import type { ExternalPriceObservation } from "@/lib/price-intelligence/types";
import {
  DATAFORSEO_CONFIG,
  isDataForSeoConfigured,
} from "@/lib/price-intelligence/provider-config";

export type DataForSeoSearchInput = {
  keyword: string;
  locationName?: string;
  languageCode?: string;
  /** Inject fetch for testing */
  fetchImpl?: typeof fetch;
};

type DataForSeoTaskResponse = {
  status_code?: number;
  status_message?: string;
  tasks?: Array<{
    id?: string;
    status_code?: number;
    status_message?: string;
    result?: Array<{
      keyword?: string;
      items?: DataForSeoRawItem[];
    }>;
  }>;
};

type DataForSeoRating = {
  value?: string | number;
};

type DataForSeoRawItem = {
  type?: string;
  rank_group?: number;
  rank_absolute?: number;
  title?: string;
  price?: number;
  currency?: string;
  url?: string;
  shopping_url?: string;
  domain?: string;
  product_id?: string;
  gid?: string;
  data_docid?: string;
  description?: string;
  seller?: string;
  tags?: string[];
  rating?: DataForSeoRating;
  product_rating?: DataForSeoRating;
  items?: DataForSeoRawItem[];
};

export type DataForSeoParseStats = {
  supportedItemTypes: string[];
  unknownTypeCount: number;
  unknownTypes: Record<string, number>;
  skippedInvalidPrice: number;
  skippedMissingTitle: number;
  skippedMissingCurrency: number;
  duplicatesSkipped: number;
  normalizedCount: number;
};

const DIRECT_PRODUCT_TYPES = new Set(["google_shopping_serp", "google_shopping_paid"]);
const CAROUSEL_CONTAINER_TYPES = new Set([
  "google_shopping_carousel",
  "google_shopping_sponsored_carousel",
]);
const NESTED_PRODUCT_TYPES = new Set([
  "google_shopping_carousel_element",
  "google_shopping_sponsored_carousel_element",
]);

export const DATAFORSEO_SUPPORTED_ITEM_TYPES = [
  ...DIRECT_PRODUCT_TYPES,
  ...NESTED_PRODUCT_TYPES,
] as const;

const DATAFORSEO_OK = 20000;
const DATAFORSEO_TASK_CREATED = 20100;
const TASK_IN_QUEUE = 40601;
const TASK_IN_PROGRESS = 40602;

const EMPTY_PARSE_STATS: DataForSeoParseStats = {
  supportedItemTypes: [...DATAFORSEO_SUPPORTED_ITEM_TYPES],
  unknownTypeCount: 0,
  unknownTypes: {},
  skippedInvalidPrice: 0,
  skippedMissingTitle: 0,
  skippedMissingCurrency: 0,
  duplicatesSkipped: 0,
  normalizedCount: 0,
};

let lastParseStats: DataForSeoParseStats = { ...EMPTY_PARSE_STATS, unknownTypes: {} };

function isTaskPostSuccess(statusCode: number | undefined): boolean {
  return statusCode === DATAFORSEO_OK || statusCode === DATAFORSEO_TASK_CREATED;
}

function authHeader(): string {
  const creds = `${DATAFORSEO_CONFIG.login}:${DATAFORSEO_CONFIG.password}`;
  return `Basic ${Buffer.from(creds).toString("base64")}`;
}

function formatStatus(code: number | undefined, message: string | undefined): string {
  return `${code ?? "unknown"}${message ? `: ${message}` : ""}`;
}

function assertTopLevelStatus(phase: string, data: DataForSeoTaskResponse): void {
  if (data.status_code !== DATAFORSEO_OK) {
    throw new Error(
      `DataForSEO ${phase} status ${formatStatus(data.status_code, data.status_message)}`,
    );
  }
}

function assertTaskPostSuccess(data: DataForSeoTaskResponse): string {
  assertTopLevelStatus("task_post", data);

  const task = data.tasks?.[0];
  if (!task) {
    throw new Error("DataForSEO task_post empty tasks array");
  }

  if (!isTaskPostSuccess(task.status_code)) {
    throw new Error(
      `DataForSEO task_post task status ${formatStatus(task.status_code, task.status_message)}`,
    );
  }

  if (!task.id) {
    throw new Error("DataForSEO task_post missing task id");
  }

  return task.id;
}

function buildTaskPostPayload(keyword: string, languageCode: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    keyword,
    language_code: languageCode,
    depth: 20,
    tag: "talepo-price-intelligence",
  };

  if (Number.isFinite(DATAFORSEO_CONFIG.locationCode) && DATAFORSEO_CONFIG.locationCode > 0) {
    payload.location_code = DATAFORSEO_CONFIG.locationCode;
  } else {
    payload.location_name = DATAFORSEO_CONFIG.locationName;
  }

  return payload;
}

function readRatingValue(item: DataForSeoRawItem): number | null {
  const candidates = [item.product_rating?.value, item.rating?.value];
  for (const raw of candidates) {
    if (raw == null) continue;
    const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function inferCondition(title: string, tags?: string[]): string | null {
  const combined = `${title} ${(tags ?? []).join(" ")}`.toLocaleLowerCase("tr-TR");
  if (
    /refurb|renewed|yenilenmiş|yenilenmis|reconditioned|certified refurbished/.test(combined)
  ) {
    return "refurbished";
  }
  if (/ikinci el|2\. el|2 el|used|pre-owned|preowned|a kalite/.test(combined)) {
    return "used";
  }
  return null;
}

function stableExternalId(item: DataForSeoRawItem, fallbackIndex: number): string | null {
  if (item.gid) return `gid:${item.gid}`;
  if (item.product_id) return `pid:${item.product_id}`;
  if (item.data_docid) return `doc:${item.data_docid}`;
  if (item.rank_absolute != null) return `rank-abs:${item.rank_absolute}`;
  if (item.rank_group != null) return `rank-grp:${item.rank_group}`;
  if (fallbackIndex >= 0) return `idx:${fallbackIndex}`;
  return null;
}

function isValidPrice(price: number | undefined): price is number {
  return price != null && Number.isFinite(price) && price > 0;
}

function resolveCurrency(item: DataForSeoRawItem): string | null {
  const raw = item.currency?.trim();
  if (!raw) return null;
  return raw.toUpperCase();
}

function itemToObservation(
  item: DataForSeoRawItem,
  stats: DataForSeoParseStats,
  fallbackIndex: number,
  sourceItemType: string,
): ExternalPriceObservation | null {
  if (!isValidPrice(item.price)) {
    stats.skippedInvalidPrice++;
    return null;
  }

  const title = item.title?.trim();
  if (!title) {
    stats.skippedMissingTitle++;
    return null;
  }

  const currency = resolveCurrency(item);
  if (!currency) {
    stats.skippedMissingCurrency++;
    return null;
  }

  const externalId = stableExternalId(item, fallbackIndex);
  if (!externalId) {
    stats.skippedInvalidPrice++;
    return null;
  }

  const condition = inferCondition(title, item.tags);
  const locationLabel = DATAFORSEO_CONFIG.locationName;

  return {
    provider: "dataforseo-google-shopping",
    externalId,
    title,
    price: item.price,
    currency,
    condition,
    location: locationLabel,
    url: item.shopping_url ?? item.url ?? null,
    observedAt: new Date(),
    sourceType: "EXTERNAL_LISTING",
    rawMetadata: {
      domain: item.domain ?? null,
      seller: item.seller ?? null,
      rank: item.rank_group ?? item.rank_absolute ?? null,
      rating: readRatingValue(item),
      sourceItemType,
      conditionSignal: condition,
      tags: item.tags ?? null,
    },
  };
}

function recordUnknownType(stats: DataForSeoParseStats, type: string): void {
  stats.unknownTypeCount++;
  stats.unknownTypes[type] = (stats.unknownTypes[type] ?? 0) + 1;
}

function collectProductCandidates(
  items: DataForSeoRawItem[] | undefined,
  stats: DataForSeoParseStats,
): Array<{ item: DataForSeoRawItem; sourceItemType: string }> {
  const candidates: Array<{ item: DataForSeoRawItem; sourceItemType: string }> = [];
  if (!items?.length) return candidates;

  for (const item of items) {
    const type = item.type ?? "";

    if (DIRECT_PRODUCT_TYPES.has(type)) {
      candidates.push({ item, sourceItemType: type });
      continue;
    }

    if (CAROUSEL_CONTAINER_TYPES.has(type)) {
      const nested = item.items ?? [];
      for (const child of nested) {
        const childType = child.type ?? "";
        if (NESTED_PRODUCT_TYPES.has(childType)) {
          candidates.push({ item: child, sourceItemType: childType });
        } else if (childType) {
          recordUnknownType(stats, childType);
        }
      }
      continue;
    }

    if (type && type !== "related_searches") {
      recordUnknownType(stats, type);
    }
  }

  return candidates;
}

function parseProductItems(items: DataForSeoRawItem[] | undefined): ExternalPriceObservation[] {
  const stats: DataForSeoParseStats = {
    ...EMPTY_PARSE_STATS,
    unknownTypes: {},
  };

  const candidates = collectProductCandidates(items, stats);
  const seenIds = new Set<string>();
  const observations: ExternalPriceObservation[] = [];

  candidates.forEach(({ item, sourceItemType }, index) => {
    const observation = itemToObservation(item, stats, index, sourceItemType);
    if (!observation) return;

    if (seenIds.has(observation.externalId)) {
      stats.duplicatesSkipped++;
      return;
    }

    seenIds.add(observation.externalId);
    observations.push(observation);
  });

  stats.normalizedCount = observations.length;
  lastParseStats = stats;
  return observations;
}

export function getLastDataForSeoParseStats(): DataForSeoParseStats {
  return lastParseStats;
}

async function postTask(
  fetchImpl: typeof fetch,
  keyword: string,
  languageCode: string,
): Promise<string> {
  const res = await fetchImpl(`${DATAFORSEO_CONFIG.apiBase}/merchant/google/products/task_post`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify([buildTaskPostPayload(keyword, languageCode)]),
    signal: AbortSignal.timeout(DATAFORSEO_CONFIG.requestTimeoutMs),
  });

  const data = (await res.json()) as DataForSeoTaskResponse;

  if (!res.ok) {
    throw new Error(
      `DataForSEO task_post HTTP ${res.status} — ${formatStatus(data.status_code, data.status_message)}`,
    );
  }

  return assertTaskPostSuccess(data);
}

type TaskGetOutcome =
  | { state: "pending" }
  | { state: "ready"; observations: ExternalPriceObservation[] };

async function getTaskResults(
  fetchImpl: typeof fetch,
  taskId: string,
): Promise<TaskGetOutcome> {
  const res = await fetchImpl(
    `${DATAFORSEO_CONFIG.apiBase}/merchant/google/products/task_get/advanced/${taskId}`,
    {
      method: "GET",
      headers: { Authorization: authHeader() },
      signal: AbortSignal.timeout(DATAFORSEO_CONFIG.requestTimeoutMs),
    },
  );

  const data = (await res.json()) as DataForSeoTaskResponse;

  if (!res.ok) {
    throw new Error(
      `DataForSEO task_get HTTP ${res.status} — ${formatStatus(data.status_code, data.status_message)}`,
    );
  }

  assertTopLevelStatus("task_get", data);

  const task = data.tasks?.[0];
  if (!task) {
    throw new Error("DataForSEO task_get empty tasks array");
  }

  if (task.status_code === TASK_IN_QUEUE || task.status_code === TASK_IN_PROGRESS) {
    return { state: "pending" };
  }

  if (task.status_code !== DATAFORSEO_OK) {
    throw new Error(
      `DataForSEO task_get task status ${formatStatus(task.status_code, task.status_message)}`,
    );
  }

  const items = task.result?.[0]?.items ?? [];
  return { state: "ready", observations: parseProductItems(items) };
}

/**
 * Search Google Shopping via DataForSEO Merchant API (task_post + poll task_get).
 * Returns empty array when credentials missing — never throws for NOT_CONFIGURED.
 */
export async function searchDataForSeoGoogleShopping(
  input: DataForSeoSearchInput,
): Promise<ExternalPriceObservation[]> {
  if (!isDataForSeoConfigured()) {
    return [];
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const languageCode = input.languageCode ?? DATAFORSEO_CONFIG.languageCode;

  const taskId = await postTask(fetchImpl, input.keyword, languageCode);

  for (let attempt = 0; attempt < DATAFORSEO_CONFIG.maxPollAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, DATAFORSEO_CONFIG.pollIntervalMs));
    const outcome = await getTaskResults(fetchImpl, taskId);

    if (outcome.state === "ready") {
      return outcome.observations;
    }

    if (attempt === DATAFORSEO_CONFIG.maxPollAttempts - 1) {
      const final = await getTaskResults(fetchImpl, taskId);
      return final.state === "ready" ? final.observations : [];
    }
  }

  return [];
}

/** Parse mocked response for tests */
export function parseDataForSeoMockResponse(data: DataForSeoTaskResponse): ExternalPriceObservation[] {
  const items = data.tasks?.[0]?.result?.[0]?.items ?? [];
  return parseProductItems(items);
}

export function getDataForSeoProviderStatus(): "CONFIGURED" | "NOT_CONFIGURED" {
  return isDataForSeoConfigured() ? "CONFIGURED" : "NOT_CONFIGURED";
}

/** Exposed for verify scripts — documents active location routing */
export function getDataForSeoLocationConfig(): {
  primary: "location_code" | "location_name";
  locationCode: number | null;
  locationName: string;
} {
  const useCode =
    Number.isFinite(DATAFORSEO_CONFIG.locationCode) && DATAFORSEO_CONFIG.locationCode > 0;

  return {
    primary: useCode ? "location_code" : "location_name",
    locationCode: useCode ? DATAFORSEO_CONFIG.locationCode : null,
    locationName: DATAFORSEO_CONFIG.locationName,
  };
}
