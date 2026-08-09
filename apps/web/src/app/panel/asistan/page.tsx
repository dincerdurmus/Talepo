import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Crown } from "lucide-react";

import { AiAssistantPanel } from "@/components/panel/AiAssistantPanel";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { requireUser } from "@/server/auth/require-user";

export default async function AiAssistantPage() {
  const user = await requireUser();
  const entitlements = await resolveEntitlements(
    user.id,
    await getCompanyContextOptions(),
  );

  const allowed =
    entitlements.features.ai_offer_assistant ||
    entitlements.features.advanced_ai_pricing;

  if (!allowed) {
    return (
      <>
        <section className="py-4 sm:py-6">
          <p className="text-sm font-semibold text-teal-800/55">Premium özellik</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
            AI teklif asistanı
          </h1>
        </section>

        <div className="rounded-[28px] border border-amber-200/60 bg-gradient-to-br from-[#fffbeb] to-[#fef3c7] p-8">
          <Crown className="h-8 w-8 text-amber-700" />
          <h2 className="mt-4 text-2xl font-semibold text-[#78350f]">
            Bu özellik Premium ve üzeri planlarda açılır
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#92400e]/75">
            AI teklif asistanı ve gelişmiş fiyat analizi için planınızı
            yükseltmeniz gerekir.
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
          AI teklif asistanı
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-black/45">
          Talep bağlamına göre teklif taslağı, fiyat bandı ve teslim notu
          üretin. Fiyatlar tahmini olup kategori katsayılarına dayanır.
        </p>
      </section>

      <Suspense
        fallback={
          <div className="rounded-[28px] border border-black/[0.06] bg-white p-8 text-sm text-black/45">
            Asistan yükleniyor...
          </div>
        }
      >
        <AiAssistantPanel
          hasOfferAssistant={entitlements.features.ai_offer_assistant}
          hasAdvancedPricing={entitlements.features.advanced_ai_pricing}
        />
      </Suspense>
    </>
  );
}
