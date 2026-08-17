import type { LucideIcon } from "lucide-react";
import { Boxes, Users } from "lucide-react";

import {
  EXTRA_SEAT_ADDON,
  HIDDEN_INVENTORY_ADDON,
  formatAddonDisplayPriceLine,
} from "@/lib/membership/company-addon-policy";

type AddonOffer = {
  title: string;
  description: string;
  displayPriceLabel: string;
  purchaseCtaLabel: string;
  checkoutEnabled: boolean;
  priceTry: number | null;
};

export function ExtraSeatOfferCard({
  kicker = "Firma eklentisi",
}: {
  kicker?: string;
}) {
  return (
    <CompanyAddonOfferCard
      addon={EXTRA_SEAT_ADDON}
      icon={Users}
      kicker={kicker}
    />
  );
}

export function HiddenInventoryOfferCard({
  kicker = "Ücretli firma eklentisi",
}: {
  kicker?: string;
}) {
  return (
    <CompanyAddonOfferCard
      addon={HIDDEN_INVENTORY_ADDON}
      icon={Boxes}
      kicker={kicker}
    />
  );
}

function CompanyAddonOfferCard({
  addon,
  icon: Icon,
  kicker,
}: {
  addon: AddonOffer;
  icon: LucideIcon;
  kicker: string;
}) {
  const priceLine = formatAddonDisplayPriceLine(addon.displayPriceLabel);
  const ctaDisabled = !addon.checkoutEnabled || addon.priceTry == null;

  return (
    <article className="relative overflow-hidden rounded-[24px] border border-teal-900/10 bg-gradient-to-br from-white via-[#f7fbf9] to-[#eef6f4] p-5 shadow-[0_12px_32px_rgba(15,31,29,0.05)] sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(196,154,108,0.45),transparent)]"
      />
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800/50">
        {kicker}
      </p>
      <div className="mt-3 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#f4e6c8] text-[#b8893a]">
          <Icon className="h-4 w-4" strokeWidth={2.1} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#0f1f1d]">
            {addon.title}
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-black/50">
            {addon.description}
          </p>
          <p className="mt-3 text-sm font-semibold text-teal-950/80">
            {priceLine}
          </p>
          <button
            type="button"
            disabled={ctaDisabled}
            title={addon.purchaseCtaLabel}
            className="mt-4 inline-flex items-center rounded-full border border-teal-900/10 bg-white px-4 py-2 text-sm font-semibold text-teal-900/55 shadow-[0_1px_0_rgba(255,255,255,0.8)] disabled:cursor-not-allowed"
          >
            {addon.purchaseCtaLabel}
          </button>
        </div>
      </div>
    </article>
  );
}
