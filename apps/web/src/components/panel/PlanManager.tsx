"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Crown, LoaderCircle, Sparkles } from "lucide-react";

import {
  FEATURE_META,
  PLAN_SUMMARY_FEATURE_KEYS,
} from "@/lib/membership/feature-meta";
import { PLAN_FEATURES, PLAN_VISUALS } from "@/lib/membership/plan-visuals";
import {
  OFFER_CREDIT_PACKS,
  PLAN_DEFINITIONS,
  type PlanTierId,
} from "@/lib/membership/plans";
import type { EntitlementDTO } from "@/lib/membership/serialize";
import { formatQuotaRemaining } from "@/lib/membership/serialize";

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
      <section
        className={`relative overflow-hidden rounded-[28px] border p-6 ${
          currentVisual.dark
            ? "border-white/10 bg-[#151515] text-white"
            : "border-black/[0.06] bg-white"
        }`}
      >
        <div
          className={`pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-[40px] ${currentVisual.glow}`}
        />
        <p
          className={`text-sm ${currentVisual.dark ? "text-white/40" : "text-black/40"}`}
        >
          Mevcut planınız
        </p>
        <div className="relative mt-3 flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${currentVisual.accent} ${
              currentVisual.dark ? "text-white" : "text-[#151515]"
            }`}
          >
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">{entitlements.planLabel}</h2>
            <p
              className={`text-sm ${currentVisual.dark ? "text-white/50" : "text-black/45"}`}
            >
              Kalan teklif: {remainingLabel} · Bu ay kullanılan:{" "}
              {entitlements.quota.used}
              {entitlements.quota.bonusCredits > 0
                ? ` · Bonus: ${entitlements.quota.bonusCredits}`
                : ""}
            </p>
          </div>
        </div>

        <div
          className={`relative mt-5 grid gap-2 text-sm sm:grid-cols-2 ${
            currentVisual.dark ? "text-white/55" : "text-black/45"
          }`}
        >
          <p>
            Kayıtlı plan:{" "}
            <strong className={currentVisual.dark ? "text-white" : "text-black"}>
              {PLAN_DEFINITIONS[entitlements.storedPlanTier].label}
            </strong>
          </p>
          <p>
            Effective plan:{" "}
            <strong className={currentVisual.dark ? "text-white" : "text-black"}>
              {entitlements.planLabel}
            </strong>
          </p>
          <p>
            Subject:{" "}
            <strong className={currentVisual.dark ? "text-white" : "text-black"}>
              {entitlements.subject.type === "company"
                ? `Firma · ${entitlements.subject.name ?? entitlements.subject.id}`
                : "Kişisel hesap"}
            </strong>
          </p>
          <p>
            Bitiş:{" "}
            <strong className={currentVisual.dark ? "text-white" : "text-black"}>
              {entitlements.expiresAt
                ? formatDate(entitlements.expiresAt)
                : "—"}
            </strong>
            {entitlements.isExpired ? " (süresi dolmuş)" : ""}
          </p>
        </div>

        {companies.length >= 1 && (
          <label className="relative mt-5 block max-w-md">
            <span
              className={`mb-2 block text-xs ${
                currentVisual.dark ? "text-white/40" : "text-black/40"
              }`}
            >
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
              className={`h-12 w-full rounded-[14px] border px-3 text-sm outline-none ${
                currentVisual.dark
                  ? "border-white/15 bg-white/10 text-white"
                  : "border-black/10 bg-[#fafaf8] text-black"
              }`}
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

      <section className="rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_16px_55px_rgba(0,0,0,0.04)]">
        <h3 className="text-xl font-semibold tracking-tight">
          Aktif özellikleriniz
        </h3>
        <p className="mt-2 text-sm text-black/45">
          Effective planınıza göre açılan entitlement&apos;lar.
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
              return (
                <li
                  key={key}
                  className="rounded-[18px] border border-black/[0.05] bg-[#fafaf8] p-4"
                >
                  <p className="font-semibold">{meta.label}</p>
                  <p className="mt-1 text-sm text-black/45">{meta.description}</p>
                  {meta.surface && (
                    <Link
                      href={meta.surface}
                      className="mt-3 inline-flex text-xs font-semibold text-[#5b3fd4]"
                    >
                      Aç →
                    </Link>
                  )}
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
          const isDark = visual.dark;

          return (
            <article
              key={plan.id}
              className={`relative overflow-hidden rounded-[28px] border p-6 sm:p-7 ${visual.border} ${
                visual.highlight
                  ? "shadow-[0_24px_80px_rgba(124,92,255,0.16)] ring-1 ring-[#7c5cff]/15"
                  : "shadow-[0_16px_55px_rgba(0,0,0,0.04)]"
              } ${isDark ? "bg-[#151515] text-white" : "bg-white text-[#151515]"}`}
            >
              <div
                className={`pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full blur-[45px] ${visual.glow}`}
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${visual.accent} ${
                      isDark ? "text-white" : "text-[#151515]"
                    }`}
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

                <p
                  className={`mt-3 text-sm leading-6 ${
                    isDark ? "text-white/55" : "text-black/50"
                  }`}
                >
                  {plan.description}
                </p>

                <div className="mt-5">
                  {plan.priceTry ? (
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-semibold tracking-[-0.04em]">
                        ₺{plan.priceTry.toLocaleString("tr-TR")}
                      </span>
                      <span
                        className={`pb-1 text-sm ${
                          isDark ? "text-white/40" : "text-black/35"
                        }`}
                      >
                        / ay
                      </span>
                    </div>
                  ) : plan.id === "CORPORATE" ? (
                    <p className="text-xl font-semibold">Özel fiyatlandırma</p>
                  ) : (
                    <p className="text-xl font-semibold">Ücretsiz</p>
                  )}
                  <p
                    className={`mt-1 text-xs ${
                      isDark ? "text-white/35" : "text-black/35"
                    }`}
                  >
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
                      className={`flex items-start gap-2.5 text-sm leading-6 ${
                        isDark ? "text-white/70" : "text-black/55"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          isDark ? "bg-white/10" : "bg-[#e4f4df]"
                        }`}
                      >
                        <Check
                          className={`h-3 w-3 ${
                            isDark ? "text-[#c4f3bb]" : "text-[#356d3a]"
                          }`}
                        />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={isCurrent || loadingKey === plan.id}
                  onClick={() =>
                    runAction(plan.id, {
                      action: "upgrade",
                      planTier: plan.id as PlanTierId,
                    })
                  }
                  className={`mt-6 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-30 ${visual.button}`}
                >
                  {loadingKey === plan.id ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    <>
                      Aktif plan
                      <Check className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      {plan.priceTry
                        ? `₺${plan.priceTry}/ay — Seç`
                        : plan.id === "CORPORATE"
                          ? "İletişime geç"
                          : "Ücretsiz başla"}
                    </>
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
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {Object.entries(OFFER_CREDIT_PACKS).map(([packKey, pack]) => (
            <button
              key={packKey}
              type="button"
              disabled={loadingKey === packKey}
              onClick={() =>
                runAction(packKey, { action: "buy-credits", pack: packKey })
              }
              className="rounded-[22px] border border-white/60 bg-white/80 p-5 text-left transition hover:bg-white"
            >
              <p className="font-semibold text-[#312e81]">{pack.label}</p>
              <p className="mt-2 text-sm text-[#4338ca]">₺{pack.priceTry}</p>
            </button>
          ))}
        </div>
      </section>

      <p className="text-xs leading-5 text-black/35">
        Ödeme entegrasyonu henüz bağlanmadı. Plan yükseltme yalnızca{" "}
        <code className="rounded bg-black/[0.05] px-1">ALLOW_MOCK_UPGRADE=true</code>{" "}
        iken çalışır. Ek teklif paketleri geliştirme amaçlı anında uygulanır.
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
