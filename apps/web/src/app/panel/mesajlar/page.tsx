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
              request: { select: { id: true, title: true, city: true } },
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

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl border border-teal-900/10 bg-white px-5 py-6 shadow-[0_12px_36px_rgba(15,31,29,0.04)] sm:px-7 sm:py-7">
        <p className="relative text-xs font-semibold uppercase tracking-[0.14em] text-teal-800/55">
          {workspace ? workspace.companyName : "İletişim"}
        </p>
        <h1 className="talepo-page-title relative mt-2 text-3xl sm:text-4xl">
          Mesajlar
        </h1>
        <p className="relative mt-3 max-w-2xl text-sm leading-7 text-teal-950/50 sm:text-[15px]">
          {workspace
            ? "Firmanızın tekliflerine bağlı yazışmalar. İletişim teklif kabulünden sonra açılır."
            : "Anlaşma sonrası açılan yazışmalar. Fiyat pazarlığı karşı teklif turlarıyla yapılır; mesajlaşma teklif kabulünden sonra açılır."}
        </p>
      </section>

      {list.length === 0 ? (
        <section className="mt-5 rounded-2xl border border-teal-900/10 bg-white p-8 text-center shadow-[0_12px_36px_rgba(15,31,29,0.04)] sm:p-14">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-[#eef6f4] text-teal-800">
            <MessageCircle className="h-7 w-7" />
          </div>
          <h2 className="mt-6 text-2xl font-semibold tracking-tight text-[#0f1f1d]">
            Henüz mesajınız yok
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-teal-950/50">
            Mesajlar otomatik gelmez. Karşı teklif ve pazarlık tutar üzerinden
            yürür; yazışma ancak anlaşmadan sonra açılır.
          </p>

          <ol className="mx-auto mt-6 max-w-md space-y-3 text-left text-sm text-teal-950/60">
            {workspace ? (
              <>
                <li className="rounded-xl border border-teal-900/8 bg-[#f7faf9] px-4 py-3">
                  <span className="font-semibold text-teal-900/80">1.</span>{" "}
                  Keşiften bir talebe <strong>teklif gönderin</strong>
                </li>
                <li className="rounded-xl border border-teal-900/8 bg-[#f7faf9] px-4 py-3">
                  <span className="font-semibold text-teal-900/80">2.</span> Alıcı{" "}
                  <strong>kabul eder</strong> veya <strong>karşı teklif</strong>{" "}
                  verir. Anlaşma olunca yazışma açılır
                </li>
                <li className="rounded-xl border border-teal-900/8 bg-[#f7faf9] px-4 py-3">
                  <span className="font-semibold text-teal-900/80">3.</span> Yazışma{" "}
                  <strong>burada</strong> açılır
                </li>
              </>
            ) : (
              <>
                <li className="rounded-xl border border-teal-900/8 bg-[#f7faf9] px-4 py-3">
                  <span className="font-semibold text-[#0f1f1d]">1.</span> Firma
                  talebinize <strong>teklif gönderir</strong> →{" "}
                  <Link
                    href="/panel/gelen-teklifler"
                    className="font-semibold text-teal-800 underline-offset-2 hover:underline"
                  >
                    Gelen teklifler
                  </Link>
                </li>
                <li className="rounded-xl border border-teal-900/8 bg-[#f7faf9] px-4 py-3">
                  <span className="font-semibold text-[#0f1f1d]">2.</span> Siz{" "}
                  <strong>Kabul et</strong> veya <strong>karşı teklif</strong>{" "}
                  verirsiniz
                </li>
                <li className="rounded-xl border border-teal-900/8 bg-[#f7faf9] px-4 py-3">
                  <span className="font-semibold text-[#0f1f1d]">3.</span> Anlaşma
                  sonrası yazışma <strong>burada</strong> açılır
                </li>
              </>
            )}
          </ol>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {workspace ? (
              <>
                <Link
                  href="/panel/talepler"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0f766e] px-5 py-3 text-sm font-semibold text-white"
                >
                  Talepleri keşfet
                </Link>
                <Link
                  href="/panel/teklifler"
                  className="inline-flex items-center gap-2 rounded-xl border border-teal-900/10 bg-white px-5 py-3 text-sm font-semibold text-[#0f1f1d]"
                >
                  Tekliflerimiz
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/panel/gelen-teklifler"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0f766e] px-5 py-3 text-sm font-semibold text-white"
                >
                  Gelen teklifler
                </Link>
                <Link
                  href="/panel/taleplerim"
                  className="inline-flex items-center gap-2 rounded-xl border border-teal-900/10 bg-white px-5 py-3 text-sm font-semibold text-[#0f1f1d]"
                >
                  Taleplerim
                </Link>
              </>
            )}
          </div>
        </section>
      ) : (
        <section className="mt-5 grid gap-3">
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
            const requestId = conversation.offer.request.id;
            const unread =
              conversation.lastMessageAt &&
              (!lastReadAt || lastReadAt < conversation.lastMessageAt);

            const preview = lastMessage
              ? lastMessage.type === "SYSTEM"
                ? lastMessage.content
                : lastMessage.type === "IMAGE"
                  ? `${lastMessage.senderUser?.name ?? "Sistem"}: Fotoğraf${
                      lastMessage.content ? ` · ${lastMessage.content}` : ""
                    }`
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
                className="group rounded-2xl border border-teal-900/8 bg-white/95 p-5 shadow-[0_10px_36px_rgba(15,118,110,0.04)] transition hover:border-teal-700/20 hover:bg-[#f8fcfb] hover:shadow-[0_14px_42px_rgba(15,118,110,0.07)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="inline-flex max-w-full flex-col gap-0.5 rounded-xl border border-teal-800/10 bg-[#f0faf7] px-2.5 py-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-800/55">
                        Talep başlığı
                      </span>
                      <span className="truncate text-[13px] font-semibold text-teal-950/90">
                        {requestTitle}
                      </span>
                    </div>
                    <p className="mt-2.5 truncate text-[15px] font-semibold text-slate-800">
                      {counterpart}
                    </p>
                    {conversation.offer.status !== "ACCEPTED" ? (
                      <p className="mt-1 text-[11px] font-semibold text-amber-800">
                        Salt okunur · mesajlaşma anlaşmadan sonra açılır
                      </p>
                    ) : null}
                    {conversation.offer.request.city && (
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {conversation.offer.request.city}
                      </p>
                    )}
                    <p className="mt-3 truncate text-sm text-slate-500">
                      {preview}
                    </p>
                    <p className="mt-2 text-[11px] font-medium text-slate-400">
                      Talep no · {requestId.slice(-8)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {conversation.lastMessageAt && (
                      <p className="text-xs text-slate-400">
                        {formatDate(conversation.lastMessageAt)}
                      </p>
                    )}
                    {unread && (
                      <span className="mt-2 inline-flex rounded-lg bg-teal-700/90 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm shadow-teal-900/10">
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
