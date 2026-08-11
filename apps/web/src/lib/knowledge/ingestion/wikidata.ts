/**
 * Optional Wikidata SPARQL helper — structured free API only.
 * Failures → SOURCE_UNAVAILABLE; never bypasses access restrictions.
 */

import type { AccessStatus } from "./types";

export type WikidataSparqlResult = {
  accessStatus: AccessStatus;
  fetchAttempts: number;
  bindings: Array<Record<string, { type: string; value: string }>>;
  errorMessage?: string;
  fingerprint?: string;
};

const DEFAULT_ENDPOINT = "https://query.wikidata.org/sparql";

export async function runWikidataSparql(
  query: string,
  opts?: {
    allowNetwork?: boolean;
    timeoutMs?: number;
    userAgent?: string;
  },
): Promise<WikidataSparqlResult> {
  if (opts?.allowNetwork === false) {
    return {
      accessStatus: "SOURCE_UNAVAILABLE",
      fetchAttempts: 0,
      bindings: [],
      errorMessage: "Network disabled (allowNetwork=false).",
    };
  }

  const timeoutMs = opts?.timeoutMs ?? 12_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let fetchAttempts = 0;

  try {
    fetchAttempts = 1;
    const url = `${DEFAULT_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent":
          opts?.userAgent ??
          "TalepoCatalogIngest/1.0 (knowledge dry-run; contact: local-dev)",
      },
    });

    if (res.status === 429) {
      return {
        accessStatus: "RATE_LIMITED",
        fetchAttempts,
        bindings: [],
        errorMessage: "Wikidata rate limited (429).",
      };
    }
    if (res.status === 403 || res.status === 401) {
      return {
        accessStatus: "MANUAL_REVIEW_REQUIRED",
        fetchAttempts,
        bindings: [],
        errorMessage: `Wikidata access blocked (${res.status}).`,
      };
    }
    if (!res.ok) {
      return {
        accessStatus: "SOURCE_UNAVAILABLE",
        fetchAttempts,
        bindings: [],
        errorMessage: `Wikidata HTTP ${res.status}`,
      };
    }

    const json = (await res.json()) as {
      results?: { bindings?: Array<Record<string, { type: string; value: string }>> };
    };
    const bindings = json.results?.bindings ?? [];
    return {
      accessStatus: "AVAILABLE",
      fetchAttempts,
      bindings,
      fingerprint: `wikidata:${bindings.length}:${query.length}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      accessStatus: "SOURCE_UNAVAILABLE",
      fetchAttempts,
      bindings: [],
      errorMessage: message,
    };
  } finally {
    clearTimeout(timer);
  }
}
