import Link from "next/link";
import { Bell, BriefcaseBusiness, Building2, MessageCircle, Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { InviteActions } from "@/components/panel/InviteActions";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

export default async function NotificationsPage() {
  const user = await requireUser();

  const [notifications, pendingInvites] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.companyMember.findMany({
      where: {
        userId: user.id,
        status: "INVITED",
        company: {
          deletedAt: null,
          status: { in: ["ACTIVE", "PENDING_VERIFICATION", "DRAFT"] },
        },
      },
      select: {
        companyId: true,
        company: { select: { id: true, name: true } },
      },
    }),
  ]);

  const pendingByCompany = new Map(
    pendingInvites.map((invite) => [invite.companyId, invite.company.name]),
  );

  return (
    <>
      <section className="py-4 sm:py-6">
        <p className="text-sm font-semibold text-black/35">Bildirimler</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
          Hareketler
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-black/45">
          Talepleriniz, teklifleriniz, mesajlarınız ve firma davetleriyle ilgili
          güncellemeler burada listelenir.
        </p>
      </section>

      {pendingInvites.length > 0 && (
        <section className="mb-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-teal-800/70">
            Bekleyen davetler
          </h2>
          {pendingInvites.map((invite) => (
            <div
              key={invite.companyId}
              className="rounded-[24px] border border-teal-800/15 bg-[#e7f7f2] px-5 py-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-800/15 text-teal-800">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-teal-950">
                    {invite.company.name}
                  </p>
                  <p className="mt-1 text-sm text-teal-950/65">
                    Sizi ekibe davet etti. Kabul ederseniz firma çalışma alanına
                    geçersiniz.
                  </p>
                  <InviteActions
                    companyId={invite.companyId}
                    companyName={invite.company.name}
                  />
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {notifications.length === 0 ? (
        <section className="rounded-[34px] border border-black/[0.06] bg-white p-8 text-center shadow-[0_20px_70px_rgba(0,0,0,0.04)] sm:p-14">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#f4f4f0]">
            <Bell className="h-7 w-7 text-black/35" />
          </div>
          <h2 className="mt-6 text-2xl font-semibold tracking-tight">
            Henüz bildirim yok
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-black/45">
            İlk talebinizi oluşturduğunuzda veya teklif aldığınızda
            bildirimler burada görünecek.
          </p>
          <Link
            href="/talep"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white"
          >
            Talep oluştur
          </Link>
        </section>
      ) : (
        <section className="divide-y divide-black/[0.06] overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_18px_60px_rgba(0,0,0,0.04)]">
          {notifications.map((notification) => {
            const isInvite = notification.type === "COMPANY_INVITATION";
            const inviteCompanyId = notification.companyId;
            const stillPending =
              isInvite &&
              inviteCompanyId &&
              pendingByCompany.has(inviteCompanyId);

            return (
              <div
                key={notification.id}
                className={`flex items-start gap-4 px-5 py-5 sm:px-6 ${
                  notification.status === "UNREAD" ? "bg-[#fafdf8]" : ""
                }`}
              >
                <NotificationIcon type={notification.type} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <p className="font-semibold tracking-tight">
                      {notification.title}
                    </p>
                    <span className="shrink-0 text-xs text-black/30">
                      {formatRelativeTime(notification.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-black/45">
                    {notification.message}
                  </p>

                  {stillPending && inviteCompanyId ? (
                    <InviteActions
                      companyId={inviteCompanyId}
                      companyName={pendingByCompany.get(inviteCompanyId)}
                    />
                  ) : notification.actionUrl && !isInvite ? (
                    <Link
                      href={notification.actionUrl}
                      className="mt-3 inline-flex text-sm font-semibold text-teal-800"
                    >
                      Görüntüle →
                    </Link>
                  ) : null}

                  {notification.status === "UNREAD" && !stillPending && (
                    <span className="mt-3 inline-flex rounded-full bg-[#e4f4df] px-2.5 py-1 text-[11px] font-semibold text-[#356d3a]">
                      Yeni
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}

function NotificationIcon({ type }: { type: string }) {
  let Icon: LucideIcon = Bell;
  let background = "bg-[#f4f4f0]";

  if (type === "REQUEST_PUBLISHED" || type === "NEW_REQUEST_MATCH") {
    Icon = Package;
    background = "bg-[#e9f8e5]";
  }

  if (
    type === "NEW_OFFER" ||
    type === "OFFER_ACCEPTED" ||
    type === "OFFER_VIEWED" ||
    type === "OFFER_REJECTED"
  ) {
    Icon = BriefcaseBusiness;
    background = "bg-[#e5efff]";
  }

  if (type === "NEW_MESSAGE") {
    Icon = MessageCircle;
    background = "bg-[#f4eaff]";
  }

  if (type === "COMPANY_INVITATION" || type === "COMPANY_MEMBER_JOINED") {
    Icon = Building2;
    background = "bg-[#e4f4f2]";
  }

  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${background}`}
    >
      <Icon className="h-5 w-5" />
    </div>
  );
}

function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return "Az önce";
  if (diffHours < 24) return `${diffHours} saat önce`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Dün";
  if (diffDays < 7) return `${diffDays} gün önce`;

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
