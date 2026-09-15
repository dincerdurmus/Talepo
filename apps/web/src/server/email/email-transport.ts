import { createSubsystemLogger } from "@/lib/observability/logger";

/**
 * E-POSTA TAŞIYICI — TEK ÇIKIŞ NOKTASI (2026-09-15).
 *
 * Ölçülen kusur: `deliver-notification-email.ts` sağlayıcı dalı hiç
 * yazılmamıştı; `EMAIL_PROVIDER` ayarlı olsa bile her çağrı
 * `provider_not_implemented` yazıp `PROVIDER_ERROR` dönüyordu. Sonuç:
 * "teklifiniz kabul edildi", "firma daveti" ve "işlem tamamlandı" dahil
 * HİÇBİR e-posta kimseye ulaşmıyordu. Platformu birkaç gün açmayan alıcı,
 * teklifinin kabul edildiğini hiçbir zaman öğrenmiyordu.
 *
 * BAĞIMLILIK EKLENMEDİ. Her iki sağlayıcı da düz REST; `fetch` yeter.
 * `npm install` bir onay kapısıdır ve lansman öncesi lockfile'ı
 * değiştirmek gereksiz risktir.
 *
 * SIR LOGLANMAZ. API anahtarı hiçbir log satırına, hiçbir hata mesajına
 * girmez; alıcı adresi de PII'dir, yalnız alan adı loglanır.
 *
 * SESSİZ BAŞARI UYDURULMAZ. Yapılandırma eksikse ya da sağlayıcı hata
 * dönerse çağıran bunu tip üzerinden görür; `true` uydurulmaz.
 */

const log = createSubsystemLogger("email.transport");

/** Sağlayıcı bu sürede cevap vermezse teslim başarısız sayılır. */
const SEND_TIMEOUT_MS = 15000;

export type EmailTransportResult =
  | { sent: true; provider: string }
  | { sent: false; reason: "UNCONFIGURED" | "PROVIDER_ERROR" };

export type OutgoingEmail = {
  to: string;
  subject: string;
  /** Düz metin gövde — her istemcide okunur, tek zorunlu gövde. */
  text: string;
  /** İsteğe bağlı HTML gövde; yoksa yalnız düz metin gönderilir. */
  html?: string;
};

type TransportConfig = {
  provider: "resend" | "brevo";
  apiKey: string;
  fromEmail: string;
  fromName: string;
};

/**
 * Yapılandırma TAM olmalıdır. Yarım yapılandırma (anahtar var, gönderen
 * adresi yok) sessizce çalışmaz duruma düşmesin diye burada eksik sayılır
 * ve nedeni tek satırda loglanır.
 */
export function resolveEmailTransportConfig(): TransportConfig | null {
  const provider = (process.env.EMAIL_PROVIDER ?? "").trim().toLowerCase();
  if (provider !== "resend" && provider !== "brevo") return null;

  const apiKey = (process.env.EMAIL_API_KEY ?? "").trim();
  const fromEmail = (process.env.EMAIL_FROM ?? "").trim();
  if (!apiKey || !fromEmail) return null;

  const fromName = (process.env.EMAIL_FROM_NAME ?? "Talepo").trim() || "Talepo";
  return { provider, apiKey, fromEmail, fromName };
}

/**
 * Uygulamanın kendi mutlak adresi — e-postadaki bağlantılar için.
 * Sıra bilinçlidir: açık beyan, sonra platformun enjekte ettiği değer.
 */
export function resolveAppBaseUrl(): string {
  const explicit =
    process.env.APP_BASE_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}

function recipientDomain(address: string): string {
  return address.split("@")[1] ?? "?";
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<{ ok: boolean; status: number }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  return { ok: response.ok, status: response.status };
}

export async function sendEmail(
  message: OutgoingEmail,
): Promise<EmailTransportResult> {
  const config = resolveEmailTransportConfig();
  if (!config) {
    log.warn("email.transport.unconfigured", {
      outcome: "skipped",
      context: { recipientDomain: recipientDomain(message.to) },
    });
    return { sent: false, reason: "UNCONFIGURED" };
  }

  try {
    const result =
      config.provider === "resend"
        ? await postJson(
            "https://api.resend.com/emails",
            { Authorization: `Bearer ${config.apiKey}` },
            {
              from: `${config.fromName} <${config.fromEmail}>`,
              to: [message.to],
              subject: message.subject,
              text: message.text,
              ...(message.html ? { html: message.html } : {}),
            },
          )
        : await postJson(
            "https://api.brevo.com/v3/smtp/email",
            { "api-key": config.apiKey },
            {
              sender: { email: config.fromEmail, name: config.fromName },
              to: [{ email: message.to }],
              subject: message.subject,
              textContent: message.text,
              ...(message.html ? { htmlContent: message.html } : {}),
            },
          );

    if (!result.ok) {
      /* Sağlayıcı gövdesi okunmaz ve loglanmaz: hata metni alıcı adresini
         yankılayabilir ve PII sızdırabilir. Durum kodu teşhis için yeter. */
      log.error("email.transport.rejected", {
        outcome: "failure",
        context: {
          provider: config.provider,
          status: result.status,
          recipientDomain: recipientDomain(message.to),
        },
      });
      return { sent: false, reason: "PROVIDER_ERROR" };
    }

    log.info("email.transport.sent", {
      outcome: "success",
      context: {
        provider: config.provider,
        recipientDomain: recipientDomain(message.to),
      },
    });
    return { sent: true, provider: config.provider };
  } catch (error) {
    /* Zaman aşımı ve ağ hatası dahil. Hata NESNESİ loglanmaz — anahtar
       taşıyan istek nesnesine referans verebilir; yalnız adı yazılır. */
    log.error("email.transport.failed", {
      outcome: "failure",
      context: {
        provider: config.provider,
        errorName: error instanceof Error ? error.name : "unknown",
        recipientDomain: recipientDomain(message.to),
      },
    });
    return { sent: false, reason: "PROVIDER_ERROR" };
  }
}
