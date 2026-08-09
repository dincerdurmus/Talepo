"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Send, WandSparkles } from "lucide-react";

import { OFFER_DRAFT_STORAGE_KEY } from "@/components/panel/AiAssistantPanel";
import {
  LetterSendButton,
  waitForLetterSend,
} from "@/components/panel/LetterSendButton";
import { TrMoneyInput } from "@/components/ui/TrMoneyInput";
import { formatTrNumber, parseTrNumber } from "@/lib/format/tr-number";
import { scoreOfferCompleteness } from "@/lib/offer/offer-completeness";
import type { EntitlementDTO } from "@/lib/membership/serialize";
import { formatQuotaRemaining } from "@/lib/membership/serialize";

type ExistingOfferValues = {
  id: string;
  description: string;
  amount: number;
  deliveryDays: number | null;
};

type OfferFormProps = {
  requestId: string;
  entitlements: EntitlementDTO;
  categorySlug?: string;
  budgetMin?: number | null;
  existingOffer?: ExistingOfferValues | null;
};

type StoredDraft = {
  requestId: string;
  description: string;
  amount: number;
  deliveryDays: number;
};

const fieldClass =
  "h-12 w-full rounded-xl border border-teal-900/8 bg-[#f7faf9] px-3.5 text-[15px] text-[#0f1f1d] outline-none transition placeholder:text-black/30 focus:border-teal-700/25 focus:bg-white focus:ring-2 focus:ring-teal-700/10";

const areaClass =
  "min-h-[120px] w-full resize-y rounded-xl border border-teal-900/8 bg-[#f7faf9] px-3.5 py-3 text-[15px] leading-6 text-[#0f1f1d] outline-none transition placeholder:text-black/30 focus:border-teal-700/25 focus:bg-white focus:ring-2 focus:ring-teal-700/10";

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
      description: "Kira, depozito, gösterim ve dahil olanlar…",
    };
  }

  return {
    amount: budgetHint,
    delivery: "Örn. 7",
    deliveryLabel: "Teslim (gün)",
    description: "Kapsam, garanti ve teslim koşulları…",
  };
}

function formatTry(amount: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function OfferForm({
  requestId,
  entitlements,
  categorySlug,
  budgetMin,
  existingOffer = null,
}: OfferFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const applyDraftFromQuery = searchParams.get("taslak") === "1";
  const isRevise = Boolean(existingOffer);

  const [step, setStep] = useState<"edit" | "preview">("edit");
  const [description, setDescription] = useState(
    existingOffer?.description ?? "",
  );
  const [amount, setAmount] = useState(
    existingOffer ? formatTrNumber(existingOffer.amount) : "",
  );
  const [deliveryDays, setDeliveryDays] = useState(
    existingOffer?.deliveryDays ? String(existingOffer.deliveryDays) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftApplied, setDraftApplied] = useState(false);

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

    setDescription(draft.description);
    setAmount(formatTrNumber(draft.amount));
    setDeliveryDays(draft.deliveryDays ? String(draft.deliveryDays) : "");
    sessionStorage.removeItem(OFFER_DRAFT_STORAGE_KEY);
    setDraftApplied(true);
    router.replace(`/panel/talepler/${requestId}/teklif`, { scroll: false });
  }, [applyDraftFromQuery, isRevise, requestId, router]);

  function validateFields(): string | null {
    const parsedAmount = parseTrNumber(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return "Geçerli bir teklif tutarı girin.";
    }
    if (!description.trim()) {
      return "Kısa açıklama gerekli.";
    }
    if (deliveryDays) {
      const days = Number(deliveryDays);
      if (!Number.isFinite(days) || days <= 0) {
        return "Yanıt / teslim süresi geçerli bir gün olmalı.";
      }
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

    try {
      const payload = {
        description,
        amount: parseTrNumber(amount),
        deliveryDays: deliveryDays ? Number(deliveryDays) : null,
      };

      const response = await fetch(
        isRevise && existingOffer
          ? `/api/offers/${existingOffer.id}`
          : "/api/offers",
        {
          method: isRevise ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isRevise ? payload : { ...payload, requestId },
          ),
        },
      );

      const result = (await response.json()) as {
        message?: string;
        code?: string;
        redirectTo?: string;
      };

      if (!response.ok) {
        if (result.code === "OFFER_QUOTA_EXCEEDED") {
          setQuotaExceeded(true);
        }
        throw new Error(
          result.message ||
            (isRevise ? "Teklif güncellenemedi." : "Teklif gönderilemedi."),
        );
      }

      sessionStorage.removeItem(OFFER_DRAFT_STORAGE_KEY);
      await waitForLetterSend(startedAt);
      router.push(
        result.redirectTo ||
          (isRevise
            ? `/panel/teklifler?guncellendi=1`
            : `/panel/teklifler?gonderildi=1`),
      );
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : isRevise
            ? "Teklif güncellenirken bir hata oluştu."
            : "Teklif gönderilirken bir hata oluştu.",
      );
      setIsSubmitting(false);
      setStep("edit");
    }
  }

  const parsedAmount = parseTrNumber(amount);
  const deliveryNum = deliveryDays ? Number(deliveryDays) : null;
  const completeness = scoreOfferCompleteness({
    amount: Number.isFinite(parsedAmount) ? parsedAmount : null,
    deliveryDays:
      deliveryNum != null && Number.isFinite(deliveryNum) && deliveryNum > 0
        ? deliveryNum
        : null,
    description,
    title: null,
    validUntil: null,
  });

  if (step === "preview") {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-sm text-teal-900/50">Son kontrol</p>
          <h3 className="mt-0.5 text-lg font-semibold tracking-tight text-[#0f1f1d]">
            Teklifiniz şöyle görünecek
          </h3>
        </div>

        <div className="overflow-hidden rounded-2xl border border-teal-900/8 bg-[#f7faf9]">
          <div className="grid grid-cols-2 divide-x divide-teal-900/8 border-b border-teal-900/8">
            <div className="px-4 py-3.5">
              <p className="text-xs text-teal-900/45">Tutar</p>
              <p className="mt-1 text-base font-semibold text-[#0f1f1d]">
                {Number.isFinite(parsedAmount) && parsedAmount > 0
                  ? formatTry(parsedAmount)
                  : "—"}
              </p>
            </div>
            <div className="px-4 py-3.5">
              <p className="text-xs text-teal-900/45">
                {placeholders.deliveryLabel}
              </p>
              <p className="mt-1 text-base font-semibold text-[#0f1f1d]">
                {deliveryDays ? `${deliveryDays} gün` : "Belirtilmedi"}
              </p>
            </div>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-xs text-teal-900/45">Açıklama</p>
            <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-[#0f1f1d]/80">
              {description}
            </p>
          </div>
          <div className="border-t border-teal-900/8 px-4 py-3.5">
            <p className="text-xs text-teal-900/45">Alıcı karşılaştırması</p>
            <p className="mt-1 text-sm font-semibold text-[#0f1f1d]">
              Doluluk {completeness.score}% · {completeness.label}
            </p>
            {completeness.missing.length > 0 ? (
              <p className="mt-1 text-xs text-amber-800/80">
                Eksik: {completeness.missing.join(", ")}
              </p>
            ) : (
              <p className="mt-1 text-xs text-emerald-700">
                Temel alanlar dolu — karşılaştırmada güçlüsünüz.
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-[#fff1ee] px-3.5 py-2.5 text-sm text-[#8b352b]">
            {error}
          </div>
        )}

        {quotaExceeded && (
          <div className="rounded-xl bg-[#fffbeb] px-3.5 py-2.5 text-sm text-[#78350f]">
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
              isRevise ? "Teklif güncelleniyor…" : "Teklif gönderiliyor…"
            }
            withCloud={false}
          >
            <span className="flex min-w-0 items-center gap-3">
              <Send className="h-4 w-4 shrink-0" />
              <span className="text-base font-semibold">
                {isRevise ? "Güncellemeyi gönder" : "Teklifi gönder"}
              </span>
            </span>
          </LetterSendButton>

          <button
            type="button"
            onClick={() => setStep("edit")}
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-teal-900/60 transition hover:bg-teal-50 hover:text-teal-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Düzenle
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handlePreview} className="space-y-4">
      {(isRevise || draftApplied) && (
        <p className="rounded-xl bg-teal-50/80 px-3.5 py-2.5 text-sm text-teal-950/80">
          {isRevise
            ? "Mevcut teklifiniz yüklendi. Değiştirip önizleyebilirsiniz."
            : "AI taslağı uygulandı. İstediğiniz alanları düzenleyin."}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm text-teal-950/55">
            Tutar (₺)
          </span>
          <TrMoneyInput
            required
            value={amount}
            onValueChange={setAmount}
            placeholder={placeholders.amount}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-teal-950/55">
            {placeholders.deliveryLabel}
          </span>
          <input
            inputMode="numeric"
            value={deliveryDays}
            onChange={(event) => setDeliveryDays(event.target.value)}
            placeholder={placeholders.delivery}
            className={fieldClass}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm text-teal-950/55">
          Kısa açıklama
        </span>
        <textarea
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={placeholders.description}
          rows={4}
          className={areaClass}
        />
      </label>

      <div className="rounded-xl border border-teal-900/8 bg-[#f7faf9] px-3.5 py-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-teal-950/60">
            Teklif doluluğu · {completeness.label}
          </span>
          <span className="tabular-nums font-semibold text-teal-900">
            {completeness.score}%
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-teal-900/10">
          <div
            className="h-full rounded-full bg-[#0f766e] transition-all"
            style={{ width: `${completeness.score}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] leading-5 text-teal-950/45">
          {completeness.missing.length > 0
            ? `Daha güçlü görünmek için: ${completeness.missing.join(", ")}. Alıcı birden fazla teklifte doluluğa göre sıralar.`
            : "Temel alanlar dolu. Alıcı karşılaştırmasında avantajlısınız."}
        </p>
      </div>

      {!isRevise &&
        !draftApplied &&
        entitlements.features.ai_offer_assistant && (
          <Link
            href={`/panel/asistan?request=${requestId}`}
            className="inline-flex items-center gap-1.5 text-sm text-teal-800/70 transition hover:text-teal-900"
          >
            <WandSparkles className="h-3.5 w-3.5" />
            AI ile taslak oluştur
          </Link>
        )}

      <p className="text-xs text-black/35">
        {isRevise
          ? "Güncelleme kotadan düşmez."
          : `${entitlements.planLabel} · ${
              entitlements.quota.isUnlimited
                ? "Sınırsız teklif"
                : `Kalan: ${remainingLabel}`
            }`}
        {" · "}
        Telefon / IBAN yazmayın.
      </p>

      {error && (
        <div className="rounded-xl bg-[#fff1ee] px-3.5 py-2.5 text-sm text-[#8b352b]">
          {error}
        </div>
      )}

      {quotaExceeded && (
        <div className="rounded-xl bg-[#fffbeb] px-3.5 py-2.5 text-sm text-[#78350f]">
          Teklif hakkınız doldu.{" "}
          <Link href="/panel/plan" className="font-semibold underline">
            Planı yükselt
          </Link>
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="flex h-12 w-full items-center justify-center rounded-xl bg-teal-800 text-[15px] font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Önizle ve devam et
      </button>
    </form>
  );
}
