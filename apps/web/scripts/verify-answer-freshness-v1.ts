/**
 * CEVAP TAZELİĞİ V1 — D3f Dilim 3e (2026-08-28).
 *
 * KURUCU KARARI. Geçmiş cevap SESSİZCE güncel kabul edilmez. Maira önce
 * sorar: "Daha önce bütçe için 'Fark etmez' demiştiniz. Aynı şekilde devam
 * edelim mi?" — "Evet, aynı kalsın" cevabı YENİ ve açık bir onaydır;
 * "Değiştirmek istiyorum" eski cevabı güncel yayın durumundan çıkarır ve onu
 * yalnız geçmiş bilgi olarak bırakır.
 *
 * İKİ EKSEN. `Authority` "bunu KİM söyledi?" sorusunu cevaplar ve eskimez:
 * kullanıcının verdiği cevap sonsuza kadar `USER_EXPLICIT`tir.
 * `AnswerFreshness` BAŞKA bir soruyu cevaplar: "bu cevap bugün hâlâ onaylı
 * mı?". Bir alan aynı anda `USER_EXPLICIT` VE `INHERITED` olabilir. İkisini
 * tek duruma indirmek, bayat bir bütçeyi tam yetkili bir cevap gibi
 * göstererek talebi yanlış firmalara yönlendirirdi.
 *
 * BAĞLAM KURALLARI (süre eşiği YOK):
 *   - Aynı DRAFT'ın sıradan yenilenmesi + o cevaba ait geçerli damga → FRESH.
 *   - PUBLISHED / RECEIVING_OFFERS düzenlemesi → INHERITED.
 *   - Clone edilmiş yeni DRAFT → damga taşınmaz → INHERITED.
 *   - Damga VAR ama BAŞKA bir cevaba aitse → INHERITED (anahtar varlığı
 *     yetmez; damga cevabın imzasına bağlıdır).
 *
 * ÖNCEKİ CEVAP KANALI `inferredSuggestion` DEĞİLDİR: o kanal Talepo'nun kendi
 * tahminini taşır ve otoritesi `INFERRED`dır. Kullanıcının kendi sözünü
 * makinenin tahmini gibi sunmak, cevabın kaynağını yanlış anlatmak olurdu.
 *
 * SALT-OKUNUR. Veritabanına yazılmaz ve tarayıcı çalıştırılmaz; ölçüm üretim
 * fonksiyonları ve kaynak taraması üzerinden yapılır. GERÇEK DB ve TARAYICI
 * kabulü bu turda NOT-MEASURED'dır.
 *
 * KAPSAM DIŞI: `title` (otomatik başlık ayrı dilim), legacy backfill, süre
 * eşiği ve Maira UI.
 */

import fs from "node:fs";
import path from "node:path";

import { buildDiscoveryProjectionFromState } from "../src/lib/discovery/build-projection";
import {
  answerSignature,
  resolveCloneProjection,
  resolveCreateProjection,
  resolveUpdateProjection,
} from "../src/lib/discovery/server-authority";
import { COMMON_FIELD_DEFAULTS } from "../src/lib/request-category-engine";
import {
  applyPublishAnswersToState,
  buildPublishAnswerFields,
  createTextOnlyState,
} from "../src/lib/request-composer";
import {
  isReconfirmableCommonKey,
  resolveAnswerFreshness,
  toPreviousAnswer,
  unresolvedInheritedKeys,
  type AnswerFreshness,
} from "../src/lib/request-composer/answer-authority";
import type { PublishFieldAnswer } from "../src/lib/request-composer/ui-helpers";
import { cloneAnswerChannel } from "../src/server/request/mapper";

const problems: string[] = [];

function ok(id: string, condition: boolean, detail: string): void {
  if (!condition) problems.push(`${id}: ${detail}`);
}

const SOURCE_TEXT = "İstanbul'da ikinci el buzdolabı arıyorum, bütçem 15000 TL";

/** Kapsam kanonik registry'den türer; `title` bilinçli olarak dışarıdadır. */
const COMMON_KEYS = Object.keys(COMMON_FIELD_DEFAULTS);
const MUTABLE_KEYS = COMMON_KEYS.filter((key) =>
  isReconfirmableCommonKey(key, COMMON_KEYS),
);
const MODES = ["VALUE", "ANY", "UNKNOWN", "NOT_APPLICABLE"] as const;

function answerFor(mode: (typeof MODES)[number]): PublishFieldAnswer {
  return mode === "VALUE"
    ? { mode: "VALUE", value: "GERCEK" }
    : { mode, value: "" };
}

/* ------------------------------------------------------------------ *
 * 1. KAPSAM — title dışarıda
 * ------------------------------------------------------------------ */

function measureScope(): void {
  ok(
    "A1",
    MUTABLE_KEYS.length === 4 &&
      ["budget", "city", "delivery", "quantity"].every((key) =>
        MUTABLE_KEYS.includes(key),
      ),
    `mutable ortak alan kümesi beklenmedik → ${MUTABLE_KEYS.join(",")}`,
  );
  ok("A2", !MUTABLE_KEYS.includes("title"), "title kapsama girdi");
}

/* ------------------------------------------------------------------ *
 * 2. BAĞLAM MATRİSİ — 4 ALAN × 4 MOD × 6 BAĞLAM
 * ------------------------------------------------------------------ */

function measureFreshnessMatrix(): void {
  for (const key of MUTABLE_KEYS) {
    for (const mode of MODES) {
      const answer = answerFor(mode);
      const signature = answerSignature({
        key,
        mode: answer.mode,
        value: answer.value,
      });
      const other = answerSignature({
        key,
        mode: answer.mode === "VALUE" ? "ANY" : "VALUE",
        value: "BASKA",
      });
      const id = `B:${key}/${mode}`;

      const cases: readonly [string, AnswerFreshness, Parameters<typeof resolveAnswerFreshness>[0]][] = [
        [
          "same-draft + eşleşen damga",
          "FRESH",
          { status: "DRAFT", confirmedSignature: signature, answerSignature: signature },
        ],
        [
          "same-draft + damga yok",
          "INHERITED",
          { status: "DRAFT", confirmedSignature: null, answerSignature: signature },
        ],
        [
          "same-draft + farklı cevap damgası",
          "INHERITED",
          { status: "DRAFT", confirmedSignature: other, answerSignature: signature },
        ],
        [
          "PUBLISHED edit",
          "INHERITED",
          { status: "PUBLISHED", confirmedSignature: signature, answerSignature: signature },
        ],
        [
          "RECEIVING_OFFERS edit",
          "INHERITED",
          { status: "RECEIVING_OFFERS", confirmedSignature: signature, answerSignature: signature },
        ],
        [
          "clone DRAFT (damga düştü)",
          "INHERITED",
          { status: "DRAFT", confirmedSignature: null, answerSignature: signature },
        ],
      ];

      for (const [label, expected, context] of cases) {
        const actual = resolveAnswerFreshness(context);
        ok(
          `${id}/${label}`,
          actual === expected,
          `tazelik '${actual}' (beklenen '${expected}')`,
        );
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * 3. İMZA — ANAHTAR VARLIĞI YETMEZ, HAM DEĞER SAKLANMAZ
 * ------------------------------------------------------------------ */

function measureSignature(): void {
  const a = answerSignature({ key: "budget", mode: "VALUE", value: "15000" });
  const b = answerSignature({ key: "budget", mode: "VALUE", value: "25000" });
  const c = answerSignature({ key: "city", mode: "VALUE", value: "15000" });
  const d = answerSignature({ key: "budget", mode: "ANY", value: "" });

  ok("C1", a !== b, "cevap değiştiği hâlde imza aynı kaldı");
  ok("C2", a !== c, "farklı alan aynı imzayı üretti");
  ok("C3", a !== d, "farklı mod aynı imzayı üretti");
  ok(
    "C4",
    a === answerSignature({ key: "budget", mode: "VALUE", value: "15000" }),
    "imza deterministik değil",
  );
  /* Değer taşımayan modda etiket imzayı DEĞİŞTİRMEZ. */
  ok(
    "C5",
    answerSignature({ key: "budget", mode: "ANY", value: "Fark etmez" }) ===
      answerSignature({ key: "budget", mode: "ANY", value: "" }),
    "değer taşımayan modda etiket imzaya girdi",
  );
  /* HAM PII TAŞINMAZ: imza girdiyi içermez. */
  for (const raw of ["İstanbul", "15000", "Fark etmez"]) {
    const signature = answerSignature({ key: "city", mode: "VALUE", value: raw });
    ok(
      `C6:'${raw}'`,
      !signature.includes(raw),
      "ham değer imzaya kopyalandı",
    );
  }
}

/* ------------------------------------------------------------------ *
 * 4. SUNUCU DAMGASI — YALNIZ GERÇEKTEN ONAYLANAN CEVAP
 * ------------------------------------------------------------------ */

function projectionWith(
  key: string,
  mode: (typeof MODES)[number],
): ReturnType<typeof buildDiscoveryProjectionFromState> {
  const answers: Record<string, PublishFieldAnswer> = {
    [key]: answerFor(mode),
  };
  return buildDiscoveryProjectionFromState(
    applyPublishAnswersToState(createTextOnlyState(SOURCE_TEXT), answers),
  );
}

function fieldsFor(key: string, mode: (typeof MODES)[number]) {
  const answers: Record<string, PublishFieldAnswer> = {
    [key]: answerFor(mode),
  };
  const state = applyPublishAnswersToState(
    createTextOnlyState(SOURCE_TEXT),
    answers,
  );
  return buildPublishAnswerFields({
    canonicalFields: state.fields,
    values: mode === "VALUE" ? { [key]: "GERCEK" } : {},
    userTouchedKeys: mode === "VALUE" ? [key] : [],
    dynamicFieldKeys: [],
  });
}

function measureServerStamp(): void {
  for (const key of MUTABLE_KEYS) {
    for (const mode of MODES) {
      const projection = projectionWith(key, mode);
      const fields = fieldsFor(key, mode);
      const id = `D:${key}/${mode}`;

      /* Onaylanmadan damga YAZILMAZ. */
      const withoutConfirm = resolveCreateProjection({
        discoveryProjection: projection,
        rawInput: SOURCE_TEXT,
        fields,
      }).projection;
      ok(
        `${id}/onaysiz`,
        withoutConfirm?.fieldConfirmations?.[key] === undefined,
        `onay yokken damga yazıldı → ${JSON.stringify(withoutConfirm?.fieldConfirmations ?? null)}`,
      );

      /* Onaylandığında damga cevabın imzasına bağlanır. */
      const confirmedProjection = {
        ...projection,
        understanding: { confirmedFieldKeys: [key] },
      } as unknown as typeof projection;
      const confirmed = resolveCreateProjection({
        discoveryProjection: confirmedProjection,
        rawInput: SOURCE_TEXT,
        fields,
      }).projection;
      const row = fields.find((f) => f.key === key);
      const expected = row
        ? answerSignature({ key, mode: row.mode, value: row.value })
        : null;
      if (row) {
        ok(
          `${id}/onayli`,
          confirmed?.fieldConfirmations?.[key]?.signature === expected,
          `damga imzası yanlış → ${JSON.stringify(confirmed?.fieldConfirmations?.[key] ?? null)}`,
        );
        /* Aynı damga BAŞKA bir cevabı taze yapamaz. */
        const stale = resolveAnswerFreshness({
          status: "DRAFT",
          confirmedSignature:
            confirmed?.fieldConfirmations?.[key]?.signature ?? null,
          answerSignature: answerSignature({
            key,
            mode: "VALUE",
            value: "DEGISTI",
          }),
        });
        ok(`${id}/eski-damga`, stale === "INHERITED", "eski damga geçerli kaldı");
      }

      /* create ve update aynı sonucu verir. */
      const updated = resolveUpdateProjection(
        {
          discoveryProjection: confirmedProjection,
          rawInput: SOURCE_TEXT,
          fields,
        },
        SOURCE_TEXT,
      );
      ok(
        `${id}/create-update`,
        JSON.stringify(confirmed?.fieldConfirmations) ===
          JSON.stringify(updated?.fieldConfirmations),
        "create ve update farklı damga üretti",
      );

      /* CLONE damgayı DÜŞÜRÜR. */
      const cloned = resolveCloneProjection({
        discoveryProjection: confirmed,
        rawInput: SOURCE_TEXT,
        fieldAnswers: cloneAnswerChannel([
          { key, textValue: null, jsonValue: mode === "VALUE" ? null : { mode } },
        ]),
      });
      ok(
        `${id}/clone`,
        cloned?.fieldConfirmations === undefined,
        `clone damgayı taşıdı → ${JSON.stringify(cloned?.fieldConfirmations ?? null)}`,
      );
    }
  }
}

/* ------------------------------------------------------------------ *
 * 5. İSTEMCİ SAHTECİLİĞİ
 * ------------------------------------------------------------------ */

function measureForgery(): void {
  const key = "budget";
  const projection = projectionWith(key, "ANY");
  const fields = fieldsFor(key, "ANY");

  const forged = {
    ...projection,
    fieldConfirmations: {
      [key]: { signature: "v1:deadbeef" },
      __hack__: { signature: "v1:deadbeef" },
    },
  } as unknown as typeof projection;

  const saved = resolveCreateProjection({
    discoveryProjection: forged,
    rawInput: SOURCE_TEXT,
    fields,
  }).projection;
  ok(
    "E1",
    saved?.fieldConfirmations === undefined,
    `sahte istemci damgası kabul edildi → ${JSON.stringify(saved?.fieldConfirmations ?? null)}`,
  );

  /* Sahte onay anahtarı yalnız GERÇEK cevabın imzasını üretebilir. */
  const forgedConfirm = {
    ...projection,
    understanding: { confirmedFieldKeys: [key, "__hack__", "__proto__"] },
    fieldConfirmations: { [key]: { signature: "v1:deadbeef" } },
  } as unknown as typeof projection;
  const rederived = resolveCreateProjection({
    discoveryProjection: forgedConfirm,
    rawInput: SOURCE_TEXT,
    fields,
  }).projection;
  const row = fields.find((f) => f.key === key);
  ok(
    "E2",
    rederived?.fieldConfirmations?.[key]?.signature ===
      answerSignature({ key, mode: row!.mode, value: row!.value }),
    "damga istemci imzasından türedi",
  );
  /**
   * `__proto__` düz bir nesnede prototip zincirinden geldiği için `undefined`
   * DEĞİLDİR; varlık kontrolü bu yüzden `hasOwnProperty` ile yapılır.
   */
  const stamped = rederived?.fieldConfirmations ?? {};
  for (const forgedKey of ["__hack__", "__proto__", "constructor"]) {
    ok(
      `E3:'${forgedKey}'`,
      !Object.prototype.hasOwnProperty.call(stamped, forgedKey),
      "uydurma anahtar damga kazandı",
    );
  }
}

/* ------------------------------------------------------------------ *
 * 6. ÖNCEKİ CEVAP KANALI — TAHMİN DEĞİLDİR
 * ------------------------------------------------------------------ */

function measurePreviousAnswer(): void {
  for (const mode of MODES) {
    const answer = answerFor(mode);
    const previous = toPreviousAnswer({
      kind: answer.mode,
      value: answer.mode === "VALUE" ? answer.value : null,
      provenance: "EXPLICIT_BROWSE",
    });
    ok(`F:${mode}/var`, previous !== null, "önceki cevap kaydı üretilmedi");
    ok(
      `F:${mode}/authority`,
      previous?.originalAuthority === "USER_EXPLICIT",
      "önceki cevabın otoritesi kullanıcı beyanı değil",
    );
    ok(
      `F:${mode}/freshness`,
      previous?.freshness === "INHERITED",
      "önceki cevap taze işaretlendi",
    );
    ok(`F:${mode}/confirmed`, previous?.confirmed === false, "onaylı sayıldı");
    ok(`F:${mode}/kind`, previous?.kind === mode, "kanonik mod kaybedildi");
  }

  /* ÇIKARIM önceki cevap DEĞİLDİR: kanallar karışmaz. */
  ok(
    "F-inferred",
    toPreviousAnswer({
      kind: "VALUE",
      value: "Tahmin",
      provenance: "INFERRED",
    }) === null,
    "Talepo tahmini önceki kullanıcı cevabı sayıldı",
  );
  ok(
    "F-catalog",
    toPreviousAnswer({
      kind: "VALUE",
      value: "Mercedes-Benz",
      provenance: "CATALOG_ENRICHED",
    }) === null,
    "katalog doğrulaması kullanıcı cevabı sayıldı",
  );
}

/* ------------------------------------------------------------------ *
 * 7. KAYDETME KAPISI
 * ------------------------------------------------------------------ */

function measureSaveGate(): void {
  const freshnessByKey: Record<string, AnswerFreshness> = {
    budget: "INHERITED",
    city: "INHERITED",
    delivery: "FRESH",
  };

  ok(
    "G1",
    JSON.stringify(
      unresolvedInheritedKeys({ freshnessByKey, resolvedKeys: [] }),
    ) === JSON.stringify(["budget", "city"]),
    "çözülmemiş miras cevaplar doğru listelenmedi",
  );
  ok(
    "G2",
    JSON.stringify(
      unresolvedInheritedKeys({ freshnessByKey, resolvedKeys: ["budget"] }),
    ) === JSON.stringify(["city"]),
    "'aynı kalsın' çözüm sayılmadı",
  );
  ok(
    "G3",
    unresolvedInheritedKeys({
      freshnessByKey,
      resolvedKeys: ["budget", "city"],
    }).length === 0,
    "tüm cevaplar çözüldüğü hâlde kapı açılmadı",
  );
  /* Başka bir alanı değiştirmek miras cevabı çözmez. */
  ok(
    "G4",
    unresolvedInheritedKeys({
      freshnessByKey,
      resolvedKeys: ["delivery", "brand"],
    }).length === 2,
    "ilgisiz alan miras cevabı taze yaptı",
  );
  /* Hiç miras cevap yoksa kapı hiç açılmaz. */
  ok(
    "G5",
    unresolvedInheritedKeys({
      freshnessByKey: { budget: "FRESH" },
      resolvedKeys: [],
    }).length === 0,
    "taze cevapta kapı açıldı",
  );
}

/* ------------------------------------------------------------------ *
 * 8. UI VE BAĞLAM KABLOSU (kaynak taraması)
 * ------------------------------------------------------------------ */

function measureWiring(): void {
  const page = fs.readFileSync(
    path.join(
      process.cwd(),
      "src",
      "app",
      "panel",
      "taleplerim",
      "[id]",
      "duzenle",
      "page.tsx",
    ),
    "utf8",
  );
  ok("H1", /status:\s*request\.status/.test(page), "status sunucudan taşınmıyor");
  ok(
    "H2",
    /fieldConfirmations/.test(page) && /parseDiscoveryProjection/.test(page),
    "onay damgaları DB projection'ından fail-closed okunmuyor",
  );
  ok(
    "H3",
    !/yeni\s*===\s*"1"[\s\S]{0,80}freshness/i.test(page),
    "`?yeni=1` tazelik kaynağı olarak kullanılmış",
  );

  const form = fs.readFileSync(
    path.join(process.cwd(), "src", "components", "panel", "EditRequestForm.tsx"),
    "utf8",
  );
  ok("H4", /Evet, aynı kalsın/.test(form), "'aynı kalsın' seçeneği yok");
  ok(
    "H5",
    /Değiştirmek istiyorum/.test(form),
    "'değiştirmek istiyorum' seçeneği yok",
  );
  ok(
    "H6",
    /resolveAnswerFreshness/.test(form) && /unresolvedInheritedKeys/.test(form),
    "form kanonik tazelik fonksiyonlarını kullanmıyor",
  );
  ok(
    "H7",
    /unresolvedReconfirmKeys\.length > 0/.test(form),
    "kaydetme kapısı yok",
  );
  /**
   * Önceki cevap Talepo'nun TAHMİN kanalına bağlanamaz. Ölçüt KOD
   * kullanımıdır: yorumda kanalın adının geçmesi (neden kullanılmadığını
   * açıklamak için) bir bağımlılık değildir.
   */
  ok(
    "H8",
    !/\.inferredSuggestion|inferredSuggestion\s*[:=]/.test(form),
    "önceki cevap tahmin kanalına bağlanmış",
  );
  ok(
    "H9",
    /quantity: restoredCommonValue\("quantity"\)/.test(form) &&
      /delivery: restoredCommonValue\("delivery"\)/.test(form),
    "ortak alan cevapları geri yüklenmiyor",
  );

  /* TalepoAiPanel'e yeni bağımlılık kurulmadı. */
  ok(
    "H10",
    !/TalepoAiPanel/.test(form),
    "düzenleme formu TalepoAiPanel'e bağlandı",
  );
}

/* ------------------------------------------------------------------ *
 * RAPOR
 * ------------------------------------------------------------------ */

function main(): void {
  console.log("===== CEVAP TAZELIGI V1 =====");
  console.log(`MUTABLE_KEYS=${MUTABLE_KEYS.join(",")} (title kapsam disi)`);

  measureScope();
  measureFreshnessMatrix();
  measureSignature();
  measureServerStamp();
  measureForgery();
  measurePreviousAnswer();
  measureSaveGate();
  measureWiring();

  console.log(`PROBLEMS=${problems.length}`);
  console.log("\n--- SINIRLAR (olculdu) ---");
  console.log("  - sure esigi YOK: karar yalniz status + onay damgasindan gelir");
  console.log("  - `?yeni=1` hicbir yerde tazelik kaniti degildir");
  console.log("  - clone damgayi dusurur; hatirlanan cevap INHERITED baslar");
  console.log("  - GERCEK DB ve TARAYICI kabulu: NOT-MEASURED");
  console.log("  - KAPSAM DISI: title, legacy backfill, Maira UI");

  console.log("\n===== HUKUM =====");
  if (problems.length) {
    console.error("KIRMIZI — miras cevaplar sessizce guncel sayiliyor:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    "YESIL — tazelik otoriteden ayri bir eksen olarak modellendi; ayni\n" +
      "taslagin yenilenmesinde gecerli damga FRESH uretiyor, yayinlanmis\n" +
      "talep duzenlemesi ve clone edilmis taslak INHERITED basliyor; damga\n" +
      "cevabin imzasina bagli oldugu icin cevap degisince kendiliginden\n" +
      "gecersiz oluyor ve ham deger metadata'ya kopyalanmiyor; istemcinin\n" +
      "gonderdigi damga tamamen atilip sunucuda yeniden turetiliyor, uydurma\n" +
      "anahtar damga kazanamiyor; onceki cevap Talepo tahmininden ayri bir\n" +
      "kanalda tasiniyor; cozulmemis miras cevap varken kaydetme kapisi\n" +
      "acilmiyor ve ilgisiz bir alani degistirmek eski cevabi taze yapmiyor;\n" +
      "ortak alan cevaplari duzenleme ekranina geri yukleniyor.\n" +
      "\nNOT-MEASURED: gercek veritabani ve tarayici kabulu olculmedi.",
  );
  process.exit(0);
}

main();
