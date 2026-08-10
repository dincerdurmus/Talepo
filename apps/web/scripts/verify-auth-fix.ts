import { resolveSessionUser } from "../src/lib/auth/sync-google-user";
import { prisma } from "../src/lib/prisma";

async function main() {
  const resolved = await resolveSessionUser(
    "dincer_@hotmail.com.tr",
    "dincer_@hotmail.com.tr",
    { name: "Dinçer Durmuş" },
  );

  console.log("resolveSessionUser:", JSON.stringify(resolved, null, 2));

  if (!resolved || resolved.dbUnavailable) {
    throw new Error("Kullanıcı çözümlenemedi veya dbUnavailable");
  }

  const requests = await prisma.request.count({
    where: { createdById: resolved.user.id, deletedAt: null },
  });
  const companies = await prisma.companyMember.count({
    where: { userId: resolved.user.id, status: "ACTIVE" },
  });

  console.log(`Talep sayısı: ${requests}, aktif firma üyeliği: ${companies}`);

  if (requests < 3 || companies < 1) {
    throw new Error("Beklenen veri bulunamadı");
  }

  console.log("\nAuth fix doğrulaması başarılı.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
