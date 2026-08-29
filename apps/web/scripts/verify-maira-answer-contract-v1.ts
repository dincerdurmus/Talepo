/**
 * MAIRA ↔ STANDART GÖRÜNÜM CEVAP SÖZLEŞMESİ — KAPILAR.
 *
 * Bu doğrulayıcı, Maira görünümü YAZILMADAN ÖNCE, iki görünümün paylaşacağı
 * sözleşmeyi bugünkü GERÇEK üretim fonksiyonları üzerinde kilitler. Hiçbir
 * kapı kendi karar kopyasını kurmaz: cevabın soruyu kapatıp kapatmadığına
 * `isFieldSatisfied`, sıradaki sorulara `scheduleComposerQuestions`, soru
 * evrenine `resolveHybridQuestions` karar verir.
 *
 * Her kusur sınıfının bir MUTASYON KONTROLÜ vardır: kusur bilerek geri
 * getirildiğinde ilgili kapı kırmızıya döner. Kontrolü geçemeyen bir kapı
 * kanıt değildir.
 *
 * Çalıştırma: npm run verify:maira-answer-contract
 */
import { syncFromText, syncFromBrowse } from "../src/lib/request-composer/sync";
import { resolveHybridQuestions } from "../src/lib/request-composer/questions";
import {
  scheduleComposerQuestions,
  scheduledToFocusedQuestion,
} from "../src/lib/request-composer/v2/focused-questions";
import {
  isFieldSatisfied,
  type FieldAnswerState,
} from "../src/lib/request-composer/v2/question-scheduler";
import { buildUnderstoodFacts } from "../src/lib/request-composer/ui-helpers";
import { budgetDisplayFromUnderstanding } from "../src/lib/request-understanding/activation-bridge";
import type { CanonicalRequestState } from "../src/lib/request-composer/types";

const PROBLEMS: string[] = [];
let CHECKS = 0;

function gate(name: string, ok: boolean, detail?: string) {
  CHECKS += 1;
  if (!ok) PROBLEMS.push(`${name}${detail ? " — " + detail : ""}`);
}

/** Mutasyon kontrolü: kusur geri getirildiğinde kapı KIRMIZI olmalı. */
function mutationControl(name: string, wouldFail: boolean) {
  CHECKS += 1;
  if (!wouldFail) {
    PROBLEMS.push(
      `${name} — MUTASYON KONTROLÜ BAŞARISIZ: kusur geri getirildiğinde kapı hâlâ yeşil`,
    );
  }
}

const KADIKOY =
  "İstanbul Kadıköy'de no-frost buzdolabı arıyorum, bütçem 25.000 TL civarı.";

const baseState: CanonicalRequestState = syncFromText(null, KADIKOY).state;

/**
 * Üretimin scheduler'a verdiği girdiyi birebir kurar. `values.city` ve
 * `values.budget` üretimde `mergedCommonDraft` üzerinden anlamadan tohumlanır
 * (talep/page.tsx:753); sonda o tohumu atlarsa ölçüm üretimi yansıtmaz.
 */
function scheduleFor(
  state: CanonicalRequestState,
  opts: {
    answeredKeys?: string[];
    overrideFieldStates?: Record<string, FieldAnswerState>;
  } = {},
) {
  const hybrid = resolveHybridQuestions(state, {});
  const values: Record<string, string | undefined> = {};
  for (const [k, f] of Object.entries(state.fields)) {
    values[k] = f.kind === "VALUE" ? String(f.value ?? "") : undefined;
  }
  values.city = values.city || (state.understanding.location?.city?.value ?? "");
  values.budget =
    values.budget || budgetDisplayFromUnderstanding(state.understanding);

  const fieldStates: Record<string, FieldAnswerState> = Object.fromEntries(
    Object.entries(state.fields).map(([key, field]) => [
      key,
      {
        kind: field.kind,
        value:
          field.kind === "VALUE"
            ? String(field.value ?? "")
            : field.kind === "ANY"
              ? "no_preference"
              : null,
        provenance: field.provenance ?? null,
      },
    ]),
  );
  Object.assign(fieldStates, opts.overrideFieldStates ?? {});

  const result = scheduleComposerQuestions({
    categoryId:
      state.categoryId ?? state.understanding.category.value ?? "unknown",
    needType:
      state.fields.needType?.kind === "VALUE"
        ? String(state.fields.needType.value ?? "")
        : null,
    candidates: hybrid.candidates,
    values,
    fieldStates,
    answeredKeys: opts.answeredKeys ?? [],
  });
  return { hybrid, result, visible: result.visible.map((q) => q.fieldKey) };
}

/* ------------------------------------------------------------------ *
 * K1 — Kadıköy senaryosu: anlaşılan değerler kilitli.
 * ------------------------------------------------------------------ */
{
  const u = baseState.understanding;
  gate(
    "K1a-sehir",
    u.location?.city?.value === "İstanbul / Kadıköy",
    `city=${String(u.location?.city?.value)}`,
  );
  gate(
    "K1b-ilce",
    u.location?.district?.value === "Kadıköy",
    `district=${String(u.location?.district?.value)}`,
  );
  gate(
    "K1c-butce",
    u.budget?.value?.max === 25000 && u.budget?.value?.currency === "TRY",
    JSON.stringify(u.budget?.value ?? null),
  );
  gate(
    "K1d-urun",
    baseState.fields.productType?.kind === "VALUE" &&
      String(baseState.fields.productType?.value) === "Buzdolabı",
    JSON.stringify(baseState.fields.productType ?? null),
  );
  gate("K1e-kategori", baseState.categoryId === "appliances");
}

/* ------------------------------------------------------------------ *
 * K2 — TEK SORU OTORİTESİ.
 * Maira'nın gösterebileceği her soru metni ve seçeneği kanonik listeden
 * gelmelidir. Prototipte uydurulmuş "Kadıköy dışına da bakalım mı?" gibi
 * bir metin kanonik evrende BULUNMAMALIDIR.
 * ------------------------------------------------------------------ */
{
  const { hybrid, result } = scheduleFor(baseState);
  const canonicalTexts = [
    ...hybrid.candidates.map((c) => c.label ?? ""),
    ...result.visible.map(
      (q) => scheduledToFocusedQuestion(q, undefined, {}).label,
    ),
  ];
  const FORBIDDEN = /dışına da bakalım|bakalım mı/i;
  gate(
    "K2a-uydurma-soru-yok",
    !canonicalTexts.some((t) => FORBIDDEN.test(t)),
    JSON.stringify(canonicalTexts.filter((t) => FORBIDDEN.test(t))),
  );
  gate(
    "K2b-soru-kaynagi-kanonik",
    hybrid.questionSource === "canonical-hybrid",
    hybrid.questionSource,
  );
  gate("K2c-gorunen-soru-var", result.visible.length > 0);

  mutationControl(
    "K2a-mutasyon",
    FORBIDDEN.test("Kadıköy dışına da bakalım mı?"),
  );
}

/* ------------------------------------------------------------------ *
 * K3 — Cevaplanan soru elenir (answeredKeys).
 * Senaryo 2 ve 6'nın çekirdeği: bir görünümde verilen cevap, diğerinde
 * soruyu yeniden açmaz.
 * ------------------------------------------------------------------ */
{
  const before = scheduleFor(baseState).visible;
  const target = before[0];
  const after = scheduleFor(baseState, { answeredKeys: [target] }).visible;
  gate("K3a-elenir", !after.includes(target), `${target} hâlâ görünüyor`);
  gate("K3b-digerleri-durur", before.slice(1).every((k) => after.includes(k)));

  // Aynı anahtarı iki kez işaretlemek yinelenme üretmez.
  const twice = scheduleFor(baseState, {
    answeredKeys: [target, target],
  }).visible;
  gate("K3c-yinelenme-yok", JSON.stringify(twice) === JSON.stringify(after));

  mutationControl("K3a-mutasyon", scheduleFor(baseState).visible.includes(target));
}

/* ------------------------------------------------------------------ *
 * K4–K8 — CEVAP TÜRLERİ. Kapatma kararı tek otoriteden: isFieldSatisfied.
 * ------------------------------------------------------------------ */
{
  const common = {
    fieldKey: "fridgeType",
    importance: "quote_critical" as const,
    allowUnknown: true,
    allowDontCare: true,
  };

  gate(
    "K4-deger-cevabi-kapatir",
    isFieldSatisfied({
      ...common,
      state: { kind: "VALUE", value: "No-frost", provenance: "EXPLICIT_BROWSE" },
    }),
  );

  gate(
    "K5-fark-etmez-kapatir",
    isFieldSatisfied({
      ...common,
      state: {
        kind: "ANY",
        value: "Fark etmez",
        softStatus: "no_preference",
        provenance: "EXPLICIT_BROWSE",
      },
    }),
  );

  /**
   * ÖLÇÜLDÜ (2026-08-29): "Henüz bilmiyorum" soruyu YALNIZ alanın profili
   * bilinmezliğe izin veriyorsa kapatır. `fridgeType` için allowUnknown=false,
   * `delivery` için true. İkisi ayrı kapıdır; tek beklentiye indirilmez.
   */
  gate(
    "K6a-bilmiyorum-izinli-alanda-kapatir",
    isFieldSatisfied({
      ...common,
      allowUnknown: true,
      state: {
        kind: "UNKNOWN",
        value: "Henüz bilmiyorum",
        softStatus: "unknown",
        provenance: "EXPLICIT_BROWSE",
      },
    }),
  );
  gate(
    "K6b-bilmiyorum-izinsiz-alanda-kapatmaz",
    !isFieldSatisfied({
      ...common,
      allowUnknown: false,
      state: {
        kind: "UNKNOWN",
        value: "Henüz bilmiyorum",
        softStatus: "unknown",
        provenance: "EXPLICIT_BROWSE",
      },
    }),
    "allowUnknown=false alan bilinmezlikle kapandı",
  );

  gate(
    "K7-cikarim-kapatmaz",
    !isFieldSatisfied({
      ...common,
      state: { kind: "VALUE", value: "No-frost", provenance: "INFERRED" },
    }),
    "çıkarım cevap sayıldı (KB-17 ihlali)",
  );

  gate(
    "K8-kacis-etiketi-tek-basina-kapatmaz",
    !isFieldSatisfied({
      ...common,
      state: { kind: "VALUE", value: "Fark etmez", provenance: "EXPLICIT_BROWSE" },
    }),
    "kanonik modu olmayan kaçış etiketi soruyu kapattı",
  );

  /**
   * Kanonik MOD yetkiyi taşır, etiket değil: `kind: "ANY"` softStatus olmadan
   * da bilinçli cevaptır (ölçüldü). Bu yüzden mutasyon kontrolü etiketi değil,
   * gerçek kusuru dener: ÇIKARIMDAN gelen bir ANY cevap sayılırsa kapı kırmızı.
   */
  mutationControl(
    "K5-mutasyon",
    !isFieldSatisfied({
      ...common,
      state: { kind: "ANY", value: "Fark etmez", provenance: "INFERRED" },
    }),
  );
  mutationControl(
    "K7-mutasyon",
    isFieldSatisfied({
      ...common,
      state: { kind: "VALUE", value: "No-frost", provenance: "EXPLICIT_TEXT" },
    }),
  );
}

/* ------------------------------------------------------------------ *
 * K9 — Cevap verilen alan scheduler'da da tekrar sorulmaz.
 * (Senaryo 5: "Fark etmez" cevabı soruyu kapatır ve kaybolmaz.)
 * ------------------------------------------------------------------ */
{
  const before = scheduleFor(baseState).visible;
  const target = before.find((k) => k === "fridgeType") ?? before[0];
  const withAny = scheduleFor(baseState, {
    overrideFieldStates: {
      [target]: {
        kind: "ANY",
        value: "Fark etmez",
        softStatus: "no_preference",
        provenance: "EXPLICIT_BROWSE",
      },
    },
  }).visible;
  gate(
    "K9a-fark-etmez-soruyu-kapatir",
    !withAny.includes(target),
    `${target} "Fark etmez" cevabına rağmen yeniden soruldu`,
  );

  /**
   * `delivery` profili bilinmezliğe izin verir; `fridgeType` vermez. İki
   * davranış ayrı ayrı kilitlenir — biri diğerini gizlemez.
   */
  const withUnknownDelivery = scheduleFor(baseState, {
    overrideFieldStates: {
      delivery: {
        kind: "UNKNOWN",
        value: "Henüz bilmiyorum",
        softStatus: "unknown",
        provenance: "EXPLICIT_BROWSE",
      },
    },
  }).visible;
  gate("K9b-bilmiyorum-izinli-alani-kapatir", !withUnknownDelivery.includes("delivery"));

  const withUnknownFridge = scheduleFor(baseState, {
    overrideFieldStates: {
      fridgeType: {
        kind: "UNKNOWN",
        value: "Henüz bilmiyorum",
        softStatus: "unknown",
        provenance: "EXPLICIT_BROWSE",
      },
    },
  }).visible;
  gate(
    "K9c-bilmiyorum-izinsiz-alani-acik-birakir",
    withUnknownFridge.includes("fridgeType"),
    "allowUnknown=false alan bilinmezlikle kapandı",
  );

  mutationControl("K9a-mutasyon", scheduleFor(baseState).visible.includes(target));
}

/* ------------------------------------------------------------------ *
 * K10 — AŞAMA GERİLEMESİ YOK.
 * Cevap eklendikçe incelemeye girilebilirlik geri gitmez.
 * ------------------------------------------------------------------ */
{
  const start = scheduleFor(baseState).result;
  let canReview = start.canEnterReview;
  const answered: string[] = [];
  for (const key of scheduleFor(baseState).visible) {
    answered.push(key);
    const step = scheduleFor(baseState, { answeredKeys: answered }).result;
    if (canReview && !step.canEnterReview) {
      gate("K10-asama-gerilemesi", false, `${key} sonrası canEnterReview düştü`);
    }
    canReview = canReview || step.canEnterReview;
  }
  gate("K10-asama-gerilemesi", true);
  gate(
    "K10b-yayin-kapisi-korunur",
    Array.isArray(start.blockingFieldKeys),
    "blockingFieldKeys sözleşmesi kayıp",
  );
}

/* ------------------------------------------------------------------ *
 * K11 — "YANITLARIM" KAYNAĞI.
 * buildUnderstoodFacts TEK BAŞINA yeterli DEĞİLDİR: değer taşımayan bilinçli
 * cevaplar ("Fark etmez" / "Henüz bilmiyorum") orada görünmez. Bu kapı, ileride
 * yazılacak projeksiyonun kanonik alan torbasından türetilmesi gerektiğini
 * kilitler — yoksa kullanıcının verdiği cevap listeden düşer.
 * ------------------------------------------------------------------ */
{
  const withNonValue: CanonicalRequestState = {
    ...baseState,
    fields: {
      ...baseState.fields,
      fridgeType: {
        kind: "ANY",
        value: "Fark etmez",
        provenance: "EXPLICIT_BROWSE",
      },
    },
  };
  const facts = buildUnderstoodFacts(withNonValue);
  const shown = facts.some((f) => f.key === "fridgeType");
  gate(
    "K11a-understood-facts-tek-basina-yetmez",
    !shown,
    'buildUnderstoodFacts "Fark etmez" cevabını gösteriyor — projeksiyon kararı yeniden ölçülmeli',
  );
  gate(
    "K11b-kanonik-torba-cevabi-tasiyor",
    withNonValue.fields.fridgeType?.kind === "ANY" &&
      withNonValue.fields.fridgeType?.provenance === "EXPLICIT_BROWSE",
    "kanonik alan torbası bilinçli non-value cevabı taşımıyor",
  );
  gate(
    "K11c-kullanici-kaynagi-ayirt-edilebilir",
    Object.values(baseState.fields).some(
      (f) => f.provenance === "EXPLICIT_TEXT",
    ) &&
      Object.values(baseState.fields).some((f) => f.provenance === "INFERRED"),
    "provenance ayrımı yok — kullanıcı cevabı çıkarımdan ayrılamaz",
  );
}

/* ================================================================== *
 * T — KATEGORİ DEĞİŞİMİ VE ÜRÜN TİPİ SÖZLEŞMESİ.
 *
 * Kaynak: kurucu kararı 2026-08-29. Prototipte "Televizyon arıyorum"
 * yazıldığında ekranda buzdolabı sorusu kalmıştı; ölçüm bunun ÜRÜNDEN
 * DEĞİL prototipin kayıtlı örneğinden geldiğini gösterdi. Aşağıdaki
 * kapılar bu sınıfı kalıcı olarak kilitler ve ürün tarafında hâlâ açık
 * olan üç davranışı görünür kırmızı olarak tutar.
 * ================================================================== */
{
  const FRIDGE = /fridge|buzdolab|no-?frost|statik/i;

  /* --- T1: temiz başlangıçta televizyon doğru bağlanır --- */
  const tv = syncFromText(null, "Televizyon arıyorum").state;
  gate("T1a-kategori", tv.categoryId === "technology", String(tv.categoryId));
  gate(
    "T1b-urun-tipi",
    tv.fields.productType?.kind === "VALUE" &&
      /televizyon/i.test(String(tv.fields.productType?.value ?? "")) &&
      tv.fields.productType?.provenance === "EXPLICIT_TEXT",
    JSON.stringify(tv.fields.productType ?? null),
  );

  /* --- T2: buzdolabına özel hiçbir soru/alan görünmez --- */
  const tvAsk = scheduleFor(tv);
  const tvSurface = [
    ...tvAsk.hybrid.candidates.map((c) => c.fieldKey + " " + (c.label ?? "")),
    ...tvAsk.result.visible.map(
      (q) => q.fieldKey + " " + scheduledToFocusedQuestion(q, undefined, {}).label,
    ),
    ...Object.keys(tv.fields),
  ];
  const leak = tvSurface.filter((t) => FRIDGE.test(t));
  gate("T2-buzdolabi-sizintisi-yok", leak.length === 0, JSON.stringify(leak));
  mutationControl("T2-mutasyon", FRIDGE.test("fridgeType Buzdolabı tipi"));

  /* --- T3: soru üretimi kanonik; profil yoksa genel akışa düşer --- */
  gate(
    "T3a-kanonik-kaynak",
    tvAsk.hybrid.questionSource === "canonical-hybrid",
    tvAsk.hybrid.questionSource,
  );
  gate(
    "T3b-genel-akis-calisir",
    tvAsk.visible.length > 0,
    "televizyon için hiç soru üretilmedi",
  );

  /* --- T4/T5/T6: buzdolabı → televizyon değişimi --- */
  const answered = syncFromBrowse(baseState, {
    key: "fridgeType",
    value: "No-frost",
    isAny: false,
  }).state;
  gate(
    "T4a-cevap-yazildi",
    answered.fields.fridgeType?.kind === "VALUE" &&
      answered.fields.fridgeType?.provenance === "EXPLICIT_BROWSE",
    JSON.stringify(answered.fields.fridgeType ?? null),
  );

  const switched = syncFromText(answered, "Televizyon arıyorum").state;
  /**
   * Ölçüldü: değişimden sonra `applianceType` boş bir `UNKNOWN/INFERRED` yuva
   * olarak kalabiliyor. Kapının ölçtüğü şey yuvanın varlığı değil, kategoriye
   * özel bir CEVABIN taşınıp taşınmadığıdır.
   */
  const carried = (k: string) => {
    const f = switched.fields[k];
    return Boolean(
      f && f.kind === "VALUE" &&
        (f.provenance === "EXPLICIT_BROWSE" || f.provenance === "EXPLICIT_TEXT"),
    );
  };
  gate(
    "T4b-kategoriye-ozel-cevap-duser",
    !carried("fridgeType") && !carried("applianceType"),
    JSON.stringify({
      fridgeType: switched.fields.fridgeType ?? null,
      applianceType: switched.fields.applianceType ?? null,
    }),
  );
  gate(
    "T4c-urun-tipi-guncellendi",
    /televizyon/i.test(String(switched.fields.productType?.value ?? "")),
    JSON.stringify(switched.fields.productType ?? null),
  );

  const afterAsk = scheduleFor(switched);
  const afterLeak = [
    ...afterAsk.hybrid.candidates.map((c) => c.fieldKey),
    ...afterAsk.visible,
  ].filter((t) => FRIDGE.test(t));
  gate("T5-degisimden-sonra-sizinti-yok", afterLeak.length === 0, JSON.stringify(afterLeak));

  const again = scheduleFor(switched);
  gate(
    "T6-dusen-cevap-geri-gelmez",
    !again.visible.some((k) => FRIDGE.test(k)) && !switched.fields.fridgeType,
    "kategoriye özel cevap kendiliğinden geri geldi",
  );

  /* --- T7 (BEKLENEN KIRMIZI): ortak ve hâlâ geçerli cevaplar korunmalı --- *
   * Ölçüldü 2026-08-29: tıklamayla verilmiş `city` ve `budget` cevapları da
   * metin değişince kanonik state'ten siliniyor. Sayfa `commonDraft` içinde
   * onları tutabildiği için ekranda görünmeye devam ediyor — yani iki otorite
   * aynı cevap hakkında farklı şey söylüyor. Kapı bu ayrışmayı görünür tutar. */
  const clicked = syncFromBrowse(
    syncFromBrowse(baseState, { key: "city", value: "İstanbul", isAny: false }).state,
    { key: "budget", value: "25.000 TL", isAny: false },
  ).state;
  const clickedThenSwitched = syncFromText(clicked, "Televizyon arıyorum").state;
  gate(
    "T7-ortak-cevaplar-korunur",
    clickedThenSwitched.fields.city?.kind === "VALUE" &&
      clickedThenSwitched.fields.budget?.kind === "VALUE",
    "tıklamayla verilmiş konum/bütçe metin değişince kanonik state'ten silindi",
  );

  /* --- T8 (BEKLENEN KIRMIZI): açık "no-frost" beyanı tekrar sorulmamalı --- */
  const noFrostAsk = scheduleFor(baseState);
  gate(
    "T8-no-frost-tekrar-sorulmaz",
    !noFrostAsk.visible.includes("fridgeType"),
    'kullanıcı "no-frost" yazdığı hâlde "Buzdolabı tipi" yeniden soruluyor',
  );

  /* --- T9 (BEKLENEN KIRMIZI): açık bütçe tek otoriteden okunmalı --- */
  gate(
    "T9-acik-butce-kanonik-alanda",
    baseState.fields.budget?.kind === "VALUE" &&
      (baseState.fields.budget?.provenance === "EXPLICIT_TEXT" ||
        baseState.fields.budget?.provenance === "EXPLICIT_BROWSE"),
    "açıkça yazılan bütçe kanonik alana yazılmıyor; readiness ve isFieldSatisfied ayrı yol okuyor",
  );

  /* --- T10: yalnız tahmin edilen bütçe readiness'i karşılamaz --- */
  gate(
    "T10-tahmini-butce-karsilamaz",
    !isFieldSatisfied({
      fieldKey: "budget",
      importance: "publish_required",
      allowUnknown: false,
      allowDontCare: false,
      state: { kind: "VALUE", value: "25.000 TL", provenance: "INFERRED" },
    }),
  );
}

/* ================================================================== *
 * T7b–T9d — "TALEP CEVABI TEMELİ" DİLİMİNİN ALT SENARYOLARI.
 * Kurucu kararı 2026-08-29. Hepsi gerçek üretim fonksiyonları üzerinde
 * ölçülür; hiçbir kapı kendi karar kopyasını kurmaz.
 * ================================================================== */
{
  const FRIDGE_TEXT =
    "İstanbul Kadıköy'de no-frost buzdolabı arıyorum, bütçem 25.000 TL civarı.";

  /** Kullanıcı arayüzden konum + bütçe + buzdolabı tipi vermiş bir taban. */
  function answeredBase() {
    let st = syncFromText(null, FRIDGE_TEXT).state;
    st = syncFromBrowse(st, { key: "city", value: "İstanbul", isAny: false }).state;
    st = syncFromBrowse(st, { key: "budget", value: "25.000 TL", isAny: false }).state;
    st = syncFromBrowse(st, { key: "fridgeType", value: "No-Frost", isAny: false }).state;
    return st;
  }
  const explicit = (f?: { kind?: string; provenance?: string } | null) =>
    Boolean(
      f &&
        f.kind === "VALUE" &&
        (f.provenance === "EXPLICIT_BROWSE" || f.provenance === "EXPLICIT_TEXT"),
    );

  /* ---- T7b: yeni metinde açık şehir beyanı kazanır ---- */
  {
    const next = syncFromText(answeredBase(), "Ankara'da televizyon arıyorum").state;
    const city = String(next.fields.city?.value ?? next.understanding.location?.city?.value ?? "");
    gate("T7b-yeni-acik-sehir-kazanir", /ankara/i.test(city), `city=${city}`);
    gate(
      "T7b2-eski-sehir-geri-gelmez",
      !/istanbul/i.test(city),
      `city=${city}`,
    );
  }

  /* ---- T7c: yeni metinde açık bütçe beyanı kazanır ---- */
  {
    const next = syncFromText(answeredBase(), "Televizyon arıyorum, bütçem 40.000 TL").state;
    const b =
      String(next.fields.budget?.value ?? "") ||
      String(next.understanding.budget?.value?.max ?? "");
    gate("T7c-yeni-acik-butce-kazanir", /40/.test(b), `budget=${b}`);
  }

  /* ---- T7d: yeni açık beyan yoksa eski kullanıcı cevabı korunur ---- */
  {
    const next = syncFromText(answeredBase(), "Televizyon arıyorum").state;
    gate(
      "T7d-konum-korunur",
      explicit(next.fields.city),
      JSON.stringify(next.fields.city ?? null),
    );
    gate(
      "T7d2-butce-korunur",
      explicit(next.fields.budget),
      JSON.stringify(next.fields.budget ?? null),
    );
    gate(
      "T7d3-kategoriye-ozel-tasinmaz",
      !explicit(next.fields.fridgeType) && !explicit(next.fields.applianceType),
      JSON.stringify({
        fridgeType: next.fields.fridgeType ?? null,
        applianceType: next.fields.applianceType ?? null,
      }),
    );
    /* Korunan cevap sonraki turda da yerinde kalmalı (geri gelme/kaybolma yok). */
    const again = syncFromText(next, "Televizyon arıyorum").state;
    gate(
      "T7d4-korunan-cevap-kalici",
      explicit(again.fields.city) && !explicit(again.fields.fridgeType),
      JSON.stringify({ city: again.fields.city ?? null, fridgeType: again.fields.fridgeType ?? null }),
    );
  }

  /* ---- T8: no-frost olumlu ---- */
  {
    const st = syncFromText(null, "No-frost buzdolabı arıyorum").state;
    gate(
      "T8a-no-frost-kanonik-alana-yazilir",
      st.fields.fridgeType?.kind === "VALUE" &&
        st.fields.fridgeType?.provenance === "EXPLICIT_TEXT",
      JSON.stringify(st.fields.fridgeType ?? null),
    );
    const asked = scheduleFor(st).visible;
    gate(
      "T8a2-ayni-soru-tekrar-sorulmaz",
      !asked.includes("fridgeType"),
      JSON.stringify(asked),
    );
  }

  /* ---- T8 yanlış pozitifler ---- */
  {
    const neg = syncFromText(null, "Buzdolabı arıyorum, no-frost istemiyorum").state;
    gate(
      "T8b-olumsuzlama-cevap-uretmez",
      !explicit(neg.fields.fridgeType),
      JSON.stringify(neg.fields.fridgeType ?? null),
    );

    const unsure = syncFromText(
      null,
      "Buzdolabı arıyorum, no-frost mu statik mi bilmiyorum",
    ).state;
    gate(
      "T8c-belirsizlik-cevap-uretmez",
      !explicit(unsure.fields.fridgeType),
      JSON.stringify(unsure.fields.fridgeType ?? null),
    );

    const other = syncFromText(null, "No frost yazılımı için geliştirici arıyorum").state;
    gate(
      "T8d-baska-kategori-alan-uretmez",
      !other.fields.fridgeType,
      JSON.stringify({ categoryId: other.categoryId, fridgeType: other.fields.fridgeType ?? null }),
    );
  }

  /* ---- T8 yazım varyantları ---- */
  {
    const variants = ["no-frost", "no frost", "nofrost"];
    const bound = variants.map((v) => {
      const st = syncFromText(null, `${v} buzdolabı arıyorum`).state;
      return {
        v,
        value: st.fields.fridgeType?.kind === "VALUE"
          ? String(st.fields.fridgeType?.canonicalValue ?? st.fields.fridgeType?.value ?? "")
          : null,
      };
    });
    const values = bound.map((b) => b.value);
    gate(
      "T8e-yazim-varyantlari-ayni-kanonik-degere-gider",
      values.every((v) => v !== null) && new Set(values).size === 1,
      JSON.stringify(bound),
    );
  }

  /* ---- T9: açık bütçe kanonik alana yazılır ve tek otorite okunur ---- */
  {
    const st = syncFromText(null, "Buzdolabı arıyorum, bütçem 25.000 TL").state;
    gate(
      "T9a-acik-butce-kanonik-alan",
      explicit(st.fields.budget),
      JSON.stringify(st.fields.budget ?? null),
    );
    gate(
      "T9a2-butce-satisfied",
      isFieldSatisfied({
        fieldKey: "budget",
        importance: "publish_required",
        allowUnknown: false,
        allowDontCare: false,
        state: {
          kind: st.fields.budget?.kind,
          value: st.fields.budget?.value ?? null,
          provenance: st.fields.budget?.provenance ?? null,
        },
      }),
      "kanonik bütçe alanı isFieldSatisfied'ı geçmedi",
    );
    gate(
      "T9a3-butce-sorulmaz",
      !scheduleFor(st).visible.includes("budget"),
      JSON.stringify(scheduleFor(st).visible),
    );
  }

  /* ---- T9: sayısal olmayan genel ifade açık bütçe üretmez ---- */
  {
    const vague = syncFromText(null, "Uygun fiyatlı bir buzdolabı olsun").state;
    gate(
      "T9b-genel-ifade-butce-uretmez",
      !explicit(vague.fields.budget),
      JSON.stringify(vague.fields.budget ?? null),
    );
    gate(
      "T9b2-genel-ifade-butce-sorusu-durur",
      scheduleFor(vague).result.blockingFieldKeys.includes("budget") ||
        scheduleFor(vague).visible.includes("budget"),
      "sayısal olmayan ifade bütçe kapısını açtı",
    );
  }
}

/* ================================================================== *
 * T7x — ORTAKLIK KANITI KARŞI ÖRNEĞİ (kurucu, 2026-08-29).
 *
 * "Alan yeni kategorinin SORU PROFİLİNDE de var" ortaklık kanıtı DEĞİLDİR:
 * `brand` iki profilde de bulunur, ama buzdolabı markası televizyon talebine
 * taşınamaz. Ortaklık, ürünün kendi ortak alan kaydından türer.
 * ================================================================== */
{
  const carried = (st: CanonicalRequestState, k: string) => {
    const f = st.fields[k];
    return Boolean(
      f &&
        f.kind === "VALUE" &&
        (f.provenance === "EXPLICIT_BROWSE" || f.provenance === "EXPLICIT_TEXT"),
    );
  };
  const val = (st: CanonicalRequestState, k: string) =>
    String(st.fields[k]?.value ?? "");

  function fullyAnswered() {
    let st = syncFromText(
      null,
      "İstanbul Kadıköy'de buzdolabı arıyorum, bütçem 25.000 TL civarı.",
    ).state;
    for (const [key, value] of [
      ["city", "İstanbul"],
      ["budget", "25.000 TL"],
      ["brand", "Bosch"],
      ["fridgeType", "No-Frost"],
    ] as const) {
      st = syncFromBrowse(st, { key, value, isAny: false }).state;
    }
    return st;
  }

  /* ---- yalnız ürün değişir: ortak cevaplar kalır, ürüne özel olanlar düşer ---- */
  {
    const base = fullyAnswered();
    gate(
      "T7x0-taban-dolu",
      carried(base, "city") &&
        carried(base, "budget") &&
        carried(base, "brand") &&
        carried(base, "fridgeType"),
      JSON.stringify({
        city: base.fields.city ?? null,
        budget: base.fields.budget ?? null,
        brand: base.fields.brand ?? null,
        fridgeType: base.fields.fridgeType ?? null,
      }),
    );

    const tv = syncFromText(base, "Televizyon arıyorum").state;
    gate("T7x1-konum-korunur", carried(tv, "city"), val(tv, "city"));
    gate("T7x2-butce-korunur", carried(tv, "budget"), val(tv, "budget"));
    gate(
      "T7x3-fridgeType-duser",
      !carried(tv, "fridgeType"),
      JSON.stringify(tv.fields.fridgeType ?? null),
    );
    /**
     * ASIL KARŞI ÖRNEK: `brand` her iki soru profilinde de vardır. Profil
     * kesişimini ortaklık sayan bir kural buzdolabı markasını televizyona
     * taşır — bu kabul edilemez.
     */
    gate(
      "T7x4-marka-tasinmaz",
      !carried(tv, "brand"),
      `brand=${val(tv, "brand")} — profil kesişimi ortaklık kanıtı sayılmış`,
    );
    gate(
      "T7x5-model-ve-urun-ozelligi-tasinmaz",
      !carried(tv, "model") && !carried(tv, "applianceType"),
      JSON.stringify({
        model: tv.fields.model ?? null,
        applianceType: tv.fields.applianceType ?? null,
      }),
    );
  }

  /* ---- yeni metin açıkça yeni değerler veriyorsa onlar kazanır ---- */
  {
    const base = fullyAnswered();
    const next = syncFromText(
      base,
      "Samsung televizyon arıyorum, Ankara'da, bütçem 40.000 TL",
    ).state;
    gate(
      "T7x6-yeni-marka-kazanir",
      /samsung/i.test(val(next, "brand")),
      `brand=${val(next, "brand")}`,
    );
    const city =
      val(next, "city") || String(next.understanding.location?.city?.value ?? "");
    gate("T7x7-yeni-sehir-kazanir", /ankara/i.test(city), `city=${city}`);
    const budget =
      val(next, "budget") || String(next.understanding.budget?.value?.max ?? "");
    gate("T7x8-yeni-butce-kazanir", /40/.test(budget), `budget=${budget}`);
    gate(
      "T7x9-eski-degerler-geri-gelmez",
      !/bosch/i.test(val(next, "brand")) &&
        !/istanbul/i.test(city) &&
        !/25/.test(budget),
      JSON.stringify({ brand: val(next, "brand"), city, budget }),
    );
  }
}

/* ================================================================== *
 * T9m — BÜTÇE PARA İŞARETİ KAPISI (kurucu, 2026-08-29).
 *
 * Desteklenen her yazım biçimi kanonik cevap üretmeli ve yayın kapısını
 * karşılamalı; para anlamı taşımayan sayı/aralık hiçbirini yapmamalı.
 * Kapı yeni bir bütçe grameri kurmaz — mevcut ayrıştırıcının desteklediğini
 * ölçer.
 * ================================================================== */
{
  const POSITIVE = [
    "Buzdolabı arıyorum, bütçem 15.000 TL",
    "Buzdolabı arıyorum, bütçem 15000 TL",
    "Buzdolabı arıyorum, 15 bin TL bütçem var",
    "Buzdolabı arıyorum, 15.000 lira civarı",
    "Buzdolabı arıyorum, ₺15.000",
  ];
  const NEGATIVE = [
    "Oto koltuğu 9-36 kg",
    "55 inç televizyon",
    "2 adet sandalye",
    "120x60 cm masa",
  ];

  function budgetOf(text: string) {
    const st = syncFromText(null, text).state;
    const f = st.fields.budget;
    const satisfied = f
      ? isFieldSatisfied({
          fieldKey: "budget",
          importance: "publish_required",
          allowUnknown: false,
          allowDontCare: false,
          state: {
            kind: f.kind,
            value: f.value ?? null,
            provenance: f.provenance ?? null,
          },
        })
      : false;
    return { state: st, field: f, satisfied };
  }

  for (const text of POSITIVE) {
    const { state, field, satisfied } = budgetOf(text);
    const id = `T9m+:${text.slice(24, 48)}`;
    gate(
      `${id}/kanonik`,
      field?.kind === "VALUE" && Boolean(field?.value),
      JSON.stringify(field ?? null),
    );
    gate(
      `${id}/explicit-text`,
      field?.provenance === "EXPLICIT_TEXT",
      String(field?.provenance),
    );
    gate(
      `${id}/user-explicit`,
      state.understanding.budget?.source === "USER_EXPLICIT" ||
        state.understanding.budget?.provenance === "EXPLICIT",
      JSON.stringify(state.understanding.budget ?? null),
    );
    gate(`${id}/readiness`, satisfied, "yayın kapısı karşılanmadı");
    gate(
      `${id}/soru-sorulmaz`,
      !scheduleFor(state).visible.includes("budget"),
      JSON.stringify(scheduleFor(state).visible),
    );
  }

  for (const text of NEGATIVE) {
    const { state, field, satisfied } = budgetOf(text);
    const id = `T9m-:${text.slice(0, 22)}`;
    gate(
      `${id}/kanonik-yok`,
      !field || field.kind === "UNKNOWN",
      JSON.stringify(field ?? null),
    );
    gate(`${id}/readiness-acilmaz`, !satisfied, "para olmayan sayı yayın kapısını açtı");
  }

  /* Mutasyon kontrolü: para işareti taşımayan metin kapıyı geçerse kırmızı. */
  mutationControl(
    "T9m-mutasyon",
    !budgetOf("Oto koltuğu 9-36 kg").field,
  );
}

console.log(`\nPROBLEMS=${PROBLEMS.length}`);
for (const p of PROBLEMS) console.log("  - " + p);
console.log("\n===== HUKUM =====");
console.log(`kapi=${CHECKS} sorun=${PROBLEMS.length}`);
console.log(PROBLEMS.length === 0 ? "SONUC=GECTI" : "SONUC=KALDI");
process.exit(PROBLEMS.length === 0 ? 0 : 1);
