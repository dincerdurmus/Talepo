import { getProviderProfile } from "@/lib/price-intelligence/category-registry";

import {
  dataForSeoGoogleShoppingProvider,
  type PriceDataProvider,
} from "./types";

/** Internal Talepo observations — always persistable, all categories */
const internalProvider: PriceDataProvider = {
  id: "talepo-internal",
  name: "Talepo Internal",
  capabilities: ["LISTING_PRICE", "SOLD_PRICE", "HISTORICAL_PRICE"],
  dataPolicy: {
    canPersist: true,
    retentionPolicy: "indefinite",
    termsReference: "talepo-internal",
  },
  supportsCategory: ({ categorySlug }) =>
    getProviderProfile(categorySlug).internal,
  getStatus: () => "CONFIGURED",
};

const registry = new Map<string, PriceDataProvider>([
  [internalProvider.id, internalProvider],
  [dataForSeoGoogleShoppingProvider.id, dataForSeoGoogleShoppingProvider],
]);

export function registerPriceDataProvider(provider: PriceDataProvider) {
  registry.set(provider.id, provider);
}

export function getPriceDataProvider(id: string): PriceDataProvider | undefined {
  return registry.get(id);
}

export function listPriceDataProviders(): PriceDataProvider[] {
  return [...registry.values()];
}

export function listProvidersByCapability(
  capability: PriceDataProvider["capabilities"][number],
): PriceDataProvider[] {
  return listPriceDataProviders().filter((p) =>
    p.capabilities.includes(capability),
  );
}

export function listProvidersForCategory(
  categorySlug: string,
  normalizedProduct?: import("@/lib/price-intelligence/types").NormalizedProduct,
): PriceDataProvider[] {
  return listPriceDataProviders().filter((p) => {
    if (!p.supportsCategory) return true;
    return (
      p.supportsCategory({
        categoryId: "",
        categorySlug,
        normalizedProduct,
      }) >= 0.2
    );
  });
}

export { internalProvider, dataForSeoGoogleShoppingProvider };
