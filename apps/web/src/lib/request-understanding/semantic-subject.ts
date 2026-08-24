/**
 * B3.7 — Semantic subject & relationship layer.
 * Deterministic: what the user is actually seeking + how other entities relate.
 * No brand/model-specific production branches.
 */
import { isKnownAutomotiveModelName } from "@/lib/ai/parser/brand-catalog";
import { isKnownPartNoun, stripTrailingPartNouns } from "@/lib/ai/parser/part-nouns";
import { hasFurnitureObjectNoun } from "@/lib/ai/parser/category";
import { isCanonicalWholeProductPhrase } from "@/lib/taxonomy/phrase-classification";
import { isRequestedItemNotModel } from "./requested-item-role";
import {
  containsPhraseToken,
  coversRequestedTokens,
  readRequestedTarget,
  resolveCompatibilityAuthority,
  resolvePartBearingParent,
  splitCompatibilityPhrase,
} from "./part-relation";
import { clamp01, uv } from "./provenance";
import type {
  ParentEntityKind,
  RequestIntent,
  RequestRelationship,
  RequestSubjectKind,
  SemanticRequestSubject,
  SubjectRelation,
  UnderstandingDecision,
  UnderstandingValue,
} from "./types";

/** Component / spare-part lexicon (generic Turkish) */
const PART_LEMMAS = [
  "tampon",
  "far",
  "ayna",
  "filtre",
  "kapak",
  "motor",
  "pompa",
  "merdane",
  "balata",
  "kart",
  "parça",
  "parca",
  "yedek parça",
  "yedek parca",
  "kablo",
  "adaptör",
  "adaptor",
  "hazne",
  "batarya",
  "akü",
  "aku",
  "mandren",
  "radyatör",
  "radyator",
  "egzoz",
  "egzoz",
  "disk",
  "kampana",
  "amortisör",
  "amortisor",
  "rot",
  "şanzıman",
  "sanziman",
  "debriyaj",
  "debriyaj",
  "fren",
  "rulman",
  "şarj adaptörü",
  "sarj adaptoru",
  "şarj adaptoru",
  "sarj adaptörü",
] as const;

const ACCESSORY_LEMMAS = [
  "kılıf",
  "kilif",
  "stand",
  "aparat",
  "çanta",
  "canta",
  "aksesuar",
  "uzatma",
  "başlık",
  "baslik",
  "şarj",
  "sarj",
] as const;

/** Categories that must never collapse to VEHICLE via numeric false positives */
const NON_VEHICLE_CATEGORIES = new Set([
  "technology",
  "appliances",
  "home-kitchen",
  "furniture",
  "health",
  "baby",
  "printing",
  "real-estate",
  "services",
  "machinery",
]);

const MOTOR_PART_CONTEXT_RE =
  /(?:çıkma|cikma|yedek|muadil|uyumlu|kapa|pompa|yağ|yag|\biçin\b|\bicin\b|2\.?\s*el|ikinci\s*el)/i;

const SERVICE_LEMMAS = [
  "bakım",
  "bakim",
  "onarım",
  "onarim",
  "tamir",
  "boyama",
  "boya",
  "badana",
  "montaj",
  "kurulum",
  "kaplama",
  "servis",
  "revizyon",
  "temizlik",
] as const;

const POSITION_TOKENS = [
  "ön",
  "on",
  "arka",
  "sağ",
  "sag",
  "sol",
  "üst",
  "ust",
  "alt",
  "iç",
  "ic",
  "dış",
  "dis",
] as const;

const POSITION_CANON: Record<string, string> = {
  on: "ön",
  ön: "ön",
  arka: "arka",
  sag: "sağ",
  sağ: "sağ",
  sol: "sol",
  ust: "üst",
  üst: "üst",
  alt: "alt",
  ic: "iç",
  iç: "iç",
  dis: "dış",
  dış: "dış",
};

const PART_NEGATION =
  /(?:parça|parca|tampon|far|ayna|filtre|balata|yedek)\s*(?:istemiyorum|istemiyoz|değil|degil)|(?:araç|arac|kendisini|komple\s+(?:cihaz|makine|araç|arac))\s*(?:arıyorum|ariyorum|lazım|lazim)/i;

const WHOLE_VEHICLE_SEEK =
  /\b(?:araç|arac)\s*(?:arıyorum|ariyorum|lazım|lazim)|(?:komple|kendisini)\s*(?:arıyorum|ariyorum)|(?:satın\s*almak|satin\s*almak|satın\s*alıyorum|satin\s*aliyorum|almak\s*istiyorum)/i;

type IdentityLite = {
  brand?: string | null;
  model?: string | null;
  series?: string | null;
  variant?: string | null;
};

export type SemanticSubjectInput = {
  normalizedInput: string;
  identity: IdentityLite;
  intent: RequestIntent;
  categoryId?: string | null;
  quantity?: number | null;
  area?: number | null;
  roomCount?: string | null;
  listingType?: string | null;
  /** Automotive model token from catalog when present */
  automotiveModel?: string | null;
  /**
   * Structured / browse-pinned commercial need (EXPLICIT).
   * When set, overrides ambiguous brand+model → vehicle collapse.
   */
  forcedNeedType?: string | null;
};

function decision<T>(
  value: T | null,
  confidence: number,
  evidence: string[],
): UnderstandingDecision<T> {
  const status =
    value == null || confidence < 0.35
      ? ("UNKNOWN" as const)
      : confidence < 0.65
        ? ("TENTATIVE" as const)
        : ("CONFIDENT" as const);
  return {
    value: status === "UNKNOWN" ? null : value,
    confidence: clamp01(confidence),
    status,
    evidence,
  };
}

/** Strip common Turkish possessive / compound suffixes from a lemma match. */
export function normalizeSubjectLemma(raw: string): string {
  const t = raw.trim().toLocaleLowerCase("tr-TR");
  const strip = (base: string, suffixes: string[]) => {
    for (const s of suffixes) {
      if (t === base + s || t.startsWith(base) && t.length <= base.length + 3) {
        if (t.startsWith(base)) return base;
      }
    }
    return null;
  };
  for (const lemma of [...PART_LEMMAS, ...ACCESSORY_LEMMAS, ...SERVICE_LEMMAS]) {
    if (lemma.includes(" ")) continue;
    const hit = strip(lemma, [
      "sı",
      "si",
      "su",
      "sü",
      "ı",
      "i",
      "u",
      "ü",
      "yı",
      "yi",
      "yu",
      "yü",
      "nın",
      "nin",
      "nun",
      "nün",
    ]);
    if (hit) return hit;
    if (t === lemma || t.startsWith(lemma)) return lemma;
  }
  return t;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * JS \\b is ASCII-only — breaks on Turkish letters (ç, ğ, ı, ş, ü, ö).
 * Use letter/number class boundaries instead.
 */
function lemmaPattern(lemma: string): RegExp {
  if (lemma.includes(" ")) {
    return new RegExp(`(?:^|[^\\p{L}\\p{N}])(${escapeRe(lemma)})(?=[^\\p{L}\\p{N}]|$)`, "iu");
  }
  // Include common Turkish possessive + consonant mutation (kapak→kapağı)
  const suffixes =
    "(?:sı|si|su|sü|ı|i|u|ü|yı|yi|yu|yü|ğı|gi|ğu|gü|ği|nın|nin|nun|nün)?";
  let body = `${escapeRe(lemma)}${suffixes}`;
  if (lemma === "kapak") {
    body = `(?:kapak${suffixes}|kapağ[ıiuü])`;
  }
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])(${body})(?=[^\\p{L}\\p{N}]|$)`, "iu");
}

function findLemmaHit(
  text: string,
  lemmas: readonly string[],
): { raw: string; lemma: string; index: number } | null {
  let best: { raw: string; lemma: string; index: number } | null = null;
  for (const lemma of lemmas) {
    const pattern = lemmaPattern(lemma);
    const m = text.match(pattern);
    if (!m || m.index == null || !m[1]) continue;
    const raw = m[1];
    const index = m.index + (m[0].length - raw.length);
    const normalized = normalizeSubjectLemma(raw.startsWith("kapağ") ? "kapak" : raw);
    // Prefer earlier hits; when tied/overlapping, prefer longer/more specific lemma
    const score = normalized.length;
    if (
      !best ||
      index < best.index ||
      (index === best.index && score > best.lemma.length)
    ) {
      best = { raw, lemma: normalized, index };
    }
  }
  // Prefer kapak over motor when both present
  if (best?.lemma === "motor") {
    const kapak = findLemmaHit(text, ["kapak"]);
    if (kapak) return kapak;
  }
  return best;
}

function extractPositions(text: string, beforeIndex: number): string | null {
  const window = text.slice(Math.max(0, beforeIndex - 24), beforeIndex);
  const found: string[] = [];
  const lower = window.toLocaleLowerCase("tr-TR");
  for (const tok of POSITION_TOKENS) {
    const re = new RegExp(`(?:^|\\s)${escapeRe(tok)}(?:\\s|$)`, "i");
    if (re.test(lower)) {
      const canon = POSITION_CANON[tok] ?? tok;
      if (!found.includes(canon)) found.push(canon);
    }
  }
  // Prefer spatial order: sol/sağ then ön/arka
  const order = ["sol", "sağ", "ön", "arka", "üst", "alt", "iç", "dış"];
  found.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return found.length ? found.join(" ") : null;
}

/**
 * Generic parent identity reconciliation — never invent brands.
 * Fixes cases where brand string already embeds the model token.
 */
export function reconcileParentIdentityTokens(
  identity: IdentityLite,
  opts?: { automotiveModel?: string | null },
): { brand: string | null; model: string | null; series: string | null } {
  let brand = identity.brand?.trim() || null;
  let model = identity.model?.trim() || null;
  const series = identity.series?.trim() || null;

  if (opts?.automotiveModel) {
    const am = opts.automotiveModel.trim();
    if (!model || model.toLocaleLowerCase("tr-TR") !== am.toLocaleLowerCase("tr-TR")) {
      model = am;
    }
  }

  if (model) {
    const cleaned = stripTrailingPartNouns(model);
    model = cleaned || null;
  }
  if (model && isKnownPartNoun(model)) {
    model = null;
  }

  // Known vehicle model occupying brand: demote so catalog can fill parent brand
  if (brand && isKnownAutomotiveModelName(brand)) {
    if (
      !model ||
      model.toLocaleLowerCase("tr-TR") === brand.toLocaleLowerCase("tr-TR")
    ) {
      model = brand;
    }
    brand = null;
  }

  if (brand && model) {
    const brandLower = brand.toLocaleLowerCase("tr-TR");
    const modelLower = model.toLocaleLowerCase("tr-TR");
    if (brandLower === modelLower) {
      // Brand collapsed into model — keep model only
      brand = null;
    } else if (brandLower.endsWith(modelLower)) {
      const stripped = brand.slice(0, brand.length - model.length).trim();
      if (stripped) brand = stripped;
    } else {
      const tokens = brand.split(/\s+/);
      const last = tokens[tokens.length - 1]?.toLocaleLowerCase("tr-TR");
      if (tokens.length > 1 && last === modelLower) {
        brand = tokens.slice(0, -1).join(" ");
      }
    }
  }

  // Multi-token brand with no model: split first token as brand, rest as model
  // only when remainder looks like a model-ish token (letter+digit or known short name)
  if (brand && !model) {
    const tokens = brand.split(/\s+/);
    if (tokens.length >= 2) {
      const rest = tokens.slice(1).join(" ");
      if (
        /^[A-Za-zÇĞİÖŞÜçğıöşü]{1,3}\d/i.test(rest) ||
        /^[A-Za-zÇĞİÖŞÜçğıöşü][A-Za-zÇĞİÖŞÜçğıöşü0-9.\-]{1,20}$/i.test(rest)
      ) {
        brand = tokens[0];
        model = rest;
      }
    }
  }

  return { brand, model, series };
}

function parentKindFromContext(
  categoryId: string | null | undefined,
  subjectKind: RequestSubjectKind,
): ParentEntityKind {
  if (categoryId === "automotive" || subjectKind === "PART") {
    // refined below
  }
  if (categoryId === "automotive") return "VEHICLE";
  if (categoryId === "machinery") return "MACHINE";
  if (categoryId === "real-estate") return "PROPERTY";
  if (categoryId === "technology" || categoryId === "appliances" || categoryId === "home-kitchen") {
    return "PRODUCT";
  }
  return "OTHER";
}

function buildParentEntity(
  identity: IdentityLite,
  kind: ParentEntityKind,
  automotiveModel?: string | null,
): SemanticRequestSubject["parentEntity"] | undefined {
  const reconciled = reconcileParentIdentityTokens(identity, { automotiveModel });
  if (!reconciled.brand && !reconciled.model && !reconciled.series) return undefined;

  const parent: NonNullable<SemanticRequestSubject["parentEntity"]> = { kind };
  if (reconciled.brand) {
    parent.brand = uv(reconciled.brand, {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      confidence: 0.9,
      evidence: [reconciled.brand],
    });
  }
  if (reconciled.model) {
    parent.model = uv(reconciled.model, {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      confidence: 0.9,
      evidence: [reconciled.model],
    });
  }
  if (reconciled.series) {
    parent.series = uv(reconciled.series, {
      provenance: "EXPLICIT",
      source: "PRODUCT_IDENTITY",
      confidence: 0.75,
      evidence: [reconciled.series],
    });
  }
  return parent;
}

function parentDisplay(parent?: SemanticRequestSubject["parentEntity"]): string {
  if (!parent) return "";
  const parts = [
    parent.brand?.value,
    parent.model?.value,
    parent.series?.value,
  ].filter(Boolean) as string[];
  return dedupeAdjacentTokens(parts.join(" "));
}

/** Generic adjacent token dedupe for headlines */
export function dedupeAdjacentTokens(text: string): string {
  const tokens = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const t of tokens) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.toLocaleLowerCase("tr-TR") === t.toLocaleLowerCase("tr-TR")
    ) {
      continue;
    }
    out.push(t);
  }
  return out.join(" ");
}

function detectServiceTarget(text: string): string | null {
  if (/(?:^|[^\p{L}\p{N}])ofis(?=[^\p{L}\p{N}]|$)/iu.test(text)) return "ofis";
  if (/(?:^|[^\p{L}\p{N}])ev(?=[^\p{L}\p{N}]|$)/iu.test(text)) return "ev";
  if (/(?:^|[^\p{L}\p{N}])daire(?=[^\p{L}\p{N}]|$)/iu.test(text)) return "daire";
  if (/(?:^|[^\p{L}\p{N}])klima(?=[^\p{L}\p{N}]|$)/iu.test(text)) return "klima";
  return null;
}

function detectManufactureProduct(text: string): {
  product: string;
  modifier?: string;
} | null {
  const logo = /(?:^|[^\p{L}\p{N}])logolu(?=[^\p{L}\p{N}]|$)/iu.test(text)
    ? "logolu"
    : undefined;
  if (/(?:^|[^\p{L}\p{N}])kutu(?=[^\p{L}\p{N}]|$)/iu.test(text)) {
    return { product: "kutu", modifier: logo };
  }
  if (/(?:^|[^\p{L}\p{N}])(?:çanta|canta)(?=[^\p{L}\p{N}]|$)/iu.test(text)) {
    return { product: "çanta", modifier: logo };
  }
  if (/(?:^|[^\p{L}\p{N}])kartvizit(?=[^\p{L}\p{N}]|$)/iu.test(text)) {
    return { product: "kartvizit", modifier: logo };
  }
  return null;
}

/**
 * Resolve semantic request subject from evidence.
 */
/**
 * UYUMLULUK NİTELİĞİ TAŞIYAN TALEP KONULARI (1E).
 *
 * Sistemde bugün ikisi var. `RequestSubjectKind` genişlerse (COMPONENT,
 * SPARE_PART …) yeni tür buraya eklenir ve aynı kapıdan geçer — dal başına
 * ayrı bir kapı AÇILMAZ, ilk sorunun kaynağı buydu.
 */
const COMPATIBILITY_KINDS: ReadonlySet<RequestSubjectKind> = new Set([
  "PART",
  "ACCESSORY",
]);

/** TENTATIVE eşiği `decision()` ile aynı: 0.35 ≤ c < 0.65. */
const UNPROVEN_COMPATIBILITY_CONFIDENCE = 0.5;

/**
 * TEK KAPI — hangi daldan gelirse gelsin, uyumluluk kararı buradan geçer.
 *
 * Eski sözlükler (PART_LEMMAS, ACCESSORY_LEMMAS) "sağdaki ifade parça/aksesuar
 * olabilir mi?" sorusunu yanıtlamaya devam eder; ama "bu parent gerçekten bu
 * parçayı taşır ve sonuç CONFIDENT'tır" kararını veremezler. Kanıt yoksa
 * KONU TÜRÜ KORUNUR (eski sözleşmeler bozulmaz) ama güven TENTATIVE'e düşer
 * ve gerekçe karar günlüğüne yazılır.
 */
function applyCompatibilityAuthority(
  subject: SemanticRequestSubject,
  input: SemanticSubjectInput,
): SemanticRequestSubject {
  const kindValue = subject.kind.value;
  if (!kindValue || !COMPATIBILITY_KINDS.has(kindValue)) return subject;

  const parent = subject.parentEntity;
  const hasIdentityParent = Boolean(
    parent?.brand?.value ||
      parent?.model?.value ||
      input.identity.brand ||
      input.identity.model ||
      input.automotiveModel,
  );
  /**
   * KULLANICININ DOĞRULADIĞI ROL (1F) — çıkarım değil, beyandır.
   * Browse/structured akışta "Yedek parça"yı kullanıcı seçtiyse rol bir daha
   * sorulmaz; ama bu seçim üst ürünü KANITLAMAZ.
   */
  const roleConfirmedByUser = Boolean(input.forcedNeedType?.trim());
  const authority = resolveCompatibilityAuthority(
    input.normalizedInput,
    {
      brand: input.identity.brand,
      model: input.identity.model,
      catalogModel: input.automotiveModel,
    },
    hasIdentityParent,
    roleConfirmedByUser,
  );
  const roleEvidence = roleConfirmedByUser ? ["user-confirmed-role"] : [];
  if (authority.verdict === "NO_PARENT_CLAIM") {
    return roleEvidence.length
      ? withKindEvidence(subject, roleEvidence)
      : subject;
  }

  if (authority.verdict === "VERIFIED") {
    return withKindEvidence(subject, [
      ...roleEvidence,
      authority.evidence!.code,
    ]);
  }

  /**
   * KANITSIZ İLİŞKİ — kategori şeması ne olursa olsun istenen şey KAYBOLMAZ.
   *
   * Doğrulanmış ilişkide kanonik parça adını alan katmanı taşır
   * (`fields.part`). Kanıt yokken o katman yok: baby/mobilya şemasında
   * `part` alanı bulunmadığı için ifade domain geçişinde siliniyor ve
   * kullanıcının istediği şey yalnız audit kaydında kalıyordu (ölçüldü).
   * Bu yüzden kanıtsız durumda BİRİNCİL yüzey konunun kendisidir: adı,
   * kullanıcının bağlacın sağına yazdığı ifade olur.
   */
  const requested = splitCompatibilityPhrase(input.normalizedInput);
  const requestedItem = requested
    ? readRequestedTarget(requested.requested).value
    : null;
  const keepsUserWording =
    requestedItem &&
    subject.name?.value &&
    coversRequestedTokens(requestedItem, String(subject.name.value));
  const named =
    requestedItem && keepsUserWording
      ? {
          ...subject,
          name: uv(requestedItem, {
            provenance: "EXPLICIT",
            source: "USER_EXPLICIT",
            confidence: 0.6,
            evidence: [requestedItem],
          }),
          displayPhrase: uv(requestedItem, {
            provenance: "EXPLICIT",
            source: "NORMALIZED_EXPLICIT",
            confidence: 0.6,
            evidence: [requestedItem],
          }),
        }
      : subject;

  return {
    ...named,
    kind: {
      ...named.kind,
      confidence: Math.min(
        named.kind.confidence,
        UNPROVEN_COMPATIBILITY_CONFIDENCE,
      ),
      status: "TENTATIVE",
      evidence: [
        ...(named.kind.evidence ?? []),
        ...roleEvidence,
        `compat-authority:${authority.reason}`,
      ],
    },
  };
}

/** Kanıt kodunu yinelemeden ekler. */
function withKindEvidence(
  subject: SemanticRequestSubject,
  codes: string[],
): SemanticRequestSubject {
  const evidence = subject.kind.evidence ?? [];
  const missing = codes.filter((c) => !evidence.includes(c));
  return missing.length
    ? { ...subject, kind: { ...subject.kind, evidence: [...evidence, ...missing] } }
    : subject;
}

export function resolveSemanticSubject(
  input: SemanticSubjectInput,
): SemanticRequestSubject {
  return applyCompatibilityAuthority(resolveSemanticSubjectCore(input), input);
}

function resolveSemanticSubjectCore(
  rawInputArg: SemanticSubjectInput,
): SemanticRequestSubject {
  /**
   * İSTENEN ŞEY ÜST ÜRÜNÜN MODELİ OLAMAZ — TÜM parentEntity üretimi için (1B).
   *
   * Kural `requested-item-role.ts` içinde TEK yerde tanımlıdır; burada
   * `buildParentEntity`nin 11 çağrı yerinin hepsini birden kapsayacak biçimde
   * girdi kimliğine bir kez uygulanır.
   *
   * Ölçülen uydurmalar bu güvence olmadan şunlardı:
   *   "Bosch için rezistans arıyorum"        → parentEntity.model = "rezistans"
   *   "Bosch kampanya için destek arıyorum"  → parentEntity.model = "kampanya destek"
   *   "Bosch acil için servis arıyorum"      → parentEntity.model = "acil servis"
   * Üçünde de kullanıcı hiçbir model yazmamıştı. Üst ürün belirtilmemişse
   * sistem yüksek güvenli bir model uydurmaz; alan boş kalır.
   *
   * Bağlacın SOLUNDA da geçen jetonlar korunur ("Heidelberg SM 74 için …",
   * "Alfa Romeo 156 için yedek parça") — kural konumsaldır, kelimeye özel değil.
   */
  const input: SemanticSubjectInput = {
    ...rawInputArg,
    identity: {
      ...rawInputArg.identity,
      model:
        rawInputArg.identity.model &&
        isRequestedItemNotModel(
          rawInputArg.normalizedInput,
          rawInputArg.identity.model,
        )
          ? null
          : rawInputArg.identity.model,
    },
  };
  // tr-TR lowercase up front: the regex `i` flag does NOT fold Turkish İ/I
  // (/yaptır/iu never matches "YAPTIRMAK"), so all-caps input used to blind
  // every Turkish pattern in this resolver.
  const text = input.normalizedInput.toLocaleLowerCase("tr-TR");
  const evidence: string[] = [];
  const alternatives: SemanticRequestSubject["alternatives"] = [];

  const forcedNeed = input.forcedNeedType?.trim().toLowerCase() ?? null;

  // Browse / structured EXPLICIT needType beats ambiguous brand+model collapse.
  if (forcedNeed === "part" || forcedNeed === "tire") {
    const parentKind: ParentEntityKind =
      input.categoryId === "machinery" || input.categoryId === "industrial"
        ? "MACHINE"
        : input.categoryId === "automotive" || input.automotiveModel
          ? "VEHICLE"
          : "PRODUCT";
    const parent = buildParentEntity(
      input.identity,
      parentKind,
      input.automotiveModel,
    );
    const partHit = findLemmaHit(text, PART_LEMMAS);
    const name =
      forcedNeed === "tire"
        ? "lastik"
        : partHit &&
            partHit.lemma !== "parça" &&
            partHit.lemma !== "parca" &&
            partHit.lemma !== "motor" &&
            partHit.lemma !== "fren"
          ? partHit.lemma
          : "yedek parça";
    return {
      kind: decision("PART", 0.95, [
        "forcedNeedType=part",
        ...(partHit ? [partHit.raw] : []),
      ]),
      name: uv(name, {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        confidence: 0.95,
        evidence: ["forcedNeedType"],
      }),
      displayPhrase: uv(name, {
        provenance: "EXPLICIT",
        source: "NORMALIZED_EXPLICIT",
        confidence: 0.95,
        evidence: ["forcedNeedType"],
      }),
      parentEntity: parent,
      relation: decision("PART_OF", 0.9, ["forced-part"]),
      relationship: decision("PART_FOR_PRODUCT", 0.9, ["forced-part"]),
    };
  }

  if (forcedNeed === "service") {
    const parent = buildParentEntity(
      input.identity,
      input.categoryId === "automotive" ? "VEHICLE" : "PRODUCT",
      input.automotiveModel,
    );
    return {
      kind: decision("SERVICE", 0.95, ["forcedNeedType=service"]),
      name: uv("bakım", {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        confidence: 0.9,
        evidence: ["forcedNeedType"],
      }),
      displayPhrase: uv("bakım", {
        provenance: "EXPLICIT",
        source: "NORMALIZED_EXPLICIT",
        confidence: 0.9,
        evidence: ["forcedNeedType"],
      }),
      parentEntity: parent,
      relationship: decision("SERVICE_FOR_OBJECT", 0.9, ["forced-service"]),
      relation: decision("UNKNOWN", 0.5, []),
    };
  }

  if (forcedNeed === "vehicle") {
    const parent = buildParentEntity(
      input.identity,
      "VEHICLE",
      input.automotiveModel,
    );
    const label = parentDisplay(parent) || "araç";
    return {
      kind: decision("VEHICLE", 0.95, ["forcedNeedType=vehicle"]),
      name: uv(label, {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        confidence: 0.9,
        evidence: ["forcedNeedType"],
      }),
      displayPhrase: uv(label, {
        provenance: "EXPLICIT",
        source: "NORMALIZED_EXPLICIT",
        confidence: 0.9,
        evidence: ["forcedNeedType"],
      }),
      parentEntity: parent,
      relationship: decision("VEHICLE_REQUEST", 0.9, ["forced-vehicle"]),
      relation: decision("UNKNOWN", 0.4, []),
    };
  }

  const partNegated = PART_NEGATION.test(text);
  const explicitVehiclePurchase = WHOLE_VEHICLE_SEEK.test(text);
  const wholeVehicle = explicitVehiclePurchase || partNegated;

  /**
   * NİYET ÖNCELİĞİ — AÇIK ÜRETİM, PARÇA SÖZLÜĞÜNÜ YENER (1F).
   *
   * "Fason üretim için plastik parça ürettirmek istiyorum" bir parça TEDARİK
   * talebi değil, ÜRETTİRME talebidir; ama "parça" sözlükte olduğu için parça
   * dalı cümleyi kapıyor ve niyeti PART'a çeviriyordu (ölçüldü).
   *
   * Kural ada özel değildir: niyet katmanı AÇIK üretim kanıtı gördüyse (zayıf
   * alan adları artık niyet seçtiremiyor, bkz. intent-signals) parça ve
   * aksesuar sözlükleri o cümleyi sahiplenemez. Kullanıcının KENDİ seçtiği rol
   * (`forcedNeedType`) bunun üstündedir — o bir çıkarım değil, beyandır.
   */
  const explicitManufactureIntent =
    input.intent === "MANUFACTURE" && !forcedNeed;
  const partHit = explicitManufactureIntent
    ? null
    : findLemmaHit(text, PART_LEMMAS);
  const accessoryHit = explicitManufactureIntent
    ? null
    : findLemmaHit(text, ACCESSORY_LEMMAS);
  const serviceHit = findLemmaHit(text, SERVICE_LEMMAS);

  const hasCompatibilityTarget =
    Boolean(input.automotiveModel) ||
    identitySuggestsVehicle(input.identity) ||
    isKnownAutomotiveModelName(input.identity.model) ||
    isKnownAutomotiveModelName(input.identity.brand) ||
    Boolean(input.identity.brand && input.identity.model);

  // --- PART ---
  if (partHit && !wholeVehicle) {
    // Bare "motor" without a compatibility target often means powertrain
    // preference on a vehicle purchase. Model/entity + part noun → PART.
    const motorBareWithoutTarget =
      partHit.lemma === "motor" &&
      !MOTOR_PART_CONTEXT_RE.test(text) &&
      !hasCompatibilityTarget;
    const effectiveLemma =
      motorBareWithoutTarget
        ? null
        : partHit.lemma === "fren" && /balata/i.test(text)
          ? "balata"
          : partHit.lemma === "fren"
            ? null
            : partHit.lemma === "şarj" || partHit.lemma === "sarj"
              ? "şarj adaptörü"
              : partHit.lemma;

    if (effectiveLemma) {
      const pos = extractPositions(text, partHit.index);
      const name =
        effectiveLemma === "parça" || effectiveLemma === "parca"
          ? "parça"
          : effectiveLemma === "şarj adaptörü" ||
              effectiveLemma === "sarj adaptoru" ||
              effectiveLemma === "şarj adaptoru" ||
              effectiveLemma === "sarj adaptörü"
            ? "şarj adaptörü"
            : effectiveLemma;
      // Position tokens already in the noun must not be re-prefixed
      const nameLower = name.toLocaleLowerCase("tr-TR");
      const posSafe =
        pos &&
        !pos
          .split(/\s+/)
          .every((tok) => nameLower.includes(tok.toLocaleLowerCase("tr-TR")))
          ? pos
          : pos && !nameLower.includes(pos.toLocaleLowerCase("tr-TR"))
            ? pos
              .split(/\s+/)
              .filter((tok) => !nameLower.includes(tok.toLocaleLowerCase("tr-TR")))
              .join(" ") || null
            : null;
      const display = [posSafe, name].filter(Boolean).join(" ");

      evidence.push(partHit.raw);
      if (posSafe) evidence.push(posSafe);

      const safeParentKind: ParentEntityKind =
        input.categoryId === "machinery"
          ? "MACHINE"
          : input.categoryId === "automotive" ||
              (Boolean(input.automotiveModel) &&
                !NON_VEHICLE_CATEGORIES.has(input.categoryId ?? ""))
            ? "VEHICLE"
            : input.categoryId === "technology" ||
                input.categoryId === "appliances" ||
                input.categoryId === "home-kitchen" ||
                input.categoryId === "health" ||
                input.categoryId === "baby"
              ? "PRODUCT"
              : identitySuggestsVehicle(input.identity) &&
                  !NON_VEHICLE_CATEGORIES.has(input.categoryId ?? "")
                ? "VEHICLE"
                : "PRODUCT";

      if (accessoryHit) {
        alternatives.push({
          kind: "ACCESSORY",
          confidence: 0.55,
          evidence: [accessoryHit.raw],
        });
      }

      return {
        kind: decision("PART", 0.88, evidence),
        name: uv(name, {
          provenance: "EXPLICIT",
          source: "USER_EXPLICIT",
          confidence: 0.9,
          evidence: [partHit.raw],
        }),
        displayPhrase: uv(display, {
          provenance: "EXPLICIT",
          source: "NORMALIZED_EXPLICIT",
          confidence: 0.9,
          evidence,
        }),
        position: posSafe
          ? uv(posSafe, {
              provenance: "EXPLICIT",
              source: "USER_EXPLICIT",
              confidence: 0.9,
              evidence: [posSafe],
            })
          : undefined,
        parentEntity: buildParentEntity(
          input.identity,
          safeParentKind,
          NON_VEHICLE_CATEGORIES.has(input.categoryId ?? "")
            ? null
            : input.automotiveModel,
        ),
        relation: decision("PART_OF", 0.85, ["part-of-parent"]),
        relationship: decision("PART_FOR_PRODUCT", 0.85, ["part-for-product"]),
        alternatives,
      };
    }
  }

  // Structural "X için Y" when Y looks like a spare and lemma path did not resolve
  const forPart = text.match(
    /(.+?)\s+için\s+(.+?)(?:\s+(?:arıyorum|ariyorum|lazım|lazim)|$)/iu,
  );
  if (
    !wholeVehicle &&
    // Açık üretim niyeti ilişki yapısını da yener (1F): "Fason üretim için
    // plastik parça ürettirmek" bir tedarik değil, ürettirme talebidir.
    !explicitManufactureIntent &&
    forPart?.[2] &&
    /(?:arıyorum|ariyorum|lazım|lazim|olmasın)/i.test(text)
  ) {
    const requested = forPart[2].trim();
    const requestedLower = requested.toLocaleLowerCase("tr-TR");
    /**
     * ÜST ÜRÜN KANITI HER İKİ DALIN DA ÖN KOŞULUDUR (1C).
     *
     * "X için Y" yapısı tek başına parça ilişkisi kurmaz: X kullanım YERİ,
     * kişi ya da amaç olabilir. Sözlük tuttuğunda bile ("rezistans",
     * "kapı kolu", "masa ayağı" PART_LEMMAS içindedir) ölçülen sonuç
     * bölünmüş bir zihindi — "Ev için rezistans" → kind=PART, part=null,
     * üst ürün=null, cümle "konut arıyorum.". Sözlük hedefin NE olduğunu
     * bilir, KİMİN İÇİN olduğunu bilmez; onu kanonik yetkinlik bilir.
     */
    const parentEvidence = resolvePartBearingParent(forPart[1] ?? "", {
      brand: input.identity.brand,
      model: input.identity.model,
      catalogModel: input.automotiveModel,
    });
    const looksLikePart =
      findLemmaHit(requested, PART_LEMMAS) ||
      /(?:parça|parca|yedek|motor|pompa|rulman|tampon|far|adaptör|adaptor)/i.test(
        requestedLower,
      );
    if (parentEvidence && looksLikePart && !findLemmaHit(requested, SERVICE_LEMMAS)) {
      const lemmaHit = findLemmaHit(requested, PART_LEMMAS);
      const name = lemmaHit?.lemma === "parça" || lemmaHit?.lemma === "parca"
        ? "parça"
        : lemmaHit?.lemma ?? requested.split(/\s+/).slice(-2).join(" ");
      const pos = lemmaHit
        ? extractPositions(requested, lemmaHit.index)
        : extractPositions(requested, requested.length);
      const display = [pos, name].filter(Boolean).join(" ");
      const parentKind: ParentEntityKind =
        input.categoryId === "machinery"
          ? "MACHINE"
          : input.categoryId === "automotive" || input.automotiveModel
            ? "VEHICLE"
            : NON_VEHICLE_CATEGORIES.has(input.categoryId ?? "")
              ? "PRODUCT"
              : "VEHICLE";
      return {
        kind: decision("PART", 0.84, ["icin-structure", name, parentEvidence.code]),
        name: uv(name, {
          provenance: "EXPLICIT",
          source: "USER_EXPLICIT",
          confidence: 0.85,
          evidence: [requested],
        }),
        displayPhrase: uv(display || name, {
          provenance: "EXPLICIT",
          source: "NORMALIZED_EXPLICIT",
          confidence: 0.85,
          evidence: [requested],
        }),
        position: pos
          ? uv(pos, {
              provenance: "EXPLICIT",
              source: "USER_EXPLICIT",
              confidence: 0.85,
              evidence: [pos],
            })
          : undefined,
        parentEntity: buildParentEntity(
          input.identity,
          parentKind,
          input.automotiveModel,
        ),
        relation: decision("PART_OF", 0.82, ["icin-part-of"]),
        relationship: decision("PART_FOR_PRODUCT", 0.82, ["icin-part-for"]),
      };
    }

    /**
     * --- AÇIK DÜNYA PARÇA ---
     *
     * Yukarıdaki dal KAPALI DÜNYADIR: hedefi `PART_LEMMAS` sözlüğünde arar.
     * Sözlük tutmayınca kullanıcının yazdığı parça adı üst ürünün MODELİ
     * olarak saklanıyordu ("… için rezistans" → `parentEntity.model =
     * "rezistans"`, `part = null`). Katalog bir allowlist DEĞİLDİR:
     * tanımadığı ad talebi geçersiz kılmaz.
     *
     * ÜST ÜRÜN KANITI ARTIK BU DALIN ÖN KOŞULU DEĞİLDİR (1F). Kanıt kapısı
     * tek yerde, `applyCompatibilityAuthority` içindedir: bu dal ADAYI üretir,
     * authority onu VERIFIED ise CONFIDENT, değilse TENTATIVE olarak
     * derecelendirir. İki yerde kapı tutmak, kanıtsız parent'ta talebi
     * tamamen düşürüyordu — "Matbaa makinesi için kontrol paneli arıyorum"
     * INDUSTRIAL_EQUIPMENT'a düşüp cümle "arıyorum."e iniyordu (ölçüldü).
     *
     * Geriye iki yapısal koşul kalır: sağda somut bir hedef ifade bulunması ve
     * o hedefin bütün bir ürünü adlandırmaması.
     *
     * Kanıt ve güven KASITLI olarak katalog parçasından ayrıdır: sözcükler
     * kullanıcının kendi sözcükleridir (`provenance: EXPLICIT`) ama PARÇA
     * OLMA bilgisi sözdiziminden türetilmiştir, katalogla doğrulanmamıştır.
     */
    const openTarget = readRequestedTarget(requested).value;
    if (
      openTarget &&
      !findLemmaHit(requested, SERVICE_LEMMAS) &&
      // Sağdaki ifade BÜTÜN bir ürünü adlandırıyorsa parça değildir. Kanonik
      // taksonomiye sorulur: "televizyon"/"tablet"/"klima" PRODUCT_TYPE olarak
      // döner ve elenir; "termostat" PART_TYPE, "rezistans" ise hiç düğüm
      // olmadığı için geçer. Bu, "Ofis için televizyon"u kara liste olmadan
      // eleyen ikinci taraftır.
      !isCanonicalWholeProductPhrase(openTarget) &&
      // Hedef, solun kendisi olamaz.
      !containsPhraseToken(forPart[1] ?? "", openTarget)
    ) {
      const evidenceOpen = [
        "open-world-part",
        "icin-structure",
        ...(parentEvidence ? [parentEvidence.code] : []),
      ];
      // Sol taraf pozitif olarak ürün/makine diye tanındığı için burada
      // VEHICLE tahmini yapılmaz — yalnız ölçülebilen tür kullanılır.
      const openParentKind: ParentEntityKind =
        input.categoryId === "machinery"
          ? "MACHINE"
          : input.categoryId === "automotive" || input.automotiveModel
            ? "VEHICLE"
            : "PRODUCT";
      return {
        kind: decision("PART", 0.7, evidenceOpen),
        name: uv(openTarget, {
          provenance: "EXPLICIT",
          source: "DETERMINISTIC_INFERENCE",
          confidence: 0.6,
          evidence: evidenceOpen,
        }),
        displayPhrase: uv(openTarget, {
          provenance: "EXPLICIT",
          source: "DETERMINISTIC_INFERENCE",
          confidence: 0.6,
          evidence: evidenceOpen,
        }),
        parentEntity: buildParentEntity(
          input.identity,
          openParentKind,
          input.automotiveModel,
        ),
        relation: decision("PART_OF", 0.65, ["icin-part-of", "open-world-part"]),
        relationship: decision("PART_FOR_PRODUCT", 0.65, [
          "icin-part-for",
          "open-world-part",
        ]),
      };
    }
  }

  // --- ACCESSORY ---
  // Manufacturing verbs (bastır…) win over accessory lexicon (e.g. çanta)
  const manufactureVerbEarly =
    /(?:^|[^\p{L}\p{N}])(?:bastır\w*|bastir\w*|baskı|baski|imalat|ürettir\w*|urettir\w*)(?=[^\p{L}\p{N}]|$)/iu.test(
      text,
    );
  if (
    accessoryHit &&
    !wholeVehicle &&
    !manufactureVerbEarly &&
    input.intent !== "MANUFACTURE"
  ) {
    evidence.push(accessoryHit.raw);
    if (partHit) {
      alternatives.push({
        kind: "PART",
        confidence: 0.5,
        evidence: [partHit.raw],
      });
    }
    const parentKind = parentKindFromContext(input.categoryId, "ACCESSORY");
    return {
      kind: decision("ACCESSORY", 0.82, evidence),
      name: uv(accessoryHit.lemma, {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        confidence: 0.88,
        evidence: [accessoryHit.raw],
      }),
      displayPhrase: uv(accessoryHit.lemma, {
        provenance: "EXPLICIT",
        source: "NORMALIZED_EXPLICIT",
        confidence: 0.88,
        evidence,
      }),
      parentEntity: buildParentEntity(
        input.identity,
        parentKind === "OTHER" ? "PRODUCT" : parentKind,
        input.automotiveModel,
      ),
      relation: decision("ACCESSORY_FOR", 0.8, ["accessory-for"]),
      relationship: decision("ACCESSORY_FOR_PRODUCT", 0.8, ["accessory-for-product"]),
      alternatives,
    };
  }

  // Manufacture signals before SERVICE — "50.000 adet kutu yaptırmak" is not a service job.
  const mfgProductEarly = detectManufactureProduct(text);
  const manufactureQuantity =
    input.quantity != null ||
    /(?:^|[^\p{L}\p{N}])(?:\d+[.\d]*\s*)?(?:adet|bin|tane)(?=[^\p{L}\p{N}]|$)/iu.test(
      text,
    );
  // "yaptırmak" is a commission verb: with a known manufacture product as its
  // object ("kartvizit yaptırmak") it means production, not a service visit.
  // Without this, the SERVICE trigger two branches below claims it and the
  // category gets overridden to services (business cards asked "Sıklık?").
  const commissionVerb =
    /(?:^|[^\p{L}\p{N}])(?:yaptır\w*|yaptir\w*)(?=[^\p{L}\p{N}]|$)/iu.test(text);
  const manufactureAsk =
    input.intent === "MANUFACTURE" ||
    (mfgProductEarly && (manufactureQuantity || commissionVerb)) ||
    /(?:^|[^\p{L}\p{N}])(?:bastır\w*|bastir\w*|ürettir\w*|urettir\w*|imalat)(?=[^\p{L}\p{N}]|$)/iu.test(
      text,
    );

  // --- SERVICE ---
  const serviceNegated =
    /(?:servis|bakım|bakim|tamir|onarım|onarim)\s*istemiyorum/i.test(text) ||
    /kendisini\s*(?:arıyorum|ariyorum)/i.test(text);
  if (
    !serviceNegated &&
    !manufactureAsk &&
    (input.intent === "SERVICE" ||
      serviceHit ||
      /(?:^|[^\p{L}\p{N}])(?:yaptır\w*|yaptir\w*|boyat\w*|montaj|bakım|bakim)(?=[^\p{L}\p{N}]|$)/iu.test(
        text,
      ))
  ) {
    const serviceLemma =
      serviceHit?.lemma ??
      (/\bboya|boyat|badana/i.test(text)
        ? "boyama"
        : /\bbakım|bakim/i.test(text)
          ? "bakım"
          : /\bmontaj|kurulum/i.test(text)
            ? "montaj"
            : "servis");
    const target = detectServiceTarget(text);
    evidence.push(serviceLemma);
    if (target) evidence.push(target);

    const parent = buildParentEntity(
      input.identity,
      identitySuggestsVehicle(input.identity) || input.automotiveModel
        ? "VEHICLE"
        : "OTHER",
      input.automotiveModel,
    );

    return {
      kind: decision("SERVICE", 0.86, evidence),
      name: uv(serviceLemma, {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        confidence: 0.85,
        evidence: [serviceLemma],
      }),
      displayPhrase: uv(
        target ? `${target} ${serviceLemma}` : serviceLemma,
        {
          provenance: "EXPLICIT",
          source: "NORMALIZED_EXPLICIT",
          confidence: 0.85,
          evidence,
        },
      ),
      serviceType: uv(serviceLemma, {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        confidence: 0.85,
        evidence: [serviceLemma],
      }),
      target: target
        ? uv(target, {
            provenance: "EXPLICIT",
            source: "USER_EXPLICIT",
            confidence: 0.85,
            evidence: [target],
          })
        : undefined,
      parentEntity: parent,
      relation: decision("SERVICE_FOR", 0.8, ["service-for"]),
      relationship: decision("SERVICE_FOR_OBJECT", 0.8, ["service-for-object"]),
    };
  }

  // --- MANUFACTURE ---
  // Note: bare "baskı" must not steal whole "baskı makinesi" equipment purchases.
  const mfgProduct = mfgProductEarly;
  const wholePrintMachine =
    /(?:baskı|baski|ofset)\s*makine/i.test(text) ||
    /makine(?:si)?\s*(?:arıyorum|ariyorum|lazım|lazim)/i.test(text);
  if (manufactureAsk && !(wholePrintMachine && !mfgProduct)) {
    const name = mfgProduct?.product ?? "üretim";
    evidence.push(name);
    return {
      kind: decision("MANUFACTURED_ITEM", 0.88, evidence),
      name: uv(name, {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        confidence: 0.85,
        evidence: [name],
      }),
      displayPhrase: uv(
        [mfgProduct?.modifier, name].filter(Boolean).join(" "),
        {
          provenance: "EXPLICIT",
          source: "NORMALIZED_EXPLICIT",
          confidence: 0.85,
          evidence,
        },
      ),
      relation: decision("MANUFACTURED_AS", 0.8, ["manufacture"]),
      relationship: decision("MANUFACTURE_REQUEST", 0.88, ["manufacture-request"]),
    };
  }

  // --- REAL ESTATE ---
  if (
    (input.intent === "RENT" ||
      input.intent === "SELL" ||
      input.categoryId === "real-estate" ||
      input.roomCount ||
      input.listingType) &&
    !hasFurnitureObjectNoun(text)
  ) {
    const prop =
      /(?:^|[^\p{L}\p{N}])(?:dükkan|dukkan)(?=[^\p{L}\p{N}]|$)/iu.test(text)
        ? "dükkan"
        : /(?:^|[^\p{L}\p{N}])daire(?=[^\p{L}\p{N}]|$)/iu.test(text)
          ? "daire"
          : /(?:^|[^\p{L}\p{N}])ev(?=[^\p{L}\p{N}]|$)/iu.test(text)
            ? "ev"
            : "gayrimenkul";
    return {
      kind: decision("REAL_ESTATE", 0.9, [prop]),
      name: uv(prop, {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        confidence: 0.85,
        evidence: [prop],
      }),
      displayPhrase: uv(prop, {
        provenance: "EXPLICIT",
        source: "NORMALIZED_EXPLICIT",
        confidence: 0.85,
        evidence: [prop],
      }),
      relationship: decision("PROPERTY_REQUEST", 0.9, ["property-request"]),
      relation: decision("UNKNOWN", 0.5, []),
    };
  }

  // --- INDUSTRIAL EQUIPMENT (whole) ---
  // Only when no part/accessory already resolved; require explicit machine ask
  if (
    (input.categoryId === "machinery" ||
      /(?:^|[^\p{L}\p{N}])(?:makine|pres|ofset)(?=[^\p{L}\p{N}]|$)/iu.test(text)) &&
    !partHit &&
    !accessoryHit &&
    (input.intent === "BUY" ||
      /ikinci\s*el|makine\s*(?:arıyorum|lazım|ariyorum|lazim)/i.test(text))
  ) {
    return {
      kind: decision("INDUSTRIAL_EQUIPMENT", 0.85, ["machinery"]),
      name: uv(
        [input.identity.brand, input.identity.model].filter(Boolean).join(" ") ||
          "makine",
        {
          provenance: "EXPLICIT",
          source: "USER_EXPLICIT",
          confidence: 0.8,
          evidence: ["machinery-whole"],
        },
      ),
      parentEntity: undefined,
      relationship: decision("PRODUCT_REQUEST", 0.8, ["equipment-request"]),
      relation: decision("UNKNOWN", 0.4, []),
    };
  }

  // --- VEHICLE (whole) ---
  // Never default non-auto categories to VEHICLE (numeric false positives → "Araç").
  const categoryBlocksVehicle = NON_VEHICLE_CATEGORIES.has(
    input.categoryId ?? "",
  );
  const autoModelCredible =
    Boolean(input.automotiveModel) &&
    !categoryBlocksVehicle &&
    (input.categoryId === "automotive" ||
      input.categoryId == null ||
      identitySuggestsVehicle(input.identity));
  if (
    !categoryBlocksVehicle &&
    (wholeVehicle ||
      autoModelCredible ||
      (input.categoryId === "automotive" &&
        (input.intent === "BUY" || input.intent === "UNKNOWN") &&
        !partHit &&
        !accessoryHit))
  ) {
    const parent = buildParentEntity(
      input.identity,
      "VEHICLE",
      input.automotiveModel,
    );
    const label = parentDisplay(parent) || "araç";
    return {
      kind: decision("VEHICLE", 0.85, ["vehicle-request"]),
      name: uv(label, {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        confidence: 0.8,
        evidence: ["vehicle"],
      }),
      parentEntity: parent,
      relationship: decision("VEHICLE_REQUEST", 0.85, ["vehicle-request"]),
      relation: decision("UNKNOWN", 0.4, []),
    };
  }

  // --- PRODUCT (whole retail) ---
  if (
    input.intent === "BUY" ||
    input.identity.brand ||
    input.identity.model ||
    input.categoryId === "appliances" ||
    input.categoryId === "technology" ||
    input.categoryId === "home-kitchen" ||
    input.categoryId === "furniture" ||
    input.categoryId === "baby" ||
    input.categoryId === "health" ||
    hasFurnitureObjectNoun(text)
  ) {
    const parent = buildParentEntity(input.identity, "PRODUCT");
    const label =
      parentDisplay(parent) ||
      input.identity.model ||
      input.identity.brand ||
      "ürün";
    return {
      kind: decision("PRODUCT", 0.75, ["product-request"]),
      name: uv(String(label), {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        confidence: 0.7,
        evidence: ["product"],
      }),
      parentEntity: parent,
      relationship: decision("PRODUCT_REQUEST", 0.75, ["product-request"]),
      relation: decision("UNKNOWN", 0.3, []),
    };
  }

  return {
    kind: decision("UNKNOWN", 0.2, ["no-subject-evidence"]),
    relationship: decision("UNKNOWN", 0.2, []),
    relation: decision("UNKNOWN", 0.2, []),
  };
}

function identitySuggestsVehicle(identity: IdentityLite): boolean {
  // Heuristic without brand lists: model codes like C180, F30, Golf 7.
  // Bare digits (140, 256) are NOT vehicle signals — screen size / storage.
  const model = identity.model ?? "";
  const compact = model.replace(/\s/g, "");
  if (/^[A-Za-z]\d{2,3}[A-Za-z]?$/i.test(compact)) return true;
  if (/^\d{3}[A-Za-z]$/i.test(compact)) return true;
  if (/^[CESAGL]\d{2,3}/i.test(model)) return true;
  if (/^F\d{2}$/i.test(model)) return true;
  if (/\b\d\b/.test(model) && /^[A-Za-z]/.test(model)) return true;
  return false;
}

/**
 * Map semantic subject → legacy SubjectKind used elsewhere.
 */
export function subjectKindFromSemantic(
  kind: RequestSubjectKind | null,
): import("./types").SubjectKind {
  switch (kind) {
    case "VEHICLE":
      return "VEHICLE";
    case "PART":
    case "ACCESSORY":
      return "PART";
    case "SERVICE":
      return "SERVICE";
    case "REAL_ESTATE":
      return "PROPERTY";
    case "MANUFACTURED_ITEM":
      return "MANUFACTURED_GOOD";
    case "INDUSTRIAL_EQUIPMENT":
      return "MACHINE";
    case "PRODUCT":
    case "SOFTWARE":
    case "MEDICAL_DEVICE":
      return "PRODUCT";
    default:
      return "UNKNOWN";
  }
}

export function relationshipLabel(rel: RequestRelationship | null): string | null {
  switch (rel) {
    case "PART_FOR_PRODUCT":
      return "Yedek parça";
    case "ACCESSORY_FOR_PRODUCT":
      return "Aksesuar";
    case "SERVICE_FOR_OBJECT":
      return "Hizmet";
    case "VEHICLE_REQUEST":
      return "Araç";
    case "PROPERTY_REQUEST":
      return "Emlak";
    case "MANUFACTURE_REQUEST":
      return "Üretim";
    case "PRODUCT_REQUEST":
      return "Ürün";
    default:
      return null;
  }
}

export type { SubjectRelation };
