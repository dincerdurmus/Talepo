import assert from "node:assert/strict";
import { clearCostEvents, costUnits, evaluateFairUse, recordCostEvent } from "../src/lib/monetization/cost-telemetry";
import { clearProviderCache, coalesceProviderQuery, getProviderCacheMetadata, setCachedProviderResults } from "../src/server/price-intelligence/provider-cache";
clearCostEvents();
const opportunity = recordCostEvent({ eventType: "INTELLIGENCE_ACTION", feature: "OPPORTUNITY", costDimension: "INFRA", units: 1, intelligenceUnits: costUnits("OPPORTUNITY"), cacheHit: false, dedupHit: false, estimatedCost: null, currency: null });
const price = recordCostEvent({ eventType: "PROVIDER_QUERY", feature: "PRICE_PROVIDER_QUERY", costDimension: "PROVIDER", units: 1, intelligenceUnits: costUnits("PRICE_PROVIDER_QUERY"), cacheHit: false, dedupHit: false, estimatedCost: null, currency: null, provider: "test" });
assert.equal(opportunity.intelligenceUnits, 1); assert.equal(price.intelligenceUnits, 8); assert.equal(evaluateFairUse(50, { softLimit: 100, hardLimit: 160 }), "NORMAL"); assert.equal(evaluateFairUse(100, { softLimit: 100, hardLimit: 160 }), "SOFT_LIMIT"); assert.equal(evaluateFairUse(160, { softLimit: 100, hardLimit: 160 }), "HARD_LIMIT");
async function main() {
  clearProviderCache(); const key = "test:key"; setCachedProviderResults(key, [], 60_000); assert.equal(getProviderCacheMetadata(key).cacheHit, true); let calls = 0;
  const query = () => { calls++; return new Promise<never>((resolve) => setTimeout(() => resolve([] as never), 10)); };
  const results = await Promise.all([coalesceProviderQuery(key, query), coalesceProviderQuery(key, query)]); assert.equal(calls, 1); assert.equal(results[1].dedupHit, true);
  console.log("verify-cost-control-v1: PASS");
}
void main();
