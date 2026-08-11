/**
 * Lightweight source response cache (gitignored under data/catalog-ingestion/cache/).
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";

import type { AccessStatus, DiscoveryMode } from "./types";

export type SourceCacheEntry = {
  sourceId: string;
  requestFingerprint: string;
  retrievedAt: string;
  contentHash: string;
  status: AccessStatus;
  ttlSeconds: number;
  discoveryMode?: DiscoveryMode;
  contentType?: string;
  /** Truncated body for small structured payloads; large bodies store hash-only. */
  bodyPreview?: string;
  /** Full body path relative to cache root when persisted. */
  bodyFile?: string;
  url?: string;
};

function cacheRoots(): string[] {
  const cwd = process.cwd();
  return [
    path.resolve(cwd, "../../data/catalog-ingestion/cache"),
    path.resolve(cwd, "../data/catalog-ingestion/cache"),
    path.resolve(cwd, "data/catalog-ingestion/cache"),
  ];
}

export function resolveCacheRoot(): string {
  for (const root of cacheRoots()) {
    try {
      mkdirSync(root, { recursive: true });
      return root;
    } catch {
      // try next
    }
  }
  return cacheRoots()[0]!;
}

export function fingerprintRequest(parts: {
  sourceId: string;
  url?: string;
  method?: string;
  query?: string;
  mode?: DiscoveryMode;
}): string {
  const raw = JSON.stringify({
    sourceId: parts.sourceId,
    url: parts.url ?? "",
    method: parts.method ?? "GET",
    query: parts.query ?? "",
    mode: parts.mode ?? "FULL_DISCOVERY",
  });
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

export function contentHash(body: string | Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}

function entryPath(root: string, fingerprint: string): string {
  return path.join(root, `${fingerprint}.json`);
}

export function readCacheEntry(
  fingerprint: string,
  opts?: { root?: string },
): SourceCacheEntry | null {
  const root = opts?.root ?? resolveCacheRoot();
  const full = entryPath(root, fingerprint);
  if (!existsSync(full)) return null;
  try {
    return JSON.parse(readFileSync(full, "utf8")) as SourceCacheEntry;
  } catch {
    return null;
  }
}

export function isCacheFresh(entry: SourceCacheEntry, now = Date.now()): boolean {
  const retrieved = Date.parse(entry.retrievedAt);
  if (!Number.isFinite(retrieved)) return false;
  return now - retrieved < entry.ttlSeconds * 1000;
}

export function writeCacheEntry(
  entry: SourceCacheEntry,
  body?: string,
  opts?: { root?: string; maxInlineBytes?: number },
): SourceCacheEntry {
  const root = opts?.root ?? resolveCacheRoot();
  mkdirSync(root, { recursive: true });
  const maxInline = opts?.maxInlineBytes ?? 64_000;
  const stored: SourceCacheEntry = { ...entry };

  if (body != null) {
    stored.contentHash = contentHash(body);
    if (Buffer.byteLength(body, "utf8") <= maxInline) {
      stored.bodyPreview = body;
    } else {
      const bodyFile = `${entry.requestFingerprint}.body.txt`;
      writeFileSync(path.join(root, bodyFile), body, "utf8");
      stored.bodyFile = bodyFile;
      stored.bodyPreview = body.slice(0, 2000);
    }
  }

  writeFileSync(entryPath(root, entry.requestFingerprint), JSON.stringify(stored, null, 2), "utf8");
  return stored;
}

export function loadCachedBody(
  entry: SourceCacheEntry,
  opts?: { root?: string },
): string | null {
  if (entry.bodyPreview && !entry.bodyFile) return entry.bodyPreview;
  const root = opts?.root ?? resolveCacheRoot();
  if (entry.bodyFile) {
    const full = path.join(root, entry.bodyFile);
    if (existsSync(full)) return readFileSync(full, "utf8");
  }
  return entry.bodyPreview ?? null;
}

export function listCacheEntries(opts?: { root?: string }): SourceCacheEntry[] {
  const root = opts?.root ?? resolveCacheRoot();
  if (!existsSync(root)) return [];
  const out: SourceCacheEntry[] = [];
  for (const name of readdirSync(root)) {
    if (!name.endsWith(".json") || name.endsWith(".body.txt")) continue;
    try {
      out.push(JSON.parse(readFileSync(path.join(root, name), "utf8")) as SourceCacheEntry);
    } catch {
      // skip
    }
  }
  return out;
}

export type CacheLookupResult =
  | { hit: true; entry: SourceCacheEntry; body: string | null; mode: "CACHE" }
  | { hit: false };

export function lookupFreshCache(
  fingerprint: string,
  opts?: { root?: string; now?: number },
): CacheLookupResult {
  const entry = readCacheEntry(fingerprint, opts);
  if (!entry || !isCacheFresh(entry, opts?.now)) return { hit: false };
  return {
    hit: true,
    entry,
    body: loadCachedBody(entry, opts),
    mode: "CACHE",
  };
}
