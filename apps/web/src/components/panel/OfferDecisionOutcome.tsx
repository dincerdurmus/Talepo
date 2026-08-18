"use client";

import { useEffect, useRef } from "react";
import { Clock, LoaderCircle, Scale } from "lucide-react";
import type { ReactNode } from "react";

export type OfferDecisionPhase =
  | "idle"
  | "accept-loading"
  | "accept-success"
  | "reject-confirm"
  | "reject-loading"
  | "reject-success"
  | "negotiate-channel"
  | "negotiate-composer"
  | "negotiation-sending"
  | "negotiation-sent"
  | "negotiation-waiting"
  | "error";

export type OfferRejectVariant = "offer" | "counter";

type OfferDecisionOutcomeProps = {
  phase: OfferDecisionPhase;
  error?: string | null;
  acceptAmountLabel?: string;
  rejectVariant?: OfferRejectVariant;
  waitingMessage?: string;
  waitingHint?: string;
  children?: ReactNode;
  onConfirmReject?: () => void;
  onCancelReject?: () => void;
  confirmRejectBusy?: boolean;
};

type TxnTone = "teal" | "emerald" | "amber" | "rose";

const TONE: Record<
  TxnTone,
  {
    frame: string;
    title: string;
    sub: string;
    hairline: string;
    settled: string;
    signal: string;
    node: string;
    medallion: string;
    ring: string;
    badge: string;
  }
> = {
  teal: {
    frame:
      "border-teal-900/12 bg-white shadow-[0_4px_18px_rgba(15,118,110,0.06)]",
    title: "text-[#0f1f1d]",
    sub: "text-black/50",
    hairline: "bg-teal-900/15",
    settled: "bg-teal-600/45",
    signal: "via-teal-500",
    node: "bg-teal-600",
    medallion: "ring-teal-900/10 text-teal-700",
    ring: "border-teal-500/40",
    badge: "bg-teal-50 text-teal-800 ring-teal-600/15",
  },
  emerald: {
    frame:
      "border-emerald-300/60 bg-gradient-to-r from-emerald-50/70 via-white to-emerald-50/45 shadow-[0_6px_22px_rgba(16,185,129,0.10)]",
    title: "text-emerald-950",
    sub: "text-emerald-950/65",
    hairline: "bg-emerald-600/18",
    settled: "bg-emerald-500/70",
    signal: "via-emerald-500",
    node: "bg-emerald-600",
    medallion: "ring-emerald-500/25 text-emerald-700",
    ring: "border-emerald-500/45",
    badge: "bg-emerald-100/70 text-emerald-800 ring-emerald-600/20",
  },
  amber: {
    frame:
      "border-amber-300/60 bg-gradient-to-r from-amber-50/70 via-white to-teal-50/40 shadow-[0_6px_22px_rgba(180,83,9,0.08)]",
    title: "text-amber-950",
    sub: "text-amber-950/65",
    hairline: "bg-amber-700/18",
    settled: "bg-teal-600/45",
    signal: "via-amber-500",
    node: "bg-amber-500",
    medallion: "ring-amber-500/25 text-amber-800",
    ring: "border-amber-500/40",
    badge: "bg-amber-100/70 text-amber-900 ring-amber-600/20",
  },
  rose: {
    frame:
      "border-rose-200/70 bg-gradient-to-r from-rose-50/60 via-white to-rose-50/40 shadow-[0_4px_18px_rgba(159,18,57,0.06)]",
    title: "text-rose-950",
    sub: "text-rose-950/60",
    hairline: "bg-rose-500/20",
    settled: "bg-rose-400/60",
    signal: "via-rose-400",
    node: "bg-rose-400",
    medallion: "ring-rose-400/25 text-rose-700",
    ring: "border-rose-400/40",
    badge: "bg-rose-100/70 text-rose-800 ring-rose-500/20",
  },
};

function TxnNode({
  tone,
  mode = "static",
}: {
  tone: TxnTone;
  mode?: "static" | "idle" | "pulse";
}) {
  const token = TONE[tone];
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
      <span
        className={`h-1.5 w-1.5 rounded-full ${token.node} ${
          mode === "idle"
            ? "motion-safe:animate-[txn-node-idle_1300ms_ease-in-out_infinite]"
            : mode === "pulse"
              ? "motion-safe:animate-[txn-node-pulse_620ms_cubic-bezier(0.22,1,0.36,1)_forwards]"
              : ""
        }`}
      />
    </span>
  );
}

function TxnTrack({
  tone,
  direction = "none",
  settled = false,
  sever = null,
  speedMs = 1400,
  delayMs = 0,
}: {
  tone: TxnTone;
  direction?: "none" | "forward" | "back" | "both";
  settled?: boolean;
  sever?: "left" | "right" | null;
  speedMs?: number;
  delayMs?: number;
}) {
  const token = TONE[tone];
  const severClass =
    sever === "left"
      ? "motion-safe:animate-[txn-sever-left_420ms_cubic-bezier(0.4,0,0.2,1)_forwards] motion-reduce:opacity-25"
      : sever === "right"
        ? "motion-safe:animate-[txn-sever-right_420ms_cubic-bezier(0.4,0,0.2,1)_forwards] motion-reduce:opacity-25"
        : "";

  return (
    <div className="relative h-[3px] min-w-5 flex-1 overflow-hidden" aria-hidden>
      <span
        className={`absolute inset-x-0 top-[1px] h-px ${token.hairline} ${severClass}`}
      />
      {settled ? (
        <span
          className={`absolute inset-x-0 top-[1px] h-px origin-center ${token.settled} motion-safe:scale-x-0 motion-safe:animate-[txn-line-settle_420ms_cubic-bezier(0.22,1,0.36,1)_forwards]`}
          style={{ animationDelay: `${delayMs}ms` }}
        />
      ) : null}
      {direction === "forward" || direction === "both" ? (
        <span
          className={`absolute inset-y-0 left-0 w-1/5 rounded-full bg-gradient-to-r from-transparent ${token.signal} to-transparent motion-safe:animate-[txn-signal-forward_var(--txn-speed)_linear_infinite] motion-reduce:hidden`}
          style={{ ["--txn-speed" as string]: `${speedMs}ms` }}
        />
      ) : null}
      {direction === "back" || direction === "both" ? (
        <span
          className={`absolute inset-y-0 left-0 w-1/5 rounded-full bg-gradient-to-r from-transparent ${token.signal} to-transparent opacity-70 motion-safe:animate-[txn-signal-back_var(--txn-speed)_linear_infinite] motion-reduce:hidden`}
          style={{
            ["--txn-speed" as string]: `${speedMs}ms`,
            animationDelay: `${Math.round(speedMs / 2)}ms`,
          }}
        />
      ) : null}
    </div>
  );
}

function TxnMedallion({
  tone,
  ring = false,
  converge = false,
  children,
}: {
  tone: TxnTone;
  ring?: boolean;
  converge?: boolean;
  children: ReactNode;
}) {
  const token = TONE[tone];
  return (
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
      {ring ? (
        <span
          aria-hidden
          className={`absolute h-9 w-9 rounded-full border ${token.ring} motion-safe:animate-[txn-ring_620ms_ease-out_forwards] motion-reduce:hidden`}
        />
      ) : null}
      {converge ? (
        <>
          <span
            aria-hidden
            className={`absolute h-1.5 w-1.5 rounded-full ${token.node} motion-safe:animate-[txn-converge-left_520ms_cubic-bezier(0.22,1,0.36,1)_forwards] motion-reduce:hidden`}
          />
          <span
            aria-hidden
            className={`absolute h-1.5 w-1.5 rounded-full ${token.node} motion-safe:animate-[txn-converge-right_520ms_cubic-bezier(0.22,1,0.36,1)_forwards] motion-reduce:hidden`}
          />
        </>
      ) : null}
      <span
        className={`relative flex h-9 w-9 items-center justify-center rounded-full bg-white ring-1 ${token.medallion}`}
      >
        {children}
      </span>
    </span>
  );
}

/** Outcome check drawn from two stroke segments rather than a filled glyph. */
function DigitalCheck() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path
        d="M5 12.6 10 17.4 19 7.2"
        strokeDasharray="26"
        className="motion-safe:animate-[txn-draw_360ms_cubic-bezier(0.65,0,0.35,1)_100ms_backwards] [--txn-dash:26]"
      />
    </svg>
  );
}

/** Two segments that meet to terminate the connection. */
function DigitalCross() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[17px] w-[17px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path
        d="M7.5 7.5 16.5 16.5"
        strokeDasharray="13"
        className="motion-safe:animate-[txn-draw_260ms_ease-out_60ms_backwards] [--txn-dash:13]"
      />
      <path
        d="M16.5 7.5 7.5 16.5"
        strokeDasharray="13"
        className="motion-safe:animate-[txn-draw_260ms_ease-out_200ms_backwards] [--txn-dash:13]"
      />
    </svg>
  );
}

/** Bidirectional exchange arrows for the negotiation outcome. */
function ExchangeGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[17px] w-[17px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path
        d="M4 9.5h13.5M14 6l3.5 3.5"
        strokeDasharray="24"
        className="motion-safe:animate-[txn-draw_300ms_ease-out_60ms_backwards] [--txn-dash:24]"
      />
      <path
        d="M20 14.5H6.5M10 18l-3.5-3.5"
        strokeDasharray="24"
        className="motion-safe:animate-[txn-draw_300ms_ease-out_200ms_backwards] [--txn-dash:24]"
      />
    </svg>
  );
}

function TxnPanel({
  tone,
  busy = false,
  scan = false,
  morph = false,
  rail,
  icon,
  title,
  subtitle,
  badge,
}: {
  tone: TxnTone;
  busy?: boolean;
  scan?: boolean;
  morph?: boolean;
  rail: ReactNode;
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  const token = TONE[tone];
  return (
    <div
      className={`relative overflow-hidden rounded-xl border px-4 py-3.5 ${token.frame} ${
        morph
          ? "motion-safe:animate-[txn-morph-in_320ms_cubic-bezier(0.22,1,0.36,1)_forwards]"
          : "motion-safe:animate-[txn-panel-in_260ms_ease-out_forwards]"
      }`}
      role="status"
      aria-live="polite"
      {...(busy ? { "aria-busy": true } : null)}
      data-offer-txn-panel={tone}
    >
      {scan ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-transparent via-emerald-400/10 to-transparent motion-safe:animate-[txn-scan_640ms_ease-in-out_160ms_forwards] motion-reduce:hidden"
        />
      ) : null}
      <div className="relative">
        {rail}
        <div className="mt-3 flex items-start gap-2.5">
          {icon ? (
            <span className={`mt-px shrink-0 ${token.title}`}>{icon}</span>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className={`text-sm font-semibold ${token.title}`}>{title}</p>
              {badge ? (
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ring-1 ${token.badge}`}
                >
                  {badge}
                </span>
              ) : null}
            </div>
            {subtitle ? (
              <p
                className={`mt-0.5 text-xs font-medium leading-5 tabular-nums ${token.sub}`}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function PriceChip({
  tone,
  label,
  value,
  dotted = false,
  locked = false,
}: {
  tone: TxnTone;
  label: string;
  value: string;
  dotted?: boolean;
  locked?: boolean;
}) {
  const token = TONE[tone];
  return (
    <span
      className={`flex shrink-0 flex-col rounded-lg border px-2.5 py-1 ${
        dotted
          ? "border-dashed border-amber-500/45 bg-amber-50/40"
          : "border-teal-900/12 bg-white"
      } ${locked ? "motion-safe:animate-[txn-chip-lock_360ms_ease-out_forwards]" : ""}`}
    >
      <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-black/35">
        {label}
      </span>
      <span
        className={`text-xs font-semibold tabular-nums tracking-tight ${
          dotted ? "text-amber-900/70" : token.title
        }`}
      >
        {value}
      </span>
    </span>
  );
}

function RejectConfirm({
  busy,
  variant,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  variant: OfferRejectVariant;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const counter = variant === "counter";

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div
      className="rounded-xl border border-rose-200/70 bg-rose-50/50 px-4 py-3.5"
      role="alertdialog"
      aria-labelledby="reject-confirm-title"
      aria-describedby="reject-confirm-body"
    >
      <p id="reject-confirm-title" className="text-sm font-semibold text-[#0f1f1d]">
        {counter
          ? "Bu pazarlık teklifini reddetmek istiyor musunuz?"
          : "Teklifi reddetmek istiyor musunuz?"}
      </p>
      <p id="reject-confirm-body" className="mt-1 text-xs leading-5 text-black/55">
        {counter
          ? "Bu fiyat önerisi reddedilecek. Önceki teklif ve pazarlık geçmişi silinmeyecek."
          : "Bu teklif reddedilecek. Pazarlık geçmişi silinmeyecek."}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          ref={cancelRef}
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium text-black/55 hover:bg-black/[0.03] disabled:opacity-50"
        >
          Vazgeç
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          aria-busy={busy}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#8b352b] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
              Karar işleniyor…
            </>
          ) : counter ? (
            "Pazarlık teklifini reddet"
          ) : (
            "Teklifi reddet"
          )}
        </button>
      </div>
    </div>
  );
}

export function OfferDecisionOutcome({
  phase,
  error,
  acceptAmountLabel,
  rejectVariant = "offer",
  waitingMessage,
  waitingHint,
  children,
  onConfirmReject,
  onCancelReject,
  confirmRejectBusy = false,
}: OfferDecisionOutcomeProps) {
  const showActions =
    phase === "idle" || phase === "error" || phase === "reject-confirm";

  const priceLabel = acceptAmountLabel ?? "";

  return (
    <div className="mt-4 border-t border-teal-900/[0.06] pt-4" data-offer-decision-footer>
      {phase === "accept-loading" ? (
        <TxnPanel
          tone="teal"
          busy
          title="Teklif doğrulanıyor…"
          subtitle={priceLabel ? `Güncel fiyat · ${priceLabel}` : undefined}
          rail={
            <div className="flex items-center gap-2">
              <TxnNode tone="teal" mode="idle" />
              <TxnTrack tone="teal" direction="forward" speedMs={1300} />
              <TxnMedallion tone="teal">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-600 motion-safe:animate-[txn-node-idle_1100ms_ease-in-out_infinite]" />
              </TxnMedallion>
              <TxnTrack tone="teal" direction="back" speedMs={1300} />
              <TxnNode tone="teal" mode="idle" />
            </div>
          }
        />
      ) : null}

      {phase === "accept-success" ? (
        <TxnPanel
          tone="emerald"
          scan
          badge="DOĞRULANDI"
          title="Teklif kabul edildi"
          subtitle={
            priceLabel
              ? `${priceLabel} üzerinden güvenli anlaşma oluştu`
              : "Güvenli anlaşma oluştu"
          }
          rail={
            <div className="flex items-center gap-2">
              <TxnNode tone="emerald" />
              <TxnTrack tone="emerald" settled />
              <TxnMedallion tone="emerald" ring converge>
                <DigitalCheck />
              </TxnMedallion>
              <TxnTrack tone="emerald" settled delayMs={60} />
              <TxnNode tone="emerald" />
            </div>
          }
        />
      ) : null}

      {phase === "reject-confirm" && onConfirmReject && onCancelReject ? (
        <RejectConfirm
          busy={confirmRejectBusy}
          variant={rejectVariant}
          onConfirm={onConfirmReject}
          onCancel={onCancelReject}
        />
      ) : null}

      {phase === "reject-loading" ? (
        <TxnPanel
          tone="rose"
          busy
          title="Karar işleniyor…"
          subtitle={
            rejectVariant === "counter"
              ? "Pazarlık teklifi değerlendiriliyor"
              : "Teklif kaydı güncelleniyor"
          }
          rail={
            <div className="flex items-center gap-2 opacity-70">
              <TxnNode tone="rose" mode="idle" />
              <TxnTrack tone="rose" direction="forward" speedMs={1800} />
              <TxnMedallion tone="rose">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400 motion-safe:animate-[txn-node-idle_1400ms_ease-in-out_infinite]" />
              </TxnMedallion>
              <TxnTrack tone="rose" direction="back" speedMs={1800} />
              <TxnNode tone="rose" mode="idle" />
            </div>
          }
        />
      ) : null}

      {phase === "reject-success" ? (
        <TxnPanel
          tone="rose"
          title={
            rejectVariant === "counter"
              ? "Pazarlık teklifi reddedildi"
              : "Teklif reddedildi"
          }
          subtitle="Geçmiş korunuyor"
          rail={
            <div className="flex items-center gap-2">
              <TxnNode tone="rose" />
              <TxnTrack tone="rose" sever="left" />
              <TxnMedallion tone="rose">
                <DigitalCross />
              </TxnMedallion>
              <TxnTrack tone="rose" sever="right" />
              <TxnNode tone="rose" />
            </div>
          }
        />
      ) : null}

      {phase === "negotiate-channel" || phase === "negotiate-composer" ? (
        <TxnPanel
          tone="amber"
          title="Yeni fiyat önerisi oluştur"
          subtitle="İki taraf arasındaki pazarlık kanalı açıldı"
          rail={
            <div className="flex items-center gap-2">
              <PriceChip
                tone="amber"
                label="Güncel"
                value={priceLabel || "—"}
              />
              <TxnTrack
                tone="amber"
                direction={phase === "negotiate-channel" ? "both" : "none"}
                settled={phase === "negotiate-composer"}
                speedMs={1500}
              />
              <TxnMedallion tone="amber">
                <Scale
                  className="h-[17px] w-[17px] motion-safe:animate-[txn-balance_720ms_cubic-bezier(0.36,0,0.2,1)_forwards]"
                  aria-hidden
                />
              </TxnMedallion>
              <TxnTrack
                tone="amber"
                direction={phase === "negotiate-channel" ? "both" : "none"}
                settled={phase === "negotiate-composer"}
                speedMs={1500}
              />
              <PriceChip
                tone="amber"
                label="Yeni"
                value="Fiyat girin"
                dotted
              />
            </div>
          }
        />
      ) : null}

      {phase === "negotiation-sending" ? (
        <TxnPanel
          tone="amber"
          busy
          title="Fiyat önerisi iletiliyor…"
          subtitle="Karşı tarafa güvenli şekilde gönderiliyor"
          rail={
            <div className="flex items-center gap-2">
              <PriceChip
                tone="amber"
                label="Güncel"
                value={priceLabel || "—"}
              />
              <TxnTrack tone="amber" direction="forward" speedMs={1100} />
              <TxnMedallion tone="amber">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 motion-safe:animate-[txn-node-idle_1000ms_ease-in-out_infinite]" />
              </TxnMedallion>
              <TxnTrack tone="amber" direction="forward" speedMs={1100} />
              <PriceChip tone="amber" label="Yeni" value="Gönderiliyor" dotted locked />
            </div>
          }
        />
      ) : null}

      {phase === "negotiation-sent" ? (
        <TxnPanel
          tone="amber"
          title="Pazarlık teklifiniz iletildi"
          subtitle="Karşı tarafın yanıtı bekleniyor"
          rail={
            <div className="flex items-center gap-2">
              <TxnNode tone="amber" />
              <TxnTrack tone="amber" settled />
              <TxnMedallion tone="amber" ring>
                <ExchangeGlyph />
              </TxnMedallion>
              <TxnTrack tone="amber" settled delayMs={60} />
              <TxnNode tone="teal" mode="pulse" />
            </div>
          }
        />
      ) : null}

      {phase === "negotiation-waiting" ? (
        <TxnPanel
          tone="teal"
          morph
          icon={<Clock className="h-4 w-4 text-teal-700/80" aria-hidden />}
          title={waitingMessage ?? "Karşı tarafın yanıtı bekleniyor"}
          subtitle={waitingHint ?? "Yanıt geldiğinde bildirim alırsınız."}
          rail={
            <div className="flex items-center gap-2">
              <TxnNode tone="teal" />
              <TxnTrack tone="teal" settled />
              <TxnMedallion tone="teal">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-600/70" />
              </TxnMedallion>
              <TxnTrack tone="teal" settled delayMs={40} />
              <TxnNode tone="teal" mode="idle" />
            </div>
          }
        />
      ) : null}

      {error ? (
        <p className="mb-3 text-xs font-semibold text-[#8b352b]" role="alert">
          {error}
        </p>
      ) : null}

      {showActions && phase !== "reject-confirm" ? children : null}
    </div>
  );
}
