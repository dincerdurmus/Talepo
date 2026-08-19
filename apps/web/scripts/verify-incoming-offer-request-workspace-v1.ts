/**
 * Buyer incoming offers: request inbox + per-request workspace.
 * Run: npx tsx scripts/verify-incoming-offer-request-workspace-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  aggregateIncomingRequestGroups,
  countIncomingRequestInboxFilters,
  requestGroupMatchesInboxFilter,
  sortIncomingRequestGroups,
} from "../src/lib/offer/incoming-request-inbox";
import {
  buildIncomingOffersInboxPath,
  buildIncomingRequestWorkspacePath,
  classifyIncomingOfferInbox,
  isBuyerActionableIncomingOffer,
  offerMatchesIncomingInboxFilter,
} from "../src/lib/offer/incoming-offer-inbox";
import { mapIncomingRequestOfferRow } from "../src/lib/offer/incoming-offer-mapper";
import type { BuyerIncomingOfferRow } from "../src/server/offer/load-buyer-incoming-offers";

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

function offerRow(
  partial: Partial<BuyerIncomingOfferRow> & {
    id: string;
    request: BuyerIncomingOfferRow["request"];
  },
): BuyerIncomingOfferRow {
  return {
    amount: 8400,
    currency: "TRY",
    deliveryDays: 3,
    title: null,
    description: "fixture",
    validUntil: null,
    status: "SUBMITTED",
    createdAt: new Date("2026-08-18T10:00:00Z"),
    updatedAt: new Date("2026-08-18T10:00:00Z"),
    company: null,
    submittedBy: { id: "seller-1", name: "Satıcı" },
    conversation: null,
    media: [],
    negotiations: [],
    ...partial,
  };
}

console.log("\n=== ROUTES & SURFACES ===\n");
{
  const inbox = read("src/app/panel/gelen-teklifler/page.tsx");
  const workspace = read("src/app/panel/gelen-teklifler/[requestId]/page.tsx");
  const requestCard = read("src/components/panel/IncomingRequestInboxCard.tsx");
  const workspaceClient = read("src/components/panel/IncomingOfferWorkspace.tsx");
  const sellerPage = read("src/app/panel/teklifler/page.tsx");

  check("inbox route exists", inbox.includes("IncomingOffersInboxPage"));
  check("workspace route exists", workspace.includes("IncomingOfferRequestWorkspacePage"));
  check("inbox uses request cards only", inbox.includes("IncomingRequestInboxCard"));
  check("inbox no offer card on page", !inbox.includes("IncomingOfferCard"));
  check("inbox no seen marker", !inbox.includes("OfferCardSeenMarker"));
  check("inbox no compare group", !inbox.includes("IncomingOfferCompareGroup"));
  check("workspace uses IncomingOfferWorkspace", workspace.includes("IncomingOfferWorkspace"));
  check("workspace uses IncomingOfferCard", workspaceClient.includes("IncomingOfferCard"));
  check("seen only in workspace", workspaceClient.includes("OfferCardSeenMarker"));
  check("compare default closed", workspaceClient.includes('useState(false)') && workspaceClient.includes("Teklifleri karşılaştır"));
  check("request card CTA", requestCard.includes("Teklifleri incele"));
  check("summary talep · teklif", inbox.includes("talep ·") && inbox.includes("teklif"));
  check("legacy deep link redirect", inbox.includes("loadBuyerIncomingOfferById") && inbox.includes("buildIncomingRequestWorkspacePath"));
  check("workspace ownership 404", workspace.includes("createdById: user.id") && workspace.includes("notFound()"));
  check("workspace excludes draft via loader", workspace.includes("loadBuyerIncomingOffers"));
  check("seller page untouched", sellerPage.includes("OutgoingOfferCompareGroup") && !sellerPage.includes("IncomingOfferWorkspace"));
  check("no separate pazarlik route", !read("src/components/panel/panel-nav.ts").includes("/panel/pazarlik"));
  check(
    "panel Geri hidden on workspace route",
    read("src/components/panel/PanelShell.tsx").includes(
      "/^\\/panel\\/gelen-teklifler\\/[^/]+$/",
    ),
  );
  check(
    "inbox back href built on page",
    workspace.includes("inboxBackHref") &&
      workspace.includes("buildIncomingOffersInboxPath"),
  );
  check(
    "workspace inbox back is prominent link",
    workspaceClient.includes("Gelen tekliflere dön") &&
      workspaceClient.includes("href={inboxBackHref}"),
  );
  check(
    "workspace card uses compareStripLayout",
    workspaceClient.includes("compareStripLayout"),
  );
  check(
    "workspace rail+card without request summary column",
    workspaceClient.includes("lg:grid-cols-[5.75rem_minmax(0,1fr)]") &&
      !workspaceClient.includes("<IncomingRequestSummary"),
  );
  check(
    "compact request summary row",
    workspaceClient.includes("h-[4.5rem]") && workspaceClient.includes("sm:h-20"),
  );
  check(
    "offer list column width",
    workspaceClient.includes("lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)]"),
  );
  check(
    "mobile bottom scroll padding",
    workspaceClient.includes("pb-[calc(5.5rem+env(safe-area-inset-bottom"),
  );
  check(
    "filter strip client scroll hint",
    read("src/components/panel/IncomingOfferInboxFilters.tsx").includes('"use client"') &&
      read("src/components/panel/IncomingOfferInboxFilters.tsx").includes("scrollIntoView"),
  );
}

console.log("\n=== REQUEST GROUPING ===\n");
{
  const reqA = {
    id: "req-a",
    title: "Ofis koltuğu",
    city: "İstanbul",
    status: "PUBLISHED",
    coverImageUrl: null,
    budgetMin: null,
    budgetMax: 12000,
    currency: "TRY",
    category: { name: "Mobilya", slug: "mobilya" },
    fieldValues: [],
  };
  const reqB = { ...reqA, id: "req-b", title: "Masa" };

  const rows = [
    offerRow({ id: "o1", request: reqA }),
    offerRow({ id: "o2", request: reqA, amount: 14000 }),
    offerRow({ id: "o3", request: reqB }),
  ].map(mapIncomingRequestOfferRow);

  const unread = new Set(["o1", "o3"]);
  const groups = aggregateIncomingRequestGroups({
    offers: rows,
    unreadOfferIds: unread,
    getRequest: (offer) => {
      const source = rows.find((row) => row.id === offer.id)!;
      const req = [reqA, reqB].find((row) =>
        ["o1", "o2"].includes(offer.id) ? row.id === "req-a" : row.id === "req-b",
      )!;
      return {
        id: req.id,
        title: req.title,
        city: req.city,
        status: req.status,
        coverImageUrl: req.coverImageUrl,
        categorySlug: req.category.slug,
        categoryName: req.category.name,
        budgetLabel: "₺12.000",
        budgetMin: null,
        budgetMax: 12000,
        currency: req.currency,
      };
    },
  });

  check("N offers same request → one group", groups.filter((g) => g.request.id === "req-a").length === 1);
  check("req-a has 2 offers", groups.find((g) => g.request.id === "req-a")?.totalOffers === 2);
  check("req-b has 1 offer", groups.find((g) => g.request.id === "req-b")?.totalOffers === 1);
  check("price range on group", Boolean(groups.find((g) => g.request.id === "req-a")?.priceRangeLabel?.includes("–")));
  check("unread counted per offer in group", groups.find((g) => g.request.id === "req-a")?.unreadCount === 1);

  const filterCounts = countIncomingRequestInboxFilters(groups, unread);
  check("filter counts are request groups not offers", filterCounts.all === 2);
  check("unread filter counts requests", filterCounts.unread === 2);
}

console.log("\n=== FILTERS & SORT ===\n");
{
  const req = {
    id: "req-x",
    title: "Test",
    city: null,
    status: "PUBLISHED",
    coverImageUrl: null,
    budgetMin: null,
    budgetMax: null,
    currency: "TRY",
    category: { name: "X", slug: "x" },
    fieldValues: [],
  };
  const actionable = mapIncomingRequestOfferRow(
    offerRow({
      id: "act",
      status: "VIEWED",
      request: req,
      negotiations: [
        {
          id: "n1",
          amount: 9000,
          currency: "TRY",
          proposedBySide: "PROVIDER",
          status: "PENDING",
          createdAt: new Date(),
        },
      ],
    }),
  );
  const concluded = mapIncomingRequestOfferRow(
    offerRow({ id: "done", status: "ACCEPTED", request: req }),
  );

  const group = aggregateIncomingRequestGroups({
    offers: [actionable, concluded],
    unreadOfferIds: new Set(),
    getRequest: () => ({
      id: req.id,
      title: req.title,
      city: req.city,
      status: req.status,
      coverImageUrl: req.coverImageUrl,
      categorySlug: req.category.slug,
      categoryName: req.category.name,
      budgetLabel: null,
      budgetMin: null,
      budgetMax: null,
      currency: req.currency,
    }),
  })[0]!;

  check(
    "action_required filter matches group",
    requestGroupMatchesInboxFilter(group, "action_required", new Set()),
  );
  check(
    "concluded filter matches mixed group",
    requestGroupMatchesInboxFilter(group, "concluded", new Set()),
  );
  check("action required helper", isBuyerActionableIncomingOffer(actionable));
  check(
    "buyer not actionable on own pending",
    !isBuyerActionableIncomingOffer({
      status: "VIEWED",
      negotiations: [
        { status: "PENDING", proposedBySide: "BUYER", createdAt: new Date() },
      ],
    }),
  );

  const sorted = sortIncomingRequestGroups([
    { ...group, sortRank: 4, lastActivityAt: new Date("2026-01-01") },
    {
      ...group,
      request: { ...group.request, id: "req-y", title: "Y" },
      sortRank: 0,
      lastActivityAt: new Date("2026-06-01"),
    },
  ]);
  check("action required sorts first", sorted[0]?.sortRank === 0);
}

console.log("\n=== DEEP LINKS ===\n");
{
  check(
    "canonical workspace path",
    buildIncomingRequestWorkspacePath({
      requestId: "req-1",
      teklif: "off-1",
      tur: "neg-1",
    }) === "/panel/gelen-teklifler/req-1?teklif=off-1&tur=neg-1",
  );
  check(
    "inbox path no teklif",
    buildIncomingOffersInboxPath({ filter: "all" }) === "/panel/gelen-teklifler",
  );
  check(
    "legacy buildIncomingOffersPath keeps query on inbox",
    read("src/lib/offer/incoming-offer-inbox.ts").includes("buildIncomingOffersPath"),
  );
}

console.log("\n=== MOBILE & A11Y ===\n");
{
  const workspace = read("src/components/panel/IncomingOfferWorkspace.tsx");
  const listItem = read("src/components/panel/IncomingOfferWorkspaceListItem.tsx");
  check(
    "mobile list/detail toggle",
    workspace.includes('mobileView === "detail"') &&
      workspace.includes("Teklif listesine dön"),
  );
  check("desktop two columns", workspace.includes("lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)]"));
  check("selected aria-current", listItem.includes("aria-current"));
  check(
    "list item budget compare authority",
    listItem.includes("compareBuyerBudgetToOffer") &&
      listItem.includes("budgetCompareListDeltaLabel"),
  );
  check(
    "list item status authority",
    listItem.includes("resolveOfferCardStatusHeader"),
  );
  check(
    "list item message preview",
    listItem.includes("line-clamp-2") && listItem.includes("previewMessage"),
  );
  check(
    "list item metadata icons",
    listItem.includes("Clock") &&
      listItem.includes("Camera") &&
      listItem.includes("ArrowLeftRight"),
  );
  check("detail focus on select", workspace.includes("detailHeadingRef"));
  check("gallery in card not always open", read("src/components/panel/IncomingOfferGallery.tsx").includes("mediaIds.length === 0) return null"));
  check("actions only buyer turn", read("src/components/panel/IncomingOfferCard.tsx").includes("showActions") && read("src/components/panel/OfferActions.tsx").includes("Teklifi kabul et"));
}

console.log("\n=== ARCHIVE ===\n");
{
  const inboxLib = read("src/lib/offer/incoming-request-inbox.ts");
  const inboxPage = read("src/app/panel/gelen-teklifler/page.tsx");
  check("countArchivedRequestGroups", inboxLib.includes("countArchivedRequestGroups"));
  check("archive filter chip", read("src/components/panel/IncomingOfferInboxFilters.tsx").includes("Arşiv"));
  check("mixed archive uses offer ids not whole request", inboxPage.includes("countArchivedRequestGroups"));
  check("workspace archived redirect", read("src/app/panel/gelen-teklifler/[requestId]/page.tsx").includes("archiveView: true"));
}

console.log("\n=== CLASSIFICATION CONTRACT ===\n");
{
  check(
    "unread ≠ action required",
    offerMatchesIncomingInboxFilter("negotiating", "unread", {
      offerId: "x",
      unreadOfferIds: new Set(["x"]),
    }) &&
      !offerMatchesIncomingInboxFilter("negotiating", "action_required", {
        offer: {
          status: "VIEWED",
          negotiations: [
            {
              status: "PENDING",
              proposedBySide: "BUYER",
              createdAt: new Date(),
            },
          ],
        },
      }),
  );
  check(
    "new bucket",
    classifyIncomingOfferInbox({ status: "SUBMITTED", negotiations: [] }) === "new",
  );
}

if (fail > 0) {
  console.log(`\nFAILED ${fail}/${pass + fail}`);
  for (const error of errors) console.log(` - ${error}`);
  process.exit(1);
}

console.log(`\nOK ${pass}/${pass + fail} — incoming offer request workspace v1`);
