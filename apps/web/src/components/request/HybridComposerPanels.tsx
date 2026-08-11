"use client";

import { ChevronRight, FolderTree } from "lucide-react";

import type { BrowseNode } from "@/lib/knowledge/types";
import type { BrowsePathStep } from "@/lib/request-composer";
import type {
  BrowseWalkState,
  QuickSelectGroup,
  UnderstoodFact,
} from "@/lib/request-composer/ui-helpers";

type UnderstoodProps = {
  facts: UnderstoodFact[];
  categoryLabel?: string | null;
  degraded?: boolean;
  hasText: boolean;
};

/** Subtle “Talepo ne anladı?” under/beside the composer. */
export function HybridUnderstoodPanel({
  facts,
  categoryLabel,
  degraded,
  hasText,
}: UnderstoodProps) {
  if (!hasText) return null;
  if (degraded) {
    return (
      <div className="mt-3 rounded-xl border border-teal-900/8 bg-[#f7faf9]/80 px-3.5 py-2.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-teal-800/40">
          Talepo ne anladı?
        </p>
        <p className="mt-1 text-sm text-teal-950/50">
          Yazınız korunuyor — kategori paneli şu an sınırlı.
        </p>
      </div>
    );
  }
  if (facts.length === 0 && !categoryLabel) return null;

  return (
    <div className="mt-3 rounded-xl border border-[#0f766e]/14 bg-[#f0fdfa]/55 px-3.5 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#0f766e]/70">
        Talepo ne anladı?
      </p>
      {categoryLabel ? (
        <p className="mt-1 text-sm font-semibold text-[#0f1f1d]">{categoryLabel}</p>
      ) : null}
      {facts.length > 0 ? (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {facts.map((fact) => (
            <li
              key={fact.key}
              className="rounded-full border border-teal-900/10 bg-white/90 px-2.5 py-1 text-[11px] text-teal-950/75"
            >
              <span className="text-teal-950/45">{fact.label}: </span>
              {fact.displayValue}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type PathProps = {
  path: BrowsePathStep[];
  degraded?: boolean;
  onEditBrandAny?: () => void;
  allowBrandEdit?: boolean;
};

/** Live category path breadcrumbs/chips. */
export function HybridBrowsePath({
  path,
  degraded,
  onEditBrandAny,
  allowBrandEdit,
}: PathProps) {
  if (degraded || path.length === 0) return null;

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1 text-[12px] text-teal-950/60">
      {path.map((step, index) => {
        const isBrandAny = step.id === "any:brand" || step.label === "Farketmez";
        const clickable = Boolean(allowBrandEdit && isBrandAny && onEditBrandAny);
        return (
          <span key={`${step.id}-${index}`} className="inline-flex items-center gap-1">
            {index > 0 ? (
              <ChevronRight className="h-3 w-3 shrink-0 text-teal-900/25" aria-hidden />
            ) : null}
            {clickable ? (
              <button
                type="button"
                onClick={onEditBrandAny}
                className="rounded-md border border-dashed border-[#0f766e]/25 bg-white/80 px-1.5 py-0.5 font-medium text-[#0f766e] transition hover:bg-[#f0fdfa]"
              >
                {step.kind === "brand" ? `Marka: ${step.label}` : step.label}
              </button>
            ) : (
              <span
                className={
                  isBrandAny
                    ? "rounded-md bg-white/80 px-1.5 py-0.5 font-medium text-[#0f766e]"
                    : "font-medium text-teal-950/70"
                }
              >
                {step.label}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

type QuickProps = {
  groups: QuickSelectGroup[];
  onSelect: (fieldKey: string, value: string, isAny?: boolean) => void;
};

export function HybridQuickSelectChips({ groups, onSelect }: QuickProps) {
  if (groups.length === 0) return null;

  return (
    <div className="mt-3 space-y-2.5 border-t border-teal-900/6 pt-3">
      {groups.map((group) => (
        <div key={group.fieldKey}>
          <p className="text-[11px] font-medium text-teal-950/40">{group.label}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {group.options.map((opt) => (
              <button
                key={`${group.fieldKey}-${opt.value}`}
                type="button"
                onClick={() => onSelect(group.fieldKey, opt.value, opt.isAny)}
                className="rounded-full border border-teal-900/10 bg-white px-3 py-1.5 text-xs font-medium text-teal-950/75 transition hover:border-[#0f766e]/25 hover:bg-[#f0fdfa] hover:text-[#0f1f1d]"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

type BrowsePanelProps = {
  open: boolean;
  onToggle: () => void;
  walk: BrowseWalkState;
  options: BrowseNode[];
  degraded?: boolean;
  onSelect: (node: BrowseNode) => void;
  onBack: () => void;
  onReset: () => void;
};

/** Secondary “Kategoriden seç” panel — same CanonicalRequestState. */
export function HybridCategoryBrowsePanel({
  open,
  onToggle,
  walk,
  options,
  degraded,
  onSelect,
  onBack,
  onReset,
}: BrowsePanelProps) {
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-950/50 transition hover:text-[#0f766e]"
      >
        <FolderTree className="h-3.5 w-3.5" aria-hidden />
        {open ? "Kategori seçimini gizle" : "Kategoriden seç"}
      </button>

      {open ? (
        <div className="mt-2 rounded-xl border border-teal-900/8 bg-[#fafcfb] p-3">
          {degraded ? (
            <p className="text-sm text-teal-950/50">
              Kategori paneli geçici olarak sınırlı. Yazmaya devam edebilirsiniz.
            </p>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {walk.stack.length > 0 ? (
                  <button
                    type="button"
                    onClick={onBack}
                    className="text-[11px] font-medium text-[#0f766e]"
                  >
                    ← Geri
                  </button>
                ) : null}
                {walk.stack.length > 0 ? (
                  <button
                    type="button"
                    onClick={onReset}
                    className="text-[11px] text-teal-950/40"
                  >
                    Başa dön
                  </button>
                ) : null}
                <p className="min-w-0 flex-1 truncate text-[11px] text-teal-950/40">
                  {walk.stack.length === 0
                    ? "Ana kategoriler"
                    : walk.stack.map((n) => n.label).join(" › ")}
                </p>
              </div>
              <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto sm:max-h-56">
                {options.length === 0 ? (
                  <p className="text-sm text-teal-950/45">Bu seviyede seçenek yok.</p>
                ) : (
                  options.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => onSelect(node)}
                      className="rounded-full border border-teal-900/10 bg-white px-3 py-1.5 text-left text-xs font-medium text-teal-950/75 transition hover:border-[#0f766e]/25 hover:bg-[#f0fdfa]"
                    >
                      {node.label}
                      {node.meta?.any ? "" : node.hasChildren ? " ›" : ""}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

type DebugProps = {
  snapshot: {
    syncGeneration: number;
    lastUserAction?: string;
    pathIds: string[];
    nextKeys: string[];
    lastComposedText?: string;
  } | null;
};

/** Dev-only tiny drawer — never rendered in production builds. */
export function HybridComposerDebugDrawer({ snapshot }: DebugProps) {
  if (process.env.NODE_ENV !== "development" || !snapshot) return null;

  return (
    <details className="mt-3 rounded-lg border border-dashed border-amber-700/25 bg-amber-50/40 px-3 py-2 text-[11px] text-amber-950/70">
      <summary className="cursor-pointer font-medium text-amber-900/60">
        Hybrid debug
      </summary>
      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all">
        {JSON.stringify(snapshot, null, 2)}
      </pre>
    </details>
  );
}
