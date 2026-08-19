"use client";

import Link from "next/link";

export default function MyRequestsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="talepo-my-requests mx-auto w-full max-w-[64rem] pb-6 pt-8">
      <section className="rounded-[1.75rem] border border-[#0f1f1d]/8 bg-white px-6 py-12 text-center sm:px-10">
        <h1 className="text-xl font-semibold tracking-tight text-[#0f1f1d]">
          Taleplerim şu an açılamadı
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#0f1f1d]/55">
          Liste yüklenirken bir sorun oluştu. Kısa süre sonra tekrar deneyin.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0f766e] px-5 text-sm font-semibold text-white"
          >
            Yeniden dene
          </button>
          <Link
            href="/panel"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#0f1f1d]/10 px-5 text-sm font-semibold text-[#0f1f1d]"
          >
            Sayfam
          </Link>
        </div>
      </section>
    </div>
  );
}
