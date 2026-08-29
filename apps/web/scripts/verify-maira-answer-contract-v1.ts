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
import { listAllProfiles } from "../src/lib/request-composer/v2/question-profiles";
import type { QuestionProfileDef } from "../src/lib/request-composer/v2/question-profile-types";
import { resolveQuestionControl } from "../src/lib/request-composer/v2/question-control-registry";
import { readFileSync } from "node:fs";
import { mergeAnswersIntoUnderstoodFacts } from "../src/app/talep/ui-helpers";
import type { UserAnswerRow } from "../src/lib/request-composer/v2/answer-apply-plan";
import {
  planAnswerApplication,
  projectUserAnswers,
} from "../src/lib/request-composer/v2/answer-apply-plan";
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
    const { field, satisfied } = budgetOf(text);
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

/* ================================================================== *
 * P — KANONİK PROFİL SEÇENEKLERİ KONTROL YÜZEYİNE ULAŞIR.
 *
 * Ölçüldü (2026-08-29): 37 profil alanı `quickChoices` taşıyor, 34'ünde
 * seçenekler `FocusedQuestion.control.options` yüzeyine hiç ulaşmıyor ve
 * soru serbest metin kutusu olarak çiziliyor. Kayıp noktası
 * `scheduledToFocusedQuestion` içinde `resolveQuestionControl` çağrısının
 * profil seçeneklerini taşımaması.
 *
 * SÖZLEŞME: seçenekler görünür olur AMA cevap evreni kapanmaz —
 * `quickChoices` kapalı enum değildir (profil kaydında bunu söyleyen bir
 * metadata yok), bu yüzden serbest cevap yolu korunur.
 * ================================================================== */
{
  const profilesWithChoices = (listAllProfiles() as QuestionProfileDef[]).filter(
    (d) => (d.quickChoices?.length ?? 0) > 0,
  );

  function controlFor(def: QuestionProfileDef) {
    const cat = (def.categories ?? ["technology"])[0]!;
    return resolveQuestionControl({
      categoryId: cat,
      fieldKey: def.fieldKey,
      importance: def.importance,
      allowUnknown: Boolean(def.allowUnknown),
      allowDontCare: Boolean(def.allowDontCare),
      isRealEstate: cat === "real-estate",
      productType: (def.whenProductTypes ?? [])[0] ?? null,
      needType: (def.whenNeedTypes ?? [])[0] ?? null,
      profileChoices: def.quickChoices,
    });
  }

  /** Kaydın kendi özel dalından gelen kontroller — profil yolu bunlara dokunmaz. */
  const SPECIAL = new Set([
    "money_range",
    "location_picker",
    "date_or_deadline",
    "searchable_entity",
    "dimensions",
    "number_presets",
    "multi_choice",
    "yes_no",
  ]);

  gate(
    "P0-profil-alani-sayisi",
    profilesWithChoices.length === 37,
    `quickChoices taşıyan alan sayısı ${profilesWithChoices.length} (beklenen 37)`,
  );

  let lost = 0;
  let profileSourced = 0;
  const dist: Record<string, number> = {};
  for (const def of profilesWithChoices) {
    const cat = (def.categories ?? ["technology"])[0]!;
    const id = `${cat}/${def.fieldKey}`;
    const ctrl = controlFor(def);
    dist[ctrl.controlType] = (dist[ctrl.controlType] ?? 0) + 1;

    if (SPECIAL.has(ctrl.controlType)) continue; // özel kontrol korunur
    if (def.fieldKey === "condition") continue; // kayıt kararı, P5'te ayrıca ölçülür
    profileSourced += 1;

    if (ctrl.options.length === 0) {
      lost += 1;
      gate(`P1:${id}/secenek-ulasti`, false, "profil seçenekleri kontrol yüzeyine ulaşmadı");
      continue;
    }
    gate(
      `P1:${id}/secenek-sayisi`,
      ctrl.options.length === def.quickChoices!.length,
      `${ctrl.options.length} ≠ profil ${def.quickChoices!.length}`,
    );
    gate(
      `P2:${id}/sira-ve-etiket`,
      ctrl.options.map((o) => o.label).join("|") ===
        def.quickChoices!.map((o) => o.label).join("|"),
      JSON.stringify(ctrl.options.map((o) => o.label)),
    );
    gate(
      `P2b:${id}/deger-ayrimi`,
      ctrl.options.every(
        (o, i) => o.value === def.quickChoices![i]!.value && Boolean(o.label),
      ),
      "etiket ile gönderilecek değer karıştı",
    );
    gate(
      `P3:${id}/duplicate-yok`,
      new Set(ctrl.options.map((o) => o.value)).size === ctrl.options.length,
      JSON.stringify(ctrl.options.map((o) => o.value)),
    );
    gate(
      `P4:${id}/serbest-cevap-korunur`,
      ctrl.allowCustom === true ||
        [...ctrl.options, ...ctrl.softOptions].some((o) => o.opensCustom),
      "listede olmayan cevabı yazma yolu kapandı",
    );
    gate(
      `P5:${id}/kacis-hardcoded-degil`,
      !ctrl.options.some((o) => /^fark\s*etmez$/i.test(o.label) || o.soft),
      "kaçış cevabı profil seçeneklerine karıştı",
    );
  }
  gate("P1-toplam-kayip", lost === 0, `${lost} alanda seçenek kaybı sürüyor`);
  gate(
    "P6-profil-kaynakli-kontrol-sayisi",
    profileSourced === 34,
    `profil kaynaklı kontrol ${profileSourced} (beklenen 34)`,
  );
  gate(
    "P7-drift-single-choice",
    (dist.single_choice ?? 0) === 35,
    `single_choice ${dist.single_choice ?? 0} (beklenen 35 = 34 profil + machinery/condition)`,
  );
  gate(
    "P7b-drift-text-fallback",
    (dist.text_fallback ?? 0) === 0,
    `text_fallback ${dist.text_fallback ?? 0} (beklenen 0)`,
  );

  /* --- P8: machinery/condition kilidi bu dilimde KORUNUR --- */
  {
    const cond = profilesWithChoices.find(
      (d) => d.fieldKey === "condition" && (d.categories ?? []).includes("machinery"),
    );
    gate("P8a-condition-profili-var", Boolean(cond));
    if (cond) {
      const c = controlFor(cond);
      gate("P8b-condition-single-choice", c.controlType === "single_choice", c.controlType);
      gate(
        "P8c-condition-kilidi-korunur",
        c.allowCustom === false,
        "kayıt kararı profil düzeltmesiyle değişti",
      );
    }
  }

  /* --- P9: özel kontroller değişmez --- */
  {
    const expect: Array<[string, string, string]> = [
      ["appliances", "budget", "money_range"],
      ["appliances", "city", "location_picker"],
      ["appliances", "delivery", "date_or_deadline"],
      ["technology", "brand", "searchable_entity"],
      ["printing", "printSize", "dimensions"],
      ["printing", "quantity", "number_presets"],
    ];
    for (const [cat, key, type] of expect) {
      const c = resolveQuestionControl({
        categoryId: cat,
        fieldKey: key,
        importance: "quote_critical",
        allowUnknown: true,
        allowDontCare: true,
        isRealEstate: false,
      });
      gate(`P9:${cat}/${key}`, c.controlType === type, `${c.controlType} ≠ ${type}`);
    }
  }

  /* --- P10: seçeneksiz gerçek soru text_fallback kalır --- */
  {
    const c = resolveQuestionControl({
      categoryId: "appliances",
      fieldKey: "notes",
      importance: "optional",
      allowUnknown: true,
      allowDontCare: true,
    });
    gate("P10-secenekssiz-soru-text-kalir", c.controlType === "text_fallback", c.controlType);
  }

  /* --- P11: fridgeType uçtan uca --- */
  {
    const st = syncFromText(null, "Buzdolabı arıyorum").state;
    const sch = scheduleFor(st);
    const q = sch.result.visible.find((v) => v.fieldKey === "fridgeType");
    gate("P11a-fridgeType-soruluyor", Boolean(q), JSON.stringify(sch.visible));
    if (q) {
      const f = scheduledToFocusedQuestion(q, undefined, { productType: "Buzdolabı" });
      gate(
        "P11b-dort-secenek-gorunur",
        (f.control?.options ?? []).map((o) => o.label).join("|") ===
          "No-Frost|Alttan donduruculu|Gardrop tipi|Mini",
        JSON.stringify((f.control?.options ?? []).map((o) => o.label)),
      );
      gate("P11c-serbest-cevap-var", f.control?.allowCustom === true, "serbest cevap yolu yok");
    }
    /* Seçim kanonik alana gider ve soru tekrar sorulmaz. */
    const answered = syncFromBrowse(st, {
      key: "fridgeType",
      value: "No-Frost",
      isAny: false,
    }).state;
    gate(
      "P11d-secim-kanonik-alana-gider",
      answered.fields.fridgeType?.kind === "VALUE" &&
        String(answered.fields.fridgeType?.value) === "No-Frost" &&
        answered.fields.fridgeType?.provenance === "EXPLICIT_BROWSE",
      JSON.stringify(answered.fields.fridgeType ?? null),
    );
    gate(
      "P11e-tekrar-sorulmaz",
      !scheduleFor(answered).visible.includes("fridgeType"),
      JSON.stringify(scheduleFor(answered).visible),
    );
    /* Listede olmayan geçerli değer aynı yoldan yazılabilir. */
    const custom = syncFromBrowse(st, {
      key: "fridgeType",
      value: "Yan yana çift kapılı",
      isAny: false,
    }).state;
    gate(
      "P11f-liste-disi-deger-yazilabilir",
      custom.fields.fridgeType?.kind === "VALUE" &&
        String(custom.fields.fridgeType?.value) === "Yan yana çift kapılı",
      JSON.stringify(custom.fields.fridgeType ?? null),
    );
  }

  /* --- P12: televizyon sorusu buzdolabı seçeneği almaz --- */
  {
    const tv = syncFromText(null, "Televizyon arıyorum").state;
    const surface = scheduleFor(tv).result.visible.flatMap((v) => {
      const f = scheduledToFocusedQuestion(v, undefined, { productType: "televizyon" });
      return (f.control?.options ?? []).map((o) => o.label);
    });
    gate(
      "P12-buzdolabi-secenegi-sizmaz",
      !surface.some((l) => /no-?frost|donduruculu|gardrop/i.test(l)),
      JSON.stringify(surface),
    );
  }

  /* --- P13: listede olmayan serbest cevap örnekleri --- */
  {
    const samples: Array<[string, string]> = [
      ["brand", "Sony"],
      ["screenSize", "65 inç"],
      ["seatingType", "Modüler köşe koltuk"],
    ];
    const base = syncFromText(null, "Televizyon arıyorum").state;
    for (const [key, value] of samples) {
      const st = syncFromBrowse(base, { key, value, isAny: false }).state;
      gate(
        `P13:${key}/serbest-deger`,
        st.fields[key]?.kind === "VALUE" &&
          String(st.fields[key]?.value) === value &&
          st.fields[key]?.provenance === "EXPLICIT_BROWSE",
        JSON.stringify(st.fields[key] ?? null),
      );
    }
  }

  mutationControl(
    "P-mutasyon",
    resolveQuestionControl({
      categoryId: "appliances",
      fieldKey: "fridgeType",
      importance: "quote_critical",
      allowUnknown: false,
      allowDontCare: true,
    }).options.length === 0,
  );
}

/* ================================================================== *
 * V — MAIRA ↔ STANDART GÖRÜNÜM GEÇİŞ SÖZLEŞMESİ.
 *
 * Kapılar DAVRANIŞSALDIR: kaynak metni taramaz, gerçek üretim yollarını
 * çalıştırır. Aşağıdaki koşum, sayfanın state kaplarını birebir taklit eder
 * ve cevabı `planAnswerApplication` → `syncFromBrowse` yolundan uygular —
 * yani üretimde iki görünümün de kullanacağı yol.
 *
 * ÖLÇÜM SINIRI: bu kapılar kod düzeyinde ölçer (CODE-VERIFIED). Tarayıcıda
 * gerçek tıklama ile geçiş davranışı bu koşumda ÖLÇÜLMEZ (NOT-MEASURED) ve
 * öyle raporlanır.
 * ================================================================== */
{
  type Harness = {
    canonical: CanonicalRequestState;
    common: Record<string, string>;
    touchedCommon: string[];
    dynamic: Record<string, string>;
    answered: string[];
    confirmed: string[];
    stage: "compose" | "clarify" | "review";
  };

  const STAGE_RANK = { compose: 0, clarify: 1, review: 2 } as const;

  function harnessFromText(text: string): Harness {
    return {
      canonical: syncFromText(null, text).state,
      common: {},
      touchedCommon: [],
      dynamic: {},
      answered: [],
      confirmed: [],
      stage: "clarify",
    };
  }

  /** Planı uygular — sayfanın yaptığı işin aynısı, React'siz. */
  function applyPlan(h: Harness, fieldKey: string, rawValue: string): Harness {
    const plan = planAnswerApplication({
      fieldKey,
      rawValue,
      currentText: String(h.canonical.understanding.rawInput ?? ""),
    });
    const next: Harness = {
      ...h,
      common: { ...h.common },
      dynamic: { ...h.dynamic },
      touchedCommon: [...h.touchedCommon],
    };
    for (const e of plan.effects) {
      if (e.kind === "canonical") {
        next.canonical = syncFromBrowse(next.canonical, {
          key: e.fieldKey,
          value: e.value,
          isAny: e.isAny,
          kind: e.valueKind,
        }).state;
      } else if (e.kind === "common") {
        next.common[e.fieldKey] = e.value;
        if (!next.touchedCommon.includes(e.fieldKey)) {
          next.touchedCommon.push(e.fieldKey);
        }
      } else if (e.kind === "dynamic") {
        next.dynamic[e.fieldKey] = e.value;
      } else if (e.kind === "cityFilter") {
        next.common.city = e.value;
        if (!next.touchedCommon.includes("city")) next.touchedCommon.push("city");
      }
    }
    if (plan.noop === null) {
      if (!next.answered.includes(plan.fieldKey)) next.answered.push(plan.fieldKey);
      if (!next.confirmed.includes(plan.fieldKey)) next.confirmed.push(plan.fieldKey);
    }
    return next;
  }

  /** İki görünümün de okuduğu tek soru türetimi. */
  function questionKeys(h: Harness): string[] {
    return scheduleFor(h.canonical, { answeredKeys: h.answered }).visible;
  }

  /** İki görünümün de okuduğu tek cevap türetimi. */
  function answerRows(h: Harness) {
    return projectUserAnswers({
      fields: h.canonical.fields,
      commonDraft: h.common,
      touchedCommonKeys: h.touchedCommon,
      categoryId: h.canonical.categoryId,
      rawInput: String(h.canonical.understanding.rawInput ?? ""),
      /* Üretimdeki sayfa ile aynı: metinde açıkça yazılan konum taşınır. */
      explicitCommon: (() => {
        const c = h.canonical.understanding.location?.city;
        return c?.value && (c.source === "USER_EXPLICIT" || c.provenance === "EXPLICIT")
          ? { city: String(c.value) }
          : {};
      })(),
    });
  }

  const rowFor = (h: Harness, key: string) =>
    answerRows(h).find((r) => r.fieldKey === key) ?? null;

  /* ---- V1: Maira'da verilen cevap standart yüzeyde görünür ---- */
  {
    const base = harnessFromText("Buzdolabı arıyorum");
    const after = applyPlan(base, "fridgeType", "No-Frost");
    gate(
      "V1a-cevap-kanonik-duruma-yazildi",
      after.canonical.fields.fridgeType?.kind === "VALUE" &&
        String(after.canonical.fields.fridgeType?.value) === "No-Frost",
      JSON.stringify(after.canonical.fields.fridgeType ?? null),
    );
    gate(
      "V1b-standart-kontrolde-dolu",
      rowFor(after, "fridgeType")?.displayValue === "No-Frost",
      JSON.stringify(rowFor(after, "fridgeType")),
    );
    gate(
      "V1c-soru-listeden-dustu",
      !questionKeys(after).includes("fridgeType"),
      JSON.stringify(questionKeys(after)),
    );
    mutationControl("V1-mutasyon", rowFor(base, "fridgeType") === null);
  }

  /* ---- V2: standartta verilen cevap Maira'ya dönünce tekrar sorulmaz ---- */
  {
    const h = applyPlan(harnessFromText("Buzdolabı arıyorum"), "delivery", "1 hafta içinde");
    /* Görünüm değişimi state'e dokunmaz: aynı koşum, aynı türetim. */
    const maira = questionKeys(h);
    const standart = questionKeys(h);
    gate("V2a-iki-gorunum-ayni-soru-listesi", maira.join("|") === standart.join("|"));
    gate("V2b-tekrar-sorulmaz", !maira.includes("delivery"), JSON.stringify(maira));
    gate("V2c-yanitlarimda-var", rowFor(h, "delivery") !== null, JSON.stringify(answerRows(h)));
  }

  /* ---- V3: Yanıtlarım'dan değiştirilen cevap iki yüzeyde tek güncel değer ---- */
  {
    let h = applyPlan(harnessFromText("Buzdolabı arıyorum"), "fridgeType", "No-Frost");
    const before = answerRows(h).length;
    h = applyPlan(h, "fridgeType", "Mini");
    const rows = answerRows(h).filter((r) => r.fieldKey === "fridgeType");
    gate("V3a-tek-satir", rows.length === 1, JSON.stringify(rows));
    gate("V3b-guncel-deger", rows[0]?.displayValue === "Mini", JSON.stringify(rows[0]));
    gate("V3c-satir-cogalmadi", answerRows(h).length === before, `${answerRows(h).length} ≠ ${before}`);
    gate(
      "V3d-kanonik-de-guncel",
      String(h.canonical.fields.fridgeType?.value) === "Mini",
      JSON.stringify(h.canonical.fields.fridgeType ?? null),
    );
  }

  /* ---- V4: üç kez görünüm değişimi çoğaltmaz, aşamayı geriletmez ---- */
  {
    let h = applyPlan(harnessFromText("Buzdolabı arıyorum"), "fridgeType", "No-Frost");
    h = applyPlan(h, "delivery", "1 hafta içinde");
    const snapshot = {
      answered: [...h.answered],
      confirmed: [...h.confirmed],
      rows: answerRows(h).length,
      stage: h.stage,
      questions: questionKeys(h).join("|"),
    };
    for (let i = 0; i < 3; i++) {
      /* Görünüm değişimi: state kabına DOKUNMAZ. */
      h = { ...h };
    }
    gate("V4a-answered-cogalmadi", h.answered.length === snapshot.answered.length &&
      new Set(h.answered).size === h.answered.length, JSON.stringify(h.answered));
    gate("V4b-confirmed-cogalmadi", h.confirmed.length === snapshot.confirmed.length &&
      new Set(h.confirmed).size === h.confirmed.length, JSON.stringify(h.confirmed));
    gate("V4c-cevap-kaybi-yok", answerRows(h).length === snapshot.rows,
      `${answerRows(h).length} ≠ ${snapshot.rows}`);
    gate("V4d-asama-gerilemedi", STAGE_RANK[h.stage] >= STAGE_RANK[snapshot.stage]);
    gate("V4e-soru-listesi-ayni", questionKeys(h).join("|") === snapshot.questions);
  }

  /* ---- V5: kategori değişince ortak korunur, kategoriye özel düşer ---- */
  {
    let h = harnessFromText("İstanbul'da buzdolabı arıyorum, bütçem 25.000 TL");
    h = applyPlan(h, "city", "İstanbul");
    h = applyPlan(h, "budget", "25.000 TL");
    h = applyPlan(h, "fridgeType", "No-Frost");
    const switched: Harness = {
      ...h,
      canonical: syncFromText(h.canonical, "Televizyon arıyorum").state,
    };
    gate(
      "V5a-ortak-korunur",
      switched.canonical.fields.city?.kind === "VALUE" &&
        switched.canonical.fields.budget?.kind === "VALUE",
      JSON.stringify({
        city: switched.canonical.fields.city ?? null,
        budget: switched.canonical.fields.budget ?? null,
      }),
    );
    gate(
      "V5b-kategoriye-ozel-duser",
      !switched.canonical.fields.fridgeType,
      JSON.stringify(switched.canonical.fields.fridgeType ?? null),
    );
    gate(
      "V5c-yanitlarimda-gorunmez",
      rowFor(switched, "fridgeType") === null,
      JSON.stringify(answerRows(switched)),
    );
  }

  /* ---- V6: ANY / serbest metin / hazır seçenek cevapları kaybolmaz ---- */
  {
    let h = harnessFromText("Buzdolabı arıyorum");
    h = applyPlan(h, "fridgeType", "No-Frost");            // hazır seçenek
    h = applyPlan(h, "brand", "Sony");                      // serbest metin
    h = applyPlan(h, "usageArea", "no_preference");         // ANY
    h = applyPlan(h, "capacityKg", "unknown");              // UNKNOWN
    for (const key of ["fridgeType", "brand", "usageArea", "capacityKg"]) {
      gate(
        `V6:${key}/yanitlarimda-var`,
        rowFor(h, key) !== null,
        JSON.stringify(answerRows(h).map((r) => r.fieldKey)),
      );
    }
    gate(
      "V6-fark-etmez-etiketi",
      /fark etmez/i.test(String(rowFor(h, "usageArea")?.displayValue ?? "")),
      JSON.stringify(rowFor(h, "usageArea")),
    );
  }

  /* ---- V7: televizyon talebinde buzdolabı sorusu/seçeneği yok ---- */
  {
    const h = harnessFromText("Televizyon arıyorum");
    const keys = questionKeys(h);
    const labels = scheduleFor(h.canonical, { answeredKeys: [] }).result.visible.flatMap(
      (q) => {
        const f = scheduledToFocusedQuestion(q, undefined, { productType: "televizyon" });
        return [f.label, ...(f.control?.options ?? []).map((o) => o.label)];
      },
    );
    const FRIDGE = /fridge|buzdolab|no-?frost|donduruculu|gardrop/i;
    gate("V7a-soru-yok", !keys.some((k) => FRIDGE.test(k)), JSON.stringify(keys));
    gate("V7b-secenek-yok", !labels.some((l) => FRIDGE.test(l)), JSON.stringify(labels));
    gate(
      "V7c-yanitlarimda-yok",
      !answerRows(h).some((r) => FRIDGE.test(r.fieldKey) || FRIDGE.test(r.displayValue)),
      JSON.stringify(answerRows(h)),
    );
  }


  /* ---- V9: tarayıcı turunda görülen üç kusur (2026-08-30) ---- */
  {
    const h = harnessFromText(
      "İstanbul Kadıköy'de no-frost buzdolabı arıyorum, bütçem 25.000 TL",
    );
    const rows = answerRows(h);

    /* V9a — iç anahtar kullanıcıya gösterilmez. */
    const rawKeyRows = rows.filter((r) => r.label === r.fieldKey);
    gate(
      "V9a-ic-anahtar-gosterilmez",
      rawKeyRows.length === 0,
      JSON.stringify(rawKeyRows.map((r) => r.fieldKey)),
    );

    /* V9b — aynı etiket+değer iki satırda görünmez. */
    const pairs = rows.map((r) => `${r.label}=${r.displayValue}`);
    gate(
      "V9b-yinelenen-satir-yok",
      new Set(pairs).size === pairs.length,
      JSON.stringify(pairs),
    );

    /* V9c — metinde açıkça yazılan konum listede görünür. */
    gate(
      "V9c-acik-konum-gorunur",
      rows.some((r) => /kadıköy|istanbul/i.test(r.displayValue)),
      JSON.stringify(rows.map((r) => `${r.label}=${r.displayValue}`)),
    );
  }


  /* ---- V10: cevaplanmış bir satır DÜZENLENEBİLİR olmalı (2026-08-30) ---- *
   * Tarayıcı turunda ölçüldü: "Yanıtlarım"da bir satıra dokunmak soruyu
   * yeniden açmıyordu — kanonik değer soruyu KAPALI tuttuğu için zamanlayıcı
   * onu bir daha yayınlamıyor. Düzenleme bu yüzden zamanlayıcıdan değil,
   * kontrol kaydından beslenmelidir: aynı kanonik seçenekler ve aynı serbest
   * cevap yolu. Maira kendi seçeneğini üretmez.                              */
  {
    const h = applyPlan(
      harnessFromText("Buzdolabı arıyorum"),
      "fridgeType",
      "No-Frost",
    );
    const row = rowFor(h, "fridgeType");
    gate("V10a-cevap-satiri-var", row !== null, JSON.stringify(answerRows(h)));

    /* Düzenleme yüzeyi kanonik kontrol kaydından gelir. */
    const editControl = resolveQuestionControl({
      categoryId: h.canonical.categoryId ?? "appliances",
      fieldKey: "fridgeType",
      importance: "quote_critical",
      allowUnknown: false,
      allowDontCare: true,
      productType: "Buzdolabı",
      profileChoices: listAllProfiles().find((d) => d.fieldKey === "fridgeType")
        ?.quickChoices,
    });
    gate(
      "V10b-duzenleme-secenekleri-kanonik",
      editControl.options.map((o) => o.label).join("|") ===
        "No-Frost|Alttan donduruculu|Gardrop tipi|Mini",
      JSON.stringify(editControl.options.map((o) => o.label)),
    );
    gate(
      "V10c-duzenlemede-serbest-cevap",
      editControl.allowCustom === true,
      "düzenlemede listede olmayan cevap yazılamıyor",
    );

    /* Yeni değer eskisinin YERİNE geçer. */
    const edited = applyPlan(h, "fridgeType", "Mini");
    const rows = answerRows(edited).filter((r) => r.fieldKey === "fridgeType");
    gate("V10d-tek-guncel-deger", rows.length === 1 && rows[0]?.displayValue === "Mini",
      JSON.stringify(rows));

    /* Maira bileşeni kendi kontrol çözücüsünü kurmaz; props ile alır. */
    let src = "";
    try {
      src = readFileSync("src/components/request/maira/MairaAnswers.tsx", "utf8");
    } catch {
      src = "";
    }
    gate(
      "V10e-maira-kendi-cozucusunu-kurmaz",
      src.length > 0 && !/resolveQuestionControl|question-control-registry/.test(src),
      "MairaAnswers kendi kontrol otoritesini kuruyor",
    );
    gate(
      "V10f-duzenleme-yuzeyi-props-ile",
      /editControl/.test(src),
      "MairaAnswers düzenleme kontrolünü props ile almıyor",
    );
  }


  /* ================================================================== *
   * W — KANONİK CEVAPLAR STANDART "ANLADIKLARIMIZ" PANOSUNDA GÖRÜNÜR.
   *
   * Tarayıcı turunda ölçüldü (2026-08-30): Maira'da verilen `delivery` ve
   * düzeltilen `fridgeType` standart görünümde hiçbir yerde görünmüyordu;
   * pano yalnız anlama katmanı olgularını basıyor. Birleştirme KÖR DEĞİLDİR:
   * aynı alan tek satır üretir ve kanonik cevap eski olguyu yener.
   * ================================================================== */
  {
    const fact = (key: string, label: string, displayValue: string) => ({
      key,
      label,
      displayValue,
      tone: "medium" as const,
      trustLabel: "",
    });

    /* W1 — cevap panoda görünür. */
    {
      const merged = mergeAnswersIntoUnderstoodFacts({
        facts: [fact("productType", "Ürün", "Buzdolabı")],
        answers: [
          {
            fieldKey: "fridgeType",
            label: "Buzdolabı tipi",
            displayValue: "Mini",
            mode: "VALUE",
            source: "canonical",
          },
        ],
      });
      gate(
        "W1-cevap-panoda-gorunur",
        merged.some((f) => f.key === "fridgeType" && f.displayValue === "Mini"),
        JSON.stringify(merged.map((f) => `${f.label}=${f.displayValue}`)),
      );
      gate(
        "W1b-mevcut-olgu-korunur",
        merged.some((f) => f.key === "productType"),
        "anlama olgusu kayboldu",
      );
    }

    /* W2 — aynı alanda kanonik cevap eski olguyu yener, eski değer kalmaz. */
    {
      const merged = mergeAnswersIntoUnderstoodFacts({
        facts: [fact("fridgeType", "Buzdolabı tipi", "No-Frost")],
        answers: [
          {
            fieldKey: "fridgeType",
            label: "Buzdolabı tipi",
            displayValue: "Mini",
            mode: "VALUE",
            source: "canonical",
          },
        ],
      });
      const rows = merged.filter((f) => f.key === "fridgeType");
      gate("W2a-tek-satir", rows.length === 1, JSON.stringify(rows));
      gate("W2b-kanonik-kazanir", rows[0]?.displayValue === "Mini", JSON.stringify(rows[0]));
      gate(
        "W2c-eski-deger-kalmaz",
        !merged.some((f) => f.displayValue === "No-Frost"),
        JSON.stringify(merged.map((f) => f.displayValue)),
      );
    }

    /* W3 — aynı etiket+değer iki kez görünmez (kör birleştirme yok). */
    {
      const merged = mergeAnswersIntoUnderstoodFacts({
        facts: [fact("productType", "Ürün", "Buzdolabı")],
        answers: [
          {
            fieldKey: "applianceType",
            label: "Ürün",
            displayValue: "Buzdolabı",
            mode: "VALUE",
            source: "canonical",
          },
        ],
      });
      const pairs = merged.map((f) => `${f.label}=${f.displayValue}`);
      gate("W3-yinelenme-yok", new Set(pairs).size === pairs.length, JSON.stringify(pairs));
    }

    /* W4 — sözleşmede sayılan cevap türlerinin hepsi panoda. */
    {
      const answers: UserAnswerRow[] = [
        { fieldKey: "fridgeType", label: "Buzdolabı tipi", displayValue: "Mini", mode: "VALUE", source: "canonical" },
        { fieldKey: "delivery", label: "Zaman", displayValue: "1 hafta içinde", mode: "VALUE", source: "canonical" },
        { fieldKey: "brand", label: "Marka", displayValue: "Bosch", mode: "VALUE", source: "canonical" },
        { fieldKey: "budget", label: "Bütçe", displayValue: "32.500 TL", mode: "VALUE", source: "canonical" },
        { fieldKey: "city", label: "Şehir", displayValue: "İstanbul / Kadıköy", mode: "VALUE", source: "draft" },
        { fieldKey: "model", label: "Model", displayValue: "Serbest yazılmış değer", mode: "VALUE", source: "canonical" },
        { fieldKey: "condition", label: "Durum", displayValue: "Fark etmez", mode: "ANY", source: "canonical" },
      ];
      const merged = mergeAnswersIntoUnderstoodFacts({ facts: [], answers });
      for (const a of answers) {
        gate(
          `W4:${a.fieldKey}/panoda`,
          merged.some((f) => f.key === a.fieldKey && f.displayValue === a.displayValue),
          JSON.stringify(merged.map((f) => f.key)),
        );
      }
    }

    /* W5 — kategori değişince kategoriye özel cevap panodan da düşer. */
    {
      let h = harnessFromText("İstanbul'da buzdolabı arıyorum, bütçem 25.000 TL");
      h = applyPlan(h, "city", "İstanbul");
      h = applyPlan(h, "budget", "25.000 TL");
      h = applyPlan(h, "fridgeType", "Mini");
      const switched: typeof h = {
        ...h,
        canonical: syncFromText(h.canonical, "Televizyon arıyorum").state,
      };
      const merged = mergeAnswersIntoUnderstoodFacts({
        facts: [],
        answers: answerRows(switched),
      });
      gate(
        "W5a-buzdolabi-satiri-duser",
        !merged.some((f) => /Mini|No-Frost|Buzdolabı tipi/.test(`${f.label}${f.displayValue}`)),
        JSON.stringify(merged.map((f) => `${f.label}=${f.displayValue}`)),
      );
      gate(
        "W5b-sehir-ve-butce-kalir",
        merged.some((f) => f.key === "city") && merged.some((f) => f.key === "budget"),
        JSON.stringify(merged.map((f) => f.key)),
      );
    }
  }

  /* ---- V8: Maira kaynağında hardcoded soru/seçenek yok (kaynak kapısı) ---- */
  {
    const dir = "src/components/request/maira";
    const files = ["MairaStage.tsx", "MairaAnswers.tsx"];
    for (const file of files) {
      const path = `${dir}/${file}`;
      let src = "";
      try {
        src = readFileSync(path, "utf8");
      } catch {
        gate(`V8:${file}/mevcut`, false, "dosya yok");
        continue;
      }
      gate(`V8:${file}/mevcut`, true);
      gate(
        `V8:${file}/urun-sorusu-yok`,
        !/buzdolab|no-?frost|statik|televizyon|ekran boyut/i.test(src),
        "kaynakta ürün sorusu/seçeneği geçiyor",
      );
      gate(
        `V8:${file}/soru-uretimi-yok`,
        !/resolveHybridQuestions|scheduleComposerQuestions|question-profiles/.test(src),
        "Maira kendi soru otoritesini kuruyor",
      );
      gate(
        `V8:${file}/cevap-deposu-yok`,
        !/useState<[^>]*(Record<string, ?string>|CanonicalFieldState)/.test(src),
        "Maira kalıcı cevap deposu tutuyor",
      );
    }
  }
}

console.log(`\nPROBLEMS=${PROBLEMS.length}`);
for (const p of PROBLEMS) console.log("  - " + p);
console.log("\n===== HUKUM =====");
console.log(`kapi=${CHECKS} sorun=${PROBLEMS.length}`);
console.log(PROBLEMS.length === 0 ? "SONUC=GECTI" : "SONUC=KALDI");
process.exit(PROBLEMS.length === 0 ? 0 : 1);
