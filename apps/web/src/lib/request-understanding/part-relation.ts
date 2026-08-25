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
  APPLIANCE_BRANDS,
  AUTOMOTIVE_BRANDS,
  BABY_BRANDS,
  FURNITURE_BRANDS,
  HOME_KITCHEN_BRANDS,
  MACHINERY_BRANDS,
  TECHNOLOGY_BRANDS,
  findAnyCatalogBrand,
  findBrand,
  findTechnologyProduct,
  isKnownAutomotiveModelName,
} from "@/lib/ai/parser/brand-catalog";
import type { BrandEntry } from "@/lib/ai/parser/brand-catalog";
import { resolveDomainEntity } from "@/lib/catalog";
import {
  findPartBearingParentSpan,
  readParentProductVerdict,
} from "@/lib/taxonomy/phrase-classification";
import { listTaxonomyAliasCandidates } from "@/lib/taxonomy/registry";
import type { TaxonomyNode } from "@/lib/taxonomy";

import {
  classifyRequestedTargetRole,
  foldRoleToken,
} from "./requested-item-role";
import type { RequestedTargetRole } from "./requested-item-role";

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

/**
 * Bağlacın SOLUNDAKİ güvenli span — hizmetin uygulandığı ürün/platform (1I).
 *
 * `readRequestedTarget`'ın aynadaki eşi. Sol yaka da serbest metin taşıyabilir
 * ("Merhaba, telefonum 0532…, ofis için temizlik"); bu yüzden yalnız SON
 * yan cümle alınır, talep fiilleri kırpılır, uzunluk sınırlanır ve rakam
 * dizisi taşıyan span REDDEDİLİR. Böylece bu span profesyonel metne
 * güvenle yazılabilir.
 */
export function readRelationContext(parent: string): string | null {
  const raw = String(parent ?? "").trim();
  if (!raw) return null;
  const clauses = raw.split(/[,;:.!?()/]/u).filter((c) => c.trim());
  const last = clauses[clauses.length - 1] ?? "";
  const t = last.replace(REQUEST_TAIL_RE, " ").replace(/\s+/gu, " ").trim();
  if (!t || !/\p{L}/u.test(t)) return null;
  if (t.length > MAX_TARGET_CHARS) return null;
  if (/\d{5,}/u.test(t)) return null;
  return t;
}

/**
 * BİR VARLIK ADINI İÇEREN GÜVENLİ KULLANICI İFADESİ (1K).
 *
 * Uyumluluk bağlacı olmayan cümlelerde besteci kullanıcının ifadesini
 * kaybediyor ve "arıyorum."a iniyordu — "WordPress destek arıyorum",
 * "CNC servis arıyorum" böyle öznesiz kalıyordu.
 *
 * Ham cümlenin tamamı ASLA taşınmaz. Cümle yan cümlelere bölünür, YALNIZ
 * verilen adı içeren yan cümle seçilir, talep fiilleri kırpılır, uzunluk
 * sınırlanır ve rakam dizisi taşıyan span reddedilir. Böylece bütçe,
 * telefon ve adres parçaları profesyonel metne giremez.
 */
export function readSafePhraseContaining(
  rawInput: string,
  needle: string,
): string | null {
  const raw = String(rawInput ?? "").trim();
  const token = String(needle ?? "").trim();
  if (!raw || !token) return null;
  for (const clause of raw.split(/[,;:.!?()/\n]/u)) {
    const candidate = clause
      .replace(REQUEST_TAIL_RE, " ")
      .replace(/\s+/gu, " ")
      .trim();
    if (!candidate || !/\p{L}/u.test(candidate)) continue;
    if (!containsPhraseToken(candidate, token)) continue;
    if (candidate.length > MAX_TARGET_CHARS) return null;
    if (/\d{5,}/u.test(candidate)) return null;
    return candidate;
  }
  return null;
}

/**
 * HAM CÜMLENİN İLK GÜVENLİ ÖBEĞİ (RC_BRAND takip dilimi).
 *
 * Marka temizliği öznesiz metin bırakabiliyor ("Kürek sapı arıyorum" →
 * "arıyorum."). Bu yardımcı ham cümlenin İLK noktalama öbeğini alır, talep
 * ve yaptırma fiillerini kırpar, sondaki bağlacı atar; rakam dizisi taşıyan
 * ya da anlamlı sözcük içermeyen öbeği REDDEDER. Ham cümlenin tamamı asla
 * taşınmaz — bütçe/telefon/adres yan cümleleri noktalama sınırında kalır.
 */
const MAKE_VERB_RE =
  /(?:^|[^\p{L}\p{N}])(?:yaptırmak|yaptirmak|bastırmak|bastirmak|ürettirmek|urettirmek|boyatmak)(?=[^\p{L}\p{N}]|$)/giu;

export function readSafeLeadingPhrase(rawInput: string): string | null {
  const raw = String(rawInput ?? "").trim();
  if (!raw) return null;
  const first = raw.split(/[,;:.!?()/\n]/u)[0] ?? "";
  let t = first
    .replace(REQUEST_TAIL_RE, " ")
    .replace(MAKE_VERB_RE, " ")
    .replace(/\s+/gu, " ")
    .trim();
  t = t.replace(/\s+(?:için|icin)$/iu, "").trim();
  if (!t || !/\p{L}{3,}/u.test(t)) return null;
  if (t.length > MAX_TARGET_CHARS) return null;
  if (/\d{5,}/u.test(t)) return null;
  return t;
}

export type ParentIdentity = {
  brand?: string | null;
  model?: string | null;
  /** Doğrulanmış otomotiv modeli (varsa). */
  catalogModel?: string | null;
};

export type UsageContextSplit = {
  /** Bağlacın SOLU — yalnız kullanım amacı / hedef kitle / yer / kurum. */
  context: string;
  /** Bağlacın SAĞI — asıl talep konusu. */
  target: string;
  /** Hedefin kanonik rolü — bu yapıda yalnız WHOLE_PRODUCT ya da SERVICE. */
  role: RequestedTargetRole;
};

/**
 * SOL TARAF YALNIZ KULLANIM BAĞLAMI MI? (1H)
 *
 * "X için Y" yapısında rolleri belirleyen SAĞ taraftır:
 *
 *   Y bir BİLEŞEN ise   → X gerçek üst üründür; markası, modeli ve ürün
 *                          kimliği KORUNUR ("Renault Clio için ön far").
 *   Y bütün ÜRÜN ya da  → Y asıl talep konusudur; X yalnız kullanım amacı,
 *   HİZMET ise            hedef kitle, yer ya da kurum bağlamıdır ve
 *                          kategori/marka/model olarak Y'yi EZEMEZ
 *                          ("Ofis için muhasebe yazılımı").
 *   Y rolü BİLİNMİYORSA → hiçbir şey silinmez, kesinlik de üretilmez.
 *
 * Ölçülen hata ailesi tek kökten geliyordu: anlama katmanı sağ tarafı doğru
 * çözdükten sonra ham cümlenin TAMAMINI yeniden tarayan ipucu katmanları
 * soldaki bağlamı asıl ürün ya da marka sanıyordu — "Ofis için muhasebe
 * yazılımı" kategorisi real-estate, "Restoran için POS yazılımı" markası
 * "Restoran" oluyordu.
 *
 * Karar burada verilmez, tek yetkili rol sınıflandırıcısından okunur; bu
 * fonksiyon yalnız o rolü ilişkinin iki yakasına bağlar. Kelime listesi
 * yoktur: "Ofis" de "WordPress" de aynı kuraldan geçer, ayrımı sağdaki
 * hedefin rolü yapar.
 */
export function readUsageContextSplit(rawInput: string): UsageContextSplit | null {
  const split = splitCompatibilityPhrase(String(rawInput ?? ""));
  if (!split) return null;
  const target = readRequestedTarget(split.requested).value;
  if (!target) return null;
  const role = classifyRequestedTargetRole(target).role;
  if (role !== "WHOLE_PRODUCT" && role !== "SERVICE") return null;
  return { context: split.parent, target, role };
}

/**
 * BU JETON YALNIZ KULLANIM BAĞLAMINDAN MI GELİYOR? (1H)
 *
 * `isRequestedItemNotModel` (KB-12) kardeş kuraldır: o "bağlacın SAĞI model
 * olamaz" der, bu "bağlacın SOLU yalnız bağlamsa marka/model olamaz" der.
 *
 * Kural kelime listesiyle DEĞİL kanıtla çalışır; dört koşul birlikte aranır:
 *
 *   1) Uyumluluk bağlacı var ve sağdaki hedefin rolü bütün ürün ya da hizmet
 *      (`readUsageContextSplit`). Sağ taraf bir BİLEŞENSE kural hiç çalışmaz;
 *      "Renault Clio için ön far" cümlesinde sol taraf gerçek üst üründür.
 *   2) Jeton yalnız SOLDA geçiyor, sağdaki hedefte yok.
 *   3) Sol taraf kanonik üst ürün kanıtı taşımıyor (`resolvePartBearingParent`).
 *   4) Aday KATALOGDA DOĞRULANMIŞ bir marka/model DEĞİLDİR. Kimlik katmanı
 *      tanımadığı büyük harfli sözcükleri de marka adayı üretir; büyük harfle
 *      başlamak tek başına marka kanıtı DEĞİLDİR. Ölçülen ayrım:
 *      `findAnyCatalogBrand` "Arçelik" ve "Bosch"u tanır, "Restoran",
 *      "WordPress" ve "SAP"ı tanımaz. Bu yüzden "Arçelik için servis"te marka
 *      korunur, "Restoran için POS yazılımı"nda düşer.
 *
 * Ölçülen hata: "Restoran için POS yazılımı arıyorum" → marka "Restoran".
 * "WordPress için SEO eklentisi" cümlesinde WordPress KORUNUR: orada sağ taraf
 * bir BİLEŞENdir, kural hiç çalışmaz.
 */
export function isUsageContextOnlyDesignator(
  rawInput: string,
  candidate: { value?: unknown } | null | undefined,
  identity: ParentIdentity,
): boolean {
  const value = String(candidate?.value ?? "").trim();
  if (!value) return false;
  const usage = readUsageContextSplit(rawInput);
  if (!usage) return false;
  /**
   * SENTEZLENMİŞ ADAY — ilişkinin İKİ YAKASINI birden kapsayabilir (1B ile
   * aynı desen). Ölçülen: "Restoran için POS yazılımı" → marka adayı
   * "Restoran POS"; bütün olarak ne solda ne sağda geçer. Bu yüzden aday
   * SÖZCÜK SÖZCÜK okunur: en az bir sözcüğü yalnız bağlamdan geliyorsa aday
   * ilişki sınırını ihlal ediyordur.
   */
  const words = value.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const fromContext = words.filter(
    (w) =>
      containsPhraseToken(usage.context, w) &&
      !containsPhraseToken(usage.target, w),
  );
  if (!fromContext.length) return false;
  // Katalogda doğrulanmış marka/model asla bağlam sanılmaz.
  if (findAnyCatalogBrand(value)) return false;
  if (isKnownAutomotiveModelName(value) || findTechnologyProduct(value)) {
    return false;
  }
  return !resolvePartBearingParent(usage.context, identity);
}

/* ------------------------------------------------------------------ *
 *  UZMANLIK ALANI (KATEGORİ) — İHTİYAÇ TÜRÜNDEN AYRI EKSEN (1I)       *
 * ------------------------------------------------------------------ */

/**
 * KATALOG MARKASININ ALANI — mevcut kanonik listelerden TÜRETİLİR.
 *
 * `brand-catalog.ts` markaları zaten alan alan ayrı listelerde tutuyor;
 * burada ikinci bir marka listesi KURULMAZ, yalnız o listelerin adlandırdığı
 * alan tek yerde adlandırılır. Slug'lar kanonik taksonominin kök kategori
 * kimlikleridir ve `verify-taxonomy-drift-v1` onları zaten izler.
 *
 * Birden fazla alanda geçen marka (ölçüldü: "Samsung" hem appliances hem
 * technology) KANIT ÜRETMEZ — belirsizlik kesinliğe çevrilmez.
 */
const CATALOG_BRAND_DOMAINS: ReadonlyArray<readonly [string, BrandEntry[]]> = [
  ["automotive", AUTOMOTIVE_BRANDS],
  ["appliances", APPLIANCE_BRANDS],
  ["home-kitchen", HOME_KITCHEN_BRANDS],
  ["machinery", MACHINERY_BRANDS],
  ["technology", TECHNOLOGY_BRANDS],
  ["furniture", FURNITURE_BRANDS],
  ["baby", BABY_BRANDS],
];

/** Kanonik kök kategori kimlikleri — sapma denetimi için dışa verilir. */
export const CATALOG_BRAND_DOMAIN_IDS: readonly string[] =
  CATALOG_BRAND_DOMAINS.map(([id]) => id);

function domainForCatalogBrand(span: string): string | null {
  const hits = CATALOG_BRAND_DOMAINS.filter(([, list]) =>
    findBrand(span, list),
  ).map(([id]) => id);
  return hits.length === 1 ? (hits[0] ?? null) : null;
}

export type RelationDomainEvidence = {
  /** Kanonik kök kategori kimliği. */
  categoryId: string;
  code:
    | "domain:taxonomy-part-bearing"
    | "domain:taxonomy-area"
    | "domain:catalog-brand"
    | "domain:catalog-entity"
    | "domain:role-vocabulary";
  /** Kanıtı üreten ifade parçası. */
  span: string;
  /** Doğrulanmış ürün/platform kanıtı mı, yoksa sözcük dağarcığı mı? */
  verified: boolean;
};

function domainFromSpan(span: string): RelationDomainEvidence | null {
  const trimmed = span.trim();
  if (!trimmed) return null;
  /**
   * 0) TİPLİ KANONİK ALAN VARLIĞI (1J) — platform, yazılım ailesi, makine
   *    türü. Marka kataloğundan ÖNCE sorulur: bu varlıklar marka değildir ve
   *    marka olarak aranmaları zaten yanlış olurdu.
   */
  const typed = resolveDomainEntity(trimmed);
  if (typed.status !== "NONE" && typed.domainId) {
    return {
      categoryId: typed.domainId,
      code: "domain:catalog-entity",
      span: typed.canonicalLabel ?? trimmed,
      /**
       * KÜRASYON KAPISI (1K): yalnız kurucu onaylı kayıt doğrulanmış
       * kanıt sayılır. Onay bekleyen kayıt alan ADAYI üretir, kesinlik
       * üretmez; çakışmalı (AMBIGUOUS) kayıt da öyle.
       */
      verified: typed.status === "RESOLVED" && typed.evidenceStrength === "VERIFIED",
    };
  }
  // 1) Kanonik taksonomide parça taşıyan bir ürün — servis edilebilen şey
  //    parçası olan şeydir. "klima", "buzdolabı", "bulaşık makinesi" böyle
  //    bulunur; "ofis", "ev", "düğün" bulunmaz (ölçüldü).
  const bearing = findPartBearingParentSpan(trimmed);
  if (bearing?.node.categoryId) {
    return {
      categoryId: bearing.node.categoryId,
      code: "domain:taxonomy-part-bearing",
      span: bearing.text,
      verified: true,
    };
  }
  // 2) Doğrulanmış katalog markası — listenin kendisi alanı adlandırır.
  const brandDomain = domainForCatalogBrand(trimmed);
  if (brandDomain) {
    return {
      categoryId: brandDomain,
      code: "domain:catalog-brand",
      span: trimmed,
      verified: true,
    };
  }
  return null;
}

/**
 * TALEBİN UZMANLIK ALANI — hizmet olmak alanı silmez (1I).
 *
 * Talepo'da iki ayrı eksen vardır: KATEGORİ "hangi uzmanlık alanı?", KIND
 * "ne tür ihtiyaç?" sorusunu yanıtlar. `SERVICE` olmak kategorinin otomatik
 * `services` olması demek DEĞİLDİR — "Renault Clio bakımı" otomotiv,
 * "klima servisi" beyaz eşya, "ev temizliği" genel hizmettir.
 *
 * Alan kanıtı şu sırayla aranır ve hepsi MEVCUT kanonik kaynaklardan gelir:
 *
 *   1) Bağlacın SOLUNDA doğrulanmış ürün/platform (kanonik parça taşıyıcı
 *      düğüm ya da katalog markası) — hizmetin uygulandığı şey.
 *   2) İstenen hedefin İÇİNDE doğrulanmış ürün ("klima servisi" → klima).
 *   3) Bağlaç yoksa cümlenin tamamında aynı arama ("buzdolabı tamiri").
 *   4) Rol sözcük dağarcığının adlandırdığı alan ("ERP sistemi" → technology).
 *
 * Doğrulanmış kanıt yoksa `null` döner: alan uydurulmaz, mevcut karar
 * korunur ve gerekirse genel hizmet alanına düşülür.
 */
export function resolveRelationDomain(
  rawInput: string,
): RelationDomainEvidence | null {
  const text = String(rawInput ?? "").trim();
  if (!text) return null;
  const split = splitCompatibilityPhrase(text);
  const target = split ? readRequestedTarget(split.requested).value : null;

  if (split) {
    // (1) Sol taraf: hizmetin/parçanın uygulandığı ürün ya da platform.
    const fromContext = domainFromSpan(split.parent);
    if (fromContext) return fromContext;
    // (2) İstenen hedefin içindeki ürün.
    const fromTarget = target ? domainFromSpan(target) : null;
    if (fromTarget) return fromTarget;
  } else {
    // (3) Bağlaç yok — cümlenin tamamı taranır.
    const fromText = domainFromSpan(text);
    if (fromText) return fromText;
  }

  // (4) Rol sözcük dağarcığı — kanonik düğümü olmayan dijital ürün adları.
  const roleScope = target ?? text;
  const vocabularyDomain = classifyRequestedTargetRole(roleScope).domain;
  if (vocabularyDomain) {
    return {
      categoryId: vocabularyDomain,
      code: "domain:role-vocabulary",
      span: roleScope,
      verified: false,
    };
  }

  /**
   * (5) HEDEF BİR HİZMETSE alanı SOL taraf taşır.
   *
   * "Logo yazılımı için kurulum hizmeti" ve "Web sitesi için bakım desteği"
   * cümlelerinde istenen şey hizmettir; hangi uzmanlık alanına ait olduğunu
   * yalnız sol taraftaki ürün/platform söyler. Bu adım BİLEREK en sonda ve
   * yalnız hizmet hedefleri için çalışır: "Ofis için televizyon" gibi bütün
   * ürün taleplerinde alan zaten sağdan çözülür ve soldaki kullanım yeri
   * kategoriyi ele geçiremez.
   *
   * Kanıt doğrulanmamıştır (`verified: false`) — kesinlik iddia edilmez.
   */
  if (split && target && classifyRequestedTargetRole(target).role === "SERVICE") {
    const contextVocabulary = classifyRequestedTargetRole(split.parent).domain;
    if (contextVocabulary) {
      return {
        categoryId: contextVocabulary,
        code: "domain:role-vocabulary",
        span: split.parent,
        verified: false,
      };
    }
    /**
     * Kanonik ağaçta bir UZMANLIK ALANI adlandıran sol taraf.
     *
     * Yalnız `CATEGORY` / `SUBCATEGORY` / `GROUP` düğümleri sayılır: bunlar
     * bir alanı adlandırır ("Web sitesi" → technology). `PRODUCT_TYPE`
     * SAYILMAZ — o satın alınabilir bir nesnedir ve hizmet bağlamında yer
     * anlamına gelebilir. Ölçülen hata: "ofis için teknik destek" →
     * real-estate; "Ofis" emlakta bir PRODUCT_TYPE'tır. Servis edilebilen
     * ürünler zaten (1) adımında parça taşıyıcılığıyla yakalanır.
     *
     * Birden fazla alana çözülen ifade ("ev" → emlak ve otomotiv) kanıt
     * üretmez.
     */
    const AREA_TYPES = new Set(["CATEGORY", "SUBCATEGORY", "GROUP"]);
    const areaNodes = listTaxonomyAliasCandidates(split.parent.trim()).nodes.filter(
      (n) => AREA_TYPES.has(n.nodeType),
    );
    const domains = new Set(areaNodes.map((n) => n.categoryId).filter(Boolean));
    if (domains.size === 1) {
      const only = [...domains][0];
      if (only) {
        return {
          categoryId: only,
          code: "domain:taxonomy-area",
          span: split.parent.trim(),
          verified: false,
        };
      }
    }
  }
  return null;
}

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
    /** Konu bir HİZMET olarak çözüldü mü? */
    isServiceSubject: boolean;
    representedText: string;
  },
): UnresolvedCompatibilityTarget | null {
  /**
   * HİZMET KONUSU UYUMLULUK BELİRSİZLİĞİ ÜRETMEZ (1G). Konu hizmet olarak
   * çözüldüyse "için" bir parça ilişkisi değil, hizmetin hedefini anlatır;
   * ortada kaydedilecek bir uyumluluk belirsizliği yoktur. Ölçülen gürültü:
   * "Ev için klima servisi arıyorum" → SERVICE, ama yine de
   * compat_target_unresolved="klima servisi" kaydı üretiliyordu.
   */
  if (subject.isServiceSubject) return null;
  const split = splitCompatibilityPhrase(normalizedInput);
  if (!split) return null;
  const target = readRequestedTarget(split.requested);
  const text = target.value ?? target.raw;
  if (!text || !/\p{L}/u.test(text)) return null;
  /**
   * ROLÜ UYUMLULUĞA KAPALI HEDEF, BELİRSİZLİK DE ÜRETMEZ (1G).
   *
   * Bütün bir ürün ("televizyon", "muhasebe yazılımı") ya da bir hizmet
   * ("kurulum hizmeti") istenmişse ortada çözülememiş bir UYUMLULUK yoktur;
   * kayıt düşmek kullanıcıya olmayan bir eksik gösterirdi. Karar burada
   * yeniden verilmez, tek yetkili rol sınıflandırıcısından okunur.
   */
  if (target.value) {
    const role = classifyRequestedTargetRole(target.value).role;
    if (role === "WHOLE_PRODUCT" || role === "SERVICE") return null;
  }
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
