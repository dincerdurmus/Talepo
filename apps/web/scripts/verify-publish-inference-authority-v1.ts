/**
 * YAYIN ÇIKARIM OTORİTESİ V1 — D3c-a (2026-08-27).
 *
 * ÖLÇTÜĞÜ TEK SÖZLEŞME. Talepo'nun KENDİ tahmininden gelen ve kullanıcının
 * dokunmadığı bir değer, yayınlanan talebin KULLANICI CEVABI kanalına
 * (`payload.fields[]` → sunucuda `fieldValues`) yazılamaz. Firmalar o kanalı
 * talebin cevapları olarak okur; oraya yazılan her değer "kullanıcı böyle
 * dedi" iddiasıdır ve tahmin bu iddiayı taşıyamaz.
 *
 * SÖZLEŞMENİN DİĞER YÜZÜ AYNI ANDA ÖLÇÜLÜR:
 *   - Tahmin KAYBOLMAZ: kanonik anlama durumunda değeriyle durur ve sorunun
 *     kendi sözleşmesi (`QuestionCandidate.inferredSuggestion`) üzerinden
 *     ÖNERİ olarak görünür kalır (D3b'nin 35 önerisi geri görünmez yapılamaz).
 *   - Kullanıcı öneriyi AÇIKÇA seçtiğinde değer `USER_EXPLICIT` otoriteyle
 *     yayın torbasına girer — onay yolu üretim API'siyle (`syncFromBrowse`)
 *     simüle edilir, elle provenance yazılmaz.
 *   - `rawInput` değişmez; torba kurucusu kanonik durumu MUTASYONA uğratamaz.
 *   - Soruyu kapatmaya YETKİLİ değerler (kanonik merdivende `VERIFIED` ve
 *     üstü — yetki `mayCloseQuestion`dan OKUNUR, burada ikinci bir merdiven
 *     ya da allowlist kurulmaz) yayın torbasından DÜŞÜRÜLEMEZ.
 *   - İç kanıt alanları (`brandCandidate`, `brandEvidence`) hiçbir senaryoda
 *     kullanıcı sorusu hâline gelemez.
 *
 * ÜRETİM MANTIĞI KOPYALANMAZ. Değer torbası `buildPublishFieldValues`tan,
 * sayfa girdileri ortak üretim kurucusundan (`talep-production-inputs-v1`),
 * görünür alanlar `getVisibleCategoryFields`ten, öneriler
 * `filterRenderableCandidates`ten okunur. Sayfanın da aynı kurucuyu
 * kullandığı `page.tsx` AST'siyle kanıtlanır — substring aramasına güvenilmez.
 *
 * KURAL KATEGORİYE, ALANA YA DA SENARYOYA ÖZEL DEĞİLDİR. Tek ölçüt kanonik
 * cevap otoritesidir (`answer-authority`). `furn-04/usageArea` ve
 * `auto-02/condition` yalnız ADLANDIRILMIŞ kanaryalardır; kapı 108 senaryonun
 * tamamında kimlik bazında işler.
 *
 * DONDURULMUŞ TABAN (D3c-a ölçüm blokeri, 2026-08-27). "Sızan 0" hükmü tek
 * başına güvenilmez: bir çıkarım kimliği ölçüm evreninden sessizce kaybolursa
 * sızacak kimse kalmadığı için de sıfır çıkar. Bu yüzden ölçülen INFERRED
 * evreni (85 kimlik) ve kullanıcı dokunuşu olmadan yayın adayına dönüşen aile
 * (23 kimlik) `fixtures/publish-inference-authority-v1` içinde BAĞIMSIZ veri
 * otoritesi olarak dondurulmuştur. Karşılaştırma İKİ YÖNLÜ ve kimlik
 * bazındadır: kaybolan kimlik de, açıklanamayan yeni kimlik de KIRMIZI.
 * Fixture bu dosyadan ya da üretim kodundan türetilmez; içinde import
 * bulunmadığı da ayrıca denetlenir. Hüküm bloğundan önce makine tarafından
 * okunabilir sayaç satırları basılır (`INFERRED_MISSING=...` vb.).
 *
 * SALT-OKUNUR: hiçbir veritabanı yazımı, hiçbir ağ çağrısı yapılmaz; bu
 * doğrulayıcı fixture'ı da hiçbir dosyayı da YENİDEN YAZMAZ.
 */

import fs from "node:fs";
import path from "node:path";

import ts from "typescript";

import { CATEGORY_COVERAGE_V1 } from "./fixtures/category-coverage-v1";
import {
  BASELINE_INFERRED_IDENTITIES,
  BASELINE_UNCONFIRMED_PUBLISH_CANDIDATES,
} from "./fixtures/publish-inference-authority-v1";
import { productionInputs } from "./lib/talep-production-inputs-v1";
import { syncFromBrowse, syncFromText } from "../src/lib/request-composer";
import { resolveHybridQuestions } from "../src/lib/request-composer/questions";
import {
  buildPublishFieldValues,
  filterRenderableCandidates,
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

/** ADLANDIRILMIŞ kanaryalar — kapı yine 108 senaryonun tamamında işler. */
const TARGET_IDS = ["furn-04/usageArea", "auto-02/condition"] as const;

/** İç kanıt alanları — anlama katmanının kendi muhasebesi, soru DEĞİL. */
const INTERNAL_EVIDENCE_KEYS = ["brandCandidate", "brandEvidence"] as const;

type FieldMap = Record<string, CanonicalFieldState | undefined>;

function fieldsOf(state: CanonicalRequestState): FieldMap {
  return state.fields;
}

function valueOf(field: CanonicalFieldState | undefined): string {
  return field?.kind === "VALUE" && field.value != null
    ? String(field.value).trim()
    : "";
}

type IdentityRow = {
  id: string;
  authority: Authority;
  value: string;
  /** Kullanıcı cevabı kanalına (payload.fields / brandPreference) ulaştı mı? */
  reachedPayload: boolean;
  /** Soru adayı olarak öneri taşıyor mu? */
  suggestionVisible: boolean;
  /**
   * Süzgeç OLMASAYDI kanala yazılacak mıydı? (Görünür alana ya da beyaz
   * eşyada `brandPreference`e değer taşıyor.) D3c-a öncesi sızan aile budur.
   */
  unconfirmedPublishCandidate: boolean;
  /** Alanın sorusu bu turda soru adayı olarak render ediliyor mu? */
  questionRendered: boolean;
  /** Kapatmaya yetkili değer yayın torbasından düşürüldü mü? */
  stripped: boolean;
};

type Measurement = {
  /** Sözleşme ihlalleri — hüküm bunlardan verilir. */
  violations: string[];
  /** Kimlik satırları (INFERRED + kapatmaya yetkili kanaryalar). */
  rows: IdentityRow[];
  /** Onay yolu ölçülen kimlikler (yalnız öneri olarak görünenler). */
  confirmPathMeasured: string[];
  /** Onay yolunda USER_EXPLICIT olarak yayına ULAŞAMAYAN kimlikler. */
  confirmPathDropped: string[];
};

function measureScenario(scenarioId: string, input: string): Measurement {
  const violations: string[] = [];
  const rows: IdentityRow[] = [];
  const confirmPathMeasured: string[] = [];
  const confirmPathDropped: string[] = [];

  const { state } = syncFromText(null, input);
  const fields = fieldsOf(state);
  const fieldsBefore = JSON.stringify(state.fields);
  const rawBefore = state.understanding.rawInput;

  const inputs = productionInputs(state, input);
  const { values, dynamicFields, categoryId } = inputs;
  const visibleKeys = new Set(dynamicFields.map((f) => f.key));

  // Kullanıcı dokunuşu YOK — serbest metin sonrası doğrudan yayın modeli.
  const publishBag = buildPublishFieldValues({
    canonicalFields: state.fields,
    values,
    userTouchedKeys: [],
  });

  /** Sayfanın kanala yazdığı değer: yalnız görünür alanlar torbadan okunur. */
  const payloadValueOf = (key: string): string =>
    visibleKeys.has(key) ? (publishBag[key] ?? "").trim() : "";
  const brandPreferenceValue =
    categoryId === "appliances" ? (publishBag.brand ?? "").trim() : "";

  const production = resolveHybridQuestions(state, inputs.options);
  const renderable = filterRenderableCandidates(
    inputs.renderInputWithout(production),
  );
  const candidateByKey = new Map(renderable.map((c) => [c.fieldKey, c]));

  for (const key of INTERNAL_EVIDENCE_KEYS) {
    if (candidateByKey.has(key)) {
      violations.push(
        `${scenarioId}/${key}: iç kanıt alanı kullanıcı sorusu olarak render ediliyor`,
      );
    }
  }

  for (const [key, field] of Object.entries(fields)) {
    const value = valueOf(field);
    if (!value) continue;
    const authority = classifyAnswerAuthority(field);
    const id = `${scenarioId}/${key}`;

    if (isInferenceOnlyAnswer(field)) {
      const reachedPayload =
        payloadValueOf(key) !== "" ||
        (key === "brand" && brandPreferenceValue !== "");
      const suggestion = candidateByKey.get(key)?.inferredSuggestion;
      const suggestionVisible = suggestion?.value?.trim() === value;
      const unconfirmedPublishCandidate =
        (visibleKeys.has(key) && (values[key] ?? "").trim() !== "") ||
        (categoryId === "appliances" &&
          key === "brand" &&
          (values.brand ?? "").trim() !== "");
      rows.push({
        id,
        authority,
        value,
        reachedPayload,
        suggestionVisible,
        unconfirmedPublishCandidate,
        questionRendered: candidateByKey.has(key),
        stripped: false,
      });

      /* (1) Onaysız çıkarım kullanıcı cevabı kanalına yazılamaz. */
      if (reachedPayload) {
        violations.push(
          `${id}: '${value}' yalnız çıkarım (INFERRED) ve kullanıcı dokunuşu yok — ` +
            `yine de kullanıcı cevabı kanalına yazıldı`,
        );
      }

      /* (2a) Değer kanonik anlama durumunda KORUNUR. */
      if (valueOf(fields[key]) !== value) {
        violations.push(`${id}: kanonik değer yayın kurucusunda kayboldu`);
      }

      /* (2b) Soru adayı olarak görünüyorsa öneri sözleşmesini taşımalı. */
      if (candidateByKey.has(key) && !suggestionVisible) {
        violations.push(
          `${id}: soru adayı görünüyor ama 'inferredSuggestion' önerisi yok — ` +
            `tahmin görünürlüğü kaybedildi (D3b gerilemesi)`,
        );
      }

      /* (3a) Kullanıcı dokunuşu değeri yayına taşır (aynı değeri yazsa bile). */
      const touchedBag = buildPublishFieldValues({
        canonicalFields: state.fields,
        values,
        userTouchedKeys: [key],
      });
      if ((touchedBag[key] ?? "").trim() !== (values[key] ?? "").trim()) {
        violations.push(
          `${id}: kullanıcı dokunuşuna rağmen değer yayın torbasından düştü`,
        );
      }

      /* (3b) Açık seçim üretim API'siyle USER_EXPLICIT olarak yayına ulaşır. */
      if (candidateByKey.has(key)) {
        confirmPathMeasured.push(id);
        const confirmed = syncFromBrowse(state, { key, value }).state;
        const confirmedField = fieldsOf(confirmed)[key];
        const confirmedAuthority = classifyAnswerAuthority(confirmedField);
        if (confirmedAuthority !== "USER_EXPLICIT") {
          confirmPathDropped.push(id);
          violations.push(
            `${id}: öneri onayı sonrası otorite USER_EXPLICIT değil → ${confirmedAuthority}`,
          );
        }
        const confirmedInputs = productionInputs(confirmed, input);
        const confirmedBag = buildPublishFieldValues({
          canonicalFields: confirmed.fields,
          values: confirmedInputs.values,
          userTouchedKeys: [],
        });
        if ((confirmedBag[key] ?? "").trim() === "") {
          confirmPathDropped.push(id);
          violations.push(
            `${id}: kullanıcı onayladı ama değer yayın torbasına ulaşmadı`,
          );
        }
      }
    } else if (mayCloseQuestion(authority)) {
      /* (6) Yetki merdivenden OKUNUR: kapatmaya yetkili değer düşürülemez. */
      const stripped =
        (values[key] ?? "").trim() !== "" &&
        (publishBag[key] ?? "").trim() !== (values[key] ?? "").trim();
      rows.push({
        id,
        authority,
        value,
        reachedPayload: payloadValueOf(key) !== "",
        suggestionVisible: false,
        unconfirmedPublishCandidate: false,
        questionRendered: candidateByKey.has(key),
        stripped,
      });
      if (stripped) {
        violations.push(
          `${id}: otorite=${authority} (mayCloseQuestion=true) ama değer ` +
            `yayın torbasından düşürüldü — yalnız INFERRED süzülebilir`,
        );
      }
    }
  }

  /* (4) Kurucular kanonik durumu ve rawInput'u DEĞİŞTİRMEZ. */
  if (JSON.stringify(state.fields) !== fieldsBefore) {
    violations.push(`${scenarioId}: yayın ölçümü kanonik alanları değiştirdi`);
  }
  if (state.understanding.rawInput !== rawBefore) {
    violations.push(`${scenarioId}: rawInput değişti — dokunulmazdı`);
  }

  return { violations, rows, confirmPathMeasured, confirmPathDropped };
}

function measureAll(): Measurement {
  const out: Measurement = {
    violations: [],
    rows: [],
    confirmPathMeasured: [],
    confirmPathDropped: [],
  };
  for (const sc of CATEGORY_COVERAGE_V1) {
    const m = measureScenario(sc.id, sc.input);
    out.violations.push(...m.violations);
    out.rows.push(...m.rows);
    out.confirmPathMeasured.push(...m.confirmPathMeasured);
    out.confirmPathDropped.push(...m.confirmPathDropped);
  }
  out.violations.sort();
  out.rows.sort((a, b) => a.id.localeCompare(b.id));
  out.confirmPathMeasured.sort();
  out.confirmPathDropped.sort();
  return out;
}

/**
 * WIRING KAPISI — SAYFA AYNI KURUCUYU KULLANIYOR MU? (AST)
 *
 * Ortak kurucuyu çağırıp yeşil dönmek, SAYFANIN da onu çağırdığını
 * kanıtlamaz. Dört şey yapısal olarak kanıtlanır:
 *   1. `page.tsx` `buildPublishFieldValues` import ediyor.
 *   2. Torba çağrısının `userTouchedKeys` girdisi, understanding snapshot'ının
 *      `confirmedFieldKeys` girdisiyle AYNI değişkendir (tek dokunuş listesi).
 *   3. Payload `fields:` dizisi içinde ham `dynamicValues` okuması KALMADI
 *      (`isFieldRequired(field, dynamicValues)` çağrı argümanı serbesttir).
 *   4. `fields:` dizisi torba sonucunu gerçekten okuyor.
 */
function checkPublishWiring(): string[] {
  const problems: string[] = [];
  const pagePath = path.join(process.cwd(), "src", "app", "talep", "page.tsx");
  const source = ts.createSourceFile(
    pagePath,
    fs.readFileSync(pagePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  let importsBuilder = false;
  let bagTouchedKeysId: string | null = null;
  let snapshotConfirmedId: string | null = null;
  let fieldsArrayReadsBag = false;
  const rawReadsInFieldsArray: string[] = [];

  const identifierOf = (node: ts.Expression | undefined): string | null =>
    node && ts.isIdentifier(node) ? node.text : null;

  const propertyValue = (
    call: ts.CallExpression,
    property: string,
  ): ts.Expression | undefined => {
    const arg = call.arguments[0];
    if (!arg || !ts.isObjectLiteralExpression(arg)) return undefined;
    for (const p of arg.properties) {
      if (
        ts.isPropertyAssignment(p) &&
        ts.isIdentifier(p.name) &&
        p.name.text === property
      ) {
        return p.initializer;
      }
    }
    return undefined;
  };

  /** `fields:` dizisi içinde dynamicValues'a DEĞER okuması var mı? */
  const scanFieldsArray = (array: ts.ArrayLiteralExpression): void => {
    const scan = (n: ts.Node): void => {
      if (
        (ts.isElementAccessExpression(n) || ts.isPropertyAccessExpression(n)) &&
        ts.isIdentifier(n.expression)
      ) {
        if (n.expression.text === "dynamicValues") {
          rawReadsInFieldsArray.push(n.getText(source));
        }
        if (n.expression.text === bagVariableName) {
          fieldsArrayReadsBag = true;
        }
      }
      ts.forEachChild(n, scan);
    };
    scan(array);
  };

  let bagVariableName: string | null = null;

  const visit = (node: ts.Node): void => {
    if (
      ts.isImportSpecifier(node) &&
      node.name.text === "buildPublishFieldValues"
    ) {
      importsBuilder = true;
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === "buildPublishFieldValues"
    ) {
      bagVariableName = node.name.text;
      bagTouchedKeysId = identifierOf(
        propertyValue(node.initializer, "userTouchedKeys"),
      );
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "buildPublishUnderstandingSnapshot"
    ) {
      snapshotConfirmedId = identifierOf(
        propertyValue(node, "confirmedFieldKeys"),
      );
    }
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "fields" &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      scanFieldsArray(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  console.log("\n--- wiring kapisi (page.tsx AST) ---");
  console.log(`  torba kurucusu import edilmis   : ${importsBuilder ? "EVET" : "HAYIR"}`);
  console.log(`  torba degiskeni                 : ${bagVariableName ?? "YOK"}`);
  console.log(
    `  dokunus listesi tek kaynak      : ` +
      `${bagTouchedKeysId ?? "?"} == ${snapshotConfirmedId ?? "?"} → ` +
      `${bagTouchedKeysId != null && bagTouchedKeysId === snapshotConfirmedId ? "EVET" : "HAYIR"}`,
  );
  console.log(
    `  fields[] ham dynamicValues okur : ${rawReadsInFieldsArray.length === 0 ? "HAYIR" : rawReadsInFieldsArray.join(", ")}`,
  );
  console.log(`  fields[] torbadan okur          : ${fieldsArrayReadsBag ? "EVET" : "HAYIR"}`);

  if (!importsBuilder) {
    problems.push("wiring: page.tsx `buildPublishFieldValues` import etmiyor");
  }
  if (!bagVariableName) {
    problems.push("wiring: yayın torbası `buildPublishFieldValues` ile kurulmuyor");
  }
  if (bagTouchedKeysId == null || bagTouchedKeysId !== snapshotConfirmedId) {
    problems.push(
      "wiring: torbanın `userTouchedKeys` girdisi snapshot'ın `confirmedFieldKeys` " +
        "girdisiyle aynı değişken değil — iki ayrı dokunuş kaydı",
    );
  }
  for (const read of [...new Set(rawReadsInFieldsArray)].sort()) {
    problems.push(
      `wiring: payload fields[] içinde ham dynamicValues okuması duruyor → ${read}`,
    );
  }
  if (!fieldsArrayReadsBag) {
    problems.push("wiring: payload fields[] torba sonucunu okumuyor");
  }
  return problems;
}

/**
 * DONDURULMUŞ TABAN KAPILARI — D3c-a ölçüm blokeri.
 *
 * Fixture BAĞIMSIZ veri otoritesidir; buradaki hiçbir kapı fixture'ı ölçümden
 * güncellemez, yalnız karşılaştırır. Karşılaştırma iki yönlü ve kimlik
 * bazındadır — toplam sayı tek başına başarı sayılmaz:
 *   (a) fixture'ın kendisi sıralı + benzersiz + 23 ⊆ 85 + import'suz,
 *   (b) ölçülen INFERRED evreni == dondurulmuş 85 (kaybolan da yeni de kırmızı),
 *   (c) dokunuşsuz yayın adayı ailesi == dondurulmuş 23 (iki yönlü),
 *   (d) 23'ün tamamı kullanıcı cevabı kanalının DIŞINDA ama kanonik durumda
 *       ve (sorusu render edildiğinde) öneri katmanında DURUYOR,
 *   (e) USER_EXPLICIT ve VERIFIED kanaryaları yayına devam ediyor; ölçüm
 *       evrenleri boşsa "sıfır düşüş" hükmü anlamsızdır ve kırmızıdır.
 */
function checkFrozenBaseline(m: Measurement): string[] {
  const problems: string[] = [];

  /* (a) Fixture veri otoritesi sağlam mı? */
  const validateList = (name: string, list: readonly string[]): void => {
    if (JSON.stringify([...list].sort()) !== JSON.stringify([...list])) {
      problems.push(`fixture: ${name} sıralı değil — veri otoritesi bozuk`);
    }
    if (new Set(list).size !== list.length) {
      problems.push(`fixture: ${name} benzersiz değil — yinelenen kimlik var`);
    }
  };
  validateList("BASELINE_INFERRED_IDENTITIES", BASELINE_INFERRED_IDENTITIES);
  validateList(
    "BASELINE_UNCONFIRMED_PUBLISH_CANDIDATES",
    BASELINE_UNCONFIRMED_PUBLISH_CANDIDATES,
  );
  const baselineAll = new Set(BASELINE_INFERRED_IDENTITIES);
  for (const id of BASELINE_UNCONFIRMED_PUBLISH_CANDIDATES) {
    if (!baselineAll.has(id)) {
      problems.push(
        `fixture: ${id} 23 ailesinde ama 85 evreninde yok — altküme bozuk`,
      );
    }
  }
  const fixtureSource = fs.readFileSync(
    path.join(
      process.cwd(),
      "scripts",
      "fixtures",
      "publish-inference-authority-v1.ts",
    ),
    "utf8",
  );
  if (
    /^\s*import[\s({"']/m.test(fixtureSource) ||
    /\bfrom\s+["']/.test(fixtureSource) ||
    /\brequire\s*\(/.test(fixtureSource)
  ) {
    problems.push(
      "fixture: kaynakta import/require var — taban elle dondurulur, koddan türetilmez",
    );
  }

  /* (b) Ölçülen INFERRED evreni == dondurulmuş 85, iki yönlü. */
  const inferredRows = m.rows.filter((r) => r.authority === "INFERRED");
  const measuredIds = new Set(inferredRows.map((r) => r.id));
  const missing = BASELINE_INFERRED_IDENTITIES.filter(
    (id) => !measuredIds.has(id),
  );
  const unexpected = [...measuredIds].filter((id) => !baselineAll.has(id)).sort();
  for (const id of missing) {
    problems.push(
      `taban: ${id} ölçülen INFERRED evreninden KAYBOLDU — "sızan 0" bu kayıpla ` +
        `yanlış başarıya dönüşür`,
    );
  }
  for (const id of unexpected) {
    problems.push(
      `taban: ${id} açıklanamayan YENİ INFERRED kimlik — bilinçliyse fixture ` +
        `karar gerekçesiyle güncellenir`,
    );
  }

  /* (c) Dokunuşsuz yayın adayı ailesi == dondurulmuş 23, iki yönlü. */
  const familyBaseline = new Set(BASELINE_UNCONFIRMED_PUBLISH_CANDIDATES);
  const measuredFamily = new Set(
    inferredRows.filter((r) => r.unconfirmedPublishCandidate).map((r) => r.id),
  );
  const familyMissing = BASELINE_UNCONFIRMED_PUBLISH_CANDIDATES.filter(
    (id) => !measuredFamily.has(id),
  );
  const familyUnexpected = [...measuredFamily]
    .filter((id) => !familyBaseline.has(id))
    .sort();
  for (const id of familyMissing) {
    problems.push(
      `taban: ${id} dokunuşsuz yayın adayı ailesinden KAYBOLDU — koruma iddiası ` +
        `ölçülemez hâle geldi`,
    );
  }
  for (const id of familyUnexpected) {
    problems.push(
      `taban: ${id} ailede olmayan yeni dokunuşsuz yayın adayı — süzgecin yükü ` +
        `sessizce büyüdü`,
    );
  }

  /* (d) 23'ün tamamı kanal DIŞINDA ama katmanlarda DURUYOR. */
  const rowById = new Map(inferredRows.map((r) => [r.id, r]));
  let familyProtected = 0;
  const familyLeaked: string[] = [];
  for (const id of BASELINE_UNCONFIRMED_PUBLISH_CANDIDATES) {
    const row = rowById.get(id);
    if (!row) continue; // kayıp zaten (c)'de kırmızı
    if (row.reachedPayload) {
      familyLeaked.push(id);
      problems.push(
        `taban: ${id} onaysız çıkarım kullanıcı cevabı kanalına SIZDI`,
      );
    } else {
      familyProtected += 1;
    }
    if (row.value.trim() === "") {
      problems.push(`taban: ${id} kanonik durumda değersiz kaldı`);
    }
    if (row.questionRendered && !row.suggestionVisible) {
      problems.push(
        `taban: ${id} sorusu render ediliyor ama öneri katmanından kayboldu`,
      );
    }
  }

  /* (e) Kanaryalar yayına devam — boş evrenle "sıfır düşüş" sayılmaz. */
  const closerRows = m.rows.filter((r) => r.authority !== "INFERRED");
  const userExplicitRows = closerRows.filter(
    (r) => r.authority === "USER_EXPLICIT",
  );
  const verifiedRows = closerRows.filter((r) => r.authority === "VERIFIED");
  const confirmDropped = [...new Set(m.confirmPathDropped)];
  const userExplicitDropped =
    userExplicitRows.filter((r) => r.stripped).length + confirmDropped.length;
  const verifiedDropped = verifiedRows.filter((r) => r.stripped).length;
  if (userExplicitRows.length === 0 || m.confirmPathMeasured.length === 0) {
    problems.push(
      "kanarya: USER_EXPLICIT ölçüm evreni boş — düşüş sayacı anlamsız (ölçülmedi ≠ sıfır)",
    );
  }
  if (verifiedRows.length === 0) {
    problems.push(
      "kanarya: VERIFIED ölçüm evreni boş — düşüş sayacı anlamsız (ölçülmedi ≠ sıfır)",
    );
  }

  console.log("\n--- dondurulmus taban (D3c-a olcum blokeri) ---");
  console.log(
    `  INFERRED evren                  : fixture ${BASELINE_INFERRED_IDENTITIES.length} / olculen ${measuredIds.size}`,
  );
  console.log(
    `  dokunussuz yayin aday ailesi    : fixture ${BASELINE_UNCONFIRMED_PUBLISH_CANDIDATES.length} / olculen ${measuredFamily.size}`,
  );
  console.log(
    `  USER_EXPLICIT kanarya evreni    : kapatan ${userExplicitRows.length} + onay yolu ${m.confirmPathMeasured.length}`,
  );
  console.log(`  VERIFIED kanarya evreni         : ${verifiedRows.length}`);

  console.log("\n--- makine ozeti ---");
  console.log(`INFERRED_BASELINE_TOTAL=${BASELINE_INFERRED_IDENTITIES.length}`);
  console.log(`INFERRED_MISSING=${missing.length}`);
  console.log(`INFERRED_UNEXPECTED=${unexpected.length}`);
  console.log(
    `UNCONFIRMED_PUBLISH_FAMILY_TOTAL=${BASELINE_UNCONFIRMED_PUBLISH_CANDIDATES.length}`,
  );
  console.log(`UNCONFIRMED_PUBLISH_PROTECTED=${familyProtected}`);
  console.log(`UNCONFIRMED_PUBLISH_LEAKED=${familyLeaked.length}`);
  console.log(`USER_EXPLICIT_DROPPED=${userExplicitDropped}`);
  console.log(`VERIFIED_DROPPED=${verifiedDropped}`);

  return problems;
}

function main(): void {
  const problems: string[] = [];
  console.log("=== YAYIN CIKARIM OTORITESI V1 (D3c-a) ===");
  console.log(`senaryo tabani: ${CATEGORY_COVERAGE_V1.length} senaryo`);
  console.log(`adlandirilmis kanaryalar: ${TARGET_IDS.join(", ")}\n`);

  /* ---- (0) YETKİ MERDİVENİ KODDAN OKUNUR — İKİNCİ MERDİVEN YOK ---- */
  const ladder: Array<[Authority, boolean]> = [
    ["USER_EXPLICIT", true],
    ["VERIFIED", true],
    ["INFERRED", false],
    ["UNKNOWN", false],
  ];
  console.log("--- kapatma yetkisi (mayCloseQuestion, uretimden okundu) ---");
  for (const [authority, expected] of ladder) {
    const got = mayCloseQuestion(authority);
    console.log(`  ${authority.padEnd(13)} → ${got}`);
    if (got !== expected) {
      problems.push(
        `kanonik sözleşme değişti: mayCloseQuestion(${authority})=${got} — ` +
          `bu doğrulayıcının süzme sınırı yeniden gözden geçirilmeli`,
      );
    }
  }

  /* ---- (1) GENEL ÖLÇÜM — iki koşu, birebir ---- */
  const a = measureAll();
  const b = measureAll();
  const deterministic = JSON.stringify(a) === JSON.stringify(b);

  const inferredRows = a.rows.filter((r) => r.authority === "INFERRED");
  const leaked = inferredRows.filter((r) => r.reachedPayload);
  const closers = a.rows.filter((r) => r.authority !== "INFERRED");
  const suggestions = inferredRows.filter((r) => r.suggestionVisible);

  console.log("\n--- genel olcum ---");
  console.log(`  INFERRED kimlik                 : ${inferredRows.length}`);
  console.log(`  kanala sizan INFERRED           : ${leaked.length}`);
  console.log(`  oneri olarak gorunen            : ${suggestions.length}`);
  console.log(`  kapatmaya yetkili kanarya       : ${closers.length}`);
  console.log(`  onay yolu olculen kimlik        : ${a.confirmPathMeasured.length}`);
  console.log(`  iki olcum birebir               : ${deterministic ? "EVET" : "HAYIR"}`);

  console.log("\n--- kanala sizan INFERRED kimlikler ---");
  for (const r of leaked) console.log(`  ${r.id} deger='${r.value}'`);

  console.log("\n--- adlandirilmis kanaryalar ---");
  for (const id of TARGET_IDS) {
    const row = a.rows.find((r) => r.id === id);
    if (!row) {
      problems.push(`${id}: kanarya kimliği ölçümde bulunamadı — fixture değişmiş olabilir`);
      continue;
    }
    console.log(
      `  ${id} otorite=${row.authority} kanalda=${row.reachedPayload ? "EVET" : "HAYIR"} ` +
        `oneri=${row.suggestionVisible ? "EVET" : "HAYIR"}`,
    );
    if (row.authority !== "INFERRED") {
      problems.push(`${id}: kanarya otoritesi INFERRED değil → ${row.authority}`);
    }
  }

  problems.push(...a.violations);
  if (!deterministic) {
    problems.push("olcum deterministik degil: iki ardisik kosu farkli sonuc verdi");
  }

  /* ---- (1.5) DONDURULMUŞ TABAN + MAKİNE ÖZETİ ---- */
  problems.push(...checkFrozenBaseline(a));

  /* ---- (2) WIRING ---- */
  problems.push(...checkPublishWiring());

  console.log("\n===== HUKUM =====");
  if (problems.length > 0) {
    console.log(`KIRMIZI — ${problems.length} ihlal:`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    "YESIL — kullanıcının dokunmadığı hiçbir çıkarım kullanıcı cevabı kanalına\n" +
      "yazılmadı; tahminler kanonik durumda ve öneri sözleşmesinde korundu; açık\n" +
      "onay USER_EXPLICIT olarak yayına ulaştı; kapatmaya yetkili hiçbir değer\n" +
      "düşürülmedi; iç kanıt alanları soru olmadı; rawInput değişmedi.",
  );
}

main();
