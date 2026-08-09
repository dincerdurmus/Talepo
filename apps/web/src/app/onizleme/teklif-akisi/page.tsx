import Link from "next/link";
import { Lock, MessageSquareText } from "lucide-react";

/**
 * Auth gerektirmeyen görsel önizleme.
 * Ürün akışını göstermek için: /onizleme/teklif-akisi
 */
export default function TeklifAkisiPreviewPage() {
  return (
    <main className="min-h-screen bg-[#f3f3ef] px-4 py-8 text-[#151515] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold text-black/35">Önizleme</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
          Teklif → Kabul → Mesajlaşma
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-black/45">
          Solda kabul öncesi (iletişim gizli, mesaj kapalı). Sağda kabul sonrası
          (güvenli mesajlaşma açık). Bu sayfa sadece görsel demo; giriş
          gerektirmez.
        </p>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {/* BEFORE ACCEPT */}
          <section className="rounded-[28px] border border-black/[0.06] bg-white p-5 shadow-[0_16px_50px_rgba(0,0,0,0.04)] sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/30">
              1 · Teklif geldi
            </p>
            <h2 className="mt-3 text-xl font-semibold">
              Bağcılar&apos;da kiralık daire
            </h2>
            <p className="mt-1 text-sm text-black/40">Emlak · İstanbul / Bağcılar</p>

            <div className="mt-5 rounded-[22px] border border-black/[0.06] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">Atlas Emlak</p>
                  <p className="mt-1 text-sm text-black/40">3 gün teslim / görüşme</p>
                </div>
                <p className="text-lg font-semibold">₺22.500</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-black/55">
                Daire hazır. Detayları kabul sonrası paylaşırım. Depozito ve
                aidat ayrı belirtilir.
              </p>
              <div className="mt-3 rounded-[14px] bg-[#fff7e8] px-3 py-2 text-xs font-medium text-[#9a3412]">
                İletişim bilgisi gizli — telefon / IBAN / WhatsApp paylaşılamaz
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
                >
                  Kabul et
                </button>
                <button
                  type="button"
                  className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold"
                >
                  Reddet
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-[18px] bg-[#f6f6f2] px-4 py-3 text-sm text-black/40">
              <Lock className="h-4 w-4" />
              Mesajlaşma kapalı — önce teklifi kabul edin
            </div>
          </section>

          {/* AFTER ACCEPT */}
          <section className="rounded-[28px] border border-black/[0.06] bg-white p-5 shadow-[0_16px_50px_rgba(0,0,0,0.04)] sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/30">
              2 · Kabul sonrası
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Atlas Emlak</h2>
                <p className="mt-1 text-sm text-black/40">
                  Bağcılar&apos;da kiralık daire
                </p>
              </div>
              <span className="rounded-full bg-[#e4f4df] px-3 py-1.5 text-xs font-semibold text-[#356d3a]">
                Kabul edildi
              </span>
            </div>

            <div className="mt-4 rounded-[14px] bg-[#e4f4df] px-3 py-2 text-xs font-medium text-[#356d3a]">
              Teklif kabul edildi — güvenli mesajlaşma açıldı
            </div>

            <div className="mt-4 flex min-h-[260px] flex-col rounded-[22px] border border-black/[0.06]">
              <div className="flex-1 space-y-3 p-4">
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-[18px] bg-[#f3f3ef] px-4 py-3 text-sm leading-6 text-black/70">
                    Merhaba, daireyi yarın 14:00&apos;te gösterebilirim.
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-[18px] bg-[#151515] px-4 py-3 text-sm leading-6 text-white">
                    Uygun. Depozito ve aidat bilgisini de yazabilir misiniz?
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-[18px] bg-[#f3f3ef] px-4 py-3 text-sm leading-6 text-black/70">
                    Depozito 1 kira, aidat ₺1.200. Detayları mesajda paylaşırım.
                  </div>
                </div>
              </div>
              <div className="border-t border-black/[0.06] p-3">
                <div className="flex items-center gap-2 rounded-[16px] bg-[#fafaf8] px-3 py-2">
                  <input
                    readOnly
                    value="Mesaj yazın..."
                    className="w-full bg-transparent text-sm text-black/35 outline-none"
                  />
                  <button
                    type="button"
                    className="rounded-full bg-black px-3 py-2 text-xs font-semibold text-white"
                  >
                    Gönder
                  </button>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-black/35">
                  <MessageSquareText className="h-3 w-3" />
                  Telefon ve IBAN mesajlarda engellenir
                </p>
              </div>
            </div>
          </section>
        </div>

        <p className="mt-6 text-center text-xs text-black/35">
          Canlı ürün yolu:{" "}
          <Link href="/panel/taleplerim" className="underline">
            /panel/taleplerim/[id]
          </Link>{" "}
          → Kabul et →{" "}
          <Link href="/panel/mesajlar" className="underline">
            /panel/mesajlar/[id]
          </Link>
        </p>
      </div>
    </main>
  );
}
