"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";

import { TrMoneyInput } from "@/components/ui/TrMoneyInput";
import { formatTrNumber, parseTrNumber } from "@/lib/format/tr-number";
import { resolveOfferCommercialAmount } from "@/lib/offer/commercial-amount";
import type { OfferNegotiationDto } from "@/lib/offer/offer-negotiation";

type OfferNegotiationPanelProps = {
  offerId: string;
  originalAmount: number;
  currency: string;
  offerStatus: string;
  viewer: "buyer" | "provider";
  negotiations: OfferNegotiationDto[];
  canMutate: boolean;
};

function formatMoneyLabel(amount: number, currency: string) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: currency === "USD" || currency === "EUR" || currency === "GBP" ? currency : "TRY",
    maximumFractionDigits: 0,
  }).format(amount);
}

function sideLabel(
  side: OfferNegotiationDto["proposedBySide"],
  viewer: "buyer" | "provider",
) {
  if (viewer === "buyer") {
    return side === "BUYER" ? "Sizin öneriniz" : "Teklif verenin önerisi";
  }
  return side === "PROVIDER" ? "Sizin öneriniz" : "Alıcının önerisi";
}

export function OfferNegotiationPanel({
  offerId,
  originalAmount,
  currency,
  offerStatus,
  viewer,
  negotiations,
  canMutate,
}: OfferNegotiationPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingRow = negotiations.find((row) => row.status === "PENDING");
  const acceptedRow = negotiations.find((row) => row.status === "ACCEPTED");
  const commercial = resolveOfferCommercialAmount({
    offerAmount: originalAmount,
    acceptedNegotiationAmount: acceptedRow?.amount ?? null,
  });
  const awaiting = ["SUBMITTED", "VIEWED"].includes(offerStatus);
  const myPending =
    pendingRow &&
    ((viewer === "buyer" && pendingRow.proposedBySide === "BUYER") ||
      (viewer === "provider" && pendingRow.proposedBySide === "PROVIDER"));
  const canRespond = Boolean(canMutate && awaiting && pendingRow && !myPending);
  const canPropose =
    canMutate &&
    awaiting &&
    (viewer === "buyer" ? !pendingRow || !myPending : Boolean(pendingRow) && !myPending);

  async function post(action: "propose" | "accept" | "reject", nextAmount?: number) {
    if (pending) return;
    setPending(action);
    setError(null);
    try {
      const response = await fetch(`/api/offers/${offerId}/negotiations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "propose" ? { action, amount: nextAmount } : { action },
        ),
      });
      const result = (await response.json()) as {
        message?: string;
        redirectTo?: string;
      };
      if (!response.ok) {
        throw new Error(result.message || "İşlem tamamlanamadı.");
      }
      setOpen(false);
      setAmount("");
      if (result.redirectTo) {
        router.push(result.redirectTo);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başarısız.");
    } finally {
      setPending(null);
    }
  }

  function submitPropose() {
    const parsed = parseTrNumber(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Geçerli bir karşı teklif tutarı girin.");
      return;
    }
    void post("propose", parsed);
  }

  return (
    <div className="mt-3 rounded-xl border border-teal-900/8 bg-white px-3.5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-950/40">
        {pendingRow || negotiations.length > 0 ? "Pazarlık" : "Fiyat"}
      </p>
      <p className="mt-1 text-sm text-[#0f1f1d]">
        <span className="font-semibold">{formatMoneyLabel(originalAmount, currency)}</span>
        <span className="ml-1.5 text-xs text-black/40">İlk teklif</span>
      </p>

      {pendingRow ? (
        <p className="mt-2 text-sm">
          <span className="font-semibold text-amber-900">
            {formatMoneyLabel(pendingRow.amount, currency)}
          </span>
          <span className="ml-1.5 text-xs text-amber-900/70">
            {myPending
              ? "Karşı teklif · sıra karşı tarafta"
              : "Karşı teklif · sıra sizde"}
          </span>
        </p>
      ) : null}

      {acceptedRow ? (
        <p className="mt-2 text-sm">
          <span className="font-semibold text-teal-800">
            {formatMoneyLabel(commercial, currency)}
          </span>
          <span className="ml-1.5 text-xs text-teal-800/70">Anlaşılan fiyat</span>
        </p>
      ) : null}

      {negotiations.length > 0 ? (
        <ol className="mt-3 space-y-1 border-t border-teal-900/8 pt-3">
          {negotiations.map((row) => (
            <li
              key={row.id}
              className="flex items-baseline justify-between gap-3 text-xs text-black/55"
            >
              <span>
                {sideLabel(row.proposedBySide, viewer)}
                {row.status === "SUPERSEDED"
                  ? " · geçersiz"
                  : row.status === "REJECTED"
                    ? " · reddedildi"
                    : row.status === "ACCEPTED"
                      ? " · kabul"
                      : row.status === "CANCELLED"
                        ? " · iptal"
                        : ""}
              </span>
              <span className="tabular-nums font-medium text-[#0f1f1d]/80">
                {formatMoneyLabel(row.amount, currency)}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {canRespond ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={Boolean(pending)}
            onClick={() => void post("accept")}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0f766e] px-3.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {pending === "accept" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : pendingRow ? (
              `Kabul et · ${formatMoneyLabel(pendingRow.amount, currency)}`
            ) : (
              "Kabul et"
            )}
          </button>
          <button
            type="button"
            disabled={Boolean(pending)}
            onClick={() => setOpen(true)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-teal-800/15 bg-teal-50 px-3.5 text-xs font-semibold text-teal-950 disabled:opacity-50"
          >
            Karşı teklif ver
          </button>
          <button
            type="button"
            disabled={Boolean(pending)}
            onClick={() => void post("reject")}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-black/10 px-3.5 text-xs font-semibold text-black/70 disabled:opacity-50"
          >
            {pending === "reject" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : viewer === "buyer" ? (
              "Karşı teklifi reddet"
            ) : (
              "Reddet"
            )}
          </button>
        </div>
      ) : null}

      {canPropose && !canRespond ? (
        <button
          type="button"
          disabled={Boolean(pending)}
          onClick={() => setOpen(true)}
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-teal-800/15 bg-teal-50 px-3.5 text-xs font-semibold text-teal-950 disabled:opacity-50"
        >
          Karşı teklif ver
        </button>
      ) : null}

      {myPending && awaiting ? (
        <p className="mt-2 text-xs text-amber-900/70">
          {viewer === "provider"
            ? "Sıra alıcıda. Karşı teklifiniz yanıtlanınca pazarlık devam eder veya anlaşma oluşur."
            : "Sıra teklif verende. Yanıt gelince pazarlık devam eder veya anlaşma oluşur."}
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 text-xs font-semibold text-[#8b352b]">{error}</p>
      ) : null}

      {open ? (
        <div className="mt-3 rounded-xl border border-teal-900/10 bg-[#f7faf9] p-3">
          <p className="text-sm font-medium text-[#0f1f1d]">Karşı teklifiniz</p>
          <TrMoneyInput
            value={amount}
            onValueChange={setAmount}
            placeholder={formatTrNumber(originalAmount)}
            className="mt-2 h-11 w-full rounded-xl border border-teal-900/10 bg-white px-3.5 text-sm outline-none focus:border-teal-700/25 focus:ring-2 focus:ring-teal-700/10"
          />
          <p className="mt-1.5 text-[11px] leading-5 text-black/40">
            Karşı teklifiniz karşı tarafa iletilir. İlk teklif tutarı değişmez.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={Boolean(pending)}
              onClick={submitPropose}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0f1f1d] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending === "propose" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                "Teklif et"
              )}
            </button>
            <button
              type="button"
              disabled={Boolean(pending)}
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 items-center justify-center px-3 text-sm text-black/45"
            >
              Vazgeç
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
