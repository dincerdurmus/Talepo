import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";

import {
  formatMoney,
  formatOfferStatus,
} from "@/lib/panel/company-format";
import { getCompanyWorkspace } from "@/lib/panel/company-workspace";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

export default async function CompanyOffersPage() {
  const user = await requireUser();
  const workspace = await getCompanyWorkspace(user.id);

  if (!workspace) {
    return (
      <>
        <Header />
        <Gate
          title="Firma bağlamı gerekli"
          body="Tekliflerimizi görmek için Plan sayfasından bir firma seçin."
          href="/panel/plan"
          cta="Firma seç"
        />
      </>
    );
  }

  const offers = await prisma.offer.findMany({
    where: {
      companyId: workspace.companyId,
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
        },
      },
      submittedBy: { select: { name: true } },
      conversation: { select: { id: true } },
    },
    take: 50,
  });

  const counts = {
    open: offers.filter((o) =>
      ["SUBMITTED", "VIEWED"].includes(o.status),
    ).length,
    accepted: offers.filter((o) => o.status === "ACCEPTED").length,
    rejected: offers.filter((o) => o.status === "REJECTED").length,
  };

  return (
    <>
      <section className="py-4 sm:py-6">
        <p className="text-sm font-semibold text-teal-800/60">
          {workspace.companyName}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
          Tekliflerimiz
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-black/45">
          Firmanızın gönderdiği teklifler, durumları ve bağlı talepler.
        </p>
      </section>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Açık", value: counts.open, tone: "bg-[#eef3fb]" },
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
          body="Keşiften uygun taleplere teklif verin; burada listelenir."
          href="/panel/talepler"
          cta="Talepleri keşfet"
        />
      ) : (
        <section className="grid gap-3">
          {offers.map((offer) => {
            const status = formatOfferStatus(offer.status);
            return (
              <article
                key={offer.id}
                className="rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {offer.title || offer.request.title}
                    </p>
                    <p className="mt-1 text-xs text-black/45">
                      {offer.request.title}
                      {offer.request.city ? ` · ${offer.request.city}` : ""}
                      {offer.submittedBy.name
                        ? ` · ${offer.submittedBy.name}`
                        : ""}
                    </p>
                    <p className="mt-3 text-sm text-black/55 line-clamp-2">
                      {offer.description}
                    </p>
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
                  {offer.conversation?.id && (
                    <Link
                      href={`/panel/mesajlar/${offer.conversation.id}`}
                      className="rounded-xl border border-black/10 px-3 py-2 text-xs font-medium"
                    >
                      Mesajlar
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}

function Header() {
  return (
    <section className="py-4 sm:py-6">
      <p className="text-sm font-semibold text-teal-800/60">Kurumsal</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
        Tekliflerimiz
      </h1>
    </section>
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
    <div className="rounded-[28px] border border-black/[0.06] bg-white p-8 shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7f7f2] text-teal-800">
        <FileText className="h-5 w-5" />
      </div>
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
