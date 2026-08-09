"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoaderCircle, Sparkles, WandSparkles } from "lucide-react";

import { OFFER_DRAFT_STORAGE_KEY } from "@/components/panel/AiAssistantPanel";
import type { EntitlementDTO } from "@/lib/membership/serialize";
import { formatQuotaRemaining } from "@/lib/membership/serialize";

type OfferFormProps = {
  requestId: string;
  entitlements: EntitlementDTO;
};

type StoredDraft = {
  requestId: string;
  description: string;
  amount: number;
  deliveryDays: number;
};

export function OfferForm({ requestId, entitlements }: OfferFormProps) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<StoredDraft | null>(null);

  const remainingLabel = formatQuotaRemaining(entitlements.quota);
  const canSubmit =
    entitlements.quota.isUnlimited ||
    (entitlements.quota.remaining !== null && entitlements.quota.remaining > 0);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(OFFER_DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredDraft;
      if (parsed.requestId === requestId) {
        setPendingDraft(parsed);
      }
    } catch {
      // ignore invalid storage
    }
  }, [requestId]);

  function applyDraft() {
    if (!pendingDraft) return;
    setDescription(pendingDraft.description);
    setAmount(String(pendingDraft.amount));
    setDeliveryDays(String(pendingDraft.deliveryDays));
    sessionStorage.removeItem(OFFER_DRAFT_STORAGE_KEY);
    setPendingDraft(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setQuotaExceeded(false);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          description,
          amount: Number(amount.replace(/\./g, "")),
          deliveryDays: deliveryDays ? Number(deliveryDays) : undefined,
        }),
      });

      const result = (await response.json()) as {
        message?: string;
        code?: string;
        redirectTo?: string;
      };

      if (!response.ok) {
        if (result.code === "OFFER_QUOTA_EXCEEDED") {
          setQuotaExceeded(true);
        }
        throw new Error(result.message || "Teklif gönderilemedi.");
      }

      sessionStorage.removeItem(OFFER_DRAFT_STORAGE_KEY);
      router.push(result.redirectTo || `/panel/talepler/${requestId}`);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Teklif gönderilirken bir hata oluştu.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-[20px] bg-[#f6f6f2] p-4 text-sm text-black/55">
        <p>
          Plan: <strong>{entitlements.planLabel}</strong> · Kalan teklif:{" "}
          <strong>{remainingLabel}</strong>
        </p>
        {!entitlements.features.instant_request_access && (
          <p className="mt-2 text-xs text-black/40">
            Standart erişim: yeni talepler 24 saat gecikmeyle açılır. Premium ile
            anında erişin.
          </p>
        )}
        {entitlements.features.ai_offer_assistant && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-teal-800">
            <WandSparkles className="h-3.5 w-3.5" />
            AI teklif asistanı açık.{" "}
            <Link
              href={`/panel/asistan?request=${requestId}`}
              className="font-semibold underline"
            >
              Bu talep için taslak üret
            </Link>
          </p>
        )}
      </div>

      {pendingDraft && (
        <div className="rounded-[16px] border border-amber-200/70 bg-gradient-to-r from-[#fffbeb] to-[#fef3c7] p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-950">
            <Sparkles className="h-4 w-4 text-amber-700" />
            AI taslağı hazır
          </p>
          <p className="mt-1 text-xs text-amber-900/70">
            Önerilen tutar ₺{pendingDraft.amount.toLocaleString("tr-TR")} ·{" "}
            {pendingDraft.deliveryDays} gün teslim
          </p>
          <button
            type="button"
            onClick={applyDraft}
            className="mt-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-semibold text-white"
          >
            Taslağı forma uygula
          </button>
        </div>
      )}

      <label className="block">
        <span className="mb-2 block text-xs font-medium text-black/40">
          Teklif tutarı (₺)
        </span>
        <input
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Örn. 15000"
          className="h-13 w-full rounded-[17px] border border-black/[0.07] bg-[#fafaf8] px-4 text-sm font-medium outline-none"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-xs font-medium text-black/40">
          Teslim süresi (gün)
        </span>
        <input
          value={deliveryDays}
          onChange={(event) => setDeliveryDays(event.target.value)}
          placeholder="Örn. 7"
          className="h-13 w-full rounded-[17px] border border-black/[0.07] bg-[#fafaf8] px-4 text-sm font-medium outline-none"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-xs font-medium text-black/40">
          Teklif açıklaması
        </span>
        <textarea
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Ürün/hizmet detayı, garanti, teslim koşulları..."
          className="min-h-[140px] w-full rounded-[17px] border border-black/[0.07] bg-[#fafaf8] px-4 py-3 text-sm leading-6 outline-none"
        />
        <p className="mt-2 text-xs text-black/35">
          Telefon, IBAN ve platform dışı iletişim bilgisi paylaşılamaz.
        </p>
      </label>

      {error && (
        <div className="rounded-[16px] bg-[#ffe4df] p-3 text-sm font-semibold text-[#8b352b]">
          {error}
        </div>
      )}

      {quotaExceeded && (
        <div className="rounded-[16px] border border-amber-200/60 bg-[#fffbeb] p-4 text-sm text-[#78350f]">
          <p className="font-semibold">Aylık ücretsiz teklif hakkınız doldu.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="/panel/plan"
              className="rounded-full bg-gradient-to-r from-teal-700 to-teal-800 px-4 py-2 text-xs font-semibold text-white"
            >
              Premium&apos;a geç
            </a>
            <a
              href="/panel/plan#credits"
              className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold"
            >
              Ek teklif satın al
            </a>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || !canSubmit}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-black px-5 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSubmitting ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Gönderiliyor...
          </>
        ) : (
          "Teklif gönder"
        )}
      </button>
    </form>
  );
}
