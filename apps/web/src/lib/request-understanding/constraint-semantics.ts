/**
 * Phase 2 — Constraint & preference semantics for Single Brain.
 * Additive: MUST / PREFERRED / EXCLUDED / multi-value / ranges.
 * Does not invent a second brain; lexical markers + field context + catalogs.
 */

import {
  APPLIANCE_BRANDS,
  AUTOMOTIVE_BRANDS,
  AUTOMOTIVE_MODEL_TOKENS,
  HOME_KITCHEN_BRANDS,
  TECHNOLOGY_BRANDS,
  type BrandEntry,
} from "@/lib/ai/parser/brand-catalog";
import {
  isNegatedMention,
  isNegatedWindow,
} from "@/lib/ai/parser/negation";
import { classifyNumbers } from "./number-role";
import type {
  UnderstandingContradiction,
  UnderstandingProvenance,
} from "./types";

export type ConstraintStrength = "MUST" | "PREFERRED";

export type FieldConstraintSemantics = {
  fieldKey: string;
  /** Concrete single value when known (compatible with VALUE fields). */
  value?: string | null;
  strength?: ConstraintStrength;
  preferredValues?: string[];
  /** Stronger than preferred — "Samsung ya da LG olsun" */
  allowedValues?: string[];
  excludedValues?: string[];
  range?: { min?: number; max?: number; unit?: string };
  /** ANY marker on this field (farketmez) — may coexist with exclusions. */
  any?: boolean;
  confidence: number;
  provenance: UnderstandingProvenance;
  evidence?: string[];
};

export type ConstraintBundle = {
  byField: Record<string, FieldConstraintSemantics>;
  conflicts: UnderstandingContradiction[];
};

/** Downstream matching / saved-search / alert readiness (types only). */
export type ConstraintMatchContract = {
  must: Array<{ fieldKey: string; value?: string | null; range?: FieldConstraintSemantics["range"] }>;
  preferred: Array<{ fieldKey: string; values: string[] }>;
  excluded: Array<{ fieldKey: string; values: string[] }>;
  anyFields: string[];
  ranges: Array<{ fieldKey: string; min?: number; max?: number; unit?: string }>;
};

export type ConstraintFilterContract = {
  include: Record<string, string[]>;
  exclude: Record<string, string[]>;
  preferred: Record<string, string[]>;
  range: Record<string, { min?: number; max?: number; unit?: string }>;
  any: string[];
};

const MUST_MARKERS =
  /\b(mutlaka|kesinlikle|şart|sart|olmak\s+zorunda|sadece|yalnızca|yalnizca|kesin)\b/i;

const PREFERRED_MARKERS =
  /\b(tercihen|tercihim|önceliğim|onceligim|olursa\s+iyi\s+olur|olsa\s+iyi\s+olur|mümkünse|mumkunse|daha\s+iyi\s+olur|olabilir)\b/i;

/**
 * ÇEKİNCE OTORİTESİ (KB-15) — TEK YER.
 *
 * Kullanıcı bir değeri kesin beyan etmek yerine yaklaşıklık ("yaklaşık 1000
 * adet"), benzetme ("Clio gibi", "ahşap görünümlü") ya da isteğe bağlılık
 * ("Arçelik olmasa da olur") ile söyleyebilir. Böyle bir değer, kesin
 * yazılmış bir değerle AYNI statüyü taşıyamaz: alanda durur ama soruyu
 * kesin cevap gibi kapatmaz.
 *
 * Bu kalıplar tek yerde tutulur; besteci katmanı kendi paralel listesini
 * kurmaz, buradan sorar.
 */
const APPROXIMATION_MARKERS =
  /(yaklaşık|yaklasik|civar|aşağı\s*yukarı|asagi\s*yukari|takriben|kadar\s*olsun|en\s*az|en\s*fazla)/i;

const SIMILARITY_MARKERS =
  /(görünüm|gorunum|görünt|gorunt|tarzı|tarzi|tarzında|tarzinda|imitasyon|benzeri|benzer|gibi)/i;

/**
 * BELİRSİZLİK İŞARETLERİ (T8, kurucu kararı 2026-08-29).
 *
 * "no-frost mu statik mi bilmiyorum" bir BEYAN değildir; kullanıcı iki
 * seçenek arasında karar veremediğini söylüyor. Bu, çekincenin bir türüdür
 * ve tek çekince otoritesinde durur — hiçbir ürüne özel ikinci olumsuzlama
 * tablosu kurulmaz. İki imza tanınır: doğrudan bilmeme ifadesi ve Türkçe
 * seçenekli soru kalıbı ("... mu ... mi").
 */
const UNCERTAINTY_MARKERS =
  /(bilmiyorum|bilmiyoruz|emin\s*değilim|emin\s*degilim|karar\s*veremedim|kararsızım|kararsizim|fikrim\s*yok)/i;

const ALTERNATIVE_QUESTION =
  /\b(mu|mü|mi|mı)\b[^.?!]{0,40}?\b(mu|mü|mi|mı)\b/i;

const OPTIONAL_MARKERS =
  /(olmasa\s*da\s*olur|şart\s*değil|sart\s*degil|olmak\s*zorunda\s*değil|olmak\s*zorunda\s*degil|istemiyorum|önemli\s*değil|onemli\s*degil)/i;

/**
 * Metinde (isteğe bağlı olarak belirli bir span'in yakınında) bir çekince
 * işareti var mı? `span` verilirse yalnız onun çevresindeki pencere okunur —
 * cümlenin başka bir yerindeki çekince ilgisiz bir alanı zayıflatmasın.
 * Açık bir MUST işareti çekinceyi geçersiz kılar.
 */
export function isHedgedExpression(text: string, span?: string): boolean {
  const full = String(text ?? "");
  if (!full) return false;
  let scope = full;
  if (span) {
    const idx = full.toLocaleLowerCase("tr-TR").indexOf(
      String(span).toLocaleLowerCase("tr-TR"),
    );
    if (idx >= 0) {
      scope = full.slice(
        Math.max(0, idx - 28),
        idx + String(span).length + 28,
      );
    }
  }
  /**
   * Belirsizlik, KESİNLİK işaretinden önce değerlendirilir: "bilmiyorum ama
   * mutlaka no-frost olsun" cümlesinde son açık karar kazanmalıdır; bu yüzden
   * MUST işareti belirsizliği geçersiz kılar ve sıra bozulmaz.
   */
  if (MUST_MARKERS.test(scope)) return false;
  if (UNCERTAINTY_MARKERS.test(scope) || ALTERNATIVE_QUESTION.test(scope)) {
    return true;
  }
  return (
    APPROXIMATION_MARKERS.test(scope) ||
    SIMILARITY_MARKERS.test(scope) ||
    OPTIONAL_MARKERS.test(scope) ||
    PREFERRED_MARKERS.test(scope)
  );
}

const BRAND_CATALOG: BrandEntry[] = [
  ...TECHNOLOGY_BRANDS,
  ...APPLIANCE_BRANDS,
  ...HOME_KITCHEN_BRANDS,
  ...AUTOMOTIVE_BRANDS,
];

const RESOLUTION_ALIASES: Array<{ re: RegExp; value: string }> = [
  { re: /\b(8k)\b/i, value: "8K" },
  { re: /\b(4k|uhd|ultra\s*hd)\b/i, value: "4K" },
  { re: /\b(full\s*hd|fhd|1080p)\b/i, value: "Full HD" },
  { re: /\b(hd|720p)\b/i, value: "HD" },
];

const CONDITION_USED =
  /\b(ikinci\s*el|2\.?\s*el|used|refurbished|yenilenmiş|yenilenmis)\b/i;
const CONDITION_NEW = /\b(sıfır|sifir|0\s*km|brand\s*new|yeni)\b/i;

const COLOR_WORDS: Array<{ re: RegExp; value: string }> = [
  { re: /\b(kırmızı|kirmizi|red)\b/i, value: "Kırmızı" },
  { re: /\b(beyaz|white)\b/i, value: "Beyaz" },
  { re: /\b(siyah|black)\b/i, value: "Siyah" },
  { re: /\b(gri|gray|grey)\b/i, value: "Gri" },
  { re: /\b(mavi|blue)\b/i, value: "Mavi" },
];

const LIGHTING_WORDS: Array<{ re: RegExp; value: string }> = [
  { re: /\b(xenon|ksenon)\b/i, value: "XENON" },
  { re: /\b(led)\b/i, value: "LED" },
  { re: /\b(halojen|halogen)\b/i, value: "HALOGEN" },
];

const LAMINATION_WORDS: Array<{ re: RegExp; value: string }> = [
  { re: /\bmat\s*selefon(?:lu)?\b/i, value: "mat selefon" },
  { re: /\bparlak\s*selefon(?:lu)?\b/i, value: "parlak selefon" },
  { re: /\bselefon(?:lu)?\b/i, value: "selefon" },
];

function fold(text: string): string {
  return text.normalize("NFC");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Regex matching a brand by ANY of its catalog aliases (plus the canonical
 * spelling). The confirm/negation scans below used to re-search the text with
 * the canonical only, so a brand found via a diacritic-free alias ("arcelik")
 * was silently dropped before it could become a constraint.
 */
function brandMentionRegex(canonical: string): RegExp {
  const entry = BRAND_CATALOG.find((b) => b.canonical === canonical);
  const needles = [...new Set([canonical, ...(entry?.aliases ?? [])])]
    .map((n) => escapeRegex(n.toLocaleLowerCase("tr-TR")))
    .sort((a, b) => b.length - a.length);
  return new RegExp(
    `(?:^|[^a-zçğıöşü0-9])(?:${needles.join("|")})(?=$|[^a-zçğıöşü0-9])`,
    "gi",
  );
}

function brandMatchesInText(text: string): string[] {
  const normalized = text.toLocaleLowerCase("tr-TR");
  const hits: Array<{ canonical: string; aliasLen: number }> = [];
  for (const brand of BRAND_CATALOG) {
    for (const alias of brand.aliases) {
      const needle = alias.toLocaleLowerCase("tr-TR");
      const re = new RegExp(
        `(?:^|[^a-zçğıöşü0-9])${escapeRegex(needle)}(?=$|[^a-zçğıöşü0-9])`,
        "i",
      );
      if (!re.test(normalized)) continue;
      hits.push({ canonical: brand.canonical, aliasLen: alias.length });
    }
  }
  // Dedupe by canonical, keep longest alias hit
  const byCanon = new Map<string, number>();
  for (const h of hits) {
    const prev = byCanon.get(h.canonical) ?? 0;
    if (h.aliasLen > prev) byCanon.set(h.canonical, h.aliasLen);
  }
  return [...byCanon.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c);
}

/** Window around a match for strength / negation cues. */
function windowAround(text: string, index: number, len: number, pad = 40): string {
  const start = Math.max(0, index - pad);
  const end = Math.min(text.length, index + len + pad);
  return text.slice(start, end);
}

function strengthInWindow(win: string): ConstraintStrength | undefined {
  if (MUST_MARKERS.test(win)) return "MUST";
  if (PREFERRED_MARKERS.test(win)) return "PREFERRED";
  return undefined;
}

function upsert(
  bag: Record<string, FieldConstraintSemantics>,
  patch: FieldConstraintSemantics,
): void {
  const prev = bag[patch.fieldKey];
  if (!prev) {
    bag[patch.fieldKey] = { ...patch };
    return;
  }
  bag[patch.fieldKey] = {
    ...prev,
    ...patch,
    preferredValues: unique([
      ...(prev.preferredValues ?? []),
      ...(patch.preferredValues ?? []),
    ]),
    allowedValues: unique([
      ...(prev.allowedValues ?? []),
      ...(patch.allowedValues ?? []),
    ]),
    excludedValues: unique([
      ...(prev.excludedValues ?? []),
      ...(patch.excludedValues ?? []),
    ]),
    evidence: [...(prev.evidence ?? []), ...(patch.evidence ?? [])],
    confidence: Math.max(prev.confidence, patch.confidence),
    strength: patch.strength ?? prev.strength,
    any: Boolean(prev.any || patch.any),
    range: patch.range ?? prev.range,
    value: patch.value !== undefined ? patch.value : prev.value,
  };
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.toLocaleLowerCase("tr-TR");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function extractAnyBrand(text: string): boolean {
  return (
    /\bmarka\s+(fark\s*etmez|önemli\s*değil|onemli\s*degil)\b/i.test(text) ||
    /\b(fark\s*etmez|önemli\s*değil|onemli\s*degil)\s+marka\b/i.test(text) ||
    /\bherhangi\s+bir\s+marka\b/i.test(text)
  );
}

function extractAnyColor(text: string): boolean {
  return (
    /\brenk(?:i|ler)?\s+(fark\s*etmez|önemli\s*değil|onemli\s*degil)\b/i.test(
      text,
    ) ||
    /\b(fark\s*etmez|önemli\s*değil|onemli\s*degil)\s+renk(?:i)?\b/i.test(text)
  );
}

function extractMultiList(
  text: string,
  candidates: string[],
): { values: string[]; evidence: string; strong: boolean } | null {
  if (candidates.length < 2) return null;
  // "A veya B" / "A ya da B" / "A, B olabilir"
  const lower = text.toLocaleLowerCase("tr-TR");
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i]!.toLocaleLowerCase("tr-TR");
      const b = candidates[j]!.toLocaleLowerCase("tr-TR");
      const pair = new RegExp(
        `${escapeRegex(a)}\\s*(?:,|\\/|veya|ya\\s*da|veyahut)\\s*${escapeRegex(b)}|` +
          `${escapeRegex(b)}\\s*(?:,|\\/|veya|ya\\s*da|veyahut)\\s*${escapeRegex(a)}`,
        "i",
      );
      const m = lower.match(pair);
      if (!m) continue;
      const win = windowAround(lower, m.index ?? 0, m[0].length, 50);
      const strong =
        /\b(olsun|olmalı|olmali|sadece|yalnızca|yalnizca)\b/i.test(win) &&
        !PREFERRED_MARKERS.test(win);
      return {
        values: [candidates[i]!, candidates[j]!],
        evidence: m[0],
        strong,
      };
    }
  }
  return null;
}

function extractModelAlternatives(text: string): string[] {
  const out: string[] = [];
  // Dyson-style short models
  const v15 = text.match(/\b(v\s*15(?:\s*detect)?)\b/i);
  if (v15) out.push(/detect/i.test(v15[0]) ? "V15 Detect" : "V15 Detect");
  const gen5 = text.match(/\b(gen\s*5(?:\s*detect)?)\b/i);
  if (gen5) out.push(/detect/i.test(gen5[0]) ? "Gen5detect" : "Gen5detect");
  // "V15 veya Gen5"
  if (out.length >= 2) return unique(out);
  if (/\bv\s*15\b/i.test(text) && /\bgen\s*5\b/i.test(text)) {
    return unique(["V15 Detect", "Gen5detect"]);
  }
  return out;
}

function extractScreenSize(text: string): string | null {
  /**
   * Tek sayı otoritesinden türetilir (I44): screenSize yalnız birim destekli
   * ("55 inç", "55 ekran") ya da TV bağlamı kanıtlı bir SCREEN_SIZE
   * kararından doğar. Eski yerel regex birimi opsiyonel bıraktığı için
   * "100 kutu", "9-36 kg" ve "SM 74" gibi span'leri ekran boyutu sanıyordu.
   */
  const hit = classifyNumbers(text).find(
    (n) => n.role === "SCREEN_SIZE" && n.value != null,
  );
  return hit ? String(hit.value) : null;
}

/**
 * Extract field-scoped constraints from normalized free text.
 */
export function extractConstraintSemantics(rawText: string): ConstraintBundle {
  const text = fold(rawText);
  const byField: Record<string, FieldConstraintSemantics> = {};
  const conflicts: UnderstandingContradiction[] = [];

  // --- ANY ---
  if (extractAnyBrand(text)) {
    upsert(byField, {
      fieldKey: "brand",
      any: true,
      confidence: 0.95,
      provenance: "EXPLICIT",
      evidence: ["marka fark etmez"],
    });
  }
  if (extractAnyColor(text)) {
    upsert(byField, {
      fieldKey: "color",
      any: true,
      confidence: 0.95,
      provenance: "EXPLICIT",
      evidence: ["renk fark etmez"],
    });
  }

  // --- Brands: multi / exclude / positive ---
  const brands = brandMatchesInText(text);
  const multiBrand = extractMultiList(text, brands);

  for (const brand of brands) {
    const re = brandMentionRegex(brand);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (isNegatedMention(text, m.index, m[0].length)) {
        upsert(byField, {
          fieldKey: "brand",
          excludedValues: [brand],
          confidence: 0.95,
          provenance: "EXPLICIT",
          evidence: [m[0].trim() + " negated"],
        });
      }
    }
  }

  if (multiBrand) {
    upsert(byField, {
      fieldKey: "brand",
      preferredValues: multiBrand.values,
      allowedValues: multiBrand.strong ? multiBrand.values : undefined,
      strength: multiBrand.strong ? "MUST" : "PREFERRED",
      confidence: multiBrand.strong ? 0.92 : 0.88,
      provenance: "EXPLICIT",
      evidence: [multiBrand.evidence],
    });
  }

  // Positive single brand only when not multi and not only-excluded
  const excludedBrands = new Set(
    (byField.brand?.excludedValues ?? []).map((b) =>
      b.toLocaleLowerCase("tr-TR"),
    ),
  );
  const preferredBrands = byField.brand?.preferredValues ?? [];
  if (preferredBrands.length === 0 && brands.length >= 1) {
    for (const brand of brands) {
      if (excludedBrands.has(brand.toLocaleLowerCase("tr-TR"))) {
        // Still record positive mention for contradiction detection
        const re = brandMentionRegex(brand);
        let m: RegExpExecArray | null;
        let positive = false;
        while ((m = re.exec(text)) !== null) {
          if (!isNegatedMention(text, m.index, m[0].length)) positive = true;
        }
        if (positive) {
          upsert(byField, {
            fieldKey: "brand",
            value: brand,
            confidence: 0.7,
            provenance: "EXPLICIT",
            evidence: [brand, "also-excluded"],
          });
        }
        continue;
      }
      const re = brandMentionRegex(brand);
      let m: RegExpExecArray | null;
      let positive = false;
      let strength: ConstraintStrength | undefined;
      while ((m = re.exec(text)) !== null) {
        if (isNegatedMention(text, m.index, m[0].length)) continue;
        positive = true;
        const win = windowAround(text, m.index, m[0].length, 40);
        strength = strengthInWindow(win) ?? strength;
      }
      /**
       * EKSEN DÜZELTMESİ (Wave I, 2026-08-31; phase2 15b ile ölçüldü).
       * "Tek pozitif marka" kuralı cümledeki TÜM katalog isabetlerini
       * sayıyordu; "LG olsun ama Samsung olmasın"da dışlanan Samsung da
       * sayılınca (2 isabet) kullanıcının AÇIKÇA istediği LG değer
       * olamıyordu — pozitif tercih düşüyor, yalnız dışlama kalıyordu.
       * Doğru eksen: teklik, DIŞLANANLAR ÇIKARILDIKTAN sonra kalan
       * pozitif marka üzerinden ölçülür. Çok-pozitifli belirsizlik
       * davranışı değişmedi.
       */
      const positiveBrandCount = brands.filter(
        (b) => !excludedBrands.has(b.toLocaleLowerCase("tr-TR")),
      ).length;
      if (positive && positiveBrandCount === 1) {
        upsert(byField, {
          fieldKey: "brand",
          value: brand,
          strength: strength === "MUST" ? "MUST" : strength,
          confidence: 0.95,
          provenance: "EXPLICIT",
          evidence: [brand],
        });
      }
    }
  }

  // --- Models / series: exclude via Phase 2 EXCLUDED (not a parallel negation system) ---
  {
    const seriesRe = /\b(\d)\s*seri(?:si)?\b/gi;
    let sm: RegExpExecArray | null;
    while ((sm = seriesRe.exec(text)) !== null) {
      if (!isNegatedMention(text, sm.index, sm[0].length)) continue;
      upsert(byField, {
        fieldKey: "model",
        excludedValues: [`${sm[1]} Serisi`],
        confidence: 0.93,
        provenance: "EXPLICIT",
        evidence: [sm[0] + " negated"],
      });
    }
    for (const token of AUTOMOTIVE_MODEL_TOKENS) {
      const needle = token.toLocaleLowerCase("tr-TR");
      if (needle.length < 3) continue;
      const re = new RegExp(
        `(?:^|[^a-zçğıöşü0-9])${escapeRegex(needle)}(?=$|[^a-zçğıöşü0-9])`,
        "gi",
      );
      let mm: RegExpExecArray | null;
      while ((mm = re.exec(text)) !== null) {
        if (!isNegatedMention(text, mm.index, mm[0].length)) continue;
        upsert(byField, {
          fieldKey: "model",
          excludedValues: [token],
          confidence: 0.93,
          provenance: "EXPLICIT",
          evidence: [mm[0].trim() + " negated"],
        });
      }
    }
  }

  // Contradiction: same brand both required and excluded
  if (byField.brand?.value && byField.brand.excludedValues?.length) {
    const v = byField.brand.value.toLocaleLowerCase("tr-TR");
    if (
      byField.brand.excludedValues.some((e) => e.toLocaleLowerCase("tr-TR") === v)
    ) {
      conflicts.push({
        kind: "BRAND_INCLUDE_EXCLUDE",
        message: `${byField.brand.value} hem isteniyor hem dışlanıyor`,
        fields: ["brand"],
      });
      // Do not invent final brand
      byField.brand = {
        ...byField.brand,
        value: null,
        confidence: 0.4,
        evidence: [...(byField.brand.evidence ?? []), "contradiction"],
      };
    }
  }
  // Also: positive brand list vs exclude of same
  if (byField.brand?.preferredValues?.length && byField.brand.excludedValues?.length) {
    const overlap = byField.brand.preferredValues.filter((p) =>
      byField.brand!.excludedValues!.some(
        (e) => e.toLocaleLowerCase("tr-TR") === p.toLocaleLowerCase("tr-TR"),
      ),
    );
    if (overlap.length) {
      conflicts.push({
        kind: "BRAND_INCLUDE_EXCLUDE",
        message: `${overlap.join(", ")} hem tercih hem dışlama`,
        fields: ["brand"],
      });
    }
  }

  // --- Resolution ---
  for (const alias of RESOLUTION_ALIASES) {
    const m = text.match(alias.re);
    if (!m || m.index == null) continue;
    const win = windowAround(text, m.index, m[0].length, 40);
    if (isNegatedMention(text, m.index, m[0].length)) {
      upsert(byField, {
        fieldKey: "resolution",
        excludedValues: [alias.value],
        confidence: 0.9,
        provenance: "EXPLICIT",
        evidence: [m[0]],
      });
      continue;
    }
    const strength = strengthInWindow(win) ?? strengthInWindow(text.slice(0, m.index + m[0].length + 20));
    // "mutlaka 4K" often precedes the token
    const before = text.slice(Math.max(0, m.index - 30), m.index);
    const strength2 = strengthInWindow(before) ?? strength;
    upsert(byField, {
      fieldKey: "resolution",
      value: alias.value,
      strength: strength2,
      confidence: strength2 === "MUST" ? 0.95 : strength2 === "PREFERRED" ? 0.9 : 0.85,
      provenance: "EXPLICIT",
      evidence: [m[0]],
    });
    break;
  }

  // --- Screen size ---
  const screen = extractScreenSize(text);
  if (screen) {
    const m = text.match(new RegExp(`\\b${screen}\\b`));
    const win =
      m && m.index != null
        ? windowAround(text, m.index, m[0].length, 30)
        : text;
    upsert(byField, {
      fieldKey: "screenSize",
      value: screen,
      strength: strengthInWindow(win),
      range: /\b(en\s*az|minimum|min\.?)\b/i.test(win)
        ? { min: Number(screen) }
        : undefined,
      confidence: 0.92,
      provenance: "EXPLICIT",
      evidence: [`${screen} ekran`],
    });
  }

  // --- Condition exclude / value ---
  {
    const usedMatch = text.match(CONDITION_USED);
    if (usedMatch && usedMatch.index != null) {
      const win = windowAround(text, usedMatch.index, usedMatch[0].length, 40);
      if (isNegatedWindow(win)) {
        upsert(byField, {
          fieldKey: "condition",
          excludedValues: ["USED"],
          confidence: 0.93,
          provenance: "EXPLICIT",
          evidence: [usedMatch[0] + " negated"],
        });
      }
    }
    const newMatch = text.match(CONDITION_NEW);
    if (newMatch && newMatch.index != null) {
      const win = windowAround(text, newMatch.index, newMatch[0].length, 40);
      if (!isNegatedWindow(win)) {
        upsert(byField, {
          fieldKey: "condition",
          value: "NEW",
          strength: strengthInWindow(win) ?? "MUST",
          confidence: 0.9,
          provenance: "EXPLICIT",
          evidence: [newMatch[0]],
        });
      } else {
        upsert(byField, {
          fieldKey: "condition",
          excludedValues: ["NEW"],
          confidence: 0.9,
          provenance: "EXPLICIT",
          evidence: [newMatch[0] + " negated"],
        });
      }
    }
  }

  // --- Color exclude / multi ---
  const colorHits: string[] = [];
  for (const c of COLOR_WORDS) {
    const m = text.match(c.re);
    if (!m || m.index == null) continue;
    const win = windowAround(text, m.index, m[0].length, 40);
    if (isNegatedWindow(win)) {
      upsert(byField, {
        fieldKey: "color",
        excludedValues: [c.value],
        confidence: 0.9,
        provenance: "EXPLICIT",
        evidence: [m[0]],
      });
    } else {
      colorHits.push(c.value);
    }
  }
  const multiColor = extractMultiList(text, colorHits);
  if (multiColor) {
    upsert(byField, {
      fieldKey: "color",
      preferredValues: multiColor.values,
      strength: "PREFERRED",
      confidence: 0.88,
      provenance: "EXPLICIT",
      evidence: [multiColor.evidence],
    });
  } else if (colorHits.length === 1) {
    upsert(byField, {
      fieldKey: "color",
      value: colorHits[0],
      strength: "PREFERRED",
      confidence: 0.9,
      provenance: "EXPLICIT",
      evidence: [colorHits[0]!],
    });
  }

  // --- Lighting (auto) ---
  for (const l of LIGHTING_WORDS) {
    const m = text.match(l.re);
    if (!m || m.index == null) continue;
    const win = windowAround(text, m.index, m[0].length, 40);
    if (isNegatedWindow(win)) {
      upsert(byField, {
        fieldKey: "lightingType",
        excludedValues: [l.value],
        confidence: 0.9,
        provenance: "EXPLICIT",
        evidence: [m[0]],
      });
    } else {
      upsert(byField, {
        fieldKey: "lightingType",
        value: l.value,
        strength: strengthInWindow(win),
        confidence: 0.85,
        provenance: "EXPLICIT",
        evidence: [m[0]],
      });
    }
  }

  // --- Side RIGHT for far ---
  if (/\b(sağ|sag)\b/i.test(text) && /\b(far|headlamp|stop)\b/i.test(text)) {
    upsert(byField, {
      fieldKey: "partPosition",
      value: "RIGHT",
      strength: /\bsağ\s+olsun|sag\s+olsun\b/i.test(text) ? "MUST" : undefined,
      confidence: 0.9,
      provenance: "EXPLICIT",
      evidence: ["sağ"],
    });
  }

  // --- Models multi (Dyson) ---
  const models = extractModelAlternatives(text);
  if (models.length >= 2) {
    upsert(byField, {
      fieldKey: "model",
      preferredValues: models,
      strength: "PREFERRED",
      confidence: 0.88,
      provenance: "EXPLICIT",
      evidence: models,
    });
  } else if (models.length === 1) {
    upsert(byField, {
      fieldKey: "model",
      value: models[0],
      confidence: 0.85,
      provenance: "EXPLICIT",
      evidence: models,
    });
  }

  // --- Lamination / print ---
  for (const l of LAMINATION_WORDS) {
    const m = text.match(l.re);
    if (!m || m.index == null) continue;
    const win = windowAround(text, m.index, m[0].length, 40);
    upsert(byField, {
      fieldKey: "lamination",
      value: l.value,
      strength: strengthInWindow(win) ?? "PREFERRED",
      confidence: 0.88,
      provenance: "EXPLICIT",
      evidence: [m[0]],
    });
    break;
  }

  // --- Quantity min ("en az 5 ton", "50 bin adet") ---
  {
    const minQty = text.match(
      /\b(?:en\s*az|minimum|min\.?)\s*(\d+(?:[.,]\d+)?)\s*(ton|adet|kg|lt|litre)?\b/i,
    );
    if (minQty) {
      const n = Number(minQty[1]!.replace(",", "."));
      upsert(byField, {
        fieldKey: "quantity",
        range: { min: n, unit: minQty[2]?.toLocaleLowerCase("tr-TR") },
        strength: "MUST",
        confidence: 0.93,
        provenance: "EXPLICIT",
        evidence: [minQty[0]],
      });
    }
    const binAdet = text.match(/\b(\d+)\s*bin\s*adet\b/i);
    if (binAdet) {
      const n = Number(binAdet[1]) * 1000;
      upsert(byField, {
        fieldKey: "quantity",
        value: String(n),
        range: { min: n, unit: "adet" },
        strength: "MUST",
        confidence: 0.92,
        provenance: "EXPLICIT",
        evidence: [binAdet[0]],
      });
    }
  }

  // --- Budget max ("en fazla 30 bin", "30 binin üstü olmasın") ---
  {
    const maxBudget = text.match(
      /\b(?:en\s*fazla|maksimum|max\.?)\s*(\d+)\s*(bin)?\s*(tl|₺)?\b/i,
    );
    if (maxBudget) {
      let n = Number(maxBudget[1]);
      if (maxBudget[2]) n *= 1000;
      upsert(byField, {
        fieldKey: "budget",
        range: { max: n, unit: "TRY" },
        strength: "MUST",
        confidence: 0.9,
        provenance: "EXPLICIT",
        evidence: [maxBudget[0]],
      });
    }
    const negUpper = text.match(
      /\b(\d+)\s*bin(?:in)?\s*(?:üstü|ustu|üzeri|uzeri)\s*olmasın\b/i,
    );
    if (negUpper) {
      const n = Number(negUpper[1]) * 1000;
      upsert(byField, {
        fieldKey: "budget",
        range: { max: n, unit: "TRY" },
        strength: "MUST",
        confidence: 0.9,
        provenance: "EXPLICIT",
        evidence: [negUpper[0]],
      });
    }
    const rangeBudget = text.match(
      /\b(\d+)\s*[-–]\s*(\d+)\s*bin\b/i,
    );
    if (rangeBudget) {
      upsert(byField, {
        fieldKey: "budget",
        range: {
          min: Number(rangeBudget[1]) * 1000,
          max: Number(rangeBudget[2]) * 1000,
          unit: "TRY",
        },
        strength: "MUST",
        confidence: 0.9,
        provenance: "EXPLICIT",
        evidence: [rangeBudget[0]],
      });
    }
  }

  // --- Grade 304 ---
  if (/\b304\b/.test(text) && /\b(paslanmaz|sac|çelik|celik)\b/i.test(text)) {
    upsert(byField, {
      fieldKey: "grade",
      value: "304",
      strength: "MUST",
      confidence: 0.92,
      provenance: "EXPLICIT",
      evidence: ["304"],
    });
  }

  // Resolution contradiction
  if (
    byField.resolution?.value &&
    byField.resolution.excludedValues?.some(
      (e) =>
        e.toLocaleLowerCase("tr-TR") ===
        byField.resolution!.value!.toLocaleLowerCase("tr-TR"),
    )
  ) {
    conflicts.push({
      kind: "RESOLUTION_INCLUDE_EXCLUDE",
      message: "Aynı çözünürlük hem isteniyor hem dışlanıyor",
      fields: ["resolution"],
    });
    byField.resolution = {
      ...byField.resolution,
      value: null,
      confidence: 0.4,
    };
  }

  return { byField, conflicts };
}

export function toConstraintMatchContract(
  bundle: ConstraintBundle | undefined | null,
): ConstraintMatchContract {
  const must: ConstraintMatchContract["must"] = [];
  const preferred: ConstraintMatchContract["preferred"] = [];
  const excluded: ConstraintMatchContract["excluded"] = [];
  const anyFields: string[] = [];
  const ranges: ConstraintMatchContract["ranges"] = [];

  if (!bundle) {
    return { must, preferred, excluded, anyFields, ranges };
  }

  for (const c of Object.values(bundle.byField)) {
    if (c.any) anyFields.push(c.fieldKey);
    if (c.excludedValues?.length) {
      excluded.push({ fieldKey: c.fieldKey, values: c.excludedValues });
    }
    const prefs = c.preferredValues?.length
      ? c.preferredValues
      : c.allowedValues?.length
        ? c.allowedValues
        : [];
    if (prefs.length) {
      preferred.push({ fieldKey: c.fieldKey, values: prefs });
    }
    if (c.strength === "MUST" && (c.value || c.range)) {
      must.push({ fieldKey: c.fieldKey, value: c.value, range: c.range });
    }
    if (c.range) {
      ranges.push({ fieldKey: c.fieldKey, ...c.range });
    }
  }

  return { must, preferred, excluded, anyFields, ranges };
}

export function toConstraintFilterContract(
  bundle: ConstraintBundle | undefined | null,
): ConstraintFilterContract {
  const include: Record<string, string[]> = {};
  const exclude: Record<string, string[]> = {};
  const preferred: Record<string, string[]> = {};
  const range: ConstraintFilterContract["range"] = {};
  const any: string[] = [];

  if (!bundle) return { include, exclude, preferred, range, any };

  for (const c of Object.values(bundle.byField)) {
    if (c.any) any.push(c.fieldKey);
    if (c.excludedValues?.length) exclude[c.fieldKey] = c.excludedValues;
    if (c.preferredValues?.length) preferred[c.fieldKey] = c.preferredValues;
    if (c.allowedValues?.length) include[c.fieldKey] = c.allowedValues;
    else if (c.value && c.strength === "MUST") include[c.fieldKey] = [c.value];
    if (c.range) range[c.fieldKey] = c.range;
  }

  return { include, exclude, preferred, range, any };
}

/**
 * True when "ikinci el" / used appears only under negation (olmasın / istemiyorum).
 */
export function isConditionUsedNegated(text: string): boolean {
  const m = fold(text).match(CONDITION_USED);
  if (!m || m.index == null) return false;
  return isNegatedWindow(windowAround(fold(text), m.index, m[0].length, 40));
}

/**
 * Brands mentioned only in exclusion windows (should not become identity.brand).
 */
export function brandsOnlyInExclusion(text: string): Set<string> {
  const all = brandMatchesInText(text);
  const only = new Set<string>();
  for (const brand of all) {
    const re = new RegExp(
      `(?:^|[^a-zçğıöşü0-9])${escapeRegex(brand)}(?=$|[^a-zçğıöşü0-9])`,
      "gi",
    );
    let m: RegExpExecArray | null;
    let positive = false;
    let negative = false;
    while ((m = re.exec(text)) !== null) {
      if (isNegatedMention(text, m.index, m[0].length)) negative = true;
      else positive = true;
    }
    if (negative && !positive) only.add(brand);
  }
  return only;
}
