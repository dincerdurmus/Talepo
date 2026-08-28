/**
 * ACİL NUDGE İŞİNİN SINIRI VE ATOMİKLİĞİ — KB-22 (2026-08-28).
 *
 * Kalıcı iş render'dan çıkarıldığında geriye iki soru kalır: işi KİM
 * başlatabilir ve iş YARIM kalırsa ne olur? Bu doğrulayıcı ikisini de
 * gerçek veritabanı olmadan ölçer: üretim fonksiyonuna sahte bir Prisma
 * istemcisi enjekte edilir, böylece transaction sınırı, geri alma ve
 * eşzamanlılık gözlemlenebilir olur.
 *
 * SALT-OKUNUR. Hiçbir veritabanı bağlantısı açılmaz; ölçüm saf fonksiyon
 * üzerindedir.
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  runUrgentNudgeScan,
  type UrgentNudgeDb,
  type UrgentNudgeNotifier,
} from "../src/server/request/urgent-nudge-core";

const ROOT = resolve(__dirname, "..");
const problems: string[] = [];

function ok(id: string, condition: boolean, detail: string): void {
  if (!condition) problems.push(`${id}: ${detail}`);
}

/* ------------------------------------------------------------------ *
 * SAHTE PRISMA — transaction semantiği taklit edilir
 * ------------------------------------------------------------------ */

type Row = {
  id: string;
  createdById: string;
  urgentOfferNudgeAt: Date | null;
};

type Notification = { userId: string; requestId?: string };

type FakeOptions = {
  rows: Row[];
  failNotificationFor?: Set<string>;
};

function createFakeDb(options: FakeOptions) {
  const rows = options.rows.map((row) => ({ ...row }));
  const notifications: Notification[] = [];
  const failFor = options.failNotificationFor ?? new Set<string>();
  let transactions = 0;

  function claim(where: { id?: string; urgentOfferNudgeAt?: unknown }, at: Date) {
    const row = rows.find((candidate) => candidate.id === where.id);
    if (!row) return { count: 0 };
    /* Koşullu claim: yalnız hâlâ damgasız satır yakalanır. */
    if (row.urgentOfferNudgeAt !== null) return { count: 0 };
    row.urgentOfferNudgeAt = at;
    return { count: 1 };
  }

  const client: UrgentNudgeDb = {
    request: {
      /* Sahte istemci `take` ve `orderBy` sözleşmesine UYAR; uymazsa
       * batch sınırı ve determinizm ölçülemez (ölçüldü: 25/0 çıkmıştı). */
      findMany: async (args: { take?: number }) =>
        rows
          .filter((row) => row.urgentOfferNudgeAt === null)
          .sort((a, b) => a.id.localeCompare(b.id))
          .slice(0, args?.take ?? rows.length)
          .map((row) => ({
            id: row.id,
            title: `talep ${row.id}`,
            createdById: row.createdById,
          })),
      updateMany: async (args: { where: never; data: { urgentOfferNudgeAt: Date } }) =>
        claim(args.where as never, args.data.urgentOfferNudgeAt),
    },
    $transaction: async <T,>(fn: (tx: UrgentNudgeDb) => Promise<T>): Promise<T> => {
      transactions += 1;
      const snapshot = rows.map((row) => ({ ...row }));
      const notificationCount = notifications.length;
      try {
        return await fn(client);
      } catch (error) {
        /* ROLLBACK: satırlar ve bildirimler işlem öncesine döner. */
        rows.splice(0, rows.length, ...snapshot);
        notifications.splice(notificationCount);
        throw error;
      }
    },
  } as unknown as UrgentNudgeDb;

  const notify: UrgentNudgeNotifier = async (input) => {
    if (failFor.has(input.requestId)) {
      throw new Error("notification yazilamadi (sahte hata)");
    }
    notifications.push({ userId: input.userId, requestId: input.requestId });
    return input;
  };

  return {
    client,
    notify,
    rows,
    notifications,
    get transactions() {
      return transactions;
    },
  };
}

function row(id: string, createdById: string): Row {
  return { id, createdById, urgentOfferNudgeAt: null };
}

async function main(): Promise<void> {
  /* ------------------------------------------------------------------ *
   * A — ATOMİKLİK
   * ------------------------------------------------------------------ */

  {
    const fake = createFakeDb({ rows: [row("r1", "u1")] });
    const result = await runUrgentNudgeScan({ db: fake.client, notify: fake.notify, userId: "u1", waitMs: 0 });
    ok("A1-mutlu-yol", result.created === 1, `created=${result.created}, beklenen 1`);
    ok(
      "A1-damga",
      fake.rows[0]?.urgentOfferNudgeAt !== null,
      "başarılı turda damga atılmadı",
    );
    ok(
      "A1-bildirim",
      fake.notifications.length === 1 &&
        fake.notifications[0]?.requestId === "r1",
      `bildirim üretilmedi: ${JSON.stringify(fake.notifications)}`,
    );
    ok(
      "A1-transaction",
      fake.transactions >= 1,
      "claim ve bildirim transaction içinde yürütülmedi",
    );
  }

  {
    /* Bildirim hata verirse damga GERİ ALINIR — talep sessizce tüketilmez. */
    const fake = createFakeDb({
      rows: [row("r1", "u1")],
      failNotificationFor: new Set(["r1"]),
    });
    let threw = false;
    try {
      await runUrgentNudgeScan({ db: fake.client, notify: fake.notify, userId: "u1", waitMs: 0 });
    } catch {
      threw = true;
    }
    ok(
      "A2-hata-yutulmaz",
      threw,
      "bildirim hatası iş sınırında görünür olmadı (sessizce yutuldu)",
    );
    ok(
      "A2-damga-rollback",
      fake.rows[0]?.urgentOfferNudgeAt === null,
      "bildirim başarısızken damga kalıcı oldu — nudge kalıcı olarak kaybolur",
    );
    ok(
      "A2-bildirim-yok",
      fake.notifications.length === 0,
      "başarısız turda bildirim yazıldı",
    );
  }

  /* ------------------------------------------------------------------ *
   * B — EŞZAMANLILIK VE TEKİLLİK
   * ------------------------------------------------------------------ */

  {
    const fake = createFakeDb({ rows: [row("r1", "u1")] });
    const [first, second] = await Promise.all([
      runUrgentNudgeScan({ db: fake.client, notify: fake.notify, userId: "u1", waitMs: 0 }),
      runUrgentNudgeScan({ db: fake.client, notify: fake.notify, userId: "u1", waitMs: 0 }),
    ]);
    ok(
      "B1-duplicate-yok",
      fake.notifications.length === 1,
      `eşzamanlı çalıştırmada ${fake.notifications.length} bildirim üretildi`,
    );
    ok(
      "B1-tek-created",
      (first.created ?? 0) + (second.created ?? 0) === 1,
      `created toplamı ${first.created}+${second.created}, beklenen 1`,
    );
  }

  {
    /* Poller ve cron aynı anda: yine tek bildirim. */
    const fake = createFakeDb({ rows: [row("r1", "u1")] });
    await Promise.all([
      runUrgentNudgeScan({ db: fake.client, notify: fake.notify, userId: "u1", waitMs: 0 }),
      runUrgentNudgeScan({ db: fake.client, notify: fake.notify, waitMs: 0 }),
    ]);
    ok(
      "B2-poller-cron-duplicate-yok",
      fake.notifications.length === 1,
      `poller+cron ${fake.notifications.length} bildirim üretti`,
    );
  }

  /* ------------------------------------------------------------------ *
   * C — SAHİPLİK VE SIZINTI
   * ------------------------------------------------------------------ */

  {
    const fake = createFakeDb({ rows: [row("r1", "u1"), row("r2", "u2")] });
    await runUrgentNudgeScan({ db: fake.client, notify: fake.notify, waitMs: 0 });
    const owners = fake.notifications.map(
      (notification) => `${notification.requestId}:${notification.userId}`,
    );
    ok(
      "C1-sahip-request-tan-turer",
      owners.includes("r1:u1") && owners.includes("r2:u2"),
      `bildirim sahibi talebin createdById değerinden türemedi: ${owners.join(", ")}`,
    );
    ok(
      "C1-capraz-sizinti-yok",
      fake.notifications.every(
        (notification) =>
          fake.rows.find((candidate) => candidate.id === notification.requestId)
            ?.createdById === notification.userId,
      ),
      "bir talep başka kullanıcıya bildirim üretti",
    );
  }

  /* ------------------------------------------------------------------ *
   * D — BATCH DETERMİNİZMİ VE KALAN
   * ------------------------------------------------------------------ */

  {
    const many = Array.from({ length: 25 }, (_, index) =>
      row(`r${String(index).padStart(2, "0")}`, "u1"),
    );
    const fake = createFakeDb({ rows: many });
    const first = await runUrgentNudgeScan({ db: fake.client, notify: fake.notify, userId: "u1", waitMs: 0 });
    ok("D1-batch-siniri", first.created === 20, `ilk turda ${first.created}, beklenen 20`);
    const second = await runUrgentNudgeScan({ db: fake.client, notify: fake.notify, userId: "u1", waitMs: 0 });
    ok("D1-kalan", second.created === 5, `ikinci turda ${second.created}, beklenen 5`);
    ok(
      "D1-toplam",
      fake.notifications.length === 25,
      `toplam bildirim ${fake.notifications.length}, beklenen 25`,
    );

    const fakeB = createFakeDb({
      rows: Array.from({ length: 25 }, (_, index) =>
        row(`r${String(index).padStart(2, "0")}`, "u1"),
      ),
    });
    await runUrgentNudgeScan({ db: fakeB.client, notify: fakeB.notify, userId: "u1", waitMs: 0 });
    ok(
      "D2-deterministik-sira",
      JSON.stringify(fake.notifications.slice(0, 20).map((n) => n.requestId)) ===
        JSON.stringify(fakeB.notifications.map((n) => n.requestId)),
      "batch sırası iki koşuda ayrıştı",
    );
  }

  /* ------------------------------------------------------------------ *
   * E — CRON SINIRI (kaynak sözleşmesi)
   * ------------------------------------------------------------------ */

  {
    const routePath = join(ROOT, "src/app/api/cron/urgent-nudge/route.ts");
    let source = "";
    try {
      source = readFileSync(routePath, "utf8");
    } catch {
      source = "";
    }
    ok("E1-route-var", source.length > 0, "cron route dosyası yok");
    ok(
      "E1-cron-secret",
      /process\.env\.CRON_SECRET/.test(source) &&
        /Bearer \$\{secret\}/.test(source),
      "depodaki mevcut CRON_SECRET fail-closed deseni kullanılmıyor",
    );
    ok(
      "E1-401",
      /status:\s*401/.test(source),
      "yetkisiz çağrı 401 döndürmüyor",
    );
    ok(
      "E1-istemci-userId-yok",
      !/req(uest)?\.(json|nextUrl)/.test(source),
      "cron route istemciden gelen gövde/sorgu okuyor — userId istemciden gelmemeli",
    );

    const vercel = readFileSync(join(ROOT, "../../vercel.json"), "utf8");
    ok(
      "E2-vercel-cron",
      /\/api\/cron\/urgent-nudge/.test(vercel),
      "vercel.json içinde acil nudge cron kaydı yok",
    );

    const poller = readFileSync(
      join(ROOT, "src/app/api/notifications/urgent-nudge/route.ts"),
      "utf8",
    );
    ok(
      "E3-poller-requireUser",
      /requireUser\(\)/.test(poller) &&
        !/\breq(uest)?\.json\(\)/.test(poller),
      "poller route kullanıcıyı requireUser dışında bir kaynaktan alıyor",
    );

    const layout = readFileSync(join(ROOT, "src/app/panel/layout.tsx"), "utf8");
    ok(
      "E4-layout-temiz",
      !/^\s*import[^;]*processUrgentNoOfferNudges/m.test(layout) &&
      !/await\s+processUrgentNoOfferNudges\s*\(/.test(layout),
      "panel layout hâlâ nudge işini çağırıyor",
    );
  }


}

void main().then(() => {
  console.log(`PROBLEMS=${problems.length}`);
  for (const problem of problems.slice(0, 25)) console.log(`  - ${problem}`);
  console.log("===== HUKUM =====");
  console.log(
    problems.length === 0
      ? "GECTI: nudge işi açık sınırda, atomik ve sızıntısız."
      : "KALDI: nudge sınırı sözleşmeyi ihlal ediyor.",
  );
  process.exit(problems.length === 0 ? 0 : 1);

});
