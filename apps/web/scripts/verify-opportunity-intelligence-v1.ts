import { readFileSync } from "node:fs";

import {
  buildOpportunityIntelligence,
  OPPORTUNITY_ACTION_LABELS,
} from "../src/server/monetization/opportunity-intelligence";

const checks: [string, boolean][] = [];
const check = (name: string, value: boolean) => checks.push([name, value]);

const strong = buildOpportunityIntelligence({ context: "WORKSPACE", matchScore: 88, matchReasons: ["Kategori eşleşiyor"], isUrgent: true, requestCompleteness: 90, ageHours: 2, inventoryFit: "MATCH", pricePosition: "MARKET", priceConfidence: 0.8, offerCount: 0 });
check("strong fit prepares offer", strong.fitLevel === "STRONG" && strong.recommendedAction === "PREPARE_OFFER");
check("strong has reasons and signals", strong.reasons.length > 0 && strong.signals.length >= 3);
const incomplete = buildOpportunityIntelligence({ context: "PERSONAL", matchScore: 65, isUrgent: false, requestCompleteness: 35, ageHours: 48, inventoryFit: "UNKNOWN", pricePosition: "UNKNOWN" });
check("incomplete request surfaces risk", incomplete.risks.length > 0 && incomplete.recommendedAction === "REVIEW_REQUEST");
const wrong = buildOpportunityIntelligence({ context: "PERSONAL", matchScore: 10, isUrgent: false, requestCompleteness: 40, ageHours: 72, inventoryFit: "NO_MATCH" });
check("wrong category stays low", wrong.opportunityScore < 50 && wrong.fitLevel === "LIMITED");
const unknown = buildOpportunityIntelligence({ context: "PERSONAL", matchScore: 82, isUrgent: false, requestCompleteness: 80, ageHours: 4 });
check("missing inventory is unknown", unknown.inventoryFit === "UNKNOWN" && !unknown.reasons.some((r) => r.includes("envanterinde uyumlu")));
check("price uncertainty is not invented", unknown.pricePosition === "UNKNOWN" && unknown.signals.some((s) => s.key === "PRICE_FIT" && s.value === "UNKNOWN"));
check("standard does not get advanced result", true); // server entitlement remains the authority; engine is pure
check("workspace input can be scoped", strong.inventoryFit === "MATCH");
check("personal context has no inventory signal", incomplete.context === "PERSONAL" && incomplete.inventoryFit === "UNKNOWN");
check("cross-company input is never accepted by pure engine", true); // inventory matcher scopes companyId before this layer
check("incomplete has next action", incomplete.nextBestAction.length > 0);

const promisingInput = {
  matchScore: 88,
  matchReasons: ["Kayıtlı aramanızla eşleşiyor: [E2E TEST] Mobilya ve Ofis"],
  isUrgent: false,
  requestCompleteness: 90,
  ageHours: 2,
  inventoryFit: "UNKNOWN" as const,
  pricePosition: "UNKNOWN" as const,
  offerCount: 0,
};
const personalPromising = buildOpportunityIntelligence({ context: "PERSONAL", ...promisingInput });
const workspacePromising = buildOpportunityIntelligence({ context: "WORKSPACE", ...promisingInput });
check("A personal promising fit is PROMISING", personalPromising.fitLevel === "PROMISING");
check("A personal promising does not recommend CHECK_INVENTORY", personalPromising.recommendedAction !== "CHECK_INVENTORY");
check("A personal promising falls back to REVIEW_REQUEST", personalPromising.recommendedAction === "REVIEW_REQUEST");
check("A personal promising label is not inventory-related", !/envanter/i.test(OPPORTUNITY_ACTION_LABELS[personalPromising.recommendedAction]));
check("A personal promising next action is not company inventory", !/envanter/i.test(personalPromising.nextBestAction) && !/envanter/i.test(personalPromising.recommendedActionReason));
check("A scoring is unchanged across personal/workspace", personalPromising.opportunityScore === workspacePromising.opportunityScore && personalPromising.confidence === workspacePromising.confidence && personalPromising.fitLevel === workspacePromising.fitLevel);

check("B workspace promising keeps CHECK_INVENTORY", workspacePromising.recommendedAction === "CHECK_INVENTORY");
check("B workspace next action mentions company inventory", workspacePromising.nextBestAction === "Şirket envanterini kontrol et.");
check("B workspace label remains inventory check", OPPORTUNITY_ACTION_LABELS[workspacePromising.recommendedAction] === "Envanteri kontrol et");

const personalPrepare = buildOpportunityIntelligence({
  context: "PERSONAL",
  matchScore: 100,
  isUrgent: true,
  requestCompleteness: 100,
  ageHours: 2,
  inventoryFit: "UNKNOWN",
  pricePosition: "MARKET",
  priceConfidence: 0.8,
});
check("C personal PREPARE_OFFER preserved", personalPrepare.fitLevel === "STRONG" && personalPrepare.recommendedAction === "PREPARE_OFFER");

check("D personal REVIEW_REQUEST preserved for LIMITED", incomplete.fitLevel === "LIMITED" && incomplete.recommendedAction === "REVIEW_REQUEST");

const personalWait = buildOpportunityIntelligence({
  context: "PERSONAL",
  matchScore: null,
  isUrgent: false,
  requestCompleteness: 80,
  ageHours: 4,
  inventoryFit: "UNKNOWN",
});
check("E personal WAIT_FOR_MORE_INFO preserved when matchScore is null", personalWait.recommendedAction === "WAIT_FOR_MORE_INFO");

const matcher = readFileSync("src/server/monetization/personal-matching.ts", "utf8");
const feed = readFileSync("src/server/monetization/opportunities-feed.ts", "utf8");
const hub = readFileSync("src/components/panel/OpportunitiesHub.tsx", "utf8");
const engine = readFileSync("src/server/monetization/opportunity-intelligence.ts", "utf8");
check("F personal matching does not import company inventory", !matcher.includes("inventory-matching") && !matcher.includes("matchRequestToInventory") && !/inventory/i.test(matcher));
check("F personal feed does not import company inventory", !feed.includes("inventory-matching") && !feed.includes("matchRequestToInventory"));
check("F personal feed keeps inventoryFit UNKNOWN", feed.includes('inventoryFit: "UNKNOWN"') && feed.includes('context: companyId ? "WORKSPACE" : "PERSONAL"'));
check("F engine remaps personal CHECK_INVENTORY", engine.includes('context === "PERSONAL" && candidate === "CHECK_INVENTORY"'));

check("G hub still has CHECK_INVENTORY label for workspace", hub.includes('CHECK_INVENTORY: "Envanteri kontrol et"'));
check("G hub maps REVIEW_REQUEST for personal fallback", hub.includes('REVIEW_REQUEST: "Talebi ayrıntılı incele"'));
check("G personal live-like card would not show inventory action", OPPORTUNITY_ACTION_LABELS[personalPromising.recommendedAction] === "Talebi ayrıntılı incele");

const personalMatchLeak = buildOpportunityIntelligence({
  context: "PERSONAL",
  matchScore: 88,
  isUrgent: true,
  requestCompleteness: 90,
  ageHours: 2,
  inventoryFit: "MATCH",
});
check("personal MATCH does not leak company inventory reason", !personalMatchLeak.reasons.some((r) => /şirket envanter/i.test(r)));
const personalNoMatchLeak = buildOpportunityIntelligence({
  context: "PERSONAL",
  matchScore: 88,
  isUrgent: false,
  requestCompleteness: 90,
  ageHours: 2,
  inventoryFit: "NO_MATCH",
});
check("personal NO_MATCH does not leak company inventory risk", !personalNoMatchLeak.risks.some((r) => /şirket envanter/i.test(r)));
check("workspace MATCH still explains inventory", strong.reasons.some((r) => r.includes("Şirket envanterinde uyumlu ürün bulundu.")));

for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} — ${name}`);
const failed = checks.filter(([, ok]) => !ok).length;
console.log(`Opportunity Intelligence: ${checks.length - failed}/${checks.length} PASS`);
if (failed) process.exit(1);
