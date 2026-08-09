"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";

type CategoryOption = {
  slug: string;
  name: string;
};

const CHIP_TONES = [
  "border-[#0d9488]/25 bg-[#e6fffa] text-teal-900 hover:border-teal-600/40",
  "border-[#d97706]/20 bg-[#fff7ed] text-[#9a5b00] hover:border-[#d97706]/40",
  "border-[#0284c7]/20 bg-[#e0f2fe] text-[#075985] hover:border-[#0284c7]/40",
  "border-[#059669]/20 bg-[#ecfdf5] text-[#065f46] hover:border-[#059669]/40",
  "border-[#b45309]/20 bg-[#fef3c7] text-[#92400e] hover:border-[#b45309]/40",
];

export function InterestCategoryPicker({
  categories,
  initialSelected = [],
}: {
  categories: CategoryOption[];
  initialSelected?: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Eski kalıcı cookie’yi temizle (artık kullanılmıyor).
    void fetch("/api/explore/interests", { method: "DELETE" }).catch(() => {});
  }, []);

  function toggle(slug: string) {
    setSelected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  function save() {
    if (selected.length === 0) {
      setError("En az bir kategori seçin.");
      return;
    }
    setError(null);
    startTransition(() => {
      // Oturum cookie’si yok — sadece bu sayfa gezintisinde URL’de tutulur.
      // Panelden çıkıp tekrar girince seçim sıfırlanır.
      const q = new URLSearchParams();
      q.set("interest", selected.join(","));
      router.replace(`/panel/talepler?${q.toString()}`);
    });
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-teal-700/15 bg-gradient-to-br from-[#eefcf8] via-white to-[#fff8ee] px-5 py-8 sm:px-8">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#9ae89a]/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 left-8 h-36 w-36 rounded-full bg-[#7ec8ff]/20 blur-3xl" />

      <div className="relative">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-teal-700/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800">
          <Sparkles className="h-3.5 w-3.5" />
          Size özel akış
        </p>
        <h2 className="mt-3 font-[family-name:var(--font-explore-display)] text-2xl font-semibold tracking-tight text-[#0f3d38] sm:text-3xl">
          Hangi kategoride arıyorsunuz?
        </h2>
        <p className="mt-2 max-w-lg text-sm leading-6 text-[#3d5c57]">
          Birkaç alan seçin; Size uygun sekmesi bu ilanları göstersin. Bu seçim
          yalnızca bu oturum gezintisinde kalır — çıkıp girince yeniden sorulur.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {categories.map((category, index) => {
            const active = selected.includes(category.slug);
            const tone = CHIP_TONES[index % CHIP_TONES.length];
            return (
              <button
                key={category.slug}
                type="button"
                onClick={() => toggle(category.slug)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                  active
                    ? "border-teal-700 bg-teal-700 text-white shadow-sm"
                    : tone
                }`}
              >
                {active ? <Check className="h-3.5 w-3.5" /> : null}
                {category.name}
              </button>
            );
          })}
        </div>

        {error ? <p className="mt-4 text-sm text-[#8b352b]">{error}</p> : null}

        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-700 to-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(13,148,136,0.25)] transition hover:brightness-105 disabled:opacity-60"
        >
          {pending ? "Açılıyor…" : "Talepleri göster"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
