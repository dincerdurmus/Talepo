import type { CatalogDomainProvider } from "../types";
import { getCatalogRegistry } from "../registry";
import { getAutomotiveIndexes } from "./indexes";

export function createAutomotiveCatalogProvider(): CatalogDomainProvider {
  return {
    domainId: "automotive",
    version: "1.0.0",
    ready: true,
    ensureReady() {
      getAutomotiveIndexes();
    },
  };
}

export function ensureAutomotiveCatalogRegistered(): CatalogDomainProvider {
  const registry = getCatalogRegistry();
  const existing = registry.get("automotive");
  if (existing) {
    existing.ensureReady();
    return existing;
  }
  const provider = createAutomotiveCatalogProvider();
  registry.register(provider);
  provider.ensureReady();
  return provider;
}
