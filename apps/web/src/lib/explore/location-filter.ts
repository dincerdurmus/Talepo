import type { Prisma } from "@/generated/prisma/client";

import {
  parseRealEstateCity,
  TURKEY_PROVINCES,
} from "@/lib/geo/turkey-districts";

export function parseExploreLocationList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  const seen = new Set<string>();
  const values: string[] = [];
  for (const part of raw.split(",")) {
    const value = part.trim();
    if (!value) continue;
    const key = value.toLocaleLowerCase("tr-TR");
    if (seen.has(key)) continue;
    seen.add(key);
    values.push(value);
  }
  return values;
}

function equalsInsensitive(
  field: "city" | "district",
  value: string,
): Prisma.RequestWhereInput {
  return {
    [field]: { equals: value, mode: "insensitive" as const },
  };
}

export function cityFilterWhere(
  cities: string[],
): Prisma.RequestWhereInput | null {
  if (cities.length === 0) return null;
  if (cities.length === 1) return equalsInsensitive("city", cities[0]!);
  return {
    OR: cities.map((city) => equalsInsensitive("city", city)),
  };
}

export function districtFilterWhere(
  districts: string[],
): Prisma.RequestWhereInput | null {
  if (districts.length === 0) return null;
  const clauses: Prisma.RequestWhereInput[] = [];
  for (const token of districts) {
    const pair = token.includes(" / ") ? parseRealEstateCity(token) : null;
    if (pair?.il && pair.ilce) {
      clauses.push({
        AND: [
          equalsInsensitive("city", pair.il),
          equalsInsensitive("district", pair.ilce),
        ],
      });
      continue;
    }
    clauses.push(equalsInsensitive("district", token));
  }
  if (clauses.length === 1) return clauses[0]!;
  return { OR: clauses };
}

export type ExploreDistrictChoice = {
  value: string;
  label: string;
};

export function exploreDistrictChoices(
  selectedCities: string[],
): ExploreDistrictChoice[] {
  if (selectedCities.length === 0) return [];
  const provinces = TURKEY_PROVINCES.filter((province) =>
    selectedCities.includes(province.il),
  );
  const qualify = provinces.length !== 1;
  const choices: ExploreDistrictChoice[] = [];
  for (const province of provinces) {
    for (const district of province.ilceler) {
      choices.push({
        value: qualify ? `${province.il} / ${district}` : district,
        label: qualify ? `${district} · ${province.il}` : district,
      });
    }
  }
  return choices;
}

function resolveDistrictToken(
  token: string,
  selectedCities: string[],
): { il: string; ilce: string } | null {
  if (token.includes(" / ")) {
    const pair = parseRealEstateCity(token);
    if (!pair?.il || !pair.ilce) return null;
    if (!selectedCities.includes(pair.il)) return null;
    return pair;
  }

  const matches = TURKEY_PROVINCES.filter(
    (province) =>
      selectedCities.includes(province.il) &&
      province.ilceler.includes(token),
  );
  if (matches.length !== 1) return null;
  return { il: matches[0]!.il, ilce: token };
}

export function canonicalDistrictValue(
  il: string,
  ilce: string,
  selectedCities: string[],
): string | null {
  if (!selectedCities.includes(il)) return null;
  const province = TURKEY_PROVINCES.find((entry) => entry.il === il);
  if (!province?.ilceler.includes(ilce)) return null;
  return selectedCities.length === 1 ? ilce : `${il} / ${ilce}`;
}

export function pruneExploreDistricts(
  selectedCities: string[],
  selectedDistricts: string[],
): string[] {
  if (selectedDistricts.length === 0 || selectedCities.length === 0) return [];
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const token of selectedDistricts) {
    const pair = resolveDistrictToken(token, selectedCities);
    if (!pair) continue;
    const next = canonicalDistrictValue(pair.il, pair.ilce, selectedCities);
    if (!next) continue;
    const key = next.toLocaleLowerCase("tr-TR");
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(next);
  }
  return kept;
}
