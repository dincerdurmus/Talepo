/** Browser-side image compression to a JPEG data URL. */

export async function compressImageToDataUrl(
  file: File,
  options: {
    maxWidth: number;
    maxHeight: number;
    quality?: number;
    maxBytes?: number;
  },
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Yalnızca görsel dosyaları yüklenebilir.");
  }

  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(
    1,
    options.maxWidth / bitmap.width,
    options.maxHeight / bitmap.height,
  );
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Görsel işlenemedi.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = options.quality ?? 0.82;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  const maxBytes = options.maxBytes ?? 320_000;

  while (dataUrl.length > maxBytes && quality > 0.45) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  if (dataUrl.length > maxBytes) {
    throw new Error("Görsel sıkıştırılamadı. Daha küçük bir dosya seçin.");
  }

  return dataUrl;
}
