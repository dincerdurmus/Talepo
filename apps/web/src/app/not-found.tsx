import Link from "next/link";

/**
 * KÖK 404 — TEK ÇIKMAZ YOK KURALI (CLAUDE_PRODUCT_IMPROVEMENT, 2026-08-31).
 *
 * Ölçüldü: 46 sayfalık uygulamada hiçbir `not-found.tsx` yoktu; yanlış bir
 * adres Next'in çıplak varsayılan 404'üne düşüyor, kullanıcı Talepo'nun
 * dışına atılmış gibi kalıyordu. Sayfa Signal dilindedir: tek ana eylem,
 * sakin tipografi, kullanıcıyı çalışan iki gerçek yüzeye (talep oluşturma
 * ve panel) geri bağlayan net yönlendirme.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7f6] px-6 text-[#0f1f1d]">
      <div className="w-full max-w-[420px] text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0f766e]/70">
          404 · Sayfa bulunamadı
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.01em]">
          Aradığınız sayfa burada değil
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#0f1f1d]/55">
          Bağlantı eski olabilir ya da sayfa taşınmış olabilir. Talebinize
          panelden ulaşabilir veya yeni bir talep oluşturabilirsiniz.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/talep"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#0f766e] px-5 text-sm font-semibold text-white transition hover:bg-[#115e59]"
          >
            Yeni talep oluştur
          </Link>
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
