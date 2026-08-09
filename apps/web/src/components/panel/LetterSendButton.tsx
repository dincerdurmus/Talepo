"use client";

import type { ReactNode } from "react";
import { Mail } from "lucide-react";

export const LETTER_SEND_DURATION_MS = 1800;

const LETTER_SEND_STYLES = `
  @keyframes talepo-letter-fly {
    0% {
      opacity: 1;
      transform: translate3d(0, -50%, 0) rotate(-6deg) scale(1);
    }
    12% {
      opacity: 1;
      transform: translate3d(24px, -56%, 0) rotate(0deg) scale(1.1);
    }
    72% {
      opacity: 1;
      transform: translate3d(min(55vw, 520px), -62%, 0) rotate(12deg) scale(0.95);
    }
    100% {
      opacity: 0;
      transform: translate3d(min(78vw, 720px), -72%, 0) rotate(24deg) scale(0.78);
    }
  }
  @keyframes talepo-content-slide {
    0% {
      opacity: 1;
      transform: translateX(0);
    }
    35% {
      opacity: 1;
      transform: translateX(12%);
    }
    100% {
      opacity: 0;
      transform: translateX(115%);
    }
  }
  @keyframes talepo-status-in {
    0% {
      opacity: 0;
      transform: translateX(12px);
    }
    100% {
      opacity: 1;
      transform: translateX(0);
    }
  }
  @keyframes talepo-trail {
    0% { opacity: 0; }
    20% { opacity: 0.5; }
    75% { opacity: 0.35; }
    100% { opacity: 0; }
  }
`;

type LetterSendButtonProps = {
  sending: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  statusLabel: string;
  children: ReactNode;
  withCloud?: boolean;
};

export function LetterSendButton({
  sending,
  disabled = false,
  type = "button",
  onClick,
  statusLabel,
  children,
  withCloud = true,
}: LetterSendButtonProps) {
  const button = (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || sending}
      aria-busy={sending}
      className={`group relative flex w-full items-center justify-between gap-4 overflow-hidden bg-gradient-to-r from-[#0f766e] via-[#0d9488] to-[#115e59] px-6 py-4 text-left text-white shadow-[0_12px_28px_rgba(15,118,110,0.28)] transition hover:shadow-[0_16px_36px_rgba(15,118,110,0.36)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] disabled:cursor-not-allowed disabled:opacity-50 sm:px-8 sm:py-4.5 ${
        withCloud ? "rounded-full" : "rounded-2xl"
      }`}
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_45%)]" />

      {sending && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-6 left-10 right-10"
          style={{ animation: "talepo-trail 1.6s ease-out forwards" }}
        >
          <span className="block h-full w-full bg-[repeating-linear-gradient(90deg,transparent,transparent_10px,rgba(255,255,255,0.35)_10px,rgba(255,255,255,0.35)_16px)] opacity-70 [mask-image:linear-gradient(90deg,transparent,black_20%,black_70%,transparent)]" />
        </span>
      )}

      {sending && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-8 top-1/2 z-20 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#0f766e] shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
          style={{
            animation:
              "talepo-letter-fly 1.55s cubic-bezier(0.22, 1, 0.36, 1) forwards",
          }}
        >
          <Mail className="h-5 w-5" />
        </span>
      )}

      <span
        className="relative z-10 flex min-w-0 flex-1 items-center justify-between gap-4"
        style={
          sending
            ? {
                animation:
                  "talepo-content-slide 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards",
              }
            : undefined
        }
      >
        {children}
      </span>

      {sending && (
        <span
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-sm font-semibold tracking-wide"
          style={{
            animation: "talepo-status-in 0.45s ease-out 0.55s both",
          }}
        >
          {statusLabel}
        </span>
      )}
    </button>
  );

  return (
    <>
      <style>{LETTER_SEND_STYLES}</style>
      {withCloud ? (
        <div className="rounded-full border border-black/[0.06] bg-white/90 p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.05)] backdrop-blur-md">
          {button}
        </div>
      ) : (
        button
      )}
    </>
  );
}

export function waitForLetterSend(startedAt: number) {
  const elapsed = Date.now() - startedAt;
  const remaining = Math.max(0, LETTER_SEND_DURATION_MS - elapsed);
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, remaining);
  });
}
