"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, LoaderCircle, Sparkles } from "lucide-react";

import {
  FEATURE_META,
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
  OFFER_CREDIT_PACKS,
  PLAN_DEFINITIONS,
  planTierRank,
  type PlanTierId,
} from "@/lib/membership/plans";
import type { EntitlementDTO } from "@/lib/membership/serialize";
import { formatQuotaRemaining } from "@/lib/membership/serialize";

import { PersonalPlanMismatchBanner } from "./PersonalPlanMismatchBanner";

export type CompanyOption = {
  id: string;
  name: string;
};

type BillingStatusProps = {
  subscriptionStatus?: string;
  pendingCheckout?: boolean;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  providerStatus?: "NONE" | "MOCK_DEV" | "EXTERNAL_BLOCKED";
  mockBillingEnabled?: boolean;
  /** From URL ?billing=pending after checkout redirect */
  redirectPending?: boolean;
};

type PlanManagerProps = {
  entitlements: EntitlementDTO;
  companies?: CompanyOption[];
  mockUpgradeEnabled?: boolean;
  billing?: BillingStatusProps;
};

export function PlanManager({
  entitlements,
  companies = [],
  mockUpgradeEnabled = false,
  billing,
}: PlanManagerProps) {
  const router = useRouter();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const billingPending =
    Boolean(billing?.redirectPending) || Boolean(billing?.pendingCheckout);
  const checkoutAvailable =
    Boolean(billing?.mockBillingEnabled) ||
    billing?.providerStatus === "MOCK_DEV";

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
    if (planId === entitlements.effectivePlanTier) return false;
    if (planId === "CORPORATE") return false;
    if (planId === "STANDARD") return mockUpgradeEnabled;
    if (checkoutAvailable && planTierRank(planId) > currentRank) return true;
    return mockUpgradeEnabled && planTierRank(planId) > currentRank;
  }

  function planButtonLabel(planId: PlanTierId): string {
    if (planId === entitlements.effectivePlanTier) {
      return "Aktif plan";
    }
    if (planId === "CORPORATE") {
      return "Kurumsal · özel satış";
    }
    if (planId === "STANDARD") {
      return mockUpgradeEnabled ? "Standart'a geç (test)" : "Ücretsiz başla";
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

  async function startCheckout(planId: PlanTierId) {
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
      };
      if (!response.ok) {
        throw new Error(result.message || "Checkout başlatılamadı.");
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

  async function startCreditCheckout(packId: string) {
    setLoadingKey(packId);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/billing/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const result = (await response.json()) as {
        message?: string;
        checkoutUrl?: string;
      };
      if (!response.ok) {
        throw new Error(result.message || "Kredi ödemesi başlatılamadı.");
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
          : "Kredi ödemesi başlatılırken hata oluştu.",
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
              {entitlements.personalPlan?.planLabel ?? "Standart"}
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

      <section className="rounded-2xl border border-teal-900/10 bg-white p-6 shadow-[0_12px_36px_rgba(15,31,29,0.04)]">
        <h3 className="text-xl font-semibold tracking-tight text-[#0f172a]">
          Aktif özellikleriniz
        </h3>
        <p className="mt-2 text-sm text-black/45">
          Geçerli planınıza göre açılan özellikler.
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {activeFeatureKeys.length === 0 ? (
            <li className="rounded-[18px] bg-[#f6f6f2] p-4 text-sm text-black/50 sm:col-span-2">
              Standart planda temel teklif hakkı dışında premium özellik yok.
              Yükseltme ile AI asistan, anında erişim ve uyarı kuralları açılır.
            </li>
          ) : (
            activeFeatureKeys.map((key) => {
              const meta = FEATURE_META[key];
              const visual = getFeatureVisual(key);
              const Icon = visual.icon;
              const href = visual.href ?? meta.surface;
              const cta = visual.cta ?? "Aç →";

              return (
                <li
                  key={key}
                  className={`relative overflow-hidden rounded-[18px] border p-4 ${visual.border} ${visual.surface}`}
                >
                  <div
                    className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-[32px] ${visual.glow}`}
                  />
                  <div className="relative flex items-start gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${visual.iconWrap}`}
                    >
                      <Icon className={`h-4 w-4 ${visual.iconClass}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#0f172a]">{meta.label}</p>
                        {visual.badge && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${visual.badgeClass}`}
                          >
                            {visual.badge}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-black/45">{meta.description}</p>
                      {href && (
                        <Link
                          href={href}
                          className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold ${visual.linkClass}`}
                        >
                          {cta}
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
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

      <section className="grid gap-5 lg:grid-cols-2">
        {Object.values(PLAN_DEFINITIONS).map((plan) => {
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
                  ) : plan.id === "CORPORATE" ? (
                    <p className="text-xl font-semibold">Özel fiyatlandırma</p>
                  ) : (
                    <p className="text-xl font-semibold">Ücretsiz</p>
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
      </section>

      <section
        id="credits"
        className="rounded-2xl border border-teal-900/10 bg-[#eef6f4] p-6 sm:p-7"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0f766e] text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-[#0f1f1d]">
              Ek teklif paketleri
            </h3>
            <p className="text-sm text-teal-950/55">
              Premium almak istemeyen firmalar için tek seferlik paketler. Kredi
              yalnız doğrulanmış ödeme (webhook) sonrası eklenir.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {Object.entries(OFFER_CREDIT_PACKS).map(([packKey, pack]) => (
            <button
              key={packKey}
              type="button"
              disabled={!checkoutAvailable || loadingKey === packKey}
              title={
                checkoutAvailable
                  ? "Ödeme oturumu başlat"
                  : "Ödeme sağlayıcısı gerekli"
              }
              onClick={() => {
                if (checkoutAvailable) void startCreditCheckout(packKey);
              }}
              className={`rounded-xl border border-teal-900/10 bg-white p-5 text-left ${
                checkoutAvailable
                  ? "hover:border-teal-800/30"
                  : "cursor-not-allowed opacity-70"
              }`}
            >
              <p className="font-semibold text-[#0f1f1d]">{pack.label}</p>
              <p className="mt-2 text-sm text-teal-800">₺{pack.priceTry}</p>
              <p className="mt-2 text-[11px] font-medium text-teal-800/60">
                {checkoutAvailable ? "Ödemeye geç" : "Provider gerekli"}
              </p>
            </button>
          ))}
        </div>
      </section>

      <p className="text-xs leading-5 text-black/35">
        {checkoutAvailable
          ? "Dev billing mock açık (ALLOW_MOCK_BILLING): checkout sonrası plan/credit yalnız imzalı webhook ile açılır. Browser success tek başına authority değildir."
          : mockUpgradeEnabled
            ? "Eski test yükseltmesi (ALLOW_MOCK_UPGRADE) hâlâ açık olabilir; production'da kapalıdır. Gerçek provider bağlanana kadar checkout 402 döner."
            : "Ödeme sağlayıcısı henüz seçilmedi/bağlanmadı (PAYMENT_PROVIDER_REQUIRED). Fiyatlar bilgilendirme amaçlıdır; client plan/fiyat manipülasyonu etkisizdir."}
      </p>
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
