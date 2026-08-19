import { MAX_MESSAGE_IMAGES } from "@/lib/message/limits";

/** Internal fileName prefix for multi-image message groups (no schema migration). */
export const GROUP_PREFIX = "talepo-group:";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ParsedAttachmentGroup = {
  groupId: string;
  index: number;
  displayName: string;
};

/** Server-issued group ids only — fail-closed for client-controlled fileName values. */
export function isValidAttachmentGroupId(groupId: string): boolean {
  return UUID_RE.test(groupId);
}

/** Strip user attempts to inject group encoding into a display file name. */
export function sanitizeUserFileName(fileName: string | null | undefined): string {
  let safe =
    (fileName?.trim() || "fotograf.jpg")
      .replace(/[^\w.\-()+\sğüşıöçĞÜŞİÖÇ]/gi, "")
      .slice(0, 120) || "fotograf.jpg";

  safe = safe.replace(/talepo-group:[^:]*:\d+:/gi, "");
  while (safe.toLowerCase().startsWith(GROUP_PREFIX)) {
    safe = safe.slice(GROUP_PREFIX.length).replace(/^[^:]*:\d+:/, "");
  }

  const reparsed = parseGroupFileNameInternal(safe, { strictServerGroup: false });
  if (reparsed) {
    safe = reparsed.displayName;
  }

  return safe.trim() || "fotograf.jpg";
}

export function encodeGroupFileName(
  groupId: string,
  index: number,
  originalName: string,
): string {
  if (!isValidAttachmentGroupId(groupId)) {
    throw new Error("Attachment group id must be server-generated UUID.");
  }
  if (index < 0 || index >= MAX_MESSAGE_IMAGES) {
    throw new Error("Attachment group index out of range.");
  }

  const safe = sanitizeUserFileName(originalName);
  return `${GROUP_PREFIX}${groupId}:${index}:${safe}`;
}

function parseGroupFileNameInternal(
  fileName: string | null | undefined,
  options?: { strictServerGroup?: boolean },
): ParsedAttachmentGroup | null {
  const strict = options?.strictServerGroup ?? true;
  if (!fileName?.startsWith(GROUP_PREFIX)) return null;
  const rest = fileName.slice(GROUP_PREFIX.length);
  const firstColon = rest.indexOf(":");
  const secondColon = rest.indexOf(":", firstColon + 1);
  if (firstColon < 1 || secondColon < 0) return null;
  const groupId = rest.slice(0, firstColon);
  const indexRaw = rest.slice(firstColon + 1, secondColon);
  const index = Number.parseInt(indexRaw, 10);
  if (!groupId || !Number.isFinite(index)) return null;
  if (strict && !isValidAttachmentGroupId(groupId)) return null;
  if (index < 0 || index >= MAX_MESSAGE_IMAGES) return null;
  return {
    groupId,
    index,
    displayName: rest.slice(secondColon + 1) || "fotograf.jpg",
  };
}

export function parseGroupFileName(
  fileName: string | null | undefined,
): ParsedAttachmentGroup | null {
  return parseGroupFileNameInternal(fileName, { strictServerGroup: true });
}

export function displayFileName(fileName: string | null | undefined): string {
  const parsed = parseGroupFileName(fileName);
  return parsed?.displayName ?? fileName ?? "fotograf.jpg";
}

/** Conversation list preview for the latest persisted row. */
export function formatImageMessagePreview(
  fileName: string | null | undefined,
  caption: string | null | undefined,
): string {
  const parsed = parseGroupFileName(fileName);
  const photoLabel = parsed
    ? `${parsed.index + 1} fotoğraf`
    : "Fotoğraf";
  return caption ? `${photoLabel} · ${caption}` : photoLabel;
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
      const caption = message.content?.trim() || null;
      index += 1;

      if (groupId && parsed) {
        while (index < messages.length) {
          const next = messages[index];
          if (next.type !== "IMAGE" || !next.fileUrl) break;
          const nextParsed = parseGroupFileName(next.fileName);
          if (!nextParsed || nextParsed.groupId !== groupId) break;
          if (nextParsed.index !== parsed.index + images.length) break;
          if (next.senderUserId !== message.senderUserId) break;
          images.push({
            id: next.id,
            fileUrl: next.fileUrl,
            fileName: displayFileName(next.fileName),
          });
          index += 1;
        }
        images.sort((a, b) => {
          const ai =
            parseGroupFileName(
              messages.find((m) => m.id === a.id)?.fileName,
            )?.index ?? 0;
          const bi =
            parseGroupFileName(
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

/** One logical send with N images maps to N persisted Message rows. */
export function logicalMessageRowCount(imageCount: number): number {
  return Math.max(0, Math.min(imageCount, MAX_MESSAGE_IMAGES));
}
