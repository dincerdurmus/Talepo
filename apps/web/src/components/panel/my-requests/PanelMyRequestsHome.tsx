import Link from "next/link";
import type { ReactNode } from "react";

import { MyRequestsCommandHeader } from "@/components/panel/my-requests/MyRequestsCommandHeader";
import { EmptyIllustration } from "@/components/visuals/EmptyIllustration";
import {
  MY_REQUEST_FILTER_EMPTY,
  type MyRequestBannerSummary,
  type MyRequestFilter,
} from "@/lib/panel/my-requests-surface";

type PanelMyRequestsHomeProps = {
  banner: MyRequestBannerSummary;
  filterBar: ReactNode;
  children: ReactNode;
};

export function PanelMyRequestsHome({
  banner,
  filterBar,
  children,
}: PanelMyRequestsHomeProps) {
  return (
    <div className="talepo-my-requests mx-auto w-full max-w-[64rem] pb-6 pt-1 sm:pb-8 sm:pt-2">
      <div className="talepo-beacon-shell relative overflow-hidden rounded-[1.75rem] sm:rounded-[2rem]">
        <MyRequestsCommandHeader banner={banner} />
        <div className="talepo-beacon-body relative px-5 py-5 sm:px-8 sm:py-6 lg:px-9">
          {filterBar}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function MyRequestsEmpty({
  filter,
  totalCount,
}: {
  filter: MyRequestFilter;
  totalCount: number;
}) {
  const isAll = filter === "all";
  return (
    <section className="rounded-[1.35rem] border border-[#0f1f1d]/8 bg-white px-6 py-12 text-center sm:px-10 sm:py-14">
      {isAll && totalCount === 0 ? (
        <EmptyIllustration variant="requests" />
      ) : null}
      <h2
        className={`text-xl font-semibold tracking-tight text-[#0f1f1d] ${
          isAll && totalCount === 0 ? "mt-6" : ""
        }`}
      >
        {isAll ? "Henüz talebiniz yok" : "Bu filtrede talep yok"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#0f1f1d]/55">
        {isAll
          ? "İhtiyacınızı yazın; Talepo talebinizi yayına hazırlasın."
          : MY_REQUEST_FILTER_EMPTY[filter]}
      </p>
      {isAll || totalCount === 0 ? (
        <Link
          href="/talep"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0f766e] px-5 text-sm font-semibold text-white transition hover:bg-[#115e59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e]/40"
        >
          Yeni talep
        </Link>
      ) : (
        <Link
          href="/panel/taleplerim"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-[#0f1f1d]/10 bg-white px-5 text-sm font-semibold text-[#0f1f1d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f1f1d]/30"
        >
          Tüm talepleri göster
        </Link>
      )}
    </section>
  );
}
