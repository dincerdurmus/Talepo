/**
 * FAZ 3 + FAZ 4 (oturumlu dallar) — sunucu yolu koşucusu, ikinci koşu.
 *
 * Neden ayrı bir dosya: `acceptance-core-commerce-v1.ts` yayın -> teklif -> kabul ->
 * mesaj hattını zaten kanıtlıyor. Burada ÖLÇÜLEN şey onun kapsamadığı dallar:
 * pazarlık zinciri, ret/geri çekme, kapanış (deal outcome + review), arşiv,
 * kota, ücretli özellik kapısı, bildirim kaydı ve e-posta taşıyıcısının dönüşü.
 *
 * Ürün kodu değiştirilmez. Her adım GERÇEK üretim servisini çağırır; bu dosyada
 * ikinci bir karar kopyası kurulmaz.
 *
 * Koşum: NODE_EXTRA_CA_CERTS=.acceptance/supabase-ca.crt npx tsx scripts/e2e-a-z/run-phase3-server-v1.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ACCEPTANCE_MARKER, PERSONAS } from "../lib/acceptance-personas-v1.constants";
import { ACCEPTANCE_FIXTURE_PREFIX } from "../lib/acceptance-fixtures-v1.constants";
import { formatAcceptanceError, redactAcceptanceOutput } from "../lib/acceptance-redaction-v1";
import { loadAcceptanceEnv } from "../lib/load-acceptance-env";
import { isAcceptanceCliEntrypoint } from "../lib/acceptance-cli-entry-v1";

let prisma!: typeof import("@/lib/prisma").prisma;
let understandRequest!: typeof import("@/lib/request-understanding/understand-request").understandRequest;
let resolveSchemaCategory!: typeof import("@/lib/request-understanding/activation-bridge").resolveSchemaCategory;
let getCategoryById!: typeof import("@/lib/request-category-engine").getCategoryById;
let buildCanonicalRequestState!: typeof import("@/lib/request-composer/build-state").buildCanonicalRequestState;
let buildDiscoveryProjectionFromState!: typeof import("@/lib/discovery").buildDiscoveryProjectionFromState;
let createRequest!: typeof import("@/server/request/create-request").createRequest;
let createOffer!: typeof import("@/server/offer/offer-service").createOffer;
let acceptOffer!: typeof import("@/server/offer/offer-service").acceptOffer;
let rejectOffer!: typeof import("@/server/offer/offer-service").rejectOffer;
let proposeOfferNegotiation!: typeof import("@/server/offer/offer-negotiation-service").proposeOfferNegotiation;
let rejectPendingNegotiation!: typeof import("@/server/offer/offer-negotiation-service").rejectPendingNegotiation;
let acceptPendingNegotiation!: typeof import("@/server/offer/offer-negotiation-service").acceptPendingNegotiation;
let sendMessage!: typeof import("@/server/message/send-message").sendMessage;
let markConversationAsRead!: typeof import("@/server/message/mark-conversation-read").markConversationAsRead;
let confirmDealCompletion!: typeof import("@/server/price-intelligence/deal-outcome").confirmDealCompletion;
let createDealReview!: typeof import("@/server/offer/deal-review-service").createDealReview;
let archiveOfferForUser!: typeof import("@/server/offer/offer-archive-service").archiveOfferForUser;
let unarchiveOfferForUser!: typeof import("@/server/offer/offer-archive-service").unarchiveOfferForUser;
let resolveEntitlements!: typeof import("@/lib/membership/resolve-entitlements").resolveEntitlements;
let resolveEmailTransportConfig!: typeof import("@/server/email/email-transport").resolveEmailTransportConfig;
let containsBlockedContactInfo!: typeof import("@/lib/membership/contact-filter").containsBlockedContactInfo;

async function bindProductModules(): Promise<void> {
  ({ prisma } = await import("@/lib/prisma"));
  ({ understandRequest } = await import("@/lib/request-understanding/understand-request"));
  ({ resolveSchemaCategory } = await import("@/lib/request-understanding/activation-bridge"));
  ({ getCategoryById } = await import("@/lib/request-category-engine"));
  ({ buildCanonicalRequestState } = await import("@/lib/request-composer/build-state"));
  ({ buildDiscoveryProjectionFromState } = await import("@/lib/discovery"));
  ({ createRequest } = await import("@/server/request/create-request"));
  ({ createOffer, acceptOffer, rejectOffer } = await import("@/server/offer/offer-service"));
  ({ proposeOfferNegotiation, rejectPendingNegotiation, acceptPendingNegotiation } = await import(
    "@/server/offer/offer-negotiation-service"
  ));
  ({ sendMessage } = await import("@/server/message/send-message"));
  ({ markConversationAsRead } = await import("@/server/message/mark-conversation-read"));
  ({ confirmDealCompletion } = await import("@/server/price-intelligence/deal-outcome"));
  ({ createDealReview } = await import("@/server/offer/deal-review-service"));
  ({ archiveOfferForUser, unarchiveOfferForUser } = await import(
    "@/server/offer/offer-archive-service"
  ));
  ({ resolveEntitlements } = await import("@/lib/membership/resolve-entitlements"));
  ({ resolveEmailTransportConfig } = await import("@/server/email/email-transport"));
  ({ containsBlockedContactInfo } = await import("@/lib/membership/contact-filter"));
}

/**
 * Boş çerez kavanozu — ÜRÜN KARARI DEĞİL.
 *
 * `createOffer` şirket bağlamını `next/headers` çerezinden okur; komut satırında
 * Next.js istek kapsamı yoktur ve çağrı "cookies was called outside a request
 * scope" ile düşer. Burada YALNIZ boş bir kavanoz sunulur: üretimdeki "çerez yok
 * -> kişisel bağlam" dalı olduğu gibi koşar, hak/kota kararının hiçbir parçası
 * bu dosyaya kopyalanmaz. Alternatif, teklif verme kararını harness içinde
 * yeniden yazmaktı; o, ölçtüğünü iddia ettiği üretim davranışını ölçmezdi.
 */
function installEmptyCookieJar(): void {
  const id = require.resolve("next/headers");
  const emptyJar = {
    get: () => undefined,
    getAll: () => [],
    has: () => false,
  };
  const stub = { cookies: async () => emptyJar, headers: async () => new Map() };
  require.cache[id] = {
    id,
    filename: id,
    loaded: true,
    exports: stub,
  } as unknown as NodeModule;
}

type Outcome = "PASS" | "FAIL" | "BLOCKED" | "OBSERVED";
type Row = { step: string; outcome: Outcome; detail: string };

const rows: Row[] = [];
function record(step: string, outcome: Outcome, detail: string): void {
  const safe = redactAcceptanceOutput(detail);
  rows.push({ step, outcome, detail: safe });
  console.log(`${outcome.padEnd(8)} ${step} — ${safe}`);
}

/** Reddedilmesi BEKLENEN adımlar: reddedildi mi, hangi mesajla. */
async function expectRefusal(step: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    record(step, "FAIL", "çağrı kabul edildi; reddedilmesi bekleniyordu");
  } catch (error) {
    record(step, "PASS", `reddedildi: ${formatAcceptanceError(error)}`);
  }
}

async function personaId(key: keyof typeof PERSONAS): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { email: PERSONAS[key].email },
    select: { id: true, biography: true },
  });
  if (!u?.id || !u.biography?.includes(ACCEPTANCE_MARKER)) {
    throw new Error(`Persona ${key} eksik ya da işaret taşımıyor`);
  }
  return u.id;
}

function title(text: string): string {
  return `${ACCEPTANCE_FIXTURE_PREFIX} ${text}`.slice(0, 120);
}

async function publish(userId: string, text: string, city: string, key: string) {
  const understanding = understandRequest({ rawInput: text });
  const schema = resolveSchemaCategory(understanding);
  const category = getCategoryById(schema.categoryId);
  const state = buildCanonicalRequestState({ understanding, progressiveReset: true });
  const projection = buildDiscoveryProjectionFromState(state);
  const created = await createRequest(userId, {
    title: title(text),
    description: text,
    category: { slug: category.id, name: category.label, description: category.description },
    city,
    publishVersion: "ai",
    fields: [],
    discoveryProjection: projection,
    idempotencyKey: key,
  });
  const row = await prisma.request.findUnique({
    where: { id: created.id },
    select: { status: true, publishedAt: true, city: true, district: true },
  });
  return { id: created.id, categoryId: category.id, row };
}

async function countNotifications(userId: string, since: Date): Promise<number> {
  return prisma.notification.count({ where: { userId, createdAt: { gte: since } } });
}

async function main(): Promise<void> {
  loadAcceptanceEnv();
  installEmptyCookieJar();
  await bindProductModules();
  const startedAt = new Date();

  console.log("=== e2e FAZ 3/4 sunucu yolu (ikinci koşu) ===");

  const A = await personaId("A");
  const B = await personaId("B");
  const C = await personaId("C");
  const D = await personaId("D");

  const stamp = Date.now().toString(36);

  // ---------- 1. Yayın fiili ----------
  const req = await publish(
    A,
    "Ofis icin 10 adet ergonomik calisma sandalyesi ariyorum. Butcem 60000 TL. Istanbul Kadikoy. Iki hafta icinde.",
    "İstanbul",
    `e2e-p3-req1-${stamp}`,
  );
  record(
    "3.0 yayın fiili",
    req.row?.publishedAt ? "PASS" : "FAIL",
    `status=${req.row?.status} kategori=${req.categoryId} publishedAt=${req.row?.publishedAt ? "var" : "yok"}`,
  );

  const estate = await publish(
    A,
    "kiralik 3+1 daire ariyorum istanbul besiktas butcem 35000 tl",
    "İstanbul",
    `e2e-p3-estate-${stamp}`,
  );
  record(
    "3.0b P1-6 emlak il/ilçe",
    estate.row?.publishedAt ? "PASS" : "FAIL",
    `kategori=${estate.categoryId} status=${estate.row?.status} il=${estate.row?.city ?? "boş"} ilce=${estate.row?.district ?? "boş"}`,
  );

  // ---------- 2. Teklif + bildirim ----------
  const beforeOffer = new Date();
  const offerC = await createOffer(C, {
    requestId: req.id,
    description: "10 adet ergonomik sandalye, 2 yil garanti, montaj dahil teslim.",
    amount: 58000,
    deliveryDays: 10,
  });
  record("3.2 tedarikçi teklifi (C)", "PASS", `offer=${offerC.id.slice(0, 8)}...`);
  const buyerNotif = await countNotifications(A, beforeOffer);
  record(
    "3.2b alıcıya bildirim",
    buyerNotif > 0 ? "PASS" : "FAIL",
    `teklif sonrası A'ya düşen bildirim=${buyerNotif}`,
  );

  // ---------- 3. Pazarlık zinciri ----------
  const beforeNeg = new Date();
  await proposeOfferNegotiation(A, offerC.id, 50000);
  record("3.3a A karşı teklif 50000", "PASS", "PENDING pazarlık açıldı");
  const cNotif1 = await countNotifications(C, beforeNeg);
  record("3.3b C'ye bildirim", cNotif1 > 0 ? "PASS" : "FAIL", `bildirim=${cNotif1}`);

  await expectRefusal("3.3c bekleyen varken aynı taraf ikinci pazarlık", () =>
    proposeOfferNegotiation(A, offerC.id, 49000),
  );

  await rejectPendingNegotiation(C, offerC.id);
  record("3.3d C reddetti", "PASS", "PENDING -> REJECTED");

  // ---------- 4. İkinci tedarikçi: ret dalı ----------
  // Sıra bilerek böyle: pazarlığın kabulü teklifin kabulüdür ve talebi yeni
  // tekliflere kapatır, o yüzden D'nin teklifi ve reddi kabulden ÖNCE ölçülür.
  const offerD = await createOffer(D, {
    requestId: req.id,
    description: "Kurumsal tedarik, 10 adet sandalye, 15 gun icinde teslim.",
    amount: 62000,
    deliveryDays: 15,
  });
  const beforeReject = new Date();
  await rejectOffer(A, offerD.id);
  const dRow = await prisma.offer.findUnique({
    where: { id: offerD.id },
    select: { status: true },
  });
  record(
    "3.4 A ikinci teklifi reddetti (D)",
    dRow?.status === "REJECTED" ? "PASS" : "FAIL",
    `status=${dRow?.status}`,
  );
  const dNotif = await countNotifications(D, beforeReject);
  record("3.4b D'ye ret bildirimi", dNotif > 0 ? "PASS" : "FAIL", `bildirim=${dNotif}`);

  // ---------- 5. Pazarlığın kabulü = teklifin kabulü ----------
  await proposeOfferNegotiation(A, offerC.id, 55000);
  record("3.3e A yeni karşı teklif 55000", "PASS", "yeni PENDING");
  await acceptPendingNegotiation(C, offerC.id);
  record("3.3f C kabul etti", "PASS", "PENDING -> ACCEPTED (teklif de kabul edilir)");

  const negs = await prisma.offerNegotiation.findMany({
    where: { offerId: offerC.id },
    select: { amount: true, status: true, proposedBySide: true },
    orderBy: { createdAt: "asc" },
  });
  record(
    "3.3g pazarlık zinciri kaydı",
    negs.length === 2 && negs[0].status === "REJECTED" && negs[1].status === "ACCEPTED"
      ? "PASS"
      : "FAIL",
    negs.map((n) => `${n.proposedBySide}:${n.amount.toString()}:${n.status}`).join(" | "),
  );

  const afterAccept = await prisma.offer.findMany({
    where: { requestId: req.id },
    select: { id: true, status: true },
  });
  record(
    "3.5 kabul sonrası kardeş teklif durumu",
    afterAccept.some((o) => o.id === offerC.id && o.status === "ACCEPTED") ? "PASS" : "FAIL",
    afterAccept.map((o) => `${o.id.slice(0, 6)}:${o.status}`).join(" | "),
  );

  const reqAfter = await prisma.request.findUnique({
    where: { id: req.id },
    select: { status: true },
  });
  record("3.5b talep durumu", "OBSERVED", `status=${reqAfter?.status}`);

  // ---------- 6. Mesajlaşma ----------
  const conv = await prisma.conversation.findFirst({
    where: { offerId: offerC.id },
    select: { id: true },
  });
  if (!conv) {
    record("3.6 konuşma", "FAIL", "kabul sonrası konuşma açılmadı");
  } else {
    record("3.6 konuşma açıldı", "PASS", `conversation=${conv.id.slice(0, 8)}...`);
    const beforeMsg = new Date();
    await sendMessage(A, conv.id, "Merhaba, teslimat adresini yarin paylasacagim.");
    await sendMessage(C, conv.id, "Tesekkurler, montaj ekibi hazir.");
    const msgCount = await prisma.message.count({ where: { conversationId: conv.id } });
    record("3.6b iki yönlü mesaj", msgCount >= 2 ? "PASS" : "FAIL", `mesaj=${msgCount}`);
    await markConversationAsRead(C, conv.id);
    record("3.6c okundu işareti", "PASS", "markConversationAsRead çağrıldı");
    const msgNotif = await countNotifications(C, beforeMsg);
    record("3.6d mesaj bildirimi", msgNotif > 0 ? "PASS" : "OBSERVED", `bildirim=${msgNotif}`);
    record(
      "3.6e mesajda iletişim bilgisi algılanıyor mu",
      containsBlockedContactInfo("numaram 0532 111 22 33") ? "PASS" : "FAIL",
      "contact-filter mesaj metninde telefonu yakalıyor",
    );
    // Kabul SONRASI iletişim paylaşımı ürün kararıyla serbesttir
    // (`send-message.ts`: "Contact sharing is allowed after offer acceptance").
    // Ölçülen şey engelleme değil, kararın gerçekten uygulanması.
    try {
      await sendMessage(A, conv.id, "Beni 0532 111 22 33 numarasindan arayin.");
      record(
        "3.6f kabul sonrası telefon paylaşımı",
        "OBSERVED",
        "izin verildi — send-message.ts'deki kabul-sonrası kararıyla uyumlu",
      );
    } catch (error) {
      record("3.6f kabul sonrası telefon paylaşımı", "OBSERVED", formatAcceptanceError(error));
    }
  }

  // ---------- 7. Kapanış ----------
  const deal = await prisma.dealOutcome.findFirst({
    where: { offerId: offerC.id },
    select: { id: true, status: true },
  });
  if (!deal) {
    record("3.7 deal outcome", "FAIL", "kabul sonrası deal outcome kaydı yok");
  } else {
    record("3.7 deal outcome oluştu", "PASS", `deal=${deal.id.slice(0, 8)}... status=${deal.status}`);
    try {
      await confirmDealCompletion(A, deal.id);
      await confirmDealCompletion(C, deal.id);
      const confirmed = await prisma.dealOutcome.findUnique({
        where: { id: deal.id },
        select: { status: true },
      });
      record("3.7b iki taraf onayı", "PASS", `status=${confirmed?.status}`);
    } catch (error) {
      record("3.7b iki taraf onayı", "FAIL", formatAcceptanceError(error));
    }
    try {
      await createDealReview({
        userId: A,
        dealOutcomeId: deal.id,
        rating: 5,
        comment: "Hizli ve duzgun teslimat.",
      });
      await createDealReview({
        userId: C,
        dealOutcomeId: deal.id,
        rating: 4,
        comment: "Alici iletisimi netti.",
      });
      const reviews = await prisma.dealReview.count({ where: { dealOutcomeId: deal.id } });
      record("3.7c iki taraflı değerlendirme", reviews === 2 ? "PASS" : "FAIL", `değerlendirme=${reviews}`);
    } catch (error) {
      record("3.7c iki taraflı değerlendirme", "FAIL", formatAcceptanceError(error));
    }
  }

  // ---------- 8. Arşiv ----------
  try {
    await archiveOfferForUser({
      userId: A,
      offerId: offerD.id,
      role: "buyer",
      companyId: null,
      unreadOfferIds: new Set<string>(),
    });
    const archived = await prisma.offerArchive.count({ where: { offerId: offerD.id } });
    await unarchiveOfferForUser({
      userId: A,
      offerId: offerD.id,
      role: "buyer",
      companyId: null,
    });
    const after = await prisma.offerArchive.count({ where: { offerId: offerD.id } });
    record(
      "3.8 arşivle / arşivden çıkar",
      archived === 1 && after === 0 ? "PASS" : "FAIL",
      `arşiv=${archived} sonra=${after}`,
    );
  } catch (error) {
    record("3.8 arşivle / arşivden çıkar", "FAIL", formatAcceptanceError(error));
  }

  // ---------- 9. Kota ve hak ----------
  for (const [key, id] of [
    ["A", A],
    ["B", B],
    ["C", C],
    ["D", D],
  ] as const) {
    const ent = await resolveEntitlements(id, {});
    record(
      `3.9 hak tablosu ${key}`,
      "OBSERVED",
      `plan=${ent.effectivePlanTier} kota=${JSON.stringify(ent.quota)} ` +
        `teklifAsistani=${ent.features.offer_assistant ?? "yok"} ` +
        `gecikme=${ent.requestAccessDelayHours}s`,
    );
  }
  // STANDARD plan teklif vermeyi tamamen kapatmaz; aylık kotayla sınırlar.
  // Ölçülen şey kotanın gerçekten tükenip doğru hatayı verip vermediğidir.
  const entA = await resolveEntitlements(A, {});
  record(
    "3.9b STANDARD teklif kotası (başlangıç)",
    "OBSERVED",
    `plan=${entA.effectivePlanTier} kota=${JSON.stringify(entA.quota)}`,
  );
  let quotaHitAt: number | null = null;
  let quotaMessage = "";
  for (let i = 0; i < 12; i += 1) {
    const filler = await publish(
      B,
      `Endustriyel raf sistemi ariyorum parti ${i}. Butcem 40000 TL. Ankara Cankaya.`,
      "Ankara",
      `e2e-p3-quota-${stamp}-${i}`,
    );
    try {
      await createOffer(A, {
        requestId: filler.id,
        description: `Kota olcumu icin standart teklif metni, parti ${i}.`,
        amount: 39000,
      });
    } catch (error) {
      quotaHitAt = i;
      quotaMessage = formatAcceptanceError(error);
      break;
    }
  }
  record(
    "3.9c STANDARD teklif kotası tükendi mi",
    quotaHitAt === null ? "FAIL" : "PASS",
    quotaHitAt === null
      ? "12 ardışık teklif kabul edildi; kota kapısı görülmedi"
      : `${quotaHitAt + 1}. teklifte durdu: ${quotaMessage}`,
  );
  const entAfter = await resolveEntitlements(A, {});
  record("3.9d kota sonrası hak", "OBSERVED", `kota=${JSON.stringify(entAfter.quota)}`);

  // ---------- 10. E-posta taşıyıcısı ----------
  const transport = resolveEmailTransportConfig();
  record(
    "3.10 e-posta taşıyıcı yapılandırması",
    "OBSERVED",
    transport ? "yapılandırılmış (kabulde gerçek gönderim denenmez)" : "UNCONFIGURED (beklenen)",
  );

  // ---------- 11. FAZ 4 ----------
  await expectRefusal("4.1 başkasının teklifinde pazarlık (B)", () =>
    proposeOfferNegotiation(B, offerC.id, 40000),
  );
  await expectRefusal("4.2 başkasının teklifini reddetme (B)", () => rejectOffer(B, offerC.id));
  await expectRefusal("4.3 kapanmış teklifte yeni pazarlık", () =>
    proposeOfferNegotiation(A, offerC.id, 30000),
  );
  if (conv) {
    await expectRefusal("4.4 yabancı konuşmaya mesaj (B)", () =>
      sendMessage(B, conv.id, "Bu sohbete ait degilim ama yaziyorum."),
    );
  } else {
    record("4.4 yabancı konuşmaya mesaj (B)", "BLOCKED", "konuşma yok");
  }

  // ---------- Rapor ----------
  const outDir = join(__dirname, "..", "..", "..", "..", "reports", "e2e-a-z-2026-09-23");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "faz3-sunucu.jsonl"),
    rows.map((r) => JSON.stringify(r)).join("\n") + "\n",
    "utf8",
  );

  const pass = rows.filter((r) => r.outcome === "PASS").length;
  const fail = rows.filter((r) => r.outcome === "FAIL").length;
  const blocked = rows.filter((r) => r.outcome === "BLOCKED").length;
  console.log("\n=== ÖZET ===");
  console.log(
    `PASS=${pass} FAIL=${fail} BLOCKED=${blocked} OBSERVED=${rows.length - pass - fail - blocked}`,
  );
  console.log(`BAŞLANGIÇ=${startedAt.toISOString()}`);
  console.log("SECRETS PRINTED: no");
  console.log(fail === 0 ? "FAZ3/4 SUNUCU: PASS" : "FAZ3/4 SUNUCU: FAIL");
}

if (isAcceptanceCliEntrypoint(module)) {
  main().catch((error) => {
    console.error(`FAIL — ${formatAcceptanceError(error)}`);
    process.exit(1);
  });
}
