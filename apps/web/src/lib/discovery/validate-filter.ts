/**
 * Validate user-controlled canonical discovery filters (SavedSearch / Alert / Explore).
 */

import { getTaxonomyNode } from "@/lib/taxonomy";
import {
  INTERNAL_EVIDENCE_ATTRIBUTE_KEYS,
  isRequestUnderstandingSnapshot,
  normalizeSnapshotInternalEvidence,
  type InternalEvidenceSnapshot,
} from "@/lib/request/understanding-snapshot";

import {
  authorityRank,
  type Authority,
} from "@/lib/request-understanding/provenance";

import {
  DISCOVERY_FILTER_VERSION,
  DISCOVERY_PROJECTION_VERSION,
  type CanonicalDiscoveryFilter,
  type ProjectionAuthoritySurface,
  type RequestDiscoveryProjection,
} from "./types";

/**
 * OTORİTE HARİTASINA GİREMEYECEK ANAHTARLAR (D3d, 2026-08-27).
 *
 * `__proto__` / `constructor` / `prototype` bir alan adı DEĞİL, JavaScript
 * nesne modelinin kendi anahtarlarıdır. Bir JSON kolonundan gelip düz bir
 * nesneye yazıldıklarında okuma tarafında alan adı gibi sorgulanabilirler;
 * ölçüldü (2026-08-27): guard'dan önce okuma sınırı `constructor` ve
 * `prototype` için istemcinin yazdığı seviyeyi döndürüyordu.
 *
 * İç kanıt (`brandCandidate` / `brandEvidence`) ise kullanıcı beyanı değildir
 * ve D3c-b'den beri generic `attributes`/`constraints` torbalarına girmez;
 * aynı gerekçeyle otorite haritasında da yeri yoktur.
 *
 * KURAL BURADA DURUR çünkü hem OKUMA sınırı (`projectionAuthorityOf`) hem
 * YAZMA sınırı (`server-authority`) aynı elemeyi uygular ve iki kopya zamanla
 * sessizce ayrışırdı. Yazma sınırı bu modülden okur; ters yönde bağımlılık
 * YOKTUR.
 */
const BLOCKED_AUTHORITY_KEYS: readonly string[] = [
  "__proto__",
  "constructor",
  "prototype",
];

/** Bu anahtar generic otorite haritasında YAŞAYABİLİR Mİ? */
export function isProjectionAuthorityKeyAllowed(key: string): boolean {
  if (!key) return false;
  if (BLOCKED_AUTHORITY_KEYS.includes(key)) return false;
  return !(INTERNAL_EVIDENCE_ATTRIBUTE_KEYS as readonly string[]).includes(key);
}

const MAX_TAXONOMY_IDS = 40;
const MAX_ATTR_KEYS = 40;
const MAX_STRING_LEN = 120;
const MAX_ARRAY_LEN = 20;

export type FilterValidationResult =
  | { ok: true; filter: CanonicalDiscoveryFilter }
  | { ok: false; errors: string[] };

function cleanStr(value: unknown, max = MAX_STRING_LEN): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().slice(0, max);
  return v || null;
}

function cleanStrArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value.slice(0, MAX_ARRAY_LEN)) {
    const s = cleanStr(item);
    if (s) out.push(s);
  }
  return out;
}

function cleanTaxonomyIds(value: unknown): string[] {
  const ids = cleanStrArray(value).slice(0, MAX_TAXONOMY_IDS);
  return ids.filter((id) => {
    if (!id.startsWith("tax:")) return false;
    return Boolean(getTaxonomyNode(id));
  });
}

/**
 * Parse + validate CanonicalDiscoveryFilter from unknown JSON.
 */
export function validateCanonicalDiscoveryFilter(
  raw: unknown,
): FilterValidationResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { ok: false, errors: ["Filter boş veya geçersiz."] };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.kind != null && obj.kind !== "canonical_discovery_filter") {
    return { ok: false, errors: ["Bilinmeyen filter kind."] };
  }

  const version =
    typeof obj.version === "number" ? obj.version : DISCOVERY_FILTER_VERSION;
  if (version !== DISCOVERY_FILTER_VERSION) {
    errors.push(`Desteklenmeyen filter version: ${version}`);
  }

  const taxonomyNodeIds = cleanTaxonomyIds(obj.taxonomyNodeIds);
  if (
    Array.isArray(obj.taxonomyNodeIds) &&
    obj.taxonomyNodeIds.length > 0 &&
    taxonomyNodeIds.length === 0
  ) {
    errors.push("Geçersiz taxonomy ID.");
  }

  let primaryLeafId: string | null | undefined;
  if (obj.primaryLeafId === null) primaryLeafId = null;
  else if (obj.primaryLeafId !== undefined) {
    const id = cleanStr(obj.primaryLeafId);
    if (id && getTaxonomyNode(id)) primaryLeafId = id;
    else if (id) errors.push("Geçersiz primaryLeafId.");
  }

  const leafExact = Boolean(obj.leafExact);

  const entityRefs: Record<string, string> = {};
  if (obj.entityRefs && typeof obj.entityRefs === "object") {
    for (const [k, v] of Object.entries(
      obj.entityRefs as Record<string, unknown>,
    ).slice(0, MAX_ATTR_KEYS)) {
      const key = cleanStr(k, 80);
      const val = cleanStr(v);
      if (key && val) entityRefs[key] = val;
    }
  }

  const attributes: Record<string, string> = {};
  if (obj.attributes && typeof obj.attributes === "object") {
    for (const [k, v] of Object.entries(
      obj.attributes as Record<string, unknown>,
    ).slice(0, MAX_ATTR_KEYS)) {
      const key = cleanStr(k, 80);
      const val = cleanStr(v);
      if (key && val) attributes[key] = val;
    }
  }

  const excluded: Record<string, string[]> = {};
  const preferred: Record<string, string[]> = {};
  const mustIncludes: Record<string, string[]> = {};
  const ranges: CanonicalDiscoveryFilter["ranges"] = {};

  const packMap = (
    source: unknown,
    target: Record<string, string[]>,
  ) => {
    if (!source || typeof source !== "object") return;
    for (const [k, v] of Object.entries(
      source as Record<string, unknown>,
    ).slice(0, MAX_ATTR_KEYS)) {
      const key = cleanStr(k, 80);
      if (!key) continue;
      const arr = cleanStrArray(v);
      if (arr.length) target[key] = arr;
    }
  };

  packMap(obj.excluded, excluded);
  packMap(obj.preferred, preferred);
  packMap(obj.mustIncludes, mustIncludes);

  // Nested constraints from Phase 2 filter contract
  if (obj.constraints && typeof obj.constraints === "object") {
    const c = obj.constraints as Record<string, unknown>;
    packMap(c.exclude, excluded);
    packMap(c.preferred, preferred);
    packMap(c.include, mustIncludes);
    if (c.range && typeof c.range === "object") {
      for (const [k, v] of Object.entries(
        c.range as Record<string, unknown>,
      ).slice(0, MAX_ATTR_KEYS)) {
        if (!v || typeof v !== "object") continue;
        const r = v as Record<string, unknown>;
        const min = typeof r.min === "number" ? r.min : undefined;
        const max = typeof r.max === "number" ? r.max : undefined;
        const unit = cleanStr(r.unit, 40) ?? undefined;
        if (min != null || max != null) {
          ranges[k] = { min, max, unit };
        }
      }
    }
  }

  if (obj.ranges && typeof obj.ranges === "object") {
    for (const [k, v] of Object.entries(
      obj.ranges as Record<string, unknown>,
    ).slice(0, MAX_ATTR_KEYS)) {
      if (!v || typeof v !== "object") continue;
      const r = v as Record<string, unknown>;
      const min = typeof r.min === "number" ? r.min : undefined;
      const max = typeof r.max === "number" ? r.max : undefined;
      const unit = cleanStr(r.unit, 40) ?? undefined;
      if (min != null || max != null) ranges[k] = { min, max, unit };
    }
  }

  let location: CanonicalDiscoveryFilter["location"];
  if (obj.location && typeof obj.location === "object") {
    const loc = obj.location as Record<string, unknown>;
    const city = cleanStr(loc.city, 80) ?? undefined;
    const district = cleanStr(loc.district, 80) ?? undefined;
    if (city || district) location = { city, district };
  }

  const urgency = obj.urgency === true ? true : undefined;

  if (errors.length) return { ok: false, errors };

  const filter: CanonicalDiscoveryFilter = {
    version: DISCOVERY_FILTER_VERSION,
    kind: "canonical_discovery_filter",
    taxonomyNodeIds: taxonomyNodeIds.length ? taxonomyNodeIds : undefined,
    primaryLeafId,
    leafExact: leafExact || undefined,
    entityRefs: Object.keys(entityRefs).length ? entityRefs : undefined,
    attributes: Object.keys(attributes).length ? attributes : undefined,
    mustIncludes: Object.keys(mustIncludes).length ? mustIncludes : undefined,
    excluded: Object.keys(excluded).length ? excluded : undefined,
    preferred: Object.keys(preferred).length ? preferred : undefined,
    ranges: Object.keys(ranges).length ? ranges : undefined,
    location,
    urgency,
  };

  return { ok: true, filter };
}

/**
 * TEK KANONİK LEGACY NORMALIZER — projection tarafı (D3c-b).
 *
 * D3c-b öncesi kayıtlarda iç kanıt anahtarları `attributes`/`constraints`
 * içinde durur ve bu parse sınırından geçen HER okuyucuya (workspace facts,
 * evaluateDiscoveryFilter, feed/personal/alert eşleşmeleri, routing
 * envelope) kullanıcı beyanı gibi görünürdü. Burada anahtarlar generic
 * torbalardan çıkarılır; değer, nested snapshot'ın tipli kanalı zaten
 * taşımıyorsa projection'ın tipli `internalEvidence` alanına taşınır (çift
 * veri yok). Girdi mutate edilmez; yeni şekil AYNI referansla geri döner.
 */
function normalizeProjectionInternalEvidence(
  projection: RequestDiscoveryProjection,
): RequestDiscoveryProjection {
  const understanding =
    projection.understanding &&
    isRequestUnderstandingSnapshot(projection.understanding)
      ? normalizeSnapshotInternalEvidence(projection.understanding)
      : projection.understanding;

  const legacyKeys = INTERNAL_EVIDENCE_ATTRIBUTE_KEYS.filter(
    (key) =>
      Boolean(projection.attributes?.[key]) ||
      Boolean(projection.constraints?.[key]),
  );
  if (legacyKeys.length === 0 && understanding === projection.understanding) {
    return projection;
  }

  const attributes = { ...projection.attributes };
  const constraints = { ...projection.constraints };
  const internalEvidence: Record<string, InternalEvidenceSnapshot> = {
    ...(projection.internalEvidence ?? {}),
  };
  for (const key of legacyKeys) {
    /* Parse güvenilmez istemci JSON'ına da uygulanır (request-schema,
     * create-request) — non-string değer throw ETMEMELİ, parse total kalır. */
    const rawAttr = attributes[key];
    const value =
      (typeof rawAttr === "string" ? rawAttr.trim() : "") ||
      (typeof constraints[key]?.value === "string"
        ? constraints[key]!.value!.trim()
        : "");
    delete attributes[key];
    delete constraints[key];
    const alreadyTyped =
      Boolean(internalEvidence[key]?.value) ||
      Boolean(understanding?.internalEvidence?.[key]?.value);
    if (value && !alreadyTyped) {
      internalEvidence[key] = { value };
    }
  }

  return {
    ...projection,
    attributes,
    constraints,
    ...(Object.keys(internalEvidence).length ? { internalEvidence } : {}),
    ...(understanding !== undefined ? { understanding } : {}),
  };
}

export function parseDiscoveryProjection(
  raw: unknown,
): RequestDiscoveryProjection | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.kind !== "discovery_projection") return null;
  if (obj.version !== DISCOVERY_PROJECTION_VERSION && obj.version !== 1) {
    return null;
  }
  if (!Array.isArray(obj.taxonomyNodeIds)) return null;
  return normalizeProjectionInternalEvidence(raw as RequestDiscoveryProjection);
}

/**
 * BİR PROJECTION DEĞERİNİN KAYNAĞINI OKUYAN TEK YARDIMCI (D3c).
 *
 * Tüketiciler kendi varsayılanını, kendi tip kontrolünü ya da kendi
 * "güvenilir mi" eşiğini kurmaz — hepsi buradan okur. Eşik gerektiğinde
 * kanonik `isAtLeastAuthority` kullanılır; burada ikinci bir merdiven yoktur.
 *
 * GÜVENLİ TARAF. `discoveryProjection` bir JSON kolonudur ve içine her şey
 * yazılmış olabilir: eski kayıtta alan hiç yoktur, bozuk kayıtta harita bir
 * dizi, bir metin ya da tanınmayan bir otorite adı olabilir. Hiçbiri THROW
 * ETMEZ ve hiçbiri güvenilir SAYILMAZ — hepsi `UNKNOWN` döner. Eksik ya da
 * doğrulanamayan metadata hiçbir koşulda `USER_EXPLICIT` veya `VERIFIED`
 * sayılamaz: o iki seviye firmalara yönlendirme sinyalidir.
 *
 * Otorite adının geçerliliği KANONİK rank tablosundan sorulur
 * (`authorityRank`); burada ikinci bir string allowlist'i tutulmaz.
 *
 * BU BİR YETKİ KAPISI DEĞİLDİR. Dönen değer AÇIKLAYICI provenance
 * metadata'sıdır; istemciden gelen bir projection'da da bulunabilir. Update
 * yolunun sunucu doğrulaması yapılmadan güvenlik kararı, izin kontrolü ya da
 * "bu değeri kullanıcı gerçekten söyledi" ispatı olarak kullanılamaz.
 */
export function projectionAuthorityOf(
  projection: RequestDiscoveryProjection | null | undefined,
  key: string,
  surface: ProjectionAuthoritySurface,
): Authority {
  /**
   * ANAHTAR GUARD'I (D3d). Yazma sınırı bu anahtarları zaten eler, ama okuma
   * sınırı yazma sınırından ÖNCE kaydedilmiş kayıtları da okur. İç kanıt
   * (`brandCandidate`/`brandEvidence`) firmalara dönük bir alan değildir ve
   * `__proto__`/`constructor`/`prototype` bir alan adı değil nesne modeli
   * anahtarıdır — ikisi de hiçbir koşulda güvenilir bir seviye döndüremez.
   * Eleme tek yerde tanımlıdır (`server-authority`), burada tekrarlanmaz.
   */
  if (!isProjectionAuthorityKeyAllowed(key)) return "UNKNOWN";

  const bag: unknown = projection?.fieldAuthority;
  if (!bag || typeof bag !== "object" || Array.isArray(bag)) return "UNKNOWN";

  const entry: unknown = (bag as Record<string, unknown>)[key];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return "UNKNOWN";
  }

  const raw: unknown = (entry as Record<string, unknown>)[surface];
  if (typeof raw !== "string") return "UNKNOWN";
  /* Kanonik tabloda karşılığı olmayan metin doğrulanamaz — güvenilir sayılmaz.
   * `authorityRank` bilinmeyen ad için çalışma anında `undefined` üretir. */
  if (!Number.isFinite(authorityRank(raw as Authority))) return "UNKNOWN";
  return raw as Authority;
}

/** True when filter carries any canonical (non-legacy-only) signal. */
export function hasCanonicalFilterSignal(
  filter: CanonicalDiscoveryFilter | null | undefined,
): boolean {
  if (!filter) return false;
  return Boolean(
    filter.taxonomyNodeIds?.length ||
      filter.primaryLeafId ||
      filter.leafExact ||
      (filter.entityRefs && Object.keys(filter.entityRefs).length) ||
      (filter.mustIncludes && Object.keys(filter.mustIncludes).length) ||
      (filter.excluded && Object.keys(filter.excluded).length) ||
      (filter.ranges && Object.keys(filter.ranges).length) ||
      (filter.attributes && Object.keys(filter.attributes).length),
  );
}
