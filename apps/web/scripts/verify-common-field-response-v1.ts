/**
 * ORTAK ALAN CEVAP KANALI V1 — D3f Dilim 2b (2026-08-27).
 *
 * SORUN (salt-okunur keşif, 2026-08-27). Dilim 2 değer taşımayan bilinçli
 * cevaplar için `fieldResponses` yüzeyini kurdu ve sunucuda güvenli biçimde
 * yeniden türetti. Ama sunucunun tek güvenilir girdisi süzülmüş cevap kanalı
 * (`fields[]` → kanonik `mode`) ve `/talep` o listeyi YALNIZ
 * `visibleDynamicFields`'ten kuruyor. Ölçüldü: `commonFields` ile
 * `category.fields` kesişimi 11 kategorinin HEPSİNDE 0.
 *
 * Sonuç: `budget` / `city` / `delivery` / `quantity` / `title` alanlarında
 * kullanıcının bilinçli "Bilmiyorum" / "Fark etmez" cevabı istemci
 * projection'ında doğru kuruluyor, ama sunucuya hiç ulaşmıyor ve güven
 * sınırında fail-closed düşüyor. Beş alan × ilgili modların tamamı sessizce
 * kayboluyordu.
 *
 * ELLE LİSTE YOK. Ortak alan evreni kanonik registry'den türer
 * (`COMMON_FIELD_DEFAULTS` / `CommonFieldKey`); bu doğrulayıcı da, ürün kodu
 * da beşli bir isim listesi yazmaz. Registry büyürse ölçüm kendiliğinden
 * büyür.
 *
 * YENİ KANAL YOK. Mevcut `fields[] + mode` sözleşmesi kullanılır; sunucu
 * tarafı zaten hazırdır ve DEĞİŞMEZ davranışla ortak alanları da kabul eder.
 *
 * SALT-OKUNUR. Hiçbir veritabanı yazımı yapılmaz.
 *
 * KAPSAM DIŞI (ölçülmedi): `RequestFieldValue` kalıcılığı, edit/reload state
 * kurulumu, clone geri yükleme ve `parseBudgetRange` / dedicated kolon
 * davranışı — Dilim 3. Bu YEŞİL, cevabın sayfa yenilendikten sonra geri
 * geldiğini KAPSAMAZ.
 */

import { buildDiscoveryProjectionFromState } from "../src/lib/discovery/build-projection";
import {
  resolveCloneProjection,
  resolveCreateProjection,
  resolveUpdateProjection,
} from "../src/lib/discovery/server-authority";
import type { RequestDiscoveryProjection } from "../src/lib/discovery/types";
import {
  COMMON_FIELD_DEFAULTS,
  isGeneratedCommonField,
} from "../src/lib/request-category-engine";
import type { CommonFieldKey } from "../src/lib/request-category-engine";
import {
  buildPublishAnswerFields,
  createTextOnlyState,
} from "../src/lib/request-composer";
import type {
  CanonicalFieldState,
  CanonicalRequestState,
} from "../src/lib/request-composer/types";
import { CATEGORY_COVERAGE_V1 } from "./fixtures/category-coverage-v1";

const problems: string[] = [];

function ok(id: string, condition: boolean, detail: string): void {
  if (!condition) problems.push(`${id}: ${detail}`);
}

const SCENE_TEXT = "İstanbul'da ikinci el buzdolabı arıyorum, bütçem 15000 TL";

/**
 * Ortak alan evreni KANONİK REGISTRY'den türer — elle liste yazılmaz.
 *
 * ÜRETİLEN ALANLAR DIŞARIDADIR (kurucu kararı, 2026-08-28 — D3f Dilim 3g).
 * Bu doğrulayıcı ilk yazıldığında `title` de cevap taşıyan bir ortak alan
 * sayılıyordu. Kurucu sonradan başlığın bir CEVAP alanı olmadığına, talebin
 * içeriğinden ÜRETİLEN bir etiket olduğuna karar verdi. Beklenti bu yüzden
 * sayacı düşürmek için değil, ÜRÜN KARARI değiştiği için daraltıldı; kapsam
 * yine tek kanonik yetenekten okunur ve üretilen alanın hiçbir yüzey
 * üretmediği aşağıda AYRICA ölçülür (bkz. `measureGeneratedFieldsExcluded`).
 */
const COMMON_KEYS = Object.keys(COMMON_FIELD_DEFAULTS).filter(
  (key) => !isGeneratedCommonField(key),
) as CommonFieldKey[];

const GENERATED_KEYS = Object.keys(COMMON_FIELD_DEFAULTS).filter((key) =>
  isGeneratedCommonField(key),
);

function sceneState(): CanonicalRequestState {
  return createTextOnlyState(SCENE_TEXT);
}

function withField(
  key: string,
  field: CanonicalFieldState | null,
): CanonicalRequestState {
  const state = sceneState();
  if (!field) return state;
  return { ...state, fields: { ...state.fields, [key]: field } };
}

/**
 * `/talep` ve `EditRequestForm` yayın payload'ının `fields[]` listesini kuran
 * ÜRETİM yardımcısı. Doğrulayıcı kendi kopyasını KURMAZ.
 */
function publishFields(
  state: CanonicalRequestState,
  visibleDynamicKeys: string[] = [],
): { key: string; value: string; mode?: string }[] {
  return buildPublishAnswerFields({
    canonicalFields: state.fields,
    values: {},
    userTouchedKeys: [],
    dynamicFieldKeys: visibleDynamicKeys,
  });
}

type Outcome = {
  inFields: boolean;
  fieldsMode: string | null;
  clientResponse: string | null;
  serverResponse: string | null;
  serverConstraintMode: string | null;
  serverConstraintAuthority: string | null;
  attribute: string | null;
  rawInput: string;
};

function outcomeFor(key: string, field: CanonicalFieldState | null): Outcome {
  const state = withField(key, field);
  const projection = buildDiscoveryProjectionFromState(state);
  const fields = publishFields(state);
  const row = fields.find((f) => f.key === key) ?? null;
  const created = resolveCreateProjection({
    discoveryProjection: projection,
    rawInput: SCENE_TEXT,
    /* Sunucu kategoriyi KENDİ yazdığı alandan okur (D3f 3h). */
    category: { slug: projection.categoryId },
    fields,
  }).projection;
  return {
    inFields: row !== null,
    fieldsMode: row?.mode ?? null,
    clientResponse: projection.fieldResponses?.[key]?.kind ?? null,
    serverResponse: created?.fieldResponses?.[key]?.kind ?? null,
    serverConstraintMode: created?.constraints?.[key]?.mode ?? null,
    serverConstraintAuthority:
      created?.fieldAuthority?.[key]?.constraints ?? null,
    attribute: created?.attributes?.[key] ?? null,
    rawInput: String(state.understanding.rawInput ?? ""),
  };
}

/* ------------------------------------------------------------------ *
 * 1. BEŞ ORTAK ALAN × YEDİ MOD
 * ------------------------------------------------------------------ */

const MODES: readonly {
  id: string;
  field: CanonicalFieldState | null;
  expectInFields: boolean;
  expectFieldsMode: string | null;
  expectServerResponse: string | null;
  expectServerConstraintMode: string | null;
}[] = [
  {
    id: "untouched",
    field: null,
    expectInFields: false,
    expectFieldsMode: null,
    expectServerResponse: null,
    expectServerConstraintMode: null,
  },
  {
    id: "VALUE",
    field: { kind: "VALUE", value: "GERCEK", provenance: "EXPLICIT_BROWSE" },
    expectInFields: false,
    expectFieldsMode: null,
    expectServerResponse: null,
    expectServerConstraintMode: "VALUE",
  },
  {
    id: "ANY+EXPLICIT_BROWSE",
    field: { kind: "ANY", value: null, provenance: "EXPLICIT_BROWSE" },
    expectInFields: true,
    expectFieldsMode: "ANY",
    expectServerResponse: null,
    expectServerConstraintMode: "ANY",
  },
  {
    id: "UNKNOWN+EXPLICIT_TEXT",
    field: { kind: "UNKNOWN", value: null, provenance: "EXPLICIT_TEXT" },
    expectInFields: true,
    expectFieldsMode: "UNKNOWN",
    expectServerResponse: "UNKNOWN",
    expectServerConstraintMode: null,
  },
  {
    id: "UNKNOWN+EXPLICIT_BROWSE",
    field: { kind: "UNKNOWN", value: null, provenance: "EXPLICIT_BROWSE" },
    expectInFields: true,
    expectFieldsMode: "UNKNOWN",
    expectServerResponse: "UNKNOWN",
    expectServerConstraintMode: null,
  },
  {
    id: "NOT_APPLICABLE+EXPLICIT_BROWSE",
    field: {
      kind: "NOT_APPLICABLE",
      value: null,
      provenance: "EXPLICIT_BROWSE",
    },
    expectInFields: true,
    expectFieldsMode: "NOT_APPLICABLE",
    expectServerResponse: "NOT_APPLICABLE",
    expectServerConstraintMode: null,
  },
  {
    id: "UNKNOWN+INFERRED",
    field: { kind: "UNKNOWN", value: null, provenance: "INFERRED" },
    expectInFields: false,
    expectFieldsMode: null,
    expectServerResponse: null,
    expectServerConstraintMode: null,
  },
  {
    id: "ANY+INFERRED",
    field: { kind: "ANY", value: null, provenance: "INFERRED" },
    expectInFields: false,
    expectFieldsMode: null,
    expectServerResponse: null,
    /* Kurucu ANY constraint'i değeri korur; yalnız cevap kanalına girmez. */
    expectServerConstraintMode: "ANY",
  },
  {
    id: "NOT_APPLICABLE+INFERRED",
    field: {
      kind: "NOT_APPLICABLE",
      value: null,
      provenance: "INFERRED",
    },
    expectInFields: false,
    expectFieldsMode: null,
    expectServerResponse: null,
    expectServerConstraintMode: null,
  },
];

/**
 * ÜRETİLEN ALAN HİÇBİR YÜZEY ÜRETMEZ — daraltmanın karşıtı.
 *
 * Kapsamdan çıkarmak tek başına bir kanıt değildir; çıkarılan alanın
 * GERÇEKTEN sessiz kaldığı burada ölçülür.
 */
function measureGeneratedFieldsExcluded(): void {
  for (const key of GENERATED_KEYS) {
    for (const mode of ["UNKNOWN", "NOT_APPLICABLE", "ANY"] as const) {
      const outcome = outcomeFor(key, {
        kind: mode,
        value: null,
        provenance: "EXPLICIT_BROWSE",
      });
      const id = `A-generated:${key}/${mode}`;
      ok(`${id}/fields`, !outcome.inFields, "üretilen alan cevap kanalına girdi");
      ok(
        `${id}/response`,
        outcome.serverResponse === null,
        `üretilen alan cevap yüzeyi üretti → ${outcome.serverResponse}`,
      );
      ok(
        `${id}/constraint`,
        outcome.serverConstraintMode === null,
        `üretilen alan constraint üretti → ${outcome.serverConstraintMode}`,
      );
    }
  }
}

function measureCommonFieldMatrix(): void {
  for (const key of COMMON_KEYS) {
    for (const mode of MODES) {
      const id = `A:${key}/${mode.id}`;
      const o = outcomeFor(key, mode.field);

      ok(
        `${id}/fields`,
        o.inFields === mode.expectInFields,
        `fields[] üyeliği ${o.inFields} (beklenen ${mode.expectInFields})`,
      );
      ok(
        `${id}/mode`,
        (o.fieldsMode ?? null) === mode.expectFieldsMode,
        `fields[] modu '${String(o.fieldsMode)}' (beklenen '${String(mode.expectFieldsMode)}')`,
      );
      ok(
        `${id}/server-response`,
        (o.serverResponse ?? null) === mode.expectServerResponse,
        `server fieldResponses '${String(o.serverResponse)}' (beklenen '${String(mode.expectServerResponse)}')`,
      );
      ok(
        `${id}/server-constraint`,
        (o.serverConstraintMode ?? null) === mode.expectServerConstraintMode,
        `server constraint modu '${String(o.serverConstraintMode)}' (beklenen '${String(mode.expectServerConstraintMode)}')`,
      );
      ok(
        `${id}/attribute-sizinti`,
        mode.id === "VALUE" || o.attribute === null,
        `attributes sızıntısı → '${String(o.attribute)}'`,
      );
      ok(`${id}/rawInput`, o.rawInput === SCENE_TEXT, "rawInput değişti");
    }

    /* ANY bilinçliyse otoritesi de sunucuda türetilmelidir. */
    const anyOutcome = outcomeFor(key, {
      kind: "ANY",
      value: null,
      provenance: "EXPLICIT_BROWSE",
    });
    ok(
      `A:${key}/ANY-authority`,
      anyOutcome.serverConstraintAuthority === "USER_EXPLICIT",
      `ANY constraint otoritesi '${String(anyOutcome.serverConstraintAuthority)}'`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * 2. TEK KAYIT, TEK KURUCU
 * ------------------------------------------------------------------ */

function measureNoDuplicates(): void {
  /* Ortak alan aynı anda görünür dinamik alan olarak da verilirse iki kez
   * eklenmemelidir; liste tek kurucudan çıkar. */
  for (const key of COMMON_KEYS) {
    const state = withField(key, {
      kind: "UNKNOWN",
      value: null,
      provenance: "EXPLICIT_BROWSE",
    });
    const fields = publishFields(state, [key, "energyClass"]);
    const count = fields.filter((f) => f.key === key).length;
    ok(`B:${key}`, count === 1, `fields[] içinde ${count} kez göründü`);
  }

  /* Dinamik alanların mevcut davranışı korunur. */
  const dynState = withField("energyClass", {
    kind: "UNKNOWN",
    value: null,
    provenance: "EXPLICIT_BROWSE",
  });
  const dynFields = publishFields(dynState, ["energyClass"]);
  ok(
    "B:dinamik",
    dynFields.filter((f) => f.key === "energyClass").length === 1,
    "dinamik alan kaydı tekil değil",
  );
}

/* ------------------------------------------------------------------ *
 * 3. ANAHTAR GÜVENLİĞİ
 * ------------------------------------------------------------------ */

/**
 * Cevap kanalı bir KULLANICI BEYANIDIR ama uydurma bir alan adı bir cevap
 * yüzeyi üretemez. Ölçüldü (D3f keşif): `{key:"__hack__", mode:"UNKNOWN"}`
 * sunucu sınırından geçip `fieldResponses.__hack__` üretiyordu.
 */
function measureKeySafety(): void {
  const projection = buildDiscoveryProjectionFromState(sceneState());
  const FORGED = [
    "__hack__",
    "uydurmaAlan",
    "brandCandidate",
    "brandEvidence",
    "__proto__",
    "constructor",
    "prototype",
  ];
  for (const key of FORGED) {
    const created = resolveCreateProjection({
      discoveryProjection: projection,
      rawInput: SCENE_TEXT,
      /* Sunucu kategoriyi KENDİ yazdığı alandan okur (D3f 3h). */
      category: { slug: projection.categoryId },
      fields: [{ key, value: "", mode: "UNKNOWN" }],
    }).projection;
    ok(
      `C:'${key}'`,
      created?.fieldResponses?.[key] === undefined,
      `uydurma anahtar cevap yüzeyi üretti → ${JSON.stringify(created?.fieldResponses ?? null)}`,
    );
  }

  /* Kanonik anahtarlar (ortak alan + kategori alanı) geçmeye devam eder. */
  for (const key of [...COMMON_KEYS, "energyClass", "brand"]) {
    const created = resolveCreateProjection({
      discoveryProjection: projection,
      rawInput: SCENE_TEXT,
      /* Sunucu kategoriyi KENDİ yazdığı alandan okur (D3f 3h). */
      category: { slug: projection.categoryId },
      fields: [{ key, value: "", mode: "UNKNOWN" }],
    }).projection;
    ok(
      `C-ok:'${key}'`,
      created?.fieldResponses?.[key]?.kind === "UNKNOWN",
      `kanonik anahtar reddedildi → ${JSON.stringify(created?.fieldResponses ?? null)}`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * 4. CREATE / UPDATE / CLONE EŞİTLİĞİ
 * ------------------------------------------------------------------ */

function measureWritePaths(): void {
  for (const key of COMMON_KEYS) {
    const state = withField(key, {
      kind: "UNKNOWN",
      value: null,
      provenance: "EXPLICIT_BROWSE",
    });
    const projection = buildDiscoveryProjectionFromState(state);
    const fields = publishFields(state);

    const created = resolveCreateProjection({
      discoveryProjection: projection,
      rawInput: SCENE_TEXT,
      /* Sunucu kategoriyi KENDİ yazdığı alandan okur (D3f 3h). */
      category: { slug: projection.categoryId },
      fields,
    }).projection;
    const updated = resolveUpdateProjection(
      { discoveryProjection: projection, rawInput: SCENE_TEXT, fields },
      SCENE_TEXT,
    );
    ok(
      `D:${key}/create-update`,
      JSON.stringify(created?.fieldResponses) ===
        JSON.stringify(updated?.fieldResponses),
      "create ve update farklı sonuç verdi",
    );
    ok(
      `D:${key}/create`,
      created?.fieldResponses?.[key]?.authority === "USER_EXPLICIT",
      `create otoritesi '${String(created?.fieldResponses?.[key]?.authority)}'`,
    );

    /* CLONE yeni beyan üretmez. */
    const cloned = resolveCloneProjection({
      discoveryProjection: created,
      rawInput: SCENE_TEXT,
    });
    ok(
      `D:${key}/clone`,
      cloned?.fieldResponses === undefined,
      `clone cevap yüzeyi taşıdı → ${JSON.stringify(cloned?.fieldResponses ?? null)}`,
    );

    /* MUTASYONSUZ + İDEMPOTENT. */
    const before = JSON.stringify(projection);
    const twice = resolveCreateProjection({
      discoveryProjection: created as RequestDiscoveryProjection,
      rawInput: SCENE_TEXT,
      fields,
    }).projection;
    ok(
      `D:${key}/mutasyon`,
      JSON.stringify(projection) === before,
      "girdi mutate edildi",
    );
    ok(
      `D:${key}/idempotent`,
      JSON.stringify(twice?.fieldResponses) ===
        JSON.stringify(created?.fieldResponses),
      "idempotent değil",
    );
  }
}

/* ------------------------------------------------------------------ *
 * 5. VARSAYILAN CORPUS KORUMASI
 * ------------------------------------------------------------------ */

function measureCorpus(): {
  scenarios: number;
  fields: number;
  unknown: number;
  extraRows: number;
  responses: number;
  attributes: number;
  constraints: number;
} {
  let scenarios = 0;
  let fields = 0;
  let unknown = 0;
  let extraRows = 0;
  let responses = 0;
  let attributes = 0;
  let constraints = 0;

  for (const scenario of CATEGORY_COVERAGE_V1) {
    const text = String(scenario.input ?? "");
    if (!text) continue;
    scenarios++;
    const state = createTextOnlyState(text);
    for (const field of Object.values(state.fields)) {
      fields++;
      if (field.kind === "UNKNOWN") unknown++;
    }
    const projection = buildDiscoveryProjectionFromState(state);
    attributes += Object.keys(projection.attributes ?? {}).length;
    constraints += Object.keys(projection.constraints ?? {}).length;
    responses += Object.keys(projection.fieldResponses ?? {}).length;
    /* Görünür dinamik alan yokken kurucu TEK BİR ek kayıt bile üretmemeli. */
    extraRows += publishFields(state).length;
  }

  ok("E1", scenarios === 108, `senaryo sayısı değişti → ${scenarios}`);
  ok("E2", fields === 1279, `kanonik alan sayısı değişti → ${fields}`);
  ok("E3", unknown === 988, `varsayılan UNKNOWN değişti → ${unknown}`);
  ok("E4", extraRows === 0, `varsayılan durumda fields[] kaydı → ${extraRows}`);
  ok("E5", responses === 0, `varsayılan durumda cevap yüzeyi → ${responses}`);
  ok("E6", attributes === 255, `attributes tabanı kaydı → ${attributes}`);
  ok("E7", constraints === 255, `constraints tabanı kaydı → ${constraints}`);

  return {
    scenarios,
    fields,
    unknown,
    extraRows,
    responses,
    attributes,
    constraints,
  };
}

/* ------------------------------------------------------------------ *
 * RAPOR
 * ------------------------------------------------------------------ */

function main(): void {
  console.log("===== ORTAK ALAN CEVAP KANALI V1 =====");
  console.log(`COMMON_KEYS=${COMMON_KEYS.join(",")} (kanonik registry)`);

  measureGeneratedFieldsExcluded();
  measureCommonFieldMatrix();
  measureNoDuplicates();
  measureKeySafety();
  measureWritePaths();
  const corpus = measureCorpus();

  console.log(
    `CORPUS scenarios=${corpus.scenarios} fields=${corpus.fields} ` +
      `default_unknown=${corpus.unknown} extra_field_rows=${corpus.extraRows} ` +
      `field_responses=${corpus.responses} attributes=${corpus.attributes} ` +
      `constraints=${corpus.constraints}`,
  );
  console.log(`PROBLEMS=${problems.length}`);

  console.log("\n===== HUKUM =====");
  if (problems.length) {
    console.error("KIRMIZI — ortak alan cevaplari sunucuya ulasmiyor:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    "YESIL — bes ortak alanin bilincli deger tasimayan cevaplari mevcut\n" +
      "fields[] kanalindan sunucuya ulasiyor ve orada yeniden turetiliyor;\n" +
      "explicit UNKNOWN/NOT_APPLICABLE cevap yuzeyi, ANY ise kendi constraint\n" +
      "kanali ve USER_EXPLICIT otoritesi uretiyor; cikarimdan gelen kayit\n" +
      "hicbir sey uretmiyor; VALUE davranisi degismiyor; uydurma anahtar\n" +
      "cevap yuzeyi uretemiyor; kayitlar tekil, create ve update esit, clone\n" +
      "fail-closed, islem mutasyonsuz ve idempotent; varsayilan corpus tek\n" +
      "kayit bile eklemiyor ve rawInput degismiyor.\n" +
      "\nKAPSAM DISI (olculmedi): RequestFieldValue kaliciligi, edit/reload\n" +
      "state kurulumu, clone geri yukleme ve parseBudgetRange / dedicated\n" +
      "kolon davranisi — Dilim 3.",
  );
  process.exit(0);
}

main();
