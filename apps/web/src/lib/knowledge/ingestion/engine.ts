/**
 * Generic Catalog Ingestion Engine — dry-run first, apply explicit.
 * Does not mutate production catalog JSON unless apply === true (still
 * foundation-only: apply writes run artifacts + delta, not live datasets yet).
 *
 * V2: LIVE vs FIXTURE vs CACHE accounting. Fixtures never count as LIVE SAFE.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { resolveKnowledgeProfile } from "../profile-registry";
import type {
  ClassifiedIngestRecord,
  IngestRecord,
  IngestRejectReason,
  IngestSourceMode,
} from "../types";
import {
  createEmptyGenericIndex,
  mapIngestRecord,
  registerGenericEntity,
} from "./canonical-mapper";
import { classifyIngestRecord } from "./classifier";
import { automotiveTransmissionCoverageStats } from "@/lib/catalog/automotive/indexes";

import { buildCoverageBefore } from "./coverage";
import {
  buildCoverageMatrix,
  mergeCoverageMatrices,
} from "./coverage-matrix";
import {
  DEFAULT_REGIONAL_ALIASES,
  mergeMultiSourceRecords,
} from "./multi-source-merge";
import {
  normalizeIngestRecord,
  toCanonicalCandidate,
} from "./normalize";
import type { MergeConflict } from "./multi-source-merge";
import type {
  AdapterDiscoverResult,
  AdapterRunStats,
  IngestionEngineOptions,
  IngestionEngineResult,
  NormalizeResult,
  SourceAdapter,
  SourceAdapterContext,
} from "./types";

function defaultRunsRoot(): string {
  return path.resolve(process.cwd(), "../../data/catalog-ingestion/runs");
}

function defaultStateRoot(): string {
  return path.resolve(process.cwd(), "../../data/catalog-ingestion/state");
}

function runIdNow(): string {
  const d = new Date();
  const stamp = d.toISOString().replace(/[:.]/g, "-");
  return `run-${stamp}`;
}

function resolveSourceMode(record: IngestRecord): IngestSourceMode {
  if (record.sourceMode) return record.sourceMode;
  return "OFFLINE_FIXTURE";
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
  if (record.payload.outOfScope === true) reasons.push("OUT_OF_SCOPE");
  if (record.payload.variantExplosion === true) {
    reasons.push("VARIANT_EXPLOSION");
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
  const cats = adapter.supportedCategories?.length
    ? adapter.supportedCategories
    : adapter.supportedCategoryIds;
  if (!cats.includes(categoryId)) return false;
  if (policy === "DISCOVERY_ONLY") return true;
  if (policy === "SELECTIVE") return true;
  if (policy === "REQUIRED") return true;
  return false;
}

function normalizeDiscoverResult(
  raw: AdapterDiscoverResult | IngestRecord[],
): AdapterDiscoverResult {
  if (Array.isArray(raw)) {
    return {
      records: raw,
      accessStatus: "AVAILABLE",
      fetchAttempts: 0,
    };
  }
  return raw;
}

function writeJson(dir: string, name: string, data: unknown): void {
  writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2), "utf8");
}

/**
 * Run ingestion pipeline.
 * dryRun defaults true. apply requires dryRun === false.
 * Default developer path prefers LIVE network; use allowNetwork=false / --offline for CI fixtures.
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
  const discoveredRaw: IngestRecord[] = [];
  const normalizedRows: NormalizeResult[] = [];
  const adapterStats: AdapterRunStats[] = [];
  let discovered = 0;
  let skippedPolicy = 0;
  let existingMapped = 0;
  let newCandidates = 0;
  let outOfScope = 0;
  let fetchAttemptsTotal = 0;
  let liveSourceRecords = 0;
  let fixtureRecords = 0;
  let cacheRecords = 0;
  let liveSafe = 0;
  let liveReview = 0;
  const seenCanonical = new Map<string, string>();
  const adapterIdsUsed = new Set<string>();
  const genericIndex = createEmptyGenericIndex();
  const coverageBefore = buildCoverageBefore(options.categoryIds);
  let failedAdapters = 0;
  let calledAdapters = 0;
  const matrixRows: ReturnType<typeof buildCoverageMatrix> = [];
  const multiSourceConflicts: MergeConflict[] = [];

  for (const categoryId of options.categoryIds) {
    const profile = resolveKnowledgeProfile({
      categoryId,
      subcategorySlug: options.subcategorySlug,
    });
    if (profile.externalPolicy === "DISABLED") {
      skippedCategoryIds.push(categoryId);
      skippedPolicy += 1;
      notes.push(`Policy DISABLED — skip external adapters for ${categoryId}`);
      for (const adapter of options.adapters) {
        const cats = adapter.supportedCategories?.length
          ? adapter.supportedCategories
          : adapter.supportedCategoryIds;
        if (!cats.includes(categoryId)) continue;
        adapterStats.push({
          adapterId: adapter.adapterId ?? adapter.id,
          categoryId,
          accessStatus: "AVAILABLE",
          fetchAttempts: 0,
          discovered: 0,
          notes: ["DISABLED_POLICY_GUARD: discover() not called"],
        });
      }
      continue;
    }

    const ctx: SourceAdapterContext = {
      categoryId,
      subcategorySlug: options.subcategorySlug ?? profile.subcategorySlug,
      policy: profile.externalPolicy,
      dryRun,
      limit: options.limit,
      sourceFilter: options.sourceFilter,
      entityFilter: options.entityFilter ?? null,
      allowNetwork: options.allowNetwork !== false,
      discoveryMode: options.discoveryMode ?? "FULL_DISCOVERY",
    };

    const categoryRaw: IngestRecord[] = [];

    for (const adapter of options.adapters) {
      if (options.sourceFilter) {
        const aid = adapter.adapterId ?? adapter.id;
        if (aid !== options.sourceFilter && adapter.id !== options.sourceFilter) {
          continue;
        }
      }
      if (!adapterAllowed(adapter, categoryId, profile.externalPolicy)) {
        continue;
      }

      const adapterId = adapter.adapterId ?? adapter.id;
      adapterIdsUsed.add(adapterId);
      calledAdapters += 1;

      let result: AdapterDiscoverResult;
      try {
        result = normalizeDiscoverResult(
          await Promise.resolve(adapter.discover(ctx)),
        );
      } catch (err) {
        failedAdapters += 1;
        const message = err instanceof Error ? err.message : String(err);
        adapterStats.push({
          adapterId,
          categoryId,
          accessStatus: "FAILED",
          fetchAttempts: 0,
          discovered: 0,
          errorMessage: message,
        });
        notes.push(`Adapter ${adapterId} FAILED on ${categoryId}: ${message}`);
        continue;
      }

      fetchAttemptsTotal += result.fetchAttempts;
      if (
        result.accessStatus === "FAILED" ||
        result.accessStatus === "SOURCE_UNAVAILABLE" ||
        result.accessStatus === "RATE_LIMITED" ||
        result.accessStatus === "ACCESS_BLOCKED" ||
        result.accessStatus === "MANUAL_REVIEW_REQUIRED"
      ) {
        if (result.accessStatus === "FAILED") failedAdapters += 1;
        notes.push(
          `Adapter ${adapterId} access=${result.accessStatus}` +
            (result.errorMessage ? `: ${result.errorMessage}` : ""),
        );
      }

      adapterStats.push({
        adapterId,
        categoryId,
        accessStatus: result.accessStatus,
        fetchAttempts: result.fetchAttempts,
        discovered: result.records.length,
        errorMessage: result.errorMessage,
        notes: result.notes,
        sourceFingerprint: result.sourceFingerprint,
      });

      if (result.sourceFingerprint && options.writeArtifacts !== false) {
        try {
          const stateRoot = options.stateRoot ?? defaultStateRoot();
          mkdirSync(stateRoot, { recursive: true });
          writeJson(stateRoot, `${adapterId}.json`, {
            adapterId,
            categoryId,
            sourceFingerprint: result.sourceFingerprint,
            lastRunId: id,
            updatedAt: new Date().toISOString(),
            discoveryMode: ctx.discoveryMode,
          });
        } catch {
          // non-fatal
        }
      }

      for (const raw of result.records) {
        const mode = resolveSourceMode(raw);
        categoryRaw.push({ ...raw, sourceMode: mode });
      }
    }

    const mergeResult = mergeMultiSourceRecords(categoryRaw, {
      aliasMaps: DEFAULT_REGIONAL_ALIASES,
    });
    if (mergeResult.conflicts.length) {
      multiSourceConflicts.push(...mergeResult.conflicts);
      notes.push(
        `${categoryId} SOURCE_CONFLICT groups=${mergeResult.conflicts.length}`,
      );
    }
    if (mergeResult.aliasResolved) {
      notes.push(
        `${categoryId} regionalAliasesResolved=${mergeResult.aliasResolved}`,
      );
    }

    discovered += mergeResult.merged.length;

    const discoveredByType: Record<string, number> = {};
    const reviewByType: Record<string, number> = {};

    for (const raw of mergeResult.merged) {
      const mode = resolveSourceMode(raw);
      if (mode === "LIVE") liveSourceRecords += 1;
      else if (mode === "CACHE") cacheRecords += 1;
      else fixtureRecords += 1;

      discoveredRaw.push(raw);
      const normalized = normalizeIngestRecord(raw);
      const mapped = mapIngestRecord(normalized.record, genericIndex);
      const candidate = toCanonicalCandidate(normalized, {
        existingCanonicalId: mapped.canonicalId,
        matchStatus: mapped.status,
      });
      candidate.record.sourceMode = mode;
      normalizedRows.push(candidate);

      const kindKey = String(candidate.record.kind);
      discoveredByType[kindKey] = (discoveredByType[kindKey] ?? 0) + 1;

      if (mapped.status === "EXISTING") existingMapped += 1;
      if (mapped.status === "NEW_CANDIDATE") newCandidates += 1;
      if (mapped.status === "OUT_OF_SCOPE") outOfScope += 1;

      if (mapped.status === "NEW_CANDIDATE") {
        registerGenericEntity(genericIndex, {
          id: candidate.record.id,
          brand:
            typeof candidate.record.payload.brand === "string"
              ? candidate.record.payload.brand
              : undefined,
          model:
            typeof candidate.record.payload.model === "string"
              ? candidate.record.payload.model
              : undefined,
          family:
            typeof candidate.record.payload.family === "string"
              ? candidate.record.payload.family
              : typeof candidate.record.payload.productFamily === "string"
                ? candidate.record.payload.productFamily
                : undefined,
          categoryId: candidate.record.categoryId,
          aliases: Array.isArray(candidate.record.payload.aliases)
            ? (candidate.record.payload.aliases as string[])
            : undefined,
        });
      }

      const forceDiscoveryReview =
        profile.externalPolicy === "DISCOVERY_ONLY";

      const validation = validateRecord(candidate.record);
      if (mapped.status === "OUT_OF_SCOPE") {
        validation.reasons.push("OUT_OF_SCOPE");
        validation.ok = false;
      }
      if (mapped.reasons?.length) {
        for (const r of mapped.reasons) {
          if (!validation.reasons.includes(r)) validation.reasons.push(r);
        }
      }

      const conflict = detectConflicts(candidate.record, seenCanonical);
      if (candidate.record.payload.sourceConflict === true) {
        conflict.hasConflict = true;
        if (!conflict.reasons.includes("SOURCE_CONFLICT")) {
          conflict.reasons.push("SOURCE_CONFLICT");
        }
      }

      if (mapped.status === "EXISTING" && !conflict.hasConflict) {
        if (
          candidate.record.provenance.sourceType === "MARKETPLACE" ||
          candidate.record.payload.discoveryOnly === true
        ) {
          candidate.record.payload.matchExisting = mapped.canonicalId;
        }
      }

      const critical =
        candidate.record.kind === "relation" ||
        Boolean(candidate.record.payload.compatibility) ||
        candidate.record.payload.gapType === "transmission" ||
        candidate.record.payload.gapType === "engine" ||
        candidate.record.payload.requiresOfficialCorroboration === true;

      let classified = classifyIngestRecord({
        record: candidate.record,
        validation: {
          ok: validation.ok && !validation.reasons.includes("OUT_OF_SCOPE"),
          reasons: validation.reasons,
        },
        conflict,
        duplicate: conflict.duplicate,
        orphan: Boolean(candidate.record.payload.orphan),
        ambiguous:
          Boolean(candidate.record.payload.ambiguous) ||
          mapped.status === "AMBIGUOUS",
        criticalCompatibility: critical,
      });

      if (forceDiscoveryReview && classified.classification === "SAFE") {
        classified = {
          ...classified,
          classification: "REVIEW",
          reasons: [...classified.reasons, "LOW_CONFIDENCE"],
        };
      }

      if (
        mapped.status === "EXISTING" &&
        classified.classification === "SAFE" &&
        (candidate.record.payload.discoveryOnly === true ||
          candidate.record.payload.gapMetric === true ||
          candidate.record.provenance.sourceType === "MARKETPLACE")
      ) {
        classified = {
          ...classified,
          classification: "REVIEW",
          reasons: Array.from(
            new Set<IngestRejectReason>([
              ...classified.reasons,
              "POSSIBLE_DUPLICATE",
            ]),
          ),
        };
      }

      if (candidate.record.payload.gapMetric === true) {
        classified = {
          ...classified,
          classification: "REVIEW",
          reasons: Array.from(
            new Set<IngestRejectReason>([
              ...classified.reasons,
              "LOW_CONFIDENCE",
            ]),
          ),
        };
      }

      if (
        candidate.record.payload.wikidataSole === true &&
        classified.classification === "SAFE"
      ) {
        classified = {
          ...classified,
          classification: "REVIEW",
          reasons: Array.from(
            new Set<IngestRejectReason>([
              ...classified.reasons,
              "MARKETPLACE_INSUFFICIENT_AUTHORITY",
            ]),
          ),
        };
      }

      // V2C SAFE gates for TX/engine: never SAFE codes without OFFICIAL;
      // unknown/ambiguous family → REVIEW; marketplace sole never SAFE.
      if (
        classified.classification === "SAFE" &&
        (candidate.record.payload.gapType === "transmission" ||
          candidate.record.payload.gapType === "engine")
      ) {
        const family = String(
          candidate.record.payload.transmissionFamily ?? "",
        ).toUpperCase();
        const hasCode =
          candidate.record.payload.transmissionCode != null ||
          candidate.record.payload.engineCode != null;
        const src = candidate.record.provenance.sourceType;
        const authoritative =
          src === "TRUSTED_DATASET" ||
          src === "OFFICIAL_MANUFACTURER" ||
          src === "OFFICIAL_EPC" ||
          src === "LICENSED_CATALOG" ||
          src === "OFFICIAL_DISTRIBUTOR" ||
          src === "STANDARDS_BODY";
        const oemOfficial =
          src === "OFFICIAL_MANUFACTURER" ||
          src === "OFFICIAL_EPC" ||
          src === "LICENSED_CATALOG";
        const genOk = Boolean(candidate.record.payload.generationId);
        const unknownFamily =
          candidate.record.payload.gapType === "transmission" &&
          (family === "" || family === "UNKNOWN" || family === "OTHER");
        if (
          !authoritative ||
          !genOk ||
          unknownFamily ||
          candidate.record.payload.ambiguous === true ||
          (hasCode && !oemOfficial)
        ) {
          classified = {
            ...classified,
            classification: "REVIEW",
            reasons: Array.from(
              new Set<IngestRejectReason>([
                ...classified.reasons,
                hasCode && !oemOfficial
                  ? "MARKETPLACE_INSUFFICIENT_AUTHORITY"
                  : "LOW_CONFIDENCE",
              ]),
            ),
          };
        }
      }

      classified.sourceMode = mode;

      if (classified.classification === "SAFE") {
        safe.push(classified);
        if (mode === "LIVE") liveSafe += 1;
      } else if (classified.classification === "REVIEW") {
        review.push(classified);
        reviewByType[kindKey] = (reviewByType[kindKey] ?? 0) + 1;
        if (mode === "LIVE") liveReview += 1;
        if (conflict.hasConflict || candidate.record.payload.sourceConflict) {
          conflicts.push(classified);
        }
      } else rejected.push(classified);
    }

    const before = coverageBefore[categoryId];
    matrixRows.push(
      ...buildCoverageMatrix({
        domain: categoryId,
        known: {
          brand: before?.knownBrands ?? 0,
          model: before?.knownModels ?? 0,
          generation: before?.knownGenerations ?? 0,
          engine: before?.knownEngines ?? 0,
          transmission: before?.knownTransmissions ?? 0,
          family: before?.knownFamilies ?? 0,
        },
        discovered: discoveredByType,
        review: reviewByType,
        verified: {},
        gaps: {
          transmission:
            categoryId === "automotive"
              ? Math.max(
                  0,
                  (before?.knownModels ?? 0) - (before?.knownTransmissions ?? 0),
                )
              : 0,
        },
        notes:
          categoryId === "automotive"
            ? {
                transmission: [
                  "Production transmission catalog empty — gap reported without inventing codes.",
                ],
              }
            : undefined,
      }),
    );
  }

  const finishedAt = new Date().toISOString();
  let status: IngestionEngineResult["status"] = "SUCCESS";
  if (failedAdapters > 0 && (safe.length > 0 || review.length > 0 || discovered > 0)) {
    status = "PARTIAL_SUCCESS";
  } else if (failedAdapters > 0 && discovered === 0 && calledAdapters > 0) {
    status = "PARTIAL_SUCCESS";
  }
  const hardFails = adapterStats.filter((s) => s.accessStatus === "FAILED");
  const blocked = adapterStats.filter((s) => s.accessStatus === "ACCESS_BLOCKED");
  if (hardFails.length > 0 && hardFails.length < adapterStats.length) {
    status = "PARTIAL_SUCCESS";
  }
  if (blocked.length > 0 && (discovered > 0 || adapterStats.length > blocked.length)) {
    status = "PARTIAL_SUCCESS";
  }

  const isTx = (r: { payload?: Record<string, unknown> }) =>
    !r.payload?.mappingProbe &&
    (r.payload?.gapType === "transmission" ||
      String(r.payload?.canonicalKey ?? "").includes("|transmission|"));
  const isEng = (r: { payload?: Record<string, unknown> }) =>
    !r.payload?.mappingProbe &&
    (r.payload?.gapType === "engine" ||
      String(r.payload?.canonicalKey ?? "").includes("|engine|"));

  const liveTx = discoveredRaw.filter(
    (r) => resolveSourceMode(r) === "LIVE" && isTx(r),
  ).length;
  const liveEng = discoveredRaw.filter(
    (r) => resolveSourceMode(r) === "LIVE" && isEng(r),
  ).length;
  const fixtureTx = discoveredRaw.filter(
    (r) => resolveSourceMode(r) !== "LIVE" && isTx(r),
  ).length;
  const fixtureEng = discoveredRaw.filter(
    (r) => resolveSourceMode(r) !== "LIVE" && isEng(r),
  ).length;

  const coverageStats = options.categoryIds.includes("automotive")
    ? automotiveTransmissionCoverageStats()
    : null;

  notes.push(
    `LIVE_SOURCE_RECORDS=${liveSourceRecords}`,
    `FIXTURE_RECORDS=${fixtureRecords}`,
    `CACHE_RECORDS=${cacheRecords}`,
    `LIVE_SAFE=${liveSafe} (fixtures excluded)`,
    `LIVE_REVIEW=${liveReview}`,
    `LIVE_TRANSMISSION_RECORDS=${liveTx}`,
    `LIVE_ENGINE_RECORDS=${liveEng}`,
    `FIXTURE_TRANSMISSION_RECORDS=${fixtureTx}`,
    `FIXTURE_ENGINE_RECORDS=${fixtureEng}`,
  );

  const coverageMatrix = mergeCoverageMatrices(matrixRows);

  const report = {
    runId: id,
    dryRun,
    applied: false,
    startedAt,
    finishedAt,
    categoryIds: options.categoryIds,
    adapterIds: [...adapterIdsUsed],
    status,
    entityFilter: options.entityFilter ?? null,
    counts: {
      discovered,
      safe: safe.length,
      review: review.length,
      rejected: rejected.length,
      skippedPolicy,
      existingMapped,
      newCandidates,
      outOfScope,
      fetchAttempts: fetchAttemptsTotal,
      LIVE_SOURCE_RECORDS: liveSourceRecords,
      FIXTURE_RECORDS: fixtureRecords,
      CACHE_RECORDS: cacheRecords,
      LIVE_SAFE: liveSafe,
      LIVE_REVIEW: liveReview,
      LIVE_TRANSMISSION_RECORDS: liveTx,
      LIVE_ENGINE_RECORDS: liveEng,
      FIXTURE_TRANSMISSION_RECORDS: fixtureTx,
      FIXTURE_ENGINE_RECORDS: fixtureEng,
      newTransmissionCandidates: discoveredRaw.filter(isTx).length,
      newEngineCandidates: discoveredRaw.filter(isEng).length,
      ...(coverageStats ?? {}),
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

    const engSafe = safe.filter(isEng);
    const txSafe = safe.filter(isTx);
    const engReview = review.filter(isEng);
    const txReview = review.filter(isTx);
    const sourceConflicts = {
      classifiedConflicts: conflicts.filter((c) => isTx(c) || isEng(c)),
      multiSourceConflicts,
    };

    writeJson(artifactDir, "manifest.json", {
      runId: id,
      dryRun,
      applied: false,
      startedAt,
      finishedAt,
      categoryIds: options.categoryIds,
      adapterIds: [...adapterIdsUsed],
      status,
      limit: options.limit ?? null,
      sourceFilter: options.sourceFilter ?? null,
      entityFilter: options.entityFilter ?? null,
      allowNetwork: options.allowNetwork !== false,
      discoveryMode: options.discoveryMode ?? "FULL_DISCOVERY",
    });
    writeJson(artifactDir, "sources.json", adapterStats);
    writeJson(artifactDir, "coverage-before.json", coverageBefore);
    writeJson(artifactDir, "coverage-matrix.json", coverageMatrix);
    writeJson(artifactDir, "coverage.json", {
      before: coverageBefore,
      matrix: coverageMatrix,
      stats: coverageStats,
      live: {
        LIVE_TRANSMISSION_RECORDS: liveTx,
        LIVE_ENGINE_RECORDS: liveEng,
        FIXTURE_TRANSMISSION_RECORDS: fixtureTx,
        FIXTURE_ENGINE_RECORDS: fixtureEng,
      },
    });
    writeJson(artifactDir, "discovered-raw.json", discoveredRaw);
    writeJson(artifactDir, "normalized.json", normalizedRows);
    writeJson(artifactDir, "safe-delta.json", safe);
    writeJson(artifactDir, "review.json", review);
    writeJson(artifactDir, "rejected.json", rejected);
    writeJson(artifactDir, "conflicts.json", conflicts);
    writeJson(artifactDir, "source-conflicts.json", sourceConflicts);
    writeJson(artifactDir, "automotive-engines-safe-delta.json", engSafe);
    writeJson(artifactDir, "automotive-engines-review.json", engReview);
    writeJson(artifactDir, "automotive-transmissions-safe-delta.json", txSafe);
    writeJson(artifactDir, "automotive-transmissions-review.json", txReview);
    writeJson(artifactDir, "report.json", { ...report, notes });
    notes.push(`Artifacts written to ${artifactDir}`);
  } else if (dryRun) {
    notes.push("Dry-run: production catalog unchanged; no artifacts written.");
  }

  if (apply && !dryRun) {
    notes.push(
      "Apply requested but SourceAdapters V2 blocks production catalog mutation; artifacts/delta only.",
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
    adapterStats,
    coverageBefore,
    discoveredRaw,
    normalized: normalizedRows,
    status,
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
