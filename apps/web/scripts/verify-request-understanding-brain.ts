/**
 * B1–B3 — Canonical Request Understanding Brain acceptance corpus.
 * Run: npx tsx scripts/verify-request-understanding-brain.ts
 */
import { understandRequest } from "../src/lib/request-understanding/understand-request";
import type { RequestUnderstandingResult } from "../src/lib/request-understanding/types";

type Fixture = {
  id: number;
  text: string;
  check: (r: RequestUnderstandingResult) => string[];
};

function qtyValue(r: RequestUnderstandingResult): number | undefined {
  return r.quantity?.value?.value;
}

function hasRole(r: RequestUnderstandingResult, role: string, rawHint?: string) {
  return (r.diagnostics?.numberRoles ?? []).some(
    (n) =>
      n.role === role &&
      (rawHint
        ? String(n.raw).toLocaleLowerCase("tr-TR").includes(rawHint.toLocaleLowerCase("tr-TR"))
        : true),
  );
}

function modelPreserved(r: RequestUnderstandingResult, token: string) {
  const t = token.toLocaleLowerCase("tr-TR");
  const model = r.identity.model?.value?.toLocaleLowerCase("tr-TR") ?? "";
  const ids = (r.identity.identifiers ?? []).map((i) =>
    String(i.value).toLocaleLowerCase("tr-TR"),
  );
  const roles = (r.diagnostics?.numberRoles ?? [])
    .filter((n) => n.role === "MODEL_IDENTIFIER")
    .map((n) => String(n.raw).toLocaleLowerCase("tr-TR"));
  return (
    model.includes(t) ||
    ids.some((i) => i.includes(t)) ||
    roles.some((i) => i.includes(t))
  );
}

function isConfidentWrongCategory(
  r: RequestUnderstandingResult,
  wrong: string[],
): boolean {
  return (
    r.category.status === "CONFIDENT" &&
    r.category.value != null &&
    wrong.includes(r.category.value)
  );
}

function isConfidentWrongStrategy(
  r: RequestUnderstandingResult,
  wrong: string[],
): boolean {
  return (
    r.strategy.status === "CONFIDENT" &&
    r.strategy.value != null &&
    wrong.includes(r.strategy.value)
  );
}

const fixtures: Fixture[] = [
  {
    id: 1,
    text: "2013 model c180 düşük km araç arıyorum",
    check: (r) => {
      const errors: string[] = [];
      if (r.attributes.modelYear?.value !== 2013) errors.push("year!=2013");
      if (!modelPreserved(r, "c180")) errors.push("model C180 lost");
      if (r.preferences.mileagePreference?.value !== "LOW") {
        errors.push("mileage preference missing");
      }
      if (r.intent.value !== "BUY") errors.push(`intent=${r.intent.value}`);
      if (r.subject.kind.value !== "VEHICLE") {
        errors.push(`subject=${r.subject.kind.value}`);
      }
      if (r.category.value !== "automotive" || r.category.status === "UNKNOWN") {
        errors.push(`category=${r.category.value}/${r.category.status}`);
      }
      if (r.strategy.value !== "VEHICLE") errors.push(`strategy=${r.strategy.value}`);
      if (qtyValue(r) === 180 || qtyValue(r) === 2013) {
        errors.push(`quantity hallucinated=${qtyValue(r)}`);
      }
      if (r.budget) errors.push("budget should be unknown");
      if (r.attributes.maxMileage) errors.push("maxMileage hallucinated");
      return errors;
    },
  },
  {
    id: 2,
    text: "c180 lazım",
    check: (r) => {
      const errors: string[] = [];
      if (!modelPreserved(r, "c180")) errors.push("model lost");
      if (r.intent.value !== "BUY" && r.intent.value !== "UNKNOWN") {
        errors.push(`intent=${r.intent.value}`);
      }
      if (isConfidentWrongCategory(r, ["services", "printing", "real-estate"])) {
        errors.push(`confident wrong cat=${r.category.value}`);
      }
      if (
        r.identity.brand &&
        r.identity.brand.provenance === "EXPLICIT" &&
        !r.rawInput.toLocaleLowerCase("tr-TR").includes(
          String(r.identity.brand.value).toLocaleLowerCase("tr-TR"),
        )
      ) {
        errors.push("fabricated brand marked explicit");
      }
      return errors;
    },
  },
  {
    id: 3,
    text: "merso c180 bakıyorum",
    check: (r) => {
      const errors: string[] = [];
      if (!modelPreserved(r, "c180")) errors.push("model lost");
      return errors;
    },
  },
  {
    id: 4,
    text: "c180 parçası lazım",
    check: (r) => {
      const errors: string[] = [];
      if (r.intent.value !== "PART") errors.push(`intent=${r.intent.value}`);
      if (r.strategy.value !== "AUTO_PART") {
        errors.push(`strategy=${r.strategy.value}`);
      }
      if (r.strategy.value === "VEHICLE") errors.push("whole vehicle purchase");
      return errors;
    },
  },
  {
    id: 5,
    text: "c180 bakım yaptıracam",
    check: (r) => {
      const errors: string[] = [];
      if (r.intent.value !== "SERVICE") errors.push(`intent=${r.intent.value}`);
      if (r.strategy.value === "VEHICLE") errors.push("VEHICLE purchase");
      if (
        r.strategy.value !== "SERVICE_SCOPE" &&
        r.strategy.value !== "INDUSTRIAL_PARTS_SERVICE"
      ) {
        errors.push(`strategy=${r.strategy.value}`);
      }
      return errors;
    },
  },
  {
    id: 6,
    text: "dyson lazım",
    check: (r) => {
      const errors: string[] = [];
      if (r.category.value === "services" && r.category.status === "CONFIDENT") {
        errors.push("confident services");
      }
      if (isConfidentWrongStrategy(r, ["SERVICE_SCOPE"])) {
        errors.push("confident SERVICE strategy");
      }
      return errors;
    },
  },
  {
    id: 7,
    text: "v15 bakıyom",
    check: (r) => {
      const errors: string[] = [];
      if (!modelPreserved(r, "v15") && !hasRole(r, "MODEL_IDENTIFIER", "v15")) {
        errors.push("V15 not model identifier");
      }
      if (qtyValue(r) === 15) errors.push("quantity=15");
      if (r.category.value === "services" && r.category.status === "CONFIDENT") {
        errors.push("confident services");
      }
      return errors;
    },
  },
  {
    id: 8,
    text: "dyson v15 sıfır",
    check: (r) => {
      const errors: string[] = [];
      if (r.condition?.value !== "NEW") errors.push(`condition=${r.condition?.value}`);
      if (!modelPreserved(r, "v15")) errors.push("V15 lost");
      if (qtyValue(r) != null) errors.push(`quantity=${qtyValue(r)}`);
      if (isConfidentWrongStrategy(r, ["SERVICE_SCOPE"])) {
        errors.push("confident SERVICE");
      }
      return errors;
    },
  },
  {
    id: 9,
    text: "iphone 15 pro max 256gb",
    check: (r) => {
      const errors: string[] = [];
      if (qtyValue(r) === 15) errors.push("15 as quantity");
      const storage = r.attributes.storage?.value as
        | { value?: number; unit?: string }
        | undefined;
      if (storage?.value !== 256) errors.push(`storage=${JSON.stringify(storage)}`);
      if (!modelPreserved(r, "15") && !r.identity.model?.value) {
        errors.push("identity regression");
      }
      return errors;
    },
  },
  {
    id: 10,
    text: "sony wh-1000xm5 arıyorum",
    check: (r) => {
      const errors: string[] = [];
      if (
        !modelPreserved(r, "wh-1000xm5") &&
        !modelPreserved(r, "1000xm5") &&
        !hasRole(r, "MODEL_IDENTIFIER", "wh")
      ) {
        errors.push("model token lost");
      }
      if (qtyValue(r) === 1000) errors.push("1000 as quantity");
      return errors;
    },
  },
  {
    id: 11,
    text: "başakşehir 2+1 ev lazım",
    check: (r) => {
      const errors: string[] = [];
      const rooms = String(r.attributes.roomCount?.value ?? "");
      if (!rooms.includes("2+1")) errors.push(`rooms=${rooms}`);
      if (qtyValue(r) === 2) errors.push("quantity=2");
      if (r.category.value !== "real-estate" && r.category.status === "CONFIDENT") {
        // allow tentative real-estate
      }
      if (r.category.value && r.category.value !== "real-estate" && r.category.status === "CONFIDENT") {
        errors.push(`confident cat=${r.category.value}`);
      }
      if (r.intent.value === "RENT") errors.push("rent without kiralık");
      return errors;
    },
  },
  {
    id: 12,
    text: "başakşehir 2+1 kiralık ev",
    check: (r) => {
      const errors: string[] = [];
      if (r.intent.value !== "RENT") errors.push(`intent=${r.intent.value}`);
      if (r.strategy.value !== "REAL_ESTATE_RENT") {
        errors.push(`strategy=${r.strategy.value}`);
      }
      return errors;
    },
  },
  {
    id: 13,
    text: "kiracılı satılık dükkan arıyorum",
    /**
     * BEKLENTİ GÜNCELLENDİ — kurucu kapsam kararı (2026-08-25).
     *
     * Eski beklenti `intent === "SELL"` idi; bu, "satılık" ilan sıfatının
     * niyeti belirlediği eski modelden geliyordu. Bu cümleyi yazan kişi
     * dükkanı SATMIYOR, kiracılı bir dükkan ARIYOR — yani alıcıdır.
     * Talepo yalnız talep tarafını kabul ettiği için eski beklenti korunsaydı
     * bu talep artık "arz ilanı" sayılıp ENGELLENİRDİ. Testin asıl koruduğu
     * şey ("kiracı" sözcüğü bunu kiralama talebi yapmasın) aynen duruyor.
     */
    check: (r) => {
      const errors: string[] = [];
      if (r.intent.value !== "BUY") errors.push(`intent=${r.intent.value}`);
      if (r.intent.value === "RENT") errors.push("rent from kiracı");
      if (r.strategy.value === "REAL_ESTATE_RENT") {
        errors.push("RENT strategy");
      }
      if (r.requestScope.value !== "DEMAND") {
        errors.push(`scope=${r.requestScope.value}`);
      }
      if (r.preferences.tenantOccupied?.value !== true) {
        errors.push("tenantOccupied missing");
      }
      return errors;
    },
  },
  {
    id: 14,
    text: "5000 kutu bastırcam",
    check: (r) => {
      const errors: string[] = [];
      if (r.intent.value !== "MANUFACTURE") errors.push(`intent=${r.intent.value}`);
      if (qtyValue(r) !== 5000) errors.push(`qty=${qtyValue(r)}`);
      if (r.strategy.value !== "CUSTOM_MANUFACTURING") {
        errors.push(`strategy=${r.strategy.value}`);
      }
      return errors;
    },
  },
  {
    id: 15,
    text: "350gr kuşe 5bin kutu",
    check: (r) => {
      const errors: string[] = [];
      const w = r.attributes.weight?.value as
        | { value?: number; unit?: string }
        | undefined;
      if (w?.value !== 350) errors.push(`weight=${JSON.stringify(w)}`);
      if (qtyValue(r) !== 5000) errors.push(`qty=${qtyValue(r)}`);
      if (qtyValue(r) === 350) errors.push("350 as quantity");
      return errors;
    },
  },
  {
    id: 16,
    text: "200m2 ofis boyatacam",
    check: (r) => {
      const errors: string[] = [];
      if (r.intent.value !== "SERVICE") errors.push(`intent=${r.intent.value}`);
      const area = r.attributes.area?.value as
        | { value?: number; unit?: string }
        | undefined;
      if (area?.value !== 200) errors.push(`area=${JSON.stringify(area)}`);
      if (qtyValue(r) === 200) errors.push("200 as product qty");
      if (r.strategy.value !== "SERVICE_SCOPE") {
        errors.push(`strategy=${r.strategy.value}`);
      }
      return errors;
    },
  },
  {
    id: 17,
    text: "heidelberg 74 ikinci el lazım",
    check: (r) => {
      const errors: string[] = [];
      if (r.condition?.value !== "USED") errors.push(`condition=${r.condition?.value}`);
      if (qtyValue(r) === 74) errors.push("74 as quantity");
      if (
        r.category.status === "CONFIDENT" &&
        r.category.value &&
        !["machinery", "appliances"].includes(r.category.value)
      ) {
        // industrial equipment candidate if evidence supports — confident wrong fails
        if (["services", "printing", "real-estate"].includes(r.category.value)) {
          errors.push(`confident wrong cat=${r.category.value}`);
        }
      }
      return errors;
    },
  },
  {
    id: 18,
    text: "heidelberg sm74 ikinci el",
    check: (r) => {
      const errors: string[] = [];
      if (!modelPreserved(r, "sm74")) errors.push("SM74 lost");
      if (r.condition?.value !== "USED") errors.push(`condition=${r.condition?.value}`);
      if (qtyValue(r) != null) errors.push(`qty=${qtyValue(r)}`);
      return errors;
    },
  },
  {
    id: 19,
    text: "urban plus bebek arabası",
    check: (r) => {
      const errors: string[] = [];
      if (
        !r.subject.productType &&
        r.category.value !== "baby" &&
        !/bebek|arab/i.test(r.rawInput)
      ) {
        errors.push("no baby product evidence");
      }
      if (r.category.value === "services" && r.category.status === "CONFIDENT") {
        errors.push("confident service");
      }
      if (isConfidentWrongStrategy(r, ["SERVICE_SCOPE"])) {
        errors.push("SERVICE strategy");
      }
      return errors;
    },
  },
  {
    id: 20,
    text: "lattego kahve makinesi arıyorum",
    check: (r) => {
      const errors: string[] = [];
      if (
        r.category.value === "services" &&
        r.category.status === "CONFIDENT"
      ) {
        errors.push("confident service");
      }
      if (isConfidentWrongStrategy(r, ["SERVICE_SCOPE"])) {
        errors.push("SERVICE strategy");
      }
      return errors;
    },
  },
  {
    id: 21,
    text: "servis istemiyorum cihazın kendisini arıyorum",
    check: (r) => {
      const errors: string[] = [];
      if (r.intent.value === "SERVICE") errors.push("SERVICE won from negation");
      return errors;
    },
  },
  {
    id: 22,
    text: "yedek parça değil komple makine lazım",
    check: (r) => {
      const errors: string[] = [];
      if (r.intent.value === "PART") errors.push("PART won from negation");
      return errors;
    },
  },
  {
    id: 23,
    text: "2013 model ama 2020 sonrası da olabilir",
    check: (r) => {
      const errors: string[] = [];
      const years = (r.diagnostics?.numberRoles ?? []).filter(
        (n) => n.role === "MODEL_YEAR",
      );
      if (years.length < 2 && r.ambiguities.length === 0) {
        // at least ambiguity or low confidence year collapse avoided
        if (r.attributes.modelYear?.value === 2013 && years.length === 1) {
          // collapsed silently if only one year classified — check ambiguity
        }
      }
      if (
        r.attributes.modelYear?.value != null &&
        r.ambiguities.length === 0 &&
        years.length >= 2
      ) {
        errors.push("conflicting years collapsed without ambiguity");
      }
      if (r.ambiguities.length === 0 && years.length < 2) {
        // Expect ambiguity from flexible year language even with one primary year
        if (!/sonrası|sonrasi/.test(r.normalizedInput) || r.ambiguities.length === 0) {
          // yearAmbiguities should fire on sonrası
          if (r.ambiguities.length === 0) {
            errors.push("expected year ambiguity");
          }
        }
      }
      return errors;
    },
  },
  {
    id: 24,
    text: "fiyat çok uçmasın temiz olsun",
    check: (r) => {
      const errors: string[] = [];
      if (r.budget) errors.push("fabricated numeric budget");
      if (r.condition?.value === "NEW") errors.push("fabricated NEW");
      if (!r.preferences.budgetPreference && !r.preferences.cleanlinessPreference) {
        errors.push("fuzzy prefs lost");
      }
      return errors;
    },
  },
  {
    id: 25,
    text: "bir tane v15 lazım",
    check: (r) => {
      const errors: string[] = [];
      if (qtyValue(r) !== 1) errors.push(`qty=${qtyValue(r)}`);
      if (!modelPreserved(r, "v15") && !hasRole(r, "MODEL_IDENTIFIER", "v15")) {
        errors.push("V15 lost");
      }
      return errors;
    },
  },
];

let pass = 0;
let fail = 0;
let intentOk = 0;
let intentTotal = 0;
let strategyOk = 0;
let strategyTotal = 0;
let confidentWrong = 0;
let hallucinatedAttr = 0;
let numberRoleErrors = 0;
let explicitFactLoss = 0;
let provenanceErrors = 0;

const expectedIntent: Record<number, string | string[]> = {
  1: "BUY",
  4: "PART",
  5: "SERVICE",
  12: "RENT",
  13: "SELL",
  14: "MANUFACTURE",
  16: "SERVICE",
  21: ["BUY", "UNKNOWN"],
  22: ["BUY", "UNKNOWN", "MANUFACTURE"],
};

const expectedStrategy: Record<number, string | string[]> = {
  1: "VEHICLE",
  4: "AUTO_PART",
  5: ["SERVICE_SCOPE", "INDUSTRIAL_PARTS_SERVICE"],
  12: "REAL_ESTATE_RENT",
  14: "CUSTOM_MANUFACTURING",
  16: "SERVICE_SCOPE",
};

for (const f of fixtures) {
  let r: RequestUnderstandingResult;
  try {
    r = understandRequest(f.text);
  } catch (e) {
    fail += 1;
    console.log(`FAIL #${f.id} — threw: ${e}`);
    continue;
  }

  const errors = f.check(r);

  // Global metrics
  if (
    r.category.status === "CONFIDENT" &&
    f.id === 6 &&
    r.category.value === "services"
  ) {
    confidentWrong += 1;
  }
  if (
    r.strategy.status === "CONFIDENT" &&
    [6, 7, 8].includes(f.id) &&
    r.strategy.value === "SERVICE_SCOPE"
  ) {
    confidentWrong += 1;
  }

  // Hallucination heuristics
  if (r.attributes.maxMileage) hallucinatedAttr += 1;
  if (f.id === 24 && r.budget) hallucinatedAttr += 1;
  if (f.id === 1 && (qtyValue(r) === 180 || qtyValue(r) === 2013)) {
    numberRoleErrors += 1;
  }
  if (f.id === 7 && qtyValue(r) === 15) numberRoleErrors += 1;
  if (f.id === 10 && qtyValue(r) === 1000) numberRoleErrors += 1;
  if (f.id === 17 && qtyValue(r) === 74) numberRoleErrors += 1;
  if (f.id === 15 && qtyValue(r) === 350) numberRoleErrors += 1;

  if (f.id === 1 && !r.attributes.modelYear) explicitFactLoss += 1;
  if (f.id === 1 && r.preferences.mileagePreference?.provenance !== "EXPLICIT") {
    // missing or wrong provenance
    if (!r.preferences.mileagePreference) explicitFactLoss += 1;
  }
  if (
    r.identity.brand &&
    r.identity.brand.provenance === "EXPLICIT" &&
    !f.text.toLocaleLowerCase("tr-TR").includes(
      String(r.identity.brand.value).split(/\s+/)[0]!.toLocaleLowerCase("tr-TR"),
    ) &&
    f.id === 2
  ) {
    provenanceErrors += 1;
  }

  const expI = expectedIntent[f.id];
  if (expI) {
    intentTotal += 1;
    const ok = Array.isArray(expI)
      ? expI.includes(r.intent.value ?? "")
      : r.intent.value === expI;
    if (ok) intentOk += 1;
  }
  const expS = expectedStrategy[f.id];
  if (expS) {
    strategyTotal += 1;
    const ok = Array.isArray(expS)
      ? expS.includes(r.strategy.value ?? "")
      : r.strategy.value === expS;
    if (ok) strategyOk += 1;
  }

  if (errors.length === 0) {
    pass += 1;
    console.log(`PASS #${f.id} — ${f.text}`);
  } else {
    fail += 1;
    console.log(
      `FAIL #${f.id} — ${f.text}\n  ${errors.join("; ")}\n  intent=${r.intent.value} cat=${r.category.value}/${r.category.status} strat=${r.strategy.value}/${r.strategy.status} qty=${qtyValue(r)}`,
    );
  }
}

const total = fixtures.length;
console.log("\n========== REQUEST UNDERSTANDING BRAIN ==========");
console.log(`TOTAL FIXTURES: ${total}`);
console.log(`PASS: ${pass}`);
console.log(`FAIL: ${fail}`);
console.log(
  `INTENT ACCURACY: ${intentTotal ? ((intentOk / intentTotal) * 100).toFixed(1) : "n/a"}% (${intentOk}/${intentTotal})`,
);
console.log(
  `STRATEGY ACCURACY: ${strategyTotal ? ((strategyOk / strategyTotal) * 100).toFixed(1) : "n/a"}% (${strategyOk}/${strategyTotal})`,
);
console.log(`CATEGORY CONFIDENT-WRONG COUNT: ${confidentWrong}`);
console.log(`HALLUCINATED ATTRIBUTE COUNT: ${hallucinatedAttr}`);
console.log(`NUMBER ROLE ERROR COUNT: ${numberRoleErrors}`);
console.log(`EXPLICIT FACT LOSS COUNT: ${explicitFactLoss}`);
console.log(`PROVENANCE ERROR COUNT: ${provenanceErrors}`);

const nonNegotiable =
  confidentWrong === 0 && hallucinatedAttr === 0 && fail === 0;

if (!nonNegotiable || fail > 0) {
  console.log("\nVERIFY REQUEST UNDERSTANDING BRAIN: FAIL");
  process.exit(1);
}
console.log("\nVERIFY REQUEST UNDERSTANDING BRAIN: PASS");
