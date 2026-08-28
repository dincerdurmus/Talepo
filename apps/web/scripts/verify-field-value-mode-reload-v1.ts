/**
 * DİNAMİK ALAN CEVAP MODU GERİ YÜKLEME V1 — D3f Dilim 3c (2026-08-28).
 *
 * SORUN. Dilim 3b kullanıcının bilinçli "Bilmiyorum" / "Uygulanamaz" /
 * "Fark etmez" cevabını `RequestFieldValue.jsonValue = { mode }` olarak
 * kalıcılaştırdı. Ama düzenleme sayfası o kolonu HİÇ okumuyordu:
 *
 *   duzenle/page.tsx  → select { textValue, numberValue, booleanValue }
 *   EditRequestForm   → fieldValues: Record<string, string>
 *
 * Değer taşımayan cevapta `textValue` bilinçli olarak `null` olduğu için
 * cevap state'e hiç gelmiyordu: kullanıcı düzenleme ekranına döndüğünde
 * soru YENİDEN AÇILIYOR, hiçbir şey değiştirmeden kaydettiğinde ise cevap
 * sessizce KAYBOLUYORDU.
 *
 * KARAR. Geri yükleme TEK tipli ve fail-closed bir okuyucudan geçer
 * (`persistedAnswerModeOf` — Dilim 3b'de kurulmuş kanonik parser). İkinci bir
 * mod listesi, ikinci bir etiket tablosu ya da yeni bir otorite merdiveni
 * TANIMLANMAZ. Geri yüklenen mod YALNIZ sunucunun veritabanından verdiği
 * satırdan doğar; URL, localStorage ya da istemcinin authority etiketi güven
 * kaynağı değildir.
 *
 * ÇELİŞKİ KURALI (ölçüldü ve raporlanır). Yeni yazımlar çelişki ÜRETMEZ:
 * `mapFieldValue` değer taşımayan modda `textValue`'yu `null` yazar. Yine de
 * eski/bozuk bir kayıtta ikisi birden bulunabilir; o durumda STRUCTURED MOD
 * KAZANIR, çünkü `textValue` orada olsa olsa görünür bir etikettir ve etiket
 * hiçbir zaman cevabın kendisi değildir.
 *
 * SALT-OKUNUR. Veritabanına YAZILMAZ ve tarayıcı çalıştırılmaz: ölçüm,
 * düzenleme sayfasının kullandığı ÜRETİM okuyucusu ve `/talep` ile ortak olan
 * yayın kurucusu üzerinden yapılır. GERÇEK DB ve TARAYICI ölçümü bu turda
 * NOT-MEASURED'dır.
 *
 * KAPSAM DIŞI (ölçülmedi): ortak alanlar (budget/city/delivery/quantity/
 * title), clone restore (Dilim 3d), legacy backfill ve Maira UI.
 */

import fs from "node:fs";
import path from "node:path";

import { buildDiscoveryProjectionFromState } from "../src/lib/discovery/build-projection";
import { getCategoryById } from "../src/lib/request-category-engine";
import {
  applyPublishAnswersToState,
  buildPublishAnswerFields,
  createTextOnlyState,
  resolveHybridQuestions,
} from "../src/lib/request-composer";
import { isDeliberateNonValueAnswer } from "../src/lib/request-composer/answer-authority";
import type { PublishFieldAnswer } from "../src/lib/request-composer/ui-helpers";
import {
  mapFieldValue,
  persistedAnswerModeOf,
  restoredFieldAnswers,
} from "../src/server/request/mapper";
import type { RequestFieldInput } from "../src/server/request/request-schema";

const problems: string[] = [];

function ok(id: string, condition: boolean, detail: string): void {
  if (!condition) problems.push(`${id}: ${detail}`);
}

const SCENE_TEXT = "İstanbul'da ikinci el buzdolabı arıyorum, bütçem 15000 TL";

/** En az üç kategoriden altı gerçek dinamik alan. */
const SCENE_FIELDS: readonly { categoryId: string; key: string }[] = (() => {
  const out: { categoryId: string; key: string }[] = [];
  for (const categoryId of ["appliances", "automotive", "printing"]) {
    for (const field of (getCategoryById(categoryId)?.fields ?? []).slice(0, 2)) {
      out.push({ categoryId, key: field.key });
    }
  }
  return out;
})();

/** Sunucunun `duzenle/page.tsx` sorgusundan dönen satır şekli. */
type StoredRow = {
  key: string;
  textValue: string | null;
  numberValue: number | null;
  booleanValue: boolean | null;
  jsonValue: unknown;
};

function row(key: string, patch: Partial<StoredRow> = {}): StoredRow {
  return {
    key,
    textValue: null,
    numberValue: null,
    booleanValue: null,
    jsonValue: null,
    ...patch,
  };
}

/** Düzenleme ekranının kanonik state'i — üretim yolu. */
function editState(rows: StoredRow[]) {
  const answers = restoredFieldAnswers(rows) as Record<string, PublishFieldAnswer>;
  return {
    answers,
    state: applyPublishAnswersToState(createTextOnlyState(SCENE_TEXT), answers),
  };
}

/* ------------------------------------------------------------------ *
 * 1. OKUMA SÖZLEŞMESİ — TEK, TİPLİ, FAIL-CLOSED
 * ------------------------------------------------------------------ */

function measureParser(): void {
  for (const mode of ["UNKNOWN", "NOT_APPLICABLE", "ANY"] as const) {
    ok(
      `A:${mode}`,
      persistedAnswerModeOf({ mode }) === mode,
      "kanonik mod okunamadı",
    );
  }
  const BROKEN: unknown[] = [
    null,
    undefined,
    "bozuk",
    42,
    [1, 2, 3],
    { mode: "MAYBE" },
    { mode: "VALUE" },
    { mode: "USER_EXPLICIT" },
    { mode: null },
    {},
  ];
  for (const broken of BROKEN) {
    let threw = false;
    let out: unknown = null;
    try {
      out = persistedAnswerModeOf(broken);
    } catch {
      threw = true;
    }
    ok(`A-broken:${JSON.stringify(broken)}`, !threw, "okuyucu throw etti");
    ok(
      `A-broken-null:${JSON.stringify(broken)}`,
      out === null,
      `bozuk kayıt güvenilir cevap sayıldı → ${JSON.stringify(out)}`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * 2. GERİ YÜKLENEN CEVAP KANONİK STATE'E GİRER
 * ------------------------------------------------------------------ */

function measureRestore(): void {
  for (const scene of SCENE_FIELDS) {
    const id = `B:${scene.categoryId}/${scene.key}`;

    for (const mode of ["UNKNOWN", "NOT_APPLICABLE", "ANY"] as const) {
      const { answers, state } = editState([
        row(scene.key, { jsonValue: { mode } }),
      ]);
      const field = state.fields[scene.key];

      ok(
        `${id}/${mode}/answer`,
        answers[scene.key]?.mode === mode,
        `geri yüklenen cevap modu '${String(answers[scene.key]?.mode)}'`,
      );
      ok(
        `${id}/${mode}/kind`,
        field?.kind === mode,
        `kanonik kind '${String(field?.kind)}'`,
      );
      ok(
        `${id}/${mode}/value`,
        field?.value == null,
        `değer uyduruldu → ${JSON.stringify(field?.value)}`,
      );
      ok(
        `${id}/${mode}/deliberate`,
        isDeliberateNonValueAnswer(field),
        "geri yüklenen cevap bilinçli sayılmadı",
      );

      /* Soru KAPANIR ama attribute üretmez. */
      const questions = resolveHybridQuestions(state);
      ok(
        `${id}/${mode}/kapanis`,
        !questions.next.some((f) => f.key === scene.key) &&
          !questions.candidates.some((c) => c.fieldKey === scene.key),
        "soru yeniden açıldı",
      );

      const projection = buildDiscoveryProjectionFromState(state);
      ok(
        `${id}/${mode}/attr`,
        projection.attributes?.[scene.key] === undefined,
        `attributes yüzeyi oluştu → '${projection.attributes?.[scene.key]}'`,
      );
      if (mode === "ANY") {
        ok(
          `${id}/ANY/constraint`,
          projection.constraints?.[scene.key]?.mode === "ANY",
          "ANY constraint yüzeyi kayboldu",
        );
        ok(
          `${id}/ANY/response`,
          projection.fieldResponses?.[scene.key] === undefined,
          "ANY cevap yüzeyine taşındı",
        );
      } else {
        ok(
          `${id}/${mode}/response`,
          projection.fieldResponses?.[scene.key]?.kind === mode,
          `fieldResponses yüzeyi yok → ${JSON.stringify(projection.fieldResponses?.[scene.key] ?? null)}`,
        );
      }
      ok(
        `${id}/${mode}/rawInput`,
        String(state.understanding.rawInput ?? "") === SCENE_TEXT,
        "rawInput değişti",
      );
    }

    /* VALUE satırı mevcut davranışını korur. */
    const valueState = editState([row(scene.key, { textValue: "GERCEK" })]);
    ok(
      `${id}/VALUE`,
      valueState.answers[scene.key]?.mode === "VALUE" &&
        valueState.answers[scene.key]?.value === "GERCEK",
      `VALUE geri yüklemesi bozuldu → ${JSON.stringify(valueState.answers[scene.key] ?? null)}`,
    );

    /* Satır yoksa hiçbir cevap uydurulmaz. */
    const emptyState = editState([]);
    ok(
      `${id}/absent`,
      emptyState.answers[scene.key] === undefined &&
        !isDeliberateNonValueAnswer(emptyState.state.fields[scene.key]),
      "cevapsız alan için cevap uyduruldu",
    );
  }
}

/* ------------------------------------------------------------------ *
 * 3. ÇELİŞKİ VE LEGACY
 * ------------------------------------------------------------------ */

function measureConflictAndLegacy(): string[] {
  const notes: string[] = [];
  const key = SCENE_FIELDS[0]?.key ?? "brand";

  /* Çelişki: structured mod KAZANIR (etiket cevabın kendisi değildir). */
  const conflict = editState([
    row(key, { textValue: "Fark etmez", jsonValue: { mode: "UNKNOWN" } }),
  ]);
  ok(
    "C1",
    conflict.answers[key]?.mode === "UNKNOWN",
    `çelişkide etiket kazandı → ${JSON.stringify(conflict.answers[key] ?? null)}`,
  );
  notes.push(
    "çelişki kuralı: jsonValue.mode ile textValue birlikteyse STRUCTURED MOD kazanır (yeni yazımlar çelişki üretmez)",
  );

  /* Bozuk jsonValue: güvenilir cevap sayılmaz, textValue'ya düşer. */
  const brokenWithText = editState([
    row(key, { textValue: "Arçelik", jsonValue: { mode: "MAYBE" } }),
  ]);
  ok(
    "C2",
    brokenWithText.answers[key]?.mode === "VALUE" &&
      brokenWithText.answers[key]?.value === "Arçelik",
    `bozuk mod değeri bozdu → ${JSON.stringify(brokenWithText.answers[key] ?? null)}`,
  );
  const brokenNoText = editState([row(key, { jsonValue: [1, 2, 3] })]);
  ok(
    "C3",
    brokenNoText.answers[key] === undefined,
    "bozuk jsonValue cevap üretti",
  );

  /* LEGACY: textValue="Fark etmez" — backfill YOK, uydurma authority YOK. */
  const legacy = editState([row(key, { textValue: "Fark etmez" })]);
  ok(
    "C4",
    legacy.answers[key]?.mode === "VALUE",
    `legacy kayıt structured cevap gibi okundu → ${JSON.stringify(legacy.answers[key] ?? null)}`,
  );
  notes.push(
    'legacy: textValue="Fark etmez" VALUE olarak okunur — backfill yapılmaz, structured cevap uydurulmaz',
  );
  notes.push(
    "GERÇEK DB ve TARAYICI ölçümü: NOT-MEASURED (bu doğrulayıcı saf fonksiyonları ölçer)",
  );
  return notes;
}

/* ------------------------------------------------------------------ *
 * 4. ROUND-TRIP — load → save → load
 * ------------------------------------------------------------------ */

function savedRowsFor(
  rows: StoredRow[],
  dynamicKeys: string[],
  overrides: Record<string, PublishFieldAnswer> = {},
): StoredRow[] {
  const { state } = editState(rows);
  const patched = Object.keys(overrides).length
    ? applyPublishAnswersToState(state, overrides)
    : state;
  const fields = buildPublishAnswerFields({
    canonicalFields: patched.fields,
    /* Kamuya açık soru evreni sahnenin kategorisinden türer (D3f 3h). */
    categoryId: SCENE_FIELDS[0]?.categoryId ?? null,
    values: Object.fromEntries(
      Object.entries(overrides).map(([k, a]) => [k, a.value]),
    ),
    userTouchedKeys: Object.keys(overrides),
    dynamicFieldKeys: dynamicKeys,
  });
  const out: StoredRow[] = [];
  for (const field of fields) {
    const mapped = mapFieldValue({
      key: field.key,
      label: field.key,
      type: "text",
      value: field.value,
      mode: field.mode,
    } as RequestFieldInput) as Record<string, unknown> | null;
    if (!mapped) continue;
    out.push(
      row(field.key, {
        textValue: (mapped.textValue as string | null) ?? null,
        jsonValue: mapped.jsonValue ?? null,
      }),
    );
  }
  return out;
}

function measureRoundTrip(): void {
  const key = SCENE_FIELDS[0]?.key ?? "brand";

  /* Değiştirmeden kaydet → mod korunur, iki tur byte-birebir. */
  for (const mode of ["UNKNOWN", "NOT_APPLICABLE", "ANY"] as const) {
    const first = savedRowsFor([row(key, { jsonValue: { mode } })], [key]);
    const saved = first.find((r) => r.key === key);
    ok(
      `D:${mode}/korunur`,
      JSON.stringify(saved?.jsonValue) === JSON.stringify({ mode }) &&
        saved?.textValue === null,
      `kaydetmede mod kayboldu → ${JSON.stringify(saved ?? null)}`,
    );
    const second = savedRowsFor(first, [key]);
    ok(
      `D:${mode}/idempotent`,
      JSON.stringify(first) === JSON.stringify(second),
      "iki tur byte-birebir değil",
    );
  }

  /* mode → VALUE geçişi: textValue yazılır, jsonValue temizlenir. */
  for (const mode of ["UNKNOWN", "ANY"] as const) {
    const after = savedRowsFor([row(key, { jsonValue: { mode } })], [key], {
      [key]: { mode: "VALUE", value: "GERCEK" },
    });
    const saved = after.find((r) => r.key === key);
    ok(
      `D:${mode}→VALUE`,
      saved?.textValue === "GERCEK" && !saved?.jsonValue,
      `geçiş bozuldu → ${JSON.stringify(saved ?? null)}`,
    );
  }

  /* VALUE → UNKNOWN geçişi. */
  const toUnknown = savedRowsFor([row(key, { textValue: "GERCEK" })], [key], {
    [key]: { mode: "UNKNOWN", value: "" },
  });
  const savedUnknown = toUnknown.find((r) => r.key === key);
  ok(
    "D:VALUE→UNKNOWN",
    savedUnknown?.textValue === null &&
      JSON.stringify(savedUnknown?.jsonValue) ===
        JSON.stringify({ mode: "UNKNOWN" }),
    `geçiş bozuldu → ${JSON.stringify(savedUnknown ?? null)}`,
  );

  /**
   * SENARYO ADI DÜZELTİLDİ (D3f Dilim 3h, 2026-08-28).
   *
   * Bu satır önce `D:kaldirildi` adını taşıyor ve "kaldırıldı"yı
   * `dynamicFieldKeys` listesinde BULUNMAMAK olarak ifade ediyordu. Ölçüldü
   * ki o sahne bir kaldırma eylemini değil, YALNIZ alanın o an ekranda render
   * edilmemesini temsil ediyordu: kullanıcının görünmeyen bir alandaki cevabı
   * kaldırmak için bir arayüzü YOKTUR. Eski beklenti korunsaydı, kayıtlı bir
   * cevap yalnız görünmediği için silinirdi — sessiz veri kaybı (aynı kusur
   * sınıfı `/talep` yayınında tarayıcıda ölçüldü, 2026-08-28).
   *
   * Sayaç düşürülmedi: eski sahne aşağıda `D:gorunmez-korunur` adıyla DOĞRU
   * beklentisiyle duruyor, buraya ise gerçekten farklı bir durum yazıldı —
   * cevabın geri yükleme kanalında hiç bulunmaması. Kullanıcının açık kaldırma
   * / değiştirme eylemi ayrıca `verify-answer-lifecycle-separation-v1`
   * içindeki `S2:*` senaryolarında ölçülür.
   */
  const removed = savedRowsFor([], []);
  ok(
    "D:reload-kanalinda-yok",
    !removed.some((r) => r.key === key),
    "geri yükleme kanalında olmayan cevap için satır kuruldu",
  );

  /* Alan render edilmese de kayıtlı ve geçerli cevap KORUNUR. */
  const hidden = savedRowsFor([row(key, { jsonValue: { mode: "UNKNOWN" } })], []);
  const savedHidden = hidden.find((r) => r.key === key);
  ok(
    "D:gorunmez-korunur",
    savedHidden?.textValue === null &&
      JSON.stringify(savedHidden?.jsonValue) ===
        JSON.stringify({ mode: "UNKNOWN" }),
    `render edilmeyen alanın kayıtlı cevabı kayboldu → ${JSON.stringify(savedHidden ?? null)}`,
  );

  /* Malformed kayıt yeniden güvenilir cevap olarak YAZILMAZ. */
  const malformed = savedRowsFor([row(key, { jsonValue: { mode: "MAYBE" } })], [key]);
  const savedMalformed = malformed.find((r) => r.key === key);
  ok(
    "D:malformed",
    !savedMalformed || !savedMalformed.jsonValue,
    `bozuk kayıt güvenilir cevaba dönüştü → ${JSON.stringify(savedMalformed ?? null)}`,
  );
}

/* ------------------------------------------------------------------ *
 * 5. VERİ AKTARIMI — SAYFA GERÇEKTEN OKUYOR MU?
 * ------------------------------------------------------------------ */

function measureWiring(): void {
  const pageSource = fs.readFileSync(
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
  ok(
    "E1",
    /jsonValue/.test(pageSource),
    "düzenleme sayfası jsonValue alanını seçmiyor",
  );
  ok(
    "E2",
    /restoredFieldAnswers/.test(pageSource),
    "düzenleme sayfası kanonik geri yükleme okuyucusunu kullanmıyor",
  );

  const formSource = fs.readFileSync(
    path.join(process.cwd(), "src", "components", "panel", "EditRequestForm.tsx"),
    "utf8",
  );
  ok(
    "E3",
    /fieldAnswers/.test(formSource),
    "düzenleme formu tipli cevapları almıyor",
  );
  ok(
    "E4",
    /buildPublishAnswerFields/.test(formSource),
    "düzenleme formu ortak yayın kurucusunu kullanmıyor",
  );
  /* Form kendi mod/etiket listesini kurmaz. */
  ok(
    "E5",
    !/["']NOT_APPLICABLE["']\s*:/.test(formSource),
    "düzenleme formu kendi mod/etiket tablosunu kurdu",
  );
}

/* ------------------------------------------------------------------ *
 * 6. MUTASYONSUZ
 * ------------------------------------------------------------------ */

function measurePurity(): void {
  const rows = [row("brand", { jsonValue: { mode: "UNKNOWN" } })];
  const before = JSON.stringify(rows);
  const first = restoredFieldAnswers(rows);
  const second = restoredFieldAnswers(rows);
  ok("F1", JSON.stringify(rows) === before, "girdi mutate edildi");
  ok(
    "F2",
    JSON.stringify(first) === JSON.stringify(second),
    "idempotent değil",
  );
}

/* ------------------------------------------------------------------ *
 * RAPOR
 * ------------------------------------------------------------------ */

function main(): void {
  console.log("===== DINAMIK ALAN CEVAP MODU GERI YUKLEME V1 =====");
  console.log(
    `SCENE_FIELDS=${SCENE_FIELDS.map((s) => `${s.categoryId}/${s.key}`).join(", ")}`,
  );

  measureParser();
  measureRestore();
  const notes = measureConflictAndLegacy();
  measureRoundTrip();
  measureWiring();
  measurePurity();

  console.log(`PROBLEMS=${problems.length}`);
  console.log("\n--- SINIRLAR (olculdu) ---");
  for (const note of notes) console.log(`  - ${note}`);
  console.log(
    "  - KAPSAM DISI: ortak alanlar, clone restore (3d), legacy backfill, Maira UI",
  );

  console.log("\n===== HUKUM =====");
  if (problems.length) {
    console.error("KIRMIZI — kalici cevap modu duzenlemede geri yuklenmiyor:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    "YESIL — veritabaninda { mode } olarak duran bilincli cevap duzenleme\n" +
      "ekraninda kanonik state'e geri yukleniyor: kind dogru, deger\n" +
      "uydurulmuyor, soru yeniden acilmiyor, UNKNOWN/NOT_APPLICABLE\n" +
      "fieldResponses ve ANY kendi constraint kanali uretiyor; degistirmeden\n" +
      "kaydetmede mod korunuyor ve iki tur byte-birebir; mod<->VALUE gecisleri\n" +
      "temiz; bozuk kayit guvenilir cevap sayilmiyor ve legacy metin backfill\n" +
      "edilmiyor; rawInput degismiyor; islem mutasyonsuz ve idempotent.\n" +
      "\nNOT-MEASURED: gercek veritabani ve tarayici kosumu bu turda\n" +
      "olculmedi — olcum saf uretim fonksiyonlari uzerinden yapildi.",
  );
  process.exit(0);
}

main();
