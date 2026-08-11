/**
 * Transmission commercial-name normalization.
 * Maps marketing aliases → family/type. Never invents transmissionCode.
 */

export type TransmissionFamily =
  | "MANUAL"
  | "TORQUE_CONVERTER_AUTOMATIC"
  | "DCT"
  | "DSG"
  | "CVT"
  | "E_CVT"
  | "AMT"
  | "SINGLE_SPEED_EV"
  | "OTHER"
  | "UNKNOWN";

export type TransmissionType =
  | "manual"
  | "torque_converter_automatic"
  | "dual_clutch"
  | "dsg"
  | "cvt"
  | "e_cvt"
  | "automated_manual"
  | "single_speed"
  | "other"
  | "unknown";

export type TransmissionMatchKind =
  | "exact_canonical_name"
  | "exact_marketing_name"
  | "alias"
  | "code"
  | "family_hint";

/** Marketing / commercial labels that must never become transmissionCode. */
export const MARKETING_ONLY_TRANSMISSION_LABELS = new Set([
  "dsg",
  "s-tronic",
  "s tronic",
  "stronic",
  "pdk",
  "dct",
  "cvt",
  "e-cvt",
  "ecvt",
  "e cvt",
  "tiptronic",
  "steptronic",
  "powershift",
  "power shift",
  "multitronic",
  "edc",
  "amt",
  "manuel",
  "manual",
  "otomatik",
  "automatic",
  "auto",
  "at",
  "mt",
  "stepless",
  "single speed",
  "single-speed",
  "şanzıman",
  "sanziman",
]);

const FAMILY_ALIASES: Array<{
  family: TransmissionFamily;
  patterns: RegExp[];
  aliases: string[];
}> = [
  {
    family: "E_CVT",
    patterns: [
      /\be[-\s]?cvt\b/i,
      /\belectronic\s+cvt\b/i,
      /\bhybrid\s+synergy\s+drive\b/i,
      /\bhsd\b/i,
    ],
    aliases: ["e-CVT", "eCVT", "E-CVT", "Hybrid Synergy Drive"],
  },
  {
    family: "SINGLE_SPEED_EV",
    patterns: [
      /\bsingle[-\s]?speed\b/i,
      /\b1[-\s]?speed\s*(?:ev|electric|reduction)?\b/i,
      /\breduction\s+gear\b/i,
    ],
    aliases: ["single-speed", "1-speed EV", "single speed"],
  },
  {
    family: "DSG",
    patterns: [/\bdsg\b/i, /\bdirekt[-\s]?schalt\b/i],
    aliases: ["DSG"],
  },
  {
    family: "DCT",
    patterns: [
      /\bdct\b/i,
      /\bdual[-\s]?clutch\b/i,
      /\bs[-\s]?tronic\b/i,
      /\bpdk\b/i,
      /\bedc\b/i,
      /\bpowershift\b/i,
      /\bpower\s*shift\b/i,
      /\b7dct\b/i,
      /\b6dct\b/i,
      /\b8dct\b/i,
    ],
    aliases: [
      "DCT",
      "dual-clutch",
      "S tronic",
      "S-tronic",
      "PDK",
      "EDC",
      "PowerShift",
    ],
  },
  {
    family: "CVT",
    patterns: [
      /\bcvt\b/i,
      /\bmultitronic\b/i,
      /\bxtronic\b/i,
      /\bstepless\b/i,
      /\bvariable\s+gear\s+ratios?\b/i,
    ],
    aliases: ["CVT", "Multitronic", "Xtronic", "stepless"],
  },
  {
    family: "AMT",
    patterns: [
      /\bamt\b/i,
      /\bautomated\s+manual\b/i,
      /\bsingleshift\b/i,
      /\beasytronic\b/i,
      /\bdurashift\s*est\b/i,
    ],
    aliases: ["AMT", "automated manual", "Easytronic"],
  },
  {
    family: "MANUAL",
    patterns: [
      /\bmanual\b/i,
      /\bmanuel\b/i,
      /\bdüz\s*vites\b/i,
      /\b\d\s*mt\b/i,
      /\bmt\b/i,
      /\b\d[-\s]?speed\s+manual\b/i,
    ],
    aliases: ["manual", "manuel", "MT", "düz vites"],
  },
  {
    family: "TORQUE_CONVERTER_AUTOMATIC",
    patterns: [
      /\btiptronic\b/i,
      /\bsteptronic\b/i,
      /\btorque\s*converter\b/i,
      /\b\d\s*at\b/i,
      /\b\d[-\s]?speed\s+automatic\b/i,
      /\bautomatic\b/i,
      /\botomatik\b/i,
      /\b\bat\b/i,
      /\b8hp\b/i,
      /\b8[-\s]?speed\b/i,
      /\b6[-\s]?speed\s+auto/i,
      /\b7[-\s]?speed\s+auto/i,
      /\b9[-\s]?speed\s+auto/i,
    ],
    aliases: [
      "automatic",
      "otomatik",
      "AT",
      "Tiptronic",
      "Steptronic",
      "8AT",
      "6AT",
      "8HP",
    ],
  },
];

/**
 * Accept transmissionCode only with explicit OEM-code shape (digits + alnum).
 * DSG / S tronic / CVT alone → null.
 */
export function sanitizeTransmissionCode(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  const fold = t.toLowerCase().replace(/\s+/g, " ");
  if (MARKETING_ONLY_TRANSMISSION_LABELS.has(fold)) return null;
  if (MARKETING_ONLY_TRANSMISSION_LABELS.has(fold.replace(/-/g, " "))) return null;
  // Explicit codes: DQ200, DQ250, 8HP50, 7G-DCT, GF6 — need a digit
  if (!/[0-9]/.test(t)) return null;
  // Reject gear-count marketing like "7DSG", "6MT", "8AT" as codes
  if (/^\d{1,2}\s*(?:dsg|dct|mt|at|cvt|edc|amt)$/i.test(t.replace(/[-\s]/g, ""))) {
    return null;
  }
  if (t.length < 3 || t.length > 24) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(t)) return null;
  return t.toUpperCase().replace(/\s+/g, "");
}

export function familyToType(family: TransmissionFamily): TransmissionType {
  switch (family) {
    case "MANUAL":
      return "manual";
    case "TORQUE_CONVERTER_AUTOMATIC":
      return "torque_converter_automatic";
    case "DCT":
      return "dual_clutch";
    case "DSG":
      return "dsg";
    case "CVT":
      return "cvt";
    case "E_CVT":
      return "e_cvt";
    case "AMT":
      return "automated_manual";
    case "SINGLE_SPEED_EV":
      return "single_speed";
    case "OTHER":
      return "other";
    default:
      return "unknown";
  }
}

export function inferTransmissionFamily(
  marketingName: string,
  opts?: {
    explicit?: string | null;
    electrification?: string | null;
    fuelType?: string | null;
  },
): TransmissionFamily {
  if (opts?.explicit) {
    const e = opts.explicit.toUpperCase().replace(/\s+/g, "_");
    const allowed: TransmissionFamily[] = [
      "MANUAL",
      "TORQUE_CONVERTER_AUTOMATIC",
      "DCT",
      "DSG",
      "CVT",
      "E_CVT",
      "AMT",
      "SINGLE_SPEED_EV",
      "OTHER",
      "UNKNOWN",
    ];
    if (allowed.includes(e as TransmissionFamily)) return e as TransmissionFamily;
    if (e === "AUTOMATIC") return "TORQUE_CONVERTER_AUTOMATIC";
  }

  const n = marketingName.toLowerCase();

  // Order matters: e-CVT before CVT; DSG before DCT; EV single-speed before AT.
  if (/\be[-\s]?cvt\b|\belectronic\s+cvt\b|\bhybrid\s+synergy\b/.test(n)) {
    return "E_CVT";
  }
  if (
    opts?.electrification === "BEV" ||
    /\be[-\s]?golf\b|\btesla\b|\btogg\b|\bbev\b|\belectric\b/.test(n)
  ) {
    if (
      /\bsingle[-\s]?speed\b|\b1[-\s]?speed\b|\breduction\b/.test(n) ||
      opts?.electrification === "BEV"
    ) {
      // Only force SINGLE_SPEED_EV when EV context is clear and no ICE gearbox label.
      if (
        opts?.electrification === "BEV" &&
        !/\bdsg\b|\bdct\b|\bmanual\b|\bcvt\b|\bat\b/.test(n)
      ) {
        return "SINGLE_SPEED_EV";
      }
      if (/\bsingle[-\s]?speed\b|\b1[-\s]?speed\b|\breduction\b/.test(n)) {
        return "SINGLE_SPEED_EV";
      }
    }
  }
  if (/\bdsg\b/.test(n)) return "DSG";
  if (
    /\bdct\b|\bdual[-\s]?clutch\b|\bs[-\s]?tronic\b|\bpdk\b|\bedc\b|\bpowershift\b/.test(
      n,
    )
  ) {
    return "DCT";
  }
  if (/\bcvt\b|\bmultitronic\b|\bxtronic\b|\bvariable\s+gear\s+ratios?\b/.test(n)) {
    return "CVT";
  }
  if (/\bamt\b|\bautomated\s+manual\b|\beasytronic\b/.test(n)) return "AMT";
  if (/\bmanual\b|\bmanuel\b|\bdüz\b|\b\d\s*mt\b|\bmt\b/.test(n)) return "MANUAL";
  if (
    /\btiptronic\b|\bsteptronic\b|\bautomatic\b|\botomatik\b|\b\d\s*at\b|\bat\b|\b8hp\b/.test(
      n,
    )
  ) {
    return "TORQUE_CONVERTER_AUTOMATIC";
  }
  return "UNKNOWN";
}

export function extractGearCount(text: string): number | null {
  const m =
    text.match(
      /\b(\d{1,2})\s*[-\s]?(?:speed|spd|vites|gang|gears?)\b/i,
    ) ||
    text.match(/\b(\d{1,2})\s*(?:mt|at|dct|dsg|edc)\b/i) ||
    text.match(/\b(?:mt|at|dct|dsg|edc)\s*(\d{1,2})\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1 || n > 12) return null;
  return n;
}

/**
 * Extract transmission-like phrases from free text (precision-first surfaces).
 */
export function extractTransmissionLikePhrases(text: string): string[] {
  const out: string[] = [];
  const patterns = [
    /\be[-\s]?cvt\b/gi,
    /\b\d{1,2}\s*[-\s]?speed\s+(?:dsg|dct|manual|automatic|amt|cvt)\b/gi,
    /\b\d{1,2}\s*(?:dsg|dct|mt|at|edc|amt)\b/gi,
    /\b(?:dsg|dct|edc|pdk|tiptronic|steptronic|powershift|multitronic|xtronic)\b/gi,
    /\b(?:s[-\s]?tronic)\b/gi,
    /\b(?:manual|manuel|otomatik|automatic|cvt|amt)\b/gi,
    /\b(?:dq|dl)\d{2,3}\b/gi,
    /\b\d\s*hp\d{2,3}\b/gi,
    /\b8hp\d{0,2}\b/gi,
    /\b7g[-\s]?dct\b/gi,
    /\bsingle[-\s]?speed\b/gi,
  ];
  for (const re of patterns) {
    for (const m of text.match(re) ?? []) {
      const t = m.trim();
      if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) {
        out.push(t);
      }
    }
  }
  return out;
}

export type NormalizedTransmissionMention = {
  raw: string;
  family: TransmissionFamily;
  type: TransmissionType;
  gearCount: number | null;
  transmissionCode: string | null;
  marketingName: string;
  aliases: string[];
  ambiguousFamily: boolean;
};

/**
 * Normalize a commercial transmission mention without inventing OEM codes.
 * CVT ≠ E_CVT. DSG is family, never auto-code.
 */
export function normalizeTransmissionMention(
  raw: string,
  opts?: {
    electrification?: string | null;
    fuelType?: string | null;
  },
): NormalizedTransmissionMention {
  const text = raw.trim();
  const code = sanitizeTransmissionCode(
    text.match(/\b((?:DQ|DL|0D|0B|0CW)\d{2,3}|8HP\d{0,2}|7G-?DCT|GF6|AWF\d+)\b/i)?.[1] ??
      null,
  );
  const family = inferTransmissionFamily(text, {
    electrification: opts?.electrification,
    fuelType: opts?.fuelType,
  });
  const gearCount = extractGearCount(text);
  const aliasRow = FAMILY_ALIASES.find((r) => r.family === family);
  // Detect CVT vs e-CVT confusion risk when both tokens present
  const hasCvt = /\bcvt\b/i.test(text) && !/\be[-\s]?cvt\b/i.test(text);
  const hasEcvt = /\be[-\s]?cvt\b/i.test(text);
  const ambiguousFamily = hasCvt && hasEcvt;

  let marketingName = text;
  if (family === "DSG" && gearCount) marketingName = `${gearCount}-speed DSG`;
  else if (family === "DCT" && gearCount) marketingName = `${gearCount}-speed DCT`;
  else if (family === "MANUAL" && gearCount) marketingName = `${gearCount}MT`;
  else if (family === "TORQUE_CONVERTER_AUTOMATIC" && gearCount) {
    marketingName = `${gearCount}AT`;
  } else if (family === "E_CVT") marketingName = "e-CVT";
  else if (family === "CVT") marketingName = "CVT";
  else if (family === "SINGLE_SPEED_EV") marketingName = "single-speed";

  return {
    raw: text,
    family,
    type: familyToType(family),
    gearCount,
    transmissionCode: code,
    marketingName,
    aliases: aliasRow?.aliases ?? [],
    ambiguousFamily,
  };
}

export function commercialAliasesForFamily(
  family: TransmissionFamily,
): string[] {
  return FAMILY_ALIASES.find((r) => r.family === family)?.aliases ?? [];
}
