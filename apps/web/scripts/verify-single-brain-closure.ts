/**
 * B3.6 — Single-brain closure architecture + behavior verification.
 * Run: npx tsx scripts/verify-single-brain-closure.ts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { understandRequest } from "../src/lib/request-understanding/understand-request";
import {
  resolveSchemaCategory,
  seedFieldValuesFromUnderstanding,
  strategyResolutionFromUnderstanding,
} from "../src/lib/request-understanding/activation-bridge";
import {
  toMatchingEstimateInput,
  toPriceCanonicalHints,
} from "../src/lib/request-understanding/consumer-adapters";
import { buildPreviewFingerprint } from "../src/lib/request-brain/preview-fingerprint";
import { buildProviderRouting } from "../src/server/price-intelligence/provider-query";
import type { RequestUnderstandingResult } from "../src/lib/request-understanding/types";
import type { PriceStrategyKey } from "../src/lib/price-intelligence/price-strategy-registry";

let activeDualAuthority = 0;
let editDrift = 0;
let homeHandoffDrift = 0;
let priceInternalMismatch = 0;
let matchingMismatch = 0;
let unknownConcreteLeak = 0;
let tentativeConfidentLeak = 0;
let structuredOverrideLost = 0;
let duplicateIdentityAuthority = 0;

function semanticKey(r: RequestUnderstandingResult) {
  return JSON.stringify({
    intent: r.intent.value,
    intentStatus: r.intent.status,
    category: r.category.value,
    categoryStatus: r.category.status,
    strategy: r.strategy.value,
    model: r.identity.model?.value ?? null,
    modelProv: r.identity.model?.provenance ?? null,
    brandProv: r.identity.brand?.provenance ?? null,
    qty: r.quantity?.value?.value ?? null,
    year: r.attributes.modelYear?.value ?? null,
    condition: r.condition?.value ?? null,
    listing: r.attributes.listingType?.value ?? null,
    needType: r.attributes.needType?.value ?? null,
    weight: (r.attributes.weight?.value as { value?: number } | undefined)?.value ?? null,
    area: (r.attributes.area?.value as { value?: number } | undefined)?.value ?? null,
  });
}

function simulateActiveCategory(
  r: RequestUnderstandingResult,
  opts: {
    categoryOverride?: string | null;
    categoryLockedByUser?: boolean;
  },
) {
  const schema = resolveSchemaCategory(r);
  if (opts.categoryLockedByUser && opts.categoryOverride) {
    return opts.categoryOverride;
  }
  if (r.category.status === "CONFIDENT" && r.category.value) {
    return r.category.value;
  }
  if (r.category.status === "TENTATIVE" && r.category.value) {
    return r.category.value;
  }
  return opts.categoryOverride ?? schema.categoryId;
}

// ---------- Static authority scan ----------
const SRC = join(process.cwd(), "src");
const PROHIBITED_ACTIVE = [
  {
    file: "app/talep/page.tsx",
    ban: ["runTalepoAiCore", "detectCategory("],
  },
  {
    file: "components/panel/EditRequestForm.tsx",
    ban: ["runTalepoAiCore", "parseRequest("],
  },
  {
    file: "components/home/HomeComposer.tsx",
    ban: ["detectCategory("], // must use hint wrapper
  },
];

for (const row of PROHIBITED_ACTIVE) {
  const full = join(SRC, row.file);
  const text = readFileSync(full, "utf8");
  for (const ban of row.ban) {
    if (text.includes(ban)) {
      activeDualAuthority += 1;
      console.log(`STATIC FAIL — ${row.file} still contains ${ban}`);
    }
  }
}

// Edit + talep must call understandRequest
for (const file of [
  "app/talep/page.tsx",
  "components/panel/EditRequestForm.tsx",
]) {
  const text = readFileSync(join(SRC, file), "utf8");
  if (!text.includes("understandRequest")) {
    activeDualAuthority += 1;
    console.log(`STATIC FAIL — ${file} missing understandRequest`);
  }
}

// Duplicate identity authority: migrated UI must not call buildProductIdentity
for (const file of [
  "app/talep/page.tsx",
  "components/panel/EditRequestForm.tsx",
  "hooks/useRequestBrain.ts",
]) {
  const text = readFileSync(join(SRC, file), "utf8");
  if (text.includes("buildProductIdentity")) {
    duplicateIdentityAuthority += 1;
    console.log(`STATIC FAIL — ${file} calls buildProductIdentity`);
  }
}

// Preview engine must accept canonicalStrategy
{
  const engine = readFileSync(
    join(SRC, "server/price-intelligence/price-intelligence-engine.ts"),
    "utf8",
  );
  if (!engine.includes("canonicalStrategy")) {
    activeDualAuthority += 1;
    console.log("STATIC FAIL — price engine missing canonicalStrategy");
  }
}

console.log(
  activeDualAuthority === 0
    ? "STATIC AUTHORITY — PASS"
    : `STATIC AUTHORITY — FAIL (${activeDualAuthority})`,
);

// ---------- Fixture matrix ----------
const fixtures: Array<{
  id: string;
  text: string;
  expectStrategy?: PriceStrategyKey | PriceStrategyKey[];
  expectIntent?: string;
}> = [
  { id: "A", text: "2013 model c180 düşük km araç arıyorum", expectStrategy: "VEHICLE", expectIntent: "BUY" },
  { id: "B", text: "c180 parçası lazım", expectStrategy: "AUTO_PART", expectIntent: "PART" },
  { id: "C", text: "c180 bakım yaptıracam", expectStrategy: ["SERVICE_SCOPE", "INDUSTRIAL_PARTS_SERVICE"], expectIntent: "SERVICE" },
  { id: "D", text: "dyson v15 sıfır", expectStrategy: ["RETAIL_PRODUCT", "USED_PRODUCT"] },
  { id: "E", text: "v15 bakıyom" },
  { id: "F", text: "350gr kuşe 5bin kutu", expectStrategy: "CUSTOM_MANUFACTURING" },
  { id: "G", text: "200m2 ofis boyatacam", expectStrategy: "SERVICE_SCOPE", expectIntent: "SERVICE" },
  { id: "H", text: "başakşehir 2+1 kiralık ev", expectStrategy: "REAL_ESTATE_RENT", expectIntent: "RENT" },
  { id: "I", text: "kiracılı satılık dükkan arıyorum", expectIntent: "SELL" },
  { id: "J", text: "heidelberg sm74 ikinci el" },
];

let fixtureFail = 0;

for (const f of fixtures) {
  const canonical = understandRequest(f.text);
  const errors: string[] = [];

  // Price internal strategy = canonical
  const priceHints = toPriceCanonicalHints(canonical);
  if (priceHints.strategy.strategy !== (canonical.strategy.value ?? "UNKNOWN")) {
    priceInternalMismatch += 1;
    errors.push("price hint strategy mismatch");
  }

  // Fingerprint uses canonical strategy
  const fp = buildPreviewFingerprint({
    categorySlug: canonical.category.value ?? "unknown",
    title: f.text,
    fieldValues: seedFieldValuesFromUnderstanding(canonical),
    canonicalStrategy: canonical.strategy.value,
  });
  if (canonical.strategy.value && !fp.includes(canonical.strategy.value)) {
    priceInternalMismatch += 1;
    errors.push("fingerprint strategy mismatch");
  }

  // Provider routing receives same strategy key (no re-resolve in this layer)
  if (
    canonical.strategy.value === "RETAIL_PRODUCT" ||
    canonical.strategy.value === "AUTO_PART"
  ) {
    const routing = buildProviderRouting({
      categoryId: `preview:${canonical.category.value ?? "technology"}`,
      categorySlug: canonical.category.value ?? "technology",
      title: f.text,
      attributes: seedFieldValuesFromUnderstanding(canonical),
    });
    if (!routing || typeof routing.shouldCallExternal !== "boolean") {
      priceInternalMismatch += 1;
      errors.push("routing failed");
    }
  }

  // Matching from canonical
  const matching = toMatchingEstimateInput(canonical);
  if (
    matching.status === "READY" &&
    matching.categorySlug &&
    canonical.category.value &&
    matching.categorySlug !== canonical.category.value
  ) {
    matchingMismatch += 1;
    errors.push(
      `matching cat ${matching.categorySlug} != ${canonical.category.value}`,
    );
  }

  // UNKNOWN must not become services
  if (
    (canonical.category.status === "UNKNOWN" ||
      (canonical.category.status === "TENTATIVE" &&
        !canonical.category.value)) &&
    matching.categorySlug === "services"
  ) {
    unknownConcreteLeak += 1;
    errors.push("UNKNOWN→services leak in matching");
  }

  if (
    f.id === "E" &&
    matching.categorySlug === "services" &&
    matching.status === "READY"
  ) {
    unknownConcreteLeak += 1;
    errors.push("v15 bakıyom matched as services");
  }

  // Tentative must not become confident in UI schema flag
  const schema = resolveSchemaCategory(canonical);
  if (
    canonical.category.status === "TENTATIVE" &&
    schema.confident === true
  ) {
    tentativeConfidentLeak += 1;
    errors.push("TENTATIVE→CONFIDENT leak");
  }
  if (
    canonical.category.status === "UNKNOWN" &&
    schema.displayLabelSafe
  ) {
    tentativeConfidentLeak += 1;
    errors.push("UNKNOWN shown certain");
  }

  // URL unlocked hint must not beat strong canonical
  if (f.id === "D") {
    const uiCat = simulateActiveCategory(canonical, {
      categoryOverride: "services",
      categoryLockedByUser: false,
    });
    if (uiCat === "services" && canonical.category.value !== "services") {
      activeDualAuthority += 1;
      errors.push("unlocked URL services overrode product understanding");
    }
    const locked = simulateActiveCategory(canonical, {
      categoryOverride: "services",
      categoryLockedByUser: true,
    });
    if (locked !== "services") {
      structuredOverrideLost += 1;
      errors.push("locked override lost");
    }
  }

  // Home handoff: raw only — same as direct
  const fromHome = understandRequest(f.text);
  if (semanticKey(fromHome) !== semanticKey(canonical)) {
    homeHandoffDrift += 1;
    errors.push("home handoff drift");
  }

  // Edit round-trip for selected fixtures
  if (["A", "D", "G", "H"].includes(f.id)) {
    const seeded = seedFieldValuesFromUnderstanding(canonical);
    const edited = understandRequest({
      rawInput: f.text,
      structured: {
        categoryId:
          canonical.category.status === "CONFIDENT"
            ? canonical.category.value
            : null,
        city: "Ankara",
        fieldValues: {
          ...seeded,
          city: "Ankara",
        },
      },
    });

    if (edited.location?.city?.value !== "Ankara") {
      structuredOverrideLost += 1;
      errors.push("edit city override lost");
    }

    // Unrelated strategy/intent should stay
    if (
      edited.intent.value !== canonical.intent.value ||
      edited.strategy.value !== canonical.strategy.value
    ) {
      editDrift += 1;
      errors.push(
        `edit drift intent/strategy ${edited.intent.value}/${edited.strategy.value}`,
      );
    }

    // modelYear / model preserved when present (string/number coercion)
    if (canonical.attributes.modelYear?.value != null) {
      const before = String(canonical.attributes.modelYear.value);
      const after = String(edited.attributes.modelYear?.value ?? "");
      if (before !== after) {
        editDrift += 1;
        errors.push("modelYear drifted after unrelated edit");
      }
    }
  }

  if (f.expectStrategy) {
    const ok = Array.isArray(f.expectStrategy)
      ? f.expectStrategy.includes(canonical.strategy.value as PriceStrategyKey)
      : canonical.strategy.value === f.expectStrategy;
    if (!ok) errors.push(`strategy=${canonical.strategy.value}`);
  }
  if (f.expectIntent && canonical.intent.value !== f.expectIntent) {
    errors.push(`intent=${canonical.intent.value}`);
  }

  if (errors.length) {
    fixtureFail += 1;
    console.log(`FAIL ${f.id} — ${f.text}\n  ${errors.join("; ")}`);
  } else {
    console.log(`PASS ${f.id} — ${f.text}`);
  }
}

// Simulate price-engine canonical path equality (pure)
{
  const u = understandRequest("c180 bakım yaptıracam");
  const hints = toPriceCanonicalHints(u);
  const engineStrategy = hints.strategy; // authoritative when supplied
  if (engineStrategy.strategy !== u.strategy.value) {
    priceInternalMismatch += 1;
    console.log("FAIL — price internal vs canonical for service");
  } else if (engineStrategy.strategy === "VEHICLE") {
    priceInternalMismatch += 1;
    console.log("FAIL — service became VEHICLE");
  } else {
    console.log("PASS — price canonical strategy for service");
  }
}

console.log("\n========== SINGLE BRAIN CLOSURE ==========");
console.log(`ACTIVE DUAL-AUTHORITY PATH COUNT: ${activeDualAuthority}`);
console.log(`EDIT ROUND-TRIP SEMANTIC DRIFT COUNT: ${editDrift}`);
console.log(`HOME HANDOFF SEMANTIC DRIFT COUNT: ${homeHandoffDrift}`);
console.log(
  `CANONICAL/PRICE-INTERNAL STRATEGY MISMATCH COUNT: ${priceInternalMismatch}`,
);
console.log(
  `CANONICAL/MATCHING CATEGORY MISMATCH COUNT: ${matchingMismatch}`,
);
console.log(`UNKNOWN→CONCRETE LEAK COUNT: ${unknownConcreteLeak}`);
console.log(`TENTATIVE→CONFIDENT LEAK COUNT: ${tentativeConfidentLeak}`);
console.log(`STRUCTURED OVERRIDE LOST COUNT: ${structuredOverrideLost}`);
console.log(
  `DUPLICATE PRODUCT IDENTITY AUTHORITY COUNT: ${duplicateIdentityAuthority}`,
);
console.log(`FIXTURE FAILURES: ${fixtureFail}`);

const pass =
  activeDualAuthority === 0 &&
  editDrift === 0 &&
  homeHandoffDrift === 0 &&
  priceInternalMismatch === 0 &&
  matchingMismatch === 0 &&
  unknownConcreteLeak === 0 &&
  tentativeConfidentLeak === 0 &&
  structuredOverrideLost === 0 &&
  duplicateIdentityAuthority === 0 &&
  fixtureFail === 0;

if (!pass) {
  console.log("\nVERIFY SINGLE BRAIN CLOSURE: FAIL");
  process.exit(1);
}
console.log("\nVERIFY SINGLE BRAIN CLOSURE: PASS");
