import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";

import { CompanyCategoriesForm } from "@/components/panel/CompanyCategoriesForm";
import { CompanySettingsForm } from "@/components/panel/CompanySettingsForm";
import { getCompanyWorkspace } from "@/lib/panel/company-workspace";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

export default async function FirmaAyarlariPage() {
  const user = await requireUser();
  const workspace = await getCompanyWorkspace(user.id);

  if (!workspace) {
    redirect("/panel/firma/yeni");
  }

  const company = await prisma.company.findFirst({
    where: { id: workspace.companyId, deletedAt: null },
    select: {
      name: true,
      legalName: true,
      description: true,
      phone: true,
      email: true,
      websiteUrl: true,
      city: true,
      district: true,
      address: true,
      taxNumber: true,
      taxOffice: true,
      logoUrl: true,
      coverUrl: true,
    },
  });

  if (!company) {
    redirect("/panel/firma/yeni");
  }

  const activeCategorySlugs = (
    await prisma.companyCategory.findMany({
      where: { companyId: workspace.companyId },
      select: { category: { select: { slug: true } } },
    })
  ).map((row) => row.category.slug);

  return (
    <>
      <section className="py-4 sm:py-6">
        <Link
          href="/panel"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-black/45 transition hover:text-black"
        >
          <ArrowLeft className="h-4 w-4" />
          Panele dön
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              Firma ayarları
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-black/45">
              {workspace.companyName} profilini, görsellerini ve hizmet
              kategorilerini buradan yönetin.
            </p>
          </div>
          <Link
            href="/panel/firma/yeni"
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-black/70 transition hover:border-black/25 hover:text-black"
          >
            <Building2 className="h-4 w-4" />
            Yeni firma oluştur
          </Link>
        </div>
      </section>

      <div className="space-y-5">
        <CompanySettingsForm
          initial={{
            name: company.name,
            legalName: company.legalName ?? "",
            description: company.description ?? "",
            phone: company.phone ?? "",
            email: company.email ?? "",
            websiteUrl: company.websiteUrl ?? "",
            city: company.city ?? "",
            district: company.district ?? "",
            address: company.address ?? "",
            taxNumber: company.taxNumber ?? "",
            taxOffice: company.taxOffice ?? "",
            logoUrl: company.logoUrl,
            coverUrl: company.coverUrl,
          }}
        />
        <CompanyCategoriesForm initialSlugs={activeCategorySlugs} />
      </div>
    </>
  );
}
