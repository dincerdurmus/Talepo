"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import { detectCategoryHintLabel } from "@/lib/request-category-engine";

/* Kurucu (2026-09-04): çipler Talepo genişliğini anlatır — tüketici,
   üretim, hizmet ve makine bir arada; salt B2B ofis hissi verilmez. */
const SUGGESTIONS = [
  "Mercedes C200 arıyorum",
  "10.000 adet kraft kutu",
  "Logo tasarımı yaptıracağım",
  "CNC torna tezgahı arıyorum",
];

type HomeComposerProps = {
  /** When true, secondary links are tuned for a dark atmospheric hero. */
  onInk?: boolean;
  /** Ana Sayfa 1 preview — subtle composer polish without affecting production `/`. */
  variant?: "default" | "home1";
};

export function HomeComposer({ onInk = false, variant = "default" }: HomeComposerProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const isLoggedIn = status === "authenticated" && Boolean(session?.user);

  /**
   * NON-AUTHORITATIVE UX hint only.
   * Home never locks category — handoff is raw query → /talep → understandRequest().
   */
  const categoryHint = useMemo(() => {
    const trimmed = text.trim();
    if (trimmed.length < 8) return null;
    return detectCategoryHintLabel(trimmed);
  }, [text]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(Math.max(el.scrollHeight, 56), 140);
    el.style.height = `${next}px`;
  }, [text]);

  function go(next: string) {
    const value = next.trim();
    if (!value) {
      router.push("/talep");
      return;
    }
    // Raw input only — no category authority in URL
    router.push(`/talep?query=${encodeURIComponent(value)}`);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    go(text);
  }

  function applySuggestion(value: string) {
    setText(value);
    textareaRef.current?.focus();
  }

  const canSubmit = text.trim().length > 0;
  const home1 = variant === "home1" && onInk;

  return (
    <div className={`w-full ${home1 ? "talepo-home1-composer-wrap" : ""}`}>
      <form onSubmit={onSubmit} className="talepo-composer w-full">
        {!home1 ? (
          <div className="flex items-baseline justify-between gap-3 px-1">
            <label
              htmlFor={fieldId}
              className={`text-[11px] font-medium uppercase tracking-[0.2em] ${
                onInk ? "text-white/35" : "text-[#0a1210]/40"
              }`}
            >
              Talep
            </label>
            {categoryHint ? (
              <span
                className={`text-[11px] tracking-[0.02em] ${
                  onInk ? "text-teal-200/40" : "text-teal-800/45"
                }`}
              >
                {categoryHint}
              </span>
            ) : null}
          </div>
        ) : null}

        <div
          data-talepo-composer-anchor={home1 ? "true" : undefined}
          className={`${home1 ? "" : "mt-3"} flex items-center gap-2 rounded-[1.75rem] border px-3 py-2.5 backdrop-blur-2xl transition-[background-color,border-color,box-shadow] duration-300 sm:gap-3 sm:px-4 sm:py-3 ${
            home1
              ? focused
                ? "talepo-home1-composer-field is-focused border-teal-200/38 bg-[#07110f]/88 shadow-[0_0_0_1px_rgba(45,212,191,0.08)]"
                : "talepo-home1-composer-field border-teal-200/24 bg-[#07110f]/76 hover:border-teal-200/34"
              : onInk
              ? focused
                ? "border-white/18 bg-white/[0.12] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
                : "border-white/10 bg-white/[0.08] hover:border-white/14 hover:bg-white/[0.1]"
              : focused
                ? "border-[#0a1210]/14 bg-white/90 shadow-[0_12px_40px_rgba(10,18,16,0.08)]"
                : "border-[#0a1210]/10 bg-white/70 hover:border-[#0a1210]/14"
          }`}
        >
          <textarea
            ref={textareaRef}
            id={fieldId}
            name="query"
            rows={home1 ? 1 : 2}
            value={text}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(event) => {
              const nextText = event.target.value;
              setText(nextText);
              /* Planet sahnesi yazımı hisseder — yalnız hafif bir olay;
                 render maliyeti yok, input asla beklemez. */
              if (text.trim().length === 0 && nextText.trim().length > 0) {
                window.dispatchEvent(new Event("talepo:home-typing"));
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                go(text);
              }
            }}
            placeholder="Ne arıyorsunuz?"
            className={`relative z-10 max-h-[140px] min-h-[56px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] leading-6 outline-none sm:text-[16px] sm:leading-7 ${
              onInk
                ? "text-white/92 placeholder:text-white/28"
                : "text-[#0a1210] placeholder:text-[#0a1210]/28"
            }`}
          />

          <button
            type="submit"
            className={`relative z-10 inline-flex h-10 shrink-0 items-center justify-center gap-1.5 px-4 text-[13px] font-medium tracking-[0.01em] transition sm:h-11 sm:px-5 ${
              home1
                ? canSubmit
                  ? "border-l border-white/12 text-teal-100 hover:text-white"
                  : "border-l border-white/10 text-teal-100/62 hover:text-teal-100"
                : onInk
                ? canSubmit
                  ? "rounded-full bg-white text-[#070c0b] hover:bg-white/92"
                  : "rounded-full bg-white/12 text-white/55 hover:bg-white/16 hover:text-white/75"
                : canSubmit
                  ? "rounded-full bg-[#0a1210] text-white hover:bg-[#121c1a]"
                  : "rounded-full bg-[#0a1210]/70 text-white/90 hover:bg-[#0a1210]/82"
            }`}
          >
            {home1 ? "Talebi yayınla" : "Devam"}
            <ArrowRight className="h-3.5 w-3.5 opacity-70" />
          </button>
        </div>

        {!home1 ? (
          <ul className="mt-4 flex flex-wrap items-center justify-center gap-2 px-1 sm:mt-5 lg:justify-start">
            {SUGGESTIONS.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  onClick={() => applySuggestion(suggestion)}
                  className={`text-[12.5px] tracking-[0.01em] transition sm:text-[13px] ${
                    onInk
                      ? "text-white/32 hover:text-white/62"
                      : "text-[#0a1210]/38 hover:text-[#0a1210]/70"
                  }`}
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>

      {isLoggedIn && !home1 && (
        <div className="mt-6 flex justify-center">
          <Link
            href="/panel"
            className={`inline-flex items-center gap-2 text-[13px] font-medium transition ${
              onInk
                ? "text-white/40 hover:text-white/70"
                : "text-teal-800/65 hover:text-teal-900"
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5 opacity-70" />
            Panele git
          </Link>
        </div>
      )}
    </div>
  );
}
