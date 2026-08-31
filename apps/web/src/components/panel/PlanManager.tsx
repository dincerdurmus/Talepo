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
  type PlanTierId,
} from "@/lib/membership/plans";
import {
  getPublicFacingPlanId,
  isSelfServeCheckoutPlan,
  PROFESSIONAL_WORKSPACE_NOTE,
  PUBLIC_PLAN_TAGLINES,
  toPublicPlanId,
} from "@/lib/membership/product-packaging";
import type { EntitlementDTO } from "@/lib/membership/serialize";
import { formatQuotaRemaining } from "@/lib/membership/serialize";
import { FeatureInfoTooltip } from "./FeatureInfoTooltip";
import { PRO_FEATURE_PRESENTATION } from "@/lib/membership/feature-presentation";

import { PersonalPlanMismatchBanner } from "./PersonalPlanMismatchBanner";

export type CompanyOption = {
  id: string;
  name: string;
};

const DETAIL_GROUPS = [
  {
    id: "capture",
    title: "Keşfet",
    accent: "cyan",
    keys: [
      "talepo_radar",
      "hot_opportunities",
      "saved_searches",
      "smart_matching",
      "advanced_filters",
    ] as const,
  },
  {
    id: "analyze",
    title: "Karar ver",
    accent: "blue",
    keys: ["professional_analytics", "competition_signals"] as const,
  },
  {
    id: "offer",
    title: "Ölç",
    accent: "violet",
    keys: ["basic_market_insights"] as const,
  },
  {
    id: "follow-up",
    title: "Takip et",
    accent: "mint",
    keys: ["smart_alerts", "watchlist", "budget_change_alerts"] as const,
  },
] as const;

const SECTION_INFO: Record<
  string,
  { label: string; description: string }
> = {
  capture: {
    label: "Keşfet",
    description:
      "Yeni fırsatları bulma ve kriterlerinize uygun talepleri ayırt etme araçları.",
  },
  analyze: {
    label: "Karar ver",
    description:
      "Bir fırsata teklif verip vermemeyi ve teklif stratejinizi değerlendirmenize yardımcı olan araçlar.",
  },
  offer: {
    label: "Ölç",
    description:
      "Platform talep özeti ve performans görünürlüğüyle sonuçlarınızı takip etmenize yardımcı olan araçlar.",
  },
  "follow-up": {
    label: "Takip et",
    description:
      "Belirlediğiniz kriterleri sürekli izleyerek yeni eşleşmelerden haberdar olmanızı sağlayan araçlar.",
  },
};

function planFeatureTooltipDescription(
  key: string,
  subjectType: EntitlementDTO["subject"]["type"],
): string | undefined {
  if (key === "smart_matching") {
    return subjectType === "company"
      ? "Talepo şirket profiliniz ve desteklenen çalışma alanı sinyalleriyle fırsat uygunluğunu değerlendirir."
      : "Talepo kayıtlı tercihleriniz ve desteklenen kişisel eşleşme sinyalleriyle fırsatların size ne kadar ilgili olduğunu değerlendirir.";
  }
  return undefined;
}

function planFeatureLabel(key: string): string {
  if (key === "smart_alerts") return "Anlık bildirimler";
  if (key === "saved_searches") return "Takiplerim";
  const presentation =
    PRO_FEATURE_PRESENTATION[key as keyof typeof PRO_FEATURE_PRESENTATION];
  return (
    presentation?.label ??
    FEATURE_META[key as keyof typeof FEATURE_META]?.label ??
    key
  );
}


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

  const publicPlanId = getPublicFacingPlanId(
    entitlements.storedPlanTier,
    entitlements.effectivePlanTier,
  );
  const visualKey = publicPlanId;
  const currentVisual = PLAN_VISUALS[visualKey];
  const remainingLabel = formatQuotaRemaining(entitlements.quota);
  const activeFeatureKeys = PLAN_SUMMARY_FEATURE_KEYS.filter(
    (key) => entitlements.features[key],
  );
  const personalMismatch = hasPersonalPlanMismatch(entitlements);
  const mismatchDetail = personalMismatch
    ? formatPersonalPlanMismatchDetail(entitlements)
    : undefined;

  function canSelectPlan(planId: PlanTierId): boolean {
    if (!canMutateBilling) return false;
    if (planId === "PREMIUM" || planId === "CORPORATE") return false;
    if (publicPlanId === planId) return false;
    if (planId === "STANDARD") return mockUpgradeEnabled;
    if (
      isSelfServeCheckoutPlan(planId) &&
      checkoutAvailable &&
      publicPlanId === "STANDARD"
    ) {
      return true;
    }
    return mockUpgradeEnabled && planId === "PROFESSIONAL" && publicPlanId === "STANDARD";
  }

  function planButtonLabel(planId: PlanTierId): string {
    if (publicPlanId === planId) {
      return "Aktif plan";
    }
    if (planId === "STANDARD") {
      return mockUpgradeEnabled ? "Bireysel'e geç (test)" : "Ücretsiz başla";
    }
    const plan = PLAN_DEFINITIONS[planId];
    if (
      isSelfServeCheckoutPlan(planId) &&
      checkoutAvailable &&
      publicPlanId === "STANDARD"
    ) {
      return `Ödemeye geç · ₺${plan.priceTry?.toLocaleString("tr-TR")}/ay`;
    }
    if (mockUpgradeEnabled && planId === "PROFESSIONAL" && publicPlanId === "STANDARD") {
      return `Test yükselt · ₺${plan.priceTry?.toLocaleString("tr-TR")}/ay`;
    }
    if (plan.priceTry) {
      return `₺${plan.priceTry.toLocaleString("tr-TR")}/ay`;
    }
    return "İncele";
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
        // Ödeme sağlayıcısına tam-sayfa yönlendirme — event handler içinde kasıtlı navigasyon.
        // eslint-disable-next-line react-hooks/immutability
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
        <p className="talepo-plan-status">
          {TEAM_PLAN_SCOPE_NOTE}
        </p>
      )}

      {entitlements.subject.type === "company" && !canMutateBilling && (
        <p className="talepo-plan-status">
          Firma planı ve ödeme işlemlerini yalnızca sahip veya yönetici
          başlatabilir. Mevcut plan haklarınızı görebilirsiniz.
        </p>
      )}

      {billingPending && (
        <p className="talepo-plan-status talepo-plan-status--warn">
          Ödemeniz doğrulanıyor. Plan hakları, ödeme sağlayıcısı webhook ile
          onaylanana kadar açılmaz.
        </p>
      )}

      {billing?.subscriptionStatus && billing.subscriptionStatus !== "INACTIVE" && (
        <p className="text-sm text-teal-950/48">
          Abonelik durumu: <strong className="font-semibold text-[#0f1f1d]">{billing.subscriptionStatus}</strong>
          {billing.currentPeriodEnd
            ? ` · dönem sonu: ${formatDate(billing.currentPeriodEnd)}`
            : ""}
          {billing.cancelAtPeriodEnd ? " · dönem sonunda iptal" : ""}
        </p>
      )}

      {(message || error) && (
        <p
          className={`talepo-plan-status ${
            error ? "border-red-200 bg-red-50 text-red-800" : ""
          }`}
        >
          {error || message}
        </p>
      )}

      <section
        className={`talepo-plan-current relative ${currentVisual.border} ${currentVisual.surface}`}
      >
        <div
          className="talepo-plan-accent-bar absolute inset-x-0 top-0 h-[3px]"
          aria-hidden
        />
        <div
          className={`pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-[40px] ${currentVisual.glow}`}
        />
        <p className="talepo-plan-current-mark">Mevcut plan</p>
        <div className="relative mt-3 flex flex-wrap items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${currentVisual.accent} ${currentVisual.iconClass}`}
          >
            <CurrentIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight text-[#0f1f1d]">
                {entitlements.planLabel}
              </h2>
              <span className="rounded-full border border-teal-900/12 bg-teal-900/[0.05] px-2.5 py-0.5 text-[11px] font-semibold text-teal-900/70">
                Aktif
              </span>
            </div>
            <p className="mt-1 text-sm text-teal-950/48">
              {remainingLabel === "Sınırsız"
                ? "Sınırsız teklif"
                : `Kalan teklif: ${remainingLabel}`}
              {entitlements.quota.bonusCredits > 0
                ? ` · Bonus: ${entitlements.quota.bonusCredits}`
                : ""}
            </p>
          </div>
        </div>

        <div className="talepo-plan-meta relative">
          <span>
            {entitlements.subject.type === "company"
              ? `Firma · ${entitlements.subject.name ?? "Firma"}`
              : "Kişisel hesap"}
          </span>
          {entitlements.expiresAt ? (
            <span>
              Bitiş: <strong>{formatDate(entitlements.expiresAt)}</strong>
              {entitlements.isExpired ? " (süresi dolmuş)" : ""}
            </span>
          ) : null}
          {personalMismatch && entitlements.personalPlan ? (
            <span>
              Kişisel plan:{" "}
              <strong>{entitlements.personalPlan.planLabel}</strong>
              <span className="ml-1 text-amber-700">
                (firma bağlamında geçerli değil)
              </span>
            </span>
          ) : null}
        </div>

        <p className="relative mt-4 text-[12px] leading-5 text-teal-950/42">
          Talep oluşturmak ücretsizdir. Profesyonel üyelik doğrulanmış ödeme
          sonrası açılır.
        </p>

        {companies.length >= 1 && (
          <label className="relative mt-4 block max-w-md">
            <span className="mb-1.5 block text-[11px] font-medium text-teal-950/42">
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
              className="h-11 w-full rounded-[12px] border border-teal-900/10 bg-white/80 px-3 text-sm text-[#0f1f1d] outline-none"
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

      <section className="relative overflow-hidden rounded-[1.35rem] border border-teal-900/12 bg-[#16262f] p-6 text-white sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-teal-300/10 blur-[70px]" />
        <div className="pointer-events-none absolute bottom-[-6rem] left-1/3 h-48 w-48 rounded-full bg-amber-200/8 blur-[80px]" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100/90">
              Profesyonel
            </span>
            <span className="text-xs text-white/45">Keşfet → karar ver → ölç</span>
          </div>
          <h3 className="mt-4 max-w-2xl text-[1.65rem] font-semibold tracking-[-0.04em] sm:text-3xl">
            Fırsatı bul. Doğru teklifi ver. Performansını geliştir.
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/65 sm:text-[15px]">
            Talepo Radar hareketi gösterir. Teklif Zekâsı aynı talepteki anonim fiyat dağılımını gösterir. Analiz sizin performansınızdır.
          </p>
        </div>
        <div className="relative mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {PRO_VALUE_PILLARS.map((pillar, index) => (
            <article
              key={pillar.id}
              className={`rounded-[1.1rem] border p-4 ${
                index === 0
                  ? "border-cyan-200/15 bg-cyan-200/8"
                  : index === 1
                    ? "border-blue-200/15 bg-blue-200/8"
                    : index === 2
                      ? "border-violet-200/15 bg-violet-200/8"
                      : "border-emerald-200/15 bg-emerald-200/8"
              }`}
            >
              <div className="flex items-start justify-between">
                <p className="text-xl font-semibold tracking-[-0.05em] text-white/30">
                  0{index + 1}
                </p>
                <FeatureInfoTooltip
                  feature={
                    pillar.id === "capture"
                      ? "talepo_radar"
                      : pillar.id === "analyze"
                        ? "professional_analytics"
                        : pillar.id === "offer"
                          ? "basic_market_insights"
                          : "saved_searches"
                  }
                />
              </div>
              <h4 className="mt-4 font-semibold text-white">{pillar.title}</h4>
              <p className="mt-2 text-sm leading-6 text-white/55">{pillar.description}</p>
              <p className="mt-3 text-[11px] font-medium leading-5 text-white/40">
                {pillar.features
                  .map((key) => planFeatureLabel(key))
                  .filter((label, index, list) => list.indexOf(label) === index)
                  .slice(0, 3)
                  .join(" · ") || "Takip önerisi · kullanıcı onayı"}
              </p>
            </article>
          ))}
        </div>
      </section>

      {showPlanChoices ? (
        <section>
          <p className="talepo-plan-section-label">Planları karşılaştır</p>
          <div className="grid gap-5 lg:grid-cols-2">
        {getAvailablePlans().map((plan) => {
          const visual = PLAN_VISUALS[plan.id];
          const theme = PLAN_THEME_TOKENS[plan.id];
          const Icon = visual.icon;
          const isCurrent = publicPlanId === plan.id;

          return (
            <article
              key={plan.id}
              className={`relative overflow-hidden rounded-[1.35rem] border p-5 sm:p-6 ${visual.border} ${visual.surface} ${
                visual.highlight
                  ? (visual.highlightClass ??
                    "shadow-[0_12px_36px_rgba(15,31,29,0.05)]")
                  : "shadow-[0_10px_28px_rgba(15,31,29,0.04)]"
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

                  {isCurrent ? (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${visual.activeBadge}`}
                    >
                      Aktif
                    </span>
                  ) : (
                    <span
                      className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${visual.badge}`}
                    >
                      {visual.badgeText}
                    </span>
                  )}
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
                  <p className="mt-1 text-xs font-medium text-teal-900/70">
                    {PUBLIC_PLAN_TAGLINES[toPublicPlanId(plan.id)]}
                  </p>
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
                {plan.id === "PROFESSIONAL" ? (
                  <p className="mt-4 text-[11px] leading-5 text-black/40">
                    {PROFESSIONAL_WORKSPACE_NOTE}
                  </p>
                ) : null}

                <button
                  type="button"
                  disabled={
                    !canSelectPlan(plan.id) || loadingKey === plan.id
                  }
                  onClick={() => {
                    if (!canSelectPlan(plan.id)) return;
                    if (checkoutAvailable && isSelfServeCheckoutPlan(plan.id)) {
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
          </div>
        </section>
      ) : null}

      <section className="rounded-[1.35rem] border border-teal-900/10 bg-white/75 p-5 sm:p-6">
        <p className="talepo-plan-section-label">Özellikler</p>
        <h3 className="mt-1 text-lg font-semibold tracking-tight text-[#0f172a]">
          Planınızda açılan yetenekler
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-black/48">
          Geçerli planınıza göre açılan özellikler; keşiften takibe kadar.
        </p>
        <div className="mt-6 space-y-6">
          {activeFeatureKeys.length === 0 ? (
            <p className="rounded-[16px] bg-[#f6f6f2] p-4 text-sm text-black/50">
              Standard planda talep oluşturma, ayda 5 teklif, keşif ve temel
              Analiz açıktır. Radar, Teklif Zekâsı, Fırsatlar ve Takiplerim
              Profesyonel ile açılır.
            </p>
          ) : (
            DETAIL_GROUPS.map((group) => {
              const groupKeys = group.keys.filter((key) => activeFeatureKeys.includes(key));
              if (groupKeys.length === 0) return null;
              const sectionInfo = SECTION_INFO[group.id];
              return (
                <div key={group.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${group.accent === "cyan" ? "bg-cyan-500" : group.accent === "blue" ? "bg-blue-500" : group.accent === "violet" ? "bg-violet-500" : "bg-emerald-500"}`} />
                    <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-950/55">{group.title}</h4>
                    <span className="h-px flex-1 bg-teal-900/8" />
                    {sectionInfo ? (
                      <FeatureInfoTooltip
                        label={sectionInfo.label}
                        description={sectionInfo.description}
                      />
                    ) : null}
                  </div>
                  <ul className="divide-y divide-teal-900/8 rounded-[14px] border border-teal-900/8 bg-[#f8fbfa]/70 px-3">
                    {groupKeys.map((key) => {
                      const meta = FEATURE_META[key];
                      const presentation = PRO_FEATURE_PRESENTATION[key];
                      const visual = getFeatureVisual(key);
                      const Icon = visual.icon;
                      const href = visual.href ?? meta.surface ?? ((key === "smart_matching" || key === "competition_signals") ? "/panel/firsatlar" : undefined);
                      return (
                        <li key={key} className={`group/feature relative flex min-h-[60px] items-center gap-3 py-2.5 transition ${href ? "cursor-pointer" : ""}`}>
                          {href && <Link href={href} aria-label={`${planFeatureLabel(key)} aç`} className="absolute inset-0 z-0 rounded-[12px] transition hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/35" />}
                          <span className="pointer-events-none relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-teal-900/[0.03] text-teal-900/45"><Icon className="h-3.5 w-3.5" /></span>
                          <span className="pointer-events-none relative z-10 min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[13px] font-semibold text-[#102522]">{planFeatureLabel(key)}</span>
                              <span className="pointer-events-auto relative z-20">
                                <FeatureInfoTooltip
                                  feature={key}
                                  label={planFeatureLabel(key)}
                                  description={planFeatureTooltipDescription(
                                    key,
                                    entitlements.subject.type,
                                  )}
                                />
                              </span>
                            </span>
                            <span className="mt-0.5 block text-[12px] leading-5 text-teal-950/50">{presentation?.description ?? meta.description}</span>
                          </span>
                          {href && <span className="pointer-events-none relative z-10 shrink-0 text-xs font-semibold text-teal-900/50 opacity-80 transition group-hover/feature:translate-x-0.5 group-hover/feature:opacity-100">{presentation?.actionLabel ?? visual.cta ?? "Aç →"}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </div>
        <p className="mt-5 text-[11px] leading-5 text-black/40">
          Profesyonel üyelik ile firma çalışma alanı açılabilir; koltuklar ayrıca yönetilir. Gizli Envanter şirket alanına bağlı ücretli bir eklentidir — üçüncü bir kullanıcı planı değildir.
        </p>
      </section>

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
