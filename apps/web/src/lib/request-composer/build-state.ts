/**
 * Build CanonicalRequestState from understandRequest() + optional browse bag.
 * Does not re-parse intent/category — maps RU output into hybrid field semantics.
 */

import {
  seedFieldValuesFromUnderstanding,
  resolveSchemaCategory,
} from "@/lib/request-understanding/activation-bridge";
import { TECH_HARDWARE_SIGNAL } from "@/lib/request-category-engine";
import type {
  RequestUnderstandingResult,
  UnderstandingSource,
} from "@/lib/request-understanding/types";
import { isVerifiedSource } from "@/lib/request-understanding/provenance";
import {
  findTaxonomyTypeUnderSubcategory,
  getTaxonomyNode,
} from "@/lib/taxonomy";

import {
  isHedgedExpression,
  type ConstraintBundle,
} from "@/lib/request-understanding/constraint-semantics";

import {
  applyAnyBindingsToFields,
  extractFieldScopedAny,
} from "./any-language";
import {
  cleanBrandToken,
  cleanModelToken,
  extractProductTypeHint,
  extractResolution,
  extractScreenSize,
} from "./attribute-hints";
import { isKnownAutomotiveModelName } from "@/lib/ai/parser/brand-catalog";
// Kategori alanlarının kanonik değer kaydı — KB-15 seçenek bağlayıcısı bunu okur.
import { REQUEST_CATEGORIES } from "@/lib/request-category-engine";
// Bilgi şeması ENUM kayıtları (matbaa productType seçenekleri orada yaşar).
import { resolveRequestSchema } from "@/lib/knowledge/request-schema";
import { inferenceOnlyMarkerKey } from "@/lib/knowledge/inference-marker";
import { isProductTypePhrase } from "@/lib/product-identity/identity-candidates";
import {
  classifyRequestedTargetRole,
  isRequestedItemNotModel,
} from "@/lib/request-understanding/requested-item-role";
import {
  isConsumedAsParentProduct,
  readRequestedTarget,
  readUsageContextSplit,
  splitCompatibilityPhrase,
} from "@/lib/request-understanding/part-relation";
import {
  isDeliberateNonValueAnswer,
  isInferenceOnlyAnswer,
} from "./answer-authority";
import { stripIncompatibleDomainFields } from "./request-transition";
import { sanitizeFactRoles } from "./v2/entity-roles";
import type {
  CanonicalFieldState,
  CanonicalRequestState,
  FieldProvenance,
  LastUserAction,
} from "./types";
import { FIELD_SENTINEL, isAnySentinel, isNotApplicableSentinel } from "./types";

/**
 * Map Phase 2 constraint bundle onto hybrid fields.
 * Does not re-parse text — consumes Single Brain constraints only.
 */
export function applyConstraintBundleToFields(
  fields: Record<string, CanonicalFieldState>,
  bundle: ConstraintBundle | undefined | null,
): Record<string, CanonicalFieldState> {
  if (!bundle) return fields;
  const next = { ...fields };

  for (const c of Object.values(bundle.byField)) {
    const existing = next[c.fieldKey];
    // Never overwrite EXPLICIT_BROWSE with text constraints
    if (existing?.provenance === "EXPLICIT_BROWSE") {
      next[c.fieldKey] = {
        ...existing,
        excludedValues: uniqueStrings([
          ...(existing.excludedValues ?? []),
          ...(c.excludedValues ?? []),
        ]),
        preferredValues: existing.preferredValues ?? c.preferredValues,
        allowedValues: existing.allowedValues ?? c.allowedValues,
        strength: existing.strength ?? c.strength,
        range: existing.range ?? c.range,
      };
      continue;
    }

    if (c.any) {
      next[c.fieldKey] = {
        kind: "ANY",
        value: null,
        provenance: "EXPLICIT_TEXT",
        confidence: c.confidence,
        evidence: c.evidence,
        strength: c.strength,
        preferredValues: c.preferredValues,
        allowedValues: c.allowedValues,
        excludedValues: c.excludedValues,
        range: c.range,
      };
      continue;
    }

    if (c.preferredValues && c.preferredValues.length >= 2 && !c.value) {
      next[c.fieldKey] = {
        kind: "UNKNOWN",
        value: null,
        provenance: "EXPLICIT_TEXT",
        confidence: c.confidence,
        evidence: c.evidence,
        strength: c.strength ?? "PREFERRED",
        preferredValues: c.preferredValues,
        allowedValues: c.allowedValues,
        excludedValues: c.excludedValues,
        range: c.range,
      };
      continue;
    }

    if (c.value) {
      const label =
        c.fieldKey === "condition" && c.value === "NEW"
          ? "Sıfır"
          : c.fieldKey === "condition" && c.value === "USED"
            ? "İkinci el"
            : c.fieldKey === "partPosition" && c.value === "RIGHT"
              ? "Sağ"
              : c.value;
      next[c.fieldKey] = {
        kind: "VALUE",
        value: label,
        provenance: "EXPLICIT_TEXT",
        confidence: c.confidence,
        evidence: c.evidence,
        strength: c.strength,
        preferredValues: c.preferredValues,
        allowedValues: c.allowedValues,
        excludedValues: c.excludedValues,
        range: c.range,
      };
      continue;
    }

    // Exclusion-only / range-only / preferred-empty
    if (
      c.excludedValues?.length ||
      c.range ||
      c.preferredValues?.length ||
      c.allowedValues?.length
    ) {
    const excludedFold = (c.excludedValues ?? []).map((v) =>
      v.toLocaleLowerCase("tr-TR"),
    );
    const existingValue = existing?.kind === "VALUE" ? existing.value : null;
    const valueIsExcluded =
      Boolean(existingValue) &&
      excludedFold.some(
        (e) => e === String(existingValue).toLocaleLowerCase("tr-TR"),
      );
    next[c.fieldKey] = {
      kind: valueIsExcluded
        ? "UNKNOWN"
        : existing?.kind === "VALUE"
          ? existing.kind
          : "UNKNOWN",
      value: valueIsExcluded
        ? null
        : existing?.kind === "VALUE"
          ? existing.value
          : null,
        provenance: "EXPLICIT_TEXT",
        confidence: c.confidence,
        evidence: c.evidence,
        strength: c.strength ?? existing?.strength,
        preferredValues: c.preferredValues ?? existing?.preferredValues,
        allowedValues: c.allowedValues ?? existing?.allowedValues,
        excludedValues: uniqueStrings([
          ...(existing?.excludedValues ?? []),
          ...(c.excludedValues ?? []),
        ]),
        range: c.range ?? existing?.range,
      };
    }
  }

  return next;
}

function uniqueStrings(values: string[]): string[] {
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

/**
 * Anlama katmanının kanıt otoritesini bestecinin alan etiketine çevirir.
 *
 * Doğrulanmış kaynak listesi burada TEKRARLANMAZ (D3a): eskiden bu satırda
 * `FUTURE_KNOWLEDGE || PRODUCT_IDENTITY` çifti elle yazılıydı ve kanonik
 * listeden bağımsız yaşıyordu. Artık tek otorite okunur.
 */
function mapRuProvenance(
  provenance: "EXPLICIT" | "INFERRED" | undefined,
  source?: string,
): FieldProvenance {
  if (provenance === "EXPLICIT") return "EXPLICIT_TEXT";
  if (isVerifiedSource(source as UnderstandingSource | undefined)) {
    return "CATALOG_ENRICHED";
  }
  return "INFERRED";
}

function valueField(
  value: string,
  provenance: FieldProvenance,
  confidence?: number,
  evidence?: string[],
): CanonicalFieldState {
  return {
    kind: "VALUE",
    value,
    provenance,
    confidence,
    evidence,
  };
}

function unknownField(): CanonicalFieldState {
  return {
    kind: "UNKNOWN",
    value: null,
    provenance: "INFERRED",
    confidence: 0,
  };
}

function flattenUnknown(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") {
    const obj = value as { value?: unknown; unit?: string };
    if (obj.value != null && obj.unit) return `${obj.value} ${obj.unit}`;
    if (obj.value != null) return String(obj.value);
  }
  return String(value);
}

/**
 * Uyumluluk bağlacı — parça ADI bunları asla içeremez (kurucu, 2026-08-24).
 * Bunlar parçayı değil, parçanın hangi ürüne ait olduğunu anlatır.
 */
const PART_COMPATIBILITY_CONNECTIVES = [
  "için",
  "ait",
  "uyumlu",
  "markalı",
  "modeli",
  "ile",
];

/**
 * Adayın BAŞINDAKİ uyumluluk bağlacını kırpar (KB-11).
 * Bağlaç adayın BAŞINDAysa ardındaki ifade zaten istenen şeydir; aday
 * reddedilirse "nemlendirme" bilgisi boşuna kaybolur. Ortada bağlaç varsa
 * ("Bosch çamaşır makinesi için pompa") aday yine reddedilir — orada bağlacın
 * solunda uyumluluk hedefi durur, o bilgi parça adına ait değildir.
 */
function stripLeadingConnective(value: string): string {
  let out = value.trim();
  for (;;) {
    const first = out.split(/\s+/)[0] ?? "";
    if (!first) return out;
    const isConnective = PART_COMPATIBILITY_CONNECTIVES.some(
      (c) => foldPartToken(c) === foldPartToken(first),
    );
    if (!isConnective) return out;
    out = out.slice(first.length).trim();
  }
}

/**
 * `whole`, `part`in bütün sözcüklerini taşıyor mu? Türkçe ek toleranslı:
 * "kart" ⊂ "kartı", "pompa" ⊂ "pompası". Sıra aranmaz; eksik sözcük yeter.
 */
function coversAllTokens(whole: string, part: string): boolean {
  const haystack = foldPartToken(whole).split(/\s+/).filter(Boolean);
  const needles = foldPartToken(part).split(/\s+/).filter(Boolean);
  if (!needles.length || !haystack.length) return false;
  return needles.every((n) => haystack.some((h) => h.startsWith(n)));
}

/**
 * Kaçamak seçenekler kanıt sayılmaz: "Fark etmez" yazmak bir tercih beyanı
 * değildir, tercih YOKLUĞUDUR.
 */
const OPTION_ESCAPE_RE =
  /fark\s*etmez|karisik|bilmiyorum|diger|belirtmek\s*istemiyorum|onemli\s*degil/;

/** Kelime sınırıyla eşleşme (ASCII-fold sonrası). */
function foldedHasWord(foldedText: string, foldedNeedle: string): boolean {
  if (!foldedNeedle) return false;
  const esc = foldedNeedle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(foldedText);
}

/**
 * Kullanıcının KENDİ yazdığı biçimi geri verir (diyakritikleriyle).
 * Kanonik seçeneği değil kullanıcının ifadesini korumak içindir: "ahşap"
 * yazan kişiye "Masif ahşap" atfetmek uydurma olur.
 */
function originalSpelling(raw: string, foldedToken: string): string | null {
  for (const word of String(raw).split(/[^\p{L}\p{N}]+/u)) {
    if (word && foldPartToken(word) === foldedToken) return word;
  }
  return null;
}

/**
 * Değerin yakınında çekince var mı? Karar burada verilmez — çekince
 * kalıplarının tek yetkilisi `constraint-semantics` modülüdür.
 */
function qualifierNear(raw: string, writtenSpan: string): boolean {
  return isHedgedExpression(raw, writtenSpan);
}

/**
 * Kategorinin `select` alanlarında, kullanıcının metninde açıkça geçen
 * değerleri alana bağlar (KB-15). Dolu alanlara dokunmaz.
 */
function bindWrittenOptionValues(
  fields: Record<string, CanonicalFieldState>,
  categoryId: string,
  raw: string,
): void {
  const text = foldPartToken(String(raw ?? ""));
  if (!text.trim()) return;

  /**
   * KANONİK DEĞER KAYDI İKİ YERDE YAŞIYOR (KB-15).
   *
   * Kategori motoru `select` alanları, bilgi şeması ise `ENUM` alanları
   * taşır — matbaanın `productType` seçenekleri (Karton kutu / Etiket /
   * Broşür / Diğer) YALNIZ ikincisindedir. Yalnız birincisini okumak,
   * "karton kutu" yazan kullanıcının kayıtta tam karşılığı olmasına rağmen
   * bağlanmamasına yol açıyordu. İki kayıt da okunur; yeni bir liste
   * kurulmaz.
   */
  const optionDefs: Array<{
    key: string;
    options: Array<{ label?: string; value?: string }>;
  }> = [];
  const category = REQUEST_CATEGORIES.find((c) => c.id === categoryId);
  for (const def of category?.fields ?? []) {
    if (def.type === "select" && def.options?.length) {
      optionDefs.push({ key: def.key, options: def.options });
    }
  }
  try {
    for (const def of resolveRequestSchema({ categoryId }).fields) {
      if (def.type !== "ENUM" || !def.options?.length) continue;
      if (optionDefs.some((d) => d.key === def.key)) continue;
      optionDefs.push({ key: def.key, options: def.options });
    }
  } catch {
    // Bilgi şeması çözülemiyorsa kategori motoru kaydıyla devam edilir.
  }

  /**
   * KAPI ALANLARI: başka alanların görünürlüğü/bağımlılığı bunlara bağlıdır
   * ve bu yüzden yalnız kanonik değer taşıyabilirler.
   */
  const gatingKeys = new Set<string>();
  for (const def of category?.fields ?? []) {
    if (def.when?.field) gatingKeys.add(def.when.field);
  }
  try {
    for (const def of resolveRequestSchema({ categoryId }).fields) {
      if (def.visibleWhen?.field) gatingKeys.add(def.visibleWhen.field);
      for (const dep of def.dependsOn ?? []) gatingKeys.add(dep);
    }
  } catch {
    // yoksayılır — kapı listesi eksik kalırsa yalnız daha muhafazakâr oluruz
  }

  for (const def of optionDefs) {
    const current = fields[def.key];
    if (current && current.kind !== "UNKNOWN") continue;

    let value: string | null = null;
    let canonicalSlug: string | null = null;
    let evidence: string | null = null;

    for (const opt of def.options) {
      const canonicalValue = String(opt.value ?? opt.label ?? "").trim();
      const canonicalLabel = String(opt.label ?? opt.value ?? "").trim();
      if (!canonicalValue) continue;
      // Kayıt değeri bir slug ("karton-kutu"), kullanıcı ise etiketi yazar
      // ("karton kutu"). İkisi de aynı ayraç normalizasyonuyla aranır.
      const forms = [canonicalLabel, canonicalValue]
        .map((s) => foldPartToken(s).replace(/[^a-z0-9]+/g, " ").trim())
        .filter(Boolean);
      if (forms.some((f) => OPTION_ESCAPE_RE.test(f))) continue;

      // 1) Seçeneğin tamamı yazılmışsa kayıt eşleşmesi kurulur: kullanıcıya
      //    ETİKET gösterilir, koşullu alanlara KAYIT DEĞERİ verilir.
      const whole = forms.find((f) => f.length >= 3 && foldedHasWord(text, f));
      if (whole) {
        value = canonicalLabel || canonicalValue;
        canonicalSlug = canonicalValue;
        evidence = whole;
        break;
      }
      /**
       * 2) Yalnız ayırt edici bir sözcüğü yazılmışsa KULLANICININ sözcüğü
       *    bağlanır ("ahşap", "Masif ahşap" değil).
       *
       * KAPI ALANLARINDA BU YOL KAPALIDIR: başka alanların görünürlüğü bu
       * alanın değerine bağlıysa (`visibleWhen` / `dependsOn`) kayıt dışı bir
       * değer, bağlı soruları SESSİZCE gizler. Ölçülen vaka: matbaa
       * `productType` alanına "kutu" yazılınca `depth` ve `lamination`
       * koşulları (`in: ["karton-kutu"]`) hiç eşleşmiyordu.
       */
      if (gatingKeys.has(def.key)) continue;
      for (const token of forms[0]!.split(" ")) {
        if (token.length < 4 || OPTION_ESCAPE_RE.test(token)) continue;
        if (!foldedHasWord(text, token)) continue;
        value = originalSpelling(raw, token) ?? token;
        evidence = token;
        break;
      }
      if (value) break;
    }

    if (!value || !evidence) continue;
    // Benzetme/olumsuzlama varsa değer kullanıcının beyanı sayılmaz: alan boş
    // kalır ve soru sorulmaya devam eder.
    if (qualifierNear(raw, value)) continue;
    fields[def.key] = {
      ...valueField(value, "EXPLICIT_TEXT", 0.85, [evidence]),
      ...(canonicalSlug && canonicalSlug !== value
        ? { canonicalValue: canonicalSlug }
        : {}),
    };
  }
}

function foldPartToken(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u");
}

function partTokens(value: string): string[] {
  return foldPartToken(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/**
 * Zenginleştirilmiş parça adı temiz mi? (kurucu kuralı, 2026-08-24 — KB-2c)
 *
 * Kural: aday, `parentEntity`'ye ait HİÇBİR kelimeyi (marka, model, ürün adı)
 * ve HİÇBİR uyumluluk bağlacını içeremez. İhlal varsa aday reddedilir ve ham
 * `basePart` kullanılır.
 *
 * Neden böyle, "için"de kesmek değil: geri yayılma kalıbı
 * (`[\p{L}\s]{0,40}?`) parça isminden geriye doğru yutuyor ve "Bosch çamaşır
 * makinesi için pompa" üretiyordu; compose-text sonra hedefi bir kez daha
 * önüne ekleyip "Bosch için bosch çamaşır makinesi için pompa arıyorum"
 * yazıyordu — kullanıcının yazdığı ona iki kez geri okunuyordu. Tek bir
 * bağlaçta kesmek dizgi yamasıdır, bir sonraki bağlaçta yine patlar; geri
 * yayılmayı tamamen kapatmak ise "tahliye pompası" gibi gerçek zenginleşmeyi
 * öldürür. Kural ikisini de çözer.
 *
 * Not: rakamlar bilerek kalıba EKLENMEDİ. Bugün "Alfa Romeo 156" ve "Golf 7"
 * gibi hedeflerin hatayı tetiklememesi, karakter sınıfının rakam içermemesi
 * sayesindedir — yani tesadüf. Koruma bu tesadüfe dayanamaz.
 */
function isCleanEnrichedPartLabel(
  candidate: string,
  requestSubject: RequestUnderstandingResult["requestSubject"],
): boolean {
  const tokens = partTokens(candidate);
  if (tokens.length === 0) return false;

  for (const connective of PART_COMPATIBILITY_CONNECTIVES) {
    if (tokens.includes(foldPartToken(connective))) return false;
  }

  const parent = requestSubject?.parentEntity as
    | Record<string, { value?: unknown } | undefined>
    | undefined;
  if (!parent) return true;

  const parentWords = new Set<string>();
  for (const key of ["brand", "model", "generation", "name", "productType"]) {
    const raw = parent[key]?.value;
    if (raw == null) continue;
    for (const token of partTokens(String(raw))) parentWords.add(token);
  }
  return !tokens.some((token) => parentWords.has(token));
}

/**
 * ÜRÜN İPUCU HANGİ METİNDEN OKUNUR? (1H)
 *
 * `extractProductTypeHint` ham cümlenin TAMAMINI tarar. "X için Y" yapısında
 * sağ taraf bütün bir ürün ya da hizmetse asıl talep konusu Y'dir; soldaki
 * kullanım bağlamı ürün ipucu üretmemelidir. Ölçülen hata: "Ofis için
 * muhasebe yazılımı arıyorum" → ipucu "Ofis" (emlak düğümü) → `productType`
 * alanı "Ofis", kategori real-estate; anlama katmanının doğru cevabı
 * (technology) sessizce eziliyordu.
 *
 * Karar burada verilmez, tek yetkili uyumluluk katmanından okunur. Sağ taraf
 * bir BİLEŞENSE (ya da rolü bilinmiyorsa) tarama ham cümlede kalır: orada
 * sol taraf gerçek üst üründür ve ipucu üretmesi DOĞRUdur.
 */
function resolveProductHint(
  raw: string,
): ReturnType<typeof extractProductTypeHint> {
  const usage = readUsageContextSplit(raw);
  if (!usage) return extractProductTypeHint(raw);
  const hint = extractProductTypeHint(usage.target);
  if (!hint) return null;
  /**
   * İpucu hedefin ROLÜYLE ÇELİŞEMEZ. Tarama n-gram tabanlıdır ve bir
   * niteleyiciyi tek başına çözebilir: "muhasebe yazılımı" bütün bir üründür
   * ama içindeki "muhasebe" kanonik ağaçta bir HİZMET düğümüdür ve talebi
   * hizmete çeviriyordu (ölçüldü). Türkçede baş sondadır; niteleyici parça
   * talebin türünü belirleyemez.
   */
  const hintRole = classifyRequestedTargetRole(hint.productType).role;
  if (hintRole !== "UNKNOWN" && hintRole !== usage.role) return null;
  return hint;
}

/**
 * Convert understanding + raw text hints into hybrid field map.
 */
export function mapUnderstandingToFields(
  result: RequestUnderstandingResult,
): Record<string, CanonicalFieldState> {
  const fields: Record<string, CanonicalFieldState> = {};
  const raw = result.rawInput ?? "";

  const screenSize = extractScreenSize(raw);
  const resolution = extractResolution(raw);
  const productHint = resolveProductHint(raw);

  let brandRaw = cleanBrandToken(
    result.identity.brand?.value
      ? String(result.identity.brand.value)
      : result.requestSubject.parentEntity?.brand?.value
        ? String(result.requestSubject.parentEntity.brand.value)
        : null,
  );
  let modelRaw = cleanModelToken(
    result.identity.model?.value
      ? String(result.identity.model.value)
      : result.requestSubject.parentEntity?.model?.value
        ? String(result.requestSubject.parentEntity.model.value)
        : null,
    {
      screenSize,
      productType: result.attributes?.productType?.value
        ? String(result.attributes.productType.value)
        : result.attributes?.applianceType?.value
          ? String(result.attributes.applianceType.value)
          : null,
    },
  );
  // Common city shorthand must remain location context, never product model.
  if (
    modelRaw?.toLocaleLowerCase("tr-TR") === "ist" &&
    /\bist(?:anbul)?(?:['’]?(?:da|de|dan|den))?\b/iu.test(raw)
  ) {
    modelRaw = null;
  }
  // A product-type phrase names WHAT the item is, never which model — this
  // guards every modelRaw source at once (identity AND subject parentEntity),
  // so "Model: hava temizleyicisi" cannot reach the board from any of them.
  if (modelRaw && isProductTypePhrase(modelRaw)) {
    modelRaw = null;
  }
  // Aynı gerekçeyle: uyumluluk bağlacının SAĞINDA duran jeton istenen şeydir,
  // üst ürünün modeli olamaz (KB-12). Kural understand-request.ts'te tek yerde
  // tanımlıdır; burada yalnız ikinci kaynağa (parentEntity.model) da uygulanır,
  // çünkü modelRaw identity VE parentEntity'den beslenir.
  if (modelRaw && isRequestedItemNotModel(raw, modelRaw)) {
    modelRaw = null;
  }
  // Üst ürün olarak tüketilen span ne marka ne model olabilir (1D). Kural
  // part-relation.ts'te tek yerde tanımlıdır; burada ikinci kaynağa
  // (parentEntity) de uygulanır.
  if (modelRaw && isConsumedAsParentProduct(raw, modelRaw)) {
    modelRaw = null;
  }
  if (brandRaw && isConsumedAsParentProduct(raw, brandRaw)) {
    brandRaw = null;
  }
  if (brandRaw && isKnownAutomotiveModelName(brandRaw)) {
    if (
      !modelRaw ||
      modelRaw.toLocaleLowerCase("tr-TR") ===
        brandRaw.toLocaleLowerCase("tr-TR")
    ) {
      modelRaw = brandRaw;
    }
    brandRaw = null;
  }

  if (brandRaw && result.identity.brand) {
    fields.brand = valueField(
      brandRaw,
      mapRuProvenance(
        result.identity.brand.provenance,
        result.identity.brand.source,
      ),
      result.identity.brand.confidence,
      result.identity.brand.evidence,
    );
  } else if (brandRaw) {
    fields.brand = valueField(brandRaw, "INFERRED", 0.6);
  } else {
    fields.brand = unknownField();
  }

  if (modelRaw && result.identity.model) {
    fields.model = valueField(
      modelRaw,
      mapRuProvenance(
        result.identity.model.provenance,
        result.identity.model.source,
      ),
      result.identity.model.confidence,
      result.identity.model.evidence,
    );
  } else if (modelRaw) {
    fields.model = valueField(modelRaw, "INFERRED", 0.5);
  } else {
    fields.model = unknownField();
  }

  if (result.condition?.value && result.condition.value !== "UNKNOWN") {
    const label =
      result.condition.value === "NEW"
        ? "Sıfır"
        : result.condition.value === "USED"
          ? "İkinci el"
          : result.condition.value === "REFURBISHED"
            ? "Yenilenmiş"
            : String(result.condition.value);
    fields.condition = valueField(
      label,
      mapRuProvenance(result.condition.provenance, result.condition.source),
      result.condition.confidence,
    );
  } else {
    fields.condition = unknownField();
  }

  if (result.subject.productType?.value) {
    fields.productType = valueField(
      String(result.subject.productType.value),
      mapRuProvenance(
        result.subject.productType.provenance,
        result.subject.productType.source,
      ),
    );
  } else if (productHint) {
    fields.productType = valueField(
      productHint.productType,
      "EXPLICIT_TEXT",
      0.9,
      ["product-hint"],
    );
  } else {
    fields.productType = unknownField();
  }

  // Final entity-role gate: product span must not leak into brand/model
  {
    const productTypeValue =
      fields.productType?.kind === "VALUE"
        ? String(fields.productType.value ?? "")
        : productHint?.productType ?? null;
    const cleaned = sanitizeFactRoles({
      brand: fields.brand?.kind === "VALUE" ? String(fields.brand.value) : null,
      model: fields.model?.kind === "VALUE" ? String(fields.model.value) : null,
      productType: productTypeValue,
      rawInput: raw,
      categoryId: result.category.value,
    });
    if (!cleaned.brand) fields.brand = unknownField();
    else if (fields.brand.kind === "VALUE") {
      fields.brand = { ...fields.brand, value: cleaned.brand };
    }
    if (!cleaned.model) fields.model = unknownField();
    else if (fields.model.kind === "VALUE") {
      fields.model = { ...fields.model, value: cleaned.model };
    }
  }

  /**
   * Furniture product leaves → furnitureType (browse ↔ text)
   *
   * KB-15 KÖPRÜSÜ: düğüm kimliği belirsiz olduğunda ("Toplantı Masası"
   * taksonomide iki kez tanımlı) ön ek kontrolü boşa düşüyor ve bu alan
   * doldurulmuyordu. `furnitureType` yalnız bir UI alanı DEĞİLDİR — explore
   * filtresi (`category-filters.ts`) ve profesyonel metin bestecisi onu
   * okur; boş kalması Pro tarafında sessiz kayıptır. Alan kimliği
   * belirsizlikten etkilenmediği için köprü ona bağlanır. Bu ikinci bir
   * otorite değildir: değer aynı kanonik ipucundan TÜRETİLİR.
   */
  const hintIsFurniture =
    productHint?.taxonomyNodeId?.startsWith("tax:furniture:") ||
    (productHint?.categoryId === "furniture" && !productHint?.taxonomyNodeId);
  if (productHint && hintIsFurniture) {
    fields.furnitureType = valueField(
      productHint.productType,
      "EXPLICIT_TEXT",
      0.9,
      ["furniture-hint"],
    );
  } else {
    fields.furnitureType = unknownField();
  }

  // Appliances product leaves → applianceType (browse ↔ text)
  if (productHint?.taxonomyNodeId?.startsWith("tax:appliances:")) {
    fields.applianceType = valueField(
      productHint.productType,
      "EXPLICIT_TEXT",
      0.9,
      ["appliance-hint"],
    );
  } else if (
    productHint?.productType === "supurge" ||
    /süpürge|supurge/i.test(productHint?.productType ?? "")
  ) {
    fields.applianceType = valueField(
      "Elektrikli Süpürge",
      "EXPLICIT_TEXT",
      0.85,
      ["appliance-vacuum-hint"],
    );
  } else {
    fields.applianceType = unknownField();
  }

  if (screenSize) {
    fields.screenSize = valueField(screenSize, "EXPLICIT_TEXT", 0.95, [
      `${screenSize} ekran`,
    ]);
  } else {
    fields.screenSize = unknownField();
  }

  if (resolution) {
    fields.resolution = valueField(resolution, "EXPLICIT_TEXT", 0.9, [
      resolution,
    ]);
  } else {
    fields.resolution = unknownField();
  }

  // Seed remaining attributes from RU
  for (const [key, uv] of Object.entries(result.attributes)) {
    if (fields[key]?.kind === "VALUE" || fields[key]?.kind === "ANY") continue;
    const flat = flattenUnknown(uv.value);
    if (!flat.trim()) continue;
    fields[key] = valueField(
      flat,
      mapRuProvenance(uv.provenance, uv.source),
      uv.confidence,
      uv.evidence,
    );
  }

  /**
   * KANONİK SEÇENEK KAYDINDAN BAĞLAMA (KB-15).
   *
   * `REQUEST_CATEGORIES` her kategori için `select` alanların İZİN VERİLEN
   * değerlerini zaten taşıyor; bu, alanın kanonik değer kaydıdır. Kullanıcı o
   * kayıttaki bir değeri yazdıysa alan doldurulur. Kural kelimeye ya da tek
   * kategoriye özel DEĞİLDİR: aynı satır emlakta "Arsa", mobilyada "Ahşap",
   * bebekte "Mama sandalyesi", mutfakta "Çelik" vakalarını birlikte kapatır.
   * Yeni bir çıkarıcı kurulmaz — var olan kayıt okunur.
   */
  const optionCategoryId = result.category.value
    ? String(result.category.value)
    : null;
  if (optionCategoryId) {
    bindWrittenOptionValues(fields, optionCategoryId, raw);
  }

  // part / position only for spare-part subjects — never dump vehicle name into part
  const subjectKind = result.requestSubject.kind.value;
  const isPartSubject = subjectKind === "PART" || subjectKind === "ACCESSORY";

  // Real-estate subject name → propertyType (concrete types only; not "gayrimenkul")
  if (
    subjectKind === "REAL_ESTATE" &&
    result.requestSubject.name?.value &&
    !fields.propertyType
  ) {
    const propName = String(result.requestSubject.name.value).trim();
    const generic = /^(gayrimenkul|emlak|konut|ev)$/i.test(propName);
    if (!generic) {
      fields.propertyType = valueField(
        propName,
        mapRuProvenance(
          result.requestSubject.name.provenance,
          result.requestSubject.name.source,
        ),
        result.requestSubject.name.confidence,
      );
    }
  }

  /**
   * ÜRÜN KONUSUNUN ADI → productType (KB-15).
   *
   * Yukarıdaki REAL_ESTATE kuralının aynısı, ürün tarafında. Konu otoritesi
   * "karton kutu ürettirmek" cümlesinde istenen şeyi zaten "kutu" olarak
   * çözüyordu; alan boş kaldığı için soru motoru `productType`ı eksik sayıp
   * kullanıcıya tekrar soruyordu.
   *
   * Jenerik yedek adlar bağlanmaz: konu otoritesi bir ad bulamadığında
   * "ürün" / "servis" / "cihaz" gibi yer tutucular üretir ve bunlar
   * kullanıcının yazdığı bir şey DEĞİLDİR. Yer tutucu bağlanırsa soru
   * yanlışlıkla bastırılır — bu, tekrar sormak kadar ciddi bir kusurdur.
   */
  const PRODUCT_SUBJECT_KINDS = new Set([
    "PRODUCT",
    "MANUFACTURED_ITEM",
    "INDUSTRIAL_EQUIPMENT",
    "MEDICAL_DEVICE",
  ]);
  if (
    PRODUCT_SUBJECT_KINDS.has(String(subjectKind)) &&
    result.requestSubject.name?.value &&
    fields.productType?.kind !== "VALUE"
  ) {
    const prodName = String(result.requestSubject.name.value).trim();
    const placeholder = /^(ürün|urun|servis|hizmet|cihaz|makine|eşya|esya)$/i.test(
      prodName,
    );
    const writtenByUser = foldPartToken(String(result.rawInput ?? "")).includes(
      foldPartToken(prodName),
    );
    if (!placeholder && prodName.length >= 3 && writtenByUser) {
      fields.productType = valueField(
        prodName,
        mapRuProvenance(
          result.requestSubject.name.provenance,
          result.requestSubject.name.source,
        ),
        result.requestSubject.name.confidence,
      );
    }
  }

  if (isPartSubject) {
    const rawPhrase = String(result.rawInput ?? "");
    const basePart = String(
      result.requestSubject.displayPhrase?.value ??
        result.requestSubject.name?.value ??
        "",
    ).trim();
    let partLabel = basePart;

    /**
     * KULLANICININ YAZDIĞI HEDEF İFADE ÖNCELİKLİDİR (1C).
     *
     * Anlam katmanı parça adını lemma'ya indirger ve konum belirtecini ayrı
     * saklar; ikisi yeniden birleştirilince kullanıcının ARADAKİ sözcükleri
     * düşer. Ölçülen kayıplar: "dış ünite fan motoru" → "dış fan motoru",
     * "güç kartı" → "kart". Kısaltma bir normalizasyon değil KAYIPTIR.
     *
     * Aşağıdaki ham-metin taraması bu kaybı telafi edemiyordu, çünkü
     * indirgenmiş ifade metinde BİTİŞİK geçmiyor. Bunun yerine ilişkinin tek
     * yetkili çözümüne sorulur: bağlacın sağındaki hedef ifade. Hedef,
     * indirgenmiş adın bütün sözcüklerini kapsıyorsa kullanıcının yazdığı
     * hâli kazanır.
     */
    const compatSplit = splitCompatibilityPhrase(rawPhrase);
    const requestedTarget = compatSplit
      ? readRequestedTarget(compatSplit.requested).value
      : null;
    if (basePart && requestedTarget && coversAllTokens(requestedTarget, basePart)) {
      partLabel = requestedTarget;
    } else if (basePart && rawPhrase && !compatSplit) {
      // Bağlaç VARSA ham metin taraması yapılmaz: hedefin nerede başladığını
      // zaten bağlaç söyler. Tarama bağlaçlı metinde kelime ORTASINDAN
      // kesebiliyordu ("paslanmaz" → "anmaz", ölçüldü); güvenli olan,
      // indirgenmiş adı olduğu gibi bırakıp ham hedefi unresolved kaydına
      // düşürmektir.
      // Prefer fuller user wording: "nemlendirme pompası" over stem "pompa"
      const escaped = basePart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const fuller = rawPhrase.match(
        new RegExp(
          `([\\p{L}][\\p{L}\\s]{0,40}?${escaped}[\\p{L}]*)`,
          "iu",
        ),
      );
      // Baştaki bağlaç önce kırpılır, kural ONDAN SONRA uygulanır (KB-11).
      const candidate = stripLeadingConnective(fuller?.[1]?.trim() ?? "");
      if (
        candidate &&
        candidate.length > basePart.length &&
        isCleanEnrichedPartLabel(candidate, result.requestSubject)
      ) {
        partLabel = candidate;
      }
    }
    partLabel = partLabel.replace(/^\s*için\s+/iu, "").trim();
    if (partLabel) {
      fields.part = valueField(
        partLabel,
        mapRuProvenance(
          result.requestSubject.displayPhrase?.provenance ??
            result.requestSubject.name?.provenance,
          result.requestSubject.displayPhrase?.source ??
            result.requestSubject.name?.source,
        ),
      );
    }

    if (result.requestSubject.position?.value) {
      fields.partPosition = valueField(
        String(result.requestSubject.position.value),
        mapRuProvenance(
          result.requestSubject.position.provenance,
          result.requestSubject.position.source,
        ),
      );
    }
  }

  if (result.quantity?.value?.value != null) {
    const qtyText = String(result.quantity.value.value);
    fields.quantity = valueField(
      qtyText,
      mapRuProvenance(result.quantity.provenance, result.quantity.source),
    );
    /**
     * ÇEKİNCELİ SAYI KESİN SAYI DEĞİLDİR (KB-15).
     *
     * "Yaklaşık 1000 adet" ile "1000 adet" aynı statüyü taşıyamaz: değer
     * korunur (kullanıcı bir büyüklük söyledi) ama kesin cevap sayılmaz.
     * Çekince kalıpları burada tanımlanmaz, tek yetkiliden sorulur.
     */
    if (isHedgedExpression(raw, qtyText)) {
      fields.quantity = { ...fields.quantity, strength: "PREFERRED" };
    }
  } else {
    fields.quantity = fields.quantity ?? unknownField();
  }

  if (result.attributes.color) {
    fields.color = valueField(
      flattenUnknown(result.attributes.color.value),
      mapRuProvenance(
        result.attributes.color.provenance,
        result.attributes.color.source,
      ),
    );
  } else {
    fields.color = fields.color ?? unknownField();
  }

  // Field-scoped ANY post-process
  const bindings = extractFieldScopedAny(raw);
  let withAny = applyAnyBindingsToFields(fields, bindings);

  // Phase 2 — apply Single Brain constraint bundle (additive)
  withAny = applyConstraintBundleToFields(withAny, result.constraints);

  // If brand is ANY, drop conflicting concrete brand from weak identity
  if (withAny.brand?.kind === "ANY") {
    // keep ANY
  }

  // Technology hardware demand → needType/solutionType for Step-2 filters
  const taxId = productHint?.taxonomyNodeId ?? "";
  const pt =
    withAny.productType?.kind === "VALUE"
      ? String(withAny.productType.value)
      : productHint?.productType ?? "";
  // Tek otorite: motorun donanım sinyali (drone/kamera/kulaklık… dahil).
  const isTechHardware =
    taxId.startsWith("tax:technology:donanim:") ||
    TECH_HARDWARE_SIGNAL.test(`${pt} ${raw}`);
  if (isTechHardware) {
    if (
      !withAny.needType ||
      withAny.needType.kind === "UNKNOWN" ||
      (withAny.needType.kind === "VALUE" &&
        withAny.needType.value === "software" &&
        withAny.needType.provenance === "INFERRED")
    ) {
      withAny.needType = valueField("hardware", "INFERRED", 0.9, [
        "tech-hardware-seed",
      ]);
    }
    if (
      (!withAny.solutionType || withAny.solutionType.kind === "UNKNOWN") &&
      pt
    ) {
      withAny.solutionType = valueField(pt, "INFERRED", 0.85, [
        "tech-solution-seed",
      ]);
    }
  }

  // Furniture home leaf → usageArea Ev (publish/filter comfort)
  if (
    taxId.includes(":ev-mobilyasi:") ||
    (withAny.furnitureType?.kind === "VALUE" &&
      !/ofis|toplantı|makam|çalışma/i.test(
        String(withAny.furnitureType.value ?? ""),
      ))
  ) {
    if (!withAny.usageArea || withAny.usageArea.kind === "UNKNOWN") {
      withAny.usageArea = valueField("Ev", "INFERRED", 0.8, [
        "furniture-home-usage",
      ]);
    }
  } else if (
    taxId.includes(":ofis-mobilyalari:") &&
    (!withAny.usageArea || withAny.usageArea.kind === "UNKNOWN")
  ) {
    withAny.usageArea = valueField("Ofis", "INFERRED", 0.8, [
      "furniture-office-usage",
    ]);
  }

  // RE Residans spelling → Rezidans
  if (
    withAny.propertyType?.kind === "VALUE" &&
    /^residans$/i.test(String(withAny.propertyType.value ?? "").trim())
  ) {
    withAny.propertyType = {
      ...withAny.propertyType,
      value: "Rezidans",
    };
  }

  return withAny;
}

function taxonomyFromUnderstanding(
  result: RequestUnderstandingResult,
  fields: Record<string, CanonicalFieldState>,
): { categoryId: string | null; subcategorySlug: string | null; taxonomyNodeId: string | null } {
  const schema = resolveSchemaCategory(result);
  let categoryId =
    result.category.status !== "UNKNOWN" && result.category.value
      ? result.category.value
      : schema.confident && schema.categoryId
        ? schema.categoryId
        : null;

  const productHint = resolveProductHint(result.rawInput);
  let taxonomyNodeId = productHint?.taxonomyNodeId ?? null;
  let subcategorySlug: string | null = null;

  if (taxonomyNodeId) {
    const node = getTaxonomyNode(taxonomyNodeId);
    if (node) {
      // Kurucu (2026-08-23): servis niyeti Hizmetler'e yönlendiyse ürün
      // düğümü (kombi → beyaz eşya) kategoriyi geri EZEMEZ.
      const serviceRouted =
        result.category.value === "services" &&
        (result.category.evidence ?? []).includes(
          "service-intent-routes-to-services",
        );
      if (serviceRouted) {
        taxonomyNodeId = null;
      } else {
        categoryId = node.categoryId;
        subcategorySlug = node.subcategoryId ?? null;
      }
    }
  } else if (fields.productType?.kind === "VALUE" && fields.productType.value) {
    // leave as-is
  }

  // Automotive subcategory from needType / subject (not always yedek-parça)
  if (categoryId === "automotive" && !subcategorySlug) {
    const need =
      fields.needType?.kind === "VALUE" && fields.needType.value
        ? fields.needType.value
        : null;
    const subject = result.requestSubject.kind.value;
    if (need === "part" || subject === "PART" || subject === "ACCESSORY") {
      subcategorySlug = "yedek-parca";
    } else if (need === "service" || subject === "SERVICE") {
      subcategorySlug = "arac-bakim";
    } else if (need === "tire") {
      subcategorySlug = "lastik-ve-jant";
    } else if (
      need === "vehicle" ||
      subject === "VEHICLE" ||
      result.intent.value === "BUY" ||
      result.intent.value === "SELL" ||
      result.intent.value === "RENT"
    ) {
      subcategorySlug = "arac-satin-alma";
    }
  }

  // Real-estate: listingType + property hint → subcategory / taxonomy leaf
  if (categoryId === "real-estate") {
    const listing = (
      fields.listingType?.kind === "VALUE" && fields.listingType.value
        ? fields.listingType.value
        : ""
    ).toLocaleLowerCase("tr-TR");
    const raw = (result.rawInput ?? "").toLocaleLowerCase("tr-TR");
    const propHint = (
      fields.propertyType?.kind === "VALUE" && fields.propertyType.value
        ? fields.propertyType.value
        : result.requestSubject.name?.value
          ? String(result.requestSubject.name.value)
          : ""
    ).toLocaleLowerCase("tr-TR");

    if (!subcategorySlug) {
      if (listing.includes("kiralık") || /\bkiralık\b/.test(raw)) {
        subcategorySlug = "kiralik-konut";
      } else if (listing.includes("satılık") || /\bsatılık\b/.test(raw)) {
        subcategorySlug = "satilik-konut";
      } else if (/\b(arsa|tarla)\b/.test(raw) || propHint.includes("arsa")) {
        subcategorySlug = "arsa";
      } else if (
        /\b(dükkan|dukkan|ofis|işyeri|isyeri|depo)\b/.test(raw) ||
        propHint.includes("ofis") ||
        propHint.includes("dükkan")
      ) {
        subcategorySlug = "ticari-gayrimenkul";
      } else if (
        /\b(daire|villa|rezidans|konut|ev|stüdyo|studyo|dubleks)\b/.test(raw) ||
        /\b(daire|villa|ev)\b/.test(propHint)
      ) {
        subcategorySlug =
          result.intent.value === "RENT" ? "kiralik-konut" : "satilik-konut";
      }
    }

    if (!taxonomyNodeId && subcategorySlug) {
      const typeToken =
        /\bdaire\b/.test(propHint) || /\bdaire\b/.test(raw)
          ? "daire"
          : /\brezidans\b/.test(propHint) || /\brezidans\b/.test(raw)
            ? "rezidans"
            : /\bvilla\b/.test(propHint) || /\bvilla\b/.test(raw)
              ? "villa"
              : /\bmüstakil\b/.test(raw)
                ? "müstakil ev"
                : /\byalı\b/.test(raw)
                  ? "yalı"
                  : propHint.trim() &&
                      !/^(gayrimenkul|emlak|konut)$/i.test(propHint.trim())
                    ? propHint.trim()
                    : null;
      if (typeToken) {
        const hit = findTaxonomyTypeUnderSubcategory(
          "real-estate",
          subcategorySlug,
          typeToken,
        );
        if (hit) taxonomyNodeId = hit.id;
      }
    }
  }

  // Appliances vacuum / appliance leaves → stay on appliances
  // (servis niyeti Hizmetler'e yönlendiyse bu sabitleme de devre dışıdır)
  const serviceRoutedToServices =
    result.category.value === "services" &&
    (result.category.evidence ?? []).includes(
      "service-intent-routes-to-services",
    );
  if (
    !serviceRoutedToServices &&
    (productHint?.taxonomyNodeId?.startsWith("tax:appliances:") ||
      productHint?.productType === "supurge")
  ) {
    categoryId = "appliances";
    if (!taxonomyNodeId && productHint.taxonomyNodeId) {
      taxonomyNodeId = productHint.taxonomyNodeId;
    }
    if (!subcategorySlug && productHint.taxonomyNodeId) {
      if (productHint.taxonomyNodeId.includes(":kucuk-ev-aletleri:")) {
        subcategorySlug = "kucuk-ev-aletleri";
      } else if (
        productHint.taxonomyNodeId.includes(":isitma-sogutma-ve-havalandirma:")
      ) {
        subcategorySlug = "isitma-sogutma-ve-havalandirma";
      } else if (productHint.taxonomyNodeId.includes(":beyaz-esya:")) {
        subcategorySlug = "beyaz-esya";
      }
    }
    if (!subcategorySlug && productHint.productType === "supurge") {
      subcategorySlug = "kucuk-ev-aletleri";
    }
  }

  return {
    categoryId: categoryId ?? null,
    subcategorySlug,
    taxonomyNodeId,
  };
}

/**
 * Merge optional browse field bag (__explicit__* markers) into hybrid fields.
 */
export function mergeBrowseFieldBag(
  fields: Record<string, CanonicalFieldState>,
  browseFields: Record<string, string> | undefined,
  lastUserAction: LastUserAction | undefined,
): Record<string, CanonicalFieldState> {
  if (!browseFields) return fields;
  const next = { ...fields };

  for (const [key, raw] of Object.entries(browseFields)) {
    if (key.startsWith("__explicit__")) continue;
    if (key.endsWith("Id")) continue;
    const explicit = (browseFields[`__explicit__${key}`] ?? "").trim();
    if (!raw?.trim() && !explicit) continue;

    if (isAnySentinel(raw) || raw === FIELD_SENTINEL.ANY) {
      next[key] = {
        kind: "ANY",
        value: null,
        provenance: "EXPLICIT_BROWSE",
        confidence: 1,
        evidence: ["browse:ANY"],
      };
      continue;
    }
    if (isNotApplicableSentinel(raw)) {
      next[key] = {
        kind: "NOT_APPLICABLE",
        value: null,
        provenance: "EXPLICIT_BROWSE",
        confidence: 1,
      };
      continue;
    }

    const incoming: CanonicalFieldState = {
      kind: "VALUE",
      value: raw.trim(),
      provenance: explicit ? "EXPLICIT_BROWSE" : "INFERRED",
      confidence: explicit ? 1 : 0.6,
      evidence: explicit ? ["browse"] : undefined,
    };

    const existing = next[key];
    if (!canApplyField(existing, incoming, lastUserAction ?? "browse")) {
      continue;
    }
    next[key] = incoming;
  }

  return next;
}

/**
 * Last explicit user action wins between EXPLICIT_TEXT and EXPLICIT_BROWSE.
 * Catalog/inferred never overwrite conflicting EXPLICIT.
 */
export function canApplyField(
  existing: CanonicalFieldState | undefined,
  incoming: CanonicalFieldState,
  lastUserAction: LastUserAction,
): boolean {
  if (!existing) return true;
  /**
   * BOŞ UNKNOWN İLE BİLİNÇLİ "BİLMİYORUM" AYNI ŞEY DEĞİLDİR (D3f Dilim 1).
   *
   * Cevaplanmamış alanların varsayılan durumu da `UNKNOWN`tur ve serbestçe
   * doldurulabilir. Ama kullanıcı o soruyu açıkça "Bilmiyorum" diye
   * kapattıysa, Talepo'nun kendi tahmini o cevabın üstüne yazamaz — yazarsa
   * kullanıcı reddettiği tahmini geri almış olur.
   */
  if (existing.kind === "UNKNOWN" && !isDeliberateNonValueAnswer(existing)) {
    return true;
  }

  if (
    incoming.provenance === "INFERRED" ||
    incoming.provenance === "CATALOG_ENRICHED"
  ) {
    if (
      existing.provenance === "EXPLICIT_TEXT" ||
      existing.provenance === "EXPLICIT_BROWSE"
    ) {
      return false;
    }
    if (existing.kind === "ANY" || existing.kind === "NOT_APPLICABLE") {
      return false;
    }
    return true;
  }

  // Incoming is EXPLICIT_*
  if (isDeliberateNonValueAnswer(existing)) {
    /**
     * Bilinçli bir "değer taşımayan" cevabın üstüne YALNIZ yeni bir bilinçli
     * kullanıcı cevabı yazabilir: somut bir değer ya da başka bir değer
     * taşımayan mod. Çıkarım bu kapıya zaten giremez (yukarıda elenir).
     */
    return (
      incoming.kind === "VALUE" ||
      incoming.kind === "ANY" ||
      incoming.kind === "UNKNOWN" ||
      incoming.kind === "NOT_APPLICABLE"
    );
  }

  if (
    existing.provenance === "INFERRED" ||
    existing.provenance === "CATALOG_ENRICHED"
  ) {
    return true;
  }

  // Both explicit — last action wins
  if (
    existing.provenance === "EXPLICIT_TEXT" &&
    incoming.provenance === "EXPLICIT_BROWSE"
  ) {
    return lastUserAction === "browse";
  }
  if (
    existing.provenance === "EXPLICIT_BROWSE" &&
    incoming.provenance === "EXPLICIT_TEXT"
  ) {
    return lastUserAction === "text";
  }

  return true;
}

/**
 * Progressive text rebuild: keep EXPLICIT_BROWSE only.
 * Previous EXPLICIT_TEXT / INFERRED / CATALOG come from the new understanding
 * (stale text-inferred values must not survive when the user deletes them).
 */
const STALE_FOLD: Record<string, string> = {
  ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u",
};
function foldForStaleCheck(value: string): string {
  let out = "";
  for (const ch of value.toLocaleLowerCase("tr-TR")) out += STALE_FOLD[ch] ?? ch;
  return out;
}

/**
 * A text-extracted value is a NEW statement only if the user's edit introduced
 * it. If the same wording was already present in the previous raw input, the
 * user edited something else — re-parsing that untouched phrase must not
 * overwrite an explicit answer they gave in the question flow.
 *
 * Bug this kills: user wrote "…ankara civarı", later picked a different city
 * in the question flow, then touched the text once more — the stale "ankara"
 * re-parsed as EXPLICIT_TEXT and clobbered the chosen city.
 */
function isStaleTextRestatement(
  incoming: CanonicalFieldState,
  previousRawInput: string | undefined,
  currentRawInput: string | undefined,
): boolean {
  if (!previousRawInput || !currentRawInput) return false;
  const value =
    incoming.kind === "VALUE" && incoming.value != null
      ? String(incoming.value).trim()
      : "";
  if (!value) return false;
  const needle = foldForStaleCheck(value);
  if (!needle) return false;
  return (
    foldForStaleCheck(previousRawInput).includes(needle) &&
    foldForStaleCheck(currentRawInput).includes(needle)
  );
}

export function mergePreservedBrowseFields(
  fromUnderstanding: Record<string, CanonicalFieldState>,
  previous: Record<string, CanonicalFieldState> | undefined,
  lastUserAction: LastUserAction,
  rawInputs?: { previous?: string; current?: string },
): Record<string, CanonicalFieldState> {
  if (!previous) return fromUnderstanding;

  const next = { ...fromUnderstanding };
  for (const [key, prevField] of Object.entries(previous)) {
    if (prevField.provenance !== "EXPLICIT_BROWSE") continue;
    if (prevField.kind === "UNKNOWN") continue;

    const incoming = next[key];
    if (!incoming || incoming.kind === "UNKNOWN") {
      next[key] = prevField;
      continue;
    }

    // An unchanged phrase from the old text is not a fresh user statement —
    // the explicit answer (browse/question flow) stays authoritative.
    if (
      incoming.provenance === "EXPLICIT_TEXT" &&
      isStaleTextRestatement(incoming, rawInputs?.previous, rawInputs?.current)
    ) {
      next[key] = prevField;
      continue;
    }

    // Incoming may not overwrite browse explicit (e.g. weak inference)
    if (!canApplyField(prevField, incoming, lastUserAction)) {
      next[key] = prevField;
    }
  }
  return next;
}

export function buildCanonicalRequestState(input: {
  understanding: RequestUnderstandingResult;
  browseFields?: Record<string, string>;
  lastUserAction?: LastUserAction;
  previous?: CanonicalRequestState | null;
  /**
   * When rebuilding from new text: drop stale inferred/EXPLICIT_TEXT from previous,
   * but preserve EXPLICIT_BROWSE unless the new text explicitly conflicts.
   */
  progressiveReset?: boolean;
}): CanonicalRequestState {
  const lastAction =
    input.lastUserAction ?? input.previous?.lastUserAction ?? "text";
  const mapped = mapUnderstandingToFields(input.understanding);
  let fields = mergeBrowseFieldBag(mapped, input.browseFields, lastAction);

  // Progressive text path: preserve browse pins; never keep stale text inference
  if (input.progressiveReset && input.previous?.fields) {
    fields = mergePreservedBrowseFields(
      fields,
      input.previous.fields,
      lastAction,
      {
        previous: input.previous.understanding?.rawInput,
        current: input.understanding.rawInput,
      },
    );
  }

  const tax = taxonomyFromUnderstanding(input.understanding, fields);

  // Browse-selected taxonomy leaf survives progressive text if still same category
  let taxonomyNodeId = tax.taxonomyNodeId;
  let subcategorySlug = tax.subcategorySlug;
  let categoryId = tax.categoryId;
  if (
    input.progressiveReset &&
    input.previous?.taxonomyNodeId &&
    !taxonomyNodeId &&
    (!tax.categoryId ||
      !input.previous.categoryId ||
      tax.categoryId === input.previous.categoryId)
  ) {
    taxonomyNodeId = input.previous.taxonomyNodeId;
    subcategorySlug = subcategorySlug ?? input.previous.subcategorySlug;
    categoryId = categoryId ?? input.previous.categoryId;
  }

  /**
   * SEÇENEK BAĞLAMASI ÇÖZÜLMÜŞ KATEGORİYLE TEKRARLANIR (KB-15).
   *
   * `mapUnderstandingToFields` bağlamayı anlama katmanının kendi kategori
   * kararıyla yapar; o karar `UNKNOWN` olabilir ("Klinik için steril eldiven
   * arıyorum" ölçüldü: `understanding.category = null`, besteci `health`).
   * O durumda kanonik seçenek kaydı hiç okunmuyor ve kullanıcının yazdığı
   * değer alana bağlanmıyordu. Bağlayıcı yalnız BOŞ alanları doldurduğu için
   * ikinci çağrı güvenlidir; dolu ya da tarayarak seçilmiş alanlara dokunmaz.
   */
  if (categoryId) {
    bindWrittenOptionValues(
      fields,
      categoryId,
      String(input.understanding.rawInput ?? ""),
    );
  }

  fields = stripIncompatibleDomainFields(fields, categoryId);

  return {
    version: "hybrid-v1",
    understanding: input.understanding,
    fields,
    categoryId,
    subcategorySlug,
    taxonomyNodeId,
    lastUserAction: input.lastUserAction ?? input.previous?.lastUserAction,
    naturalTextDirty: true,
    lastComposedText: input.previous?.lastComposedText,
    syncGeneration: (input.previous?.syncGeneration ?? 0) + 1,
  };
}

/** Field bag for question resolver / schema (sentinels for ANY/NA). */
export function toResolverFieldBag(
  state: CanonicalRequestState,
): Record<string, string> {
  const seeded = seedFieldValuesFromUnderstanding(state.understanding);
  const out: Record<string, string> = { ...seeded };

  for (const [key, field] of Object.entries(state.fields)) {
    if (isDeliberateNonValueAnswer(field)) {
      /**
       * DEĞER TAŞIMAYAN BİLİNÇLİ CEVAP — TEK KAPI, TEK ÖLÇÜT (B1, 2026-08-27).
       *
       * Burada eskiden `kind === "ANY" || kind === "NOT_APPLICABLE"` diye
       * ELLE yazılmış bir dal vardı ve açık-cevap işaretini PROVENANCE'A
       * BAKMADAN yazıyordu. Soru çözücüsü kapanışı o işaretten okuduğu için
       * `kind` tek başına yetki üretiyordu: kanonik yardımcı "bu bilinçli bir
       * cevap değil" derken soru yine de kapanıyordu. Ölçüldü — çıkarımdan
       * gelen bir `ANY` kaydı soruyu kapatabiliyordu.
       *
       * Kapanış yetkisi artık YALNIZ kanonik yardımcıdan doğar. `ANY` ve
       * `NOT_APPLICABLE` kendi sentinel'lerini korur (koşullu görünürlük ve
       * filtre sözleşmesi onları okur); `UNKNOWN` için YENİ BİR SENTINEL
       * DİZESİ UYDURULMAZ — `__UNKNOWN__` diye bir kayıt, kaçındığımız
       * etiket/dize kanalını bir kez daha kurmak olurdu ve `visibleWhen` onu
       * bir değer sanabilirdi. Üçünde de yazılan tek ortak şey, zaten var
       * olan açık-cevap işaretidir.
       */
      if (field.kind === "ANY") out[key] = FIELD_SENTINEL.ANY;
      else if (field.kind === "NOT_APPLICABLE") {
        out[key] = FIELD_SENTINEL.NOT_APPLICABLE;
      }
      out[`__explicit__${key}`] =
        field.provenance === "EXPLICIT_BROWSE" ? "browse" : "text";
    } else if (field.kind === "VALUE" && field.value) {
      /**
       * KAPI DEĞERİ KAYIT DEĞERİDİR, ETİKET DEĞİL (KB-15).
       *
       * Soru çözücüsü `visibleWhen` / `dependsOn` koşullarını bu torbadan
       * okur ve koşullar kayıt değerine ("karton-kutu") bakar. Kullanıcının
       * gördüğü etiket ("Karton kutu") `state.fields` içinde kalır; burada
       * kayıt değeri varsa o geçirilir.
       */
      out[key] = field.canonicalValue ?? field.value;
      if (
        field.provenance === "EXPLICIT_TEXT" ||
        field.provenance === "EXPLICIT_BROWSE"
      ) {
        out[`__explicit__${key}`] =
          field.provenance === "EXPLICIT_BROWSE" ? "browse" : "text";
      }
      /**
       * ÇIKARIM CEVAP DEĞİLDİR (KB-17). Değer torbada kalır — koşullu
       * görünürlük onu okur — ama alan cevaplanmış sayılmasın diye ayrıca
       * işaretlenir. Karar burada verilmez: tek otorite `classifyAnswerAuthority`.
       */
      if (isInferenceOnlyAnswer(field)) {
        out[inferenceOnlyMarkerKey(key)] = "1";
      }
    }
  }

  if (state.categoryId === "automotive" && !out.needType) {
    if (state.understanding.requestSubject.kind.value === "PART") {
      out.needType = "part";
    }
  }

  return out;
}

export function getFieldKind(
  state: CanonicalRequestState,
  key: string,
): CanonicalFieldState["kind"] {
  return state.fields[key]?.kind ?? "UNKNOWN";
}
