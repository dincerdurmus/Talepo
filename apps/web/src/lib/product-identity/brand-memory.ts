import type { BrandMemoryStore } from "./types";

/** In-memory brand alias store — optional, not seeded. Future: DB-backed. */
export function createInMemoryBrandMemory(): BrandMemoryStore {
  const aliases = new Map<string, string>();

  return {
    resolve(input: string) {
      const key = input.trim().toLocaleLowerCase("tr-TR");
      if (!key) return { canonical: null, confidence: 0 };
      const canonical = aliases.get(key);
      if (canonical) return { canonical, confidence: 0.9 };
      return { canonical: null, confidence: 0 };
    },
    remember(entry) {
      const canonical = entry.canonical.trim();
      for (const alias of [canonical, ...entry.aliases]) {
        aliases.set(alias.trim().toLocaleLowerCase("tr-TR"), canonical);
      }
    },
  };
}

export const defaultBrandMemory: BrandMemoryStore = createInMemoryBrandMemory();
