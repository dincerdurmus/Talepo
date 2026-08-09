import Link from "next/link";
import { ArrowRight, Crown, Sparkles, WandSparkles } from "lucide-react";

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
          <p className="text-sm font-semibold text-black/35">Premium özellik</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
            AI teklif asistanı
          </h1>
        </section>

        <div className="rounded-[28px] border border-[#8c72c9]/20 bg-[#f8f5ff] p-8">
          <Crown className="h-8 w-8 text-[#704daf]" />
          <h2 className="mt-4 text-2xl font-semibold text-[#4f3d72]">
            Bu özellik Premium ve üzeri planlarda açılır
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#4f3d72]/75">
            AI teklif asistanı ve gelişmiş fiyat analizi için planınızı
            yükseltin. Entitlement kaydı hazır; ürün motoru sonraki fazda
            bağlanacak.
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
          AI teklif asistanı
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-black/45">
          Planınızda bu entitlement açık. Asistan yüzeyi hazır; teklif taslağı
          motoru sonraki fazda bağlanacak.
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_16px_55px_rgba(0,0,0,0.04)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eee7ff] text-[#704daf]">
            <WandSparkles className="h-5 w-5" />
          </div>
          <h2 className="mt-5 text-xl font-semibold">Teklif taslağı</h2>
          <p className="mt-3 text-sm leading-6 text-black/45">
            Seçtiğiniz talebe göre açıklama, teslim süresi ve fiyat önerisi
            üretecek. Motor bağlandığında burada çalışacak.
          </p>
          <button
            type="button"
            disabled
            className="mt-6 rounded-full bg-black/10 px-5 py-3 text-sm font-semibold text-black/40"
          >
            Yakında
          </button>
        </section>

        <section className="rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_16px_55px_rgba(0,0,0,0.04)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e4f4df] text-[#356d3a]">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="mt-5 text-xl font-semibold">Fiyat analizi</h2>
          <p className="mt-3 text-sm leading-6 text-black/45">
            {entitlements.features.advanced_ai_pricing
              ? "Gelişmiş AI fiyat analizi entitlement’ınız aktif."
              : "Gelişmiş fiyat analizi bu planda kapalı."}
          </p>
          <button
            type="button"
            disabled
            className="mt-6 rounded-full bg-black/10 px-5 py-3 text-sm font-semibold text-black/40"
          >
            Yakında
          </button>
        </section>
      </div>
    </>
  );
}
