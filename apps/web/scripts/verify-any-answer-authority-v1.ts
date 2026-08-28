/**
 * AÇIK "FARK ETMEZ" CEVABININ OTORİTESİ V1 — D3f Dilim 3h (2026-08-28).
 *
 * SORUN (tarayıcı kabulünde ölçüldü, 2026-08-28). Kullanıcı `/talep` akışında
 * bir soruya açıkça "Fark etmez" dediğinde istemci projection'ı doğru kuruyor
 * (`constraints[key].mode = "ANY"`), ama o cevap yayın payload'ının süzülmüş
 * cevap kanalına (`fields[]` → kanonik `mode`) HİÇ girmiyordu. Sunucu güven
 * sınırı istemcinin `fieldAuthority` kopyasını doğru biçimde atıyor ve cevabı
 * yeniden türetemediği için fail-closed düşüyor: kısıt kalıyor, ama
 * "bunu kullanıcı söyledi" damgası kayboluyor.
 *
 * KÖKEN (salt-okunur, üç ağaçta aynı üretim ölçümü). Aynı girdi `4d2822f`,
 * `6cd753f` ve `33013b8` ağaçlarında `resolveCreateProjection`a verildiğinde
 * sonuç BİREBİR aynı çıktı: cevap satırı yoksa otorite yok, cevap satırı
 * varsa `USER_EXPLICIT`. Yani sunucu sınırı her üç commit'te de doğrudur ve
 * bu kusur bu feature zincirinde OLUŞMADI — `fields[]` listesi entegrasyon
 * tabanında da yalnız `visibleDynamicFields`ten kuruluyordu. Zincir ortak
 * alanları kanala ekledi (Dilim 2b); registry dışındaki dinamik anahtarlar
 * (soru profili alanları) açıkta kaldı.
 *
 * ALAN ÖZEL DAL YOKTUR. Ölçüm tek bir anahtar (`fridgeType`) üzerinden
 * yapılmaz: evren KANONİK kaynaklardan türer — her kategorinin kendi
 * `fields` registry'si ve o kategorinin soru profili anahtarları. Kategori
 * ya da alan adına özel hiçbir istisna yazılmaz.
 *
 * KANONİK SÖZLEŞME (kurucu, 2026-08-28):
 *   1. Açık `ANY` cevabı `constraints[key].mode = "ANY"` olarak KALIR.
 *   2. Aynı anahtarın `fieldAuthority[key].constraints` değeri
 *      `USER_EXPLICIT` olur.
 *   3. `attributes[key]` ÜRETİLMEZ — "fark etmez" bir ürün özelliği değildir.
 *   4. `fieldResponses[key]` ÜRETİLMEZ — `ANY` kendi constraint kanalındadır.
 *   5. İstemcinin `fieldAuthority` kopyası GÜVENİLMEZ; sunucu kanonik
 *      cevaptan yeniden türetir (sahte kopya fail-closed düşer).
 *   6. `confirmedFieldKeys` KÜME semantiğindedir: aynı anahtar en fazla bir
 *      kez bulunur.
 *   7. `rawInput` DEĞİŞMEZ.
 *   8. Üretilen `title` hiçbir cevap yüzeyine geri dönmez.
 *
 * SALT-OKUNUR. Hiçbir veritabanı yazımı yapılmaz.
 *
 * KAPSAM DIŞI (ölçülmedi): `RequestFieldValue` kalıcılığı ve edit/reload
 * geri yükleme — bu YEŞİL, `ANY` cevabının sayfa yenilendikten sonra geri
 * geldiğini KAPSAMAZ.
 */

import { buildDiscoveryProjectionFromState } from "../src/lib/discovery/build-projection";
import { resolveCreateProjection } from "../src/lib/discovery/server-authority";
import {
  COMMON_FIELD_DEFAULTS,
  REQUEST_CATEGORIES,
  isGeneratedCommonField,
} from "../src/lib/request-category-engine";
import {
  buildPublishAnswerFields,
  createTextOnlyState,
} from "../src/lib/request-composer";
import type {
  CanonicalFieldState,
  CanonicalRequestState,
} from "../src/lib/request-composer/types";
import { listProfileKeysForCategory } from "../src/lib/request-composer/v2/question-profiles";
import { buildUnderstandingSnapshot } from "../src/lib/request/understanding-snapshot";

const problems: string[] = [];

function ok(id: string, condition: boolean, detail: string): void {
  if (!condition) problems.push(`${id}: ${detail}`);
}

const SCENE_TEXT = "İstanbul'da ikinci el buzdolabı arıyorum, bütçem 15000 TL";

/**
 * Kullanıcının açıkça seçtiği "Fark etmez" cevabı. Kaynak AÇIK KULLANICI
 * kaynağıdır — çıkarım değildir.
 */
const EXPLICIT_ANY: CanonicalFieldState = {
  kind: "ANY",
  value: null,
  provenance: "EXPLICIT_BROWSE",
};

/**
 * DİNAMİK ALAN EVRENİ — İKİ KANONİK KAYNAKTAN TÜRER.
 *
 * (a) kategorinin kendi `fields` registry'si,
 * (b) o kategori için tanımlı soru profili anahtarları.
 *
 * Ortak alanlar (`COMMON_FIELD_DEFAULTS`) burada ÖLÇÜLMEZ: onların kanalı
 * Dilim 2b'de kapandı ve kendi doğrulayıcısı vardır. Üretilen alanlar hiçbir
 * koşulda evrene girmez.
 */
function dynamicKeysOf(categoryId: string): string[] {
  const category = REQUEST_CATEGORIES.find((c) => c.id === categoryId);
  const keys = new Set<string>();
  for (const field of category?.fields ?? []) keys.add(field.key);
  for (const key of listProfileKeysForCategory(categoryId)) keys.add(key);
  for (const key of Object.keys(COMMON_FIELD_DEFAULTS)) keys.delete(key);
  return [...keys].sort();
}

type Outcome = {
  inFields: boolean;
  fieldsMode: string | null;
  constraintMode: string | null;
  constraintAuthority: string | null;
  attributeAuthority: string | null;
  attribute: string | null;
  response: string | null;
  rawInput: string;
};

/**
 * ÜRETİM ZİNCİRİ. İstemci yayın satırlarını üretim kurucusundan alır,
 * sunucu kararını üretim güven sınırından okur. Doğrulayıcı kendi karar
 * kopyasını KURMAZ.
 *
 * `dynamicFieldKeys` bilinçli olarak BOŞTUR: cevabın kanala girmesi, alanın
 * o an ekranda RENDER EDİLMİŞ olmasına bağlı olamaz. Kullanıcı soruyu
 * cevapladıktan sonra alan görünür listeden çıkarsa cevabı kaybolmamalıdır.
 */
function measure(
  key: string,
  field: CanonicalFieldState,
  categoryId: string | null,
): Outcome {
  const base: CanonicalRequestState = createTextOnlyState(SCENE_TEXT);
  const state: CanonicalRequestState = {
    ...base,
    fields: { ...base.fields, [key]: field },
  };
  const projection = buildDiscoveryProjectionFromState(state);
  const fields = buildPublishAnswerFields({
    canonicalFields: state.fields,
    /* Kamuya açık soru evreni ölçülen kategoriden türer (D3f 3h). */
    categoryId,
    values: {},
    userTouchedKeys: [],
    dynamicFieldKeys: [],
  });
  const row = fields.find((f) => f.key === key) ?? null;
  const created = resolveCreateProjection({
    discoveryProjection: projection,
    rawInput: SCENE_TEXT,
    /* Üretimde olduğu gibi: sunucu kategoriyi KENDİ yazdığı alandan okur. */
    category: { slug: categoryId },
    fields,
  } as never).projection;
  return {
    inFields: row !== null,
    fieldsMode: row?.mode ?? null,
    constraintMode: created?.constraints?.[key]?.mode ?? null,
    constraintAuthority: created?.fieldAuthority?.[key]?.constraints ?? null,
    attributeAuthority: created?.fieldAuthority?.[key]?.attributes ?? null,
    attribute: created?.attributes?.[key] ?? null,
    response: created?.fieldResponses?.[key]?.kind ?? null,
    rawInput: String(state.understanding.rawInput ?? ""),
  };
}

/* ------------------------------------------------------------------ *
 * KIRMIZI KAPI 1 — ANY KISITI VAR, OTORİTE KAYIP
 * ------------------------------------------------------------------ */

const categories = REQUEST_CATEGORIES.filter(
  (c) => c.id && dynamicKeysOf(c.id).length > 0,
);

ok(
  "G1-kapsam",
  categories.length >= 3,
  `en az üç kategori ölçülmeli, ölçülen ${categories.length}`,
);

let measured = 0;
let authorityLost = 0;
const lostSample: string[] = [];

for (const category of categories) {
  const keys = dynamicKeysOf(category.id);
  ok(
    `G1-alan-sayisi/${category.id}`,
    keys.length >= 2,
    `birden fazla dinamik alan ölçülmeli, bulunan ${keys.length}`,
  );
  for (const key of keys) {
    measured += 1;
    const outcome = measure(key, EXPLICIT_ANY, category.id);

    /* 1. Kısıt kalır. */
    ok(
      `G1-kisit/${category.id}/${key}`,
      outcome.constraintMode === "ANY",
      `constraints.mode = ${outcome.constraintMode}, beklenen ANY`,
    );
    /* 2. Otorite USER_EXPLICIT olur. */
    if (outcome.constraintAuthority !== "USER_EXPLICIT") {
      authorityLost += 1;
      if (lostSample.length < 8) {
        lostSample.push(
          `${category.id}/${key} (fields[]=${outcome.inFields}, authority=${outcome.constraintAuthority})`,
        );
      }
    }
    ok(
      `G1-otorite/${category.id}/${key}`,
      outcome.constraintAuthority === "USER_EXPLICIT",
      `fieldAuthority.constraints = ${outcome.constraintAuthority}, beklenen USER_EXPLICIT`,
    );
    /* 3. attributes üretilmez. */
    ok(
      `G1-attr/${category.id}/${key}`,
      outcome.attribute === null && outcome.attributeAuthority === null,
      `attributes yüzeyi üretildi (${outcome.attribute} / ${outcome.attributeAuthority})`,
    );
    /* 4. fieldResponses üretilmez — ANY kendi kanalındadır. */
    ok(
      `G1-response/${category.id}/${key}`,
      outcome.response === null,
      `fieldResponses üretildi (${outcome.response})`,
    );
    /* 7. rawInput değişmez. */
    ok(
      `G1-raw/${category.id}/${key}`,
      outcome.rawInput === SCENE_TEXT,
      "rawInput değişti",
    );
  }
}

/* ÇIKARIMDAN GELEN `ANY` KARŞI TESTİ — otorite kazanmamalıdır. */
for (const category of categories.slice(0, 3)) {
  const key = dynamicKeysOf(category.id)[0];
  if (!key) continue;
  const inferred = measure(
    key,
    { kind: "ANY", value: null, provenance: "INFERRED" },
    category.id,
  );
  ok(
    `G1-cikarim/${category.id}/${key}`,
    inferred.inFields === false && inferred.constraintAuthority !== "USER_EXPLICIT",
    `çıkarımdan gelen ANY cevap kanalına girdi (fields[]=${inferred.inFields}, authority=${inferred.constraintAuthority})`,
  );
}

/* 8. ÜRETİLEN BAŞLIK HİÇBİR CEVAP YÜZEYİNE DÖNMEZ. */
const generatedKeys = Object.keys(COMMON_FIELD_DEFAULTS).filter((key) =>
  isGeneratedCommonField(key),
);
ok(
  "G1-generated-kapsam",
  generatedKeys.length >= 1,
  "üretilen ortak alan bulunamadı — karşı test ölçmüyor",
);
for (const key of generatedKeys) {
  const outcome = measure(key, EXPLICIT_ANY, categories[0]?.id ?? null);
  ok(
    `G1-generated/${key}`,
    outcome.inFields === false &&
      outcome.constraintAuthority === null &&
      outcome.response === null,
    `üretilen alan cevap yüzeyi üretti (fields[]=${outcome.inFields}, authority=${outcome.constraintAuthority}, response=${outcome.response})`,
  );
}

/* ------------------------------------------------------------------ *
 * KIRMIZI KAPI 2 — `confirmedFieldKeys` AYNI ANAHTARI YİNELİYOR
 * ------------------------------------------------------------------ */

const duplicatedInput = [
  "fridgeType",
  "fridgeType",
  " fridgeType ",
  "condition",
  "condition",
];
const snapshot = buildUnderstandingSnapshot({
  categoryResolution: {
    status: "unresolved",
    userSelected: false,
    userChoice: null,
    primary: null,
    candidates: [],
  },
  confirmedFieldKeys: duplicatedInput,
} as never);
const confirmed = snapshot.confirmedFieldKeys ?? [];
ok(
  "G2-kume",
  confirmed.length === new Set(confirmed).size,
  `confirmedFieldKeys küme değil: ${JSON.stringify(confirmed)}`,
);
ok(
  "G2-korunan",
  new Set(confirmed).size === 2,
  `beklenen 2 farklı anahtar, ölçülen ${new Set(confirmed).size} (${JSON.stringify(confirmed)})`,
);

/* ------------------------------------------------------------------ *
 * KIRMIZI KAPI 3 — SAHTE İSTEMCİ OTORİTESİ FAIL-CLOSED
 * ------------------------------------------------------------------ */

{
  const base = createTextOnlyState(SCENE_TEXT);
  const forgedKey = dynamicKeysOf(categories[0]?.id ?? "")[0] ?? "fridgeType";
  const state: CanonicalRequestState = {
    ...base,
    fields: { ...base.fields, [forgedKey]: EXPLICIT_ANY },
  };
  const projection = buildDiscoveryProjectionFromState(state);
  /* İstemci otorite kopyasını uydurur ve cevap satırını GÖNDERMEZ. */
  const forged = {
    ...projection,
    fieldAuthority: {
      ...(projection.fieldAuthority ?? {}),
      [forgedKey]: { attributes: "USER_EXPLICIT", constraints: "USER_EXPLICIT" },
      __hack__: { constraints: "USER_EXPLICIT" },
    },
  };
  const created = resolveCreateProjection({
    discoveryProjection: forged,
    rawInput: SCENE_TEXT,
    fields: [],
  }).projection;
  ok(
    "G3-fail-closed",
    created?.fieldAuthority?.[forgedKey]?.constraints !== "USER_EXPLICIT",
    "cevap satırı olmadan sahte istemci otoritesi kabul edildi",
  );
  ok(
    "G3-attr-fail-closed",
    created?.fieldAuthority?.[forgedKey]?.attributes !== "USER_EXPLICIT",
    "sahte attributes otoritesi kabul edildi",
  );
  ok(
    "G3-uydurma-anahtar",
    created?.fieldAuthority?.__hack__ === undefined,
    "uydurma anahtar otorite haritasında kaldı",
  );
}

/* ------------------------------------------------------------------ *
 * HÜKÜM
 * ------------------------------------------------------------------ */

console.log(`ölçülen kategori: ${categories.length}`);
console.log(`ölçülen dinamik alan: ${measured}`);
console.log(`otoritesi kaybolan açık ANY cevabı: ${authorityLost}/${measured}`);
if (lostSample.length > 0) {
  console.log(`örnek: ${lostSample.join(" | ")}`);
}
/* Kapı kırılımı: üç kırmızı kapı AYRI AYRI görünür, biri ötekini gizlemez. */
const byGate = new Map<string, number>();
for (const problem of problems) {
  const gate = problem.split(/[/:]/, 1)[0] ?? "?";
  byGate.set(gate, (byGate.get(gate) ?? 0) + 1);
}
for (const gate of [...byGate.keys()].sort()) {
  console.log(`  kapı ${gate}: ${byGate.get(gate)} sorun`);
}

console.log(`PROBLEMS=${problems.length}`);
for (const problem of problems.slice(0, 25)) console.log(`  - ${problem}`);
if (problems.length > 25) {
  console.log(`  ... (+${problems.length - 25} tane daha)`);
}
console.log("===== HUKUM =====");
console.log(
  problems.length === 0
    ? "GECTI: açık ANY cevabı kanonik sözleşmeye uygun."
    : "KALDI: açık ANY cevabı sözleşmeyi ihlal ediyor.",
);
process.exit(problems.length === 0 ? 0 : 1);
