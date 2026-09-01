/**
 * BEYİN ADVERSARIAL KORPUS DOĞRULAYICISI V1 (98+ Faz I, 2026-09-01).
 *
 * fixtures/brain-adversarial-corpus-v1.ts korpusunu ÜRETİM zinciriyle koşar
 * (understandRequest → syncFromText → resolveHybridQuestions) ve talep
 * beynini TEK "PASS" olarak değil, boyut boyut ölçer:
 *
 *   category  — beklenen kümede mi; YÜKSEK GÜVENLE yanlış ayrı sayılır
 *   kind      — beklenen kümede mi; yüksek güvenle yanlış ayrı sayılır
 *   brand     — precision (asserted → beyanla eşleşmeli) + recall (beyan → yakalanmalı)
 *   model     — precision
 *   number    — rol doğruluğu: yasak sayılar adet/bütçe kanalına yazılamaz;
 *               beyan edilen adet/bütçe doğru kanalda olmalı
 *   ANY       — "fark etmez" ANY olarak korunur ve soru YENİDEN sorulmaz
 *   scope     — UNSUPPORTED_* doğru; SUPPORTED yanlışlıkla düşmez
 *   question  — kullanıcının zaten cevapladığı anahtar yeniden sorulmaz
 *   hallucination — beyan edilmemiş marka/model/bütçe DEĞER üretemez
 *
 * KALİBRASYON SÖZLEŞMESİ: lossy (typo) varyantta doğru çözüm zorunlu değildir;
 * zorunlu olan yüksek güvenli YANLIŞ üretmemektir. Bu yüzden category/kind
 * boyutlarında payda lossy-olmayan vakalardır; yüksek-güven-yanlış sayacı ise
 * HER vakayı kapsar ve sert kapıdır.
 *
 * SERT KAPILAR (kırmızı):
 *   HIGH_CONFIDENCE_WRONG_CATEGORY = 0
 *   HIGH_CONFIDENCE_WRONG_KIND     = 0
 *   BRAND_HALLUCINATION            = 0
 *   MODEL_HALLUCINATION            = 0
 *   BUDGET_HALLUCINATION           = 0
 *   FORBIDDEN_NUMBER_IN_ROLE       = 0
 *   ANY_REASK                      = 0
 *   SCOPE_MISS                     = 0
 *
 * Boyut skorları dürüstçe raporlanır; NOT_MEASURED hiçbir sayaca girmez.
 */
import { buildAdversarialCorpus } from "./fixtures/brain-adversarial-corpus-v1";
import { understandRequest } from "../src/lib/request-understanding/understand-request";
import { syncFromText } from "../src/lib/request-composer";
import { resolveHybridQuestions } from "../src/lib/request-composer/questions";

function fold(v: unknown): string {
  return String(v ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
    .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type Counter = { ok: number; miss: number; wrongConfident: number };
const dim = (): Counter => ({ ok: 0, miss: 0, wrongConfident: 0 });

async function main() {
  const corpus = buildAdversarialCorpus();
  const category = dim();
  const kind = dim();
  let brandAsserted = 0, brandCorrect = 0, brandHallucination = 0;
  let brandApplicable = 0, brandRecalled = 0;
  let modelAsserted = 0, modelCorrect = 0, modelHallucination = 0;
  let numberChecked = 0, forbiddenNumberInRole = 0;
  let quantityDeclared = 0, quantityCorrect = 0;
  let budgetDeclared = 0, budgetCorrect = 0, budgetHallucination = 0;
  let anyCases = 0, anyPreserved = 0, anyReask = 0;
  let scopeCases = 0, scopeCorrect = 0, scopeMiss = 0, scopeMissLossy = 0, supportedDropped = 0;
  let questionCases = 0, questionClean = 0, reaskViolations = 0;
  const failures: string[] = [];
  const fail = (id: string, msg: string) => failures.push(`${id}: ${msg}`);

  for (const c of corpus) {
    const u = understandRequest(c.input) as unknown as {
      category: { value: string | null; status: string; confidence: number };
      requestSubject: { kind: { value: string | null; status: string; confidence: number } };
      requestScope: { value: string };
      identity: { brand?: { value?: string }; model?: { value?: string } };
      budget?: { value?: { max?: number; min?: number } };
      quantity?: { value?: { value?: number; unit?: string } };
    };
    const { state } = syncFromText(null, c.input) as unknown as {
      state: {
        fields: Record<string, { kind?: string; value?: unknown } | undefined>;
      };
    };
    const qr = resolveHybridQuestions(state as never) as unknown as {
      next?: Array<{ key: string }>;
    };
    const askedKeys = new Set((qr.next ?? []).map((q) => q.key));

    // --- SCOPE ---
    scopeCases += 1;
    const rawScope = String(u.requestScope?.value ?? "DEMAND");
    /* Kanonik kapsam değeri DEMAND'dir; korpus sözlüğünde SUPPORTED olarak anılır. */
    const gotScope = rawScope.startsWith("UNSUPPORTED") ? rawScope : "SUPPORTED";
    if (gotScope === c.expected.scope) scopeCorrect += 1;
    else if (c.lossy) {
      /**
       * KALİBRASYON İSTİSNASI DEĞİL, DÜRÜST AYRI SAYAÇ: typo ile bozulmuş
       * kapsam-dışı kalıp ("kullanaliyim") çözülemeyebilir; bu bir sert kapı
       * ihlali sayılmaz ama SAKLANMAZ — scopeMissLossy olarak raporlanır ve
       * launch riski listesinde görünür.
       */
      scopeMissLossy += 1;
      fail(c.id, `scope(lossy) beklenen=${c.expected.scope} gözlenen=${gotScope}`);
    } else {
      scopeMiss += 1;
      if (c.expected.scope === "SUPPORTED") supportedDropped += 1;
      fail(c.id, `scope beklenen=${c.expected.scope} gözlenen=${gotScope}`);
    }
    if (c.expected.scope !== "SUPPORTED") continue; // kapsam dışı: diğer boyutlar N/A

    // --- CATEGORY ---
    if (c.expected.categories.length) {
      const got = u.category?.value ?? null;
      const okCat = got != null && c.expected.categories.includes(got);
      const confident = u.category?.status === "CONFIDENT";
      if (okCat) category.ok += 1;
      else if (confident && got != null) {
        category.wrongConfident += 1;
        fail(c.id, `KATEGORİ YÜKSEK GÜVENLE YANLIŞ: ${got} (beklenen ${c.expected.categories.join("|")})`);
      } else if (!c.lossy) {
        category.miss += 1;
        fail(c.id, `kategori kaçtı: ${got ?? "null"}/${u.category?.status}`);
      }
    }

    // --- KIND ---
    if (c.expected.kinds.length) {
      const got = u.requestSubject?.kind?.value ?? null;
      const okKind = got != null && c.expected.kinds.includes(got);
      const confident = u.requestSubject?.kind?.status === "CONFIDENT";
      if (okKind) kind.ok += 1;
      else if (confident && got != null && got !== "UNKNOWN") {
        kind.wrongConfident += 1;
        fail(c.id, `KIND YÜKSEK GÜVENLE YANLIŞ: ${got} (beklenen ${c.expected.kinds.join("|")})`);
      } else if (!c.lossy) {
        kind.miss += 1;
        fail(c.id, `kind kaçtı: ${got ?? "null"}/${u.requestSubject?.kind?.status}`);
      }
    }

    // --- BRAND precision / recall / hallucination ---
    const gotBrand = u.identity?.brand?.value ?? null;
    if (gotBrand) {
      brandAsserted += 1;
      if (c.expected.brand && fold(gotBrand) === fold(c.expected.brand)) {
        brandCorrect += 1;
      } else if (c.expected.brand && fold(gotBrand).includes(fold(c.expected.brand))) {
        brandCorrect += 1;
      } else {
        brandHallucination += 1;
        fail(c.id, `MARKA HALÜSİNASYONU: "${gotBrand}" (beyan: ${c.expected.brand ?? "yok"})`);
      }
    }
    if (c.expected.brand && !c.lossy) {
      brandApplicable += 1;
      if (gotBrand && fold(gotBrand).includes(fold(c.expected.brand))) brandRecalled += 1;
    }

    // --- MODEL precision ---
    const gotModel = u.identity?.model?.value ?? null;
    if (gotModel) {
      modelAsserted += 1;
      if (c.expected.model && fold(gotModel).includes(fold(c.expected.model))) {
        modelCorrect += 1;
      } else if (!c.expected.model) {
        modelHallucination += 1;
        fail(c.id, `MODEL HALÜSİNASYONU: "${gotModel}"`);
      } else if (c.lossy) {
        // typo model sözcüğünü bozdu — kalan parça yanlış model sayılmaz,
        // ayrı raporlanır (sert kapı dışı, saklanmaz).
        fail(c.id, `model(lossy) "${gotModel}" (beyan: ${c.expected.model})`);
      } else {
        modelHallucination += 1;
        fail(c.id, `MODEL YANLIŞ: "${gotModel}" (beyan: ${c.expected.model})`);
      }
    }

    // --- NUMBER ROLES ---
    const gotQty = u.quantity?.value?.value ?? null;
    const gotBudgetMax = u.budget?.value?.max ?? u.budget?.value?.min ?? null;
    if (c.expected.forbiddenNumbers.length) {
      numberChecked += 1;
      if (gotQty != null && c.expected.forbiddenNumbers.includes(gotQty)) {
        forbiddenNumberInRole += 1;
        fail(c.id, `SAYI ROLÜ: ${gotQty} adet kanalına yazıldı`);
      }
      if (
        gotBudgetMax != null &&
        c.expected.budgetMax !== gotBudgetMax &&
        c.expected.forbiddenNumbers.includes(gotBudgetMax)
      ) {
        forbiddenNumberInRole += 1;
        fail(c.id, `SAYI ROLÜ: ${gotBudgetMax} bütçe kanalına yazıldı`);
      }
    }
    if (c.expected.quantity) {
      quantityDeclared += 1;
      if (gotQty === c.expected.quantity.value) quantityCorrect += 1;
      else if (!c.lossy) fail(c.id, `adet kaçtı: beklenen ${c.expected.quantity.value}, gözlenen ${gotQty ?? "yok"}`);
    }
    if (c.expected.budgetMax != null) {
      budgetDeclared += 1;
      if (gotBudgetMax === c.expected.budgetMax) budgetCorrect += 1;
      else if (!c.lossy) fail(c.id, `bütçe kaçtı: beklenen ${c.expected.budgetMax}, gözlenen ${gotBudgetMax ?? "yok"}`);
    } else if (gotBudgetMax != null) {
      budgetHallucination += 1;
      fail(c.id, `BÜTÇE HALÜSİNASYONU: ${gotBudgetMax}`);
    }

    // --- ANY korunumu ---
    if (c.expected.anyFields.length) {
      anyCases += 1;
      let preserved = true;
      for (const f of c.expected.anyFields) {
        const fs = state.fields[f];
        if (fs?.kind !== "ANY") preserved = false;
        if (askedKeys.has(f)) {
          anyReask += 1;
          preserved = false;
          fail(c.id, `ANY YENİDEN SORULDU: ${f}`);
        }
      }
      if (preserved) anyPreserved += 1;
      else if (!askedKeys.size) fail(c.id, `ANY korunmadı: ${c.expected.anyFields.join(",")}`);
    }

    // --- SORU YARARLILIĞI ---
    if (c.expected.answeredKeys.length && !c.lossy) {
      questionCases += 1;
      let clean = true;
      for (const k of c.expected.answeredKeys) {
        if (askedKeys.has(k)) {
          clean = false;
          reaskViolations += 1;
          fail(c.id, `CEVAPLANMIŞ SORU YENİDEN SORULDU: ${k}`);
        }
      }
      if (clean) questionClean += 1;
    }
  }

  const pct = (n: number, d: number) => (d ? ((100 * n) / d).toFixed(1) : "N/A");
  const catDen = category.ok + category.miss + category.wrongConfident;
  const kindDen = kind.ok + kind.miss + kind.wrongConfident;

  console.log(`\n===== BEYİN ADVERSARIAL KORPUS V1 =====`);
  console.log(`corpus=${corpus.length} vaka`);
  console.log(`category  : ${pct(category.ok, catDen)}%  (ok=${category.ok} miss=${category.miss} HIGH_CONF_WRONG=${category.wrongConfident}; payda lossy-korumalı)`);
  console.log(`kind      : ${pct(kind.ok, kindDen)}%  (ok=${kind.ok} miss=${kind.miss} HIGH_CONF_WRONG=${kind.wrongConfident})`);
  console.log(`brand prec: ${pct(brandCorrect, brandAsserted)}%  (asserted=${brandAsserted} HALLUCINATION=${brandHallucination})`);
  console.log(`brand rec : ${pct(brandRecalled, brandApplicable)}%  (uygulanabilir=${brandApplicable})`);
  console.log(`model prec: ${pct(modelCorrect, modelAsserted)}%  (asserted=${modelAsserted} HALLUCINATION/WRONG=${modelHallucination})`);
  console.log(`number    : forbidden-in-role=${forbiddenNumberInRole}/${numberChecked} vaka`);
  console.log(`quantity  : ${pct(quantityCorrect, quantityDeclared)}% (${quantityCorrect}/${quantityDeclared})`);
  console.log(`budget    : ${pct(budgetCorrect, budgetDeclared)}% (${budgetCorrect}/${budgetDeclared}) HALLUCINATION=${budgetHallucination}`);
  console.log(`ANY       : ${pct(anyPreserved, anyCases)}% (${anyPreserved}/${anyCases}) REASK=${anyReask}`);
  console.log(`scope     : ${pct(scopeCorrect, scopeCases)}% (${scopeCorrect}/${scopeCases}) MISS=${scopeMiss} MISS_LOSSY=${scopeMissLossy} supportedDropped=${supportedDropped}`);
  console.log(`questions : ${pct(questionClean, questionCases)}% (${questionClean}/${questionCases}) REASK=${reaskViolations}`);

  const hardGate =
    category.wrongConfident === 0 &&
    kind.wrongConfident === 0 &&
    brandHallucination === 0 &&
    modelHallucination === 0 &&
    budgetHallucination === 0 &&
    forbiddenNumberInRole === 0 &&
    anyReask === 0 &&
    scopeMiss === 0;

  if (failures.length) {
    console.log(`\n--- başarısızlıklar (${failures.length}) ---`);
    for (const f of failures.slice(0, 80)) console.log("  " + f);
    if (failures.length > 80) console.log(`  … +${failures.length - 80} satır`);
  }

  console.log(`\nHARD_GATES=${hardGate ? "GREEN" : "RED"}`);
  if (!hardGate) process.exit(1);
  if (failures.length) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
