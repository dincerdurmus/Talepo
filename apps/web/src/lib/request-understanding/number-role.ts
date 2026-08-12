import { extractModelIdentityTokens } from "@/lib/product-identity/model-identity-tokens";

export type NumberRole =
  | "MODEL_IDENTIFIER"
  | "MODEL_YEAR"
  | "QUANTITY"
  | "WEIGHT"
  | "DIMENSION"
  | "MILEAGE"
  | "CAPACITY"
  | "AREA"
  | "PRICE"
  | "STORAGE"
  | "OTHER";

export type ClassifiedNumber = {
  raw: string;
  role: NumberRole;
  value?: number;
  unit?: string;
  evidence: string[];
  index: number;
};

function parseTrInt(raw: string): number {
  const cleaned = raw.replace(/\./g, "").replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Classify numeric tokens by surrounding evidence.
 * Never assume bare digits are QUANTITY.
 *
 * Order: unit-backed roles first, then alphanumeric model tokens,
 * then bare-after-alpha model candidates, then OTHER.
 */
export function classifyNumbers(normalizedText: string): ClassifiedNumber[] {
  const text = normalizedText;
  const lower = text.toLocaleLowerCase("tr-TR");
  const results: ClassifiedNumber[] = [];
  const claimed = new Set<number>();

  const claim = (index: number, len: number) => {
    for (let i = index; i < index + len; i++) claimed.add(i);
  };
  const isClaimed = (index: number, len: number) => {
    for (let i = index; i < index + len; i++) {
      if (claimed.has(i)) return true;
    }
    return false;
  };

  // --- Unit-backed / contextual roles first ---

  const weightRe = /(\d+(?:[.,]\d+)?)\s*(gr|gram|kg)\b/gi;
  let wm: RegExpExecArray | null;
  while ((wm = weightRe.exec(text)) !== null) {
    if (isClaimed(wm.index, wm[0].length)) continue;
    results.push({
      raw: wm[0],
      role: "WEIGHT",
      value: parseTrInt(wm[1]!),
      unit: wm[2]!.toLocaleLowerCase("tr-TR"),
      evidence: [wm[0]],
      index: wm.index,
    });
    claim(wm.index, wm[0].length);
  }

  const storageRe = /(\d+(?:[.,]\d+)?)\s*(gb|tb)\b/gi;
  let sm: RegExpExecArray | null;
  while ((sm = storageRe.exec(text)) !== null) {
    if (isClaimed(sm.index, sm[0].length)) continue;
    results.push({
      raw: sm[0],
      role: "STORAGE",
      value: parseTrInt(sm[1]!),
      unit: sm[2]!.toLocaleLowerCase("tr-TR"),
      evidence: [sm[0]],
      index: sm.index,
    });
    claim(sm.index, sm[0].length);
  }

  const areaRe = /(\d+(?:[.,]\d+)?)\s*(m2|m²|metre\s*kare|metrekare)\b/gi;
  let arm: RegExpExecArray | null;
  while ((arm = areaRe.exec(text)) !== null) {
    if (isClaimed(arm.index, arm[0].length)) continue;
    results.push({
      raw: arm[0],
      role: "AREA",
      value: parseTrInt(arm[1]!),
      unit: "m2",
      evidence: [arm[0]],
      index: arm.index,
    });
    claim(arm.index, arm[0].length);
  }

  const mileRe = /(\d+(?:[.,]\d+)?)\s*(bin\s*)?km\b/gi;
  let mm: RegExpExecArray | null;
  while ((mm = mileRe.exec(text)) !== null) {
    if (isClaimed(mm.index, mm[0].length)) continue;
    let value = parseTrInt(mm[1]!);
    if (mm[2]) value *= 1000;
    results.push({
      raw: mm[0],
      role: "MILEAGE",
      value,
      unit: "km",
      evidence: [mm[0]],
      index: mm.index,
    });
    claim(mm.index, mm[0].length);
  }

  const priceRe = /(?:₺|tl|try)?\s*(\d+(?:[.,]\d+)*)\s*(?:₺|tl|try|lira)\b/gi;
  let pm: RegExpExecArray | null;
  while ((pm = priceRe.exec(text)) !== null) {
    if (isClaimed(pm.index, pm[0].length)) continue;
    results.push({
      raw: pm[0],
      role: "PRICE",
      value: parseTrInt(pm[1]!),
      unit: "TRY",
      evidence: [pm[0]],
      index: pm.index,
    });
    claim(pm.index, pm[0].length);
  }

  const dimRe = /(\d+)\s*[x×]\s*(\d+)(?:\s*[x×]\s*(\d+))?/gi;
  let dm: RegExpExecArray | null;
  while ((dm = dimRe.exec(text)) !== null) {
    if (isClaimed(dm.index, dm[0].length)) continue;
    results.push({
      raw: dm[0],
      role: "DIMENSION",
      evidence: [dm[0]],
      index: dm.index,
    });
    claim(dm.index, dm[0].length);
  }

  // Room layout like 2+1 — not quantity
  const roomRe = /\b([1-9])\s*\+\s*([0-9])\b/g;
  let rm: RegExpExecArray | null;
  while ((rm = roomRe.exec(text)) !== null) {
    if (isClaimed(rm.index, rm[0].length)) continue;
    results.push({
      raw: rm[0],
      role: "OTHER",
      evidence: [rm[0], "room-layout"],
      index: rm.index,
    });
    claim(rm.index, rm[0].length);
  }

  const binRe = /(\d+)\s*bin\b/gi;
  let bm: RegExpExecArray | null;
  while ((bm = binRe.exec(text)) !== null) {
    if (isClaimed(bm.index, bm[0].length)) continue;
    const n = Number(bm[1]);
    if (!Number.isFinite(n)) continue;
    // "50bin km" already claimed by mileage; "5bin kutu" is quantity
    const after = lower.slice(bm.index + bm[0].length, bm.index + bm[0].length + 12);
    if (/^\s*km\b/.test(after)) continue;
    results.push({
      raw: bm[0],
      role: "QUANTITY",
      value: n * 1000,
      unit: "adet",
      evidence: [bm[0], "bin multiplier"],
      index: bm.index,
    });
    claim(bm.index, bm[0].length);
  }

  const qtyRe =
    /\b(bir|iki|üç|uc|1|2|3|\d+(?:[.,]\d+)*)\s*(adet|tane|kutu|paket|takım|takim)\b/gi;
  let qm: RegExpExecArray | null;
  while ((qm = qtyRe.exec(text)) !== null) {
    if (isClaimed(qm.index, qm[0].length)) continue;
    const word = qm[1]!.toLocaleLowerCase("tr-TR");
    const map: Record<string, number> = { bir: 1, iki: 2, üç: 3, uc: 3 };
    const value = map[word] ?? parseTrInt(word);
    if (!Number.isFinite(value)) continue;
    results.push({
      raw: qm[0],
      role: "QUANTITY",
      value,
      unit: qm[2]!.toLocaleLowerCase("tr-TR"),
      evidence: [qm[0], "unit-backed quantity"],
      index: qm.index,
    });
    claim(qm.index, qm[0].length);
  }

  const yearRe = /\b((?:19|20)\d{2})\b/g;
  let ym: RegExpExecArray | null;
  while ((ym = yearRe.exec(text)) !== null) {
    if (isClaimed(ym.index, ym[0].length)) continue;
    const year = Number(ym[1]);
    const window = lower.slice(Math.max(0, ym.index - 12), ym.index + 20);
    const yearish =
      /model|yıl|yil|sonrası|sonrasi|üstü|ustu|öncesi|oncesi|ama/.test(window) ||
      (year >= 1980 && year <= 2035);
    if (!yearish) continue;
    results.push({
      raw: ym[0],
      role: "MODEL_YEAR",
      value: year,
      evidence: [ym[0], window.trim()],
      index: ym.index,
    });
    claim(ym.index, ym[0].length);
  }

  // --- Model identity tokens (alphanumeric preferred; skip pure digits) ---

  const hyphenModel = /\b([a-z]{1,4}-\d+[a-z0-9-]*)\b/gi;
  let hm: RegExpExecArray | null;
  while ((hm = hyphenModel.exec(text)) !== null) {
    if (isClaimed(hm.index, hm[0].length)) continue;
    results.push({
      raw: hm[0],
      role: "MODEL_IDENTIFIER",
      evidence: ["hyphenated-model-token"],
      index: hm.index,
    });
    claim(hm.index, hm[0].length);
  }

  for (const token of extractModelIdentityTokens(text)) {
    const compact = token.normalized.replace(/[^a-z0-9]/gi, "");
    // Pure numeric tokens are ambiguous — only keep if not already claimed
    // and look like series codes (not large quantities)
    if (/^\d+$/.test(compact)) {
      continue;
    }
    const idx = lower.indexOf(token.normalized);
    const rawLower = token.raw.toLocaleLowerCase("tr-TR");
    let at = text.toLocaleLowerCase("tr-TR").indexOf(rawLower);
    if (at < 0) at = idx >= 0 ? idx : -1;
    if (at < 0) continue;
    if (isClaimed(at, token.raw.length)) continue;
    results.push({
      raw: token.raw,
      role: "MODEL_IDENTIFIER",
      evidence: [`model-token:${token.class}`, token.family],
      index: at,
    });
    claim(at, Math.max(1, token.raw.length));
  }

  const alphaNum = /\b([a-z]{1,4}\d+[a-z0-9-]*)\b/gi;
  let am: RegExpExecArray | null;
  while ((am = alphaNum.exec(text)) !== null) {
    if (isClaimed(am.index, am[0].length)) continue;
    results.push({
      raw: am[0],
      role: "MODEL_IDENTIFIER",
      evidence: ["alphanumeric-token"],
      index: am.index,
    });
    claim(am.index, am[0].length);
  }

  // Bare number after alphabetic brand/product token → MODEL_IDENTIFIER candidate
  const bareAfterAlpha = /\b([a-zçğıöşü]{3,})\s+(\d{1,4})\b/gi;
  let bam: RegExpExecArray | null;
  while ((bam = bareAfterAlpha.exec(text)) !== null) {
    const numStart = bam.index + bam[1]!.length + 1;
    if (isClaimed(numStart, bam[2]!.length)) continue;
    const head = bam[1]!.toLocaleLowerCase("tr-TR");
    if (
      /adet|tane|kutu|fiyat|tl|kira|bütçe|butce|km|m2|bin|gram|ofis|metre/.test(
        head,
      )
    ) {
      continue;
    }
    results.push({
      raw: bam[2]!,
      role: "MODEL_IDENTIFIER",
      value: Number(bam[2]),
      evidence: [`after-token:${bam[1]}`, "bare-number-not-quantity"],
      index: numStart,
    });
    claim(numStart, bam[2]!.length);
  }

  // Remaining bare numbers → OTHER (never auto QUANTITY)
  const bare = /\b(\d+(?:[.,]\d+)*)\b/g;
  let other: RegExpExecArray | null;
  while ((other = bare.exec(text)) !== null) {
    if (isClaimed(other.index, other[0].length)) continue;
    results.push({
      raw: other[0],
      role: "OTHER",
      value: parseTrInt(other[1]!),
      evidence: ["unclassified-number"],
      index: other.index,
    });
  }

  return results;
}

export function primaryQuantity(
  numbers: ClassifiedNumber[],
): ClassifiedNumber | undefined {
  return numbers.find((n) => n.role === "QUANTITY" && n.value != null);
}

export function primaryYear(
  numbers: ClassifiedNumber[],
): ClassifiedNumber | undefined {
  return numbers.find((n) => n.role === "MODEL_YEAR" && n.value != null);
}

/** Calendar year token — never a brand/model identity by itself. */
export function looksLikeYearToken(value: string | null | undefined): boolean {
  return /^(19|20)\d{2}$/.test(String(value ?? "").trim());
}

export function modelIdentifierTokens(
  numbers: ClassifiedNumber[],
): ClassifiedNumber[] {
  return numbers.filter((n) => n.role === "MODEL_IDENTIFIER");
}
