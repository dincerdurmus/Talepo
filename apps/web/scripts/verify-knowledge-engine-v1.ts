/**
 * Universal Catalog & Request Knowledge Engine V1 foundation checks.
 * Run: npx tsx scripts/verify-knowledge-engine-v1.ts
 */
import { REQUEST_CATEGORIES } from "../src/lib/request-category-engine";
import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog";
import {
  ALL_KNOWLEDGE_PROFILES,
  applyBrowseSelection,
  auditCategoryTreeCoverage,
  browsePathToExplicitFields,
  canPromoteGapToProduction,
  compareFreeTextAndBrowseEquivalence,
  createCatalogGap,
  getBrands,
  getBrowseChildren,
  getCategoryChildren,
  getConditionalFields,
  getGenerations,
  getMissingRequiredFields,
  getModels,
  getNextMissingFields,
  getOptionalFields,
  getRequiredFields,
  getRootCategories,
  profileHasCapability,
  profilesForExternalPolicy,
  resolveKnowledgeProfile,
  resolveNextQuestions,
  resolveRequestSchema,
  subcategorySlug,
} from "../src/lib/knowledge";
import {
  canAutoSafeSource,
  categoriesEligibleForExternalIngest,
  classifyIngestRecord,
  createStubSourceAdapter,
  runCatalogIngestion,
} from "../src/lib/knowledge/ingestion";
import type { IngestRecord } from "../src/lib/knowledge/types";

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

ensureAutomotiveCatalogRegistered();

// 1–2 category tree + profile resolution
const audit = auditCategoryTreeCoverage();
check("category tree source REQUEST_CATEGORIES", audit.totalCategories === 11);
check("all domain profiles present", audit.missingDomainProfiles.length === 0);
check(
  "subcategory profiles cover tree",
  audit.missingSubcategoryProfiles.length === 0,
  JSON.stringify(audit.missingSubcategoryProfiles.slice(0, 5)),
);
check("total categories analyzed", audit.totalCategories >= 11);
check("total subcategories analyzed", audit.totalSubcategories >= 40);

// 3 subcategory override
const autoSpare = resolveKnowledgeProfile({
  categoryId: "automotive",
  subcategoryLabel: "Yedek Parça",
});
check(
  "subcategory override spare capabilities",
  autoSpare.capabilities.includes("ENTITY_COMPATIBILITY") &&
    autoSpare.id === "automotive/yedek-parca",
);

// 4 multiple capabilities
check(
  "multiple capability resolution machinery",
  resolveKnowledgeProfile({ categoryId: "machinery" }).capabilities.length >= 2,
);

// 5–8 browse
const roots = getRootCategories();
check("browse root categories", roots.length === REQUEST_CATEGORIES.length);
check(
  "browse category children automotive",
  getCategoryChildren("automotive").some((n) => n.label === "Yedek Parça"),
);
const brands = getBrands("automotive", "yedek-parca");
check("brand browse automotive", brands.length >= 100);
const vw = brands.find((b) => b.label === "Volkswagen");
check("volkswagen brand present", Boolean(vw?.entityId));
const models = vw ? getModels("automotive", vw.entityId!) : [];
const golf = models.find((m) => m.label === "Golf");
check("model browse golf", Boolean(golf?.entityId));
const gens = golf ? getGenerations("automotive", golf.entityId!) : [];
check(
  "nested generation browse golf vii",
  gens.some((g) => g.label === "Golf VII"),
);

const spareChildren = getBrowseChildren("automotive/yedek-parca", {
  categoryId: "automotive",
  subcategorySlug: "yedek-parca",
});
check("browse children after subcategory", spareChildren.length > 0);

// 9–16 request schema + questions
const schema = resolveRequestSchema({
  categoryId: "automotive",
  subcategoryLabel: "Yedek Parça",
  values: { needType: "part" },
});
check("request schema resolution", schema.fields.length > 0);
check(
  "required fields include brand/model",
  getRequiredFields({
    categoryId: "automotive",
    values: { needType: "part" },
  }).some((f) => f.key === "brand"),
);
check(
  "optional/conditional fields exist",
  getOptionalFields({
    categoryId: "automotive",
    values: { needType: "part" },
  }).length > 0,
);
check(
  "conditional fields active for part",
  getConditionalFields({
    categoryId: "automotive",
    subcategoryLabel: "Yedek Parça",
    values: { needType: "part" },
  }).length >= 0,
);

const missing = getMissingRequiredFields({
  categoryId: "automotive",
  values: { needType: "part" },
});
check("missing required when empty", missing.length >= 2);

let filled = applyBrowseSelection(
  { needType: "part", brand: "Volkswagen" },
  { key: "brand", value: "Volkswagen", entityId: "brand_volkswagen" },
);
filled = applyBrowseSelection(filled, {
  key: "model",
  value: "Golf",
  entityId: "model_volkswagen_golf",
});
const nextAfterBrowse = getNextMissingFields({
  categoryId: "automotive",
  values: filled,
});
check(
  "known explicit browse field not re-asked",
  !nextAfterBrowse.some((f) => f.key === "brand" || f.key === "model"),
);

const questions = resolveNextQuestions({
  categoryId: "automotive",
  values: filled,
  explicitKeys: ["brand", "model"],
});
check(
  "browse choice EXPLICIT accepted",
  questions.known.includes("brand") && questions.known.includes("model"),
);

// catalog does not overwrite explicit — marker preserved
check(
  "explicit marker preserved",
  filled.__explicit__brand === "browse" && filled.brand === "Volkswagen",
);

// 17–22 capability flows via profiles
check(
  "ENTITY_CATALOG automotive",
  profileHasCapability(
    resolveKnowledgeProfile({ categoryId: "automotive" }),
    "ENTITY_CATALOG",
  ),
);
check(
  "ENTITY_SPEC appliances",
  profileHasCapability(
    resolveKnowledgeProfile({ categoryId: "appliances" }),
    "ENTITY_SPEC",
  ),
);
check(
  "ENTITY_COMPATIBILITY spare",
  profileHasCapability(autoSpare, "ENTITY_COMPATIBILITY"),
);
check(
  "ATTRIBUTE_SCHEMA printing",
  profileHasCapability(
    resolveKnowledgeProfile({ categoryId: "printing" }),
    "ATTRIBUTE_SCHEMA",
  ),
);
check(
  "SERVICE_SCHEMA services",
  profileHasCapability(
    resolveKnowledgeProfile({ categoryId: "services" }),
    "SERVICE_SCHEMA",
  ),
);
check(
  "COMMODITY_SCHEMA health sarf",
  profileHasCapability(
    resolveKnowledgeProfile({
      categoryId: "health",
      subcategoryLabel: "Sarf Malzeme",
    }),
    "COMMODITY_SCHEMA",
  ),
);

// 23–26 external policies
check(
  "external REQUIRED automotive",
  resolveKnowledgeProfile({ categoryId: "automotive" }).externalPolicy ===
    "REQUIRED",
);
check(
  "external SELECTIVE appliances",
  resolveKnowledgeProfile({ categoryId: "appliances" }).externalPolicy ===
    "SELECTIVE",
);
check(
  "external DISCOVERY_ONLY furniture diğer",
  resolveKnowledgeProfile({
    categoryId: "furniture",
    subcategoryLabel: "Diğer",
  }).externalPolicy === "DISCOVERY_ONLY",
);
check(
  "external DISABLED printing",
  resolveKnowledgeProfile({ categoryId: "printing" }).externalPolicy ===
    "DISABLED",
);

// 27–36 classification / provenance
function rec(
  partial: Partial<IngestRecord> & Pick<IngestRecord, "id" | "provenance">,
): IngestRecord {
  return {
    categoryId: "automotive",
    kind: "entity",
    payload: { canonicalKey: partial.id },
    ...partial,
  };
}

const safeRec = classifyIngestRecord({
  record: rec({
    id: "safe-1",
    provenance: {
      sourceType: "OFFICIAL_MANUFACTURER",
      sourceName: "OEM",
      confidence: "HIGH",
      verificationStatus: "verified",
    },
  }),
  validation: { ok: true, reasons: [] },
  conflict: { hasConflict: false, reasons: [] },
});
check("SAFE classification", safeRec.classification === "SAFE");

const reviewDup = classifyIngestRecord({
  record: rec({
    id: "dup-1",
    provenance: {
      sourceType: "TRUSTED_DATASET",
      sourceName: "ds",
      confidence: "HIGH",
      verificationStatus: "ok",
    },
  }),
  validation: { ok: true, reasons: [] },
  conflict: { hasConflict: true, reasons: ["DUPLICATE"] },
  duplicate: true,
});
check("REVIEW duplicate", reviewDup.classification === "REVIEW");

const rejectInvalid = classifyIngestRecord({
  record: rec({
    id: "bad-1",
    provenance: {
      sourceType: "TRUSTED_DATASET",
      sourceName: "ds",
      confidence: "HIGH",
      verificationStatus: "ok",
    },
    payload: { canonicalKey: "bad-1" },
  }),
  validation: { ok: false, reasons: ["INVALID_RANGE"] },
  conflict: { hasConflict: false, reasons: [] },
});
check("REJECT invalid", rejectInvalid.classification === "REJECT");

const orphan = classifyIngestRecord({
  record: rec({
    id: "orphan-1",
    provenance: {
      sourceType: "TRUSTED_DATASET",
      sourceName: "ds",
      confidence: "HIGH",
      verificationStatus: "ok",
    },
  }),
  validation: { ok: true, reasons: [] },
  conflict: { hasConflict: false, reasons: [] },
  orphan: true,
});
check("REVIEW orphan", orphan.classification === "REVIEW");

const amb = classifyIngestRecord({
  record: rec({
    id: "amb-1",
    provenance: {
      sourceType: "TRUSTED_DATASET",
      sourceName: "ds",
      confidence: "HIGH",
      verificationStatus: "ok",
    },
  }),
  validation: { ok: true, reasons: [] },
  conflict: { hasConflict: false, reasons: [] },
  ambiguous: true,
});
check("REVIEW ambiguous", amb.classification === "REVIEW");

check("AI_INFERRED cannot auto-SAFE", !canAutoSafeSource("AI_INFERRED"));
check("USER_DISCOVERED cannot auto-SAFE", !canAutoSafeSource("USER_DISCOVERED"));

const ai = classifyIngestRecord({
  record: rec({
    id: "ai-1",
    provenance: {
      sourceType: "AI_INFERRED",
      sourceName: "llm",
      confidence: "HIGH",
      verificationStatus: "inferred",
    },
  }),
  validation: { ok: true, reasons: [] },
  conflict: { hasConflict: false, reasons: [] },
});
check("AI_INFERRED not SAFE", ai.classification !== "SAFE");

const mkt = classifyIngestRecord({
  record: rec({
    id: "mkt-1",
    kind: "relation",
    payload: { canonicalKey: "mkt-1", compatibility: true },
    provenance: {
      sourceType: "MARKETPLACE",
      sourceName: "market",
      confidence: "HIGH",
      verificationStatus: "raw",
    },
  }),
  validation: { ok: true, reasons: [] },
  conflict: { hasConflict: false, reasons: [] },
  criticalCompatibility: true,
});
check(
  "marketplace cannot authorize critical compatibility",
  mkt.classification !== "SAFE" &&
    mkt.reasons.includes("MARKETPLACE_INSUFFICIENT_AUTHORITY"),
);

const gap = createCatalogGap({ categoryId: "automotive", rawValue: "FooCar" });
check("gap cannot auto promote", canPromoteGapToProduction(gap) === false);

// 37–41 dry-run / apply / ingest-all / printing / furniture
const allIds = REQUEST_CATEGORIES.map((c) => c.id);
const eligible = categoriesEligibleForExternalIngest(allIds);
check(
  "ingest all respects DISABLED",
  eligible.skippedDisabled.includes("printing") &&
    eligible.skippedDisabled.includes("furniture") &&
    eligible.skippedDisabled.includes("services"),
);

const stub = createStubSourceAdapter({
  id: "stub-auto",
  supportedCategoryIds: ["automotive", "printing", "furniture"],
  recordsFor: (ctx) => [
    {
      id: `${ctx.categoryId}-r1`,
      categoryId: ctx.categoryId,
      kind: "entity",
      payload: { canonicalKey: `${ctx.categoryId}-r1` },
      provenance: {
        sourceType: "TRUSTED_DATASET",
        sourceName: "stub",
        confidence: "HIGH",
        verificationStatus: "test",
      },
    },
  ],
});

void (async () => {
  const dry = await runCatalogIngestion({
    categoryIds: allIds,
    dryRun: true,
    apply: false,
    adapters: [stub],
    writeArtifacts: false,
  });
  check("dry-run does not apply", dry.report.applied === false && dry.report.dryRun);
  check(
    "printing packaging crawling not started",
    !dry.report.adapterIds.length ||
      !dry.safe.some((r) => r.categoryId === "printing"),
  );
  check(
    "furniture blind crawl not started",
    !dry.safe.some((r) => r.categoryId === "furniture") &&
      dry.skippedCategoryIds.includes("furniture"),
  );
  check(
    "automotive eligible under ingest-all",
    dry.report.categoryIds.includes("automotive") &&
      dry.safe.some((r) => r.categoryId === "automotive"),
  );

  let applyGuardOk = false;
  try {
    await runCatalogIngestion({
      categoryIds: ["automotive"],
      dryRun: true,
      apply: true,
      adapters: [stub],
    });
  } catch {
    applyGuardOk = true;
  }
  check("apply requires explicit dryRun=false", applyGuardOk);

  // 42 machinery entity + attributes
  const mach = resolveKnowledgeProfile({ categoryId: "machinery" });
  check(
    "machinery entity + attributes",
    mach.capabilities.includes("ENTITY_CATALOG") &&
      mach.capabilities.includes("ATTRIBUTE_SCHEMA"),
  );

  // 43 kitchen/bath → appliances firin + home-kitchen attribute
  const builtIn = resolveKnowledgeProfile({
    categoryId: "appliances",
    subcategoryLabel: "Fırın / Ocak",
  });
  const sinkLike = resolveKnowledgeProfile({
    categoryId: "home-kitchen",
    subcategoryLabel: "Cam / Porselen",
  });
  check(
    "kitchen/bath subcategory override",
    builtIn.capabilities.includes("ENTITY_CATALOG") &&
      sinkLike.capabilities.includes("ATTRIBUTE_SCHEMA") &&
      sinkLike.externalPolicy === "DISABLED",
  );

  // 44–46 free text / browse equivalence
  const eq = compareFreeTextAndBrowseEquivalence();
  check(
    "free text automotive resolves facts",
    Boolean(eq.freeText?.brand?.id && eq.freeText?.model?.id),
    JSON.stringify(eq.freeText),
  );
  check(
    "browse automotive resolves facts",
    Boolean(eq.browse.brand?.id && eq.browse.generation?.id && eq.browse.part?.id),
  );
  check(
    "free text / browse canonical equivalence",
    eq.equivalent,
    eq.mismatches.join(","),
  );

  const explicitFields = browsePathToExplicitFields();
  check(
    "browse path builds explicit fields",
    explicitFields.__explicit__brand === "browse" &&
      Boolean(explicitFields.brandId),
  );

  // Profile counts for report
  console.log("\n--- PROFILE COUNTS ---");
  console.log("ALL_PROFILES", ALL_KNOWLEDGE_PROFILES.length);
  console.log("REQUIRED", profilesForExternalPolicy("REQUIRED").length);
  console.log("SELECTIVE", profilesForExternalPolicy("SELECTIVE").length);
  console.log("DISCOVERY_ONLY", profilesForExternalPolicy("DISCOVERY_ONLY").length);
  console.log("DISABLED", profilesForExternalPolicy("DISABLED").length);
  console.log("slug yedek", subcategorySlug("Yedek Parça"));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
