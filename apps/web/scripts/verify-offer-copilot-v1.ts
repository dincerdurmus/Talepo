import assert from "node:assert/strict";
import { buildOfferCopilot } from "../src/server/offer-copilot/offer-copilot-engine";

const base = { context: "PERSONAL" as const, title: "Acil CNC parça üretimi", description: "10 adet, teknik ölçülere uygun üretim ve hızlı teslim", isUrgent: true };
const strong = buildOfferCopilot({ ...base, price: { confidence: 0.9, suggestedOfferBand: { low: 900, target: 1000, high: 1100 }, warnings: [] }, opportunity: { fit: "STRONG", reasons: ["Kategori eşleşmesi"] }, fields: { delivery: "3 gün" } });
assert.equal(strong.strategy, "AGGRESSIVE"); assert.equal(strong.recommendedPrice.target, 1000); assert.equal(strong.delivery.state, "KNOWN");
const weak = buildOfferCopilot({ ...base, price: { confidence: 0.2, suggestedOfferBand: null, warnings: ["Küçük örneklem"] } });
assert.equal(weak.strategy, "BALANCED"); assert.equal(weak.recommendedPrice.target, null); assert.match(weak.recommendedPrice.reason, /uydurulmadı/);
const workspace = buildOfferCopilot({ ...base, context: "WORKSPACE", inventory: { available: true, items: ["CNC-01"] }, opportunity: { inventoryFit: "MATCH" } });
assert.ok(workspace.scope.included.includes("CNC-01")); assert.equal(workspace.context, "WORKSPACE");
const personal = buildOfferCopilot({ ...base, context: "PERSONAL", inventory: undefined });
assert.equal(personal.scope.included.some((item) => item.includes("CNC-01")), false);
assert.equal(personal.draft.price, null); assert.equal(personal.delivery.state, "NEEDS_CONFIRMATION");
console.log("verify-offer-copilot-v1: PASS");
