/**
 * Doğrulayıcıların veritabanına YAZMASINI mekanizmayla engelleyen kapı
 * (kurucu, 2026-08-23).
 *
 * NEDEN VAR — somut olay, konvansiyon değil:
 * `apps/web/.env` bugün **Tuğrul ile ortak kullanılan Supabase pooler'ına**
 * bakıyor. `verify-request-publish-v1` sahte bir alıcıyla **gerçek `Request`
 * satırları oluşturup siliyor**; başka beş doğrulayıcı da gerçek prisma
 * istemcisiyle yazma çağrıları içeriyor. Veritabanı 2026-08-23 sabahına kadar
 * kapalıydı (ECONNREFUSED), bu yüzden bu yazımlar sessizce başarısız oluyordu
 * ve kimse fark etmedi. Veritabanı **artık açık**. Yani bugüne kadar bizi
 * koruyan şey bir kural değil, bir arızaydı.
 *
 * "Dikkatli olalım" bir mekanizma değildir. Kapı üç koşulu birden arar; biri
 * eksikse bağlantı DENENMEDEN çıkılır ve sonuç NOT-MEASURED olur — çünkü
 * ölçmemek, ortak veriye yazmaktan iyidir ve "ölçemedim" ile "ölçtüm, bozuk"
 * asla aynı renge boyanmaz (bkz. not-measured.ts).
 *
 * Davranışı verify-understanding-invariants-v1 (I15) sınar.
 */

/** 1) Açık niyet bayrağı. Varsayılan: yazma yok. */
const ALLOW_FLAG = "TALEPO_VERIFY_ALLOW_DB";

/**
 * 2) Pozitif kontrol — host bir TEST hedefi kalıbına uymalı.
 * Allowlist bilerek dar: bilmediğimiz bir host asla test sayılmaz.
 */
const ALLOWED_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\.0\.0\.1$/,
  /^\[?::1\]?$/,
  /^host\.docker\.internal$/i,
  /(^|[.\-_])test([.\-_]|$)/i,
  /(^|[.\-_])staging([.\-_]|$)/i,
];

/**
 * 3) Negatif kontrol — açık isim listesi. Pozitif kontrol yanlışlıkla
 * eşleşse bile (ör. birinin projesinin adında "test" geçmesi) bunlar keser.
 * Ortak/üretim hedefleri burada ADIYLA durur ki gözden kaçmasın.
 */
const FORBIDDEN_HOST_FRAGMENTS: string[] = [
  "pooler.supabase.com", // Tuğrul ile ortak Supabase (2026-08-23 itibarıyla .env hedefi)
  "supabase.co",
  "supabase.in",
  "rds.amazonaws.com",
  "neon.tech",
  "prod",
  "production",
  "canli",
  "canlı",
];

export type DbGuardVerdict =
  | { allowed: true; host: string }
  | { allowed: false; reason: string };

/** postgres URL'inden host — ayrıştırılamazsa null (ve kapı kapalı kalır). */
export function databaseHost(url: string | undefined | null): string | null {
  if (!url || !url.trim()) return null;
  try {
    return new URL(url.trim()).hostname || null;
  } catch {
    // URL ayrıştırılamıyorsa host'u BİLMİYORUZ demektir; tahmin etmeyiz.
    return null;
  }
}

/**
 * Doğrulayıcı bu veritabanına yazabilir mi?
 *
 * Üç koşul da sağlanmadıkça `allowed:false` döner. Bu fonksiyon **ağa
 * çıkmaz, bağlanmaz** — yalnız yapılandırmaya bakar.
 */
export function canWriteToDatabase(
  env: Record<string, string | undefined> = process.env,
): DbGuardVerdict {
  if (env[ALLOW_FLAG]?.trim() !== "1") {
    return {
      allowed: false,
      reason: `${ALLOW_FLAG}=1 verilmedi — doğrulayıcı veritabanına yazmaz (varsayılan güvenli)`,
    };
  }

  const url = env.DATABASE_URL?.trim() || env.DIRECT_URL?.trim();
  const host = databaseHost(url);
  if (!host) {
    return {
      allowed: false,
      reason:
        "DATABASE_URL/DIRECT_URL yok ya da host ayrıştırılamadı — bilinmeyen hedefe yazılmaz",
    };
  }

  const lower = host.toLowerCase();
  const forbidden = FORBIDDEN_HOST_FRAGMENTS.find((f) => lower.includes(f));
  if (forbidden) {
    return {
      allowed: false,
      reason: `host '${host}' yasak listede ('${forbidden}') — ortak/üretim veritabanına doğrulayıcı yazamaz`,
    };
  }

  if (!ALLOWED_HOST_PATTERNS.some((p) => p.test(host))) {
    return {
      allowed: false,
      reason: `host '${host}' test kalıbına uymuyor — yalnız localhost / *test* / *staging* hedeflerine yazılır`,
    };
  }

  return { allowed: true, host };
}
