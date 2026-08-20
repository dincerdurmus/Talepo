import Link from "next/link";
import { Bell, Building2 } from "lucide-react";

import { InviteActions } from "@/components/panel/InviteActions";
import { ComplaintNotificationDialog } from "@/components/panel/ComplaintNotificationDialog";
import { MarkAllNotificationsReadButton } from "@/components/panel/MarkAllNotificationsReadButton";
import { SignalActivityShell } from "@/components/panel/signal/SignalActivityShell";
import {
  buildNotificationRowCopy,
  NOTIFICATION_ICONS,
  notificationIconKind,
} from "@/lib/notifications/notification-row-copy";
import {
  notificationIsUnread,
  unreadNotificationWhere,
} from "@/lib/notifications/unread";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ hedef?: string; sikayet?: string; sikayetBildirimi?: string }>;
}) {
  const user = await requireUser();
  const { hedef, sikayet, sikayetBildirimi } = await searchParams;

  const [notifications, pendingInvites, unreadCount, complaintCase, complaintNotice] = await Promise.all([
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
    sikayet
      ? prisma.moderationCase.findFirst({
          where: { id: sikayet, reporterId: user.id, isComplaint: true },
          select: { complaintNumber: true, summary: true, details: true, status: true, resolutionNote: true, updatedAt: true },
        })
      : Promise.resolve(null),
    sikayetBildirimi
      ? prisma.notification.findFirst({
          where: { id: sikayetBildirimi, userId: user.id, title: "Şikayetiniz güncellendi" },
          select: { title: true, message: true, createdAt: true },
        })
      : Promise.resolve(null),
  ]);

  const pendingByCompany = new Map(
    pendingInvites.map((invite) => [invite.companyId, invite.company.name]),
  );
  const requestIds = [
    ...new Set(
      notifications
        .map((notification) => notification.requestId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const requestTitles = requestIds.length
    ? await prisma.request.findMany({
        where: { id: { in: requestIds } },
        select: { id: true, title: true },
      })
    : [];
  const requestTitleById = new Map(
    requestTitles.map((request) => [request.id, request.title]),
  );
  const missingTarget = hedef === "bulunamadi";
  const summary =
    unreadCount > 0
      ? `${unreadCount} bakman gereken hareket`
      : notifications.length > 0
        ? "Şu an bakman gereken yeni hareket yok."
        : "Talepler ve teklifler ilerledikçe hareketler burada toplanır.";

  return (
    <SignalActivityShell
      tone="activity"
      eyebrow="HAREKET"
      title="Bildirimler"
      description="Talepo’da senin için ne oldu ve hangisine bakman gerekiyor."
      summary={summary}
    >
      {missingTarget ? (
        <p className="talepo-activity-alert" role="status">
          Bu bildirimin hedefi artık yok veya açılamıyor. Bildirim okundu olarak
          işaretlendi.
        </p>
      ) : null}

      {(complaintCase || complaintNotice) ? (
        <ComplaintNotificationDialog
          complaint={complaintCase ? {
            complaintNumber: complaintCase.complaintNumber,
            summary: complaintCase.summary,
            details: complaintCase.details,
            status: complaintCase.status,
            resolutionNote: complaintCase.resolutionNote,
            updatedAt: complaintCase.updatedAt.toISOString(),
          } : null}
          notice={complaintNotice ? {
            title: complaintNotice.title,
            message: complaintNotice.message,
            createdAt: complaintNotice.createdAt.toISOString(),
          } : null}
        />
      ) : null}

      {pendingInvites.length > 0 ? (
        <section className="talepo-activity-invite space-y-2" aria-label="Bekleyen davetler">
          <h2 className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0f1f1d]/42">
            Bekleyen davetler
          </h2>
          {pendingInvites.map((invite) => (
            <div key={invite.companyId} className="talepo-activity-row talepo-activity-row--unread">
              <span className="talepo-activity-icon" aria-hidden>
                <Building2 className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold tracking-tight text-[#0f1f1d]">
                  {invite.company.name}
                </p>
                <p className="mt-1 text-sm leading-6 text-[#0f1f1d]/58">
                  Sizi ekibe davet etti. Kabul ederseniz firma çalışma alanına
                  geçersiniz.
                </p>
                <InviteActions
                  companyId={invite.companyId}
                  companyName={invite.company.name}
                />
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {notifications.length > 0 ? (
        <div className="talepo-activity-toolbar">
          <MarkAllNotificationsReadButton unreadCount={unreadCount} />
        </div>
      ) : null}

      {notifications.length === 0 ? (
        <section className="talepo-activity-empty">
          <span className="talepo-activity-icon" aria-hidden>
            <Bell className="h-4 w-4" />
          </span>
          <h2 className="text-lg font-semibold tracking-tight text-[#0f1f1d]">
            Henüz bildirim yok
          </h2>
          <p className="max-w-md text-sm leading-6 text-[#0f1f1d]/52">
            İlk talebinizi oluşturduğunuzda veya teklif aldığınızda
            bildirimler burada görünecek.
          </p>
          <Link href="/talep" className="talepo-activity-cta talepo-activity-cta--primary">
            Talep oluştur
          </Link>
        </section>
      ) : (
        <section className="talepo-activity-list" aria-label="Bildirimler">
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
              "talepo-activity-row",
              isUnread ? "talepo-activity-row--unread" : "",
              clickThroughHref ? "talepo-activity-row--clickable" : "",
            ]
              .filter(Boolean)
              .join(" ");

            const copy = buildNotificationRowCopy({
              title: notification.title,
              message: notification.message,
              requestTitle: notification.requestId
                ? requestTitleById.get(notification.requestId) ?? null
                : null,
            });
            const iconKind = notificationIconKind(
              notification.type,
              notification.title,
            );

            const rowContent = (
              <>
                <NotificationIcon kind={iconKind} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p
                      className={
                        isUnread
                          ? "min-w-0 font-semibold tracking-tight text-[#0f1f1d]"
                          : "min-w-0 font-medium tracking-tight text-[#0f1f1d]/68"
                      }
                    >
                      {isUnread ? (
                        <span className="talepo-beacon-unread-dot mr-2 inline-block align-middle" aria-hidden />
                      ) : null}
                      {copy.title}
                      {isUnread ? <span className="sr-only"> Okunmadı</span> : null}
                    </p>
                    <time
                      dateTime={notification.createdAt.toISOString()}
                      className="shrink-0 pt-0.5 text-[11px] tabular-nums text-[#0f1f1d]/38"
                    >
                      {formatRelativeTime(notification.createdAt)}
                    </time>
                  </div>
                  {copy.context ? (
                    <p className="mt-0.5 truncate text-[13px] font-medium text-[#0f1f1d]/52">
                      {copy.context}
                    </p>
                  ) : null}
                  {copy.detail ? (
                    <p
                      className={
                        isUnread
                          ? "mt-1 text-sm leading-6 text-[#0f1f1d]/62"
                          : "mt-1 text-sm leading-6 text-[#0f1f1d]/46"
                      }
                    >
                      {copy.detail}
                    </p>
                  ) : null}
                  {stillPending && inviteCompanyId ? (
                    <InviteActions
                      companyId={inviteCompanyId}
                      companyName={pendingByCompany.get(inviteCompanyId)}
                    />
                  ) : null}
                </div>
              </>
            );

            if (clickThroughHref) {
              return (
                <Link
                  key={notification.id}
                  href={clickThroughHref}
                  prefetch={false}
                  className={rowClassName}
                  aria-label={
                    isUnread
                      ? `${notification.title}, okunmadı, ${formatRelativeTime(notification.createdAt)}`
                      : `${notification.title}, ${formatRelativeTime(notification.createdAt)}`
                  }
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
    </SignalActivityShell>
  );
}

function NotificationIcon({
  kind,
}: {
  kind: ReturnType<typeof notificationIconKind>;
}) {
  const Icon = NOTIFICATION_ICONS[kind];
  return (
    <span className={`talepo-activity-icon talepo-activity-icon--${kind}`} aria-hidden>
      <Icon className="h-4 w-4" />
    </span>
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
