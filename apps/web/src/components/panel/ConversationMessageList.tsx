"use client";

import { useMemo, useState } from "react";

import { MessageImageLightbox } from "@/components/panel/MessageImageLightbox";
import {
  groupConversationMessages,
  type MessageRow,
} from "@/lib/message/attachment-group";

type ConversationMessageListProps = {
  messages: MessageRow[];
  viewerUserId: string;
  onOpenProfile?: (userId: string, displayName: string) => void;
};

export function ConversationMessageList({
  messages,
  viewerUserId,
  onOpenProfile,
}: ConversationMessageListProps) {
  const grouped = useMemo(
    () => groupConversationMessages(messages, viewerUserId),
    [messages, viewerUserId],
  );
  const [lightbox, setLightbox] = useState<{
    images: { src: string; alt: string }[];
    startIndex: number;
  } | null>(null);

  if (grouped.length === 0) {
    return (
      <p className="px-2 py-8 text-center text-sm text-[#0f1f1d]/42">
        Henüz mesaj yok. İlk mesajı siz gönderebilirsiniz.
      </p>
    );
  }

  return (
    <>
      {grouped.map((item) => {
        if (item.kind === "system") {
          return (
            <div key={item.id} className="flex justify-center">
              <p className="talepo-conversation-system">{item.content}</p>
            </div>
          );
        }

        const senderLabel = item.senderName ?? "Katılımcı";

        return (
          <div
            key={item.id}
            className={`flex ${item.isMine ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`talepo-conversation-msg ${
                item.isMine
                  ? "talepo-conversation-msg--mine"
                  : "talepo-conversation-msg--theirs"
              }`}
            >
              <div
                className={`talepo-conversation-bubble ${
                  item.isMine
                    ? "talepo-conversation-bubble--mine"
                    : "talepo-conversation-bubble--theirs"
                } ${item.kind === "image-group" ? "talepo-conversation-bubble--media" : ""}`}
              >
                {!item.isMine && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenProfile?.(item.senderUserId, senderLabel)
                    }
                    className="talepo-conversation-bubble-sender px-5 pt-3.5 text-xs font-semibold text-[#0f1f1d]/48 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/30"
                    aria-label={`${senderLabel} profilini görüntüle`}
                  >
                    {senderLabel}
                  </button>
                )}

                {item.kind === "image-group" ? (
                  <div className={item.caption || !item.isMine ? "pt-2" : ""}>
                    <div
                      className={`grid gap-0.5 ${
                        item.images.length === 1
                          ? "grid-cols-1"
                          : item.images.length === 2
                            ? "grid-cols-2"
                            : "grid-cols-3"
                      }`}
                    >
                      {item.images.map((image, imageIndex) => (
                        <button
                          key={image.id}
                          type="button"
                          onClick={() =>
                            setLightbox({
                              images: item.images.map((row) => ({
                                src: row.fileUrl,
                                alt: row.fileName,
                              })),
                              startIndex: imageIndex,
                            })
                          }
                          className="block overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                          aria-label={`${image.fileName} fotoğrafını büyüt`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image.fileUrl}
                            alt={image.fileName}
                            className="aspect-square w-full object-cover sm:max-h-48 sm:aspect-auto sm:object-cover"
                          />
                        </button>
                      ))}
                    </div>
                    {item.caption ? (
                      <p className="talepo-conversation-bubble-copy">{item.caption}</p>
                    ) : (
                      <div className="h-1" />
                    )}
                  </div>
                ) : (
                  <p className="talepo-conversation-bubble-copy">{item.content}</p>
                )}
              </div>
              <p
                className={`mt-1 px-1 text-[10px] tabular-nums text-[#0f1f1d]/34 ${
                  item.isMine ? "text-right" : "text-left"
                }`}
              >
                {formatMessageTime(item.createdAt)}
              </p>
            </div>
          </div>
        );
      })}

      <MessageImageLightbox
        images={lightbox?.images ?? []}
        startIndex={lightbox?.startIndex ?? 0}
        open={Boolean(lightbox)}
        onClose={() => setLightbox(null)}
      />
    </>
  );
}

function formatMessageTime(iso: string) {
  const date = new Date(iso);
  const sameDay =
    date.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat("tr-TR", {
    day: sameDay ? undefined : "numeric",
    month: sameDay ? undefined : "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
