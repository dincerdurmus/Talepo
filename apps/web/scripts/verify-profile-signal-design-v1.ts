/**
 * Talepo Signal profile design V1 static checks.
 * Run: npx tsx scripts/verify-profile-signal-design-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

console.log("\n=== PROFILE SIGNAL DESIGN V1 ===\n");

const signal = read("src/components/panel/profile/ProfileSignal.tsx");
check("signal surface tokens exported", signal.includes("signalSurface"));
check("completion ring component exists", signal.includes("ProfileCompletionRing"));
check("signal tab strip with animated indicator", signal.includes("SignalTabStrip"));
check("signal tab panels with fade content", signal.includes("signalFadeIn"));
check("prefers-reduced-motion on tab indicator", signal.includes("motion-reduce:transition-none"));
check("signal save success check animation", signal.includes("SignalSaveSuccess"));

const hero = read("src/components/panel/profile/ProfileIdentityHero.tsx");
check("identity hero uses completion ring", hero.includes("ProfileCompletionRing"));
check("identity hero has preview toggle", hero.includes("Profili önizle"));
check("identity hero embeds public preview", hero.includes("embedded"));

const pageContent = read("src/components/panel/profile/ProfilePageContent.tsx");
check("page content uses identity hero not sidebar", pageContent.includes("ProfileIdentityHero"));
check("page content removed sidebar grid", !pageContent.includes("ProfileSummarySidebar"));
check("page content uses signal tabs", pageContent.includes("SignalTabStrip"));

const editor = read("src/components/panel/ProfileEditor.tsx");
check("profile editor dirty state indicator", editor.includes("Kaydedilmemiş değişiklikler"));
check("profile editor uses signal section", editor.includes("SignalSection"));
check("profile editor uses signal inputs", editor.includes("signalInput"));
check("save button muted when no changes", editor.includes("!isDirty"));

const trust = read("src/components/panel/profile/ProfileTrustPanel.tsx");
const trustSurface = read("src/components/panel/profile/ProfileTrustSurface.tsx");
const trustAuthority = read("src/lib/profile/trust-surface.ts");
check(
  "trust compact empty shared component",
  trustSurface.includes("ProfileTrustCompactEmptyState"),
);
check(
  "trust authority semantic metric slots",
  trustAuthority.includes("TrustMetricSlot") &&
    trustAuthority.includes("completedTransactions"),
);
check(
  "self trust no-data uses single compact surface",
  trust.includes("ProfileTrustCompactEmptyState") &&
    trust.includes("if (!hasAnyReviews)"),
);
check(
  "trust panel compact copy",
  trustSurface.includes("Güven profili oluşuyor"),
);

const security = read("src/components/panel/profile/ProfileSecurityPanel.tsx");
check("security status summary line", security.includes("Hesap güvenliği"));
check("security rows with tone states", security.includes("SecurityRow"));
check("google provider card for oauth", security.includes("Google hesabı"));

const account = read("src/components/panel/profile/ProfileAccountPanel.tsx");
check("account hub uses signal section", account.includes("Hesap merkezi"));
check("private fields marked with lock", account.includes("Özel"));

const preview = read("src/components/panel/profile/PublicProfilePreviewPanel.tsx");
check("preview uses same PublicProfileCard", preview.includes("PublicProfileCard"));
check("preview embedded mode label", preview.includes("Başkalarının gördüğü görünüm"));
check(
  "profile editor city/district use turkey districts authority",
  editor.includes("TURKEY_IL_NAMES") &&
    editor.includes("getDistrictsForProvince") &&
    editor.includes("resolveCanonicalProvince"),
);

const drawer = read("src/components/panel/ParticipantProfileDrawer.tsx");
check("drawer skeleton while loading", drawer.includes("DrawerSkeleton"));
check("drawer full profile link text", drawer.includes("Tam profili görüntüle"));
check("public card identity passport hero", drawer.includes("signalHeroSurface"));
check("single back link in public card", drawer.includes("backLabel"));
check("mobile conversation cta", drawer.includes("lg:hidden"));
check(
  "public trust sections shared component",
  drawer.includes("ProfileTrustPublicSections"),
);
check(
  "hero trust metrics single authority",
  drawer.includes("ProfileTrustHeroMetrics") &&
    !drawer.includes("tamamlanan işlem</span>"),
);
check(
  "completed metric semantic data attribute",
  read("src/components/panel/CompletedTransactionBadge.tsx").includes(
    'data-trust-metric="completedTransactions"',
  ),
);

const userPage = read("src/app/panel/profil/[userId]/page.tsx");
check("participant page no duplicate header back", !userPage.includes("ArrowLeft"));
check("participant page single back via card", userPage.includes("backLabel"));

const panelShell = read("src/components/panel/PanelShell.tsx");
check(
  "panel shell hides back on participant profile",
  panelShell.includes("/^\\/panel\\/profil\\/[^/]+$/.test(pathname)"),
);
check(
  "panel shell hides back on company profile",
  panelShell.includes("/^\\/panel\\/firma-profil\\/[^/]+$/.test(pathname)"),
);

const globals = read("src/app/globals.css");
check("signal fade keyframes", globals.includes("@keyframes signalFadeIn"));
check("signal ring keyframes", globals.includes("@keyframes signalRingDraw"));
check("signal check keyframes", globals.includes("@keyframes signalCheckDraw"));
check("signal shimmer for skeleton", globals.includes("@keyframes signalShimmer"));

const profilPage = read("src/app/panel/profil/page.tsx");
check("self profile page removed duplicate h1 header", !profilPage.includes("text-4xl"));

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
if (errors.length > 0) {
  console.log("Failures:");
  for (const error of errors) console.log(` - ${error}`);
  process.exit(1);
}
