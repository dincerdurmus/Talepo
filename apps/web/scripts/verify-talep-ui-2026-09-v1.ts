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
import { readingDurationMs } from "../src/lib/motion/talep-motion";
import {
  composeRequestTitle,
  resolveSuggestedRequestTitle,
  titleRepeatsContent,
} from "../src/lib/ai/request-text-composer";
import { createTextOnlyState } from "../src/lib/request-composer/sync";
import { composeNaturalRequestText } from "../src/lib/request-composer/compose-text";
import { resolveRequestCategory } from "../src/lib/request-category-engine";
import {
  findProvinceAndDistrictInText,
  textMentionsPlace,
} from "../src/lib/geo/turkey-districts";

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
/**
 * KAPI (a) — METİNDE YERİ BULUNAN HER ALAN VURGULANIR, KONUM DAHİL.
 *
 * Kurucu ölçümü (2026-09-25, `m-2-okuma.png`): "Arçelik buzdolabı arıyorum,
 * İstanbul Kadıköy" cümlesinde yalnız MARKA ve ÜRÜN yanıyordu. Anlama konumu
 * "il / ilçe" diye ayrı tutuyor, cümlede ise ikisi bitişik yazılmış; yalnız
 * parçalar arandığı için ilk bulunan "İstanbul" tek başına vurgulanıyor ve
 * ilçe karanlıkta kalıyordu. Vurgu artık konumun TAMAMINI kapsar.
 */
console.log("A2) Konum vurgusu — il ve ilçe bitişik de aranır");

{
  const cityFact = (value: string) => [
    { key: "city", label: "Konum", displayValue: value },
  ];

  const joined = buildReadingHighlights({
    text: SENTENCE,
    facts: cityFact("İstanbul / Kadıköy"),
  });
  ok(
    "(a) bitişik yazılan il+ilçe TEK vurguda tamamen yanar",
    joined.length === 1 && joined[0]!.text === "İstanbul Kadıköy",
    JSON.stringify(joined),
  );
  ok(
    "(a) vurgu ham metnin aynısıdır",
    joined.length === 1 &&
      SENTENCE.slice(joined[0]!.start, joined[0]!.end) === joined[0]!.text,
  );

  /* Ters sıra: anlama "Kadıköy, İstanbul" derken kullanıcı "İstanbul Kadıköy"
     yazmış olabilir; iki sıralama da denenir. */
  ok(
    "(a) ters sıralı değer de bitişik yakalanır",
    buildReadingHighlights({
      text: SENTENCE,
      facts: cityFact("Kadıköy, İstanbul"),
    })[0]?.text === "İstanbul Kadıköy",
  );

  /* Ayraç esnektir: "İstanbul, Kadıköy'de" de tek vurgudur. */
  {
    const commaText = "İstanbul, Kadıköy'de televizyon arıyorum";
    const comma = buildReadingHighlights({
      text: commaText,
      facts: cityFact("İstanbul / Kadıköy"),
    });
    ok(
      "(a) virgüllü yazılış da tek vurgudur",
      comma[0]?.text === "İstanbul, Kadıköy",
      JSON.stringify(comma),
    );
  }

  /* EK TOLERANSI: yalnız ilçe yazılmışsa ek vurguyu bozmaz. */
  {
    const rentText = "Kadıköy'de kiralık 3+1, eşyasız, 60 bin TL'ye kadar";
    const rent = buildReadingHighlights({
      text: rentText,
      facts: cityFact("İstanbul / Kadıköy"),
    });
    ok(
      "(a) ekli ilçe ('Kadıköy'de') vurgulanır",
      rent[0]?.text === "Kadıköy",
      JSON.stringify(rent),
    );
  }

  /*
   * MUTASYON KONTROLÜ — KUSURUN KENDİSİ. Eski davranış "yalnız parçaları ara"
   * idi; o kural geri gelirse bitişik yazılan konumun ancak YARISI vurgulanır.
   * Kusuru burada üretip kapının onu ayırt ettiğini gösteriyoruz.
   */
  const halfOnly = buildReadingHighlights({
    text: SENTENCE,
    facts: cityFact("İstanbul"),
  });
  ok(
    "mutasyon: yalnız il aranırsa vurgu ilçeyi kapsamaz (kapı bunu ayırt eder)",
    halfOnly[0]?.text === "İstanbul" &&
      halfOnly[0]!.text !== joined[0]?.text,
    JSON.stringify(halfOnly),
  );
  /* MUTASYON: metinde hiç geçmeyen konum yine vurgulanmaz. */
  ok(
    "mutasyon: metinde olmayan konum vurgulanmaz",
    buildReadingHighlights({
      text: SENTENCE,
      facts: cityFact("Ankara / Çankaya"),
    }).length === 0,
  );
}

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
console.log(
  "B5) Kullanıcıya gösterilen başlık kısadır — konum ve arama fiili girmez",
);

/**
 * NEDEN BU BÖLÜM VAR (2026-09-26). B4 yalnız `composeRequestTitle`i ölçüyordu;
 * `/talep` sayfası ise onun ÜSTÜNE kendi kuralını koyuyordu: üretilmiş doğal
 * cümleyi başlık yapıyor ve sonuna konumu ekliyordu. Ölçülen kusur:
 *   "Kadıköy'de kiralık 3+1, eşyasız, 60 bin TL'ye kadar"
 *     → "kiralık 3+1 konut arıyorum - Kadıköy, İstanbul"
 * Kural 1e (`4d6d587`) konumun ve olumsuzlamanın başlığa girmemesini, arama
 * fiilinin düşmesini söylüyor. 14 cümlede ölçüldü: konum 12/14, arama fiili
 * 14/14 başlıkta duruyordu.
 *
 * Bu bölüm üretim yolunu ölçer: gerçek anlama sonucundan (`createTextOnlyState`)
 * üretilmiş doğal cümle + `composeRequestTitle` → `resolveSuggestedRequestTitle`.
 * Kendi karar kopyası kurulmaz.
 */
{
  const ARAMA_FIILI =
    /\b(arıyorum|ariyorum|istiyorum|lazım|lazim|aranıyor|bastırmak|bastirmak)\b/iu;

  /** Üretim yolu: sayfanın verdiği girdilerin aynısı. */
  const uretimBasligi = (rawText: string) => {
    const state = createTextOnlyState(rawText);
    const categoryId = state.categoryId ?? "";
    const category = resolveRequestCategory(categoryId, undefined);
    const values: Record<string, string> = {};
    for (const [key, field] of Object.entries(state.fields ?? {})) {
      const value = (field as { value?: string } | undefined)?.value;
      if (value) values[key] = value;
    }
    const autoTitle = composeRequestTitle({
      categoryId,
      rawText,
      attributes: values,
      fieldValues: values,
      city: values.city ?? "",
      fields: category?.fields,
    });
    const composedText = (
      state.lastComposedText ?? composeNaturalRequestText(state)
    ).trim();
    return {
      title: resolveSuggestedRequestTitle({
        categoryId,
        rawText,
        composedText,
        autoTitle,
        yearValues: {
          yearMin: values.yearMin,
          yearMax: values.yearMax,
          modelYear: values.modelYear,
        },
        resolvedPlace: values.city ?? values.location ?? "",
      }),
      composedText,
      autoTitle,
      categoryId,
    };
  };

  /** Emlak, otomotiv ve genel — en az on cümle. */
  const CUMLELER = [
    "Kadıköy'de kiralık 3+1, eşyasız, 60 bin TL'ye kadar",
    "Ankara Çankaya'da kiralık 3+1 daire arıyorum",
    "İstanbul Beşiktaş'ta satılık 2+1 daire arıyorum",
    "Kadıköy'de kiralık dükkan arıyorum",
    "İzmir Bornova'da kiralık depo arıyorum",
    "Egea için 4 kış lastiği, takma dahil, Ümraniye",
    "2018 ve üzeri Fiat Egea arıyorum, Bursa",
    "Arçelik buzdolabı arıyorum, İstanbul Kadıköy",
    "Bosch çamaşır makinesi lazım, Ankara",
    "500 adet kartvizit bastırmak istiyorum, Topkapı",
    "Ofis boyama hizmeti arıyorum, Şişli",
    "Buzdolabı arıyorum, Bosch hariç",
  ];

  for (const cumle of CUMLELER) {
    const { title } = uretimBasligi(cumle);
    const place = findProvinceAndDistrictInText(cumle);
    const konumVar = Boolean(
      place &&
        (textMentionsPlace(title, place.il) ||
          (place.ilce ? textMentionsPlace(title, place.ilce) : false)),
    );
    ok(`konum başlığa girmiyor — "${cumle.slice(0, 34)}"`, !konumVar, title);
    ok(
      `arama fiili başlıktan düşüyor — "${cumle.slice(0, 34)}"`,
      !ARAMA_FIILI.test(title),
      title,
    );
    ok(`başlık boş kalmıyor — "${cumle.slice(0, 34)}"`, title.trim().length >= 3, title);
    /* Videodaki kısalık: başlık altı sözcüğü geçmez. */
    ok(
      `başlık kısa kalıyor — "${cumle.slice(0, 34)}"`,
      title.split(/\s+/u).filter(Boolean).length <= 6,
      title,
    );
  }

  /* Emlak başlığı kurucunun istediği iki biçimden birine denk gelir. */
  ok(
    "emlak başlığı videodaki biçimde",
    uretimBasligi("Kadıköy'de kiralık 3+1, eşyasız, 60 bin TL'ye kadar").title ===
      "Kiralık 3+1 konut",
    uretimBasligi("Kadıköy'de kiralık 3+1, eşyasız, 60 bin TL'ye kadar").title,
  );
  /* Reddedilen marka başlıkta durmaz, kalan bağlaç da bırakılmaz. */
  ok(
    "reddedilen marka ve artık bağlaç başlıkta kalmıyor",
    uretimBasligi("Buzdolabı arıyorum, Bosch hariç").title === "Buzdolabı",
    uretimBasligi("Buzdolabı arıyorum, Bosch hariç").title,
  );
  /* Temizlik yazımı küçültmez: kanonik ürün adı büyük harfini korur. */
  ok(
    "temizlik kanonik yazımı küçültmüyor",
    /Kartvizit/.test(
      uretimBasligi("500 adet kartvizit bastırmak istiyorum, Topkapı").title,
    ),
    uretimBasligi("500 adet kartvizit bastırmak istiyorum, Topkapı").title,
  );
  /* Başlık kendini tekrar etmez ("… hizmeti … hizmeti"). */
  ok(
    "hizmet başlığı kendini tekrar etmiyor",
    !titleRepeatsContent(uretimBasligi("Ofis boyama hizmeti arıyorum, Şişli").title),
    uretimBasligi("Ofis boyama hizmeti arıyorum, Şişli").title,
  );
  /* İl adıyla çakışan ürün sözcüğü silinmez ("Ağrı kesici"). */
  ok(
    "il adıyla çakışan ürün sözcüğü korunuyor",
    /Ağrı kesici/.test(uretimBasligi("Ağrı kesici ilaç arıyorum, İstanbul").title),
    uretimBasligi("Ağrı kesici ilaç arıyorum, İstanbul").title,
  );

  /**
   * MUTASYON KONTROLÜ — kusurun KENDİSİ üretilir.
   *
   * Kaldırılan kural birebir geri konur (son süzgeç atlanır, sonuna konum
   * eklenir) ve yukarıdaki iki kapının bu çıktıyı REDDETTİĞİ gösterilir.
   * Reddetmezse kapılar her zaman yeşil olurdu.
   */
  {
    const cumle = "Kadıköy'de kiralık 3+1, eşyasız, 60 bin TL'ye kadar";
    const { composedText } = uretimBasligi(cumle);
    const place = findProvinceAndDistrictInText(cumle);
    const mutant = `${composedText.replace(/[.!\s]+$/u, "")} - ${place?.ilce}, ${place?.il}`;
    ok(
      "mutasyon: konum eklenen başlık kapıdan geçmiyor",
      Boolean(place) && textMentionsPlace(mutant, place!.ilce),
      mutant,
    );
    ok(
      "mutasyon: arama fiili bırakılan başlık kapıdan geçmiyor",
      ARAMA_FIILI.test(mutant),
      mutant,
    );
    ok(
      "mutasyon: uzun başlık kısalık kapısından geçmiyor",
      mutant.split(/\s+/u).filter(Boolean).length > 6,
      mutant,
    );
  }

  /* Sayfa kendi başlık kuralını TUTMUYOR. */
  const pageSrc = strip(read("src/app/talep/page.tsx"));
  ok(
    "sayfa başlığı tek yetkiliden okuyor",
    Boolean(pageSrc && /resolveSuggestedRequestTitle\(/.test(pageSrc)),
  );
  ok(
    "sayfa başlığa konum eklemiyor",
    Boolean(pageSrc && !/locationLabel/.test(pageSrc)),
  );
  ok(
    "sayfa ikinci bir başlık kuralı tutmuyor",
    Boolean(
      pageSrc &&
        !/function\s+title(?:PreservesRequestSubject|RepeatsContent|HasMeaningfulSubject)/.test(
          pageSrc,
        ),
    ),
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

/* ------------------------------------------------------------------ */
/**
 * E) TANITIM VİDEOSUNDAKİ SADELİK — YENİ KAPILAR (kurucu, 2026-09-25).
 *
 * Her kapı bir kaynak ŞEKLİNİ ölçer ve hemen ardından kusurun kendisini
 * üretir: ilgili kaynak dizesi eski hâline "geri döndürülür" ve kapının
 * kırmızıya döndüğü gösterilir. Böylece hiçbiri her zaman yeşil kalmaz.
 */
console.log("E) Videodaki sadelik — kart, soru alanı, yayın anı");

const publishStatusSrc = strip(read("src/lib/request/publish-result-status.ts"));

/** Kapı yordamları: aynı ölçüm hem gerçek kaynağa hem mutasyona uygulanır. */
const gate = {
  /** (b) Kategori doğrulaması karttan çıktı, tek soru alanında. */
  cardHasNoCategoryQuestion: (cardSrc: string, pageSrc: string) =>
    /*
      Kart kategori SORUSUNU taşımaz. D-0047'de karta tek bir GÖRÜNÜRLÜK
      bayrağı eklendi (`categoryStepOpen` → "Değiştir" düğmesinin
      `aria-expanded` değeri); o bayrak adımın kendisi değildir ve kapının
      ölçtüğü şeyi değiştirmez. Bu yüzden kapı adımın kendisine bakar:
      modelin taşınması, eylemin çağrılması ya da etiketlerin yazılması.
    */
    !/categoryStep(?!Open\b)/.test(cardSrc) &&
    !/onCategoryAction/.test(cardSrc) &&
    !/confirmLabel|rejectLabel/.test(cardSrc) &&
    /<CategoryConfirmationCard[\s\S]*?onAction=\{applyCategoryConfirmation\}/.test(
      pageSrc,
    ),
  /** (c) Yayın butonu isteğe bağlı bölümün ÜSTÜNDE ve bölüm kapalı doğar. */
  publishAboveOptional: (pageSrc: string) => {
    const cta = pageSrc.indexOf('data-testid="composer-review-cta"');
    const details = pageSrc.indexOf('data-testid="composer-optional-details"');
    return (
      cta >= 0 &&
      details > cta &&
      /const \[optionalOpen, setOptionalOpen\] = useState\(false\)/.test(pageSrc) &&
      /open=\{optionalOpen\}/.test(pageSrc) &&
      /showQuestionInDetails[\s\S]{0,400}?optionalOpen/.test(pageSrc)
    );
  },
  /**
   * (g) SIRA: kategori onayı beklerken yayın butonu ekranın dibine
   * KENETLENMEZ (2026-09-26). DOM sırası zaten doğruydu; kusur, telefonda
   * kenetlenmiş (position: fixed) butonun akıştan çıkıp sorunun ÜSTÜNE
   * oturmasıydı. Kenetleme koşulu bu yüzden kategori adımına bağlıdır ve alt
   * pay da aynı koşulu okur.
   */
  publishDockYieldsToCategory: (pageSrc: string) => {
    const dock = pageSrc.indexOf('data-testid="composer-publish-dock"');
    if (dock < 0) return false;
    const block = pageSrc.slice(dock, dock + 1200);
    return (
      /data-docked=\{\s*categoryStepActive\s*\?\s*"inline"/.test(block) &&
      /categoryStepActive\s*\?\s*""\s*:\s*`max-lg:fixed/.test(block) &&
      /categoryStepActive \? null : \(\s*<div aria-hidden className="max-lg:h-\[86px\] lg:hidden" \/>/.test(
        pageSrc,
      ) &&
      /* Soru kaynakta da butondan ÖNCE kurulur. */
      pageSrc.indexOf("<CategoryConfirmationCard") <
        pageSrc.indexOf('data-testid="composer-review-cta"')
    );
  },
  /**
   * (d) "Yayında" görüntüsü yalnız published durumunda kurulur: onay işareti
   * de, mono satır da aynı koşula bağlıdır ve metin sunucudan gelen kanonik
   * sonuçtan okunur (sayfa kendi cümlesini yazmaz).
   */
  publishedOnlyWhenPublished: (pageSrc: string) =>
    /publishOutcome\.kind === "published"[\s\S]{0,400}?<Check/.test(pageSrc) &&
    /publishOutcome\.kind === "published"\s*\?\s*"Teklif geldikçe burada görünecek"/.test(
      pageSrc,
    ) &&
    /\{publishOutcome\.headline\}/.test(pageSrc),
  /** (e) Teslim sınırı: gönderim dili yok. */
  noDeliveryVerbs: (...sources: string[]) =>
    sources.every((src) => !/ulaştı|iletildi|gönderildi/i.test(src)),
  /** (f) "Tüm alt kategoriler" yer tutucusu hiçbir yüzeyde yok. */
  noSubcategoryPlaceholder: (...sources: string[]) =>
    sources.every((src) => !/Tüm alt kategoriler/.test(src)),
};

ok(
  "(b) kart kategori sorusu taşımaz; doğrulama tek soru alanında aynı eylemi çağırır",
  Boolean(card && page && gate.cardHasNoCategoryQuestion(card, page)),
);
ok(
  "mutasyon: kategori kutusu karta geri konursa kapı kırmızı olur",
  Boolean(
    card &&
      page &&
      !gate.cardHasNoCategoryQuestion(
        `${card}\n categoryStep.confirmLabel; onCategoryAction({ kind: "confirm" });`,
        page,
      ),
  ),
);

ok(
  "(c) yayın butonu isteğe bağlı bölümün ÜSTÜNDE ve bölüm kapalı doğar",
  Boolean(page && gate.publishAboveOptional(page)),
);
ok(
  "mutasyon: isteğe bağlı bölüm varsayılan açık olursa kapı kırmızı olur",
  Boolean(
    page &&
      !gate.publishAboveOptional(
        page.replace(
          "const [optionalOpen, setOptionalOpen] = useState(false)",
          "const [optionalOpen, setOptionalOpen] = useState(true)",
        ),
      ),
  ),
);
ok(
  "mutasyon: bölüm butonun ÜSTÜNE alınırsa kapı kırmızı olur",
  Boolean(
    page &&
      !gate.publishAboveOptional(
        `data-testid="composer-optional-details"\n${page}`,
      ),
  ),
);

ok(
  "(g) kategori onayı beklerken yayın butonu kenetlenmez, soru üstte kalır",
  Boolean(page && gate.publishDockYieldsToCategory(page)),
);
ok(
  "mutasyon: buton her durumda kenetlenirse kapı kırmızı olur",
  Boolean(
    page &&
      !gate.publishDockYieldsToCategory(
        page.replace(
          /data-docked=\{\s*categoryStepActive\s*\?\s*"inline"[\s\S]*?\}/,
          'data-docked={keyboardOpen ? "hidden" : "visible"}',
        ),
      ),
  ),
);

ok(
  "(d) 'yayında' görüntüsü yalnız published durumunda kurulur",
  Boolean(page && gate.publishedOnlyWhenPublished(page)),
);
ok(
  "mutasyon: onay işareti koşulsuz çizilirse kapı kırmızı olur",
  Boolean(
    page &&
      !gate.publishedOnlyWhenPublished(
        page.replace(/publishOutcome\.kind === "published"/g, "true"),
      ),
  ),
);

const publishSurfaces = [page, publishStatusSrc].filter(
  (src): src is string => src != null,
);
ok(
  "(e) yayın sonrası metinde 'ulaştı / iletildi / gönderildi' yok",
  publishSurfaces.length === 2 && gate.noDeliveryVerbs(...publishSurfaces),
);
ok(
  "mutasyon: gönderim dili geri gelirse kapı kırmızı olur",
  !gate.noDeliveryVerbs(
    ...publishSurfaces,
    "Talebin 42 tedarikçiye iletildi.",
  ),
);

const cardSurfaces = [card, page, start].filter(
  (src): src is string => src != null,
);
ok(
  "(f) 'Tüm alt kategoriler' yer tutucusu hiçbir kartta görünmez",
  cardSurfaces.length === 3 && gate.noSubcategoryPlaceholder(...cardSurfaces),
);
ok(
  "mutasyon: yer tutucu geri gelirse kapı kırmızı olur",
  !gate.noSubcategoryPlaceholder(
    ...cardSurfaces,
    '{leafLabel ?? "Tüm alt kategoriler"}',
  ),
);

/* ------------------------------------------------------------------ */
/**
 * E2) BAŞLANGIÇ EKRANI VE HAREKET DİLİ.
 *
 * Videodaki ilk an: büyük yüz, mono `MAIRA`, "Tek cümle yaz." ve kutu. Kutunun
 * altındaki açıklama ile ipucu satırı kalktı. Süreler tek tabloda toplandı.
 */
console.log("E2) Başlangıç ekranı ve hareket dili");

const motion = strip(read("src/lib/motion/talep-motion.ts"));
const voice = strip(read("src/components/request/talep/MairaVoice.tsx"));

ok("hareket tablosu okunabiliyor", motion != null);
ok(
  "başlangıç başlığı 'Tek cümle yaz.' ve placeholder 'Ne arıyorsun?'",
  Boolean(
    start &&
      /Tek cümle yaz\./.test(start) &&
      /placeholder="Ne arıyorsun\?"/.test(start),
  ),
);
ok(
  "kutunun altındaki açıklama ve ipucu satırı kalktı",
  Boolean(
    start &&
      !/Maira eksik kalanı sorar/.test(start) &&
      !/Marka, adet, konum yazarsan/.test(start),
  ),
);
ok(
  "telefonda yüz 240px, masaüstünde 380px",
  Boolean(start && /size=\{240\}/.test(start) && /size=\{380\}/.test(start)),
);
ok(
  "yüzün altında mono MAIRA etiketi var",
  Boolean(start && /talep-start-maira-mark/.test(start)),
);

/**
 * TELEFON HİZASI (D-0046, 2026-09-26) — kurucu kararı: telefonda başlangıç
 * ekranı videodaki gibi ORTALIDIR, masaüstü DEĞİŞMEZ.
 *
 * Neden kaynak üzerinden de ölçülüyor: gerçek hiza tarayıcıda geometriyle
 * ölçülür (`qa-talep-ui-browser-v1.cjs`, 390/1280), ama o geçiş bir sunucu
 * ister. Burada kararın KENDİSİ kilitlenir; iki ayrı hizayı tek sınıf
 * dizisine sıkıştıran bir düzenleme sessizce geçemesin.
 */
{
  const mobilMark = start?.match(/<MairaMark[^>]*size=\{240\}[^>]*\/>/)?.[0] ?? null;
  const masaustuMark =
    start?.match(/<MairaMark[^>]*size=\{380\}[^>]*\/>/)?.[0] ?? null;
  const h1 = start?.match(/<h1[\s\S]*?>/)?.[0] ?? null;

  ok(
    "telefon başlangıcı: yüz + MAIRA etiketi ortalı",
    Boolean(mobilMark && /align="center"/.test(mobilMark)),
    mobilMark,
  );
  ok(
    "telefon başlangıcı: yüzde yatay kaydırma sınıfı kalmadı",
    /* Sınır boşluk DEĞİL tırnak da olabilir: `className="-ml-3 lg:hidden"`. */
    Boolean(mobilMark && !/(?:^|[\s"'`])-?m[lrx]-/.test(mobilMark)),
    mobilMark,
  );
  ok(
    "telefon başlangıcı: 'Tek cümle yaz.' başlığı ortalı",
    Boolean(h1 && /(?:^|\s|")text-center(?:\s|")/.test(h1)),
    h1,
  );
  /* MASAÜSTÜ DEĞİŞMEZ — aynı kapı bunu da kanıtlar. */
  ok(
    "masaüstü başlangıcı: başlık sola hizalı kalır",
    Boolean(h1 && /lg:text-left/.test(h1)),
    h1,
  );
  ok(
    "masaüstü başlangıcı: sağ sütundaki yüz ortalanmadı",
    Boolean(masaustuMark && !/align="center"/.test(masaustuMark)),
    masaustuMark,
  );
  /*
    HİZA TEK PROP'TAN OKUNUR. `justify-items-*` sınıfını dışarıdan `className`
    ile ezmek Tailwind'de sıra bağımlıdır; kapı, hizanın prop'a bağlı kaldığını
    ölçer ki "ortalı" iddiası üretimde sessizce bozulmasın.
  */
  ok(
    "hiza prop'tan gelir (className ile ezilmiyor)",
    Boolean(
      start &&
        /align === "center"/.test(start) &&
        /centered \? "justify-items-center" : "justify-items-start"/.test(start),
    ),
  );
}
ok(
  "süreler tek tablodan okunur (yüzeyler kendi sayısını tutmaz)",
  Boolean(
    voice &&
      card &&
      /@\/lib\/motion\/talep-motion/.test(voice) &&
      /@\/lib\/motion\/talep-motion/.test(card) &&
      !/const REVEAL_STEP_MS/.test(voice),
  ),
);
ok(
  "her hareket yüzeyi azaltılmış hareketi sorar",
  Boolean(
    voice &&
      card &&
      page &&
      /prefersReducedMotion/.test(voice) &&
      /prefersReducedMotion/.test(card) &&
      /prefersReducedMotion\(\)/.test(page),
  ),
);
/* Sınır kaynak metninden değil, kanonik fonksiyondan ölçülür. */
ok(
  "okuma anı 3 saniyeyi aşmaz ve vurgu sayısıyla uzar",
  readingDurationMs(50) <= 3000 &&
    readingDurationMs(1) > readingDurationMs(0) &&
    readingDurationMs(1) < 3000,
  `${readingDurationMs(0)} / ${readingDurationMs(1)} / ${readingDurationMs(50)}`,
);

/**
 * NABIZ DEKORATİFTİR. Sahne el tutamağına `pulse()` eklendi; hiçbir karar,
 * cevap ya da telemetri taşımadığı ölçülür.
 */
const sceneSrc = strip(read("src/lib/maira/contour-scene.ts"));
const faceSrc = strip(read("src/components/request/talep/MairaFace.tsx"));
ok(
  "sahne el tutamağında pulse() var ve iClickT'yi sürer",
  Boolean(
    sceneSrc &&
      /pulse: \(\) => \{/.test(sceneSrc) &&
      /uniforms\.iClickT\.value = performance\.now\(\) \/ 1000/.test(sceneSrc),
  ),
);
ok(
  "nabız yalnız görünüm taşır (cevap/telemetri değil)",
  Boolean(
    faceSrc &&
      /pulseToken/.test(faceSrc) &&
      !/onAnswer|trackComposerEvent|setManualValues/.test(faceSrc),
  ),
);

/* ------------------------------------------------------------------ */
/**
 * H) CEVAPLANAN ADIM KAPANIR, KARTTAN GERİ AÇILIR (D-0047, kurucu 2026-09-26).
 *
 * Kurucunun cümlesi: "geriye dönük kapanmadığı zaman biraz karışık oluyor;
 * seçilen şey gidebilir ama geri dönüşü olacak şekilde kalkması lazım."
 *
 * Tarayıcıda ölçülen başlangıç durumu (`sonuc7/once-*`): bloklar KALKıyordu
 * ama (a) bir karede yok oluyordu, (b) kapanışın ardından
 * `document.activeElement` her seferinde gövdeydi, (c) karttaki "Değiştir"
 * kapanan bloğu değil BAŞKA bir yüzeyi (tam ekran kategori paneli) açıyordu.
 * Bu bölümdeki kapılar bu üç kararı kilitler.
 *
 * SINIR. Hiçbiri soru otoritesine, sıraya, zorunluluğa, yayın kararına ya da
 * kategori doğrulama mantığına dokunmaz; ölçülen tek şey görünürlük, yerleşim
 * ve odak devridir.
 */
console.log("H) Cevaplanan adım kapanır, karttan geri açılır (D-0047)");

const softExit = strip(
  read("src/components/request/talep/SoftExit.tsx"),
);
ok(
  "yumuşak kapanış süresini hareket tablosundan okur",
  Boolean(
    softExit &&
      /@\/lib\/motion\/talep-motion/.test(softExit) &&
      /REVEAL_MS/.test(softExit) &&
      /EASE_REVEAL/.test(softExit) &&
      !/\b(?:300|400|460|500)\s*(?:;|,|\))/.test(
        softExit.replace(/REVEAL_MS/g, ""),
      ),
  ),
  softExit === null ? "SoftExit.tsx yok" : undefined,
);
ok(
  "azaltılmış harekette kapanış kurulmaz (atlanır, hızlandırılmaz)",
  Boolean(
    page &&
      /function startSoftExit\(name: string, node: ReactNode\) \{/.test(page) &&
      /if \(!node \|\| prefersReducedMotion\(\)\) \{\s*setClosingBlock\(null\);/.test(
        page,
      ),
  ),
);
/*
  KAPANIŞ SÜRESİ DE TEK TABLODAN. Sayfa kopyayı `REVEAL_MS` kadar tutar;
  bileşenin çizdiği animasyon aynı süreyi kullanır, iki yer ayrışamaz.
*/
ok(
  "kapanış süresi sayfada da hareket tablosundan okunur",
  Boolean(
    page &&
      /closingTimerRef\.current = window\.setTimeout\([\s\S]{0,200}?\}, REVEAL_MS\);/.test(
        page,
      ),
  ),
);
ok(
  "çekilen kopyaya ne klavye ne ekran okuyucu ne fare ulaşır",
  Boolean(
    softExit &&
      /aria-hidden/.test(softExit) &&
      /\binert\b/.test(softExit) &&
      /pointer-events-none/.test(softExit),
  ),
);
ok(
  "yumuşak kapanış karar taşımaz (cevap/telemetri/yayın yok)",
  Boolean(
    softExit &&
      !/trackComposerEvent|onAnswer|applyBrainQuestion|canReview|blockingFieldKeys/.test(
        softExit,
      ),
  ),
);
ok(
  "kategori ve soru blokları yumuşak kapanışla kalkar",
  Boolean(
    page &&
      /startSoftExit\("kategori", categoryStepNode\);/.test(page) &&
      /startSoftExit\("soru", questionPanel\);/.test(page) &&
      /<SoftExit closing=\{closingBlock\} \/>/.test(page),
  ),
);
/*
  ÇEKİLEN KOPYA CANLI BLOĞUN ALTINDA DURUR. Aksi hâlde geri açılan blokla
  çekilmekte olan kopya aynı `data-testid`'yi taşıdığı için odak ve ölçüm
  sorgusu yanlış düğümü bulur.
*/
ok(
  "çekilen kopya canlı bloğun ALTINDA çizilir",
  Boolean(
    page &&
      page.indexOf("{categoryStepNode}") <
        page.indexOf("<SoftExit closing={closingBlock} />"),
  ),
);
ok(
  "blok geri açılırken bekleyen kopya hemen silinir",
  Boolean(page && /startSoftExit\("kategori", null\);/.test(page)),
);
/*
  TEK MODEL, TEK BİLEŞEN. Onay, geri açılan onay ve seçim aynı kanonik modeli
  (`categoryStepForMaira`) çizer; sayfada ikinci bir kategori kartı çağrısı
  kalmadığı ölçülür — yoksa iki yüzey sessizce ayrışabilir.
*/
ok(
  "kategori adımı tek kanonik modelden çizilir",
  Boolean(
    page &&
      (page.match(/<CategoryConfirmationCard/g) ?? []).length === 1 &&
      /model=\{categoryStepForMaira\}/.test(page),
  ),
  page ? (page.match(/<CategoryConfirmationCard/g) ?? []).length : null,
);
/*
  GERİ AÇILIŞ KANONİK KURUCUYU KULLANIR ve yalnız "davetsiz sorma" kapılarını
  kaldırır. İkinci bir kategori modeli, ikinci bir kök listesi yoktur.
*/
ok(
  "geri açılan adım kanonik kurucudan gelir, yalnız iki kilit kapısı kalkar",
  Boolean(
    page &&
      /const categoryReopenModel = useMemo\(/.test(page) &&
      /categoryLockedByUser: false,\s*categoryUserChoice: null,/.test(page) &&
      /const categoryStepForMaira =\s*categoryConfirmation \?\? categoryReopenStep \?\? categoryChoice;/.test(
        page,
      ),
  ),
);
ok(
  "karttaki 'Değiştir' kapanan bloğu geri açar",
  Boolean(page && /onChangeCategory=\{reopenCategoryStep\}/.test(page)),
);
ok(
  "'Değiştir' bir aç/kapa denetimidir (aria-expanded taşır)",
  Boolean(
    card &&
      /data-testid="talep-card-change-category"/.test(card) &&
      /aria-expanded=\{categoryStepOpen\}/.test(card),
  ),
);
/*
  MODEL KURULAMADIĞINDA BOŞLUK OLMAZ: motor emin değilse "Değiştir" bugünkü
  yolunu sürdürür ve tam ekran paneli açar. Alt kategori yolu her iki durumda
  da açıktır.
*/
ok(
  "model kurulamazsa 'Değiştir' tam ekran paneli açar (boş tıklama yok)",
  Boolean(
    page &&
      /if \(!categoryReopenAvailable\) \{\s*setCategorySheet\(\{ mode: "pick", root: null \}\);/.test(
        page,
      ),
  ),
);
ok(
  "alt kategori paneline giden kapı blokta duruyor",
  Boolean(page && /data-testid="category-step-open-sheet"/.test(page)),
);
/*
  CEVAPLANAN SORU BLOĞU GERÇEKTEN KAPANIR. `askingFieldKey` temizlenmezse
  satırdan açılmış soru cevaptan sonra ekranda kalır.
*/
ok(
  "cevaplanan soru bloğu kapanır (askingFieldKey temizlenir)",
  Boolean(
    page &&
      /function closeAnsweredQuestion\(fieldKey: string\) \{/.test(page) &&
      /setAskingFieldKey\(\(current\) => \(current === fieldKey \? null : current\)\);/.test(
        page,
      ),
  ),
);
ok(
  "kapanış hem cevap hem atlama yolundan çağrılır",
  Boolean(page && (page.match(/closeAnsweredQuestion\(fieldKey\);/g) ?? []).length >= 3),
  page ? (page.match(/closeAnsweredQuestion\(fieldKey\);/g) ?? []).length : null,
);
/*
  GÖVDE SINIRLA OKUNUR. "Fonksiyondan sonraki 400 karakter" demek kapıyı
  komşu koda taşırır ve her zaman kırmızı gösterir; gövde kendi kapanış
  parantezine kadar kesilir.
*/
const closeAnsweredBody =
  page?.match(
    /function closeAnsweredQuestion\(fieldKey: string\) \{([\s\S]*?)\n {2}\}/,
  )?.[1] ?? null;
ok(
  "kapanış cevabı ya da otoriteyi değiştirmez",
  Boolean(
    closeAnsweredBody &&
      !/applyBrainQuestion|hybrid\.|setAnsweredQuestionKeys|setSkippedQuestionKeys|canReview/.test(
        closeAnsweredBody,
      ),
  ),
  closeAnsweredBody === null ? "closeAnsweredQuestion gövdesi bulunamadı" : undefined,
);
/*
  ODAK KAPANAN BLOKTAN KARTTAKİ İLGİLİ SATIRA GEÇER. Hedef seçicileri kapıya
  yazılır; "odağı taşıdım" iddiası bir yorum değil, ölçülen bir dizedir.
*/
ok(
  "kapanan bloğun odağı karttaki ilgili satıra geçer",
  Boolean(
    page &&
      /returnFocusTo === "__category__"/.test(page) &&
      /\[data-testid="talep-card-change-category"\]/.test(page) &&
      /\[data-testid="talep-card-row"\]\[data-row-key="\$\{CSS\.escape\(returnFocusTo\)\}"\]/.test(
        page,
      ),
  ),
);
ok(
  "satır bulunamazsa odak yine kartta kalır (gövdeye düşmez)",
  Boolean(page && /\(hedef \?\? yedek\)\?\.focus\(\{ preventScroll: true \}\)/.test(page)),
);
ok(
  "blok içinde kalan geçişlerde odak bloğun içinde kalır",
  Boolean(
    page &&
      /function focusInsideCategoryStep\(selector: string\) \{/.test(page) &&
      /focusInsideCategoryStep\(\s*'\[data-testid\^="category-root-"\]/.test(page) &&
      /focusInsideCategoryStep\('\[data-testid="category-confirmation-confirm"\]'\)/.test(
        page,
      ),
  ),
);
/*
  DUYURU TEK CANLI BÖLGEDEN GELİR ve SEÇİLEN kategoriyi söyler. Ölçüldü: kök
  seçildiğinde cümle ekrandaki eski adımın etiketini okuyordu.
*/
ok(
  "kapanış tek canlı bölgeden duyurulur",
  Boolean(
    page &&
      (page.match(/data-testid="talep-step-closed-notice"/g) ?? []).length === 1 &&
      /role="status"\s*aria-live="polite"/.test(page),
  ),
);
ok(
  "duyuru seçilen kategoriyi söyler (ekrandaki eski etiketi değil)",
  Boolean(
    page &&
      /action\.kind === "pick_root"\s*\? \[\.\.\.step\.rootChoices, \.\.\.step\.candidates\]\.find\(/.test(
        page,
      ),
  ),
);
ok(
  "satırdan geri açılışta bayat duyuru silinir",
  Boolean(page && /setClosedStepNotice\(null\);\s*setCategoryStepReopened\(false\);/.test(page)),
);
/*
  YAYINA HAZIR EKRANIN GÖRSEL AĞIRLIĞI. "Talep analizi" kapalıyken çerçevesiz
  ve sessizdir; açılınca çerçevesini geri alır. Ürün kararı değişmedi: panel
  kaybolmaz ve zorunlu sinyalde yine kendiliğinden açılır.
*/
ok(
  "'Talep analizi' kapalıyken ikincil görünür, açılınca çerçevelenir",
  Boolean(
    page &&
      /data-testid="talep-analysis-details"/.test(page) &&
      /aiCompanionOpen \|\| publishSignalDemandsAttention\s*\? "border border-\[#0b1917\]\/8 bg-white"\s*: ""/.test(
        page,
      ),
  ),
);
ok(
  "'Talep analizi' zorunlu sinyalde hâlâ kendiliğinden açılır",
  Boolean(page && /open=\{aiCompanionOpen \|\| publishSignalDemandsAttention\}/.test(page)),
);
ok(
  "ikincil yollar kaybolmadı",
  Boolean(
    page &&
      /data-testid="talep-secondary-edit-sentence"/.test(page) &&
      /data-testid="talep-analysis-summary"/.test(page),
  ),
);

console.log(`\nkapi=${kapi} sorun=${sorun}`);
console.log(sorun === 0 ? "SONUC=GECTI" : "SONUC=KALDI");
process.exit(sorun === 0 ? 0 : 1);
