"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  ClipboardCopy,
  LoaderCircle,
  Send,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import type { AssistantRequestOption } from "@/lib/ai/list-assistant-requests";
import type { OfferAssistantResult } from "@/lib/ai/offer-assistant";
import { formatTry } from "@/lib/ai/offer-assistant";

export const OFFER_DRAFT_STORAGE_KEY = "talepo_offer_draft";

type AiAssistantPanelProps = {
  hasOfferAssistant: boolean;
  hasAdvancedPricing: boolean;
  initialRequests: AssistantRequestOption[];
  initialRequestId?: string | null;
  initialTab?: "draft" | "pricing";
};

function resolveInitialSelectedId(
  requests: AssistantRequestOption[],
  initialRequestId?: string | null,
) {
  if (initialRequestId) return initialRequestId;
  return requests[0]?.id ?? "";
}

export function AiAssistantPanel({
  hasOfferAssistant,
  hasAdvancedPricing,
  initialRequests,
  initialRequestId,
  initialTab = "draft",
}: AiAssistantPanelProps) {
  const router = useRouter();

  const lockedToRequest = Boolean(initialRequestId);
  const lockedRequest =
    lockedToRequest
      ? initialRequests.find((item) => item.id === initialRequestId) ??
        initialRequests[0] ??
        null
      : null;

  const [tab, setTab] = useState<"draft" | "pricing">(() => {
    if (initialRequestId) return "draft";
    if (!hasOfferAssistant) return "pricing";
    return initialTab;
  });
  const [requests] = useState(() => {
    if (initialRequestId) {
      return initialRequests.filter((item) => item.id === initialRequestId);
    }
    return initialRequests;
  });
  const [selectedId, setSelectedId] = useState(() =>
    resolveInitialSelectedId(
      initialRequestId
        ? initialRequests.filter((item) => item.id === initialRequestId)
        : initialRequests,
      initialRequestId,
    ),
  );
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
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

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

    router.push(`/panel/talepler/${selectedId}/teklif?taslak=1`);
  }

  async function submitOfferFromDraft() {
    if (!draft || !selectedId || submittingOffer) return;

    setSubmittingOffer(true);
    setError(null);
    setSubmitSuccess(false);

    try {
      const response = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: selectedId,
          description: draft.description,
          amount: draft.suggestedAmount,
          deliveryDays: draft.deliveryDays,
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        redirectTo?: string;
      };

      if (!response.ok) {
        throw new Error(result.message || "Teklif gönderilemedi.");
      }

      sessionStorage.removeItem(OFFER_DRAFT_STORAGE_KEY);
      setSubmitSuccess(true);
      router.push(result.redirectTo || `/panel/teklifler?gonderildi=1`);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Teklif gönderilirken bir hata oluştu.",
      );
      setSubmittingOffer(false);
    }
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
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === "draft"
                ? "bg-[#0f766e] text-white shadow-sm"
                : "bg-[#eef6f4] text-teal-900 hover:bg-[#e7f0ee]"
            }`}
          >
            Teklif taslağı
          </button>
        )}
        {hasAdvancedPricing && (
          <button
            type="button"
            onClick={() => setTab("pricing")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === "pricing"
                ? "bg-[#0f1f1d] text-white shadow-sm"
                : "bg-[#f0f4f3] text-[#0f1f1d]/70 hover:bg-[#e8eeec]"
            }`}
          >
            Fiyat analizi
          </button>
        )}
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-teal-900/10 bg-white p-6 shadow-[0_12px_36px_rgba(15,31,29,0.04)]">
        <div className="relative space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0f766e] text-white">
              {tab === "pricing" ? (
                <Sparkles className="h-5 w-5" />
              ) : (
                <WandSparkles className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#0f1f1d]">
                {tab === "pricing"
                  ? "Fiyat bandı analizi"
                  : lockedToRequest
                    ? "Bu talep için taslak"
                    : "Talep seçin"}
              </h2>
              <p className="text-sm text-teal-950/45">
                {lockedToRequest
                  ? "Yalnızca seçtiğiniz talep için çalışır; diğer talepler listelenmez."
                  : tab === "pricing"
                    ? "Kategori ve miktar bazlı tahmini aralık."
                    : "Keşifteki bir talebi seçin veya metin yapıştırın."}
              </p>
            </div>
          </div>

          {lockedToRequest ? (
            <div className="rounded-xl border border-teal-900/10 bg-[#eef6f4] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-800/70">
                Seçili talep
              </p>
              <p className="mt-1 text-sm font-semibold leading-snug text-[#0f1f1d]">
                {lockedRequest?.title?.trim() || "Başlıksız talep"}
              </p>
              {(lockedRequest?.city || lockedRequest?.category?.name) && (
                <p className="mt-0.5 text-xs text-teal-950/55">
                  {[lockedRequest.city, lockedRequest.category?.name]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              <Link
                href={`/panel/talepler/${initialRequestId}`}
                className="mt-2 inline-block text-xs font-semibold text-teal-800 underline-offset-2 hover:underline"
              >
                Talep detayına dön →
              </Link>
            </div>
          ) : (
            <>
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-teal-950/40">
                  Açık talepler
                </span>
                <select
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                  className="h-12 w-full rounded-xl border border-teal-900/10 bg-[#f7faf9] px-3 text-sm outline-none focus:border-teal-700/30 focus:bg-white"
                >
                  {requests.length === 0 ? (
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
                <span className="mb-2 block text-xs font-medium text-teal-950/40">
                  veya talep metni yapıştırın
                </span>
                <textarea
                  value={pastedText}
                  onChange={(event) => setPastedText(event.target.value)}
                  placeholder="Örn. İstanbul'da 50 adet ofis sandalyesi..."
                  className="min-h-[100px] w-full rounded-xl border border-teal-900/10 bg-[#f7faf9] px-4 py-3 text-sm leading-6 outline-none focus:border-teal-700/30 focus:bg-white"
                />
              </label>
            </>
          )}

          <button
            type="button"
            disabled={
              generating ||
              (lockedToRequest
                ? !selectedId
                : !selectedId && !pastedText.trim())
            }
            onClick={() => void handleGenerate()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0f766e] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-45"
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
        <section className="rounded-2xl border border-teal-900/10 bg-[#eef6f4] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800/70">
            Tahmini fiyat aralığı
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[#0f1f1d]">
            {pricingOnly.priceLabel}
          </p>
          <p className="mt-2 text-sm text-teal-950/60">
            Önerilen teklif:{" "}
            <strong>{formatTry(pricingOnly.suggestedAmount)}</strong>
          </p>
          <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm leading-6 text-teal-950/65">
            Güven: %{pricingOnly.confidence} · {pricingOnly.pricingExplanation}
          </p>
        </section>
      )}

      {tab === "draft" && draft && (
        <section className="rounded-2xl border border-teal-900/10 bg-white p-6 shadow-[0_12px_36px_rgba(15,31,29,0.04)]">
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
                className="inline-flex items-center gap-1.5 rounded-xl border border-teal-900/10 bg-[#f7faf9] px-3 py-2 text-xs font-semibold text-teal-900"
              >
                <ClipboardCopy className="h-3.5 w-3.5" />
                {copied ? "Kopyalandı" : "Kopyala"}
              </button>
              {selectedId && (
                <>
                  <button
                    type="button"
                    onClick={() => void submitOfferFromDraft()}
                    disabled={submittingOffer}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#0f766e] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submittingOffer ? (
                      <>
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        Gönderiliyor...
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        Teklifi gönder
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={applyToOfferForm}
                    className="inline-flex items-center gap-1.5 rounded-full border border-teal-300 bg-white px-3 py-2 text-xs font-semibold text-teal-900"
                  >
                    Formda düzenle
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </>
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
            Taslak alıcıya ulaşmaz — <strong>Teklifi gönder</strong> ile
            kaydedilir. Tahmini fiyat güveni %{draft.confidence}.{" "}
            {draft.pricingExplanation}
          </p>

          {submitSuccess && (
            <p className="mt-3 rounded-[14px] bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
              Teklif gönderildi. Alıcı talep detayında görebilir.
            </p>
          )}

          {selectedId && (
            <Link
              href={`/panel/talepler/${selectedId}/teklif`}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal-800"
            >
              Talep detayında manuel teklif ver
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
