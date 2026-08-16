import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Crown } from "lucide-react";

import { AiAssistantPanel } from "@/components/panel/AiAssistantPanel";
import { listAssistantRequests } from "@/lib/ai/list-assistant-requests";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

export default async function AiAssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; request?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const entitlements = await resolveEntitlements(
    user.id,
    await getCompanyContextOptions(),
  );

  const allowed =
    entitlements.features.ai_offer_assistant ||
    entitlements.features.advanced_ai_pricing;

  const listedRequests = allowed ? await listAssistantRequests(user.id) : [];
  const initialRequestId = params.request ?? null;
  const initialTab = params.tab === "fiyat" ? "pricing" : "draft";

  // When opened for a specific request, only that request is in scope
  // (supplier must not browse the buyer's other requests here).
  let initialRequests = listedRequests;
  if (allowed && initialRequestId) {
    const locked = listedRequests.find((item) => item.id === initialRequestId);
    if (locked) {
      initialRequests = [locked];
    } else {
      const row = await prisma.request.findFirst({
        where: {
          id: initialRequestId,
          deletedAt: null,
          createdById: { not: user.id },
          status: {
            in: [
              "PUBLISHED",
              "RECEIVING_OFFERS",
              "OFFER_SELECTED",
              "IN_PROGRESS",
            ],
          },
        },
        select: {
          id: true,
          title: true,
          city: true,
          isUrgent: true,
          category: { select: { name: true, slug: true } },
        },
      });
      initialRequests = row ? [row] : [];
    }
  }

  if (!allowed) {
    return (
      <>
        <section className="py-4 sm:py-6">
          <p className="text-sm font-semibold text-teal-800/55">Profesyonel özellik</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
            AI teklif asistanı
          </h1>
        </section>

        <div className="rounded-2xl border border-teal-900/10 bg-white p-8 shadow-[0_12px_36px_rgba(15,31,29,0.04)]">
          <Crown className="h-8 w-8 text-teal-800" />
          <h2 className="mt-4 text-2xl font-semibold text-[#0f1f1d]">
            Bu özellik Profesyonel üyelikte açılır
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-teal-950/55">
            AI teklif asistanı ve gelişmiş fiyat analizi için planınızı
            yükseltmeniz gerekir.
          </p>
          <Link
            href="/panel/plan"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0f766e] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#115e59]"
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
        <p className="text-sm font-semibold text-teal-800/55">Profesyonel özellik</p>
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
          key={initialRequestId ?? "default"}
          hasOfferAssistant={entitlements.features.ai_offer_assistant}
          hasAdvancedPricing={entitlements.features.advanced_ai_pricing}
          initialRequests={initialRequests}
          initialRequestId={initialRequestId}
          initialTab={initialTab}
        />
      </Suspense>
    </>
  );
}
