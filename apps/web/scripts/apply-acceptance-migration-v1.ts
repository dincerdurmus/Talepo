/**
 * KABUL VERİTABANINA TEK BİR MİGRASYON UYGULAR — BAŞKA HİÇBİR HEDEFE.
 *
 * NEDEN BU BETİK VAR. Prisma'nın kendi migrate yolu KAPALIDIR ve kapalı
 * kalmalıdır: `acceptance-prisma-tls-v1.ts` şunu söyler — şema motorunun
 * `sslmode=verify-full` okumasını buradan ÖLÇEMEYİZ, ölçülmemiş bir doğrulama
 * da doğrulama değildir. Bu betik o kapıyı AÇMAZ; başka bir kapıdan girer:
 * uygulamanın kendi `pg` bağlantısı. O bağlantıda TLS doğrulaması ÖLÇÜLMÜŞTÜR
 * (pinlenmiş CA + parmak izi eşleşmesi, `verify-acceptance-db-target-v1`),
 * yani burada TLS zayıflatılmaz — tam tersine, ölçülmüş olan tercih edilir.
 *
 * NE YAPMAZ:
 *  - Üretim veritabanına dokunmaz. Hedef `ACCEPTANCE_ALLOWLISTED` değilse
 *    tek bir komut bile çalıştırmaz (S-16: üretim migrasyonu AYRI kurucu
 *    onayıdır ve bu betiğin kapsamında DEĞİLDİR).
 *  - Migrasyon üretmez, şema karşılaştırmaz, `prisma migrate dev` yerine
 *    geçmez. Yalnız DİSKTEKİ bir `migration.sql` dosyasını uygular.
 *  - Sırrı ekrana yazmaz; her satır tek redaksiyon otoritesinden geçer.
 *
 * Koşum:
 *   NODE_EXTRA_CA_CERTS=.acceptance/supabase-ca.crt \
 *   npx tsx scripts/apply-acceptance-migration-v1.ts 20260923120000_request_pending_review --apply
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { isAcceptanceCliEntrypoint } from "./lib/acceptance-cli-entry-v1";
import { evaluateAcceptanceDbTarget } from "./lib/acceptance-db-target-v1";
import { formatAcceptanceError, redactAcceptanceOutput } from "./lib/acceptance-redaction-v1";
import { loadAcceptanceEnv } from "./lib/load-acceptance-env";

let prisma!: typeof import("@/lib/prisma").prisma;

function say(line: string): void {
  console.log(redactAcceptanceOutput(line));
}

async function main(): Promise<void> {
  const name = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!name || !/^[0-9]{14}_[a-z0-9_]+$/.test(name)) {
    console.error("FAIL — migrasyon klasör adı gerekli (ör. 20260923120000_request_pending_review)");
    process.exit(1);
  }

  loadAcceptanceEnv();

  // Hedef sınıflandırması env uygulandıktan SONRA ve bağlantı açılmadan ÖNCE.
  const decision = evaluateAcceptanceDbTarget(process.env);
  if (!decision.ok) {
    console.error(`FAIL — ${decision.reason}: ${decision.detail}`);
    process.exit(1);
  }
  say("TARGET_CLASSIFICATION=ACCEPTANCE_ALLOWLISTED");

  const dir = join(__dirname, "..", "prisma", "migrations", name);
  const sqlPath = join(dir, "migration.sql");
  if (!existsSync(sqlPath)) {
    console.error("FAIL — migration.sql bulunamadı");
    process.exit(1);
  }
  const sql = readFileSync(sqlPath, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");
  say(`MIGRATION: ${name}`);
  say(`CHECKSUM: ${checksum}`);

  ({ prisma } = await import("@/lib/prisma"));

  const already = await prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
    `SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = $1`,
    name,
  );
  if (already.length > 0) {
    say("DURUM: zaten uygulanmış — hiçbir komut çalıştırılmadı");
    say("SECRETS PRINTED: no");
    console.log("PASS — kabul migrasyonu zaten yerinde");
    return;
  }

  if (!apply) {
    say("DURUM: uygulanmamış. Uygulamak için --apply verin.");
    say("DB WRITE: no");
    console.log("PASS — kuru koşu");
    return;
  }

  /**
   * `ALTER TYPE ... ADD VALUE` PostgreSQL'de bir işlem bloğu içinde
   * çalıştırılamaz, bu yüzden ifadeler tek tek ve işlemsiz gönderilir.
   * Migrasyon dosyası bu yüzden küçük ve tek amaçlı tutulur.
   */
  // Yorumlar ÖNCE atılır, sonra bölünür: bir yorum satırı noktalı virgül
  // içerebilir ve ters sıra onu ayrı bir "ifade" sanıp sözdizimi hatası verir.
  const statements = sql
    .replace(/--[^\n]*/g, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     VALUES ($1, $2, now(), $3, NULL, NULL, now(), $4)`,
    createHash("sha256").update(`${name}:${checksum}`).digest("hex").slice(0, 36),
    checksum,
    name,
    statements.length,
  );

  say(`UYGULANAN İFADE: ${statements.length}`);
  say("DB WRITE: yes (yalnız kabul veritabanı)");
  say("PRODUCTION TOUCHED: no");
  say("SECRETS PRINTED: no");
  console.log("PASS — kabul migrasyonu uygulandı");
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
