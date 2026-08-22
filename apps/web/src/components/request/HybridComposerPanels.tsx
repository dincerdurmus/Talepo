"use client";

import {
  Armchair,
  Baby,
  Building2,
  Car,
  ChevronRight,
  Cog,
  CookingPot,
  Cpu,
  FolderTree,
  HeartPulse,
  Printer,
  Refrigerator,
  Wrench,
  type LucideIcon,
} from "lucide-react";

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
  updating?: boolean;
  conditionConfirmationPending?: boolean;
  modelYearConfirmationPending?: boolean;
};

/** Subtle “Talepo ne anladı?” under/beside the composer. */
export function HybridUnderstoodPanel({
  facts,
  categoryLabel,
  degraded,
  hasText,
  updating,
  conditionConfirmationPending,
  modelYearConfirmationPending,
}: UnderstoodProps) {
  if (!hasText) return null;
  if (updating) {
    return (
      <div className="mt-3 rounded-xl border border-teal-900/8 bg-[#f7faf9]/80 px-3.5 py-2.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-teal-800/40">
          Talepo ne anladı?
        </p>
        <p className="mt-1 text-sm text-teal-950/55">
          Talepo talebini güncelliyor…
        </p>
      </div>
    );
  }
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
          {facts.map((fact) => {
            const awaitingConfirmation =
              (conditionConfirmationPending && fact.key === "condition") ||
              (modelYearConfirmationPending &&
                ["modelYear", "yearMin", "yearMax"].includes(fact.key));
            return (
            <li
              key={fact.key}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${awaitingConfirmation ? "border-orange-300 bg-orange-100 text-orange-800 shadow-[0_0_0_2px_rgba(251,146,60,0.08)]" : "border-[#0f766e]/25 bg-[#dff6ef] text-[#0f5f59] shadow-[0_0_0_1px_rgba(15,118,110,0.04)]"}`}
            >
              {awaitingConfirmation ? (
                fact.key === "condition"
                  ? "Durum: Onay Bekleniyor"
                  : "Model yılı: Onay Bekleniyor"
              ) : (
                <><span className="text-[#0f766e]/65">{fact.label}: </span>{fact.displayValue}</>
              )}
            </li>
          )})}
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
  // Donanım ara katmanı ağaçtan kaldırıldı — ekmek kırıntısında da görünmez.
  const visiblePath = path.filter(
    (step) => !(step.kind === "subcategory" && step.label === "Donanım"),
  );
  if (degraded || visiblePath.length === 0) return null;

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1 text-[12px] text-teal-950/60">
      {visiblePath.map((step, index) => {
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
  // Guard against accidental duplicate fieldKeys from upstream merges
  const unique: QuickSelectGroup[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    if (seen.has(group.fieldKey)) continue;
    seen.add(group.fieldKey);
    unique.push(group);
  }
  if (unique.length === 0) return null;

  return (
    <div className="mt-3 space-y-2.5 border-t border-teal-900/6 pt-3">
      {unique.map((group) => (
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
  columns: BrowseNode[][];
  degraded?: boolean;
  onSelectAtColumn: (columnIndex: number, node: BrowseNode) => void;
  onReset: () => void;
};

/** Primary “Kategoriden seç” — multi-column cascade (Talepo styling). */
/** Kök kategori ikonları — kaskadın ilk kolonu kimlikli görünsün. */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "real-estate": Building2,
  automotive: Car,
  technology: Cpu,
  appliances: Refrigerator,
  furniture: Armchair,
  printing: Printer,
  machinery: Cog,
  baby: Baby,
  "home-kitchen": CookingPot,
  health: HeartPulse,
  services: Wrench,
};

export function HybridCategoryBrowsePanel({
  open,
  onToggle,
  walk,
  columns,
  degraded,
  onSelectAtColumn,
  onReset,
}: BrowsePanelProps) {
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`group flex w-full items-center justify-between gap-3 rounded-[1.35rem] border px-4 py-3.5 text-left transition sm:px-5 ${
          open
            ? "border-[#0f766e]/30 bg-[#f7fdfb] shadow-[0_14px_40px_rgba(11,37,34,0.08)]"
            : "border-[#0f1f1d]/8 bg-white hover:border-[#0f766e]/25 hover:shadow-[0_14px_40px_rgba(11,37,34,0.08)]"
        }`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7cc4ff] via-[#0f766e] to-[#a78bfa] text-white shadow-[0_6px_18px_rgba(15,118,110,0.35)]">
            <FolderTree className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold tracking-tight text-[#0f1f1d]">
              {open ? "Kategori seçimini gizle" : "Kategoriden seç"}
            </span>
            <span className="mt-0.5 block text-xs text-[#0f1f1d]/50">
              {open
                ? "İstersen ağaçtan da ilerleyebilirsin"
                : "İsteğe bağlı — yazmak seni sınırlamaz"}
            </span>
          </span>
        </span>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${
            open
              ? "rotate-90 border-[#0f766e]/30 bg-[#e3f1f2] text-[#0f766e]"
              : "border-[#0f1f1d]/10 bg-white text-[#0f766e] group-hover:border-[#0f766e]/30 group-hover:bg-[#f0fdfa]"
          }`}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </span>
      </button>

      {open ? (
        <div className="mt-3 overflow-hidden rounded-[1.35rem] border border-[#0f1f1d]/8 bg-white shadow-[0_18px_50px_rgba(11,37,34,0.07)]">
          {degraded ? (
            <p className="p-3 text-sm text-[#0f1f1d]/50">
              Kategori paneli geçici olarak sınırlı. Yazmaya devam edebilirsiniz.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-[#0f1f1d]/6 bg-[#fafcfb] px-3.5 py-2.5">
                {walk.stack.length === 0 ? (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0f766e]/70">
                    Kategori seçin
                  </p>
                ) : (
                  <div className="flex min-w-0 flex-wrap items-center gap-1">
                    {walk.stack.map((n, i) => (
                      <span key={n.id} className="flex items-center gap-1">
                        {i > 0 ? (
                          <ChevronRight className="h-3 w-3 text-[#0f1f1d]/25" aria-hidden />
                        ) : null}
                        <span
                          className={`max-w-[10rem] truncate rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            i === walk.stack.length - 1
                              ? "bg-[#0f766e] text-white"
                              : "bg-[#e3f1f2] text-[#0f5f59]"
                          }`}
                        >
                          {n.label}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
                {walk.stack.length > 0 ? (
                  <button
                    type="button"
                    onClick={onReset}
                    className="shrink-0 rounded-full px-2 py-1 text-[11px] font-medium text-[#0f766e] hover:bg-[#e3f1f2]"
                  >
                    Başa dön
                  </button>
                ) : null}
              </div>

              <div
                className="grid max-h-72 min-w-0 overflow-hidden sm:max-h-80"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))`,
                }}
              >
                {columns.length === 0 ? (
                  <p className="p-3 text-sm text-[#0f1f1d]/45">Kategori yok.</p>
                ) : (
                  columns.map((columnNodes, columnIndex) => {
                    const selectedId = walk.stack[columnIndex]?.id ?? null;
                    const columnTitle =
                      columnIndex === 0
                        ? "Kategoriler"
                        : walk.stack[columnIndex - 1]?.label ?? "";
                    return (
                      <div
                        key={`col-${columnIndex}-${walk.stack[columnIndex - 1]?.id ?? "root"}`}
                        className="flex min-w-0 flex-col border-r border-[#0f1f1d]/5 last:border-r-0 odd:bg-[#fcfdfd]"
                      >
                        <p className="truncate border-b border-[#0f1f1d]/5 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0f1f1d]/35">
                          {columnTitle}
                        </p>
                        <ul className="max-h-72 overflow-y-auto px-1.5 py-1.5 sm:max-h-80 [scrollbar-width:thin] [scrollbar-color:rgba(15,118,110,0.25)_transparent]">
                          {columnNodes.length === 0 ? (
                            <li className="px-3 py-2 text-xs text-[#0f1f1d]/40">
                              Seçenek yok
                            </li>
                          ) : (
                            columnNodes.map((node) => {
                              const selected = selectedId === node.id;
                              const isLeafFocus =
                                selected && columnIndex === walk.stack.length - 1;
                              const CatIcon =
                                columnIndex === 0 && node.kind === "category"
                                  ? CATEGORY_ICONS[node.id] ??
                                    CATEGORY_ICONS[node.categoryId ?? ""]
                                  : undefined;
                              return (
                                <li key={node.id}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onSelectAtColumn(columnIndex, node)
                                    }
                                    className={`flex min-h-9 w-full min-w-0 items-center justify-between gap-1 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                                      isLeafFocus
                                        ? "bg-[#0f766e] font-semibold text-white shadow-[0_4px_14px_rgba(15,118,110,0.3)]"
                                        : selected
                                          ? "bg-[#e3f1f2] font-medium text-[#0f5f59]"
                                          : "text-[#0f1f1d]/75 hover:bg-[#f0fdfa] hover:text-[#0f1f1d]"
                                    }`}
                                  >
                                    <span className="flex min-w-0 items-center gap-2.5">
                                      {CatIcon ? (
                                        <span
                                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                                            selected
                                              ? "bg-white/60 text-[#0f5f59]"
                                              : "bg-[#f0f4f3] text-[#0f766e]"
                                          }`}
                                        >
                                          <CatIcon className="h-4 w-4" aria-hidden />
                                        </span>
                                      ) : null}
                                      <span className="min-w-0 truncate">
                                        {node.label}
                                      </span>
                                    </span>
                                    {!node.meta?.any && node.hasChildren ? (
                                      <ChevronRight
                                        className={`h-3 w-3 shrink-0 ${
                                          isLeafFocus
                                            ? "text-white/70"
                                            : "text-[#0f1f1d]/25"
                                        }`}
                                        aria-hidden
                                      />
                                    ) : null}
                                  </button>
                                </li>
                              );
                            })
                          )}
                        </ul>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
