/**
 * JEV DEMETİNİ İSTEK BAŞINA BİR KEZ ÇEKER — API SINIRI (2026-09-21).
 *
 * NEDEN BURADA. Karar sözleşmesi SENKRONDUR (bkz. jev/jev-provider.ts); bir
 * HTTP servisi senkron olamaz. Çözüm sözleşmeyi Promise'e çevirmek değil,
 * çağrıyı API sınırında BİR KEZ yapıp sonucu senkron sağlayıcıya vermektir.
 * Bu dosya o tek çekim noktasıdır ve YALNIZ sunucuda koşar: anahtar asla
 * istemciye inmez.
 *
 * ÜÇ SESSİZ DÜŞÜŞ, ÜÇÜ DE AYNI SONUCU VERİR (null → yerleşik motor devralır):
 *   1) sağlayıcı geçişi henüz açık değil (`shouldFetchJevBundle()` false),
 *   2) ortamda `TYPESAFE_API_KEY` yok,
 *   3) servis düştü / zaman aşımına uğradı (istemcinin kendi sözleşmesi).
 * Bir karar servisinin düşmesi talebin kaybolması değildir; hiçbir durumda
 * istek başarısız olmaz.
 *
 * ANAHTAR YALNIZ ORTAM DEĞİŞKENİNDE YAŞAR. Ne loglanır, ne demete konur, ne
 * de hata mesajına geçer — çağrı zaten `jev-client` içinde yapılır ve buradan
 * dışarı yalnız kararlar çıkar.
 */
import { fetchJevDecisions } from "@/lib/request-decisions/jev";
import type { JevDecisionBundle } from "@/lib/request-decisions/jev";
import { shouldFetchJevBundle } from "@/lib/request-decisions/get-provider";

export async function resolveJevBundle(
  text: string | null | undefined,
): Promise<JevDecisionBundle | null> {
  if (!shouldFetchJevBundle()) return null;
  const metin = text?.trim();
  if (!metin) return null;
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) return null;
  return fetchJevDecisions(metin, apiKey);
}
