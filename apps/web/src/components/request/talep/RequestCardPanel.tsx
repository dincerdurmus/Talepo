"use client";

/**
 * TALEP KARTI — FORMUN KENDİSİ (kurucu, 2026-09-25).
 *
 * Anlaşılan bilgiler satır satır burada durur; satıra dokunmak o alanın
 * KANONİK sorusunu açar. Ayrı bir "bilgileri düzenle" formu yoktur.
 *
 * KART KARAR VERMEZ. Satırları, doluluk sayısını ve ek alan chip'lerini
 * `buildRequestCardModel` üretir; kategori adımını `buildCategoryConfirmation`
 * üretir. Bu dosya yalnız çizer ve dokunuşu dışarıya iletir.
 */

import Image from "next/image";
import { Check, Eye, Pencil, Plus } from "lucide-react";

import { getCategoryVisual } from "@/lib/visuals/category-visuals";
import type { RequestCardModel } from "@/lib/request-composer/v2/request-card-model";
import type {
  CategoryConfirmationAction,
  CategoryConfirmationModel,
} from "@/lib/request-composer/v2/category-confirmation";

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
  onAddOptional: (fieldKey: string) => void;
  /**
   * Kategori onay adımı — /talep'in iki yüzeyi de AYNI modeli ve AYNI
   * işleyiciyi kullanır; kart kendi kategori cümlesini uydurmaz.
   */
  categoryStep?: CategoryConfirmationModel | null;
  /**
   * Kullanıcı "Bu değil" dediğinde kök seçimi kartın ALTINDA açılır; kart
   * aynı soruyu ikinci kez sormaz.
   */
  categoryRejected?: boolean;
  onCategoryAction?: (action: CategoryConfirmationAction) => void;
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
  onAddOptional,
  categoryStep = null,
  categoryRejected = false,
  onCategoryAction,
}: Props) {
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

  return (
    <article
      data-testid="talep-request-card"
      aria-live="polite"
      className="overflow-hidden rounded-[28px] bg-white shadow-[0_0_0_1px_rgba(11,25,23,0.07),0_18px_44px_-24px_rgba(11,25,23,0.22)]"
    >
      <Banner categoryId={categoryId} categoryLabel={categoryLabel} />

      <div className="flex items-center gap-3.5 px-[22px] pt-4">
        <div className="grid min-w-0 gap-0.5">
          <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-[#0f1f1d]/45">
            {categoryLabel ?? "Kategori"}
          </span>
          <span className="truncate text-[15px] font-medium text-[#0f1f1d]">
            {leafLabel ?? (categoryLabel ? "Tüm alt kategoriler" : "Seçilmedi")}
          </span>
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

      {/*
        Kategori onayı kartın içindedir: kararın gösterildiği yer, kararın
        yaşadığı yerdir. "Bu değil" denince kök seçimi kartın ALTINDA açılır.
      */}
      {!locked &&
      !categoryRejected &&
      categoryStep &&
      categoryStep.mode === "confirm" &&
      onCategoryAction ? (
        <div
          data-testid="talep-card-category-confirm"
          className="mx-[22px] mt-3 rounded-2xl border border-[#0f766e]/15 bg-[#f7fdfb] px-3.5 py-3"
        >
          <p className="text-[13.5px] leading-5 text-[#0f1f1d]">
            {categoryStep.prompt}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-10 rounded-xl bg-[#0f766e] px-3.5 text-[13px] font-medium text-white"
              onClick={() => onCategoryAction({ kind: "confirm" })}
            >
              {categoryStep.confirmLabel}
            </button>
            <button
              type="button"
              className="min-h-10 rounded-xl border border-[#0f1f1d]/10 bg-white px-3.5 text-[13px] font-medium text-[#0f1f1d]/70"
              onClick={() => onCategoryAction({ kind: "reject" })}
            >
              {categoryStep.rejectLabel}
            </button>
          </div>
        </div>
      ) : null}

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
            <div className="flex flex-1 gap-1">
              {model.rows.map((row) => (
                <i
                  key={`seg-${row.key}`}
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

          <div className="px-[22px] pb-2 pt-0.5">
            {model.rows.map((row) => (
              <button
                key={row.key}
                type="button"
                disabled={locked || !row.askable}
                data-testid="talep-card-row"
                data-row-key={row.key}
                data-row-state={row.state}
                onClick={() => onAskField(row.key)}
                className="flex min-h-[52px] w-full items-center gap-3 border-t border-[#0b1917]/[0.08] py-2.5 text-left first:border-t-0 disabled:cursor-default"
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
                      {row.state === "asking" ? "şimdi soruluyor" : "sorulacak"}
                    </em>
                  )}
                </span>
                {row.value && !locked ? (
                  <Pencil className="h-[15px] w-[15px] shrink-0 text-[#0f1f1d]/30" aria-hidden />
                ) : null}
              </button>
            ))}
          </div>

          {model.extras.length > 0 && !locked ? (
            <div
              data-testid="talep-card-extras"
              className="mx-[22px] flex flex-wrap gap-2 border-t border-[#0b1917]/[0.08] pb-5 pt-3.5"
            >
              <span className="w-full text-[13px] text-[#0f1f1d]/45">
                İstersen ekle, teklifler netleşir
              </span>
              {model.extras.map((extra) => (
                <button
                  key={extra.key}
                  type="button"
                  onClick={() => onAddOptional(extra.key)}
                  className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-dashed border-[#0f766e]/30 px-3.5 text-[13.5px] text-[#0f766e] transition hover:bg-[#f0fdfa]"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  {extra.label}
                </button>
              ))}
            </div>
          ) : null}
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
  );
}
