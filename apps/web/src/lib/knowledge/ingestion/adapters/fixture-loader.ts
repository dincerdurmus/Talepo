import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { KnowledgeSourceType, ProvenanceRecord } from "../../types";

export type FixtureProduct = {
  id: string;
  subcategorySlug?: string;
  brand: string;
  region?: string;
  productFamily?: string;
  family?: string;
  series?: string;
  model: string;
  kind?: string;
  machineType?: string;
  outOfScope?: boolean;
  scopeReason?: string;
  specs?: Record<string, unknown>;
  variantAttributes?: Record<string, unknown>;
  compatibleProductIds?: string[];
  provenance: {
    sourceType: KnowledgeSourceType;
    sourceName: string;
    sourceRef?: string;
    retrievedAt?: string;
    confidence: "HIGH" | "MEDIUM" | "LOW";
    verificationStatus: string;
  };
};

export type FixtureFile = {
  version: string;
  domain: string;
  notes?: string;
  products: FixtureProduct[];
};

function fixtureRoots(): string[] {
  const cwd = process.cwd();
  return [
    path.resolve(cwd, "../../data/catalog-ingestion/fixtures"),
    path.resolve(cwd, "../data/catalog-ingestion/fixtures"),
    path.resolve(cwd, "data/catalog-ingestion/fixtures"),
    path.resolve(cwd, "../../../data/catalog-ingestion/fixtures"),
  ];
}

export function loadFixtureFile(domain: string): FixtureFile {
  const rel = path.join(domain, "products.json");
  for (const root of fixtureRoots()) {
    const full = path.join(root, rel);
    if (existsSync(full)) {
      return JSON.parse(readFileSync(full, "utf8")) as FixtureFile;
    }
  }
  throw new Error(`Fixture not found for domain=${domain} (${rel})`);
}

export function toProvenance(p: FixtureProduct["provenance"]): ProvenanceRecord {
  return {
    sourceType: p.sourceType,
    sourceName: p.sourceName,
    sourceRef: p.sourceRef,
    retrievedAt: p.retrievedAt,
    confidence: p.confidence,
    verificationStatus: p.verificationStatus,
  };
}
