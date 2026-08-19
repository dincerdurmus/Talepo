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

  const shell = read("src/components/panel/ConversationShell.tsx");
  check(
    "deal panels moved to header not above composer",
    shell.includes("DealOutcomePanel") &&
      shell.includes("compact") &&
      !shell.includes("mt-4 rounded-xl border border-teal-900/10 bg-white px-4 py-4"),
  );

  const profileService = read("src/server/profile/public-profile-service.ts");
  check(
    "public profile service excludes email/phone",
    !profileService.includes("email:") &&
      !profileService.includes("phone:") &&
      profileService.includes("assertConversationParticipantAccess"),
  );

  const drawer = read("src/components/panel/ParticipantProfileDrawer.tsx");
  check(
    "participant profile drawer + full profile link",
    drawer.includes("ParticipantProfileDrawer") &&
      drawer.includes("Profili görüntüle") &&
      drawer.includes("role=\"dialog\""),
  );

  const lightbox = read("src/components/panel/MessageImageLightbox.tsx");
  check(
    "message lightbox keyboard navigation",
    lightbox.includes("ArrowLeft") &&
      lightbox.includes("ArrowRight") &&
      lightbox.includes("Escape"),
  );

  const editor = read("src/components/panel/ProfileEditor.tsx");
  check(
    "profile editor preview aligned to public fields",
    editor.includes("Konuşmalarda görünen önizleme") &&
      editor.includes("PUBLIC_PROFILE_BIO_MAX"),
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
if (errors.length > 0) {
  console.log("\nFailures:");
  for (const error of errors) console.log(`- ${error}`);
  process.exit(1);
}
