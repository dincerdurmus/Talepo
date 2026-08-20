import Link from "next/link";

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

  const offerLabel =
    group.totalOffers === 1 ? "1 teklif" : `${group.totalOffers} teklif`;
  const newLabel =
    group.unreadCount <= 0
      ? null
      : group.unreadCount === 1
        ? "1 yeni"
        : `${group.unreadCount} yeni`;
  const actionLabel =
    group.actionRequiredCount > 0 ? "Yanıt bekleniyor" : null;
  const statusLabel = actionLabel
    ? "Yanıt bekleniyor"
    : newLabel
      ? "Yeni teklif"
      : group.negotiatingCount > 0
        ? "Pazarlıkta"
        : "Takip";
  const lifecycle = actionLabel
    ? "active"
    : group.concludedCount === group.totalOffers && group.totalOffers > 0
      ? "concluded"
      : "active";

  return (
    <article
      className={`talepo-my-requests-card talepo-my-requests-card--${lifecycle}`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
        <Link
          href={href}
          className="flex min-w-0 flex-1 gap-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f1f1d]/30 sm:gap-4"
          aria-label={`${group.request.title} talebi için teklifleri incele`}
        >
          <div className="h-[5.25rem] w-[5.25rem] shrink-0 self-start sm:h-24 sm:w-24">
            <IncomingRequestCover
              coverImageUrl={group.request.coverImageUrl}
              categorySlug={group.request.categorySlug}
              categoryName={group.request.categoryName}
              requestTitle={group.request.title}
              compact
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="talepo-my-requests-status text-[11px] font-semibold uppercase tracking-[0.12em]">
              {statusLabel}
            </p>
            <h2 className="mt-1.5 truncate text-[1.05rem] font-semibold tracking-[-0.02em] text-[#0f1f1d] sm:text-lg">
              {group.request.title}
            </h2>
            <p className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[#0f1f1d]/48">
              {group.request.city ? <span>{group.request.city}</span> : null}
              {group.request.budgetLabel ? (
                <span>{group.request.budgetLabel}</span>
              ) : null}
              {group.priceRangeLabel ? (
                <span>{group.priceRangeLabel}</span>
              ) : null}
              <span>{offerLabel}</span>
              {newLabel ? <span>{newLabel}</span> : null}
              {group.negotiatingCount > 0 ? <span>Pazarlıkta</span> : null}
              <span>{group.lastActivityLabel}</span>
            </p>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-2 border-t border-[#0f1f1d]/6 pt-3 sm:border-t-0 sm:pt-0">
          <Link
            href={href}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[#0f766e] px-4 text-sm font-semibold text-white transition hover:bg-[#115e59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e]/40 sm:flex-none"
          >
            Teklifleri incele
          </Link>
        </div>
      </div>
    </article>
  );
}
