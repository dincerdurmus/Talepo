"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ArrowRight, Check } from "lucide-react";

import { getCategoryVisual } from "@/lib/visuals/category-visuals";

type CategoryOption = {
  slug: string;
  name: string;
};

export function InterestCategoryPicker({
  categories,
  initialSelected = [],
  preserveFrom,
}: {
  categories: CategoryOption[];
  initialSelected?: string[];
  /** Keep follow-create context across interest save navigation. */
  preserveFrom?: string;
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
      if (preserveFrom) q.set("from", preserveFrom);
      router.replace(`/panel/talepler?${q.toString()}`);
    });
  }

  return (
    <div className="relative overflow-hidden rounded-[1.35rem] border border-[rgba(15,118,110,0.14)] bg-white px-5 py-7 sm:px-7 sm:py-8">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0f766e]">
        Kategori seç
      </p>
      <h2 className="mt-3 text-[1.35rem] font-semibold tracking-[-0.03em] text-[#0f1f1d] sm:text-[1.5rem]">
        Hangi kategoride arıyorsunuz?
      </h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-[#0f1f1d]/48">
        Birkaç alan seçin; Size uygun sekmesi bu ilanları göstersin. Bu seçim
        yalnızca bu gezintide kalır — çıkıp girince yeniden sorulur.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {categories.map((category) => {
          const active = selected.includes(category.slug);
          const look = getCategoryVisual(category.slug);
          const Icon = look.icon;
          return (
            <button
              key={category.slug}
              type="button"
              onClick={() => toggle(category.slug)}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                active
                  ? "border-teal-700/30 bg-teal-700/10 text-teal-950"
                  : `border-[#0f1f1d]/10 bg-white/80 text-[#0f1f1d] hover:border-teal-700/25`
              }`}
              aria-pressed={active}
            >
              {active ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              {category.name}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="mt-4 text-sm text-[#8b352b]" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0f766e] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#115e59] disabled:opacity-60"
      >
        {pending ? "Açılıyor…" : "Talepleri göster"}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
