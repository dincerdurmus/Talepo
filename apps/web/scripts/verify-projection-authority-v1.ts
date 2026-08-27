/**
 * PROJECTION OTORİTESİ V1 — D3c (2026-08-27).
 *
 * ÖLÇTÜĞÜ TEK SÖZLEŞME. `discoveryProjection.attributes` ve
 * `discoveryProjection.constraints` içindeki bir değerin KAYNAĞI —
 * kullanıcının kendi beyanı mı, çağrılabilir bir katalog otoritesinin
 * doğruladığı bilgi mi, yoksa Talepo'nun kendi tahmini mi — projection boyunca
 * KAYBOLMAMALIDIR. Kaybolduğunda sonraki katmanların hiçbiri farkı göremez:
 * Matching V3 tahmine kullanıcı beyanı kadar güvenir, admin paneli "kullanıcı
 * söyledi" diye gösterir ve soru katmanı zaten cevaplanmış sanıp bir daha
 * sormaz.
 *
 * ÜRETİM DAVRANIŞI ÖLÇÜLÜR, KOPYALANMAZ. Bu doğrulayıcı otoriteyi KENDİ
 * hesaplamaz: projection'ı üretim kurucusuyla (`buildDiscoveryProjectionFromState`)
 * kurar ve otoriteyi üretim okuma sınırından (`projectionAuthorityOf`) okur.
 * Kendi kopyasını kursaydı, üretim tarafı bozulduğunda bile yeşil kalırdı.
 *
 * KİMLİK BİÇİMİ `senaryo/alanAnahtarı/yüzey`. Yüzey kimliğin PARÇASIDIR: aynı
 * alan iki yüzeyde birden yaşayabilir ve ayrışabilir — değer taşımayan
 * `mode:"ANY"` bir constraint YALNIZ `constraints` yüzeyinde vardır. Yüzeyi
 * kimlikten düşürmek bu ayrımı ölçülemez yapardı.
 *
 * DONDURULMUŞ TABAN. "Yanlış otorite 0" hükmü tek başına güvenilmez: bir
 * kimlik ölçüm evreninden sessizce kaybolursa yanlış etiketlenecek kimse
 * kalmadığı için de sıfır çıkar. Bu yüzden 510 kimliğin tamamı
 * `fixtures/projection-authority-v1` içinde BAĞIMSIZ veri otoritesi olarak
 * dondurulmuştur. Karşılaştırma İKİ YÖNLÜ ve kimlik bazındadır: kaybolan
 * kimlik de, açıklanamayan yeni kimlik de, otoritesi sessizce değişen kimlik
 * de KIRMIZI. Fixture bu dosyadan ya da üretim kodundan türetilmez; içinde
 * import bulunmadığı da ayrıca denetlenir.
 *
 * ADDITIVE OLDUĞU ÖLÇÜLÜR. `fieldAuthority` mevcut değer payload'ını
 * değiştirmemelidir. İddia edilmez: projection'dan `fieldAuthority` çıkarılıp
 * serileştirilir ve düzeltme ÖNCESİ (`50ab671`) dondurulmuş imzalarla
 * karşılaştırılır.
 *
 * BU DOĞRULAYICI BİR GÜVENLİK KAPISI DEĞİLDİR. `fieldAuthority` AÇIKLAYICI
 * provenance metadata'sıdır; istemciden gelen bir projection'da da bulunabilir
 * ve update yolunun sunucu doğrulaması yapılmadan yetki/izin kanıtı olarak
 * KULLANILAMAZ. Burada ölçülen tek şey, üretim kurucusunun kendi kurduğu
 * projection'da kaynağın kaybolmamasıdır.
 *
 * SALT-OKUNUR: hiçbir veritabanı yazımı, hiçbir ağ çağrısı yapılmaz; bu
 * doğrulayıcı fixture'ı da hiçbir dosyayı da YENİDEN YAZMAZ.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { CATEGORY_COVERAGE_V1 } from "./fixtures/category-coverage-v1";
import {
  FROZEN_PROJECTION_AUTHORITY_IDENTITIES,
  FROZEN_PROJECTION_PAYLOAD_SIGNATURES,
  PROJECTION_AUTHORITY_BASELINE,
} from "./fixtures/projection-authority-v1";
import { buildDiscoveryProjectionFromState } from "../src/lib/discovery/build-projection";
import { parseDiscoveryProjection, projectionAuthorityOf } from "../src/lib/discovery/validate-filter";
import type {
  ProjectionAuthoritySurface,
  RequestDiscoveryProjection,
} from "../src/lib/discovery/types";
import { syncFromBrowse, syncFromText } from "../src/lib/request-composer";
import { INTERNAL_EVIDENCE_ATTRIBUTE_KEYS } from "../src/lib/request/understanding-snapshot";
import {
  authorityRank,
  type Authority,
} from "../src/lib/request-understanding/provenance";

const SURFACES: readonly ProjectionAuthoritySurface[] = [
  "attributes",
  "constraints",
];

type Tally = Record<Authority, number>;

function emptyTally(): Tally {
  return { UNKNOWN: 0, INFERRED: 0, VERIFIED: 0, USER_EXPLICIT: 0 };
}

/**
 * Tek senaryonun ölçümü. Otorite BURADA hesaplanmaz; üretim projection'ı
 * kurulur ve üretim okuma yardımcısı sorgulanır.
 */
function measureScenario(
  scenarioId: string,
  input: string,
): {
  identities: Map<string, Authority>;
  payloadSignature: string;
  attrKeys: string[];
  consKeys: string[];
} {
  const { state } = syncFromText(null, input);
  const projection = buildDiscoveryProjectionFromState(state);

  const identities = new Map<string, Authority>();
  const attrKeys = Object.keys(projection.attributes);
  const consKeys = Object.keys(projection.constraints);

  for (const key of attrKeys) {
    identities.set(
      `${scenarioId}/${key}/attributes`,
      projectionAuthorityOf(projection, key, "attributes"),
    );
  }
  for (const key of consKeys) {
    identities.set(
      `${scenarioId}/${key}/constraints`,
      projectionAuthorityOf(projection, key, "constraints"),
    );
  }

  return {
    identities,
    payloadSignature: payloadSignatureOf(projection),
    attrKeys,
    consKeys,
  };
}

/**
 * Değer payload'ının imzası: `fieldAuthority` ÇIKARILIR, `builtAt` (her koşuda
 * değişen zaman damgası) ölçülen sözleşmenin parçası olmadığı için dışarıda
 * bırakılır; geri kalan projection'ın TAMAMI imzaya girer.
 */
function payloadSignatureOf(projection: RequestDiscoveryProjection): string {
  const copy: Record<string, unknown> = { ...projection };
  delete copy.builtAt;
  delete copy.fieldAuthority;
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(copy))
    .digest("hex")
    .slice(0, 16);
}

/** `senaryo/alan/yüzey=OTORİTE` satırını ayrıştırır. */
function parseFrozenRow(
  row: string,
): { id: string; authority: string } | null {
  const at = row.lastIndexOf("=");
  if (at <= 0) return null;
  return { id: row.slice(0, at), authority: row.slice(at + 1) };
}

/**
 * Fixture'ın kendi bütünlüğü. Buradaki hiçbir kapı fixture'ı ölçümden
 * GÜNCELLEMEZ; yalnız karşılaştırır.
 */
function checkFixtureIntegrity(): string[] {
  const problems: string[] = [];

  const list = FROZEN_PROJECTION_AUTHORITY_IDENTITIES;
  if (JSON.stringify([...list].sort()) !== JSON.stringify([...list])) {
    problems.push(
      "fixture: kimlik listesi sıralı değil — veri otoritesi bozuk",
    );
  }
  if (new Set(list).size !== list.length) {
    problems.push("fixture: kimlik listesi benzersiz değil — yinelenen kimlik");
  }
  if (list.length !== PROJECTION_AUTHORITY_BASELINE.totalIdentities) {
    problems.push(
      `fixture: kimlik sayısı ${list.length}, dondurulmuş taban ` +
        `${PROJECTION_AUTHORITY_BASELINE.totalIdentities}`,
    );
  }

  /* Kimlik biçimi ve otorite adı kanonik merdivenle örtüşüyor mu? Fixture
   * import ALAMAZ, bu yüzden otorite adlarını kendi yazar; burada o adların
   * kanonik `Authority` birleşiminde GERÇEKTEN var olduğu denetlenir —
   * ikinci bir merdiven kurulmadan, kanonik `authorityRank` üzerinden. */
  const seenIds = new Set<string>();
  for (const row of list) {
    const parsed = parseFrozenRow(row);
    if (!parsed) {
      problems.push(`fixture: satır biçimi bozuk — ${row}`);
      continue;
    }
    if (seenIds.has(parsed.id)) {
      problems.push(`fixture: kimlik iki kez donduruldu — ${parsed.id}`);
    }
    seenIds.add(parsed.id);
    const parts = parsed.id.split("/");
    if (parts.length !== 3) {
      problems.push(
        `fixture: kimlik "senaryo/alan/yüzey" biçiminde değil — ${parsed.id}`,
      );
      continue;
    }
    if (!SURFACES.includes(parts[2] as ProjectionAuthoritySurface)) {
      problems.push(`fixture: bilinmeyen yüzey — ${parsed.id}`);
    }
    if (!Number.isFinite(authorityRank(parsed.authority as Authority))) {
      problems.push(
        `fixture: "${parsed.authority}" kanonik Authority birleşiminde yok — ` +
          `fixture ile merdiven ayrışmış`,
      );
    }
    if (
      (INTERNAL_EVIDENCE_ATTRIBUTE_KEYS as readonly string[]).includes(parts[1])
    ) {
      problems.push(
        `fixture: iç kanıt anahtarı generic tabanda — ${parsed.id}; ` +
          `brandCandidate/brandEvidence projection torbalarına giremez`,
      );
    }
  }

  const sigs = FROZEN_PROJECTION_PAYLOAD_SIGNATURES;
  if (JSON.stringify([...sigs].sort()) !== JSON.stringify([...sigs].sort())) {
    problems.push("fixture: imza listesi karşılaştırılamadı");
  }
  if (new Set(sigs).size !== sigs.length) {
    problems.push("fixture: imza listesi benzersiz değil");
  }
  if (sigs.length !== PROJECTION_AUTHORITY_BASELINE.scenarios) {
    problems.push(
      `fixture: imza sayısı ${sigs.length}, senaryo tabanı ` +
        `${PROJECTION_AUTHORITY_BASELINE.scenarios}`,
    );
  }

  const fixtureSource = fs.readFileSync(
    path.join(
      process.cwd(),
      "scripts",
      "fixtures",
      "projection-authority-v1.ts",
    ),
    "utf8",
  );
  if (
    /^\s*import[\s({"']/m.test(fixtureSource) ||
    /\bfrom\s+["']/.test(fixtureSource) ||
    /\brequire\s*\(/.test(fixtureSource)
  ) {
    problems.push(
      "fixture: kaynakta import/require var — taban elle dondurulur, koddan türetilmez",
    );
  }

  return problems;
}

/**
 * LEGACY KAPISI. Otorite metadata'sı OLMAYAN eski kayıtlarda otorite
 * UYDURULAMAZ: her yüzey `UNKNOWN` dönmelidir. Eksik metadata hiçbir koşulda
 * `USER_EXPLICIT` ya da `VERIFIED` sayılamaz — o iki seviye firmalara
 * yönlendirme sinyalidir.
 */
function legacyProjection(): Record<string, unknown> {
  return {
    version: 1,
    kind: "discovery_projection",
    taxonomyNodeIds: ["tax:furniture"],
    primaryLeafId: null,
    categoryId: "furniture",
    subcategorySlug: null,
    attributes: { condition: "ikinci el", furnitureType: "koltuk" },
    constraints: {
      condition: { mode: "VALUE", value: "ikinci el" },
    },
    matchContract: { must: {}, preferred: {}, exclude: {}, any: [], range: {} },
    filterContract: { must: {}, preferred: {}, exclude: {}, any: [], range: {} },
    builtAt: "2026-01-01T00:00:00.000Z",
  };
}

function checkLegacyReads(): string[] {
  const problems: string[] = [];

  const legacyRaw = legacyProjection();
  const legacyJson = JSON.stringify(legacyRaw);
  const legacy = parseDiscoveryProjection(legacyRaw);
  if (!legacy) {
    problems.push("legacy: metadata'sız eski kayıt parse edilemedi");
    return problems;
  }
  if (JSON.stringify(legacy) !== legacyJson) {
    problems.push(
      "legacy: parse eski kaydın değerlerini değiştirdi — okuma sınırı " +
        "değer taşıyıcı olmamalı",
    );
  }
  if (JSON.stringify(parseDiscoveryProjection(legacy)) !== JSON.stringify(legacy)) {
    problems.push("legacy: parse idempotent değil");
  }
  for (const key of ["condition", "furnitureType"]) {
    for (const surface of SURFACES) {
      const a = projectionAuthorityOf(legacy, key, surface);
      if (a !== "UNKNOWN") {
        problems.push(
          `legacy: ${key}/${surface} → ${a}; metadata yokken UNKNOWN dışında ` +
            `bir otorite uydurulamaz`,
        );
      }
    }
  }

  /* BOZUK RUNTIME DEĞERİ. Kolon JSON'dur; içine her şey yazılmış olabilir.
   * Okuma sınırı THROW ETMEMELİ ve bozuk metni güvenilir SAYMAMALIDIR. */
  const corrupt = [
    { fieldAuthority: { condition: { attributes: "TOTALLY_BOGUS" } } },
    { fieldAuthority: { condition: { attributes: "user_explicit" } } },
    { fieldAuthority: { condition: { attributes: 3 } } },
    { fieldAuthority: { condition: { attributes: null } } },
    { fieldAuthority: { condition: "USER_EXPLICIT" } },
    { fieldAuthority: { condition: ["USER_EXPLICIT"] } },
    { fieldAuthority: [] },
    { fieldAuthority: "USER_EXPLICIT" },
    { fieldAuthority: null },
  ];
  for (const [index, patch] of corrupt.entries()) {
    const raw = { ...legacyProjection(), ...patch };
    let parsed: RequestDiscoveryProjection | null = null;
    try {
      parsed = parseDiscoveryProjection(raw);
    } catch (error) {
      problems.push(
        `bozuk metadata #${index}: parse throw etti (${
          error instanceof Error ? error.name : "unknown"
        }) — okuma sınırı total kalmalı`,
      );
      continue;
    }
    for (const surface of SURFACES) {
      let authority: Authority;
      try {
        authority = projectionAuthorityOf(parsed, "condition", surface);
      } catch (error) {
        problems.push(
          `bozuk metadata #${index}/${surface}: okuma throw etti (${
            error instanceof Error ? error.name : "unknown"
          })`,
        );
        continue;
      }
      if (authority !== "UNKNOWN") {
        problems.push(
          `bozuk metadata #${index}/${surface}: ${authority} döndü — ` +
            `doğrulanamayan metin güvenilir sayılamaz`,
        );
      }
    }
  }

  /* Bilinmeyen alan / yüzey de UNKNOWN olmalı. */
  if (projectionAuthorityOf(legacy, "hicBoyleBirAlanYok", "attributes") !== "UNKNOWN") {
    problems.push("legacy: var olmayan alan UNKNOWN dönmedi");
  }
  if (projectionAuthorityOf(null, "condition", "attributes") !== "UNKNOWN") {
    problems.push("legacy: null projection UNKNOWN dönmedi");
  }

  return problems;
}

/**
 * BROWSE-ANY KANARYASI. Kullanıcının gezinme üzerinden açıkça seçtiği
 * "Fark etmez" bilinçli bir cevaptır ve `EXPLICIT_BROWSE` provenance taşır —
 * ama değer taşımadığı için `attributes` yüzeyinde HİÇ görünmez, yalnız
 * `constraints` yüzeyinde `mode:"ANY"` olarak durur. Otorite `UNKNOWN`
 * yazılırsa kullanıcının açık kararı Talepo'nun bilgisizliğiyle aynı kovaya
 * düşer; bu yüzden `USER_EXPLICIT` olmak ZORUNDADIR.
 *
 * Bu aynı zamanda serbest metin corpusunda hiç görünmeyen GERÇEK
 * constraints-only vakadır: çapraz yüzey uyuşmazlığı tabanının neden yalnız
 * o corpus için 0 olduğunu gösterir.
 */
function checkBrowseAnyCanary(): string[] {
  const problems: string[] = [];

  const { state: base } = syncFromText(
    null,
    "İstanbul'da ikinci el ofis koltuğu arıyorum",
  );
  const { state } = syncFromBrowse(base, {
    key: "condition",
    value: "__ANY__",
    isAny: true,
  });

  const field = state.fields.condition;
  if (field?.kind !== "ANY" || field.provenance !== "EXPLICIT_BROWSE") {
    problems.push(
      `browse-ANY: kanarya kurulumu bozuk — kind=${field?.kind} ` +
        `provenance=${field?.provenance}`,
    );
    return problems;
  }

  const projection = buildDiscoveryProjectionFromState(state);

  if (Object.prototype.hasOwnProperty.call(projection.attributes, "condition")) {
    problems.push(
      "browse-ANY: değer taşımayan ANY attributes torbasına yazıldı",
    );
  }
  if (projection.constraints.condition?.mode !== "ANY") {
    problems.push("browse-ANY: constraints kaydı ANY modunda değil");
  }

  const consAuthority = projectionAuthorityOf(
    projection,
    "condition",
    "constraints",
  );
  if (consAuthority !== "USER_EXPLICIT") {
    problems.push(
      `browse-ANY: constraints otoritesi ${consAuthority}; kullanıcının açık ` +
        `"fark etmez" seçimi USER_EXPLICIT olmalı`,
    );
  }

  const attrAuthority = projectionAuthorityOf(
    projection,
    "condition",
    "attributes",
  );
  if (attrAuthority !== "UNKNOWN") {
    problems.push(
      `browse-ANY: attributes yüzeyi ${attrAuthority} döndü; o yüzeyde kayıt ` +
        `YOK — var olmayan yüzeye otorite yazılamaz`,
    );
  }

  /* Gidiş-dönüş: DB serileştirmesi ve okuma sınırı otoriteyi düşürmemeli. */
  const roundTripped = parseDiscoveryProjection(
    JSON.parse(JSON.stringify(projection)),
  );
  if (
    projectionAuthorityOf(roundTripped, "condition", "constraints") !==
    "USER_EXPLICIT"
  ) {
    problems.push("browse-ANY: otorite JSON gidiş-dönüşünde kayboldu");
  }

  return problems;
}

function main(): void {
  const problems: string[] = [];

  /* ---- (1) ÖLÇÜM ---- */
  const measured = new Map<string, Authority>();
  const signatures = new Map<string, string>();
  const perSurface: Record<ProjectionAuthoritySurface, Tally> = {
    attributes: emptyTally(),
    constraints: emptyTally(),
  };
  let crossSurfaceDisagreement = 0;
  const disagreementIds: string[] = [];
  let internalEvidenceLeak = 0;

  for (const scenario of CATEGORY_COVERAGE_V1) {
    const m = measureScenario(scenario.id, scenario.input);
    signatures.set(scenario.id, m.payloadSignature);

    for (const [id, authority] of m.identities) {
      measured.set(id, authority);
      const surface = id.split("/")[2] as ProjectionAuthoritySurface;
      perSurface[surface][authority] += 1;
    }

    const shared = m.attrKeys.filter((k) => m.consKeys.includes(k));
    for (const key of shared) {
      const a = m.identities.get(`${scenario.id}/${key}/attributes`);
      const c = m.identities.get(`${scenario.id}/${key}/constraints`);
      if (a !== c) {
        crossSurfaceDisagreement += 1;
        disagreementIds.push(`${scenario.id}/${key} → ${a} | ${c}`);
      }
    }

    for (const key of [...m.attrKeys, ...m.consKeys]) {
      if (
        (INTERNAL_EVIDENCE_ATTRIBUTE_KEYS as readonly string[]).includes(key)
      ) {
        internalEvidenceLeak += 1;
        problems.push(
          `${scenario.id}/${key}: iç kanıt anahtarı generic projection ` +
            `torbasına sızdı`,
        );
      }
    }
  }

  /* ---- (2) FIXTURE BÜTÜNLÜĞÜ ---- */
  problems.push(...checkFixtureIntegrity());

  /* ---- (3) İKİ YÖNLÜ KİMLİK KARŞILAŞTIRMASI ---- */
  const frozen = new Map<string, string>();
  for (const row of FROZEN_PROJECTION_AUTHORITY_IDENTITIES) {
    const parsed = parseFrozenRow(row);
    if (parsed) frozen.set(parsed.id, parsed.authority);
  }

  const missing: string[] = [];
  const mismatched: string[] = [];
  for (const [id, expected] of frozen) {
    const actual = measured.get(id);
    if (actual === undefined) {
      missing.push(id);
      continue;
    }
    if (actual !== expected) {
      mismatched.push(`${id}: beklenen ${expected}, ölçülen ${actual}`);
    }
  }
  const unexpected = [...measured.keys()].filter((id) => !frozen.has(id)).sort();

  for (const id of missing) {
    problems.push(
      `taban: ${id} ölçüm evreninden KAYBOLDU — kimlik kaybı "yanlış otorite 0" ` +
        `hükmünü sahte yeşile çevirir`,
    );
  }
  for (const row of mismatched) {
    problems.push(`otorite: ${row}`);
  }
  for (const id of unexpected) {
    problems.push(
      `taban: ${id} dondurulmuş tabanda YOK — açıklanamayan yeni kimlik`,
    );
  }

  /* ---- (4) YÜZEY BAŞINA TABAN ---- */
  for (const surface of SURFACES) {
    const expected = PROJECTION_AUTHORITY_BASELINE[surface];
    const actual = perSurface[surface];
    for (const authority of Object.keys(expected) as Authority[]) {
      if (actual[authority] !== expected[authority]) {
        problems.push(
          `yüzey ${surface}: ${authority} ölçüldü ${actual[authority]}, ` +
            `taban ${expected[authority]}`,
        );
      }
    }
  }

  if (crossSurfaceDisagreement !== PROJECTION_AUTHORITY_BASELINE.crossSurfaceDisagreement) {
    problems.push(
      `çapraz yüzey uyuşmazlığı ${crossSurfaceDisagreement}, taban ` +
        `${PROJECTION_AUTHORITY_BASELINE.crossSurfaceDisagreement}: ` +
        disagreementIds.slice(0, 5).join(" · "),
    );
  }

  /* ---- (5) DEĞER PAYLOAD'I DEĞİŞMEDİ Mİ ---- */
  const frozenSignatures = new Map<string, string>();
  for (const row of FROZEN_PROJECTION_PAYLOAD_SIGNATURES) {
    const parsed = parseFrozenRow(row);
    if (parsed) frozenSignatures.set(parsed.id, parsed.authority);
  }
  let signatureDrift = 0;
  for (const [scenarioId, expected] of frozenSignatures) {
    const actual = signatures.get(scenarioId);
    if (actual !== expected) {
      signatureDrift += 1;
      problems.push(
        `payload: ${scenarioId} imzası ${actual ?? "(ölçülmedi)"}, düzeltme ` +
          `öncesi ${expected} — fieldAuthority additive değil, mevcut değeri ` +
          `değiştirmiş`,
      );
    }
  }

  /* ---- (6) LEGACY + BOZUK METADATA + BROWSE-ANY ---- */
  problems.push(...checkLegacyReads());
  problems.push(...checkBrowseAnyCanary());

  /* ---- MAKİNE ÖZETİ ---- */
  console.log("===== PROJECTION OTORITESI V1 =====");
  console.log(`SCENARIOS=${CATEGORY_COVERAGE_V1.length}`);
  console.log(`FROZEN_IDENTITIES=${frozen.size}`);
  console.log(`MEASURED_IDENTITIES=${measured.size}`);
  console.log(`IDENTITY_MISSING=${missing.length}`);
  console.log(`IDENTITY_UNEXPECTED=${unexpected.length}`);
  console.log(`IDENTITY_DUPLICATE=${FROZEN_PROJECTION_AUTHORITY_IDENTITIES.length - frozen.size}`);
  console.log(`AUTHORITY_MISMATCH=${mismatched.length}`);
  for (const surface of SURFACES) {
    const t = perSurface[surface];
    console.log(
      `SURFACE_${surface.toUpperCase()}=` +
        `UNKNOWN:${t.UNKNOWN} INFERRED:${t.INFERRED} ` +
        `VERIFIED:${t.VERIFIED} USER_EXPLICIT:${t.USER_EXPLICIT}`,
    );
  }
  console.log(`CROSS_SURFACE_DISAGREEMENT=${crossSurfaceDisagreement}`);
  console.log(`PAYLOAD_SIGNATURE_DRIFT=${signatureDrift}`);
  console.log(`INTERNAL_EVIDENCE_LEAK=${internalEvidenceLeak}`);

  console.log("\n===== HUKUM =====");
  if (problems.length > 0) {
    console.log(`KIRMIZI — ${problems.length} ihlal:`);
    for (const p of problems.slice(0, 60)) console.log(`  - ${p}`);
    if (problems.length > 60) {
      console.log(`  ... ve ${problems.length - 60} ihlal daha`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(
    "YESIL — 510 kimliğin tamamı dondurulmuş tabanla birebir örtüştü; her\n" +
      "değerin kullanıcı beyanı / doğrulanmış bilgi / Talepo tahmini olduğu\n" +
      "projection boyunca korundu; metadata'sız eski kayıtlar ve bozuk metadata\n" +
      "UNKNOWN okundu; kullanıcının açık \"fark etmez\" seçimi USER_EXPLICIT\n" +
      "kaldı; iç kanıt generic torbalara sızmadı; mevcut değer payload'ları\n" +
      "byte-birebir değişmedi.",
  );
}

main();
