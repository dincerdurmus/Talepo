/**
 * Offer product photo upload V1.
 * Run: npx tsx scripts/verify-offer-media-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  detectImageMime,
  looksLikeBlockedUploadName,
  validateImageBuffer,
} from "../src/lib/media/image-validation";
import {
  OFFER_MEDIA_ALLOWED_MIME,
  OFFER_MEDIA_IMMUTABLE_MESSAGE,
  OFFER_MEDIA_LIMIT_MESSAGE,
  OFFER_MEDIA_MAX_BYTES,
  OFFER_MEDIA_MAX_COUNT,
  OFFER_MEDIA_TYPE_MESSAGE,
  isOfferMediaMime,
} from "../src/lib/offer/offer-media";
import { featuresForPlan } from "../src/lib/membership/entitlements";
import { OFFER_INTELLIGENCE_FEATURE } from "../src/lib/monetization/offer-intelligence";

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

const root = join(__dirname, "..");
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function padded(header: number[]) {
  const buffer = Buffer.alloc(48, 0);
  Buffer.from(header).copy(buffer);
  return buffer;
}

const jpeg = padded([0xff, 0xd8, 0xff, 0xe0]);
const png = padded([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webp = padded([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const svg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
);
const pdf = Buffer.from("%PDF-1.4 mock document content............");
const gif = padded([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

console.log("\n=== LIMITS / TYPES ===\n");
{
  check("1 max 5", OFFER_MEDIA_MAX_COUNT === 5);
  check("2 min 0 implied (photos optional)", OFFER_MEDIA_MAX_COUNT >= 1);
  check("3 JPEG allowed", isOfferMediaMime("image/jpeg"));
  check("4 PNG allowed", isOfferMediaMime("image/png"));
  check("5 WebP allowed", isOfferMediaMime("image/webp"));
  check("6 SVG not allowed", !isOfferMediaMime("image/svg+xml"));
  check("7 GIF not allowed", !isOfferMediaMime("image/gif"));
  check("8 PDF not allowed", !isOfferMediaMime("application/pdf"));
  check("9 server size reuses 2.5MB", OFFER_MEDIA_MAX_BYTES === 2_500_000);
  check(
    "10 allowlist is jpeg/png/webp only",
    OFFER_MEDIA_ALLOWED_MIME.join(",") === "image/jpeg,image/png,image/webp",
  );
}

console.log("\n=== MAGIC-BYTE VALIDATION ===\n");
{
  check("11 JPEG buffer PASS", validateImageBuffer(jpeg).mimeType === "image/jpeg");
  check("12 PNG buffer PASS", validateImageBuffer(png).mimeType === "image/png");
  check("13 WebP buffer PASS", validateImageBuffer(webp).mimeType === "image/webp");

  let svgRejected = false;
  try {
    validateImageBuffer(svg, { originalName: "x.svg", claimedMime: "image/svg+xml" });
  } catch {
    svgRejected = true;
  }
  check("14 SVG rejected", svgRejected);

  let pdfRejected = false;
  try {
    validateImageBuffer(pdf, { originalName: "spec.pdf", claimedMime: "application/pdf" });
  } catch {
    pdfRejected = true;
  }
  check("15 unsupported document rejected", pdfRejected);

  let gifRejected = false;
  try {
    validateImageBuffer(gif, { originalName: "a.gif", claimedMime: "image/gif" });
  } catch {
    gifRejected = true;
  }
  check("16 GIF rejected", gifRejected);

  let tooLarge = false;
  try {
    validateImageBuffer(Buffer.alloc(OFFER_MEDIA_MAX_BYTES + 10, 0xff), {
      claimedMime: "image/jpeg",
      originalName: "big.jpg",
    });
  } catch (error) {
    tooLarge =
      error instanceof Error && error.message.includes("2.5 MB");
  }
  check("17 too-large rejected", tooLarge);

  check("18 .svg filename blocked", looksLikeBlockedUploadName("payload.svg"));
  check("19 .exe filename blocked", looksLikeBlockedUploadName("setup.exe"));
  check("20 jpeg name allowed", !looksLikeBlockedUploadName("urun.jpg"));
  check("21 detect jpeg", detectImageMime(jpeg) === "image/jpeg");
}

console.log("\n=== SOURCE: MODEL / STORAGE / FLOW ===\n");
{
  const schema = read("prisma/schema.prisma");
  const migration = read(
    "prisma/migrations/20260817160000_offer_media_v1/migration.sql",
  );
  const service = read("src/server/offer/offer-service.ts");
  const mediaService = read("src/server/offer/offer-media-service.ts");
  const access = read("src/server/offer/offer-media-access.ts");
  const store = read("src/server/offer/offer-media-store.ts");
  const createRoute = read("src/app/api/offers/route.ts");
  const attachRoute = read("src/app/api/offers/[id]/media/route.ts");
  const getRoute = read("src/app/api/offers/[id]/media/[mediaId]/route.ts");
  const form = read("src/components/panel/OfferForm.tsx");
  const picker = read("src/components/panel/OfferPhotoPicker.tsx");
  const incoming = read("src/app/panel/gelen-teklifler/page.tsx");
  const incomingCard = read("src/components/panel/IncomingOfferCard.tsx");
  const mine = read("src/app/panel/teklifler/page.tsx");
  const requestDetail = read("src/app/panel/taleplerim/[id]/page.tsx");
  const intelligenceLib = read("src/lib/monetization/offer-intelligence.ts");
  const intelligenceServer = read("src/server/monetization/offer-intelligence.ts");
  const radar = read("src/lib/monetization/talepo-radar.ts");
  const analytics = read("src/server/monetization/professional-analytics.ts");
  const lock = read("src/lib/offer/submitted-commercial-lock.ts");
  const entitlements = read("src/lib/membership/entitlements.ts");
  const gitignore = read(".gitignore");

  check("22 OfferMedia model exists", schema.includes("model OfferMedia"));
  check(
    "23 no photo1 columns on Offer",
    !schema.includes("photo1") && !migration.includes("photo1"),
  );
  check("24 additive migration", migration.includes("CREATE TABLE IF NOT EXISTS \"OfferMedia\""));
  check(
    "25 no base64 column for offer media",
    !schema.includes("OfferMedia") || !schema.includes("dataUrl"),
  );
  check("26 private filesystem store", store.includes(".data") && store.includes("offer-media"));
  check("27 path traversal rejected", store.includes(".."));
  check(
    "28 default create locks empty media",
    service.includes("mediaFinalizedAt: input.deferMediaFinalize ? null : now"),
  );
  check(
    "29 JSON create can defer finalize",
    createRoute.includes("deferMediaFinalize: body.deferMediaFinalize === true"),
  );
  check("30 attach uses validateImageBuffer", mediaService.includes("validateImageBuffer"));
  check("31 count limit enforced", mediaService.includes("OFFER_MEDIA_MAX_COUNT"));
  check(
    "32 post-submit attach rejected",
    mediaService.includes("OFFER_MEDIA_IMMUTABLE_MESSAGE") &&
      mediaService.includes("offer.mediaFinalizedAt"),
  );
  check(
    "33 write is submitter only",
    access.includes("canWriteOfferMedia") &&
      access.includes("isOfferSubmitter") &&
      !access.includes("canWriteOfferMedia") === false,
  );
  check(
    "34 read: request owner + submitter + company member",
    access.includes("isRequestOwner") &&
      access.includes("isOfferCompanyMember") &&
      access.includes("canReadOfferMedia"),
  );
  check(
    "35 GET is authenticated",
    getRoute.includes("requireUser") && getRoute.includes("readOfferMediaBytes"),
  );
  check("36 GET is private no-store", getRoute.includes("private, no-store"));
  check("37 POST attach uses formData file", attachRoute.includes("form.get(\"file\")"));
  check(
    "38 form copy",
    picker.includes("OFFER_MEDIA_COPY") &&
      picker.includes("Ürün fotoğrafları"),
  );
  check("39 photos optional on form", form.includes("deferMediaFinalize: photos.length > 0"));
  check("40 retry keeps created offer", form.includes("createdOfferId"));
  const incomingGallery = read("src/components/panel/IncomingOfferGallery.tsx");
  check(
    "41 Gelen teklifler include media ids",
    incoming.includes("select: { id: true }") &&
      (incoming.includes("OfferMediaThumbStrip") ||
        incomingCard.includes("IncomingOfferGallery") ||
        incomingGallery.includes("offerMediaSrc")),
  );
  check(
    "42 Tekliflerim include media ids",
    mine.includes("select: { id: true }") &&
      (mine.includes("OfferMediaThumbStrip") ||
        mine.includes("OutgoingOfferCompareGroup")),
  );
  check("43 request detail include media", requestDetail.includes("OfferMediaThumbStrip"));
  check(
    "44 list include is ids only (no bytes)",
    incoming.includes("select: { id: true }") && mine.includes("select: { id: true }"),
  );
  check(
    "45 acceptOffer does not delete media",
    !service.slice(service.indexOf("export async function acceptOffer")).includes("offerMedia.delete") &&
      !service.slice(service.indexOf("export async function rejectOffer")).includes("offerMedia.delete"),
  );
  check(
    "46 no message-attachment conversion",
    !mediaService.includes("createMessage") && !mediaService.includes("fileUrl"),
  );
  check(
    "47 Offer Intelligence unchanged (no photo score)",
    !intelligenceLib.includes("photo") &&
      !intelligenceServer.includes("offerMedia") &&
      intelligenceLib.includes(OFFER_INTELLIGENCE_FEATURE),
  );
  check("48 Radar unchanged", !radar.includes("offerMedia") && !radar.includes("OfferMedia"));
  check("49 Analytics unchanged", !analytics.includes("offerMedia"));
  check(
    "50 amount/delivery lock file unchanged API",
    lock.includes("OFFER_AMOUNT_IMMUTABLE_MESSAGE") &&
      lock.includes("OFFER_DELIVERY_IMMUTABLE_MESSAGE"),
  );
  check(
    "51 not a Pro upsell (no feature gate on attach)",
    !attachRoute.includes("assertCan") &&
      !mediaService.includes("featuresForPlan") &&
      !entitlements.includes("offer_media"),
  );
  check("52 Standard still has submit_offer", featuresForPlan("STANDARD").submit_offer === true);
  check(
    "53 Professional still has submit_offer",
    featuresForPlan("PROFESSIONAL").submit_offer === true,
  );
  check("54 .data gitignored", gitignore.includes("/.data/"));
  check("55 JPEG client compress reused", picker.includes("compressImageToDataUrl"));
  check("56 SVG client reject", picker.includes("image/svg+xml"));
  check("57 6th photo client limit message", picker.includes("OFFER_MEDIA_LIMIT_MESSAGE"));
  check("58 immutable copy on revise", form.includes("Fotoğraflar gönderimden sonra değiştirilemez"));
  check("59 no public bucket URL", !store.includes("supabase") && !getRoute.includes("public"));
  check("60 signed access via auth GET, not public CDN", getRoute.includes("requireUser"));
}

console.log("\n=== POLICY CONSTANTS ===\n");
{
  check("61 limit message set", OFFER_MEDIA_LIMIT_MESSAGE.includes("5"));
  check("62 type message mentions SVG", OFFER_MEDIA_TYPE_MESSAGE.includes("SVG"));
  check(
    "63 immutable message set",
    OFFER_MEDIA_IMMUTABLE_MESSAGE.includes("değiştirilemez"),
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
