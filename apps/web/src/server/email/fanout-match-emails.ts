import { createSubsystemLogger } from "@/lib/observability/logger";
import { prisma } from "@/lib/prisma";

import {
  deliverNotificationEmail,
  EMAIL_CRITICAL_NOTIFICATION_TYPES,
} from "./deliver-notification-email";
import { resolveEmailTransportConfig } from "./email-transport";

/**
 * EŞLEŞEN TALEP E-POSTASI — TEDARİKÇİYE DIŞARIDAN ULAŞAN İLK KANAL
 * (2026-09-16, Dinçer'in kararı: "E-postayı bağla").
 *
 * O güne kadar dağıtım yalnız iki şey yazıyordu: `RequestMatch` satırı ve
 * panel içi `NEW_REQUEST_MATCH` bildirimi. Dışarı çıkan hiçbir kanal yoktu;
 * paneli açmayan tedarikçi hiçbir şey öğrenmiyordu. Para veren tedarikçinin
 * sessizce atlanmaması sözleşmesi, tedarikçinin paneli açmasına bağlıydı.
 *
 * BU MODÜL İKİNCİ BİR BİLDİRİM MOTORU DEĞİLDİR. Dağıtımın yazdığı bildirim
 * satırları aynen alınır ve her biri için e-posta görünümü denenir; kime ne
 * gideceğine burada karar verilmez. Bu yüzden panel içi bildirimin metni ile
 * e-postanın metni birebir aynıdır ve birbirinden ayrışamaz.
 *
 * SAĞLAYICI YOKSA TEK SATIR. `deliverNotificationEmail` her çağrıda
 * "unconfigured" uyarısı yazar; yüz alıcılı bir dağıtımda yüz satır olurdu.
 * Yapılandırma burada BİR kez okunur; yoksa hiç alıcı sorgulanmaz ve tek bir
 * "skipped" satırı yazılır. Sessiz başarı uydurulmaz: dönüşte `skipped`
 * sayısı ile nedeni durur.
 *
 * ANA AKIŞI KIRAMAZ. Dağıtım bunu `void` çağırır; bu fonksiyon hiçbir
 * durumda fırlatmaz. Bir sağlayıcı hatası ya da bozuk bir alıcı adresi
 * yalnız o alıcıyı düşürür, kalanı gider.
 *
 * ÜST SINIR. Tek dağıtımda en fazla `MAX_EMAILS_PER_FANOUT` e-posta
 * gönderilir; sınıra dayanıldığı logda görünür. Gönderim `CONCURRENCY`
 * kadar paralel koşar — sağlayıcı zaman aşımı 15 sn olduğundan yüz alıcıyı
 * sırayla göndermek dakikalar sürerdi.
 *
 * PII LOGLANMAZ. Sayılar loglanır; adres, ad, talep başlığı loglanmaz.
 *
 * DAĞITIMIN VERİ ERİŞİM YÜZEYİNE DOKUNMAZ. Alıcı adresleri burada okunur;
 * `distribute-request.ts` yeni bir Prisma çağrısı kazanmaz (o yüzey
 * `verify-fanout-telemetry-v1` ile mühürlüdür).
 */

const log = createSubsystemLogger("email.match-fanout");

export const MAX_EMAILS_PER_FANOUT = 200;
const CONCURRENCY = 5;

export type MatchNotificationRow = {
  userId: string;
  type: string;
  title: string;
  message: string;
  actionUrl: string;
};

export type MatchEmailFanoutResult = {
  attempted: number;
  delivered: number;
  failed: number;
  skipped: number;
  skippedReason: "none" | "unconfigured" | "no_rows" | "error";
  capped: boolean;
};

export async function deliverMatchEmails(input: {
  requestId: string;
  notifications: MatchNotificationRow[];
}): Promise<MatchEmailFanoutResult> {
  const rows = input.notifications.filter((n) =>
    EMAIL_CRITICAL_NOTIFICATION_TYPES.has(n.type),
  );
  if (rows.length === 0) {
    return {
      attempted: 0,
      delivered: 0,
      failed: 0,
      skipped: 0,
      skippedReason: "no_rows",
      capped: false,
    };
  }

  if (!resolveEmailTransportConfig()) {
    log.warn("email.match_fanout.skipped", {
      outcome: "skipped",
      requestId: input.requestId,
      context: { reason: "unconfigured", recipientCount: rows.length },
    });
    return {
      attempted: 0,
      delivered: 0,
      failed: 0,
      skipped: rows.length,
      skippedReason: "unconfigured",
      capped: false,
    };
  }

  try {
    const capped = rows.length > MAX_EMAILS_PER_FANOUT;
    const batch = capped ? rows.slice(0, MAX_EMAILS_PER_FANOUT) : rows;

    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(batch.map((r) => r.userId))] } },
      select: { id: true, email: true },
    });
    const emailById = new Map(users.map((u) => [u.id, u.email]));

    let delivered = 0;
    let failed = 0;

    /* Sınırlı paralellik: aynı anda en fazla CONCURRENCY gönderim. */
    let cursor = 0;
    const worker = async () => {
      while (cursor < batch.length) {
        const row = batch[cursor++]!;
        try {
          const result = await deliverNotificationEmail({
            recipientEmail: emailById.get(row.userId),
            notificationType: row.type,
            title: row.title,
            message: row.message,
            actionPath: row.actionUrl,
          });
          if (result.delivered) delivered += 1;
          else failed += 1;
        } catch {
          failed += 1;
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, batch.length) }, worker),
    );

    log.info("email.match_fanout.completed", {
      outcome: failed === 0 ? "success" : "failure",
      requestId: input.requestId,
      context: {
        attempted: batch.length,
        delivered,
        failed,
        capped,
        droppedByCap: capped ? rows.length - batch.length : 0,
      },
    });

    return {
      attempted: batch.length,
      delivered,
      failed,
      skipped: capped ? rows.length - batch.length : 0,
      skippedReason: "none",
      capped,
    };
  } catch (error) {
    log.warn("email.match_fanout.failed", {
      outcome: "failure",
      requestId: input.requestId,
      context: {
        errorName: error instanceof Error ? error.name : "unknown",
        recipientCount: rows.length,
      },
    });
    return {
      attempted: 0,
      delivered: 0,
      failed: rows.length,
      skipped: 0,
      skippedReason: "error",
      capped: false,
    };
  }
}
