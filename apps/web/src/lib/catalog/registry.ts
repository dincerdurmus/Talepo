import type { CatalogDomainId, CatalogDomainProvider } from "./types";

/**
 * Central registry for domain catalogs (automotive, appliances, …).
 * Providers register once; indexes are owned by each provider.
 */
export class CatalogRegistry {
  private readonly providers = new Map<CatalogDomainId, CatalogDomainProvider>();

  register(provider: CatalogDomainProvider): void {
    this.providers.set(provider.domainId, provider);
  }

  get(domainId: CatalogDomainId): CatalogDomainProvider | null {
    return this.providers.get(domainId) ?? null;
  }

  has(domainId: CatalogDomainId): boolean {
    return this.providers.has(domainId);
  }

  listDomains(): CatalogDomainId[] {
    return [...this.providers.keys()];
  }
}

type GlobalCatalog = {
  __talepoCatalogRegistry?: CatalogRegistry;
};

function createAndRegister(): CatalogRegistry {
  const registry = new CatalogRegistry();
  // Lazy import to keep registry generic — provider self-registers on first access
  return registry;
}

export function getCatalogRegistry(): CatalogRegistry {
  const g = globalThis as GlobalCatalog;
  if (!g.__talepoCatalogRegistry) {
    g.__talepoCatalogRegistry = createAndRegister();
  }
  return g.__talepoCatalogRegistry;
}
