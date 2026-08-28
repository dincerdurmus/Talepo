/**
 * CEVAP YAŞAM DÖNGÜSÜNÜN ÜÇ DURUMU — D3f Dilim 3h (2026-08-28).
 *
 * Bu doğrulayıcı, birbirine karıştırılması sessiz veri kaybı ya da sessiz
 * veri uydurması üreten ÜÇ AYRI durumu kalıcı olarak ayırır:
 *
 *   1. GEÇİCİ OLARAK GÖRÜNMEYEN ama kullanıcı tarafından SİLİNMEMİŞ cevap.
 *      Alan o an ekranda render edilmiyor olabilir; bu bir kaldırma niyeti
 *      DEĞİLDİR. Cevap yayın kanalında korunur ve otoritesini taşır.
 *
 *   2. KULLANICININ AÇIKÇA KALDIRDIĞI / DEĞİŞTİRDİĞİ cevap. Hiçbir yüzey
 *      üretmez, geri yükleme kanalında bulunmaz ve yeniden kaydetmede geri
 *      gelmez.
 *
 *   3. ARTIK GEÇERSİZ ya da YABANCI cevap. Önceki kategoriden kalmış anahtar,
 *      başka kategoriye ait alan, kullanıcı onaylamamış çıkarım, iç kanıt
 *      anahtarı ve nesne modeli anahtarları (`__proto__` / `constructor` /
 *      `prototype` / uydurma). Hiçbiri yayın evrenine giremez.
 *
 * NEDEN AYRI TESTLER. 1 ile 2'yi tek ölçüte indirmek, "görünmüyor" ile
 * "silindi"yi aynı şey sayardı — kullanıcının kayıtlı cevabı sessizce
 * silinirdi (ölçüldü, 2026-08-28). 1 ile 3'ü tek ölçüte indirmek ise cevap
 * evrenini kanonik durumun tamamına açardı ve kategori dışı / iç kanıt
 * anahtarları kullanıcı beyanı gibi kalıcılaşabilirdi.
 *
 * SALT-OKUNUR. Hiçbir veritabanı yazımı yapılmaz.
 */

import { buildDiscoveryProjectionFromState } from "../src/lib/discovery/build-projection";
import { resolveCreateProjection } from "../src/lib/discovery/server-authority";
import {
  COMMON_FIELD_DEFAULTS,
  REQUEST_CATEGORIES,
  isGeneratedCommonField,
} from "../src/lib/request-category-engine";
import {
  applyPublishAnswersToState,
  buildPublishAnswerFields,
  createTextOnlyState,
} from "../src/lib/request-composer";
import type { PublishFieldAnswer } from "../src/lib/request-composer";
import type {
  CanonicalFieldState,
  CanonicalRequestState,
} from "../src/lib/request-composer/types";
import { publishAnswerKeyUniverse } from "../src/lib/request-composer/answer-authority";
import {
  listProfileKeysForCategory,
  listProfilesForCategory,
} from "../src/lib/request-composer/v2/question-profiles";
import { INTERNAL_EVIDENCE_ATTRIBUTE_KEYS } from "../src/lib/request/understanding-snapshot";
import { buildUnderstandingSnapshot } from "../src/lib/request/understanding-snapshot";
import { restoredFieldAnswers } from "../src/server/request/mapper";

const problems: string[] = [];

function ok(id: string, condition: boolean, detail: string): void {
  if (!condition) problems.push(`${id}: ${detail}`);
}

const SCENE_TEXT = "İstanbul'da ikinci el buzdolabı arıyorum, bütçem 15000 TL";
const SCENE_CATEGORY = "appliances";

const EXPLICIT_ANY: CanonicalFieldState = {
  kind: "ANY",
  value: null,
  provenance: "EXPLICIT_BROWSE",
};

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

/** Düzenleme ekranının kanonik state'i — üretim yolundan kurulur. */
function editState(rows: StoredRow[]): CanonicalRequestState {
  const answers = restoredFieldAnswers(rows) as Record<string, PublishFieldAnswer>;
  const base = createTextOnlyState(SCENE_TEXT);
  return applyPublishAnswersToState(
    { ...base, categoryId: SCENE_CATEGORY },
    answers,
  );
}

type Surfaces = {
  inFields: boolean;
  fieldsMode: string | null;
  constraintMode: string | null;
  constraintAuthority: string | null;
  attribute: string | null;
  response: string | null;
  rawInput: string;
};

/** Yayın zinciri: istemci kurucu → sunucu güven sınırı. Kopya karar yok. */
function surfacesFor(
  state: CanonicalRequestState,
  key: string,
  visibleKeys: string[] = [],
): Surfaces {
  const projection = buildDiscoveryProjectionFromState(state);
  const fields = buildPublishAnswerFields({
    canonicalFields: state.fields,
    categoryId: state.categoryId,
    values: {},
    userTouchedKeys: [],
    dynamicFieldKeys: visibleKeys,
  });
  const found = fields.find((f) => f.key === key) ?? null;
  const created = resolveCreateProjection({
    discoveryProjection: projection,
    rawInput: SCENE_TEXT,
    /* Üretimde olduğu gibi: sunucu kategoriyi KENDİ yazdığı alandan okur. */
    category: { slug: state.categoryId },
    fields,
  } as never).projection;
  return {
    inFields: found !== null,
    fieldsMode: found?.mode ?? null,
    constraintMode: created?.constraints?.[key]?.mode ?? null,
    constraintAuthority: created?.fieldAuthority?.[key]?.constraints ?? null,
    attribute: created?.attributes?.[key] ?? null,
    response: created?.fieldResponses?.[key]?.kind ?? null,
    rawInput: String(state.understanding.rawInput ?? ""),
  };
}

/**
 * KANONİK YAYIN SORU EVRENİ — doğrulayıcının KENDİ kopyası değil, ürünün
 * okuduğu iki kaynağın aynısı: kategori registry'si ve soru profilleri.
 */
function publicQuestionKeys(categoryId: string): string[] {
  const category = REQUEST_CATEGORIES.find((c) => c.id === categoryId);
  const keys = new Set<string>();
  for (const field of category?.fields ?? []) keys.add(field.key);
  for (const key of listProfileKeysForCategory(categoryId)) keys.add(key);
  for (const key of Object.keys(COMMON_FIELD_DEFAULTS)) {
    if (!isGeneratedCommonField(key)) keys.add(key);
  }
  return [...keys].sort();
}

/* ------------------------------------------------------------------ *
 * DURUM 1 — GEÇİCİ OLARAK GÖRÜNMEYEN, SİLİNMEMİŞ CEVAP
 * ------------------------------------------------------------------ */

/**
 * SAHNE ANAHTARI KATEGORİYE ÖZGÜ OLMAK ZORUNDA.
 *
 * İlk yazımda buraya profil listesinin ilk anahtarı alınıyordu; o anahtar
 * `city` çıktı — yani ORTAK bir alan. Ortak alanlar her evrende bulunduğu
 * için bozuk kategori ve yabancı anahtar senaryoları yanlış sebeple yeşil
 * görünüyordu (ölçüldü, 2026-08-28). Sahne artık ortak alan evreninin DIŞINDA
 * bir profil anahtarı seçer ve bu koşul aşağıda ayrıca ölçülür.
 */
const SCENE_TEXT_FILLED = new Set(
  Object.keys(createTextOnlyState(SCENE_TEXT).fields),
);

const SCENE_KEY =
  listProfileKeysForCategory(SCENE_CATEGORY).find(
    (key) => !(key in COMMON_FIELD_DEFAULTS) && !SCENE_TEXT_FILLED.has(key),
  ) ?? "fridgeType";

{
  ok(
    "S1:sahne-kategoriye-ozgu",
    !(SCENE_KEY in COMMON_FIELD_DEFAULTS),
    `sahne anahtarı ortak alan (${SCENE_KEY}) — kategori denetimini ölçemez`,
  );
  ok(
    "S1:sahne-metinden-dolmuyor",
    !SCENE_TEXT_FILLED.has(SCENE_KEY),
    `sahne anahtarını (${SCENE_KEY}) metnin kendisi dolduruyor — kaldırma senaryosu ölçülemez`,
  );

  /* Alan geçerli mevcut kategori/profil anahtarıdır. */
  ok(
    "S1:gecerli-anahtar",
    publicQuestionKeys(SCENE_CATEGORY).includes(SCENE_KEY),
    `${SCENE_KEY} mevcut kategorinin kamuya açık soru evreninde değil`,
  );

  const base = createTextOnlyState(SCENE_TEXT);
  const state: CanonicalRequestState = {
    ...base,
    categoryId: SCENE_CATEGORY,
    fields: { ...base.fields, [SCENE_KEY]: EXPLICIT_ANY },
  };

  /* Cevap gerçekten açık kullanıcı kaynaklı ve bilinçlidir. */
  ok(
    "S1:deliberate",
    state.fields[SCENE_KEY]?.kind === "ANY" &&
      state.fields[SCENE_KEY]?.provenance === "EXPLICIT_BROWSE",
    "sahne bilinçli USER_EXPLICIT cevabı temsil etmiyor",
  );

  /* Alan RENDER EDİLMİYOR — görünür liste boş. */
  const hidden = surfacesFor(state, SCENE_KEY, []);
  ok(
    "S1:gorunmez-korunur/kanal",
    hidden.inFields && hidden.fieldsMode === "ANY",
    `görünmeyen alanın cevabı yayın kanalından düştü (inFields=${hidden.inFields}, mode=${hidden.fieldsMode})`,
  );
  ok(
    "S1:gorunmez-korunur/kisit",
    hidden.constraintMode === "ANY",
    `constraints.mode = ${hidden.constraintMode}, beklenen ANY`,
  );
  ok(
    "S1:gorunmez-korunur/otorite",
    hidden.constraintAuthority === "USER_EXPLICIT",
    `fieldAuthority.constraints = ${hidden.constraintAuthority}, beklenen USER_EXPLICIT`,
  );
  ok(
    "S1:gorunmez-korunur/attr",
    hidden.attribute === null && hidden.response === null,
    `ANY yanlış yüzey üretti (attributes=${hidden.attribute}, fieldResponses=${hidden.response})`,
  );

  /* Görünür olması sonucu DEĞİŞTİRMEZ — görünürlük bir otorite kanıtı değildir. */
  const visible = surfacesFor(state, SCENE_KEY, [SCENE_KEY]);
  ok(
    "S1:gorunurluk-farketmez",
    visible.constraintAuthority === hidden.constraintAuthority &&
      visible.constraintMode === hidden.constraintMode,
    `görünürlük otoriteyi değiştirdi (${visible.constraintAuthority} vs ${hidden.constraintAuthority})`,
  );
}

/* ------------------------------------------------------------------ *
 * DURUM 2 — KULLANICININ AÇIKÇA KALDIRDIĞI / DEĞİŞTİRDİĞİ CEVAP
 * ------------------------------------------------------------------ */

{
  /* (a) Geri yükleme kanalında ARTIK YOK — kullanıcı cevabı kaldırmış. */
  const cleared = editState([]);
  ok(
    "S2:reload-yok",
    restoredFieldAnswers([])[SCENE_KEY] === undefined,
    "kaldırılan cevap geri yükleme kanalında hâlâ var",
  );
  ok(
    "S2:kanonik-yok",
    cleared.fields[SCENE_KEY] === undefined ||
      cleared.fields[SCENE_KEY]?.provenance === "INFERRED",
    "kaldırılan cevap kanonik durumda bilinçli cevap olarak duruyor",
  );
  const removed = surfacesFor(cleared, SCENE_KEY, []);
  ok(
    "S2:kullanici-kaldirdi/yuzey-yok",
    !removed.inFields &&
      removed.constraintAuthority === null &&
      removed.response === null,
    `kaldırılan cevap yüzey üretti (fields=${removed.inFields}, authority=${removed.constraintAuthority}, response=${removed.response})`,
  );

  /* (b) Yeniden kaydetmede GERİ GELMEZ — ikinci tur da boştur. */
  const again = surfacesFor(editState([]), SCENE_KEY, []);
  ok(
    "S2:yeniden-kayitta-geri-gelmez",
    !again.inFields && again.constraintAuthority === null,
    "kaldırılan cevap yeniden kaydetmede geri geldi",
  );

  /* (c) Gerçek değerle DEĞİŞTİRME de bir kaldırmadır: mod artık VALUE'dur. */
  const replaced = applyPublishAnswersToState(
    editState([row(SCENE_KEY, { jsonValue: { mode: "ANY" } })]),
    { [SCENE_KEY]: { mode: "VALUE", value: "Ankastre" } },
  );
  const afterReplace = buildPublishAnswerFields({
    canonicalFields: replaced.fields,
    categoryId: replaced.categoryId,
    values: { [SCENE_KEY]: "Ankastre" },
    userTouchedKeys: [SCENE_KEY],
    dynamicFieldKeys: [SCENE_KEY],
  }).find((f) => f.key === SCENE_KEY);
  ok(
    "S2:degistirme-modu-siler",
    afterReplace?.mode === "VALUE" && afterReplace?.value === "Ankastre",
    `değer yazıldığında değer taşımayan mod kalmamalı → ${JSON.stringify(afterReplace ?? null)}`,
  );
}

/* ------------------------------------------------------------------ *
 * DURUM 3 — GEÇERSİZ / YABANCI CEVAP
 * ------------------------------------------------------------------ */

const otherCategory =
  REQUEST_CATEGORIES.find(
    (c) => c.id && c.id !== SCENE_CATEGORY && (c.fields?.length ?? 0) > 0,
  ) ?? null;

const foreignKey =
  otherCategory?.fields?.find(
    (f) => !publicQuestionKeys(SCENE_CATEGORY).includes(f.key),
  )?.key ?? null;

ok(
  "S3:yabanci-anahtar-bulundu",
  foreignKey !== null,
  "başka kategoriye ait ölçülebilir bir alan bulunamadı",
);

const INVALID_CASES: { id: string; key: string; field: CanonicalFieldState }[] =
  [
    /* Önceki kategoriden kalmış / başka kategoriye ait alan. */
    ...(foreignKey
      ? [{ id: "yabanci-alan", key: foreignKey, field: EXPLICIT_ANY }]
      : []),
    { id: "uydurma-alan", key: "__hack__", field: EXPLICIT_ANY },
    /* Nesne modeli anahtarları. */
    { id: "proto", key: "__proto__", field: EXPLICIT_ANY },
    { id: "constructor", key: "constructor", field: EXPLICIT_ANY },
    { id: "prototype", key: "prototype", field: EXPLICIT_ANY },
    /* İç kanıt anahtarları — firmalara dönük bir alan değildir. */
    ...INTERNAL_EVIDENCE_ATTRIBUTE_KEYS.map((key) => ({
      id: `ic-kanit/${key}`,
      key,
      field: EXPLICIT_ANY,
    })),
    /* Kullanıcı onaylamamış çıkarım — bilinçli cevap değildir. */
    {
      id: "onaysiz-cikarim",
      key: SCENE_KEY,
      field: { kind: "ANY", value: null, provenance: "INFERRED" },
    },
    /* Üretilen etiket. */
    ...Object.keys(COMMON_FIELD_DEFAULTS)
      .filter((key) => isGeneratedCommonField(key))
      .map((key) => ({ id: `uretilen/${key}`, key, field: EXPLICIT_ANY })),
  ];

for (const invalid of INVALID_CASES) {
  const base = createTextOnlyState(SCENE_TEXT);
  const state: CanonicalRequestState = {
    ...base,
    categoryId: SCENE_CATEGORY,
    fields: { ...base.fields, [invalid.key]: invalid.field },
  };
  const out = surfacesFor(state, invalid.key, []);
  ok(
    `S3:gecersiz-yabanci/${invalid.id}`,
    !out.inFields,
    `yayın kanalına girdi (mode=${out.fieldsMode})`,
  );
  ok(
    `S3:otorite-yok/${invalid.id}`,
    out.constraintAuthority !== "USER_EXPLICIT",
    `USER_EXPLICIT otorite kazandı (${out.constraintAuthority})`,
  );
  ok(
    `S3:response-yok/${invalid.id}`,
    out.response === null,
    `fieldResponses üretti (${out.response})`,
  );
}

/* ------------------------------------------------------------------ *
 * KAPI 4 — `categoryId` EKSİK / TANINMAYAN / BOZUK
 * ------------------------------------------------------------------ */

{
  const commonOnly = Object.keys(COMMON_FIELD_DEFAULTS).filter(
    (key) => !isGeneratedCommonField(key),
  );
  const BROKEN_IDS: { id: string; value: unknown }[] = [
    { id: "eksik", value: undefined },
    { id: "null", value: null },
    { id: "bos", value: "" },
    { id: "bosluk", value: "   " },
    { id: "taninmayan", value: "kesinlikle-yok-boyle-bir-kategori" },
    { id: "proto", value: "__proto__" },
    { id: "sayi", value: 42 },
    { id: "nesne", value: { slug: SCENE_CATEGORY } },
  ];

  /**
   * Kategoriden bağımsız eşleşen profil anahtarları — ORTAK ALAN OLMAYANLAR.
   *
   * `listProfilesForCategory`, `categories` tanımlanmamış bir profili her
   * kategori için eşleşmiş sayar. Bunların ortak alan olanları (`budget`,
   * `delivery`) evrende zaten meşru biçimde bulunur; ölçülen şey, ortak alan
   * OLMAYAN bir profilin uydurma kategori dizesiyle sızıp sızmadığıdır.
   */
  const agnosticProfileKeys = new Set(
    listProfilesForCategory({
      categoryId: "kesinlikle-yok-boyle-bir-kategori",
    })
      .map((p) => p.fieldKey)
      .filter((key) => !(key in COMMON_FIELD_DEFAULTS)),
  );
  console.log(`kategori-bağımsız profil anahtarı: ${agnosticProfileKeys.size}`);

  for (const broken of BROKEN_IDS) {
    const universe = publishAnswerKeyUniverse(broken.value as never);

    /* Yalnız gerçekten kategori-bağımsız, üretilmeyen ortak alanlar kalır. */
    ok(
      `K4:yalniz-ortak/${broken.id}`,
      universe.size === commonOnly.length &&
        commonOnly.every((key) => universe.has(key)),
      `evren ortak alanlardan farklı: ${[...universe].sort().join(",")}`,
    );

    /* Hiçbir kategoriye özgü dinamik anahtar girmez. */
    const categorySpecific = [...universe].filter(
      (key) => !commonOnly.includes(key),
    );
    ok(
      `K4:kategoriye-ozgu-yok/${broken.id}`,
      categorySpecific.length === 0,
      `kategoriye özgü anahtar sızdı: ${categorySpecific.join(",")}`,
    );

    /* Bütün profillerin birleşimi AÇILMAZ. */
    const leaked = [...agnosticProfileKeys].filter((key) => universe.has(key));
    ok(
      `K4:profil-birlesimi-kapali/${broken.id}`,
      leaked.length === 0,
      `kategori-bağımsız profil anahtarı sızdı: ${leaked.join(",")}`,
    );

    /* Üretilen `title` yine dışarıda. */
    for (const key of Object.keys(COMMON_FIELD_DEFAULTS).filter((k) =>
      isGeneratedCommonField(k),
    )) {
      ok(
        `K4:generated-disarida/${broken.id}/${key}`,
        !universe.has(key),
        "üretilen alan bozuk kategoride evrene girdi",
      );
    }
  }

  /* Uçtan uca: bozuk kategoride kategori alanının cevabı kabul edilmez. */
  const base = createTextOnlyState(SCENE_TEXT);
  const state: CanonicalRequestState = {
    ...base,
    categoryId: "kesinlikle-yok-boyle-bir-kategori",
    fields: { ...base.fields, [SCENE_KEY]: EXPLICIT_ANY },
  };
  const out = surfacesFor(state, SCENE_KEY, []);
  ok(
    "K4:uctan-uca-fail-closed",
    !out.inFields && out.constraintAuthority !== "USER_EXPLICIT",
    `bozuk kategoride cevap kabul edildi (fields=${out.inFields}, authority=${out.constraintAuthority})`,
  );
}

/* ------------------------------------------------------------------ *
 * KAPI 5 — SUNUCU SINIRINDA KULLANILAN KATEGORİ
 * ------------------------------------------------------------------ */

{
  const base = createTextOnlyState(SCENE_TEXT);
  const state: CanonicalRequestState = {
    ...base,
    categoryId: SCENE_CATEGORY,
    fields: { ...base.fields, [SCENE_KEY]: EXPLICIT_ANY },
  };
  const projection = buildDiscoveryProjectionFromState(state);
  const answerRow = {
    key: SCENE_KEY,
    label: SCENE_KEY,
    type: "text" as const,
    required: false,
    value: "",
    mode: "ANY" as const,
  };

  function serverAuthorityFor(
    categorySlug: unknown,
    projectionOverride: Record<string, unknown> = {},
    fields: unknown[] = [answerRow],
    key: string = SCENE_KEY,
  ): string | null {
    const created = resolveCreateProjection({
      discoveryProjection: { ...projection, ...projectionOverride },
      rawInput: SCENE_TEXT,
      category: { slug: categorySlug },
      fields,
    } as never);
    return created.projection?.fieldAuthority?.[key]?.constraints ?? null;
  }

  /* Doğru kategori bağlamında cevap kabul edilir (pozitif kontrol). */
  ok(
    "K5:pozitif-kontrol",
    serverAuthorityFor(SCENE_CATEGORY) === "USER_EXPLICIT",
    "doğru kategoride meşru cevap reddedildi",
  );

  /* İstemcinin projection içindeki sahte `categoryId`'sine körü körüne
   * güvenilmez: kalıcılaştırılan kategori başkaysa cevap kabul edilmez. */
  ok(
    "K5:sahte-projection-categoryId",
    serverAuthorityFor(otherCategory?.id ?? "printing", {
      categoryId: SCENE_CATEGORY,
    }) !== "USER_EXPLICIT",
    "projection içindeki sahte categoryId evreni genişletti",
  );

  /* Mevcut kategori altında BAŞKA kategori anahtarı → fail-closed. */
  if (foreignKey) {
    const foreignState: CanonicalRequestState = {
      ...base,
      categoryId: SCENE_CATEGORY,
      fields: { ...base.fields, [foreignKey]: EXPLICIT_ANY },
    };
    const foreignProjection = buildDiscoveryProjectionFromState(foreignState);
    const created = resolveCreateProjection({
      discoveryProjection: foreignProjection,
      rawInput: SCENE_TEXT,
      category: { slug: SCENE_CATEGORY },
      fields: [{ ...answerRow, key: foreignKey, label: foreignKey }],
    } as never);
    ok(
      "K5:yabanci-anahtar-fail-closed",
      created.projection?.fieldAuthority?.[foreignKey]?.constraints !==
        "USER_EXPLICIT",
      "mevcut kategori altında yabancı kategori anahtarı kabul edildi",
    );
    ok(
      "K5:yabanci-anahtar-response-yok",
      created.projection?.fieldResponses?.[foreignKey] === undefined,
      "yabancı anahtar fieldResponses yüzeyi üretti",
    );

    /* Kategori MEŞRU biçimde değişti: yalnız yeni kategorinin alanı kabul
     * edilir, eski kategorininki taşınmaz. */
    const migrated = resolveCreateProjection({
      discoveryProjection: foreignProjection,
      rawInput: SCENE_TEXT,
      category: { slug: otherCategory?.id ?? "printing" },
      fields: [{ ...answerRow, key: foreignKey, label: foreignKey }],
    } as never);
    ok(
      "K5:mesru-kategori-degisimi",
      migrated.projection?.fieldAuthority?.[foreignKey]?.constraints ===
        "USER_EXPLICIT",
      "kategori meşru biçimde değiştiğinde yeni kategorinin alanı reddedildi",
    );
    const carried = resolveCreateProjection({
      discoveryProjection: projection,
      rawInput: SCENE_TEXT,
      category: { slug: otherCategory?.id ?? "printing" },
      fields: [answerRow],
    } as never);
    ok(
      "K5:eski-kategori-tasinmaz",
      carried.projection?.fieldAuthority?.[SCENE_KEY]?.constraints !==
        "USER_EXPLICIT",
      "kategori değiştiğinde eski kategorinin alanı taşındı",
    );
  }

  /* Kategori hiç gönderilmezse kategoriye özgü cevap kabul edilmez. */
  ok(
    "K5:kategori-yok-fail-closed",
    serverAuthorityFor(undefined) !== "USER_EXPLICIT",
    "kategori bağlamı olmadan kategoriye özgü cevap kabul edildi",
  );
  ok(
    "K5:kategori-bozuk-fail-closed",
    serverAuthorityFor("kesinlikle-yok-boyle-bir-kategori") !== "USER_EXPLICIT",
    "tanınmayan kategoride cevap kabul edildi",
  );
}

/* ------------------------------------------------------------------ *
 * EK KANITLAR
 * ------------------------------------------------------------------ */

/* `confirmedFieldKeys` tekrarsız, deterministik ve tek geçişli. */
function confirmedFor(input: string[]): string[] {
  const snapshot = buildUnderstandingSnapshot({
    categoryResolution: {
      status: "unresolved",
      userSelected: false,
      userChoice: null,
      primary: null,
      candidates: [],
    },
    confirmedFieldKeys: input,
  } as never);
  return snapshot.confirmedFieldKeys ?? [];
}

{
  const noisy = [
    SCENE_KEY,
    SCENE_KEY,
    ` ${SCENE_KEY} `,
    "condition",
    "condition",
    "",
    "  ",
  ];
  const first = confirmedFor(noisy);
  const second = confirmedFor(noisy);
  ok(
    "P:confirmed-tekrarsiz",
    first.length === new Set(first).size,
    `küme değil: ${JSON.stringify(first)}`,
  );
  ok(
    "P:confirmed-en-fazla-bir",
    first.filter((k) => k === SCENE_KEY).length === 1,
    `aynı anahtar birden çok kez: ${JSON.stringify(first)}`,
  );
  ok(
    "P:confirmed-deterministik",
    JSON.stringify(first) === JSON.stringify(second),
    `iki koşu ayrıştı: ${JSON.stringify(first)} vs ${JSON.stringify(second)}`,
  );
  ok(
    "P:confirmed-sira",
    JSON.stringify(first) === JSON.stringify([SCENE_KEY, "condition"]),
    `beklenen ilk-görülme sırası korunmadı: ${JSON.stringify(first)}`,
  );
}

/* 119 ANY kimliğinin tamamı geçerli kamuya açık soru anahtarıdır. */
{
  let identities = 0;
  let outsideUniverse = 0;
  let internalOrBlocked = 0;
  const offenders: string[] = [];
  const blocked = new Set<string>([
    "__proto__",
    "constructor",
    "prototype",
    ...INTERNAL_EVIDENCE_ATTRIBUTE_KEYS,
  ]);

  for (const category of REQUEST_CATEGORIES) {
    if (!category.id) continue;
    const universe = new Set(publicQuestionKeys(category.id));
    const dynamic = new Set<string>();
    for (const field of category.fields ?? []) dynamic.add(field.key);
    for (const key of listProfileKeysForCategory(category.id)) dynamic.add(key);
    for (const key of Object.keys(COMMON_FIELD_DEFAULTS)) dynamic.delete(key);
    for (const key of dynamic) {
      identities += 1;
      if (!universe.has(key)) {
        outsideUniverse += 1;
        if (offenders.length < 8) offenders.push(`${category.id}/${key}`);
      }
      if (blocked.has(key)) internalOrBlocked += 1;
    }
  }

  /**
   * KİMLİK SAYISI BÜYÜDÜ, KÜÇÜLMEDİ (D3f Dilim 3h, 2026-08-28).
   *
   * İlk ölçüm 119'du ve evren `listProfilesForCategory` ile kuruluyordu; o
   * çağrı `whenNeedTypes` / `whenProductTypes` süzgecini de uygular ve
   * ZAMANLAMA sorusunu cevaplar ("şu an sorulsun mu?"). Cevap evreni bu
   * süzgece bağlı olamaz: ürün tipi henüz çözülmemişken verilmiş bir cevap
   * evren dışına düşerdi — `fridgeType` tam olarak böyle düşüyordu. Evren
   * kategori düzeyindeki kanonik `listProfileKeysForCategory`ye taşındı ve
   * ölçülen kimlik 119 → 151 oldu.
   *
   * TABAN ASLA KÜÇÜLMEZ. Aşağıdaki iki ölçüt birlikte durur: güncel beklenti
   * ve dondurulmuş alt sınır. Bir gün evren daralırsa bu doğrulayıcı sayacı
   * sessizce düşürmez, KIRMIZI olur.
   */
  const FROZEN_MIN_IDENTITIES = 119;
  console.log(`ANY kimliği: ${identities}`);
  ok(
    "P:kimlik-sayisi",
    identities === 151,
    `beklenen 151 kimlik, ölçülen ${identities}`,
  );
  ok(
    "P:kimlik-taban-korunur",
    identities >= FROZEN_MIN_IDENTITIES,
    `dondurulmuş taban ${FROZEN_MIN_IDENTITIES} altına düştü: ${identities}`,
  );
  ok(
    "P:kimlik-evren-ici",
    outsideUniverse === 0,
    `kategori dışı anahtar: ${outsideUniverse} (${offenders.join(", ")})`,
  );
  ok(
    "P:kimlik-ic-kanit-yok",
    internalOrBlocked === 0,
    `iç kanıt / nesne modeli anahtarı: ${internalOrBlocked}`,
  );
}

/* `rawInput` değişmez ve üretilen başlık geri dönmez. */
{
  const base = createTextOnlyState(SCENE_TEXT);
  const state: CanonicalRequestState = {
    ...base,
    categoryId: SCENE_CATEGORY,
    fields: { ...base.fields, [SCENE_KEY]: EXPLICIT_ANY },
  };
  const out = surfacesFor(state, SCENE_KEY, []);
  ok("P:rawInput", out.rawInput === SCENE_TEXT, "rawInput değişti");

  for (const key of Object.keys(COMMON_FIELD_DEFAULTS).filter((k) =>
    isGeneratedCommonField(k),
  )) {
    const generated: CanonicalRequestState = {
      ...base,
      categoryId: SCENE_CATEGORY,
      fields: { ...base.fields, [key]: EXPLICIT_ANY },
    };
    const surfaces = surfacesFor(generated, key, []);
    ok(
      `P:generated-donmez/${key}`,
      !surfaces.inFields &&
        surfaces.constraintAuthority === null &&
        surfaces.response === null,
      `üretilen alan cevap yüzeyine döndü (fields=${surfaces.inFields})`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * HÜKÜM
 * ------------------------------------------------------------------ */

const byGate = new Map<string, number>();
for (const problem of problems) {
  const gate = problem.split(/[/:]/, 1)[0] ?? "?";
  byGate.set(gate, (byGate.get(gate) ?? 0) + 1);
}
for (const gate of [...byGate.keys()].sort()) {
  console.log(`  ${gate}: ${byGate.get(gate)} sorun`);
}

console.log(`PROBLEMS=${problems.length}`);
for (const problem of problems.slice(0, 30)) console.log(`  - ${problem}`);
if (problems.length > 30) {
  console.log(`  ... (+${problems.length - 30} tane daha)`);
}
console.log("===== HUKUM =====");
console.log(
  problems.length === 0
    ? "GECTI: görünmeyen / kaldırılan / geçersiz cevap birbirinden ayrı."
    : "KALDI: üç durum birbirine karışıyor.",
);
process.exit(problems.length === 0 ? 0 : 1);
