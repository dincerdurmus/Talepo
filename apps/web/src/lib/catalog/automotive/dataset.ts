/**
 * Automotive catalog dataset — JSON files live in /data/catalogs/automotive.
 * Relative path keeps a single source of truth (no copied constants).
 *
 * From this file: src/lib/catalog/automotive → repo root is 6 levels up.
 */
import brands from "../../../../../../data/catalogs/automotive/automotive-brands.json";
import models from "../../../../../../data/catalogs/automotive/automotive-models-core.json";
import groups from "../../../../../../data/catalogs/automotive/automotive-manufacturer-groups.json";
import taxonomy from "../../../../../../data/catalogs/automotive/automotive-part-taxonomy.json";
import aliasesTr from "../../../../../../data/catalogs/automotive/automotive-part-aliases-tr.json";
import positions from "../../../../../../data/catalogs/automotive/automotive-positions.json";
import generations from "../../../../../../data/catalogs/automotive/automotive-generations.json";
import engines from "../../../../../../data/catalogs/automotive/automotive-engines.json";
import oemCrossrefs from "../../../../../../data/catalogs/automotive/automotive-oem-crossrefs.json";
import compatibility from "../../../../../../data/catalogs/automotive/automotive-compatibility.json";
import manifest from "../../../../../../data/catalogs/automotive/manifest.json";

import type {
  AutomotiveBrandRecord,
  AutomotiveEngineRecord,
  AutomotiveGenerationRecord,
  AutomotiveManufacturerGroup,
  AutomotiveModelRecord,
  AutomotivePositionRecord,
} from "./types";

export type AutomotiveTaxonomy = Record<
  string,
  {
    name_tr: string;
    children: Record<string, string[]>;
  }
>;

export type AutomotiveManifest = {
  version: string;
  counts?: Record<string, number>;
  generationCount?: number;
  engineRecordCount?: number;
  generatedAt?: string;
  files: string[];
};

export function loadAutomotiveDataset() {
  return {
    manifest: manifest as AutomotiveManifest,
    brands: brands as AutomotiveBrandRecord[],
    models: models as AutomotiveModelRecord[],
    groups: groups as AutomotiveManufacturerGroup[],
    taxonomy: taxonomy as AutomotiveTaxonomy,
    partAliases: aliasesTr as Record<string, string[]>,
    positions: positions as AutomotivePositionRecord[],
    generations: generations as AutomotiveGenerationRecord[],
    engines: engines as AutomotiveEngineRecord[],
    oemCrossrefs: oemCrossrefs as unknown[],
    compatibility: compatibility as unknown[],
  };
}
