/**
 * ÜRETİLEN ALAN CEVAP TAŞIMAZ V1 — D3f Dilim 3g (2026-08-28).
 *
 * ÜRÜN KARARI (kurucu). Talep başlığı kullanıcıya "Bilmiyorum / Fark etmez /
 * Uygulanamaz" diye sorulan bir CEVAP alanı DEĞİLDİR; talebin gerçek
 * içeriğinden kanonik başlık üreticisiyle otomatik oluşturulan bir ETİKETTİR.
 *
 * ÖLÇÜLEN DURUM (2026-08-28, bu doğrulayıcıdan önce). `title` için değer
 * taşımayan bir cevap dört ayrı yolda yüzey üretebiliyordu:
 *
 *   composer/projection : fieldResponses.title = {UNKNOWN, USER_EXPLICIT}
 *                         constraints.title    = {mode:"ANY"}
 *   yayın kanalı        : fields[] içinde {key:"title", mode:"UNKNOWN"}
 *   kalıcılık           : RequestFieldValue jsonValue = {mode:"UNKNOWN"}
 *   sunucu              : sahte istemci cevabı da aynen kabul ediliyordu
 *
 * Sonuç anlamsız bir kayıttı: `Request.title` gerçek bir başlık taşırken
 * projection "kullanıcı kendi başlığını bilmiyor" diyordu — çelişkili çift
 * yüzey.
 *
 * KURAL ALAN ADINDAN DEĞİL YETENEKTEN TÜRER. Dağınık `key === "title"`
 * istisnaları ya da ikinci bir allowlist kurulmaz: kanonik ortak alan
 * registry'si bir alanın ÜRETİLEN bir etiket olduğunu söyler
 * (`isGeneratedCommonField`) ve cevap taşıyan bütün yollar o tek gerçeği
 * okur. Bu, üç ayrı yerde tekrarlanan `title` literalini de tekilleştirir.
 *
 * KORUNAN SÖZLEŞMELER. `Request.title` NOT NULL'dır ve dokunulmaz; otomatik
 * başlık üretimi (`composeRequestTitle`) aynen çalışır; `rawInput` değişmez;
 * yeniden onay akışının dört alanı (`budget`/`city`/`delivery`/`quantity`)
 * etkilenmez. MIGRATION YOKTUR.
 *
 * SALT-OKUNUR. Veritabanına yazılmaz, tarayıcı çalıştırılmaz; ölçüm üretim
 * fonksiyonları üzerinden yapılır. GERÇEK DB ve TARAYICI kabulü bu turda
 * NOT-MEASURED'dır.
 */

import { buildDiscoveryProjectionFromState } from "../src/lib/discovery/build-projection";
import {
  resolveCloneProjection,
  resolveCreateProjection,
  resolveUpdateProjection,
} from "../src/lib/discovery/server-authority";
import { composeRequestTitle } from "../src/lib/ai/request-text-composer";
import {
  COMMON_FIELD_DEFAULTS,
  isGeneratedCommonField,
} from "../src/lib/request-category-engine";
import {
  applyPublishAnswersToState,
  buildPublishAnswerFields,
  createTextOnlyState,
  syncFromBrowse,
} from "../src/lib/request-composer";
import { isReconfirmableCommonKey } from "../src/lib/request-composer/answer-authority";
import type { PublishFieldAnswer } from "../src/lib/request-composer/ui-helpers";
import { cloneAnswerChannel, mapFieldValue } from "../src/server/request/mapper";
import { CATEGORY_COVERAGE_V1 } from "./fixtures/category-coverage-v1";

const problems: string[] = [];

function ok(id: string, condition: boolean, detail: string): void {
  if (!condition) problems.push(`${id}: ${detail}`);
}

const SOURCE_TEXT = "İstanbul'da ikinci el buzdolabı arıyorum, bütçem 15000 TL";
const NON_VALUE_MODES = ["UNKNOWN", "NOT_APPLICABLE", "ANY"] as const;

/** Üretilen alanlar kanonik registry'den türer — elle liste yazılmaz. */
const GENERATED_KEYS = Object.keys(COMMON_FIELD_DEFAULTS).filter((key) =>
  isGeneratedCommonField(key),
);
const ANSWERABLE_COMMON_KEYS = Object.keys(COMMON_FIELD_DEFAULTS).filter(
  (key) => !isGeneratedCommonField(key),
);

/* ------------------------------------------------------------------ *
 * 1. YETENEK KANONİK REGISTRY'DEN TÜRER
 * ------------------------------------------------------------------ */

function measureCapability(): void {
  ok(
    "A1",
    GENERATED_KEYS.length === 1 && GENERATED_KEYS[0] === "title",
    `üretilen alan kümesi beklenmedik → ${GENERATED_KEYS.join(",")}`,
  );
  ok(
    "A2",
    ["budget", "city", "delivery", "quantity"].every((key) =>
      ANSWERABLE_COMMON_KEYS.includes(key),
    ),
    `cevap taşıyan ortak alanlar bozuldu → ${ANSWERABLE_COMMON_KEYS.join(",")}`,
  );
  /* Yeniden onay kapsamı AYNI yetenekten türer; ikinci liste kurulmaz. */
  const commonKeys = Object.keys(COMMON_FIELD_DEFAULTS);
  for (const key of GENERATED_KEYS) {
    ok(
      `A3:${key}`,
      !isReconfirmableCommonKey(key, commonKeys),
      "üretilen alan yeniden onay kapsamına girdi",
    );
  }
  for (const key of ANSWERABLE_COMMON_KEYS) {
    ok(
      `A4:${key}`,
      isReconfirmableCommonKey(key, commonKeys),
      "cevap taşıyan ortak alan yeniden onay kapsamından düştü",
    );
  }
}

/* ------------------------------------------------------------------ *
 * 2. COMPOSER / PROJECTION — HİÇBİR YÜZEY
 * ------------------------------------------------------------------ */

function measureProjection(): void {
  const base = createTextOnlyState(SOURCE_TEXT);
  for (const key of GENERATED_KEYS) {
    for (const mode of NON_VALUE_MODES) {
      const id = `B:${key}/${mode}`;

      /* Kanonik durum elle bozulsa bile yüzey oluşmaz. */
      const forcedState = {
        ...base,
        fields: {
          ...base.fields,
          [key]: {
            kind: mode,
            value: null,
            provenance: "EXPLICIT_BROWSE" as const,
            confidence: 1,
          },
        },
      };
      const forced = buildDiscoveryProjectionFromState(forcedState);
      ok(
        `${id}/response`,
        forced.fieldResponses?.[key] === undefined,
        `cevap yüzeyi oluştu → ${JSON.stringify(forced.fieldResponses?.[key] ?? null)}`,
      );
      ok(
        `${id}/constraint`,
        forced.constraints?.[key] === undefined,
        `constraint yüzeyi oluştu → ${JSON.stringify(forced.constraints?.[key] ?? null)}`,
      );
      ok(
        `${id}/attr`,
        forced.attributes?.[key] === undefined,
        `attributes yüzeyi oluştu → '${forced.attributes?.[key]}'`,
      );

      /* Üretim yazıcısından (UI hızlı seçim) geçse de aynı sonuç. */
      const written = syncFromBrowse(base, {
        key,
        value: "Belirtilmedi",
        kind: mode,
      }).state;
      const writtenProjection = buildDiscoveryProjectionFromState(written);
      ok(
        `${id}/ui-response`,
        writtenProjection.fieldResponses?.[key] === undefined &&
          writtenProjection.constraints?.[key] === undefined,
        "UI yolundan yüzey oluştu",
      );
      ok(
        `${id}/rawInput`,
        String(written.understanding.rawInput ?? "") === SOURCE_TEXT,
        "rawInput değişti",
      );
    }
  }
}

/* ------------------------------------------------------------------ *
 * 3. YAYIN KANALI VE KALICILIK
 * ------------------------------------------------------------------ */

function measurePublishChannel(): void {
  const base = createTextOnlyState(SOURCE_TEXT);
  for (const key of GENERATED_KEYS) {
    for (const mode of NON_VALUE_MODES) {
      const id = `C:${key}/${mode}`;
      const state = syncFromBrowse(base, {
        key,
        value: "Belirtilmedi",
        kind: mode,
      }).state;
      const fields = buildPublishAnswerFields({
        canonicalFields: state.fields,
        values: {},
        userTouchedKeys: [],
        dynamicFieldKeys: [],
      });
      ok(
        `${id}/fields`,
        !fields.some((row) => row.key === key),
        `üretilen alan cevap kanalına girdi → ${JSON.stringify(fields)}`,
      );
    }

    /* Doğrudan gönderilse bile kalıcı satır kurulmaz. */
    for (const mode of NON_VALUE_MODES) {
      const mapped = mapFieldValue({
        key,
        label: key,
        type: "text",
        value: "",
        mode,
      });
      ok(
        `C:${key}/${mode}/row`,
        mapped === null,
        `üretilen alan için kalıcı satır kuruldu → ${JSON.stringify(mapped)}`,
      );
    }

    /* GERÇEK BAŞLIK DEĞERİ BOZULMAZ: VALUE davranışı aynen korunur. */
    const valueRow = mapFieldValue({
      key,
      label: key,
      type: "text",
      value: "2015 Toyota Corolla",
      mode: "VALUE",
    });
    ok(
      `C:${key}/VALUE`,
      valueRow !== null &&
        (valueRow as { textValue?: string }).textValue ===
          "2015 Toyota Corolla",
      `gerçek başlık değeri bozuldu → ${JSON.stringify(valueRow)}`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * 4. SUNUCU GÜVEN SINIRI — SAHTE İSTEMCİ FAIL-CLOSED
 * ------------------------------------------------------------------ */

function measureServerBoundary(): void {
  const base = createTextOnlyState(SOURCE_TEXT);
  const honest = buildDiscoveryProjectionFromState(base);

  for (const key of GENERATED_KEYS) {
    for (const mode of NON_VALUE_MODES) {
      const id = `D:${key}/${mode}`;
      /* İstemci hem sahte yüzey hem sahte cevap kanalı gönderir. */
      const forged = {
        ...honest,
        fieldResponses: {
          [key]: { kind: mode === "ANY" ? "UNKNOWN" : mode, authority: "USER_EXPLICIT" },
        },
        constraints: { ...honest.constraints },
      } as unknown as typeof honest;
      const fields = [{ key, value: "Belirtilmedi", mode }];

      const created = resolveCreateProjection({
        discoveryProjection: forged,
        rawInput: SOURCE_TEXT,
        fields,
      }).projection;
      ok(
        `${id}/create`,
        created?.fieldResponses?.[key] === undefined,
        `sahte istemci cevabı create'te kabul edildi → ${JSON.stringify(created?.fieldResponses?.[key] ?? null)}`,
      );

      const updated = resolveUpdateProjection(
        { discoveryProjection: forged, rawInput: SOURCE_TEXT, fields },
        SOURCE_TEXT,
      );
      ok(
        `${id}/update`,
        updated?.fieldResponses?.[key] === undefined,
        `sahte istemci cevabı update'te kabul edildi → ${JSON.stringify(updated?.fieldResponses?.[key] ?? null)}`,
      );

      const cloned = resolveCloneProjection({
        discoveryProjection: forged,
        rawInput: SOURCE_TEXT,
        fieldAnswers: cloneAnswerChannel([
          { key, textValue: null, jsonValue: { mode } },
        ]),
      });
      ok(
        `${id}/clone`,
        cloned?.fieldResponses?.[key] === undefined,
        `klon üretilen alan için cevap taşıdı → ${JSON.stringify(cloned?.fieldResponses?.[key] ?? null)}`,
      );

      /* Onay damgası da üretilemez. */
      const confirmed = resolveCreateProjection({
        discoveryProjection: {
          ...forged,
          understanding: { confirmedFieldKeys: [key] },
        } as unknown as typeof honest,
        rawInput: SOURCE_TEXT,
        fields,
      }).projection;
      ok(
        `${id}/confirmation`,
        confirmed?.fieldConfirmations?.[key] === undefined,
        `üretilen alan onay damgası kazandı → ${JSON.stringify(confirmed?.fieldConfirmations?.[key] ?? null)}`,
      );
    }
  }
}

/* ------------------------------------------------------------------ *
 * 5. OTOMATİK BAŞLIK KORUNUR
 * ------------------------------------------------------------------ */

function measureAutoTitle(): void {
  const cases: readonly [string, string][] = [
    ["appliances", "İstanbul'da ikinci el buzdolabı arıyorum"],
    ["automotive", "Ankara'da 2018 Passat arıyorum"],
    ["printing", "5000 adet broşür bastırmak istiyorum"],
  ];
  for (const [categoryId, rawText] of cases) {
    const projection = buildDiscoveryProjectionFromState(
      createTextOnlyState(rawText),
    );
    const title = composeRequestTitle({
      categoryId,
      rawText,
      attributes: projection.attributes ?? {},
      city: "",
      fields: [],
      fieldValues: {},
    });
    ok(
      `E:${categoryId}`,
      typeof title === "string" && title.trim().length > 0,
      `otomatik başlık üretilemedi → '${title}'`,
    );
    /* Otomatik başlık ASLA bir kaçış etiketi olamaz. */
    for (const label of ["Bilmiyorum", "Belirtilmedi", "Fark etmez", "Uygulanamaz", "Henüz bilmiyorum"]) {
      ok(
        `E:${categoryId}/'${label}'`,
        !title.includes(label),
        "otomatik başlık kaçış etiketi taşıdı",
      );
    }
  }
  /* Boş metinde bile başlık üretilir — NOT NULL sözleşmesi korunur. */
  const empty = composeRequestTitle({
    categoryId: "printing",
    rawText: "",
    attributes: {},
    city: "",
    fields: [],
    fieldValues: {},
  });
  ok("E-empty", empty.trim().length > 0, "boş metinde başlık üretilmedi");
}

/* ------------------------------------------------------------------ *
 * 6. CEVAP TAŞIYAN ALANLAR ETKİLENMEZ
 * ------------------------------------------------------------------ */

function measureAnswerableUnchanged(): void {
  const base = createTextOnlyState(SOURCE_TEXT);
  for (const key of ANSWERABLE_COMMON_KEYS) {
    for (const mode of NON_VALUE_MODES) {
      const id = `F:${key}/${mode}`;
      const answers: Record<string, PublishFieldAnswer> = {
        [key]: { mode, value: "" },
      };
      const state = applyPublishAnswersToState(base, answers);
      const projection = buildDiscoveryProjectionFromState(state);
      if (mode === "ANY") {
        ok(
          `${id}/constraint`,
          projection.constraints?.[key]?.mode === "ANY",
          "ANY constraint kayboldu",
        );
      } else {
        ok(
          `${id}/response`,
          projection.fieldResponses?.[key]?.kind === mode,
          `cevap yüzeyi kayboldu → ${JSON.stringify(projection.fieldResponses?.[key] ?? null)}`,
        );
      }
      const fields = buildPublishAnswerFields({
        canonicalFields: state.fields,
        values: {},
        userTouchedKeys: [],
        dynamicFieldKeys: [],
      });
      ok(
        `${id}/fields`,
        fields.some((row) => row.key === key),
        "cevap kanalından düştü",
      );
    }
  }
}

/* ------------------------------------------------------------------ *
 * 7. CORPUS KORUMASI
 * ------------------------------------------------------------------ */

function measureCorpus(): {
  scenarios: number;
  fields: number;
  unknown: number;
  attributes: number;
  constraints: number;
  responses: number;
} {
  let scenarios = 0;
  let fields = 0;
  let unknown = 0;
  let attributes = 0;
  let constraints = 0;
  let responses = 0;

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
  }

  ok("G1", scenarios === 108, `senaryo sayısı değişti → ${scenarios}`);
  /* 98+ Faz I (2026-09-01) sayılı rebase: 13 senaryoluk davranış deltası — appl-02 inverter parça sızıntısı kapandı (-part,-partSystem), auto-11 lastik ürünleşti (-needType=vehicle, araç soruları düştü), tech-04/tech-11 RC ayrışması kapandı (state kategorisi beyni izler), tech-12 SERVICE kind (+needType,+serviceType), mach-05 machinery claim (+productType), baby-08/furn-04/home-07 kullanıcı parça beyanı korunuyor (+part), health-06 hint kategoriyi ezemiyor. Kimlik-düzeyi tam liste: fixtures/projection-authority-v1.ts */
  /* 98+ Part II (2026-09-01) sayılı rebase: kullanıcı ürün ad-öbeği ekseninin sonucu — 11 senaryo productType/propertyType kazandı (kimlik listesi: fixtures/projection-authority-v1.ts PART II notu). */
  ok("G2", fields === 1282, `kanonik alan sayısı değişti → ${fields}`);
  ok("G3", unknown === 972, `varsayılan UNKNOWN değişti → ${unknown}`);
  ok("G4", attributes === 276, `attributes tabanı kaydı → ${attributes}`);
  ok("G5", constraints === 276, `constraints tabanı kaydı → ${constraints}`);
  ok("G6", responses === 0, `varsayılan cevap yüzeyi → ${responses}`);

  return { scenarios, fields, unknown, attributes, constraints, responses };
}

/* ------------------------------------------------------------------ *
 * RAPOR
 * ------------------------------------------------------------------ */

function main(): void {
  console.log("===== URETILEN ALAN CEVAP TASIMAZ V1 =====");
  console.log(
    `GENERATED_KEYS=${GENERATED_KEYS.join(",")} · ANSWERABLE=${ANSWERABLE_COMMON_KEYS.join(",")}`,
  );

  measureCapability();
  measureProjection();
  measurePublishChannel();
  measureServerBoundary();
  measureAutoTitle();
  measureAnswerableUnchanged();
  const corpus = measureCorpus();

  console.log(
    `CORPUS scenarios=${corpus.scenarios} fields=${corpus.fields} ` +
      `default_unknown=${corpus.unknown} attributes=${corpus.attributes} ` +
      `constraints=${corpus.constraints} field_responses=${corpus.responses}`,
  );
  console.log(`PROBLEMS=${problems.length}`);
  console.log("\n--- SINIRLAR (olculdu) ---");
  console.log("  - kural alan adindan degil kanonik registry yeteneginden turer");
  console.log("  - Request.title NOT NULL korunur, MIGRATION YOK");
  console.log("  - GERCEK DB ve TARAYICI kabulu: NOT-MEASURED");

  console.log("\n===== HUKUM =====");
  if (problems.length) {
    console.error("KIRMIZI — uretilen alan hala cevap yuzeyi uretiyor:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    "YESIL — uretilen alan (baslik) hicbir composer, projection, yayin\n" +
      "kanali, kalicilik ya da sunucu yolunda deger tasimayan cevap yuzeyi\n" +
      "uretmiyor; sahte istemci cevabi create/update/clone'da fail-closed\n" +
      "dusuyor ve onay damgasi kazanamiyor; otomatik baslik uretimi ve\n" +
      "gercek baslik degeri korunuyor; cevap tasiyan dort ortak alan\n" +
      "etkilenmiyor; rawInput degismiyor ve varsayilan corpus sayaclari\n" +
      "sabit kaliyor.\n" +
      "\nNOT-MEASURED: gercek veritabani ve tarayici kabulu olculmedi.",
  );
  process.exit(0);
}

main();
