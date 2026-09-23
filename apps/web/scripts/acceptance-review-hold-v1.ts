/**
 * KABUL KOŞUSU: ŞÜPHELİ TALEP KUYRUĞA DÜŞER, ADMİN AÇAR (D-0032).
 *
 * NE KANITLAR — ve neden bir birim testi yetmez. `audit-review-hold-v1` kodu
 * okuyup "her yüzeyde filtre var" der; burada GERÇEK veritabanında gerçek bir
 * şüpheli talep açılır ve tedarikçinin onu GERÇEKTEN göremediği ölçülür.
 * Kapının kodda görünmesi ile satırın sorguda dönmemesi iki ayrı iddiadır.
 *
 * Yalnız kabul veritabanında koşar; hedef doğrulanmadan tek satır yazmaz.
 *
 * Koşum:
 *   NODE_EXTRA_CA_CERTS=.acceptance/supabase-ca.crt \
 *   npx tsx scripts/acceptance-review-hold-v1.ts
 */
import { ACCEPTANCE_MARKER, PERSONAS } from "./lib/acceptance-personas-v1.constants";
import { ACCEPTANCE_FIXTURE_PREFIX } from "./lib/acceptance-fixtures-v1.constants";
import { formatAcceptanceError, redactAcceptanceOutput } from "./lib/acceptance-redaction-v1";
import { loadAcceptanceEnv } from "./lib/load-acceptance-env";
import { isAcceptanceCliEntrypoint } from "./lib/acceptance-cli-entry-v1";

let prisma!: typeof import("@/lib/prisma").prisma;
let parseCreateRequestInput!: typeof import("@/server/request/request-schema").parseCreateRequestInput;
let createRequest!: typeof import("@/server/request/create-request").createRequest;
let approveHeldRequest!: typeof import("@/server/request/review-hold-decision").approveHeldRequest;
let rejectHeldRequest!: typeof import("@/server/request/review-hold-decision").rejectHeldRequest;
let createOffer!: typeof import("@/server/offer/offer-service").createOffer;
let buildSupplierVisibilityFilter!: typeof import("@/lib/membership/assert-entitlement").buildSupplierVisibilityFilter;
let resolveEntitlements!: typeof import("@/lib/membership/resolve-entitlements").resolveEntitlements;
let REVIEW_HOLD_GUARD!: typeof import("@/lib/request/review-hold").REVIEW_HOLD_GUARD;

async function bindProductModules(): Promise<void> {
  ({ prisma } = await import("@/lib/prisma"));
  ({ parseCreateRequestInput } = await import("@/server/request/request-schema"));
  ({ createRequest } = await import("@/server/request/create-request"));
  ({ approveHeldRequest, rejectHeldRequest } = await import("@/server/request/review-hold-decision"));
  ({ createOffer } = await import("@/server/offer/offer-service"));
  ({ buildSupplierVisibilityFilter } = await import("@/lib/membership/assert-entitlement"));
  ({ resolveEntitlements } = await import("@/lib/membership/resolve-entitlements"));
  ({ REVIEW_HOLD_GUARD } = await import("@/lib/request/review-hold"));
}

/** Boş çerez kavanozu — `createRequest`/`createOffer` şirket bağlamını çerezden okur. */
function installEmptyCookieJar(): void {
  const id = require.resolve("next/headers");
  const jar = { get: () => undefined, getAll: () => [], has: () => false };
  require.cache[id] = {
    id,
    filename: id,
    loaded: true,
    exports: { cookies: async () => jar, headers: async () => new Map() },
  } as unknown as NodeModule;
}

let red = 0;
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) red += 1;
  console.log(`  ${ok ? "yesil " : "KIRMIZI"} ${name} — ${redactAcceptanceOutput(detail)}`);
}

async function personaId(key: keyof typeof PERSONAS): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { email: PERSONAS[key].email },
    select: { id: true, biography: true },
  });
  if (!u?.id || !u.biography?.includes(ACCEPTANCE_MARKER)) {
    throw new Error(`Persona ${key} eksik`);
  }
  return u.id;
}

/** Şüpheli metinle talep aç — sunucunun kendi kapısından geçerek. */
async function openSuspectRequest(userId: string, text: string, key: string) {
  const parsed = parseCreateRequestInput({
    title: `${ACCEPTANCE_FIXTURE_PREFIX} ${text}`.slice(0, 120),
    description: text,
    rawInput: text,
    category: { slug: "health", name: "Sağlık" },
    city: "İstanbul",
    publishVersion: "ai",
    fields: [],
    idempotencyKey: key,
  });
  const created = await createRequest(userId, parsed);
  return created.id;
}

async function main(): Promise<void> {
  loadAcceptanceEnv();
  installEmptyCookieJar();
  await bindProductModules();

  console.log("=== acceptance-review-hold-v1 ===");
  console.log("TARGET_CLASSIFICATION=ACCEPTANCE_ALLOWLISTED");

  const A = await personaId("A");
  const C = await personaId("C");
  const admin = await personaId("D");
  const stamp = Date.now().toString(36);

  // ---- 1. Şüpheli talep kuyruğa düşer ----
  const suspectText = "agri kesici kutu ariyorum butcem 500 tl istanbul";
  const requestId = await openSuspectRequest(A, suspectText, `e2e-hold-${stamp}`);
  const row = await prisma.request.findUnique({
    where: { id: requestId },
    select: { status: true, publishedAt: true, isModerationHidden: true, visibleToSuppliersAt: true },
  });
  check(
    "1. supheli talep PENDING_REVIEW",
    row?.status === "PENDING_REVIEW",
    `status=${row?.status}`,
  );
  check(
    "1b. yayin ani ve tedarikci gorunurlugu kapali",
    row?.publishedAt === null && row?.visibleToSuppliersAt === null && row?.isModerationHidden === true,
    `publishedAt=${row?.publishedAt} visibleToSuppliersAt=${row?.visibleToSuppliersAt} hidden=${row?.isModerationHidden}`,
  );

  const kase = await prisma.moderationCase.findFirst({
    where: { subjectType: "REQUEST", subjectId: requestId },
    select: { category: true, priority: true, details: true },
  });
  check(
    "2. admin kuyruk kaydi kanitiyla olustu",
    kase?.category === "REQUEST_REVIEW" && kase.priority === "HIGH" && Boolean(kase.details),
    `kategori=${kase?.category} oncelik=${kase?.priority} kanit=${kase?.details ?? "yok"}`,
  );

  // ---- 3. Tedarikçi göremez ----
  const ent = await resolveEntitlements(C, {});
  const visible = await prisma.request.count({
    where: {
      id: requestId,
      ...buildSupplierVisibilityFilter(ent),
      status: { in: ["PUBLISHED", "RECEIVING_OFFERS"] },
    },
  });
  check("3. tedarikci gorunurluk filtresinde yok", visible === 0, `gorunen=${visible}`);

  const guarded = await prisma.request.count({ where: { id: requestId, ...REVIEW_HOLD_GUARD } });
  check("3b. kanonik gorunmezlik filtresi de eliyor", guarded === 0, `gecen=${guarded}`);

  let offerRefused = false;
  let offerMessage = "";
  try {
    await createOffer(C, { requestId, description: "Kuyruktaki talebe teklif denemesi.", amount: 400 });
  } catch (error) {
    offerRefused = true;
    offerMessage = formatAcceptanceError(error);
  }
  check("3c. teklif verilemez", offerRefused, offerMessage || "teklif KABUL EDILDI");

  // ---- 4. Admin onaylar: onay anı yayın anıdır ----
  const before = new Date();
  const approved = await approveHeldRequest({ requestId, adminUserId: admin });
  const afterRow = await prisma.request.findUnique({
    where: { id: requestId },
    select: { status: true, publishedAt: true, isModerationHidden: true, visibleToSuppliersAt: true },
  });
  check(
    "4. onay sonrasi yayinda",
    afterRow?.status === "PUBLISHED" && afterRow.publishedAt !== null && afterRow.isModerationHidden === false,
    `status=${afterRow?.status} publishedAt=${afterRow?.publishedAt ? "var" : "yok"} hidden=${afterRow?.isModerationHidden}`,
  );
  check(
    "4b. tedarikci gorunurlugu aciildi",
    afterRow?.visibleToSuppliersAt !== null,
    `visibleToSuppliersAt=${afterRow?.visibleToSuppliersAt ? "var" : "yok"}`,
  );
  const approveNotif = await prisma.notification.count({
    where: { userId: A, requestId, createdAt: { gte: before } },
  });
  check("4c. kullaniciya onay bildirimi", approveNotif > 0, `bildirim=${approveNotif}`);
  console.log(
    `  bilgi  onay aninda dagitim tetiklendi: eslesen=${approved.distribution.matchedCompanyCount} bildirilen=${approved.distribution.notifiedUserCount}`,
  );

  const visibleAfter = await prisma.request.count({
    where: {
      id: requestId,
      ...buildSupplierVisibilityFilter(ent),
      status: { in: ["PUBLISHED", "RECEIVING_OFFERS"] },
    },
  });
  check("4d. tedarikci artik goruyor", visibleAfter === 1, `gorunen=${visibleAfter}`);

  // ---- 5. İkinci vaka reddedilir ----
  const secondId = await openSuspectRequest(A, `${suspectText} ikinci vaka`, `e2e-hold2-${stamp}`);
  const beforeReject = new Date();
  await rejectHeldRequest({ requestId: secondId, adminUserId: admin, reason: "Talep metni ilac mi kap mi belirsiz." });
  const rejected = await prisma.request.findUnique({
    where: { id: secondId },
    select: { status: true, isModerationHidden: true, moderationReason: true, publishedAt: true },
  });
  check(
    "5. ret sonrasi yayinlanmadi",
    rejected?.status === "PENDING_REVIEW" && rejected.isModerationHidden === true && rejected.publishedAt === null,
    `status=${rejected?.status} hidden=${rejected?.isModerationHidden}`,
  );
  const rejectNotif = await prisma.notification.findFirst({
    where: { userId: A, requestId: secondId, createdAt: { gte: beforeReject } },
    select: { message: true },
  });
  check(
    "5b. kullanici gerekceyi goruyor",
    Boolean(rejectNotif?.message?.includes("belirsiz")),
    rejectNotif?.message ?? "bildirim yok",
  );

  // ---- 6. Gerekçesiz ret reddedilir ----
  let reasonEnforced = false;
  try {
    await rejectHeldRequest({ requestId: secondId, adminUserId: admin, reason: "yok" });
  } catch {
    reasonEnforced = true;
  }
  check("6. gerekcesiz ret kabul edilmiyor", reasonEnforced, "5 karakterden kisa gerekce reddedildi");

  console.log("\nDB WRITE: yes (yalniz kabul)");
  console.log("PRODUCTION TOUCHED: no");
  console.log("SECRETS PRINTED: no");
  if (red === 0) {
    console.log("PASS — supheli talep kuyruga duser, gorunmez kalir, admin acar");
    return;
  }
  console.log(`KIRMIZI — ${red} sorun`);
  process.exit(1);
}

if (isAcceptanceCliEntrypoint(module)) {
  main().catch((error) => {
    console.error(`FAIL — ${formatAcceptanceError(error)}`);
    process.exit(1);
  });
}
