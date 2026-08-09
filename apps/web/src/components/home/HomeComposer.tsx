"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

const EXAMPLES = [
  {
    label: "İstanbul’da 50 ofis sandalyesi lazım",
    tone: "border-[#b7e3b0] bg-[#eef9eb] text-[#2f6b34] hover:bg-[#e4f5df]",
  },
  {
    label: "Bağcılar’da 2+1 kiralık daire arıyorum",
    tone: "border-[#b8cce8] bg-[#eef3fb] text-[#2a4a74] hover:bg-[#e4ecf8]",
  },
  {
    label: "5.000 adet baskılı karton kutu",
    tone: "border-[#e4c9a0] bg-[#fbf4ea] text-[#7a4e1a] hover:bg-[#f7ecdc]",
  },
  {
    label: "Ankara’ya 10 laptop teklifi",
    tone: "border-[#c5d9d4] bg-[#eef6f4] text-[#2f5c54] hover:bg-[#e4f0ed]",
  },
];

const PLACEHOLDERS = [
  "Örnek: İstanbul’da 50 ofis sandalyesi lazım…",
  "Örnek: Bağcılar’da 2+1 kiralık daire…",
  "Örnek: 5.000 adet baskılı karton kutu…",
];

export function HomeComposer() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (text || focused) return;
    const id = window.setInterval(() => {
      setPlaceholderIndex((current) => (current + 1) % PLACEHOLDERS.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, [text, focused]);

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

  return (
    <div className="w-full">
      <form
        onSubmit={onSubmit}
        className={`relative overflow-hidden rounded-[30px] border bg-white/95 p-3 shadow-[0_28px_90px_rgba(20,40,20,0.10)] backdrop-blur-sm transition duration-300 sm:p-4 ${
          focused
            ? "border-[#7cbc7a]/55 shadow-[0_28px_90px_rgba(80,150,90,0.16)]"
            : "border-black/[0.08]"
        }`}
      >
        <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[#c9f4c1]/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-14 -left-8 h-32 w-32 rounded-full bg-[#c6d9ff]/45 blur-3xl" />

        <div className="relative mb-2 flex items-center gap-2 px-3 pt-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef9eb] px-2.5 py-1 text-[11px] font-semibold text-[#2f6b34]">
            <Sparkles className="h-3 w-3" />
            Hızlı yaz
          </span>
          <span className="text-[11px] text-black/35">
            Günlük dille anlatman yeter
          </span>
        </div>

        <label htmlFor="home-need" className="sr-only">
          Ne arıyorsunuz?
        </label>
        <textarea
          id="home-need"
          name="query"
          rows={3}
          value={text}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(event) => setText(event.target.value)}
          placeholder={PLACEHOLDERS[placeholderIndex]}
          className="relative min-h-[104px] w-full resize-none bg-transparent px-3 py-2 text-base leading-7 outline-none placeholder:text-black/30 sm:text-lg"
        />
        <div className="relative mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="px-1 text-xs text-black/40 sm:px-3">
            Ücretsiz · Yaklaşık 20 saniye · Telefonunuz gizli kalır
          </p>
          <button
            type="submit"
            className="group inline-flex min-h-[54px] items-center justify-center gap-2 rounded-[18px] bg-[#151515] px-6 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:bg-black sm:min-w-[210px]"
          >
            Talep oluştur
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="self-center text-xs font-medium text-black/40">
          Hızlı örnek:
        </span>
        {EXAMPLES.map((example) => (
          <button
            key={example.label}
            type="button"
            onClick={() => {
              setText(example.label);
              go(example.label);
            }}
            className={`rounded-full border px-3.5 py-2 text-left text-xs font-medium transition hover:-translate-y-0.5 ${example.tone}`}
          >
            {example.label}
          </button>
        ))}
      </div>
    </div>
  );
}
