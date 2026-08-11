/**
 * Generic Catalog Ingestion Engine — dry-run first, apply explicit.
 * Does not mutate production catalog JSON unless apply === true (still
 * foundation-only: apply writes run artifacts + delta, not live datasets yet).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { resolveKnowledgeProfile } from "../profile-registry";
import type { ClassifiedIngestRecord, IngestRecord } from "../types";
import { classifyIngestRecord } from "./classifier";
import type {
  IngestionEngineOptions,
  IngestionEngineResult,
  SourceAdapter,
  SourceAdapterContext,
} from "./types";

function defaultRunsRoot(): string {
  // apps/web → repo root data/catalog-ingestion/runs
  return path.resolve(process.cwd(), "../../data/catalog-ingestion/runs");
}

function runIdNow(): string {
  const d = new Date();
  const stamp = d.toISOString().replace(/[:.]/g, "-");
  return `run-${stamp}`;
}

function validateRecord(record: IngestRecord): {
  ok: boolean;
  reasons: import("../types").IngestRejectReason[];
} {
  const reasons: import("../types").IngestRejectReason[] = [];
  if (!record.categoryId) reasons.push("UNSUPPORTED_CATEGORY");
  if (!record.payload || typeof record.payload !== "object") {
    reasons.push("INVALID_RANGE");
  }
  return { ok: reasons.length === 0, reasons };
}

function detectConflicts(
  record: IngestRecord,
  seenCanonical: Map<string, string>,
): {
  hasConflict: boolean;
  reasons: import("../types").IngestRejectReason[];
  conflictingIds?: string[];
  duplicate?: boolean;
} {
  const canonicalKey =
    typeof record.payload.canonicalKey === "string"
      ? record.payload.canonicalKey
      : record.id;
  const prior = seenCanonical.get(canonicalKey);
  if (prior && prior !== record.id) {
    return {
      hasConflict: true,
      reasons: ["DUPLICATE", "SOURCE_CONFLICT"],
      conflictingIds: [prior],
      duplicate: true,
    };
  }
  seenCanonical.set(canonicalKey, record.id);
  return { hasConflict: false, reasons: [] };
}

function adapterAllowed(
  adapter: SourceAdapter,
  categoryId: string,
  policy: string,
): boolean {
  if (policy === "DISABLED") return false;
  if (!adapter.supportedCategoryIds.includes(categoryId)) return false;
  if (policy === "DISCOVERY_ONLY") return true;
  if (policy === "SELECTIVE") return true;
  if (policy === "REQUIRED") return true;
  return false;
}

/**
 * Run ingestion pipeline.
 * dryRun defaults true. apply requires dryRun === false.
 */
export async function runCatalogIngestion(
  options: IngestionEngineOptions,
): Promise<IngestionEngineResult> {
  const dryRun = options.dryRun !== false;
  const apply = Boolean(options.apply);

  if (apply && dryRun) {
    throw new Error(
      "Apply guard: catalog ingest --apply requires dryRun=false (explicit apply intent).",
    );
  }

  const startedAt = new Date().toISOString();
  const id = options.runId ?? runIdNow();
  const safe: ClassifiedIngestRecord[] = [];
  const review: ClassifiedIngestRecord[] = [];
  const rejected: ClassifiedIngestRecord[] = [];
  const conflicts: ClassifiedIngestRecord[] = [];
  const skippedCategoryIds: string[] = [];
  const notes: string[] = [];
  let discovered = 0;
  let skippedPolicy = 0;
  const seenCanonical = new Map<string, string>();
  const adapterIdsUsed = new Set<string>();

  for (const categoryId of options.categoryIds) {
    const profile = resolveKnowledgeProfile({ categoryId });
    if (profile.externalPolicy === "DISABLED") {
      skippedCategoryIds.push(categoryId);
      skippedPolicy += 1;
      notes.push(`Policy DISABLED — skip external adapters for ${categoryId}`);
      continue;
    }

    const ctx: SourceAdapterContext = {
      categoryId,
      policy: profile.externalPolicy,
      dryRun,
    };

    for (const adapter of options.adapters) {
      if (!adapterAllowed(adapter, categoryId, profile.externalPolicy)) {
        continue;
      }
      adapterIdsUsed.add(adapter.id);
      const rows = await Promise.resolve(adapter.discover(ctx));
      discovered += rows.length;

      for (const record of rows) {
        // DISCOVERY_ONLY never auto-SAFE
        const forceDiscoveryReview =
          profile.externalPolicy === "DISCOVERY_ONLY";

        const validation = validateRecord(record);
        const conflict = detectConflicts(record, seenCanonical);
        const critical =
          record.kind === "relation" ||
          Boolean(record.payload.compatibility);

        let classified = classifyIngestRecord({
          record,
          validation,
          conflict,
          duplicate: conflict.duplicate,
          orphan: Boolean(record.payload.orphan),
          ambiguous: Boolean(record.payload.ambiguous),
          criticalCompatibility: critical,
        });

        if (forceDiscoveryReview && classified.classification === "SAFE") {
          classified = {
            ...classified,
            classification: "REVIEW",
            reasons: [...classified.reasons, "LOW_CONFIDENCE"],
          };
        }

        if (classified.classification === "SAFE") safe.push(classified);
        else if (classified.classification === "REVIEW") {
          review.push(classified);
          if (conflict.hasConflict) conflicts.push(classified);
        } else rejected.push(classified);
      }
    }
  }

  const finishedAt = new Date().toISOString();
  const report = {
    runId: id,
    dryRun,
    applied: apply && !dryRun,
    startedAt,
    finishedAt,
    categoryIds: options.categoryIds,
    adapterIds: [...adapterIdsUsed],
    counts: {
      discovered,
      safe: safe.length,
      review: review.length,
      rejected: rejected.length,
      skippedPolicy,
    },
    notes,
  };

  let artifactDir: string | undefined;
  const shouldWrite =
    options.writeArtifacts === true || (apply && !dryRun);

  if (shouldWrite) {
    const root = options.runsRoot ?? defaultRunsRoot();
    artifactDir = path.join(root, id);
    mkdirSync(artifactDir, { recursive: true });
    writeFileSync(
      path.join(artifactDir, "report.json"),
      JSON.stringify(report, null, 2),
      "utf8",
    );
    writeFileSync(
      path.join(artifactDir, "safe-delta.json"),
      JSON.stringify(safe, null, 2),
      "utf8",
    );
    writeFileSync(
      path.join(artifactDir, "review.json"),
      JSON.stringify(review, null, 2),
      "utf8",
    );
    writeFileSync(
      path.join(artifactDir, "rejected.json"),
      JSON.stringify(rejected, null, 2),
      "utf8",
    );
    writeFileSync(
      path.join(artifactDir, "conflicts.json"),
      JSON.stringify(conflicts, null, 2),
      "utf8",
    );
    notes.push(`Artifacts written to ${artifactDir}`);
  } else if (dryRun) {
    notes.push("Dry-run: production catalog unchanged; no artifacts written.");
  }

  // Foundation: even with apply, we do NOT mutate data/catalogs/** yet.
  if (apply && !dryRun) {
    notes.push(
      "Apply mode: delta artifacts only. Production catalog datasets not mutated in V1 foundation.",
    );
  }

  return {
    report: { ...report, notes },
    safe,
    review,
    rejected,
    conflicts,
    skippedCategoryIds,
    artifactDir,
  };
}

/** Categories that would invoke adapters under ingest-all dry-run. */
export function categoriesEligibleForExternalIngest(
  categoryIds: string[],
): {
  eligible: string[];
  skippedDisabled: string[];
} {
  const eligible: string[] = [];
  const skippedDisabled: string[] = [];
  for (const categoryId of categoryIds) {
    const policy = resolveKnowledgeProfile({ categoryId }).externalPolicy;
    if (policy === "DISABLED") skippedDisabled.push(categoryId);
    else eligible.push(categoryId);
  }
  return { eligible, skippedDisabled };
}
