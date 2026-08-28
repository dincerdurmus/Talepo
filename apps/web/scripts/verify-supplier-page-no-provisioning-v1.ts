/**
 * PROVISIONING VE BACKFILL SINIRI — KB-22 Dilim 2 (2026-08-28).
 *
 * SORUN. `panel/talepler/page.tsx` RSC render'ında iki kalıcı yazım koşuyor:
 *   - `ensureEngineCategories()` → 11 `Category.upsert`
 *   - `backfillMatchesForCompany()` → `RequestMatch.createMany`
 * İkisi de PROVISIONING/BACKFILL işidir; bir sayfa görüntülemesi (hatta nav
 * bağlantısının prefetch'i) bunları tetiklememelidir.
 *
 * STARVATION. Backfill aday sorgusu `publishedAt desc` ile ilk 100 talebi
 * seçiyordu. `skipDuplicates` zaten yazılmış eşleşmeleri atlıyor ama sorgu
 * HER TURDA aynı 100 talebi seçtiği için 101. talebe hiç sıra gelmiyordu.
 * Çözüm kalıcı bir cursor DEĞİL, FAIL-CLOSED bir yüklem: yalnız o şirket için
 * eşleşmesi OLMAYAN talepler aday olur (`requestMatches: { none: { companyId } }`).
 * Böylece her tur kalan gerçekten azalır ve migration gerekmez —
 * `@@unique([requestId, companyId])` zaten şemada vardır.
 *
 * KATEGORİ SAHİPLİĞİ. `REQUEST_CATEGORIES` slug/name/description/sortOrder
 * için kanonik kaynaktır. `isActive` ise OPERASYONEL/ADMIN kontrolüdür: yeni
 * satır registry varsayılanıyla oluşur, mevcut satırın `isActive` değeri job
 * tarafından DEĞİŞTİRİLMEZ, admin'in kapattığı kategori yeniden açılmaz,
 * silme yapılmaz ve `syncCompanyCategories` devre dışı bir kategoriyi yan
 * etkiyle aktifleştirmez.
 *
 * SALT-OKUNUR. Gerçek veritabanı açılmaz; üretim fonksiyonlarına sahte
 * istemci enjekte edilir.
 */

process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://verifier:verifier@127.0.0.1:1/none?schema=public";

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const SRC = join(ROOT, "src");

const problems: string[] = [];

function ok(id: string, condition: boolean, detail: string): void {
  if (!condition) problems.push(`${id}: ${detail}`);
}

function read(file: string): string {
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

/** Yorumları atar — açıklamada geçen ad ÇAĞRI sayılmaz. */
function code(file: string): string {
  return read(file)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/** Üretim modülleri TEMBEL yüklenir (statik import env atamasının üstüne hoist edilir). */
async function loadProduction() {
  const [categories, distribute] = await Promise.all([
    import("../src/server/company/sync-company-categories"),
    import("../src/server/request/distribute-request"),
  ]);
  return {
    ensureEngineCategories: categories.ensureEngineCategories as (
      db?: unknown,
    ) => Promise<unknown>,
    syncCompanyCategories: categories.syncCompanyCategories as (
      companyId: string,
      slugs: string[],
      db?: unknown,
    ) => Promise<unknown>,
    backfillMatchesForCompany: distribute.backfillMatchesForCompany as (
      companyId: string,
      options?: unknown,
    ) => Promise<{ created: number }>,
    backfillMatchesForAllCompanies: (
      distribute as Record<string, unknown>
    ).backfillMatchesForAllCompanies as
      | ((options?: unknown) => Promise<{ companies: number; created: number }>)
      | undefined,
  };
}

/* ------------------------------------------------------------------ *
 * 1. RENDER SINIRI
 * ------------------------------------------------------------------ */

const SUPPLIER_PAGE = join(SRC, "app/panel/talepler/page.tsx");
{
  const source = code(SUPPLIER_PAGE);
  ok("P1-sayfa-var", source.length > 0, "tedarikçi talepler sayfası okunamadı");
  for (const fn of ["ensureEngineCategories", "backfillMatchesForCompany"]) {
    ok(
      `P1-render-cagri-yok/${fn}`,
      !new RegExp(`\\b${fn}\\s*\\(`).test(source),
      `render sırasında ${fn}(...) çağrılıyor`,
    );
    ok(
      `P1-import-yok/${fn}`,
      !new RegExp(`^\\s*import[^;]*\\b${fn}\\b`, "m").test(source),
      `render sayfası ${fn} import ediyor`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * 2. AÇIK JOB SINIRLARI
 * ------------------------------------------------------------------ */

const CATEGORY_JOB = join(SRC, "app/api/cron/category-provisioning/route.ts");
const BACKFILL_JOB = join(SRC, "app/api/cron/match-backfill/route.ts");

for (const [id, file] of [
  ["kategori", CATEGORY_JOB],
  ["backfill", BACKFILL_JOB],
] as const) {
  const source = code(file);
  ok(`P2-job-var/${id}`, source.length > 0, `korumalı job rotası yok: ${file}`);
  ok(
    `P2-cron-secret/${id}`,
    /process\.env\.CRON_SECRET/.test(source) && /Bearer \$\{secret\}/.test(source),
    "depodaki mevcut CRON_SECRET fail-closed deseni kullanılmıyor",
  );
  ok(`P2-401/${id}`, /status:\s*401/.test(source), "yetkisiz çağrı 401 döndürmüyor");
  ok(
    `P2-istemci-companyId-yok/${id}`,
    !/req(uest)?\.(json|nextUrl)/.test(source),
    "job istemciden gövde/sorgu okuyor — companyId istemciden gelemez",
  );
}

const VERCEL = join(ROOT, "../../vercel.json");
{
  const source = read(VERCEL);
  ok(
    "P2-vercel-kategori",
    /\/api\/cron\/category-provisioning/.test(source),
    "vercel.json içinde kategori provisioning cron kaydı yok",
  );
  ok(
    "P2-vercel-backfill",
    /\/api\/cron\/match-backfill/.test(source),
    "vercel.json içinde backfill cron kaydı yok",
  );
}

/* ------------------------------------------------------------------ *
 * 3. GERÇEK OLAY TETİKLEYİCİLERİ
 * ------------------------------------------------------------------ */

const TRIGGERS: [string, string][] = [
  ["sirket-olusturma", join(SRC, "server/company/create-company.ts")],
  ["kategori-guncelleme", join(SRC, "app/api/company/route.ts")],
  ["admin-status", join(SRC, "app/api/admin/companies/[id]/route.ts")],
];

for (const [id, file] of TRIGGERS) {
  const source = code(file);
  ok(
    `P3-tetikleyici/${id}`,
    /backfillMatchesForCompany\s*\(/.test(source),
    "gerçek olay yolunda backfill tetiklenmiyor",
  );
}

{
  /* Yeni request publish MEVCUT dağıtım yolunu korur. */
  const createRequest = code(join(SRC, "server/request/create-request.ts"));
  ok(
    "P3-publish-degismedi",
    /distributeRequestToCompanies\s*\(/.test(createRequest),
    "request publish mevcut dağıtım yolunu kaybetti",
  );
}

{
  /**
   * YALNIZ EŞLEŞMEYİ ETKİLEYEN GÜNCELLEME TETİKLER. İsim/logo gibi profil
   * değişikliği gereksiz toplu backfill üretmemelidir: tetikleyici
   * `hasCategories` dalının İÇİNDE olmalıdır.
   */
  const companyRoute = code(join(SRC, "app/api/company/route.ts"));
  const categoryBranch =
    /if \(hasCategories\) \{([\s\S]*?)\n    \}/.exec(companyRoute)?.[1] ?? "";
  ok(
    "P3-yalniz-kategori-tetikler",
    /backfillMatchesForCompany\s*\(/.test(categoryBranch),
    "backfill kategori dalının içinde değil — profil güncellemesi de tetikler",
  );
  const profileBranch =
    /if \(hasProfile[\s\S]{0,400}/.exec(companyRoute)?.[0] ?? "";
  ok(
    "P3-profil-tetiklemez",
    !/backfillMatchesForCompany\s*\(/.test(profileBranch),
    "profil güncelleme dalı backfill tetikliyor",
  );
  ok(
    "P3-sunucu-companyId",
    /backfillMatchesForCompany\(\s*workspace\.companyId\s*\)/.test(companyRoute),
    "companyId sunucudaki çalışma alanından okunmuyor",
  );
}

{
  /**
   * ADMIN DURUM DEĞİŞİKLİĞİ. Uygunluk tek kanonik kümeden okunur; rota kendi
   * ikinci listesini tutmaz. Bu rotanın BUGÜN üretebildiği durumlar
   * `COMPANY_STATUSES` ile sınırlıdır — `PENDING_VERIFICATION` bu yoldan
   * ÜRETİLEMEZ ve hayalî bir yol test edilmez; o durum şirket oluşturulurken
   * verilir ve reconciliation cron'u kapsar.
   */
  const adminRoute = code(join(SRC, "app/api/admin/companies/[id]/route.ts"));
  ok(
    "P3-admin-kanonik-kume",
    /BACKFILL_ELIGIBLE_COMPANY_STATUSES/.test(adminRoute),
    "admin rotası uygunluk için ikinci bir liste tutuyor",
  );
  const statuses =
    /const COMPANY_STATUSES = \[([^\]]*)\]/.exec(adminRoute)?.[1] ?? "";
  ok(
    "P3-admin-uretebildigi-durumlar",
    /"ACTIVE"/.test(statuses) && !/"PENDING_VERIFICATION"/.test(statuses),
    `admin rotasının ürettiği durumlar beklenenden farklı: ${statuses.trim()}`,
  );
  ok(
    "P3-admin-sunucu-companyId",
    /backfillMatchesForCompany\(\s*updated\.id\s*\)/.test(adminRoute),
    "companyId sunucuda güncellenen kayıttan okunmuyor",
  );
}

{
  /**
   * OLAY HATASI ANA MUTASYONU GERİ ALMAZ ve PII SIZDIRMAZ.
   * Her tetikleyici `try/catch` ile sarılıdır ve log yalnız sabit bir etiket
   * ile hata nesnesini yazar — şirket adı, e-posta, payload yazılmaz.
   */
  for (const [id, file] of TRIGGERS) {
    const source = code(file);
    /**
     * Pencere çağrıdan İLERİ doğru okunur. Lazy bir `}` eşleşmesi `catch`
     * bloğundan önce kapanıyordu; çağrıdan GERİYE bakmak ise rotanın
     * ilgisiz kodunu (`body`, `company.name`) PII sanıyordu — iki yanlış
     * kırmızı da ölçüldü ve düzeltildi.
     */
    const at = source.indexOf("backfillMatchesForCompany(");
    const block = at >= 0 ? source.slice(at, at + 400) : "";
    ok(
      `P3-hata-yutulur/${id}`,
      /catch\s*\(/.test(block) && /console\.error/.test(block),
      "backfill hatası yakalanıp loglanmıyor — ana mutasyon riske girer",
    );
    /* PII ölçümü YALNIZ log deyimini kapsar; komşu rota kodu değil. */
    const logStatement =
      /console\.error\([^)]*\)/.exec(block)?.[0] ?? "";
    ok(
      `P3-log-var/${id}`,
      logStatement.length > 0,
      "backfill hatası için log deyimi bulunamadı",
    );
    ok(
      `P3-log-pii-yok/${id}`,
      !/company\.(name|email)|\bbody\b|payload|user\.(name|email)|slug/.test(
        logStatement,
      ),
      `backfill hata logu PII veya payload taşıyor: ${logStatement}`,
    );
  }
}

{
  /* Cron yanıtları PII taşımaz: yalnız sayaç döner. */
  for (const [id, file] of [
    ["kategori", CATEGORY_JOB],
    ["backfill", BACKFILL_JOB],
  ] as const) {
    const source = code(file);
    ok(
      `P2-yanit-pii-yok/${id}`,
      !/name|email|city|title/.test(
        /NextResponse\.json\(\s*\{\s*ok:\s*true[\s\S]{0,120}/.exec(source)?.[0] ??
          "",
      ),
      "cron yanıtı PII taşıyor",
    );
  }

  /* Cron periyotları ürün kararına uygun. */
  const vercel = read(VERCEL);
  ok(
    "P2-kategori-periyot",
    /"\/api\/cron\/category-provisioning"[\s\S]{0,80}"0 3 \* \* \*"/.test(vercel),
    "kategori provisioning periyodu `0 3 * * *` değil",
  );
  ok(
    "P2-backfill-periyot",
    /"\/api\/cron\/match-backfill"[\s\S]{0,80}"\*\/15 \* \* \* \*"/.test(vercel),
    "match backfill periyodu `*/15 * * * *` değil",
  );
}

/* ------------------------------------------------------------------ *
 * 4. KATEGORİ SAHİPLİĞİ — SAHTE İSTEMCİYLE
 * ------------------------------------------------------------------ */

type CategoryRow = {
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

function categoryDb(rows: CategoryRow[]) {
  const state = rows.map((row) => ({ ...row }));
  const deletes: string[] = [];
  const client = {
    category: {
      findMany: async () => state.map((row) => ({ ...row })),
      create: async (args: { data: CategoryRow }) => {
        state.push({ ...args.data });
        return args.data;
      },
      update: async (args: {
        where: { slug: string };
        data: Partial<CategoryRow>;
      }) => {
        const row = state.find((item) => item.slug === args.where.slug);
        if (row) Object.assign(row, args.data);
        return row;
      },
      upsert: async (args: {
        where: { slug: string };
        update: Partial<CategoryRow>;
        create: CategoryRow;
      }) => {
        const row = state.find((item) => item.slug === args.where.slug);
        if (row) {
          Object.assign(row, args.update);
          return { ...row, id: row.slug };
        }
        state.push({ ...args.create });
        return { ...args.create, id: args.create.slug };
      },
      deleteMany: async (args: { where: unknown }) => {
        deletes.push(JSON.stringify(args.where));
        return { count: 0 };
      },
    },
    companyCategory: {
      deleteMany: async () => ({ count: 0 }),
      createMany: async () => ({ count: 0 }),
    },
    $transaction: async <T,>(fn: (tx: unknown) => Promise<T>): Promise<T> =>
      fn(client),
  };
  return { client, state, deletes };
}

async function measureCategoryProvisioning(): Promise<void> {
  const { ensureEngineCategories, syncCompanyCategories } =
    await loadProduction();
  const registry = (
    await import("../src/lib/request-category-engine")
  ).REQUEST_CATEGORIES;

  /* Bir kategori eksik, biri drift etmiş, biri admin tarafından kapatılmış. */
  const first = registry[0]!;
  const second = registry[1]!;
  const fake = categoryDb([
    {
      slug: first.id,
      name: "ESKI AD",
      description: "eski",
      sortOrder: 99,
      isActive: true,
    },
    {
      slug: second.id,
      name: second.label,
      description: second.description ?? null,
      sortOrder: 1,
      isActive: false,
    },
  ]);

  await ensureEngineCategories(fake.client);

  ok(
    "P4-eksik-olusturuldu",
    fake.state.length === registry.length,
    `beklenen ${registry.length} kategori, ölçülen ${fake.state.length}`,
  );
  const drifted = fake.state.find((row) => row.slug === first.id);
  ok(
    "P4-metadata-drift-duzeltildi",
    drifted?.name === first.label && drifted?.sortOrder === 0,
    `metadata düzeltilmedi: ${JSON.stringify(drifted)}`,
  );
  const disabled = fake.state.find((row) => row.slug === second.id);
  ok(
    "P4-isActive-korundu",
    disabled?.isActive === false,
    "admin tarafından kapatılan kategori job tarafından yeniden açıldı",
  );
  ok(
    "P4-yeni-satir-aktif",
    fake.state
      .filter((row) => row.slug !== second.id)
      .every((row) => row.isActive === true),
    "yeni satırlar registry varsayılanıyla oluşturulmadı",
  );
  ok("P4-silme-yok", fake.deletes.length === 0, "job kategori sildi");

  /* İkinci tur idempotent: durum değişmez. */
  const before = JSON.stringify(fake.state);
  await ensureEngineCategories(fake.client);
  ok(
    "P4-idempotent",
    JSON.stringify(fake.state) === before,
    "ikinci tur durumu değiştirdi",
  );

  /* `syncCompanyCategories` devre dışı kategoriyi AKTİFLEŞTİRMEZ. */
  await syncCompanyCategories("c1", [second.id], fake.client);
  ok(
    "P4-sync-aktiflestirmez",
    fake.state.find((row) => row.slug === second.id)?.isActive === false,
    "şirket kategori senkronu devre dışı kategoriyi aktifleştirdi",
  );
}

/* ------------------------------------------------------------------ *
 * 5. BACKFILL — STARVATION, DUPLICATE, SIZINTI
 * ------------------------------------------------------------------ */

type MatchRow = { requestId: string; companyId: string };

function backfillDb(options: {
  companies: { id: string; city: string | null; categoryId: string }[];
  requests: { id: string; city: string | null; categoryId: string }[];
  matches?: MatchRow[];
}) {
  const matches: MatchRow[] = [...(options.matches ?? [])];
  let notificationWrites = 0;

  const client = {
    company: {
      findFirst: async (args: { where: { id?: string } }) => {
        const company = options.companies.find((c) => c.id === args.where.id);
        if (!company) return null;
        return {
          id: company.id,
          city: company.city,
          categories: [{ categoryId: company.categoryId }],
        };
      },
      findMany: async () =>
        [...options.companies]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((c) => ({ id: c.id })),
    },
    companyMember: {
      findMany: async () => [] as { userId: string }[],
    },
    request: {
      findMany: async (args: {
        where: Record<string, unknown>;
        take?: number;
      }) => {
        /* FAIL-CLOSED YÜKLEM: yalnız eşleşmesi OLMAYAN talepler aday. */
        const none = (
          args.where?.["requestMatches"] as
            | { none?: { companyId?: string } }
            | undefined
        )?.none;
        const companyId = none?.companyId;
        const eligible = options.requests.filter((request) => {
          if (companyId === undefined) return true;
          return !matches.some(
            (match) =>
              match.requestId === request.id && match.companyId === companyId,
          );
        });
        return eligible.slice(0, args.take ?? eligible.length).map((r) => ({
          id: r.id,
          city: r.city,
          categoryId: r.categoryId,
          category: { name: "kategori" },
        }));
      },
    },
    requestMatch: {
      createMany: async (args: {
        data: MatchRow[];
        skipDuplicates?: boolean;
      }) => {
        let created = 0;
        for (const row of args.data) {
          const exists = matches.some(
            (match) =>
              match.requestId === row.requestId &&
              match.companyId === row.companyId,
          );
          if (exists && args.skipDuplicates) continue;
          matches.push({ requestId: row.requestId, companyId: row.companyId });
          created += 1;
        }
        return { count: created };
      },
    },
    notification: {
      createMany: async () => {
        notificationWrites += 1;
        return { count: 0 };
      },
    },
  };

  return {
    client,
    matches,
    get notificationWrites() {
      return notificationWrites;
    },
  };
}

async function measureBackfill(): Promise<void> {
  const { backfillMatchesForCompany, backfillMatchesForAllCompanies } =
    await loadProduction();

  /* 101+ uygun talep: ilk tur 100, ikinci tur KALAN. */
  const requests = Array.from({ length: 101 }, (_, index) => ({
    id: `r${String(index).padStart(3, "0")}`,
    city: "İstanbul",
    categoryId: "cat-1",
  }));
  const fake = backfillDb({
    companies: [{ id: "co-1", city: "İstanbul", categoryId: "cat-1" }],
    requests,
  });

  const first = await backfillMatchesForCompany("co-1", { db: fake.client });
  ok("P5-ilk-tur", first.created === 100, `ilk tur ${first.created}, beklenen 100`);

  const second = await backfillMatchesForCompany("co-1", { db: fake.client });
  ok(
    "P5-kalan-islenir",
    second.created === 1,
    `ikinci tur ${second.created}, beklenen 1 — starvation`,
  );

  const third = await backfillMatchesForCompany("co-1", { db: fake.client });
  ok("P5-ucuncu-tur-bos", third.created === 0, `üçüncü tur ${third.created}`);
  ok(
    "P5-duplicate-yok",
    fake.matches.length === 101,
    `toplam eşleşme ${fake.matches.length}, beklenen 101`,
  );
  ok(
    "P5-notification-yok",
    fake.notificationWrites === 0,
    "backfill bildirim üretti",
  );

  /* Çapraz şirket sızıntısı: başka şirket için satır oluşmaz. */
  ok(
    "P5-capraz-sirket-yok",
    fake.matches.every((match) => match.companyId === "co-1"),
    "backfill başka şirket için eşleşme üretti",
  );

  /* Bilinmeyen / inactive şirket fail-closed. */
  const unknown = await backfillMatchesForCompany("yok", { db: fake.client });
  ok("P5-bilinmeyen-sirket", unknown.created === 0, "bilinmeyen şirket yazdı");

  /* Bütün şirketler kapsanır; ilk şirket sonrakileri aç bırakmaz. */
  if (backfillMatchesForAllCompanies) {
    const many = backfillDb({
      companies: [
        { id: "co-b", city: "İstanbul", categoryId: "cat-1" },
        { id: "co-a", city: "İstanbul", categoryId: "cat-1" },
        { id: "co-c", city: "İstanbul", categoryId: "cat-1" },
      ],
      requests: requests.slice(0, 3),
    });
    const all = await backfillMatchesForAllCompanies({ db: many.client });
    ok(
      "P5-tum-sirketler",
      all.companies === 3,
      `taranan şirket ${all.companies}, beklenen 3`,
    );
    const covered = new Set(many.matches.map((match) => match.companyId));
    ok(
      "P5-starvation-yok",
      covered.size === 3,
      `yalnız ${[...covered].join(",")} şirketi işlendi — starvation`,
    );
  } else {
    ok("P5-toplu-job-var", false, "backfillMatchesForAllCompanies yok");
  }
}

/* ------------------------------------------------------------------ *
 * 6. SHADOW KORUNUR
 * ------------------------------------------------------------------ */

{
  const distribute = code(join(SRC, "server/request/distribute-request.ts"));
  const backfillStart = distribute.indexOf("export async function backfillMatchesForCompany");
  const backfillBody =
    backfillStart >= 0 ? distribute.slice(backfillStart, backfillStart + 8000) : "";
  ok(
    "P6-matching-v3-yok",
    backfillBody.length > 0 && !/matching-v3|MATCHER_MODE/.test(backfillBody),
    "backfill Matching V3'e referans veriyor — SHADOW durumu riske girer",
  );
  const matcher = read(join(SRC, "lib/matching-v3/matcher-version.ts"));
  ok(
    "P6-shadow-sabiti",
    /MATCHER_MODE\s*=\s*"shadow"/.test(matcher),
    "Matching V3 SHADOW sabiti değişti",
  );
}

/* ------------------------------------------------------------------ *
 * HÜKÜM
 * ------------------------------------------------------------------ */

async function guarded(id: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    const message = (error as Error)?.message ?? String(error);
    ok(id, false, `sahte istemciyle ölçülemedi: ${message.slice(0, 140)}`);
  }
}

/**
 * ÜRETİM TELEMETRİSİ ÖLÇÜM SIRASINDA SUSTURULUR.
 *
 * `logBackfillStarted` / `logBackfillCompleted` her satıra `timestamp` ve
 * `durationMs` yazar; bu satırlar çıktıya karışırsa doğrulayıcının kendi
 * raporu iki koşuda ASLA byte-birebir olmaz (ölçüldü). Susturma yalnız
 * ölçüm penceresini kapsar ve üretim davranışını değiştirmez.
 */
async function main(): Promise<void> {
  const original = { log: console.log, info: console.info, error: console.error };
  console.log = () => {};
  console.info = () => {};
  console.error = () => {};
  try {
    await guarded("P4-olculebilir", measureCategoryProvisioning);
    await guarded("P5-olculebilir", measureBackfill);
  } finally {
    console.log = original.log;
    console.info = original.info;
    console.error = original.error;
  }
}

void main().then(() => {
  console.log(`PROBLEMS=${problems.length}`);
  for (const problem of problems.slice(0, 30)) console.log(`  - ${problem}`);
  console.log("===== HUKUM =====");
  console.log(
    problems.length === 0
      ? "GECTI: provisioning ve backfill açık job sınırında; starvation yok."
      : "KALDI: provisioning/backfill sınırı sözleşmeyi ihlal ediyor.",
  );
  process.exit(problems.length === 0 ? 0 : 1);
});
