import { createHmac } from "node:crypto";

import { prisma } from "@/lib/prisma";

/**
 * ŞİFRE DÖNEMİ — ŞEMA DEĞİŞTİRMEDEN OTURUM GEÇERSİZLEŞTİRME (2026-09-15).
 *
 * Ölçülen kusur: şifre sıfırlama ve şifre değiştirme, MEVCUT OTURUMLARI
 * DÜŞÜRMÜYORDU. Oturum stratejisi JWT ve ömrü 30 gün; hiçbir yerde şifreyle
 * karşılaştırılmıyordu. Sonuç şuydu: hesabı ele geçirilmiş bir kullanıcı
 * şifresini sıfırlasa bile saldırganın oturumu 30 güne kadar çalışmaya devam
 * ediyordu — sıfırlamanın var oluş sebebi tam olarak bu senaryodur.
 * `change-password.ts` de `requiresReLogin: true` dönüyordu ama sunucuda
 * hiçbir şey bunu zorlamıyordu; söz veriliyor, tutulmuyordu.
 *
 * YENİ KOLON AÇILMADI. Şifre özetinin KENDİSİ zaten bir sürüm damgasıdır:
 * `hashPassword` her çağrıda 16 baytlık yeni bir tuz üretir, dolayısıyla
 * şifre her değiştiğinde özet mutlaka değişir. Jetona özetin kendisi değil,
 * ondan türeyen kısa bir HMAC parmak izi konur; her yenilemede veritabanındaki
 * güncel özetin parmak iziyle karşılaştırılır. Uyuşmuyorsa oturum ölmüştür.
 *
 * YALNIZ ŞİFRELİ HESAPLARI İLGİLENDİRİR. Yalnız sosyal girişle açılmış bir
 * hesabın şifresi yoktur; onlarda bu kontrol hiç çalışmaz ve fazladan sorgu
 * da yapılmaz.
 *
 * HATADA AÇIK KALIR, UYUŞMAZLIKTA KAPANIR. Veritabanı okunamıyorsa oturum
 * düşürülmez. Bilinçli bir tercih: tehdit modeli "çalınmış oturum"dur ve bir
 * veritabanı kesintisinde saldırgana birkaç dakika daha vermek, kesinti
 * boyunca BÜTÜN kullanıcıları dışarı atmaktan çok daha az zararlıdır. Kesin
 * bir uyuşmazlık ise her zaman oturumu kapatır.
 */

export type PasswordEpochCheck =
  | { state: "no_password" }
  | { state: "match" }
  | { state: "mismatch" }
  | { state: "unavailable" };

function secret(): string | null {
  const value = process.env.NEXTAUTH_SECRET?.trim();
  return value && value.length >= 16 ? value : null;
}

/** Şifre özetinin kısa parmak izi. Ham özet ASLA jetona girmez. */
export function passwordEpoch(passwordHash: string | null): string | null {
  if (!passwordHash) return null;
  const key = secret();
  if (!key) return null;
  return createHmac("sha256", key)
    .update(`epoch:${passwordHash}`)
    .digest("base64url")
    .slice(0, 16);
}

/** Tek ve dar bir birincil anahtar okuması — yalnız `passwordHash`. */
export async function readPasswordEpoch(
  userId: string,
): Promise<string | null | "unavailable"> {
  if (!userId) return null;
  try {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    return passwordEpoch(row?.passwordHash ?? null);
  } catch {
    return "unavailable";
  }
}

/**
 * Jetondaki dönem hâlâ geçerli mi? Jetonda dönem yoksa (sosyal giriş ya da
 * bu özellikten önce açılmış oturum) kontrol çalışmaz.
 */
export async function checkPasswordEpoch(input: {
  userId: string;
  tokenEpoch: string | undefined;
}): Promise<PasswordEpochCheck> {
  if (!input.tokenEpoch) return { state: "no_password" };
  const current = await readPasswordEpoch(input.userId);
  if (current === "unavailable") return { state: "unavailable" };
  if (current === null) {
    /* Şifre kaldırılmış (yalnız sosyal girişe dönmüş): eski şifreye bağlı
       oturum artık bir şey kanıtlamıyor, kapatılır. */
    return { state: "mismatch" };
  }
  return current === input.tokenEpoch ? { state: "match" } : { state: "mismatch" };
}
