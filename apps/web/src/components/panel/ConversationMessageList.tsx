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
      <p className="text-center text-sm text-slate-400">
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
              <p className="max-w-[90%] rounded-xl border border-teal-900/8 bg-white/80 px-3 py-2 text-center text-xs leading-5 text-slate-500">
                {item.content}
              </p>
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
              className={`max-w-[85%] overflow-hidden rounded-2xl text-sm leading-6 shadow-sm sm:max-w-[80%] ${
                item.isMine
                  ? "bg-teal-800 text-white shadow-teal-900/10"
                  : "border border-slate-200/70 bg-white text-slate-700"
              }`}
            >
              {!item.isMine && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenProfile?.(item.senderUserId, senderLabel)
                  }
                  className={`px-4 pt-3 text-xs font-semibold underline-offset-2 hover:underline ${
                    item.isMine ? "text-white/55" : "text-slate-500"
                  }`}
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
                    <p className="px-4 py-3">{item.caption}</p>
                  ) : (
                    <div className="h-1" />
                  )}
                </div>
              ) : (
                <p className="px-4 py-3">{item.content}</p>
              )}
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
