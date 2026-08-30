/**
 * TAM KATALOG ROUTING MATRİSİ — TEK KALICI DOĞRULAYICI (2026-08-30).
 *
 * Dinçer'in kuralı: yeni ürünleri kullanıcı elle denemek zorunda kalmamalı.
 * Bu kapı, kanonik envanterin TAMAMINDAN otomatik vaka üretir ve şu zinciri
 * gerçek üretim fonksiyonlarıyla ölçer:
 *
 *   kullanıcı metni → understandRequest → kategori → talep türü →
 *   profil → soru zamanlayıcı → cevap seçenekleri
 *
 * İLKELER
 *   - Vakalar kanonik kayıtlardan ÜRETİLİR; elle yazılmış ikinci katalog
 *     yoktur. Yeni kategori/düğüm/alias eklendiğinde matrise otomatik girer.
 *   - Rastgelelik yoktur; iki koşu bayt-birebir aynıdır.
 *   - DB, tarayıcı, LLM, ağ yoktur.
 *   - Kategoriler-arası alias çakışmaları tipli politikadan
 *     (`routing-ambiguity-policy`) okunur; politikasız çakışma KIRMIZIDIR.
 *   - Parça–ana ürün sözleşmesi yapısaldır: "araba lastiği" gibi ana varlık +
 *     iyelikli parça tamlamalarında istenen şey BAŞ İSİMDİR; kelime listesi
 *     yaması kabul edilmez, beklenti kanonik taksonomiden türetilir.
 *
 * ÇIKTI SÖZLEŞMESİ (satır adları sabittir):
 *   CATEGORIES / LEAF ROUTES / PROFILES / ALIASES / GENERATED CASES /
 *   ALLOWED AMBIGUITIES / ROUTING FAILURES / STALE STATE FAILURES /
 *   QUESTION FAILURES / OPTION LEAKS / PROBLEMS
 * Herhangi bir problem exit kodunu sıfırdan farklı yapar.
 */
import { writeFileSync } from "node:fs";
import {
  ensureTaxonomyLoaded,
  getTaxonomyAncestorIds,
  listAllTaxonomyNodes,
} from "../src/lib/taxonomy";
import type { TaxonomyNode } from "../src/lib/taxonomy";
import {
  AMBIGUITY_RULES,
  allowedClarificationCategories,
  foldAmbiguityPhrase,
} from "../src/lib/taxonomy/routing-ambiguity-policy";
import { REQUEST_CATEGORIES } from "../src/lib/request-category-engine";
import { understandRequest } from "../src/lib/request-understanding/understand-request";
import { resolveSchemaCategory } from "../src/lib/request-understanding/activation-bridge";
import { syncFromText } from "../src/lib/request-composer";
import { buildCategoryGuidance } from "../src/lib/request-composer/v2/category-guidance";
import type { RequestUnderstandingResult } from "../src/lib/request-understanding/types";
import {
  listAllProfiles,
  resolveProfileForField,
} from "../src/lib/request-composer/v2/question-profiles";
import {
  scheduleComposerQuestions,
  scheduledToFocusedQuestion,
} from "../src/lib/request-composer/v2/focused-questions";
import { resolveQuestionControl } from "../src/lib/request-composer/v2/question-control-registry";

/* ────────────────────────── yardımcılar ────────────────────────── */

const fold = foldAmbiguityPhrase;

type Failure = {
  sinif:
    | "ROUTING"
    | "STALE_STATE"
    | "QUESTION"
    | "OPTION_LEAK"
    | "POLICY";
  /** Tekilleştirme anahtarı: kategori/alan düzeyinde. */
  kume: string;
  ornek: string;
  detay: string;
};
const failures: Failure[] = [];
const fail = (f: Failure) => failures.push(f);
/**
 * Analiz dökümü (isteğe bağlı): TALEPO_ROUTING_DUMP=path verilirse başarısız
 * vakalar JSON olarak da yazılır. Konsol çıktısı DEĞİŞMEZ; determinizm
 * sözleşmesi bozulmaz.
 */
const DUMP_PATH = process.env.TALEPO_ROUTING_DUMP ?? null;

/* ────────────────────── 1) KANONİK ENVANTER ────────────────────── */

ensureTaxonomyLoaded();
const nodes = listAllTaxonomyNodes()
  .slice()
  .sort((a, b) => a.id.localeCompare(b.id, "en"));

const leafTypes = new Set([
  "PRODUCT_TYPE",
  "PART_TYPE",
  "SERVICE_TYPE",
  "COMMODITY_TYPE",
  "TECHNICAL_TYPE",
]);
const leaves = nodes.filter((n) => leafTypes.has(n.nodeType));
const profiles = listAllProfiles();
const aliasCount = nodes.reduce(
  (s, n) => s + (n.aliases?.length ?? 0) + (n.searchTerms?.length ?? 0),
  0,
);

/** Bir ifadenin taksonomide dokunduğu kategoriler (politika denetimi için). */
const categoriesByPhrase = new Map<string, Set<string>>();
for (const n of nodes) {
  if (
    !leafTypes.has(n.nodeType) &&
    n.nodeType !== "GROUP" &&
    n.nodeType !== "SUBCATEGORY"
  )
    continue;
  for (const p of [n.canonicalName, ...(n.aliases ?? []), ...(n.searchTerms ?? [])]) {
    const f = fold(String(p ?? ""));
    if (!f) continue;
    if (!categoriesByPhrase.has(f)) categoriesByPhrase.set(f, new Set());
    categoriesByPhrase.get(f)!.add(n.categoryId);
  }
}

/* ───────────── 2) POLİTİKA ↔ TAKSONOMİ ÇİFT YÖNLÜ DENETİM ───────────── */

const collisions = [...categoriesByPhrase.entries()]
  .filter(([, cats]) => cats.size > 1)
  .sort((a, b) => a[0].localeCompare(b[0], "en"));

const ruleByPhrase = new Map(AMBIGUITY_RULES.map((r) => [r.phrase, r]));
for (const [phrase, cats] of collisions) {
  const rule = ruleByPhrase.get(phrase);
  if (!rule) {
    fail({
      sinif: "POLICY",
      kume: "policy/eksik-kayit",
      ornek: phrase,
      detay: `çakışan kategoriler: ${[...cats].sort().join(",")} — ALLOWED_CLARIFICATION kararı yok`,
    });
    continue;
  }
  const allowed = new Set(rule.categoryIds);
  for (const c of cats) {
    if (!allowed.has(c)) {
      fail({
        sinif: "POLICY",
        kume: "policy/kategori-eksik",
        ornek: phrase,
        detay: `taksonomi ${c} kategorisine de gidiyor ama politika izin listesinde yok`,
      });
    }
  }
}
for (const rule of AMBIGUITY_RULES) {
  const cats = categoriesByPhrase.get(rule.phrase);
  if (!cats || cats.size < 2) {
    fail({
      sinif: "POLICY",
      kume: "policy/bayat-kayit",
      ornek: rule.phrase,
      detay: "politika kaydı var ama taksonomide artık çakışma yok",
    });
  }
}

/* ───────────────────── 3) VAKA ÜRETİMİ (tam katalog) ───────────────────── */

type Case = {
  text: string;
  node: TaxonomyNode;
  phrase: string;
  sablon: string;
};

const PURCHASE_TEMPLATES: ReadonlyArray<readonly [string, (p: string) => string]> = [
  ["ariyorum", (p) => `${p} arıyorum`],
  ["lazim", (p) => `${p} lazım`],
  ["almak", (p) => `${p} almak istiyorum`],
];
/** Hizmet yaprakları satın alınmaz; yaptırılır. */
const SERVICE_TEMPLATES: ReadonlyArray<readonly [string, (p: string) => string]> = [
  ["ariyorum", (p) => `${p} arıyorum`],
  ["lazim", (p) => `${p} lazım`],
  ["yaptirmak", (p) => `${p} yaptırmak istiyorum`],
];

const cases: Case[] = [];
for (const n of leaves) {
  const phrases = new Map<string, string>(); // fold → orijinal
  const isim = String(n.canonicalName ?? "").trim();
  if (isim) phrases.set(fold(isim), isim);
  for (const a of [...(n.aliases ?? []), ...(n.searchTerms ?? [])]) {
    const t = String(a ?? "").trim();
    if (t && !phrases.has(fold(t))) phrases.set(fold(t), t);
  }
  const templates =
    n.nodeType === "SERVICE_TYPE" ? SERVICE_TEMPLATES : PURCHASE_TEMPLATES;
  let ilk = true;
  for (const [, phrase] of [...phrases.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "en"),
  )) {
    /* Kanonik ad bütün şablonlarla, alias'lar tek şablonla — katalog iki
       kez büyüdüğünde koşum süresi patlamasın diye; kapsam yine tamdır
       (her alias en az bir vakada). */
    const kullan = ilk ? templates : templates.slice(0, 1);
    ilk = false;
    for (const [ad, sable] of kullan) {
      cases.push({ text: sable(phrase), node: n, phrase, sablon: ad });
    }
  }
}
cases.sort((a, b) =>
  a.node.id === b.node.id
    ? a.text.localeCompare(b.text, "en")
    : a.node.id.localeCompare(b.node.id, "en"),
);

/* ───────────── 4) PARÇA–ANA ÜRÜN YAPISAL REGRESYONLARI ───────────── */

/** Ana varlık + iyelikli parça: istenen şey BAŞ İSİMDİR. */
const PART_COMPOUND_REGRESSIONS: ReadonlyArray<{
  text: string;
  yasakNeedType: string;
  beklenenKategori: readonly string[];
}> = [
  { text: "araba lastiği arıyorum", yasakNeedType: "vehicle", beklenenKategori: ["automotive"] },
  { text: "otomobil lastiği lazım", yasakNeedType: "vehicle", beklenenKategori: ["automotive"] },
  { text: "kamyon lastiği arıyorum", yasakNeedType: "vehicle", beklenenKategori: ["automotive"] },
  { text: "motosiklet lastiği arıyorum", yasakNeedType: "vehicle", beklenenKategori: ["automotive"] },
  { text: "araç aküsü arıyorum", yasakNeedType: "vehicle", beklenenKategori: ["automotive"] },
  { text: "araba jantı arıyorum", yasakNeedType: "vehicle", beklenenKategori: ["automotive"] },
  { text: "otomobil farı lazım", yasakNeedType: "vehicle", beklenenKategori: ["automotive"] },
  { text: "telefon ekranı arıyorum", yasakNeedType: "vehicle", beklenenKategori: ["technology"] },
  { text: "bilgisayar klavyesi arıyorum", yasakNeedType: "vehicle", beklenenKategori: ["technology"] },
  { text: "buzdolabı rafı lazım", yasakNeedType: "vehicle", beklenenKategori: ["appliances"] },
];

/** Negatif koruma: bunlar OLDUĞU GİBİ kalmalı. */
const NEGATIVE_GUARDS: ReadonlyArray<{
  text: string;
  kategori: string;
  needType?: string | null;
  subjectKind?: string;
}> = [
  { text: "araba satın almak istiyorum", kategori: "automotive", needType: "vehicle", subjectKind: "VEHICLE" },
  { text: "ikinci el otomobil arıyorum", kategori: "automotive", needType: "vehicle", subjectKind: "VEHICLE" },
  { text: "kiralık daire arıyorum", kategori: "real-estate" },
  { text: "araba bakımı yaptırmak istiyorum", kategori: "automotive", subjectKind: "SERVICE" },
];

/* ─────────────────────── 5) MATRİS KOŞUMU ─────────────────────── */

const VEHICLE_PURCHASE_PREFIX = "tax:automotive:arac-satin-alma";

function isUnderVehiclePurchase(node: TaxonomyNode): boolean {
  return (
    node.id.startsWith(VEHICLE_PURCHASE_PREFIX) ||
    getTaxonomyAncestorIds(node.id).some((a) =>
      a.startsWith(VEHICLE_PURCHASE_PREFIX),
    )
  );
}

let routingOk = 0;
for (const c of cases) {
  const u = understandRequest(c.text) as {
    category?: { value?: string | null };
    attributes?: { needType?: { value?: unknown } };
    requestSubject?: { kind?: { value?: string } };
    diagnostics?: { categoryConfident?: boolean };
  };
  const gotCat = u.category?.value ?? null;
  const allowed = allowedClarificationCategories(c.phrase, c.node.categoryId);
  const needType = String(u.attributes?.needType?.value ?? "");
  const subjectKind = u.requestSubject?.kind?.value ?? "";

  /* R1 — kategori: kanonik kategoriye ya da izinli belirsizlik kümesine. */
  if (gotCat && !allowed.includes(gotCat)) {
    fail({
      sinif: "ROUTING",
      kume: `kategori/${c.node.categoryId}→${gotCat}`,
      ornek: c.text,
      detay: `düğüm ${c.node.id} beklenen=${c.node.categoryId} bulunan=${gotCat}`,
    });
    continue;
  }

  /* R2 — host/parça: araç-satın-alma alt ağacında OLMAYAN otomotiv yaprağı
     needType=vehicle üretmemeli (araç satın almaya zorlanamaz). */
  if (
    c.node.categoryId === "automotive" &&
    !isUnderVehiclePurchase(c.node) &&
    needType === "vehicle"
  ) {
    fail({
      sinif: "ROUTING",
      kume: `hostparca/${c.node.nodeType}`,
      ornek: c.text,
      detay: `düğüm ${c.node.id} araç-satın-alma dışı ama needType=vehicle (subject=${subjectKind})`,
    });
    continue;
  }

  /* R3 — parça yaprağı bütün-araç öznesine çökmemeli. */
  if (
    c.node.nodeType === "PART_TYPE" &&
    c.node.categoryId === "automotive" &&
    subjectKind === "VEHICLE"
  ) {
    fail({
      sinif: "ROUTING",
      kume: "hostparca/subject-vehicle",
      ornek: c.text,
      detay: `düğüm ${c.node.id} parça ama özne VEHICLE`,
    });
    continue;
  }

  /* R4 — netleştirme sızıntısı: kategori kararsızsa GERÇEK kılavuz kartı
     yalnız izinli kategori kümesini gösterebilir. Kararlılık, sayfanın
     kendi okuduğu yüzeyden gelir (resolveSchemaCategory) — dedektörün ham
     bayrağından değil; yanlış yüzeyden ölçmek claim'le kesinleşen vakaları
     kararsız gösteriyordu (ölçüldü). */
  const confident = resolveSchemaCategory(
    u as unknown as RequestUnderstandingResult,
  ).confident;
  if (!confident && gotCat) {
    const card = buildCategoryGuidance({
      understanding: u as unknown as RequestUnderstandingResult,
      rawText: c.text,
      categoryConfident: confident,
    });
    if (card) {
      const disari = card.candidates
        .map((o) => o.slug)
        .filter((cid) => cid && !allowed.includes(cid));
      if (disari.length > 0) {
        fail({
          sinif: "ROUTING",
          kume: `clarify/${c.node.categoryId}`,
          ornek: c.text,
          detay: `izinli={${allowed.join(",")}} kart dışarıyı gösteriyor: ${[...new Set(disari)].sort().join(",")}`,
        });
        continue;
      }
    }
  }

  routingOk++;
}

/* Parça–ana ürün regresyonları */
for (const r of PART_COMPOUND_REGRESSIONS) {
  const u = understandRequest(r.text) as {
    category?: { value?: string | null };
    attributes?: { needType?: { value?: unknown } };
    requestSubject?: { kind?: { value?: string }; name?: { value?: string } };
  };
  const cat = u.category?.value ?? null;
  const needType = String(u.attributes?.needType?.value ?? "");
  const kind = u.requestSubject?.kind?.value ?? "";
  if (cat && !r.beklenenKategori.includes(cat)) {
    fail({
      sinif: "ROUTING",
      kume: "parca-tamlama/kategori",
      ornek: r.text,
      detay: `beklenen=${r.beklenenKategori.join("|")} bulunan=${cat}`,
    });
  }
  if (needType === r.yasakNeedType || kind === "VEHICLE") {
    fail({
      sinif: "ROUTING",
      kume: "parca-tamlama/host-cokmesi",
      ornek: r.text,
      detay: `baş isim parça olmalı; needType=${needType || "-"} subject=${kind}`,
    });
  }
}
for (const g of NEGATIVE_GUARDS) {
  const u = understandRequest(g.text) as {
    category?: { value?: string | null };
    attributes?: { needType?: { value?: unknown } };
    requestSubject?: { kind?: { value?: string } };
  };
  const cat = u.category?.value ?? null;
  const needType = String(u.attributes?.needType?.value ?? "") || null;
  const kind = u.requestSubject?.kind?.value ?? "";
  if (cat !== g.kategori) {
    fail({
      sinif: "ROUTING",
      kume: "negatif-koruma/kategori",
      ornek: g.text,
      detay: `beklenen=${g.kategori} bulunan=${cat}`,
    });
  }
  if (g.needType !== undefined && needType !== g.needType) {
    fail({
      sinif: "ROUTING",
      kume: "negatif-koruma/needType",
      ornek: g.text,
      detay: `beklenen=${g.needType} bulunan=${needType}`,
    });
  }
  if (g.subjectKind && kind !== g.subjectKind) {
    fail({
      sinif: "ROUTING",
      kume: "negatif-koruma/subject",
      ornek: g.text,
      detay: `beklenen=${g.subjectKind} bulunan=${kind}`,
    });
  }
}

/* ────────────── 6) ESKİ SEÇİM / METİN DEĞİŞİMİ MATRİSİ ────────────── */

type StaleScenario = {
  ad: string;
  adimlar: readonly string[];
  beklenen: {
    kategori: string;
    needTypeYasak?: string;
    dusmesiGerekenAlanlar?: readonly string[];
  };
};
const STALE_SCENARIOS: readonly StaleScenario[] = [
  {
    ad: "bos→lastik",
    adimlar: ["araba lastiği arıyorum"],
    beklenen: { kategori: "automotive", needTypeYasak: "vehicle" },
  },
  {
    ad: "arac→lastik",
    adimlar: ["araba satın almak istiyorum", "araba lastiği arıyorum"],
    beklenen: { kategori: "automotive", needTypeYasak: "vehicle" },
  },
  {
    ad: "daire→lastik",
    adimlar: ["kiralık daire arıyorum", "araba lastiği arıyorum"],
    beklenen: {
      kategori: "automotive",
      needTypeYasak: "vehicle",
      dusmesiGerekenAlanlar: ["listingType", "roomCount"],
    },
  },
  {
    ad: "lastik→arac",
    adimlar: ["araba lastiği arıyorum", "araba satın almak istiyorum"],
    beklenen: { kategori: "automotive" },
  },
  {
    ad: "tv→buzdolabi",
    adimlar: [
      "55 inç televizyon arıyorum",
      "no-frost buzdolabı arıyorum",
    ],
    beklenen: {
      kategori: "appliances",
      dusmesiGerekenAlanlar: ["screenSize"],
    },
  },
];

for (const s of STALE_SCENARIOS) {
  let state: ReturnType<typeof syncFromText>["state"] | null = null;
  for (const metin of s.adimlar) {
    state = syncFromText(state, metin).state;
  }
  if (!state) continue;
  const kategori = state.categoryId ?? null;
  const needField = state.fields.needType;
  const needType =
    needField?.kind === "VALUE" ? String(needField.value ?? "") : null;
  if (kategori !== s.beklenen.kategori) {
    fail({
      sinif: "STALE_STATE",
      kume: `stale/kategori/${s.ad}`,
      ornek: s.adimlar.join(" → "),
      detay: `beklenen=${s.beklenen.kategori} bulunan=${kategori}`,
    });
  }
  if (s.beklenen.needTypeYasak && needType === s.beklenen.needTypeYasak) {
    fail({
      sinif: "STALE_STATE",
      kume: `stale/needType/${s.ad}`,
      ornek: s.adimlar.join(" → "),
      detay: `needType=${needType} düşmedi`,
    });
  }
  for (const alan of s.beklenen.dusmesiGerekenAlanlar ?? []) {
    const f = state.fields[alan];
    if (f && f.kind === "VALUE" && String(f.value ?? "").trim()) {
      fail({
        sinif: "STALE_STATE",
        kume: `stale/bayat-alan/${alan}`,
        ornek: s.adimlar.join(" → "),
        detay: `${alan}=${String(f.value)} yeni anlamda hâlâ duruyor`,
      });
    }
  }
}

/* ─────────────── 7) SORU VE SEÇENEK ZİNCİRİ DENETİMİ ─────────────── */

const commonKeysByCategory = new Map<string, Set<string>>(
  REQUEST_CATEGORIES.map((c) => [
    c.id,
    new Set(c.commonFields.map((f) => f.key)),
  ]),
);

let questionOk = 0;
const questionContexts: Array<{
  categoryId: string;
  productType: string | null;
}> = [];
/** Her kategori + whenProductTypes bağlamı — profillerin kendisinden türetilir. */
{
  const seen = new Set<string>();
  for (const p of profiles) {
    for (const cat of p.categories ?? []) {
      for (const pt of p.whenProductTypes ?? [null]) {
        const key = `${cat}::${pt ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        questionContexts.push({ categoryId: cat, productType: pt });
      }
    }
  }
  questionContexts.sort((a, b) =>
    `${a.categoryId}:${a.productType ?? ""}`.localeCompare(
      `${b.categoryId}:${b.productType ?? ""}`,
      "en",
    ),
  );
}

for (const ctx of questionContexts) {
  const schedule = scheduleComposerQuestions({
    categoryId: ctx.categoryId,
    candidates: [],
    values: ctx.productType ? { productType: ctx.productType } : {},
  });
  for (const q of schedule.visible) {
    const common = commonKeysByCategory.get(ctx.categoryId);
    const isCommon = Boolean(common?.has(q.fieldKey)) || q.fieldKey === "city" || q.fieldKey === "budget" || q.fieldKey === "delivery" || q.fieldKey === "quantity";
    const profile = resolveProfileForField({
      fieldKey: q.fieldKey,
      categoryId: ctx.categoryId,
      productType: ctx.productType,
    });
    if (!isCommon && !profile) {
      fail({
        sinif: "QUESTION",
        kume: `soru-sizintisi/${ctx.categoryId}/${q.fieldKey}`,
        ornek: `${ctx.categoryId} + ${ctx.productType ?? "-"}`,
        detay: `görünür soru ${q.fieldKey} bu bağlamın profillerinden gelmiyor`,
      });
      continue;
    }
    /* Seçenekler kanonik kontrol kaydıyla birebir mi? */
    const fq = scheduledToFocusedQuestion(q, undefined, {
      productType: ctx.productType,
      needType: null,
      isRemoteService: false,
      listingType: null,
    });
    const canonical = resolveQuestionControl({
      categoryId: ctx.categoryId,
      fieldKey: q.fieldKey,
      productType: ctx.productType,
      importance: q.importance,
      allowUnknown: q.allowUnknown,
      allowDontCare: q.allowDontCare,
      isRealEstate: ctx.categoryId === "real-estate",
      profileChoices: q.quickChoices,
    });
    const imza = (c: { options: { value: string; label: string }[]; softOptions: { value: string; label: string }[] }) =>
      JSON.stringify([
        c.options.map((o) => [o.value, o.label]),
        c.softOptions.map((o) => [o.value, o.label]),
      ]);
    if (imza(fq.control!) !== imza(canonical)) {
      fail({
        sinif: "OPTION_LEAK",
        kume: `secenek/${ctx.categoryId}/${q.fieldKey}`,
        ornek: `${ctx.categoryId} + ${ctx.productType ?? "-"}`,
        detay: "görünür seçenekler kanonik kayıttan sapıyor",
      });
      continue;
    }
    questionOk++;
  }
}

/* ─────────────────────────── RAPOR ─────────────────────────── */

const say = (sinif: Failure["sinif"]) =>
  failures.filter((f) => f.sinif === sinif).length;

console.log("CATEGORIES:", REQUEST_CATEGORIES.length);
console.log("LEAF ROUTES:", leaves.length);
console.log("PROFILES:", profiles.length);
console.log("ALIASES:", aliasCount);
console.log("GENERATED CASES:", cases.length);
console.log("ALLOWED AMBIGUITIES:", AMBIGUITY_RULES.length);
console.log("ROUTING FAILURES:", say("ROUTING"));
console.log("STALE STATE FAILURES:", say("STALE_STATE"));
console.log("QUESTION FAILURES:", say("QUESTION"));
console.log("OPTION LEAKS:", say("OPTION_LEAK"));
console.log("POLICY FAILURES:", say("POLICY"));
console.log("PROBLEMS:", failures.length);
console.log(
  "PASSED:",
  `routing=${routingOk}/${cases.length}`,
  `question=${questionOk}`,
);

/* Tekilleştirilmiş küme raporu — hata gizlenmez, kategori/alan bazında
   toplanır; her kümeden en fazla iki örnek gösterilir. */
if (failures.length > 0) {
  const gruplar = new Map<string, Failure[]>();
  for (const f of failures) {
    if (!gruplar.has(f.kume)) gruplar.set(f.kume, []);
    gruplar.get(f.kume)!.push(f);
  }
  console.log("\n──── TEKİLLEŞTİRİLMİŞ HATA KÜMELERİ ────");
  for (const [kume, list] of [...gruplar.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "en"),
  )) {
    console.log(`\n[${list[0]!.sinif}] ${kume} — ${list.length} vaka`);
    for (const f of list.slice(0, 2)) {
      console.log(`   · "${f.ornek}" — ${f.detay}`);
    }
  }
}

if (DUMP_PATH) {
  writeFileSync(DUMP_PATH, JSON.stringify(failures, null, 1));
}
console.log(failures.length === 0 ? "\nSONUC=GECTI" : "\nSONUC=KALDI");
process.exit(failures.length === 0 ? 0 : 1);
