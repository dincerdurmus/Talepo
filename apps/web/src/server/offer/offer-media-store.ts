import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AllowedImageMime } from "@/lib/media/image-validation";

const DEFAULT_DIR = path.join(process.cwd(), ".data", "offer-media");

function resolveRoot() {
  const fromEnv = process.env.OFFER_MEDIA_DIR?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_DIR;
}

const SAFE_ID_RE = /^[a-z0-9_-]{8,64}$/i;

function extForMime(mime: AllowedImageMime) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export function buildOfferMediaStorageKey(
  offerId: string,
  mediaId: string,
  mime: AllowedImageMime,
) {
  if (!SAFE_ID_RE.test(offerId) || !SAFE_ID_RE.test(mediaId)) {
    throw new Error("Geçersiz medya anahtarı.");
  }
  return `${offerId}/${mediaId}.${extForMime(mime)}`;
}

function resolveSafePath(storageKey: string) {
  if (
    !storageKey ||
    storageKey.includes("..") ||
    storageKey.includes("\\") ||
    storageKey.startsWith("/") ||
    !/^[a-z0-9_-]+\/[a-z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(storageKey)
  ) {
    throw new Error("Geçersiz medya anahtarı.");
  }

  const root = path.resolve(resolveRoot());
  const full = path.resolve(root, storageKey);
  const relative = path.relative(root, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Geçersiz medya anahtarı.");
  }
  return full;
}

export async function writeOfferMediaFile(
  storageKey: string,
  bytes: Buffer,
) {
  const full = resolveSafePath(storageKey);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
}

export async function readOfferMediaFile(storageKey: string) {
  return readFile(resolveSafePath(storageKey));
}

export async function deleteOfferMediaFile(storageKey: string) {
  try {
    await unlink(resolveSafePath(storageKey));
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    if (code !== "ENOENT") throw error;
  }
}
