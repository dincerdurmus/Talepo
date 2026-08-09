import {
  formatNeighborhoodsLabel,
  parseNeighborhoods,
  serializeNeighborhoods,
} from "@/lib/geo/neighborhoods";
import {
  findProvinceAndDistrictInText,
  formatRealEstateCity,
  isValidRealEstateLocation,
  parseRealEstateCity,
} from "@/lib/geo/turkey-districts";

export type RealEstateLocation = {
  il: string;
  ilce: string;
  mahalleler: string[];
};

export function resolveRealEstateLocationFromSources(options: {
  /** When true, never override with AI/text — even if only il is set. */
  preferManual?: boolean;
  manual?: RealEstateLocation;
  parsedCity?: string | null;
  rawText?: string;
  parsedNeighborhoods?: string | null;
}): RealEstateLocation {
  const parsedMahalleler = parseNeighborhoods(options.parsedNeighborhoods);

  if (options.preferManual && options.manual) {
    return {
      il: options.manual.il ?? "",
      ilce: options.manual.ilce ?? "",
      mahalleler: options.manual.mahalleler ?? [],
    };
  }

  if (
    options.manual?.il &&
    options.manual.ilce &&
    isValidRealEstateLocation(options.manual.il, options.manual.ilce)
  ) {
    return {
      ...options.manual,
      mahalleler: options.manual.mahalleler ?? [],
    };
  }

  const fromCity = parseRealEstateCity(options.parsedCity);
  if (fromCity?.il && fromCity.ilce) {
    return {
      il: fromCity.il,
      ilce: fromCity.ilce,
      mahalleler: parsedMahalleler,
    };
  }

  const fromText = options.rawText
    ? findProvinceAndDistrictInText(options.rawText)
    : null;
  if (fromText?.il && fromText.ilce) {
    return {
      il: fromText.il,
      ilce: fromText.ilce,
      mahalleler: parsedMahalleler,
    };
  }

  if (fromCity?.il) {
    return { il: fromCity.il, ilce: "", mahalleler: [] };
  }
  if (fromText?.il) {
    return { il: fromText.il, ilce: "", mahalleler: [] };
  }

  return { il: "", ilce: "", mahalleler: [] };
}

export function realEstateLocationToCity(location: RealEstateLocation): string {
  if (!isValidRealEstateLocation(location.il, location.ilce)) return "";
  return formatRealEstateCity(location.il, location.ilce);
}

export function realEstateLocationError(
  location: RealEstateLocation,
): string | null {
  if (!location.il?.trim()) return "İl seçimi zorunludur.";
  if (!location.ilce?.trim()) return "İlçe seçimi zorunludur.";
  if (!isValidRealEstateLocation(location.il, location.ilce)) {
    return "Geçerli bir il ve ilçe seçiniz.";
  }
  return null;
}

export function neighborhoodsFieldValue(location: RealEstateLocation): string {
  return serializeNeighborhoods(location.mahalleler ?? []);
}

export function neighborhoodsDisplayValue(location: RealEstateLocation): string {
  return formatNeighborhoodsLabel(location.mahalleler ?? []);
}
