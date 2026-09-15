import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AllowedImageMime } from "@/lib/media/image-validation";

const DEFAULT_DIR = path.join(process.cwd(), ".data", "offer-media");

function resolveRoot() {
  const fromEnv = process.env.OFFER_MEDIA_DIR?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_DIR;
}

/**
 * DEPOLAMA KİPİ — KALICILIK SÖZLEŞMESİ.
 *
 * `fs` (varsayılan, davranış değişmez): bayt diske yazılır. Tek sunuculu
 * kurulumda doğrudur; sunucusuz (Vercel) kurulumda YANLIŞTIR — dosya her
 * deploy'da ve örnekler arasında kaybolur, yani ücretli tedarikçinin
 * yüklediği ürün fotoğrafı sessizce yok olur.
 *
 * `inline`: bayt `data:` URL olarak kaydın kendi `storageKey` kolonunda
 * taşınır, yani veritabanında yaşar. Mesaj görselleri bu depoda zaten
 * böyle saklanıyor (`send-image-message.ts` → `fileUrl: dataUrl`), bu
 * yüzden yeni bir kalıcılık modeli icat edilmiyor, var olanı kullanıyor.
 *
 * OKUMA HER İKİ KİPTE DE ÇALIŞIR: `data:` ile başlayan anahtar çözülür,
 * diğerleri diskten okunur. Bu yüzden kip değiştiğinde eski kayıtlar
 * bozulmaz ve geri dönüş tek env değişkeni kadar uzaktır.
 */
export type OfferMediaStorageMode = "fs" | "inline";

/**
 * SUNUCUSUZ ORTAMDA VARSAYILAN GÜVENLİ TARAFA DÜŞER (2026-09-15).
 *
 * Ölçülen risk: varsayılan `fs` idi ve `OFFER_MEDIA_STORAGE` yalnız OPSİYONEL
 * ortam değişkeniydi — `/api/ready` onu denetlemiyor. Vercel'e bu değişken
 * yazılmadan çıkılırsa tedarikçinin yüklediği ürün fotoğrafı ya yazma hatası
 * verir ya ilk deploy'da sessizce kaybolur. Sessiz kayıp, ücretli tedarikçinin
 * teklifinin kanıtını yok eder; unutulması çok kolay, fark edilmesi çok zor
 * bir ayardır.
 *
 * Bu yüzden kip artık ortamdan da okunur: sunucusuz platform değişkeni
 * (`VERCEL`) varsa varsayılan `inline`'dır. AÇIK BEYAN HER ZAMAN KAZANIR —
 * `OFFER_MEDIA_STORAGE` yazılmışsa o kullanılır, yani kalıcı disk bağlayan
 * bir kurulum `fs` diyerek eski davranışa döner. Ortam tespiti bir tahmin
 * değil, platformun kendi enjekte ettiği değişkendir.
 */
export function resolveOfferMediaStorageMode(): OfferMediaStorageMode {
  const declared = process.env.OFFER_MEDIA_STORAGE?.trim().toLowerCase();
  if (declared === "inline") return "inline";
  if (declared === "fs") return "fs";

  const serverless =
    Boolean(process.env.VERCEL?.trim()) ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME?.trim());
  return serverless ? "inline" : "fs";
}

const INLINE_PREFIX = "data:";

/** `data:image/jpeg;base64,…` — mime beyaz listeye karşı doğrulanır. */
const INLINE_KEY_RE =
  /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export function isInlineOfferMediaKey(storageKey: string): boolean {
  return storageKey.startsWith(INLINE_PREFIX);
}

function mimeForExt(storageKey: string): AllowedImageMime {
  const lower = storageKey.toLowerCase();
  if (lower.endsWith(".png")) return "image/png" as AllowedImageMime;
  if (lower.endsWith(".webp")) return "image/webp" as AllowedImageMime;
  return "image/jpeg" as AllowedImageMime;
}

function buildInlineStorageKey(
  mime: AllowedImageMime,
  bytes: Buffer,
): string {
  return `${INLINE_PREFIX}${mime};base64,${bytes.toString("base64")}`;
}

function decodeInlineStorageKey(storageKey: string): Buffer {
  const match = INLINE_KEY_RE.exec(storageKey);
  if (!match) {
    throw new Error("Geçersiz medya anahtarı.");
  }
  return Buffer.from(match[2], "base64");
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

/**
 * Baytı saklar ve KAYDA YAZILACAK anahtarı döndürür.
 *
 * `fs` kipinde dönen değer verilen anahtardır (eski davranış birebir aynı).
 * `inline` kipinde diske hiçbir şey yazılmaz ve dönen değer baytı taşıyan
 * `data:` URL'dir. Çağıran, kayda DÖNEN anahtarı yazmalıdır.
 */
export async function writeOfferMediaFile(
  storageKey: string,
  bytes: Buffer,
): Promise<string> {
  if (resolveOfferMediaStorageMode() === "inline") {
    // Anahtar biçimi yine doğrulansın: geçersiz id ile buraya gelinmesin.
    resolveSafePath(storageKey);
    return buildInlineStorageKey(mimeForExt(storageKey), bytes);
  }
  const full = resolveSafePath(storageKey);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
  return storageKey;
}

export async function readOfferMediaFile(storageKey: string) {
  if (isInlineOfferMediaKey(storageKey)) {
    return decodeInlineStorageKey(storageKey);
  }
  return readFile(resolveSafePath(storageKey));
}

export async function deleteOfferMediaFile(storageKey: string) {
  if (isInlineOfferMediaKey(storageKey)) {
    // Bayt kaydın kendi içinde; kayıt silinince bayt da gider.
    return;
  }
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
