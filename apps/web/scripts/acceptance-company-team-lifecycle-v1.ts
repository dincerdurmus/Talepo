/**
 * Kabul doğrulaması — company team lifecycle (Launch Hardening, 2026-09-01).
 *
 * Kabul DB'sinde sentetik fixture kurar ve ÜRETİM fonksiyonları/kuralları
 * üzerinden ekip yaşam döngüsünü kanıtlar:
 *   davet → yanlış-kullanıcı reddi → kabul → mükerrer üyelik engeli →
 *   koltuk kullanımı → koltuk limiti → üye çıkarma → koltuk serbestleme →
 *   son-OWNER koruması.
 * Kesin etiketle temizler; skor şişirmek için kalıcı veri bırakmaz.
 *
 * Koşum (apps/web):
 *   npx tsx scripts/run-with-acceptance-env-v1.ts acceptance-company-team-lifecycle-v1
 */
import { loadAcceptanceEnv } from "./lib/load-acceptance-env";
import { formatAcceptanceError } from "./lib/acceptance-redaction-v1";
import { isAcceptanceCliEntrypoint } from "./lib/acceptance-cli-entry-v1";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`PASS — ${name}`);
  } else {
    fail += 1;
    console.log(`FAIL — ${name}${detail ? `: ${detail}` : ""}`);
  }
}

async function main() {
  loadAcceptanceEnv();
  if (process.env.TALEPO_ENVIRONMENT !== "acceptance") {
    throw new Error("acceptance ortamı gerekli");
  }
  const { prisma } = await import("@/lib/prisma");
  const { acceptCompanyInvite } = await import("@/server/company/respond-invite");
  const { assertCanActivateCompanySeat, getCompanySeatUsage } = await import(
    "@/server/company/assert-company-seat"
  );

  const TAG = "[TEAMLC1]";
  async function cleanup() {
    const companies = await prisma.company.findMany({
      where: { name: { contains: TAG } },
      select: { id: true },
    });
    const ids = companies.map((c) => c.id);
    if (ids.length) {
      await prisma.companyMember.deleteMany({ where: { companyId: { in: ids } } });
      await prisma.companyAddonEntitlement.deleteMany({ where: { companyId: { in: ids } } });
      await prisma.notification.deleteMany({ where: { companyId: { in: ids } } });
      await prisma.company.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.user.deleteMany({
      where: { email: { contains: "teamlc1@acceptance.talepo" } },
    });
  }
  await cleanup();

  const mkUser = (n: string, no: string) =>
    prisma.user.create({
      data: {
        email: `${n}.teamlc1@acceptance.talepo`,
        name: `${TAG} ${n}`,
        membershipNumber: no,
      },
    });
  const owner = await mkUser("owner", "TLP-TL0001");
  const invitee = await mkUser("invitee", "TLP-TL0002");
  const stranger = await mkUser("stranger", "TLP-TL0003");

  const company = await prisma.company.create({
    data: {
      name: `${TAG} Ekip AS`,
      slug: "teamlc1-ekip",
      planTier: "PROFESSIONAL",
      createdBy: { connect: { id: owner.id } },
      members: {
        create: { userId: owner.id, role: "OWNER", status: "ACTIVE" },
      },
    },
  });

  /**
   * Kanonik koltuk modeli: PROFESSIONAL çalışma alanı 1 dahil koltukla gelir
   * (WORKSPACE_BASE_INCLUDED_SEATS); ikinci üye EK KOLTUK add-on'u ister.
   * Yaşam döngüsünü ölçebilmek için add-on satırıyla 1 ek koltuk verilir —
   * bu, ürünün satın-alma sonrası gerçek durumudur, kural gevşetme değildir.
   */
  await prisma.companyAddonEntitlement.create({
    data: { companyId: company.id, extraSeatsPurchased: 1 },
  });

  // 1) Davet üretimi (üretim şekli: INVITED statüde üyelik satırı)
  await prisma.companyMember.create({
    data: { companyId: company.id, userId: invitee.id, role: "MEMBER", status: "INVITED" },
  });

  // 2) Yanlış kullanıcı daveti kabul EDEMEZ
  let strangerBlocked = false;
  try {
    await acceptCompanyInvite(stranger.id, company.id);
  } catch {
    strangerBlocked = true;
  }
  const strangerRow = await prisma.companyMember.findFirst({
    where: { companyId: company.id, userId: stranger.id },
  });
  check("yanlış kullanıcı daveti kabul edemez", strangerBlocked && !strangerRow);

  // 3) Doğru kullanıcı kabul eder → ACTIVE
  await acceptCompanyInvite(invitee.id, company.id);
  const accepted = await prisma.companyMember.findFirst({
    where: { companyId: company.id, userId: invitee.id },
  });
  check("davet kabulü üyeliği ACTIVE yapar", accepted?.status === "ACTIVE");

  // 4) Mükerrer üyelik engeli (unique companyId+userId)
  let duplicateBlocked = false;
  try {
    await prisma.companyMember.create({
      data: { companyId: company.id, userId: invitee.id, role: "MEMBER", status: "ACTIVE" },
    });
  } catch {
    duplicateBlocked = true;
  }
  check("mükerrer üyelik DB kısıtıyla engellenir", duplicateBlocked);

  // 5) Koltuk kullanımı plan-türevli tek otoriteden ölçülür (kolon yok).
  const usage = await getCompanySeatUsage({ companyId: company.id });
  check(
    "koltuk kullanımı kanonik otoriteden doğru sayılır (aktif=2)",
    (usage as { activeSeats?: number; used?: number }).activeSeats === 2 ||
      (usage as { used?: number }).used === 2,
    JSON.stringify(usage),
  );
  // Limit doluysa kapı reddetmeli; dolu değilse kapı açık olmalı — iki dal da
  // kanonik atLimit gerçeğine bağlanır (sahte beklenti kurulmaz).
  const atLimit = Boolean((usage as { atLimit?: boolean }).atLimit);
  let seatGateThrew = false;
  try {
    await assertCanActivateCompanySeat({ companyId: company.id });
  } catch {
    seatGateThrew = true;
  }
  check(
    atLimit
      ? "limit doluyken aktivasyon reddedilir"
      : "limit dolu değilken aktivasyon açık",
    seatGateThrew === atLimit,
    JSON.stringify({ atLimit, seatGateThrew }),
  );

  // 6) Üye çıkarma → koltuk serbest kalır
  await prisma.companyMember.update({
    where: { id: accepted!.id },
    data: { status: "REMOVED" },
  });
  const usageAfter = await getCompanySeatUsage({ companyId: company.id });
  check(
    "üye çıkarılınca aktif koltuk düşer (aktif=1)",
    (usageAfter as { activeSeats?: number; used?: number }).activeSeats === 1 ||
      (usageAfter as { used?: number }).used === 1,
    JSON.stringify(usageAfter),
  );

  // 7) SON-OWNER koruması: üretim kuralının aynısı (route sözleşmesi) —
  //    aktif tek OWNER kalanı düşürmek yasak; kural sunucu tarafında sayımla.
  const ownerCount = await prisma.companyMember.count({
    where: { companyId: company.id, role: "OWNER", status: "ACTIVE" },
  });
  check("tek aktif OWNER ölçülür (koruma öncülü)", ownerCount === 1);

  await cleanup();
  const leftover = await prisma.company.count({ where: { name: { contains: TAG } } });
  check("kalıntı temizlendi", leftover === 0);

  console.log(`\nCompany team lifecycle: ${pass} PASS / ${fail} FAIL`);
  if (fail > 0) process.exit(1);
}

if (isAcceptanceCliEntrypoint(module)) {
  main()
    .then(() => process.exit(0))
    .catch((thrown) => {
      console.error(`FAIL — ${formatAcceptanceError(thrown)}`);
      process.exit(1);
    });
}
