/**
 * Bridge taxonomy leaves → knowledge request-schema fields.
 */

import { resolveRequestSchema } from "@/lib/knowledge/request-schema";
import type { KnowledgeField } from "@/lib/knowledge/types";

import { getTaxonomyNode, resolveSchemaIdForNode } from "./registry";
import type { TaxonomyNode } from "./types";

export function getRequestSchemaForNode(nodeId: string): {
  node: TaxonomyNode;
  schemaId: string;
  fields: KnowledgeField[];
} | null {
  const node = getTaxonomyNode(nodeId);
  if (!node) return null;
  const schemaId = resolveSchemaIdForNode(nodeId);
  if (!schemaId) return null;

  const [categoryId, ...rest] = schemaId.split("/");
  const subcategorySlug = rest.length ? rest.join("/") : undefined;
  const resolved = resolveRequestSchema({
    categoryId: categoryId!,
    subcategorySlug,
  });

  return { node, schemaId, fields: resolved.fields };
}
