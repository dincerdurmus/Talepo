import Link from "next/link";

import { MyRequestsBannerFlow } from "@/components/panel/my-requests/MyRequestsBannerFlow";
import {
  myRequestBannerExpiredCopy,
  myRequestBannerMixCopy,
  myRequestBannerTotalLabel,
  type MyRequestBannerSummary,
} from "@/lib/panel/my-requests-surface";

export function MyRequestsCommandHeader({
  banner,
}: {
  banner: MyRequestBannerSummary;
}) {
  const empty = banner.totalCount === 0;
  const totalLabel = myRequestBannerTotalLabel(banner.totalCount);
  const mixLabel = myRequestBannerMixCopy(
    banner.activeCount,
    banner.concludedCount,
  );
  const expiredLabel = myRequestBannerExpiredCopy(banner.expiredCount);

  return (
    <header className="talepo-my-requests-banner relative px-5 py-4 sm:px-8 sm:py-5 lg:px-9 lg:py-6">
      <div className="talepo-my-requests-banner-grid" aria-hidden />
      <div className="talepo-my-requests-banner-glow" aria-hidden />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="min-w-0 max-w-xl">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-[#c8f4eb]">
            KİŞİSEL TALEP MERKEZİ
          </p>
          <h1 className="mt-1.5 text-[1.5rem] font-semibold tracking-[-0.03em] text-[#f4fbf9] sm:text-[1.75rem]">
            Taleplerim
          </h1>
          <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-[#d7ece7] sm:text-[15px]">
            Oluşturduğun talepleri ve süreç durumlarını tek yerden takip et.
          </p>
          <div className="mt-4 hidden text-[#9ee8dc] lg:block" aria-hidden>
            <MyRequestsBannerFlow />
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-3 lg:w-[19.5rem] lg:shrink-0">
          <div
            className="talepo-my-requests-summary"
            aria-label="Talep durumu özeti"
          >
            {empty ? (
              <p className="text-[13px] leading-5 text-[#e7f3f0]">
                İlk talebini oluşturarak başlayabilirsin.
              </p>
            ) : (
              <ul className="space-y-1.5 text-[13px] leading-5">
                {totalLabel ? (
                  <li className="font-semibold tabular-nums text-[#e7f3f0]">
                    {totalLabel}
                  </li>
                ) : null}
                <li className="text-[#d7ece7]">{mixLabel}</li>
                {expiredLabel ? (
                  <li className="font-medium text-[#f3c48a]">{expiredLabel}</li>
                ) : null}
              </ul>
            )}
          </div>

          <Link
            href="/talep"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#f4fbf9] px-4 text-sm font-semibold text-[#0c1d1a] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            Yeni talep
          </Link>
        </div>
      </div>
    </header>
  );
}
