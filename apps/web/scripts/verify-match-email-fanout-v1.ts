/**
 * EŞLEŞEN TALEP E-POSTASI — kalıcı doğrulayıcı (2026-09-16).
 *
 * Kapattığı kusur: dağıtım yalnız RequestMatch satırı ve panel içi bildirim
 * yazıyordu; dışarı çıkan hiçbir kanal yoktu. Paneli açmayan tedarikçi
 * hiçbir şey öğrenmiyordu. Dinçer'in kararıyla NEW_REQUEST_MATCH e-postaya
 * bağlandı.
 *
 * Bu dosya bir SONDA değil KAPIDIR:
 *   A. NEW_REQUEST_MATCH kritik ailededir ve dağıtım createMany'den sonra
 *      e-posta yayılımını AYNI satırlarla, non-blocking çağırır. Panel içi
 *      metin ile e-posta metni ayrışamaz.
 *   B. Sağlayıcı yoksa: hiç alıcı sorgulanmaz, hiç gönderim denenmez, TEK
 *      satır log yazılır (yüz alıcıda yüz satır değil) ve dönüş bunu
 *      "skipped/unconfigured" diye söyler — sessiz başarı yok.
 *   C. Sağlayıcı varsa: her alıcıya bir e-posta, konu = bildirim başlığı,
 *      gövde = bildirim metni + mutlak bağlantı; adresi bozuk alıcı yalnız
 *      kendini düşürür, kalanı gider.
 *   D. Asla fırlatmaz: alıcı sorgusu patlarsa dağıtım etkilenmez.
 *   E. Üst sınır uygulanır ve sınıra dayanıldığı gizlenmez.
 *   F. PII loglanmaz: adres, talep başlığı, kullanıcı kimliği log'a girmez.
 *   G. Dağıtımın veri erişim yüzeyi değişmez (alıcı sorgusu bu modülde).
 */
process.env.DATABASE_URL ??=
  "postgresql://verifier:verifier@127.0.0.1:5432/verifier";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  addLogSink,
  type OperationalLogEvent,
} from "../src/lib/observability/logger";
import { EMAIL_CRITICAL_NOTIFICATION_TYPES } from "../src/server/email/deliver-notification-email";

type PrismaLike = Record<string, unknown>;

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`  ok   ${name}`);
    })
    .catch((error: unknown) => {
      failed++;
      console.log(
        `  FAIL ${name}\n       ${error instanceof Error ? error.message : String(error)}`,
      );
    });
}

const WEB = join(__dirname, "..");
const REQ = "cmreqemail00001";
const BASLIK = "Kadıköy'de 3+1 daire — ali@example.com 05551112233";

function row(userId: string) {
  return {
    userId,
    type: "NEW_REQUEST_MATCH",
    title: "Yeni eşleşen talep",
    message: `“${BASLIK}” talebi firmanızla eşleşti.`,
    actionUrl: `/panel/talepler/${REQ}`,
  };
}

/** Ortam değişkenlerini geçici olarak kurar, sonra eski hâline döndürür. */
function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>) {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  return fn().finally(() => {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { deliverMatchEmails, MAX_EMAILS_PER_FANOUT } = await import(
    "../src/server/email/fanout-match-emails"
  );

  const captured: OperationalLogEvent[] = [];
  const detach = addLogSink((e) => {
    captured.push(e);
  });

  function stubUsers(impl: PrismaLike) {
    const desc = Object.getOwnPropertyDescriptor(prisma as unknown as PrismaLike, "user");
    Object.defineProperty(prisma as unknown as PrismaLike, "user", {
      value: impl,
      configurable: true,
      writable: true,
    });
    return () => {
      if (desc) Object.defineProperty(prisma as unknown as PrismaLike, "user", desc);
      else delete (prisma as unknown as PrismaLike).user;
    };
  }

  /** Sağlayıcıyı stub'lar: gerçek ağ yok, gönderilenler toplanır. */
  const sent: { to: string; subject: string; text: string }[] = [];
  const realFetch = globalThis.fetch;
  function stubProvider(ok = true) {
    sent.length = 0;
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        to?: string[] | { email: string }[];
        subject?: string;
        text?: string;
        textContent?: string;
      };
      const to = Array.isArray(body.to)
        ? typeof body.to[0] === "string"
          ? (body.to[0] as string)
          : (body.to[0] as { email: string }).email
        : "?";
      sent.push({
        to,
        subject: body.subject ?? "",
        text: body.text ?? body.textContent ?? "",
      });
      return new Response(JSON.stringify({ id: "x" }), {
        status: ok ? 200 : 500,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    return () => {
      globalThis.fetch = realFetch;
    };
  }

  const CONFIGURED = {
    EMAIL_PROVIDER: "resend",
    EMAIL_API_KEY: "verifier-only-not-a-real-key",
    EMAIL_FROM: "bildirim@talepo.test",
    APP_BASE_URL: "https://talepo.test",
  };
  const UNCONFIGURED = {
    EMAIL_PROVIDER: undefined,
    EMAIL_API_KEY: undefined,
    EMAIL_FROM: undefined,
  };

  console.log("=== EŞLEŞEN TALEP E-POSTASI ===\n");

  /* ---------------------------------------------------------------- */
  /* A. Bağlantı                                                        */
  /* ---------------------------------------------------------------- */
  await check("NEW_REQUEST_MATCH e-posta kritik ailesinde", () => {
    assert.ok(
      EMAIL_CRITICAL_NOTIFICATION_TYPES.has("NEW_REQUEST_MATCH"),
      "tedarikçiye dışarıdan ulaşan kanal yine yok",
    );
  });

  await check("dağıtım bildirimleri yazdıktan sonra AYNI satırlarla e-postayı çağırır", () => {
    const DIST = readFileSync(
      join(WEB, "src", "server", "request", "distribute-request.ts"),
      "utf8",
    );
    const yaz = DIST.indexOf("prisma.notification.createMany({ data: notifications })");
    assert.ok(yaz >= 0, "bildirim yazımı bulunamadı");
    const sonra = DIST.slice(yaz, yaz + 900);
    assert.ok(
      /void\s+deliverMatchEmails\(\{[\s\S]*?notifications,?[\s\S]*?\}\)/.test(sonra),
      "e-posta yayılımı createMany'den sonra, aynı satırlarla, non-blocking çağrılmıyor",
    );
    /* Alıcı sorgusu dağıtımda DEĞİL; o yüzey mühürlü. */
    assert.ok(
      !/prisma\.user\.findMany/.test(DIST),
      "dağıtım dosyası yeni bir Prisma çağrısı kazanmış — telemetri yüzeyi bozulur",
    );
  });

  /* ---------------------------------------------------------------- */
  /* B. Sağlayıcı yok                                                   */
  /* ---------------------------------------------------------------- */
  await check("sağlayıcı yoksa: sorgu yok, gönderim yok, TEK satır log, dürüst dönüş", async () => {
    await withEnv(UNCONFIGURED, async () => {
      let userQueries = 0;
      const restoreUsers = stubUsers({
        findMany: async () => {
          userQueries++;
          return [];
        },
      });
      const restoreFetch = stubProvider();
      captured.length = 0;
      try {
        const out = await deliverMatchEmails({
          requestId: REQ,
          notifications: Array.from({ length: 40 }, (_, i) => row(`u${i}`)),
        });
        assert.equal(out.skippedReason, "unconfigured");
        assert.equal(out.skipped, 40, "atlanan sayısı dürüst değil");
        assert.equal(out.delivered, 0);
        assert.equal(userQueries, 0, "sağlayıcı yokken alıcı sorgulanıyor");
        assert.equal(sent.length, 0, "sağlayıcı yokken gönderim deneniyor");
        const skippedLogs = captured.filter((e) =>
          String(e.event).includes("match_fanout.skipped"),
        );
        assert.equal(skippedLogs.length, 1, `40 alıcı için ${skippedLogs.length} log satırı`);
      } finally {
        restoreUsers();
        restoreFetch();
      }
    });
  });

  /* ---------------------------------------------------------------- */
  /* C. Sağlayıcı var                                                   */
  /* ---------------------------------------------------------------- */
  await check("sağlayıcı varsa her alıcıya bir e-posta; bozuk adres yalnız kendini düşürür", async () => {
    await withEnv(CONFIGURED, async () => {
      const restoreUsers = stubUsers({
        findMany: async (args: { where: { id: { in: string[] } } }) => {
          assert.equal(args.where.id.in.length, 3, "alıcı sorgusu tekilleştirilmemiş");
          return [
            { id: "u1", email: "firma1@example.com" },
            { id: "u2", email: "bozuk-adres" },
            { id: "u3", email: "firma3@example.com" },
          ];
        },
      });
      const restoreFetch = stubProvider();
      try {
        const out = await deliverMatchEmails({
          requestId: REQ,
          notifications: [row("u1"), row("u2"), row("u3")],
        });
        assert.equal(out.attempted, 3);
        assert.equal(out.delivered, 2, "iki geçerli alıcıya gitmeli");
        assert.equal(out.failed, 1, "bozuk adres düşmeli");
        assert.equal(sent.length, 2);
        const alicilar = sent.map((s) => s.to).sort();
        assert.deepEqual(alicilar, ["firma1@example.com", "firma3@example.com"]);
        for (const m of sent) {
          assert.equal(m.subject, "Yeni eşleşen talep", "konu bildirim başlığı değil");
          assert.ok(m.text.includes(BASLIK), "gövde bildirim metnini taşımıyor");
          assert.ok(
            m.text.includes(`https://talepo.test/panel/talepler/${REQ}`),
            "gövdede mutlak bağlantı yok — tedarikçi nereye tıklayacağını bilmez",
          );
        }
      } finally {
        restoreUsers();
        restoreFetch();
      }
    });
  });

  await check("sağlayıcı hata dönerse dağıtım etkilenmez, sayı dürüst", async () => {
    await withEnv(CONFIGURED, async () => {
      const restoreUsers = stubUsers({
        findMany: async () => [{ id: "u1", email: "firma1@example.com" }],
      });
      const restoreFetch = stubProvider(false);
      try {
        const out = await deliverMatchEmails({
          requestId: REQ,
          notifications: [row("u1")],
        });
        assert.equal(out.delivered, 0);
        assert.equal(out.failed, 1);
      } finally {
        restoreUsers();
        restoreFetch();
      }
    });
  });

  /* ---------------------------------------------------------------- */
  /* D. Asla fırlatmaz                                                  */
  /* ---------------------------------------------------------------- */
  await check("alıcı sorgusu patlarsa fırlatmaz", async () => {
    await withEnv(CONFIGURED, async () => {
      const restoreUsers = stubUsers({
        findMany: async () => {
          throw new Error("db down");
        },
      });
      const restoreFetch = stubProvider();
      try {
        const out = await deliverMatchEmails({
          requestId: REQ,
          notifications: [row("u1"), row("u2")],
        });
        assert.equal(out.skippedReason, "error");
        assert.equal(out.failed, 2);
        assert.equal(sent.length, 0);
      } finally {
        restoreUsers();
        restoreFetch();
      }
    });
  });

  /* ---------------------------------------------------------------- */
  /* E. Üst sınır                                                       */
  /* ---------------------------------------------------------------- */
  await check("üst sınır uygulanır ve gizlenmez", async () => {
    await withEnv(CONFIGURED, async () => {
      const n = MAX_EMAILS_PER_FANOUT + 25;
      const restoreUsers = stubUsers({
        findMany: async (args: { where: { id: { in: string[] } } }) =>
          args.where.id.in.map((id) => ({ id, email: `${id}@example.com` })),
      });
      const restoreFetch = stubProvider();
      try {
        const out = await deliverMatchEmails({
          requestId: REQ,
          notifications: Array.from({ length: n }, (_, i) => row(`u${i}`)),
        });
        assert.equal(out.capped, true, "sınıra dayanıldığı söylenmiyor");
        assert.equal(out.attempted, MAX_EMAILS_PER_FANOUT);
        assert.equal(sent.length, MAX_EMAILS_PER_FANOUT, "sınır aşıldı");
        assert.equal(out.skipped, 25, "düşen sayısı dürüst değil");
      } finally {
        restoreUsers();
        restoreFetch();
      }
    });
  });

  /* ---------------------------------------------------------------- */
  /* F. PII                                                             */
  /* ---------------------------------------------------------------- */
  await check("adres, talep başlığı ve kullanıcı kimliği loga girmez", () => {
    assert.ok(captured.length > 0, "hiç log yok — sızıntı testi anlamsız");
    const blob = JSON.stringify(captured);
    for (const yasak of [
      "firma1@example.com",
      "firma3@example.com",
      "ali@example.com",
      "05551112233",
      BASLIK,
      '"u1"',
    ]) {
      assert.ok(!blob.includes(yasak), `loga sızdı: ${yasak}`);
    }
  });

  detach();

  /* ---------------------------------------------------------------- */
  /* G. Sır loglanmaz                                                   */
  /* ---------------------------------------------------------------- */
  await check("API anahtarı hiçbir loga girmez", () => {
    const blob = JSON.stringify(captured);
    assert.ok(!blob.includes("verifier-only-not-a-real-key"), "API anahtarı loga sızdı");
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
