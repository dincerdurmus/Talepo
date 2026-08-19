/**
 * Multi-photo logical message group contract.
 * Run: npx tsx scripts/verify-message-photo-group-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import {
  encodeGroupFileName,
  formatImageMessagePreview,
  groupConversationMessages,
  isValidAttachmentGroupId,
  logicalMessageRowCount,
  parseGroupFileName,
  sanitizeUserFileName,
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

console.log("\n=== MULTI-PHOTO LOGICAL MESSAGE GROUP ===\n");

{
  check(
    "one Send with 3 images maps to 3 Message rows",
    logicalMessageRowCount(3) === 3,
  );

  const sendImages = read("src/server/message/send-image-message.ts");
  check(
    "group id generated server-side",
    sendImages.includes("randomUUID()") &&
      sendImages.includes("encodeGroupFileName(groupId"),
  );
  check(
    "user fileName sanitized before encode",
    sendImages.includes("sanitizeUserFileName"),
  );
  check(
    "batch persisted inside single prisma transaction",
    sendImages.includes("prisma.$transaction") &&
      sendImages.match(/for \(let index = 0; index < moderated\.length/) !==
        null,
  );
  check(
    "moderation completes before transaction (partial failure safe)",
    sendImages.indexOf("for (let index = 0; index < images.length") <
      sendImages.indexOf("prisma.$transaction"),
  );
  check(
    "single notification call site per send (not per row)",
    (sendImages.match(/createNotification\(/g) ?? []).length === 1,
  );
  check(
    "conversation lastMessageAt updated once in transaction",
    (sendImages.match(/lastMessageAt: now/g) ?? []).length === 1,
  );

  const composer = read("src/components/panel/MessageComposer.tsx");
  check(
    "composer sends one POST with images array",
    composer.includes("images: images.map") &&
      (composer.match(/fetch\(/g) ?? []).length >= 1,
  );

  const fakeGroup = "talepo-group:evil:0:photo.jpg";
  check(
    "user-controlled group prefix stripped from fileName",
    !sanitizeUserFileName(fakeGroup).startsWith("talepo-group:") &&
      parseGroupFileName(sanitizeUserFileName(fakeGroup)) === null,
  );

  check(
    "parser rejects non-uuid group ids (fail-closed)",
    parseGroupFileName("talepo-group:evil:0:photo.jpg") === null,
  );

  const groupId = randomUUID();
  check("parser accepts server uuid group ids", isValidAttachmentGroupId(groupId));

  const encoded = encodeGroupFileName(groupId, 2, "scan.jpg");
  check(
    "list preview shows grouped photo count from last row index",
    formatImageMessagePreview(encoded, null) === "3 fotoğraf",
  );

  const grouped = groupConversationMessages(
    [0, 1, 2].map((idx) => ({
      id: `m${idx}`,
      type: "IMAGE",
      content: idx === 0 ? "kap" : null,
      fileUrl: `url-${idx}`,
      fileName: encodeGroupFileName(groupId, idx, `p${idx}.jpg`),
      senderUserId: "u1",
      createdAt: `2026-01-01T00:00:0${idx}.000Z`,
    })),
    "u2",
  );
  check(
    "UI renders 3 DB rows as one image-group bubble",
    grouped.length === 1 &&
      grouped[0].kind === "image-group" &&
      grouped[0].kind === "image-group" &&
      grouped[0].images.length === 3,
  );

  check(
    "fourth photo rejected at API",
    read("src/app/api/conversations/[id]/messages/route.ts").includes(
      "Bir mesaja en fazla 3 fotoğraf",
    ) &&
      read("src/components/panel/MessageComposer.tsx").includes(
        "Bir mesaja en fazla 3 fotoğraf",
      ),
  );

  check("max constant remains 3", MAX_MESSAGE_IMAGES === 3);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (errors.length > 0) {
  console.log("\nFailures:");
  for (const error of errors) console.log(`- ${error}`);
  process.exit(1);
}
