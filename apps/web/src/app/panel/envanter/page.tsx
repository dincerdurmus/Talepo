import Link from "next/link";
import { ArrowRight, Crown } from "lucide-react";

import { InventoryManager } from "@/components/panel/InventoryManager";
import { getCompanyWorkspace } from "@/lib/panel/company-workspace";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

export default async function InventoryPage() {
  const user = await requireUser();
  const workspace = await getCompanyWorkspace(user.id);

  if (!workspace) {
    return (
      <>
        <PageHeader />
        <Locked
          title="Firma bağlamı gerekli"
          body="Gizli envanter firma hesabında çalışır. Plan sayfasından firmanızı seçin."
          href="/panel/plan"
        />
      </>
    );
  }

  if (!workspace.features.hidden_inventory) {
    return (
      <>
        <PageHeader companyName={workspace.companyName} />
        <Locked
          title="Kurumsal planda açılır"
          body="Gizli envanter firma içi stok listesidir; rakipler görmez. Aktif kullanım yalnızca Kurumsal pakette açılır."
          href="/panel/plan"
          cta="Kurumsal plana geç"
          icon
        />
      </>
    );
  }

  const items = await prisma.companyInventoryItem.findMany({
    where: { companyId: workspace.companyId, isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <>
      <PageHeader companyName={workspace.companyName} />
      <InventoryManager
        companyName={workspace.companyName}
        initialItems={items.map((item) => ({
          id: item.id,
          title: item.name || item.title || "",
          categoryLabel: item.categoryLabel,
          quantity: item.quantity,
          unit: item.unit,
          sku: item.sku,
          city: item.city,
          notes: item.notes,
        }))}
      />
    </>
  );
}

function PageHeader({ companyName }: { companyName?: string }) {
  return (
    <section className="py-4 sm:py-6">
      <p className="text-sm font-semibold text-teal-800/60">
        {companyName ?? "Kurumsal"}
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
        Gizli envanter
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-black/45">
        Stoklarınızı ekleyin. Uygun talepler geldiğinde eşleşme için kullanılır;
        rakipler stok listenizi görmez.
      </p>
    </section>
  );
}

function Locked({
  title,
  body,
  href,
  cta = "Plana git",
  icon,
}: {
  title: string;
  body: string;
  href: string;
  cta?: string;
  icon?: boolean;
}) {
  return (
    <div className="rounded-[28px] border border-teal-800/15 bg-[#e7f7f2] p-8">
      {icon ? <Crown className="h-8 w-8 text-teal-800" /> : null}
      <h2 className={`text-2xl font-semibold text-teal-950 ${icon ? "mt-4" : ""}`}>
        {title}
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-teal-950/70">{body}</p>
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
