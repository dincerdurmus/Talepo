/** Internal fileName prefix for multi-image message groups (no schema migration). */
const GROUP_PREFIX = "talepo-group:";

export type ParsedAttachmentGroup = {
  groupId: string;
  index: number;
  displayName: string;
};

export function encodeGroupFileName(
  groupId: string,
  index: number,
  originalName: string,
): string {
  const safe =
    originalName.replace(/[^\w.\-()+\sğüşıöçĞÜŞİÖÇ]/gi, "").slice(0, 100) ||
    "fotograf.jpg";
  return `${GROUP_PREFIX}${groupId}:${index}:${safe}`;
}

export function parseGroupFileName(
  fileName: string | null | undefined,
): ParsedAttachmentGroup | null {
  if (!fileName?.startsWith(GROUP_PREFIX)) return null;
  const rest = fileName.slice(GROUP_PREFIX.length);
  const firstColon = rest.indexOf(":");
  const secondColon = rest.indexOf(":", firstColon + 1);
  if (firstColon < 1 || secondColon < 0) return null;
  const groupId = rest.slice(0, firstColon);
  const indexRaw = rest.slice(firstColon + 1, secondColon);
  const index = Number.parseInt(indexRaw, 10);
  if (!groupId || !Number.isFinite(index)) return null;
  return {
    groupId,
    index,
    displayName: rest.slice(secondColon + 1) || "fotograf.jpg",
  };
}

export function displayFileName(fileName: string | null | undefined): string {
  const parsed = parseGroupFileName(fileName);
  return parsed?.displayName ?? fileName ?? "fotograf.jpg";
}

export type MessageRow = {
  id: string;
  type: string;
  content: string | null;
  fileUrl: string | null;
  fileName: string | null;
  senderUserId: string;
  createdAt: Date | string;
  senderUser?: { name: string | null; id: string };
};

export type GroupedMessage =
  | {
      kind: "text";
      id: string;
      content: string;
      senderUserId: string;
      senderName: string | null;
      createdAt: string;
      isMine: boolean;
    }
  | {
      kind: "system";
      id: string;
      content: string;
    }
  | {
      kind: "image-group";
      id: string;
      groupId: string | null;
      images: { id: string; fileUrl: string; fileName: string }[];
      caption: string | null;
      senderUserId: string;
      senderName: string | null;
      createdAt: string;
      isMine: boolean;
    };

export function groupConversationMessages(
  messages: MessageRow[],
  viewerUserId: string,
): GroupedMessage[] {
  const result: GroupedMessage[] = [];
  let index = 0;

  while (index < messages.length) {
    const message = messages[index];

    if (message.type === "SYSTEM") {
      result.push({
        kind: "system",
        id: message.id,
        content: message.content ?? "",
      });
      index += 1;
      continue;
    }

    if (message.type === "IMAGE" && message.fileUrl) {
      const parsed = parseGroupFileName(message.fileName);
      const groupId = parsed?.groupId ?? null;
      const images: { id: string; fileUrl: string; fileName: string }[] = [
        {
          id: message.id,
          fileUrl: message.fileUrl,
          fileName: displayFileName(message.fileName),
        },
      ];
      let caption = message.content?.trim() || null;
      index += 1;

      if (groupId) {
        while (index < messages.length) {
          const next = messages[index];
          if (next.type !== "IMAGE" || !next.fileUrl) break;
          const nextParsed = parseGroupFileName(next.fileName);
          if (!nextParsed || nextParsed.groupId !== groupId) break;
          if (next.senderUserId !== message.senderUserId) break;
          images.push({
            id: next.id,
            fileUrl: next.fileUrl,
            fileName: displayFileName(next.fileName),
          });
          index += 1;
        }
        images.sort((a, b) => {
          const ai = parseGroupFileName(
            messages.find((m) => m.id === a.id)?.fileName,
          )?.index ?? 0;
          const bi = parseGroupFileName(
            messages.find((m) => m.id === b.id)?.fileName,
          )?.index ?? 0;
          return ai - bi;
        });
      }

      result.push({
        kind: "image-group",
        id: message.id,
        groupId,
        images,
        caption,
        senderUserId: message.senderUserId,
        senderName: message.senderUser?.name ?? null,
        createdAt:
          typeof message.createdAt === "string"
            ? message.createdAt
            : message.createdAt.toISOString(),
        isMine: message.senderUserId === viewerUserId,
      });
      continue;
    }

    result.push({
      kind: "text",
      id: message.id,
      content: message.content ?? "",
      senderUserId: message.senderUserId,
      senderName: message.senderUser?.name ?? null,
      createdAt:
        typeof message.createdAt === "string"
          ? message.createdAt
          : message.createdAt.toISOString(),
      isMine: message.senderUserId === viewerUserId,
    });
    index += 1;
  }

  return result;
}
