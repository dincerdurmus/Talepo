"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  Info,
  LoaderCircle,
} from "lucide-react";

import { NegotiationTimeline } from "@/components/panel/NegotiationTimeline";
import { TrMoneyInput } from "@/components/ui/TrMoneyInput";
import { formatTrNumber, parseTrNumber } from "@/lib/format/tr-number";
import { resolveOfferCommercialAmount } from "@/lib/offer/commercial-amount";
import {
  buildNegotiationHistory,
  currentTurnCopy,
  proposalTitle,
} from "@/lib/offer/negotiation-history";
import type { OfferNegotiationDto } from "@/lib/offer/offer-negotiation";

type OfferNegotiationPanelProps = {
  offerId: string;
  originalAmount: number;
  currency: string;
  offerStatus: string;
  viewer: "buyer" | "provider";
  negotiations: OfferNegotiationDto[];
  canMutate: boolean;
  hideTriggers?: boolean;
  composerOpen?: boolean;
  onComposerOpenChange?: (open: boolean) => void;
  onBusyChange?: (busy: string | null) => void;
  onProposeSuccess?: () => void;
  bargainCopy?: boolean;
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
  // Role-surface copy authority used by verifiers and legacy surfaces.
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
  hideTriggers = false,
  composerOpen,
  onComposerOpenChange,
  onBusyChange,
  onProposeSuccess,
  bargainCopy = false,
}: OfferNegotiationPanelProps) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = composerOpen ?? uncontrolledOpen;

  useEffect(() => {
    onBusyChange?.(pending);
  }, [pending, onBusyChange]);

  function setOpen(next: boolean) {
    onComposerOpenChange?.(next);
    if (composerOpen === undefined) setUncontrolledOpen(next);
  }

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
      if (action === "propose" && onProposeSuccess) {
        onProposeSuccess();
        return;
      }
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
      setError(
        bargainCopy
          ? "Geçerli bir fiyat girin."
          : "Geçerli bir karşı teklif tutarı girin.",
      );
      return;
    }
    void post("propose", parsed);
  }

  const proposeCta = bargainCopy ? "Pazarlık yap" : "Karşı teklif ver";
  const formTitle = bargainCopy ? "Pazarlık yap" : "Karşı teklifiniz";
  const formHelp = bargainCopy
    ? viewer === "provider"
      ? "Yeni fiyatınızı iletin; alıcı kabul edebilir veya farklı bir fiyat önerebilir."
      : "Yeni fiyatınızı iletin; satıcı kabul edebilir veya yeni bir fiyat önerebilir."
    : "Karşı teklifiniz karşı tarafa iletilir. İlk teklif tutarı değişmez.";
  const submitLabel = bargainCopy ? "Pazarlık teklifini gönder" : "Teklif et";
  const hasNegotiationEvents = negotiations.length > 0;
  const showNegotiationState =
    !hideTriggers &&
    (Boolean(pendingRow) || Boolean(acceptedRow) || hasNegotiationEvents);
  const showShell =
    !hideTriggers || open || Boolean(error) || showNegotiationState;
  const historyViewer = viewer === "buyer" ? "buyer" : "seller";
  const timelineEvents = showNegotiationState
    ? buildNegotiationHistory({
        viewer: historyViewer,
        originalAmount,
        currency,
        offerStatus,
        negotiations,
      })
    : [];
  const turnCopy = currentTurnCopy(historyViewer, offerStatus, negotiations);
  const historyMoves = timelineEvents.length;

  const currentAmount = pendingRow
    ? pendingRow.amount
    : acceptedRow
      ? commercial
      : originalAmount;
  const currentCaption = pendingRow
    ? myPending
      ? bargainCopy
        ? "Son öneriniz"
        : sideLabel(pendingRow.proposedBySide, viewer)
      : proposalTitle(historyViewer, pendingRow.proposedBySide)
    : acceptedRow
      ? "Anlaşılan fiyat"
      : "İlk teklif";
  const currentTone = pendingRow
    ? "text-amber-950"
    : acceptedRow
      ? "text-teal-900"
      : "text-[#0f1f1d]";

  if (!showShell) return null;

  return (
    <div className={hideTriggers ? "mt-2.5" : "mt-2.5"}>
      {showNegotiationState ? (
        <div className="rounded-[14px] border border-teal-900/8 bg-[#f7faf9]/80 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-950/40">
              Pazarlık
            </p>
            {myPending && awaiting ? (
              <span className="inline-flex rounded-full border border-amber-200/70 bg-amber-50/80 px-2 py-0.5 text-[10px] font-semibold text-amber-950/75">
                Yanıt bekleniyor
              </span>
            ) : null}
            {canRespond ? (
              <span className="inline-flex rounded-full border border-teal-200/60 bg-teal-50/70 px-2 py-0.5 text-[10px] font-semibold text-teal-900/75">
                Sıra sizde
              </span>
            ) : null}
          </div>
          <p className={`mt-1 text-[1.05rem] font-semibold tabular-nums tracking-tight ${currentTone}`}>
            {formatMoneyLabel(currentAmount, currency)}
          </p>
          <p className="mt-0.5 text-[12px] font-medium text-[#0f1f1d]/60">
            {currentCaption}
          </p>
          {turnCopy ? (
            <p className="mt-1 text-[11px] leading-4 text-black/40">
              {myPending
                ? `Yanıt bekleniyor · ${turnCopy.toLocaleLowerCase("tr-TR")}`
                : turnCopy}
            </p>
          ) : null}

          {hasNegotiationEvents ? (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setHistoryOpen((value) => !value)}
                aria-expanded={historyOpen}
                className="inline-flex min-h-9 w-full items-center justify-between gap-2 rounded-[10px] border border-teal-900/6 bg-white/70 px-2.5 text-left text-[11px] font-semibold text-teal-950/65 transition hover:bg-white"
              >
                <span>
                  {historyOpen
                    ? "Geçmişi gizle"
                    : `Pazarlık geçmişi · ${historyMoves} hareket`}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 text-black/35 transition ${
                    historyOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden
                />
              </button>
              {historyOpen ? (
                <NegotiationTimeline events={timelineEvents} />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {!hideTriggers && canRespond ? (
        <div className="mt-2.5 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            disabled={Boolean(pending)}
            onClick={() => void post("reject")}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-rose-200/60 bg-white px-3 text-xs font-semibold text-rose-800/80 disabled:opacity-50 sm:order-1"
          >
            {pending === "reject" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : viewer === "buyer" ? (
              "Karşı teklifi reddet"
            ) : (
              "Reddet"
            )}
          </button>
          <button
            type="button"
            disabled={Boolean(pending)}
            onClick={() => setOpen(true)}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-indigo-200/70 bg-indigo-50/60 px-3 text-xs font-semibold text-indigo-950 disabled:opacity-50 sm:order-2"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {proposeCta}
          </button>
          <button
            type="button"
            disabled={Boolean(pending)}
            onClick={() => void post("accept")}
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#0f766e] px-3.5 text-xs font-semibold text-white disabled:opacity-50 sm:order-3"
          >
            {pending === "accept" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : pendingRow ? (
              `Kabul et · ${formatMoneyLabel(pendingRow.amount, currency)}`
            ) : (
              "Kabul et"
            )}
          </button>
        </div>
      ) : null}

      {!hideTriggers && canPropose && !canRespond ? (
        <button
          type="button"
          disabled={Boolean(pending)}
          onClick={() => setOpen(true)}
          className="mt-2.5 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-indigo-200/70 bg-indigo-50/60 px-3 text-xs font-semibold text-indigo-950 disabled:opacity-50"
        >
          <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {proposeCta}
        </button>
      ) : null}

      {!hideTriggers && myPending && awaiting ? (
        <p className="mt-2 flex gap-2 text-[11px] leading-5 text-black/40">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-black/30" aria-hidden />
          <span>
            {viewer === "provider"
              ? "Sıra alıcıda. Karşı teklifiniz yanıtlanınca pazarlık devam eder veya anlaşma oluşur."
              : "Sıra teklif verende. Yanıt gelince pazarlık devam eder veya anlaşma oluşur."}
          </span>
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 text-xs font-semibold text-[#8b352b]">{error}</p>
      ) : null}

      {open ? (
        <div className="mt-2.5 rounded-xl border border-teal-900/10 bg-[#f7faf9] p-3 motion-safe:animate-[txn-morph-in_280ms_cubic-bezier(0.22,1,0.36,1)_forwards]">
          <p className="text-sm font-medium text-[#0f1f1d]">{formTitle}</p>
          <p className="mt-1 text-[11px] leading-5 text-black/45">{formHelp}</p>
          <TrMoneyInput
            value={amount}
            onValueChange={setAmount}
            placeholder={formatTrNumber(originalAmount)}
            aria-label={bargainCopy ? "Yeni pazarlık fiyatı" : "Karşı teklif tutarı"}
            className="mt-2 h-11 w-full rounded-xl border border-teal-900/10 bg-white px-3.5 text-sm outline-none focus:border-teal-700/25 focus:ring-2 focus:ring-teal-700/10"
          />
          <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={Boolean(pending)}
              onClick={submitPropose}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0f1f1d] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending === "propose" ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                  Gönderiliyor…
                </>
              ) : (
                submitLabel
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
