import neighborhoodsByDistrict from "@/lib/geo/data/neighborhoods-by-district.json";

import { parseNeighborhoods } from "@/lib/geo/neighborhoods";

export type NeighborhoodLookup = Record<string, string[]>;

const LOOKUP = neighborhoodsByDistrict as NeighborhoodLookup;

/** Per-district memo for repeated lookups in a single request lifecycle. */
const districtCache = new Map<string, string[]>();

export function neighborhoodDistrictKey(il: string, ilce: string): string {
  return `${il.trim()}|${ilce.trim()}`;
}

export function getNeighborhoodsForDistrict(il: string, ilce: string): string[] {
  if (!il?.trim() || !ilce?.trim()) return [];
  const key = neighborhoodDistrictKey(il, ilce);
  const cached = districtCache.get(key);
  if (cached) return cached;
  const list = LOOKUP[key] ?? [];
  districtCache.set(key, list);
  return list;
}

export function hasNeighborhoodsForDistrict(il: string, ilce: string): boolean {
  return getNeighborhoodsForDistrict(il, ilce).length > 0;
}

export function isValidNeighborhoodSelection(
  il: string,
  ilce: string,
  mahalleler: string[],
): boolean {
  if (!mahalleler.length) return false;
  const allowed = new Set(getNeighborhoodsForDistrict(il, ilce));
  if (!allowed.size) return false;
  return mahalleler.every((name) => allowed.has(name));
}

export function filterValidNeighborhoods(
  il: string,
  ilce: string,
  mahalleler: string[],
): string[] {
  const allowed = new Set(getNeighborhoodsForDistrict(il, ilce));
  return [
    ...new Set(
      mahalleler
        .map((item) => item.trim())
        .filter((name) => name && allowed.has(name)),
    ),
  ];
}

export { parseNeighborhoods };
