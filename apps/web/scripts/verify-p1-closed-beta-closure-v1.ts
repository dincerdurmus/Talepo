/**
 * Closed Beta P1 Closure V1 — focused verification.
 * Run from apps/web:
 *   npx --yes tsx scripts/verify-p1-closed-beta-closure-v1.ts
 *
 * Offline fixtures always. Does not load .env files or acceptance credentials.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { canMutateCompanyBilling } from "../src/lib/billing/billing-authority";
import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog";
import { AUTHORIZATION_MATRIX } from "../src/lib/observability/authorization-matrix";
import {
  getCategoryById,
  getCategoryNeedTypeDefault,
  getVisibleCategoryFields,
} from "../src/lib/request-category-engine";
import {
  composeNaturalRequestText,
  composeTextFromBrowseStack,
  createBrowseWalkState,
  createTextOnlyState,
  pinBrowseSemanticContext,
  resolveHybridQuestions,
} from "../src/lib/request-composer";
import { buildUnderstandingSummary } from "../src/lib/request-understanding/activation-bridge";
import { ensureTaxonomyLoaded } from "../src/lib/taxonomy";

let pass = 0;
let fail = 0;
const errors: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`PASS — ${name}`);
  } else {
    fail += 1;
    const msg = detail ? `${name}: ${detail}` : name;
    errors.push(msg);
    console.log(`FAIL — ${msg}`);
  }
}

const root = join(__dirname, "..");
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

ensureAutomotiveCatalogRegistered();
ensureTaxonomyLoaded();

console.log("=== P1-1 BUYER OFFER COPY ===\n");
{
  const buyerPage = read("src/app/panel/gelen-teklifler/page.tsx");
  const incomingCard = read("src/components/panel/IncomingOfferCard.tsx");
  const compare = read("src/components/panel/OfferCompareToggle.tsx");
  const sellerForm = read("src/components/panel/OfferForm.tsx");
  check(
    "buyer incoming cards do not print Eksik:",
    !buyerPage.includes("Eksik:") && !incomingCard.includes("Eksik:"),
  );
  check(
    "buyer compare table does not print Eksik:",
    !compare.includes("Eksik:"),
  );
  check(
    "buyer incoming uses scope in details accordion not main card",
    read("src/components/panel/NegotiationHistory.tsx").includes("Teklif ayrıntıları") &&
      read("src/components/panel/NegotiationHistory.tsx").includes("Teklif kapsamı") &&
      !incomingCard.includes("Eksik:"),
  );
  check(
    "seller OfferForm still has completeness guidance",
    sellerForm.includes("Eksik:") && sellerForm.includes("completeness.missing"),
  );
}

console.log("\n=== P1-2 COMPOSE DEDUPE ===\n");
{
  const bosch = createTextOnlyState(
    "Bosch çamaşır makinesi için pompa arıyorum",
  );
  const boschText = composeNaturalRequestText(bosch).toLocaleLowerCase("tr-TR");
  check(
    "Bosch pump single pompa / single için",
    (boschText.match(/pompa/g) ?? []).length === 1 &&
      (boschText.match(/için/g) ?? []).length <= 1 &&
      /bosch/.test(boschText) &&
      /arıyorum/.test(boschText),
    boschText,
  );
  const headline = buildUnderstandingSummary(bosch.understanding)
    .headline.toLocaleLowerCase("tr-TR");
  check(
    "Bosch headline no duplicate için pompa",
    (headline.match(/için/g) ?? []).length <= 1 &&
      (headline.match(/pompa/g) ?? []).length <= 1,
    headline,
  );

  const golf = composeNaturalRequestText(
    createTextOnlyState("Golf 7 dizel çıkma motor arıyorum"),
  ).toLocaleLowerCase("tr-TR");
  check(
    "Golf engine no duplicate motor/için/yedek",
    !/için\s+için/.test(golf) &&
      (golf.match(/\bmotor\b/g) ?? []).length <= 1 &&
      !/yedek\s+için\s+yedek/.test(golf),
    golf,
  );

  const alfa = composeTextFromBrowseStack(
    [
      { kind: "category", label: "Otomotiv" },
      { kind: "subcategory", label: "Yedek Parça" },
      { kind: "brand", label: "Alfa Romeo" },
      { kind: "model", label: "156" },
    ],
    { categoryId: "automotive", subcategorySlug: "yedek-parca" },
  );
  check(
    "Alfa browse PART natural",
    /Alfa Romeo/i.test(alfa) &&
      /156/.test(alfa) &&
      /arıyorum/i.test(alfa) &&
      !/yedek\s+için\s+yedek/i.test(alfa),
    alfa,
  );

  const browseOnly = composeTextFromBrowseStack(
    [
      { kind: "category", label: "Otomotiv" },
      { kind: "subcategory", label: "Yedek Parça" },
    ],
    { categoryId: "automotive", subcategorySlug: "yedek-parca" },
  ).toLocaleLowerCase("tr-TR");
  check(
    "browse-only PART no yedek için yedek parça",
    !/yedek\s+için\s+yedek/.test(browseOnly),
    browseOnly,
  );

  const composeSrc = read("src/lib/request-composer/compose-text.ts");
  check(
    "dedupe is semantic compose planning not post-hoc replace",
    composeSrc.includes("composeCompatibilityPartSentence") &&
      composeSrc.includes("planIdentityPhrase") &&
      composeSrc.includes("planPartPhrase") &&
      !composeSrc.includes('.replace("için pompa arıyorum için pompa"'),
  );
}

console.log("\n=== P1-3 STALE FLASH ===\n");
{
  const hook = read("src/hooks/useHybridRequestComposer.ts");
  const talep = read("src/app/talep/page.tsx");
  const panel = read("src/components/request/HybridComposerPanels.tsx");
  check(
    "text change sets isSyncing immediately",
    hook.includes("setIsSyncing(true)") &&
      hook.includes("if (next.trim() !== currentRaw)"),
  );
  check(
    "questions/facts empty while syncing",
    hook.includes("if (!state || isSyncing) return null") &&
      talep.includes("hybrid.isSyncing ? []") &&
      talep.includes("updating={hybrid.isSyncing}"),
  );
  check(
    "updating copy present",
    panel.includes("Talepo talebini güncelliyor"),
  );
  check(
    "category root does not seed vehicle-purchase text",
    hook.includes("Category root alone is not a vehicle-purchase request") &&
      hook.includes('if (node.kind === "category" && !walkSubSlug)'),
  );
  check(
    "automotive needType is not defaulted to vehicle",
    getCategoryNeedTypeDefault("automotive") === null,
  );
}

console.log("\n=== P1-4 BILLING RBAC ===\n");
{
  check("OWNER allow", canMutateCompanyBilling("OWNER") === true);
  check("ADMIN allow", canMutateCompanyBilling("ADMIN") === true);
  check("MANAGER deny", canMutateCompanyBilling("MANAGER") === false);
  check("MEMBER deny", canMutateCompanyBilling("MEMBER") === false);
  check("VIEWER deny", canMutateCompanyBilling("VIEWER") === false);
  check("null deny", canMutateCompanyBilling(null) === false);

  const assertSrc = read("src/server/billing/assert-billing-permission.ts");
  const checkout = read("src/server/billing/create-checkout.ts");
  const credits = read("src/server/billing/create-credit-checkout.ts");
  const membership = read("src/app/api/membership/route.ts");
  const planPage =
    read("src/app/panel/plan/page.tsx") +
    read("src/components/panel/PlanDetails.tsx");
  const planUi = read("src/components/panel/PlanManager.tsx");
  const offerSrc = read("src/lib/membership/assert-entitlement.ts");

  check(
    "assertCanMutateBilling uses role helper",
    assertSrc.includes("canMutateCompanyBilling(membership.role)"),
  );
  check(
    "plan checkout calls assertCanMutateBilling",
    checkout.includes("await assertCanMutateBilling"),
  );
  check(
    "credit checkout calls assertCanMutateBilling",
    credits.includes("await assertCanMutateBilling"),
  );
  check(
    "membership upgrade/credits call assertCanMutateBilling",
    (membership.match(/assertCanMutateBilling/g) ?? []).length >= 2,
  );
  check(
    "plan page computes canMutateBilling from company role",
    planPage.includes("canMutateCompanyBilling(companyRole)"),
  );
  check(
    "PlanManager gates checkout UI",
    planUi.includes("canMutateBilling") &&
      planUi.includes("if (!canMutateBilling) return false"),
  );
  check(
    "offer submit has no MEMBER role block",
    !offerSrc.includes("MEMBER") && offerSrc.includes("assertCanSubmitOffer"),
  );
  check(
    "authz matrix documents MEMBER billing DENY + offer ALLOW",
    AUTHORIZATION_MATRIX.some(
      (r) =>
        r.actor === "company_member" &&
        r.resource === "billing" &&
        r.condition.includes("DENY"),
    ) &&
      AUTHORIZATION_MATRIX.some(
        (r) =>
          r.actor === "company_member" &&
          r.resource === "offer" &&
          r.action === "submit" &&
          r.condition.includes("ALLOW"),
      ),
  );
}

console.log("\n=== P1-5 PART QUESTIONS + GOLF ROLES ===\n");
{
  const autoFields = getCategoryById("automotive").fields;
  const unknownNeed = getVisibleCategoryFields(autoFields, {}, "automotive");
  check(
    "automotive root does not require modelYear",
    !unknownNeed.some((f) => f.key === "modelYear"),
    unknownNeed.map((f) => f.key).join(","),
  );
  const partFields = getVisibleCategoryFields(
    autoFields,
    { needType: "part" },
    "automotive",
    { subcategorySlug: "yedek-parca" },
  );
  check(
    "PART schema modelYear not visible/required",
    !partFields.some((f) => f.key === "modelYear"),
    partFields.map((f) => f.key).join(","),
  );

  const golfState = createTextOnlyState("Golf 7 dizel çıkma motor arıyorum");
  const golfQ = resolveHybridQuestions(golfState);
  check(
    "Golf PART subject",
    golfState.understanding.requestSubject.kind.value === "PART",
    golfState.understanding.requestSubject.kind.value,
  );
  check(
    "Golf questions do not require modelYear",
    !golfQ.missingRequired.some((f) => f.key === "modelYear") &&
      !golfQ.candidates.some((c) => c.fieldKey === "modelYear"),
    golfQ.missingRequired.map((f) => f.key).join(","),
  );
  const brand = golfState.fields.brand?.value ?? "";
  const model = golfState.fields.model?.value ?? "";
  const gen =
    golfState.fields.generation?.value ??
    golfState.understanding.catalogEnrichment?.generation?.label ??
    "";
  check(
    "Golf brand=Volkswagen model=Golf",
    /volkswagen/i.test(brand) && /golf/i.test(model) && !/^golf$/i.test(brand),
    `brand=${brand} model=${model} gen=${gen}`,
  );
  check(
    "Golf generation VII/7 when resolved",
    /vii|\b7\b/i.test(String(gen)) || /golf vii/i.test(composeNaturalRequestText(golfState)),
    `gen=${gen}`,
  );

  const corolla = createTextOnlyState("Toyota Corolla için yağ filtresi");
  check(
    "Corolla brand stays Toyota",
    /toyota/i.test(corolla.fields.brand?.value ?? "") &&
      /corolla/i.test(corolla.fields.model?.value ?? ""),
    `brand=${corolla.fields.brand?.value} model=${corolla.fields.model?.value}`,
  );

  const alfa = createTextOnlyState("Alfa Romeo 156 far arıyorum");
  check(
    "Alfa PART not vehicle-purchase",
    alfa.understanding.requestSubject.kind.value === "PART" &&
      !resolveHybridQuestions(alfa).candidates.some(
        (c) => c.fieldKey === "condition" || c.fieldKey === "mileage",
      ),
    alfa.understanding.requestSubject.kind.value,
  );
}

console.log("\n=== P1-6 HYDRATION ===\n");
{
  const shell = read("src/components/panel/PanelShell.tsx");
  const walk = createBrowseWalkState();
  check(
    "PanelShell does not read localStorage in useState initializer",
    /useState\(false\)/.test(shell) &&
      !/useState\(\(\)\s*=>\s*\{[\s\S]*localStorage/.test(shell) &&
      shell.includes("localStorage.getItem(SIDEBAR_COLLAPSED_KEY)") &&
      shell.includes("useEffect"),
  );
  check(
    "browse walk initial categoryId is empty not appliances",
    walk.categoryId === "" && walk.stack.length === 0,
    JSON.stringify(walk),
  );
  check(
    "createBrowseWalkState source is deterministic empty",
    read("src/lib/request-composer/ui-helpers.ts").includes(
      'categoryId: ""',
    ),
  );
}

check(
  "suite source has no env credential blobs",
  !read("src/lib/billing/billing-authority.ts").includes("postgresql://") &&
    !read("src/server/billing/assert-billing-permission.ts").includes(
      "postgresql://",
    ),
);

console.log(
  `\n=== P1 CLOSURE SUMMARY pass=${pass} fail=${fail} ===\n`,
);
if (errors.length) {
  console.log("FAILURES:");
  for (const e of errors) console.log(` - ${e}`);
  process.exit(1);
}
process.exit(0);
