"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  ClipboardCopy,
  LoaderCircle,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import type { OfferAssistantResult } from "@/lib/ai/offer-assistant";
import { formatTry } from "@/lib/ai/offer-assistant";

export const OFFER_DRAFT_STORAGE_KEY = "talepo_offer_draft";

type RequestOption = {
  id: string;
  title: string;
  city: string | null;
  isUrgent: boolean;
  category: { name: string; slug: string };
};

type AiAssistantPanelProps = {
  hasOfferAssistant: boolean;
  hasAdvancedPricing: boolean;
};

export function AiAssistantPanel({
  hasOfferAssistant,
  hasAdvancedPricing,
}: AiAssistantPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "fiyat" ? "pricing" : "draft";

  const [tab, setTab] = useState<"draft" | "pricing">(
    hasOfferAssistant ? initialTab : "pricing",
  );
  const [requests, setRequests] = useState<RequestOption[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<
    (OfferAssistantResult & { requestId?: string; requestTitle?: string }) | null
  >(null);
  const [pricingOnly, setPricingOnly] = useState<{
    priceMin: number;
    priceMax: number;
    suggestedAmount: number;
    confidence: number;
    pricingExplanation: string;
    priceLabel: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const response = await fetch("/api/ai/offer-assistant");
      const data = (await response.json()) as {
        ok?: boolean;
        requests?: RequestOption[];
      };
      if (response.ok && data.requests) {
        setRequests(data.requests);
        if (data.requests[0] && !selectedId) {
          setSelectedId(data.requests[0].id);
        }
      }
    } finally {
      setLoadingRequests(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    const preset = searchParams.get("request");
    if (preset) {
      setSelectedId(preset);
      setTab("draft");
    }
  }, [searchParams]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setDraft(null);
    setPricingOnly(null);

    try {
      const response = await fetch("/api/ai/offer-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: selectedId || undefined,
          pastedText: pastedText.trim() || undefined,
          mode: tab === "pricing" ? "pricing" : "draft",
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        draft?: OfferAssistantResult & {
          requestId?: string;
          requestTitle?: string;
          priceLabel?: string;
        };
      };

      if (!response.ok) {
        throw new Error(data.message || "Taslak oluşturulamadı.");
      }

      if (tab === "pricing" && data.draft) {
        setPricingOnly({
          priceMin: data.draft.priceMin,
          priceMax: data.draft.priceMax,
          suggestedAmount: data.draft.suggestedAmount,
          confidence: data.draft.confidence,
          pricingExplanation: data.draft.pricingExplanation,
          priceLabel:
            data.draft.priceLabel ??
            `${formatTry(data.draft.priceMin)} – ${formatTry(data.draft.priceMax)}`,
        });
      } else if (data.draft) {
        setDraft(data.draft);
      }
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Taslak oluşturulamadı.",
      );
    } finally {
      setGenerating(false);
    }
  }

  function applyToOfferForm() {
    if (!draft || !selectedId) return;

    sessionStorage.setItem(
      OFFER_DRAFT_STORAGE_KEY,
      JSON.stringify({
        requestId: selectedId,
        description: draft.description,
        amount: draft.suggestedAmount,
        deliveryDays: draft.deliveryDays,
        generatedAt: new Date().toISOString(),
      }),
    );

    router.push(`/panel/talepler/${selectedId}?teklif=1`);
  }

  async function copyDraft() {
    if (!draft?.description) return;
    await navigator.clipboard.writeText(draft.description);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {hasOfferAssistant && (
          <button
            type="button"
            onClick={() => setTab("draft")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === "draft"
                ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm"
                : "bg-amber-50 text-amber-900 hover:bg-amber-100"
            }`}
          >
            Teklif taslağı
          </button>
        )}
        {hasAdvancedPricing && (
          <button
            type="button"
            onClick={() => setTab("pricing")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === "pricing"
                ? "bg-gradient-to-r from-sky-500 to-cyan-600 text-white shadow-sm"
                : "bg-sky-50 text-sky-900 hover:bg-sky-100"
            }`}
          >
            Fiyat analizi
          </button>
        )}
      </div>

      <section className="relative overflow-hidden rounded-[28px] border border-amber-200/60 bg-gradient-to-br from-[#fffbeb] via-white to-[#fef3c7] p-6 shadow-[0_16px_55px_rgba(217,119,6,0.08)]">
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-300/25 blur-[40px]" />

        <div className="relative space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
              {tab === "pricing" ? (
                <Sparkles className="h-5 w-5" />
              ) : (
                <WandSparkles className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#0f172a]">
                {tab === "pricing" ? "Fiyat bandı analizi" : "Talep bağlamı seçin"}
              </h2>
              <p className="text-sm text-black/45">
                {tab === "pricing"
                  ? "Kategori ve miktar bazlı tahmini aralık — gerçek pazar verisi gelene kadar sezgisel hesap."
                  : "Keşifteki bir talebi seçin veya metin yapıştırın."}
              </p>
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-black/40">
              Açık talepler
            </span>
            <select
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              disabled={loadingRequests}
              className="h-12 w-full rounded-[14px] border border-amber-200/70 bg-white/90 px-3 text-sm outline-none"
            >
              {loadingRequests ? (
                <option>Yükleniyor...</option>
              ) : requests.length === 0 ? (
                <option value="">Henüz erişilebilir talep yok</option>
              ) : (
                requests.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                    {item.city ? ` · ${item.city}` : ""}
                    {item.isUrgent ? " · Acil" : ""}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-black/40">
              veya talep metni yapıştırın
            </span>
            <textarea
              value={pastedText}
              onChange={(event) => setPastedText(event.target.value)}
              placeholder="Örn. İstanbul'da 50 adet ofis sandalyesi, 7 gün içinde teslim..."
              className="min-h-[100px] w-full rounded-[14px] border border-amber-200/70 bg-white/90 px-4 py-3 text-sm leading-6 outline-none"
            />
          </label>

          <button
            type="button"
            disabled={generating || (!selectedId && !pastedText.trim())}
            onClick={() => void handleGenerate()}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-700 to-teal-800 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {generating ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Hesaplanıyor...
              </>
            ) : tab === "pricing" ? (
              "Fiyat bandını hesapla"
            ) : (
              "Taslak oluştur"
            )}
          </button>

          {error && (
            <div className="rounded-[16px] bg-[#ffe4df] p-3 text-sm font-semibold text-[#8b352b]">
              {error}
            </div>
          )}
        </div>
      </section>

      {tab === "pricing" && pricingOnly && (
        <section className="rounded-[28px] border border-sky-200/70 bg-gradient-to-br from-[#e0f2fe] via-white to-[#ecfeff] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-800/70">
            Tahmini fiyat aralığı
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-sky-950">
            {pricingOnly.priceLabel}
          </p>
          <p className="mt-2 text-sm text-sky-900/70">
            Önerilen teklif:{" "}
            <strong>{formatTry(pricingOnly.suggestedAmount)}</strong>
          </p>
          <p className="mt-4 rounded-[16px] bg-white/70 px-4 py-3 text-sm leading-6 text-sky-950/65">
            Güven: %{pricingOnly.confidence} · {pricingOnly.pricingExplanation}
          </p>
        </section>
      )}

      {tab === "draft" && draft && (
        <section className="rounded-[28px] border border-teal-200/60 bg-gradient-to-br from-[#ecfdf5] via-white to-[#e0f2fe] p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800/70">
                Teklif taslağı
              </p>
              {draft.requestTitle && (
                <p className="mt-1 text-sm font-medium text-teal-950/70">
                  {draft.requestTitle}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyDraft()}
                className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-white px-3 py-2 text-xs font-semibold text-teal-900"
              >
                <ClipboardCopy className="h-3.5 w-3.5" />
                {copied ? "Kopyalandı" : "Kopyala"}
              </button>
              {selectedId && (
                <button
                  type="button"
                  onClick={applyToOfferForm}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-teal-700 to-teal-800 px-3 py-2 text-xs font-semibold text-white"
                >
                  Forma bas
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <pre className="mt-4 whitespace-pre-wrap rounded-[18px] bg-white/80 p-4 text-sm leading-7 text-[#0f172a]">
            {draft.description}
          </pre>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Metric label="Önerilen fiyat" value={formatTry(draft.suggestedAmount)} />
            <Metric
              label="Fiyat bandı"
              value={`${formatTry(draft.priceMin)} – ${formatTry(draft.priceMax)}`}
            />
            <Metric label="Teslim" value={draft.deliveryNote} />
          </div>

          <p className="mt-4 text-xs leading-5 text-teal-900/55">
            Tahmini fiyat — güven %{draft.confidence}. {draft.pricingExplanation}
          </p>

          {selectedId && (
            <Link
              href={`/panel/talepler/${selectedId}?teklif=1`}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal-800"
            >
              Talep detayında teklif ver
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] bg-white/75 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/35">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[#0f172a]">{value}</p>
    </div>
  );
}
