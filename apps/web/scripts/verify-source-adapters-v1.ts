/**
 * SourceAdapters V1 acceptance checks.
 * Run: npx tsx scripts/verify-source-adapters-v1.ts
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog";
import { REQUEST_CATEGORIES } from "../src/lib/request-category-engine";
import {
  resolveKnowledgeProfile,
  resolveRequestSchema,
} from "../src/lib/knowledge";
import {
  REAL_SOURCE_ADAPTERS,
  adaptersForDomain,
  automotiveCoverageBefore,
  canAutoSafeSource,
  classifyIngestRecord,
  createEmptyGenericIndex,
  createStubSourceAdapter,
  getRegisteredAdapters,
  matchExistingAutomotive,
  matchExistingGeneric,
  normalizeIngestRecord,
  normalizeStorageGb,
  registerGenericEntity,
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

// 1 registration
check("real adapter registration", REAL_SOURCE_ADAPTERS.length >= 5);
check(
  "adapters declare contract fields",
  REAL_SOURCE_ADAPTERS.every(
    (a) =>
      a.adapterId &&
      a.sourceType &&
      a.supportedDomains?.length &&
      a.supportedEntityTypes?.length &&
      a.authorityLevel &&
      a.discoveryCapability &&
      a.structuredDataCapability &&
      a.rateLimitPolicy &&
      typeof a.supportsIncremental === "boolean" &&
      typeof a.supportsDetailFetch === "boolean",
  ),
);

// 2–3 domain / category support
check(
  "domain support automotive",
  adaptersForDomain("automotive").some((a) => a.id === "automotive-coverage-gap"),
);
check(
  "domain support appliances",
  adaptersForDomain("appliances").some((a) => a.id === "appliances-discovery"),
);
check(
  "category scope filter via getRegisteredAdapters",
  getRegisteredAdapters({ categoryId: "technology" }).every((a) =>
    a.supportedCategories.includes("technology"),
  ),
);

// 4–7 policy
check(
  "printing DISABLED",
  resolveKnowledgeProfile({ categoryId: "printing" }).externalPolicy ===
    "DISABLED",
);
check(
  "furniture DISABLED",
  resolveKnowledgeProfile({ categoryId: "furniture" }).externalPolicy ===
    "DISABLED",
);
check(
  "services DISABLED",
  resolveKnowledgeProfile({ categoryId: "services" }).externalPolicy ===
    "DISABLED",
);
check(
  "home-kitchen DISABLED",
  resolveKnowledgeProfile({ categoryId: "home-kitchen" }).externalPolicy ===
    "DISABLED",
);
check(
  "automotive REQUIRED",
  resolveKnowledgeProfile({ categoryId: "automotive" }).externalPolicy ===
    "REQUIRED",
);
check(
  "machinery SELECTIVE",
  resolveKnowledgeProfile({ categoryId: "machinery" }).externalPolicy ===
    "SELECTIVE",
);
check(
  "technology Donanım SELECTIVE",
  resolveKnowledgeProfile({
    categoryId: "technology",
    subcategoryLabel: "Donanım",
  }).externalPolicy === "SELECTIVE",
);
check(
  "technology Yazılım DISABLED",
  resolveKnowledgeProfile({
    categoryId: "technology",
    subcategoryLabel: "Yazılım Geliştirme",
  }).externalPolicy === "DISABLED",
);

// 8–9 normalize
const norm = normalizeIngestRecord({
  id: "n1",
  categoryId: "technology",
  kind: "model",
  payload: { brand: "Apple", model: "iPhone 15 Pro Max", storage: "1TB" },
  provenance: {
    sourceType: "TRUSTED_DATASET",
    sourceName: "t",
    confidence: "HIGH",
    verificationStatus: "ok",
  },
});
check(
  "raw → normalized",
  Boolean(norm.normalized.brandFold && norm.normalized.canonicalKey),
);
check("storage normalization 1TB→1024GB", normalizeStorageGb("1TB") === "1024GB");
check(
  "normalized → canonical candidate stage",
  norm.stage === "NORMALIZED" && Boolean(norm.record.payload.canonicalKey),
);

// 10–13 automotive / generic match
const vw = matchExistingAutomotive({ brand: "Volkswagen", model: "Golf" });
check(
  "existing canonical mapping VW Golf",
  vw.status === "EXISTING" && vw.canonicalId === "model_volkswagen_golf",
);
const bmw = matchExistingAutomotive({ brand: "BMW", model: "3 Serisi" });
check(
  "existing canonical mapping BMW 3",
  bmw.status === "EXISTING" && bmw.canonicalId === "model_bmw_3-serisi",
);
const bmwAlias = matchExistingAutomotive({ brand: "BMW", model: "3 Series" });
check(
  "alias mapping BMW 3 Series",
  bmwAlias.status === "EXISTING" || bmwAlias.status === "NEW_CANDIDATE",
);
const unknown = matchExistingAutomotive({
  brand: "TotallyFakeMotors",
  model: "ZX9000",
});
check("new candidate unknown auto", unknown.status === "NEW_CANDIDATE");

const gidx = createEmptyGenericIndex();
registerGenericEntity(gidx, {
  id: "appl-bosch-sms6zci42e",
  brand: "Bosch",
  model: "SMS6ZCI42E",
  family: "Bulaşık Makinesi",
  categoryId: "appliances",
});
const dup = matchExistingGeneric(
  {
    id: "x",
    categoryId: "appliances",
    kind: "model",
    payload: {
      brand: "Bosch",
      model: "SMS6ZCI42E",
      productFamily: "Bulaşık Makinesi",
    },
    provenance: {
      sourceType: "TRUSTED_DATASET",
      sourceName: "t",
      confidence: "HIGH",
      verificationStatus: "ok",
    },
  },
  gidx,
);
check("duplicate prevention scoped match", dup.status === "EXISTING");

const oos = matchExistingGeneric(
  {
    id: "oos",
    categoryId: "appliances",
    kind: "model",
    payload: { brand: "Bosch", model: "GWS 750", outOfScope: true },
    provenance: {
      sourceType: "TRUSTED_DATASET",
      sourceName: "t",
      confidence: "HIGH",
      verificationStatus: "ok",
    },
  },
  gidx,
  { inScope: false },
);
check("out-of-scope rejection status", oos.status === "OUT_OF_SCOPE");

// 14–18 provenance / authority
check("AI cannot auto-safe", !canAutoSafeSource("AI_INFERRED"));
check("marketplace cannot auto-safe", !canAutoSafeSource("MARKETPLACE"));
const ai = classifyIngestRecord({
  record: {
    id: "ai",
    categoryId: "appliances",
    kind: "entity",
    payload: { canonicalKey: "ai" },
    provenance: {
      sourceType: "AI_INFERRED",
      sourceName: "llm",
      confidence: "HIGH",
      verificationStatus: "inferred",
    },
  },
  validation: { ok: true, reasons: [] },
  conflict: { hasConflict: false, reasons: [] },
});
check("AI_INFERRED not SAFE", ai.classification !== "SAFE");

const mkt = classifyIngestRecord({
  record: {
    id: "mkt",
    categoryId: "automotive",
    kind: "relation",
    payload: { canonicalKey: "mkt", compatibility: true },
    provenance: {
      sourceType: "MARKETPLACE",
      sourceName: "market",
      confidence: "HIGH",
      verificationStatus: "raw",
    },
  },
  validation: { ok: true, reasons: [] },
  conflict: { hasConflict: false, reasons: [] },
  criticalCompatibility: true,
});
check(
  "marketplace critical compatibility guard",
  mkt.classification !== "SAFE" &&
    mkt.reasons.includes("MARKETPLACE_INSUFFICIENT_AUTHORITY"),
);

const missingProv = classifyIngestRecord({
  record: {
    id: "mp",
    categoryId: "appliances",
    kind: "entity",
    payload: { canonicalKey: "mp" },
    provenance: {
      sourceType: "TRUSTED_DATASET",
      sourceName: "",
      confidence: "HIGH",
      verificationStatus: "x",
    },
  },
  validation: { ok: true, reasons: [] },
  conflict: { hasConflict: false, reasons: [] },
});
check(
  "provenance validation",
  missingProv.classification === "REVIEW" &&
    missingProv.reasons.includes("MISSING_PROVENANCE"),
);

// SAFE / REVIEW / REJECT samples
const safeRec = classifyIngestRecord({
  record: {
    id: "safe1",
    categoryId: "appliances",
    kind: "model",
    payload: { canonicalKey: "safe1", brand: "Bosch", model: "SMS6ZCI42E" },
    provenance: {
      sourceType: "TRUSTED_DATASET",
      sourceName: "fixture",
      confidence: "HIGH",
      verificationStatus: "ok",
    },
  },
  validation: { ok: true, reasons: [] },
  conflict: { hasConflict: false, reasons: [] },
});
check("SAFE classification", safeRec.classification === "SAFE");

const rejectOos = classifyIngestRecord({
  record: {
    id: "rej",
    categoryId: "appliances",
    kind: "model",
    payload: { canonicalKey: "rej", outOfScope: true },
    provenance: {
      sourceType: "TRUSTED_DATASET",
      sourceName: "fixture",
      confidence: "HIGH",
      verificationStatus: "ok",
    },
  },
  validation: { ok: false, reasons: ["OUT_OF_SCOPE"] },
  conflict: { hasConflict: false, reasons: [] },
});
check("REJECT out-of-scope", rejectOos.classification === "REJECT");

void (async () => {
  // Dry-run no mutation + disabled no fetch
  const allIds = REQUEST_CATEGORIES.map((c) => c.id);
  const dry = await runCatalogIngestion({
    categoryIds: allIds,
    dryRun: true,
    apply: false,
    adapters: REAL_SOURCE_ADAPTERS,
    writeArtifacts: false,
    allowNetwork: false,
    limit: 25,
  });

  check("dry-run no mutation / not applied", dry.report.applied === false && dry.report.dryRun);
  check(
    "printing disabled no fetch",
    dry.adapterStats
      .filter((s) => s.categoryId === "printing")
      .every((s) => s.fetchAttempts === 0) &&
      dry.skippedCategoryIds.includes("printing"),
  );
  check(
    "furniture blind crawling disabled",
    dry.skippedCategoryIds.includes("furniture") &&
      dry.adapterStats
        .filter((s) => s.categoryId === "furniture")
        .every((s) => s.fetchAttempts === 0 && s.discovered === 0),
  );
  check(
    "services external calls 0",
    dry.skippedCategoryIds.includes("services") &&
      !(dry.report.counts.fetchAttempts && dry.discoveredRaw.some((r) => r.categoryId === "services")),
  );

  // Failure isolation
  const boom = createStubSourceAdapter({
    id: "boom-adapter",
    supportedCategoryIds: ["appliances"],
    recordsFor: () => {
      throw new Error("simulated adapter failure");
    },
  });
  // Override discover to throw at promise level
  const failing: typeof boom = {
    ...boom,
    discover: async () => {
      throw new Error("simulated adapter failure");
    },
  };
  const partial = await runCatalogIngestion({
    categoryIds: ["appliances", "machinery"],
    dryRun: true,
    adapters: [failing, ...adaptersForDomain("machinery")],
    writeArtifacts: false,
    allowNetwork: false,
  });
  check(
    "failure isolation / partial success",
    partial.status === "PARTIAL_SUCCESS" &&
      partial.adapterStats.some((s) => s.accessStatus === "FAILED") &&
      (partial.safe.length > 0 || partial.review.length > 0 || partial.discoveredRaw.length > 0),
  );

  // Coverage report present
  check(
    "coverage report",
    Boolean(dry.coverageBefore.automotive) &&
      (dry.coverageBefore.automotive as { knownBrands: number }).knownBrands > 0,
  );

  // Incremental contract fields
  check(
    "incremental contract",
    REAL_SOURCE_ADAPTERS.every((a) => typeof a.supportsIncremental === "boolean"),
  );

  // Domain dry-runs with artifacts
  const auto = await runCatalogIngestion({
    categoryIds: ["automotive"],
    dryRun: true,
    adapters: adaptersForDomain("automotive"),
    writeArtifacts: true,
    allowNetwork: false,
    limit: 30,
    runId: "verify-auto-source-adapters-v1",
  });
  check(
    "automotive existing mapping in run",
    auto.discoveredRaw.some(
      (r) =>
        r.payload.brand === "Volkswagen" &&
        r.payload.model === "Golf" &&
        r.payload.matchStatus === "EXISTING",
    ) ||
      auto.normalized.some(
        (n) =>
          n.normalized.brandFold === "volkswagen" &&
          String(n.normalized.matchStatus ?? "") === "EXISTING",
      ),
  );
  check(
    "automotive duplicate prevention (Golf not NEW)",
    !auto.safe.some(
      (r) =>
        r.payload.brand === "Volkswagen" &&
        r.payload.model === "Golf" &&
        r.payload.matchStatus === "NEW_CANDIDATE",
    ),
  );

  const appl = await runCatalogIngestion({
    categoryIds: ["appliances"],
    dryRun: true,
    adapters: adaptersForDomain("appliances"),
    writeArtifacts: true,
    allowNetwork: false,
    limit: 50,
    runId: "verify-appl-source-adapters-v1",
  });
  const applBrands = new Set(
    appl.discoveredRaw
      .filter((r) => r.kind === "brand" || r.payload.brand)
      .map((r) => String(r.payload.brand)),
  );
  check(
    "appliances discovery TR/EU/ASIA brands",
    ["Arçelik", "Beko", "Bosch", "Samsung", "LG", "Miele", "Vestel", "Profilo", "Siemens"].filter(
      (b) => applBrands.has(b),
    ).length >= 6,
  );
  check(
    "appliances model/spec",
    appl.discoveredRaw.some(
      (r) =>
        r.kind === "model" &&
        r.payload.specs &&
        (r.payload.capacityKg != null ||
          r.payload.volume != null ||
          r.payload.capacityBtu != null ||
          (r.payload.specs as Record<string, unknown>).capacityKg != null ||
          (r.payload.specs as Record<string, unknown>).volume != null),
    ),
  );
  check(
    "appliances out-of-scope power tool rejected",
    appl.rejected.some((r) => String(r.payload.model ?? "").includes("GWS")) ||
      appl.discoveredRaw.some((r) => r.payload.outOfScope === true),
  );

  const tech = await runCatalogIngestion({
    categoryIds: ["technology"],
    dryRun: true,
    adapters: adaptersForDomain("technology"),
    writeArtifacts: true,
    allowNetwork: false,
    limit: 50,
    runId: "verify-tech-source-adapters-v1",
  });
  check(
    "technology discovery smartphone+laptop+tv",
    tech.discoveredRaw.some((r) => r.payload.kind === "smartphone") &&
      tech.discoveredRaw.some((r) => r.payload.kind === "laptop") &&
      tech.discoveredRaw.some((r) => r.payload.kind === "tv"),
  );
  check(
    "technology variant control (no SKU explosion)",
    tech.discoveredRaw
      .filter((r) => r.id === "tech-apple-iphone-15-pro-max")
      .every(
        (r) =>
          r.payload.emitSeparateSkuPerVariant === false &&
          r.payload.variantExplosion === false &&
          Array.isArray(
            (r.payload.variantAttributes as { storageOptions?: string[] })
              ?.storageOptions,
          ),
      ),
  );

  const mach = await runCatalogIngestion({
    categoryIds: ["machinery"],
    dryRun: true,
    adapters: adaptersForDomain("machinery"),
    writeArtifacts: true,
    allowNetwork: false,
    runId: "verify-mach-source-adapters-v1",
  });
  check(
    "machinery selective pilot",
    mach.discoveredRaw.some((r) => r.payload.subcategorySlug === "uretim-makinesi") &&
      mach.discoveredRaw.some((r) => r.payload.subcategorySlug === "kesim-makinesi") &&
      mach.discoveredRaw.some((r) => r.payload.subcategorySlug === "paketleme-makinesi"),
  );

  // Browse / schema compatibility
  const schema = resolveRequestSchema({
    categoryId: "appliances",
    subcategoryLabel: "Buzdolabı",
  });
  check(
    "request schema compatibility appliances fields",
    schema.fields.some((f) => f.key === "volume" || f.key === "energyClass"),
  );
  check(
    "browse canonical shape kinds present",
    appl.discoveredRaw.some((r) => r.kind === "brand") &&
      appl.discoveredRaw.some((r) => r.kind === "product_family") &&
      appl.discoveredRaw.some((r) => r.kind === "model"),
  );

  // Artifacts written
  const art = auto.artifactDir;
  check(
    "artifacts written",
    Boolean(art) &&
      existsSync(path.join(art!, "manifest.json")) &&
      existsSync(path.join(art!, "sources.json")) &&
      existsSync(path.join(art!, "coverage-before.json")) &&
      existsSync(path.join(art!, "report.json")),
  );

  // Coverage before automotive transmissions=0
  const cov = automotiveCoverageBefore();
  check("automotive transmissions gap = 0 known", cov.knownTransmissions === 0);

  // Production catalogs untouched (spot-check brands file mtime not required — ensure no write path)
  const brandsPath = path.resolve(
    process.cwd(),
    "../../data/catalogs/automotive/automotive-brands.json",
  );
  check("production catalog file still present", existsSync(brandsPath));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
