import { createHmac, timingSafeEqual } from "crypto";

const lifetimeMs = 10 * 60_000;

function secret() {
  const value = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!value) throw new Error("Support talep erişimi için uygulama imza anahtarı tanımlı değil.");
  return value;
}

export function createSupportRequestAccessToken(userId: string, requestId: string) {
  const expiresAt = Date.now() + lifetimeMs;
  const payload = `${userId}.${requestId}.${expiresAt}`;
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function verifySupportRequestAccessToken(token: string | undefined, userId: string, requestId: string) {
  if (!token) return false;
  try {
    const [payload, signature] = Buffer.from(token, "base64url").toString().split(/\.(?=[^.]+$)/);
    const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
    if (!signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    const [tokenUserId, tokenRequestId, expiresAt] = payload.split(".");
    return tokenUserId === userId && tokenRequestId === requestId && Number(expiresAt) > Date.now();
  } catch { return false; }
}
