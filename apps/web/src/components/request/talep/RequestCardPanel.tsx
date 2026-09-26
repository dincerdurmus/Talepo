"use client";

/**
 * TALEP KARTI — FORMUN KENDİSİ (kurucu, 2026-09-25).
 *
 * Anlaşılan bilgiler satır satır burada durur; satıra dokunmak o alanın
 * KANONİK sorusunu açar. Ayrı bir "bilgileri düzenle" formu yoktur.
 *
 * KART KARAR VERMEZ. Satırları, doluluk sayısını ve ek alan chip'lerini
 * `buildRequestCardModel` üretir. Bu dosya yalnız çizer ve dokunuşu dışarıya
 * iletir.
 *
 * KART = YALNIZ BİLGİ (kurucu, 2026-09-25 tanıtım videosu). Kategori onayı
 * kartın İÇİNDEN çıktı: kart bilgiyi gösterir, soru sormaz. Aynı model ve
 * aynı işleyici kartın altındaki tek soru alanında çalışır — yalnız yeri
 * değişti, kararı değil.
 */

import Image from "next/image";
import { useState } from "react";
import { Check, ChevronRight, Eye } from "lucide-react";

import { getCategoryVisual } from "@/lib/visuals/category-visuals";
import {
  CARD_IN_MS,
  EASE_REVEAL,
  EASE_SPRING,
  REVEAL_MS,
  ROW_STEP_MS,
  prefersReducedMotion,
} from "@/lib/motion/talep-motion";
import type { RequestCardModel } from "@/lib/request-composer/v2/request-card-model";

type Props = {
  model: RequestCardModel;
  title: string;
  categoryId: string | null;
  categoryLabel: string | null;
  subcategoryLabel: string | null;
  /** Metin değişince kart "kontrol ediliyor" der; bayat bilgi göstermez. */
  updating?: boolean;
  /**
   * Yayın kapısı AÇIK mı? Kart bunu kendisi hesaplamaz: kanonik
   * `computeComposerPublishReadiness` sonucunu alır. Sayacın yanındaki
   * "Yayına hazır" ancak bu doğruyken yazılır — satırlar dolu görünürken
   * yayının kapalı olduğu bir durumda kart yalan söylemesin diye.
   */
  ready?: boolean;
  /** Yayınlandıktan sonra satırlar kilitlenir. */
  locked?: boolean;
  lockedBadge?: string | null;
  onChangeCategory: () => void;
  onAskField: (fieldKey: string) => void;
};

function Banner({
  categoryId,
  categoryLabel,
}: {
  categoryId: string | null;
  categoryLabel: string | null;
}) {
  const image = categoryId ? getCategoryVisual(categoryId).image : undefined;
  if (!image) {
    return (
      <div className="grid h-32 place-items-center bg-[#f5f8f7] text-[11px] font-medium uppercase tracking-[0.12em] text-[#0f1f1d]/30">
        Kategori seçilmedi
      </div>
    );
  }
  return (
    <div className="relative h-32 w-full overflow-hidden bg-[#f5f8f7]">
      <Image
        src={image}
        alt={`${categoryLabel ?? "Kategori"} kategori görseli`}
        fill
        sizes="(min-width: 920px) 420px, 100vw"
        className="object-cover"
        priority={false}
      />
    </div>
  );
}

export function RequestCardPanel({
  model,
  title,
  categoryId,
  categoryLabel,
  subcategoryLabel,
  updating = false,
  ready = false,
  locked = false,
  lockedBadge = null,
  onChangeCategory,
  onAskField,
}: Props) {
  /**
   * Hareket kararı BİR KEZ okunur. Azaltılmış hareket isteniyorsa yay girişi
   * ve satır sırası hiç kurulmaz; kart son hâliyle görünür.
   */
  const [still] = useState(prefersReducedMotion);
  /**
   * "Beyaz Eşya › Beyaz Eşya" tekrarı bu yapıda KALMAZ: alt satır yalnız üst
   * kategoriden farklıysa yazılır, aynıysa ikinci satır hiç çizilmez.
   */
  const sameLabel =
    Boolean(subcategoryLabel) &&
    subcategoryLabel!.trim().toLocaleLowerCase("tr-TR") ===
      (categoryLabel ?? "").trim().toLocaleLowerCase("tr-TR");
  const leafLabel = sameLabel ? null : subcategoryLabel;
  /** Eksik satır kalmadı: sayaç tam. Yayın kapısı ayrı bir bilgidir. */
  const complete =
    model.totalCount > 0 && model.filledCount === model.totalCount;

  const hasEditableRow = !locked && model.rows.some((row) => row.askable);

  return (
    <>
    <article
      data-testid="talep-request-card"
      aria-live="polite"
      /* Kart aşağıdan yay hareketiyle gelir (videodaki `spring`). */
      style={
        still
          ? undefined
          : {
              animation: `talep-card-in ${CARD_IN_MS}ms ${EASE_SPRING} both`,
            }
      }
      className="overflow-hidden rounded-[28px] bg-white shadow-[0_0_0_1px_rgba(11,25,23,0.07),0_18px_44px_-24px_rgba(11,25,23,0.22)]"
    >
      <style>{`@keyframes talep-card-in{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}@keyframes talep-row-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes talep-seg-in{from{transform:scaleX(0)}to{transform:scaleX(1)}}`}</style>
      <Banner categoryId={categoryId} categoryLabel={categoryLabel} />

      <div className="flex items-center gap-3.5 px-[22px] pt-4">
        <div className="grid min-w-0 gap-0.5">
          <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-[#0f1f1d]/45">
            {categoryLabel ?? "Kategori"}
          </span>
          {/*
            YER TUTUCU YAZILMAZ (kurucu, 2026-09-25). Alt kategori yoksa
            "Tüm alt kategoriler" diye bir şey uydurulmaz; satır hiç çizilmez
            ve başlıkta yalnız kategori adı kalır.
          */}
          {leafLabel ? (
            <span
              data-testid="talep-card-subcategory"
              className="truncate text-[15px] font-medium text-[#0f1f1d]"
            >
              {leafLabel}
            </span>
          ) : null}
        </div>
        {locked ? (
          <span
            data-testid="talep-card-locked-badge"
            className="ml-auto inline-flex items-center gap-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-[#0f766e]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#0d9488]" aria-hidden />
            {lockedBadge ?? "Yayında"}
          </span>
        ) : (
          <button
            type="button"
            data-testid="talep-card-change-category"
            onClick={onChangeCategory}
            className="ml-auto min-h-10 px-2.5 text-sm font-medium text-[#0f766e]"
          >
            Değiştir
          </button>
        )}
      </div>

      <h2 className="mx-[22px] mb-2.5 mt-4 text-[28px] font-semibold leading-[1.1] tracking-[-0.035em] text-[#0f1f1d]">
        {title}
      </h2>

      {updating ? (
        <p
          data-testid="talep-card-updating"
          className="mx-[22px] mb-4 text-sm text-[#0f1f1d]/45"
        >
          Kontrol ediliyor…
        </p>
      ) : (
        <>
          <div className="mx-[22px] mb-2 flex items-center gap-2.5">
            {/*
              ÇUBUK SEGMENT SEGMENT İLERLER (videodaki an): her segment kendi
              satırıyla aynı sırada dolar, hepsi birden belirmez.
            */}
            <div className="flex flex-1 gap-1">
              {model.rows.map((row, index) => (
                <i
                  key={`seg-${row.key}`}
                  style={
                    still || !row.value
                      ? undefined
                      : {
                          transformOrigin: "left",
                          animation: `talep-seg-in ${REVEAL_MS}ms ${EASE_REVEAL} ${index * ROW_STEP_MS}ms both`,
                        }
                  }
                  className={`h-1 flex-1 rounded ${
                    row.value ? "bg-[#0d9488]" : "bg-[#0b1917]/10"
                  }`}
                />
              ))}
            </div>
            {/*
              SAYAÇ YALNIZ YAYIN İÇİN GEREKENİ SAYAR (kurucu, 2026-09-25).
              Zorunlu bilgi kalmadığında sayı yerine durumu söyler: kullanıcı
              "4/7" görüp eksik sanmasın diye.
            */}
            <span
              data-testid="talep-card-meter"
              data-meter-ready={complete && ready ? "true" : "false"}
              data-meter-filled={model.filledCount}
              data-meter-total={model.totalCount}
              className={`font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] ${
                complete && ready ? "text-[#0f766e]" : "text-[#0f1f1d]/45"
              }`}
            >
              {complete && ready
                ? "Yayına hazır"
                : `${model.filledCount}/${model.totalCount} bilgi`}
            </span>
          </div>

          {/*
            KALEM İKONU KALKTI (kurucu, 2026-09-25). Satırın tamamı zaten
            dokunulabilir; ikon aynı şeyi ikinci kez söyleyip satırı
            kalabalıklaştırıyordu. Dokunuş geri bildirimi basılı zemin,
            masaüstünde hover'da sağda ince bir oktur.
          */}
          <div className="px-[22px] pb-2 pt-0.5">
            {model.rows.map((row, index) => {
              const editable = !locked && row.askable;
              return (
                <button
                  key={row.key}
                  type="button"
                  disabled={locked || !row.askable}
                  data-testid="talep-card-row"
                  data-row-key={row.key}
                  data-row-state={row.state}
                  onClick={() => onAskField(row.key)}
                  style={
                    still
                      ? undefined
                      : {
                          animation: `talep-row-in ${REVEAL_MS}ms ${EASE_REVEAL} ${index * ROW_STEP_MS}ms both`,
                        }
                  }
                  className={`group flex min-h-[52px] w-full items-center gap-3 border-t border-[#0b1917]/[0.08] px-2 py-2.5 text-left transition-colors duration-150 first:border-t-0 disabled:cursor-default ${
                    editable ? "active:bg-[#f0fdfa] lg:hover:bg-[#f7fdfb]" : ""
                  }`}
                >
                  <span
                    className={`min-w-[80px] text-sm ${
                      row.state === "asking"
                        ? "text-[#3a4c49]"
                        : "text-[#0f1f1d]/45"
                    }`}
                  >
                    {row.label}
                  </span>
                  <span className="ml-auto text-right text-[15.5px] font-medium text-[#0f1f1d]">
                    {row.value ? (
                      row.value
                    ) : (
                      <em
                        className={`not-italic text-[14.5px] ${
                          row.state === "asking"
                            ? "font-medium text-[#a15c07]"
                            : "font-normal text-[#0f1f1d]/38"
                        }`}
                      >
                        {row.state === "asking"
                          ? "şimdi soruluyor"
                          : "sorulacak"}
                      </em>
                    )}
                  </span>
                  {editable ? (
                    <ChevronRight
                      className="hidden h-4 w-4 shrink-0 text-[#0f766e]/0 transition-colors duration-150 lg:block lg:group-hover:text-[#0f766e]/60"
                      aria-hidden
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

        </>
      )}

      <div className="flex items-center gap-2 border-t border-[#0b1917]/[0.08] bg-[#f5f8f7] px-[22px] py-3 text-[12.5px] text-[#0f1f1d]/50">
        {locked ? (
          <Check className="h-[15px] w-[15px]" aria-hidden />
        ) : (
          <Eye className="h-[15px] w-[15px]" aria-hidden />
        )}
        Tedarikçiler talebini bu kart olarak görür
      </div>
    </article>
    {/*
      İPUCU KART ALTINDA, BİR KEZ. Kalem ikonu kalkınca satırların
      dokunulabilir olduğunu söyleyecek tek bir yer kaldı; o yer burasıdır.
    */}
    {hasEditableRow ? (
      <p
        data-testid="talep-card-row-hint"
        className="m-0 mt-2.5 px-1 text-[13px] text-[#0f1f1d]/45"
      >
        Satıra dokunup değiştirebilirsin
      </p>
    ) : null}
    </>
  );
}
