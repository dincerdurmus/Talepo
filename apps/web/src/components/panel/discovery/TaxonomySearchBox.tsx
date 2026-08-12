"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { searchTaxonomyNodes } from "@/lib/discovery";
import { getTaxonomyNode, isTaxonomyLeaf, getTaxonomyChildren } from "@/lib/taxonomy";

type TaxonomySearchBoxProps = {
  onPick: (nodeId: string, leafExact: boolean) => void;
};

export function TaxonomySearchBox({ onPick }: TaxonomySearchBoxProps) {
  const [q, setQ] = useState("");
  const hits = useMemo(() => searchTaxonomyNodes(q, { limit: 10 }), [q]);

  return (
    <div className="relative">
      <label className="block">
        <span className="sr-only">Taxonomy ara</span>
        <span className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-900/35" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Örn. far, karton kutu, televizyon…"
            className="h-11 w-full rounded-xl border border-teal-900/10 bg-white pl-10 pr-3 text-sm outline-none focus:border-teal-600/45"
            autoComplete="off"
          />
        </span>
      </label>
      {q.trim().length >= 2 && hits.length > 0 ? (
        <ul
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-teal-900/10 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                role="option"
                className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-teal-50"
                onClick={() => {
                  const node = getTaxonomyNode(hit.id);
                  const leafExact = Boolean(
                    node &&
                      isTaxonomyLeaf(node) &&
                      getTaxonomyChildren(hit.id).length === 0,
                  );
                  onPick(hit.id, leafExact);
                  setQ("");
                }}
              >
                <span className="font-medium text-teal-950">{hit.label}</span>
                <span className="text-[11px] text-teal-950/45">
                  {hit.matchedAlias !== hit.label
                    ? `eşleşen: ${hit.matchedAlias} · `
                    : ""}
                  {hit.nodeType}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
