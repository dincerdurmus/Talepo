/**
 * Rate-limited HTTP fetch with robots.txt respect, timeouts, limited retries.
 * Never bypasses captcha/login/anti-bot.
 */

import type { AccessStatus, DiscoveryMode, RateLimitPolicy } from "./types";
import {
  fingerprintRequest,
  lookupFreshCache,
  writeCacheEntry,
} from "./source-cache";

export type FetchOutcome = {
  accessStatus: AccessStatus;
  fetchAttempts: number;
  statusCode?: number;
  url: string;
  body?: string;
  contentType?: string;
  fromCache: boolean;
  requestFingerprint: string;
  errorMessage?: string;
  robotsBlocked?: boolean;
};

const lastRequestAt = new Map<string, number>();
const robotsCache = new Map<
  string,
  {
    fetchedAt: number;
    disallows: string[];
    allows: string[];
    allowAll: boolean;
    fetchFailed: boolean;
  }
>();

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function originOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return url;
  }
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return "/";
  }
}

async function loadRobots(
  robotsUrl: string,
  timeoutMs: number,
): Promise<{
  disallows: string[];
  allows: string[];
  allowAll: boolean;
  fetchFailed: boolean;
}> {
  const cached = robotsCache.get(robotsUrl);
  if (cached && Date.now() - cached.fetchedAt < 3600_000) {
    return cached;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(robotsUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "TalepoCatalogIngest/2.0 (dry-run; +https://talepo.local)",
        Accept: "text/plain",
      },
    });
    if (!res.ok) {
      const entry = {
        fetchedAt: Date.now(),
        disallows: [] as string[],
        allows: [] as string[],
        allowAll: true,
        fetchFailed: true,
      };
      robotsCache.set(robotsUrl, entry);
      return entry;
    }
    const text = await res.text();
    const disallows: string[] = [];
    const allows: string[] = [];
    let inStar = false;
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (/^user-agent:\s*\*/i.test(t)) {
        inStar = true;
        continue;
      }
      if (/^user-agent:/i.test(t)) {
        inStar = false;
        continue;
      }
      if (!inStar) continue;
      const disallow = t.match(/^disallow:\s*(.*)$/i);
      if (disallow) {
        const v = disallow[1]!.trim();
        if (v) disallows.push(v);
        continue;
      }
      const allow = t.match(/^allow:\s*(.*)$/i);
      if (allow) {
        const v = allow[1]!.trim();
        if (v) allows.push(v);
      }
    }
    const entry = {
      fetchedAt: Date.now(),
      disallows,
      allows,
      allowAll: disallows.length === 0,
      fetchFailed: false,
    };
    robotsCache.set(robotsUrl, entry);
    return entry;
  } catch {
    const entry = {
      fetchedAt: Date.now(),
      disallows: [] as string[],
      allows: [] as string[],
      allowAll: true,
      fetchFailed: true,
    };
    robotsCache.set(robotsUrl, entry);
    return entry;
  } finally {
    clearTimeout(timer);
  }
}

function isPathDisallowed(
  pathname: string,
  search: string,
  disallows: string[],
  allows: string[],
): boolean {
  const full = `${pathname}${search || ""}`;
  // Longest Allow match wins over Disallow when more specific (common robots semantics)
  let bestAllow = -1;
  for (const rule of allows) {
    if (full.startsWith(rule) || pathname.startsWith(rule)) {
      bestAllow = Math.max(bestAllow, rule.length);
    }
  }
  let bestDisallow = -1;
  for (const rule of disallows) {
    if (rule === "/") {
      bestDisallow = Math.max(bestDisallow, 1);
      continue;
    }
    if (full.startsWith(rule) || pathname.startsWith(rule)) {
      bestDisallow = Math.max(bestDisallow, rule.length);
    }
  }
  if (bestAllow > bestDisallow) return false;
  if (bestDisallow >= 0) return true;
  return false;
}

async function respectRateLimit(
  sourceId: string,
  policy: RateLimitPolicy,
): Promise<void> {
  const minInterval = policy.minIntervalMs ?? 1000;
  const last = lastRequestAt.get(sourceId) ?? 0;
  const wait = minInterval - (Date.now() - last);
  if (wait > 0) await sleep(wait);
  lastRequestAt.set(sourceId, Date.now());
}

export async function fetchPublicUrl(opts: {
  sourceId: string;
  url: string;
  allowNetwork?: boolean;
  policy?: RateLimitPolicy;
  robotsUrl?: string;
  maxRetries?: number;
  useCache?: boolean;
  ttlSeconds?: number;
  discoveryMode?: DiscoveryMode;
  accept?: string;
}): Promise<FetchOutcome> {
  const policy = opts.policy ?? { timeoutMs: 10_000, minIntervalMs: 1000 };
  const timeoutMs = policy.timeoutMs ?? 10_000;
  const maxRetries = opts.maxRetries ?? 1;
  const discoveryMode = opts.discoveryMode ?? "FULL_DISCOVERY";
  const fingerprint = fingerprintRequest({
    sourceId: opts.sourceId,
    url: opts.url,
    mode: discoveryMode,
  });

  if (opts.allowNetwork === false) {
    return {
      accessStatus: "SOURCE_UNAVAILABLE",
      fetchAttempts: 0,
      url: opts.url,
      fromCache: false,
      requestFingerprint: fingerprint,
      errorMessage: "Network disabled (allowNetwork=false).",
    };
  }

  if (opts.useCache !== false) {
    const cached = lookupFreshCache(fingerprint);
    if (cached.hit && cached.body != null) {
      return {
        accessStatus: cached.entry.status,
        fetchAttempts: 0,
        url: opts.url,
        body: cached.body,
        contentType: cached.entry.contentType,
        fromCache: true,
        requestFingerprint: fingerprint,
      };
    }
  }

  const robotsUrl = opts.robotsUrl ?? `${originOf(opts.url)}/robots.txt`;
  const robots = await loadRobots(robotsUrl, Math.min(timeoutMs, 5000));
  let pathBlocked = false;
  try {
    const u = new URL(opts.url);
    pathBlocked =
      !robots.fetchFailed &&
      isPathDisallowed(u.pathname, u.search, robots.disallows, robots.allows);
  } catch {
    pathBlocked =
      !robots.fetchFailed &&
      isPathDisallowed(pathOf(opts.url), "", robots.disallows, robots.allows);
  }
  if (pathBlocked) {
    writeCacheEntry(
      {
        sourceId: opts.sourceId,
        requestFingerprint: fingerprint,
        retrievedAt: new Date().toISOString(),
        contentHash: "robots-blocked",
        status: "ACCESS_BLOCKED",
        ttlSeconds: opts.ttlSeconds ?? 3600,
        discoveryMode,
        url: opts.url,
      },
      undefined,
    );
    return {
      accessStatus: "ACCESS_BLOCKED",
      fetchAttempts: 0,
      url: opts.url,
      fromCache: false,
      requestFingerprint: fingerprint,
      robotsBlocked: true,
      errorMessage: `robots.txt Disallow matched for ${pathOf(opts.url)}`,
    };
  }

  let fetchAttempts = 0;
  let lastError = "";
  let lastStatus: AccessStatus = "FAILED";
  let statusCode: number | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await respectRateLimit(opts.sourceId, policy);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      fetchAttempts += 1;
      const res = await fetch(opts.url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent":
            "TalepoCatalogIngest/2.0 (knowledge dry-run; respectful; no login bypass)",
          Accept:
            opts.accept ??
            "application/ld+json, application/json, text/html;q=0.9, */*;q=0.8",
        },
      });
      statusCode = res.status;
      const contentType = res.headers.get("content-type") ?? undefined;

      if (res.status === 429) {
        lastStatus = "RATE_LIMITED";
        lastError = "HTTP 429";
        if (attempt < maxRetries) {
          await sleep(1500 * (attempt + 1));
          continue;
        }
        break;
      }
      if (res.status === 401 || res.status === 403) {
        lastStatus = "ACCESS_BLOCKED";
        lastError = `HTTP ${res.status}`;
        break;
      }
      if (res.status === 404) {
        lastStatus = "SOURCE_UNAVAILABLE";
        lastError = "HTTP 404";
        break;
      }
      if (!res.ok) {
        lastStatus = "SOURCE_UNAVAILABLE";
        lastError = `HTTP ${res.status}`;
        if (attempt < maxRetries) continue;
        break;
      }

      const body = await res.text();
      // Heuristic: captcha / login walls on HTML only — never treat JSON APIs as login walls
      const isHtml = (contentType ?? "").includes("text/html") || /^\s*</.test(body);
      if (isHtml) {
        const lower = body.slice(0, 4000).toLowerCase();
        if (
          lower.includes("captcha") ||
          lower.includes("cf-browser-verification") ||
          lower.includes("attention required") ||
          (lower.includes("login") &&
            lower.includes("password") &&
            body.length < 8000)
        ) {
          writeCacheEntry(
            {
              sourceId: opts.sourceId,
              requestFingerprint: fingerprint,
              retrievedAt: new Date().toISOString(),
              contentHash: "access-blocked",
              status: "ACCESS_BLOCKED",
              ttlSeconds: opts.ttlSeconds ?? 1800,
              discoveryMode,
              contentType,
              url: opts.url,
            },
            undefined,
          );
          return {
            accessStatus: "ACCESS_BLOCKED",
            fetchAttempts,
            statusCode,
            url: opts.url,
            fromCache: false,
            requestFingerprint: fingerprint,
            contentType,
            errorMessage: "Access challenge / login wall detected — no bypass.",
          };
        }
      }

      writeCacheEntry(
        {
          sourceId: opts.sourceId,
          requestFingerprint: fingerprint,
          retrievedAt: new Date().toISOString(),
          contentHash: "",
          status: "AVAILABLE",
          ttlSeconds: opts.ttlSeconds ?? 3600,
          discoveryMode,
          contentType,
          url: opts.url,
        },
        body,
      );

      return {
        accessStatus: "AVAILABLE",
        fetchAttempts,
        statusCode,
        url: opts.url,
        body,
        contentType,
        fromCache: false,
        requestFingerprint: fingerprint,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      lastStatus =
        /abort/i.test(lastError) ? "SOURCE_UNAVAILABLE" : "SOURCE_UNAVAILABLE";
      if (attempt < maxRetries) await sleep(400 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }

  writeCacheEntry(
    {
      sourceId: opts.sourceId,
      requestFingerprint: fingerprint,
      retrievedAt: new Date().toISOString(),
      contentHash: "error",
      status: lastStatus,
      ttlSeconds: 600,
      discoveryMode,
      url: opts.url,
    },
    undefined,
  );

  return {
    accessStatus: lastStatus,
    fetchAttempts,
    statusCode,
    url: opts.url,
    fromCache: false,
    requestFingerprint: fingerprint,
    errorMessage: lastError,
  };
}
