import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gizlilik politikası",
};

export default function GizlilikPolitikasiPage() {
  return (
    <main className="min-h-screen bg-[#f4f7f6] px-5 py-12 text-[#0f1f1d] sm:px-8">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm font-medium text-black/45 transition hover:text-black"
        >
          ← Talepo
        </Link>
        <h1 className="mt-6 text-4xl font-semibold tracking-[-0.045em]">
          Gizlilik politikası
        </h1>
        <p className="mt-3 text-sm text-black/40">Son güncelleme: Ağustos 2026</p>
        <div className="mt-8 space-y-5 text-base leading-7 text-black/60">
          <p>
            Talepo; ad, e-posta, telefon ve firma bilgilerinizi hesabınızı
            yönetmek, talepleri eşleştirmek ve teklif süreçlerini yürütmek için
            işler.
          </p>
          <p>
            İletişim bilgileriniz, teklif kabul edilene kadar karşı tarafa
            gösterilmez. Oturum ve güvenlik için çerezler kullanılabilir.
          </p>
          <p>
            Verileriniz üçüncü taraflarla pazarlama amacıyla satılmaz. Yasal
            zorunluluk veya hizmet sağlayıcıları (barındırma, kimlik doğrulama)
            kapsamında sınırlı paylaşım yapılabilir.
          </p>
          <p>
            Bu metin beta döneminde özet bilgilendirmedir. KVKK kapsamında tam
            aydınlatma metni yakında yayımlanacaktır.
          </p>
        </div>
      </div>
    </main>
  );
}
