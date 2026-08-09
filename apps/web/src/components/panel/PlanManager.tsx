"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Crown, LoaderCircle, Sparkles } from "lucide-react";

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
import { PLAN_FEATURES, PLAN_VISUALS } from "@/lib/membership/plan-visuals";
import {
  OFFER_CREDIT_PACKS,
  PLAN_DEFINITIONS,
  type PlanTierId,
} from "@/lib/membership/plans";
import type { EntitlementDTO } from "@/lib/membership/serialize";
import { formatQuotaRemaining } from "@/lib/membership/serialize";

import { PersonalPlanMismatchBanner } from "./PersonalPlanMismatchBanner";

export type CompanyOption = {
  id: string;
  name: string;
};

type PlanManagerProps = {
  entitlements: EntitlementDTO;
  companies?: CompanyOption[];
};

export function PlanManager({
  entitlements,
  companies = [],
}: PlanManagerProps) {
  const router = useRouter();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      {personalMismatch && (
        <PersonalPlanMismatchBanner detail={mismatchDetail} />
      )}

      {entitlements.subject.type === "company" && (
        <p className="rounded-[18px] border border-teal-900/10 bg-[#f0fdfa] px-4 py-3 text-sm leading-6 text-teal-900/70">
          {TEAM_PLAN_SCOPE_NOTE}
        </p>
      )}

      <section
        className={`relative overflow-hidden rounded-[28px] border p-6 ${currentVisual.border} ${currentVisual.surface}`}
      >
        <div
          className={`pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-[40px] ${currentVisual.glow}`}
        />
        <p className="text-sm text-black/40">Mevcut planınız</p>
        <div className="relative mt-3 flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${currentVisual.accent} ${currentVisual.iconClass}`}
          >
            <Crown className="h-5 w-5" />
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

      <section className="rounded-[28px] border border-teal-900/10 bg-gradient-to-br from-[#f0fdfa] via-white to-[#fffbeb] p-6 shadow-[0_16px_55px_rgba(15,118,110,0.06)]">
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
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e4f4df]">
                        <Check className="h-3 w-3 text-[#356d3a]" />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={
                    isCurrent ||
                    loadingKey === plan.id ||
                    plan.id !== "STANDARD"
                  }
                  onClick={() => {
                    if (plan.id === "STANDARD") {
                      void runAction(plan.id, {
                        action: "upgrade",
                        planTier: plan.id as PlanTierId,
                      });
                    }
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
                  ) : plan.id === "CORPORATE" ? (
                    "Kurumsal · ödeme yakında"
                  ) : plan.priceTry ? (
                    `₺${plan.priceTry}/ay · ödeme yakında`
                  ) : (
                    "Ücretsiz başla"
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <section
        id="credits"
        className="rounded-[28px] border border-[#6366f1]/15 bg-gradient-to-br from-[#eef2ff] to-[#e0e7ff] p-6 sm:p-7"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6366f1] text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-[#312e81]">
              Ek teklif paketleri
            </h3>
            <p className="text-sm text-[#3730a3]/75">
              Premium almak istemeyen firmalar için tek seferlik paketler.
              Ödeme bağlanınca buradan satın alınabilecek.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {Object.entries(OFFER_CREDIT_PACKS).map(([packKey, pack]) => (
            <button
              key={packKey}
              type="button"
              disabled
              title="Ödeme altyapısı yakında"
              className="cursor-not-allowed rounded-[22px] border border-white/60 bg-white/80 p-5 text-left opacity-70"
            >
              <p className="font-semibold text-[#312e81]">{pack.label}</p>
              <p className="mt-2 text-sm text-[#4338ca]">₺{pack.priceTry}</p>
              <p className="mt-2 text-[11px] font-medium text-[#6366f1]">
                Ödeme yakında
              </p>
            </button>
          ))}
        </div>
      </section>

      <p className="text-xs leading-5 text-black/35">
        Ödeme altyapısı henüz bağlı değil. Ücretli plan yükseltmeleri ve ek
        paketler yakında açılacak; fiyatlar bilgilendirme amaçlıdır.
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
