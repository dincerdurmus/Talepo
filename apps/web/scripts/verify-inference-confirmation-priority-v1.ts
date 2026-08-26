/**
 * ÇIKARIM DOĞRULAMA ÖNCELİĞİ V1 — D3b (2026-08-26).
 *
 * ÖLÇTÜĞÜ TEK SÖZLEŞME. Talepo'nun KENDİ tahmininden gelen bir değer, ilk
 * görünür soru ekranındaki sınırlı yerleri, hiç bilmediğimiz alanlardan ÖNCE
 * doldurmalıdır.
 *
 * Gerekçe simetrik değildir. Eksik bir alan talebi eksik bırakır; kullanıcı
 * bunu görür ve isterse doldurur. YANLIŞ bir çıkarım ise talebi sessizce
 * yanlış havuza gönderir ve kullanıcı bunu hiç görmez — "İkinci el" tahmini,
 * sıfır kilometre arayan bir alıcıyı ikinci el satıcılarına yönlendirir.
 * Bu yüzden doğrulama sorusu kuyruğun başında durur.
 *
 * NEDEN "SORULDU MU" DEĞİL "NE ZAMAN SORULDU". Bu doğrulayıcı D1/D2'nin
 * ölçtüğü FULL_QUEUE ufkuyla yarışmaz ve onu tekrarlamaz. Orada cevaplanan
 * soru "çıkarım hiç sorulmadan yayına gitti mi?"dir. Burada cevaplanan soru
 * bir adım ilerdedir: çıkarım sorulsa bile kullanıcının gerçekten göreceği
 * İLK ekranda mı soruluyor? Scheduler aynı anda en çok üç soru gösterdiği
 * için bu iki soru farklı yanıtlar verebilir — auto-02'de verdiler.
 *
 * ÜÇ YÜZEY ÖLÇÜLÜR — MOTOR, ADAY LİSTESİ VE NİHAİ EKRAN (2026-08-26).
 *   NEXT                 : `resolveHybridQuestions(state).next` — iç kuyruk.
 *   CANDIDATES           : `resolveHybridQuestions(state, opts).candidates`
 *                          — sıralanmış, görünür sınıra kesilmiş aday listesi.
 *   RENDERABLE_CANDIDATES: `filterRenderableCandidates(...)` — kullanıcının
 *                          GERÇEKTEN gördüğü nihai liste.
 *
 * Üçü de gerekli, çünkü hiçbiri diğerini kapsamıyor. `candidates`,
 * `rankWithinAllowlist` ile yeniden sıralanır ve şehir önceliği listeyi
 * yeniden dizer. Nihai süzgeç ise bunların üstüne kendi elemesini koyar:
 * D3b'de motor kuyruğu ve aday listesi DOĞRUYKEN bu son süzgeç 35 çıkarım
 * doğrulamasının tamamını sessizce kaldırıyordu — `auto-02/condition` dahil.
 * Yalnız ilk iki yüzeyi ölçen bir doğrulayıcı bunu göremezdi.
 *
 * ÜRETİM MANTIĞI KOPYALANMAZ. Ne soru seçimi, ne sıralama, ne görünür sınır,
 * ne nihai eleme bu dosyada yeniden yazılır; hepsi üretim fonksiyonlarından
 * ÇAĞRILIR (`resolveHybridQuestions`, `filterRenderableCandidates`). Bu
 * dosyanın tek yaptığı, `page.tsx`in o fonksiyonlara geçirdiği GİRDİLERİ aynı
 * üretim yardımcılarıyla kurmaktır (bkz. `productionInputs`).
 *
 * BAĞLANTI DA KANITLANIR. Ortak yardımcıyı çağırıp yeşil dönmek, SAYFANIN da
 * onu çağırdığını göstermez. `checkRenderWiring` bunu `page.tsx`in AST'si
 * üzerinden kanıtlar: substring aramasına ya da satır numarasına güvenilmez.
 *
 * KURAL KATEGORİYE, ALANA YA DA SENARYOYA ÖZEL DEĞİLDİR. Tek ölçüt kanonik
 * cevap otoritesidir (`answer-authority`): değeri YALNIZ `INFERRED` olan alan
 * doğrulama gerektirir; `USER_EXPLICIT` ya da soruyu kapatmaya yetkili
 * `VERIFIED` değerler doğrulama olarak öne TAŞINAMAZ.
 *
 * SALT-OKUNUR: hiçbir veritabanı yazımı, hiçbir ağ çağrısı yapılmaz.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import ts from "typescript";

import { CATEGORY_COVERAGE_V1 } from "./fixtures/category-coverage-v1";
import { walkQuestionWavesFromText } from "./lib/question-wave-walk-v1";
import {
  resolveHybridQuestions,
  type HybridQuestionResult,
  type ResolveHybridQuestionsOptions,
} from "../src/lib/request-composer/questions";
import {
  filterRenderableCandidates,
  resolveQuestionDraftPresentation,
  softFillFromComposerState,
  type RenderableCandidateInput,
} from "../src/lib/request-composer/ui-helpers";
import {
  classifyAnswerAuthority,
  isInferenceOnlyAnswer,
  mayCloseQuestion,
  type Authority,
} from "../src/lib/request-composer/answer-authority";
import type {
  CanonicalFieldState,
  CanonicalRequestState,
} from "../src/lib/request-composer/types";
import {
  getVisibleCategoryFields,
  isFieldRequired,
  resolveRequestCategory,
  withCategoryFieldDefaults,
} from "../src/lib/request-category-engine";
import {
  completenessFromUnderstanding,
  strategyResolutionFromUnderstanding,
} from "../src/lib/request-understanding/activation-bridge";

/** Scheduler'ın aynı anda gösterdiği en çok soru sayısı — ilk ekran ufku. */
const FIRST_SCREEN_SLOTS = 3;

/** Ölçülen üç yüzey — motor kuyruğu, aday listesi, nihai render. */
const SURFACE_NEXT = "next";
const SURFACE_CANDIDATES = "candidates";
const SURFACE_RENDERABLE = "renderableCandidates";

/**
 * D3b'nin ADLANDIRILMIŞ hedefi. Toplam sayaç tek başına kanıt değildir: bir
 * kayıt düzelirken bir başkası bozulursa toplam yerinde durur. Kapı bu yüzden
 * kimlik bazındadır.
 */
const TARGET_SCENARIO_ID = "auto-02";
const TARGET_FIELD_KEY = "condition";

/**
 * Kimliğin TEK kurucusu. Format daha önce dört ayrı yerde elle üretiliyordu;
 * biri değişip diğerleri değişmediğinde kapı sessizce anlamını yitirirdi —
 * tam da bu dosyanın önlemek için var olduğu sessiz sürüklenme.
 */
function identityOf(scenarioId: string, fieldKey: string): string {
  return `${scenarioId}/${fieldKey}@FIRST_SCREEN`;
}

const TARGET_ID = identityOf(TARGET_SCENARIO_ID, TARGET_FIELD_KEY);

/**
 * Hedef kaydın girdisi fixture'ın KENDİSİNDEN okunur ve burada birebir
 * beklenir. Amaç: doğrulayıcıyı yeşile boyamak için fixture metnini
 * değiştirmenin sessiz kalmasını engellemek.
 */
const TARGET_INPUT = "2020 model dizel otomatik Volkswagen Passat arıyorum";
const TARGET_INFERRED_VALUE = "İkinci el";

type Violation = {
  id: string;
  scenarioId: string;
  fieldKey: string;
  /** Hangi yüzeyde kayboldu: motor kuyruğu, aday listesi ya da nihai render. */
  surface:
    | typeof SURFACE_NEXT
    | typeof SURFACE_CANDIDATES
    | typeof SURFACE_RENDERABLE;
  value: string;
  firstScreen: string[];
  askedAtWave: number | null;
};

type Measurement = {
  violations: Violation[];
  /** Kimlik listesi — ilk ekranda yer bulan çıkarım doğrulamaları (NEXT). */
  inferenceOnFirstScreen: string[];
  /** Kimlik listesi — `candidates` yüzeyinde duran doğrulamalar. */
  inferenceOnCandidates: string[];
  /** Kimlik listesi — kullanıcının GÖRDÜĞÜ nihai listede duran doğrulamalar. */
  inferenceOnRenderable: string[];
  /** Soruyu kapatmaya yetkili olduğu hâlde ilk ekranda sorulan alanlar. */
  wronglyRepeated: string[];
  /** Aynı dalgada iki kez çıkan alanlar. */
  duplicated: string[];
  /** `next` allowlist'i üretim seçenekleriyle değişen senaryolar (olmamalı). */
  allowlistDrift: string[];
};

function fieldsOf(
  state: CanonicalRequestState,
): Record<string, CanonicalFieldState | undefined> {
  return state.fields;
}

function valueOf(field: CanonicalFieldState | undefined): string {
  return field?.kind === "VALUE" && field.value != null
    ? String(field.value)
    : "";
}

/**
 * `/talep` SAYFASININ GEÇTİĞİ SEÇENEKLERİ ÜRETİM YARDIMCILARIYLA KURAR.
 *
 * Burada hiçbir seçim, sıralama ya da görünürlük kararı ÜRETİLMEZ; her satır
 * `page.tsx`in çağırdığı üretim fonksiyonunun aynısını çağırır:
 *
 *   strategy            ← `strategyResolutionFromUnderstanding(...).strategy`
 *                         (page: `brain.strategy?.strategy`, useRequestBrain
 *                          aynı fonksiyonu çağırır)
 *   completeness        ← `completenessFromUnderstanding(...)`
 *                         (page: `brain.completeness`, aynı kaynak)
 *   dynamicFields       ← `getVisibleCategoryFields(...)`
 *                         (page: `visibleDynamicFields`)
 *   requiredDynamicKeys ← `isFieldRequired(...)` süzgeci
 *                         (page: `requiredDynamicKeys`)
 *
 * Değer torbası da elle kurulmaz: besteci durumundan `softFillFromComposerState`
 * ile okunur ve `withCategoryFieldDefaults` ile tamamlanır — ikisi de üretim
 * fonksiyonudur. Bu ölçüm SERBEST METİNden gelen talebi modeller: kullanıcının
 * elle yazdığı form değerleri, gezinme seçimi ve kategori kilidi yoktur, bu
 * yüzden `page.tsx`in bu üç kaynağı birleştiren React katmanı devrede değildir.
 */
function productionInputs(
  state: CanonicalRequestState,
  requestText: string,
): {
  options: ResolveHybridQuestionsOptions;
  renderInputWithout: (
    result: HybridQuestionResult,
  ) => RenderableCandidateInput;
} {
  const understanding = state.understanding;
  const categoryId =
    state.categoryId ?? understanding.category.value ?? null;
  const category = resolveRequestCategory(categoryId);
  const values = withCategoryFieldDefaults(
    categoryId ?? "",
    softFillFromComposerState(state),
  );
  const dynamicFields = getVisibleCategoryFields(
    category.fields,
    values,
    categoryId ?? undefined,
    {
      subcategorySlug: state.subcategorySlug,
      taxonomyNodeId: state.taxonomyNodeId,
    },
  );
  const strategy = strategyResolutionFromUnderstanding(understanding).strategy;
  const visibleCommonFieldKeys = new Set(
    category.commonFields.map((field) =>
      typeof field === "string" ? field : (field as { key: string }).key,
    ),
  );
  const understandingCity = understanding.location?.city?.value ?? "";
  const isRealEstate = categoryId === "real-estate";
  return {
    options: {
      strategy,
      completeness: completenessFromUnderstanding(understanding, values),
      dynamicFields,
      requiredDynamicKeys: dynamicFields
        .filter((field) => isFieldRequired(field, values))
        .map((field) => field.key),
    },
    renderInputWithout: (result) => ({
      hybridQuestionResult: result,
      visibleDynamicFields: dynamicFields,
      missingFields: dynamicFields.filter(
        (field) =>
          isFieldRequired(field, values) && !values[field.key]?.trim(),
      ),
      dynamicValues: values,
      requestText,
      activeCategoryId: categoryId ?? "",
      isRealEstate,
      realEstateLocationMissing: false,
      visibleCommonFieldKeys,
      mergedCommonDraft: { city: understandingCity },
      understandingCity,
      budgetRequired: visibleCommonFieldKeys.has("budget"),
      hasBudget: false,
      strategy,
      canonicalFields: state.fields,
    }),
  };
}

/** Üç yüzeyi TEK üretim zincirinden okur. */
function firstScreenSurfaces(
  state: CanonicalRequestState,
  requestText: string,
): { next: string[]; candidates: string[]; renderable: string[] } {
  const { options, renderInputWithout } = productionInputs(state, requestText);
  const production = resolveHybridQuestions(state, options);
  return {
    next: production.next.map((f) => f.engineFieldKey ?? f.key),
    candidates: production.candidates.map((c) => c.fieldKey),
    renderable: filterRenderableCandidates(
      renderInputWithout(production),
    ).map((c) => c.fieldKey),
  };
}

/**
 * Tek senaryoyu ölçer. Karar burada üretilmez: hangi soruların sorulduğu
 * gerçek soru otoritesinden, hangi değerin doğrulama gerektirdiği ise kanonik
 * cevap otoritesinden okunur.
 */
function measureScenario(scenarioId: string, input: string): Measurement {
  const walk = walkQuestionWavesFromText(input);
  const fields = fieldsOf(walk.state);
  const surfaces = firstScreenSurfaces(walk.state, input);

  /**
   * ALLOWLIST SEÇENEKLERDEN ETKİLENMEZ.
   *
   * `next` yalnız kanonik durumdan üretilir; strateji/tamlık yalnız
   * `candidates` sıralamasını besler. Yürüyücü seçeneksiz çağırdığı için bu
   * eşitlik ölçümün ön koşuludur ve sessiz kalmamalıdır.
   */
  const allowlistDrift =
    JSON.stringify(walk.firstScreen) === JSON.stringify(surfaces.next)
      ? []
      : [
          `${scenarioId}: next(seceneksiz)=${JSON.stringify(walk.firstScreen)} ` +
            `next(uretim)=${JSON.stringify(surfaces.next)}`,
        ];

  // Yürüyüş BAŞLAMADAN önceki durum — simülasyon dolgusu kanıta karışamaz.
  const inferenceOnly = Object.keys(fields).filter((key) =>
    isInferenceOnlyAnswer(fields[key]),
  );
  const askedAnywhere = new Set(walk.asked);
  const nextSet = new Set(surfaces.next);
  const candidateSet = new Set(surfaces.candidates);
  const renderableSet = new Set(surfaces.renderable);

  /**
   * Doğrulanabilir çıkarım: değeri yalnız tahminden gelen VE soru motorunun
   * herhangi bir dalgada gerçekten sorduğu alan. Hiç sorulmayan alan bu
   * dilimin konusu değildir — onu D1/D2 ölçer.
   */
  const confirmable = inferenceOnly.filter((key) => askedAnywhere.has(key));
  const onNext = confirmable.filter((key) => nextSet.has(key));
  const onCandidates = confirmable.filter((key) => candidateSet.has(key));
  const onRenderable = confirmable.filter((key) => renderableSet.has(key));

  const waveOf = (key: string): number | null =>
    walk.waves.findIndex((wave) => wave.includes(key)) + 1 || null;

  const violationFor = (
    key: string,
    surface: Violation["surface"],
    firstScreen: string[],
  ): Violation => ({
    id: identityOf(scenarioId, key),
    scenarioId,
    fieldKey: key,
    surface,
    value: valueOf(fields[key]),
    firstScreen: [...firstScreen],
    askedAtWave: waveOf(key),
  });

  /**
   * İhlal ölçütü: ilk ekranın sınırlı yerleri, doğrulanabilir çıkarımlar
   * dururken başka alanlara gitmiş. Doğrulama sayısı yerden fazlaysa taşan
   * kısım ihlal DEĞİLDİR — üç yer üçten fazla çıkarımı taşıyamaz.
   */
  const capacity = Math.min(FIRST_SCREEN_SLOTS, confirmable.length);
  const violations: Violation[] = [];
  const seenViolations = new Set<string>();
  const record = (
    key: string,
    surface: Violation["surface"],
    firstScreen: string[],
  ) => {
    const dedupKey = `${identityOf(scenarioId, key)}|${surface}`;
    if (seenViolations.has(dedupKey)) return;
    seenViolations.add(dedupKey);
    violations.push(violationFor(key, surface, firstScreen));
  };

  /**
   * AYNI KURAL, İKİ YÜZEY. Her iki yüzeyde de ilk ekranın sınırlı yerleri
   * önce doğrulanabilir çıkarımlarla dolmalıdır. Kapı yüzey başına ayrı
   * işletilir; yoksa motor kuyruğu doğruyken gerçek ekran bozulabilir ve
   * bu sessiz kalır.
   */
  if (onNext.length < capacity) {
    for (const key of confirmable) {
      if (nextSet.has(key)) continue;
      record(key, SURFACE_NEXT, surfaces.next);
    }
  }
  if (onCandidates.length < capacity) {
    for (const key of confirmable) {
      if (candidateSet.has(key)) continue;
      record(key, SURFACE_CANDIDATES, surfaces.candidates);
    }
  }
  if (onRenderable.length < capacity) {
    for (const key of confirmable) {
      if (renderableSet.has(key)) continue;
      record(key, SURFACE_RENDERABLE, surfaces.renderable);
    }
  }
  /**
   * DÜŞME KAPISI — KAPASİTEDEN BAĞIMSIZ. `next` içinde yer bulmuş bir
   * doğrulama kullanıcının gördüğü listeden düşüyorsa ihlal kesindir: yer
   * zaten ayrılmıştı, sonraki bir sıralama katmanı onu geri aldı.
   */
  for (const key of onNext) {
    if (!candidateSet.has(key)) {
      record(key, SURFACE_CANDIDATES, surfaces.candidates);
    }
  }
  for (const key of onCandidates) {
    if (!renderableSet.has(key)) {
      record(key, SURFACE_RENDERABLE, surfaces.renderable);
    }
  }

  // Kapatmaya yetkili değer, doğrulama diye öne taşınmamalı.
  const wronglyRepeated = walk.firstScreen.filter((key) =>
    mayCloseQuestion(classifyAnswerAuthority(fields[key])),
  );

  const duplicated: string[] = [];
  for (const wave of walk.waves) {
    const seen = new Set<string>();
    for (const key of wave) {
      if (seen.has(key)) duplicated.push(`${scenarioId}/${key}`);
      seen.add(key);
    }
  }

  return {
    violations,
    inferenceOnFirstScreen: onNext.map((key) => identityOf(scenarioId, key)),
    inferenceOnCandidates: onCandidates.map((key) =>
      identityOf(scenarioId, key),
    ),
    inferenceOnRenderable: onRenderable.map((key) =>
      identityOf(scenarioId, key),
    ),
    wronglyRepeated: wronglyRepeated.map((key) => identityOf(scenarioId, key)),
    duplicated,
    allowlistDrift,
  };
}

function measure(): Measurement {
  const out: Measurement = {
    violations: [],
    inferenceOnFirstScreen: [],
    inferenceOnCandidates: [],
    inferenceOnRenderable: [],
    wronglyRepeated: [],
    duplicated: [],
    allowlistDrift: [],
  };
  for (const sc of CATEGORY_COVERAGE_V1) {
    const m = measureScenario(sc.id, sc.input);
    out.violations.push(...m.violations);
    out.inferenceOnFirstScreen.push(...m.inferenceOnFirstScreen);
    out.inferenceOnCandidates.push(...m.inferenceOnCandidates);
    out.inferenceOnRenderable.push(...m.inferenceOnRenderable);
    out.wronglyRepeated.push(...m.wronglyRepeated);
    out.duplicated.push(...m.duplicated);
    out.allowlistDrift.push(...m.allowlistDrift);
  }
  out.violations.sort(
    (a, b) => a.id.localeCompare(b.id) || a.surface.localeCompare(b.surface),
  );
  out.inferenceOnFirstScreen.sort();
  out.inferenceOnCandidates.sort();
  out.inferenceOnRenderable.sort();
  out.wronglyRepeated.sort();
  out.duplicated.sort();
  out.allowlistDrift.sort();
  return out;
}

/**
 * KAPASİTE KANARYASI — dört eşzamanlı doğrulama.
 *
 * Üç yerlik ekranda DÖRT doğrulama biriktiğinde sözleşme şudur: ilk üç
 * deterministik biçimde görünür, dördüncü KAYBOLMAZ (sonraki dalgada durur)
 * ve hiçbir kimlik çoğalmaz. Girdiler yalnız public üretim API'sinden
 * (`syncFromText`) gelir; fixture'a yazılmaz, kategoriye özel dal kurulmaz.
 *
 * Dört eşzamanlı doğrulama üretebilen bir serbest metin bulunamazsa sonuç
 * ZORLANMAZ: NOT-MEASURED olarak raporlanır. Ölçülmeyeni ölçülmüş saymak bu
 * doğrulayıcının varlık nedeninin tersidir.
 */
const CAPACITY_CANARY_INPUTS: readonly string[] = [
  "2020 model dizel otomatik Volkswagen Passat arıyorum",
  "ikinci el beyaz Arçelik buzdolabı arıyorum",
  "kiralık daire arıyorum",
  "forklift arıyorum",
  "Samsung televizyon arıyorum",
  "sıfır Renault Clio arıyorum",
  "2018 model benzinli manuel Ford Focus arıyorum",
  // Çok eksenli talepler — birden çok alanın aynı anda çıkarımla dolması
  // en çok bu tür metinlerde bekleniyordu.
  "ofis için ikinci el dizüstü bilgisayar arıyorum",
  "ofis için ikinci el yazıcı arıyorum",
  "ikinci el sunum için projeksiyon cihazı arıyorum",
  "ikinci el ofis mobilyası ve bilgisayar arıyorum",
  "e-ticaret sitesi ve mobil uygulama yaptırmak istiyorum",
  "kurumsal kimlik ve web sitesi tasarımı arıyorum",
  "atölye için ikinci el torna tezgahı arıyorum",
  "klinik için ikinci el muayene masası arıyorum",
];

type CanaryResult =
  | { measured: false; reason: string; best: number }
  | {
      measured: true;
      input: string;
      confirmable: string[];
      firstScreenNext: string[];
      firstScreenCandidates: string[];
      survivorsInLaterWaves: string[];
      duplicated: string[];
    };

function runCapacityCanary(): CanaryResult {
  let best = 0;
  for (const input of CAPACITY_CANARY_INPUTS) {
    const walk = walkQuestionWavesFromText(input);
    const fields = fieldsOf(walk.state);
    const asked = new Set(walk.asked);
    const confirmable = Object.keys(fields).filter(
      (key) => isInferenceOnlyAnswer(fields[key]) && asked.has(key),
    );
    best = Math.max(best, confirmable.length);
    if (confirmable.length <= FIRST_SCREEN_SLOTS) continue;

    const surfaces = firstScreenSurfaces(walk.state, input);
    const laterWaves = walk.waves.slice(1).flat();
    const seen = new Set<string>();
    const duplicated: string[] = [];
    for (const key of walk.asked) {
      if (seen.has(key)) duplicated.push(key);
      seen.add(key);
    }
    return {
      measured: true,
      input,
      confirmable,
      firstScreenNext: surfaces.next,
      firstScreenCandidates: surfaces.candidates,
      survivorsInLaterWaves: confirmable.filter(
        (key) => !surfaces.next.includes(key) && laterWaves.includes(key),
      ),
      duplicated,
    };
  }
  return {
    measured: false,
    reason:
      `public uretim API'siyle (syncFromText) ${FIRST_SCREEN_SLOTS}'ten fazla ` +
      `escanli cikarim dogrulamasi uretilemedi — ` +
      `${CAPACITY_CANARY_INPUTS.length} girdi denendi, tavan ${best}`,
    best,
  };
}


/**
 * WIRING KAPISI — NİHAİ LİSTE GERÇEKTEN ORTAK YARDIMCIDAN MI GELİYOR?
 *
 * Bir doğrulayıcının ortak yardımcıyı çağırıp yeşil dönmesi, SAYFANIN da onu
 * çağırdığını kanıtlamaz. Sayfa kendi kopyasını tutmaya devam ederse ölçüm
 * gerçeği değil kendini ölçer. Bu yüzden bağlantı metin araması ya da satır
 * numarasıyla değil, `page.tsx`in AST'si üzerinden kanıtlanır.
 */
function checkRenderWiring(): string[] {
  const problems: string[] = [];
  const pagePath = path.join(
    process.cwd(),
    "src",
    "app",
    "talep",
    "page.tsx",
  );
  const source = ts.createSourceFile(
    pagePath,
    fs.readFileSync(pagePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  let importsHelper = false;
  let memoUsesHelper = false;
  let renderUsesMemo = false;
  const forbiddenLeftovers: string[] = [];

  /** Eski inline süzgecin yapısal parmak izleri — ikinci kopya kalmamalı. */
  const LEFTOVER_NAMES = new Set([
    "textAlreadyAnswers",
    "featureExamplePlaceholder",
    "TURKEY_CITY_OPTIONS",
    "TURKEY_REAL_ESTATE_LOCATION_OPTIONS",
    "COLOR_PREFERENCE_OPTIONS",
  ]);

  const callsHelper = (node: ts.Node): boolean => {
    let found = false;
    const scan = (n: ts.Node): void => {
      if (found) return;
      if (
        ts.isCallExpression(n) &&
        ts.isIdentifier(n.expression) &&
        n.expression.text === "filterRenderableCandidates"
      ) {
        found = true;
        return;
      }
      ts.forEachChild(n, scan);
    };
    scan(node);
    return found;
  };

  const visit = (node: ts.Node): void => {
    if (
      ts.isImportSpecifier(node) &&
      node.name.text === "filterRenderableCandidates"
    ) {
      importsHelper = true;
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "enrichmentCandidates" &&
      node.initializer &&
      callsHelper(node.initializer)
    ) {
      memoUsesHelper = true;
    }
    if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "enrichmentCandidates" &&
      node.initializer &&
      ts.isJsxExpression(node.initializer) &&
      node.initializer.expression &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === "enrichmentCandidates"
    ) {
      renderUsesMemo = true;
    }
    if (
      (ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) &&
      node.name &&
      ts.isIdentifier(node.name) &&
      LEFTOVER_NAMES.has(node.name.text)
    ) {
      forbiddenLeftovers.push(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  if (!importsHelper) {
    problems.push(
      "wiring: page.tsx `filterRenderableCandidates` fonksiyonunu import etmiyor",
    );
  }
  if (!memoUsesHelper) {
    problems.push(
      "wiring: `enrichmentCandidates` bildirimi `filterRenderableCandidates` cagrisi icermiyor",
    );
  }
  if (!renderUsesMemo) {
    problems.push(
      "wiring: render edilen liste `enrichmentCandidates` uzerinden gecmiyor",
    );
  }
  for (const name of [...new Set(forbiddenLeftovers)].sort()) {
    problems.push(
      `wiring: eski inline suzgecin ikinci kopyasi page.tsx icinde duruyor → ${name}`,
    );
  }
  console.log("\n--- wiring kapisi (page.tsx AST) ---");
  console.log(`  helper import edilmis      : ${importsHelper ? "EVET" : "HAYIR"}`);
  console.log(`  memo helper'i cagiriyor    : ${memoUsesHelper ? "EVET" : "HAYIR"}`);
  console.log(`  render memo'yu kullaniyor  : ${renderUsesMemo ? "EVET" : "HAYIR"}`);
  console.log(
    `  eski inline kalinti        : ${forbiddenLeftovers.length === 0 ? "yok" : forbiddenLeftovers.join(", ")}`,
  );
  return problems;
}


/**
 * SAF SUNUM SÖZLEŞMESİ — ÖNERİ İLE CEVAP AYRI ROLLERDİR.
 *
 * `resolveQuestionDraftPresentation` soruyu açarken hangi değerin taslağa
 * (yani SEÇİM durumuna), hangisinin öneriye gideceğine karar verir. Karar tek
 * ölçüte bağlıdır: kanonik cevap otoritesi. Burada o sözleşme dört otorite
 * basamağı için de doğrudan ölçülür; ikinci bir karar kopyası kurulmaz.
 */
function checkDraftPresentationContract(): string[] {
  const problems: string[] = [];
  const cases: Array<{
    name: string;
    field: CanonicalFieldState | null;
    currentValue: string;
    expectDraft: string;
    expectSuggestion: string | null;
  }> = [
    {
      name: "INFERRED",
      field: { kind: "VALUE", value: "İkinci el", provenance: "INFERRED" },
      currentValue: "İkinci el",
      expectDraft: "",
      expectSuggestion: "İkinci el",
    },
    {
      name: "USER_EXPLICIT (EXPLICIT_TEXT)",
      field: { kind: "VALUE", value: "Sıfır", provenance: "EXPLICIT_TEXT" },
      currentValue: "Sıfır",
      expectDraft: "Sıfır",
      expectSuggestion: null,
    },
    {
      name: "USER_EXPLICIT (EXPLICIT_BROWSE)",
      field: { kind: "VALUE", value: "Sıfır", provenance: "EXPLICIT_BROWSE" },
      currentValue: "Sıfır",
      expectDraft: "Sıfır",
      expectSuggestion: null,
    },
    {
      name: "VERIFIED (mayCloseQuestion=true)",
      field: {
        kind: "VALUE",
        value: "Mercedes-Benz",
        provenance: "CATALOG_ENRICHED",
      },
      currentValue: "Mercedes-Benz",
      expectDraft: "Mercedes-Benz",
      expectSuggestion: null,
    },
    {
      /**
       * KULLANICININ KENDİ DEĞERİ (D3b takip, 2026-08-26).
       *
       * Kanonik alan hâlâ INFERRED etiketli olabilir — üretimde form
       * panelinden yapılan düzeltme kanonik duruma yazılmaz. O anki değer
       * tahminden FARKLIYSA kullanıcıya aittir; taslaktan silinemez ve
       * reddedilen tahmin ona geri önerilemez.
       */
      name: "INFERRED ama kullanici baska deger yazmis",
      field: { kind: "VALUE", value: "İkinci el", provenance: "INFERRED" },
      currentValue: "Sıfır",
      expectDraft: "Sıfır",
      expectSuggestion: null,
    },
    {
      name: "INFERRED, ekranda deger yok",
      field: { kind: "VALUE", value: "İkinci el", provenance: "INFERRED" },
      currentValue: "",
      expectDraft: "",
      expectSuggestion: "İkinci el",
    },
    {
      name: "UNKNOWN",
      field: { kind: "UNKNOWN", value: null, provenance: "INFERRED" },
      currentValue: "",
      expectDraft: "",
      expectSuggestion: null,
    },
    {
      name: "alan yok",
      field: null,
      currentValue: "",
      expectDraft: "",
      expectSuggestion: null,
    },
  ];

  console.log("\n--- saf sunum sozlesmesi (resolveQuestionDraftPresentation) ---");
  for (const c of cases) {
    const got = resolveQuestionDraftPresentation(c.field, c.currentValue);
    const authority = classifyAnswerAuthority(c.field);
    const ok =
      got.draftValue === c.expectDraft &&
      got.suggestedValue === c.expectSuggestion;
    console.log(
      `  ${ok ? "PASS" : "FAIL"}  ${c.name.padEnd(30)} otorite=${authority.padEnd(13)} ` +
        `draft=${JSON.stringify(got.draftValue)} oneri=${JSON.stringify(got.suggestedValue)}`,
    );
    if (!ok) {
      problems.push(
        `sunum sozlesmesi (${c.name}): draft=${JSON.stringify(got.draftValue)} ` +
          `oneri=${JSON.stringify(got.suggestedValue)}, beklenen ` +
          `draft=${JSON.stringify(c.expectDraft)} oneri=${JSON.stringify(c.expectSuggestion)}`,
      );
    }
    if (mayCloseQuestion(authority) && got.suggestedValue !== null) {
      problems.push(
        `sunum sozlesmesi (${c.name}): soruyu kapatmaya yetkili deger cikarim onerisi olarak gosteriliyor`,
      );
    }
  }
  return problems;
}

/**
 * ÖNERİ SUNUM WIRING'İ — YAPISAL KANIT.
 *
 * Üç şey substring aramasıyla değil AST ile kanıtlanır: sayfa taslağı ortak
 * yardımcıdan alıyor mu, çıkarım değerini doğrudan taslağa yazmayı bırakmış
 * mı, ve arayüz öneriyi sorunun KENDİ sözleşmesinden mi okuyor (kabuk prop
 * zincirinden değil).
 */
function checkSuggestionWiring(): string[] {
  const problems: string[] = [];

  const parse = (relative: string, kind: ts.ScriptKind): ts.SourceFile => {
    const full = path.join(process.cwd(), ...relative.split("/"));
    return ts.createSourceFile(
      full,
      fs.readFileSync(full, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      kind,
    );
  };

  /* ---- page.tsx ---- */
  const page = parse("src/app/talep/page.tsx", ts.ScriptKind.TSX);
  let importsPresentation = false;
  let draftFromHelper = false;
  let draftFromRawValues = false;

  const containsCall = (node: ts.Node, name: string): boolean => {
    let found = false;
    const scan = (n: ts.Node): void => {
      if (found) return;
      if (
        ts.isCallExpression(n) &&
        ts.isIdentifier(n.expression) &&
        n.expression.text === name
      ) {
        found = true;
        return;
      }
      ts.forEachChild(n, scan);
    };
    scan(node);
    return found;
  };

  /** `dynamicValues[...]` biçiminde ham bir okuma var mı? */
  const readsRawValueBag = (node: ts.Node): boolean => {
    let found = false;
    const scan = (n: ts.Node): void => {
      if (found) return;
      if (
        ts.isElementAccessExpression(n) &&
        ts.isIdentifier(n.expression) &&
        n.expression.text === "dynamicValues"
      ) {
        found = true;
        return;
      }
      ts.forEachChild(n, scan);
    };
    scan(node);
    return found;
  };

  const visitPage = (node: ts.Node): void => {
    if (
      ts.isImportSpecifier(node) &&
      node.name.text === "resolveQuestionDraftPresentation"
    ) {
      importsPresentation = true;
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "setEnrichmentDraft"
    ) {
      const arg = node.arguments[0];
      if (arg && containsCall(arg, "resolveQuestionDraftPresentation")) {
        draftFromHelper = true;
      } else if (arg && readsRawValueBag(arg)) {
        draftFromRawValues = true;
      }
    }
    ts.forEachChild(node, visitPage);
  };
  visitPage(page);

  /* ---- EnrichmentChips.tsx ---- */
  const chips = parse(
    "src/components/request/EnrichmentChips.tsx",
    ts.ScriptKind.TSX,
  );
  let readsCandidateSuggestion = false;
  let usesReactId = false;
  let suggestionInSelection = false;
  let shellProp = false;

  const visitChips = (node: ts.Node): void => {
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "inferredSuggestion"
    ) {
      readsCandidateSuggestion = true;
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "useId"
    ) {
      usesReactId = true;
    }
    /** Kabuk üzerinden taşınan bir öneri prop'u kalmamalı. */
    if (
      ts.isPropertySignature(node) &&
      node.name &&
      ts.isIdentifier(node.name) &&
      node.name.text === "suggestedValue"
    ) {
      shellProp = true;
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "activeSelectedValues" &&
      node.initializer
    ) {
      const scan = (n: ts.Node): void => {
        if (
          (ts.isIdentifier(n) && n.text === "suggestion") ||
          (ts.isPropertyAccessExpression(n) &&
            n.name.text === "inferredSuggestion")
        ) {
          suggestionInSelection = true;
        }
        ts.forEachChild(n, scan);
      };
      scan(node.initializer);
    }
    ts.forEachChild(node, visitChips);
  };
  visitChips(chips);

  console.log("\n--- oneri sunum wiring kapisi (AST) ---");
  console.log(
    `  page: sunum yardimcisi import edilmis : ${importsPresentation ? "EVET" : "HAYIR"}`,
  );
  console.log(
    `  page: taslak ortak yardimcidan        : ${draftFromHelper ? "EVET" : "HAYIR"}`,
  );
  console.log(
    `  page: ham deger torbasindan taslak    : ${draftFromRawValues ? "EVET" : "HAYIR"}`,
  );
  console.log(
    `  chips: oneri adayin sozlesmesinden    : ${readsCandidateSuggestion ? "EVET" : "HAYIR"}`,
  );
  console.log(
    `  chips: kabuk prop'u (olmamali)        : ${shellProp ? "EVET" : "HAYIR"}`,
  );
  console.log(
    `  chips: React useId                    : ${usesReactId ? "EVET" : "HAYIR"}`,
  );
  console.log(
    `  chips: oneri secim hesabinda (olmamali): ${suggestionInSelection ? "EVET" : "HAYIR"}`,
  );

  if (!importsPresentation) {
    problems.push(
      "wiring: page.tsx `resolveQuestionDraftPresentation` import etmiyor",
    );
  }
  if (!draftFromHelper) {
    problems.push(
      "wiring: `setEnrichmentDraft` ortak sunum yardimcisinin sonucunu almiyor",
    );
  }
  if (draftFromRawValues) {
    problems.push(
      "wiring: `setEnrichmentDraft` hala ham `dynamicValues[...]` degerini aliyor — cikarim secili gorunur",
    );
  }
  if (!readsCandidateSuggestion) {
    problems.push(
      "wiring: EnrichmentChips oneriyi adayin `inferredSuggestion` sozlesmesinden okumuyor",
    );
  }
  if (shellProp) {
    problems.push(
      "wiring: EnrichmentChips oneriyi kabuk prop zincirinden aliyor — kanonik aday sozlesmesi kullanilmali",
    );
  }
  if (!usesReactId) {
    problems.push("wiring: EnrichmentChips sabit kimlik kullaniyor (useId yok)");
  }
  if (suggestionInSelection) {
    problems.push(
      "wiring: oneri secili deger hesabina giriyor — `aria-checked` uretebilir",
    );
  }
  return problems;
}

function main(): void {
  const problems: string[] = [];
  console.log("=== CIKARIM DOGRULAMA ONCELIGI V1 (D3b) ===");
  console.log(
    `ilk ekran ufku: ${FIRST_SCREEN_SLOTS} soru · hedef kimlik: ${TARGET_ID}`,
  );
  console.log(
    `olculen yuzeyler: ${SURFACE_NEXT} (motor kuyrugu) + ` +
      `${SURFACE_CANDIDATES} (/talep ekraninin render ettigi liste)\n`,
  );

  /* ---- (0) FIXTURE DEĞİŞMEDİ ---- */
  const scenario = CATEGORY_COVERAGE_V1.find((s) => s.id === TARGET_SCENARIO_ID);
  assert.ok(scenario, `${TARGET_SCENARIO_ID} fixture'da bulunamadi`);
  assert.equal(
    scenario.input,
    TARGET_INPUT,
    `${TARGET_SCENARIO_ID} girdisi degistirilmis — bu dogrulayici fixture ` +
      `metnine baglidir ve metin degisirse olcum anlamini yitirir`,
  );
  console.log(`--- fixture girdisi ---\n  ${JSON.stringify(scenario.input)}\n`);

  /* ---- (1) HEDEF ALANIN CEVAP OTORİTESİ ---- */
  const walk = walkQuestionWavesFromText(scenario.input);
  const targetField = fieldsOf(walk.state)[TARGET_FIELD_KEY];
  const authority: Authority = classifyAnswerAuthority(targetField);
  const value = valueOf(targetField);

  console.log("--- hedef alanin cevap otoritesi ---");
  console.log(
    `  ${TARGET_FIELD_KEY}='${value}' provenance=${String(targetField?.provenance)} ` +
      `otorite=${authority} mayCloseQuestion=${mayCloseQuestion(authority)} ` +
      `cikarimTek=${isInferenceOnlyAnswer(targetField)}`,
  );
  if (value !== TARGET_INFERRED_VALUE) {
    problems.push(
      `${TARGET_FIELD_KEY} degeri '${TARGET_INFERRED_VALUE}' degil → '${value}'`,
    );
  }
  if (targetField?.provenance !== "INFERRED") {
    problems.push(
      `${TARGET_FIELD_KEY} provenance INFERRED degil → ${String(targetField?.provenance)}`,
    );
  }
  if (authority !== "INFERRED" || !isInferenceOnlyAnswer(targetField)) {
    problems.push(
      `${TARGET_FIELD_KEY} kanonik otoritesi INFERRED degil → ${authority}`,
    );
  }
  if (mayCloseQuestion(authority)) {
    problems.push(
      `${TARGET_FIELD_KEY} kullanici cevabi sayiliyor: mayCloseQuestion=true`,
    );
  }

  /* ---- (2) KIRMIZININ NEDENİ: BASTIRMA DEĞİL, ÖNCELİK KAYBI ---- */
  const askedWave =
    walk.waves.findIndex((w) => w.includes(TARGET_FIELD_KEY)) + 1 || null;
  const targetSurfaces = firstScreenSurfaces(walk.state, scenario.input);

  console.log("\n--- soru sirasi (gercek uretim akisi) ---");
  console.log(`  next[]        : ${JSON.stringify(targetSurfaces.next)}`);
  console.log(`  candidates[]  : ${JSON.stringify(targetSurfaces.candidates)}`);
  console.log(`  renderable[]  : ${JSON.stringify(targetSurfaces.renderable)}`);
  console.log(`  dalgalar      : ${JSON.stringify(walk.waves)}`);
  console.log(
    `  ${TARGET_FIELD_KEY} soruldugu dalga: ${askedWave ?? "hic sorulmadi"}`,
  );

  if (askedWave === null) {
    problems.push(
      `${TARGET_ID}: ${TARGET_FIELD_KEY} hicbir dalgada sorulmuyor — bu bir ` +
        `bastirma hatasidir, bu dogrulayicinin olctugu oncelik kaybi DEGILDIR`,
    );
  }

  /* ---- (3) GENEL ÖLÇÜM — 108 senaryo, iki yüzey ---- */
  const a = measure();
  const b = measure();
  const deterministic = JSON.stringify(a) === JSON.stringify(b);

  const droppedFromRenderable = a.violations.filter(
    (v) => v.surface === SURFACE_RENDERABLE,
  );
  const droppedFromCandidates = a.violations.filter(
    (v) => v.surface === SURFACE_CANDIDATES,
  );
  const lostInNext = a.violations.filter((v) => v.surface === SURFACE_NEXT);

  console.log("\n--- genel olcum (108 senaryo) ---");
  console.log(`  next oncelik kaybi        : ${lostInNext.length}`);
  console.log(`  candidates'tan dusen      : ${droppedFromCandidates.length}`);
  console.log(`  renderable'dan dusen      : ${droppedFromRenderable.length}`);
  console.log(`  next ilk ekranda dogrulama: ${a.inferenceOnFirstScreen.length}`);
  console.log(`  candidates'ta duran       : ${a.inferenceOnCandidates.length}`);
  console.log(`  renderable'da duran       : ${a.inferenceOnRenderable.length}`);
  console.log(`  yanlis tekrar             : ${a.wronglyRepeated.length}`);
  console.log(`  ayni dalgada tekrar       : ${a.duplicated.length}`);
  console.log(`  allowlist sapmasi         : ${a.allowlistDrift.length}`);
  console.log(`  iki olcum birebir         : ${deterministic ? "EVET" : "HAYIR"}`);

  console.log(
    "\n--- ilk ekranda dogrulanan kimlikler (next / candidates / renderable) ---",
  );
  for (const id of a.inferenceOnFirstScreen) {
    console.log(
      `  ${id}  next=EVET ` +
        `candidates=${a.inferenceOnCandidates.includes(id) ? "EVET" : "HAYIR"} ` +
        `renderable=${a.inferenceOnRenderable.includes(id) ? "EVET" : "HAYIR"}`,
    );
  }

  const renderableDroppedIds = [
    ...new Set(droppedFromRenderable.map((v) => v.id)),
  ].sort();
  console.log(
    `\n--- nihai render yuzeyinden dusen kimlikler (${renderableDroppedIds.length}) ---`,
  );
  for (const id of renderableDroppedIds) console.log(`  ${id}`);

  if (a.violations.length > 0) {
    console.log("\n--- ihlaller ---");
    for (const v of a.violations) {
      console.log(
        `  ${v.id}  yuzey=${v.surface} deger='${v.value}' ` +
          `ilkEkran=${JSON.stringify(v.firstScreen)} ` +
          `sorulduguDalga=${v.askedAtWave ?? "-"}`,
      );
    }
  }

  for (const v of a.violations) {
    if (v.id === TARGET_ID) {
      problems.push(
        `${TARGET_ID} (${v.surface}): '${v.value}' yalniz cikarimdan geliyor ve ` +
          `${v.askedAtWave ?? "-"}. dalgada soruluyor, ama ` +
          `${v.surface} ilk ekraninda ${JSON.stringify(v.firstScreen)} yok — ` +
          `dogrulama onceligini kaybetti`,
      );
    } else {
      problems.push(
        `${v.id} (${v.surface}): cikarim dogrulamasi ilk ekran onceligini kaybetti`,
      );
    }
  }
  for (const id of a.wronglyRepeated) {
    problems.push(
      `${id}: soruyu kapatmaya yetkili deger ilk ekranda tekrar soruluyor`,
    );
  }
  for (const id of a.duplicated) {
    problems.push(`${id}: ayni soru ayni dalgada iki kez cikti`);
  }
  for (const drift of a.allowlistDrift) {
    problems.push(
      `${drift}: uretim secenekleri allowlist'i degistirdi — ` +
        `secenekler yalniz siralamayi beslemelidir`,
    );
  }
  if (!deterministic) {
    problems.push("olcum deterministik degil: iki ardisik kosu farkli sonuc verdi");
  }

  /* ---- (4) KAPASİTE KANARYASI ---- */
  const canary = runCapacityCanary();
  console.log("\n--- kapasite kanaryasi (4 escanli dogrulama) ---");
  if (!canary.measured) {
    console.log(`  NOT-MEASURED: ${canary.reason}`);
    console.log(
      "  bu sonuc basari ya da hata sayaci DEGILDIR; olculemeyen olculmus sayilmaz.",
    );
  } else {
    console.log(`  girdi        : ${JSON.stringify(canary.input)}`);
    console.log(`  dogrulanabilir: ${JSON.stringify(canary.confirmable)}`);
    console.log(`  next          : ${JSON.stringify(canary.firstScreenNext)}`);
    console.log(`  candidates    : ${JSON.stringify(canary.firstScreenCandidates)}`);
    console.log(
      `  sonraki dalgada duran: ${JSON.stringify(canary.survivorsInLaterWaves)}`,
    );
    const overflow = canary.confirmable.filter(
      (key) => !canary.firstScreenNext.includes(key),
    );
    const lost = overflow.filter(
      (key) => !canary.survivorsInLaterWaves.includes(key),
    );
    if (canary.firstScreenNext.length !== FIRST_SCREEN_SLOTS) {
      problems.push(
        `kapasite kanaryasi: ilk ekran ${canary.firstScreenNext.length} soru ` +
          `gosterdi, ${FIRST_SCREEN_SLOTS} bekleniyordu`,
      );
    }
    for (const key of lost) {
      problems.push(
        `kapasite kanaryasi: ${key} ilk ekrana sigmadi ve sonraki dalgalarda ` +
          `da yok — tasan dogrulama kayboldu`,
      );
    }
    for (const key of canary.duplicated) {
      problems.push(`kapasite kanaryasi: ${key} kimligi cogaltildi`);
    }
  }

  /* ---- (5) WIRING — NİHAİ LİSTE ORTAK YARDIMCIDAN GELİYOR MU ---- */
  problems.push(...checkRenderWiring());
  problems.push(...checkDraftPresentationContract());
  problems.push(...checkSuggestionWiring());

  /* ---- (6) HEDEF KİMLİK ÜÇ YÜZEYDE DE İLK ÜÇTE ---- */
  const targetTopThree: Array<[string, string[]]> = [
    ["next", targetSurfaces.next.slice(0, FIRST_SCREEN_SLOTS)],
    ["candidates", targetSurfaces.candidates.slice(0, FIRST_SCREEN_SLOTS)],
    ["renderable", targetSurfaces.renderable.slice(0, FIRST_SCREEN_SLOTS)],
  ];
  console.log("\n--- hedef kimlik ilk uc icinde mi (uc yuzey) ---");
  for (const [surface, top] of targetTopThree) {
    const inside = top.includes(TARGET_FIELD_KEY);
    console.log(
      `  ${surface.padEnd(12)}: ${inside ? "EVET" : "HAYIR"}  ${JSON.stringify(top)}`,
    );
    if (!inside) {
      problems.push(
        `${TARGET_ID}: ${surface} yuzeyinin ilk ${FIRST_SCREEN_SLOTS} sorusu ` +
          `${JSON.stringify(top)} — hedef dogrulama disarida`,
      );
    }
  }

  /** Kimlik yalnız bir kez bulunmalı — süzgeç aynı soruyu çoğaltmamalı. */
  const targetOccurrences = targetSurfaces.renderable.filter(
    (key) => key === TARGET_FIELD_KEY,
  ).length;
  if (targetOccurrences !== 1) {
    problems.push(
      `${TARGET_ID}: nihai listede ${targetOccurrences} kez bulundu, 1 bekleniyordu`,
    );
  }

  console.log("\n===== HUKUM =====");
  if (problems.length > 0) {
    console.log(`KIRMIZI — ${problems.length} ihlal:`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    "YESIL — yalniz cikarimdan gelen ve sorulabilir olan her deger, hem motor\n" +
      "kuyrugunda hem /talep ekraninin render ettigi listede, ilk gorunur ekranin\n" +
      "siniri elverdigi olcude dogrulama onceligini aldi; kapatmaya yetkili hicbir\n" +
      "deger dogrulama diye one tasinmadi ve hicbir soru cogaltilmadi.",
  );
}

main();
