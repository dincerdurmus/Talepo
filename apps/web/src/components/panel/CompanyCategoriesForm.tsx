"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, Tags } from "lucide-react";

import { REQUEST_CATEGORIES } from "@/lib/request-category-engine";

type CompanyCategoriesFormProps = {
  initialSlugs?: string[];
  /** When true, used inside create-company flow (controlled by parent). */
  mode?: "create" | "edit";
  value?: string[];
  onChange?: (slugs: string[]) => void;
};

export function CompanyCategoryPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (slugs: string[]) => void;
}) {
  function toggle(slug: string) {
    if (value.includes(slug)) {
      onChange(value.filter((item) => item !== slug));
      return;
    }
    onChange([...value, slug].slice(0, 12));
  }

  return (
    <div className="flex flex-wrap gap-2">
      {REQUEST_CATEGORIES.map((category) => {
        const active = value.includes(category.id);
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => toggle(category.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? "bg-teal-800 text-white"
                : "bg-black/[0.04] text-black/55 hover:bg-black/[0.07]"
            }`}
          >
            {category.label}
          </button>
        );
      })}
    </div>
  );
}

export function CompanyCategoriesForm({
  initialSlugs = [],
}: CompanyCategoriesFormProps) {
  const [slugs, setSlugs] = useState(initialSlugs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);

    try {
      const response = await fetch("/api/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorySlugs: slugs }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Güncellenemedi.");
        return;
      }
      setOk("Kategoriler kaydedildi. Yeni talepler bu alanlara göre size iletilir.");
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-800/10 text-teal-800">
          <Tags className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Hizmet kategorileri
          </h2>
          <p className="mt-1 text-sm leading-6 text-black/45">
            Seçtiğiniz kategorilerdeki talepler firmanıza eşleşir ve bildirim
            gelir. En az bir kategori seçmeniz önerilir.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <CompanyCategoryPicker value={slugs} onChange={setSlugs} />
      </div>

      {error && (
        <p className="mt-4 text-sm font-medium text-red-600">{error}</p>
      )}
      {ok && (
        <p className="mt-4 text-sm font-medium text-teal-800">{ok}</p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black/85 disabled:opacity-60"
      >
        {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
        Kategorileri kaydet
      </button>
    </form>
  );
}
