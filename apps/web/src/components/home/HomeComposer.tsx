"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import { detectCategory } from "@/lib/request-category-engine";

const SUGGESTIONS = [
  "50 ofis sandalyesi, İstanbul",
  "2+1 kiralık daire, Bağcılar",
  "5.000 adet karton kutu",
];

type HomeComposerProps = {
  /** When true, secondary links are tuned for a dark atmospheric hero. */
  onInk?: boolean;
};

export function HomeComposer({ onInk = false }: HomeComposerProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const isLoggedIn = status === "authenticated" && Boolean(session?.user);

  const categoryHint = useMemo(() => {
    const trimmed = text.trim();
    if (trimmed.length < 8) return null;
    const normalized = trimmed.toLocaleLowerCase("tr-TR");
    const category = detectCategory(normalized);
    const matched = category.keywords.some((keyword) =>
      normalized.includes(keyword)
    );
    return matched ? category.label : null;
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

  return (
    <div className="w-full">
      <form onSubmit={onSubmit} className="talepo-composer w-full">
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

        <div
          className={`mt-3 flex items-end gap-2 rounded-[1.75rem] border px-3 py-2.5 backdrop-blur-2xl transition-[background-color,border-color,box-shadow] duration-300 sm:gap-3 sm:px-4 sm:py-3 ${
            onInk
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
            rows={2}
            value={text}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                go(text);
              }
            }}
            placeholder="İhtiyacınızı yazın…"
            className={`max-h-[140px] min-h-[56px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] leading-6 outline-none sm:text-[16px] sm:leading-7 ${
              onInk
                ? "text-white/92 placeholder:text-white/28"
                : "text-[#0a1210] placeholder:text-[#0a1210]/28"
            }`}
          />

          <button
            type="submit"
            className={`mb-1 inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-medium tracking-[0.01em] transition sm:h-11 sm:px-5 ${
              onInk
                ? canSubmit
                  ? "bg-white text-[#070c0b] hover:bg-white/92"
                  : "bg-white/12 text-white/55 hover:bg-white/16 hover:text-white/75"
                : canSubmit
                  ? "bg-[#0a1210] text-white hover:bg-[#121c1a]"
                  : "bg-[#0a1210]/70 text-white/90 hover:bg-[#0a1210]/82"
            }`}
          >
            Devam
            <ArrowRight className="h-3.5 w-3.5 opacity-70" />
          </button>
        </div>

        <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-1 sm:mt-5">
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
      </form>

      {isLoggedIn && (
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
