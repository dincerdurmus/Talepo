/**
 * KABUL VERİTABANI MİGRASYON SAPMA ÖLÇÜMÜ — SALT OKUNUR.
 *
 * NEDEN BU BETİK VAR. `prisma migrate status` bu depoda KAPALIDIR ve kapalı
 * kalır: `acceptance-prisma-tls-v1.ts` şema motorunun `sslmode=verify-full`
 * okumasını ölçemediğimizi söyler, ölçülmemiş doğrulama da doğrulama değildir.
 * Ama `migrate status`'ün CEVAPLADIĞI soru hâlâ sorulabilir — üstelik TLS'i
 * ÖLÇÜLMÜŞ olan yoldan: uygulamanın kendi `pg` bağlantısı (pinlenmiş CA +
 * parmak izi eşleşmesi). `apply-acceptance-migration-v1.ts` aynı kapıyı
 * kullanır; bu betik onun salt okunur ikizidir.
 *
 * NE ÖLÇER:
 *  - Diskteki her `prisma/migrations/<ad>/migration.sql` uygulanmış mı;
 *  - Uygulanmış kaydın checksum'ı diskteki dosyayla tutuyor mu;
 *  - TUTMUYORSA sapma YALNIZ satır sonundan mı kaynaklanıyor (Windows
 *    `core.autocrlf=true` checkout'u LF'i CRLF'e çevirir, checksum değişir)
 *    yoksa gerçek içerik farkı mı;
 *  - Veritabanında olup diskte olmayan kayıtlar;
 *  - Yarım kalmış / geri alınmış migrasyonlar.
 *
 * NE YAPMAZ: tek bir yazma komutu çalıştırmaz. Migrasyon uygulamaz, checksum
 * tamir etmez, `_prisma_migrations` satırı yazmaz. Üretime ve Staging'e
 * dokunmaz — hedef `ACCEPTANCE_ALLOWLISTED` değilse bağlantı bile açılmaz.
 * Sır yazdırmaz; her satır tek redaksiyon otoritesinden geçer.
 *
 * Koşum (apps/web):
 *   npx tsx scripts/verify-acceptance-migration-drift-v1.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { isAcceptanceCliEntrypoint } from "./lib/acceptance-cli-entry-v1";
import { evaluateAcceptanceDbTarget } from "./lib/acceptance-db-target-v1";
import { formatAcceptanceError, redactAcceptanceOutput } from "./lib/acceptance-redaction-v1";
import { loadAcceptanceEnv } from "./lib/load-acceptance-env";

let prisma!: typeof import("@/lib/prisma").prisma;

export const MIGRATIONS_DIR = join(__dirname, "..", "prisma", "migrations");

/** Prisma migrasyon klasör adı: 14 haneli damga + ad. */
const MIGRATION_DIR_PATTERN = /^[0-9]{14}_[A-Za-z0-9_]+$/;

export type LocalMigration = {
  name: string;
  /** Diskteki baytların sha256'sı — Prisma'nın kullandığı hesap. */
  checksumOnDisk: string;
  /** Aynı içerik LF'e indirgenmiş hâliyle. */
  checksumLf: string;
  /** Aynı içerik CRLF'e yükseltilmiş hâliyle. */
  checksumCrlf: string;
  /** Diskteki dosya CRLF taşıyor mu (tanı için). */
  diskHasCrlf: boolean;
};

export type AppliedMigration = {
  migration_name: string;
  checksum: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
  applied_steps_count: number;
};

export type DriftVerdict =
  | "MATCH"
  | "DRIFT_LINE_ENDING_ONLY"
  | "DRIFT_CONTENT"
  | "NOT_APPLIED"
  | "UNFINISHED_OR_ROLLED_BACK"
  | "IN_DB_ONLY";

export type DriftRow = {
  name: string;
  verdict: DriftVerdict;
  /** İnsana tek satır açıklama; sır içermez. */
  detail: string;
};

function sha256(buffer: Buffer | string): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Diskten okunan baytları üç yazımla birden özetler. */
export function describeLocalMigration(name: string, bytes: Buffer): LocalMigration {
  const text = bytes.toString("utf8");
  const lf = text.replace(/\r\n/g, "\n");
  const crlf = lf.replace(/\n/g, "\r\n");
  return {
    name,
    checksumOnDisk: sha256(bytes),
    checksumLf: sha256(Buffer.from(lf, "utf8")),
    checksumCrlf: sha256(Buffer.from(crlf, "utf8")),
    diskHasCrlf: bytes.includes(Buffer.from("\r\n")),
  };
}

export function readLocalMigrations(dir: string = MIGRATIONS_DIR): LocalMigration[] {
  return readdirSync(dir)
    .filter((name) => MIGRATION_DIR_PATTERN.test(name))
    .sort()
    .flatMap((name) => {
      const sqlPath = join(dir, name, "migration.sql");
      if (!existsSync(sqlPath)) return [];
      return [describeLocalMigration(name, readFileSync(sqlPath))];
    });
}

/**
 * Kararın tamamı burada ve hiçbir çıktısı yok — böylece mutasyon kontrolüyle
 * sürülebilir. Sıra sözleşmedir: önce kaydın sağlığı (yarım kalmış mı), sonra
 * checksum eşleşmesi, en son satır sonu açıklaması. Ters sırada, yarım kalmış
 * bir migrasyon checksum'ı tuttuğu için "MATCH" görünürdü.
 */
export function classifyDrift(
  local: LocalMigration[],
  applied: AppliedMigration[],
): DriftRow[] {
  const appliedByName = new Map(applied.map((row) => [row.migration_name, row]));
  const rows: DriftRow[] = [];

  for (const migration of local) {
    const row = appliedByName.get(migration.name);
    if (!row) {
      rows.push({
        name: migration.name,
        verdict: "NOT_APPLIED",
        detail: "diskte var, veritabanında kaydı yok",
      });
      continue;
    }
    if (row.finished_at === null || row.rolled_back_at !== null) {
      rows.push({
        name: migration.name,
        verdict: "UNFINISHED_OR_ROLLED_BACK",
        detail:
          row.rolled_back_at !== null
            ? "kayıt geri alınmış (rolled_back_at dolu)"
            : "kayıt bitmemiş (finished_at boş)",
      });
      continue;
    }
    if (row.checksum === migration.checksumOnDisk) {
      rows.push({ name: migration.name, verdict: "MATCH", detail: "checksum diskle birebir" });
      continue;
    }
    if (row.checksum === migration.checksumLf) {
      rows.push({
        name: migration.name,
        verdict: "DRIFT_LINE_ENDING_ONLY",
        detail: `kayıt LF ile hesaplanmış, disk ${migration.diskHasCrlf ? "CRLF" : "LF-dışı"} taşıyor`,
      });
      continue;
    }
    if (row.checksum === migration.checksumCrlf) {
      rows.push({
        name: migration.name,
        verdict: "DRIFT_LINE_ENDING_ONLY",
        detail: "kayıt CRLF ile hesaplanmış, disk LF taşıyor",
      });
      continue;
    }
    rows.push({
      name: migration.name,
      verdict: "DRIFT_CONTENT",
      detail: "checksum hiçbir satır sonu yazımıyla tutmuyor — içerik farkı",
    });
  }

  const localNames = new Set(local.map((m) => m.name));
  for (const row of applied) {
    if (localNames.has(row.migration_name)) continue;
    rows.push({
      name: row.migration_name,
      verdict: "IN_DB_ONLY",
      detail: "veritabanında var, diskte klasörü yok",
    });
  }

  return rows;
}

/**
 * MUTASYON KONTROLÜ — kapı kırmızı verebildiğini KANITLAR.
 *
 * Her sapma sınıfı için kasıtlı bir kusur üretilir ve sınıflandırıcının onu
 * yakaladığı doğrulanır. Bu kontrol geçmeden gerçek ölçüme geçilmez: yalnız
 * "MATCH" üretebilen bir kapı, hiçbir şeyi kanıtlamaz.
 */
export function runMutationControl(): { passed: number; failures: string[] } {
  const failures: string[] = [];
  let passed = 0;

  const lfBytes = Buffer.from("-- t\nSELECT 1;\n", "utf8");
  const crlfBytes = Buffer.from("-- t\r\nSELECT 1;\r\n", "utf8");
  const lfLocal = describeLocalMigration("20260101000000_control", lfBytes);
  const crlfLocal = describeLocalMigration("20260101000000_control", crlfBytes);

  const baseRow = (checksum: string): AppliedMigration => ({
    migration_name: "20260101000000_control",
    checksum,
    finished_at: new Date(),
    rolled_back_at: null,
    applied_steps_count: 1,
  });

  const cases: Array<{ label: string; want: DriftVerdict; got: DriftVerdict }> = [
    {
      label: "birebir eşleşme MATCH verir",
      want: "MATCH",
      got: classifyDrift([lfLocal], [baseRow(lfLocal.checksumOnDisk)])[0].verdict,
    },
    {
      label: "disk CRLF, kayıt LF iken satır-sonu sapması yakalanır",
      want: "DRIFT_LINE_ENDING_ONLY",
      got: classifyDrift([crlfLocal], [baseRow(crlfLocal.checksumLf)])[0].verdict,
    },
    {
      label: "disk LF, kayıt CRLF iken satır-sonu sapması yakalanır",
      want: "DRIFT_LINE_ENDING_ONLY",
      got: classifyDrift([lfLocal], [baseRow(lfLocal.checksumCrlf)])[0].verdict,
    },
    {
      label: "gerçek içerik farkı satır sonuna yazılmaz",
      want: "DRIFT_CONTENT",
      got: classifyDrift([lfLocal], [baseRow(sha256("SELECT 2;"))])[0].verdict,
    },
    {
      label: "kayıtsız migrasyon NOT_APPLIED verir",
      want: "NOT_APPLIED",
      got: classifyDrift([lfLocal], [])[0].verdict,
    },
    {
      label: "bitmemiş kayıt checksum tutsa bile MATCH sayılmaz",
      want: "UNFINISHED_OR_ROLLED_BACK",
      got: classifyDrift(
        [lfLocal],
        [{ ...baseRow(lfLocal.checksumOnDisk), finished_at: null }],
      )[0].verdict,
    },
    {
      label: "geri alınmış kayıt checksum tutsa bile MATCH sayılmaz",
      want: "UNFINISHED_OR_ROLLED_BACK",
      got: classifyDrift(
        [lfLocal],
        [{ ...baseRow(lfLocal.checksumOnDisk), rolled_back_at: new Date() }],
      )[0].verdict,
    },
    {
      label: "diskte olmayan kayıt IN_DB_ONLY verir",
      want: "IN_DB_ONLY",
      got: classifyDrift([], [baseRow("deadbeef")])[0].verdict,
    },
  ];

  for (const testCase of cases) {
    if (testCase.got === testCase.want) passed += 1;
    else failures.push(`${testCase.label}: beklenen ${testCase.want}, gelen ${testCase.got}`);
  }

  return { passed, failures };
}

function say(line: string): void {
  console.log(redactAcceptanceOutput(line));
}

async function main(): Promise<void> {
  const control = runMutationControl();
  say(`MUTASYON KONTROLÜ: ${control.passed}/${control.passed + control.failures.length}`);
  if (control.failures.length > 0) {
    for (const failure of control.failures) console.error(`  KONTROL KIRIK — ${failure}`);
    console.error("FAIL — sınıflandırıcı kendi kontrolünü geçmedi; ölçüme geçilmedi");
    process.exitCode = 1;
    return;
  }

  loadAcceptanceEnv();

  // Hedef sınıflandırması env uygulandıktan SONRA ve bağlantı açılmadan ÖNCE.
  const decision = evaluateAcceptanceDbTarget(process.env);
  if (!decision.ok) {
    console.error(`FAIL — ${decision.reason}: ${decision.detail}`);
    process.exitCode = 1;
    return;
  }
  say("TARGET_CLASSIFICATION=ACCEPTANCE_ALLOWLISTED");
  say("DB WRITE: no (salt okunur ölçüm)");
  say("PRODUCTION TOUCHED: no");

  const local = readLocalMigrations();
  say(`DİSKTEKİ MİGRASYON: ${local.length}`);
  say(`DİSKTE CRLF TAŞIYAN: ${local.filter((m) => m.diskHasCrlf).length}`);

  ({ prisma } = await import("@/lib/prisma"));
  const applied = await prisma.$queryRawUnsafe<AppliedMigration[]>(
    `SELECT migration_name, checksum, finished_at, rolled_back_at, applied_steps_count
       FROM "_prisma_migrations"
      ORDER BY migration_name ASC`,
  );
  say(`VERİTABANINDAKİ KAYIT: ${applied.length}`);

  const rows = classifyDrift(local, applied);
  const counts = new Map<DriftVerdict, number>();
  for (const row of rows) counts.set(row.verdict, (counts.get(row.verdict) ?? 0) + 1);

  say("");
  say("ÖZET");
  for (const verdict of [
    "MATCH",
    "DRIFT_LINE_ENDING_ONLY",
    "DRIFT_CONTENT",
    "NOT_APPLIED",
    "UNFINISHED_OR_ROLLED_BACK",
    "IN_DB_ONLY",
  ] as DriftVerdict[]) {
    say(`  ${verdict}: ${counts.get(verdict) ?? 0}`);
  }

  /**
   * Bugün eşleşen kayıtlar HANGİ yazımla hesaplanmış? Bu, aynı soruyu başka
   * bir makinede sorduğumuzda ne olacağını söyler: CRLF ile hesaplanmış bir
   * checksum, LF checkout'unda (Linux/CI/Vercel) "modified" görünür. Yalnız
   * "bugün temiz" demek bu riski gizlerdi.
   */
  const localByName = new Map(local.map((m) => [m.name, m]));
  let crlfComputed = 0;
  let lfComputed = 0;
  let writingNeutral = 0;
  for (const row of rows.filter((r) => r.verdict === "MATCH")) {
    const migration = localByName.get(row.name);
    const appliedRow = applied.find((a) => a.migration_name === row.name);
    if (!migration || !appliedRow) continue;
    if (migration.checksumLf === migration.checksumCrlf) writingNeutral += 1;
    else if (appliedRow.checksum === migration.checksumCrlf) crlfComputed += 1;
    else if (appliedRow.checksum === migration.checksumLf) lfComputed += 1;
  }
  say("");
  say("EŞLEŞENLERİN YAZIMI (başka makinede ne olur)");
  say(`  CRLF ile hesaplanmış (LF checkout'ta sapar): ${crlfComputed}`);
  say(`  LF ile hesaplanmış (CRLF checkout'ta sapar): ${lfComputed}`);
  say(`  satır sonundan bağımsız: ${writingNeutral}`);

  const notable = rows.filter((row) => row.verdict !== "MATCH");
  if (notable.length > 0) {
    say("");
    say("SAPAN KAYITLAR");
    for (const row of notable) say(`  ${row.name} — ${row.verdict} — ${row.detail}`);
  }

  say("");
  say("SECRETS PRINTED: no");

  const blocking = rows.filter(
    (row) =>
      row.verdict === "DRIFT_CONTENT" ||
      row.verdict === "NOT_APPLIED" ||
      row.verdict === "UNFINISHED_OR_ROLLED_BACK" ||
      row.verdict === "IN_DB_ONLY",
  );
  if (blocking.length > 0) {
    console.error(`FAIL — ${blocking.length} kayıt satır sonuyla AÇIKLANAMAYAN sapma gösteriyor`);
    process.exitCode = 1;
    return;
  }

  const lineEndingOnly = counts.get("DRIFT_LINE_ENDING_ONLY") ?? 0;
  console.log(
    lineEndingOnly > 0
      ? `PASS — içerik sapması yok; ${lineEndingOnly} kayıt YALNIZ satır sonundan sapıyor`
      : "PASS — kabul veritabanı migrasyon geçmişi diskle birebir",
  );
}

if (isAcceptanceCliEntrypoint(module)) {
  main()
    .catch((error) => {
      console.error(`FAIL — ${formatAcceptanceError(error)}`);
      process.exit(1);
    })
    .finally(() => {
      void prisma?.$disconnect?.();
    });
}
