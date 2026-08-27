/**
 * KLON TASLAKTA DEĞER TAŞIMAYAN CEVAP V1 — D3f Dilim 3d (2026-08-28).
 *
 * ÜRÜN KARARI (kurucu, 2026-08-28). Kullanıcı kendi talebini "kopyala /
 * yeniden taslak oluştur" ile çoğalttığında ÖNCEKİ AÇIK SEÇİMLERİ korunur.
 * Bu, D3d'de yazılan "clone yeni kullanıcı beyanı üretmez" kuralının
 * BİLİNÇLİ bir daraltmasıdır: klonlama işini kullanıcının KENDİSİ başlattığı
 * için, kendi önceki cevabının yeni TASLAĞA taşınması kabul edilir. Yeni
 * kayıt DRAFT kalır; bu bir otomatik yayın değildir.
 *
 * GÜVENİLİR KAYNAK YALNIZ VERİTABANIDIR. Taşınan şey kaynağın
 * `RequestFieldValue` satırındaki doğrulanmış veridir (`textValue` ve
 * fail-closed ayrıştırılmış `jsonValue.mode`). Kaynağın
 * `discoveryProjection.fieldResponses`, `fieldAuthority` ya da constraint
 * otoritesi GÜVENİLİR SAYILMAZ — o metadata bu güven sınırından önce
 * yazılmış ya da uydurulmuş olabilir ve klonlamak onu aklamaz.
 *
 * YALNIZ DEĞER TAŞIMAYAN MOD TAŞINIR. Kurucu kararı `UNKNOWN`,
 * `NOT_APPLICABLE` ve `ANY` modlarını adlandırır. `VALUE` cevaplarının
 * otoritesi eskisi gibi kaynağın KENDİ metninden yeniden türetilir; clone
 * onlara kullanıcı beyanı damgası basmaz.
 *
 * İKİNCİ MOD LİSTESİ YOK. Okuma ortak `restoredFieldAnswers` yardımcısından
 * geçer (Dilim 3c'de kurulmuş kanonik okuyucu); clone'a özel bir mod tablosu
 * ya da etiket listesi tanımlanmaz.
 *
 * SALT-OKUNUR. Veritabanına YAZILMAZ ve gerçek `cloneRequestAsDraft` işlemi
 * çalıştırılmaz: ölçüm, o işlemin kullandığı ÜRETİM fonksiyonları üzerinden
 * yapılır ve yazma yolunun onları gerçekten kullandığı kaynak taramasıyla
 * denetlenir. GERÇEK DB ve TARAYICI kabulü bu turda NOT-MEASURED'dır.
 *
 * KAPSAM DIŞI (ölçülmedi): ortak alan jsonValue kalıcılığı, `quantity`
 * kolonu, `title` fallback kararı, legacy backfill ve Maira UI.
 */

import fs from "node:fs";
import path from "node:path";

import { buildDiscoveryProjectionFromState } from "../src/lib/discovery/build-projection";
import { resolveCloneProjection } from "../src/lib/discovery/server-authority";
import type { RequestDiscoveryProjection } from "../src/lib/discovery/types";
import { getCategoryById } from "../src/lib/request-category-engine";
import {
  applyPublishAnswersToState,
  createTextOnlyState,
  resolveHybridQuestions,
} from "../src/lib/request-composer";
import { isDeliberateNonValueAnswer } from "../src/lib/request-composer/answer-authority";
import type { PublishFieldAnswer } from "../src/lib/request-composer/ui-helpers";
import {
  cloneAnswerChannel,
  restoredFieldAnswers,
  type StoredFieldValueRow,
} from "../src/server/request/mapper";

const problems: string[] = [];

function ok(id: string, condition: boolean, detail: string): void {
  if (!condition) problems.push(`${id}: ${detail}`);
}

/**
 * KAYNAK SAHNESİ GERÇEK BİR TALEBİ TAKLİT EDER.
 *
 * Kaynak projection, yayınlayan kullanıcının KANONİK DURUMUNDAN kurulmuş ve
 * kalıcılaşmış kayıttır: kategorisi çözülmüştür ve kullanıcının kendi
 * cevapları oradadır. İki ölçüm inceliği bu yüzden önemlidir:
 *
 *   1. Anahtar izni `projection.categoryId` ile sınırlıdır; kategorisiz bir
 *      kaynakta dinamik alanlar zaten reddedilir (fail-closed).
 *   2. Sunucu güven sınırı YÜZEY OLUŞTURMAZ, var olan yüzeyi damgalar. `ANY`
 *      constraint'i kaynağın kendi projection'ında bulunur; clone onun
 *      OTORİTESİNİ yeniden türetir.
 *
 * Metnin KENDİSİ bir alanı dolduruyorsa o alanın DEĞER yüzeyi vardır ve
 * tek-yüzey kuralı gereği cevap dispozisyonu yazılmaz — doğru davranıştır ve
 * aşağıda ayrıca ölçülür.
 */
const SOURCE_TEXT =
  "İstanbul'da ikinci el buzdolabı arıyorum, bütçem 15000 TL";

/**
 * En az üç kategoriden altı gerçek dinamik alan.
 *
 * Kaynak metnin KENDİSİNİN doldurduğu alanlar (ör. "buzdolabı" →
 * `applianceType`) DIŞARIDA bırakılır: onların değer yüzeyi vardır ve
 * tek-yüzey kuralı gereği cevap dispozisyonu yazılmaz. O davranış aşağıda
 * ayrı bir iddiayla ölçülür; matris ise metinden türemeyen alanları ölçer.
 */
/**
 * Her kategori KENDİ gerçek kaynak metniyle ölçülür: anahtar izni kaynağın
 * `categoryId`'sine bağlıdır ve kategorisiz bir kaynakta dinamik alanlar
 * zaten fail-closed düşer.
 */
const CATEGORY_TEXT: Record<string, string> = {
  appliances: SOURCE_TEXT,
  automotive: "Ankara'da 2018 model dizel Passat arıyorum, bütçem 900000 TL",
  printing: "5000 adet broşür bastırmak istiyorum, bütçem 20000 TL",
};

function textDerivedKeys(text: string): ReadonlySet<string> {
  const projection = buildDiscoveryProjectionFromState(
    createTextOnlyState(text),
  );
  return new Set([
    ...Object.keys(projection.attributes ?? {}),
    ...Object.keys(projection.constraints ?? {}),
  ]);
}

const SCENE_FIELDS: readonly { categoryId: string; key: string }[] = (() => {
  const out: { categoryId: string; key: string }[] = [];
  for (const [categoryId, text] of Object.entries(CATEGORY_TEXT)) {
    const derived = textDerivedKeys(text);
    const fields = (getCategoryById(categoryId)?.fields ?? []).filter(
      (field) => !derived.has(field.key),
    );
    for (const field of fields.slice(0, 2)) {
      out.push({ categoryId, key: field.key });
    }
  }
  return out;
})();

function row(
  key: string,
  patch: Partial<StoredFieldValueRow> = {},
): StoredFieldValueRow {
  return {
    key,
    textValue: null,
    numberValue: null,
    booleanValue: null,
    jsonValue: null,
    ...patch,
  };
}

/**
 * Kaynak talebin klonlanması — ÜRETİM zinciri.
 *
 * `sourceProjection` KAYNAĞIN kendi kaydıdır ve saldırı vakalarında bilinçli
 * olarak sahte metadata taşır; clone kararı ondan doğmamalıdır.
 */
function cloneOf(
  rows: StoredFieldValueRow[],
  opts: { text?: string; sourceProjection?: unknown } = {},
): {
  projection: RequestDiscoveryProjection | undefined;
  copiedRows: StoredFieldValueRow[];
} {
  const text = opts.text ?? SOURCE_TEXT;
  /**
   * KAYNAK KAYIT GERÇEKÇİ KURULUR: yayınlayan kullanıcının kanonik
   * durumundan üretilmiş ve kalıcılaşmış projection. Sunucu güven sınırı
   * YÜZEY OLUŞTURMAZ, var olan yüzeyi damgalar — bu yüzden kaynağın `ANY`
   * constraint'i kendi kaydında bulunmalıdır.
   */
  const source =
    opts.sourceProjection ??
    buildDiscoveryProjectionFromState(
      applyPublishAnswersToState(
        createTextOnlyState(text),
        restoredFieldAnswers(rows) as Record<string, PublishFieldAnswer>,
      ),
    );
  const projection = resolveCloneProjection({
    discoveryProjection: source,
    rawInput: text,
    fieldAnswers: cloneAnswerChannel(rows),
  });
  /* `fieldValues` satırları klonda BYTE-BİREBİR kopyalanır (mevcut davranış). */
  const copiedRows = rows.map((r) => ({ ...r }));
  return { projection, copiedRows };
}

/** Klon taslağın düzenleme ekranında kurulan kanonik durumu. */
function editStateOf(rows: StoredFieldValueRow[], text = SOURCE_TEXT) {
  const answers = restoredFieldAnswers(rows) as Record<string, PublishFieldAnswer>;
  return applyPublishAnswersToState(createTextOnlyState(text), answers);
}

/* ------------------------------------------------------------------ *
 * 1. KABUL MATRİSİ — ÜÇ KATEGORİ × ALTI ALAN
 * ------------------------------------------------------------------ */

function measureCloneMatrix(): void {
  for (const scene of SCENE_FIELDS) {
    const id = `A:${scene.categoryId}/${scene.key}`;
    const text = CATEGORY_TEXT[scene.categoryId] ?? SOURCE_TEXT;

    /* --- UNKNOWN / NOT_APPLICABLE: cevap yüzeyi kurulur --- */
    for (const mode of ["UNKNOWN", "NOT_APPLICABLE"] as const) {
      const rows = [row(scene.key, { jsonValue: { mode } })];
      const { projection, copiedRows } = cloneOf(rows, { text });

      ok(
        `${id}/${mode}/row`,
        JSON.stringify(copiedRows[0]?.jsonValue) === JSON.stringify({ mode }),
        "DB satırı byte-birebir kopyalanmadı",
      );
      ok(
        `${id}/${mode}/response`,
        projection?.fieldResponses?.[scene.key]?.kind === mode,
        `klon cevap yüzeyi yok → ${JSON.stringify(projection?.fieldResponses?.[scene.key] ?? null)}`,
      );
      ok(
        `${id}/${mode}/authority`,
        projection?.fieldResponses?.[scene.key]?.authority === "USER_EXPLICIT",
        "klon otoritesi USER_EXPLICIT değil",
      );
      ok(
        `${id}/${mode}/attr`,
        projection?.attributes?.[scene.key] === undefined &&
          projection?.constraints?.[scene.key] === undefined,
        "değer yüzeyi uyduruldu",
      );

      const state = editStateOf(rows, text);
      ok(
        `${id}/${mode}/edit`,
        isDeliberateNonValueAnswer(state.fields[scene.key]),
        "klon düzenleme durumunda cevap bilinçli sayılmadı",
      );
      const questions = resolveHybridQuestions(state);
      ok(
        `${id}/${mode}/reask`,
        !questions.next.some((f) => f.key === scene.key) &&
          !questions.candidates.some((c) => c.fieldKey === scene.key),
        "klonda soru yeniden açıldı",
      );
      ok(
        `${id}/${mode}/rawInput`,
        String(state.understanding.rawInput ?? "") === text,
        "rawInput değişti",
      );
    }

    /* --- ANY: kendi constraint kanalı --- */
    {
      const rows = [row(scene.key, { jsonValue: { mode: "ANY" } })];
      const { projection } = cloneOf(rows, { text });
      ok(
        `${id}/ANY/constraint`,
        projection?.constraints?.[scene.key]?.mode === "ANY",
        `ANY constraint yok → ${JSON.stringify(projection?.constraints?.[scene.key] ?? null)}`,
      );
      ok(
        `${id}/ANY/authority`,
        projection?.fieldAuthority?.[scene.key]?.constraints === "USER_EXPLICIT",
        `ANY otoritesi → ${String(projection?.fieldAuthority?.[scene.key]?.constraints)}`,
      );
      ok(
        `${id}/ANY/response`,
        projection?.fieldResponses?.[scene.key] === undefined,
        "ANY cevap yüzeyine taşındı",
      );
      ok(
        `${id}/ANY/attr`,
        projection?.attributes?.[scene.key] === undefined,
        "ANY attribute üretti",
      );
    }

    /* --- VALUE: mevcut davranış korunur, clone beyan damgalamaz --- */
    {
      const rows = [row(scene.key, { textValue: "GERCEK" })];
      const { projection, copiedRows } = cloneOf(rows, { text });
      ok(
        `${id}/VALUE/row`,
        copiedRows[0]?.textValue === "GERCEK",
        "VALUE satırı kopyalanmadı",
      );
      ok(
        `${id}/VALUE/response`,
        projection?.fieldResponses?.[scene.key] === undefined,
        "VALUE cevap yüzeyi üretti",
      );
    }

    /* --- Dokunulmamış: hiçbir şey üretilmez --- */
    {
      const { projection } = cloneOf([], { text });
      ok(
        `${id}/untouched`,
        projection?.fieldResponses?.[scene.key] === undefined,
        "cevapsız alan için klon yüzeyi uyduruldu",
      );
    }
  }
}

/* ------------------------------------------------------------------ *
 * 2. GÜVENLİK MATRİSİ
 * ------------------------------------------------------------------ */

function measureSecurity(): void {
  const key = SCENE_FIELDS[0]?.key ?? "brand";
  const honestSource = buildDiscoveryProjectionFromState(
    createTextOnlyState(SOURCE_TEXT),
  );

  /* (a) Bozuk / tanınmayan kalıcı mod güvenilir cevap üretmez. */
  const BROKEN: unknown[] = [
    "bozuk",
    42,
    [1, 2, 3],
    { mode: "MAYBE" },
    { mode: "USER_EXPLICIT" },
    { mode: "VALUE" },
    { mode: null },
    {},
    null,
  ];
  for (const jsonValue of BROKEN) {
    const { projection } = cloneOf([row(key, { jsonValue })]);
    ok(
      `B-broken:${JSON.stringify(jsonValue)}`,
      projection?.fieldResponses?.[key] === undefined,
      `bozuk kalıcı mod klon cevabı üretti → ${JSON.stringify(projection?.fieldResponses?.[key] ?? null)}`,
    );
  }

  /* (b) Legacy etiket TEK BAŞINA structured cevap değildir. */
  const legacy = cloneOf([row(key, { textValue: "Fark etmez" })]);
  ok(
    "B-legacy",
    legacy.projection?.fieldResponses?.[key] === undefined,
    "legacy etiket klonda structured cevaba dönüştü",
  );

  /* (c) Kaynak projection metadata'sı GÜVENİLİR DEĞİLDİR. */
  const forgedSource = {
    ...honestSource,
    fieldResponses: {
      [key]: { kind: "UNKNOWN", authority: "USER_EXPLICIT" },
      uydurmaAlan: { kind: "NOT_APPLICABLE", authority: "VERIFIED" },
    },
    fieldAuthority: {
      [key]: { attributes: "USER_EXPLICIT", constraints: "VERIFIED" },
    },
  } as unknown as RequestDiscoveryProjection;
  const forged = cloneOf([], { sourceProjection: forgedSource });
  ok(
    "B-forged/response",
    forged.projection?.fieldResponses === undefined,
    `sahte kaynak metadata klona geçti → ${JSON.stringify(forged.projection?.fieldResponses ?? null)}`,
  );
  ok(
    "B-forged/authority",
    forged.projection?.fieldAuthority?.[key]?.attributes !== "USER_EXPLICIT",
    "sahte kaynak otoritesi klonda korundu",
  );

  /* (d) DB modu ile sahte metadata çelişirse DB KAZANIR. */
  const conflictSource = {
    ...honestSource,
    fieldResponses: {
      [key]: { kind: "NOT_APPLICABLE", authority: "VERIFIED" },
    },
  } as unknown as RequestDiscoveryProjection;
  const conflict = cloneOf([row(key, { jsonValue: { mode: "UNKNOWN" } })], {
    sourceProjection: conflictSource,
  });
  ok(
    "B-conflict",
    conflict.projection?.fieldResponses?.[key]?.kind === "UNKNOWN",
    `çelişkide sahte metadata kazandı → ${JSON.stringify(conflict.projection?.fieldResponses?.[key] ?? null)}`,
  );

  /* (e) İzinsiz anahtarlar hiçbir koşulda yüzey üretmez. */
  for (const forgedKey of [
    "__proto__",
    "constructor",
    "prototype",
    "__hack__",
    "uydurmaAlan",
    "brandCandidate",
    "brandEvidence",
  ]) {
    const { projection } = cloneOf([
      row(forgedKey, { jsonValue: { mode: "UNKNOWN" } }),
    ]);
    ok(
      `B-key:'${forgedKey}'`,
      projection?.fieldResponses?.[forgedKey] === undefined,
      "izinsiz anahtar klon cevabı üretti",
    );
  }

  /* (f) Kaynak projection'da olup DB satırında olmayan cevap taşınmaz. */
  const ghostSource = {
    ...honestSource,
    fieldResponses: { [key]: { kind: "ANY", authority: "USER_EXPLICIT" } },
  } as unknown as RequestDiscoveryProjection;
  const ghost = cloneOf([], { sourceProjection: ghostSource });
  ok(
    "B-ghost",
    ghost.projection?.fieldResponses?.[key] === undefined,
    "DB karşılığı olmayan cevap klona taşındı",
  );

  /**
   * (g-0) METİNDEN TÜREYEN DEĞER, KLON CEVABINDAN ÜSTÜNDÜR.
   *
   * Kaynak metnin KENDİSİ bir alanı dolduruyorsa (ör. "buzdolabı" →
   * `applianceType`) o alanın DEĞER yüzeyi vardır. Tek-yüzey kuralı gereği
   * aynı anahtara cevap dispozisyonu YAZILMAZ: "kullanıcı değer vermedi"
   * ile "metin bu değeri söylüyor" aynı anda doğru olamaz.
   */
  const textDerived = cloneOf(
    [row("applianceType", { jsonValue: { mode: "UNKNOWN" } })],
    /* Kaynak projection METİNDEN kurulur: değer orada gerçekten vardır. */
    { sourceProjection: honestSource },
  );
  ok(
    "B-text-derived/response",
    textDerived.projection?.fieldResponses?.applianceType === undefined,
    "metinden türeyen değere cevap dispozisyonu yazıldı",
  );
  ok(
    "B-text-derived/value",
    textDerived.projection?.attributes?.applianceType === "Buzdolabı",
    `metinden türeyen değer kayboldu → ${JSON.stringify(textDerived.projection?.attributes?.applianceType ?? null)}`,
  );

  /* (g) textValue ile jsonValue çelişirse structured mod kazanır. */
  const mixed = cloneOf([
    row(key, { textValue: "Fark etmez", jsonValue: { mode: "UNKNOWN" } }),
  ]);
  ok(
    "B-mixed",
    mixed.projection?.fieldResponses?.[key]?.kind === "UNKNOWN",
    "çelişkide etiket kazandı",
  );
}

/* ------------------------------------------------------------------ *
 * 3. MUTASYONSUZ + İDEMPOTENT + İKİ ARDIŞIK KLON
 * ------------------------------------------------------------------ */

function measurePurity(): void {
  const key = SCENE_FIELDS[0]?.key ?? "brand";
  const rows = [row(key, { jsonValue: { mode: "UNKNOWN" } })];
  const before = JSON.stringify(rows);

  const first = cloneOf(rows);
  ok("C1", JSON.stringify(rows) === before, "kaynak satırlar mutate edildi");

  /* Klonun klonu — iki ardışık tur aynı sonucu verir. */
  const second = resolveCloneProjection({
    discoveryProjection: first.projection,
    rawInput: SOURCE_TEXT,
    fieldAnswers: cloneAnswerChannel(first.copiedRows),
  });
  ok(
    "C2",
    JSON.stringify(second?.fieldResponses) ===
      JSON.stringify(first.projection?.fieldResponses),
    "iki ardışık klon farklı sonuç verdi",
  );
  ok(
    "C3",
    JSON.stringify(second?.attributes) ===
      JSON.stringify(first.projection?.attributes) &&
      JSON.stringify(second?.constraints) ===
        JSON.stringify(first.projection?.constraints),
    "iki ardışık klonda değer torbaları kaydı",
  );
}

/* ------------------------------------------------------------------ *
 * 4. YAZMA YOLU SINIRLARI (kaynak taraması)
 * ------------------------------------------------------------------ */

function measureCloneWiring(): void {
  const source = fs.readFileSync(
    path.join(
      process.cwd(),
      "src",
      "server",
      "request",
      "clone-request-as-draft.ts",
    ),
    "utf8",
  );

  ok("D1", /status:\s*"DRAFT"/.test(source), "klon DRAFT kalmıyor");
  ok(
    "D2",
    !/publishedAt|fanout|notification\.create|visibleToSuppliersAt/i.test(source),
    "klon yayın / fanout / bildirim tetikliyor",
  );
  ok(
    "D3",
    /rawInput:\s*source\.rawInput/.test(source),
    "klon rawInput'u birebir kopyalamıyor",
  );
  ok(
    "D4",
    /cloneAnswerChannel/.test(source),
    "klon kanonik cevap kanalını kullanmıyor",
  );
  ok(
    "D5",
    /field:\s*\{\s*select:\s*\{\s*key:\s*true/.test(source),
    "klon sorgusu alan anahtarını seçmiyor",
  );
  /* 3a'daki temiz dedicated değerler aynen kopyalanır. */
  ok(
    "D6",
    /budgetMin:\s*source\.budgetMin/.test(source) &&
      /city:\s*source\.city/.test(source),
    "klon dedicated kolonları kaynaktan kopyalamıyor",
  );
  /* Klon kendi mod/etiket listesini kurmaz. */
  ok(
    "D7",
    !/["']NOT_APPLICABLE["']/.test(source),
    "klon kendi mod listesini kurdu",
  );
}

/* ------------------------------------------------------------------ *
 * RAPOR
 * ------------------------------------------------------------------ */

function main(): void {
  console.log("===== KLON TASLAKTA DEGER TASIMAYAN CEVAP V1 =====");
  console.log(
    `SCENE_FIELDS=${SCENE_FIELDS.map((s) => `${s.categoryId}/${s.key}`).join(", ")}`,
  );

  measureCloneMatrix();
  measureSecurity();
  measurePurity();
  measureCloneWiring();

  console.log(`PROBLEMS=${problems.length}`);
  console.log("\n--- SINIRLAR (olculdu) ---");
  console.log(
    "  - guvenilir kaynak YALNIZ kaynak RequestFieldValue satiridir; kaynak",
  );
  console.log(
    "    projection fieldResponses / fieldAuthority GUVENILIR SAYILMAZ",
  );
  console.log(
    "  - yalniz UNKNOWN / NOT_APPLICABLE / ANY tasinir; VALUE otoritesi metinden turer",
  );
  console.log("  - legacy textValue etiketi backfill EDILMEZ");
  console.log(
    "  - GERCEK DB ve TARAYICI kabulu: NOT-MEASURED (saf fonksiyon olcumu)",
  );
  console.log(
    "  - KAPSAM DISI: ortak alan jsonValue kaliciligi, quantity kolonu, title karari",
  );

  console.log("\n===== HUKUM =====");
  if (problems.length) {
    console.error("KIRMIZI — klon taslakta bilincli cevap korunmuyor:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    "YESIL — kullanicinin kendi baslattigi klonlamada UNKNOWN ve\n" +
      "NOT_APPLICABLE cevaplari USER_EXPLICIT cevap yuzeyi, ANY ise kendi\n" +
      "constraint kanali olarak yeni TASLAGA tasiniyor; deger yuzeyi\n" +
      "uydurulmuyor, soru yeniden acilmiyor ve rawInput degismiyor; kaynak\n" +
      "projection metadata'si guvenilir sayilmiyor ve DB modu celiskide\n" +
      "kazaniyor; bozuk mod, izinsiz anahtar, legacy etiket ve DB karsiligi\n" +
      "olmayan cevap fail-closed dusuyor; klon DRAFT kaliyor, yayin/fanout\n" +
      "tetiklemiyor, kaynagi mutate etmiyor ve iki ardisik tur idempotent.\n" +
      "\nNOT-MEASURED: gercek veritabani ve tarayici kabulu bu turda\n" +
      "olculmedi.",
  );
  process.exit(0);
}

main();
