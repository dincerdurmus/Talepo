/**
 * Load master taxonomy JSON from data/taxonomy (repo root).
 * Static imports only — client-safe (no node:fs).
 */

import manifestJson from "../../../../../data/taxonomy/manifest.json";
import printing from "../../../../../data/taxonomy/printing/products.json";
import furniture from "../../../../../data/taxonomy/furniture/products.json";
import appliances from "../../../../../data/taxonomy/appliances/products.json";
import technology from "../../../../../data/taxonomy/technology/products.json";
import machinery from "../../../../../data/taxonomy/machinery/machines.json";
import homeKitchen from "../../../../../data/taxonomy/home-kitchen/products.json";
import realEstate from "../../../../../data/taxonomy/real-estate/property.json";
import services from "../../../../../data/taxonomy/services/services.json";
import health from "../../../../../data/taxonomy/health/products.json";
import baby from "../../../../../data/taxonomy/baby/products.json";
import automotiveSpare from "../../../../../data/taxonomy/automotive/spare-parts.json";

import type { TaxonomyFile, TaxonomyManifest, TaxonomyNode } from "./types";

const DOMAIN_FILES: TaxonomyFile[] = [
  printing as TaxonomyFile,
  furniture as TaxonomyFile,
  appliances as TaxonomyFile,
  technology as TaxonomyFile,
  machinery as TaxonomyFile,
  homeKitchen as TaxonomyFile,
  realEstate as TaxonomyFile,
  services as TaxonomyFile,
  health as TaxonomyFile,
  baby as TaxonomyFile,
  automotiveSpare as TaxonomyFile,
];

/** Kept for API compatibility; data is bundled via static imports. */
export function resolveTaxonomyRoot(): string | null {
  return "data/taxonomy";
}

export function loadTaxonomyManifest(_root?: string | null): TaxonomyManifest | null {
  return manifestJson as TaxonomyManifest;
}

function normalizeNode(node: TaxonomyNode): TaxonomyNode {
  return {
    ...node,
    aliases: node.aliases ?? [],
    searchTerms: node.searchTerms ?? [],
    applicableCapabilities: node.applicableCapabilities ?? [],
    status: node.status ?? "active",
  };
}

export function loadAllTaxonomyNodes(_root?: string | null): TaxonomyNode[] {
  const nodes: TaxonomyNode[] = [];
  const seen = new Set<string>();

  for (const file of DOMAIN_FILES) {
    const list = Array.isArray(file) ? file : file.nodes ?? [];
    for (const node of list) {
      if (!node?.id || seen.has(node.id)) continue;
      seen.add(node.id);
      nodes.push(normalizeNode(node));
    }
  }

  return nodes;
}
