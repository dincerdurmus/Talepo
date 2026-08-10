"use client";

import Link from "next/link";
import { Check, Crown, Lock } from "lucide-react";

import { minimumPlanForFeature, type FeatureKey } from "@/lib/membership/entitlements";
import { getPlanPricing } from "@/lib/membership/pricing-config";
import { getPlanDefinition } from "@/lib/membership/plans";
import { UPGRADE_COPY } from "@/lib/membership/upgrade-copy";

type FeatureUpgradeGateProps = {
  feature: FeatureKey;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  /** When false, show upgrade state instead of children */
  entitled?: boolean;
  /** Override CTA label (defaults to UPGRADE_COPY or "Planları incele") */
  ctaLabel?: string;
};

export function FeatureUpgradeGate({
  feature,
  title: titleProp,
  description: descriptionProp,
  children,
  entitled = false,
  ctaLabel: ctaLabelProp,
}: FeatureUpgradeGateProps) {
  if (entitled && children) {
    return <>{children}</>;
  }

  const copy = UPGRADE_COPY[feature];
  const title = titleProp ?? copy?.title ?? "Premium özellik";
  const description =
    descriptionProp ??
    copy?.description ??
    "Bu özellik planınızda aktif değil.";
  const bullets = copy?.bullets;
  const ctaLabel = ctaLabelProp ?? copy?.cta ?? "Planları incele";

  const requiredTier = minimumPlanForFeature(feature);
  const plan = getPlanDefinition(requiredTier);
  const pricing = getPlanPricing(requiredTier);

  return (
    <section className="rounded-[28px] border border-teal-900/10 bg-gradient-to-br from-white via-teal-50/30 to-white px-6 py-10 shadow-[0_20px_60px_rgba(15,60,50,0.06)] sm:px-10">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-900/8 text-teal-800">
          <Lock className="h-7 w-7" />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-teal-800/45">
          {plan.label} planı gerekli
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-teal-950">
          {title}
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-teal-950/55">{description}</p>
        {bullets && bullets.length > 0 ? (
          <ul className="mt-5 w-full max-w-sm space-y-2 text-left">
            {bullets.map((bullet) => (
              <li
                key={bullet}
                className="flex items-start gap-2 text-sm text-teal-950/60"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                {bullet}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 text-sm text-teal-950/40">
          {pricing.tagline}
          {pricing.priceTry
            ? ` · ${pricing.priceTry.toLocaleString("tr-TR")} TL/ay`
            : pricing.tier === "CORPORATE"
              ? " · Özel fiyat"
              : ""}
        </p>
        <Link
          href="/panel/plan"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-teal-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal-950"
        >
          <Crown className="h-4 w-4" />
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
