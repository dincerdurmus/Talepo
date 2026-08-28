import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { ConversationCategoryArt } from "@/components/panel/ConversationCategoryArt";
import { SignalActivityShell } from "@/components/panel/signal/SignalActivityShell";
import { formatImageMessagePreview } from "@/lib/message/attachment-group";
import { resolveRequestCardMedia } from "@/lib/panel/request-card-media";
import { getCompanyWorkspace } from "@/lib/panel/company-workspace";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

export default async function MessagesPage() {
  const user = await requireUser();
  const workspace = await getCompanyWorkspace(user.id);

  const conversations = await prisma.conversationParticipant.findMany({
    where: {
      leftAt: null,
      OR: [
        { userId: user.id },
        ...(workspace ? [{ companyId: workspace.companyId }] : []),
      ],
    },
    orderBy: {
      conversation: { lastMessageAt: "desc" },
    },
    include: {
      conversation: {
        include: {
          offer: {
            include: {
              request: {
                select: {
                  id: true,
                  title: true,
                  city: true,
                  coverImageUrl: true,
                  category: { select: { slug: true, name: true } },
                },
              },
              company: { select: { id: true, name: true } },
              submittedBy: { select: { name: true } },
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              senderUser: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  // Deduplicate by conversation id; keep the freshest lastReadAt.
  const byConversation = new Map<string, (typeof conversations)[number]>();
  for (const row of conversations) {
    const existing = byConversation.get(row.conversationId);
    if (!existing) {
      byConversation.set(row.conversationId, row);
      continue;
    }
    const existingTs = existing.lastReadAt?.getTime() ?? 0;
    const nextTs = row.lastReadAt?.getTime() ?? 0;
    if (nextTs > existingTs) {
      byConversation.set(row.conversationId, {
        ...existing,
        lastReadAt: row.lastReadAt,
      });
    }
  }
  const unique = [...byConversation.values()];

  const companyScoped = workspace
    ? unique.filter(
        (row) => row.conversation.offer.companyId === workspace.companyId,
      )
    : unique;

  const list = workspace ? companyScoped : unique;
  const unreadCount = list.filter(({ conversation, lastReadAt }) =>
    Boolean(
      conversation.lastMessageAt &&
        (!lastReadAt || lastReadAt < conversation.lastMessageAt),
    ),
  ).length;
  const summary =
    unreadCount > 0
      ? `${unreadCount} yazışmada yeni gelişme var.`
      : list.length > 0
        ? "Tüm yazışmalar güncel."
        : "Yazışma, teklif kabulünden sonra açılır.";

  return (
    <SignalActivityShell
      tone="communication"
      eyebrow={workspace ? workspace.companyName : "İLETİŞİM"}
      title="Mesajlar"
      description={
        workspace
          ? "Firmanızın tekliflerine bağlı yazışmalar. İletişim teklif kabulünden sonra açılır."
          : "Anlaşma sonrası açılan yazışmalar. Fiyat pazarlığı karşı teklif turlarıyla yapılır; mesajlaşma teklif kabulünden sonra açılır."
      }
      summary={summary}
    >
      {list.length === 0 ? (
        <section className="talepo-activity-empty">
          <span className="talepo-activity-icon" aria-hidden>
            <MessageCircle className="h-4 w-4" />
          </span>
          <h2 className="text-lg font-semibold tracking-tight text-[#0f1f1d]">
            Anlaşma sonrası yazışmalar burada
          </h2>
          <p className="max-w-lg text-sm leading-6 text-[#0f1f1d]/52">
            Mesajlar otomatik gelmez. Karşı teklif ve pazarlık tutar üzerinden
            yürür; yazışma ancak anlaşmadan sonra açılır.
          </p>

          <ol className="talepo-activity-empty-steps">
            {workspace ? (
              <>
                <li className="talepo-activity-empty-step">
                  <span className="font-semibold text-[#0f1f1d]/80">1.</span>{" "}
                  Keşiften bir talebe <strong>teklif gönderin</strong>
                </li>
                <li className="talepo-activity-empty-step">
                  <span className="font-semibold text-[#0f1f1d]/80">2.</span> Alıcı{" "}
                  <strong>kabul eder</strong> veya <strong>karşı teklif</strong>{" "}
                  verir. Anlaşma olunca yazışma açılır
                </li>
                <li className="talepo-activity-empty-step">
                  <span className="font-semibold text-[#0f1f1d]/80">3.</span> Yazışma{" "}
                  <strong>burada</strong> açılır
                </li>
              </>
            ) : (
              <>
                <li className="talepo-activity-empty-step">
                  <span className="font-semibold text-[#0f1f1d]">1.</span> Firma
                  talebinize <strong>teklif gönderir</strong> →{" "}
                  <Link
                    href="/panel/gelen-teklifler"
                    className="font-semibold text-teal-800 underline-offset-2 hover:underline"
                  >
                    Gelen teklifler
                  </Link>
                </li>
                <li className="talepo-activity-empty-step">
                  <span className="font-semibold text-[#0f1f1d]">2.</span> Siz{" "}
                  <strong>Kabul et</strong> veya <strong>karşı teklif</strong>{" "}
                  verirsiniz
                </li>
                <li className="talepo-activity-empty-step">
                  <span className="font-semibold text-[#0f1f1d]">3.</span> Anlaşma
                  sonrası yazışma <strong>burada</strong> açılır
                </li>
              </>
            )}
          </ol>

          <div className="talepo-activity-actions">
            {workspace ? (
              <>
                <Link
                  href="/panel/talepler"
                  className="talepo-activity-cta talepo-activity-cta--primary"
                >
                  Talepler
                </Link>
                <Link
                  href="/panel/teklifler"
                  className="talepo-activity-cta talepo-activity-cta--secondary"
                >
                  Tekliflerimiz
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/panel/gelen-teklifler"
                  className="talepo-activity-cta talepo-activity-cta--primary"
                >
                  Gelen teklifler
                </Link>
                <Link
                  href="/panel/taleplerim"
                  className="talepo-activity-cta talepo-activity-cta--secondary"
                >
                  Taleplerim
                </Link>
              </>
            )}
          </div>
        </section>
      ) : (
        <section className="talepo-activity-list" aria-label="Yazışmalar">
          {list.map(({ conversation, lastReadAt }) => {
            const lastMessage = conversation.messages[0];
            const isSupplierSide = Boolean(
              workspace &&
                conversation.offer.companyId === workspace.companyId,
            );
            const counterpart = isSupplierSide
              ? "Alıcı"
              : conversation.offer.company?.name ||
                conversation.offer.submittedBy.name ||
                "Firma";
            const requestTitle =
              conversation.offer.request.title ||
              conversation.title ||
              "Talep";
            const unread =
              conversation.lastMessageAt &&
              (!lastReadAt || lastReadAt < conversation.lastMessageAt);
            const identityMark = counterpart.trim().charAt(0).toUpperCase() || "T";
            const request = conversation.offer.request;
            const hasArtwork =
              resolveRequestCardMedia({
                coverImageUrl: request.coverImageUrl,
                categorySlug: request.category?.slug,
              }).kind !== "icon";

            const preview = lastMessage
              ? lastMessage.type === "SYSTEM"
                ? lastMessage.content
                : lastMessage.type === "IMAGE"
                  ? `${lastMessage.senderUser?.name ?? "Sistem"}: ${formatImageMessagePreview(
                      lastMessage.fileName,
                      lastMessage.content,
                    )}`
                  : `${lastMessage.senderUser?.name ?? "Sistem"}: ${
                      lastMessage.content ??
                      lastMessage.fileName ??
                      "Dosya / sistem mesajı"
                    }`
              : "Henüz mesaj yok";

            return (
              <Link
                key={conversation.id}
                href={`/panel/mesajlar/${conversation.id}`}
                prefetch={false}
                className={[
                  "talepo-activity-row talepo-activity-row--clickable",
                  unread ? "talepo-activity-row--unread" : "",
                  hasArtwork ? "talepo-activity-row--with-art" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={
                  unread
                    ? `${counterpart}, ${requestTitle}, okunmadı`
                    : `${counterpart}, ${requestTitle}`
                }
              >
                <span className="talepo-activity-icon text-sm font-semibold" aria-hidden>
                  {identityMark}
                </span>
                <div className="relative z-[1] min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={
                          unread
                            ? "truncate font-semibold tracking-tight text-[#0f1f1d]"
                            : "truncate font-semibold tracking-tight text-[#0f1f1d]/78"
                        }
                      >
                        {unread ? (
                          <span className="talepo-beacon-unread-dot mr-2 inline-block align-middle" aria-hidden />
                        ) : null}
                        {counterpart}
                        {unread ? <span className="sr-only"> Okunmadı</span> : null}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] text-[#0f1f1d]/52">
                        {requestTitle}
                        {conversation.offer.request.city
                          ? ` · ${conversation.offer.request.city}`
                          : ""}
                      </p>
                    </div>
                    {conversation.lastMessageAt ? (
                      <time
                        dateTime={conversation.lastMessageAt.toISOString()}
                        className="shrink-0 pt-0.5 text-[11px] tabular-nums text-[#0f1f1d]/38"
                      >
                        {formatDate(conversation.lastMessageAt)}
                      </time>
                    ) : null}
                  </div>
                  {conversation.offer.status !== "ACCEPTED" ? (
                    <p className="mt-1 text-[11px] font-medium text-[#8a5a18]">
                      Salt okunur · mesajlaşma anlaşmadan sonra açılır
                    </p>
                  ) : null}
                  <p className="mt-1.5 truncate text-sm text-[#0f1f1d]/48">
                    {preview}
                  </p>
                </div>
                {hasArtwork ? (
                  <ConversationCategoryArt
                    coverImageUrl={request.coverImageUrl}
                    categorySlug={request.category?.slug}
                  />
                ) : null}
              </Link>
            );
          })}
        </section>
      )}
    </SignalActivityShell>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
