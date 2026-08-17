import assert from "node:assert/strict";
import { PRO_VALUE_PILLARS } from "../src/lib/membership/feature-meta";
import { PANEL_NAV_ITEMS } from "../src/components/panel/panel-nav";
assert.equal(PRO_VALUE_PILLARS.length, 4);
assert.deepEqual(PRO_VALUE_PILLARS.map((pillar) => pillar.title), ["Keşfet", "Karar ver", "Ölç / geliştir", "Takip et"]);
assert.ok(PANEL_NAV_ITEMS.some((item) => item.href === "/panel/plan"));
assert.ok(PANEL_NAV_ITEMS.some((item) => item.href === "/panel/talepler"));
console.log("verify-premium-panel-redesign-v2: PASS");
