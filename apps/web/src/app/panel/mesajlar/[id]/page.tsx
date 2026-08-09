import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { MessageComposer } from "@/components/panel/MessageComposer";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const participant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId: id,
      userId: user.id,
      leftAt: null,
    },
    include: {
      conversation: {
        include: {
          offer: {
            include: {
              request: { select: { title: true, id: true } },
              company: { select: { name: true } },
              submittedBy: { select: { name: true } },
            },
          },
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
              senderUser: { select: { name: true, id: true } },
            },
          },
        },
      },
    },
  });

  if (!participant) notFound();

  const { conversation } = participant;
  const counterpart =
    conversation.offer.company?.name ||
    conversation.offer.submittedBy.name ||
    "Firma";

  return (
    <>
      <header className="flex items-center justify-between rounded-[26px] border border-black/[0.06] bg-white/80 px-5 py-4 backdrop-blur-xl">
        <Link
          href="/panel/mesajlar"
          className="flex items-center gap-2 text-sm font-medium text-black/45 transition hover:text-black"
        >
          <ArrowLeft className="h-4 w-4" />
          Mesajlar
        </Link>
        <div className="text-right">
          <p className="text-sm font-semibold">{counterpart}</p>
          <p className="text-xs text-black/40">{conversation.offer.request.title}</p>
        </div>
      </header>

      <section className="mt-5 flex min-h-[420px] flex-col rounded-[28px] border border-black/[0.06] bg-white shadow-[0_18px_60px_rgba(0,0,0,0.04)]">
        <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
          {conversation.messages.length === 0 ? (
            <p className="text-center text-sm text-black/40">
              Henüz mesaj yok. İlk mesajı siz gönderebilirsiniz.
            </p>
          ) : (
            conversation.messages.map((message) => {
              const isMine = message.senderUserId === user.id;

              return (
                <div
                  key={message.id}
                  className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-[20px] px-4 py-3 text-sm leading-6 ${
                      isMine
                        ? "bg-[#151515] text-white"
                        : "bg-[#f3f3ef] text-black/70"
                    }`}
                  >
                    {!isMine && (
                      <p className="mb-1 text-xs font-semibold text-black/35">
                        {message.senderUser.name}
                      </p>
                    )}
                    {message.content}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <MessageComposer conversationId={conversation.id} />
      </section>
    </>
  );
}
