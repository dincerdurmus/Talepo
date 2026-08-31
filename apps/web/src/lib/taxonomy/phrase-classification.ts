/**
 * Kanonik taksonomiden türetilen İFADE SINIFLANDIRMASI (KB-12 / 1B).
 *
 * Bu modül yeni bir ürün sözlüğü KURMAZ. `data/taxonomy` altındaki 2151
 * düğümlük kanonik ağaç tek yetkilidir; buradaki işlevler yalnız o ağacı
 * `resolveTaxonomyAlias` üzerinden sorgular. Böylece taksonomiye eklenen her
 * yeni ürün, hiçbir liste güncellemesi gerekmeden bu katmanda da tanınır.
 *
 * Neden ayrı bir modül: aynı soruyu iki farklı katman soruyor —
 * `product-identity/identity-candidates.ts` ("bu ifade bir model mi, yoksa
 * ürün TÜRÜ mü?") ve `request-understanding/semantic-subject.ts` ("bağlacın
 * solunda gerçek bir üst ürün var mı?"). Kural iki yere kopyalanmasın diye
 * tek tanım burada durur ve türetildiği yetkinin (taxonomy) yanında yaşar.
 */
import { listTaxonomyAliasCandidates, resolveTaxonomyAlias } from "./registry";
import type { TaxonomyNode, TaxonomyNodeType } from "./types";

/** Kanonik yetkinlik adları — bkz. KnowledgeCapability ve
 *  data/taxonomy-sources/part-bearing-capability.json. */
const PART_BEARING = "PART_BEARING";
const NOT_PART_BEARING = "NOT_PART_BEARING";

/**
 * ÜÇ DURUM — "kayıt yok" bir RET DEĞİLDİR (1D).
 *
 * `BEARING`  kanonik olarak bildirildi: parça taşır.
 * `EXCLUDED` kanonik olarak bildirilmiş RET (emlak varlığı, hizmet).
 * `UNKNOWN`  henüz kürasyon yapılmadı ya da adaylar çelişiyor. Talep bu
 *            durumda kesinleştirilmez ama REDDEDİLMEZ de; belirsizlik
 *            korunur ve gerekçesi kaydedilir.
 */
export type PartBearingVerdict = "BEARING" | "EXCLUDED" | "UNKNOWN";

/**
 * BÜTÜN ürün adlandıran düğüm türleri. Bir parça talebinin HEDEFİ bunlardan
 * biri olamaz: "televizyon" bir parça değil, ürünün kendisidir.
 */
const WHOLE_PRODUCT_TYPES: ReadonlySet<TaxonomyNodeType> = new Set([
  "CATEGORY",
  "SUBCATEGORY",
  "GROUP",
  "PRODUCT_TYPE",
  "COMMODITY_TYPE",
]);

/** Kelime sayısı — n-gram taraması için. */
function words(phrase: string): string[] {
  return phrase.trim().split(/\s+/).filter(Boolean);
}

/** İfadenin TAMAMI taksonomide hangi düğüm türüne çözülüyor? */
export function classifyTaxonomyPhrase(phrase: string): TaxonomyNode | null {
  const t = phrase?.trim();
  if (!t) return null;
  return resolveTaxonomyAlias(t)?.node ?? null;
}

/** İfadenin TAMAMI kanonik bir ürün TÜRÜ mü? ("fırın", "ankastre fırın") */
export function isCanonicalProductTypePhrase(phrase: string): boolean {
  return classifyTaxonomyPhrase(phrase)?.nodeType === "PRODUCT_TYPE";
}

/**
 * İfadenin TAMAMI bütün bir ürünü mü adlandırıyor?
 * PART_TYPE / SERVICE_TYPE / TECHNICAL_TYPE bilerek dışarıdadır: parça ve
 * hizmet adları burada "bütün ürün" sayılmaz.
 */
export function isCanonicalWholeProductPhrase(phrase: string): boolean {
  /**
   * BÜTÜN ADAYLAR DEĞERLENDİRİLİR — "en derin düğüm kazanır" YETMEZ (1G).
   *
   * `resolveTaxonomyAlias` tek kazanan seçer ve derinliğe göre sıralar. Aynı
   * ifade bir kategoride bütün ürün, başka kategoride parça olabilir:
   * "koltuk" mobilyada PRODUCT_TYPE (depth 3), otomotivde PART_TYPE (depth 5).
   * Derin olan kazandığı için koltuk "bütün ürün değil" sayılıyor ve
   * "Salon için koltuk arıyorum" parça talebine dönüşüyordu (ölçüldü).
   *
   * Herhangi bir kategoride güvenilir bir bütün ürün adayı varsa ifade bütün
   * ürün sayılır. Kural yön olarak KORUYUCUDUR: belirsizlik parça lehine
   * değil, bütün ürün lehine çözülür.
   */
  const { nodes } = listTaxonomyAliasCandidates(phrase);
  return nodes.some((n) => WHOLE_PRODUCT_TYPES.has(n.nodeType));
}

/**
 * İfadenin BÜTÜN kanonik adaylarının düğüm türleri — ham taksonomi olgusu.
 *
 * Burada rol YARGISI yoktur; yargıyı tek yetkili rol sınıflandırıcısı verir
 * (`request-understanding/requested-item-role.ts`). Bu ayrım bilerek yapıldı:
 * olgu taksonominin yanında, yargı istenen şeyin rolünü tanımlayan tek
 * modülde yaşar; ikisi ayrı yerde durunca ikinci bir rol otoritesi doğmaz.
 */
export function listCanonicalPhraseNodeTypes(
  phrase: string,
): TaxonomyNodeType[] {
  return listTaxonomyAliasCandidates(phrase).nodes.map((n) => n.nodeType);
}

/**
 * TEK BİR İFADE parça taşıyabilen bir ürünü mü adlandırıyor?
 *
 * Karar kanonik veriden okunur (`PART_BEARING`), koddaki bir kategori
 * listesinden değil. Belirsizlik yok sayılmaz; üç kademede çözülür:
 *
 *   1) Kanonik ad eşleşmesi varsa YALNIZ o adaylar dikkate alınır. Kanonik
 *      etiket ("Klima") bir kısaltmadan ("EV") güçlü kanıttır.
 *   2) Yalnız PRODUCT_TYPE adaylar sayılır: bütün bir ürünü adlandıran tek
 *      düğüm türü odur. Otomotiv "Klima" GRUBU bir parça grubudur, ürün değil.
 *   3) Kalan adaylar parça taşıyıcılığı konusunda ÇELİŞİYORSA karar
 *      verilmez. "ev" hem emlak "Daire"nin hem otomotiv "Elektrikli
 *      araç"ın alias'ıdır — biri taşır, diğeri taşımaz; bu ifade yüksek
 *      güvenli üst ürün kanıtı üretemez.
 *
 * Kısa alias'lar KÖRLEMESİNE yasaklanmaz: "TV" tek bir PRODUCT_TYPE'a
 * çözülür, çelişki yoktur ve çalışmaya devam eder.
 */
function partBearingVerdict(
  phrase: string,
): { verdict: PartBearingVerdict; node: TaxonomyNode | null } {
  const { nodes, canonical } = listTaxonomyAliasCandidates(phrase);
  if (!nodes.length) return { verdict: "UNKNOWN", node: null };
  const scoped = canonical
    ? nodes.filter((n) => foldSameCanonical(n, phrase))
    : nodes;
  const products = scoped.filter((n) => n.nodeType === "PRODUCT_TYPE");
  if (!products.length) return { verdict: "UNKNOWN", node: null };
  const bearing = products.filter((n) =>
    n.applicableCapabilities.includes(PART_BEARING),
  );
  if (bearing.length === products.length) {
    return { verdict: "BEARING", node: bearing[0] ?? null };
  }
  const excluded = products.filter((n) =>
    n.applicableCapabilities.includes(NOT_PART_BEARING),
  );
  if (excluded.length === products.length) {
    return { verdict: "EXCLUDED", node: excluded[0] ?? null };
  }
  // Adaylar çelişiyor ("ev" → emlak Daire ile otomotiv Elektrikli araç) ya da
  // hiç kürasyon yok. İkisi de KARAR DEĞİL, belirsizliktir.
  return { verdict: "UNKNOWN", node: null };
}

function foldSameCanonical(node: TaxonomyNode, phrase: string): boolean {
  return (
    node.canonicalName.trim().toLocaleLowerCase("tr-TR") ===
    phrase.trim().toLocaleLowerCase("tr-TR")
  );
}

/**
 * İFADENİN İÇİNDE parça taşıyabilen bir üst ürün geçiyor mu?
 *
 * En uzun n-gram önce denenir ki "bulaşık makinesi" bulunsun, "bulaşık"
 * değil. Marka adları taksonomide düğüm DEĞİLDİR; yalın bir marka ("Bosch")
 * ya da marka + rastgele kelime ("Bosch kampanya") burada kanıt üretemez.
 */
export function findPartBearingParentSpan(
  phrase: string,
): { node: TaxonomyNode; text: string } | null {
  const hit = readParentProductVerdict(phrase);
  return hit.verdict === "BEARING" && hit.node && hit.text
    ? { node: hit.node, text: hit.text }
    : null;
}

/**
 * İFADENİN İÇİNDEKİ üst ürün adayının ÜÇ DURUMLU okuması.
 *
 * En uzun n-gram önce denenir ki "bulaşık makinesi" bulunsun, "bulaşık"
 * değil. `BEARING` bulunursa hemen döner; yoksa bulunan en uzun `EXCLUDED`
 * span'i döner ("Ofis" → emlak varlığı, bildirilmiş ret). Hiçbiri yoksa
 * `UNKNOWN` — kürasyon yapılmamış demektir, "taşımaz" demek DEĞİLDİR.
 */
export function readParentProductVerdict(phrase: string): {
  verdict: PartBearingVerdict;
  node: TaxonomyNode | null;
  text: string | null;
} {
  const parts = words(phrase);
  if (!parts.length) return { verdict: "UNKNOWN", node: null, text: null };
  let excluded: { node: TaxonomyNode | null; text: string } | null = null;
  for (let size = parts.length; size >= 1; size--) {
    for (let start = 0; start + size <= parts.length; start++) {
      const text = parts.slice(start, start + size).join(" ");
      const hit = partBearingVerdict(text);
      if (hit.verdict === "BEARING") {
        return { verdict: "BEARING", node: hit.node, text };
      }
      if (hit.verdict === "EXCLUDED" && !excluded) {
        excluded = { node: hit.node, text };
      }
    }
  }
  return excluded
    ? { verdict: "EXCLUDED", node: excluded.node, text: excluded.text }
    : { verdict: "UNKNOWN", node: null, text: null };
}

/* ═══════════════════════════════════════════════════════════════════════
   KANONİK KATEGORİ İDDİASI — dedektör öncelik sözleşmesinin 1. basamağı
   (2026-08-30).

   Ölçülen hata sınıfı: tam katalog matrisinde 804 kanonik yaprak adının
   TAMAMI taksonomide çözülebildiği hâlde, token skorlayıcı içlerindeki tek
   bir genel kelimeye ("Klima gaz dolumu" → klima, "Buz Makinesi" → makine)
   yenilip talebi başka kategoriye taşıyordu.

   Sözleşme: kullanıcı metnindeki EN UZUN tam kanonik yaprak/alias eşleşmesi
   ve o eşleşmenin katalogdaki sahibi, token skorlamasından ÖNCE gelir.
   Birden fazla gerçek sahip varsa karar tipli belirsizlik politikasına
   (`routing-ambiguity-policy`) gider; politika yoksa iddia üretilmez ve
   çakışma zaten POLICY kapısında kırmızıdır. Token skorlaması yalnız hiçbir
   kanonik kanıt bulunamadığında çalışan fallback'tir.

   Bu bir ikinci dedektör DEĞİLDİR: sorgulanan tek veri kanonik taksonomi,
   tek karar tablosu mevcut politika modülüdür.
   ═══════════════════════════════════════════════════════════════════════ */
import {
  ambiguityRuleFor,
  foldAmbiguityPhrase,
} from "./routing-ambiguity-policy";

export type CanonicalCategoryClaim =
  | {
      kind: "unique";
      categoryId: string;
      node: TaxonomyNode;
      phrase: string;
      /** Eşleşen sözcük sayısı — kanıt gücü raporlaması için. */
      span: number;
    }
  | {
      kind: "ambiguous";
      categoryIds: readonly string[];
      phrase: string;
      span: number;
    };

/** İstek kuyruğu — iddia taraması bu sözcükleri hiç değerlendirmez. */
const CLAIM_TAIL = new Set([
  "ariyorum",
  "arıyorum",
  "lazim",
  "lazım",
  "istiyorum",
  "gerekiyor",
  "gerek",
  "almak",
  "satin",
  "satın",
  "yaptirmak",
  "yaptırmak",
  "icin",
  "için",
]);

export function findCanonicalCategoryClaim(
  text: string,
): CanonicalCategoryClaim | null {
  const parts = words(String(text ?? ""));
  /* Kuyruk sözcükleri sondan atılır; ortadaki metin olduğu gibi kalır. */
  let end = parts.length;
  while (
    end > 0 &&
    CLAIM_TAIL.has(foldAmbiguityPhrase(parts[end - 1] ?? ""))
  ) {
    end--;
  }
  const core = parts.slice(0, end);
  if (!core.length) return null;

  const MAX_SPAN = Math.min(core.length, 7);
  for (let size = MAX_SPAN; size >= 1; size--) {
    for (let start = 0; start + size <= core.length; start++) {
      const phrase = core.slice(start, start + size).join(" ");
      const rule = ambiguityRuleFor(phrase);
      if (rule?.policy === "FORBIDDEN_ROUTE") continue;
      const { nodes: rawNodes } = listTaxonomyAliasCandidates(phrase);
      if (!rawNodes.length) continue;
      /**
       * KISALTMA KORUMASI: "EV" (elektrikli araç) gibi kısa, tamamı büyük
       * harf alias'lar yalnız kullanıcı da BÜYÜK harf yazdıysa kanıt
       * sayılır. Küçük harf "ev" sözcüğü bir kısaltma değil, Türkçe
       * "ev"dir; kısaltma alias'ı üzerinden otomotive taşınamaz (ölçüldü:
       * "Ev arıyorum" emlak yerine belirsizliğe düşüyordu). Kural ada özel
       * değildir: her ≤4 harfli tamamı-büyük alias için geçerlidir.
       */
      const phraseIsUpper = phrase === phrase.toLocaleUpperCase("tr-TR");
      /**
       * YALNIZ YAPRAK DÜĞÜMLER İDDİA ÜRETİR. "Danışmanlık", "Bakım" gibi
       * GROUP/SUBCATEGORY aile adları tek başına kategori kanıtı değildir:
       * ölçülen regresyon — "SAP danışmanlık arıyorum" platform alanı
       * (technology, TENTATIVE) yerine services SUBCATEGORY adına
       * kilitleniyor, onaysız platform sözleşmesi (I26e) çiğneniyordu.
       * Yaprak adı ("Detaylı ekspertiz", "Klima gaz dolumu") ise ürünün
       * kendisidir ve kategoriyi taşır.
       */
      const nodes = rawNodes.filter((n) => {
        if (
          n.nodeType === "CATEGORY" ||
          n.nodeType === "SUBCATEGORY" ||
          n.nodeType === "GROUP"
        ) {
          return false;
        }
        return true;
      }).filter((n) => {
        const foldedPhrase = foldAmbiguityPhrase(phrase);
        const nonAcronymMatch =
          foldAmbiguityPhrase(n.canonicalName) === foldedPhrase ||
          (n.searchTerms ?? []).some(
            (t) => foldAmbiguityPhrase(t) === foldedPhrase,
          ) ||
          (n.aliases ?? []).some(
            (al) =>
              foldAmbiguityPhrase(al) === foldedPhrase &&
              !(al.length <= 4 && al === al.toLocaleUpperCase("tr-TR")),
          );
        if (nonAcronymMatch) return true;
        const acronymMatch = (n.aliases ?? []).some(
          (al) =>
            foldAmbiguityPhrase(al) === foldedPhrase &&
            al.length <= 4 &&
            al === al.toLocaleUpperCase("tr-TR"),
        );
        return acronymMatch ? phraseIsUpper : true;
      });
      if (!nodes.length) continue;
      const cats = [...new Set(nodes.map((n) => n.categoryId))].sort();
      /**
       * TEK SÖZCÜKLÜK KANIT, ÇOK SÖZCÜKLÜ İFADEYİ TAŞIYAMAZ (2026-08-31).
       *
       * Ölçülen regresyonlar: "Tekerlekli sandalye" (sağlık) tek sözcüklük
       * "sandalye" kanıtıyla mobilyaya, "koltuk destek mekanizması" tek
       * sözcüklük "koltuk" belirsizliğiyle boşluğa düşüyordu. Türkçe ad
       * tamlamasında niteleyici anlamı değiştirir; iddia ya ÇOK sözcüklü
       * kanonik kanıt taşımalı ya da ifadenin TAMAMI olmalıdır. Tek
       * sözcüklük iddia yalnız çekirdek metin de tek sözcükse geçerlidir;
       * aksi hâlde karar skorlayıcıya kalır.
       */
      const claimCoversCore = size === core.length;
      if (size === 1 && !claimCoversCore) continue;
      if (cats.length === 1) {
        const resolved = resolveTaxonomyAlias(phrase)?.node ?? null;
        const node =
          resolved && nodes.some((n) => n.id === resolved.id)
            ? resolved
            : nodes[0]!;
        return {
          kind: "unique",
          categoryId: cats[0]!,
          node,
          phrase,
          span: size,
        };
      }
      if (rule?.policy === "ALLOWED_CLARIFICATION" && claimCoversCore) {
        return {
          kind: "ambiguous",
          categoryIds: rule.categoryIds,
          phrase,
          span: size,
        };
      }
      /* Çok sahipli ve politikasız: bu ifade karar üretemez. Daha kısa bir
         alt ifade tek sahipli olabilir; tarama sürer. Çakışmanın kendisi
         POLICY kapısında zaten kırmızıdır. */
    }
  }
  return null;
}
