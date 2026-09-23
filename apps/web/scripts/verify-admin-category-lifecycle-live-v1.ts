/**
 * Canlı DB kontrollü QA: geçici kategori + geçici ilan oluşturur ve her
 * durumda temizler. Yalnız açık izin bayrağıyla çalışır.
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: join(__dirname, "..", ".env") });
loadDotenv({ path: join(__dirname, "..", ".env.local"), override: true });

if (!process.argv.includes("--apply")) {
  throw new Error("Canlı DB QA için açık --apply onayı gerekli.");
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { addOneCalendarMonth, publicRequestWhere } = await import(
    "../src/server/request/public-visibility"
  );

  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const slug = `qa-kategori-${nonce}`;
  let categoryId: string | null = null;

  try {
  const user = await prisma.user.findFirst({
    where: { deletedAt: null },
    select: { id: true },
  });
  assert(user, "QA ilanı için mevcut kullanıcı bulunamadı.");

  const category = await prisma.category.create({
    data: {
      name: `QA Kategori ${nonce}`,
      slug,
      description: "Geçici kontrollü QA kategorisi",
      isActive: true,
      sortOrder: 999_999,
    },
    select: { id: true },
  });
  categoryId = category.id;

  const activeCategory = await prisma.category.findFirst({
    where: { id: category.id, isActive: true },
    select: { id: true },
  });
  assert(activeCategory, "Yeni kategori aktif listede görünmedi.");

  const now = new Date();
  const requestRow = await prisma.request.create({
    data: {
      createdById: user.id,
      categoryId: category.id,
      title: `QA ilanı ${nonce}`,
      description: "Geçici kategori yaşam döngüsü QA ilanı",
      rawInput: "Geçici kategori yaşam döngüsü QA ilanı",
      status: "PUBLISHED",
      publishedAt: now,
      expiresAt: addOneCalendarMonth(now),
    },
    select: { id: true },
  });

  assert(
    await prisma.request.findFirst({
      where: { id: requestRow.id, ...publicRequestWhere(now) },
      select: { id: true },
    }),
    "Yeni ilan public görünürlük filtresinden geçmedi.",
  );

  const pausedAt = new Date();
  await prisma.$transaction([
    prisma.category.update({ where: { id: category.id }, data: { isActive: false } }),
    prisma.request.update({ where: { id: requestRow.id }, data: { categoryPausedAt: pausedAt } }),
  ]);
  assert.equal(
    await prisma.request.findFirst({
      where: { id: requestRow.id, ...publicRequestWhere(new Date()) },
      select: { id: true },
    }),
    null,
    "Arşivlenen kategori ilanı public akıştan düşmedi.",
  );

  await prisma.$transaction([
    prisma.category.update({ where: { id: category.id }, data: { isActive: true } }),
    prisma.request.update({ where: { id: requestRow.id }, data: { categoryPausedAt: null } }),
  ]);
  assert(
    await prisma.request.findFirst({
      where: { id: requestRow.id, ...publicRequestWhere(new Date()) },
      select: { id: true },
    }),
    "Süresi devam eden ilan kategori açılınca geri gelmedi.",
  );

  await prisma.request.update({
    where: { id: requestRow.id },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
  assert.equal(
    await prisma.request.findFirst({
      where: { id: requestRow.id, ...publicRequestWhere(new Date()) },
      select: { id: true },
    }),
    null,
    "Süresi dolmuş ilan public akışta kaldı.",
  );

  await prisma.request.delete({ where: { id: requestRow.id } });
  await prisma.category.delete({ where: { id: category.id } });
  categoryId = null;
  assert.equal(
    await prisma.category.findUnique({ where: { slug }, select: { id: true } }),
    null,
    "Boş özel kategori kalıcı silinemedi.",
  );

  console.log("PASS: doğrudan DB kategori yaşam döngüsü (API/ekran silme akışını kapsamaz)");
  } finally {
    if (categoryId) {
      await prisma.request.deleteMany({ where: { categoryId } });
      await prisma.category.deleteMany({ where: { id: categoryId } });
    } else {
      await prisma.category.deleteMany({ where: { slug } });
    }
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
