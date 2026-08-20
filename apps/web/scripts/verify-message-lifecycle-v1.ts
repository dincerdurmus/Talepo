/**
 * Messaging lifecycle, multi-photo, participant profile V1.
 * Run: npx tsx scripts/verify-message-lifecycle-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import {
  encodeGroupFileName,
  groupConversationMessages,
  parseGroupFileName,
} from "../src/lib/message/attachment-group";
import {
  buildConversationProcessSteps,
  formatConversationMoney,
} from "../src/lib/message/conversation-process";
import { MAX_MESSAGE_IMAGES } from "../src/lib/message/limits";

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

console.log("\n=== MESSAGE LIFECYCLE V1 ===\n");

{
  const access = read("src/server/message/conversation-access.ts");
  check(
    "send gate only blocks non-ACCEPTED offer",
    access.includes('status !== "ACCEPTED"') &&
      !access.includes("dealOutcome") &&
      !access.includes("dealCompleted"),
  );

  const composer = read("src/components/panel/MessageComposer.tsx");
  check(
    "composer supports up to 3 images",
    composer.includes("MAX_MESSAGE_IMAGES") &&
      composer.includes("multiple") &&
      composer.includes("Bir mesaja en fazla 3 fotoğraf"),
  );

  check("max images constant is 3", MAX_MESSAGE_IMAGES === 3);

  const route = read("src/app/api/conversations/[id]/messages/route.ts");
  check(
    "messages API accepts images array",
    route.includes("body.images") && route.includes("sendImageMessages"),
  );

  const sendImages = read("src/server/message/send-image-message.ts");
  check(
    "batch image send uses group fileName encoding",
    sendImages.includes("encodeGroupFileName") &&
      sendImages.includes("sendImageMessages"),
  );

  const groupId = randomUUID();
  const grouped = groupConversationMessages(
    [
      {
        id: "m1",
        type: "IMAGE",
        content: "caption",
        fileUrl: "a",
        fileName: encodeGroupFileName(groupId, 0, "a.jpg"),
        senderUserId: "u1",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "m2",
        type: "IMAGE",
        content: null,
        fileUrl: "b",
        fileName: encodeGroupFileName(groupId, 1, "b.jpg"),
        senderUserId: "u1",
        createdAt: "2026-01-01T00:00:00.100Z",
      },
    ],
    "u2",
  );
  check(
    "attachment grouping persists 2 images in one bubble",
    grouped.length === 1 &&
      grouped[0].kind === "image-group" &&
      grouped[0].kind === "image-group" &&
      grouped[0].images.length === 2,
  );

  const roundtripId = randomUUID();
  const parsed = parseGroupFileName(encodeGroupFileName(roundtripId, 2, "x.png"));
  check(
    "group fileName roundtrip",
    parsed?.groupId === roundtripId && parsed.index === 2,
  );

  const sendMessage = read("src/server/message/send-message.ts");
  check(
    "accepted send uses conversation access gate",
    sendMessage.includes("getSendableConversation") &&
      sendMessage.includes("content: trimmed"),
  );
  check(
    "accepted conversation does not block contact info",
    !sendMessage.includes("containsBlockedContactInfo") &&
      !sendMessage.includes("sanitizeCommercialText"),
  );

  check(
    "image captions do not strip contact after accept",
    !sendImages.includes("containsBlockedContactInfo") &&
      !sendImages.includes("sanitizeCommercialText") &&
      sendImages.includes("getSendableConversation"),
  );

  check(
    "composer omits contact warning in accepted send",
    !composer.includes("Telefon, e-posta ve IBAN paylaşılamaz") &&
      !composer.includes("telefon ve IBAN paylaşılamaz"),
  );

  const offerService = read("src/server/offer/offer-service.ts");
  check(
    "pre-accept offer form still blocks contact",
    offerService.includes("containsBlockedContactInfo") &&
      offerService.includes("Teklif metninde telefon, IBAN"),
  );

  const offerAmount = formatConversationMoney(48000, "TRY");
  const counterAmount = formatConversationMoney(44000, "TRY");
  const processSteps = buildConversationProcessSteps({
    requestTitle: "Yönetici koltuğu",
    requestAt: "2026-08-16T09:00:00.000Z",
    hasOffer: true,
    offerAmountLabel: offerAmount,
    offerSubmittedAt: "2026-08-18T11:32:00.000Z",
    hasNegotiation: true,
    negotiationAmountLabel: counterAmount,
    negotiationAt: "2026-08-18T12:10:00.000Z",
    offerAccepted: true,
    acceptedAmountLabel: counterAmount,
    offerAcceptedAt: "2026-08-18T12:40:00.000Z",
    conversationOpened: true,
    conversationOpenedAt: "2026-08-18T12:41:00.000Z",
    dealCompleted: true,
    dealCompletedAt: "2026-08-20T10:00:00.000Z",
    reviewSubmitted: true,
    reviewRating: 5,
    reviewSubmittedAt: "2026-08-20T11:00:00.000Z",
  });
  check(
    "process rail uses real commercial details",
    processSteps.find((step) => step.id === "request")?.detail ===
      "Yönetici koltuğu" &&
      processSteps.find((step) => step.id === "offer")?.detail ===
        `${offerAmount} teklif verildi` &&
      processSteps.find((step) => step.id === "negotiation")?.detail ===
        `${counterAmount} karşı teklif` &&
      processSteps.find((step) => step.id === "accepted")?.detail ===
        `${counterAmount} üzerinde anlaşıldı` &&
      processSteps.find((step) => step.id === "review")?.detail ===
        "5 yıldız değerlendirme verildi",
  );
  check(
    "process rail does not invent missing stages",
    buildConversationProcessSteps({
      requestTitle: "X",
      requestAt: "2026-08-16T09:00:00.000Z",
      hasOffer: true,
      offerAmountLabel: "1.000 TRY",
      offerSubmittedAt: "2026-08-16T10:00:00.000Z",
      hasNegotiation: false,
      negotiationAmountLabel: null,
      negotiationAt: null,
      offerAccepted: false,
      acceptedAmountLabel: null,
      offerAcceptedAt: null,
      conversationOpened: false,
      conversationOpenedAt: null,
      dealCompleted: false,
      dealCompletedAt: null,
      reviewSubmitted: false,
      reviewRating: null,
      reviewSubmittedAt: null,
    }).every((step) => step.id === "request" || step.id === "offer"),
  );

  const shell = read("src/components/panel/ConversationShell.tsx");
  check(
    "thread banner reuses category artwork component",
    shell.includes("ConversationCategoryArt") &&
      shell.includes("coverImageUrl") &&
      shell.includes("categorySlug"),
  );

  check(
    "composer remains above transaction status",
    shell.lastIndexOf("<MessageComposer") <
      shell.lastIndexOf("<DealOutcomePanel") &&
      shell.lastIndexOf("<DealOutcomePanel") <
        shell.lastIndexOf("<DealReviewPanel"),
  );

  const outcome = read("src/components/panel/DealOutcomePanel.tsx");
  check(
    "completion panel compact and collapsed by default",
    outcome.includes("compact") &&
      outcome.includes('useState(false)') &&
      outcome.includes("İşlem durumu"),
  );

  const review = read("src/components/panel/DealReviewPanel.tsx");
  check(
    "review panel dismissible in compact mode",
    review.includes("dismissKey") && review.includes("compact"),
  );

  const profileService = read("src/server/profile/public-profile-service.ts");
  check(
    "public profile service excludes email/phone from dto",
    profileService.includes("formatParticipantLocation(user.city, user.country)") &&
      !profileService.match(/return\s*\{[\s\S]*email:/) &&
      profileService.includes("assertConversationParticipantAccess"),
  );

  const drawer = read("src/components/panel/ParticipantProfileDrawer.tsx");
  check(
    "participant profile drawer + full profile link",
    drawer.includes("ParticipantProfileDrawer") &&
      drawer.includes("Tam profili görüntüle") &&
      drawer.includes("role=\"dialog\""),
  );

  const lightbox = read("src/components/panel/MessageImageLightbox.tsx");
  check(
    "message lightbox keyboard navigation",
    lightbox.includes("ArrowLeft") &&
      lightbox.includes("ArrowRight") &&
      lightbox.includes("Escape"),
  );

  const preview = read("src/components/panel/profile/PublicProfilePreviewPanel.tsx");
  check(
    "profile preview uses public participant card",
    preview.includes("PublicProfileCard") &&
      preview.includes("PublicUserProfileDto"),
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
if (errors.length > 0) {
  console.log("\nFailures:");
  for (const error of errors) console.log(`- ${error}`);
  process.exit(1);
}
