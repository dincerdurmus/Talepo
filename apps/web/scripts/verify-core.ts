/**
 * Lightweight smoke checks for core lib helpers (no test runner required).
 * Run: npx tsx scripts/verify-core.ts
 */
import assert from "node:assert/strict";

import { containsBlockedContactInfo } from "../src/lib/membership/contact-filter";
import { scoreOfferCompleteness } from "../src/lib/offer/offer-completeness";
import { parseBudgetRange, parseMoney } from "../src/server/request/mapper";

function section(name: string) {
  console.log(`\n✓ ${name}`);
}

section("parseMoney / parseBudgetRange");
assert.equal(parseMoney("40.000"), 40000);
assert.equal(parseMoney("50 bin"), 50000);
assert.deepEqual(parseBudgetRange("10.000 – 50.000 TL"), {
  min: 10000,
  max: 50000,
});
assert.deepEqual(parseBudgetRange("50 bin"), { min: 50000, max: 50000 });
assert.equal(parseBudgetRange("10-50 bin").min, 10000);
assert.equal(parseBudgetRange("10-50 bin").max, 50000);

section("contact filter");
assert.equal(containsBlockedContactInfo("merhaba"), false);
assert.equal(containsBlockedContactInfo("mail: a@b.com"), true);
assert.equal(containsBlockedContactInfo("0555 111 22 33"), true);

section("offer completeness");
const weak = scoreOfferCompleteness({
  amount: null,
  description: "kısa",
});
assert.ok(weak.score < 40);
const strong = scoreOfferCompleteness({
  amount: 42000,
  deliveryDays: 7,
  description: "A".repeat(50),
  title: "Ofis sandalye tedariki",
  validUntil: new Date(),
  companyVerified: true,
});
assert.ok(strong.score >= 85);

console.log("\nAll core checks passed.\n");
