/**
 * TALEPTE İLETİŞİM BİLGİSİ — UYARI, ENGEL DEĞİL (kurucu kararı D-0031).
 *
 * Kurucu kararı (2026-09-23): talepte iletişim bilgisi ENGELLENMEZ.
 * Kullanıcı uyarılır, sonucu söylenir ve seçim ona bırakılır.
 *
 * NEDEN ENGEL DEĞİL. Talebin anonim kalması Talepo'nun kullanıcıya verdiği
 * bir HİZMETTİR, dayattığı bir kural değil. Kendi numarasını yazmak isteyen
 * bir kullanıcının talebini reddetmek, ona kendi bilgisini paylaşma hakkını
 * tanımamak olurdu. Ama sonucu bilmeden seçemez — bu yüzden uyarı net ve
 * sonuç odaklıdır.
 *
 * NE LOGLANIR. Yalnız SEÇİMİN TÜRÜ (kaldırdı / bıraktı) ve bulunan bilginin
 * TÜRÜ (telefon / e-posta / IBAN / sosyal hesap). İletişim bilgisinin
 * KENDİSİ hiçbir olaya, loga ya da rapora girmez.
 */
import type { ContactInfoKind } from "@/lib/membership/contact-filter";

export type ContactChoice = "REMOVED" | "KEPT";

/** Kurucunun yazdığı metin — değiştirilmeden kullanılır. */
export const CONTACT_IN_REQUEST_NOTICE =
  "Talebinize iletişim bilginizi yazdınız. Bu hâliyle talebiniz anonim olmaktan " +
  "çıkar ve talebi gören herkes iletişim bilginize erişebilir. Talepo normalde " +
  "bunu sizin için gizler.";

export const CONTACT_REMOVE_ACTION_LABEL = "Kaldır";
export const CONTACT_KEEP_ACTION_LABEL = "Kalsın";

/**
 * İstemciden gelen seçimi güvenli biçimde oku.
 *
 * TANINMAYAN DEĞER "KALDIR"a DÜŞER. Sebep: bu dalın tek riskli sonucu,
 * kullanıcının GÖRMEDİĞİ bir uyarıdan sonra iletişim bilgisinin yayına
 * çıkmasıdır. Eski bir istemci, doğrudan bir API çağrısı ya da bozuk bir
 * gövde geldiğinde varsayılanın güvenli tarafta olması gerekir; "bıraktı"
 * yalnız kullanıcı AÇIKÇA öyle dediğinde olur.
 */
export function parseContactChoice(raw: unknown): ContactChoice {
  return raw === "KEPT" ? "KEPT" : "REMOVED";
}

/** Analitik olayına giden yük — iletişim bilgisinin kendisi asla yok. */
export function contactChoiceTelemetry(input: {
  choice: ContactChoice;
  kinds: readonly ContactInfoKind[];
}): { choice: ContactChoice; kinds: string } {
  return { choice: input.choice, kinds: [...input.kinds].sort().join(",") };
}
