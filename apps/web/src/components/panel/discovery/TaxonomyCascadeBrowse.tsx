"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import {
  ensureTaxonomyLoaded,
  getRootTaxonomyNodes,
  getTaxonomyChildren,
  getTaxonomyNode,
  isTaxonomyLeaf,
  type TaxonomyNode,
} from "@/lib/taxonomy";

export type TaxonomyCascadeBrowseProps = {
  selectedNodeId?: string | null;
  onSelect: (node: TaxonomyNode, leafExact: boolean) => void;
};

function nodeLabel(node: TaxonomyNode): string {
  return node.canonicalName || node.id.split(":").pop() || node.id;
}

export function TaxonomyCascadeBrowse({
  selectedNodeId,
  onSelect,
}: TaxonomyCascadeBrowseProps) {
  ensureTaxonomyLoaded();

  const selectedPath = useMemo(() => {
    if (!selectedNodeId) return [] as TaxonomyNode[];
    const chain: TaxonomyNode[] = [];
    let cur = getTaxonomyNode(selectedNodeId);
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      chain.push(cur);
      cur = cur.parentId ? getTaxonomyNode(cur.parentId) : undefined;
    }
    return chain.reverse();
  }, [selectedNodeId]);

  const [stack, setStack] = useState<TaxonomyNode[]>(selectedPath);

  const columns = useMemo(() => {
    const cols: TaxonomyNode[][] = [getRootTaxonomyNodes()];
    for (const node of stack) {
      const kids = getTaxonomyChildren(node.id);
      if (kids.length === 0) break;
      cols.push(kids);
    }
    return cols;
  }, [stack]);

  function selectAtColumn(columnIndex: number, node: TaxonomyNode) {
    const nextStack = [...stack.slice(0, columnIndex), node];
    setStack(nextStack);
    const leafExact = isTaxonomyLeaf(node) && getTaxonomyChildren(node.id).length === 0;
    onSelect(node, leafExact);
  }

  return (
    <div className="rounded-2xl border border-teal-900/10 bg-white">
      <div className="border-b border-teal-900/8 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-800/60">
          Kategori keşfi
        </p>
        <p className="mt-1 text-sm text-teal-950/55">
          Master Taxonomy — adım adım seçin
        </p>
      </div>

      {stack.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1 border-b border-teal-900/6 px-4 py-2 text-xs text-teal-900/70">
          {stack.map((n, i) => (
            <span key={n.id} className="inline-flex items-center gap-1">
              {i > 0 ? <ChevronRight className="h-3 w-3 opacity-40" /> : null}
              <button
                type="button"
                className="font-medium hover:underline"
                onClick={() => {
                  const next = stack.slice(0, i + 1);
                  setStack(next);
                  const node = next[next.length - 1]!;
                  onSelect(
                    node,
                    isTaxonomyLeaf(node) &&
                      getTaxonomyChildren(node.id).length === 0,
                  );
                }}
              >
                {nodeLabel(n)}
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex max-h-[340px] overflow-x-auto">
        {columns.map((col, colIndex) => (
          <ul
            key={`col-${colIndex}`}
            className="min-w-[160px] max-w-[200px] flex-1 overflow-y-auto border-r border-teal-900/6 last:border-r-0"
            role="listbox"
            aria-label={colIndex === 0 ? "Kök kategoriler" : `Seviye ${colIndex + 1}`}
          >
            {col.map((node) => {
              const selected = stack[colIndex]?.id === node.id;
              return (
                <li key={node.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => selectAtColumn(colIndex, node)}
                    className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition ${
                      selected
                        ? "bg-teal-900 text-white"
                        : "text-teal-950/80 hover:bg-teal-50"
                    }`}
                  >
                    <span className="truncate">{nodeLabel(node)}</span>
                    {getTaxonomyChildren(node.id).length > 0 ? (
                      <ChevronRight
                        className={`h-3.5 w-3.5 shrink-0 ${
                          selected ? "opacity-80" : "opacity-35"
                        }`}
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ))}
      </div>
    </div>
  );
}
