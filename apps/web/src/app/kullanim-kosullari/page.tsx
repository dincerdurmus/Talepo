import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kullanım koşulları",
};

export default function KullanimKosullariPage() {
  return (
    <main className="min-h-screen bg-[#f3f3ef] px-5 py-12 text-[#151515] sm:px-8">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm font-medium text-black/45 transition hover:text-black"
        >
          ← Talepo
        </Link>
        <h1 className="mt-6 text-4xl font-semibold tracking-[-0.045em]">
          Kullanım koşulları
        </h1>
        <p className="mt-3 text-sm text-black/40">Son güncelleme: Ağustos 2026</p>
        <div className="mt-8 space-y-5 text-base leading-7 text-black/60">
          <p>
            Talepo, alıcıların ihtiyaçlarını yayınladığı ve firmaların teklif
            verdiği bir B2B eşleşme platformudur. Hesap oluşturarak bu
            koşulları kabul etmiş sayılırsınız.
          </p>
          <p>
            Platform beta aşamasındadır. Hizmet sürekliliği, özellik seti ve
            ücretlendirme zamanla güncellenebilir. Ödeme altyapısı bağlanana
            kadar ücretli plan yükseltmeleri henüz aktif değildir.
          </p>
          <p>
            Kullanıcılar doğru ve hukuka uygun içerik paylaşmakla yükümlüdür.
            Sahte talep, spam teklif veya kötüye kullanım hesap kısıtlamasına
            yol açabilir.
          </p>
          <p>
            Detaylı hukuki metinler yayına alınmadan önce bu sayfa özet bilgilendirme
            amaçlıdır. Sorularınız için destek kanallarımızı kullanabilirsiniz.
          </p>
        </div>
      </div>
    </main>
  );
}
