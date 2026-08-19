import { prisma } from "@/lib/prisma";
import { moderationSla } from "@/server/admin/moderation-sla";

/** Sends one escalation per still-open complaint after its priority SLA expires. */
export async function dispatchOverdueComplaintEscalations(now = new Date()) {
  const candidates = await prisma.moderationCase.findMany({
    where: {
      isComplaint: true,
      status: { in: ["OPEN", "INVESTIGATING"] },
      escalationNotifiedAt: null,
    },
    select: {
      id: true,
      complaintNumber: true,
      summary: true,
      priority: true,
      createdAt: true,
      assignee: { select: { name: true, email: true } },
    },
  });
  const overdueCases = candidates.filter((item) => moderationSla(item.priority, item.createdAt, now).breached);
  if (!overdueCases.length) return { escalated: 0 };

  const recipients = await prisma.user.findMany({
    where: { platformRole: { in: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });
  let escalated = 0;

  await Promise.all(overdueCases.map(async (item) => {
    // This conditional update makes concurrent web/cron runs idempotent.
    const claimed = await prisma.moderationCase.updateMany({
      where: { id: item.id, escalationNotifiedAt: null },
      data: { escalationNotifiedAt: now },
    });
    if (!claimed.count || !recipients.length) return;

    const assigneeLabel = item.assignee?.name ?? item.assignee?.email ?? "Atanmamış";
    await prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        userId: recipient.id,
        type: "GENERAL",
        title: "Şikayet SLA süresi aşıldı",
        message: `Şikayet #${item.complaintNumber ?? "—"}: ${item.summary}. ${moderationSla(item.priority, item.createdAt, now).targetHours} saatlik ${item.priority} SLA hedefi aşıldı. Takip: ${assigneeLabel}.`,
        actionUrl: "/admin",
      })),
    });
    escalated += 1;
  }));

  return { escalated };
}
