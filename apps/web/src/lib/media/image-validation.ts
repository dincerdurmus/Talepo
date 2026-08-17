/** Server-side image validation helpers (mime, size, magic bytes). */

export const MESSAGE_IMAGE_MAX_BYTES = 2_500_000;
export const MESSAGE_IMAGE_DATA_URL_MAX_CHARS = 900_000;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ParsedImageDataUrl = {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  buffer: Buffer;
  byteLength: number;
};

export type AllowedImageMime = ParsedImageDataUrl["mimeType"];

export function isAllowedImageMime(mime: string | null | undefined): boolean {
  return Boolean(mime && ALLOWED_MIME.has(mime.toLowerCase()));
}

const BLOCKED_NAME_RE =
  /\.(svg|gif|html?|xhtml|xml|js|mjs|cjs|ts|tsx|json|exe|dll|bat|cmd|ps1|sh|php|py|rb|jar|wasm|pdf|doc|docx|xls|xlsx|zip|rar|7z)$/i;

export function looksLikeBlockedUploadName(name: string | null | undefined) {
  if (!name) return false;
  const base = name.split(/[/\\]/).pop() ?? name;
  return BLOCKED_NAME_RE.test(base.trim());
}

export function detectImageMime(buffer: Buffer): AllowedImageMime | null {
  if (buffer.length < 12) return null;
  if (matchesMagicBytes(buffer, "image/jpeg")) return "image/jpeg";
  if (matchesMagicBytes(buffer, "image/png")) return "image/png";
  if (matchesMagicBytes(buffer, "image/webp")) return "image/webp";
  return null;
}

function looksLikeSvgOrScript(buffer: Buffer) {
  const head = buffer.subarray(0, 256).toString("utf8").trimStart().toLowerCase();
  if (head.startsWith("<svg") || head.includes("<svg")) return true;
  if (head.startsWith("<?xml") && head.includes("<svg")) return true;
  if (head.startsWith("<!doctype html") || head.startsWith("<html")) return true;
  if (head.startsWith("<?php") || head.startsWith("<script")) return true;
  // MZ executable
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) return true;
  return false;
}

export type ValidatedImageBuffer = {
  mimeType: AllowedImageMime;
  byteLength: number;
};

export function validateImageBuffer(
  buffer: Buffer,
  options?: {
    claimedMime?: string | null;
    originalName?: string | null;
    maxBytes?: number;
  },
): ValidatedImageBuffer {
  const maxBytes = options?.maxBytes ?? MESSAGE_IMAGE_MAX_BYTES;

  if (looksLikeBlockedUploadName(options?.originalName)) {
    throw new Error(
      "Yalnızca JPEG, PNG veya WebP kabul edilir. SVG, GIF ve belgeler yüklenemez.",
    );
  }

  if (looksLikeSvgOrScript(buffer)) {
    throw new Error(
      "Yalnızca JPEG, PNG veya WebP kabul edilir. SVG, GIF ve belgeler yüklenemez.",
    );
  }

  if (buffer.byteLength < 32) {
    throw new Error("Görsel dosyası geçersiz veya bozuk.");
  }

  if (buffer.byteLength > maxBytes) {
    throw new Error(
      "Görsel çok büyük. Lütfen 2.5 MB altındaki bir görsel yükleyin.",
    );
  }

  const detected = detectImageMime(buffer);
  if (!detected) {
    throw new Error(
      "Yalnızca JPEG, PNG veya WebP kabul edilir. SVG, GIF ve belgeler yüklenemez.",
    );
  }

  const claimed = options?.claimedMime?.toLowerCase() ?? "";
  if (
    claimed &&
    claimed !== "application/octet-stream" &&
    !isAllowedImageMime(claimed)
  ) {
    throw new Error(
      "Yalnızca JPEG, PNG veya WebP kabul edilir. SVG, GIF ve belgeler yüklenemez.",
    );
  }

  if (claimed && isAllowedImageMime(claimed) && claimed !== detected) {
    throw new Error(
      "Görsel içeriği dosya türüyle uyuşmuyor. Farklı bir görsel deneyin.",
    );
  }

  if (!matchesMagicBytes(buffer, detected)) {
    throw new Error(
      "Görsel içeriği dosya türüyle uyuşmuyor. Farklı bir görsel deneyin.",
    );
  }

  return { mimeType: detected, byteLength: buffer.byteLength };
}

export function parseImageDataUrl(dataUrl: string): ParsedImageDataUrl {
  const trimmed = dataUrl.trim();
  const match = /^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(
    trimmed,
  );

  if (!match) {
    throw new Error(
      "Geçersiz görsel formatı. Yalnızca JPEG, PNG veya WebP kabul edilir.",
    );
  }

  const mimeType = `image/${match[2].toLowerCase()}` as ParsedImageDataUrl["mimeType"];
  const buffer = Buffer.from(match[3].replace(/\s+/g, ""), "base64");

  if (buffer.byteLength < 32) {
    throw new Error("Görsel dosyası geçersiz veya bozuk.");
  }

  if (buffer.byteLength > MESSAGE_IMAGE_MAX_BYTES) {
    throw new Error(
      "Görsel çok büyük. Lütfen 2.5 MB altındaki bir görsel yükleyin.",
    );
  }

  if (trimmed.length > MESSAGE_IMAGE_DATA_URL_MAX_CHARS) {
    throw new Error("Görsel sıkıştırılamadı. Daha küçük bir dosya seçin.");
  }

  if (!matchesMagicBytes(buffer, mimeType)) {
    throw new Error(
      "Görsel içeriği dosya türüyle uyuşmuyor. Farklı bir görsel deneyin.",
    );
  }

  return { mimeType, buffer, byteLength: buffer.byteLength };
}

function matchesMagicBytes(
  buffer: Buffer,
  mimeType: ParsedImageDataUrl["mimeType"],
): boolean {
  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }

  // RIFF....WEBP
  return (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  );
}

export function readImageDimensions(
  buffer: Buffer,
  mimeType: ParsedImageDataUrl["mimeType"],
): { width: number; height: number } | null {
  try {
    if (mimeType === "image/png" && buffer.length >= 24) {
      return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
      };
    }

    if (mimeType === "image/jpeg") {
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];
        if (marker === 0xc0 || marker === 0xc2) {
          return {
            height: buffer.readUInt16BE(offset + 5),
            width: buffer.readUInt16BE(offset + 7),
          };
        }
        const size = buffer.readUInt16BE(offset + 2);
        offset += 2 + size;
      }
    }

    if (mimeType === "image/webp" && buffer.length >= 30) {
      if (
        buffer.toString("ascii", 12, 16) === "VP8 " &&
        buffer.length >= 30
      ) {
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        return { width, height };
      }
      if (buffer.toString("ascii", 12, 16) === "VP8L" && buffer.length >= 25) {
        const bits = buffer.readUInt32LE(21);
        return {
          width: (bits & 0x3fff) + 1,
          height: ((bits >> 14) & 0x3fff) + 1,
        };
      }
    }
  } catch {
    return null;
  }

  return null;
}
