import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CompanyCreateForm } from "@/components/panel/CompanyCreateForm";
import { FeatureUpgradeGate } from "@/components/panel/FeatureUpgradeGate";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { canCreateCompanyWorkspace } from "@/lib/membership/workspace-effective-plan";
import { getCompanyWorkspace } from "@/lib/panel/company-workspace";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

export default async function YeniFirmaPage() {
  const user = await requireUser();
  const [workspace, personal] = await Promise.all([
    getCompanyWorkspace(user.id),
    resolveEntitlements(user.id, { preferUserSubject: true }),
  ]);

  if (!canCreateCompanyWorkspace(personal.effectivePlanTier)) {
    return (
      <>
        <section className="py-4 sm:py-6">
          <h1 className="text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
            Firma çalışma alanı
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-black/45">
            Firma çalışma alanı Profesyonel üyeliğe bağlıdır. Standart hesapla
            açılamaz.
          </p>
        </section>
        <FeatureUpgradeGate
          feature="unlimited_offers"
          title="Firma çalışma alanı"
          description="Profesyonel üyelik ile firma oluşturun; ekip koltukları ve ücretli Gizli Envanter ile genişletin. Ayrı bir Kurumsal paket yoktur."
          ctaLabel="Profesyonel'e geç"
        />
      </>
    );
  }

  const memberships = await prisma.companyMember.findMany({
    where: {
      userId: user.id,
      status: "ACTIVE",
      company: { deletedAt: null },
    },
    select: {
      company: { select: { id: true, name: true } },
    },
    orderBy: { joinedAt: "desc" },
    take: 5,
  });

  return (
    <>
      <section className="py-4 sm:py-6">
        {workspace ? (
          <Link
            href="/panel/firma"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-black/45 transition hover:text-black"
          >
            <ArrowLeft className="h-4 w-4" />
            Firma ayarlarına dön
          </Link>
        ) : null}
        <h1
          className={`text-4xl font-semibold tracking-[-0.05em] sm:text-5xl ${workspace ? "mt-4" : ""}`}
        >
          Yeni firma oluştur
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-black/45">
          Profesyonel üyeliğinizle firma çalışma alanı açın. Oluşturma sonrası
          hesap menüsünden firma bağlamına geçebilirsiniz.
        </p>
      </section>

      {memberships.length > 0 && (
        <div className="mb-5 rounded-[22px] border border-teal-800/15 bg-[#e7f7f2] px-5 py-4 text-sm text-teal-950/80">
          Zaten {memberships.length} firmanız var
          {memberships[0] ? ` (ör. ${memberships[0].company.name})` : ""}. Yeni
          firma oluşturulunca hesap menüsünden seçebilirsiniz.
          {workspace ? (
            <>
              {" "}
              <Link
                href="/panel/firma"
                className="font-semibold text-teal-900 underline-offset-2 hover:underline"
              >
                Mevcut firma ayarları
              </Link>
            </>
          ) : null}
        </div>
      )}

      <CompanyCreateForm />
    </>
  );
}
