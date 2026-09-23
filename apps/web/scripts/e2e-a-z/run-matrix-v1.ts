/**
 * A'DAN Z'YE E2E — FAZ 1 KOŞUCU (2026-09-23)
 *
 * 240 vakayı GERÇEK üretim boru hattından geçirir:
 *   syncFromText → resolveHybridQuestions → scheduleComposerQuestions
 *   → planAnswerApplication → computeComposerPublishReadiness
 * Kendi karar kopyasını KURMAZ (kural: verifier-must-measure-production-behaviour).
 * Cevap uygulaması da `/talep` ile aynı yetkiden (`answer-apply-plan`) geçer;
 * harness kendi "cevap nasıl kaydedilir" kuralını uydurmaz.
 *
 * Ölçütler K1..K7 burada hesaplanır ve `matris.jsonl` olarak diske yazılır.
 * Salt-okunurdur; hiçbir veritabanına dokunmaz.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { syncFromText } from "../../src/lib/request-composer/sync";
import { resolveHybridQuestions } from "../../src/lib/request-composer/questions";
import { scheduleComposerQuestions } from "../../src/lib/request-composer/v2/focused-questions";
import {
  computeComposerPublishReadiness,
  OUT_OF_SCOPE_SUPPLY_NOTICE,
  OUT_OF_SCOPE_MEDICAL_ADVICE_NOTICE,
  OUT_OF_SCOPE_PHARMACY_NOTICE,
  OUT_OF_SCOPE_REMOVED_NOTICE,
} from "../../src/lib/request-composer/v2/publish-readiness";
import { listAllProfiles } from "../../src/lib/request-composer/v2/question-profiles";
import {
  planAnswerApplication,
  projectCanonicalCommonAnswers,
} from "../../src/lib/request-composer/v2/answer-apply-plan";
import { softFillFromComposerState } from "../../src/lib/request-composer/ui-helpers";
import {
  resolveRequestCategory,
  resolveCommonField,
  withCategoryFieldDefaults,
} from "../../src/lib/request-category-engine";
import {
  budgetDisplayFromUnderstanding,
  resolveSchemaCategory,
  seedFieldValuesFromUnderstanding,
} from "../../src/lib/request-understanding/activation-bridge";
import {
  resolveRealEstateLocationFromSources,
  realEstateLocationToCity,
} from "../../src/lib/geo/real-estate-location";
import type { CanonicalRequestState } from "../../src/lib/request-composer/types";
import type { ScheduledQuestion } from "../../src/lib/request-composer/v2/question-profile-types";

import { buildMatrix, type MatrixCase } from "./matrix-cases-v1";

const OUT_DIR = resolve(process.cwd(), "../../reports/e2e-a-z-2026-09-23");
const MATRIX_PATH = resolve(OUT_DIR, "matris.jsonl");
const SUMMARY_PATH = resolve(OUT_DIR, "faz1-ozet.json");

type Fields = CanonicalRequestState["fields"];

/** Kapsam → beklenen uyarı metni. Tek yetkili kaynak publish-readiness'tır. */
const EXPECTED_NOTICE: Record<string, string> = {
  UNSUPPORTED_SUPPLY: OUT_OF_SCOPE_SUPPLY_NOTICE,
  UNSUPPORTED_MEDICAL_ADVICE: OUT_OF_SCOPE_MEDICAL_ADVICE_NOTICE,
  UNSUPPORTED_PHARMACY: OUT_OF_SCOPE_PHARMACY_NOTICE,
  UNSUPPORTED_REMOVED_SCOPE: OUT_OF_SCOPE_REMOVED_NOTICE,
};

/**
 * alan anahtarı → hangi kategorilerde tanımlı (TEK yetkili kaynaktan türetilir:
 * question-profiles.ts). K5 bu türetilmiş haritayı okur; ikinci bir elle
 * yazılmış "hangi soru hangi kategoriye ait" listesi tutulmaz.
 */
function buildFieldCategoryMap(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const def of listAllProfiles()) {
    const set = map.get(def.fieldKey) ?? new Set<string>();
    for (const cat of def.categories ?? []) set.add(cat);
    map.set(def.fieldKey, set);
  }
  return map;
}

const FIELD_CATEGORIES = buildFieldCategoryMap();

/** Niyet kartı alanı → soru alan anahtarı eşlemesi (K3/K4 için). */
const INTENT_TO_FIELD: Record<string, string[]> = {
  budgetTRY: ["budget"],
  city: ["city"],
  district: [],
  quantity: ["quantity"],
  brand: ["brand", "brandPreference"],
  urgency: ["delivery", "deliveryDays"],
};

/**
 * `/talep` sayfasıyla BİREBİR aynı izdüşüm — provenance dâhil. Kaynak
 * taşınmazsa zamanlayıcı çıkarımı cevap sanar (KB-17) ve ölçüm yalan olur.
 */
function fieldStatesFrom(fields: Fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([k, f]) => [
      k,
      {
        kind: f?.kind,
        value:
          f?.kind === "VALUE"
            ? String(f.value ?? "")
            : f?.kind === "ANY"
              ? "no_preference"
              : null,
        provenance: f?.provenance ?? null,
      },
    ]),
  );
}

/**
 * `/talep` KATEGORİ MERDİVENİ — birebir (page.tsx: activeCategoryId).
 * Kategori bilinmiyorsa boş dizedir; harness burada "technology" gibi bir
 * varsayılan UYDURAMAZ, yoksa yanlış kategorinin soruları ölçüme sızar.
 */
function activeCategoryOf(state: CanonicalRequestState): string {
  const u = state.understanding;
  if (u.category.status === "CONFIDENT" && u.category.value)
    return String(u.category.value);
  if (state.categoryId) return state.categoryId;
  if (u.category.status === "TENTATIVE" && u.category.value)
    return String(u.category.value);
  return resolveSchemaCategory(u).categoryId;
}

function valueOf(fields: Fields, key: string): string | null {
  const f = fields[key];
  if (!f) return null;
  if (f.kind !== "VALUE") return null;
  const v = String(f.value ?? "").trim();
  return v ? v : null;
}

/**
 * `/talep` DEĞER TORBASI — BİREBİR İZDÜŞÜM.
 *
 * Zamanlayıcıya giden `values` bağı sayfada üç kaynaktan beslenir:
 * kanonik cevaplar, anlama katmanının tohumladığı alanlar ve kategori
 * varsayılanları. Harness bunu kurmazsa motoru OLDUĞUNDAN DAHA ÇOK SORAN
 * gösterir — ölçüm yalan olur. Bu yüzden burada yeni bir kural yazılmaz,
 * sayfadaki sıralama aynen okunur (page.tsx: mergedCommonDraft + dynamicValues).
 */
function uiValuesBag(
  state: CanonicalRequestState,
  fields: Fields,
  manual: Record<string, string>,
  rawText: string,
): Record<string, string> {
  const u = state.understanding;
  const categoryId = activeCategoryOf(state);
  const category = resolveRequestCategory(categoryId);
  const visibleCommon = new Set(
    category.commonFields.map((f) => resolveCommonField(f).key),
  );
  const canonicalCommon = projectCanonicalCommonAnswers(fields);
  const understandingCity = (u.location?.city?.value as string | undefined) ?? "";
  const understandingBudget = budgetDisplayFromUnderstanding(u);
  const uQty = u.quantity?.value?.value;
  const uUnit = u.quantity?.value?.unit ?? "adet";
  const seeded = seedFieldValuesFromUnderstanding(u);
  const softFill = softFillFromComposerState({ ...state, fields });
  const isRealEstate = categoryId === "real-estate";

  const dynamic: Record<string, string> = {};
  for (const field of category.fields) {
    const seedValue = seeded[field.key];
    dynamic[field.key] =
      manual[field.key] ??
      softFill[field.key] ??
      (seedValue === undefined || seedValue === null ? "" : String(seedValue));
  }
  for (const [key, value] of Object.entries(seeded)) {
    if (!dynamic[key] && !manual[key] && value) dynamic[key] = String(value);
  }
  for (const [key, value] of Object.entries(softFill)) {
    if (!dynamic[key] && !manual[key] && value) dynamic[key] = String(value);
  }
  const dynamicValues = withCategoryFieldDefaults(categoryId, dynamic);

  const reLocation = isRealEstate
    ? resolveRealEstateLocationFromSources({
        parsedCity: manual.city || canonicalCommon.city || understandingCity,
        rawText,
        parsedNeighborhoods: undefined,
      })
    : null;

  const quantity = visibleCommon.has("quantity")
    ? manual.quantity ||
      canonicalCommon.quantity ||
      (uQty != null ? `${uQty} ${uUnit}` : "")
    : "";
  const city = isRealEstate
    ? (reLocation ? realEstateLocationToCity(reLocation) : "") ||
      manual.city ||
      canonicalCommon.city ||
      understandingCity ||
      ""
    : visibleCommon.has("city")
      ? manual.city || canonicalCommon.city || understandingCity || ""
      : "";
  const delivery = visibleCommon.has("delivery")
    ? manual.delivery || canonicalCommon.delivery || ""
    : "";
  const budget = visibleCommon.has("budget")
    ? manual.budget || canonicalCommon.budget || understandingBudget || ""
    : "";

  return {
    ...Object.fromEntries(
      Object.entries(dynamicValues).map(([k, v]) => [k, String(v ?? "")]),
    ),
    quantity,
    city,
    delivery,
    budget,
    locationMode:
      manual.locationMode ??
      String(dynamicValues.locationMode ?? "") ??
      (/uzaktan/i.test(rawText) ? "remote" : ""),
  };
}

/**
 * Tutarlı kullanıcı: soruyu niyet kartından cevaplar. Kart o alanı
 * taşımıyorsa hızlı seçeneklerden ilkini alır; seçenek de yoksa
 * kaçış seçeneği ("Fark etmez"/"Bilmiyorum") kullanılır.
 */
function answerFromIntent(
  q: ScheduledQuestion,
  c: MatrixCase,
): { value: string; source: string } {
  const intent = c.bucket.intent;
  switch (q.fieldKey) {
    case "budget":
      if (intent.budgetTRY != null)
        return { value: String(intent.budgetTRY), source: "intent.budgetTRY" };
      break;
    case "city":
      return { value: `${intent.city} / ${intent.district}`, source: "intent.city" };
    case "quantity":
      if (intent.quantity)
        return { value: String(intent.quantity.value), source: "intent.quantity" };
      break;
    case "brand":
    case "brandPreference":
      if (intent.brand) return { value: intent.brand, source: "intent.brand" };
      break;
    case "model":
      if (intent.model) return { value: intent.model, source: "intent.model" };
      break;
    default:
      break;
  }
  // Özel şart ile eşleşen hızlı seçenek var mı?
  const cond = intent.specialCondition.toLocaleLowerCase("tr-TR");
  const matching = (q.quickChoices ?? []).find((ch) =>
    cond.includes(ch.label.toLocaleLowerCase("tr-TR")),
  );
  if (matching) return { value: matching.value, source: "intent.specialCondition" };
  if (q.suggestedValue) return { value: q.suggestedValue, source: "suggestedValue" };
  if (q.quickChoices?.length)
    return { value: q.quickChoices[0].value, source: "quickChoice[0]" };
  const escape = q.escapeChoices?.[0];
  if (escape) return { value: escape.value, source: "escape" };
  return { value: "Fark etmez", source: "fallback" };
}

type AskedQuestion = {
  round: number;
  fieldKey: string;
  label: string;
  importance: string;
  answeredWith: string;
  answerSource: string;
};

type CaseRecord = {
  caseId: string;
  bucketId: string;
  style: string;
  density: string;
  text: string;
  detected: Record<string, unknown>;
  readiness: {
    canPublish: boolean;
    canReview: boolean;
    primaryCta: string;
    blockingLabels: string[];
    outOfScopeNotice: string | null;
  };
  readinessAfterAnswers: {
    canPublish: boolean;
    primaryCta: string;
    blockingLabels: string[];
  };
  questionsRound1: string[];
  promptsRound1: string[];
  askedAll: AskedQuestion[];
  totalQuestionCount: number;
  rounds: number;
  final: Record<string, string | null>;
  findings: Array<{ code: string; detail: string }>;
  pass: boolean;
};

const EMPTY_RECORD_SHELL = {
  canPublish: false,
  canReview: false,
  primaryCta: "continue",
  blockingLabels: [] as string[],
  outOfScopeNotice: null as string | null,
};

function runCase(c: MatrixCase): CaseRecord {
  const findings: Array<{ code: string; detail: string }> = [];
  const { state } = syncFromText(null, c.text);
  const u = state.understanding;
  const scope = u.requestScope?.value ?? null;
  const categoryId = activeCategoryOf(state) || null;

  // Cevaplar kanonik duruma ve elle-cevap defterine yazılır (üretimdeki gibi).
  let fields: Fields = { ...state.fields };
  const manual: Record<string, string> = {};
  const answered = new Set<string>();

  const hybrid = resolveHybridQuestions(state);

  const scheduleNow = () =>
    scheduleComposerQuestions({
      categoryId: categoryId ?? "",
      needType: valueOf(fields, "needType"),
      candidates: hybrid.candidates,
      values: uiValuesBag(state, fields, manual, c.text),
      fieldStates: fieldStatesFrom(fields) as never,
      answeredKeys: answered,
    });

  const readinessNow = (schedule: ReturnType<typeof scheduleNow>) => {
    const bag = uiValuesBag(state, fields, manual, c.text);
    return computeComposerPublishReadiness({
      hasUsableText: Boolean(c.text.trim()),
      schedule,
      categoryId,
      budgetValue: bag.budget || null,
      cityValue: bag.city || null,
      locationMode: bag.locationMode || null,
      requestScope: scope,
      realEstateLocationComplete:
        categoryId === "real-estate" ? bag.city.includes("/") : undefined,
    });
  };

  const schedule0 = scheduleNow();
  const readiness = readinessNow(schedule0);

  // --- K1 kapsam -------------------------------------------------------
  const expectedScope = c.bucket.expectedScope;
  if (scope !== expectedScope) {
    findings.push({
      code: "K1_SCOPE",
      detail: `beklenen ${expectedScope}, bulunan ${scope ?? "null"}`,
    });
  }
  if (expectedScope !== "DEMAND") {
    if (readiness.canPublish || readiness.canReview) {
      findings.push({
        code: "K1_NOT_BLOCKED",
        detail: `kapsam dışı vaka yayına/önizlemeye açık (canPublish=${readiness.canPublish})`,
      });
    }
    const want = EXPECTED_NOTICE[expectedScope];
    if (readiness.outOfScopeNotice !== want) {
      findings.push({
        code: "K1_NOTICE",
        detail: `uyarı metni beklenen kapsam metni değil (bulunan: ${
          readiness.outOfScopeNotice
            ? readiness.outOfScopeNotice.slice(0, 70) + "…"
            : "null"
        })`,
      });
    }
  }

  // --- K2 kategori -----------------------------------------------------
  if (c.bucket.expectedCategory) {
    if (categoryId !== c.bucket.expectedCategory) {
      findings.push({
        code: "K2_CATEGORY",
        detail: `beklenen ${c.bucket.expectedCategory}, bulunan ${categoryId ?? "null"}`,
      });
    }
  } else if (c.bucket.legitOutOfCategory && scope !== "DEMAND") {
    findings.push({
      code: "K2_LEGIT_REJECTED",
      detail: `kategori dışı meşru talep kapsam dışı sayıldı: ${scope}`,
    });
  }

  // --- Soru döngüsü (tutarlı kullanıcı) --------------------------------
  const askedAll: AskedQuestion[] = [];
  let rounds = 0;
  let schedule = schedule0;
  const MAX_ROUNDS = 10;
  while (schedule.visible.length > 0 && rounds < MAX_ROUNDS) {
    rounds += 1;
    const before = schedule.visible.map((q) => q.fieldKey).join("|");
    let appliedSomething = false;
    for (const q of schedule.visible) {
      if (answered.has(q.fieldKey)) continue;
      const a = answerFromIntent(q, c);
      const plan = planAnswerApplication({ fieldKey: q.fieldKey, rawValue: a.value });
      for (const effect of plan.effects) {
        if (effect.kind === "canonical") {
          fields = {
            ...fields,
            [effect.fieldKey]: {
              kind: effect.valueKind ?? (effect.isAny ? "ANY" : "VALUE"),
              value: effect.value,
              provenance: "EXPLICIT_TEXT",
              evidence: ["e2e:user-answer"],
            },
          };
        } else if (effect.kind === "common" || effect.kind === "dynamic") {
          manual[effect.fieldKey] = effect.value;
        } else if (effect.kind === "cityFilter") {
          manual.city = effect.value;
        }
      }
      /**
       * ETİKETSİZ SORU — KALICI DEĞİŞMEZ.
       * Profil bulunamayan melez aday, özet etiketi olarak HAM ALAN
       * ANAHTARINI taşır ve kullanıcıya "quantity" diye bir soru çıkar.
       * Bu bir görünüm kusuru değil, sözleşme boşluğudur: soru bir profile
       * ait değildir.
       */
      if (q.summaryLabel === q.fieldKey) {
        findings.push({
          code: "UI_RAW_LABEL",
          detail: `soru ham alan anahtarıyla gösteriliyor: "${q.fieldKey}" (profil yok)`,
        });
      }
      answered.add(q.fieldKey);
      appliedSomething = true;
      askedAll.push({
        round: rounds,
        fieldKey: q.fieldKey,
        label: q.summaryLabel,
        importance: q.importance,
        answeredWith: a.value,
        answerSource: a.source,
      });
    }
    const next = scheduleNow();
    const after = next.visible.map((q) => q.fieldKey).join("|");
    if (!appliedSomething || (after === before && after.length > 0)) {
      findings.push({
        code: "QUESTION_LOOP",
        detail: `cevaplanmasına rağmen aynı sorular tekrar geliyor: ${after}`,
      });
      schedule = next;
      break;
    }
    schedule = next;
  }
  if (rounds >= MAX_ROUNDS && schedule.visible.length > 0) {
    findings.push({
      code: "QUESTION_NO_END",
      detail: `${MAX_ROUNDS} tur sonunda soru akışı bitmedi (${schedule.visible
        .map((q) => q.fieldKey)
        .join(", ")})`,
    });
  }

  const readinessAfter = readinessNow(schedule);
  if (expectedScope === "DEMAND" && !readinessAfter.canPublish) {
    findings.push({
      code: "PUBLISH_UNREACHABLE",
      detail: `tüm sorular cevaplandığı hâlde yayın açılmadı — engeller: ${
        readinessAfter.blockingLabels.join(", ") || "yok"
      }`,
    });
  }

  // --- K3 gereksiz soru ------------------------------------------------
  for (const a of askedAll) {
    for (const intentField of c.writtenFields) {
      const keys = INTENT_TO_FIELD[intentField];
      if (!keys?.includes(a.fieldKey)) continue;
      findings.push({
        code: "K3_REDUNDANT",
        detail: `kullanıcı "${intentField}" bilgisini yazdığı hâlde "${a.label}" (${a.fieldKey}) soruldu`,
      });
    }
  }

  // --- K4 eksik soru ---------------------------------------------------
  if (expectedScope === "DEMAND") {
    for (const f of ["budgetTRY", "city", "quantity"] as const) {
      if (c.writtenFields.includes(f)) continue;
      if (f === "quantity" && !c.bucket.intent.quantity) continue;
      const keys = INTENT_TO_FIELD[f] ?? [];
      const askedIt = askedAll.some((a) => keys.includes(a.fieldKey));
      const alreadyKnown = keys.some((k) => valueOf(state.fields, k) != null);
      if (!askedIt && !alreadyKnown) {
        findings.push({
          code: "K4_MISSING",
          detail: `niyet kartındaki kritik alan "${f}" ne yazıda var ne de soruldu`,
        });
      }
    }
  }

  // --- K5 alakasız soru ------------------------------------------------
  const expCat = c.bucket.expectedCategory;
  for (const a of askedAll) {
    if (c.bucket.absurdFieldKeys.includes(a.fieldKey)) {
      findings.push({
        code: "K5_ABSURD",
        detail: `"${a.label}" (${a.fieldKey}) bu kovada anlamsız (kalıcı değişmez satır)`,
      });
      continue;
    }
    if (!expCat) continue;
    const owners = FIELD_CATEGORIES.get(a.fieldKey);
    if (!owners || owners.size === 0) continue;
    if (owners.has("*") || owners.has("all")) continue;
    if (!owners.has(expCat)) {
      findings.push({
        code: "K5_WRONG_CATEGORY_FIELD",
        detail: `"${a.label}" (${a.fieldKey}) yalnız [${[...owners].join(
          ",",
        )}] kategorilerinde tanımlı, beklenen kategori ${expCat}`,
      });
    }
  }

  // --- K6 / K7 ---------------------------------------------------------
  const finalBag = uiValuesBag(state, fields, manual, c.text);
  const final: Record<string, string | null> = {
    category: categoryId,
    brand: valueOf(fields, "brand") ?? finalBag.brand ?? null,
    model: valueOf(fields, "model") ?? finalBag.model ?? null,
    quantity: valueOf(fields, "quantity") ?? finalBag.quantity ?? null,
    budget: valueOf(fields, "budget") ?? finalBag.budget ?? null,
    city: valueOf(fields, "city") ?? finalBag.city ?? null,
    subject:
      (u.requestSubject?.displayPhrase?.value as string | undefined) ??
      (u.requestSubject?.name?.value as string | undefined) ??
      null,
  };

  if (expectedScope === "DEMAND") {
    const intent = c.bucket.intent;
    const fold = (s: string) =>
      s
        .toLocaleLowerCase("tr-TR")
        .replace(/[ıi]/g, "i")
        .replace(/[şs]/g, "s")
        .replace(/[ğg]/g, "g")
        .replace(/[üu]/g, "u")
        .replace(/[öo]/g, "o")
        .replace(/[çc]/g, "c")
        .replace(/[^a-z0-9]/g, "");
    if (c.writtenFields.includes("brand") && intent.brand) {
      if (!final.brand || fold(final.brand) !== fold(intent.brand)) {
        findings.push({
          code: "K7_BRAND",
          detail: `yazılan marka "${intent.brand}", son talepte "${final.brand ?? "yok"}"`,
        });
      }
    }
    if (c.writtenFields.includes("quantity") && intent.quantity) {
      const got = (final.quantity ?? "").replace(/\./g, "").match(/\d+/)?.[0];
      if (got !== String(intent.quantity.value)) {
        findings.push({
          code: "K7_QUANTITY",
          detail: `yazılan adet ${intent.quantity.value}, son talepte "${final.quantity ?? "yok"}"`,
        });
      }
    }
    if (c.writtenFields.includes("city")) {
      if (!final.city || !fold(final.city).includes(fold(intent.city))) {
        findings.push({
          code: "K7_CITY",
          detail: `yazılan şehir "${intent.city}", son talepte "${final.city ?? "yok"}"`,
        });
      }
    }
    if (c.writtenFields.includes("budgetTRY") && intent.budgetTRY != null) {
      const digits = (final.budget ?? "").replace(/\D/g, "");
      if (!digits || Number(digits) !== intent.budgetTRY) {
        findings.push({
          code: "K7_BUDGET",
          detail: `yazılan bütçe ${intent.budgetTRY}, son talepte "${final.budget ?? "yok"}"`,
        });
      }
    }
  }

  return {
    caseId: c.caseId,
    bucketId: c.bucketId,
    style: c.style,
    density: c.density,
    text: c.text,
    detected: {
      scope,
      scopeStatus: u.requestScope?.status ?? "UNKNOWN",
      categoryId,
      understandingCategory: (u.category?.value as string | null) ?? null,
      subjectKind: (u.requestSubject?.kind?.value as string | null) ?? null,
      subjectName:
        (u.requestSubject?.displayPhrase?.value as string | undefined) ??
        (u.requestSubject?.name?.value as string | undefined) ??
        null,
      intent: (u.intent?.value as string | null) ?? null,
      brand: (u.identity?.brand?.value as string | undefined) ?? null,
      model: (u.identity?.model?.value as string | undefined) ?? null,
      quantity:
        u.quantity?.value?.value != null ? String(u.quantity.value.value) : null,
      budgetFromText: valueOf(state.fields, "budget"),
      cityFromText: (u.location?.city?.value as string | undefined) ?? null,
      understandingConfidence: u.understandingConfidence,
      attributeKeys: Object.keys(u.attributes ?? {}),
      publishReadinessStatus: u.publishReadiness?.status ?? "UNKNOWN",
      ambiguities: u.ambiguities?.map((a) => a.kind) ?? [],
      contradictions: u.contradictions?.map((a) => a.kind) ?? [],
    },
    readiness: {
      canPublish: readiness.canPublish,
      canReview: readiness.canReview,
      primaryCta: readiness.primaryCta,
      blockingLabels: readiness.blockingLabels,
      outOfScopeNotice: readiness.outOfScopeNotice,
    },
    readinessAfterAnswers: {
      canPublish: readinessAfter.canPublish,
      primaryCta: readinessAfter.primaryCta,
      blockingLabels: readinessAfter.blockingLabels,
    },
    questionsRound1: schedule0.visible.map(
      (q) =>
        `${q.summaryLabel}[${q.fieldKey}]${q.importance === "publish_required" ? "*" : ""}`,
    ),
    /** Ekranda GORUNEN metin ozet etiketi degil sorunun kendisidir. */
    promptsRound1: schedule0.visible.map((q) => q.prompt),
    askedAll,
    totalQuestionCount: askedAll.length,
    rounds,
    final,
    findings,
    pass: findings.length === 0,
  };
}

function main() {
  const cases = buildMatrix();
  mkdirSync(dirname(MATRIX_PATH), { recursive: true });
  const records: CaseRecord[] = [];
  for (const c of cases) {
    try {
      records.push(runCase(c));
    } catch (error) {
      records.push({
        caseId: c.caseId,
        bucketId: c.bucketId,
        style: c.style,
        density: c.density,
        text: c.text,
        detected: { scope: null, scopeStatus: "THROW" },
        readiness: { ...EMPTY_RECORD_SHELL },
        readinessAfterAnswers: {
          canPublish: false,
          primaryCta: "continue",
          blockingLabels: [],
        },
        questionsRound1: [],
        promptsRound1: [],
        askedAll: [],
        totalQuestionCount: 0,
        rounds: 0,
        final: {},
        findings: [
          {
            code: "ENGINE_THROW",
            detail: String((error as Error)?.message ?? error).slice(0, 300),
          },
        ],
        pass: false,
      });
    }
  }

  writeFileSync(
    MATRIX_PATH,
    records.map((r) => JSON.stringify(r)).join("\n") + "\n",
    "utf8",
  );

  const byCode: Record<string, number> = {};
  const casesByCode: Record<string, number> = {};
  for (const r of records) {
    for (const f of r.findings) byCode[f.code] = (byCode[f.code] ?? 0) + 1;
    for (const code of new Set(r.findings.map((f) => f.code)))
      casesByCode[code] = (casesByCode[code] ?? 0) + 1;
  }

  const byBucket: Record<string, Record<string, number>> = {};
  for (const r of records) {
    const b = (byBucket[r.bucketId] ??= {
      total: 0,
      pass: 0,
      k1: 0,
      k2: 0,
      k3: 0,
      k4: 0,
      k5: 0,
      k7: 0,
      questionSum: 0,
      maxQuestions: 0,
    });
    b.total += 1;
    if (r.pass) b.pass += 1;
    b.k1 += r.findings.filter((f) => f.code.startsWith("K1")).length;
    b.k2 += r.findings.filter((f) => f.code.startsWith("K2")).length;
    b.k3 += r.findings.filter((f) => f.code === "K3_REDUNDANT").length;
    b.k4 += r.findings.filter((f) => f.code === "K4_MISSING").length;
    b.k5 += r.findings.filter((f) => f.code.startsWith("K5")).length;
    b.k7 += r.findings.filter((f) => f.code.startsWith("K7")).length;
    b.questionSum += r.totalQuestionCount;
    b.maxQuestions = Math.max(b.maxQuestions, r.totalQuestionCount);
  }
  for (const b of Object.values(byBucket)) {
    b.avgQuestions = Number((b.questionSum / b.total).toFixed(2));
    b.k7Accuracy = Number((((b.total - b.k7) / b.total) * 100).toFixed(1));
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    totalCases: records.length,
    passed: records.filter((r) => r.pass).length,
    failed: records.filter((r) => !r.pass).length,
    findingsByCode: byCode,
    casesAffectedByCode: casesByCode,
    byBucket,
  };
  writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2), "utf8");

  console.log("=== FAZ 1 — talep beyni matrisi ===");
  console.log(
    `vaka: ${summary.totalCases}  geçti: ${summary.passed}  kaldı: ${summary.failed}`,
  );
  console.log("bulgu (toplam):", JSON.stringify(byCode));
  console.log("bulgu (etkilenen vaka):", JSON.stringify(casesByCode));
  console.log(`matris: ${MATRIX_PATH}`);
}

main();
