"use client";

import Link from "next/link";
import { Check, Crown, Lock } from "lucide-react";

import { minimumPlanForFeature, type FeatureKey } from "@/lib/membership/entitlements";
import { COMPANY_ONLY_FEATURES } from "@/lib/membership/feature-scope";
import { getPlanPricing } from "@/lib/membership/pricing-config";
import { UPGRADE_COPY } from "@/lib/membership/upgrade-copy";
import { getPublicProductLabel, PRO_VALUE_MESSAGES } from "@/lib/membership/product-packaging";

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

  const isCompanyCapability = (COMPANY_ONLY_FEATURES as readonly string[]).includes(
    feature,
  );
  const copy = UPGRADE_COPY[feature];
  const title = titleProp ?? copy?.title ?? (isCompanyCapability ? "Firma özelliği" : "Profesyonel özelliği");
  const description =
    descriptionProp ??
    copy?.description ??
    PRO_VALUE_MESSAGES[feature] ??
    (isCompanyCapability
      ? "Bu özellik firma çalışma alanında ücretli eklenti olarak açılır."
      : "Bu özellik Profesyonel planda açılır.");
  const bullets = copy?.bullets;
  const ctaLabel =
    ctaLabelProp ??
    copy?.cta ??
    (isCompanyCapability ? "Firma çalışma alanına git" : "Profesyonel'e geç");
  const ctaHref =
    feature === "hidden_inventory"
      ? "/panel/envanter"
      : isCompanyCapability
        ? "/panel/firma"
        : "/panel/plan";

  const requiredTier = minimumPlanForFeature(feature);
  const pricing = getPlanPricing(requiredTier);

  return (
    <section className="rounded-[28px] border border-teal-900/10 bg-gradient-to-br from-white via-teal-50/30 to-white px-6 py-10 shadow-[0_20px_60px_rgba(15,60,50,0.06)] sm:px-10">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-900/8 text-teal-800">
          <Lock className="h-7 w-7" />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-teal-800/45">
          {isCompanyCapability
            ? "Firma eklentisi"
            : `${getPublicProductLabel(requiredTier)} gerekli`}
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
        {!isCompanyCapability ? (
          <p className="mt-3 text-sm text-teal-950/40">
            {pricing.tagline}
            {pricing.priceTry
              ? ` · ${pricing.priceTry.toLocaleString("tr-TR")} TL/ay`
              : ""}
          </p>
        ) : null}
        <Link
          href={ctaHref}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-teal-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal-950"
        >
          <Crown className="h-4 w-4" />
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
