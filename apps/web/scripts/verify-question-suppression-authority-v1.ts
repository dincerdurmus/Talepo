/**
 * SORU BASTIRMA ÖLÇÜM OTORİTESİ V1 — D1 (2026-08-25 sözleşmesi).
 *
 * NEDEN VAR. `docs/KNOWN-BROKEN.md` KB-17 kaydı `wrongly_suppressed = 45`
 * diyordu, ama o sayıyı üreten alet repoda YOKTU: ad, hiçbir script'te,
 * fixture'da veya kaynakta geçmiyordu. Komutla yeniden üretilemeyen bir sayı
 * ölçüm değil, belge iddiasıdır. Bu doğrulayıcı o boşluğu kapatır.
 *
 * ESKİ 45 SAYISI HEDEF DEĞİLDİR. O ölçüm tek eksenliydi ("soru soruldu mu?");
 * burada iki eksen ayrı ayrı ölçülür ve yedi ayrı sonuca dağılır. İki ölçü
 * AYNI ŞEY DEĞİLDİR ve matematiksel olarak karşılaştırılamaz.
 *
 * --- İKİ AYRI EKSEN -------------------------------------------------------
 *
 *   HAM KANIT      Alan neyle doldu? Bu eksen `provenance` ETİKETİNDEN
 *                  KOPYALANMAZ — kanıtın kendisi aranır: değer kullanıcının
 *                  metninde gerçekten var mı, yoksa çağrılabilir bir otorite
 *                  onu doğruluyor mu, yoksa uydurulmuş mu?
 *
 *   SORU KARARI    Alan soruldu mu? Bu bir UX kararıdır ve kanıt ekseninden
 *                  bağımsızdır.
 *
 * İkisinin karıştırılması eski ölçümün hatasıydı: kullanıcının yazdığı bir
 * değerin sorulmaması DOĞRU bir üründür; o değerin `INFERRED` etiketlenmesi
 * ise AYRI bir hatadır. Aynı kayıt hem `correctly_suppressed` hem
 * `provenance_mismatch` olabilir — ve bu bir çelişki değildir.
 *
 * --- SELF-FULFILLING YASAĞI -----------------------------------------------
 *
 * Fixture'tan YALNIZ `id` ve `input` okunur. Beklenen kategori, beklenen alan,
 * bilinen-açık blokları veya hazır verdict'ler ölçüme SIZAMAZ. Üç mekanizma:
 *   1) Senaryolar en başta dondurulmuş iki alanlı nesnelere projekte edilir;
 *      ölçüm fonksiyonu başka bir şey göremez.
 *   2) Fixture tanıtıcısının kaynak dosyada YALNIZ iki kez (import +
 *      projeksiyon) geçtiği sayılarak doğrulanır.
 *   3) Projeksiyon gövdesinin `s.id` ve `s.input` dışında hiçbir alan
 *      okumadığı biçimsel olarak sınanır.
 *
 * --- ÇIKIŞ KODU (mevcut sözleşme; yeni kod icat edilmedi) -----------------
 *
 *   0  ölçüm tamamlandı, ölçüm sözleşmesi sağlam
 *   1  doğrulayıcının SÖZLEŞMESİ / determinizmi / invariant'ı bozuk
 *   3  ölçüm sözleşmesi SAĞLAM fakat KAPANIŞ TAMAMLANMADI — gerçek
 *      `not_measured` kayıtları var. **Bu YEŞİL DEĞİLDİR.** "Ölçemedim" ile
 *      "ölçtüm, temiz" asla aynı renge boyanmaz; `3`'ü başarı sayan bir okuma
 *      ölçülemeyeni ölçülmüş sayar ve bu doğrulayıcıyı anlamsızlaştırır.
 *
 * `high_risk_silent_suppression > 0` bu turda TEK BAŞINA kırmızı DEĞİLDİR:
 * burası bir TABAN ölçümüdür. Kapanış kapısı D2'den sonra kurulur.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CATEGORY_COVERAGE_V1 } from "./fixtures/category-coverage-v1";
import { classifyNumbers } from "../src/lib/request-understanding/number-role";
import { understandRequest } from "../src/lib/request-understanding/understand-request";
import { deriveExplicitNeedType } from "../src/lib/request-composer/build-state";
import {
  SIMULATED_ANSWER_VALUE,
  walkQuestionWavesFromText,
} from "./lib/question-wave-walk-v1";
import { foldLabel } from "../src/lib/knowledge/slug";
import { resolveTaxonomyAlias } from "../src/lib/taxonomy";
import { isBrandLikeEntityType } from "../src/lib/catalog/domain-entities";
import {
  APPLIANCE_BRANDS,
  AUTOMOTIVE_BRANDS,
  BABY_BRANDS,
  FURNITURE_BRANDS,
  HOME_KITCHEN_BRANDS,
  MACHINERY_BRANDS,
  TECHNOLOGY_BRANDS,
  findBrand,
} from "../src/lib/ai/parser/brand-catalog";
import {
  findModelInText,
  getAutomotiveIndexes,
} from "../src/lib/catalog/automotive/indexes";
import {
  listProfilesForCategory,
  resolveProfileForField,
} from "../src/lib/request-composer/v2/question-profiles";
import { globalCoreQuestionProfiles } from "../src/lib/request-composer/v2/global-core-profile";
import {
  createNotMeasuredTally,
  NOT_MEASURED_EXIT,
} from "../src/lib/verification/not-measured";

/* ---------------- GİRDİ OTORİTESİ — dondurulmuş projeksiyon --------------- */

type ScenarioInput = { id: string; input: string };

/** Fixture'tan ölçüme geçen TEK kapı. Başka hiçbir alan taşınamaz. */
const SCENARIOS: readonly ScenarioInput[] = CATEGORY_COVERAGE_V1.map((s) =>
  Object.freeze({ id: s.id, input: s.input }),
);

/* ------------------------------- TİPLER ---------------------------------- */

type Horizon = "FIRST_SCREEN" | "FULL_QUEUE";

type Evidence =
  | "EXPLICIT_TEXT"
  | "EXPLICIT_BROWSE"
  | "AUTHORITY_VERIFIED_EQUIVALENT"
  | "INFERENCE_ONLY"
  | "MISSING"
  | "UNMEASURABLE";

type Decision = "ASKED" | "NOT_ASKED" | "OUT_OF_SCOPE";

type SuppressionPolicy =
  | "USER_DECISION_REQUIRED"
  | "AUTHORITY_MAY_SUPPRESS"
  | "NOT_APPLICABLE";

/** Puanlanan sonuçlar. */
const SCORED_OUTCOMES = [
  "correctly_suppressed",
  "wrongly_repeated",
  "high_risk_silent_suppression",
  "missing_required_question",
  "authority_suppressed",
  "not_measured",
] as const;

/** Bilgi amaçlı sonuçlar — kapanış kapısına girmez. */
const INFO_OUTCOMES = [
  "authority_re_asked",
  "inference_re_asked",
  "correctly_asked",
  "optional_not_asked",
  "OUT_OF_SCOPE",
] as const;

type Outcome =
  | (typeof SCORED_OUTCOMES)[number]
  | (typeof INFO_OUTCOMES)[number];

type Rec = {
  id: string;
  scenarioId: string;
  fieldKey: string;
  horizon: Horizon;
  evidence: Evidence;
  decision: Decision;
  importance: string;
  suppressionPolicy: SuppressionPolicy;
  policySource: string;
  outcome: Outcome;
  observedProvenance: string;
  provenanceMatch: "OK" | "MISMATCH" | "N/A";
  normalizedValue: string;
  authorityFunction: string;
  authorityCanonicalId: string;
  evidenceDetail: string;
  notMeasuredReason: string;
};

/* ------------------------- KANIT YARDIMCILARI ---------------------------- */

/**
 * `foldLabel` REPO'NUN KANONİK tr-TR katlamasıdır ve `resolveTaxonomyAlias`
 * alias indeksini kuran fonksiyonun ta kendisidir. Buraya üçüncü bir katlama
 * tablosu yazmak, otoriteyi ikiye bölmek olurdu.
 */
const WORD_CHAR = /[a-z0-9]/;

/** Tam ifade, kelime sınırlarıyla. Substring ya da tek ortak kelime YETMEZ. */
function containsAsWholePhrase(
  haystackFolded: string,
  needleRaw: string,
): boolean {
  const needle = foldLabel(needleRaw);
  if (needle.length < 2) return false;
  let from = 0;
  for (;;) {
    const at = haystackFolded.indexOf(needle, from);
    if (at < 0) return false;
    const before = at === 0 ? "" : haystackFolded[at - 1]!;
    const afterIdx = at + needle.length;
    const after =
      afterIdx >= haystackFolded.length ? "" : haystackFolded[afterIdx]!;
    if (!WORD_CHAR.test(before) && !WORD_CHAR.test(after)) return true;
    from = at + 1;
  }
}

/** rawInput'un 1-4 kelimelik parçalarını taksonomi otoritesine sorar. */
function buildAliasAuthorityIndex(
  raw: string,
): Map<string, { fn: string; id: string }> {
  const out = new Map<string, { fn: string; id: string }>();
  const words = raw.split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i += 1) {
    for (let n = 1; n <= 4 && i + n <= words.length; n += 1) {
      const phrase = words.slice(i, i + n).join(" ");
      const hit = resolveTaxonomyAlias(phrase);
      if (!hit) continue;
      const key = foldLabel(hit.node.canonicalName);
      if (!key || out.has(key)) continue;
      out.set(key, {
        fn: `resolveTaxonomyAlias(${JSON.stringify(phrase)})`,
        id: hit.node.id,
      });
    }
  }
  return out;
}

/**
 * MARKA OTORİTELERİ — hepsi ÇAĞRILABİLİR ve kimlik döndürür.
 *
 * Bunlar olmadan ölçüm, katalogla doğrulanabilen bir dönüşümü (iPhone → Apple,
 * C200 → Mercedes-Benz) "uydurma" sayar ve `high_risk_silent_suppression`
 * sayısını YUKARI doğru saptırır. Yanlış B, yanlış A2 kadar zararlıdır:
 * kapanmış bir açığı açık gösterir.
 */
const BRAND_LISTS = [
  ["AUTOMOTIVE_BRANDS", AUTOMOTIVE_BRANDS],
  ["TECHNOLOGY_BRANDS", TECHNOLOGY_BRANDS],
  ["APPLIANCE_BRANDS", APPLIANCE_BRANDS],
  ["HOME_KITCHEN_BRANDS", HOME_KITCHEN_BRANDS],
  ["MACHINERY_BRANDS", MACHINERY_BRANDS],
  ["FURNITURE_BRANDS", FURNITURE_BRANDS],
  ["BABY_BRANDS", BABY_BRANDS],
] as const;

function brandAuthorityFor(
  rawInput: string,
  value: string,
): { fn: string; id: string } | null {
  const want = foldLabel(value);

  // 1) Marka takma adı metinde geçiyor mu? (iPhone → Apple)
  for (const [listName, list] of BRAND_LISTS) {
    const canonical = findBrand(rawInput, list as never);
    if (canonical && foldLabel(canonical) === want) {
      return { fn: `findBrand(text, ${listName})`, id: `brand:${canonical}` };
    }
  }

  // 2) Model → marka bağı (C200 → model_… → brand_id → katalog adı)
  const modelHit = findModelInText(rawInput);
  const brandId = modelHit?.record?.brand_id;
  if (brandId) {
    const rec = getAutomotiveIndexes().brandById.get(brandId);
    if (rec && foldLabel(rec.name) === want) {
      return {
        fn: `findModelInText(text).record.brand_id -> brandById`,
        id: brandId,
      };
    }
  }

  return null;
}

/* -------------------------------- ÖLÇÜM ---------------------------------- */

type FieldState = {
  kind?: string;
  value?: unknown;
  canonicalValue?: unknown;
  provenance?: unknown;
};

/** Ham kanıt sınıfının BEKLEDİĞİ provenance etiketi (ayrı eksen). */
const EXPECTED_LABEL: Record<string, string> = {
  EXPLICIT_TEXT: "EXPLICIT_TEXT",
  EXPLICIT_BROWSE: "EXPLICIT_BROWSE",
  AUTHORITY_VERIFIED_EQUIVALENT: "CATALOG_ENRICHED",
  INFERENCE_ONLY: "INFERRED",
};

function blankRec(
  scenarioId: string,
  fieldKey: string,
  horizon: Horizon,
  reason: string,
): Rec {
  return {
    id: `${scenarioId}/${fieldKey}@${horizon}`,
    scenarioId,
    fieldKey,
    horizon,
    evidence: "UNMEASURABLE",
    decision: "NOT_ASKED",
    importance: "-",
    suppressionPolicy: "NOT_APPLICABLE",
    policySource: "-",
    outcome: "not_measured",
    observedProvenance: "-",
    provenanceMatch: "N/A",
    normalizedValue: "",
    authorityFunction: "",
    authorityCanonicalId: "",
    evidenceDetail: "",
    notMeasuredReason: reason,
  };
}

function byId(a: Rec, b: Rec): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

const HORIZONS: readonly Horizon[] = ["FIRST_SCREEN", "FULL_QUEUE"];

function measureScenario(sc: ScenarioInput): Rec[] {
  // GİRDİ KAPISI — iki alanlı ve dondurulmuş olmayan hiçbir şey ölçülemez.
  assert.equal(Object.keys(sc).length, 2, `${sc.id}: girdi iki alanlı olmalı`);
  assert.ok(Object.isFrozen(sc), `${sc.id}: girdi dondurulmuş olmalı`);

  const walk = walkQuestionWavesFromText(sc.input);
  const state = walk.state;
  const fields = state.fields as Record<string, FieldState>;
  const rawFolded = foldLabel(sc.input);

  const firstScreen = new Set(walk.firstScreen);
  const fullQueue = new Set(walk.asked);
  const simulated = new Set(walk.simulatedBrowseKeys);

  const categoryId = state.categoryId;

  const valueKeys = Object.keys(fields).filter((k) => {
    const f = fields[k];
    return f?.kind === "VALUE" && f.value != null && String(f.value) !== "";
  });

  /* --- kategori çözülemedi: ölçülemez, ama SESSİZ KAYBOLMAZ --- */
  if (!categoryId) {
    const keys = valueKeys.length ? valueKeys : ["__scenario__"];
    return keys
      .flatMap((k) =>
        HORIZONS.map((h) => blankRec(sc.id, k, h, "category_unresolved")),
      )
      .sort(byId);
  }

  const needType =
    fields.needType?.kind === "VALUE" ? String(fields.needType.value) : null;
  const productType =
    fields.productType?.kind === "VALUE"
      ? String(fields.productType.value)
      : null;

  /**
   * ALAN EVRENİ — scheduler'ın KENDİ önceliğiyle kurulur, yeniden yazılmaz:
   * `scheduleNextQuestions` önce kategori profillerini koyar, sonra global
   * core'u ÜZERİNE yazar ("Core wins on budget/city/delivery"). Aynı sıra
   * burada da uygulanır; aksi hâlde bütçe/konum `quote_critical` görünür ve
   * "kullanıcı kararı gerektiren alan" politikası yanlış türetilir.
   */
  const profileByKey = new Map<string, { fieldKey: string; importance: string }>();
  try {
    for (const p of listProfilesForCategory({ categoryId, needType, productType })) {
      profileByKey.set(p.fieldKey, p);
    }
    const listingType =
      fields.listingType?.kind === "VALUE"
        ? String(fields.listingType.value)
        : null;
    for (const p of globalCoreQuestionProfiles(categoryId, { listingType })) {
      profileByKey.set(p.fieldKey, p);
    }
  } catch {
    return HORIZONS.map((h) =>
      blankRec(sc.id, "__scenario__", h, "profile_unresolved"),
    ).sort(byId);
  }
  const profileKeys = new Set(profileByKey.keys());

  const aliasIndex = buildAliasAuthorityIndex(sc.input);
  const resolvedEntities =
    (
      state.understanding as unknown as {
        resolvedEntities?: Array<{
          canonicalId: string;
          entityType: string;
          canonicalLabel: string;
        }>;
      }
    ).resolvedEntities ?? [];

  const universe = [...new Set([...profileKeys, ...valueKeys])].sort();
  const out: Rec[] = [];

  for (const fieldKey of universe) {
    const f = fields[fieldKey];
    const rawValue =
      f?.kind === "VALUE" && f.value != null ? String(f.value) : "";
    const observedProvenance = String(f?.provenance ?? "-");

    /* ---------- HAM KANIT — etiketten BAĞIMSIZ, sırayla ---------- */
    let evidence: Evidence;
    let authorityFunction = "";
    let authorityCanonicalId = "";
    let evidenceDetail = "";
    let notMeasuredReason = "";

    if (!rawValue) {
      evidence = "MISSING";
      evidenceDetail = f ? `kind=${String(f.kind)}` : "field-absent";
    } else if (rawValue === SIMULATED_ANSWER_VALUE) {
      // Buraya asla girilmemeli: kanıt YALNIZ yürüyüş öncesi durumdan okunur.
      evidence = "UNMEASURABLE";
      notMeasuredReason = "simulated_answer_leaked_into_evidence";
    } else if (containsAsWholePhrase(rawFolded, rawValue)) {
      evidence = "EXPLICIT_TEXT";
      evidenceDetail = "phrase-match:value";
    } else if (
      f?.canonicalValue != null &&
      containsAsWholePhrase(
        rawFolded,
        String(f.canonicalValue).replace(/-/g, " "),
      )
    ) {
      evidence = "EXPLICIT_TEXT";
      evidenceDetail = "phrase-match:canonicalValue";
    } else if (
      /**
       * D2 KAPANIŞI 1/3 (Wave K, 2026-08-31): SAYISAL NORMALİZASYON,
       * markadaki "çağrılabilir otorite" ilkesinin bütçe karşılığıdır.
       * "bütçem aylık 25 bin TL" yazan kullanıcının kaydı "25.000 TL"dir;
       * ham harf eşleşmesi bulunamayınca AÇIK beyan INFERENCE_ONLY
       * sayılıyor ve high-risk YUKARI sapıyordu (ölçülen: re-02/budget).
       * Kanıt, KANONİK tek sayı otoritesiyle aranır (`classifyNumbers` —
       * "25 bin" → 25000 dönüşümünün tek sahibi): metindeki sınıflanmış
       * bir sayının değeri kayıtlı bütçe sayısına eşitse beyan metindedir.
       * İkinci bir sayı çözümleyici YAZILMADI.
       */
      fieldKey === "budget" &&
      (() => {
        const stored = Number(
          rawValue.replace(/[^\d,\.]/g, "").replace(/\./g, "").replace(",", "."),
        );
        if (!Number.isFinite(stored) || stored <= 0) return false;
        return classifyNumbers(sc.input).some(
          (n) => n.value === stored,
        );
      })()
    ) {
      evidence = "EXPLICIT_TEXT";
      evidenceDetail = "phrase-match:budget-number-authority";
    } else if (
      /**
       * D2 SÖZLEŞME GÜNCELLEMESİ (kurucu, 2026-09-01): TALEP TÜRÜ, cümlenin
       * güvenli yeniden ifadesiyse AÇIK BEYANDIR. "Televizyon arıyorum"
       * yazana "Ne arıyorsunuz?" sorulmaz. Kanıt, üretimle AYNI tek yetkili
       * fonksiyondan aranır (deriveExplicitNeedType — niyet+özne otoritesi);
       * ikinci bir karar kopyası yazılmadı. Fonksiyon null derse (belirsiz
       * niyet) kayıt eskisi gibi INFERENCE_ONLY kalır ve D2 kilidi yaşar.
       */
      fieldKey === "needType" &&
      (() => {
        const seed = deriveExplicitNeedType(
          understandRequest({ rawInput: sc.input } as never) as never,
        );
        return seed?.value === rawValue;
      })()
    ) {
      evidence = "EXPLICIT_TEXT";
      evidenceDetail = "phrase-match:intent-kind-authority";
    } else if (observedProvenance === "EXPLICIT_BROWSE") {
      evidence = "EXPLICIT_BROWSE";
      evidenceDetail = "user-browse-selection";
    } else {
      const brandHit =
        fieldKey === "brand"
          ? resolvedEntities.find(
              (e) =>
                isBrandLikeEntityType(e.entityType as never) &&
                foldLabel(e.canonicalLabel) === foldLabel(rawValue),
            )
          : undefined;
      const catalogBrandHit =
        !brandHit && fieldKey === "brand"
          ? brandAuthorityFor(sc.input, rawValue)
          : null;
      const aliasHit = aliasIndex.get(foldLabel(rawValue));
      if (brandHit) {
        evidence = "AUTHORITY_VERIFIED_EQUIVALENT";
        authorityFunction = "isBrandLikeEntityType+resolvedEntities";
        authorityCanonicalId = brandHit.canonicalId;
      } else if (catalogBrandHit) {
        /**
         * D2 KAPANIŞI 2/3 (Wave K, 2026-08-31): katalogun KENDİ alias
         * listesindeki bir ad kullanıcı METNİNDE geçiyorsa ("iPhone" →
         * Apple), kullanıcı markayı o markanın kabul edilmiş adıyla
         * SÖYLEMİŞTİR — bu açık beyanın normalize hâlidir, bilgi türetimi
         * değil (ürün kaydı da EXPLICIT_TEXT diyor; ölçülen: tech-02/10).
         * Model→marka bağı (findModelInText) böyle DEĞİLDİR ve otorite
         * sınıfında kalır.
         */
        if (catalogBrandHit.fn.startsWith("findBrand(")) {
          evidence = "EXPLICIT_TEXT";
          evidenceDetail = `brand-alias-in-text:${catalogBrandHit.id}`;
        } else {
          evidence = "AUTHORITY_VERIFIED_EQUIVALENT";
          authorityFunction = catalogBrandHit.fn;
          authorityCanonicalId = catalogBrandHit.id;
        }
      } else if (aliasHit) {
        evidence = "AUTHORITY_VERIFIED_EQUIVALENT";
        authorityFunction = aliasHit.fn;
        authorityCanonicalId = aliasHit.id;
      } else {
        evidence = "INFERENCE_ONLY";
        evidenceDetail = "no-text-evidence,no-authority";
      }
    }

    // Otorite kanıtı eksikse bu sınıf VERİLMEZ (sözleşme).
    if (
      evidence === "AUTHORITY_VERIFIED_EQUIVALENT" &&
      (!authorityFunction || !authorityCanonicalId)
    ) {
      evidence = "UNMEASURABLE";
      notMeasuredReason = "authority_evidence_incomplete";
    }

    /* ---------- POLİTİKA — mevcut profil otoritesinden TÜRER ---------- */
    const inProfile = profileKeys.has(fieldKey);
    const coreOrCategory = profileByKey.get(fieldKey);
    const fallbackProfile =
      inProfile && !coreOrCategory
        ? resolveProfileForField({ fieldKey, categoryId, needType, productType })
        : null;
    const importance =
      coreOrCategory?.importance ?? fallbackProfile?.importance ?? "-";
    const suppressionPolicy: SuppressionPolicy = !inProfile
      ? "NOT_APPLICABLE"
      : importance === "publish_required"
        ? "USER_DECISION_REQUIRED"
        : "AUTHORITY_MAY_SUPPRESS";
    const policySource = inProfile
      ? `${coreOrCategory ? "global-core+question-profiles" : "question-profiles"}:importance=${importance}`
      : "-";

    /* ---------- PROVENANCE EKSENİ — soru sonucundan BAĞIMSIZ ---------- */
    const expectedLabel = EXPECTED_LABEL[evidence];
    const provenanceMatch: Rec["provenanceMatch"] = !expectedLabel
      ? "N/A"
      : observedProvenance === expectedLabel
        ? "OK"
        : "MISMATCH";

    /* ---------- İKİ UFUK ---------- */
    for (const horizon of HORIZONS) {
      const decision: Decision = !inProfile
        ? "OUT_OF_SCOPE"
        : (horizon === "FIRST_SCREEN" ? firstScreen : fullQueue).has(fieldKey)
          ? "ASKED"
          : "NOT_ASKED";

      let outcome: Outcome;
      let detail = evidenceDetail;
      if (decision === "OUT_OF_SCOPE") {
        outcome = "OUT_OF_SCOPE";
      } else if (evidence === "UNMEASURABLE") {
        outcome = "not_measured";
      } else if (
        evidence === "EXPLICIT_TEXT" ||
        evidence === "EXPLICIT_BROWSE"
      ) {
        outcome =
          decision === "ASKED" ? "wrongly_repeated" : "correctly_suppressed";
      } else if (evidence === "AUTHORITY_VERIFIED_EQUIVALENT") {
        if (decision === "ASKED") {
          outcome = "authority_re_asked";
        } else if (suppressionPolicy === "USER_DECISION_REQUIRED") {
          outcome = "high_risk_silent_suppression";
          detail = "AUTHORITY_INSUFFICIENT_FOR_POLICY";
        } else if (provenanceMatch === "OK") {
          /**
           * D2 KAPANIŞI 3/3 (Wave K, 2026-08-31): politika bastırmaya
           * İZİN veriyor (AUTHORITY_MAY_SUPPRESS), kanıt çağrılabilir
           * otoriteyle doğrulanmış VE ürün kaydının kendi provenance'ı da
           * bu sınıfı DOĞRU beyan ediyorsa (CATALOG_ENRICHED), bastırma
           * kapanış açısından DOĞRUDUR (ölçülen: auto-10 C200→Mercedes).
           * Koşul ÇİFTTİR: provenance uyuşmazsa kayıt eskisi gibi
           * `authority_suppressed`ta kalır — sürüklenme hâlâ yakalanır.
           */
          outcome = "correctly_suppressed";
          detail = "authority-verified+provenance-recorded";
        } else {
          outcome = "authority_suppressed";
        }
      } else if (evidence === "INFERENCE_ONLY") {
        outcome =
          decision === "ASKED"
            ? "inference_re_asked"
            : "high_risk_silent_suppression";
      } else {
        // MISSING
        outcome =
          decision === "ASKED"
            ? "correctly_asked"
            : importance !== "optional"
              ? "missing_required_question"
              : "optional_not_asked";
      }

      out.push({
        id: `${sc.id}/${fieldKey}@${horizon}`,
        scenarioId: sc.id,
        fieldKey,
        horizon,
        evidence,
        decision,
        importance,
        suppressionPolicy,
        policySource,
        outcome,
        observedProvenance,
        provenanceMatch,
        normalizedValue: foldLabel(rawValue),
        authorityFunction,
        authorityCanonicalId,
        evidenceDetail: detail,
        notMeasuredReason,
      });
    }

    // Simülasyon dolgusunun kanıta karışmadığının KANITI.
    assert.ok(
      !(simulated.has(fieldKey) && rawValue === SIMULATED_ANSWER_VALUE),
      `${sc.id}/${fieldKey}: simülasyon dolgusu kanıt olarak okundu`,
    );
  }

  return out.sort(byId);
}

function measureAll(): Rec[] {
  const all: Rec[] = [];
  const ordered = [...SCENARIOS].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const sc of ordered) all.push(...measureScenario(sc));
  return all.sort(byId);
}

/**
 * Alan ayırıcı: hiçbir alan değerinde geçemeyecek bir kontrol kodu (U+0001).
 * Ayırıcı ŞART — ayırıcısız birleştirmede iki farklı kayıt kümesi aynı diziye
 * çökebilir ve determinizm karşılaştırması sessizce yalan söyleyebilir.
 * Kaynak metne görünmez bir bayt gömülmesin diye kod noktasıyla üretilir.
 */
const FIELD_SEP = String.fromCharCode(1);

/** Deterministik seri hâl — süre/timestamp/rastgele değer İÇERMEZ. */
function serialize(recs: Rec[]): string {
  return recs
    .map((r) =>
      [
        r.id,
        r.scenarioId,
        r.fieldKey,
        r.horizon,
        r.evidence,
        r.decision,
        r.importance,
        r.suppressionPolicy,
        r.policySource,
        r.outcome,
        r.observedProvenance,
        r.provenanceMatch,
        r.normalizedValue,
        r.authorityFunction,
        r.authorityCanonicalId,
        r.evidenceDetail,
        r.notMeasuredReason,
      ].join(FIELD_SEP),
    )
    .join("\n");
}

/* ------------------- KAPANIŞ UFKU — mekanik kapı ------------------------- */

/**
 * FIRST_SCREEN KAPANIŞ ÖLÇÜSÜ OLARAK KULLANILAMAZ. Scheduler aynı anda en çok
 * üç soru gösterdiği için ilk ekrandaki "sorulmadı", "bastırıldı" ile
 * "sıralamayı kaybetti"yi karıştırır. Kapı fonksiyon düzeyinde kapalıdır.
 */
function closureRecords(recs: Rec[], horizon: Horizon): Rec[] {
  if (horizon !== "FULL_QUEUE") {
    throw new Error(
      `kapanış ölçüsü yalnız FULL_QUEUE olabilir, verilen: ${horizon}`,
    );
  }
  return recs.filter((r) => r.horizon === horizon);
}

/* -------------------------------- RAPOR ---------------------------------- */

function tally(recs: Rec[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of [...SCORED_OUTCOMES, ...INFO_OUTCOMES]) out[o] = 0;
  for (const r of recs) out[r.outcome] = (out[r.outcome] ?? 0) + 1;
  return out;
}

function groupCount(recs: Rec[], pick: (r: Rec) => string): string {
  const m: Record<string, number> = {};
  for (const r of recs) m[pick(r)] = (m[pick(r)] ?? 0) + 1;
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(m).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)),
    ),
  );
}

function listIds(recs: Rec[], outcome: Outcome): string[] {
  return recs.filter((r) => r.outcome === outcome).map((r) => r.id);
}

function reportHorizon(label: Horizon, recs: Rec[]): void {
  const t = tally(recs);
  console.log(`\n===== ${label} =====`);
  if (label === "FIRST_SCREEN") {
    console.log(
      "  UYARI: FIRST_SCREEN KAPANIS OLCUSU DEGILDIR — scheduler aynı anda en\n" +
        "  çok 3 soru gösterir; buradaki 'sorulmadı', 'bastırıldı' ile 'sıraya\n" +
        "  girdi'yi karıştırır. Kapanış ölçüsü YALNIZ FULL_QUEUE'dur.",
    );
  }
  console.log(`  kayıt sayısı: ${recs.length}`);
  console.log("  --- puanlanan sonuçlar ---");
  for (const o of SCORED_OUTCOMES) console.log(`    ${o.padEnd(32)} ${t[o]}`);
  console.log("  --- bilgi amaçlı ---");
  for (const o of INFO_OUTCOMES) console.log(`    ${o.padEnd(32)} ${t[o]}`);
  const mism = recs.filter((r) => r.provenanceMatch === "MISMATCH");
  console.log("  --- ayrı eksen ---");
  console.log(`    provenance_mismatch              ${mism.length}`);
  console.log(
    `  missing_required_question importance kırılımı: ${groupCount(
      recs.filter((r) => r.outcome === "missing_required_question"),
      (r) => r.importance,
    )}`,
  );
  console.log(
    `  DEĞER TAŞIYAN alanlarda bastırma (gerçek bastırma ölçüsü): ` +
      `correctly_suppressed=${t.correctly_suppressed} ` +
      `high_risk_silent_suppression=${t.high_risk_silent_suppression} ` +
      `authority_suppressed=${t.authority_suppressed} ` +
      `wrongly_repeated=${t.wrongly_repeated}`,
  );
  const scored = recs.filter((r) => r.outcome !== "OUT_OF_SCOPE");
  console.log(
    `  kategori dağılımı (puanlanan): ${groupCount(scored, (r) => r.scenarioId.replace(/-\d+$/, ""))}`,
  );
  console.log(
    `  alan dağılımı (puanlanan):     ${groupCount(scored, (r) => r.fieldKey)}`,
  );
}

function dumpRecords(
  title: string,
  recs: Rec[],
  extra: (r: Rec) => string,
): void {
  console.log(`\n--- ${title} (${recs.length}) ---`);
  for (const r of recs) console.log(`  ${r.id}  ${extra(r)}`);
}

/* --------------------------------- MAIN ---------------------------------- */

function main(): void {
  const problems: string[] = [];
  const notMeasured = createNotMeasuredTally();

  /* ---- (1) SELF-FULFILLING KAPILARI ---- */
  const selfSource = readFileSync(__filename, "utf8");
  // Tanıtıcı, kaynak metinde kendisi olarak geçmesin diye parçalardan kurulur.
  const FIXTURE_TOKEN = ["CATEGORY", "COVERAGE", "V1"].join("_");
  const tokenHits = selfSource.split(FIXTURE_TOKEN).length - 1;
  if (tokenHits !== 2) {
    problems.push(
      `fixture tanıtıcısı ${tokenHits} kez geçiyor; yalnız import + projeksiyon (2) olmalı`,
    );
  }
  const lines = selfSource.split("\n");
  const projAt = lines.findIndex((l) => l.includes(`${FIXTURE_TOKEN}.map(`));
  if (projAt < 0) {
    problems.push("projeksiyon satırı bulunamadı");
  } else {
    const projBody = lines[projAt + 1] ?? "";
    if (!/Object\.freeze\(\{ id: s\.id, input: s\.input \}\),/.test(projBody)) {
      problems.push(
        `projeksiyon gövdesi yalnız id+input okumalı → '${projBody.trim()}'`,
      );
    }
  }
  for (const sc of SCENARIOS) {
    if (Object.keys(sc).length !== 2 || !Object.isFrozen(sc)) {
      problems.push(`${sc.id}: projeksiyon iki alanlı ve dondurulmuş değil`);
    }
  }

  /* ---- (2) İKİ BAĞIMSIZ ÖLÇÜM — determinizm ---- */
  const runA = measureAll();
  const runB = measureAll();
  const sA = serialize(runA);
  const sB = serialize(runB);
  const deterministic = sA === sB;
  if (!deterministic) {
    const a = sA.split("\n");
    const b = sB.split("\n");
    const firstDiff = a.findIndex((l, i) => l !== b[i]);
    problems.push(
      `DETERMİNİZM BOZUK — ilk fark satır ${firstDiff}: '${a[firstDiff]}' vs '${b[firstDiff]}'`,
    );
  }

  const recs = runA;

  /* ---- (3) SÖZLEŞME INVARIANT'LARI ---- */
  const ids = recs.map((r) => r.id);
  if (new Set(ids).size !== ids.length) {
    problems.push("kayıt kimlikleri benzersiz değil");
  }

  const pairs = new Map<string, Set<Horizon>>();
  for (const r of recs) {
    const key = `${r.scenarioId}/${r.fieldKey}`;
    if (!pairs.has(key)) pairs.set(key, new Set());
    pairs.get(key)!.add(r.horizon);
  }
  for (const [k, hs] of pairs) {
    if (!hs.has("FIRST_SCREEN") || !hs.has("FULL_QUEUE")) {
      problems.push(`${k}: iki ufkun ikisi de yok → [${[...hs].join(", ")}]`);
    }
  }

  const t = tally(recs);
  const sumAll = [...SCORED_OUTCOMES, ...INFO_OUTCOMES].reduce(
    (n, o) => n + t[o]!,
    0,
  );
  if (sumAll !== recs.length) {
    problems.push(`aggregate toplamı ${sumAll} != kayıt sayısı ${recs.length}`);
  }
  const scoredTotal = SCORED_OUTCOMES.reduce((n, o) => n + t[o]!, 0);
  const infoTotal = INFO_OUTCOMES.reduce((n, o) => n + t[o]!, 0);
  if (scoredTotal + infoTotal !== recs.length) {
    problems.push("puanlanan + bilgi toplamı kayıt sayısına eşit değil");
  }
  const outOfScopeRecs = recs.filter((r) => r.outcome === "OUT_OF_SCOPE");
  if (outOfScopeRecs.some((r) => r.decision !== "OUT_OF_SCOPE")) {
    problems.push("OUT_OF_SCOPE sonucu OUT_OF_SCOPE kararıyla eşleşmiyor");
  }
  if (SCORED_OUTCOMES.some((o) => listIds(outOfScopeRecs, o).length > 0)) {
    problems.push("OUT_OF_SCOPE kayıtları puanlanan sayaçlara sızdı");
  }

  // FIRST_SCREEN kapanış kapısından geçemez — mekanik kanıt.
  let closureGateHeld = false;
  try {
    closureRecords(recs, "FIRST_SCREEN" as Horizon);
  } catch {
    closureGateHeld = true;
  }
  if (!closureGateHeld) problems.push("FIRST_SCREEN kapanış kapısından geçti");
  const closure = closureRecords(recs, "FULL_QUEUE");
  if (closure.some((r) => r.horizon !== "FULL_QUEUE")) {
    problems.push("kapanış kümesinde FULL_QUEUE dışı kayıt var");
  }

  // Simülasyon dolgusu kanıta karışmadı — mekanik kanıt.
  const simulatedFold = foldLabel(SIMULATED_ANSWER_VALUE);
  const leaked = recs.filter((r) => r.normalizedValue === simulatedFold);
  if (leaked.length) {
    problems.push(`${leaked.length} kayıt simülasyon dolgusunu kanıt saydı`);
  }

  // AUTHORITY sınıfı kanıtsız verilemez.
  for (const r of recs) {
    if (
      r.evidence === "AUTHORITY_VERIFIED_EQUIVALENT" &&
      (!r.authorityFunction || !r.authorityCanonicalId)
    ) {
      problems.push(`${r.id}: otorite kanıtı eksik`);
    }
  }

  /* ---- (4) not_measured defteri ---- */
  for (const r of recs) {
    if (r.outcome === "not_measured") {
      notMeasured.record(r.id, r.notMeasuredReason || "unclassified");
    }
  }

  /* ---- (5) RAPOR ---- */
  const first = recs.filter((r) => r.horizon === "FIRST_SCREEN");
  const full = closure;

  console.log("=== SORU BASTIRMA OLCUM OTORITESI V1 ===");
  console.log(
    `senaryo: ${SCENARIOS.length}   kayıt: ${recs.length}   (her scenarioId/fieldKey icin iki ufuk)`,
  );
  console.log(
    "\nESKİ 45 SAYISI İLE KARŞILAŞTIRILAMAZ: o ölçüm tek eksenliydi ve aracı\n" +
      "repoda kayıtlı değildi. Buradaki yedi sonuç İKİ ayrı eksenden türer;\n" +
      "aradaki sayısal fark bir 'iyileşme' ya da 'kötüleşme' DEĞİLDİR.",
  );
  console.log(
    "\nİKİ AYRI OTORİTE — okuyanın bilmesi ZORUNLU:\n" +
      "  ALAN EVRENİ  = question-profiles + global-core (scheduler'ın kendi\n" +
      "                 önceliğiyle; core budget/city/delivery'de kazanır)\n" +
      "  SORU KARARI  = resolveHybridQuestions (questionSource=canonical-hybrid)\n" +
      "Bu ikisi AYNI otorite değildir. Bu yüzden `missing_required_question`,\n" +
      "'bastırıldı' DEĞİL 'karar otoritesi bu alanı hiç önermedi' anlamına gelir:\n" +
      "bir KAPSAMA göstergesidir, bir bastırma hatası değil. Bastırma yalnız\n" +
      "DEĞER TAŞIYAN alanlarda ölçülür (correctly_suppressed /\n" +
      "high_risk_silent_suppression / authority_suppressed).",
  );

  reportHorizon("FIRST_SCREEN", first);
  reportHorizon("FULL_QUEUE", full);

  console.log("\n===== KAPANIŞ UFKU AYRINTISI (FULL_QUEUE) =====");
  dumpRecords(
    "high_risk_silent_suppression",
    full.filter((r) => r.outcome === "high_risk_silent_suppression"),
    (r) =>
      `evidence=${r.evidence} prov=${r.observedProvenance} imp=${r.importance} value="${r.normalizedValue}" ${r.evidenceDetail}`,
  );
  dumpRecords(
    "missing_required_question",
    full.filter((r) => r.outcome === "missing_required_question"),
    (r) => `imp=${r.importance} ${r.evidenceDetail}`,
  );
  dumpRecords(
    "wrongly_repeated",
    full.filter((r) => r.outcome === "wrongly_repeated"),
    (r) => `evidence=${r.evidence} value="${r.normalizedValue}"`,
  );
  dumpRecords(
    "authority_suppressed",
    full.filter((r) => r.outcome === "authority_suppressed"),
    (r) =>
      `authority=${r.authorityFunction} id=${r.authorityCanonicalId} value="${r.normalizedValue}"`,
  );
  dumpRecords(
    "provenance_mismatch (ayrı eksen)",
    full.filter((r) => r.provenanceMatch === "MISMATCH"),
    (r) =>
      `evidence=${r.evidence} beklenen=${EXPECTED_LABEL[r.evidence]} gözlenen=${r.observedProvenance} outcome=${r.outcome}`,
  );
  dumpRecords(
    "not_measured",
    full.filter((r) => r.outcome === "not_measured"),
    (r) => `neden=${r.notMeasuredReason}`,
  );

  console.log("\n===== BÜTÜN KAYIT KİMLİKLERİ =====");
  for (const o of [...SCORED_OUTCOMES, ...INFO_OUTCOMES]) {
    const idsOf = listIds(recs, o);
    console.log(`\n[${o}] ${idsOf.length}`);
    for (const id of idsOf) console.log(`  ${id}`);
  }
  const mismAll = recs.filter((r) => r.provenanceMatch === "MISMATCH");
  console.log(`\n[provenance_mismatch] ${mismAll.length}`);
  for (const r of mismAll) console.log(`  ${r.id}`);

  console.log("\n===== DETERMİNİZM =====");
  console.log(
    `iki bağımsız ölçüm byte-birebir aynı: ${deterministic ? "EVET" : "HAYIR"}`,
  );
  console.log(`kayıt sayısı A=${runA.length} B=${runB.length}`);

  /* ---- (6) ÇIKIŞ ---- */
  if (problems.length) {
    console.error("\nKIRMIZI — ölçüm sözleşmesi bozuk:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  const exitCode = notMeasured.exitCode();
  const closureComplete = exitCode === 0;

  console.log("\n===== ÇIKIŞ SINIFI =====");
  console.log(
    closureComplete
      ? "ÖLÇÜM TAMAMLANDI — sözleşme sağlam, ölçülemeyen kayıt yok (exit 0)."
      : `ÖLÇÜM SÖZLEŞMESİ SAĞLAM — FAKAT KAPANIŞ TAMAMLANMADI (exit ${NOT_MEASURED_EXIT}).\n` +
          `  ${notMeasured.count} kayıt ölçülemedi ` +
          `(${notMeasured.count / HORIZONS.length} scenarioId/fieldKey × ${HORIZONS.length} ufuk);\n` +
          "  bunlar hiçbir başarı ya da hata sayacına girmez. Bu sonuç YEŞİL\n" +
          "  DEĞİLDİR ve 'başarılı kapanış' diye okunamaz: ölçülemeyeni ölçülmüş\n" +
          "  saymak, bu doğrulayıcının var oluş nedeninin tam tersidir. Kapanış\n" +
          "  ancak ölçülemeyen kayıt kalmayınca tamamlanır.",
  );
  console.log(
    `\nölçüm deterministik: ${deterministic ? "EVET" : "HAYIR"}   ` +
      `not_measured=${notMeasured.count}   ` +
      `high_risk_silent_suppression(FULL_QUEUE)=${tally(full).high_risk_silent_suppression}`,
  );
  console.log(
    "NOT: high_risk_silent_suppression bu TABAN ölçümünde tek başına kırmızı\n" +
      "değildir — çıkış kodunu belirlemez. Kapanış kapısı D2 (KB-17 production\n" +
      "düzeltmesi) sonrası kurulur.",
  );
  process.exit(exitCode);
}

main();
