/**
 * ALAN VARLIĞI CEPHESİ — tipli varlık otoritesinin TEK giriş noktası (1K).
 *
 * Bağımsız denetimde bulunan kusur: `domain-entities.ts` üç production
 * dosyası tarafından DOĞRUDAN import ediliyordu; kayıt defterine kayıtlı
 * değildi, `catalog/index.ts`ten dışa açılmıyordu ve marka kataloğu ile
 * kanonik taksonomiyi SESSİZCE yeniyordu. Kaynağın doğru olması onu yetkili
 * yapmaz — yetki tek kapıdan geçmelidir.
 *
 * Bu cephe üç şeyi yapar:
 *   1) Tipli varlık aramasını tek yerde toplar (`resolveDomainEntity`).
 *   2) ÖNCELİK sözleşmesini açıkça yazar (`DOMAIN_ENTITY_PRECEDENCE`).
 *   3) Aynı span için başka bir kaynak FARKLI bir anlam iddia ediyorsa
 *      sessizce taraf tutmaz: sonuç `AMBIGUOUS` olur ve çağıran taraf
 *      kesinlik üretemez.
 *
 * Otomotiv odaklı `CatalogDomainProvider` sözleşmesi bilerek ZORLANMADI:
 * o arayüz indeks sahipliği ve `ensureReady` üzerine kuruludur; tipli varlık
 * araması durumsuzdur. Ortak nokta tip sözleşmesidir (`CatalogEntityHit`,
 * `CatalogDomainId`, `CatalogConfidence`).
 */
import { findAnyCatalogBrand } from "@/lib/ai/parser/brand-catalog";
import { listTaxonomyAliasCandidates } from "@/lib/taxonomy/registry";

import {
  domainEntityEvidenceStrength,
  findDomainEntity,
  matchDomainEntityAlias,
  isBrandLikeEntityType,
  type DomainEntity,
  type DomainEntityEvidenceStrength,
  type DomainEntityType,
} from "./domain-entities";

/**
 * ÖNCELİK SÖZLEŞMESİ — sessiz bir tesadüf değil, yazılı bir karar.
 *
 * Tipli varlık kaynağı önce sorulur, çünkü orada duran adlar (platform,
 * yazılım ailesi, makine türü) diğer iki kaynakta TANIM GEREĞİ bulunmaz:
 * taksonomi marka/platform adı barındırmaz, marka kataloğu yalnız üretici
 * markası taşır. Çakışma bir istisna değil, bir HATA sinyalidir; bu yüzden
 * çakışma hâlinde kazanan seçilmez.
 */
export const DOMAIN_ENTITY_PRECEDENCE = [
  "catalog-entity",
  "taxonomy",
  "brand-catalog",
] as const;

export type DomainEntityResolution = {
  status: "RESOLVED" | "AMBIGUOUS" | "NONE";
  entity?: DomainEntity;
  entityType?: DomainEntityType;
  canonicalLabel?: string;
  domainId?: string;
  matchedAlias?: string;
  /** Kürasyon durumundan türeyen kanıt gücü. */
  evidenceStrength: DomainEntityEvidenceStrength;
  /** Aynı adı sahiplenen diğer kaynaklar — boş değilse karar verilmez. */
  conflicts: string[];
};

const NONE: DomainEntityResolution = {
  status: "NONE",
  evidenceStrength: "NONE",
  conflicts: [],
};

/**
 * Verilen metinde tipli bir alan varlığı var mı?
 *
 * Çakışma denetimi EŞLEŞEN AD üzerinden yapılır, cümlenin tamamı üzerinden
 * değil: "Arçelik bulaşık makinesi" cümlesinde marka kataloğu elbette bir
 * marka bulur, ama tipli varlık orada hiçbir ad sahiplenmemiştir.
 */
export function resolveDomainEntity(text: string): DomainEntityResolution {
  const hit = findDomainEntity(text);
  if (!hit) return NONE;

  const strength = domainEntityEvidenceStrength(hit.entity);
  if (strength === "NONE") return NONE;

  // Çakışma denetimi ve metin kurtarma EŞLEŞEN ad üzerinden yapılır.
  const alias = matchDomainEntityAlias(text, hit.entity) ?? hit.label;
  const conflicts: string[] = [];

  const brandHit = findAnyCatalogBrand(alias);
  if (brandHit) conflicts.push(`brand-catalog:${brandHit}`);

  for (const node of listTaxonomyAliasCandidates(alias).nodes) {
    if (node.categoryId !== hit.entity.domainCategoryId) {
      conflicts.push(`taxonomy:${node.nodeType}@${node.categoryId}`);
    }
  }

  if (conflicts.length) {
    // Sessizce taraf tutulmaz: iki kaynak aynı adı farklı anlamda kullanıyor.
    return {
      status: "AMBIGUOUS",
      entity: hit.entity,
      entityType: hit.entity.entityType,
      canonicalLabel: hit.entity.label,
      domainId: hit.entity.domainCategoryId,
      matchedAlias: alias,
      evidenceStrength: "CANDIDATE",
      conflicts,
    };
  }

  return {
    status: "RESOLVED",
    entity: hit.entity,
    entityType: hit.entity.entityType,
    canonicalLabel: hit.entity.label,
    domainId: hit.entity.domainCategoryId,
    matchedAlias: alias,
    evidenceStrength: strength,
    conflicts: [],
  };
}

/**
 * Bu jeton kullanıcıya "Marka" olarak gösterilebilir mi?
 *
 * Platform, yazılım ailesi ve makine türü üretici markası DEĞİLDİR; marka
 * alanı hem kullanıcı ekranında hem Matching V3'te marka kanıtı sayılır.
 */
export function isNonBrandDomainEntity(token: unknown): boolean {
  const value = String(token ?? "").trim();
  if (!value) return false;
  const resolution = resolveDomainEntity(value);
  if (resolution.status === "NONE" || !resolution.entityType) return false;
  return !isBrandLikeEntityType(resolution.entityType);
}
