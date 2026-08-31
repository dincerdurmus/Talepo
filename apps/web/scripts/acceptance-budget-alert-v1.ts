/**
 * Kabul doğrulaması — budget_change_alerts (Wave L dilimi).
 * Kabul DB'sinde sentetik fixture kurar, ÜRETİM recordRequestChanges yolunu
 * çağırır, bildirim sözleşmesini ölçer (poz/negatif/dedupe), kesin
 * etiketlerle temizler. Koşum: NODE_EXTRA_CA_CERTS=.acceptance/supabase-ca.crt
 * npx tsx scripts/acceptance-budget-alert-v1.ts
 */
import { loadAcceptanceEnv } from "./lib/load-acceptance-env";

const TAG = "acceptance:wave-l-budget-alert";

async function main() {
  loadAcceptanceEnv();
  if (process.env.TALEPO_ENVIRONMENT !== "acceptance") {
    throw new Error('TALEPO_ENVIRONMENT must be "acceptance"');
  }
  const { prisma } = await import("@/lib/prisma");
  const { recordRequestChanges } = await import("@/server/monetization/request-changes");

  console.log("=== acceptance-budget-alert-v1 ===");
  console.log("TARGET_CLASSIFICATION=ACCEPTANCE_ALLOWLISTED");

  const category = await prisma.category.findFirst({ select: { id: true } });
  if (!category) throw new Error("kategori yok");

  const suffix = "wlbudget1";
  const mk = (n: string) => `${TAG}:${n}:${suffix}`;

  // Temizlik (idempotent ön-temizlik dahil) kesin etiketle.
  async function cleanup() {
    await prisma.notification.deleteMany({ where: { message: { contains: "[WLBUDGET1]" } } });
    const reqs = await prisma.request.findMany({ where: { title: { contains: "[WLBUDGET1]" } }, select: { id: true } });
    const reqIds = reqs.map((r) => r.id);
    if (reqIds.length) {
      await prisma.requestChange.deleteMany({ where: { requestId: { in: reqIds } } });
      await prisma.opportunityWatchlistItem.deleteMany({ where: { requestId: { in: reqIds } } });
      await prisma.request.deleteMany({ where: { id: { in: reqIds } } });
    }
    const companies = await prisma.company.findMany({ where: { name: { contains: "[WLBUDGET1]" } }, select: { id: true } });
    const companyIds = companies.map((c) => c.id);
    if (companyIds.length) {
      await prisma.companyMember.deleteMany({ where: { companyId: { in: companyIds } } });
      await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    }
    await prisma.user.deleteMany({ where: { email: { contains: "wlbudget1@acceptance.talepo" } } });
  }
  await cleanup();

  // Fixture: yazar, PRO firma sahibi, STANDARD firma sahibi.
  const author = await prisma.user.create({
    data: { email: `author.wlbudget1@acceptance.talepo`, name: "WL Author", membershipNumber: "TLP-WL0001" },
  });
  const proOwner = await prisma.user.create({
    data: { email: `proowner.wlbudget1@acceptance.talepo`, name: "WL ProOwner", membershipNumber: "TLP-WL0002" },
  });
  const stdOwner = await prisma.user.create({
    data: { email: `stdowner.wlbudget1@acceptance.talepo`, name: "WL StdOwner", membershipNumber: "TLP-WL0003" },
  });
  const proCompany = await prisma.company.create({
    data: {
      name: "WL Pro AS [WLBUDGET1]", slug: "wl-pro-wlbudget1", planTier: "PROFESSIONAL",
      createdBy: { connect: { id: proOwner.id } },
      members: { create: { userId: proOwner.id, role: "OWNER", status: "ACTIVE" } },
    },
  });
  const stdCompany = await prisma.company.create({
    data: {
      name: "WL Std AS [WLBUDGET1]", slug: "wl-std-wlbudget1", planTier: "STANDARD",
      createdBy: { connect: { id: stdOwner.id } },
      members: { create: { userId: stdOwner.id, role: "OWNER", status: "ACTIVE" } },
    },
  });
  const request = await prisma.request.create({
    data: {
      title: "Test talebi [WLBUDGET1]",
      description: "Wave L bütçe alarmı kabul senaryosu",
      categoryId: category.id,
      createdById: author.id,
      status: "PUBLISHED",
      budgetMin: 1000, budgetMax: 2000,
      city: "İstanbul",
    },
  });
  await prisma.opportunityWatchlistItem.createMany({
    data: [
      { companyId: proCompany.id, requestId: request.id },
      { companyId: stdCompany.id, requestId: request.id },
    ],
  });

  // ÜRETİM YOLU: update-request'in çağırdığı fonksiyonun aynısı.
  const changed = await recordRequestChanges(
    request.id,
    { budgetMin: 1000, budgetMax: 2000, isUrgent: false, deadlineAt: null, status: "PUBLISHED" },
    { budgetMin: 1500, budgetMax: 2500, isUrgent: false, deadlineAt: null, status: "PUBLISHED" },
  );
  console.log(`recordRequestChanges → ${changed} satır`);

  const notes = await prisma.notification.findMany({
    where: { requestId: request.id, title: "Takip ettiğiniz talebin bütçesi değişti" },
    select: { userId: true, companyId: true, message: true },
  });
  const proGot = notes.some((n) => n.userId === proOwner.id && n.companyId === proCompany.id);
  const stdGot = notes.some((n) => n.userId === stdOwner.id);
  const authorGot = notes.some((n) => n.userId === author.id);
  console.log(`POZ pro firma bildirimi: ${proGot ? "PASS" : "FAIL"}`);
  console.log(`NEG standard firma bildirim ALMADI: ${!stdGot ? "PASS" : "FAIL"}`);
  console.log(`NEG yazar bildirim ALMADI: ${!authorGot ? "PASS" : "FAIL"}`);
  const msg = notes.find((n) => n.userId === proOwner.id)?.message ?? "";
  console.log(`mesaj: ${msg}`);
  const contentOk = /Alt bütçe: 1\.000 → 1\.500/.test(msg) && /Üst bütçe: 2\.000 → 2\.500/.test(msg);
  console.log(`POZ mesaj içerik: ${contentOk ? "PASS" : "FAIL"}`);

  // Dedupe: ikinci aynı değişiklik ikinci bildirim üretmemeli.
  await recordRequestChanges(
    request.id,
    { budgetMin: 1000, budgetMax: 2000, isUrgent: false, deadlineAt: null, status: "PUBLISHED" },
    { budgetMin: 1500, budgetMax: 2500, isUrgent: false, deadlineAt: null, status: "PUBLISHED" },
  );
  const after2 = await prisma.notification.count({
    where: { requestId: request.id, userId: proOwner.id, title: "Takip ettiğiniz talebin bütçesi değişti" },
  });
  console.log(`POZ dedupe (1 kalmalı): ${after2 === 1 ? "PASS" : `FAIL(${after2})`}`);

  const ok = proGot && !stdGot && !authorGot && contentOk && after2 === 1;
  await cleanup();
  console.log(`KALINTI TEMİZLENDİ; SONUÇ: ${ok ? "GREEN" : "RED"}`);
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
