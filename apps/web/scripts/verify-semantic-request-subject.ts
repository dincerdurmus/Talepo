/**
 * B3.7 — Semantic request subject verification.
 * Run: npx tsx scripts/verify-semantic-request-subject.ts
 */
import { understandRequest } from "../src/lib/request-understanding/understand-request";
import { buildUnderstandingSummary } from "../src/lib/request-understanding/activation-bridge";
import { rankNextBestQuestions } from "../src/lib/request-brain/question-priority";
import { toHumanQuestions } from "../src/lib/request-brain/human-question-layer";
import { getCategoryById } from "../src/lib/request-category-engine";
import { completenessFromUnderstanding } from "../src/lib/request-understanding/activation-bridge";
import type { RequestSubjectKind } from "../src/lib/request-understanding/types";
import type { PriceStrategyKey } from "../src/lib/price-intelligence/price-strategy-registry";

type Expect = {
  raw: string;
  subject?: RequestSubjectKind | RequestSubjectKind[];
  nameIncludes?: string;
  positionIncludes?: string;
  parentIncludes?: string;
  relationship?: string | string[];
  intent?: string | string[];
  strategy?: PriceStrategyKey | PriceStrategyKey[];
  category?: string | string[];
  headlineIncludes?: string;
  headlineExcludes?: string[];
  notSubject?: RequestSubjectKind[];
  wholeNotPart?: boolean;
};

const FIXTURES: Expect[] = [
  {
    raw: "Toyota Corolla arka tampon",
    subject: "PART",
    nameIncludes: "tampon",
    positionIncludes: "arka",
    parentIncludes: "Corolla",
    relationship: "PART_FOR_PRODUCT",
    intent: "PART",
    strategy: "AUTO_PART",
    category: "automotive",
    headlineIncludes: "için",
    headlineExcludes: ["Corolla Corolla", "Toyota Corolla Corolla"],
  },
  {
    raw: "Toyota Corolla ön tampon",
    subject: "PART",
    nameIncludes: "tampon",
    positionIncludes: "ön",
    strategy: "AUTO_PART",
    headlineIncludes: "ön tampon",
  },
  {
    raw: "Golf 7 sağ ayna",
    subject: "PART",
    nameIncludes: "ayna",
    positionIncludes: "sağ",
    headlineIncludes: "ayna",
  },
  {
    raw: "C180 ön far",
    subject: "PART",
    nameIncludes: "far",
    positionIncludes: "ön",
    parentIncludes: "C180",
    headlineIncludes: "ön far",
    headlineExcludes: ["Mercedes"],
  },
  {
    raw: "BMW F30 sol ön far",
    subject: "PART",
    nameIncludes: "far",
    positionIncludes: "sol",
    headlineIncludes: "far",
  },
  {
    raw: "Corolla fren balatası",
    subject: "PART",
    nameIncludes: "balata",
    strategy: "AUTO_PART",
  },
  {
    raw: "Renault Clio motor kapağı",
    subject: "PART",
    nameIncludes: "kapak",
    parentIncludes: "Clio",
  },
  {
    raw: "Toyota Corolla arıyorum",
    subject: "VEHICLE",
    notSubject: ["PART"],
    wholeNotPart: true,
    strategy: ["VEHICLE", "RETAIL_PRODUCT"],
    headlineExcludes: ["için", "tampon"],
  },
  {
    raw: "Toyota Corolla tampon istemiyorum araç arıyorum",
    subject: "VEHICLE",
    notSubject: ["PART"],
    wholeNotPart: true,
  },
  {
    raw: "Dyson V15 filtresi",
    subject: "PART",
    nameIncludes: "filtre",
    parentIncludes: "V15",
    headlineIncludes: "filtre",
  },
  {
    raw: "Dyson V15 başlık",
    subject: ["ACCESSORY", "PART"],
    nameIncludes: "başlık",
  },
  {
    raw: "Bosch çamaşır makinesi pompası",
    subject: "PART",
    nameIncludes: "pompa",
  },
  {
    raw: "iPhone 15 Pro Max kılıf",
    subject: "ACCESSORY",
    nameIncludes: "kılıf",
  },
  {
    raw: "iPhone 15 Pro Max arıyorum",
    subject: "PRODUCT",
    notSubject: ["ACCESSORY", "PART"],
  },
  {
    raw: "Heidelberg SM74 merdanesi",
    subject: "PART",
    nameIncludes: "merdane",
    parentIncludes: "SM74",
  },
  {
    raw: "Makita DHP486 batarya",
    subject: "PART",
    nameIncludes: "batarya",
  },
  {
    raw: "DeWalt DCD996 mandren",
    subject: "PART",
    nameIncludes: "mandren",
  },
  {
    raw: "Heidelberg SM74 ikinci el makine",
    subject: ["INDUSTRIAL_EQUIPMENT", "PRODUCT"],
    notSubject: ["PART"],
  },
  {
    raw: "200m2 ofis boyatacam",
    subject: "SERVICE",
    nameIncludes: "boya",
    strategy: "SERVICE_SCOPE",
    headlineIncludes: "ofis",
  },
  {
    raw: "Corolla bakım yaptıracam",
    subject: "SERVICE",
    nameIncludes: "bakım",
  },
  {
    raw: "klima montaj yaptıracam",
    subject: "SERVICE",
    nameIncludes: "montaj",
  },
  {
    raw: "5000 tane logolu kutu bastırcam",
    subject: "MANUFACTURED_ITEM",
    nameIncludes: "kutu",
    intent: "MANUFACTURE",
  },
  {
    raw: "1000 bez çanta bastıracağım",
    subject: "MANUFACTURED_ITEM",
    nameIncludes: "çanta",
  },
  {
    raw: "350gr kuşe 5bin kutu",
    subject: ["MANUFACTURED_ITEM", "PRODUCT"],
  },
  {
    raw: "Başakşehir 2+1 kiralık ev",
    subject: "REAL_ESTATE",
    headlineIncludes: "2+1",
    headlineExcludes: ["Başakşehir Başakşehir"],
  },
  {
    raw: "kiracılı satılık dükkan arıyorum",
    subject: "REAL_ESTATE",
    intent: ["SELL", "BUY"],
  },
  {
    raw: "Ankara satılık 3+1 daire",
    subject: "REAL_ESTATE",
    headlineIncludes: "3+1",
  },
];

function matches(actual: string | null | undefined, expected: string | string[] | undefined) {
  if (expected == null) return true;
  if (actual == null) return false;
  const list = Array.isArray(expected) ? expected : [expected];
  return list.includes(actual);
}

function includesCI(hay: string | null | undefined, needle: string) {
  if (!hay) return false;
  return hay.toLocaleLowerCase("tr-TR").includes(needle.toLocaleLowerCase("tr-TR"));
}

function hasDuplication(headline: string): boolean {
  const tokens = headline.split(/\s+/).filter(Boolean);
  for (let i = 1; i < tokens.length; i++) {
    if (
      tokens[i].toLocaleLowerCase("tr-TR") ===
      tokens[i - 1].toLocaleLowerCase("tr-TR")
    ) {
      return true;
    }
  }
  // Known bad patterns
  if (/Corolla\s+Corolla/i.test(headline)) return true;
  if (/V15\s+V15/i.test(headline)) return true;
  if (/SM74\s+SM74/i.test(headline)) return true;
  if (/Series\s+6\s+Series\s+6/i.test(headline)) return true;
  return false;
}

const GENERIC_LEAK_KEYS = new Set([
  "solutionType",
  "productName",
  "specs",
  "technicalSpecs",
]);
const GENERIC_LEAK_LABEL = /çözüm\s*\/\s*ürün|ürün\s*adı|teknik\s*özellik/i;

let pass = 0;
let fail = 0;
let subjectOk = 0;
let subjectN = 0;
let relOk = 0;
let relN = 0;
let wholePartOk = 0;
let wholePartN = 0;
let duplication = 0;
let genericLeak = 0;
let fabricatedRel = 0;
let explicitSubjectLoss = 0;
let confidentWrong = 0;

for (const fx of FIXTURES) {
  const r = understandRequest(fx.raw);
  const summary = buildUnderstandingSummary(r);
  const rs = r.requestSubject;
  const errors: string[] = [];

  subjectN += 1;
  if (matches(rs.kind.value, fx.subject)) subjectOk += 1;
  else if (fx.subject) {
    errors.push(`subject got=${rs.kind.value} want=${fx.subject}`);
    if (rs.kind.status === "CONFIDENT") confidentWrong += 1;
  }

  if (fx.notSubject?.includes(rs.kind.value as RequestSubjectKind)) {
    errors.push(`subject must not be ${rs.kind.value}`);
    if (rs.kind.status === "CONFIDENT") confidentWrong += 1;
  }

  if (fx.wholeNotPart) {
    wholePartN += 1;
    if (rs.kind.value !== "PART" && rs.kind.value !== "ACCESSORY") wholePartOk += 1;
    else errors.push("whole-vs-part failed");
  }

  if (fx.nameIncludes) {
    const name = rs.name?.value ?? rs.displayPhrase?.value ?? "";
    if (!includesCI(name, fx.nameIncludes)) {
      errors.push(`name missing ${fx.nameIncludes} (got ${name})`);
      explicitSubjectLoss += 1;
    }
  }

  if (fx.positionIncludes) {
    if (!includesCI(rs.position?.value ?? rs.displayPhrase?.value, fx.positionIncludes)) {
      errors.push(`position missing ${fx.positionIncludes}`);
    }
  }

  if (fx.parentIncludes) {
    const parent = [
      rs.parentEntity?.brand?.value,
      rs.parentEntity?.model?.value,
      rs.parentEntity?.series?.value,
    ]
      .filter(Boolean)
      .join(" ");
    if (!includesCI(parent, fx.parentIncludes)) {
      errors.push(`parent missing ${fx.parentIncludes} (got ${parent})`);
    }
  }

  if (fx.relationship) {
    relN += 1;
    if (matches(rs.relationship?.value, fx.relationship)) relOk += 1;
    else errors.push(`relationship got=${rs.relationship?.value}`);
  }

  // Fabricated relationship: PART_FOR without part evidence
  if (
    rs.relationship?.value === "PART_FOR_PRODUCT" &&
    rs.kind.status === "CONFIDENT" &&
    !rs.name?.value
  ) {
    fabricatedRel += 1;
    errors.push("fabricated PART relationship without name");
  }

  if (fx.intent && !matches(r.intent.value, fx.intent)) {
    errors.push(`intent got=${r.intent.value}`);
  }
  if (fx.strategy && !matches(r.strategy.value, fx.strategy)) {
    errors.push(`strategy got=${r.strategy.value}`);
  }
  if (fx.category && !matches(r.category.value, fx.category)) {
    errors.push(`category got=${r.category.value}`);
  }

  if (fx.headlineIncludes && !includesCI(summary.headline, fx.headlineIncludes)) {
    errors.push(`headline missing ${fx.headlineIncludes}: ${summary.headline}`);
  }
  for (const bad of fx.headlineExcludes ?? []) {
    if (includesCI(summary.headline, bad)) {
      errors.push(`headline contains forbidden ${bad}`);
    }
  }

  if (hasDuplication(summary.headline)) {
    duplication += 1;
    errors.push(`duplication in headline: ${summary.headline}`);
  }

  // Question leak check for part/accessory fixtures
  if (rs.kind.value === "PART" || rs.kind.value === "ACCESSORY") {
    const catId = r.category.value ?? "automotive";
    const category = getCategoryById(catId);
    const completeness = completenessFromUnderstanding(r);
    const ranked = rankNextBestQuestions({
      strategy: (r.strategy.value ?? "UNKNOWN") as PriceStrategyKey,
      completeness,
      fieldValues: {
        needType: String(r.attributes.needType?.value ?? "part"),
        part: String(rs.displayPhrase?.value ?? rs.name?.value ?? ""),
        brand: String(r.identity.brand?.value ?? ""),
        model: String(r.identity.model?.value ?? ""),
      },
      commonDraft: { title: summary.headline, city: "", budget: "", quantity: "", delivery: "" },
      dynamicFields: category.fields,
      requiredDynamicKeys: category.fields.filter((f) => f.required).map((f) => f.key),
      maxQuestions: 5,
    });
    const human = toHumanQuestions(ranked, {
      strategy: r.strategy.value,
      requiredDynamicKeys: category.fields.filter((f) => f.required).map((f) => f.key),
      dynamicFields: category.fields,
      maxVisible: 3,
    });
    for (const q of human) {
      if (GENERIC_LEAK_KEYS.has(q.fieldKey) || GENERIC_LEAK_LABEL.test(q.label)) {
        genericLeak += 1;
        errors.push(`generic question leak: ${q.fieldKey}/${q.label}`);
      }
    }
  }

  if (errors.length) {
    fail += 1;
    console.log(`FAIL — ${fx.raw}`);
    for (const e of errors) console.log(`  ${e}`);
  } else {
    pass += 1;
    console.log(`PASS — ${fx.raw}`);
  }
}

const subjectAcc = subjectN ? (100 * subjectOk) / subjectN : 0;
const relAcc = relN ? (100 * relOk) / relN : 0;
const wholeAcc = wholePartN ? (100 * wholePartOk) / wholePartN : 0;

console.log("\n========== SEMANTIC REQUEST SUBJECT ==========");
console.log(`TOTAL FIXTURES: ${FIXTURES.length}`);
console.log(`PASS: ${pass}`);
console.log(`FAIL: ${fail}`);
console.log(`SUBJECT ACCURACY: ${subjectAcc.toFixed(1)}% (${subjectOk}/${subjectN})`);
console.log(`RELATIONSHIP ACCURACY: ${relAcc.toFixed(1)}% (${relOk}/${relN})`);
console.log(`WHOLE-VS-PART ACCURACY: ${wholeAcc.toFixed(1)}% (${wholePartOk}/${wholePartN})`);
console.log(`SEMANTIC ENTITY DUPLICATION COUNT: ${duplication}`);
console.log(`GENERIC BACKEND QUESTION LEAK COUNT: ${genericLeak}`);
console.log(`FABRICATED RELATIONSHIP COUNT: ${fabricatedRel}`);
console.log(`EXPLICIT SUBJECT LOSS COUNT: ${explicitSubjectLoss}`);
console.log(`CONFIDENT WRONG SUBJECT COUNT: ${confidentWrong}`);

const ok =
  fail === 0 &&
  duplication === 0 &&
  genericLeak === 0 &&
  fabricatedRel === 0 &&
  confidentWrong === 0;

console.log(`\nVERIFY SEMANTIC REQUEST SUBJECT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
