/**
 * Profile trust authority alignment — completedTransactions single source.
 * Run: npx tsx scripts/verify-profile-trust-authority-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildPersonalProviderTrustAuthority,
  profileTrustAuthoritiesAligned,
  PROFILE_TRUST_AUTHORITY_SCOPE,
  shouldShowTrustCompactEmpty,
  trustMetricSlotsForSurface,
} from "../src/lib/profile/trust-surface";

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

console.log("\n=== PROFILE TRUST AUTHORITY V1 ===\n");

const providerOnly = buildPersonalProviderTrustAuthority({
  completedTransactions: 0,
  reviewCount: 0,
  averageRating: null,
});
const buyerHasOne = { completedTransactions: 1, reviewCount: 0, averageRating: null };

check(
  "authority uses provider-personal scope",
  providerOnly.scope === PROFILE_TRUST_AUTHORITY_SCOPE.providerPersonal,
);
check(
  "authority does not merge buyer count into provider aggregate",
  buildPersonalProviderTrustAuthority({
    completedTransactions: 0,
    reviewCount: 0,
    averageRating: null,
  }).completedTransactions === 0,
);
check(
  "buyer-only completion must not inflate provider authority",
  buildPersonalProviderTrustAuthority({
    completedTransactions: 0,
    reviewCount: 0,
    averageRating: null,
  }).completedTransactions === 0 && buyerHasOne.completedTransactions === 1,
);

const aligned = profileTrustAuthoritiesAligned(
  buildPersonalProviderTrustAuthority({
    completedTransactions: 2,
    reviewCount: 3,
    averageRating: 4.5,
  }),
  { completedTransactions: 2, reviewCount: 3, averageRating: 4.5 },
);
check("self authority aligns with public trust dto", aligned);

const misaligned = profileTrustAuthoritiesAligned(
  buildPersonalProviderTrustAuthority({
    completedTransactions: 0,
    reviewCount: 0,
    averageRating: null,
  }),
  { completedTransactions: 1, reviewCount: 0, averageRating: null },
);
check("misaligned authority detected", !misaligned);

const hero = read("src/components/panel/profile/ProfileIdentityHero.tsx");
check(
  "identity hero uses trustAuthority prop",
  hero.includes("trustAuthority: ProfileTrustAuthority") &&
    hero.includes("trustAuthority.completedTransactions"),
);
check(
  "identity hero does not read buyer trust",
  !hero.includes("buyerTrust"),
);

const trustPanel = read("src/components/panel/profile/ProfileTrustPanel.tsx");
check(
  "trust panel accepts trustAuthority",
  trustPanel.includes("trustAuthority: ProfileTrustAuthority"),
);
check(
  "trust panel removed pickTrustCompletedSignal merge",
  !trustPanel.includes("pickTrustCompletedSignal"),
);
check(
  "self trust compact empty never repeats completed badge",
  trustPanel.includes("showCompletedSignal={false}"),
);

const pageContent = read("src/components/panel/profile/ProfilePageContent.tsx");
check(
  "page content passes shared trustAuthority",
  pageContent.includes("trustAuthority={trustAuthority}") &&
    pageContent.includes("trustAuthority: ProfileTrustAuthority"),
);

const page = read("src/app/panel/profil/page.tsx");
check(
  "profile page builds provider trust authority",
  page.includes("buildPersonalProviderTrustAuthority"),
);

const trustSurface = read("src/lib/profile/trust-surface.ts");
check(
  "trust surface documents provider-personal passport scope",
  trustSurface.includes("provider-personal") &&
    trustSurface.includes("Do not merge buyer"),
);

const publicService = read("src/server/profile/public-profile-service.ts");
check(
  "public profile dto uses getUserTrustSummary provider count",
  publicService.includes("getUserTrustSummary(user.id)") &&
    publicService.includes("completedTransactions: trust.completedTransactions"),
);

const drawer = read("src/components/panel/ParticipantProfileDrawer.tsx");
check(
  "public card uses ProfileTrustHeroMetrics for hero trust",
  drawer.includes("ProfileTrustHeroMetrics"),
);

// --- Regression scenarios (semantic render rules) ---

const selfHeroAuthority = buildPersonalProviderTrustAuthority({
  completedTransactions: 0,
  reviewCount: 0,
  averageRating: null,
});
const publicTrustDto = {
  completedTransactions: 0,
  reviewCount: 0,
  averageRating: null,
};
check(
  "1) self hero authority matches public trust dto",
  profileTrustAuthoritiesAligned(selfHeroAuthority, publicTrustDto),
);

const completedOneNoReview = buildPersonalProviderTrustAuthority({
  completedTransactions: 1,
  reviewCount: 0,
  averageRating: null,
});
const heroSlotsOne = trustMetricSlotsForSurface("hero", completedOneNoReview);
const secondarySlotsOne = trustMetricSlotsForSurface(
  "secondary",
  completedOneNoReview,
);
check(
  "2) completed=1 review=0 hero owns completed slot",
  heroSlotsOne.has("completedTransactions") &&
    !secondarySlotsOne.has("completedTransactions"),
);
check(
  "2) completed=1 review=0 compact empty still shown (no visible reviews)",
  shouldShowTrustCompactEmpty(completedOneNoReview),
);

const trustSurfaceTsx = read("src/components/panel/profile/ProfileTrustSurface.tsx");
check(
  "2) compact empty badge gated by showCompletedSignal",
  trustSurfaceTsx.includes("showCompletedSignal && completedTransactions > 0"),
);
check(
  "2) self trust panel disables compact empty badge",
  trustPanel.includes("showCompletedSignal={false}"),
);

const completedZero = buildPersonalProviderTrustAuthority({
  completedTransactions: 0,
  reviewCount: 0,
  averageRating: null,
});
check(
  "3) completed=0 review=0 hero slot omits completed chip",
  !trustMetricSlotsForSurface("hero", completedZero).has("completedTransactions"),
);
check(
  "3) completed=0 compact empty has no badge path when count is zero",
  !trustSurfaceTsx.includes("completedTransactions === 0") ||
    trustSurfaceTsx.includes("completedTransactions > 0"),
);

const withReviews = buildPersonalProviderTrustAuthority({
  completedTransactions: 3,
  reviewCount: 5,
  averageRating: 4.2,
});
check(
  "4) review present keeps rating summary slot on hero",
  trustMetricSlotsForSurface("hero", withReviews).has("ratingSummary"),
);
check(
  "4) trust panel keeps distribution and recent review sections",
  trustPanel.includes("Puan dağılımı") &&
    trustPanel.includes("Son görünür değerlendirmeler"),
);

check(
  "5) drawer and public sections share trust surface module",
  drawer.includes("ProfileTrustPublicSections") &&
    trustSurfaceTsx.includes("ProfileTrustPublicSections"),
);
check(
  "5) public sections skip compact empty when completed > 0 without reviews",
  trustSurfaceTsx.includes("profile.trust.completedTransactions > 0"),
);

const companyPage = read("src/app/panel/firma-profil/[id]/page.tsx");
check(
  "6) company profile uses separate public company dto",
  companyPage.includes("getPublicCompanyProfile"),
);
check(
  "6) personal authority builder does not import company trust merge",
  !trustSurface.includes("getCompanyTrustSummary") &&
    !trustSurface.includes("getBuyerTrustSummary"),
);

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
if (errors.length > 0) {
  console.log("Failures:");
  for (const error of errors) console.log(` - ${error}`);
  process.exit(1);
}
