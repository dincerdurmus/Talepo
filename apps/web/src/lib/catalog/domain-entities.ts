/**
 * TİPLİ KANONİK ALAN VARLIKLARI — "bu ad ne tür bir varlıktır ve hangi
 * uzmanlık alanına aittir?" sorusunun tek yetkili cevabı (1J).
 *
 * NEDEN AYRI BİR TİP: `ai/parser/brand-catalog.ts` içindeki `BrandEntry`
 * yalnız MARKA taşır ve tüketicileri onu marka olarak kullanır — ölçüldü:
 *   - `product-identity/brand-extraction.ts` → `identity.brand`
 *   - `request-composer/build-state.ts`      → `fields.brand`
 *   - `request-brain/request-summary.ts`     → kullanıcıya "Marka" etiketi
 *   - `matching-v3/identity.ts`              → `brandHit`, tedarikçi eşleşmesi
 *   - `matching-v3/scoring/score-candidate.ts` → "Marka: X" eşleşme gerekçesi
 * WordPress'i ya da CNC'yi oraya yazmak onları kullanıcı ekranında MARKA
 * gibi gösterir ve eşleşmede marka kanıtı sayar. Doğru olan varlığın TÜRÜNÜ
 * korumaktır.
 *
 * BU MODÜL PARALEL BİR KATALOG DEĞİLDİR. Tip sözleşmesi mevcut katalog
 * katmanından alınır (`CatalogDomainId`, `CatalogConfidence`,
 * `CatalogEntityHit`); marka listeleri hâlâ `brand-catalog.ts`in yetkisidir
 * ve buraya kopyalanmaz. Burada YALNIZ hiçbir mevcut kaynakta karşılığı
 * OLMAYAN varlıklar durur (ölçüldü: WordPress, SAP, Shopify, Logo Yazılım ve
 * CNC tezgâhı ne `brand-catalog` listelerinde ne de 2151 düğümlük kanonik
 * taksonomide geçiyor).
 */
import type {
  CatalogConfidence,
  CatalogDomainId,
  CatalogEntityHit,
} from "./types";

/**
 * Varlık türleri.
 *
 * `BRAND`, `PRODUCT_FAMILY` ve `PRODUCT_TYPE` mevcut adlandırmalardan gelir
 * (`knowledge/types.ts` → `BrowseNodeKind`: "brand", "product_family",
 * "product_type"). `PLATFORM` ve `MACHINE_TYPE` mevcut hiçbir sözlükte
 * karşılığı olmadığı için eklendi: bir platform üretici markası değildir,
 * bir makine türü de marka değildir.
 */
export type DomainEntityType =
  | "BRAND"
  | "PLATFORM"
  | "SOFTWARE_SUITE"
  | "PRODUCT_FAMILY"
  | "PRODUCT_TYPE"
  | "MACHINE_TYPE";

export type DomainEntityProvenance = {
  /** `knowledge/types.ts` → KnowledgeSourceType ile aynı sözcük dağarcığı. */
  sourceType: "AI_INFERRED" | "INTERNAL_AUDIT" | "TRUSTED_DATASET";
  sourceName: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  /**
   * KÜRASYON DURUMU — çalışma zamanında OKUNUR, ölü metadata değildir (1K).
   *
   *   PENDING_CURATION : yalnız aday. Alan ADAYI ve kanıt üretir; tek başına
   *                      CONFIDENT kategori ya da doğrulanmış routing kanıtı
   *                      ÜRETEMEZ.
   *   CURATOR_APPROVED : kurucu tek tek doğruladı; güçlü kanıt olabilir.
   *   REJECTED         : yanlış bulundu; hiçbir kanıt üretemez.
   *   DEPRECATED       : artık geçerli değil; hiçbir kanıt üretemez.
   */
  verificationStatus:
    | "PENDING_CURATION"
    | "CURATOR_APPROVED"
    | "REJECTED"
    | "DEPRECATED";
};

export type DomainEntity = {
  /** `<tür>:<slug>` — çakışma denetimi bunun üzerinden yapılır. */
  canonicalId: string;
  label: string;
  /** Küçük harfe katlanmış, TAM JETON olarak eşleşen adlar. */
  aliases: string[];
  entityType: DomainEntityType;
  /** Kanonik taksonominin kök kategori kimliği. */
  domainCategoryId: CatalogDomainId;
  provenance: DomainEntityProvenance;
  /**
   * ÇAKIŞMA KORUMASI — alias tek başına kanıt sayılmaz.
   *
   * `caseSensitiveAliases`: yalnız kullanıcının yazdığı BÜYÜK harfli biçim
   * sayılır. "SAP" bir yazılım firmasıdır ama "sap" Türkçede sıradan bir
   * addır; küçük harfli geçiş kanıt üretmez.
   *
   * `requiresContext`: adın yanında bu kavramlardan biri geçmelidir. "Logo"
   * hem bir yazılım firmasıdır hem de grafik tasarım nesnesidir; yazılım
   * bağlamı yoksa varlık tanınmaz.
   */
  caseSensitiveAliases?: string[];
  requiresContext?: string[];
};

/**
 * SEED KAYITLARI — kürasyon BEKLİYOR.
 *
 * Beş kaydın hiçbiri kurucu tarafından tek tek onaylanmadı; `provenance`
 * bunu açıkça söyler (`AI_INFERRED` / `PENDING_CURATION`). Kayıtlar yalnız
 * ALAN kanıtı üretir; kesin marka iddiası taşımazlar.
 */
export const DOMAIN_ENTITIES: readonly DomainEntity[] = [
  {
    canonicalId: "platform:wordpress",
    label: "WordPress",
    aliases: ["wordpress", "word press"],
    entityType: "PLATFORM",
    domainCategoryId: "technology",
    provenance: {
      sourceType: "AI_INFERRED",
      sourceName: "talepo-1j-seed",
      confidence: "HIGH",
      verificationStatus: "PENDING_CURATION",
    },
  },
  {
    canonicalId: "platform:shopify",
    label: "Shopify",
    aliases: ["shopify"],
    entityType: "PLATFORM",
    domainCategoryId: "technology",
    provenance: {
      sourceType: "AI_INFERRED",
      sourceName: "talepo-1j-seed",
      confidence: "HIGH",
      verificationStatus: "PENDING_CURATION",
    },
  },
  {
    canonicalId: "software-suite:sap",
    label: "SAP",
    aliases: [],
    // "sap" Türkçede tutamak/gövde demektir — yalnız büyük harfli yazım sayılır.
    caseSensitiveAliases: ["SAP"],
    entityType: "SOFTWARE_SUITE",
    domainCategoryId: "technology",
    provenance: {
      sourceType: "AI_INFERRED",
      sourceName: "talepo-1j-seed",
      confidence: "MEDIUM",
      verificationStatus: "PENDING_CURATION",
    },
  },
  {
    canonicalId: "software-suite:logo-yazilim",
    label: "Logo Yazılım",
    aliases: ["logo yazılımı", "logo yazilimi", "logo yazılım", "logo yazilim", "logo"],
    // "logo" bir grafik tasarım nesnesidir; yazılım bağlamı yoksa varlık değil.
    requiresContext: [
      "yazılım",
      "yazilim",
      "erp",
      "muhasebe",
      "e-fatura",
      "e fatura",
      "efatura",
      "ticari program",
      "ön muhasebe",
      "on muhasebe",
    ],
    entityType: "SOFTWARE_SUITE",
    domainCategoryId: "technology",
    provenance: {
      sourceType: "AI_INFERRED",
      sourceName: "talepo-1j-seed",
      confidence: "MEDIUM",
      verificationStatus: "PENDING_CURATION",
    },
  },
  {
    canonicalId: "machine-type:cnc-tezgahi",
    label: "CNC tezgâhı",
    aliases: ["cnc tezgâhı", "cnc tezgahı", "cnc tezgahi", "cnc tezgah", "cnc"],
    entityType: "MACHINE_TYPE",
    domainCategoryId: "machinery",
    provenance: {
      sourceType: "AI_INFERRED",
      sourceName: "talepo-1j-seed",
      confidence: "HIGH",
      verificationStatus: "PENDING_CURATION",
    },
  },
];

/** Türkçe katlama — `foldRoleToken` ile aynı kural, katalog katmanı kopyası. */
function fold(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u");
}

/**
 * Bağlam kavramı araması — Türkçe ek alabilir.
 *
 * "yazılım" bağlamı "Logo yazılımı için…" cümlesinde EKLİ geçer. Bu yüzden
 * bağlam terimleri sözcük BAŞINDA aranır, tam jeton olarak değil. Varlık
 * ADLARI için bu gevşeklik KULLANILMAZ — orada tam jeton şarttır, yoksa
 * "logosu" da "logo" sayılırdı.
 */
function containsContextTerm(haystack: string, term: string): boolean {
  const t = term.trim();
  if (!t) return false;
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}`, "u").test(haystack);
}

function containsToken(haystack: string, needle: string): boolean {
  const n = needle.trim();
  if (!n) return false;
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "u").test(
    haystack,
  );
}

/**
 * Metinde tipli bir alan varlığı geçiyor mu?
 *
 * Eşleşme TAM JETON üzerindedir: "kürek sapı" içindeki "sapı" jetonu "sap"
 * değildir, "şirket logosu" içindeki "logosu" jetonu "logo" değildir. Buna
 * ek olarak büyük harf ve bağlam koşulları uygulanır.
 *
 * En uzun alias kazanır: "cnc tezgâhı" varsa yalnız "cnc" seçilmez.
 */
export function findDomainEntity(
  text: string,
): CatalogEntityHit<DomainEntity> | null {
  const raw = String(text ?? "");
  if (!raw.trim()) return null;
  const folded = fold(raw);
  let best: { entity: DomainEntity; alias: string; cased: boolean } | null = null;

  for (const entity of DOMAIN_ENTITIES) {
    // Reddedilmiş / kullanımdan kaldırılmış kayıt hiç aranmaz.
    if (domainEntityEvidenceStrength(entity) === "NONE") continue;
    if (entity.requiresContext?.length) {
      const hasContext = entity.requiresContext.some((c) =>
        containsContextTerm(folded, fold(c)),
      );
      if (!hasContext) continue;
    }
    for (const alias of entity.caseSensitiveAliases ?? []) {
      if (!containsToken(raw, alias)) continue;
      if (!best || alias.length > best.alias.length) {
        best = { entity, alias, cased: true };
      }
    }
    for (const alias of entity.aliases) {
      if (!containsToken(folded, fold(alias))) continue;
      if (!best || fold(alias).length > best.alias.length) {
        best = { entity, alias: fold(alias), cased: false };
      }
    }
  }

  if (!best) return null;
  const confidence: CatalogConfidence =
    best.entity.provenance.confidence === "HIGH" ? "high" : "medium";
  return {
    id: best.entity.canonicalId,
    label: best.entity.label,
    confidence,
    matchMode: best.cased ? "exact" : "alias",
    entity: best.entity,
  };
}

export type DomainEntityEvidenceStrength = "VERIFIED" | "CANDIDATE" | "NONE";

/**
 * KAYDIN KANIT GÜCÜ — kürasyon durumundan türetilir (1K).
 *
 * Ölçülen kusur: `verificationStatus` beş kayıtta da yazılıydı ama hiçbir
 * yerde okunmuyordu; `AI_INFERRED / PENDING_CURATION` bir kayıt
 * `technology / CONFIDENT / 0.8` üretiyordu. Kanıt gücü artık YALNIZ
 * kürasyon durumundan gelir — verinin kendi güven öz-beyanı bir kaydı
 * onaylanmış yapamaz.
 */
export function domainEntityEvidenceStrength(
  entity: Pick<DomainEntity, "provenance">,
): DomainEntityEvidenceStrength {
  switch (entity.provenance.verificationStatus) {
    case "CURATOR_APPROVED":
      return "VERIFIED";
    case "PENDING_CURATION":
      return "CANDIDATE";
    default:
      // REJECTED / DEPRECATED — routing kanıtı olamaz.
      return "NONE";
  }
}

/**
 * Metinde bu varlığın HANGİ adı geçiyor? (1K)
 *
 * `findDomainEntity` kanonik etiketi döner ("Logo Yazılım"); kullanıcı ise
 * "Logo e-fatura kurulumu" yazmış olabilir. Profesyonel metni kullanıcının
 * kendi ifadesinden kurabilmek için EŞLEŞEN ad gerekir. En uzun eşleşme
 * kazanır ki "cnc tezgâhı" varken yalnız "cnc" seçilmesin.
 */
export function matchDomainEntityAlias(
  text: string,
  entity: DomainEntity,
): string | null {
  const raw = String(text ?? "");
  if (!raw.trim()) return null;
  const folded = fold(raw);
  let best: string | null = null;
  for (const alias of entity.caseSensitiveAliases ?? []) {
    if (containsToken(raw, alias) && (!best || alias.length > best.length)) {
      best = alias;
    }
  }
  for (const alias of entity.aliases) {
    if (containsToken(folded, fold(alias)) && (!best || alias.length > best.length)) {
      best = alias;
    }
  }
  return best;
}

/** Bu varlık türü kullanıcıya "Marka" olarak gösterilebilir mi? */
export function isBrandLikeEntityType(type: DomainEntityType): boolean {
  return type === "BRAND";
}

/** Kanonik alan kimlikleri — sapma denetimi için. */
export function listDomainEntityCategoryIds(): CatalogDomainId[] {
  return [...new Set(DOMAIN_ENTITIES.map((e) => e.domainCategoryId))];
}
