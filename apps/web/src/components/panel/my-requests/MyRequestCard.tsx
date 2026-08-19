import Link from "next/link";

import { MyRequestOverflowMenu } from "@/components/panel/my-requests/MyRequestOverflowMenu";
import { CategoryVisualThumb } from "@/components/visuals/CategoryVisualThumb";
import type { MyRequestCardModel } from "@/lib/panel/my-requests-surface";

export function MyRequestCard({ request }: { request: MyRequestCardModel }) {
  const offerLabel =
    request.offerCount === 0
      ? null
      : request.offerCount === 1
        ? "1 teklif"
        : `${request.offerCount} teklif`;
  const newOfferLabel =
    request.newCount <= 0
      ? null
      : request.newCount === 1
        ? "1 yeni teklif"
        : `${request.newCount} yeni teklif`;
  const actionLabel =
    request.actionRequiredCount > 0 ? "Yanıt bekleniyor" : null;
  const showOverflow =
    request.canEdit ||
    request.canDelete ||
    request.canCloneAsDraft ||
    request.primaryCta.kind !== "view";

  return (
    <article
      className={`talepo-my-requests-card talepo-my-requests-card--${request.lifecycle}`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
        <Link
          href={request.viewHref}
          className="flex min-w-0 flex-1 gap-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f1f1d]/30 sm:gap-4"
        >
          <CategoryVisualThumb
            categorySlug={request.categorySlug}
            categoryName={request.categoryName}
            coverImageUrl={request.coverImageUrl}
            requestTitle={request.title}
            size="md"
            className="self-start"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="talepo-my-requests-status text-[11px] font-semibold uppercase tracking-[0.12em]">
                {request.statusLabel}
              </p>
              {request.isUrgent ? (
                <span className="text-[11px] font-semibold text-[#0f1f1d]/45">
                  Acil
                </span>
              ) : null}
            </div>
            <h2 className="mt-1.5 truncate text-[1.05rem] font-semibold tracking-[-0.02em] text-[#0f1f1d] sm:text-lg">
              {request.title}
            </h2>
            <p className="mt-1 text-[13px] leading-5 text-[#0f1f1d]/58">
              {request.nextStep}
            </p>
            <p className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[#0f1f1d]/48">
              {request.locationLabel ? (
                <span>{request.locationLabel}</span>
              ) : null}
              {request.budgetLabel ? <span>{request.budgetLabel}</span> : null}
              <span>{request.lastActivityLabel}</span>
              {offerLabel ? <span>{offerLabel}</span> : null}
              {newOfferLabel ? <span>{newOfferLabel}</span> : null}
              {actionLabel ? <span>{actionLabel}</span> : null}
              {request.hasNegotiationSignal ? <span>Pazarlıkta</span> : null}
              {request.hasMessageSignal && request.lane === "in_progress" ? (
                <span>Mesaj</span>
              ) : null}
            </p>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-2 border-t border-[#0f1f1d]/6 pt-3 sm:border-t-0 sm:pt-0">
          <Link
            href={request.primaryCta.href}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[#0f766e] px-4 text-sm font-semibold text-white transition hover:bg-[#115e59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e]/40 sm:flex-none"
          >
            {request.primaryCta.label}
          </Link>
          {showOverflow ? <MyRequestOverflowMenu request={request} /> : null}
        </div>
      </div>
    </article>
  );
}
