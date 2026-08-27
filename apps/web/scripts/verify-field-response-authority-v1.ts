/**
 * CEVAP-DİSPOSİTİON YÜZEYİ OTORİTESİ V1 — D3f Dilim 2 (2026-08-27).
 *
 * SORUN. Dilim 1 kullanıcının bilinçli "Bilmiyorum" / "Uygulanamaz" cevabını
 * kanonik durumda ayırdı: soru kapanıyor, etiket hiçbir yüzeye sızmıyor. Ama
 * o cevabın KALICI bir yüzeyi yoktu. Ölçüldü (kapanış denetimi, 2026-08-27):
 *
 *   - `attributes` yüzeyi YOK (doğru — ürün özelliği değil),
 *   - `constraints` yüzeyi YOK (`build-projection` bu iki modu hiç yazmıyor),
 *   - dolayısıyla sunucu güven sınırında damgalanabileceği bir iddia da yok
 *     ve `resolveServerFieldAuthority` fail-closed `UNKNOWN` bırakıyordu.
 *
 * Sonuç: kalıcı projection'da "kullanıcı bilmiyorum dedi" ile "hiç sorulmadı"
 * hâlâ ayırt edilemiyordu. Admin paneli gerçek veri eksikliğini bilinçli
 * kullanıcı tercihinden ayıramıyor, Maira ise cevabı yalnız oturum içinde
 * hatırlıyordu.
 *
 * KARAR. Matching kısıtlarından AYRI, additive ve tipli bir cevap-disposition
 * yüzeyi: `fieldResponses`. Bu yüzey bir ÜRÜN ÖZELLİĞİ DEĞİLDİR ve bu
 * dilimde routing / filtreleme / skorlama kararına BAĞLANMAZ.
 *
 *   - Yalnız `isDeliberateNonValueAnswer` true olan `UNKNOWN` ve
 *     `NOT_APPLICABLE` kayıtları girer.
 *   - `ANY` GİRMEZ: onun kendi kanalı var (`constraints` → `mode:"ANY"`).
 *   - Varsayılan / çıkarımdan gelen `UNKNOWN` (108 senaryoda 988 alan)
 *     HİÇBİR yüzey üretmez.
 *   - Bir anahtar aynı anda yalnız TEK yüzeyde bulunabilir.
 *
 * SUNUCU GÜVEN SINIRI. İstemcinin gönderdiği `fieldResponses` `fieldAuthority`
 * ile AYNI muameleyi görür: tamamen atılır ve yalnız sunucunun doğrulanmış
 * cevap kanalından (`fields[]` → `mode`) yeniden türetilir. Clone yeni bir
 * kullanıcı beyanı üretmez.
 *
 * SALT-OKUNUR. Hiçbir veritabanı yazımı yapılmaz; ölçüm gerçek yayın
 * zincirinin ÜRETİM fonksiyonlarıyla yapılır.
 *
 * KAPSAM DIŞI (ölçülmedi): `RequestFieldValue` üzerinde mod kalıcılığı ve
 * edit/clone sonrası geri yükleme — Dilim 3. Bu YEŞİL, kullanıcının cevabının
 * reload sonrası geri geldiğini KAPSAMAZ.
 */

import { buildDiscoveryProjectionFromState } from "../src/lib/discovery/build-projection";
import {
  projectionAnswerChannel,
  resolveCloneProjection,
  resolveCreateProjection,
  resolveServerFieldAuthority,
  resolveUpdateProjection,
} from "../src/lib/discovery/server-authority";
import type {
  ProjectionFieldResponse,
  RequestDiscoveryProjection,
} from "../src/lib/discovery/types";
import { parseDiscoveryProjection } from "../src/lib/discovery/validate-filter";
import {
  buildPublishFieldValues,
  createTextOnlyState,
  syncFromBrowse,
} from "../src/lib/request-composer";
import { isDeliberateNonValueAnswer } from "../src/lib/request-composer/answer-authority";
import type {
  CanonicalFieldState,
  CanonicalRequestState,
} from "../src/lib/request-composer/types";
import { FIELD_SENTINEL } from "../src/lib/request-composer/types";
import { CATEGORY_COVERAGE_V1 } from "./fixtures/category-coverage-v1";

const problems: string[] = [];

function ok(id: string, condition: boolean, detail: string): void {
  if (!condition) problems.push(`${id}: ${detail}`);
}

const SCENE_TEXT = "İstanbul'da ikinci el buzdolabı arıyorum, bütçem 15000 TL";
const SCENE_KEY = "energyClass";

function sceneState(): CanonicalRequestState {
  return createTextOnlyState(SCENE_TEXT);
}

function withField(
  state: CanonicalRequestState,
  key: string,
  field: CanonicalFieldState,
): CanonicalRequestState {
  return { ...state, fields: { ...state.fields, [key]: field } };
}

function responseOf(
  projection: RequestDiscoveryProjection | null | undefined,
  key: string,
): ProjectionFieldResponse | undefined {
  return projection?.fieldResponses?.[key];
}

/* ------------------------------------------------------------------ *
 * 1. KURUCU — HANGİ KAYIT YÜZEY ÜRETİR?
 * ------------------------------------------------------------------ */

function measureBuilderMatrix(): void {
  const CASES: readonly {
    id: string;
    field: CanonicalFieldState | null;
    expectResponse: ProjectionFieldResponse | null;
  }[] = [
    { id: "A1 untouched", field: null, expectResponse: null },
    {
      id: "A2 UNKNOWN+INFERRED",
      field: { kind: "UNKNOWN", value: null, provenance: "INFERRED" },
      expectResponse: null,
    },
    {
      id: "A3 UNKNOWN+CATALOG_ENRICHED",
      field: { kind: "UNKNOWN", value: null, provenance: "CATALOG_ENRICHED" },
      expectResponse: null,
    },
    {
      id: "A4 UNKNOWN+EXPLICIT_TEXT",
      field: { kind: "UNKNOWN", value: null, provenance: "EXPLICIT_TEXT" },
      expectResponse: { kind: "UNKNOWN", authority: "USER_EXPLICIT" },
    },
    {
      id: "A5 UNKNOWN+EXPLICIT_BROWSE",
      field: { kind: "UNKNOWN", value: null, provenance: "EXPLICIT_BROWSE" },
      expectResponse: { kind: "UNKNOWN", authority: "USER_EXPLICIT" },
    },
    {
      id: "A6 NOT_APPLICABLE+EXPLICIT_BROWSE",
      field: { kind: "NOT_APPLICABLE", value: null, provenance: "EXPLICIT_BROWSE" },
      expectResponse: { kind: "NOT_APPLICABLE", authority: "USER_EXPLICIT" },
    },
    {
      id: "A7 NOT_APPLICABLE+INFERRED",
      field: { kind: "NOT_APPLICABLE", value: null, provenance: "INFERRED" },
      expectResponse: null,
    },
    {
      id: "A8 ANY+EXPLICIT_BROWSE",
      field: { kind: "ANY", value: null, provenance: "EXPLICIT_BROWSE" },
      expectResponse: null,
    },
    {
      id: "A9 VALUE+EXPLICIT_BROWSE",
      field: { kind: "VALUE", value: "A++", provenance: "EXPLICIT_BROWSE" },
      expectResponse: null,
    },
  ];

  for (const c of CASES) {
    const state = c.field
      ? withField(sceneState(), SCENE_KEY, c.field)
      : sceneState();
    const projection = buildDiscoveryProjectionFromState(state);
    const response = responseOf(projection, SCENE_KEY);

    ok(
      `${c.id}/response`,
      JSON.stringify(response ?? null) === JSON.stringify(c.expectResponse),
      `fieldResponses beklenen ${JSON.stringify(c.expectResponse)} ama ${JSON.stringify(response ?? null)}`,
    );

    /**
     * TEK YÜZEY KURALI — CEVAP DİSPOZİSYONU İLE DEĞER YÜZEYLERİ AYRIKTIR.
     *
     * `attributes` ve `constraints` bir DEĞERİN iki görünümüdür ve birlikte
     * bulunmaları mevcut, doğru davranıştır (kapsam tabanında 255 = 255).
     * Kural, `fieldResponses` ile o değer yüzeyleri arasındadır: "kullanıcı
     * değer vermedi" cevabı ile bir değer iddiası aynı anda doğru olamaz.
     */
    const valueSurfaces = [
      projection.attributes?.[SCENE_KEY] !== undefined ? "attributes" : null,
      projection.constraints?.[SCENE_KEY] !== undefined ? "constraints" : null,
    ].filter(Boolean);
    ok(
      `${c.id}/tek-yuzey`,
      response === undefined || valueSurfaces.length === 0,
      `cevap dispozisyonu değer yüzeyiyle birlikte var: ${valueSurfaces.join("+")}`,
    );

    /* ANY kendi kanalında KALIR. */
    if (c.field?.kind === "ANY") {
      ok(
        `${c.id}/any-kanali`,
        projection.constraints?.[SCENE_KEY]?.mode === "ANY",
        "ANY constraint kanalını kaybetti",
      );
    }
    /* VALUE mevcut davranışını korur. */
    if (c.field?.kind === "VALUE") {
      ok(
        `${c.id}/value-kanali`,
        projection.attributes?.[SCENE_KEY] === "A++",
        "VALUE attributes yüzeyini kaybetti",
      );
    }
    ok(
      `${c.id}/rawInput`,
      String(state.understanding.rawInput ?? "") === SCENE_TEXT,
      "rawInput değişti",
    );
  }
}

/* ------------------------------------------------------------------ *
 * 2. UI YOLLARI — "Bilmiyorum" ve "Uygulanamaz"
 * ------------------------------------------------------------------ */

function measureUiPaths(): void {
  const LABELS = [
    "Belirtilmedi",
    "Henüz bilmiyorum",
    "bilmiyorum",
    "unknown",
    "Uygulanamaz",
  ];

  for (const label of LABELS) {
    for (const kind of ["UNKNOWN", "NOT_APPLICABLE"] as const) {
      const state = syncFromBrowse(sceneState(), {
        key: SCENE_KEY,
        value: label,
        kind,
      }).state;
      const projection = buildDiscoveryProjectionFromState(state);
      const response = responseOf(projection, SCENE_KEY);
      const id = `B:${kind}/'${label}'`;

      ok(
        `${id}/1`,
        response?.kind === kind && response?.authority === "USER_EXPLICIT",
        `yüzey üretilmedi → ${JSON.stringify(response ?? null)}`,
      );
      ok(
        `${id}/2`,
        projection.attributes?.[SCENE_KEY] === undefined,
        "attributes sızıntısı",
      );
      ok(
        `${id}/3`,
        !Object.values(projection.attributes ?? {}).includes(label),
        "etiket başka bir attribute'a sızdı",
      );
      ok(
        `${id}/4`,
        projection.constraints?.[SCENE_KEY] === undefined,
        "constraint yüzeyi oluştu",
      );
      ok(
        `${id}/5`,
        String(state.understanding.rawInput ?? "") === SCENE_TEXT,
        "rawInput değişti",
      );
    }
  }

  /* Sentinel hiçbir yerde VALUE olmaz ve etiket olarak da sızmaz. */
  const naState = syncFromBrowse(sceneState(), {
    key: SCENE_KEY,
    value: FIELD_SENTINEL.NOT_APPLICABLE,
    kind: "NOT_APPLICABLE",
  }).state;
  const naProjection = buildDiscoveryProjectionFromState(naState);
  ok(
    "B-sentinel/1",
    !Object.values(naProjection.attributes ?? {}).includes(
      FIELD_SENTINEL.NOT_APPLICABLE,
    ),
    "ham sentinel attributes torbasına sızdı",
  );
  ok(
    "B-sentinel/2",
    responseOf(naProjection, SCENE_KEY)?.kind === "NOT_APPLICABLE",
    "sentinel yolu cevap yüzeyi üretmedi",
  );
}

/* ------------------------------------------------------------------ *
 * 3. SUNUCU GÜVEN SINIRI — SALDIRI MATRİSİ
 * ------------------------------------------------------------------ */

/** Sunucunun kalıcılaştırdığı süzülmüş cevap kanalı (`fields[]`). */
function answersFor(
  state: CanonicalRequestState,
): { key: string; value: string; mode: string }[] {
  const publish = buildPublishFieldValues({
    canonicalFields: state.fields,
    values: {},
    userTouchedKeys: [],
  });
  return Object.entries(publish).map(([key, answer]) => ({
    key,
    value: answer.value,
    mode: answer.mode,
  }));
}

function measureServerBoundary(): void {
  const state = withField(sceneState(), SCENE_KEY, {
    kind: "UNKNOWN",
    value: null,
    provenance: "EXPLICIT_BROWSE",
  });
  const honest = buildDiscoveryProjectionFromState(state);
  const fields = answersFor(state);

  /* (a) Dürüst yol: sunucu kendi cevap kanalından yeniden türetir. */
  const created = resolveCreateProjection({
    discoveryProjection: honest,
    rawInput: SCENE_TEXT,
    fields,
  }).projection;
  ok(
    "C1",
    responseOf(created, SCENE_KEY)?.kind === "UNKNOWN" &&
      responseOf(created, SCENE_KEY)?.authority === "USER_EXPLICIT",
    `create yolu yüzeyi türetmedi → ${JSON.stringify(responseOf(created, SCENE_KEY) ?? null)}`,
  );

  const updated = resolveUpdateProjection(
    { discoveryProjection: honest, rawInput: SCENE_TEXT, fields },
    SCENE_TEXT,
  );
  ok(
    "C2",
    responseOf(updated, SCENE_KEY)?.kind === "UNKNOWN",
    `update yolu yüzeyi türetmedi → ${JSON.stringify(responseOf(updated, SCENE_KEY) ?? null)}`,
  );

  /* (b) CLONE yeni kullanıcı beyanı üretmez — cevap kanalı yoktur. */
  const cloned = resolveCloneProjection({
    discoveryProjection: created,
    rawInput: SCENE_TEXT,
  });
  ok(
    "C3",
    cloned?.fieldResponses === undefined,
    `clone eski cevap metadata'sını kopyaladı → ${JSON.stringify(cloned?.fieldResponses ?? null)}`,
  );

  /* (c) SALDIRI MATRİSİ — istemci kopyası hiçbir koşulda kabul edilmez. */
  const forged: readonly { id: string; payload: unknown }[] = [
    {
      id: "D1 sahte USER_EXPLICIT",
      payload: { [SCENE_KEY]: { kind: "UNKNOWN", authority: "USER_EXPLICIT" } },
    },
    {
      id: "D2 sahte VERIFIED",
      payload: { [SCENE_KEY]: { kind: "UNKNOWN", authority: "VERIFIED" } },
    },
    {
      id: "D3 uydurma anahtar",
      payload: { __proto__: { kind: "UNKNOWN", authority: "USER_EXPLICIT" } },
    },
    {
      id: "D4 iç kanıt anahtarı",
      payload: {
        brandCandidate: { kind: "UNKNOWN", authority: "USER_EXPLICIT" },
      },
    },
    {
      id: "D5 geçersiz kind",
      payload: { [SCENE_KEY]: { kind: "MAYBE", authority: "USER_EXPLICIT" } },
    },
    {
      id: "D6 ANY yüzeye taşınmış",
      payload: { [SCENE_KEY]: { kind: "ANY", authority: "USER_EXPLICIT" } },
    },
    { id: "D7 dizi", payload: [{ kind: "UNKNOWN" }] },
    { id: "D8 metin", payload: "UNKNOWN" },
    { id: "D9 bozuk nesne", payload: { [SCENE_KEY]: null } },
    { id: "D10 sayı", payload: 42 },
  ];

  /* Cevap kanalı BOŞ: sunucu hiçbir yüzey türetememeli. */
  for (const attack of forged) {
    const tainted = {
      ...buildDiscoveryProjectionFromState(sceneState()),
      fieldResponses: attack.payload,
    } as unknown as RequestDiscoveryProjection;
    const normalized = resolveServerFieldAuthority({
      projection: tainted,
      rawInput: SCENE_TEXT,
      answers: {},
    });
    ok(
      attack.id,
      normalized?.fieldResponses === undefined,
      `sahte istemci yüzeyi geçti → ${JSON.stringify(normalized?.fieldResponses ?? null)}`,
    );
  }

  /* (d) Cevap kanalı DOLU olsa bile istemci kopyası değil sunucu türetimi kazanır. */
  const taintedButHonest = {
    ...honest,
    fieldResponses: {
      [SCENE_KEY]: { kind: "NOT_APPLICABLE", authority: "VERIFIED" },
      uydurmaAlan: { kind: "UNKNOWN", authority: "USER_EXPLICIT" },
    },
  } as unknown as RequestDiscoveryProjection;
  const rederived = resolveServerFieldAuthority({
    projection: taintedButHonest,
    rawInput: SCENE_TEXT,
    answers: projectionAnswerChannel(fields),
  });
  ok(
    "D11",
    responseOf(rederived, SCENE_KEY)?.kind === "UNKNOWN",
    `istemcinin yazdığı kind kazandı → ${JSON.stringify(responseOf(rederived, SCENE_KEY) ?? null)}`,
  );
  ok(
    "D12",
    responseOf(rederived, SCENE_KEY)?.authority === "USER_EXPLICIT",
    "otorite kanonik türetimden gelmedi",
  );
  ok(
    "D13",
    rederived?.fieldResponses?.uydurmaAlan === undefined,
    "uydurma anahtar haritada kaldı",
  );

  /* (e) MUTASYONSUZ ve İDEMPOTENT. */
  const beforeJson = JSON.stringify(taintedButHonest);
  const twice = resolveServerFieldAuthority({
    projection: rederived,
    rawInput: SCENE_TEXT,
    answers: projectionAnswerChannel(fields),
  });
  ok(
    "D14",
    JSON.stringify(taintedButHonest) === beforeJson,
    "güven sınırı girdiyi mutate etti",
  );
  ok(
    "D15",
    JSON.stringify(twice?.fieldResponses) ===
      JSON.stringify(rederived?.fieldResponses),
    "idempotent değil",
  );

  /* (f) DEĞER PAYLOAD'I DEĞİŞMEZ. */
  ok(
    "D16",
    JSON.stringify(rederived?.attributes) === JSON.stringify(honest.attributes) &&
      JSON.stringify(rederived?.constraints) ===
        JSON.stringify(honest.constraints),
    "güven sınırı değer torbalarını değiştirdi",
  );
}

/* ------------------------------------------------------------------ *
 * 4. OKUMA SINIRI — LEGACY VE BOZUK KAYIT
 * ------------------------------------------------------------------ */

function measureReadBoundary(): void {
  const legacy = {
    version: 1,
    kind: "discovery_projection",
    taxonomyNodeIds: [],
    attributes: {},
    constraints: {},
  };
  let parsed: RequestDiscoveryProjection | null = null;
  try {
    parsed = parseDiscoveryProjection(legacy);
  } catch {
    ok("E1", false, "legacy kayıt okuma sınırında throw etti");
  }
  ok("E2", parsed !== null, "legacy kayıt reddedildi");
  ok(
    "E3",
    parsed?.fieldResponses === undefined,
    "alanı olmayan kayıt için yüzey uyduruldu",
  );

  for (const broken of [
    { ...legacy, fieldResponses: "bozuk" },
    { ...legacy, fieldResponses: [1, 2, 3] },
    { ...legacy, fieldResponses: { a: { kind: "NOPE", authority: "X" } } },
    { ...legacy, fieldResponses: null },
  ]) {
    let threw = false;
    let out: RequestDiscoveryProjection | null = null;
    try {
      out = parseDiscoveryProjection(broken);
    } catch {
      threw = true;
    }
    ok(
      `E4:${JSON.stringify(broken.fieldResponses)}`,
      !threw,
      "bozuk giriş okuma sınırında throw etti",
    );
    /* Okuma sınırı yalnız TAŞIR; güvenilirlik kararı yazma sınırında verilir.
     * Tanınmayan kind/authority hiçbir koşulda geçerli cevap sayılamaz. */
    const responses = out?.fieldResponses;
    if (responses && typeof responses === "object" && !Array.isArray(responses)) {
      for (const [key, value] of Object.entries(responses)) {
        const valid =
          value !== null &&
          typeof value === "object" &&
          (value.kind === "UNKNOWN" || value.kind === "NOT_APPLICABLE") &&
          value.authority === "USER_EXPLICIT";
        ok(
          `E5:${key}`,
          !valid,
          "tanınmayan kayıt geçerli cevap gibi okundu",
        );
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * 5. VARSAYILAN 988 KORUMASI
 * ------------------------------------------------------------------ */

function measureCorpus(): {
  scenarios: number;
  fields: number;
  unknown: number;
  responses: number;
  attributes: number;
  constraints: number;
} {
  let scenarios = 0;
  let fields = 0;
  let unknown = 0;
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
      if (isDeliberateNonValueAnswer(field)) {
        ok(
          "F-corpus",
          false,
          "corpus'ta bilinçli değer taşımayan cevap belirdi",
        );
      }
    }
    const projection = buildDiscoveryProjectionFromState(state);
    attributes += Object.keys(projection.attributes ?? {}).length;
    constraints += Object.keys(projection.constraints ?? {}).length;
    responses += Object.keys(projection.fieldResponses ?? {}).length;
  }

  ok("F1", scenarios === 108, `senaryo sayısı değişti → ${scenarios}`);
  ok("F2", fields === 1279, `kanonik alan sayısı değişti → ${fields}`);
  ok("F3", unknown === 988, `varsayılan UNKNOWN değişti → ${unknown}`);
  ok(
    "F4",
    responses === 0,
    `varsayılan UNKNOWN cevap yüzeyi üretti → ${responses}`,
  );
  ok("F5", attributes === 255, `attributes tabanı kaydı → ${attributes}`);
  ok("F6", constraints === 255, `constraints tabanı kaydı → ${constraints}`);

  return { scenarios, fields, unknown, responses, attributes, constraints };
}

/* ------------------------------------------------------------------ *
 * RAPOR
 * ------------------------------------------------------------------ */

function main(): void {
  console.log("===== CEVAP-DISPOSITION YUZEYI OTORITESI V1 =====");

  measureBuilderMatrix();
  measureUiPaths();
  measureServerBoundary();
  measureReadBoundary();
  const corpus = measureCorpus();

  console.log(`SCENE=${SCENE_KEY}@appliances`);
  console.log(
    `CORPUS scenarios=${corpus.scenarios} fields=${corpus.fields} ` +
      `default_unknown=${corpus.unknown} field_responses=${corpus.responses} ` +
      `attributes=${corpus.attributes} constraints=${corpus.constraints}`,
  );
  console.log(`PROBLEMS=${problems.length}`);

  console.log("\n===== HUKUM =====");
  if (problems.length) {
    console.error("KIRMIZI — acik non-value cevaplar kalici yuzey uretmiyor:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    "YESIL — acik kullanici kaynakli UNKNOWN ve NOT_APPLICABLE additive\n" +
      "fieldResponses yuzeyinde tasiniyor; ANY kendi constraint kanalinda\n" +
      "kaliyor; VALUE attributes/constraints davranisini koruyor; bir anahtar\n" +
      "yalniz tek yuzeyde bulunuyor; varsayilan 988 UNKNOWN hicbir yuzey\n" +
      "uretmiyor; istemcinin gonderdigi fieldResponses tamamen atilip sunucu\n" +
      "cevap kanalindan yeniden turetiliyor; sahte otorite/kind/anahtar ve\n" +
      "bozuk sekiller fail-closed dusuyor; clone yeni beyan uretmiyor; okuma\n" +
      "sinirinda legacy kayit uyumlu ve bozuk giris throw etmiyor; rawInput\n" +
      "degismiyor.\n" +
      "\nKAPSAM DISI (olculmedi): RequestFieldValue mod kaliciligi ve\n" +
      "edit/clone sonrasi geri yukleme (Dilim 3). Bu yuzey henuz routing,\n" +
      "filtreleme, Matching V3 ya da skorlama kararina BAGLANMADI.",
  );
  process.exit(0);
}

main();
