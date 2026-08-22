/**
 * Turkish province allowlist for privacy-safe location telemetry.
 *
 * Slice 2a location contract (docs/ai-handoff/09-NEXT-PHASE-RECOMMENDATION.md,
 * 11-DECISION-LOG.md — Karar C):
 *
 * - `provinceCode` may ONLY be a member of this allowlist. It is never a string
 *   derived from user free text.
 * - When the input cannot be converted to a canonical province with certainty,
 *   NO code is emitted — we report `unknown` instead of guessing.
 * - District / neighbourhood / address are never resolved, derived or logged.
 *   This module deliberately exposes no district-level API.
 *
 * SINGLE AUTHORITY FOR PROVINCE NAMES
 * -----------------------------------
 * The canonical province labels are NOT re-declared here. They are read at
 * module load from `@/lib/geo/turkey-districts` (`TURKEY_IL_NAMES`), which is
 * the repository's existing geography source. This module contributes exactly
 * one thing that has no other source in the repository: the ISO 3166-2:TR code
 * assignment. (There is no province-code column in `prisma/schema.prisma` and no
 * plate/ISO table anywhere under `src/` — verified before adding this map.)
 *
 * The code table is keyed by the ASCII-folded province name rather than by the
 * exact label, so diacritic-level edits in the geography registry (for example
 * "Hakkari" → "Hakkâri") cannot silently drop a province. Any real drift — an
 * added, removed or renamed province — leaves an entry unmatched, which
 * `getProvinceAllowlistDrift()` reports and `verify-fanout-telemetry-v1`
 * asserts is empty in both directions.
 */
import { TURKEY_IL_NAMES } from "@/lib/geo/turkey-districts";

const TR_FOLD_MAP: Record<string, string> = {
  ı: "i",
  İ: "i",
  I: "i",
  ş: "s",
  Ş: "s",
  ğ: "g",
  Ğ: "g",
  ü: "u",
  Ü: "u",
  ö: "o",
  Ö: "o",
  ç: "c",
  Ç: "c",
  â: "a",
  Â: "a",
  î: "i",
  Î: "i",
  û: "u",
  Û: "u",
};

/**
 * Deterministic ASCII fold. Used both to key the code table and to accept
 * plain-keyboard spellings ("Istanbul", "Kutahya"). Never fuzzy: a folded value
 * must still match a canonical province exactly.
 */
export function foldProvinceLabel(value: string): string {
  let out = "";
  for (const char of value) {
    out += TR_FOLD_MAP[char] ?? char;
  }
  return out.toLowerCase().trim();
}

/**
 * The only new information in this module: ISO 3166-2:TR code per province,
 * keyed by ASCII-folded canonical name. Labels come from the geography
 * registry — never from this table.
 */
const ISO_CODE_BY_FOLDED_NAME = {
  adana: "TR-01",
  adiyaman: "TR-02",
  afyonkarahisar: "TR-03",
  agri: "TR-04",
  amasya: "TR-05",
  ankara: "TR-06",
  antalya: "TR-07",
  artvin: "TR-08",
  aydin: "TR-09",
  balikesir: "TR-10",
  bilecik: "TR-11",
  bingol: "TR-12",
  bitlis: "TR-13",
  bolu: "TR-14",
  burdur: "TR-15",
  bursa: "TR-16",
  canakkale: "TR-17",
  cankiri: "TR-18",
  corum: "TR-19",
  denizli: "TR-20",
  diyarbakir: "TR-21",
  edirne: "TR-22",
  elazig: "TR-23",
  erzincan: "TR-24",
  erzurum: "TR-25",
  eskisehir: "TR-26",
  gaziantep: "TR-27",
  giresun: "TR-28",
  gumushane: "TR-29",
  hakkari: "TR-30",
  hatay: "TR-31",
  isparta: "TR-32",
  mersin: "TR-33",
  istanbul: "TR-34",
  izmir: "TR-35",
  kars: "TR-36",
  kastamonu: "TR-37",
  kayseri: "TR-38",
  kirklareli: "TR-39",
  kirsehir: "TR-40",
  kocaeli: "TR-41",
  konya: "TR-42",
  kutahya: "TR-43",
  malatya: "TR-44",
  manisa: "TR-45",
  kahramanmaras: "TR-46",
  mardin: "TR-47",
  mugla: "TR-48",
  mus: "TR-49",
  nevsehir: "TR-50",
  nigde: "TR-51",
  ordu: "TR-52",
  rize: "TR-53",
  sakarya: "TR-54",
  samsun: "TR-55",
  siirt: "TR-56",
  sinop: "TR-57",
  sivas: "TR-58",
  tekirdag: "TR-59",
  tokat: "TR-60",
  trabzon: "TR-61",
  tunceli: "TR-62",
  sanliurfa: "TR-63",
  usak: "TR-64",
  van: "TR-65",
  yozgat: "TR-66",
  zonguldak: "TR-67",
  aksaray: "TR-68",
  bayburt: "TR-69",
  karaman: "TR-70",
  kirikkale: "TR-71",
  batman: "TR-72",
  sirnak: "TR-73",
  bartin: "TR-74",
  ardahan: "TR-75",
  igdir: "TR-76",
  yalova: "TR-77",
  karabuk: "TR-78",
  kilis: "TR-79",
  osmaniye: "TR-80",
  duzce: "TR-81",
} as const;

export type ProvinceCode =
  (typeof ISO_CODE_BY_FOLDED_NAME)[keyof typeof ISO_CODE_BY_FOLDED_NAME];

function lookupIsoCode(folded: string): ProvinceCode | undefined {
  return (ISO_CODE_BY_FOLDED_NAME as Record<string, ProvinceCode>)[folded];
}

/* -------------------------------------------------------------------------- */
/* Derived allowlist — labels sourced from the geography registry              */
/* -------------------------------------------------------------------------- */

const labelByCode = new Map<ProvinceCode, string>();
const codeByExactLabel = new Map<string, ProvinceCode>();
const codeByFoldedLabel = new Map<string, ProvinceCode>();

for (const label of TURKEY_IL_NAMES) {
  const folded = foldProvinceLabel(label);
  const code = lookupIsoCode(folded);
  // Drift is fail-safe: an unmatched province simply gets no code, so telemetry
  // degrades to `unknown` rather than emitting a wrong one.
  if (!code || labelByCode.has(code)) continue;
  labelByCode.set(code, label);
  codeByExactLabel.set(label.toLocaleLowerCase("tr-TR"), code);
  codeByFoldedLabel.set(folded, code);
}

/** Allowlisted codes, ascending. Derived — not hand-maintained. */
export const PROVINCE_CODES: ProvinceCode[] = [...labelByCode.keys()].sort();

/** Code → canonical label, where the label is the geography registry's string. */
export const PROVINCE_ALLOWLIST: Readonly<Record<ProvinceCode, string>> =
  Object.freeze(
    Object.fromEntries(
      PROVINCE_CODES.map((code) => [code, labelByCode.get(code) as string]),
    ) as Record<ProvinceCode, string>,
  );

const PROVINCE_CODE_SET = new Set<string>(PROVINCE_CODES);

export function isProvinceCode(value: unknown): value is ProvinceCode {
  return typeof value === "string" && PROVINCE_CODE_SET.has(value);
}

/**
 * Bidirectional drift between the geography registry and the ISO code table.
 * Both sides must be empty; the verifier asserts it on every run.
 */
export function getProvinceAllowlistDrift(): {
  geoNamesWithoutCode: string[];
  isoCodesWithoutGeoName: ProvinceCode[];
} {
  const geoNamesWithoutCode = TURKEY_IL_NAMES.filter(
    (label) => !lookupIsoCode(foldProvinceLabel(label)),
  );

  const matchedCodes = new Set<string>(PROVINCE_CODES);
  const isoCodesWithoutGeoName = Object.values(ISO_CODE_BY_FOLDED_NAME).filter(
    (code) => !matchedCodes.has(code),
  );

  return { geoNamesWithoutCode, isoCodesWithoutGeoName };
}

/* -------------------------------------------------------------------------- */
/* Location contract                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Location scope vocabulary from the Slice 2a contract.
 *
 * Legacy fanout only carries a single free-text `city` column, so it can only
 * ever produce `province` or `unspecified`. `nationwide` / `remote` are part of
 * the approved contract but have no legacy source signal yet — they are
 * intentionally never emitted by this slice rather than faked.
 */
export type LocationScope = "province" | "nationwide" | "remote" | "unspecified";

export type LocationResolutionStatus = "resolved" | "unknown";

export type LocationTelemetry = {
  locationScope: LocationScope;
  resolutionStatus: LocationResolutionStatus;
  /** Only present when `locationScope === "province"` and resolution succeeded. */
  provinceCode?: ProvinceCode;
};

/**
 * Resolve a raw `Request.city` / `Company.city` value to allowlisted telemetry.
 *
 * The raw string never leaves this function: the return value is an enum plus,
 * at most, an allowlisted code. Values stored as "İl / İlçe" are truncated at
 * the separator and the district half is discarded without being inspected.
 */
export function resolveProvinceTelemetry(
  rawCity: string | null | undefined,
): LocationTelemetry {
  const trimmed = rawCity?.trim() ?? "";
  if (!trimmed) {
    return { locationScope: "unspecified", resolutionStatus: "unknown" };
  }

  // "İstanbul / Kadıköy" → province half only; the district half is dropped.
  const provincePart = trimmed.split("/")[0]?.trim() ?? "";
  if (!provincePart) {
    return { locationScope: "unspecified", resolutionStatus: "unknown" };
  }

  const code =
    codeByExactLabel.get(provincePart.toLocaleLowerCase("tr-TR")) ??
    codeByFoldedLabel.get(foldProvinceLabel(provincePart));

  if (!code) {
    // A location was supplied but is not confidently canonical — record the
    // fact, never the text.
    return { locationScope: "province", resolutionStatus: "unknown" };
  }

  return {
    locationScope: "province",
    provinceCode: code,
    resolutionStatus: "resolved",
  };
}

/**
 * Contract enforcement at the emit boundary: strips any `provinceCode` that is
 * not an allowlist member or that is paired with a non-province scope.
 */
export function normalizeLocationTelemetry(
  input: LocationTelemetry,
): LocationTelemetry {
  const scope: LocationScope =
    input.locationScope === "province" ||
    input.locationScope === "nationwide" ||
    input.locationScope === "remote"
      ? input.locationScope
      : "unspecified";

  const status: LocationResolutionStatus =
    input.resolutionStatus === "resolved" ? "resolved" : "unknown";

  // `resolved` may never survive without an allowlisted code behind it.
  if (scope !== "province" || !isProvinceCode(input.provinceCode)) {
    return { locationScope: scope, resolutionStatus: "unknown" };
  }

  return {
    locationScope: scope,
    provinceCode: input.provinceCode,
    resolutionStatus: status,
  };
}
