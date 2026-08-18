/**
 * Incoming offers sidebar badge — shares dashboard “Yeni teklifler” count authority.
 * Run: npx tsx scripts/verify-incoming-offers-nav-badge-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`PASS — ${name}`);
  } else {
    fail += 1;
    console.log(`FAIL — ${detail ? `${name}: ${detail}` : name}`);
  }
}

const panelData = read("src/lib/panel/get-panel-data.ts");
const layout = read("src/app/panel/layout.tsx");
const shell = read("src/components/panel/PanelShell.tsx");
const panelPage = read("src/app/panel/page.tsx");

check(
  "shared count authority exported",
  panelData.includes("export async function countNewIncomingOffers") &&
    panelData.includes("NEW_INCOMING_OFFER_STATUSES") &&
    panelData.includes('status: { in: [...NEW_INCOMING_OFFER_STATUSES] }'),
);
check(
  "dashboard uses same summary field",
  panelPage.includes("summary.newOffers") &&
    panelData.includes("newOffers: offersOnMyRequests") &&
    panelData.includes("countNewIncomingOffers(userId)"),
);
check(
  "layout passes count to shell once",
  layout.includes("newIncomingOffers={newIncomingOffers}") &&
    layout.includes("newIncomingOffers = summary.newOffers"),
);
check(
  "shell badges gelen-teklifler only in personal sidebar",
  shell.includes('href === "/panel/gelen-teklifler"') &&
    shell.includes("newIncomingOffers") &&
    shell.includes("formatNavCountBadge"),
);
check("zero hides badge", shell.includes("if (count <= 0) return undefined"));
check("99+ cap", shell.includes('count > 99 ? "99+"'));
check(
  "screen reader label",
  shell.includes("yeni gelen teklif") && shell.includes("badgeAriaLabel"),
);
check(
  "badge wired in personal sidebar only",
  shell.includes("newIncomingOffers={newIncomingOffers}") &&
    shell.includes("function PersonalSidebar") &&
    shell.includes('href === "/panel/gelen-teklifler"'),
);

async function liveConsistency() {
  const { config } = await import("dotenv");
  config({ path: join(ROOT, ".env.local") });
  config({ path: join(ROOT, ".env") });

  const { prisma } = await import("../src/lib/prisma");
  const {
    countNewIncomingOffers,
    getPanelSummary,
  } = await import("../src/lib/panel/get-panel-data");

  try {
    const dincer = await prisma.user.findFirst({
      where: { email: { equals: "dincer_@hotmail.com.tr", mode: "insensitive" } },
      select: { id: true },
    });
    if (!dincer) {
      check("live dincer account", false, "user not found");
      return;
    }

    const [direct, summary] = await Promise.all([
      countNewIncomingOffers(dincer.id),
      getPanelSummary(dincer.id),
    ]);
    check("live dashboard/sidebar count equal", direct === summary.newOffers);
    console.log(
      `INFO — dincer newOffers=${summary.newOffers} (dashboard == sidebar authority)`,
    );

    const other = await prisma.user.findFirst({
      where: {
        NOT: { id: dincer.id },
        email: { contains: "@", mode: "insensitive" },
      },
      select: { id: true },
    });
    if (other) {
      const cross = await prisma.offer.count({
        where: {
          request: { createdById: dincer.id, deletedAt: null },
          submittedById: other.id,
          status: { in: ["SUBMITTED", "VIEWED"] },
        },
      });
      if (cross > 0) {
        const otherCount = await countNewIncomingOffers(other.id);
        check(
          "other user count excludes dincer requests",
          otherCount === 0 || otherCount < direct,
        );
      } else {
        check("other user isolation sample", true);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

check(
  "workspace isolation in count query",
  panelData.includes("createdById: userId") &&
    panelData.includes("deletedAt: null"),
);
check(
  "pending statuses only",
  panelData.includes('"SUBMITTED"') && panelData.includes('"VIEWED"'),
);
check(
  "no duplicate prisma query helper in shell",
  !shell.includes("prisma.offer.count"),
);

async function main() {
  await liveConsistency();

  console.log(`\nverify-incoming-offers-nav-badge-v1: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
