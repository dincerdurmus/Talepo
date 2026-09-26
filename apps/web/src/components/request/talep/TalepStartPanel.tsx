"use client";

/**
 * BAŞLANGIÇ EKRANI — /talep'in ilk anı (kurucu tasarımı, 2026-09-25).
 *
 * Tek bir cümle kutusu, üç örnek satırı ve fotoğraflı kategori şeridi.
 * Masaüstünde solda başlık + kutu + örnekler, sağda büyük Maira yüzü,
 * altta altı sütunlu kategori ızgarası ve 12. kutu olarak "Tümü →".
 *
 * KUTUNUN ALTINDAKİ ETİKETLER ÇIKARIM DEĞİL, AYNA. Yazarken görünen küçük
 * etiketler mevcut anlama sonucundan gelir ve `detected` ile hazır verilir;
 * bu dosya hiçbir şey çıkarmaz. Liste boşsa hiçbir şey gösterilmez.
 */

import Image from "next/image";
import { ArrowUp, ChevronRight } from "lucide-react";

import type { BrowseNode } from "@/lib/knowledge/types";
import { getCategoryVisual } from "@/lib/visuals/category-visuals";

import { MairaFace } from "./MairaFace";

export type DetectedChip = {
  key: string;
  label: string;
  value: string;
};

type Props = {
  text: string;
  onTextChange: (value: string) => void;
  onSubmit: () => void;
  detected: DetectedChip[];
  examples: readonly string[];
  onPickExample: (example: string) => void;
  roots: BrowseNode[];
  onOpenCategories: () => void;
  onOpenCategory: (root: BrowseNode) => void;
};

function RailTile({
  node,
  onClick,
}: {
  node: BrowseNode;
  onClick: () => void;
}) {
  const image = getCategoryVisual(node.categoryId || node.id).image;
  return (
    <button
      type="button"
      data-testid="talep-start-category"
      onClick={onClick}
      className="grid flex-none snap-start gap-2.5 text-left lg:w-auto"
      style={{ width: "148px" }}
    >
      <span className="relative block aspect-[4/5] w-full overflow-hidden rounded-[20px] bg-[#f5f8f7] shadow-[inset_0_0_0_1px_rgba(11,25,23,0.06)] lg:aspect-[16/10] lg:rounded-2xl">
        {image ? (
          <Image
            src={image}
            alt={`${node.label} kategori görseli`}
            fill
            sizes="(min-width: 920px) 180px, 148px"
            className="object-cover transition-transform duration-500 hover:scale-[1.04]"
          />
        ) : null}
      </span>
      <b className="pl-0.5 text-[14px] font-medium leading-[1.25] text-[#0f1f1d] lg:text-[13.5px]">
        {node.label}
      </b>
    </button>
  );
}

/**
 * YÜZ + ADI. Videoda yüzün altında yalnız mono `MAIRA` etiketi durur; başka
 * hiçbir açıklama yoktur. Etiket kimliği söyler, bir eylem önermez.
 */
function MairaMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <span className={`grid justify-items-start gap-2 ${className}`}>
      <MairaFace size={size} />
      <span
        data-testid="talep-start-maira-mark"
        className="pl-0.5 font-mono text-[11px] font-medium tracking-[0.22em] text-[#0f766e]"
      >
        MAIRA
      </span>
    </span>
  );
}

export function TalepStartPanel({
  text,
  onTextChange,
  onSubmit,
  detected,
  examples,
  onPickExample,
  roots,
  onOpenCategories,
  onOpenCategory,
}: Props) {
  const canSubmit = text.trim().length >= 5;

  return (
    <section
      data-testid="talep-start"
      className="grid gap-7 pt-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-x-16"
    >
      {/*
        `min-w-0` ŞART: ızgara çocuklarının varsayılan `min-width:auto` değeri,
        yatay kaydırılan kategori şeridinin min-içerik genişliğini bütün
        sütuna yansıtıyor ve sayfa telefonda taşıyordu (tarayıcıda ölçüldü).
      */}
      <div className="grid min-w-0 gap-[18px] lg:col-start-1">
        {/*
          TELEFONDA YÜZ BÜYÜKTÜR (kurucu, 2026-09-25 tanıtım videosu). 132px'te
          Maira bir ikona dönüşüyor ve ilk ekranı başlık ile açıklama
          dolduruyordu; videoda ilk anı yüz taşır. Masaüstündeki 380px sağ
          sütunda olduğu gibi kalır.
        */}
        <MairaMark size={240} className="-ml-3 lg:hidden" />
        <h1 className="m-0 text-[clamp(36px,9vw,56px)] font-semibold leading-[1.02] tracking-[-0.045em] text-[#0f1f1d]">
          Tek cümle yaz.
        </h1>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) onSubmit();
          }}
          className="grid gap-2 rounded-[26px] bg-white px-4 pb-3 pt-[18px] pl-5 shadow-[0_0_0_1px_rgba(11,25,23,0.07),0_18px_44px_-24px_rgba(11,25,23,0.22)] focus-within:shadow-[0_0_0_1.5px_#0d9488,0_18px_44px_-24px_rgba(11,25,23,0.22)]"
        >
          <label htmlFor="talep-composer" className="sr-only">
            Ne arıyorsun?
          </label>
          <textarea
            id="talep-composer"
            rows={3}
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (canSubmit) onSubmit();
              }
            }}
            placeholder="Ne arıyorsun?"
            className="min-h-20 resize-none bg-transparent text-[17.5px] leading-[1.45] text-[#0f1f1d] outline-none placeholder:text-[#a0afac]"
          />
          <div className="flex items-center justify-between gap-3">
            {/*
              İPUCU SATIRI KALKTI (kurucu, 2026-09-25): kutunun altında hiçbir
              şey anlatılmaz. Burada yalnız zaten ANLAŞILMIŞ alanların aynası
              durur; anlaşılan yoksa satır boş kalır.
            */}
            <div
              data-testid="talep-start-detected"
              className="flex min-h-[26px] flex-wrap items-center gap-1.5"
            >
              {detected.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex h-[26px] items-center gap-1.5 rounded-lg bg-[#e4f1ee] px-2.5 text-[13px] text-[#3a4c49]"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#0f766e]">
                    {chip.label}
                  </span>
                  {chip.value}
                </span>
              ))}
            </div>
            <button
              type="submit"
              data-testid="composer-intro-continue"
              aria-label="Devam"
              disabled={!canSubmit}
              className="grid h-[42px] w-[42px] flex-none place-items-center rounded-full bg-[#0f766e] text-white transition active:scale-95 disabled:cursor-default disabled:opacity-30"
            >
              <ArrowUp className="h-[19px] w-[19px] stroke-[2.2]" aria-hidden />
            </button>
          </div>
        </form>
      </div>

      <div className="hidden lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:grid lg:justify-self-center">
        <MairaMark size={380} />
      </div>

      <div className="min-w-0 lg:col-start-1 lg:row-start-2">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="m-0 text-[17px] font-semibold tracking-[-0.02em] text-[#0f1f1d]">
            Örnekle dene
          </h2>
        </div>
        <div className="grid">
          {examples.map((example, index) => (
            <button
              key={example}
              type="button"
              onClick={() => onPickExample(example)}
              className={`flex min-w-0 items-center gap-3 py-3 text-left text-[15px] text-[#3a4c49] ${
                index === 0 ? "" : "border-t border-[#0b1917]/[0.08]"
              }`}
            >
              <span className="font-mono text-[13px] text-[#a0afac]">“</span>
              <span className="min-w-0 flex-1">{example}</span>
              <ChevronRight
                className="h-5 w-5 flex-none text-[#a0afac]"
                aria-hidden
              />
            </button>
          ))}
        </div>
      </div>

      <div className="min-w-0 lg:col-span-2 lg:col-start-1 lg:row-start-3">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="m-0 text-[17px] font-semibold tracking-[-0.02em] text-[#0f1f1d]">
            Kategoriler
          </h2>
          <button
            type="button"
            onClick={onOpenCategories}
            className="text-sm font-medium text-[#0f766e]"
          >
            Tümü
          </button>
        </div>
        <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-3.5 pt-1 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-6 lg:gap-x-3.5 lg:gap-y-[18px] lg:overflow-visible lg:px-0">
          {roots.map((root) => (
            <RailTile
              key={root.id}
              node={root}
              onClick={() => onOpenCategory(root)}
            />
          ))}
          <button
            type="button"
            onClick={onOpenCategories}
            className="grid flex-none snap-start gap-2.5 text-left lg:w-auto"
            style={{ width: "148px" }}
          >
            <span className="grid aspect-[4/5] w-full place-items-center rounded-[20px] bg-[#f5f8f7] text-[15px] font-semibold text-[#0f766e] shadow-[inset_0_0_0_1px_rgba(11,25,23,0.06)] lg:aspect-[16/10] lg:rounded-2xl lg:text-sm">
              Tümü →
            </span>
            <b className="pl-0.5 text-[14px] font-medium">&nbsp;</b>
          </button>
        </div>
      </div>
    </section>
  );
}
