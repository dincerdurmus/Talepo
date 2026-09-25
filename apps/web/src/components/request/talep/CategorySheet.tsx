"use client";

/**
 * KATEGORİ PANELİ — ALTTAN AÇILAN SAYFA (kurucu tasarımı, 2026-09-25).
 *
 * Çok kolonlu kaskadın yerine iki adımlı, fotoğraflı bir panel: önce kök
 * kategoriler, sonra seçilen kökün alt kategorileri.
 *
 * AĞAÇ BURADA KURULMAZ. Kökler ve çocuklar kanonik gezinme otoritesinden
 * (`listBrowseOptions` / `advanceBrowseWalk`) gelir; bu dosya ikinci bir
 * kategori listesi tutmaz. Fotoğraflar da mevcut `category-visuals`
 * kaydından okunur — yeni bir görsel eşlemesi yazılmaz.
 */

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Search } from "lucide-react";

import type { BrowseNode } from "@/lib/knowledge/types";
import { getCategoryVisual } from "@/lib/visuals/category-visuals";

/**
 * Panel YALNIZ AÇIKKEN MOUNT EDİLİR. Kapanışta arama kutusu ve açık kök
 * böylece kendiliğinden sıfırlanır; bir effect'in içinde state sıfırlamak
 * gereksiz bir ikinci render üretirdi.
 */
type Props = {
  onClose: () => void;
  roots: BrowseNode[];
  /** Bir kökün çocukları — kanonik gezinmeden gelir. */
  childrenOf: (root: BrowseNode) => BrowseNode[];
  /**
   * Kök açıldığında kanonik gezinme de ilerletilir: alt kategori seçimi
   * doğru ebeveynin altında yapılsın diye. Panel kendi ağacını tutmaz.
   */
  onEnterRoot: (root: BrowseNode) => void;
  onPickRoot: (root: BrowseNode) => void;
  onPickChild: (root: BrowseNode, child: BrowseNode) => void;
  currentCategoryId?: string | null;
  currentSubLabel?: string | null;
  /** `pick` akış ortasında kategori sorar; `browse` başlangıçta gezdirir. */
  mode: "pick" | "browse";
  /** Doğrudan bir kökün alt listesiyle açmak için (şerit kartına dokunuş). */
  initialRoot?: BrowseNode | null;
};

function fold(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(
      /[çğıöşü]/g,
      (m) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[m] ?? m,
    );
}

function nodeCategoryId(node: BrowseNode): string {
  return node.categoryId || node.id;
}

function CategoryPhoto({
  node,
  ratio,
  rounded,
}: {
  node: BrowseNode;
  ratio: string;
  rounded: string;
}) {
  const image = getCategoryVisual(nodeCategoryId(node)).image;
  if (!image) {
    return (
      <span
        className={`block w-full bg-[#f5f8f7] ${rounded}`}
        style={{ aspectRatio: ratio }}
      />
    );
  }
  return (
    <span
      className={`relative block w-full overflow-hidden bg-[#f5f8f7] ${rounded}`}
      style={{ aspectRatio: ratio }}
    >
      <Image
        src={image}
        alt={`${node.label} kategori görseli`}
        fill
        sizes="(min-width: 920px) 220px, 46vw"
        className="object-cover"
      />
    </span>
  );
}

export function CategorySheet({
  onClose,
  roots,
  childrenOf,
  onEnterRoot,
  onPickRoot,
  onPickChild,
  currentCategoryId,
  currentSubLabel,
  mode,
  initialRoot = null,
}: Props) {
  const [filter, setFilter] = useState("");
  const [openRoot, setOpenRoot] = useState<BrowseNode | null>(initialRoot);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const childLabels = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const root of roots) {
      try {
        map.set(
          root.id,
          childrenOf(root)
            .filter((child) => !child.meta?.any)
            .map((child) => child.label),
        );
      } catch {
        /* Ağaç okunamazsa kök yine listelenir; özet satırı boş kalır. */
        map.set(root.id, []);
      }
    }
    return map;
  }, [childrenOf, roots]);

  const visibleRoots = useMemo(() => {
    const needle = fold(filter.trim());
    if (!needle) return roots;
    return roots.filter(
      (root) =>
        fold(root.label).includes(needle) ||
        (childLabels.get(root.id) ?? []).some((label) =>
          fold(label).includes(needle),
        ),
    );
  }, [childLabels, filter, roots]);

  const subs = openRoot
    ? (() => {
        try {
          return childrenOf(openRoot).filter((child) => !child.meta?.any);
        } catch {
          return [];
        }
      })()
    : [];

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-[#0b1917]/30 transition-opacity"
        role="presentation"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={openRoot ? openRoot.label : "Kategoriler"}
        data-testid="talep-category-sheet"
        className="fixed bottom-0 left-1/2 z-[61] flex h-[min(88%,800px)] w-[min(680px,100%)] -translate-x-1/2 flex-col rounded-t-[28px] bg-white pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-24px_60px_-24px_rgba(0,0,0,0.35)]"
      >
        <span
          aria-hidden
          className="mx-auto mb-0.5 mt-2.5 block h-[5px] w-[38px] rounded-full bg-[#a0afac]/50"
        />
        <div className="flex items-center gap-2.5 px-5 pb-3 pt-2">
          {openRoot ? (
            <button
              type="button"
              aria-label="Geri"
              onClick={() => setOpenRoot(null)}
              className="-ml-2 grid h-8 w-8 place-items-center text-[#0f766e]"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
          ) : null}
          <h3 className="m-0 text-[21px] font-semibold tracking-[-0.025em] text-[#0f1f1d]">
            {openRoot
              ? openRoot.label
              : mode === "pick"
                ? "Hangi kategoride?"
                : "Kategoriler"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto min-h-10 px-1 text-sm font-medium text-[#0f766e]"
          >
            Kapat
          </button>
        </div>

        {!openRoot ? (
          <label className="mx-5 mb-3.5 flex h-[46px] items-center gap-2.5 rounded-[14px] bg-white px-3.5 text-[#0f1f1d]/50 shadow-[0_0_0_1px_rgba(11,25,23,0.08)]">
            <Search className="h-5 w-5" aria-hidden />
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Kategori ya da ürün ara"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[16px] text-[#0f1f1d] outline-none placeholder:text-[#a0afac]"
            />
          </label>
        ) : null}

        <div className="flex-1 overflow-y-auto px-5 pb-7">
          {openRoot ? (
            <>
              <div className="mb-3.5 grid gap-3">
                <CategoryPhoto
                  node={openRoot}
                  ratio="16 / 7"
                  rounded="rounded-[20px]"
                />
                <p className="m-0 text-sm text-[#0f1f1d]/50">
                  {mode === "browse"
                    ? "Bir alt kategori seç, talebini onunla başlatalım."
                    : "Talebin hangi alt kategoride açılsın?"}
                </p>
              </div>
              {subs.length > 0 ? (
                <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_0_0_1px_rgba(11,25,23,0.07)]">
                  {subs.map((child, index) => (
                    <button
                      key={child.id}
                      type="button"
                      data-testid="talep-category-sub"
                      onClick={() => onPickChild(openRoot, child)}
                      className={`flex min-h-[56px] w-full items-center px-[18px] text-left text-[16px] text-[#0f1f1d] hover:bg-[#f5f8f7] ${
                        index === 0 ? "" : "border-t border-[#0b1917]/[0.08]"
                      }`}
                    >
                      {child.label}
                      {currentCategoryId === nodeCategoryId(openRoot) &&
                      currentSubLabel === child.label ? (
                        <span className="ml-auto text-[#0f766e]" aria-hidden>
                          ✓
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onPickRoot(openRoot)}
                  className="flex min-h-[56px] w-full items-center rounded-[22px] bg-white px-[18px] text-left text-[16px] text-[#0f1f1d] shadow-[0_0_0_1px_rgba(11,25,23,0.07)]"
                >
                  {openRoot.label} ile devam et
                </button>
              )}
            </>
          ) : visibleRoots.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-[18px] sm:grid-cols-3">
              {visibleRoots.map((root) => {
                const current = currentCategoryId === nodeCategoryId(root);
                const summary = (childLabels.get(root.id) ?? [])
                  .slice(0, 3)
                  .join(", ");
                return (
                  <button
                    key={root.id}
                    type="button"
                    data-testid="talep-category-root"
                    onClick={() => {
                      onEnterRoot(root);
                      setOpenRoot(root);
                    }}
                    className="grid gap-1.5 text-left"
                  >
                    <span
                      className={`mb-1 block ${current ? "rounded-[18px] ring-2 ring-[#0f766e]" : ""}`}
                    >
                      <CategoryPhoto
                        node={root}
                        ratio="3 / 2"
                        rounded="rounded-[18px]"
                      />
                    </span>
                    <b className="pl-0.5 text-[15px] font-semibold tracking-[-0.01em] text-[#0f1f1d]">
                      {root.label}
                    </b>
                    {summary ? (
                      <small className="pl-0.5 text-[12.5px] leading-[1.35] text-[#0f1f1d]/50">
                        {summary}
                      </small>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="m-0 text-sm text-[#0f1f1d]/50">
              Eşleşen kategori yok. Talebini yazarak başlayabilirsin.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
