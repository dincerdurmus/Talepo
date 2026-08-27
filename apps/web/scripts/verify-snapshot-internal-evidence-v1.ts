/**
 * SNAPSHOT İÇ KANIT AYRIMI V1 — D3c-b (2026-08-27).
 *
 * ÖLÇTÜĞÜ SÖZLEŞME. Talepo'nun kendi çıkardığı marka ipuçları
 * (`brandCandidate`, `brandEvidence`) anlama katmanının İÇ MUHASEBESİDİR;
 * kullanıcı beyanı değildir. Bu değerler:
 *   - `snapshot.attributes` içinde kullanıcı attribute'u gibi DURAMAZ,
 *   - `projection.attributes` / `projection.constraints` içine GİREMEZ,
 *   - routing envelope'un genel `attributes` torbasına KARIŞAMAZ,
 *   - `payload.fields` yayın torbasına ve soru adaylarına ULAŞAMAZ,
 *   - ama KAYBOLAMAZ: tipli `internalEvidence` kanalında, mevcut kanonik
 *     provenance/source/confidence bilgisiyle birlikte DURUR ve anlama
 *     katmanındaki (`understanding.attributes`) asıl kayıt değişmez —
 *     `compose-text` çapası oradan okur.
 *
 * ÜRETİM MANTIĞI KOPYALANMAZ. Snapshot `buildPublishUnderstandingSnapshot`,
 * projection `buildDiscoveryProjectionFromState`, envelope
 * `buildRequestRoutingEnvelope`, torba `buildPublishFieldValues`, soru
 * adayları `filterRenderableCandidates` ile üretimden ölçülür; sınıflandırma
 * kanonik merdivenden (`classifyAnswerAuthority`) okunur, ikinci merdiven
 * kurulmaz. İç kanıt anahtar kümesi fixture kimliklerinden türetilir.
 *
 * DONDURULMUŞ TABAN. 36 kimlik (20 INFERRED brandCandidate, 9 INFERRED
 * brandEvidence, 7 VERIFIED brandEvidence) `fixtures/
 * snapshot-internal-evidence-v1` içinde bağımsız veri otoritesi olarak
 * donduruldu; karşılaştırma iki yönlü ve sınıf duyarlıdır. Görev brief'inin
 * `home-06 NOT_MEASURED=1` beklentisi ölçümle doğrulanmadı — kimlik
 * deterministik ölçülüyor; NOT_MEASURED dürüstçe 0 raporlanır (fixture'daki
 * dürüstlük notuna bak).
 *
 * ESKİ ŞEKİL. D3c-b öncesi kayıtlar iç kanıtı `attributes` içinde taşır.
 * Parser eski şekli kabul etmeli, envelope eski anahtarı tipli kanala
 * ayırmalı ve genel torbada bırakmamalı. Migration YOKTUR — snapshot ve
 * projection JSON kolonlarıdır.
 *
 * SALT-OKUNUR: veritabanı yazımı ve ağ çağrısı yapılmaz; fixture dahil
 * hiçbir dosya yeniden yazılmaz.
 */

import fs from "node:fs";
import path from "node:path";

import { CATEGORY_COVERAGE_V1 } from "./fixtures/category-coverage-v1";
import {
  BASELINE_INFERRED_BRAND_CANDIDATES,
  BASELINE_INFERRED_BRAND_EVIDENCE,
  BASELINE_VERIFIED_BRAND_EVIDENCE,
  FALSE_BRAND_CANDIDATE_CANARY,
  LEGACY_PROJECTION_SAMPLE,
  LEGACY_SNAPSHOT_SAMPLE,
} from "./fixtures/snapshot-internal-evidence-v1";
import { productionInputs } from "./lib/talep-production-inputs-v1";
import { syncFromText } from "../src/lib/request-composer";
import { resolveHybridQuestions } from "../src/lib/request-composer/questions";
import {
  buildPublishFieldValues,
  filterRenderableCandidates,
} from "../src/lib/request-composer/ui-helpers";
import {
  classifyAnswerAuthority,
  type Authority,
} from "../src/lib/request-composer/answer-authority";
import { buildDiscoveryProjectionFromState } from "../src/lib/discovery";
import {
  buildPublishUnderstandingSnapshot,
  withUnderstandingSnapshot,
} from "../src/lib/request/publish-understanding";
import { parseUnderstandingSnapshot } from "../src/lib/request/understanding-snapshot";
import { buildRequestRoutingEnvelope } from "../src/lib/matching-v3/routing-envelope";
import {
  evaluateDiscoveryFilter,
  parseDiscoveryProjection,
} from "../src/lib/discovery";
import type { CanonicalDiscoveryFilter } from "../src/lib/discovery/types";
import { matchPersonalAgainstPreferences } from "../src/server/monetization/personal-matching-core";

/** Tipli iç kanıt girdisi — okunan şekil (yapısal, üretim tipini kopyalamaz). */
type EvidenceEntry = {
  value?: string;
  confidence?: number;
  provenance?: string;
  source?: string;
};

type EvidenceCarrier = {
  internalEvidence?: Record<string, EvidenceEntry | undefined>;
};

const BASELINE_BY_CLASS = {
  INFERRED_BRAND_CANDIDATE: BASELINE_INFERRED_BRAND_CANDIDATES,
  INFERRED_BRAND_EVIDENCE: BASELINE_INFERRED_BRAND_EVIDENCE,
  VERIFIED_BRAND_EVIDENCE: BASELINE_VERIFIED_BRAND_EVIDENCE,
} as const;

const BASELINE_ALL: readonly string[] = [
  ...BASELINE_INFERRED_BRAND_CANDIDATES,
  ...BASELINE_INFERRED_BRAND_EVIDENCE,
  ...BASELINE_VERIFIED_BRAND_EVIDENCE,
];

/** İç kanıt anahtarları fixture kimliklerinden türetilir — ikinci liste yok. */
const INTERNAL_KEYS = [...new Set(BASELINE_ALL.map((id) => id.split("/")[1]))]
  .filter((k): k is string => Boolean(k))
  .sort();

function classifyBaselineClass(key: string, authority: Authority): string {
  if (key === "brandCandidate" && authority === "INFERRED") {
    return "INFERRED_BRAND_CANDIDATE";
  }
  if (key === "brandEvidence" && authority === "INFERRED") {
    return "INFERRED_BRAND_EVIDENCE";
  }
  if (key === "brandEvidence" && authority === "VERIFIED") {
    return "VERIFIED_BRAND_EVIDENCE";
  }
  return `UNMAPPED:${key}:${authority}`;
}

type Row = {
  id: string;
  key: string;
  authority: Authority;
  baselineClass: string;
  value: string;
  snapshotAttributeLeak: boolean;
  projectionAttributeLeak: boolean;
  projectionConstraintLeak: boolean;
  envelopeAttributeLeak: boolean;
  payloadFieldLeak: boolean;
  questionCandidateLeak: boolean;
  snapshotEvidencePresent: boolean;
  snapshotProvenancePreserved: boolean;
  envelopeEvidencePresent: boolean;
  duplicated: boolean;
  /**
   * SNAPSHOT'SIZ YOL (create-request sunucu fallback'i, page.tsx
   * hybrid.state=null dalı): çıplak projection persist edilir. İç kanıt bu
   * yolda da tipli kanalda DURMALI — "taşı, silme" sözleşmesi snapshot'ın
   * eklenmesine bağlanamaz.
   */
  bareProjectionEvidencePresent: boolean;
  bareEnvelopeEvidencePresent: boolean;
  /** Persist edilen tam dokümanda anahtar TAM BİR tipli kanalda durur. */
  persistedSingleCopy: boolean;
};

type Measurement = {
  rows: Row[];
  violations: string[];
  userAttributeDropped: string[];
};

function measureScenario(scenarioId: string, input: string): Measurement {
  const rows: Row[] = [];
  const violations: string[] = [];
  const userAttributeDropped: string[] = [];

  const { state } = syncFromText(null, input);
  const inputs = productionInputs(state, input);
  const understandingAttrs = state.understanding.attributes as Record<
    string,
    | {
        value?: unknown;
        confidence?: number;
        provenance?: string;
        source?: string;
      }
    | undefined
  >;
  const attrsBefore = JSON.stringify(understandingAttrs);

  const projection = buildDiscoveryProjectionFromState(state);
  const snapshot = buildPublishUnderstandingSnapshot({
    understanding: state.understanding,
    userSelected: false,
    userChoice: null,
    confirmedFieldKeys: [],
    primarySlug: inputs.categoryId ?? null,
  });
  const full = withUnderstandingSnapshot(projection, snapshot);
  const envelope = buildRequestRoutingEnvelope({
    requestId: scenarioId,
    rawInput: input,
    categorySlug: inputs.categoryId ?? null,
    discoveryProjection: full,
  });

  const production = resolveHybridQuestions(state, inputs.options);
  const renderable = filterRenderableCandidates(
    inputs.renderInputWithout(production),
  );
  const renderableKeys = new Set(renderable.map((c) => c.fieldKey));

  const publishBag = buildPublishFieldValues({
    canonicalFields: state.fields,
    values: inputs.values,
    userTouchedKeys: [],
  });
  /* Üretim payload'ı yalnız görünür alanları torbadan okur (D3c-a AST kanıtı). */
  const visibleKeys = new Set(inputs.dynamicFields.map((f) => f.key));

  const snapshotEvidence = (snapshot as EvidenceCarrier).internalEvidence ?? {};
  const envelopeEvidence =
    (envelope as unknown as EvidenceCarrier).internalEvidence ?? {};

  /**
   * SNAPSHOT'SIZ (ÇIPLAK) PROJECTION YOLU. İki üretim dalı snapshot
   * eklemeden projection persist eder: sunucu yeniden kurulumu
   * (`create-request.ts`, istemci geçerli projection göndermediğinde) ve
   * `page.tsx`'in `hybrid.state == null` dalı (orada `withUnderstandingSnapshot`
   * null döndüğü için snapshot topyekûn düşer). Sözleşme "taşı, silme"
   * olduğuna göre iç kanıt bu yolda da tipli kanalda durmalıdır — aksi
   * hâlde ayrım, o dallarda sessiz silmeye dönüşür. Ölçüm DB gidiş-dönüşünü
   * JSON serileştirmesiyle taklit eder ve üretim okuma sınırından geçer.
   */
  const barePersisted = JSON.parse(
    JSON.stringify(projection),
  ) as unknown;
  const bareParsed = parseDiscoveryProjection(barePersisted);
  const bareEvidence =
    ((bareParsed ?? {}) as EvidenceCarrier).internalEvidence ?? {};
  const bareEnvelope = buildRequestRoutingEnvelope({
    requestId: `${scenarioId}-bare`,
    rawInput: input,
    categorySlug: inputs.categoryId ?? null,
    discoveryProjection: barePersisted,
  });
  const bareEnvelopeEvidence =
    (bareEnvelope as unknown as EvidenceCarrier).internalEvidence ?? {};

  /** Persist edilen tam doküman: iç kanıt TAM BİR tipli kanalda durmalı. */
  const fullPersisted = JSON.parse(JSON.stringify(full)) as unknown;
  const fullParsed = parseDiscoveryProjection(fullPersisted);
  const fullTopEvidence =
    ((fullParsed ?? {}) as EvidenceCarrier).internalEvidence ?? {};
  const fullNestedEvidence = fullParsed?.understanding
    ? (((fullParsed.understanding as unknown) as EvidenceCarrier)
        .internalEvidence ?? {})
    : {};

  for (const key of INTERNAL_KEYS) {
    const uv = understandingAttrs[key];
    const uvValue = uv?.value == null ? "" : String(uv.value).trim();
    const field = state.fields[key];
    if (!uvValue && !(field?.kind === "VALUE" && field.value?.trim())) continue;

    const id = `${scenarioId}/${key}`;
    const authority = classifyAnswerAuthority(field);
    const snapEntry = snapshotEvidence[key];
    const envEntry = envelopeEvidence[key];

    const snapshotProvenancePreserved = Boolean(
      snapEntry &&
        (snapEntry.value ?? "").trim() === uvValue &&
        (uv?.provenance == null || snapEntry.provenance === uv.provenance) &&
        (uv?.source == null || snapEntry.source === uv.source) &&
        (uv?.confidence == null ||
          Math.abs((snapEntry.confidence ?? -1) - uv.confidence) < 1e-9),
    );

    rows.push({
      id,
      key,
      authority,
      baselineClass: classifyBaselineClass(key, authority),
      value: uvValue,
      snapshotAttributeLeak: Boolean(snapshot.attributes[key]?.value),
      projectionAttributeLeak: Boolean(projection.attributes[key]),
      projectionConstraintLeak: Boolean(projection.constraints[key]),
      envelopeAttributeLeak: Boolean(envelope.attributes[key]),
      payloadFieldLeak:
        visibleKeys.has(key) && Boolean((publishBag[key] ?? "").trim()),
      questionCandidateLeak: renderableKeys.has(key),
      snapshotEvidencePresent: Boolean(
        snapEntry && (snapEntry.value ?? "").trim() === uvValue,
      ),
      snapshotProvenancePreserved,
      envelopeEvidencePresent: Boolean(
        envEntry && (envEntry.value ?? "").trim() === uvValue,
      ),
      duplicated: Boolean(snapshot.attributes[key]?.value && snapEntry),
      bareProjectionEvidencePresent: Boolean(
        (bareEvidence[key]?.value ?? "").trim() === uvValue && uvValue,
      ),
      bareEnvelopeEvidencePresent: Boolean(
        (bareEnvelopeEvidence[key]?.value ?? "").trim() === uvValue && uvValue,
      ),
      persistedSingleCopy:
        [
          (fullTopEvidence[key]?.value ?? "").trim() === uvValue,
          (fullNestedEvidence[key]?.value ?? "").trim() === uvValue,
        ].filter(Boolean).length === 1,
    });
  }

  /* Kullanıcı attribute kanaryası: iç kanıt DIŞI her anlama attribute'u
   * snapshot.attributes'ta durmaya devam etmeli — ayrım fazla süpürmemeli. */
  for (const [key, uv] of Object.entries(understandingAttrs)) {
    if (INTERNAL_KEYS.includes(key)) continue;
    const value = uv?.value == null ? "" : String(uv.value).trim();
    if (!value) continue;
    if (!snapshot.attributes[key]?.value) {
      userAttributeDropped.push(`${scenarioId}/${key}`);
    }
  }

  /* Kurucular anlama katmanını DEĞİŞTİRMEZ — compose-text çapası korunur. */
  if (JSON.stringify(understandingAttrs) !== attrsBefore) {
    violations.push(
      `${scenarioId}: yayın kurucuları understanding.attributes'u değiştirdi`,
    );
  }

  return { rows, violations, userAttributeDropped };
}

function measureAll(): Measurement {
  const out: Measurement = { rows: [], violations: [], userAttributeDropped: [] };
  for (const sc of CATEGORY_COVERAGE_V1) {
    const m = measureScenario(sc.id, sc.input);
    out.rows.push(...m.rows);
    out.violations.push(...m.violations);
    out.userAttributeDropped.push(...m.userAttributeDropped);
  }
  out.rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  out.violations.sort();
  out.userAttributeDropped.sort();
  return out;
}

/**
 * ESKİ ŞEKİL GERİYE UYUMLULUĞU — okuyucu sınırları ÜRETİM fonksiyonlarıyla
 * ölçülür. Sayılan okuyucuların HEPSİ `parseDiscoveryProjection` sınırından
 * geçer (envelope, discovery-workspace-query:146, opportunities-feed:228,
 * personal-matching:123, alert-matching:52, opportunity-hunter:66,
 * corporate-opportunity-center:297, inventory-matching:167,
 * personal-preference-candidates:104, panel/talepler:131,
 * request-schema:304); attribute/filtre beyni `evaluateDiscoveryFilter`dır
 * ve workspace facts alanı (`discovery-workspace-query.ts:192`) doğrudan
 * `projection.attributes`ı gösterir — o yüzden parse çıktısının temizliği
 * facts kapısının kendisidir.
 */
function checkLegacyShape(): {
  problems: string[];
  accepted: boolean;
  diverted: number;
  leftInAttributes: number;
  filterHits: number;
  personalHits: number;
  mutations: number;
} {
  const problems: string[] = [];
  let filterHits = 0;
  let personalHits = 0;
  let mutations = 0;

  /* Girdiler klonlanır; sondaki karşılaştırma mutasyonu yakalar. */
  const legacySnapshotInput = structuredClone(
    LEGACY_SNAPSHOT_SAMPLE,
  ) as unknown as Record<string, unknown>;
  const legacyProjectionInput = structuredClone({
    ...LEGACY_PROJECTION_SAMPLE,
    understanding: LEGACY_SNAPSHOT_SAMPLE,
  }) as unknown as Record<string, unknown>;
  const snapshotInputBefore = JSON.stringify(legacySnapshotInput);
  const projectionInputBefore = JSON.stringify(legacyProjectionInput);

  /* (L1) Parser eski şekli KABUL eder ve tipli kanala AYIRIR. */
  const parsedSnap = parseUnderstandingSnapshot(legacySnapshotInput);
  const accepted = parsedSnap != null;
  if (!accepted) {
    problems.push("legacy: parser eski şekil snapshot'ı reddetti");
  }
  const snapEvidence =
    ((parsedSnap ?? {}) as EvidenceCarrier).internalEvidence ?? {};
  for (const key of INTERNAL_KEYS) {
    const legacyValue =
      LEGACY_SNAPSHOT_SAMPLE.attributes[
        key as keyof typeof LEGACY_SNAPSHOT_SAMPLE.attributes
      ]?.value ?? null;
    if (!legacyValue) continue;
    if (parsedSnap?.attributes?.[key]?.value) {
      problems.push(
        `legacy: ${key} parse edilen snapshot'ta kullanıcı attribute'u olarak duruyor`,
      );
    }
    if ((snapEvidence[key]?.value ?? "").trim() !== legacyValue) {
      problems.push(
        `legacy: ${key} snapshot tipli iç kanıt kanalına ayrılmadı — değer kayboldu`,
      );
    }
  }

  /* (L2) Projection parse sınırı: workspace facts alanı (192) ve tüm
   * okuyucular bu çıktıyı okur — attributes/constraints temiz olmalı,
   * değer tipli kanalda durmalı. */
  const parsedProjection = parseDiscoveryProjection(legacyProjectionInput);
  if (!parsedProjection) {
    problems.push("legacy: parser eski şekil projection'ı reddetti");
  }
  const projectionEvidence =
    ((parsedProjection ?? {}) as EvidenceCarrier).internalEvidence ?? {};
  const nestedEvidence = parsedProjection?.understanding
    ? (((parsedProjection.understanding as unknown) as EvidenceCarrier)
        .internalEvidence ?? {})
    : {};
  let diverted = 0;
  let leftInAttributes = 0;
  for (const key of INTERNAL_KEYS) {
    const legacyValue =
      LEGACY_PROJECTION_SAMPLE.attributes[
        key as keyof typeof LEGACY_PROJECTION_SAMPLE.attributes
      ] ?? null;
    if (!legacyValue) continue;
    if (parsedProjection?.attributes?.[key]) {
      leftInAttributes += 1;
      problems.push(
        `legacy: ${key} parse edilen projection.attributes'ta (workspace facts yüzeyi) bırakıldı`,
      );
    }
    if (parsedProjection?.constraints?.[key]) {
      problems.push(
        `legacy: ${key} parse edilen projection.constraints'te bırakıldı`,
      );
    }
    const typedValue =
      (projectionEvidence[key]?.value ?? nestedEvidence[key]?.value ?? "").trim();
    if (typedValue === legacyValue) {
      diverted += 1;
    } else {
      problems.push(
        `legacy: ${key} tipli iç kanıt kanalına ayrılmadı — değer kayboldu`,
      );
    }
    if (projectionEvidence[key]?.value && nestedEvidence[key]?.value) {
      problems.push(
        `legacy: ${key} iki tipli kanalda birden — çift veri üretildi`,
      );
    }
  }
  if (parsedProjection?.attributes?.color !== "Siyah") {
    problems.push(
      "legacy: gerçek kullanıcı attribute'u (color) parse'ta düştü — ayrım fazla süpürdü",
    );
  }

  /* (L3) Filtre beyni: satıcı filtresi iç kanıt anahtarına EŞLEŞEMEZ
   * (workspace-query:147, opportunity-hunter:83, panel/talepler:132). */
  const internalKeyFilter: CanonicalDiscoveryFilter = {
    version: 1,
    kind: "canonical_discovery_filter",
    attributes: { brandCandidate: "WordPress" },
  };
  const filterResult = evaluateDiscoveryFilter(
    parsedProjection,
    internalKeyFilter,
  );
  if (filterResult.match) {
    filterHits += 1;
    problems.push(
      "legacy: evaluateDiscoveryFilter iç kanıt anahtarıyla EŞLEŞTİ — tahmin filtre üretti",
    );
  }
  const mustIncludeFilter: CanonicalDiscoveryFilter = {
    version: 1,
    kind: "canonical_discovery_filter",
    mustIncludes: { brandCandidate: ["WordPress"] },
  };
  if (evaluateDiscoveryFilter(parsedProjection, mustIncludeFilter).match) {
    filterHits += 1;
    problems.push(
      "legacy: mustIncludes iç kanıt anahtarıyla EŞLEŞTİ — tahmin filtre üretti",
    );
  }

  /* (L4) Kişisel eşleşme yolu (opportunities-feed:228): iç kanıt anahtarına
   * kurulu takip tercihi eşleşme ÜRETEMEZ. */
  const personal = matchPersonalAgainstPreferences(parsedProjection, [
    {
      kind: "saved_search",
      id: "pref-internal-1",
      name: "WordPress takibi",
      criteria: { canonical: internalKeyFilter },
    },
  ]);
  if (personal.score != null || personal.reasons.length > 0) {
    personalHits += 1;
    problems.push(
      "legacy: matchPersonalAgainstPreferences iç kanıt anahtarından eşleşme üretti",
    );
  }

  /* (L5) İki şeklin AYNI ANDA bulunduğu girdi: tipli kanal kazanır, çift
   * veri üretilmez, legacy değer tipliyi EZEMEZ. */
  const mixedInput = structuredClone({
    ...LEGACY_SNAPSHOT_SAMPLE,
    internalEvidence: {
      brandCandidate: { value: "TipliDeger", provenance: "INFERRED" },
    },
  }) as unknown as Record<string, unknown>;
  const mixed = parseUnderstandingSnapshot(mixedInput);
  const mixedEvidence = ((mixed ?? {}) as EvidenceCarrier).internalEvidence ?? {};
  if ((mixedEvidence.brandCandidate?.value ?? "") !== "TipliDeger") {
    problems.push(
      "legacy: karışık şekilde tipli iç kanıt legacy değerle ezildi",
    );
  }
  if (mixed?.attributes?.brandCandidate) {
    problems.push("legacy: karışık şekilde attributes temizlenmedi");
  }

  /* (L6) Okuma sınırı girdiyi MUTATE ETMEZ. */
  if (JSON.stringify(legacySnapshotInput) !== snapshotInputBefore) {
    mutations += 1;
    problems.push("legacy: parseUnderstandingSnapshot girdiyi mutate etti");
  }
  if (JSON.stringify(legacyProjectionInput) !== projectionInputBefore) {
    mutations += 1;
    problems.push(
      "legacy: parseDiscoveryProjection/evaluate yolu girdiyi mutate etti",
    );
  }

  /* (L7) YENİ şekil parse'tan DEĞİŞMEDEN geçer (kimlik korunur). */
  const { state } = syncFromText(null, "Arçelik buzdolabı arıyorum");
  const newProjection = withUnderstandingSnapshot(
    buildDiscoveryProjectionFromState(state),
    buildPublishUnderstandingSnapshot({
      understanding: state.understanding,
      userSelected: false,
      userChoice: null,
      confirmedFieldKeys: [],
      primarySlug: state.categoryId ?? null,
    }),
  );
  const reparsed = parseDiscoveryProjection(newProjection);
  if (JSON.stringify(reparsed) !== JSON.stringify(newProjection)) {
    problems.push("legacy: yeni şekil parse sınırında değişti — passthrough bozuk");
  }

  return {
    problems,
    accepted,
    diverted,
    leftInAttributes,
    filterHits,
    personalHits,
    mutations,
  };
}

function checkFixtureAuthority(): string[] {
  const problems: string[] = [];
  for (const [name, list] of Object.entries(BASELINE_BY_CLASS)) {
    if (JSON.stringify([...list].sort()) !== JSON.stringify([...list])) {
      problems.push(`fixture: ${name} sıralı değil`);
    }
    if (new Set(list).size !== list.length) {
      problems.push(`fixture: ${name} benzersiz değil`);
    }
  }
  if (new Set(BASELINE_ALL).size !== BASELINE_ALL.length) {
    problems.push("fixture: sınıflar ayrık değil — kimlik iki sınıfta");
  }
  if (!BASELINE_INFERRED_BRAND_CANDIDATES.includes(FALSE_BRAND_CANDIDATE_CANARY)) {
    problems.push(
      "fixture: sahte marka adayı kanaryası ölçülen tabanın dışında",
    );
  }
  const fixtureSource = fs.readFileSync(
    path.join(
      process.cwd(),
      "scripts",
      "fixtures",
      "snapshot-internal-evidence-v1.ts",
    ),
    "utf8",
  );
  if (
    /^\s*import[\s({"']/m.test(fixtureSource) ||
    /\bfrom\s+["']/.test(fixtureSource) ||
    /\brequire\s*\(/.test(fixtureSource)
  ) {
    problems.push("fixture: kaynakta import/require var — taban elle dondurulur");
  }
  return problems;
}

function main(): void {
  const problems: string[] = [];
  console.log("=== SNAPSHOT IC KANIT AYRIMI V1 (D3c-b) ===");
  console.log(`senaryo tabani: ${CATEGORY_COVERAGE_V1.length} senaryo`);
  console.log(`ic kanit anahtarlari (fixture'dan): ${INTERNAL_KEYS.join(", ")}\n`);

  problems.push(...checkFixtureAuthority());

  const a = measureAll();
  const b = measureAll();
  const deterministic = JSON.stringify(a) === JSON.stringify(b);
  if (!deterministic) {
    problems.push("olcum deterministik degil: iki ardisik kosu farkli");
  }
  problems.push(...a.violations);

  /* İki yönlü, sınıf duyarlı taban karşılaştırması. */
  const measuredById = new Map(a.rows.map((r) => [r.id, r]));
  const missing: string[] = [];
  const classMismatch: string[] = [];
  for (const [cls, list] of Object.entries(BASELINE_BY_CLASS)) {
    for (const id of list) {
      const row = measuredById.get(id);
      if (!row) {
        missing.push(id);
        problems.push(`taban: ${id} olculen evrenden KAYBOLDU (sinif ${cls})`);
      } else if (row.baselineClass !== cls) {
        classMismatch.push(id);
        problems.push(
          `taban: ${id} sinif degistirdi — beklenen ${cls}, olculen ${row.baselineClass}`,
        );
      }
    }
  }
  const baselineSet = new Set(BASELINE_ALL);
  const unexpected = a.rows.filter((r) => !baselineSet.has(r.id));
  for (const r of unexpected) {
    problems.push(
      `taban: ${r.id} aciklanamayan yeni ic kanit kimligi (${r.baselineClass})`,
    );
  }

  /* Sızıntı ve koruma kapıları — kimlik bazında. */
  const leak = (
    pick: (r: Row) => boolean,
    label: string,
  ): Row[] => {
    const rows = a.rows.filter(pick);
    for (const r of rows) {
      problems.push(`${label}: ${r.id} deger='${r.value}'`);
    }
    return rows;
  };
  const snapLeaks = leak(
    (r) => r.snapshotAttributeLeak,
    "sizinti: snapshot.attributes kullanici attribute'u gibi tasiyor",
  );
  const projAttrLeaks = leak(
    (r) => r.projectionAttributeLeak,
    "sizinti: projection.attributes iceriyor",
  );
  const projConstrLeaks = leak(
    (r) => r.projectionConstraintLeak,
    "sizinti: projection.constraints iceriyor",
  );
  const envLeaks = leak(
    (r) => r.envelopeAttributeLeak,
    "sizinti: envelope genel attributes torbasinda",
  );
  const payloadLeaks = leak(
    (r) => r.payloadFieldLeak,
    "sizinti: payload.fields yayin torbasinda",
  );
  const questionLeaks = leak(
    (r) => r.questionCandidateLeak,
    "sizinti: soru adayi olarak render ediliyor",
  );
  const lost = leak(
    (r) => !r.snapshotEvidencePresent,
    "kayip: snapshot.internalEvidence icinde degeriyle DURMUYOR",
  );
  const provenanceLost = leak(
    (r) => r.snapshotEvidencePresent && !r.snapshotProvenancePreserved,
    "kayip: authority/provenance/source/confidence serilestirmede kayboldu",
  );
  const envelopeLost = leak(
    (r) => !r.envelopeEvidencePresent,
    "kayip: envelope tipli ic kanit kanalinda DURMUYOR",
  );
  const bareLost = leak(
    (r) => !r.bareProjectionEvidencePresent,
    "kayip: snapshot'siz (ciplak) projection yolunda deger hicbir kanalda YOK",
  );
  const bareEnvelopeLost = leak(
    (r) => !r.bareEnvelopeEvidencePresent,
    "kayip: snapshot'siz yoldan kurulan envelope'ta ic kanit YOK",
  );
  const persistedCopyProblem = leak(
    (r) => !r.persistedSingleCopy,
    "persist: ic kanit tam bir tipli kanalda durmuyor (0 = kayip, 2 = cift)",
  );
  const duplicated = leak(
    (r) => r.duplicated,
    "cift yazim: ayni veri hem attributes hem internalEvidence icinde",
  );
  for (const id of a.userAttributeDropped) {
    problems.push(`kanarya: ${id} gercek kullanici attribute'u snapshot'tan dustu`);
  }

  const legacy = checkLegacyShape();
  problems.push(...legacy.problems);

  console.log("--- olcum ---");
  console.log(`  olculen ic kanit kimligi        : ${a.rows.length}`);
  console.log(`  iki olcum birebir               : ${deterministic ? "EVET" : "HAYIR"}`);
  console.log(
    `  sahte marka adayi kanaryasi     : ${FALSE_BRAND_CANDIDATE_CANARY} ` +
      `olculdu=${measuredById.has(FALSE_BRAND_CANDIDATE_CANARY) ? "EVET" : "HAYIR"}`,
  );
  console.log(
    "  olcum yuzeyi notu               : home-06 D3c-b SERILESTIRME yuzeyinde " +
      "olculur; D1 kategori/soru yuzeyindeki NOT_MEASURED statusu DEGISMEZ",
  );

  console.log("\n--- makine ozeti ---");
  console.log(`INTERNAL_EVIDENCE_BASELINE_TOTAL=${BASELINE_ALL.length}`);
  console.log(
    `INFERRED_BRAND_CANDIDATE_TOTAL=${BASELINE_INFERRED_BRAND_CANDIDATES.length}`,
  );
  console.log(
    `INFERRED_BRAND_EVIDENCE_TOTAL=${BASELINE_INFERRED_BRAND_EVIDENCE.length}`,
  );
  console.log(
    `VERIFIED_BRAND_EVIDENCE_TOTAL=${BASELINE_VERIFIED_BRAND_EVIDENCE.length}`,
  );
  console.log(`INTERNAL_EVIDENCE_MEASURED=${a.rows.length}`);
  console.log(`INTERNAL_EVIDENCE_MISSING=${missing.length}`);
  console.log(`INTERNAL_EVIDENCE_UNEXPECTED=${unexpected.length}`);
  console.log(`CLASS_MISMATCH=${classMismatch.length}`);
  /* Yüzey ayrımı: bu doğrulayıcı yalnız serileştirme yüzeyini ölçer; D1
   * satırı ölçüm değil, o evrenden değişmeden AKTARILAN statüdür. */
  console.log(`SERIALIZATION_NOT_MEASURED=0`);
  console.log(`D1_HOME06_STATUS=NOT_MEASURED (D1 evreninden aktarildi; burada olculmez)`);
  console.log(`SNAPSHOT_ATTRIBUTE_LEAKED=${snapLeaks.length}`);
  console.log(`PROJECTION_ATTRIBUTE_LEAKED=${projAttrLeaks.length}`);
  console.log(`PROJECTION_CONSTRAINT_LEAKED=${projConstrLeaks.length}`);
  console.log(`ENVELOPE_ATTRIBUTE_LEAKED=${envLeaks.length}`);
  console.log(`PAYLOAD_FIELD_LEAKED=${payloadLeaks.length}`);
  console.log(`QUESTION_CANDIDATE_LEAKED=${questionLeaks.length}`);
  console.log(`INTERNAL_EVIDENCE_LOST=${lost.length}`);
  console.log(`PROVENANCE_LOST=${provenanceLost.length}`);
  console.log(`ENVELOPE_EVIDENCE_LOST=${envelopeLost.length}`);
  console.log(`BARE_PROJECTION_EVIDENCE_LOST=${bareLost.length}`);
  console.log(`BARE_ENVELOPE_EVIDENCE_LOST=${bareEnvelopeLost.length}`);
  console.log(`PERSISTED_COPY_NOT_EXACTLY_ONE=${persistedCopyProblem.length}`);
  console.log(`DUPLICATED=${duplicated.length}`);
  console.log(`USER_ATTRIBUTE_DROPPED=${a.userAttributeDropped.length}`);
  console.log(`LEGACY_ACCEPTED=${legacy.accepted ? 1 : 0}`);
  console.log(`LEGACY_DIVERTED=${legacy.diverted}`);
  console.log(`LEGACY_LEFT_IN_ATTRIBUTES=${legacy.leftInAttributes}`);
  console.log(`LEGACY_FILTER_HITS=${legacy.filterHits}`);
  console.log(`LEGACY_PERSONAL_HITS=${legacy.personalHits}`);
  console.log(`LEGACY_READER_MUTATIONS=${legacy.mutations}`);

  console.log("\n===== HUKUM =====");
  if (problems.length > 0) {
    console.log(`KIRMIZI — ${problems.length} ihlal:`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    "YESIL — ic kanit hicbir kullanici kanalina karismadi; 36 kimlik tipli\n" +
      "internalEvidence kanalinda provenance'iyla duruyor; anlama katmani\n" +
      "degismedi; eski sekil kabul edilip tipli kanala ayrildi; gercek\n" +
      "kullanici attribute'lari yerinde.",
  );
}

main();
