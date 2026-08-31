/**
 * Oturum kullanıcısı çözümleme sözleşmesi (FD-7 yeniden yazımı, 2026-08-31).
 * Run from apps/web: npx tsx scripts/verify-auth-fix.ts
 *
 * ESKİ HÂLİ kurucunun GERÇEK kişisel hesabının eski-DB anlık görüntüsünü
 * bekleyen bir olay-probuydu (kişisel e-posta + "≥3 talep" snapshot'ı).
 * FD-7 kararı: kişisel hesaba bağlı prob kalmaz; benzersiz güvence —
 * `resolveSessionUser`ın id→e-posta düşüşü ve çözülen kimliğin VERİ
 * BAĞLANTISI — deterministik, bu turda oluşturulan ve turda temizlenen
 * sentetik fixture'la ölçülür. Beklenti GEVŞETİLMEDİ: eski "≥3 talep,
 * ≥1 üyelik" iddiası, tam sayıya (=3, =1) sıkılaştırıldı.
 *
 * Yazma kapısı: KB-9 mekanizması (canWriteToDatabase, FD-5 acceptance
 * yolu dahil). Kapı açılmazsa hiçbir prisma import edilmez → NOT-MEASURED.
 */
import { canWriteToDatabase } from "../src/lib/verification/db-guard";
import {
  createNotMeasuredTally,
  isUnreachableDatabase,
} from "../src/lib/verification/not-measured";

let pass = 0;
let fail = 0;
const errors: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`PASS — ${name}`);
  } else {
    fail += 1;
    const msg = detail ? `${name}: ${detail}` : name;
    errors.push(msg);
    console.log(`FAIL — ${msg}`);
  }
}

const notMeasuredTally = createNotMeasuredTally();
function notMeasuredCheck(name: string, reason: string) {
  notMeasuredTally.record(name, reason);
}

const QA_EMAIL = "qa-session-resolution-v1@talepo.test";
const QA_MARKER = "acceptance:v1 QA_AUTH_CONTRACT";

async function liveChecks() {
  const hasDb = Boolean(
    process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim(),
  );
  if (!hasDb) {
    notMeasuredCheck(
      "session resolution",
      "DATABASE_URL/DIRECT_URL tanımlı değil — sözleşme ÖLÇÜLMEDİ",
    );
    return;
  }
  const guard = canWriteToDatabase();
  if (!guard.allowed) {
    notMeasuredCheck("session resolution", `${guard.reason} — sözleşme ÖLÇÜLMEDİ`);
    return;
  }

  const { prisma } = await import("../src/lib/prisma");
  const { resolveSessionUser } = await import("../src/lib/auth/sync-google-user");
  const { hashPassword } = await import("../src/lib/auth/password");
  const { createRequest } = await import("../src/server/request/create-request");

  const createdRequestIds: string[] = [];
  let qaUserId: string | null = null;
  let qaCompanyId: string | null = null;

  try {
    // Fixture: bu turda oluşturulur, sonunda kesin kimliklerle temizlenir.
    const user = await prisma.user.upsert({
      where: { email: QA_EMAIL },
      update: { status: "ACTIVE" },
      create: {
        email: QA_EMAIL,
        name: "[acceptance:v1] QA Oturum Sözleşmesi",
        biography: QA_MARKER,
        planTier: "STANDARD",
        membershipNumber: "TLP-990097",
        status: "ACTIVE",
        passwordHash: hashPassword("AcceptanceV1!test"),
      },
      select: { id: true },
    });
    qaUserId = user.id;

    const company = await prisma.company.upsert({
      where: { slug: "qa-auth-contract-v1" },
      update: {},
      create: {
        name: "[acceptance:v1] QA Auth Contract Co",
        slug: "qa-auth-contract-v1",
        description: QA_MARKER,
        createdBy: { connect: { id: user.id } },
      },
      select: { id: true },
    });
    qaCompanyId = company.id;
    await prisma.companyMember.upsert({
      where: { companyId_userId: { companyId: company.id, userId: user.id } },
      update: { status: "ACTIVE" },
      create: { companyId: company.id, userId: user.id, role: "MEMBER", status: "ACTIVE" },
    });

    for (let i = 1; i <= 3; i++) {
      const created = await createRequest(user.id, {
        title: `QA oturum sözleşmesi talebi ${i}`,
        description:
          "QA_AUTH_CONTRACT — oturum çözümleme veri bağlantısı ölçümü için sentetik talep.",
        category: { slug: "furniture", name: "Mobilya ve Ofis" },
        city: "İstanbul",
        budget: 1000 + i,
        fields: [],
        fieldValues: {},
      } as never);
      createdRequestIds.push(created.id);
    }

    // 1) id ile çözüm.
    const byId = await resolveSessionUser(user.id, QA_EMAIL, { name: "QA" });
    check(
      "id ile çözüm aynı kullanıcıyı verir",
      Boolean(byId && !byId.dbUnavailable && byId.user.id === user.id),
    );

    // 2) Bayat id + e-posta → e-posta düşüşü AYNI kullanıcıyı bulur
    //    (ölçülen tarihsel hata sınıfı: oturum id kayması).
    const byEmail = await resolveSessionUser("stale-session-id", QA_EMAIL, {
      name: "QA",
    });
    check(
      "bayat id'de e-posta düşüşü aynı kullanıcıyı bulur",
      Boolean(byEmail && !byEmail.dbUnavailable && byEmail.user.id === user.id),
    );

    // 3) Veri bağlantısı: çözülen kimlik bu turda oluşturulan kayıtların
    //    sahibidir (tam sayı — snapshot değil).
    const requests = await prisma.request.count({
      where: { createdById: byEmail!.user.id, deletedAt: null, id: { in: createdRequestIds } },
    });
    const memberships = await prisma.companyMember.count({
      where: { userId: byEmail!.user.id, status: "ACTIVE", companyId: company.id },
    });
    check("çözülen kimlik 3 talebin sahibi", requests === 3, `→ ${requests}`);
    check("çözülen kimlik 1 aktif üyeliğin sahibi", memberships === 1, `→ ${memberships}`);

    // 4) Tanınmayan id + e-posta çökmez; fallback sentezi döner ve
    //    SÖZLEŞME GEREĞİ dbUnavailable=true işaretlenir (alt katman bu
    //    kullanıcıyı kalıcı kimlik sanmasın diye — sync-google-user tail).
    const unknown = await resolveSessionUser(
      "unknown-session-id",
      "qa-unknown-nobody-v1@talepo.test",
      { name: "Bilinmeyen" },
    );
    check(
      "bilinmeyen kimlik çökmez; fallback + dbUnavailable işareti döner",
      Boolean(unknown && unknown.dbUnavailable === true && unknown.user?.email),
    );
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : "unknown";
    if (isUnreachableDatabase(error)) {
      notMeasuredCheck("session resolution", `veritabanına bağlanılamadı (${detail})`);
    } else {
      check("session resolution akışı", false, detail);
    }
  } finally {
    for (const id of createdRequestIds) {
      await prisma.notification.deleteMany({ where: { requestId: id } }).catch(() => undefined);
      await prisma.priceObservation.deleteMany({ where: { requestId: id } }).catch(() => undefined);
      await prisma.requestMatch.deleteMany({ where: { requestId: id } }).catch(() => undefined);
      await prisma.idempotencyRecord.deleteMany({ where: { resourceId: id } }).catch(() => undefined);
      await prisma.request.delete({ where: { id } }).catch(() => undefined);
    }
    if (qaUserId && qaCompanyId) {
      await prisma.companyMember
        .deleteMany({ where: { userId: qaUserId, companyId: qaCompanyId } })
        .catch(() => undefined);
    }
    if (qaCompanyId) {
      await prisma.company.delete({ where: { id: qaCompanyId } }).catch(() => undefined);
    }
    if (qaUserId) {
      await prisma.notification.deleteMany({ where: { userId: qaUserId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: qaUserId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  }
}

async function main() {
  await liveChecks();
  console.log(
    `\nverify-auth-fix: ${pass} passed, ${fail} failed, ${notMeasuredTally.count} not-measured`,
  );
  if (notMeasuredTally.count) {
    console.log("Ölçülemeyenler (yeşil DEĞİL, kırmızı da değil):");
    for (const msg of notMeasuredTally.reasons) console.log(` ? ${msg}`);
  }
  if (fail) {
    for (const msg of errors) console.error(` - ${msg}`);
    process.exit(1);
  }
  process.exit(notMeasuredTally.exitCode());
}

void main();
