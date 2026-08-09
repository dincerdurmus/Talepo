/** Client-safe neighborhood helpers (no large JSON import). */

export function serializeNeighborhoods(mahalleler: string[]): string {
  const unique = [
    ...new Set(
      mahalleler
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
  return unique.length ? JSON.stringify(unique) : "";
}

export function parseNeighborhoods(value?: string | null): string[] {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return [
        ...new Set(
          parsed
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ];
    }
  } catch {
    // Fallback: comma / pipe separated text
  }
  return [
    ...new Set(
      value
        .split(/[,|]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function formatNeighborhoodsLabel(mahalleler: string[]): string {
  return mahalleler.filter(Boolean).join(", ");
}

export const NEIGHBORHOODS_FIELD_KEY = "neighborhoods";
