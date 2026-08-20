import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { OfferExistingStatus } from "@/components/panel/OfferExistingStatus";
import { ComplaintForm } from "@/components/panel/ComplaintForm";
import { OfferForm } from "@/components/panel/OfferForm";
import { OfferRequestPreview } from "@/components/panel/OfferRequestPreview";
import { displayRequestFieldValue } from "@/lib/field-display";
import { canAccessRequest } from "@/lib/membership/assert-entitlement";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { toEntitlementDTO } from "@/lib/membership/serialize";
import { prisma } from "@/lib/prisma";
import { formatListingBudget } from "@/lib/visuals/category-visuals";
import { requireUser } from "@/server/auth/require-user";
import { findSupplierOfferOnRequest } from "@/server/offer/offer-service";

export default async function OfferRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const entitlements = await resolveEntitlements(
    user.id,
    await getCompanyContextOptions(),
  );
  const entitlementDto = toEntitlementDTO(entitlements);
  const { id } = await params;
  const query = await searchParams;
  const attributionTouch =
    typeof query.acq === "string" && query.acq.trim()
      ? query.acq.trim()
      : null;

  const request = await prisma.request.findFirst({
    where: {
      id,
      deletedAt: null,
      isModerationHidden: false,
      createdById: { not: user.id },
      status: {
        in: ["PUBLISHED", "RECEIVING_OFFERS", "OFFER_SELECTED", "IN_PROGRESS"],
      },
    },
    select: {
      id: true,
      createdById: true,
      title: true,
      description: true,
      professionalDescription: true,
      aiSummary: true,
      city: true,
      budgetMin: true,
      budgetMax: true,
      currency: true,
      status: true,
      visibleToSuppliersAt: true,
      category: { select: { name: true, slug: true } },
      fieldValues: {
        orderBy: { field: { sortOrder: "asc" } },
        include: { field: true },
      },
    },
  });

  if (!request) notFound();
  if (!canAccessRequest(entitlements, request)) {
    redirect(`/panel/talepler/${id}`);
  }

  const existingOffer = await findSupplierOfferOnRequest(user.id, request.id);
  const awaitingResponse =
    existingOffer &&
    ["SUBMITTED", "VIEWED"].includes(existingOffer.status);
  const requestOpenForOffers =
    request.status === "PUBLISHED" || request.status === "RECEIVING_OFFERS";
  const showStatusOnly =
    existingOffer &&
    (existingOffer.status === "ACCEPTED" ||
      (["REJECTED", "WITHDRAWN", "EXPIRED"].includes(existingOffer.status) &&
        !requestOpenForOffers));

  if (showStatusOnly && existingOffer) {
    return (
      <div className="mx-auto w-full max-w-3xl pb-8">
        <Link
          href={`/panel/talepler/${request.id}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/90 px-3.5 py-2 text-sm font-medium text-black/50 shadow-[0_6px_18px_rgba(0,0,0,0.04)] backdrop-blur-md transition hover:bg-white hover:text-black"
        >
          <ArrowLeft className="h-4 w-4" />
          Talebe dön
        </Link>
        <div className="mt-6">
          <OfferExistingStatus
            status={existingOffer.status}
            messagesHref={
              existingOffer.conversation?.id &&
              existingOffer.status === "ACCEPTED"
                ? `/panel/mesajlar/${existingOffer.conversation.id}`
                : undefined
            }
          />
        </div>
      </div>
    );
  }

  const categorySlug = request.category.slug;
  const description =
    request.professionalDescription || request.description;
  const isRevise = Boolean(awaitingResponse && existingOffer);

  return (
    <div className="mx-auto w-full max-w-6xl pb-8">
      <Link
        href={`/panel/talepler/${request.id}`}
        className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/90 px-3.5 py-2 text-sm font-medium text-black/50 shadow-[0_6px_18px_rgba(0,0,0,0.04)] backdrop-blur-md transition hover:bg-white hover:text-black"
      >
        <ArrowLeft className="h-4 w-4" />
        Talebe dön
      </Link>

      <div className="mt-4 flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)] lg:items-start lg:gap-5 xl:gap-6">
        <div className="order-1 lg:order-1">
          <OfferRequestPreview
            categoryName={request.category.name}
            title={request.title}
            city={request.city}
            description={description}
            aiSummary={request.aiSummary}
            budgetLabel={formatListingBudget(
              request.budgetMin,
              request.budgetMax,
              request.currency,
            )}
            fields={request.fieldValues.map((value) => ({
              id: value.id,
              label: value.field.label,
              value: displayRequestFieldValue({
                ...value,
                categoryId: categorySlug,
              }),
            }))}
          />
          <div className="opacity-80">
            <ComplaintForm
              subjectType="REQUEST"
              subjectId={request.id}
              targetUserId={request.createdById}
            />
            {existingOffer ? (
              <ComplaintForm subjectType="OFFER" subjectId={existingOffer.id} />
            ) : null}
          </div>
        </div>

        <section className="order-2 rounded-[20px] border border-teal-900/[0.08] bg-[linear-gradient(180deg,#fcfdfc_0%,#f6f9f8_100%)] p-5 shadow-[0_12px_36px_rgba(15,31,29,0.04)] sm:p-6 lg:sticky lg:top-6 lg:p-7">
          <h1 className="text-[1.65rem] font-semibold tracking-[-0.03em] text-[#0f1f1d] sm:text-[1.85rem]">
            {isRevise ? "Teklif notunu güncelle" : "Teklifini yaz"}
          </h1>
          <p className="mt-2 max-w-lg text-[14px] leading-6 text-[#536b68]">
            {isRevise
              ? "Açıklamanızı güncelleyebilirsiniz. Tutar gönderimden sonra değişmez."
              : "Başlık, tutar ve temel bilgileri girin. Teslim süresi, açıklama ve görseller teklifinizi güçlendirir."}
          </p>

          <div className="mt-7">
            <Suspense
              fallback={
                <div className="rounded-2xl bg-[#f5f8f7] p-6 text-sm text-black/45">
                  Form yükleniyor…
                </div>
              }
            >
              <OfferForm
                requestId={request.id}
                entitlements={entitlementDto}
                categorySlug={categorySlug}
                attributionTouch={attributionTouch}
                budgetMin={
                  request.budgetMin ? Number(request.budgetMin) : null
                }
                existingOffer={
                  isRevise && existingOffer
                    ? {
                        id: existingOffer.id,
                        description: existingOffer.description,
                        amount: Number(existingOffer.amount),
                        deliveryDays: existingOffer.deliveryDays,
                        title: existingOffer.title,
                        media: existingOffer.media,
                      }
                    : null
                }
              />
            </Suspense>
          </div>
        </section>
      </div>
    </div>
  );
}
