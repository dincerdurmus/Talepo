import { createSubsystemLogger } from "@/lib/observability/logger";

/**
 * E-POSTA TESLİM SINIRI (Launch Hardening, 2026-09-01).
 *
 * Bu modül İKİNCİ bir bildirim motoru DEĞİLDİR: e-posta, kanonik in-app
 * Notification kaydının yalnız başka bir görünümüdür. Kimin neyi alacağına
 * bildirim üreticileri karar verir; burada yalnız TESLİM edilir.
 *
 * SÖZLEŞME:
 *  - Sağlayıcı yapılandırılmadıysa SESSİZCE başarı UYDURULMAZ: çağrı
 *    `{ delivered: false, reason: "EMAIL_PROVIDER_UNCONFIGURED" }` döner ve
 *    yapılandırılmış tek bir ops-log satırı bırakır (secret loglanmaz).
 *  - Teslim hatası ana ürün akışını ASLA kıramaz; çağıranlar non-blocking
 *    çağırır (alarm-teslim kalıbı).
 *  - Yalnız KRİTİK aileler e-postaya bağlanır (hesap/güvenlik, firma
 *    daveti, teklif kabulü, ödeme/abonelik) — her in-app bildirim e-posta
 *    olmaz; ürün gürültüsü yaratılmaz.
 *  - Gerçek sağlayıcı anahtarı EXTERNAL_PRODUCTION_DEPENDENCY'dir;
 *    aktivasyon = EMAIL_PROVIDER + ilgili anahtarların prod ortamına
 *    girilmesi ve buradaki tek `send` dalının doldurulması.
 */

const log = createSubsystemLogger("email.delivery");

export type EmailDeliveryResult =
  | { delivered: true; provider: string }
  | {
      delivered: false;
      reason:
        | "EMAIL_PROVIDER_UNCONFIGURED"
        | "INVALID_RECIPIENT"
        | "PROVIDER_ERROR";
    };

export type NotificationEmailInput = {
  /** Kanonik Notification kaydından türetilen alanlar — ikinci içerik kaynağı yok. */
  recipientEmail: string | null | undefined;
  notificationType: string;
  title: string;
  message: string;
  /** Mutlak URL üretimi çağıranın işi değildir; path taşınır. */
  actionPath?: string | null;
};

/** Kritik aile listesi — e-postaya bağlanan tek küme (gürültü sözleşmesi). */
export const EMAIL_CRITICAL_NOTIFICATION_TYPES = new Set([
  "OFFER_ACCEPTED",
  "COMPANY_INVITATION",
  "DEAL_COMPLETED",
]);

function emailProviderId(): string | null {
  const id = (process.env.EMAIL_PROVIDER ?? "").trim().toLowerCase();
  return id.length > 0 ? id : null;
}

function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function deliverNotificationEmail(
  input: NotificationEmailInput,
): Promise<EmailDeliveryResult> {
  const recipient = (input.recipientEmail ?? "").trim();
  if (!recipient || !isPlausibleEmail(recipient)) {
    return { delivered: false, reason: "INVALID_RECIPIENT" };
  }
  if (!EMAIL_CRITICAL_NOTIFICATION_TYPES.has(input.notificationType)) {
    // Kritik aile dışı: bilinçli olarak e-posta üretilmez (gürültü yok).
    return { delivered: false, reason: "EMAIL_PROVIDER_UNCONFIGURED" };
  }

  const provider = emailProviderId();
  if (!provider) {
    log.warn("email.delivery.unconfigured", {
      outcome: "skipped",
      context: {
        notificationType: input.notificationType,
        // Alıcı PII'si loglanmaz; yalnız alan adı ops teşhisi için yeter.
        recipientDomain: recipient.split("@")[1] ?? "?",
      },
    });
    return { delivered: false, reason: "EMAIL_PROVIDER_UNCONFIGURED" };
  }

  /**
   * Gerçek sağlayıcı dalı — EXTERNAL AKTİVASYON noktası. Anahtarlar prod
   * ortamına girildiğinde buraya tek adapter eklenir; sözleşme (dönüş tipi,
   * non-blocking çağrım, PII loglamama) değişmez.
   */
  log.error("email.delivery.provider_not_implemented", {
    outcome: "failure",
    context: { provider, notificationType: input.notificationType },
  });
  return { delivered: false, reason: "PROVIDER_ERROR" };
}
