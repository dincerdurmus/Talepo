import Link from "next/link";
import { Bell, BriefcaseBusiness, Building2, MessageCircle, Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { InviteActions } from "@/components/panel/InviteActions";
import { MarkAllNotificationsReadButton } from "@/components/panel/MarkAllNotificationsReadButton";
import {
  notificationIsUnread,
  unreadNotificationWhere,
} from "@/lib/notifications/unread";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ hedef?: string }>;
}) {
  const user = await requireUser();
  const { hedef } = await searchParams;

  const [notifications, pendingInvites, unreadCount] = await Promise.all([
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
    prisma.notification.count({
      where: { userId: user.id, ...unreadNotificationWhere },
    }),
  ]);

  const pendingByCompany = new Map(
    pendingInvites.map((invite) => [invite.companyId, invite.company.name]),
  );
  const missingTarget = hedef === "bulunamadi";

  return (
    <>
      <section className="py-4 sm:py-6">
        <p className="talepo-page-eyebrow">Bildirimler</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="talepo-page-title text-4xl sm:text-5xl">
              Hareketler
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-teal-950/50">
              Talepleriniz, teklifleriniz, mesajlarınız ve firma davetleriyle ilgili
              güncellemeler burada listelenir.
            </p>
          </div>
          {notifications.length > 0 ? (
            <MarkAllNotificationsReadButton unreadCount={unreadCount} />
          ) : null}
        </div>
      </section>

      {missingTarget ? (
        <section className="mb-5 rounded-2xl border border-amber-200/80 bg-amber-50 px-5 py-3.5 text-sm leading-6 text-amber-950/80">
          Bu bildirimin hedefi artık yok veya açılamıyor. Bildirim okundu olarak
          işaretlendi.
        </section>
      ) : null}

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
        <section className="rounded-2xl border border-teal-900/10 bg-white p-8 text-center shadow-[0_12px_36px_rgba(15,31,29,0.04)] sm:p-14">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-[#eef6f4]">
            <Bell className="h-7 w-7 text-teal-800/55" />
          </div>
          <h2 className="mt-6 text-2xl font-semibold tracking-tight text-[#0f1f1d]">
            Henüz bildirim yok
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-teal-950/50">
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
            const isUnread = notificationIsUnread(notification.status);
            const isInvite = notification.type === "COMPANY_INVITATION";
            const inviteCompanyId = notification.companyId;
            const stillPending =
              isInvite &&
              inviteCompanyId &&
              pendingByCompany.has(inviteCompanyId);
            const clickThroughHref =
              !stillPending && !isInvite
                ? `/panel/bildirimler/r/${notification.id}`
                : null;
            const rowClassName = [
              "relative flex items-start gap-4 border-l-[3px] px-5 py-5 transition-colors sm:px-6",
              isUnread
                ? "border-l-teal-600 bg-gradient-to-r from-[#e7f7f2]/90 via-[#eef8f5]/50 to-white"
                : "border-l-transparent bg-white hover:bg-[#f7faf9]/80",
              clickThroughHref ? "group cursor-pointer hover:bg-[#eef8f5]/70" : "",
            ]
              .filter(Boolean)
              .join(" ");

            const rowContent = (
              <>
                <NotificationIcon type={notification.type} unread={isUnread} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-2">
                      {isUnread && (
                        <span
                          className="talepo-plan-dot mt-2 h-2 w-2 shrink-0 rounded-full"
                          aria-hidden
                        />
                      )}
                      <p
                        className={
                          isUnread
                            ? "font-bold tracking-tight text-[#0f1f1d]"
                            : "font-medium tracking-tight text-[#0f1f1d]/70"
                        }
                      >
                        {notification.title}
                      </p>
                    </div>
                    <span
                      className={
                        isUnread
                          ? "shrink-0 text-xs font-medium text-teal-800/55"
                          : "shrink-0 text-xs text-black/30"
                      }
                    >
                      {formatRelativeTime(notification.createdAt)}
                    </span>
                  </div>
                  <p
                    className={
                      isUnread
                        ? "mt-1 text-sm leading-6 text-teal-950/65"
                        : "mt-1 text-sm leading-6 text-black/45"
                    }
                  >
                    {notification.message}
                  </p>

                  {stillPending && inviteCompanyId ? (
                    <InviteActions
                      companyId={inviteCompanyId}
                      companyName={pendingByCompany.get(inviteCompanyId)}
                    />
                  ) : clickThroughHref ? (
                    <span className="mt-3 inline-flex text-sm font-semibold text-teal-800 transition group-hover:text-teal-950">
                      Görüntüle →
                    </span>
                  ) : null}

                  {isUnread && !stillPending && (
                    <span className="mt-3 inline-flex rounded-full bg-teal-800/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-teal-800">
                      Yeni
                    </span>
                  )}
                </div>
              </>
            );

            if (clickThroughHref) {
              return (
                <Link
                  key={notification.id}
                  href={clickThroughHref}
                  className={rowClassName}
                >
                  {rowContent}
                </Link>
              );
            }

            return (
              <div key={notification.id} className={rowClassName}>
                {rowContent}
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}

function NotificationIcon({
  type,
  unread = false,
}: {
  type: string;
  unread?: boolean;
}) {
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
    type === "OFFER_REJECTED" ||
    type === "OFFER_NEGOTIATE" ||
    type === "COUNTER_OFFER_RECEIVED" ||
    type === "COUNTER_OFFER_ACCEPTED" ||
    type === "COUNTER_OFFER_REJECTED" ||
    type === "DEAL_COMPLETION_REQUESTED" ||
    type === "DEAL_COMPLETED"
  ) {
    Icon = BriefcaseBusiness;
    background =
      type === "OFFER_NEGOTIATE" ||
      type === "COUNTER_OFFER_RECEIVED" ||
      type === "DEAL_COMPLETION_REQUESTED"
        ? "bg-amber-50"
        : type === "COUNTER_OFFER_ACCEPTED" || type === "DEAL_COMPLETED"
          ? "bg-[#e9f8e5]"
          : "bg-[#e5efff]";
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
    <div className="relative shrink-0">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-2xl ${background} ${
          unread ? "ring-2 ring-teal-600/15" : ""
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
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
