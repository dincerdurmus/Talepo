import Link from "next/link";
import { ArrowRight, Crown } from "lucide-react";

import { AlertRulesManager } from "@/components/panel/AlertRulesManager";
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
          <p className="text-sm font-semibold text-teal-800/55">Premium özellik</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
            Talep bildirim kuralları
          </h1>
        </section>

        <div className="rounded-[28px] border border-amber-200/60 bg-gradient-to-br from-[#fffbeb] to-[#fef3c7] p-8">
          <Crown className="h-8 w-8 text-amber-700" />
          <h2 className="mt-4 text-2xl font-semibold text-[#78350f]">
            Bu özellik Premium ve üzeri planlarda açılır
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#92400e]/75">
            Kategori, bölge ve bütçeye göre otomatik talep uyarıları için
            planınızı yükseltmeniz gerekir.
          </p>
          <Link
            href="/panel/plan"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-700 to-teal-800 px-5 py-3 text-sm font-semibold text-white"
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
        <p className="text-sm font-semibold text-teal-800/55">Premium özellik</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
          Talep bildirim kuralları
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-black/45">
          Kategori ve şehir anahtar kelimelerine göre uyarı kuralları oluşturun.
          Eşleşen talepler yayınlandığında bildirim alacaksınız.
        </p>
      </section>

      <AlertRulesManager />
    </>
  );
}
