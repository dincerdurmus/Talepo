/**
 * UYUMLULUK İLİŞKİSİ — "<ÜST ÜRÜN> için <İSTENEN ŞEY>" tek yetkili çözümü.
 *
 * Türkçede "için" cümleyi ikiye böler: solunda parçanın ait olduğu ÜST ÜRÜN,
 * sağında İSTENEN ŞEY durur. Bu modül o bölmeyi yapar, iki yakayı ayrı ayrı
 * değerlendirir ve kararı KANITA bağlar.
 *
 * Neden tek modül: aynı ilişkiyi iki katman soruyor — `semantic-subject.ts`
 * ("bu bir parça talebi mi?") ve `understand-request.ts` ("istenen şey
 * kayboldu mu, kaydetmem gerekir mi?"). Kural iki yere kopyalanmasın diye
 * tek tanım burada durur.
 *
 * Kurallar kelimeye özel DEĞİLDİR. Üst ürün kanıtı kanonik taksonomiden
 * (`PART_BEARING`) ya da doğrulanmış katalog kimliğinden gelir; kod tarafında
 * kategori, marka veya parça adı listesi yoktur.
 */
import {
  findTechnologyProduct,
  isKnownAutomotiveModelName,
} from "@/lib/ai/parser/brand-catalog";
import {
  findPartBearingParentSpan,
  isCanonicalWholeProductPhrase,
  readParentProductVerdict,
} from "@/lib/taxonomy/phrase-classification";
import type { TaxonomyNode } from "@/lib/taxonomy";

import { foldRoleToken } from "./requested-item-role";

/** Uyumluluk bağlacı — kelime sınırında. */
const CONNECTIVE_RE = /(?:^|[^\p{L}\p{N}])(?:için|icin)(?=[^\p{L}\p{N}]|$)/iu;

/**
 * Talep fiilleri ve yardımcı sözcükler — hedef ifadeden ayrıştırılır.
 * Liste PARÇA adı içermez; yalnız TALEP dili taşır, bu yüzden yeni parça
 * adları için güncellenmesi gerekmez.
 */
const REQUEST_TAIL_RE =
  /(?:^|[^\p{L}\p{N}])(?:arıyorum|ariyorum|arıyoruz|ariyoruz|lazım|lazim|gerekiyor|gerek|istiyorum|istiyoruz|alacağım|alacagim|almak|bakıyorum|bakiyorum|olmasın|olmasin|bulmak|temin|acil)(?=[^\p{L}\p{N}]|$)/giu;

/**
 * Yalnız bir GÜVENLİK sınırı — ad sınırı değil, bozuk/serbest metne karşı
 * koruma. Sınırı aşan hedef SESSİZCE düşmez; ham hâliyle korunur ve
 * `reason` ile gerekçesi taşınır.
 */
const MAX_TARGET_CHARS = 80;

/** Normalize edilmiş kelime sınırında jeton araması. */
export function containsPhraseToken(haystack: string, needle: string): boolean {
  const h = foldRoleToken(haystack);
  const n = foldRoleToken(needle).trim();
  if (!n) return false;
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(h);
}

export type CompatibilitySplit = {
  /** Bağlacın SOLU — üst ürün adayı. */
  parent: string;
  /** Bağlacın SAĞI — istenen şey adayı (ham). */
  requested: string;
};

/** "X için Y" yapısını iki yakaya böler. Bağlaç yoksa null. */
export function splitCompatibilityPhrase(text: string): CompatibilitySplit | null {
  const match = text.match(/^(.+?)\s+(?:için|icin)\s+(.+)$/iu);
  if (!match?.[1] || !match[2]) return null;
  return { parent: match[1].trim(), requested: match[2].trim() };
}

export type RequestedTargetReason = "multi-connective" | "no-content" | "too-long";

export type RequestedTarget = {
  /** Sözdizimsel sınırlarla kırpılmış hedef; güvenli değilse null. */
  value: string | null;
  /** Kullanıcının yazdığı hedef — her hâlükârda korunur. */
  raw: string;
  /** `value` null ise yapısal gerekçe. */
  reason: RequestedTargetReason | null;
};

/**
 * Bağlacın sağındaki SOMUT hedefi okur.
 *
 * Sınır KELİME SAYISIYLA değil DİLBİLGİSEL sınırlarla çizilir: noktalama,
 * ikinci bir bağlaç ve talep fiilleri hedefi kapatır. Kelime sayısı üst
 * sınırı yoktur — "ön sağ kapı kilit mekanizması" beş kelimedir ve gerçek
 * bir parça adıdır.
 */
export function readRequestedTarget(requested: string): RequestedTarget {
  const raw = requested.trim();
  const firstClause = raw.split(/[,;:.!?()/]|\s+(?:ve|veya|ile)\s+/iu)[0] ?? "";
  const t = firstClause.replace(REQUEST_TAIL_RE, " ").replace(/\s+/g, " ").trim();
  if (!t || !/\p{L}/u.test(t)) return { value: null, raw, reason: "no-content" };
  // İkinci bir "için" varsa ilişki tek hedefe indirgenememiştir.
  if (CONNECTIVE_RE.test(t)) return { value: null, raw, reason: "multi-connective" };
  if (t.length > MAX_TARGET_CHARS) return { value: null, raw, reason: "too-long" };
  return { value: t, raw, reason: null };
}

export type ParentIdentity = {
  brand?: string | null;
  model?: string | null;
  /** Doğrulanmış otomotiv modeli (varsa). */
  catalogModel?: string | null;
};

export type ParentEvidence = {
  /** Kanıt türü — karar günlüğüne ve evidence dizisine yazılır. */
  code:
    | "parent:taxonomy-part-bearing"
    | "parent:catalog-model"
    | "parent:branded-designator";
  /** Kanıtı üreten ifade parçası. */
  span: string;
};

/**
 * Bağlacın SOLUNDA gerçekten parça taşıyabilen bir üst ürün var mı?
 *
 * Kanıt POZİTİFTİR — kara liste yoktur ve gerekmez. Kabul edilen üç kanıt,
 * güç sırasıyla:
 *
 *   1) `taxonomy-part-bearing` — kanonik taksonomide `PART_BEARING` bildiren
 *      bir ürün solun İÇİNDE geçiyor. Marka öneki sorun değildir:
 *      "Arçelik bulaşık makinesi" içinde "bulaşık makinesi" bulunur.
 *   2) `catalog-model` — doğrulanmış katalog aracı solda ("Mercedes C180").
 *   3) `branded-designator` — marka ve rakam taşıyan bir model belirteci
 *      birlikte solda ("Heidelberg SM 74"). Katalog her makineyi tanımaz;
 *      alfanümerik belirteç bir ürünü ADLANDIRIR, rastgele bir kelime
 *      adlandırmaz. Bu yüzden "Bosch kampanya" kanıt üretmez.
 *
 * Yer/kişi/amaç sözcükleri ("ev", "ofis", "salon", "çocuk", "kampanya") için
 * özel bir kural yoktur: ya taksonomide hiç yokturlar, ya emlak varlığı
 * oldukları için `PART_BEARING` bildirmezler, ya da alias'ları çelişkili
 * olduğu için kanonik katman karar vermez.
 */
export function resolvePartBearingParent(
  parentPhrase: string,
  identity: ParentIdentity,
): ParentEvidence | null {
  const phrase = parentPhrase.trim();
  if (!phrase) return null;

  const taxonomyHit = findPartBearingParentSpan(phrase);
  if (taxonomyHit) {
    return { code: "parent:taxonomy-part-bearing", span: taxonomyHit.text };
  }

  const model = identity.catalogModel ?? identity.model ?? null;
  if (!model || !containsPhraseToken(phrase, model)) return null;
  // Doğrulanmış katalog ilişkisi — araç kataloğu ya da teknoloji ürün
  // kataloğu. İkisi de kürasyonlu envanterdir; "MacBook" orada bir ürün
  // modelidir, rastgele bir jeton değil.
  if (isKnownAutomotiveModelName(model) || findTechnologyProduct(model)) {
    return { code: "parent:catalog-model", span: model };
  }
  const brand = identity.brand ?? null;
  if (brand && containsPhraseToken(phrase, brand) && /\d/.test(model)) {
    return { code: "parent:branded-designator", span: `${brand} ${model}` };
  }
  return null;
}

/**
 * KANONİK ÜST ÜRÜN SPAN'İ — rol çakışmasının tek yetkili kaynağı (1D).
 *
 * "X için Y" yapısında X içinde kanonik olarak parça taşıyan bir ürün
 * bulunduysa o span ÜST ÜRÜN olarak tüketilmiştir. Aynı span aynı anda
 * marka ya da model olamaz: ürün adı marka adayından güçlüdür.
 *
 * Ölçülen hata: "Klima için dış ünite fan motoru arıyorum" → `brand="Klima"`,
 * `categoryId="automotive"`. Kural ada özel değildir; span'e bakar.
 */
export function canonicalParentProductSpan(
  text: string,
): { node: TaxonomyNode; span: string } | null {
  const split = splitCompatibilityPhrase(text);
  if (!split) return null;
  const hit = findPartBearingParentSpan(split.parent);
  return hit ? { node: hit.node, span: hit.text } : null;
}

/**
 * Bu jeton kanonik üst ürün span'inin İÇİNDE mi tüketildi?
 *
 * `isRequestedItemNotModel` ile aynı ailedendir: o "bağlacın SAĞI model
 * olamaz" der, bu "üst ürün olarak tüketilen span marka/model olamaz" der.
 * Span'in DIŞINDA kalan gerçek marka etkilenmez — "Arçelik bulaşık makinesi"
 * içinde span "bulaşık makinesi"dir, "Arçelik" korunur.
 */
export function isConsumedAsParentProduct(text: string, token: string): boolean {
  const t = String(token ?? "").trim();
  if (!t) return false;
  const parent = canonicalParentProductSpan(text);
  if (!parent) return false;
  return containsPhraseToken(parent.span, t);
}

/**
 * TEK UYUMLULUK AUTHORITY'Sİ (1E).
 *
 * Kaldırılan model: aynı "parent için istenen şey" ilişkisi dört ayrı erken
 * daldan geçiyordu (kapalı dünya PART_LEMMAS, açık dünya PART, ACCESSORY,
 * forcedNeedType) ve yalnız ikisi capability kapısından geçiyordu. Sonuç,
 * güvenin istenen KELİMENİN eski sözlükte olup olmamasına bağlanmasıydı:
 *   "Matbaa makinesi için rulman"         → PART / CONFIDENT
 *   "Matbaa makinesi için kontrol paneli" → cümleden tamamen düşüyordu
 *
 * Eski sözlüklerin görevi artık yalnızca "sağdaki ifade parça/aksesuar
 * olabilir mi?" kanıtı üretmektir. "Bu parent gerçekten bu parçayı taşır ve
 * sonuç CONFIDENT'tır" kararını YALNIZ bu authority verir.
 */
/**
 * `whole`, `part`in bütün sözcüklerini taşıyor mu? Türkçe ek toleranslı:
 * "adaptör" ⊂ "bardaklık adaptörü", "pompa" ⊂ "nemlendirme pompası".
 * Sıra aranmaz; eksik sözcük yeter.
 */
export function coversRequestedTokens(whole: string, part: string): boolean {
  const haystack = foldRoleToken(whole).split(/\s+/).filter(Boolean);
  const needles = foldRoleToken(part).split(/\s+/).filter(Boolean);
  if (!needles.length || !haystack.length) return false;
  return needles.every((n) => haystack.some((h) => h.startsWith(n)));
}

export type CompatibilityVerdict = "VERIFIED" | "UNPROVEN" | "NO_PARENT_CLAIM";

export type CompatibilityAuthority = {
  verdict: CompatibilityVerdict;
  /** VERIFIED ise hangi kanıtla. */
  evidence: ParentEvidence | null;
  /** UNPROVEN ise neden — üst ürün hiç yazılmadı mı, kürasyon mu eksik. */
  reason:
    | "parent-capability-unknown"
    | "parent-not-part-bearing"
    | "parent-required"
    | null;
};

/**
 * Talep bir ÜST ÜRÜN İDDİASI taşıyor mu, taşıyorsa kanıtlı mı?
 *
 * İddia iki biçimde gelir: bağlaçla ("X için Y") ya da kimlik üzerinden
 * (parentEntity/identity marka-model taşıyor). Hiçbiri yoksa ortada
 * doğrulanacak bir uyumluluk iddiası yoktur — "tahliye pompası arıyorum"
 * yanlış bir parent iddia etmiyor, bu yüzden bu kapıdan geçmez.
 */
export function resolveCompatibilityAuthority(
  text: string,
  identity: ParentIdentity,
  hasIdentityParent: boolean,
  roleConfirmedByUser = false,
): CompatibilityAuthority {
  const split = splitCompatibilityPhrase(text);
  const parentPhrase = split
    ? split.parent
    : hasIdentityParent
      ? text
      : null;
  if (!parentPhrase?.trim()) {
    /**
     * KULLANICI ROLÜ DOĞRULADI AMA ÜST ÜRÜNÜ YAZMADI (1F).
     *
     * Browse'da "Yedek parça" seçmek bir BEYANDIR: istenen şey bir parçadır.
     * Ama bu seçim NE İÇİN olduğunu kanıtlamaz — marka/model uydurulamaz ve
     * ilişki kesin sayılamaz. Rol doğrulanmıştır, üst ürün gereklidir.
     */
    return roleConfirmedByUser
      ? { verdict: "UNPROVEN", evidence: null, reason: "parent-required" }
      : { verdict: "NO_PARENT_CLAIM", evidence: null, reason: null };
  }
  const evidence = resolvePartBearingParent(parentPhrase, identity);
  if (evidence) return { verdict: "VERIFIED", evidence, reason: null };
  return {
    verdict: "UNPROVEN",
    evidence: null,
    reason: parentCapabilityReason(parentPhrase),
  };
}

export type UnresolvedCompatibilityTarget = {
  /** Kullanıcının yazdığı istenen şey — kırpılmışsa kırpılmış, değilse ham. */
  target: string;
  /** Bağlacın solunda duran, çözülemeyen üst ürün adayı. */
  parent: string;
  /** Neden kesin bir ilişki kurulamadı — yapısal gerekçe. */
  reason:
    | RequestedTargetReason
    /** Kanonik olarak "parça taşımaz" bildirildi (emlak varlığı, hizmet). */
    | "parent-not-part-bearing"
    /** Fiziksel ürün ama yetkinlik kürasyonu YOK — ret değil, açık soru. */
    | "parent-capability-unknown";
};

/**
 * KAYBOLAN İSTENEN ŞEY — talep asla sessizce düşmez.
 *
 * "X için Y" yapısı var ama kesin bir parça ilişkisi kurulamadıysa Y hâlâ
 * kullanıcının yazdığı şeydir. Ölçülen kayıp: "Bosch için rezistans arıyorum"
 * → "Bosch beyaz eşya arıyorum." — 'rezistans' hiçbir yüzeyde yok, hiçbir
 * kayıt da yok. Burada üretilen kayıt mevcut `ambiguities` sözleşmesine
 * yazılır ve oradan `unresolvedExpressions`a akar; yeni bir telemetri
 * katmanı kurulmaz.
 *
 * Üç durumda kayıt ÜRETİLMEZ:
 *   - ilişki zaten kurulmuşsa (üst ürün kanıtlı ve konu PART),
 *   - istenen şey talep konusunda zaten duruyorsa ("Bosch acil için servis"
 *     → konu SERVICE, adı "servis"; kaydedilecek bir kayıp yoktur),
 *   - sağdaki ifade bütün bir ürünü adlandırıyorsa — o zaman "için" kullanım
 *     amacını anlatır ("Çocuk için tablet") ve ürün normal yoldan işlenir.
 *
 * Uzunluk sınırını aşan hedef de buraya düşer: `value` null olsa bile `raw`
 * korunur, yalnız gerekçesi işaretlenir.
 */
export function findUnresolvedCompatibilityTarget(
  normalizedInput: string,
  identity: ParentIdentity,
  subject: {
    /** Uyumluluk kararı authority tarafından DOĞRULANDI mı? */
    relationConfident: boolean;
    /** Konu türü uyumluluk niteliği taşıyor mu (PART/ACCESSORY)? */
    isCompatibilityKind: boolean;
    representedText: string;
  },
): UnresolvedCompatibilityTarget | null {
  const split = splitCompatibilityPhrase(normalizedInput);
  if (!split) return null;
  const target = readRequestedTarget(split.requested);
  const text = target.value ?? target.raw;
  if (!text || !/\p{L}/u.test(text)) return null;
  if (target.value && isCanonicalWholeProductPhrase(target.value)) return null;
  const parentEvidence = resolvePartBearingParent(split.parent, identity);
  if (!target.reason) {
    // İlişki DOĞRULANDIYSA kaydedilecek bir kayıp yoktur.
    if (parentEvidence && subject.relationConfident) return null;
    /**
     * İstenen şey zaten talep konusunda duruyorsa kayıt gereksizdir — ama bu
     * kısayol YALNIZ konu uyumluluk niteliği TAŞIMIYORSA geçerlidir (1E).
     * "Bosch acil için servis" → konu SERVICE, adı "servis": kayıp yok.
     * "Matbaa makinesi için rulman" → konu PART, adı "rulman": konu doğru
     * görünüyor ama ÜST ÜRÜN kanıtsız; burada susmak, doğrulanmamış bir
     * ilişkiyi doğrulanmış gibi göstermek olurdu.
     */
    if (
      !subject.isCompatibilityKind &&
      containsPhraseToken(subject.representedText, target.value ?? "")
    ) {
      return null;
    }
  }
  // Hedef güvenlik sınırında REDDEDİLDİYSE ilişki kurulmuş olsa bile kayıt
  // düşülür: konu doğru olabilir ama kullanıcının yazdığı ifade eksiktir.
  return {
    target: text,
    parent: split.parent,
    reason: target.reason ?? parentCapabilityReason(split.parent),
  };
}

/**
 * Üst ürün NEDEN kesinleştirilemedi? Kayıt yokluğu ile bildirilmiş ret
 * BİRBİRİNDEN AYRI tutulur — biri kürasyon işi, diğeri kanonik karar.
 */
function parentCapabilityReason(
  parentPhrase: string,
): "parent-not-part-bearing" | "parent-capability-unknown" {
  return readParentProductVerdict(parentPhrase).verdict === "EXCLUDED"
    ? "parent-not-part-bearing"
    : "parent-capability-unknown";
}
