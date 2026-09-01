/**
 * DEĞER TAŞIMAYAN CEVAP OTORİTESİ V1 — D3f Dilim 1 (2026-08-27).
 *
 * ÜÇ DURUM AYNI KOVAYA ATILAMAZ.
 *
 *   1. Kullanıcı HENÜZ CEVAP VERMEDİ.
 *   2. Kullanıcı açıkça "Bilmiyorum" dedi.
 *   3. Kullanıcı açıkça "Uygulanamaz" dedi.
 *
 * (2) ve (3) GERÇEK KULLANICI CEVAPLARIDIR: soruyu kapatabilmeleri gerekir,
 * yoksa Maira aynı soruyu tekrar tekrar sorar ve kullanıcı yorulur. Ama
 * ÜRÜN DEĞERİ DEĞİLLERDİR: firmaya "bu talep şu özelliği istiyor" diye
 * gösterilemezler ve matching onları pozitif attribute eşleşmesi sayamaz.
 *
 * ÖLÇÜLEN ÜRETİM HATASI (salt-okunur denetim, 2026-08-27). `/talep` ekranı
 * "Bilmiyorum" seçimini yerelleştirilmiş ETİKETİ bir DEĞER gibi yazarak
 * kaydediyordu:
 *
 *     applyQuickOption(field, "Belirtilmedi" | "Henüz bilmiyorum", false)
 *       → kind: "VALUE", provenance: "EXPLICIT_BROWSE"
 *       → projection.attributes[field] = "Henüz bilmiyorum"
 *       → fieldAuthority[field].attributes = "USER_EXPLICIT"
 *       → routing-envelope bu torbayı aynen matching'e kopyalıyor
 *
 * Yani "Henüz bilmiyorum" metni bir MARKA ya da ÜRÜN ÖZELLİĞİ olarak
 * firmalara yönlendirme sinyali üretiyordu. Bu, `"Fark etmez"` etiketinin
 * değer gibi kalıcılaştırılmasıyla AYNI hatadır; bu doğrulayıcı onun bir
 * daha geri gelmesini engeller.
 *
 * SALT-OKUNUR. Hiçbir veritabanı yazımı yapılmaz; ölçüm, gerçek
 * `/api/requests` yayın zincirinin kullandığı ÜRETİM fonksiyonlarının ta
 * kendisiyle yapılır (`syncFromBrowse`, `resolveHybridQuestions`,
 * `buildDiscoveryProjectionFromState`, `buildPublishFieldValues`,
 * `isFieldSatisfied`). Doğrulayıcı kendi karar kopyasını KURMAZ.
 *
 * KAPSAM (Dilim 1). Bu doğrulayıcı kanonik kapanış otoritesini ve etiketin
 * attribute'a sızmamasını ölçer. KAPSAM DIŞI ve ayrıca ölçülmemiştir:
 *   - `fieldResponses` kalıcı cevap-disposition yüzeyi (Dilim 2),
 *   - `RequestFieldValue` üzerinde mod kalıcılığı, edit/clone geri yükleme
 *     (Dilim 3).
 * Bu YEŞİL o iki konuyu KAPSAMAZ.
 */

import { buildDiscoveryProjectionFromState } from "../src/lib/discovery/build-projection";
import {
  buildPublishFieldValues,
  createTextOnlyState,
  resolveHybridQuestions,
  syncFromBrowse,
  toResolverFieldBag,
} from "../src/lib/request-composer";
import {
  classifyAnswerAuthority,
  isDeliberateNonValueAnswer,
  mayCloseQuestion,
} from "../src/lib/request-composer/answer-authority";
import type {
  CanonicalFieldState,
  CanonicalRequestState,
} from "../src/lib/request-composer/types";
import { FIELD_SENTINEL } from "../src/lib/request-composer/types";
import { isFieldSatisfied } from "../src/lib/request-composer/v2/question-scheduler";
import { CATEGORY_COVERAGE_V1 } from "./fixtures/category-coverage-v1";

const problems: string[] = [];

function fail(id: string, detail: string): void {
  problems.push(`${id}: ${detail}`);
}

function ok(id: string, condition: boolean, detail: string): void {
  if (!condition) fail(id, detail);
}

/* ------------------------------------------------------------------ *
 * ÖLÇÜM SAHNESİ
 * ------------------------------------------------------------------ */

/**
 * Sahne, ÖLÇÜLMÜŞ bir üretim senaryosudur: `appliances` kategorisinde
 * `energyClass` gerçekten sorulan bir alandır (soru kuyruğunda görünür),
 * bu yüzden "tekrar soruluyor mu?" sorusu bu alanda anlamlıdır.
 */
const SCENE_TEXT = "İstanbul'da ikinci el buzdolabı arıyorum, bütçem 15000 TL";
const SCENE_KEY = "energyClass";

/**
 * `/talep` ekranının kaçış seçeneklerinde kullanıcıya gösterilen metinler ve
 * seçenek değerleri. HİÇBİRİ bir ürün özelliği DEĞİLDİR ve hiçbiri
 * `attributes` torbasına girmemelidir.
 */
const ESCAPE_LABELS: readonly string[] = [
  "Belirtilmedi",
  "Henüz bilmiyorum",
  "bilmiyorum",
  "unknown",
  "Uygulanamaz",
];

function sceneState(): CanonicalRequestState {
  return createTextOnlyState(SCENE_TEXT);
}

function withField(
  state: CanonicalRequestState,
  key: string,
  field: CanonicalFieldState,
): CanonicalRequestState {
  return { ...state, fields: { ...state.fields, [key]: field } };
}

type Surfaces = {
  attribute: string | null;
  constraintMode: string | null;
  constraintValue: string | null;
  authority: { attributes?: string; constraints?: string } | null;
  publishMode: string | null;
  publishValue: string | null;
  closed: boolean;
  reAsked: boolean;
  rawInput: string;
};

/** Bir alanın BÜTÜN aşağı akış yüzeylerini tek geçişte ölçer. */
function surfacesOf(state: CanonicalRequestState, key: string): Surfaces {
  const projection = buildDiscoveryProjectionFromState(state);
  const questions = resolveHybridQuestions(state);
  const bag = toResolverFieldBag(state);
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(bag)) {
    if (!k.startsWith("__")) values[k] = v;
  }
  const publish = buildPublishFieldValues({
    canonicalFields: state.fields,
    values,
    userTouchedKeys: [],
  });
  const constraint = projection.constraints?.[key] ?? null;
  return {
    attribute: projection.attributes?.[key] ?? null,
    constraintMode: constraint?.mode ?? null,
    constraintValue: constraint?.value ?? null,
    authority: projection.fieldAuthority?.[key] ?? null,
    publishMode: publish[key]?.mode ?? null,
    publishValue: publish[key]?.value ?? null,
    closed: questions.known.includes(key),
    reAsked:
      questions.next.some((f) => f.key === key) ||
      questions.candidates.some((c) => c.fieldKey === key),
    rawInput: String(state.understanding.rawInput ?? ""),
  };
}

/** Değer taşımayan bir cevabın ASLA üretmemesi gereken yüzeyler. */
function assertNoProductSignal(id: string, s: Surfaces): void {
  ok(id, s.attribute === null, `attributes yüzeyi oluştu → '${s.attribute}'`);
  ok(
    id,
    s.authority?.attributes === undefined,
    `attributes otoritesi damgalandı → '${String(s.authority?.attributes)}'`,
  );
  ok(
    id,
    s.constraintMode !== "VALUE",
    `constraint VALUE moduna düştü → ${JSON.stringify(s.constraintMode)}`,
  );
  ok(
    id,
    s.publishMode !== "VALUE",
    `yayın kanalına VALUE olarak girdi → '${String(s.publishValue)}'`,
  );
}

/* ------------------------------------------------------------------ *
 * 1. DOKUNULMAMIŞ UNKNOWN — SORU AÇIK, HİÇBİR YÜZEY YOK
 * ------------------------------------------------------------------ */

function measureUntouched(): void {
  const state = sceneState();
  const field = state.fields[SCENE_KEY];
  const s = surfacesOf(state, SCENE_KEY);

  ok(
    "A1",
    !isDeliberateNonValueAnswer(field),
    "dokunulmamış UNKNOWN bilinçli cevap sayıldı",
  );
  ok("A2", s.reAsked, "dokunulmamış alan soru kuyruğundan düştü");
  ok("A3", !s.closed, "dokunulmamış alan cevaplanmış sayıldı");
  ok(
    "A4",
    s.attribute === null && s.constraintMode === null,
    `dokunulmamış alan projection yüzeyi üretti → attr='${s.attribute}' mode='${s.constraintMode}'`,
  );
  ok(
    "A5",
    s.publishMode === null,
    `dokunulmamış alan yayın kanalına girdi → ${s.publishMode}`,
  );
}

/* ------------------------------------------------------------------ *
 * 2. AÇIK KULLANICI KAYNAKLI UNKNOWN — SORU KAPANIR, DEĞER ÜRETMEZ
 * ------------------------------------------------------------------ */

function measureExplicitUnknown(): void {
  for (const provenance of ["EXPLICIT_TEXT", "EXPLICIT_BROWSE"] as const) {
    const id = `B:${provenance}`;
    const field: CanonicalFieldState = {
      kind: "UNKNOWN",
      value: null,
      provenance,
      confidence: 1,
      evidence: ["escape:unknown"],
    };
    const state = withField(sceneState(), SCENE_KEY, field);
    const s = surfacesOf(state, SCENE_KEY);

    ok(
      `${id}/1`,
      isDeliberateNonValueAnswer(field),
      "açık kaynaklı UNKNOWN bilinçli cevap sayılmadı",
    );
    ok(`${id}/2`, s.closed, "açık UNKNOWN soruyu kapatmadı");
    ok(`${id}/3`, !s.reAsked, "açık UNKNOWN sonrası soru tekrar soruldu");
    assertNoProductSignal(id, s);
    ok(
      `${id}/4`,
      s.publishMode === "UNKNOWN",
      `yayın modu UNKNOWN değil → ${String(s.publishMode)}`,
    );
    /* Otorite MERDİVENİ değişmez: değer taşımayan cevap USER_EXPLICIT bir
     * attribute üretemez — merdiven "bu DEĞER soruyu kapatır mı?" sorusunu
     * cevaplar ve burada değer yoktur. */
    ok(
      `${id}/5`,
      classifyAnswerAuthority(field) === "UNKNOWN",
      `cevap otoritesi merdiveni değişti → ${classifyAnswerAuthority(field)}`,
    );
    ok(
      `${id}/6`,
      !mayCloseQuestion(classifyAnswerAuthority(field)),
      "mayCloseQuestion değer taşımayan cevaba yetki verdi",
    );
    ok(`${id}/7`, s.rawInput === SCENE_TEXT, "rawInput değişti");
  }
}

/* ------------------------------------------------------------------ *
 * 3. NOT_APPLICABLE — SORU KAPANIR, SENTINEL ASLA VALUE OLMAZ
 * ------------------------------------------------------------------ */

function measureNotApplicable(): void {
  const field: CanonicalFieldState = {
    kind: "NOT_APPLICABLE",
    value: null,
    provenance: "EXPLICIT_BROWSE",
    confidence: 1,
  };
  const state = withField(sceneState(), SCENE_KEY, field);
  const s = surfacesOf(state, SCENE_KEY);

  ok("C1", isDeliberateNonValueAnswer(field), "NOT_APPLICABLE bilinçli cevap sayılmadı");
  ok("C2", s.closed, "NOT_APPLICABLE soruyu kapatmadı");
  ok("C3", !s.reAsked, "NOT_APPLICABLE sonrası soru tekrar soruldu");
  assertNoProductSignal("C", s);
  ok(
    "C4",
    s.publishMode === "NOT_APPLICABLE",
    `yayın modu NOT_APPLICABLE değil → ${String(s.publishMode)}`,
  );
  ok(
    "C5",
    s.publishValue !== FIELD_SENTINEL.NOT_APPLICABLE,
    "ham sentinel yayın kanalına DEĞER olarak yazıldı",
  );
  ok("C6", s.rawInput === SCENE_TEXT, "rawInput değişti");

  /**
   * SENTINEL KÖK NEDENİ. Değer torbasına sentinel dizesi düşüp kanonik alan
   * boş kaldığında `publishModeOf` eskiden `VALUE` diyordu ve `__NOT_APPLICABLE__`
   * kullanıcının cevabı olarak kalıcılaşıyordu.
   */
  for (const [sentinel, expected] of [
    [FIELD_SENTINEL.NOT_APPLICABLE, "NOT_APPLICABLE"],
    [FIELD_SENTINEL.ANY, "ANY"],
  ] as const) {
    const publish = buildPublishFieldValues({
      canonicalFields: sceneState().fields,
      values: { [SCENE_KEY]: sentinel },
      userTouchedKeys: [SCENE_KEY],
    });
    const mode = publish[SCENE_KEY]?.mode ?? null;
    ok(
      `C7:${sentinel}`,
      mode === expected,
      `sentinel '${sentinel}' modu '${String(mode)}' oldu (beklenen '${expected}')`,
    );
    ok(
      `C8:${sentinel}`,
      publish[SCENE_KEY]?.value !== sentinel,
      `ham sentinel '${sentinel}' değer olarak taşındı`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * 4. ANY KONTROL VAKASI — MEVCUT DAVRANIŞ AYNEN KORUNUR
 * ------------------------------------------------------------------ */

function measureAnyControl(): void {
  const state = syncFromBrowse(sceneState(), {
    key: SCENE_KEY,
    value: "Farketmez",
    isAny: true,
  }).state;
  const s = surfacesOf(state, SCENE_KEY);

  ok("D1", state.fields[SCENE_KEY]?.kind === "ANY", "ANY kanonik türü bozuldu");
  ok("D2", s.closed, "ANY soruyu kapatmayı bıraktı");
  ok("D3", !s.reAsked, "ANY sonrası soru tekrar soruldu");
  ok(
    "D4",
    s.constraintMode === "ANY",
    `ANY constraint modu bozuldu → ${String(s.constraintMode)}`,
  );
  ok(
    "D5",
    s.authority?.constraints === "USER_EXPLICIT",
    `ANY constraint otoritesi bozuldu → ${String(s.authority?.constraints)}`,
  );
  ok("D6", s.attribute === null, `ANY attributes yüzeyi üretti → '${s.attribute}'`);
  ok(
    "D7",
    s.publishMode === "ANY",
    `ANY yayın modu bozuldu → ${String(s.publishMode)}`,
  );
  ok("D8", s.rawInput === SCENE_TEXT, "rawInput değişti");
}

/* ------------------------------------------------------------------ *
 * 5. UI "BİLMİYORUM" YOLU — ETİKET DEĞER OLAMAZ
 * ------------------------------------------------------------------ */

/**
 * `/talep` ekranının "Bilmiyorum" dalı üretimde tek bir kanonik yazıcıdan
 * geçer: `applyQuickOption` → `syncFromBrowse`. Burada ölçülen o yazıcının
 * ta kendisidir. Kanonik mod taşındığında ETİKET hiçbir yüzeye sızmamalıdır.
 */
function measureUiUnknownPath(): void {
  for (const label of ESCAPE_LABELS) {
    const state = syncFromBrowse(sceneState(), {
      key: SCENE_KEY,
      value: label,
      kind: "UNKNOWN",
    }).state;
    const field = state.fields[SCENE_KEY];
    const s = surfacesOf(state, SCENE_KEY);
    const id = `E:'${label}'`;

    ok(
      `${id}/1`,
      field?.kind === "UNKNOWN",
      `kanonik tür UNKNOWN değil → ${String(field?.kind)}`,
    );
    ok(
      `${id}/2`,
      field?.value == null,
      `etiket kanonik değere yazıldı → '${String(field?.value)}'`,
    );
    ok(`${id}/3`, isDeliberateNonValueAnswer(field), "bilinçli cevap sayılmadı");
    ok(`${id}/4`, s.closed && !s.reAsked, "soru kapanmadı");
    assertNoProductSignal(id, s);
    ok(`${id}/5`, s.rawInput === SCENE_TEXT, "rawInput değişti");
  }

  /**
   * SIZINTI TARAMASI. Etiketlerin hiçbiri, HİÇBİR alan altında
   * attributes / constraint değeri / yayın değeri olarak görünemez.
   */
  for (const label of ESCAPE_LABELS) {
    const state = syncFromBrowse(sceneState(), {
      key: SCENE_KEY,
      value: label,
      kind: "UNKNOWN",
    }).state;
    const projection = buildDiscoveryProjectionFromState(state);
    const leakedAttr = Object.entries(projection.attributes ?? {}).find(
      ([, v]) => v === label,
    );
    ok(
      `E-leak:'${label}'`,
      leakedAttr === undefined,
      `etiket attributes torbasına sızdı → ${JSON.stringify(leakedAttr)}`,
    );
    const leakedConstraint = Object.entries(projection.constraints ?? {}).find(
      ([, c]) => c?.value === label,
    );
    ok(
      `E-leak-c:'${label}'`,
      leakedConstraint === undefined,
      `etiket constraint değerine sızdı → ${JSON.stringify(leakedConstraint)}`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * 6. PROFİL POLİTİKASI KORUNUR — KARAR ETİKETTEN OKUNMAZ
 * ------------------------------------------------------------------ */

/**
 * `allowUnknown` / `allowDontCare` bir ÜRÜN POLİTİKASIDIR: hangi sorunun
 * "Bilmiyorum" ile geçilebileceğine profil karar verir. Kanonik kapanış
 * yardımcısı bu politikayı EZMEZ — yalnız kararın girdisini yerelleştirilmiş
 * etiketten kanonik moda taşır.
 */
function measureProfilePolicy(): void {
  const cases: readonly {
    id: string;
    kind: "UNKNOWN" | "ANY" | "NOT_APPLICABLE";
    allowUnknown: boolean;
    allowDontCare: boolean;
    importance: "publish_required" | "quote_critical" | "optional";
    expected: boolean;
  }[] = [
    { id: "F1", kind: "UNKNOWN", allowUnknown: true, allowDontCare: false, importance: "quote_critical", expected: true },
    { id: "F2", kind: "UNKNOWN", allowUnknown: false, allowDontCare: true, importance: "quote_critical", expected: false },
    { id: "F3", kind: "UNKNOWN", allowUnknown: false, allowDontCare: false, importance: "optional", expected: true },
    { id: "F4", kind: "ANY", allowUnknown: false, allowDontCare: true, importance: "quote_critical", expected: true },
    { id: "F5", kind: "ANY", allowUnknown: true, allowDontCare: false, importance: "quote_critical", expected: false },
    { id: "F6", kind: "NOT_APPLICABLE", allowUnknown: false, allowDontCare: true, importance: "quote_critical", expected: true },
    { id: "F7", kind: "NOT_APPLICABLE", allowUnknown: true, allowDontCare: false, importance: "quote_critical", expected: false },
  ];

  for (const c of cases) {
    const satisfied = isFieldSatisfied({
      fieldKey: SCENE_KEY,
      state: { kind: c.kind, value: null, provenance: "EXPLICIT_BROWSE" },
      importance: c.importance,
      allowUnknown: c.allowUnknown,
      allowDontCare: c.allowDontCare,
    });
    ok(
      c.id,
      satisfied === c.expected,
      `profil politikası bozuldu (kind=${c.kind} allowUnknown=${c.allowUnknown} ` +
        `allowDontCare=${c.allowDontCare} importance=${c.importance}) → ${satisfied}`,
    );
  }

  /* ÇIKARIMDAN GELEN değer taşımayan kayıt cevap DEĞİLDİR. */
  const inferredNonValue = isFieldSatisfied({
    fieldKey: SCENE_KEY,
    state: { kind: "UNKNOWN", value: null, provenance: "INFERRED" },
    importance: "quote_critical",
    allowUnknown: true,
    allowDontCare: true,
  });
  ok("F8", !inferredNonValue, "varsayılan UNKNOWN cevap sayıldı");
}

/* ------------------------------------------------------------------ *
 * 6b. B1 — PROVENANCE'SIZ "AÇIK CEVAP" İŞARETİ YOKTUR
 * ------------------------------------------------------------------ */

/**
 * BAĞIMSIZ İKİNCİ KAPANIŞ OTORİTESİ YOKTUR (B1).
 *
 * `toResolverFieldBag` değer taşımayan alanlar için `__explicit__<key>`
 * işaretini PROVENANCE'A BAKMADAN yazıyordu. Soru çözücüsü kapanışı o
 * işaretten okuduğu için, kanonik yardımcı "bu bilinçli bir cevap değil"
 * dediği hâlde soru kapanıyordu: `kind` tek başına yetki üretiyordu.
 *
 * Kapanış YALNIZ kullanıcının kendi seçiminden doğar. Bugün `ANY`yi
 * çıkarımdan üreten bir üretim yolu yoktur; ama sözleşme, ileride öyle bir
 * yol eklendiğinde sessizce yetki vermemelidir.
 */
function measureProvenanceGate(): void {
  const NON_VALUE_KINDS = ["ANY", "NOT_APPLICABLE", "UNKNOWN"] as const;
  const NOT_DELIBERATE = ["INFERRED", "CATALOG_ENRICHED"] as const;
  const DELIBERATE = ["EXPLICIT_TEXT", "EXPLICIT_BROWSE"] as const;

  for (const kind of NON_VALUE_KINDS) {
    for (const provenance of NOT_DELIBERATE) {
      const field: CanonicalFieldState = { kind, value: null, provenance };
      const state = withField(sceneState(), SCENE_KEY, field);
      const bag = toResolverFieldBag(state);
      const s = surfacesOf(state, SCENE_KEY);
      const id = `I:${kind}/${provenance}`;

      ok(
        `${id}/1`,
        !isDeliberateNonValueAnswer(field),
        "çıkarımdan gelen değer taşımayan kayıt bilinçli cevap sayıldı",
      );
      ok(
        `${id}/2`,
        bag[`__explicit__${SCENE_KEY}`] === undefined,
        `torbaya provenance'sız açık-cevap işareti yazıldı → '${String(bag[`__explicit__${SCENE_KEY}`])}'`,
      );
      ok(`${id}/3`, !s.closed, "çıkarımdan gelen kayıt soruyu kapattı");
      ok(
        `${id}/4`,
        !isFieldSatisfied({
          fieldKey: SCENE_KEY,
          state: { kind, value: null, provenance },
          importance: "quote_critical",
          allowUnknown: true,
          allowDontCare: true,
        }),
        "v2 zamanlayıcısı çıkarımdan gelen kaydı tatmin saydı",
      );
    }

    for (const provenance of DELIBERATE) {
      const field: CanonicalFieldState = { kind, value: null, provenance };
      const state = withField(sceneState(), SCENE_KEY, field);
      const bag = toResolverFieldBag(state);
      const id = `I:${kind}/${provenance}`;
      ok(
        `${id}/5`,
        isDeliberateNonValueAnswer(field),
        "açık kullanıcı kaynaklı cevap bilinçli sayılmadı",
      );
      ok(
        `${id}/6`,
        (bag[`__explicit__${SCENE_KEY}`] ?? "").length > 0,
        "bilinçli cevabın açık-cevap işareti torbaya yazılmadı",
      );
      ok(
        `${id}/7`,
        surfacesOf(state, SCENE_KEY).closed,
        "bilinçli cevap soruyu kapatmadı",
      );
    }
  }
}

/* ------------------------------------------------------------------ *
 * 6c. B2 — ETİKET HİÇBİR PROFİLDE CEVAP YERİNE GEÇMEZ
 * ------------------------------------------------------------------ */

/**
 * YERELLEŞTİRİLMİŞ ETİKET BİR SÖZLEŞME DEĞİLDİR (B2).
 *
 * v2 zamanlayıcısı kapanış kararını `parseSoftStatus` ile taslak DİZESİNDEN
 * de veriyordu. Ölçüldü: kanonik durum "bu bilinçli bir cevap değil" derken,
 * profil izin verdiğinde `"Henüz bilmiyorum"` / `"Fark etmez"` / `"Esnek"`
 * metinleri soruyu tek başına kapatıyordu — yani ekranda yazan metin bir
 * otoriteydi ve metin değişince cevap sessizce kaybolurdu.
 *
 * FAIL-CLOSED. Kanonik modu olmayan, yalnız etiket taşıyan eski taslak
 * hiçbir profilde cevap sayılmaz; soru açık kalır. Etiket ne kapatır ne de
 * gerçek bir değer yerine geçer.
 */
const ESCAPE_DRAFT_LABELS: readonly string[] = [
  "Belirtilmedi",
  "Henüz bilmiyorum",
  "bilmiyorum",
  "unknown",
  "Fark etmez",
  "farketmez",
  "Konum fark etmez",
  "Esnek",
  "teklif",
  "teklif bekliyorum",
  "Teklifleri görmek istiyorum",
];

function measureLabelIsNotAnAnswer(): void {
  for (const label of ESCAPE_DRAFT_LABELS) {
    /* (a) Kanonik durum ÇIKARIM derken etiket kapatamaz — izin olsa bile. */
    for (const [allowUnknown, allowDontCare] of [
      [true, true],
      [true, false],
      [false, true],
      [false, false],
    ] as const) {
      const satisfied = isFieldSatisfied({
        fieldKey: "material",
        state: { kind: "UNKNOWN", value: label, provenance: "INFERRED" },
        importance: "quote_critical",
        allowUnknown,
        allowDontCare,
      });
      ok(
        `J:'${label}'/${allowUnknown}${allowDontCare}`,
        !satisfied,
        `etiket kanonik karara rağmen soruyu kapattı (allowUnknown=${allowUnknown} allowDontCare=${allowDontCare})`,
      );
    }

    /* (b) Kanonik modu HİÇ olmayan eski taslak da kapatamaz (fail-closed). */
    const legacy = isFieldSatisfied({
      fieldKey: "material",
      state: { value: label },
      importance: "quote_critical",
      allowUnknown: true,
      allowDontCare: true,
    });
    ok(
      `J-legacy:'${label}'`,
      !legacy,
      "yalnız etiket taşıyan eski taslak cevap sayıldı (fail-closed değil)",
    );
  }

  /**
   * GERÇEK DEĞER ETKİLENMEZ. Fail-closed süzgeç yalnız kaçış etiketlerini
   * reddeder; kullanıcının yazdığı gerçek cevap aynen tatmin etmeye devam eder.
   */
  for (const real of ["Ahşap", "A++", "2018", "Kırmızı"]) {
    ok(
      `J-real:'${real}'`,
      isFieldSatisfied({
        fieldKey: "material",
        state: { kind: "VALUE", value: real, provenance: "EXPLICIT_BROWSE" },
        importance: "quote_critical",
        allowUnknown: false,
        allowDontCare: false,
      }),
      "gerçek kullanıcı değeri tatmin etmeyi bıraktı",
    );
  }
}

/* ------------------------------------------------------------------ *
 * 6d. /talep KAÇIŞ ÜRETİCİLERİ KANONİK MOD YAZAR
 * ------------------------------------------------------------------ */

/**
 * `/talep` ekranının kaçış dalları kanonik modu üretimin kendi yazıcısından
 * (`syncFromBrowse`) geçirir. Ortak alanlar (`budget` / `city` / `delivery` /
 * `quantity` / `title`) TEK TEK ölçülür: eskiden bu beş alan `useAny === false`
 * olduğu için kaçış cevabını yerelleştirilmiş bir VALUE etiketi olarak
 * saklıyordu.
 */
function measureEscapeProducers(): void {
  const FIELDS = [
    "budget",
    "city",
    "delivery",
    "quantity",
    "title",
    "material",
    "brand",
  ] as const;

  for (const key of FIELDS) {
    for (const [label, kind] of [
      ["Henüz bilmiyorum", "UNKNOWN"],
      ["Fark etmez", "ANY"],
      ["Esnek", "ANY"],
    ] as const) {
      const state = syncFromBrowse(sceneState(), {
        key,
        value: label,
        kind,
      }).state;
      const field = state.fields[key];
      const id = `K:${key}/'${label}'`;

      ok(
        `${id}/1`,
        field?.kind === kind,
        `kanonik mod taşınmadı → ${String(field?.kind)}`,
      );
      ok(
        `${id}/2`,
        field?.value == null,
        `etiket kanonik değere yazıldı → '${String(field?.value)}'`,
      );
      ok(
        `${id}/3`,
        isDeliberateNonValueAnswer(field),
        "bilinçli cevap sayılmadı",
      );
      const projection = buildDiscoveryProjectionFromState(state);
      ok(
        `${id}/4`,
        projection.attributes?.[key] === undefined,
        `attributes yüzeyi oluştu → '${projection.attributes?.[key]}'`,
      );
      ok(
        `${id}/5`,
        projection.constraints?.[key]?.value !== label,
        "etiket constraint değerine yazıldı",
      );
      ok(
        `${id}/6`,
        String(state.understanding.rawInput ?? "") === SCENE_TEXT,
        "rawInput değişti",
      );
    }
  }
}

/* ------------------------------------------------------------------ *
 * 7. YAYIN ZORUNLULUKLARI GEVŞEMEZ
 * ------------------------------------------------------------------ */

/**
 * Bütçe ve konum kurucunun yayın kapılarıdır. Kanonik kapanış yardımcısı
 * onları AÇAMAZ: profil `allowUnknown: false` derse "Bilmiyorum" o soruyu
 * tatmin etmez ve alan eksik kalmaya devam eder.
 */
function measurePublishGates(): void {
  for (const key of ["budget", "city"] as const) {
    const satisfied = isFieldSatisfied({
      fieldKey: key,
      state: { kind: "UNKNOWN", value: null, provenance: "EXPLICIT_BROWSE" },
      importance: "publish_required",
      allowUnknown: false,
      allowDontCare: false,
    });
    ok(
      `G:${key}`,
      satisfied === false,
      `${key} yayın kapısı değer taşımayan cevapla açıldı`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * 8. VARSAYILAN 988 UNKNOWN DEĞİŞMEZ VE PAYLOAD ÜRETMEZ
 * ------------------------------------------------------------------ */

/**
 * Kabul kuralı (kurucu): değer taşımayan bir cevabın kalıcı yüzey üretme
 * hakkı YALNIZ açık kullanıcı kaynağından gelir. 108 senaryoluk kapsam
 * tabanında hiç kimse "Bilmiyorum" seçmemiştir; bu yüzden bu dilim
 * payload'a TEK BİR yeni kayıt bile ekleyemez.
 */
function measureCorpusDenominator(): {
  scenarios: number;
  unknown: number;
  attributes: number;
  constraints: number;
} {
  let scenarios = 0;
  let unknown = 0;
  let explicitNonValue = 0;
  let attributes = 0;
  let constraints = 0;
  let publishRows = 0;

  for (const scenario of CATEGORY_COVERAGE_V1) {
    const text = String(scenario.input ?? "");
    if (!text) continue;
    scenarios++;
    const state = createTextOnlyState(text);
    for (const field of Object.values(state.fields)) {
      if (field.kind === "UNKNOWN") unknown++;
      if (isDeliberateNonValueAnswer(field)) explicitNonValue++;
    }
    const projection = buildDiscoveryProjectionFromState(state);
    attributes += Object.keys(projection.attributes ?? {}).length;
    constraints += Object.keys(projection.constraints ?? {}).length;

    const bag = toResolverFieldBag(state);
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(bag)) {
      if (!k.startsWith("__")) values[k] = v;
    }
    const publish = buildPublishFieldValues({
      canonicalFields: state.fields,
      values,
      userTouchedKeys: [],
    });
    for (const answer of Object.values(publish)) {
      if (answer.mode !== "VALUE") publishRows++;
    }
  }

  ok("H1", scenarios === 108, `senaryo sayısı değişti → ${scenarios}`);
  /**
   * Taban 988→986 (RC, 2026-09-01): FD-7/8/10 kurucu kürasyonu tech-12/
   * health-07/home-06 kategorilerini çözdü ve productType alanları
   * UNKNOWN→VALUE oldu (Wave L, satır satır onaylı delta). Sayaç tam da bu
   * tür değişimi yakalamak için vardı; fark kararla buradan geçiyor.
   */
  /* 98+ Faz I (2026-09-01) sayılı rebase: 13 senaryoluk davranış deltası — appl-02 inverter parça sızıntısı kapandı (-part,-partSystem), auto-11 lastik ürünleşti (-needType=vehicle, araç soruları düştü), tech-04/tech-11 RC ayrışması kapandı (state kategorisi beyni izler), tech-12 SERVICE kind (+needType,+serviceType), mach-05 machinery claim (+productType), baby-08/furn-04/home-07 kullanıcı parça beyanı korunuyor (+part), health-06 hint kategoriyi ezemiyor. Kimlik-düzeyi tam liste: fixtures/projection-authority-v1.ts */
  ok("H2", unknown === 982, `varsayılan UNKNOWN sayısı değişti → ${unknown}`);
  ok(
    "H3",
    explicitNonValue === 0,
    `corpus'ta bilinçli değer taşımayan cevap belirdi → ${explicitNonValue}`,
  );
  ok(
    "H4",
    publishRows === 0,
    `varsayılan UNKNOWN yayın kanalına değer taşımayan kayıt ekledi → ${publishRows}`,
  );

  return { scenarios, unknown, attributes, constraints };
}

/* ------------------------------------------------------------------ *
 * RAPOR
 * ------------------------------------------------------------------ */

function main(): void {
  console.log("===== DEGER TASIMAYAN CEVAP OTORITESI V1 =====");

  measureUntouched();
  measureExplicitUnknown();
  measureNotApplicable();
  measureAnyControl();
  measureUiUnknownPath();
  measureProfilePolicy();
  measureProvenanceGate();
  measureLabelIsNotAnAnswer();
  measureEscapeProducers();
  measurePublishGates();
  const corpus = measureCorpusDenominator();

  console.log(`SCENE=${SCENE_KEY}@appliances`);
  console.log(`ESCAPE_LABELS=${ESCAPE_LABELS.length}`);
  console.log(
    `CORPUS scenarios=${corpus.scenarios} default_unknown=${corpus.unknown} ` +
      `attributes=${corpus.attributes} constraints=${corpus.constraints}`,
  );
  console.log(`PROBLEMS=${problems.length}`);

  console.log("\n===== HUKUM =====");
  if (problems.length) {
    console.error("KIRMIZI — degir tasimayan cevaplar sessizlikten ayrilmiyor:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    "YESIL — dokunulmamis UNKNOWN soruyu acik birakiyor ve hicbir yuzey\n" +
      "uretmiyor; acik kullanici kaynakli UNKNOWN ve NOT_APPLICABLE soruyu\n" +
      "kapatiyor ama VALUE / attribute / pozitif matching sinyali uretmiyor;\n" +
      "ham sentinel hicbir noktada VALUE olmuyor; ANY mevcut davranisini\n" +
      "koruyor; 'Belirtilmedi' ve 'Henuz bilmiyorum' etiketleri projection'a\n" +
      "sizmiyor; rawInput degismiyor; profil politikasi ve yayin kapilari\n" +
      "gevsemiyor; 988 varsayilan UNKNOWN payload'a tek kayit eklemiyor.\n" +
      "\nKAPSAM DISI (olculmedi): fieldResponses yuzeyi (Dilim 2) ve\n" +
      "RequestFieldValue mod kaliciligi / edit-clone geri yukleme (Dilim 3).",
  );
  process.exit(0);
}

main();
