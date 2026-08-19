/**
 * Incoming offers sidebar badge — unread notification events authority.
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
const unreadLib = read("src/lib/offer/offer-event-unread.ts");
const layout = read("src/app/panel/layout.tsx");
const shell = read("src/components/panel/PanelShell.tsx");
const commandShell = read("src/components/panel/CommandPersonalSidebar.tsx");
const panelPage = read("src/app/panel/page.tsx");
const sayfamHomeData = read("src/lib/panel/sayfam-home-data.ts");

check(
  "unread count authority exported",
  unreadLib.includes("export async function countUnreadIncomingOfferEvents") &&
    unreadLib.includes("BUYER_OFFER_UNREAD_TYPES") &&
    unreadLib.includes("unreadNotificationWhere"),
);
check(
  "dashboard action-required separate from unread",
  (panelPage.includes("summary.newOffers") ||
    sayfamHomeData.includes("summary.newOffers")) &&
    sayfamHomeData.includes("actionRequiredOffers: summary.newOffers") &&
    panelData.includes("newOffers: buyerActionRequiredOffers") &&
    panelData.includes("unreadIncomingOfferEvents"),
);
check(
  "layout passes unread count to shell",
  layout.includes("unreadIncomingOfferEvents={unreadIncomingOfferEvents}") &&
    layout.includes("summary.unreadIncomingOfferEvents"),
);
check(
  "shell badges gelen-teklifler only in personal sidebar",
  commandShell.includes('href === "/panel/gelen-teklifler"') &&
    commandShell.includes("unreadIncomingOfferEvents") &&
    commandShell.includes("formatPanelCountBadge"),
);
check("zero hides badge", commandShell.includes("if (count <= 0) return undefined"));
check("99+ cap", commandShell.includes('count > 99 ? "99+"'));
check(
  "screen reader label mentions unread",
  commandShell.includes("okunmamış") && commandShell.includes("badgeAriaLabel"),
);
check(
  "badge wired in command personal sidebar",
  shell.includes("unreadIncomingOfferEvents={liveIncomingUnread}") &&
    shell.includes("CommandPersonalSidebar") &&
    commandShell.includes('href === "/panel/gelen-teklifler"'),
);

async function liveConsistency() {
  const { config } = await import("dotenv");
  config({ path: join(ROOT, ".env.local") });
  config({ path: join(ROOT, ".env") });

  const { prisma } = await import("../src/lib/prisma");
  const { countUnreadIncomingOfferEvents, getPanelSummary, countBuyerActionRequiredOffers } =
    await import("../src/lib/panel/get-panel-data");

  try {
    const dincer = await prisma.user.findFirst({
      where: { email: { equals: "dincer_@hotmail.com.tr", mode: "insensitive" } },
      select: { id: true },
    });
    if (!dincer) {
      check("live dincer account", false, "user not found");
      return;
    }

    const [unread, summary, actionRequired] = await Promise.all([
      countUnreadIncomingOfferEvents(dincer.id),
      getPanelSummary(dincer.id),
      countBuyerActionRequiredOffers(dincer.id),
    ]);
    check(
      "live sidebar unread equals summary field",
      unread === summary.unreadIncomingOfferEvents,
    );
    check(
      "live action required can differ from unread",
      typeof actionRequired === "number" && typeof unread === "number",
    );
    console.log(
      `INFO — unreadIncoming=${unread} buyerActionRequired=${actionRequired} dashboard=${summary.newOffers}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

check(
  "buyer unread notification filter",
  unreadLib.includes("NEW_OFFER") && unreadLib.includes("COUNTER_OFFER_RECEIVED"),
);
check(
  "no duplicate prisma query helper in shell",
  !shell.includes("prisma.notification.count"),
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
