/**
 * /talep YENİDEN TASARIMI — TEK KALICI DOĞRULAYICI (kurucu, 2026-09-25).
 *
 * Bu dosya TEK bir sözleşmeyi ölçer: "bir anda tek şey" akışının kendi
 * kurallarını çiğnemediğini. Her endişe için yeni bir betik açılmaz; yeni
 * bir kural doğduğunda buraya bir satır eklenir.
 *
 * ÖLÇÜLEN İDDİALAR.
 *  A. Okuma anı: vurgular YALNIZ anlama sonucundan gelir, metinde yeri
 *     bulunamayan alan vurgulanmaz, aynı alan iki kez vurgulanmaz ve
 *     aralıklar çakışmaz.
 *  B. Talep kartı: doluluk çubuğu TAM OLARAK render edilen satırları sayar;
 *     "şimdi soruluyor" yalnız o an sorulan alana düşer; ek alan chip'leri
 *     yalnız eksik satır kalmadığında ve yalnız şema opsiyonel alanlarından
 *     doğar.
 *  C. Yayın sonucu: PENDING_REVIEW "yayında" DEMEZ (D-0032).
 *  D. Kaynak sınırları: koyu tema yok, koda sabit ₺ aralığı gömülü değil,
 *     talepte görsel yükleme yok, Maira tam ekran sahnesi /talep'ten kalktı.
 *
 * MUTASYON KONTROLÜ. Her ölçüm kusurun KENDİSİNİ üretir (yanlış girdiyle
 * çağırır) ve gate'in kırmızıya döndüğünü gösterir; böylece "her zaman
 * yeşil" bir kapı kalmaz.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { scheduleComposerQuestions } from "../src/lib/request-composer/v2/focused-questions";
import { computeComposerPublishReadiness } from "../src/lib/request-composer/v2/publish-readiness";
import {
  buildReadingHighlights,
  toReadingSegments,
} from "../src/lib/request-composer/v2/reading-highlights";
import {
  buildRequestCardModel,
  composeRequestCardTitle,
} from "../src/lib/request-composer/v2/request-card-model";
import { publishOutcomeFrom } from "../src/lib/request/publish-result-status";
import { composeRequestTitle } from "../src/lib/ai/request-text-composer";

const ROOT = join(__dirname, "..");
const read = (p: string) =>
  existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), "utf8") : null;
const strip = (src: string | null) =>
  src === null
    ? null
    : src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let kapi = 0;
let sorun = 0;
function ok(ad: string, kosul: boolean, detay?: unknown) {
  kapi += 1;
  if (kosul) return;
  sorun += 1;
  console.log(
    `  ✗ ${ad}${detay === undefined ? "" : ` — ${String(detay).slice(0, 200)}`}`,
  );
}

/* ------------------------------------------------------------------ */
console.log("A) Okuma anı — vurgular anlama sonucundan gelir");

const SENTENCE = "Arçelik buzdolabı arıyorum, İstanbul Kadıköy";
const FACTS = [
  { key: "brand", label: "Marka", displayValue: "Arçelik" },
  { key: "productType", label: "Ürün", displayValue: "Buzdolabı" },
  { key: "city", label: "Konum", displayValue: "Kadıköy, İstanbul" },
  /* Metinde geçmeyen bir olgu: yalnız kartta görünmeli, vurgulanmamalı. */
  { key: "budget", label: "Bütçe", displayValue: "32.000 TL" },
];

const spans = buildReadingHighlights({ text: SENTENCE, facts: FACTS });

ok("marka vurgulandı", spans.some((s) => s.key === "brand"), spans);
ok(
  "ürün vurgulandı (büyük/küçük harf ve aksan katlanır)",
  spans.some((s) => s.key === "productType"),
  spans,
);
ok("konum vurgulandı", spans.some((s) => s.key === "city"), spans);
ok(
  "metinde geçmeyen alan VURGULANMAZ",
  !spans.some((s) => s.key === "budget"),
  spans,
);
ok(
  "her alan en fazla bir kez vurgulanır",
  new Set(spans.map((s) => s.key)).size === spans.length,
  spans,
);
{
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  let overlap = false;
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i]!.start < sorted[i - 1]!.end) overlap = true;
  }
  ok("vurgu aralıkları çakışmaz", !overlap, sorted);
}
ok(
  "vurgulanan metin kullanıcının yazdığı parçadır",
  spans.every(
    (s) => SENTENCE.slice(s.start, s.end) === s.text && s.text.length > 0,
  ),
  spans,
);
{
  const segments = toReadingSegments(SENTENCE, spans);
  ok(
    "parçalar birleşince cümlenin aynısını verir",
    segments.map((s) => s.text).join("") === SENTENCE,
  );
}
ok(
  "olgu yoksa hiç vurgu yoktur",
  buildReadingHighlights({ text: SENTENCE, facts: [] }).length === 0,
);

/* Binlik ayracı: anlama "1000" der, kullanıcı "1.000 adet" yazar. */
{
  const qtyText = "1.000 adet kartvizit, mat selefonlu, Topkapı";
  const qtySpans = buildReadingHighlights({
    text: qtyText,
    facts: [
      { key: "quantity", label: "Adet", displayValue: "1000" },
      { key: "productType", label: "Ürün", displayValue: "Kartvizit" },
    ],
  });
  const qty = qtySpans.find((s) => s.key === "quantity");
  ok("binlik ayraçlı sayı vurgulanır", qty?.text === "1.000", JSON.stringify(qtySpans));
  ok(
    "sayı vurgusu ham metnin aynısıdır",
    qty ? qtyText.slice(qty.start, qty.end) === qty.text : false,
  );
  /* MUTASYON: metinde olmayan bir sayı vurgu üretmez. */
  ok(
    "mutasyon: metinde olmayan sayı vurgulanmaz",
    buildReadingHighlights({
      text: qtyText,
      facts: [{ key: "quantity", label: "Adet", displayValue: "2500" }],
    }).length === 0,
  );
}

/* MUTASYON KONTROLÜ: uydurulmuş bir değer metinde bulunamaz. */
ok(
  "mutasyon: metinde olmayan uydurma değer vurgu üretmez",
  buildReadingHighlights({
    text: SENTENCE,
    facts: [{ key: "brand", label: "Marka", displayValue: "Siemens" }],
  }).length === 0,
);

/* ------------------------------------------------------------------ */
console.log("B) Talep kartı — çubuk render edilen satırları sayar");

{
  const model = buildRequestCardModel({
    facts: FACTS.slice(0, 3),
    questions: [
      { fieldKey: "budget", summaryLabel: "Bütçe" },
      { fieldKey: "delivery", summaryLabel: "Teslim" },
    ],
    askingFieldKey: "budget",
    optionalFields: [{ key: "capacity", label: "Kapasite" }],
  });

  ok("satır sayısı = dolu + eksik", model.rows.length === 5, model.rows);
  ok(
    "çubuk paydası render edilen satır sayısıdır",
    model.totalCount === model.rows.length,
    model,
  );
  ok(
    "çubuk payı dolu satır sayısıdır",
    model.filledCount === model.rows.filter((r) => r.value).length,
    model,
  );
  ok(
    "şimdi sorulan alan 'asking' durumundadır",
    model.rows.find((r) => r.key === "budget")?.state === "asking",
    model.rows,
  );
  ok(
    "sorulmayan eksik alan 'pending' kalır",
    model.rows.find((r) => r.key === "delivery")?.state === "pending",
    model.rows,
  );
  ok(
    "eksik satır varken ek alan chip'i GÖRÜNMEZ",
    model.extras.length === 0,
    model.extras,
  );
}

{
  const full = buildRequestCardModel({
    facts: FACTS,
    questions: [],
    optionalFields: [
      { key: "capacity", label: "Kapasite" },
      { key: "brand", label: "Marka" },
    ],
  });
  ok(
    "tüm satırlar dolunca ek alan chip'i görünür",
    full.extras.some((e) => e.key === "capacity"),
    full.extras,
  );
  ok(
    "zaten satırı olan alan chip olarak tekrar sunulmaz",
    !full.extras.some((e) => e.key === "brand"),
    full.extras,
  );
  ok(
    "şema opsiyonel alan vermezse bölüm hiç doğmaz",
    buildRequestCardModel({ facts: FACTS, questions: [] }).extras.length === 0,
  );
  ok(
    "aynı etiket iki ayrı anahtarla iki chip üretmez",
    buildRequestCardModel({
      facts: FACTS,
      questions: [],
      optionalFields: [
        { key: "energyClass", label: "Enerji sınıfı" },
        { key: "energy_class", label: "Enerji Sınıfı" },
      ],
    }).extras.length === 1,
  );
  ok(
    "cevaplanmış/atlanmış opsiyonel alan chip listesinden düşer",
    buildRequestCardModel({
      facts: FACTS,
      questions: [],
      optionalFields: [{ key: "capacity", label: "Kapasite" }],
      answeredFieldKeys: ["capacity"],
    }).extras.length === 0,
  );
}

/*
 * SATIR SINIRINDA ÇEKİRDEK ALAN DÜŞMEZ (ölçüldü 2026-09-25): kart altı satır
 * sınırına dayandığında "Şehir", ikincil bir nitelik uğruna karttan
 * düşüyordu. Konum ve bütçe yayının ön koşulu — ikisi de kalmalı.
 */
{
  const many = buildRequestCardModel({
    facts: [
      { key: "brand", label: "Marka", displayValue: "Arçelik" },
      { key: "condition", label: "Durum", displayValue: "Sıfır" },
      { key: "productType", label: "Ürün", displayValue: "Buzdolabı" },
      { key: "fridgeType", label: "Buzdolabı tipi", displayValue: "Alttan" },
      { key: "fridgeCapacity", label: "Net hacim", displayValue: "200-300 L" },
      { key: "energyClass", label: "Enerji sınıfı", displayValue: "A++" },
      { key: "city", label: "Şehir", displayValue: "Kadıköy, İstanbul" },
      { key: "budget", label: "Bütçe", displayValue: "32.000 TL" },
    ],
    questions: [],
  });
  const keys = many.rows.map((r) => r.key);
  ok("satır sınırı altı satırda duruyor", many.rows.length === 6, keys.join(","));
  ok("konum satırı kırpılmaz", keys.includes("city"), keys.join(","));
  ok("bütçe satırı kırpılmaz", keys.includes("budget"), keys.join(","));
  ok(
    "kırpılan olgu eksik satır olarak geri gelmez",
    !many.rows.some((r) => r.key === "energyClass" && r.value === null),
    keys.join(","),
  );
  ok(
    "çubuk yine render edilen satırları sayar",
    many.totalCount === many.rows.length && many.filledCount === 6,
    JSON.stringify({ t: many.totalCount, f: many.filledCount }),
  );
}

/* MUTASYON KONTROLÜ: boş değerli olgu satır üretmemeli. */
ok(
  "mutasyon: boş değerli olgu satır üretmez",
  buildRequestCardModel({
    facts: [{ key: "brand", label: "Marka", displayValue: "   " }],
    questions: [],
  }).rows.length === 0,
);

/* ------------------------------------------------------------------ */
console.log(
  "B2) Sayaç yalnız yayın için gerekeni sayar — kanonik zamanlayıcıyla ölçülür",
);

/*
 * KURUCU ÖLÇÜMÜ (2026-09-25): "bütçe girilince 3/4 → 4/7 oluyor". Kusur
 * burada ÜRETİLİR ve düzelmiş hâli ölçülür: kart satırları zamanlayıcının
 * `blockingFieldKeys` listesinden gelir, görünür sorulardan değil.
 */
{
  const FRIDGE_STATES = {
    applianceType: {
      kind: "VALUE",
      value: "Buzdolabı",
      provenance: "EXPLICIT_TEXT",
    },
    brand: { kind: "VALUE", value: "Arçelik", provenance: "EXPLICIT_TEXT" },
    city: {
      kind: "VALUE",
      value: "İstanbul / Kadıköy",
      provenance: "EXPLICIT_TEXT",
    },
  } as const;
  const CARD_FACTS = [
    { key: "brand", label: "Marka", displayValue: "Arçelik" },
    { key: "applianceType", label: "Ürün", displayValue: "Buzdolabı" },
    { key: "city", label: "Şehir", displayValue: "Kadıköy, İstanbul" },
  ];

  const beforeBudget = scheduleComposerQuestions({
    categoryId: "appliances",
    needType: "product",
    candidates: [],
    values: { city: "İstanbul / Kadıköy" },
    fieldStates: { ...FRIDGE_STATES },
  });
  ok(
    "bütçe yokken yayını kilitleyen tek alan bütçedir",
    beforeBudget.blockingFieldKeys.join(",") === "budget",
    beforeBudget.blockingFieldKeys,
  );
  const beforeCard = buildRequestCardModel({
    facts: CARD_FACTS,
    questions: beforeBudget.blockingFieldKeys.map((fieldKey, i) => ({
      fieldKey,
      summaryLabel: beforeBudget.blockingLabels[i],
    })),
    askingFieldKey: "budget",
  });
  ok(
    "eksik bütçede sayaç 3/4 der",
    beforeCard.filledCount === 3 && beforeCard.totalCount === 4,
    JSON.stringify({ f: beforeCard.filledCount, t: beforeCard.totalCount }),
  );

  const afterBudget = scheduleComposerQuestions({
    categoryId: "appliances",
    needType: "product",
    candidates: [],
    values: { city: "İstanbul / Kadıköy", budget: "32000" },
    fieldStates: {
      ...FRIDGE_STATES,
      budget: { kind: "VALUE", value: "32000", provenance: "EXPLICIT_TEXT" },
    },
  });
  ok(
    "bütçe girilince yayını kilitleyen alan KALMAZ",
    afterBudget.blockingFieldKeys.length === 0,
    afterBudget.blockingFieldKeys,
  );
  ok(
    "buna rağmen Maira sormaya devam eder (atlanabilir sorular durur)",
    afterBudget.visible.length > 0,
    afterBudget.visible.map((q) => `${q.fieldKey}:${q.importance}`),
  );
  ok(
    "kalan soruların hiçbiri yayın kapısında değildir",
    afterBudget.visible.every(
      (q) => !afterBudget.blockingFieldKeys.includes(q.fieldKey),
    ),
  );

  const optional = afterBudget.visible.map((q) => ({
    key: q.fieldKey,
    label: q.summaryLabel,
  }));
  const readyCard = buildRequestCardModel({
    facts: [
      ...CARD_FACTS,
      { key: "budget", label: "Bütçe", displayValue: "32.000 TL" },
    ],
    questions: afterBudget.blockingFieldKeys.map((fieldKey, i) => ({
      fieldKey,
      summaryLabel: afterBudget.blockingLabels[i],
    })),
    optionalFields: optional,
  });
  ok(
    "zorunlular tamamsa sayaç TAMDIR (4/4)",
    readyCard.filledCount === readyCard.totalCount &&
      readyCard.totalCount === 4,
    JSON.stringify({ f: readyCard.filledCount, t: readyCard.totalCount }),
  );
  ok(
    "atlanabilir sorular kart satırı DEĞİL, chip'tir",
    readyCard.rows.every((r) => r.value !== null) &&
      readyCard.extras.length === optional.length &&
      optional.length > 0,
    JSON.stringify({
      rows: readyCard.rows.map((r) => r.key),
      extras: readyCard.extras.map((e) => e.key),
    }),
  );
  ok(
    "yayın kapısı bu durumda AÇIKTIR",
    computeComposerPublishReadiness({
      hasUsableText: true,
      schedule: afterBudget,
      categoryId: "appliances",
      budgetValue: "32000",
      cityValue: "İstanbul / Kadıköy",
    }).canReview === true,
  );

  /*
   * MUTASYON KONTROLÜ — KUSURUN KENDİSİ. Eski kural (görünür soruların
   * "optional" olmayanlarını satır yaz) geri getirilirse payda şişer ve
   * yayına hazır talep eksik görünür. Kapı bunu görmeli.
   */
  const mutated = buildRequestCardModel({
    facts: [
      ...CARD_FACTS,
      { key: "budget", label: "Bütçe", displayValue: "32.000 TL" },
    ],
    questions: afterBudget.visible
      .filter((q) => q.importance !== "optional")
      .map((q) => ({ fieldKey: q.fieldKey, summaryLabel: q.summaryLabel })),
  });
  ok(
    "mutasyon: eski kural sayacı şişirir (4/7) ve kapı bunu yakalar",
    mutated.totalCount > mutated.filledCount && mutated.totalCount >= 6,
    JSON.stringify({ f: mutated.filledCount, t: mutated.totalCount }),
  );
}

/* ------------------------------------------------------------------ */
console.log("B3) Kart başlığı kısadır — marka + ürün");

{
  const LONG = "Arçelik Buzdolabı arıyorum - Kadıköy, İstanbul";
  const short = composeRequestCardTitle({
    brand: "Arçelik",
    productType: "Buzdolabı",
    fallbackTitle: LONG,
  });
  ok("marka + ürün kısa başlığı verir", short === "Arçelik buzdolabı", short);
  ok(
    "kısa başlıkta konum geçmez",
    !/Kadıköy|İstanbul/.test(short) && !/arıyorum/i.test(short),
    short,
  );
  ok(
    "marka yoksa ürün adı yazılır",
    composeRequestCardTitle({ productType: "Buzdolabı", fallbackTitle: LONG }) ===
      "Buzdolabı",
  );
  ok(
    "ürün bilinmiyorsa mevcut başlığa düşülür (uydurma yok)",
    composeRequestCardTitle({ brand: "Arçelik", fallbackTitle: LONG }) === LONG,
  );
  ok(
    "kısaltma bozulmaz",
    composeRequestCardTitle({
      brand: "Samsung",
      productType: "LED TV",
      fallbackTitle: LONG,
    }) === "Samsung LED TV",
  );
  ok(
    "marka ürün adının içindeyse iki kez yazılmaz",
    composeRequestCardTitle({
      brand: "Arçelik",
      productType: "Arçelik Buzdolabı",
      fallbackTitle: LONG,
    }) === "Arçelik Buzdolabı",
  );
  /* MUTASYON: ürün boş/boşluk ise kısa başlık uydurulmaz. */
  ok(
    "mutasyon: boş ürün kısa başlık üretmez",
    composeRequestCardTitle({
      brand: "Arçelik",
      productType: "   ",
      fallbackTitle: LONG,
    }) === LONG,
  );
}

/* ------------------------------------------------------------------ */
console.log("B4) Yayın başlığı ile kart başlığı AYNI kaynaktan gelir");

/**
 * NEDEN BU BÖLÜM VAR (2026-09-25 akşam). B3 yalnız kart yüzeyini ölçüyordu;
 * TEDARİKÇİNİN gördüğü yayın başlığını `composeRequestTitle` üretiyor ve ikisi
 * ayrışıyordu. Ölçüldü: "Arçelik buzdolabı arıyorum, Kadıköy" cümlesinde kart
 * "Arçelik buzdolabı" gösterirken yayın başlığı "Arçelik buzdolabı Kadıköy"
 * oluyordu — ham metin yedeği ilk altı sözcüğü alıyor ve KONUM da o altıya
 * giriyordu. "Buzdolabı arıyorum, Bosch hariç" ise "Buzdolabı Bosch hariç"
 * üretiyordu: kullanıcının REDDETTİĞİ marka başlıkta duruyordu.
 *
 * Kullanıcının kartta onayladığı başlık ile yayınlanan başlığın farklı olması
 * bir görünüm kusuru değil, onayın geçersizleşmesidir.
 */
{
  const titleOf = (rawText: string, values: Record<string, string> = {}) =>
    composeRequestTitle({
      categoryId: "",
      rawText,
      attributes: values,
      fieldValues: values,
    });

  ok(
    "konum yayın başlığına girmez",
    titleOf("Arçelik buzdolabı arıyorum, Kadıköy") === "Arçelik buzdolabı",
    titleOf("Arçelik buzdolabı arıyorum, Kadıköy"),
  );
  ok(
    "semt adı da yayın başlığına girmez",
    !/Topkapı/i.test(titleOf("Kartvizit arıyorum, Topkapı")),
    titleOf("Kartvizit arıyorum, Topkapı"),
  );
  ok(
    "reddedilen marka yayın başlığına girmez",
    !/Bosch/i.test(titleOf("Buzdolabı arıyorum, Bosch hariç")),
    titleOf("Buzdolabı arıyorum, Bosch hariç"),
  );
  /* Marka + ürün biliniyorsa iki yüzey BİREBİR aynı dizeyi verir. */
  const values = { brand: "Arçelik", productType: "Buzdolabı" };
  ok(
    "marka + ürün biliniyorsa iki başlık birebir aynıdır",
    titleOf("Arçelik buzdolabı arıyorum, Kadıköy", values) ===
      composeRequestCardTitle({
        brand: "Arçelik",
        productType: "Buzdolabı",
        fallbackTitle: "Arçelik buzdolabı arıyorum, Kadıköy",
      }),
    titleOf("Arçelik buzdolabı arıyorum, Kadıköy", values),
  );
  /* MUTASYON: hiçbir yapı yoksa başlık uydurulmaz. */
  ok(
    "mutasyon: boş metin başlık uydurmaz",
    titleOf("   ") === "Yeni talep",
    titleOf("   "),
  );
}

/* ------------------------------------------------------------------ */
console.log("C) Yayın sonucu — PENDING_REVIEW 'yayında' demez (D-0032)");

{
  const held = publishOutcomeFrom({
    status: "PENDING_REVIEW",
    publishedAt: null,
  });
  ok("inceleme bekleyen talep 'pending_review' döner", held.kind === "pending_review");
  ok(
    "inceleme metninde 'yayında' geçmez",
    !/yayında/i.test(`${held.badge} ${held.headline} ${held.detail}`),
    held,
  );

  const live = publishOutcomeFrom({
    status: "PUBLISHED",
    publishedAt: "2026-09-25T10:00:00.000Z",
  });
  ok("yayınlanan talep 'published' döner", live.kind === "published");
  ok("yayın metni 'yayında' der", /yayında/i.test(live.headline), live);

  /* MUTASYON: publishedAt boşsa durum ne olursa olsun yayında denmez. */
  ok(
    "mutasyon: publishedAt boşken 'yayında' denmez",
    publishOutcomeFrom({ status: "PUBLISHED", publishedAt: null }).kind ===
      "pending_review",
  );
}

/* ------------------------------------------------------------------ */
console.log("D) Kaynak sınırları — tasarımın dokunulmaz maddeleri");

const page = strip(read("src/app/talep/page.tsx"));
const card = strip(read("src/components/request/talep/RequestCardPanel.tsx"));
const start = strip(read("src/components/request/talep/TalepStartPanel.tsx"));
const sheet = strip(read("src/components/request/talep/CategorySheet.tsx"));
const questions = strip(
  read("src/components/request/v2/FocusedQuestionsPanel.tsx"),
);
const surfaces = [
  ["page", page],
  ["RequestCardPanel", card],
  ["TalepStartPanel", start],
  ["CategorySheet", sheet],
  ["FocusedQuestionsPanel", questions],
] as const;

ok(
  "yeni yüzeylerin hepsi okunabiliyor",
  surfaces.every(([, src]) => src != null),
  surfaces.filter(([, src]) => src == null).map(([ad]) => ad),
);

for (const [ad, src] of surfaces) {
  ok(
    `${ad}: koyu tema sınıfı yok`,
    Boolean(src && !/\bdark:/.test(src) && !/prefers-color-scheme/.test(src)),
  );
}

ok(
  "soru yüzeyine sabit ₺ aralığı gömülmemiş",
  Boolean(
    questions &&
      !/\d[\d.]*\s*(?:₺|TL)['’]?(?:ye|ya)?\s*kadar/i.test(questions) &&
      !/\d+\s*[–-]\s*\d+\s*bin\s*(?:₺|TL)/i.test(questions),
  ),
);
ok(
  "sayfada sabit bütçe ön ayar listesi kalmadı",
  Boolean(page && !/BUDGET_PRESETS/.test(page)),
);

ok(
  "talepte görsel yükleme yolu yok",
  surfaces.every(
    ([, src]) =>
      !src || (!/type="file"/.test(src) && !/FormData\(/.test(src)),
  ),
);

ok(
  "Maira tam ekran sahnesi /talep'ten kaldırıldı",
  Boolean(page && !/MairaStage/.test(page) && !/MairaHandoffScene/.test(page)),
);
ok(
  "görünüm anahtarı (form ⇄ Maira) kalmadı",
  /* Sınır `\b` ile: "publishReviewModel" gibi adlar yanlış yakalanmasın. */
  Boolean(page && !/\bviewMode\b/.test(page)),
);

ok(
  "kart kategori fotoğrafını kanonik kayıttan okur",
  Boolean(card && /getCategoryVisual/.test(card) && /next\/image/.test(card)),
);
ok(
  "kategori paneli kendi kategori listesini kurmaz",
  Boolean(
    sheet &&
      !/REQUEST_CATEGORIES/.test(sheet) &&
      !/request-category-engine/.test(sheet),
  ),
);
ok(
  "başlangıç ekranı kendi çıkarımını yapmaz",
  Boolean(
    start &&
      !/understandRequest/.test(start) &&
      !/request-understanding/.test(start),
  ),
);
ok(
  "kart satırları kanonik soru köprüsüne bağlanıyor",
  Boolean(page && /onAskField=\{/.test(page) && /resolveAnswerEditQuestion/.test(page)),
);

/*
 * ZORUNLULUK KARARI SAYFADA İCAT EDİLMEZ. Kart satırları kanonik
 * `blockingFieldKeys` listesinden gelir; "importance optional değilse satır
 * yaz" kuralı geri dönerse bu kapı kırmızıya döner.
 */
ok(
  "kart eksik satırları kanonik engelleyen alan listesinden gelir",
  Boolean(page && /blockingFieldKeys\.map\(/.test(page)),
);
ok(
  "kart satırı kuralı soru önem derecesine göre yazılmıyor",
  Boolean(page && !/question\.importance !== "optional"/.test(page)),
);
ok(
  "kart kısa başlığı kanonik türeticiden gelir",
  Boolean(page && /composeRequestCardTitle\(\{/.test(page)),
);
ok(
  "yayın başlığı üreticisi bu işte DEĞİŞTİRİLMEDİ (kart yalnız gösterir)",
  Boolean(card && !/composeRequestTitle/.test(card)),
);
ok(
  "kart 'Yayına hazır'ı kanonik readiness'ten okur, kendi hesaplamaz",
  Boolean(
    card &&
      /data-meter-ready/.test(card) &&
      /complete && ready/.test(card) &&
      !/canReview|computeComposerPublishReadiness/.test(card),
  ),
);
ok(
  "'İsteğe bağlı' rozeti kanonik zorunlu alan listesine bağlı",
  Boolean(
    questions &&
      /requiredFieldKeys/.test(questions) &&
      /composer-question-optional/.test(questions),
  ),
);

/* ------------------------------------------------------------------ */
/*
 * MAIRA'NIN YÜZÜ — KADRAJ. Küçük kutuda portre kadrajı istenir; onaylanan
 * KOYU/tam kadrajın değerleri CONFIG'den TÜRER, ikinci bir kopya tutulmaz.
 */
const scene = strip(read("src/lib/maira/contour-scene.ts"));
const sceneView = strip(read("src/components/request/maira/MairaContourScene.tsx"));
const face = strip(read("src/components/request/talep/MairaFace.tsx"));

ok(
  "sahne kaynakları okunabiliyor",
  Boolean(scene && sceneView && face),
);
ok(
  "tam kadraj onaylanan CONFIG değerlerinden TÜRER (kopya sayı yok)",
  Boolean(
    scene &&
      /full:\s*\{\s*camTargetY:\s*CONFIG\.camTargetY,\s*camDist:\s*CONFIG\.camDist\s*\}/.test(
        scene,
      ),
  ),
);
ok(
  "portre kadrajı yalnız bakılan yükseklik + mesafeyi değiştirir",
  Boolean(
    scene &&
      /portrait:\s*\{\s*camTargetY:\s*[\d.]+,\s*camDist:\s*[\d.]+\s*\}/.test(scene),
  ),
);
ok(
  "varsayılan kadraj tamdır (koyu sahne yolu değişmez)",
  Boolean(
    scene &&
      /opts\.framing \?\? "full"/.test(scene) &&
      sceneView &&
      /framing = "full"/.test(sceneView),
  ),
);
ok(
  "/talep yüzü portre kadrajıyla açık zeminde kurulur",
  Boolean(face && /framing="portrait"/.test(face) && /appearance="light"/.test(face)),
);
ok(
  "yer tutucu halkalarda gövde/omuz yayı kalmadı",
  Boolean(face && !/<path/.test(face)),
);
ok(
  "kanıt karesi uygulanan kadrajı kendi söyler",
  Boolean(sceneView && /dataset\.framing/.test(sceneView)),
);

console.log(`\nkapi=${kapi} sorun=${sorun}`);
console.log(sorun === 0 ? "SONUC=GECTI" : "SONUC=KALDI");
process.exit(sorun === 0 ? 0 : 1);
