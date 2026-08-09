import Link from "next/link";
import { MessageCircle } from "lucide-react";

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
              request: { select: { title: true } },
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

  // Deduplicate by conversation id (user + company participant rows)
  const seen = new Set<string>();
  const unique = conversations.filter((row) => {
    if (seen.has(row.conversationId)) return false;
    seen.add(row.conversationId);
    return true;
  });

  const companyScoped = workspace
    ? unique.filter(
        (row) => row.conversation.offer.companyId === workspace.companyId,
      )
    : unique;

  const list = workspace ? companyScoped : unique;
  const isCorporateTone = Boolean(workspace?.isCorporate);

  return (
    <>
      <section className="py-4 sm:py-6">
        <p
          className={`text-sm font-semibold ${
            isCorporateTone ? "text-teal-800/60" : "text-black/35"
          }`}
        >
          {workspace ? workspace.companyName : "İletişim"}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
          Mesajlar
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-black/45">
          {workspace
            ? "Firmanızın tekliflerine bağlı yazışmalar. İletişim teklif kabulünden sonra açılır."
            : "Teklif sürecindeki firmalar ve müşterilerle yazışmalarınızı buradan takip edin."}
        </p>
      </section>

      {list.length === 0 ? (
        <section className="rounded-[34px] border border-black/[0.06] bg-white p-8 text-center shadow-[0_20px_70px_rgba(0,0,0,0.04)] sm:p-14">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] ${
              isCorporateTone ? "bg-[#e7f7f2] text-teal-800" : "bg-[#f4eaff] text-[#704daf]"
            }`}
          >
            <MessageCircle className="h-7 w-7" />
          </div>
          <h2 className="mt-6 text-2xl font-semibold tracking-tight">
            Henüz mesajınız yok
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-black/45">
            {workspace
              ? "Bir teklifiniz kabul edildiğinde mesajlaşma burada başlar."
              : "Bir talebe teklif verildiğinde veya talebinize teklif geldiğinde mesajlaşma burada başlayacak."}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/panel/talepler"
              className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white ${
                isCorporateTone ? "bg-teal-800" : "bg-black"
              }`}
            >
              Talepleri keşfet
            </Link>
            {workspace ? (
              <Link
                href="/panel/teklifler"
                className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-5 py-3 text-sm font-semibold"
              >
                Tekliflerimiz
              </Link>
            ) : (
              <Link
                href="/panel/taleplerim"
                className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-5 py-3 text-sm font-semibold"
              >
                Taleplerime git
              </Link>
            )}
          </div>
        </section>
      ) : (
        <section className="grid gap-3">
          {list.map(({ conversation, lastReadAt }) => {
            const lastMessage = conversation.messages[0];
            const isOwnCompanyOffer =
              workspace &&
              conversation.offer.companyId === workspace.companyId;
            const counterpart = isOwnCompanyOffer
              ? conversation.offer.request.title
              : conversation.offer.company?.name ||
                conversation.offer.submittedBy.name ||
                "Firma";
            const unread =
              conversation.lastMessageAt &&
              (!lastReadAt || lastReadAt < conversation.lastMessageAt);

            return (
              <Link
                key={conversation.id}
                href={`/panel/mesajlar/${conversation.id}`}
                className="rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.03)] transition hover:bg-[#fafaf8]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{counterpart}</p>
                    <p className="mt-1 truncate text-xs text-black/40">
                      {isOwnCompanyOffer
                        ? "Firma teklifi · kabul sonrası sohbet"
                        : conversation.offer.request.title}
                    </p>
                    <p className="mt-3 truncate text-sm text-black/55">
                      {lastMessage
                        ? `${lastMessage.senderUser?.name ?? "Sistem"}: ${
                            lastMessage.content ??
                            lastMessage.fileName ??
                            "Dosya / sistem mesajı"
                          }`
                        : "Henüz mesaj yok"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {conversation.lastMessageAt && (
                      <p className="text-xs text-black/35">
                        {formatDate(conversation.lastMessageAt)}
                      </p>
                    )}
                    {unread && (
                      <span
                        className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${
                          isCorporateTone ? "bg-teal-700" : "bg-black"
                        }`}
                      >
                        Yeni
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </>
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
