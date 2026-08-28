/**
 * OKUNDU İŞARETİ SINIRI — KB-22 Dilim 1 (2026-08-28).
 *
 * SORUN. İki panel sayfası RSC render'ı sırasında kalıcı yazım yapıyor:
 *   - `panel/bildirimler/r/[id]/page.tsx` → `markNotificationAsRead`
 *   - `panel/mesajlar/[id]/page.tsx` → `markConversationAsRead`
 * "Okundu" gerçek bir kullanıcı eylemidir; sayfanın render edilmesi değildir.
 * Sohbet linklerinde `prefetch` kapalı olmadığı için bir bağlantının ÜSTÜNE
 * GELMEK bile konuşmayı okundu işaretleyebiliyordu. Ayrıca
 * `markConversationAsRead` iki ayrı yazımı transaction'sız yapıyordu: ikincisi
 * hata verirse katılımcı okundu, bildirim UNREAD kalıyordu.
 *
 * NE ÖLÇÜLÜR.
 *   1. Render zincirinde okundu yazımı YOK (kaynak: gerçek çağrı, anma değil).
 *   2. Yazım açık, yetkili POST rotalarında ve sahiplik kapsamlı.
 *   3. Sohbet okundu işareti ATOMİK (tek transaction, hata → rollback).
 *   4. İdempotent: ikinci çağrı yeni yazım üretmez.
 *   5. Başka kullanıcının kaydı fail-closed (0 satır, bilgi sızmaz).
 *   6. Okundu rotalarına giden linklerde `prefetch={false}` — alan adına göre
 *      değil, GERÇEK href/route eşleşmesine göre.
 *   7. Yönlendirme hedefi SUNUCUDA hesaplanır; istemci keyfi URL veremez
 *      (open redirect 0).
 *
 * SALT-OKUNUR. Gerçek veritabanı açılmaz: üretim yazıcılarına sahte istemci
 * enjekte edilir. `DATABASE_URL` yalnız modül yüklenebilsin diye kukla bir
 * değere set edilir; hiçbir bağlantı kurulmaz.
 */

process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://verifier:verifier@127.0.0.1:1/none?schema=public";

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Üretim yazıcıları TEMBEL yüklenir. Statik `import` deyimleri yukarıdaki
 * `process.env` atamasının ÜSTÜNE hoist edilir ve `@/lib/prisma` modül
 * yüklenirken bağlantı dizesi arayıp fırlatırdı (ölçüldü).
 */
async function loadWriters() {
  const [notifications, messages] = await Promise.all([
    import("../src/server/notifications/mark-notifications-read"),
    import("../src/server/message/mark-conversation-read"),
  ]);
  return {
    markNotificationAsRead: notifications.markNotificationAsRead as (
      userId: string,
      id: string,
      options?: unknown,
    ) => Promise<{ count: number }>,
    markConversationAsRead: messages.markConversationAsRead as (
      userId: string,
      id: string,
      options?: unknown,
    ) => Promise<unknown>,
  };
}

const ROOT = resolve(__dirname, "..");
const SRC = join(ROOT, "src");

const problems: string[] = [];

function ok(id: string, condition: boolean, detail: string): void {
  if (!condition) problems.push(`${id}: ${detail}`);
}

function read(file: string): string {
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

/** Yorumları atar — bir açıklamada geçen ad ÇAĞRI sayılmaz. */
function code(file: string): string {
  return read(file)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/* ------------------------------------------------------------------ *
 * 1. RENDER SINIRI — GERÇEK ÇAĞRI ARANIR
 * ------------------------------------------------------------------ */

const NOTIFICATION_PAGE = join(
  SRC,
  "app/panel/bildirimler/r/[id]/page.tsx",
);
const CONVERSATION_PAGE = join(SRC, "app/panel/mesajlar/[id]/page.tsx");

for (const [id, file, fn] of [
  ["bildirim", NOTIFICATION_PAGE, "markNotificationAsRead"],
  ["sohbet", CONVERSATION_PAGE, "markConversationAsRead"],
] as const) {
  const source = code(file);
  ok(`R1-sayfa-var/${id}`, source.length > 0, `render sayfası okunamadı: ${file}`);
  ok(
    `R1-render-yazim-yok/${id}`,
    !new RegExp(`\\b${fn}\\s*\\(`).test(source),
    `render sırasında ${fn}(...) çağrılıyor`,
  );
  ok(
    `R1-import-yok/${id}`,
    !new RegExp(`^\\s*import[^;]*\\b${fn}\\b`, "m").test(source),
    `render sayfası ${fn} import ediyor — çağrı kalkmış olsa bile zincir açık kalır`,
  );
}

/* ------------------------------------------------------------------ *
 * 2. AÇIK POST SINIRLARI
 * ------------------------------------------------------------------ */

const NOTIFICATION_ROUTE = join(
  SRC,
  "app/api/notifications/[id]/read/route.ts",
);
const CONVERSATION_ROUTE = join(SRC, "app/api/messages/[id]/read/route.ts");

for (const [id, file] of [
  ["bildirim", NOTIFICATION_ROUTE],
  ["sohbet", CONVERSATION_ROUTE],
] as const) {
  const source = code(file);
  ok(`R2-route-var/${id}`, source.length > 0, `POST rotası yok: ${file}`);
  ok(
    `R2-post/${id}`,
    /export\s+async\s+function\s+POST\s*\(/.test(source),
    "rota POST değil — okundu işareti GET ile tetiklenemez",
  );
  ok(
    `R2-requireUser/${id}`,
    /requireUser\s*\(/.test(source),
    "rota kullanıcıyı `requireUser()` ile belirlemiyor",
  );
  ok(
    `R2-istemci-userId-yok/${id}`,
    !/\buserId\s*[:=]\s*(?:body|payload|json|params)\b/.test(source),
    "rota istemciden gelen bir userId kullanıyor",
  );
  ok(
    `R2-401/${id}`,
    /status:\s*401/.test(source),
    "yetkisiz çağrı 401 döndürmüyor",
  );
}

/* ------------------------------------------------------------------ *
 * 3. AÇIK YÖNLENDİRME — HEDEF SUNUCUDA HESAPLANIR
 * ------------------------------------------------------------------ */

const REDIRECT_COMPONENT = join(
  SRC,
  "components/panel/NotificationReadRedirect.tsx",
);
{
  const source = code(REDIRECT_COMPONENT);
  ok("R3-bilesen-var", source.length > 0, "istemci yönlendirme bileşeni yok");
  ok(
    "R3-use-client",
    /^\s*["']use client["']/m.test(read(REDIRECT_COMPONENT)),
    "bileşen istemci bileşeni değil",
  );
  ok(
    "R3-hedef-proptan",
    /destination/.test(source) &&
      !/searchParams|location\.search|URLSearchParams/.test(source),
    "yönlendirme hedefi istemci girdisinden okunuyor — open redirect riski",
  );
  /**
   * Guard'ın DAVRANIŞI aşağıda `R7` bloğunda GERÇEK fonksiyon üzerinde
   * ölçülür (`//host`, `/\host`, şema taşıyan ve kodlanmış hedefler dâhil).
   * Burada yalnız yönlendirmenin o guard'dan GEÇTİĞİ kilitlenir: hedef
   * doğrudan `replace(destination)` ile kullanılamaz.
   */
  ok(
    "R3-guard-kullaniliyor",
    /isInternalPath\s*\(/.test(source) &&
      !/replace\(\s*destination\s*\)/.test(source),
    "yönlendirme iç yol guard'ından geçmiyor",
  );
  ok(
    "R3-basarisizsa-yonlendirme-yok",
    /replace\s*\(/.test(source) && /catch|!response\.ok|ok\s*===\s*false|hata/i.test(source),
    "POST başarısızken yönlendirme yine de yapılıyor (sessiz başarı)",
  );
  ok(
    "R3-retry",
    /retry|Tekrar|yeniden dene/i.test(source),
    "kullanıcıya erişilebilir bir yeniden deneme yolu sunulmuyor",
  );
}

const RECEIPT_COMPONENT = join(
  SRC,
  "components/panel/ConversationReadReceipt.tsx",
);
{
  const source = code(RECEIPT_COMPONENT);
  ok("R3-sohbet-bilesen-var", source.length > 0, "sohbet okundu bileşeni yok");
  ok(
    "R3-sohbet-dongu-korumasi",
    /useRef\s*\(/.test(source) && /router\.refresh\s*\(/.test(source),
    "`router.refresh()` döngü koruması (tek koşum işareti) yok",
  );
}

/* ------------------------------------------------------------------ *
 * 4. PREFETCH — GERÇEK HREF EŞLEŞMESİ
 * ------------------------------------------------------------------ */

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full, out);
      continue;
    }
    if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/**
 * Okundu işareti üreten hedefler. Alan adına göre tarama YAPILMAZ: bir
 * `<Link>`'in gerçek `href` değeri bu yollardan birine gidiyorsa prefetch
 * kapalı olmalıdır.
 */
const READ_RECEIPT_HREF_PATTERNS = [
  /href=\{?\s*[`"']\/panel\/mesajlar\/\$\{/,
  /href=\{?\s*[`"']\/panel\/bildirimler\/r\/\$\{/,
];

const linkFiles = walk(join(SRC, "app")).concat(walk(join(SRC, "components")));
const offenders: string[] = [];
let guardedLinks = 0;

for (const file of linkFiles) {
  const source = code(file);
  if (!/<Link\b/.test(source)) continue;
  for (const block of source.split(/<Link\b/).slice(1)) {
    const head = block.slice(0, block.indexOf(">") + 1 || 400);
    if (!READ_RECEIPT_HREF_PATTERNS.some((pattern) => pattern.test(head))) {
      continue;
    }
    if (/prefetch=\{?\s*false\s*\}?/.test(head)) {
      guardedLinks += 1;
      continue;
    }
    offenders.push(file.slice(SRC.length + 1).replace(/\\/g, "/"));
  }
}

ok(
  "R4-prefetch-kapali",
  offenders.length === 0,
  `okundu rotasına giden korumasız <Link>: ${[...new Set(offenders)].join(", ")}`,
);
ok(
  "R4-olcum-calisiyor",
  guardedLinks >= 3,
  `korumalı link az bulundu (${guardedLinks}) — ölçüm gerçek href eşleşmesini bulamıyor`,
);

/* ------------------------------------------------------------------ *
 * 5. YAZICI SÖZLEŞMESİ — SAHTE İSTEMCİYLE
 * ------------------------------------------------------------------ */

type NotificationRow = {
  id: string;
  userId: string;
  status: "UNREAD" | "READ";
};

function notificationDb(rows: NotificationRow[]) {
  const state = rows.map((row) => ({ ...row }));
  let writes = 0;
  const client = {
    notification: {
      updateMany: async (args: {
        where: { id?: string; userId?: string; status?: string };
        data: { status: string };
      }) => {
        const matched = state.filter(
          (row) =>
            (args.where.id === undefined || row.id === args.where.id) &&
            (args.where.userId === undefined || row.userId === args.where.userId) &&
            (args.where.status === undefined || row.status === args.where.status),
        );
        for (const row of matched) row.status = args.data.status as "READ";
        writes += matched.length;
        return { count: matched.length };
      },
    },
  };
  return {
    client,
    state,
    get writes() {
      return writes;
    },
  };
}

async function measureNotificationWriter(): Promise<void> {
  const { markNotificationAsRead } = await loadWriters();
  const fake = notificationDb([
    { id: "n1", userId: "u1", status: "UNREAD" },
    { id: "n2", userId: "u2", status: "UNREAD" },
  ]);

  const first = (await markNotificationAsRead("u1", "n1", {
    revalidate: false,
    db: fake.client,
  } as never)) as { count: number };
  ok("R5-okundu", first.count === 1, `ilk çağrı ${first.count} satır yazdı`);

  const second = (await markNotificationAsRead("u1", "n1", {
    revalidate: false,
    db: fake.client,
  } as never)) as { count: number };
  ok("R5-idempotent", second.count === 0, `ikinci çağrı ${second.count} satır yazdı`);

  const foreign = (await markNotificationAsRead("u1", "n2", {
    revalidate: false,
    db: fake.client,
  } as never)) as { count: number };
  ok("R5-capraz-kullanici", foreign.count === 0, "başka kullanıcının bildirimi okundu işaretlendi");
  ok(
    "R5-capraz-durum",
    fake.state.find((row) => row.id === "n2")?.status === "UNREAD",
    "başka kullanıcının kaydı değişti",
  );
}

/* ------------------------------------------------------------------ *
 * 6. SOHBET — ATOMİKLİK
 * ------------------------------------------------------------------ */

function conversationDb(options: { failNotification?: boolean }) {
  let participantWrites = 0;
  let notificationWrites = 0;
  let transactions = 0;

  const client = {
    conversationParticipant: {
      updateMany: async () => {
        participantWrites += 1;
        return { count: 1 };
      },
    },
    notification: {
      updateMany: async () => {
        if (options.failNotification) {
          throw new Error("notification yazılamadı (sahte hata)");
        }
        notificationWrites += 1;
        return { count: 1 };
      },
    },
    $transaction: async <T,>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      transactions += 1;
      const participantSnapshot = participantWrites;
      const notificationSnapshot = notificationWrites;
      try {
        return await fn(client);
      } catch (error) {
        participantWrites = participantSnapshot;
        notificationWrites = notificationSnapshot;
        throw error;
      }
    },
  };

  return {
    client,
    get participantWrites() {
      return participantWrites;
    },
    get notificationWrites() {
      return notificationWrites;
    },
    get transactions() {
      return transactions;
    },
  };
}

async function measureConversationWriter(): Promise<void> {
  const { markConversationAsRead } = await loadWriters();
  const happy = conversationDb({});
  await markConversationAsRead("u1", "c1", {
    db: happy.client,
    workspace: null,
  } as never);
  ok("R6-transaction", happy.transactions >= 1, "iki yazım tek transaction'da değil");
  ok(
    "R6-mutlu-yol",
    happy.participantWrites === 1 && happy.notificationWrites === 1,
    `yazım sayıları ${happy.participantWrites}/${happy.notificationWrites}`,
  );

  const failing = conversationDb({ failNotification: true });
  let threw = false;
  try {
    await markConversationAsRead("u1", "c1", {
      db: failing.client,
      workspace: null,
    } as never);
  } catch {
    threw = true;
  }
  ok("R6-hata-yutulmaz", threw, "bildirim hatası sessizce yutuldu");
  ok(
    "R6-rollback",
    failing.participantWrites === 0,
    "bildirim başarısızken katılımcı okundu işareti kalıcı oldu",
  );
}

/**
 * Yazıcı ölçümleri GERÇEK VERİTABANI OLMADAN koşabilmelidir. Üretim enjekte
 * edilen istemciyi yok sayarsa çağrı gerçek Prisma istemcisine düşer ve
 * bağlantı hatası verir; bu bir çökme değil, ÖLÇÜLEN BİR İHLALDİR.
 */
async function guarded(id: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    const message = (error as Error)?.message ?? String(error);
    ok(
      id,
      false,
      `sahte istemciyle ölçülemedi (üretim enjekte edilen istemciyi yok sayıyor): ${message.slice(0, 120)}`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * 7. İÇ HEDEF GUARD'I — GERÇEK FONKSİYON ÜZERİNDE
 * ------------------------------------------------------------------ */

async function measureInternalPathGuard(): Promise<void> {
  const { isInternalPath } = await import(
    "../src/components/panel/NotificationReadRedirect"
  );

  const cases: [string, boolean][] = [
    ["/panel/taleplerim/abc", true],
    ["/panel/bildirimler?sikayet=1", true],
    ["//evil.example/x", false],
    ["/\\evil.example/x", false],
    ["http://evil.example", false],
    ["https://evil.example", false],
    ["\\\\evil.example", false],
    ["%2F%2Fevil.example", false],
    ["", false],
  ];

  for (const [value, expected] of cases) {
    ok(
      `R7-hedef/${JSON.stringify(value)}`,
      isInternalPath(value) === expected,
      `beklenen ${expected}, ölçülen ${isInternalPath(value)}`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * 8. BİLDİRİM: VARLIK SIZDIRMAZ, İDEMPOTENT BAŞARI
 * ------------------------------------------------------------------ */

async function measureNotificationLeak(): Promise<void> {
  const { markNotificationAsRead } = await loadWriters();
  const fake = notificationDb([
    { id: "n1", userId: "u1", status: "READ" },
    { id: "n2", userId: "u2", status: "UNREAD" },
  ]);

  const alreadyRead = await markNotificationAsRead("u1", "n1", {
    revalidate: false,
    db: fake.client,
  } as never);
  ok(
    "R8-zaten-okundu-idempotent",
    alreadyRead.count === 0,
    `zaten READ olan bildirim ${alreadyRead.count} satır yazdı`,
  );

  const missing = await markNotificationAsRead("u1", "yok-boyle-id", {
    revalidate: false,
    db: fake.client,
  } as never);
  const foreign = await markNotificationAsRead("u1", "n2", {
    revalidate: false,
    db: fake.client,
  } as never);
  ok(
    "R8-varlik-sizmaz",
    missing.count === foreign.count && missing.count === 0,
    `bulunmayan (${missing.count}) ile başkasının kaydı (${foreign.count}) farklı sonuç verdi`,
  );
  ok(
    "R8-sahip-degismedi",
    fake.state.find((row) => row.id === "n2")?.status === "UNREAD",
    "başka kullanıcının bildirimi değişti",
  );

  /* Rota, kaydın VARLIĞINA göre dallanmamalı — aksi hâlde 404/notFound
   * üzerinden varlık sızardı. */
  const routeSource = code(NOTIFICATION_ROUTE);
  ok(
    "R8-rota-varlik-dali-yok",
    !/status:\s*404/.test(routeSource) && !/notFound\s*\(/.test(routeSource),
    "bildirim rotası varlığa bağlı bir dal (404/notFound) içeriyor",
  );
}

/* ------------------------------------------------------------------ *
 * 9. RETRY GERÇEKTEN İKİNCİ POST GÖNDEREBİLİR
 * ------------------------------------------------------------------ */

{
  for (const [id, file] of [
    ["bildirim", REDIRECT_COMPONENT],
    ["sohbet", RECEIPT_COMPONENT],
  ] as const) {
    const source = code(file);
    const retryBlock =
      /onClick=\{\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*\}/.exec(source)?.[1] ?? "";
    ok(
      `R9-retry-post/${id}`,
      /\brun\s*\(\s*\)/.test(retryBlock),
      "yeniden deneme düğmesi POST'u yeniden çalıştırmıyor",
    );
    /* `run` gövdesinde tek koşum işareti OLMAMALI: guard yalnız otomatik
     * mount tetikleyicisindedir, aksi hâlde retry sessizce hiçbir şey
     * yapmazdı. */
    const runBody =
      /const run = useCallback\(async \(\) => \{([\s\S]*?)\n  \}, \[/.exec(
        source,
      )?.[1] ?? "";
    ok(
      `R9-run-guardsiz/${id}`,
      runBody.length > 0 && !/Ref\.current/.test(runBody),
      "POST fonksiyonunun kendisi tek koşum işaretiyle kilitli — retry çalışmaz",
    );
    ok(
      `R9-mount-guardi/${id}`,
      /useEffect\([\s\S]*?Ref\.current/.test(source),
      "otomatik tetikleyicide döngü koruması yok",
    );
  }
}

/* ------------------------------------------------------------------ *
 * 10. SOHBET: YAZIM ANINDA SAHİPLİK
 * ------------------------------------------------------------------ */

async function measureConversationOwnership(): Promise<void> {
  const { markConversationAsRead } = await loadWriters();
  let participantWhere: Record<string, unknown> | null = null;
  let notificationWhere: Record<string, unknown> | null = null;

  const client = {
    conversationParticipant: {
      updateMany: async (args: { where: Record<string, unknown> }) => {
        participantWhere = args.where;
        return { count: 1 };
      },
    },
    notification: {
      updateMany: async (args: { where: Record<string, unknown> }) => {
        notificationWhere = args.where;
        return { count: 1 };
      },
    },
    $transaction: async <T,>(fn: (tx: unknown) => Promise<T>): Promise<T> =>
      fn(client),
  };

  await markConversationAsRead("u1", "c1", {
    db: client,
    workspace: null,
  } as never);

  const participantScope = JSON.stringify(participantWhere ?? {});
  ok(
    "R10-yazim-aninda-sahiplik",
    /"conversationId":"c1"/.test(participantScope) &&
      /"userId":"u1"/.test(participantScope),
    `katılımcı yazımı sahiplikle kapsamlı değil: ${participantScope}`,
  );
  ok(
    "R10-bildirim-sahiplik",
    /"userId":"u1"/.test(JSON.stringify(notificationWhere ?? {})),
    "bildirim yazımı kullanıcıya kapsamlı değil",
  );
}

async function main(): Promise<void> {
  await guarded("R5-olculebilir", measureNotificationWriter);
  await guarded("R6-olculebilir", measureConversationWriter);
  await guarded("R7-olculebilir", measureInternalPathGuard);
  await guarded("R8-olculebilir", measureNotificationLeak);
  await guarded("R10-olculebilir", measureConversationOwnership);
}

void main().then(() => {
  console.log(`korumalı okundu-linki: ${guardedLinks}`);
  console.log(`PROBLEMS=${problems.length}`);
  for (const problem of problems.slice(0, 25)) console.log(`  - ${problem}`);
  console.log("===== HUKUM =====");
  console.log(
    problems.length === 0
      ? "GECTI: okundu işareti render'dan çıktı; açık, yetkili ve atomik."
      : "KALDI: okundu işareti sınırı sözleşmeyi ihlal ediyor.",
  );
  process.exit(problems.length === 0 ? 0 : 1);
});
