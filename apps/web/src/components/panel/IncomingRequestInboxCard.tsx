import Link from "next/link";
import { ArrowRight, MapPin, Wallet } from "lucide-react";

import { IncomingRequestCover } from "@/components/panel/IncomingRequestCover";
import { buildIncomingRequestWorkspacePath } from "@/lib/offer/incoming-offer-inbox";
import type { IncomingOfferInboxFilter } from "@/lib/offer/incoming-offer-inbox";
import type { IncomingRequestGroup } from "@/lib/offer/incoming-request-inbox";

export function IncomingRequestInboxCard({
  group,
  filter,
  archiveView = false,
}: {
  group: IncomingRequestGroup;
  filter: IncomingOfferInboxFilter;
  archiveView?: boolean;
}) {
  const href = buildIncomingRequestWorkspacePath({
    requestId: group.request.id,
    filter,
    archiveView,
  });

  const statsParts = [
    `${group.totalOffers} teklif`,
    group.unreadCount > 0 ? `${group.unreadCount} yeni` : null,
    group.actionRequiredCount > 0
      ? `${group.actionRequiredCount} yanıtınız bekleniyor`
      : null,
  ].filter(Boolean);

  return (
    <article className="talepo-card overflow-hidden transition hover:border-teal-700/20 hover:shadow-[0_14px_42px_rgba(15,118,110,0.07)]">
      <Link
        href={href}
        className="flex min-h-11 flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:p-5"
        aria-label={`${group.request.title} talebi için teklifleri incele`}
      >
        <div className="h-20 w-20 shrink-0 sm:h-24 sm:w-24">
          <IncomingRequestCover
            coverImageUrl={group.request.coverImageUrl}
            categorySlug={group.request.categorySlug}
            categoryName={group.request.categoryName}
            requestTitle={group.request.title}
            compact
          />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight text-[#0f1f1d]">
            {group.request.title}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-black/50">
            {group.request.city ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {group.request.city}
              </span>
            ) : null}
            {group.request.budgetLabel ? (
              <span className="inline-flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5" aria-hidden />
                {group.request.budgetLabel}
              </span>
            ) : null}
          </p>

          <p className="mt-2 text-sm font-medium text-teal-950/75">
            {statsParts.join(" · ")}
          </p>

          {group.priceRangeLabel ? (
            <p className="mt-1 text-xs text-black/45">
              Fiyat aralığı: {group.priceRangeLabel}
            </p>
          ) : null}

          {group.negotiatingCount > 0 ? (
            <p className="mt-1 text-xs text-black/45">
              {group.negotiatingCount} teklif pazarlıkta
            </p>
          ) : null}

          <p className="mt-1 text-xs text-black/35">
            Son hareket: {group.lastActivityLabel}
          </p>
        </div>

        <span className="inline-flex shrink-0 items-center gap-1 self-end text-sm font-semibold text-[#0f766e] sm:self-center">
          Teklifleri incele
          <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
      </Link>
    </article>
  );
}
