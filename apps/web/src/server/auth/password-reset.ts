import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { createSubsystemLogger } from "@/lib/observability/logger";
import { prisma } from "@/lib/prisma";
import {
  resolveAppBaseUrl,
  sendEmail,
} from "@/server/email/email-transport";

/**
 * ŞİFRE SIFIRLAMA — VERİTABANI TABLOSU OLMADAN (2026-09-15).
 *
 * Ölçülen kusur: `src/app/api/auth/` altında yalnız `[...nextauth]`,
 * `providers-status` ve `register` vardı. Şifresini unutan ücretli bir
 * aboneyi hesabına döndürecek HİÇBİR self-servis yol yoktu; destek
 * veritabanına elle müdahale etmek zorundaydı.
 *
 * NEDEN TABLO YOK. Bir `PasswordResetToken` tablosu migration ister;
 * lansman arifesinde üretim şeması değiştirmek gereksiz risktir. Aynı
 * güvenceler imzalı jetonla elde edilir:
 *
 *   - SÜRELİ: bitiş zamanı jetonun içindedir ve imzalıdır.
 *   - TEK KULLANIMLIK (fiilen): jeton, kullanıcının O ANKİ şifre özetinin
 *     parmak izini taşır. Şifre değişir değişmez parmak izi değişir ve
 *     jeton kendiliğinden ölür. Aynı bağlantı ikinci kez çalışmaz.
 *   - OTURUM DEĞİŞİMİNE DUYARLI: parmak izi `passwordHash` üzerinden
 *     türediği için, kullanıcı bu arada şifresini kendi değiştirirse
 *     yoldaki sıfırlama bağlantısı da geçersiz olur.
 *
 * FAIL-CLOSED. `NEXTAUTH_SECRET` yoksa jeton ÜRETİLMEZ ve DOĞRULANMAZ.
 * Depoda başka bir yerde görülen "sır yoksa sabit kullan" kalıbı burada
 * BİLİNÇLİ OLARAK tekrarlanmaz: sabitle imzalanan bir sıfırlama jetonu,
 * kaynak koda erişen herkesin herkesin hesabını ele geçirmesi demektir.
 *
 * KULLANICI SAYIMI SIZDIRILMAZ. `requestPasswordReset` e-posta kayıtlı
 * olsun olmasın AYNI sonucu döner; çağıran da aynı mesajı gösterir.
 */

const log = createSubsystemLogger("auth.password-reset");

/** Bağlantı bu süre sonunda ölür. Kısa tutulur: e-posta kutusu da bir yüzeydir. */
const TOKEN_TTL_MS = 60 * 60 * 1000;

const TOKEN_VERSION = "v1";

export class PasswordResetError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "PasswordResetError";
  }
}

function signingSecret(): string | null {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  return secret && secret.length >= 16 ? secret : null;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Şifre özetinin kısa parmak izi — ham özet jetona GİRMEZ. */
function passwordFingerprint(passwordHash: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`pw:${passwordHash}`)
    .digest("base64url")
    .slice(0, 22);
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function issuePasswordResetToken(input: {
  userId: string;
  passwordHash: string;
  now?: number;
}): string | null {
  const secret = signingSecret();
  if (!secret) {
    log.error("auth.password_reset.secret_missing", {
      outcome: "failure",
      context: { stage: "issue" },
    });
    return null;
  }
  const expiresAt = (input.now ?? Date.now()) + TOKEN_TTL_MS;
  const payload = [
    TOKEN_VERSION,
    input.userId,
    String(expiresAt),
    passwordFingerprint(input.passwordHash, secret),
  ].join(":");
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

type VerifiedToken = { userId: string; fingerprint: string };

function verifyToken(token: string, now: number): VerifiedToken | null {
  const secret = signingSecret();
  if (!secret) return null;

  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const encoded = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!safeEqual(signature, sign(encoded, secret))) return null;

  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const [version, userId, expiresAtRaw, fingerprint] = payload.split(":");
  if (version !== TOKEN_VERSION || !userId || !expiresAtRaw || !fingerprint) {
    return null;
  }
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;

  return { userId, fingerprint };
}

/**
 * SIFIRLAMA TALEBİ. Dönüş değeri e-postanın kayıtlı olup olmadığına göre
 * DEĞİŞMEZ — aksi hâlde bu uç nokta bir kullanıcı sayım aracına dönerdi.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, email: true, name: true, passwordHash: true, status: true },
  });

  /* Şifresiz (yalnız sosyal giriş) hesaba sıfırlama gönderilmez: sıfırlanacak
     bir şifre yoktur ve göndermek, var olmayan bir yolu varmış gibi gösterir. */
  if (!user?.passwordHash || !user.email || user.status === "DELETED") {
    log.info("auth.password_reset.requested", {
      outcome: "skipped",
      context: {
        reason: user ? "no_password_credential" : "unknown_email",
        recipientDomain: normalized.split("@")[1] ?? "?",
      },
    });
    return;
  }

  const token = issuePasswordResetToken({
    userId: user.id,
    passwordHash: user.passwordHash,
  });
  if (!token) return;

  const url = `${resolveAppBaseUrl()}/sifre-sifirla?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    subject: "Talepo şifre sıfırlama",
    text: [
      `Merhaba${user.name ? ` ${user.name}` : ""},`,
      "",
      "Talepo hesabınızın şifresini sıfırlamak için aşağıdaki bağlantıyı açın:",
      url,
      "",
      "Bağlantı 1 saat geçerlidir ve yalnız bir kez kullanılabilir.",
      "Bu talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz; şifreniz değişmez.",
      "",
      "—",
      "Talepo",
    ].join("\n"),
  });

  log.info("auth.password_reset.requested", {
    outcome: "success",
    context: { recipientDomain: user.email.split("@")[1] ?? "?" },
  });
}

/** Sıfırlamayı tamamlar. Jeton geçersizse tek ve aynı hata döner. */
export async function completePasswordReset(input: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  const invalid = new PasswordResetError(
    "Bağlantı geçersiz veya süresi dolmuş. Yeni bir sıfırlama bağlantısı isteyin.",
    400,
  );

  const verified = verifyToken(input.token ?? "", Date.now());
  if (!verified) throw invalid;

  if (input.newPassword !== input.confirmPassword) {
    throw new PasswordResetError("Şifreler eşleşmiyor.");
  }
  const strengthError = validatePasswordStrength(input.newPassword);
  if (strengthError) throw new PasswordResetError(strengthError);

  const user = await prisma.user.findUnique({
    where: { id: verified.userId },
    select: { id: true, passwordHash: true, status: true },
  });
  if (!user?.passwordHash || user.status === "DELETED") throw invalid;

  const secret = signingSecret();
  if (!secret) throw invalid;

  /* TEK KULLANIMLIK KAPISI. Parmak izi o anki şifreden türer; şifre bir kez
     değiştiyse aynı bağlantı bir daha açılmaz. */
  if (!safeEqual(verified.fingerprint, passwordFingerprint(user.passwordHash, secret))) {
    throw invalid;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(input.newPassword) },
    select: { id: true },
  });

  log.info("auth.password_reset.completed", {
    outcome: "success",
    context: { correlation: randomUUID() },
  });
}
