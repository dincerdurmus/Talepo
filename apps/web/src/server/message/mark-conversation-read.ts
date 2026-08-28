import { getCompanyWorkspace } from "@/lib/panel/company-workspace";
import { prisma } from "@/lib/prisma";

/** Okundu yazımının ihtiyaç duyduğu en dar istemci yüzeyi. */
export type ConversationReadClient = {
  conversationParticipant: {
    updateMany: (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };
  notification: {
    updateMany: (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };
  $transaction: <T>(fn: (tx: ConversationReadClient) => Promise<T>) => Promise<T>;
};

export type MarkConversationReadOptions = {
  /**
   * Yazımı yapacak istemci (KB-22 Dilim 1). Varsayılan tekil Prisma
   * istemcisidir; enjekte edilebilir olması atomiklik sözleşmesinin GERÇEK
   * BİR VERİTABANI OLMADAN ölçülebilmesi içindir.
   */
  db?: ConversationReadClient;
  /**
   * Firma çalışma alanı. Verilmezse sunucudan çözülür; ölçümde oturum
   * bağlamı (`cookies`) bulunmadığı için açıkça geçilebilir.
   */
  workspace?: { companyId: string } | null;
};

/**
 * Marks the conversation as read for the current user (and company
 * participant row when in a firm workspace). Also clears matching
 * NEW_MESSAGE notifications so the bell badge drops.
 *
 * ATOMİK (KB-22 Dilim 1, 2026-08-28). İki yazım eskiden `Promise.all` ile
 * bağımsız koşuyordu: ikincisi hata verirse katılımcı "okundu" damgasını
 * alıyor ama NEW_MESSAGE bildirimi UNREAD kalıyordu — rozet ile içerik
 * kalıcı olarak ayrışıyordu. Artık ikisi tek transaction'dadır; biri
 * başarısızsa öteki de geri alınır ve hata çağıran sınıra yükselir.
 */
export async function markConversationAsRead(
  userId: string,
  conversationId: string,
  options: MarkConversationReadOptions = {},
) {
  const db = options.db ?? (prisma as unknown as ConversationReadClient);
  const workspace =
    options.workspace !== undefined
      ? options.workspace
      : await getCompanyWorkspace(userId);
  const now = new Date();
  const actionUrl = `/panel/mesajlar/${conversationId}`;

  await db.$transaction(async (tx) => {
    await tx.conversationParticipant.updateMany({
      where: {
        conversationId,
        leftAt: null,
        OR: [
          { userId },
          ...(workspace ? [{ companyId: workspace.companyId }] : []),
        ],
      },
      data: { lastReadAt: now },
    });

    await tx.notification.updateMany({
      where: {
        userId,
        status: "UNREAD",
        type: "NEW_MESSAGE",
        actionUrl,
      },
      data: {
        status: "READ",
        readAt: now,
      },
    });
  });
}
