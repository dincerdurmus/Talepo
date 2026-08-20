"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Send, X } from "lucide-react";

import { OFFER_DRAFT_STORAGE_KEY } from "@/components/panel/AiAssistantPanel";
import {
  LetterSendButton,
  waitForLetterSend,
} from "@/components/panel/LetterSendButton";
import {
  OfferDraftComposerLock,
} from "@/components/panel/OfferDraftSuggestion";
import { OfferPhotoPicker, type PendingOfferPhoto } from "@/components/panel/OfferPhotoPicker";
import { OfferMediaThumbStrip } from "@/components/panel/OfferMediaThumbStrip";
import { TrMoneyInput } from "@/components/ui/TrMoneyInput";
import { formatTrNumber, parseTrNumber } from "@/lib/format/tr-number";
import {
  OFFER_ATTRIBUTION_TOUCH_PARAM,
  readAttributionTouchFromSearchParams,
} from "@/lib/offer/offer-attribution";
import {
  COMPOSER_COMPLETENESS_EXCLUDE,
  scoreOfferCompleteness,
} from "@/lib/offer/offer-completeness";
import { isOfferDraftAssistantLive } from "@/lib/offer/offer-draft-assistant";
import type { EntitlementDTO } from "@/lib/membership/serialize";
import { formatQuotaRemaining } from "@/lib/membership/serialize";

type ExistingOfferValues = {
  id: string;
  description: string;
  amount: number;
  deliveryDays: number | null;
  title?: string | null;
  media?: { id: string }[];
};

type OfferFormProps = {
  requestId: string;
  entitlements: EntitlementDTO;
  categorySlug?: string;
  budgetMin?: number | null;
  existingOffer?: ExistingOfferValues | null;
  /** Server-passed signed touch; falls back to ?acq= in the URL. */
  attributionTouch?: string | null;
};

type StoredDraft = {
  requestId: string;
  description: string;
  amount: number;
  deliveryDays: number;
  title?: string;
};

const fieldClass =
  "h-12 w-full rounded-[14px] border border-teal-900/[0.11] bg-[#fcfdfc] px-3.5 text-[15px] text-[#0f1f1d] outline-none transition placeholder:text-[#0f1f1d]/38 focus:border-teal-700/35 focus:bg-white focus:ring-2 focus:ring-teal-700/12";

const areaClass =
  "min-h-[118px] w-full resize-y rounded-[14px] border border-teal-900/[0.11] bg-[#fcfdfc] px-3.5 py-3 text-[15px] leading-6 text-[#0f1f1d] outline-none transition placeholder:text-[#0f1f1d]/38 focus:border-teal-700/35 focus:bg-white focus:ring-2 focus:ring-teal-700/12";

const labelClass = "mb-1.5 block text-[13px] font-medium text-[#536b68]";
const eyebrowClass =
  "text-[11px] font-semibold uppercase tracking-[0.12em] text-[#3d5c58]/90";
const helperClass = "text-[12px] leading-5 text-[#0f1f1d]/52";

function readPendingDraft(requestId: string): StoredDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(OFFER_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    return parsed.requestId === requestId ? parsed : null;
  } catch {
    return null;
  }
}

function getPlaceholders(categorySlug?: string, budgetMin?: number | null) {
  const budgetHint =
    budgetMin && budgetMin > 0
      ? `Örn. ${formatTrNumber(budgetMin)}`
      : "Örn. 15.000";

  if (categorySlug === "real-estate") {
    return {
      amount: budgetHint,
      delivery: "Örn. 3",
      deliveryLabel: "Yanıt süresi (gün)",
      title: "Örn. Deniz manzaralı 2+1 kiralık daire",
      description: "Kira, depozito, gösterim ve dahil olanlar…",
    };
  }

  return {
    amount: budgetHint,
    delivery: "Örn. 7",
    deliveryLabel: "Teslim (gün)",
    title: "Örn. 2 yıl garantili Dyson hava temizleme cihazı",
    description: "Kapsam, garanti ve teslim koşullarınızı kısaca belirtin.",
  };
}

function formatTry(amount: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(amount);
}

function resolveInitialOfferFields(
  requestId: string,
  existingOffer: ExistingOfferValues | null,
  applyDraftFromQuery: boolean,
) {
  if (existingOffer) {
    return {
      title: existingOffer.title?.trim() || "",
      description: existingOffer.description,
      amount: formatTrNumber(existingOffer.amount),
      deliveryDays: existingOffer.deliveryDays
        ? String(existingOffer.deliveryDays)
        : "",
      draftApplied: false,
    };
  }

  if (applyDraftFromQuery) {
    const draft = readPendingDraft(requestId);
    if (draft) {
      return {
        title: draft.title?.trim() || "",
        description: draft.description,
        amount: formatTrNumber(draft.amount),
        deliveryDays: draft.deliveryDays ? String(draft.deliveryDays) : "",
        draftApplied: true,
      };
    }
  }

  return {
    title: "",
    description: "",
    amount: "",
    deliveryDays: "",
    draftApplied: false,
  };
}

async function uploadOfferPhotos(
  offerId: string,
  photos: PendingOfferPhoto[],
  setPhotos: (photos: PendingOfferPhoto[]) => void,
) {
  let current = photos;
  for (const photo of photos) {
    if (photo.status === "uploaded") continue;
    current = current.map((item) =>
      item.localId === photo.localId
        ? { ...item, status: "uploading", error: undefined }
        : item,
    );
    setPhotos(current);

    const body = new FormData();
    body.append("file", photo.file, photo.file.name);
    const response = await fetch(`/api/offers/${offerId}/media`, {
      method: "POST",
      body,
    });
    const result = (await response.json()) as { message?: string };
    if (!response.ok) {
      current = current.map((item) =>
        item.localId === photo.localId
          ? {
              ...item,
              status: "error",
              error: result.message || "Yüklenemedi",
            }
          : item,
      );
      setPhotos(current);
      throw new Error(
        `${photo.name}: ${result.message || "Fotoğraf yüklenemedi."}`,
      );
    }

    current = current.map((item) =>
      item.localId === photo.localId ? { ...item, status: "uploaded" } : item,
    );
    setPhotos(current);
  }

  const finalize = await fetch(`/api/offers/${offerId}/media/finalize`, {
    method: "POST",
  });
  if (!finalize.ok) {
    const result = (await finalize.json()) as { message?: string };
    throw new Error(result.message || "Fotoğraflar kilitlenemedi.");
  }
}

export function OfferForm({
  requestId,
  entitlements,
  categorySlug,
  budgetMin,
  existingOffer = null,
  attributionTouch: attributionTouchProp = null,
}: OfferFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const applyDraftFromQuery =
    isOfferDraftAssistantLive() && searchParams.get("taslak") === "1";
  const attributionTouch =
    attributionTouchProp ??
    readAttributionTouchFromSearchParams(searchParams);
  const isRevise = Boolean(existingOffer);
  const initialFields = useMemo(
    () =>
      resolveInitialOfferFields(requestId, existingOffer, applyDraftFromQuery),
    [applyDraftFromQuery, existingOffer, requestId],
  );

  const [step, setStep] = useState<"edit" | "preview">("edit");
  const [title, setTitle] = useState(initialFields.title);
  const [description, setDescription] = useState(initialFields.description);
  const [amount, setAmount] = useState(initialFields.amount);
  const [deliveryDays, setDeliveryDays] = useState(initialFields.deliveryDays);
  const [error, setError] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftApplied] = useState(initialFields.draftApplied);
  const [photos, setPhotos] = useState<PendingOfferPhoto[]>([]);
  const [createdOfferId, setCreatedOfferId] = useState<string | null>(null);
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState<number | null>(
    null,
  );

  const placeholders = useMemo(
    () => getPlaceholders(categorySlug, budgetMin),
    [categorySlug, budgetMin],
  );
  const remainingLabel = formatQuotaRemaining(entitlements.quota);
  const canSubmit =
    isRevise ||
    entitlements.quota.isUnlimited ||
    (entitlements.quota.remaining !== null && entitlements.quota.remaining > 0);

  useEffect(() => {
    if (isRevise) return;

    if (!applyDraftFromQuery) {
      const stale = readPendingDraft(requestId);
      if (stale) sessionStorage.removeItem(OFFER_DRAFT_STORAGE_KEY);
      return;
    }

    const draft = readPendingDraft(requestId);
    if (!draft) return;

    sessionStorage.removeItem(OFFER_DRAFT_STORAGE_KEY);
    router.replace(
      attributionTouch
        ? `/panel/talepler/${requestId}/teklif?${OFFER_ATTRIBUTION_TOUCH_PARAM}=${encodeURIComponent(attributionTouch)}`
        : `/panel/talepler/${requestId}/teklif`,
      { scroll: false },
    );
  }, [applyDraftFromQuery, attributionTouch, isRevise, requestId, router]);

  function validateFields(): string | null {
    if (!isRevise) {
      const parsedAmount = parseTrNumber(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return "Geçerli bir teklif tutarı girin.";
      }
      if (deliveryDays) {
        const days = Number(deliveryDays);
        if (!Number.isFinite(days) || days <= 0) {
          return "Yanıt / teslim süresi geçerli bir gün olmalı.";
        }
      }
    }
    if (!description.trim()) {
      return "Kısa açıklama gerekli.";
    }
    return null;
  }

  function handlePreview(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;
    const validationError = validateFields();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep("preview");
  }

  async function handleConfirmSend() {
    if (isSubmitting) return;

    const validationError = validateFields();
    if (validationError) {
      setError(validationError);
      setStep("edit");
      return;
    }

    setError(null);
    setQuotaExceeded(false);
    setIsSubmitting(true);
    const startedAt = Date.now();
    let submittedOfferId = createdOfferId;
    const trimmedTitle = title.trim();

    try {
      if (isRevise && existingOffer) {
        const payload = isRevise ? { description } : { description };
        if (trimmedTitle) {
          Object.assign(payload, { title: trimmedTitle });
        }
        const response = await fetch(`/api/offers/${existingOffer.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = (await response.json()) as {
          message?: string;
          code?: string;
          redirectTo?: string;
        };
        if (!response.ok) {
          throw new Error(result.message || "Teklif güncellenemedi.");
        }
        sessionStorage.removeItem(OFFER_DRAFT_STORAGE_KEY);
        await waitForLetterSend(startedAt);
        router.push(result.redirectTo || `/panel/teklifler?guncellendi=1`);
        router.refresh();
        return;
      }

      let offerId = submittedOfferId;
      if (!offerId) {
        const response = await fetch("/api/offers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId,
            description,
            amount: parseTrNumber(amount),
            deliveryDays: deliveryDays ? Number(deliveryDays) : null,
            title: trimmedTitle || undefined,
            deferMediaFinalize: photos.length > 0,
            attributionTouch: attributionTouch ?? undefined,
          }),
        });
        const result = (await response.json()) as {
          message?: string;
          code?: string;
          redirectTo?: string;
          offer?: { id: string };
        };
        if (!response.ok) {
          if (result.code === "OFFER_QUOTA_EXCEEDED") {
            setQuotaExceeded(true);
          }
          throw new Error(result.message || "Teklif gönderilemedi.");
        }
        offerId = result.offer?.id ?? null;
        if (!offerId) {
          throw new Error("Teklif oluşturuldu ancak kimlik alınamadı.");
        }
        setCreatedOfferId(offerId);
        submittedOfferId = offerId;
      }

      if (offerId && (photos.length > 0 || createdOfferId)) {
        if (photos.length > 0) {
          await uploadOfferPhotos(offerId, photos, setPhotos);
        } else {
          const finalize = await fetch(`/api/offers/${offerId}/media/finalize`, {
            method: "POST",
          });
          if (!finalize.ok) {
            const result = (await finalize.json()) as { message?: string };
            throw new Error(result.message || "Fotoğraflar kilitlenemedi.");
          }
        }
      }

      sessionStorage.removeItem(OFFER_DRAFT_STORAGE_KEY);
      await waitForLetterSend(startedAt);
      router.push(`/panel/teklifler?gonderildi=1`);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : isRevise
            ? "Teklif güncellenirken bir hata oluştu."
            : submittedOfferId
              ? "Teklif kaydedildi; fotoğraf yüklemesi tamamlanamadı. Tekrar deneyin."
              : "Teklif gönderilirken bir hata oluştu.",
      );
      setIsSubmitting(false);
      setStep("edit");
    }
  }

  const parsedAmount = parseTrNumber(amount);
  const deliveryNum = deliveryDays ? Number(deliveryDays) : null;
  const completeness = scoreOfferCompleteness(
    {
      amount: Number.isFinite(parsedAmount) ? parsedAmount : null,
      deliveryDays:
        deliveryNum != null && Number.isFinite(deliveryNum) && deliveryNum > 0
          ? deliveryNum
          : null,
      description,
      title: title.trim() || null,
      validUntil: null,
    },
    { excludeKeys: COMPOSER_COMPLETENESS_EXCLUDE },
  );

  const strengthenLabels = [
    ...completeness.missing,
    ...(photos.length === 0 && !isRevise ? ["Fotoğraf"] : []),
  ];

  if (step === "preview") {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#3d5c58]/70">
            Önizleme
          </p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-[#0f1f1d]">
            Teklifiniz şöyle görünecek
          </h3>
        </div>

        <article className="overflow-hidden rounded-[18px] border border-teal-900/[0.08] bg-[#fbfcfc]">
          {title.trim() ? (
            <div className="border-b border-teal-900/[0.06] px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0f1f1d]/40">
                Başlık
              </p>
              <p className="mt-1 text-[17px] font-semibold tracking-tight text-[#0f1f1d]">
                {title.trim()}
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 border-b border-teal-900/[0.06] px-5 py-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0f1f1d]/40">
                Tutar
              </p>
              <p className="mt-1 text-[22px] font-semibold tracking-tight text-[#0f1f1d]">
                {Number.isFinite(parsedAmount) && parsedAmount > 0
                  ? formatTry(parsedAmount)
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0f1f1d]/40">
                {placeholders.deliveryLabel}
              </p>
              <p className="mt-1 text-[17px] font-semibold text-[#0f1f1d]">
                {deliveryDays ? `${deliveryDays} gün` : "Belirtilmedi"}
              </p>
            </div>
          </div>

          <div className="px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0f1f1d]/40">
              Açıklama
            </p>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-7 text-[#0f1f1d]/78">
              {description}
            </p>
          </div>

          {!isRevise && photos.length > 0 ? (
            <div className="border-t border-teal-900/[0.06] px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0f1f1d]/40">
                Ürün fotoğrafları
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {photos.map((photo, index) => (
                  <button
                    key={photo.localId}
                    type="button"
                    onClick={() => setPreviewPhotoIndex(index)}
                    className="h-16 w-16 overflow-hidden rounded-[12px] bg-[#eef2f1] ring-1 ring-teal-900/10"
                    aria-label={`${photo.name} önizle`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.previewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="border-t border-teal-900/[0.06] px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0f1f1d]/40">
              Teklif kalitesi
            </p>
            <p className="mt-1 text-sm font-semibold text-[#0f1f1d]">
              %{completeness.score} · {completeness.label}
            </p>
            {strengthenLabels.length > 0 ? (
              <p className="mt-1 text-xs text-[#0f1f1d]/50">
                Eksik: {strengthenLabels.join(", ")}
              </p>
            ) : (
              <p className="mt-1 text-xs text-teal-800/80">
                Temel alanlar dolu — karşılaştırmada güçlüsünüz.
              </p>
            )}
          </div>
        </article>

        {previewPhotoIndex != null && photos[previewPhotoIndex] ? (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f1f1d]/72 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Fotoğraf önizleme"
            onClick={() => setPreviewPhotoIndex(null)}
          >
            <div
              className="relative max-h-[min(88vh,720px)] w-full max-w-3xl overflow-hidden rounded-[18px] bg-[#111716]"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setPreviewPhotoIndex(null)}
                className="absolute right-3 top-3 z-10 rounded-full border border-white/15 bg-black/40 p-2 text-white"
                aria-label="Önizlemeyi kapat"
              >
                <X className="h-4 w-4" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photos[previewPhotoIndex].previewUrl}
                alt={photos[previewPhotoIndex].name}
                className="max-h-[min(88vh,720px)] w-full object-contain"
              />
            </div>
          </div>
        ) : null}

        {error && (
          <div className="rounded-[14px] bg-[#fff1ee] px-3.5 py-2.5 text-sm text-[#8b352b]">
            {error}
          </div>
        )}

        {quotaExceeded && (
          <div className="rounded-[14px] bg-[#fffbeb] px-3.5 py-2.5 text-sm text-[#78350f]">
            Teklif hakkınız doldu.{" "}
            <Link href="/panel/plan" className="font-semibold underline">
              Planı yükselt
            </Link>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <LetterSendButton
            type="button"
            sending={isSubmitting}
            disabled={!canSubmit}
            onClick={() => void handleConfirmSend()}
            statusLabel={
              isRevise
                ? "Not güncelleniyor…"
                : createdOfferId && photos.length > 0
                  ? "Fotoğraflar yükleniyor…"
                  : "Teklif gönderiliyor…"
            }
            withCloud={false}
          >
            <span className="flex min-w-0 items-center gap-3">
              <Send className="h-4 w-4 shrink-0" />
              <span className="text-base font-semibold">
                {isRevise
                  ? "Notu güncelle"
                  : createdOfferId
                    ? "Fotoğrafları tamamla"
                    : "Teklifi gönder"}
              </span>
            </span>
          </LetterSendButton>

          <button
            type="button"
            onClick={() => setStep("edit")}
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-[14px] px-4 py-2.5 text-sm font-medium text-teal-900/60 transition hover:bg-teal-50 hover:text-teal-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Düzenle
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handlePreview} className="space-y-8">
      {(isRevise || draftApplied || createdOfferId) && (
        <p className="rounded-[14px] bg-teal-50/80 px-3.5 py-2.5 text-sm text-teal-950/80">
          {isRevise
            ? "Teklif tutarı gönderimden sonra değiştirilemez. Açıklamanızı güncelleyebilirsiniz."
            : createdOfferId
              ? "Teklif kaydedildi. Fotoğraf yüklemesini tamamlayın; tutar artık değişmez."
              : "Taslak uygulandı. İstediğiniz alanları düzenleyin."}
        </p>
      )}

      <section className="space-y-4">
        <p className={eyebrowClass}>Teklif</p>

        <label className="block">
          <span className={labelClass}>Teklif başlığı</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={placeholders.title}
            maxLength={120}
            className={fieldClass}
          />
        </label>

        {isRevise ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className={labelClass}>Tutar (₺)</span>
              <p
                className={`${fieldClass} flex items-center font-semibold text-[#0f1f1d]`}
              >
                {Number.isFinite(parsedAmount) && parsedAmount > 0
                  ? formatTry(parsedAmount)
                  : "—"}
              </p>
              <p className={`mt-1.5 ${helperClass}`}>
                Teklif tutarı gönderimden sonra değiştirilemez.
              </p>
            </div>
            <div>
              <span className={labelClass}>{placeholders.deliveryLabel}</span>
              <p
                className={`${fieldClass} flex items-center font-semibold text-[#0f1f1d]`}
              >
                {deliveryDays ? `${deliveryDays} gün` : "Belirtilmedi"}
              </p>
              <p className={`mt-1.5 ${helperClass}`}>
                Teslim süresi gönderimden sonra değiştirilemez.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Tutar (₺)</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-[#536b68]">
                  ₺
                </span>
                <TrMoneyInput
                  required
                  value={amount}
                  onValueChange={setAmount}
                  placeholder={placeholders.amount}
                  className={`${fieldClass} pl-8`}
                />
              </div>
            </label>
            <label className="block">
              <span className={labelClass}>{placeholders.deliveryLabel}</span>
              <input
                inputMode="numeric"
                value={deliveryDays}
                onChange={(event) => setDeliveryDays(event.target.value)}
                placeholder={placeholders.delivery}
                className={fieldClass}
              />
            </label>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <p className={eyebrowClass}>Detay</p>
        <label className="block">
          <span className={labelClass}>Kısa açıklama</span>
          <textarea
            required
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={placeholders.description}
            rows={4}
            className={areaClass}
          />
        </label>
      </section>

      {isRevise && existingOffer?.media && existingOffer.media.length > 0 ? (
        <section className="space-y-3">
          <p className={eyebrowClass}>Görseller</p>
          <p className={helperClass}>
            Fotoğraflar gönderimden sonra değiştirilemez.
          </p>
          <OfferMediaThumbStrip
            offerId={existingOffer.id}
            mediaIds={existingOffer.media.map((item) => item.id)}
          />
        </section>
      ) : null}

      {!isRevise ? (
        <OfferPhotoPicker
          photos={photos}
          onChange={setPhotos}
          disabled={isSubmitting}
        />
      ) : null}

      <section className="rounded-[12px] border border-teal-900/[0.07] bg-[#f6f9f8]/90 px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className={eyebrowClass}>Teklif kalitesi</span>
          <span className="text-[13px] font-semibold tabular-nums text-teal-900">
            %{completeness.score}
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-teal-900/10">
          <div
            className="h-full rounded-full bg-[#0f766e] transition-all"
            style={{ width: `${completeness.score}%` }}
          />
        </div>
        <p className={`mt-2 ${helperClass}`}>
          {strengthenLabels.length > 0
            ? `Güçlendirmek için: ${strengthenLabels.join(" · ")}`
            : "Temel alanlar dolu."}
        </p>
        <p className="sr-only">
          {completeness.missing.length > 0
            ? `Eksik: ${completeness.missing.join(", ")}`
            : "Eksik alan yok"}
        </p>
      </section>

      {!isRevise && !draftApplied ? (
        <div className="opacity-90">
          <OfferDraftComposerLock />
        </div>
      ) : null}

      <div className={`space-y-1 ${helperClass}`}>
        <p>
          {isRevise
            ? "Güncelleme kotadan düşmez."
            : entitlements.quota.isUnlimited
              ? "Profesyonel üyeliğinizle sınırsız teklif verebilirsiniz."
              : `${entitlements.planLabel} · Kalan: ${remainingLabel}`}
        </p>
        {!isRevise ? (
          <p>İletişim bilgileri teklif aşamasında paylaşılmaz.</p>
        ) : null}
      </div>

      {error && (
        <div className="rounded-[14px] bg-[#fff1ee] px-3.5 py-2.5 text-sm text-[#8b352b]">
          {error}
        </div>
      )}

      {quotaExceeded && (
        <div className="rounded-[14px] bg-[#fffbeb] px-3.5 py-2.5 text-sm text-[#78350f]">
          Teklif hakkınız doldu.{" "}
          <Link href="/panel/plan" className="font-semibold underline">
            Planı yükselt
          </Link>
        </div>
      )}

      <div className="flex justify-stretch pt-2 sm:justify-end">
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex h-12 w-full items-center justify-center rounded-[14px] bg-teal-800 text-[15px] font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:min-w-[12rem] sm:px-6"
        >
          Önizle ve devam et
        </button>
      </div>
    </form>
  );
}
