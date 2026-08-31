"use client";

/**
 * KÖK HATA SINIRI (CLAUDE_PRODUCT_IMPROVEMENT, 2026-08-31).
 *
 * Ölçüldü: uygulamada tek hata sınırı `panel/taleplerim/error.tsx` idi;
 * diğer 45 sayfadaki beklenmedik bir sunucu/istemci hatası Next'in çıplak
 * hata ekranına düşüyordu. Bu sınır hatayı Signal dilinde anlatır, tek ana
 * eylem sunar (yeniden dene) ve kullanıcıyı çıkmazda bırakmaz. Hata nesnesi
 * kullanıcıya sızdırılmaz; digest yalnız destek için gösterilir.
 */
import Link from "next/link";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7f6] px-6 text-[#0f1f1d]">
      <div className="w-full max-w-[420px] text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b352b]/80">
          Bir şeyler ters gitti
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.01em]">
          Sayfa yüklenemedi
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#0f1f1d]/55">
          Geçici bir sorun oluştu. Yeniden denemek çoğu zaman yeterlidir;
          sorun sürerse panele dönüp tekrar deneyebilirsiniz.
        </p>
        {error.digest ? (
          <p className="mt-2 text-[11px] text-[#0f1f1d]/35">
            Destek kodu: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#0f766e] px-5 text-sm font-semibold text-white transition hover:bg-[#115e59]"
          >
            Yeniden dene
          </button>
          <Link
            href="/panel"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#0f1f1d]/10 bg-white px-5 text-sm font-medium text-[#0f1f1d] transition hover:border-[#0f766e]/30"
          >
            Panele dön
          </Link>
        </div>
      </div>
    </main>
  );
}
