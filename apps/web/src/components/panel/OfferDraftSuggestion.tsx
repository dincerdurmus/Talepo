"use client";

import Link from "next/link";
import { useState } from "react";
import { LoaderCircle, Sparkles, WandSparkles } from "lucide-react";

type OfferDraftSuggestionProps = {
  requestTitle: string;
  requestDescription: string;
  categoryName: string;
  teklifHref: string;
};

export function OfferDraftSuggestion({
  requestTitle,
  requestDescription,
  categoryName,
  teklifHref,
}: OfferDraftSuggestionProps) {
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generateDraft() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/monetization/offer-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestTitle,
          requestDescription,
          categoryName,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        draft?: string;
        provider?: string;
        message?: string;
      };
      if (!response.ok) {
        setError(data.message ?? "Taslak üretilemedi.");
        return;
      }
      setDraft(data.draft ?? null);
      setProvider(data.provider ?? null);
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }

  const label =
    provider === "rule-based-stub"
      ? "Talepo taslak önerisi"
      : provider
        ? "Talepo taslak önerisi"
        : "Yakında aktif";

  return (
    <section className="mt-6 rounded-2xl border border-teal-900/10 bg-gradient-to-br from-teal-50/50 to-white p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-900 text-white">
          <WandSparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-teal-950">{label}</h2>
            <span className="rounded-full bg-teal-900/8 px-2 py-0.5 text-[10px] font-semibold uppercase text-teal-800">
              Premium
            </span>
          </div>
          <p className="mt-1 text-sm text-teal-950/55">
            Talep metnine dayalı kural tabanlı taslak — harici AI sağlayıcısı
            kullanılmaz.
          </p>

          {!draft ? (
            <button
              type="button"
              onClick={() => void generateDraft()}
              disabled={loading}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-45"
            >
              {loading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Taslak oluştur
            </button>
          ) : (
            <div className="mt-4 rounded-xl border border-teal-900/10 bg-white p-4">
              <p className="whitespace-pre-line text-sm leading-6 text-teal-950/75">
                {draft}
              </p>
              <Link
                href={`${teklifHref}?draft=${encodeURIComponent(draft.slice(0, 500))}`}
                className="mt-3 inline-flex text-sm font-semibold text-teal-800 underline"
              >
                Teklif formuna aktar
              </Link>
            </div>
          )}

          {error ? (
            <p className="mt-3 text-sm text-rose-700">{error}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
