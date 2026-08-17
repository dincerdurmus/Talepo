import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Handshake,
  MessageCircle,
  Pencil,
} from "lucide-react";

import { EmptyIllustration } from "@/components/visuals/EmptyIllustration";
import { scoreOfferCompleteness } from "@/lib/offer/offer-completeness";
import {
  formatMoney,
  formatOfferStatus,
} from "@/lib/panel/company-format";
import { getCompanyWorkspace } from "@/lib/panel/company-workspace";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<{ gonderildi?: string; guncellendi?: string }>;
}) {
  const user = await requireUser();
  const workspace = await getCompanyWorkspace(user.id);
  const { gonderildi, guncellendi } = await searchParams;
  const justSubmitted = gonderildi === "1";
  const justUpdated = guncellendi === "1";

  const offers = await prisma.offer.findMany({
    where: workspace
      ? {
          companyId: workspace.companyId,
          status: { not: "DRAFT" },
        }
      : {
          submittedById: user.id,
          companyId: null,
          status: { not: "DRAFT" },
        },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    include: {
      request: {
        select: {
          id: true,
          title: true,
          city: true,
          status: true,
          isUrgent: true,
          createdBy: { select: { name: true } },
        },
      },
      submittedBy: { select: { name: true } },
      conversation: { select: { id: true } },
    },
    take: 50,
  });

  const negotiating = offers.filter(
    (o) =>
      o.conversation?.id &&
      ["SUBMITTED", "VIEWED"].includes(o.status),
  ).length;

  const counts = {
    open: offers.filter((o) =>
      ["SUBMITTED", "VIEWED"].includes(o.status),
    ).length,
    negotiating,
    accepted: offers.filter((o) => o.status === "ACCEPTED").length,
    rejected: offers.filter((o) => o.status === "REJECTED").length,
  };

  const pageTitle = workspace ? "Tekliflerimiz" : "Tekliflerim";
  const pageSubtitle = workspace
    ? "Firmanızın teklifleri: durum, pazarlık sohbetleri ve doluluk."
    : "Gönderdiğiniz teklifler. Alıcı kabul veya pazarlık ile sohbet açabilir.";

  return (
    <>
      <section className="py-4 sm:py-6">
        <p className="talepo-page-eyebrow">
          {workspace ? workspace.companyName : "Teklif takibi"}
        </p>
        <h1 className="talepo-page-title mt-3 text-4xl sm:text-5xl">
          {pageTitle}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-teal-950/50">
          {pageSubtitle}
        </p>
      </section>

      {(justSubmitted || justUpdated) && (
        <section className="mb-5 rounded-2xl border border-teal-900/12 bg-[#eef6f4] px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-teal-900">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {justUpdated
              ? "Teklif notunuz güncellendi"
              : "Teklifiniz alıcıya iletildi"}
          </p>
          <p className="mt-1.5 text-sm leading-6 text-teal-900/70">
            {justUpdated
              ? "Alıcı güncel açıklamanızı görür. Tutar ve teslim süresi aynı kalır."
              : "Alıcı teklifi Gelen teklifler’den görür. Kabul veya pazarlık ile mesajlaşma açılır."}
          </p>
        </section>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Açık", value: counts.open, tone: "bg-[#eef6f4]" },
          {
            label: "Pazarlık",
            value: counts.negotiating,
            tone: "bg-amber-50",
          },
          { label: "Kabul", value: counts.accepted, tone: "bg-[#e7f7f2]" },
          { label: "Red", value: counts.rejected, tone: "bg-[#fff1ee]" },
        ].map((item) => (
          <div
            key={item.label}
            className={`rounded-2xl border border-black/[0.05] ${item.tone} p-4`}
          >
            <p className="text-xs text-black/45">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold">{item.value}</p>
          </div>
        ))}
      </div>

      {offers.length === 0 ? (
        <Gate
          title="Henüz teklif yok"
          body="Keşiften uygun taleplere teklif verin; burada listelenir. Dolu teklifler alıcı karşılaştırmasında öne çıkar."
          href="/panel/talepler"
          cta="Talepleri keşfet"
        />
      ) : (
        <section className="grid gap-3">
          {offers.map((offer) => {
            const hasConversation = Boolean(offer.conversation?.id);
            const status = formatOfferStatus(offer.status, {
              hasConversation,
            });
            const completeness = scoreOfferCompleteness({
              amount: offer.amount,
              deliveryDays: offer.deliveryDays,
              title: offer.title,
              description: offer.description,
              validUntil: offer.validUntil,
            });
            const canRevise = ["SUBMITTED", "VIEWED"].includes(offer.status);

            return (
              <article
                key={offer.id}
                className={`rounded-[24px] border bg-white p-5 shadow-sm ${
                  hasConversation && canRevise
                    ? "border-amber-200/80 ring-1 ring-amber-100"
                    : "border-black/[0.06]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {offer.request.isUrgent ? (
                        <span className="rounded-md bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-800">
                          Acil talep
                        </span>
                      ) : null}
                      {hasConversation && canRevise ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                          <Handshake className="h-3 w-3" />
                          Pazarlık açık
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 font-semibold text-[#0f1f1d]">
                      {offer.title || offer.request.title}
                    </p>
                    <p className="mt-1 text-xs text-black/45">
                      {offer.request.title}
                      {offer.request.city ? ` · ${offer.request.city}` : ""}
                      {offer.status === "ACCEPTED" &&
                      offer.request.createdBy.name
                        ? ` · Alıcı: ${offer.request.createdBy.name}`
                        : offer.status !== "ACCEPTED"
                          ? " · Alıcı: kabulden sonra görünür"
                          : ""}
                    </p>
                    <p className="mt-3 line-clamp-2 text-sm text-black/55">
                      {offer.description}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-teal-900/10">
                        <div
                          className="h-full rounded-full bg-[#0f766e]"
                          style={{ width: `${completeness.score}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-teal-950/50">
                        Doluluk {completeness.score}% · {completeness.label}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-teal-900">
                      {formatMoney(offer.amount, offer.currency)}
                    </p>
                    <span
                      className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.tone}`}
                    >
                      {status.label}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/panel/talepler/${offer.request.id}`}
                    className="rounded-xl bg-teal-800 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Talebi aç
                  </Link>
                  {canRevise ? (
                    <Link
                      href={`/panel/talepler/${offer.request.id}/teklif`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-teal-800/15 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-950"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Notu güncelle
                    </Link>
                  ) : null}
                  {hasConversation ? (
                    <Link
                      href={`/panel/mesajlar/${offer.conversation!.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {offer.status === "ACCEPTED"
                        ? "Mesajlar"
                        : "Pazarlık sohbeti"}
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}

function Gate({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="talepo-card p-8 text-center sm:text-left">
      <EmptyIllustration variant="offers" className="sm:mx-0" />
      <h2 className="mt-5 text-xl font-semibold">{title}</h2>
      <p className="mt-3 max-w-lg text-sm leading-6 text-black/45">{body}</p>
      <Link
        href={href}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-teal-800 px-5 py-3 text-sm font-semibold text-white"
      >
        {cta}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
