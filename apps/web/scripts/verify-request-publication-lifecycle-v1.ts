/** Salt-okunur doğrulama: kategori arşivi ve bir aylık ilan görünürlüğü. */
import {
  addOneCalendarMonth,
  publicRequestWhere,
  requestPublicationState,
} from "@/server/request/public-visibility";

let checks = 0;
let failures = 0;

function assert(name: string, condition: boolean, details?: unknown) {
  checks += 1;
  if (condition) return;
  failures += 1;
  console.error(`✗ ${name}`, details ?? "");
}

const publishedAt = new Date("2026-01-31T12:00:00.000Z");
const expiresAt = addOneCalendarMonth(publishedAt);
assert("takvim ayı son günü güvenli hesaplanır", expiresAt.toISOString() === "2026-02-28T12:00:00.000Z");

const open = requestPublicationState(
  { status: "PUBLISHED", publishedAt, expiresAt },
  new Date("2026-02-20T12:00:00.000Z"),
);
assert("süresi dolmamış ilan yayınlanır", open.isPublished && open.status === "PUBLISHED");

const expired = requestPublicationState(
  { status: "RECEIVING_OFFERS", publishedAt, expiresAt },
  new Date("2026-03-01T00:00:00.000Z"),
);
assert("bir ayı geçen ilan EXPIRED olur", !expired.isPublished && expired.status === "EXPIRED");

const archived = requestPublicationState(
  { status: "PUBLISHED", publishedAt, expiresAt, categoryPausedAt: new Date("2026-02-10T00:00:00.000Z") },
  new Date("2026-02-20T12:00:00.000Z"),
);
assert("arşivlenen kategori ilanı yayından çıkarır", !archived.isPublished && archived.label === "Yayında değil");

const inactiveCategory = requestPublicationState(
  { status: "PUBLISHED", publishedAt, expiresAt, category: { name: "Arşiv", slug: "arsiv", isActive: false } },
  new Date("2026-02-20T12:00:00.000Z"),
);
assert("pasif kategori yayın durumunu kapatır", !inactiveCategory.isPublished);

const publicWhere = publicRequestWhere(new Date("2026-02-20T12:00:00.000Z"));
assert("public sorgu silinmişleri dışlar", publicWhere.deletedAt === null);
assert("public sorgu pasif kategoriyi dışlar", (publicWhere.category as { isActive?: boolean }).isActive === true);
assert("public sorgu kategori duraklamasını dışlar", publicWhere.categoryPausedAt === null);
assert("public sorgu açık durumlarla sınırlıdır", JSON.stringify(publicWhere.status) === JSON.stringify({ in: ["PUBLISHED", "RECEIVING_OFFERS"] }));

console.log(`${failures === 0 ? "PASS" : "FAIL"}: ${checks} yayın yaşam döngüsü kontrolü`);
if (failures > 0) process.exitCode = 1;
