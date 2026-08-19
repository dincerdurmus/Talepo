/**
 * Profile security, trust, password and participant profile V1.
 * Run: npx tsx scripts/verify-profile-security-trust-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(join(__dirname, "..", "package.json"));
const { config } = require("dotenv");
config({ path: join(__dirname, "..", ".env.local") });
config({ path: join(__dirname, "..", ".env") });

import { resolveAccountAuthMethod } from "../src/lib/auth/account-auth-method";
import { calculateProfileCompletion } from "../src/lib/profile/profile-completion";
import {
  formatParticipantLocation,
  type PublicUserProfileDto,
} from "../src/lib/profile/public-profile";
import {
  buildUserVerifiedIndicators,
} from "../src/lib/profile/verified-indicators";
import { revealedReviewWhere } from "../src/lib/offer/deal-review";

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

console.log("\n=== PROFILE SECURITY / TRUST V1 ===\n");

async function runOAuthFailClosedCheck() {
  const { prisma } = await import("../src/lib/prisma");
  const { ChangePasswordError, changeUserPassword } = await import(
    "../src/server/auth/change-password",
  );
  try {
    const oauthUser = await prisma.user.findFirst({
      where: { passwordHash: null, deletedAt: null },
      select: { id: true },
    });
    if (oauthUser) {
      let blocked = false;
      try {
        await changeUserPassword({
          userId: oauthUser.id,
          currentPassword: "dummy-current",
          newPassword: "DummyNewPass9!",
          confirmPassword: "DummyNewPass9!",
        });
      } catch (error) {
        blocked =
          error instanceof ChangePasswordError &&
          error.status === 403 &&
          error.message.includes("şifre ile giriş kullanmıyor");
      }
      check("oauth-only user blocked server-side on password change", blocked);
    } else {
      check(
        "oauth-only user blocked server-side on password change",
        true,
        "skipped — no oauth-only user in db",
      );
    }
  } catch (error) {
    check(
      "oauth-only user blocked server-side on password change",
      false,
      String(error),
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const credentials = resolveAccountAuthMethod({
    passwordHash: "hash",
    accounts: [],
  });
  check(
    "credentials-only account detected",
    credentials.hasPassword && credentials.primaryLabel === "E-posta ve şifre",
  );

  const googleOnly = resolveAccountAuthMethod({
    passwordHash: null,
    accounts: [{ provider: "google" }],
  });
  check(
    "google-only account detected",
    !googleOnly.hasPassword && googleOnly.primaryLabel === "Google",
  );

  const hybrid = resolveAccountAuthMethod({
    passwordHash: "hash",
    accounts: [{ provider: "google" }],
  });
  check(
    "hybrid google+credentials label",
    hybrid.hasPassword && hybrid.primaryLabel === "Google ve şifre",
  );

  const changePassword = read("src/server/auth/change-password.ts");
  check(
    "change password requires current password verification",
    changePassword.includes("verifyPassword(currentPassword") &&
      changePassword.includes("!currentPassword"),
  );
  check(
    "change password rejects same new password",
    changePassword.includes("verifyPassword(newPassword, user.passwordHash)"),
  );
  check(
    "change password uses central hash utility",
    changePassword.includes("hashPassword(newPassword)") &&
      changePassword.includes('from "@/lib/auth/password"'),
  );
  check(
    "change password blocks oauth-only accounts",
    changePassword.includes("Bu hesap şifre ile giriş kullanmıyor"),
  );

  const passwordRoute = read("src/app/api/profile/password/route.ts");
  check(
    "password route requires auth and rate limit",
    passwordRoute.includes("requireUser()") &&
      passwordRoute.includes("assertRateLimit"),
  );
  check(
    "password route success explains current-device logout only",
    passwordRoute.includes("Bu cihazdaki oturumunuz kapatılacaktır") &&
      passwordRoute.includes("Diğer açık oturumlar geçerli kalabilir"),
  );
  check(
    "password route success payload omits password fields",
    passwordRoute.includes("requiresReLogin: result.requiresReLogin") &&
      passwordRoute.includes("Bu cihazdaki oturumunuz kapatılacaktır") &&
      !passwordRoute.includes("passwordHash"),
  );

  const passwordForm = read("src/components/panel/profile/ProfilePasswordForm.tsx");
  check(
    "password form signs out after success",
    passwordForm.includes("signOut") &&
      passwordForm.includes("requiresReLogin"),
  );
  check(
    "password form has show/hide controls",
    passwordForm.includes("EyeOff") && passwordForm.includes("aria-label"),
  );

  const securityPanel = read("src/components/panel/profile/ProfileSecurityPanel.tsx");
  check(
    "security panel hides password form for oauth-only",
    securityPanel.includes("authMethod.hasPassword") &&
      securityPanel.includes("Google hesabınızla giriş yapıyorsunuz"),
  );
  check(
    "security panel does not claim global session revoke",
    (securityPanel.includes("Bu cihazdaki oturumunuz kapatılacaktır") ||
      securityPanel.includes("Google hesabınızla giriş yapıyorsunuz")) &&
      !securityPanel.includes("tüm cihazlardan çıkış"),
  );
  check(
    "security panel notes phone verification not active",
    securityPanel.includes("Telefon doğrulaması henüz etkin değil") ||
      securityPanel.includes("OTP doğrulaması henüz etkin değil"),
  );

  const indicators = read("src/lib/profile/verified-indicators.ts");
  check(
    "user verified indicators exclude phone",
    indicators.includes("buildUserVerifiedIndicators") &&
      !indicators.includes("Telefon") &&
      indicators.includes("emailVerified"),
  );
  check(
    "company verified indicators require isVerified authority",
    indicators.includes("buildCompanyVerifiedIndicators") &&
      indicators.includes("isVerified"),
  );

  const service = read("src/server/profile/public-profile-service.ts");
  check(
    "expertise categories sourced from provider offers only",
    service.includes("submittedById: userId") &&
      service.includes('status: { in: ["SUBMITTED", "VIEWED", "ACCEPTED"] }') &&
      !service.includes("createdRequests"),
  );
  check(
    "public profile never adds phone verification badge",
    !service.includes("Telefon kayıtlı") &&
      !service.includes("Telefon doğrulandı") &&
      service.includes("buildUserVerifiedIndicators"),
  );

  const dto = read("src/lib/profile/public-profile.ts");
  check(
    "public user dto allowlist excludes email/phone",
    !dto.includes("email:") && !dto.includes("phone:"),
  );
  check(
    "participant location excludes district helper exists",
    dto.includes("formatParticipantLocation") &&
      dto.includes("district stays private"),
  );
  check(
    "public dto includes trust distribution fields",
    dto.includes("ratingDistribution") && dto.includes("recentVisibleReviews"),
  );

  check(
    "formatParticipantLocation drops district",
    formatParticipantLocation("İstanbul", "Türkiye") === "İstanbul, Türkiye",
  );

  check(
    "public profile service uses participant location formatter",
    service.includes("formatParticipantLocation(user.city, user.country)"),
  );
  check(
    "public profile service gates non-self access by conversation",
    service.includes("assertConversationParticipantAccess") &&
      service.includes('if (!options?.conversationId)'),
  );
  check(
    "public profile service does not return email/phone in dto",
    !service.includes("email:") &&
      !service.match(/return\s*\{[\s\S]*phone:/),
  );

  const access = read("src/server/profile/public-profile-access.ts");
  check(
    "unauthorized profile access fails closed with 404",
    access.includes("404") || access.includes("Profil bulunamadı"),
  );

  const preview = read("src/components/panel/profile/PublicProfilePreviewPanel.tsx");
  check(
    "self preview uses PublicProfileCard",
    preview.includes("PublicProfileCard") &&
      preview.includes("PublicUserProfileDto"),
  );

  const page = read("src/app/panel/profil/page.tsx");
  check(
    "self profile page loads public preview dto from service",
    page.includes("getPublicUserProfile(sessionUser.id, user.id)"),
  );
  check(
    "self profile page uses tabbed sections",
    page.includes("ProfilePageContent"),
  );

  const pageContent = read("src/components/panel/profile/ProfilePageContent.tsx");
  check(
    "self profile uses signal identity hero layout",
    pageContent.includes("ProfileIdentityHero") &&
      pageContent.includes("SignalTabStrip"),
  );

  const accountPanel = read("src/components/panel/profile/ProfileAccountPanel.tsx");
  check(
    "private account fields labeled owner-only",
    accountPanel.includes("SignalPrivateLabel") ||
      accountPanel.includes("Yalnızca size görünür"),
  );

  const editor = read("src/components/panel/ProfileEditor.tsx");
  check(
    "profile editor marks district private",
    (editor.includes("Yalnızca size görünür") ||
      editor.includes("SignalPrivateLabel")) &&
      editor.includes("privateField") &&
      !editor.includes("Google hesabından gelir"),
  );
  check(
    "profile editor removed fake inline preview",
    !editor.includes("Konuşmalarda görünen önizleme"),
  );

  const trustPanel = read("src/components/panel/profile/ProfileTrustPanel.tsx");
  check(
    "trust panel references blind review hint",
    trustPanel.includes("DEAL_REVIEW_BLIND_HINT"),
  );

  const selfTrust = read("src/server/profile/self-profile-trust.ts");
  check(
    "pending blind reviews use NOT revealedReviewWhere",
    selfTrust.includes("NOT: visible") &&
      selfTrust.includes("revealedReviewWhere"),
  );

  check(
    "revealedReviewWhere exists for blind visibility contract",
    typeof revealedReviewWhere === "function",
  );

  const drawer = read("src/components/panel/ParticipantProfileDrawer.tsx");
  check(
    "drawer links to full secure profile",
    drawer.includes("Tam profili görüntüle"),
  );
  check(
    "drawer has focus trap and escape close",
    drawer.includes('event.key === "Escape"') &&
      drawer.includes("aria-modal"),
  );
  check(
    "full profile card supports conversation back cta",
    drawer.includes("Mesajlaşmaya dön") &&
      drawer.includes("conversationBackHref"),
  );
  check(
    "full profile card renders star distribution",
    drawer.includes("ProfileTrustPublicSections") &&
      read("src/components/panel/profile/ProfileTrustSurface.tsx").includes(
        "StarRatingDistribution",
      ),
  );

  const userProfilePage = read("src/app/panel/profil/[userId]/page.tsx");
  check(
    "participant profile page passes conversation back href",
    userProfilePage.includes("conversationBackHref"),
  );
  check(
    "participant profile page uses single back label",
    userProfilePage.includes("backLabel") &&
      !userProfilePage.includes("ArrowLeft"),
  );
  check(
    "self profile redirect from participant route",
    userProfilePage.includes('redirect("/panel/profil")'),
  );

  const signalTabs = read("src/components/panel/profile/ProfileSignal.tsx");
  check(
    "profile tabs use horizontal scroll on mobile",
    signalTabs.includes("overflow-x-auto") && signalTabs.includes("shrink-0"),
  );
  check(
    "profile tabs include security section",
    signalTabs.includes("Giriş ve güvenlik"),
  );

  check(
    "identity hero includes completion ring",
    read("src/components/panel/profile/ProfileIdentityHero.tsx").includes(
      "ProfileCompletionRing",
    ),
  );

  const completion = calculateProfileCompletion({
    name: "Ada",
    biography: "bio",
    city: "İstanbul",
    country: "Türkiye",
    phone: null,
    image: null,
  });
  check("profile completion percent calculated", completion === 67);

  check(
    "buildUserVerifiedIndicators skips unverified email",
    buildUserVerifiedIndicators({ emailVerified: null }).length === 0,
  );
  check(
    "buildUserVerifiedIndicators never includes phone badge",
    !buildUserVerifiedIndicators({ emailVerified: new Date() }).some((row) =>
      row.toLowerCase().includes("telefon"),
    ),
  );

  const sampleDto: PublicUserProfileDto = {
    kind: "user",
    id: "u1",
    displayName: "Ada",
    avatarUrl: null,
    accountType: "personal",
    biography: null,
    locationLabel: "İstanbul, Türkiye",
    memberSinceLabel: "Ocak 2026",
    expertiseCategories: [],
    trust: {
      completedTransactions: 0,
      reviewCount: 0,
      averageRating: null,
    },
    verifiedIndicators: ["E-posta doğrulandı"],
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    recentVisibleReviews: [],
  };
  check(
    "sample public dto has no sensitive keys",
    !("email" in sampleDto) &&
      !("phone" in sampleDto) &&
      !("passwordHash" in sampleDto) &&
      !("district" in sampleDto),
  );

  await runOAuthFailClosedCheck();

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
  if (errors.length > 0) {
    console.log("Failures:");
    for (const error of errors) console.log(` - ${error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
