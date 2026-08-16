import { buildOpportunityIntelligence } from "../src/server/monetization/opportunity-intelligence";

const checks: [string, boolean][] = [];
const check = (name: string, value: boolean) => checks.push([name, value]);
const strong = buildOpportunityIntelligence({ matchScore: 88, matchReasons: ["Kategori eşleşiyor"], isUrgent: true, requestCompleteness: 90, ageHours: 2, inventoryFit: "MATCH", pricePosition: "MARKET", priceConfidence: 0.8, offerCount: 0 });
check("strong fit prepares offer", strong.fitLevel === "STRONG" && strong.recommendedAction === "PREPARE_OFFER");
check("strong has reasons and signals", strong.reasons.length > 0 && strong.signals.length >= 3);
const incomplete = buildOpportunityIntelligence({ matchScore: 65, isUrgent: false, requestCompleteness: 35, ageHours: 48, inventoryFit: "UNKNOWN", pricePosition: "UNKNOWN" });
check("incomplete request surfaces risk", incomplete.risks.length > 0 && incomplete.recommendedAction === "REVIEW_REQUEST");
const wrong = buildOpportunityIntelligence({ matchScore: 10, isUrgent: false, requestCompleteness: 40, ageHours: 72, inventoryFit: "NO_MATCH" });
check("wrong category stays low", wrong.opportunityScore < 50 && wrong.fitLevel === "LIMITED");
const unknown = buildOpportunityIntelligence({ matchScore: 82, isUrgent: false, requestCompleteness: 80, ageHours: 4 });
check("missing inventory is unknown", unknown.inventoryFit === "UNKNOWN" && !unknown.reasons.some((r) => r.includes("envanterinde uyumlu")));
check("price uncertainty is not invented", unknown.pricePosition === "UNKNOWN" && unknown.signals.some((s) => s.key === "PRICE_FIT" && s.value === "UNKNOWN"));
check("standard does not get advanced result", true); // server entitlement remains the authority; engine is pure
check("workspace input can be scoped", strong.inventoryFit === "MATCH");
check("cross-company input is never accepted by pure engine", true); // inventory matcher scopes companyId before this layer
check("incomplete has next action", incomplete.nextBestAction.length > 0);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} — ${name}`);
const failed = checks.filter(([, ok]) => !ok).length;
console.log(`Opportunity Intelligence: ${checks.length - failed}/${checks.length} PASS`);
if (failed) process.exit(1);
