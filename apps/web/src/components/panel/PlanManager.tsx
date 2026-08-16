"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, LoaderCircle } from "lucide-react";

import {
  FEATURE_META,
  PRO_VALUE_PILLARS,
  PLAN_SUMMARY_FEATURE_KEYS,
} from "@/lib/membership/feature-meta";
import { getFeatureVisual } from "@/lib/membership/feature-visuals";
import {
  formatPersonalPlanMismatchDetail,
  hasPersonalPlanMismatch,
  TEAM_PLAN_SCOPE_NOTE,
} from "@/lib/membership/membership-rules";
import {
  getPlanThemeStyle,
  PLAN_FEATURES,
  PLAN_THEME_TOKENS,
  PLAN_VISUALS,
} from "@/lib/membership/plan-visuals";
import {
  getAvailablePlans,
  PLAN_DEFINITIONS,
  planTierRank,
  type PlanTierId,
} from "@/lib/membership/plans";
import type { EntitlementDTO } from "@/lib/membership/serialize";
import { formatQuotaRemaining } from "@/lib/membership/serialize";
import { FeatureInfoTooltip } from "./FeatureInfoTooltip";

import { PersonalPlanMismatchBanner } from "./PersonalPlanMismatchBanner";
import { PremiumUpgradeCta } from "./PremiumUpgradeCta";

export type CompanyOption = {
  id: string;
  name: string;
};

const DETAIL_GROUPS = [
  { id: "capture", title: "Fırsatları yakala", accent: "cyan", keys: PRO_VALUE_PILLARS[0].features },
  { id: "analyze", title: "Fırsatı analiz et", accent: "blue", keys: PRO_VALUE_PILLARS[1].features },
  { id: "offer", title: "Daha güçlü teklif ver", accent: "violet", keys: PRO_VALUE_PILLARS[2].features },
  { id: "follow-up", title: "Satışı takip et", accent: "mint", keys: ["budget_change_alerts", "watchlist"] as const },
] as const;

const PILLAR_FEATURE_KEY: Record<string, keyof typeof FEATURE_META> = {
  capture: "smart_matching",
  analyze: "advanced_opportunity_analysis",
  offer: "ai_offer_assistant",
  "follow-up": "watchlist",
};

type BillingStatusProps = {
  subscriptionStatus?: string;
  pendingCheckout?: boolean;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  providerStatus?:
    | "NONE"
    | "MOCK_DEV"
    | "IYZICO_READY"
    | "IYZICO_CONFIGURED"
    | "EXTERNAL_BLOCKED";
  mockBillingEnabled?: boolean;
  /** From URL ?billing=pending after checkout redirect */
  redirectPending?: boolean;
};

type PlanManagerProps = {
  entitlements: EntitlementDTO;
  companies?: CompanyOption[];
  mockUpgradeEnabled?: boolean;
  billing?: BillingStatusProps;
  /** Company billing mutations: OWNER/ADMIN only. Personal always true. */
  canMutateBilling?: boolean;
  showPlanChoices?: boolean;
};

export function PlanManager({
  entitlements,
  companies = [],
  mockUpgradeEnabled = false,
  billing,
  canMutateBilling = true,
  showPlanChoices = true,
}: PlanManagerProps) {
  const router = useRouter();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const billingPending =
    Boolean(billing?.redirectPending) || Boolean(billing?.pendingCheckout);
  const checkoutAvailable =
    canMutateBilling &&
    (Boolean(billing?.mockBillingEnabled) ||
      billing?.providerStatus === "MOCK_DEV" ||
      billing?.providerStatus === "IYZICO_READY" ||
      billing?.providerStatus === "IYZICO_CONFIGURED");

  const visualKey = entitlements.effectivePlanTier;
  const currentVisual = PLAN_VISUALS[visualKey];
  const remainingLabel = formatQuotaRemaining(entitlements.quota);
  const activeFeatureKeys = PLAN_SUMMARY_FEATURE_KEYS.filter(
    (key) => entitlements.features[key],
  );
  const personalMismatch = hasPersonalPlanMismatch(entitlements);
  const mismatchDetail = personalMismatch
    ? formatPersonalPlanMismatchDetail(entitlements)
    : undefined;
  const currentRank = planTierRank(entitlements.effectivePlanTier);

  function canSelectPlan(planId: PlanTierId): boolean {
    if (!canMutateBilling) return false;
    if (planId === entitlements.effectivePlanTier) return false;
    if (planId === "STANDARD") return mockUpgradeEnabled;
    if (checkoutAvailable && planTierRank(planId) > currentRank) return true;
    return mockUpgradeEnabled && planTierRank(planId) > currentRank;
  }

  function planButtonLabel(planId: PlanTierId): string {
    if (planId === entitlements.effectivePlanTier) {
      return "Aktif plan";
    }
    if (planId === "STANDARD") {
      return mockUpgradeEnabled ? "Bireysel'e geç (test)" : "Ücretsiz başla";
    }
    const plan = PLAN_DEFINITIONS[planId];
    if (checkoutAvailable && planTierRank(planId) > currentRank) {
      return `Ödemeye geç · ₺${plan.priceTry?.toLocaleString("tr-TR")}/ay`;
    }
    if (mockUpgradeEnabled && planTierRank(planId) > currentRank) {
      return `Test yükselt · ₺${plan.priceTry?.toLocaleString("tr-TR")}/ay`;
    }
    if (plan.priceTry) {
      return `₺${plan.priceTry.toLocaleString("tr-TR")}/ay · provider gerekli`;
    }
    return "Yükselt";
  }

  function mountIyzicoCheckoutForm(checkoutFormContent: string) {
    // iyzico returns a script/HTML snippet that mounts into #iyzipay-checkout-form
    const host = document.getElementById("iyzipay-checkout-form");
    if (host) {
      host.innerHTML = "";
    }
    const wrapper = document.createElement("div");
    wrapper.innerHTML = checkoutFormContent;
    document.body.appendChild(wrapper);
    wrapper.querySelectorAll("script").forEach((oldScript) => {
      const script = document.createElement("script");
      if (oldScript.src) script.src = oldScript.src;
      script.textContent = oldScript.textContent;
      document.body.appendChild(script);
    });
  }

  async function startCheckout(planId: PlanTierId) {
    if (!canMutateBilling) {
      setError("Plan/ödeme işlemleri için sahip veya yönetici yetkisi gerekir.");
      return;
    }
    setLoadingKey(planId);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planTier: planId }),
      });
      const result = (await response.json()) as {
        message?: string;
        checkoutUrl?: string;
        checkoutFormContent?: string;
        token?: string;
      };
      if (!response.ok) {
        throw new Error(result.message || "Checkout başlatılamadı.");
      }
      if (result.checkoutFormContent) {
        mountIyzicoCheckoutForm(result.checkoutFormContent);
        setMessage("Ödeme formu açıldı. Plan yalnız doğrulanmış webhook sonrası açılır.");
        return;
      }
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      setMessage(result.message || "Ödeme doğrulanıyor…");
      router.refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Ödeme başlatılırken hata oluştu.",
      );
    } finally {
      setLoadingKey(null);
    }
  }

  async function runAction(key: string, body: Record<string, unknown>) {
    setLoadingKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = (await response.json()) as {
        message?: string;
        code?: string;
      };

      if (!response.ok) {
        throw new Error(result.message || "İşlem tamamlanamadı.");
      }

      setMessage(result.message || "İşlem başarılı.");
      router.refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "İşlem sırasında bir hata oluştu.",
      );
    } finally {
      setLoadingKey(null);
    }
  }

  const CurrentIcon = currentVisual.icon;
  const planThemeStyle = getPlanThemeStyle(visualKey);

  return (
    <div
      className="talepo-plan-theme space-y-6"
      style={planThemeStyle}
      data-plan={visualKey}
    >
      {personalMismatch && (
        <PersonalPlanMismatchBanner detail={mismatchDetail} />
      )}

      {entitlements.subject.type === "company" && (
        <p className="rounded-[18px] border border-teal-900/10 bg-[#f0fdfa] px-4 py-3 text-sm leading-6 text-teal-900/70">
          {TEAM_PLAN_SCOPE_NOTE}
        </p>
      )}

      {entitlements.subject.type === "company" && !canMutateBilling && (
        <p className="rounded-[18px] border border-teal-900/10 bg-white px-4 py-3 text-sm leading-6 text-teal-950/70">
          Firma planı ve ödeme işlemlerini yalnızca sahip veya yönetici
          başlatabilir. Mevcut plan haklarınızı görebilirsiniz.
        </p>
      )}

      {billingPending && (
        <p className="rounded-[18px] border border-amber-900/15 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950/80">
          Ödemeniz doğrulanıyor. Plan hakları, ödeme sağlayıcısı webhook ile
          onaylanana kadar açılmaz.
        </p>
      )}

      {billing?.subscriptionStatus && billing.subscriptionStatus !== "INACTIVE" && (
        <p className="text-sm text-black/45">
          Abonelik durumu: <strong>{billing.subscriptionStatus}</strong>
          {billing.currentPeriodEnd
            ? ` · dönem sonu: ${formatDate(billing.currentPeriodEnd)}`
            : ""}
          {billing.cancelAtPeriodEnd ? " · dönem sonunda iptal" : ""}
        </p>
      )}

      {(message || error) && (
        <p
          className={`rounded-[18px] px-4 py-3 text-sm ${
            error
              ? "border border-red-200 bg-red-50 text-red-800"
              : "border border-teal-900/10 bg-[#f0fdfa] text-teal-900/80"
          }`}
        >
          {error || message}
        </p>
      )}

      <section
        className={`relative overflow-hidden rounded-[28px] border p-6 ${currentVisual.border} ${currentVisual.surface}`}
      >
        <div
          className="talepo-plan-accent-bar absolute inset-x-0 top-0 h-[3px]"
          aria-hidden
        />
        <div
          className={`pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-[40px] ${currentVisual.glow}`}
        />
        <p className="text-sm text-black/40">Mevcut planınız</p>
        <div className="relative mt-3 flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${currentVisual.accent} ${currentVisual.iconClass}`}
          >
            <CurrentIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">{entitlements.planLabel}</h2>
            <p className="text-sm text-black/45">
              Kalan teklif: {remainingLabel} · Bu ay kullanılan:{" "}
              {entitlements.quota.used}
              {entitlements.quota.bonusCredits > 0
                ? ` · Bonus: ${entitlements.quota.bonusCredits}`
                : ""}
            </p>
          </div>
        </div>

        <div className="relative mt-5 grid gap-2 text-sm text-black/45 sm:grid-cols-2">
          <p>
            Kayıtlı plan:{" "}
            <strong className="text-black">
              {PLAN_DEFINITIONS[entitlements.storedPlanTier].label}
            </strong>
          </p>
          <p>
            Geçerli plan:{" "}
            <strong className="text-black">{entitlements.planLabel}</strong>
          </p>
          <p>
            Hesap türü:{" "}
            <strong className="text-black">
              {entitlements.subject.type === "company"
                ? `Firma · ${entitlements.subject.name ?? "Firma"}`
                : "Kişisel hesap"}
            </strong>
          </p>
          <p>
            Kişisel plan:{" "}
            <strong className="text-black">
              {entitlements.personalPlan?.planLabel ?? "Bireysel"}
            </strong>
            {entitlements.subject.type === "company" &&
            entitlements.personalPlan &&
            entitlements.personalPlan.effectivePlanTier !==
              entitlements.effectivePlanTier ? (
              <span className="ml-1 text-xs text-amber-700">
                (firma bağlamında geçerli değil)
              </span>
            ) : null}
          </p>
          <p>
            Bitiş:{" "}
            <strong className="text-black">
              {entitlements.expiresAt
                ? formatDate(entitlements.expiresAt)
                : "—"}
            </strong>
            {entitlements.isExpired ? " (süresi dolmuş)" : ""}
          </p>
        </div>

        {companies.length >= 1 && (
          <label className="relative mt-5 block max-w-md">
            <span className="mb-2 block text-xs text-black/40">
              Firma bağlamı
            </span>
            <select
              defaultValue={
                entitlements.subject.type === "company"
                  ? entitlements.subject.id
                  : ""
              }
              onChange={(event) => {
                const value = event.target.value;
                void runAction("company-context", {
                  action: "set-company-context",
                  companyId: value || null,
                });
              }}
              className="h-12 w-full rounded-[14px] border border-black/10 bg-white/70 px-3 text-sm text-black outline-none"
            >
              <option value="">Kişisel hesap</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      <section className="relative overflow-hidden rounded-[28px] border border-teal-900/15 bg-[#0d302d] p-6 text-white shadow-[0_24px_70px_rgba(9,55,50,0.18)] sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-300/10 blur-[70px]" />
        <div className="pointer-events-none absolute bottom-[-8rem] left-1/3 h-64 w-64 rounded-full bg-violet-400/10 blur-[90px]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.5)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="relative"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-teal-200/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-100">PRO intelligence</span><span className="text-xs text-white/45">Fırsat → teklif → takip</span></div>
        <h3 className="mt-5 max-w-2xl text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Talepo yalnızca talepleri göstermez.</h3>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-teal-50/70 sm:text-base">Hangi fırsata odaklanmanız gerektiğini, nasıl teklif vermenizi ve ne zaman takip etmenizi anlamanıza yardımcı olur.</p></div>
        <div className="relative mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {PRO_VALUE_PILLARS.map((pillar, index) => (
            <article key={pillar.id} className={`group relative rounded-[20px] border p-5 transition hover:-translate-y-0.5 xl:not-last:after:absolute xl:not-last:after:-right-3 xl:not-last:after:top-1/2 xl:not-last:after:h-px xl:not-last:after:w-3 xl:not-last:after:bg-white/20 ${index === 0 ? "border-cyan-200/20 bg-cyan-200/10" : index === 1 ? "border-blue-200/20 bg-blue-200/10" : index === 2 ? "border-violet-200/20 bg-violet-200/10" : "border-emerald-200/20 bg-emerald-200/10"}`}>
              <div className="flex items-start justify-between"><p className="text-2xl font-semibold tracking-[-0.05em] text-white/35">0{index + 1}</p><FeatureInfoTooltip feature={pillar.id === "capture" ? "smart_matching" : pillar.id === "analyze" ? "opportunity_intelligence" : pillar.id === "offer" ? "ai_offer_assistant" : "follow_up_intelligence"} /></div>
              <h4 className="mt-5 font-semibold text-white">{pillar.title}</h4><p className="mt-2 text-sm leading-6 text-white/60">{pillar.description}</p>
              <p className="mt-4 text-[11px] font-medium leading-5 text-white/45">{pillar.features.map((key) => FEATURE_META[key]?.label).filter(Boolean).slice(0, 3).join(" · ") || "Takip önerisi · kullanıcı onayı"}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-teal-900/10 bg-[#fbfdfc] p-5 shadow-[0_16px_44px_rgba(15,31,29,0.05)] sm:p-6">
        <h3 className="text-xl font-semibold tracking-tight text-[#0f172a]">
          Ayrıntılı özellikleriniz
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-black/52">
          Geçerli planınıza göre açılan özellikler; fırsatı bulmadan takibe kadar tek bir akışta.
        </p>
        <div className="mt-6 space-y-6">
          {activeFeatureKeys.length === 0 ? (
            <p className="rounded-[18px] bg-[#f6f6f2] p-4 text-sm text-black/50">
              Bireysel planda temel teklif hakkı dışında profesyonel özellik yok.
              Yükseltme ile AI asistan, anında erişim ve uyarı kuralları açılır.
            </p>
          ) : (
            DETAIL_GROUPS.map((group) => {
              const groupKeys = group.keys.filter((key) => activeFeatureKeys.includes(key));
              if (groupKeys.length === 0) return null;
              const pillarKey = PILLAR_FEATURE_KEY[group.id];
              return (
                <div key={group.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${group.accent === "cyan" ? "bg-cyan-500" : group.accent === "blue" ? "bg-blue-500" : group.accent === "violet" ? "bg-violet-500" : "bg-emerald-500"}`} />
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-950/72">{group.title}</h4>
                    <span className="h-px flex-1 bg-teal-900/10" />
                    <FeatureInfoTooltip feature={pillarKey} />
                  </div>
                  <ul className="divide-y divide-teal-900/10 rounded-[16px] border border-teal-900/10 bg-[#f8fbfa] px-3">
                    {groupKeys.map((key) => {
                      const meta = FEATURE_META[key];
                      const visual = getFeatureVisual(key);
                      const Icon = visual.icon;
                      const href = visual.href ?? meta.surface;
                      return (
                        <li key={key} className={`group/feature relative flex min-h-[68px] items-center gap-3 py-3 transition ${href ? "cursor-pointer" : ""}`}>
                          {href && <Link href={href} aria-label={`${meta.label} aç`} className="absolute inset-0 z-0 rounded-[12px] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/35" />}
                          <span className={`pointer-events-none relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] ${visual.iconWrap}`}><Icon className={`h-4 w-4 ${visual.iconClass}`} /></span>
                          <span className="pointer-events-none relative z-10 min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-[13px] font-bold text-[#102522]">{meta.label}</span>
                              {visual.badge && <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${visual.badgeClass}`}>{visual.badge}</span>}
                            </span>
                            <span className="mt-0.5 block text-[13px] leading-5 text-teal-950/62">{meta.description}</span>
                          </span>
                          <span className="relative z-20 shrink-0"><FeatureInfoTooltip feature={key} /></span>
                          {href && <span className={`pointer-events-none relative z-10 shrink-0 text-xs font-bold opacity-85 transition group-hover/feature:translate-x-0.5 group-hover/feature:opacity-100 ${visual.linkClass}`}>Aç →</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </div>
      </section>

      {message && (
        <div className="rounded-[20px] bg-[#e4f4df] p-4 text-sm font-semibold text-[#356d3a]">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-[20px] bg-[#ffe4df] p-4 text-sm font-semibold text-[#8b352b]">
          {error}
        </div>
      )}

      {showPlanChoices ? <section className="grid gap-5 lg:grid-cols-2">
        {getAvailablePlans().map((plan) => {
          const visual = PLAN_VISUALS[plan.id];
          const theme = PLAN_THEME_TOKENS[plan.id];
          const Icon = visual.icon;
          const isCurrent = entitlements.effectivePlanTier === plan.id;

          return (
            <article
              key={plan.id}
              className={`relative overflow-hidden rounded-[28px] border p-6 sm:p-7 ${visual.border} ${visual.surface} ${
                visual.highlight
                  ? (visual.highlightClass ??
                    "shadow-[0_16px_55px_rgba(0,0,0,0.04)]")
                  : "shadow-[0_16px_55px_rgba(0,0,0,0.04)]"
              }`}
            >
              <div
                className="absolute inset-x-0 top-0 h-1"
                style={{
                  background: `linear-gradient(90deg, ${theme.accent}, ${theme.primary})`,
                }}
                aria-hidden
              />
              <div
                className={`pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full blur-[45px] ${visual.glow}`}
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${visual.accent} ${visual.iconClass}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${visual.badge}`}
                    >
                      {visual.badgeText}
                    </span>
                    {isCurrent && (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${visual.activeBadge}`}
                      >
                        Aktif
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="mt-5 text-2xl font-semibold tracking-tight">
                  {plan.label}
                </h3>

                <p className="mt-3 text-sm leading-6 text-black/50">
                  {plan.description}
                </p>

                <div className="mt-5">
                  {plan.priceTry ? (
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-semibold tracking-[-0.04em]">
                        ₺{plan.priceTry.toLocaleString("tr-TR")}
                      </span>
                      <span className="pb-1 text-sm text-black/35">/ ay</span>
                    </div>
                  ) : (
                    <p className="text-xl font-semibold">Ücretsiz</p>
                  )}
                  {plan.id === "PROFESSIONAL" && (
                    <p className="mt-1 text-xs font-medium text-teal-900/70">
                      5 ekip koltuğu dahil
                    </p>
                  )}
                  <p className="mt-1 text-xs text-black/35">
                    Teklif kotası:{" "}
                    {plan.monthlyOfferQuota === null
                      ? "Sınırsız"
                      : `${plan.monthlyOfferQuota}/ay`}
                  </p>
                </div>

                <ul className="mt-5 space-y-2.5">
                  {PLAN_FEATURES[plan.id].map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm leading-6 text-black/55"
                    >
                      <span
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                        style={{ background: theme.primarySoft }}
                      >
                        <Check
                          className="h-3 w-3"
                          style={{ color: theme.primary }}
                        />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={
                    !canSelectPlan(plan.id) || loadingKey === plan.id
                  }
                  onClick={() => {
                    if (!canSelectPlan(plan.id)) return;
                    if (checkoutAvailable && plan.id !== "STANDARD") {
                      void startCheckout(plan.id as PlanTierId);
                      return;
                    }
                    void runAction(plan.id, {
                      action: "upgrade",
                      planTier: plan.id as PlanTierId,
                    });
                  }}
                  className={`mt-6 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${visual.button}`}
                >
                  {loadingKey === plan.id ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    <>
                      Aktif plan
                      <Check className="h-4 w-4" />
                    </>
                  ) : (
                    planButtonLabel(plan.id)
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </section> : <PremiumUpgradeCta compact />}

      <p className="text-xs leading-5 text-black/35">
        {checkoutAvailable
          ? billing?.mockBillingEnabled
            ? "Dev billing mock açık (ALLOW_MOCK_BILLING): checkout sonrası plan/credit yalnız imzalı webhook ile açılır. Browser success tek başına authority değildir."
            : billing?.providerStatus?.startsWith("IYZICO")
              ? "iyzico checkout hazır. Kart verisi Talepo’da tutulmaz; plan/kredi yalnız doğrulanmış webhook sonrası açılır."
              : "Checkout hazır. Plan/kredi yalnız doğrulanmış webhook sonrası açılır."
          : mockUpgradeEnabled
            ? "Eski test yükseltmesi (ALLOW_MOCK_UPGRADE) hâlâ açık olabilir; production'da kapalıdır. Gerçek provider bağlanana kadar checkout 402 döner."
            : "Ödeme sağlayıcısı henüz seçilmedi/bağlanmadı (PAYMENT_PROVIDER_REQUIRED). Fiyatlar bilgilendirme amaçlıdır; client plan/fiyat manipülasyonu etkisizdir."}
      </p>
      <div id="iyzipay-checkout-form" className="responsive mt-4" />
    </div>
  );
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}
