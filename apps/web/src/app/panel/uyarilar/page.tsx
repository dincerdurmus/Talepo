import Link from "next/link";
import { ArrowRight, BellRing, Crown, Plus } from "lucide-react";

import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { requireUser } from "@/server/auth/require-user";

export default async function AlertRulesPage() {
  const user = await requireUser();
  const entitlements = await resolveEntitlements(
    user.id,
    await getCompanyContextOptions(),
  );

  if (!entitlements.features.alert_rules) {
    return (
      <>
        <section className="py-4 sm:py-6">
          <p className="text-sm font-semibold text-black/35">Premium özellik</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
            Talep bildirim kuralları
          </h1>
        </section>

        <div className="rounded-[28px] border border-[#8c72c9]/20 bg-[#f8f5ff] p-8">
          <Crown className="h-8 w-8 text-[#704daf]" />
          <h2 className="mt-4 text-2xl font-semibold text-[#4f3d72]">
            Bu özellik Premium ve üzeri planlarda açılır
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#4f3d72]/75">
            Kategori, bölge ve bütçeye göre otomatik talep uyarıları için
            planınızı yükseltin. Entitlement kaydı hazır; kural motoru sonraki
            fazda bağlanacak.
          </p>
          <Link
            href="/panel/plan"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white"
          >
            Planları gör
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <section className="py-4 sm:py-6">
        <p className="text-sm font-semibold text-black/35">Premium özellik</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
          Talep bildirim kuralları
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-black/45">
          Planınızda <strong>alert_rules</strong> entitlement’ı açık. Kural
          oluşturma motoru sonraki fazda bağlanacak; yüzey hazır.
        </p>
      </section>

      <section className="rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_16px_55px_rgba(0,0,0,0.04)] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff7e8] text-[#b45309]">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Kayıtlı kurallar</h2>
              <p className="mt-2 text-sm text-black/45">
                Henüz kural yok. Motor bağlandığında burada listelenecek.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 rounded-full bg-black/10 px-4 py-2.5 text-sm font-semibold text-black/40"
          >
            <Plus className="h-4 w-4" />
            Kural ekle
          </button>
        </div>

        <div className="mt-6 rounded-[20px] bg-[#f6f6f2] p-5 text-sm text-black/45">
          Örnek kural (yakında):{" "}
          <em>Bağcılar · kiralık daire · max ₺30.000 → anında e-posta</em>
        </div>
      </section>
    </>
  );
}
