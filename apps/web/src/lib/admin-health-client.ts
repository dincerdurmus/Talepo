type CacheEntry = { expiresAt: number; value: unknown };

const CACHE_TTL_MS = 10_000;
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

export async function fetchAdminHealth<T>(url: string, options?: { force?: boolean }): Promise<T> {
  const now = Date.now();
  const cached = cache.get(url);
  if (!options?.force && cached && cached.expiresAt > now) return cached.value as T;

  const active = inFlight.get(url);
  if (active) return active as Promise<T>;

  const request = fetch(url, { cache: "no-store" })
    .then(async (response) => {
      const value = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || value.ok === false) throw new Error(value.message ?? "Veriler alınamadı.");
      cache.set(url, { expiresAt: Date.now() + CACHE_TTL_MS, value });
      return value;
    })
    .finally(() => inFlight.delete(url));

  inFlight.set(url, request);
  return request as Promise<T>;
}
