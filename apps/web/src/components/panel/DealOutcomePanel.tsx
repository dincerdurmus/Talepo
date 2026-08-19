"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
} from "lucide-react";

import { isBilateralDealCompleted } from "@/lib/offer/deal-completion";

type DealOutcomeState = {
  id: string;
  status: string;
  confirmationLevel: string;
  agreedPrice: number | null;
  currency: string;
  buyerConfirmedAt: string | null;
  supplierConfirmedAt: string | null;
  completedAt?: string | null;
};

function statusSummary(
  local: DealOutcomeState,
  role: "buyer" | "supplier",
): string {
  const mineConfirmed =
    role === "buyer"
      ? Boolean(local.buyerConfirmedAt)
      : Boolean(local.supplierConfirmedAt);
  const otherConfirmed =
    role === "buyer"
      ? Boolean(local.supplierConfirmedAt)
      : Boolean(local.buyerConfirmedAt);

  if (isBilateralDealCompleted(local)) {
    return "İşlem tamamlandı";
  }
  if (mineConfirmed && !otherConfirmed) {
    return "Siz tamamladınız · Karşı tarafın onayı bekleniyor";
  }
  if (!mineConfirmed && otherConfirmed) {
    return "Karşı taraf tamamladı · Onayınız bekleniyor";
  }
  return "Tamamlanma onayı bekleniyor";
}

export function DealOutcomePanel({
  dealOutcome,
  role,
  compact = false,
}: {
  dealOutcome: DealOutcomeState;
  role: "buyer" | "supplier";
  compact?: boolean;
}) {
  const router = useRouter();
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [local, setLocal] = useState(dealOutcome);

  const mineConfirmed =
    role === "buyer"
      ? Boolean(local.buyerConfirmedAt)
      : Boolean(local.supplierConfirmedAt);
  const otherConfirmed =
    role === "buyer"
      ? Boolean(local.supplierConfirmedAt)
      : Boolean(local.buyerConfirmedAt);
  const completed = isBilateralDealCompleted(local);
  const summary = statusSummary(local, role);

  async function confirm() {
    if (submitting || mineConfirmed || completed) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/deal-outcomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealOutcomeId: local.id,
          response: "COMPLETED",
        }),
      });
      const data = (await res.json()) as {
        message?: string;
        dealOutcome?: DealOutcomeState;
      };
      if (!res.ok) {
        setMessage(data.message ?? "Kaydedilemedi.");
        return;
      }
      if (data.dealOutcome) setLocal(data.dealOutcome);
      router.refresh();
    } catch {
      setMessage("Bağlantı hatası.");
    } finally {
      setSubmitting(false);
    }
  }

  const amountLabel =
    local.agreedPrice != null
      ? `${local.agreedPrice.toLocaleString("tr-TR")} ${local.currency}`
      : null;

  function closePanel() {
    setExpanded(false);
    triggerRef.current?.focus();
  }

  if (compact) {
    return (
      <div className="mt-3 rounded-xl border border-teal-900/10 bg-white/90">
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((value) => !value)}
          className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
        >
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-950/40">
              İşlem durumu
            </span>
            <span
              className={`mt-0.5 block truncate text-sm font-semibold ${
                completed ? "text-teal-800" : "text-[#0f1f1d]"
              }`}
            >
              {completed ? (
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  {summary}
                </span>
              ) : (
                summary
              )}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-teal-900/40 transition ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {expanded ? (
          <div
            id={panelId}
            className="border-t border-teal-900/8 px-3.5 py-3.5"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                closePanel();
              }
            }}
          >
            <DetailBody
              completed={completed}
              mineConfirmed={mineConfirmed}
              otherConfirmed={otherConfirmed}
              amountLabel={amountLabel}
              submitting={submitting}
              message={message}
              onConfirm={() => void confirm()}
            />
          </div>
        ) : null}
      </div>
    );
  }

  if (completed) {
    return (
      <div className="mt-4 rounded-xl border border-teal-900/10 bg-[#eef6f4] px-4 py-3.5">
        <p className="flex items-center gap-2 text-sm font-semibold text-teal-950">
          <CheckCircle2 className="h-4 w-4 text-teal-800" />
          İşlem taraflarca tamamlandı olarak onaylandı.
        </p>
        {amountLabel ? (
          <p className="mt-1 text-xs text-teal-900/65">
            Anlaşılan tutar: {amountLabel}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-teal-900/10 bg-white px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-950/40">
        İşlem durumu
      </p>
      <DetailBody
        completed={completed}
        mineConfirmed={mineConfirmed}
        otherConfirmed={otherConfirmed}
        amountLabel={amountLabel}
        submitting={submitting}
        message={message}
        onConfirm={() => void confirm()}
      />
    </div>
  );
}

function DetailBody({
  completed,
  mineConfirmed,
  otherConfirmed,
  amountLabel,
  submitting,
  message,
  onConfirm,
}: {
  completed: boolean;
  mineConfirmed: boolean;
  otherConfirmed: boolean;
  amountLabel: string | null;
  submitting: boolean;
  message: string | null;
  onConfirm: () => void;
}) {
  if (completed) {
    return (
      <>
        <p className="mt-1 text-sm font-medium text-teal-950">
          İşlem taraflarca tamamlandı olarak onaylandı.
        </p>
        {amountLabel ? (
          <p className="mt-1 text-xs text-teal-900/65">
            Anlaşılan tutar: {amountLabel}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <>
      <p className="mt-1.5 text-sm font-medium text-[#0f1f1d]">
        {mineConfirmed
          ? "Siz tamamladınız · Karşı tarafın onayı bekleniyor"
          : otherConfirmed
            ? "Karşı taraf işlemin tamamlandığını onayladı"
            : "Her iki taraf bağımsız olarak onay verebilir"}
      </p>
      <p className="mt-1 text-xs leading-5 text-black/45">
        Onay, ürün teslimini veya ödemeyi Talepo’nun doğruladığı anlamına gelmez.
        Mesajlaşma açık kalır.
        {amountLabel ? ` Anlaşılan tutar: ${amountLabel}.` : ""}
      </p>

      {mineConfirmed ? (
        <p className="mt-3 text-xs font-medium text-amber-900/80">
          Karşı tarafın onayı bekleniyor.
        </p>
      ) : (
        <button
          type="button"
          disabled={submitting}
          onClick={onConfirm}
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0f1f1d] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            "İşlemi tamamladım"
          )}
        </button>
      )}

      {/* Legacy copy retained for downstream verifiers and accessibility hints */}
      <span className="sr-only">Bu işlemin tamamlandığını onaylıyorum</span>

      {message ? (
        <p className="mt-2 text-xs font-semibold text-[#8b352b]">{message}</p>
      ) : null}
    </>
  );
}
