/**
 * Keşfet visual contract — Sayfam/Signal Rail language, no marketing serif.
 * Run: npx tsx scripts/verify-explore-visual-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  cityFilterWhere,
  exploreDistrictChoices,
  parseExploreLocationList,
  pruneExploreDistricts,
} from "../src/lib/explore/location-filter";
import { TURKEY_IL_NAMES } from "../src/lib/geo/turkey-districts";

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

const page = read("src/app/panel/talepler/page.tsx");
const home = read("src/components/panel/explore/PanelExploreHome.tsx");
const picker = read("src/components/panel/InterestCategoryPicker.tsx");
const card = read("src/components/panel/ExploreRequestCard.tsx");
const upsell = read("src/components/panel/ExploreFilterUpsell.tsx");
const shell = read("src/components/panel/PanelShell.tsx");
const followSource = read("src/components/panel/FollowTracksManager.tsx");
const nav = read("src/components/panel/panel-nav.ts");
const css = read("src/app/globals.css");
const rail = read("src/components/panel/CommandPersonalSidebar.tsx");
const locationSelect = read(
  "src/components/panel/explore/ExploreLocationMultiSelect.tsx",
);

check(
  "Keşfet has its own banner, not Sayfam greeting hero",
  page.includes("PanelExploreHome") &&
    home.includes("talepo-explore-banner") &&
    home.includes("talepo-beacon-shell") &&
    !home.includes("talepo-beacon-hero") &&
    !home.includes("talepo-beacon-title") &&
    !home.includes("PlanBadge") &&
    home.includes("Talepler") &&
    !home.includes("Keşfet") &&
    !home.includes("KEŞFET"),
);

check(
  "explore banner is a light slate field, not green",
  css.includes(".talepo-explore-banner") &&
    css.includes("#eef1f4") &&
    !css.includes("#eaf6f3") &&
    !home.includes("talepo-beacon-hero") &&
    !home.includes("#071512"),
);

check(
  "no Fraunces / Manrope explore display fonts",
  !page.includes("Fraunces") &&
    !page.includes("Manrope") &&
    !page.includes("font-explore-display") &&
    !card.includes("font-explore-display") &&
    !picker.includes("font-explore-display"),
);

check(
  "plan lives in panel chrome, not explore greeting",
  !home.includes("PlanBadge") &&
    !home.includes("Talepo ·") &&
    shell.includes("<PlanBadge") &&
    !home.includes("STANDART") &&
    !home.includes("Professional"),
);

check(
  "CASE 1: /panel/talepler back Link to /panel",
  /pathname === "\/panel\/talepler"[\s\S]*?href =\s*[\s\S]*?\? "\/panel\/takiplerim"\s*:\s*"\/panel"/.test(
    shell,
  ) &&
    !shell.includes('if (pathname === "/panel/talepler") return null') &&
    !home.includes("backHref") &&
    !page.includes("backHref="),
);

check(
  "CASE 2: /panel/talepler?from=takiplerim back to /panel/takiplerim",
  shell.includes('searchParams.get("from") === "takiplerim"') &&
    shell.includes('? "/panel/takiplerim"') &&
    followSource.includes('href="/panel/talepler?from=takiplerim"'),
);

check(
  "CASE 3: /panel/taleplerim back Link to /panel",
  /pathname === "\/panel\/taleplerim"[\s\S]*?href="\/panel"/.test(shell) &&
    !shell.includes('if (pathname === "/panel/taleplerim") return null'),
);

check(
  "CASE 4: /panel keeps PanelBackLink null",
  shell.includes('if (pathname === "/panel") return null'),
);

check(
  "interest picker is frost, not marketing gradient",
  picker.includes("Hangi kategoride arıyorsunuz?") &&
    !picker.includes("bg-gradient-to-br") &&
    !picker.includes("Sparkles") &&
    !picker.includes("from-[#eefcf8]") &&
    picker.includes("aria-pressed"),
);

check(
  "explore card keeps media authority",
  card.includes("CategoryVisualThumb") &&
    card.includes("allowCategoryStockImage") &&
    card.includes("coverImageUrl={coverImageUrl}") &&
    !card.includes("font-explore-display") &&
    !card.includes("hover:-translate-y"),
);

check(
  "upsell stays teal, links to real plan page",
  upsell.includes('href="/panel/plan"') &&
    !upsell.includes("from-sky-600") &&
    !upsell.includes("from-[#eef8ff]"),
);

check(
  "hero does not duplicate plan quota chrome",
  !home.includes("Teklif hakkı") &&
    !home.includes("remainingLabel") &&
    !home.includes("talepo-beacon-pill") &&
    home.includes("Size uygun"),
);

check(
  "tabs are segmented, not underline marketing tabs",
  home.includes("ExploreTabLink") &&
    home.includes('aria-current={active ? "page" : undefined}') &&
    !page.includes("border-b-2"),
);

check(
  "matching and filter authority stay on the page",
  page.includes("buildSupplierVisibilityFilter") &&
    page.includes("hasAdvancedFilters") &&
    page.includes("InterestCategoryPicker") &&
    page.includes("ExploreCategoryFilterBar") &&
    page.includes("attributedRequestDetailHref"),
);

check(
  "Turkey has 81 provinces",
  TURKEY_IL_NAMES.length === 81,
  String(TURKEY_IL_NAMES.length),
);
check(
  "empty location list is Tümü",
  parseExploreLocationList("").length === 0 &&
    parseExploreLocationList("İstanbul, Ankara").join(",") === "İstanbul,Ankara",
);
check(
  "multi city filter uses OR equals",
  JSON.stringify(cityFilterWhere(["İstanbul", "Ankara"]) ?? {}).includes('"OR"'),
);
check(
  "Istanbul districts include Kadıköy",
  exploreDistrictChoices(["İstanbul"]).some((choice) => choice.value === "Kadıköy"),
);
check(
  "districts stay closed until a city is chosen",
  exploreDistrictChoices([]).length === 0,
);
check(
  "location picker is checkbox multi-select with Tümü",
  page.includes("ExploreLocationFilterFields") &&
    locationSelect.includes('allLabel = "Tümü"') &&
    locationSelect.includes('aria-multiselectable="true"') &&
    locationSelect.includes("flex h-4 w-4") &&
    !page.includes('placeholder="ör. İstanbul"') &&
    !page.includes('placeholder="ör. Kadıköy"'),
);
check(
  "district field waits for city selection",
  read("src/components/panel/explore/ExploreLocationFilterFields.tsx").includes(
    "cities.length > 0",
  ),
);
check(
  "banner uses a request figure, not stacked cards",
  home.includes("ExploreBannerArt") &&
    !home.includes("talepo-explore-banner-cards") &&
    !css.includes("talepo-explore-banner-cards"),
);
check(
  "explore page copy stays Talepler, chrome is Talepleri keşfet",
  /\r?\n[ \t]+Talepler\r?\n/.test(home) &&
    !home.includes("Keşfet") &&
    shell.includes(
      'if (pathname.startsWith("/panel/talepler")) return "Talepleri keşfet"',
    ) &&
    shell.includes('label="Keşfet"') &&
    shell.includes("Talepleri keşfet") &&
    nav.includes('label: "Talepleri keşfet"') &&
    !nav.includes('label: "Keşfet"') &&
    !nav.includes('label: "Talepler"') &&
    rail.includes("TALEP_TEKLIF_NAV_HREFS") &&
    rail.includes("item.label"),
);

{
  const istanbulKadikoyThenAnkara = pruneExploreDistricts(
    ["İstanbul", "Ankara"],
    ["Kadıköy"],
  );
  const bothDistricts = pruneExploreDistricts(
    ["İstanbul", "Ankara"],
    ["Kadıköy", "Ankara / Çankaya"],
  );
  const afterAnkaraRemoved = pruneExploreDistricts(
    ["İstanbul"],
    ["İstanbul / Kadıköy", "Ankara / Çankaya"],
  );
  const afterAllCitiesRemoved = pruneExploreDistricts([], ["Kadıköy"]);
  check(
    "adding a second city keeps Istanbul/Kadıköy",
    istanbulKadikoyThenAnkara.length === 1 &&
      istanbulKadikoyThenAnkara[0] === "İstanbul / Kadıköy",
  );
  check(
    "multi-city districts stay qualified and distinct",
    bothDistricts.includes("İstanbul / Kadıköy") &&
      bothDistricts.includes("Ankara / Çankaya"),
  );
  check(
    "removing Ankara keeps Istanbul district and drops Ankara districts",
    afterAnkaraRemoved.length === 1 && afterAnkaraRemoved[0] === "Kadıköy",
  );
  check(
    "clearing all cities clears districts",
    afterAllCitiesRemoved.length === 0,
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
