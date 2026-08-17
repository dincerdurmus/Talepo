/**
 * Deal review / blind reveal / 14-day auto-reveal V1.2.
 * Run: npx tsx scripts/verify-deal-review-v1.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  DEAL_REVIEW_BLIND_HINT,
  DEAL_REVIEW_COMMENT_MAX,
  DEAL_REVIEW_WINDOW_DAYS,
  DEAL_REVIEW_WINDOW_EXPIRED_MESSAGE,
  DEAL_REVIEW_WINDOW_HINT,
  DEAL_REVIEW_WINDOW_MS,
  DEAL_REVIEWS_PUBLISHED_MESSAGE,
  DEAL_REVIEWS_PUBLISHED_TITLE,
  averageRatingFrom,
  dealIsReviewEligible,
  formatAverageRating,
  formatDealReviewDeadline,
  formatReviewCount,
  formatTrustRatingMeta,
  getDealReviewDeadline,
  getDealReviewWindowCutoff,
  isDealReviewDeadlineElapsed,
  isDealReviewPairRevealed,
  isDealReviewRevealed,
  isDealReviewWindowOpen,
  isValidDealRating,
  resolveDealReviewTarget,
  revealedReviewWhere,
} from "../src/lib/offer/deal-review";
import { formatCompletedTransactionCount } from "../src/lib/offer/deal-completion";
import {
  deriveNotificationPath,
  resolveNotificationDestination,
} from "../src/lib/notifications/destination";
import { featuresForPlan } from "../src/lib/membership/entitlements";

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

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260817190000_deal_review_v1/migration.sql");
const domain = read("src/lib/offer/deal-review.ts");
const service = read("src/server/offer/deal-review-service.ts");
const trust = read("src/server/offer/trust-summary.ts");
const api = read("src/app/api/deal-reviews/route.ts");
const panel = read("src/components/panel/DealReviewPanel.tsx");
const completionPanel = read("src/components/panel/DealOutcomePanel.tsx");
const badge = read("src/components/panel/TrustSummaryBadge.tsx");
const conversation = read("src/app/panel/mesajlar/[id]/page.tsx");
const destination = read("src/lib/notifications/destination.ts");
const notify = read("src/server/notifications/create-notification.ts");
const radar = read("src/server/monetization/talepo-radar.ts");
const intelligence = read("src/server/monetization/offer-intelligence.ts");
const analiz = read("src/server/monetization/professional-analytics.ts");
const opportunity = read("src/server/monetization/opportunity-score.ts");
const dealOutcome = read("src/server/price-intelligence/deal-outcome.ts");

const pendingDeal = {
  status: "PENDING",
  confirmationLevel: "NONE",
  completedAt: null,
  buyerConfirmedAt: null,
  supplierConfirmedAt: null,
};
const acceptedLike = {
  status: "PENDING",
  confirmationLevel: "NONE",
  completedAt: null,
  buyerConfirmedAt: null,
  supplierConfirmedAt: null,
};
const buyerOnly = {
  status: "COMPLETED",
  confirmationLevel: "BUYER_CONFIRMED",
  completedAt: new Date(),
  buyerConfirmedAt: new Date(),
  supplierConfirmedAt: null,
};
const providerOnly = {
  status: "COMPLETED",
  confirmationLevel: "SUPPLIER_CONFIRMED",
  completedAt: new Date(),
  buyerConfirmedAt: null,
  supplierConfirmedAt: new Date(),
};
const bilateral = {
  status: "COMPLETED",
  confirmationLevel: "BOTH_CONFIRMED",
  completedAt: new Date(),
  buyerConfirmedAt: new Date(),
  supplierConfirmedAt: new Date(),
};

function daysFrom(completedAt: Date, days: number) {
  return new Date(completedAt.getTime() + days * 24 * 60 * 60 * 1000);
}

console.log("\n=== ELIGIBILITY ===\n");
{
  check("accepted but not completed denied", !dealIsReviewEligible(acceptedLike));
  check("buyer confirmed only denied", !dealIsReviewEligible(buyerOnly));
  check("provider confirmed only denied", !dealIsReviewEligible(providerOnly));
  check("bilateral completed eligible", dealIsReviewEligible(bilateral));
  check("pending deal denied", !dealIsReviewEligible(pendingDeal));
  check(
    "create uses bilateral where",
    service.includes("BILATERAL_COMPLETED_WHERE") &&
      service.includes("dealIsReviewEligible"),
  );
}

console.log("\n=== CREATE / DUPLICATE / TARGET ===\n");
{
  check("buyer create path", service.includes("reviewerSide: side") && service.includes("createDealReview"));
  check("provider create path", service.includes("resolveNegotiationActorSide"));
  check(
    "unique duplicate",
    schema.includes("@@unique([dealOutcomeId, reviewerSide])") &&
      migration.includes("DealReview_dealOutcomeId_reviewerSide_key") &&
      service.includes("isPrismaUniqueViolation"),
  );
  check(
    "company two members share provider side",
    schema.includes("@@unique([dealOutcomeId, reviewerSide])"),
  );

  check("rating 1 pass", isValidDealRating(1));
  check("rating 5 pass", isValidDealRating(5));
  check("rating 0 reject", !isValidDealRating(0));
  check("rating 6 reject", !isValidDealRating(6));
  check("decimal reject", !isValidDealRating(4.5));
  check("comment max 800", DEAL_REVIEW_COMMENT_MAX === 800);
  check(
    "contact blocker reused",
    service.includes("containsBlockedContactInfo"),
  );

  const createCall = api.slice(api.indexOf("await createDealReview"));
  check(
    "target spoof ignored",
    !createCall.includes("body.targetUserId") &&
      !createCall.includes("body.targetCompanyId"),
  );

  const companyTarget = resolveDealReviewTarget(
    { companyId: "co1", submittedById: "member1", requestCreatedById: "buyer1" },
    "BUYER",
  );
  check(
    "company target correct",
    companyTarget.targetType === "COMPANY" && companyTarget.targetCompanyId === "co1",
  );
  const personalTarget = resolveDealReviewTarget(
    { companyId: null, submittedById: "prov1", requestCreatedById: "buyer1" },
    "BUYER",
  );
  check(
    "personal provider target correct",
    personalTarget.targetType === "USER" && personalTarget.targetUserId === "prov1",
  );
  const buyerTarget = resolveDealReviewTarget(
    { companyId: "co1", submittedById: "member1", requestCreatedById: "buyer1" },
    "PROVIDER",
  );
  check(
    "buyer target correct",
    buyerTarget.targetType === "USER" && buyerTarget.targetUserId === "buyer1",
  );
}

console.log("\n=== REVIEW WINDOW / AUTO REVEAL ===\n");
{
  const completedAt = new Date("2026-08-01T12:00:00.000Z");
  const deadline = getDealReviewDeadline(completedAt);
  const day1 = daysFrom(completedAt, 1);
  const day13 = daysFrom(completedAt, 13);
  const day14 = daysFrom(completedAt, 14);
  const day14plus = new Date(deadline.getTime() + 60_000);

  check("1 window is 14 days", DEAL_REVIEW_WINDOW_DAYS === 14);
  check(
    "2 deadline = completedAt + 14d",
    deadline.getTime() === completedAt.getTime() + DEAL_REVIEW_WINDOW_MS,
  );
  check(
    "3 buyer-only day 1 hidden",
    !isDealReviewRevealed({
      sides: ["BUYER"],
      completedAt,
      now: day1,
    }),
  );
  check(
    "4 buyer-only day 13 hidden",
    !isDealReviewRevealed({
      sides: ["BUYER"],
      completedAt,
      now: day13,
    }) && isDealReviewWindowOpen(completedAt, day13),
  );
  check(
    "5 buyer-only after deadline visible",
    isDealReviewRevealed({
      sides: ["BUYER"],
      completedAt,
      now: day14,
    }) && isDealReviewDeadlineElapsed(completedAt, day14),
  );
  check(
    "6 provider-only same behavior",
    !isDealReviewRevealed({
      sides: ["PROVIDER"],
      completedAt,
      now: day1,
    }) &&
      isDealReviewRevealed({
        sides: ["PROVIDER"],
        completedAt,
        now: day14plus,
      }),
  );
  check(
    "7 pair day 2 immediate visible",
    isDealReviewRevealed({
      sides: ["BUYER", "PROVIDER"],
      completedAt,
      now: daysFrom(completedAt, 2),
    }),
  );
  check(
    "8 pair day 13 immediate visible",
    isDealReviewRevealed({
      sides: ["BUYER", "PROVIDER"],
      completedAt,
      now: day13,
    }),
  );
  check(
    "9 create day 13 allowed",
    isDealReviewWindowOpen(completedAt, day13) &&
      !isDealReviewDeadlineElapsed(completedAt, day13),
  );
  check(
    "10 create after deadline rejected policy",
    !isDealReviewWindowOpen(completedAt, day14plus) &&
      isDealReviewDeadlineElapsed(completedAt, day14plus) &&
      service.includes("DEAL_REVIEW_WINDOW_EXPIRED_MESSAGE") &&
      DEAL_REVIEW_WINDOW_EXPIRED_MESSAGE.includes("değerlendirme süresi sona erdi"),
  );
  check(
    "11 create gate uses completedAt not review.createdAt",
    service.includes("isDealReviewDeadlineElapsed(deal.completedAt)") &&
      service.includes("isDealReviewDeadlineElapsed(fresh.completedAt)") &&
      !domain.includes("createdAt + DEAL_REVIEW_WINDOW"),
  );
  check(
    "12 no reviews after deadline nothing to count",
    !isDealReviewPairRevealed([]) &&
      // helper returns true on elapsed even with empty sides; queries still need a row
      isDealReviewDeadlineElapsed(completedAt, day14),
  );
  check(
    "13 window open exclusive of deadline",
    isDealReviewWindowOpen(completedAt, new Date(deadline.getTime() - 1)) &&
      !isDealReviewWindowOpen(completedAt, deadline),
  );
  check(
    "14 reveal at deadline inclusive",
    isDealReviewDeadlineElapsed(completedAt, deadline) &&
      isDealReviewRevealed({
        sides: ["BUYER"],
        completedAt,
        now: deadline,
      }),
  );
  check(
    "15 cutoff for SQL matches window",
    getDealReviewWindowCutoff(day14).getTime() === completedAt.getTime(),
  );
  check(
    "16 revealedReviewWhere has pair OR deadline",
    (() => {
      const where = revealedReviewWhere(day14);
      return (
        Array.isArray(where.OR) &&
        where.OR.length === 2 &&
        Boolean(where.OR[1]?.dealOutcome?.completedAt?.lte)
      );
    })(),
  );
  check(
    "17 trust uses revealedReviewWhere",
    trust.includes("revealedReviewWhere()") &&
      (trust.match(/revealedReviewWhere/g) ?? []).length >= 4,
  );
  check(
    "18 legacy expired single visible",
    isDealReviewRevealed({
      sides: ["BUYER"],
      completedAt,
      now: day14plus,
    }),
  );
  check(
    "19 legacy unexpired single hidden",
    !isDealReviewRevealed({
      sides: ["BUYER"],
      completedAt,
      now: day1,
    }),
  );
  check(
    "20 format deadline label",
    formatDealReviewDeadline(completedAt).length > 4,
  );
  check(
    "21 single policy constant",
    domain.includes("DEAL_REVIEW_WINDOW_DAYS = 14") &&
      !panel.includes("14 * 24") &&
      !service.includes("14 * 24"),
  );
  check(
    "22 no cron/job",
    !service.includes("cron") &&
      !domain.includes("cron") &&
      !trust.includes("setInterval"),
  );
  check(
    "23 no revealedAt column on DealReview",
    !schema.includes("revealedAt") &&
      !domain.includes("revealedAt") &&
      !service.includes("revealedAt") &&
      (() => {
        const model = schema.slice(
          schema.indexOf("model DealReview"),
          schema.indexOf("model PriceObservation"),
        );
        return (
          !model.includes("expiresAt") &&
          !model.includes("reviewDeadline") &&
          !model.includes("visibleAt")
        );
      })(),
  );
  check(
    "24 no timeout notification",
    !service.includes("TIMEOUT") &&
      !service.includes("auto reveal") &&
      service.includes("isDealReviewPairRevealed") &&
      !service.includes("isDealReviewDeadlineElapsed(sides"),
  );
}

console.log("\n=== TRUST / UI / NOTIFICATIONS ===\n");
{
  check(
    "completed count unchanged",
    trust.includes("countCompletedTransactions") &&
      formatCompletedTransactionCount(18) === "18 tamamlanan işlem",
  );
  check(
    "averageRating arithmetic",
    averageRatingFrom([5, 4]) === 4.5 && averageRatingFrom([]) == null,
  );
  check(
    "low sample no fake label",
    formatAverageRating(5) === "5,0 / 5" &&
      formatReviewCount(1) === "1 değerlendirme" &&
      formatTrustRatingMeta({
        completedTransactions: 1,
        reviewCount: 1,
        averageRating: 5,
      }) === "5,0 / 5 · 1 değerlendirme" &&
      !badge.includes("çok güvenilir") &&
      !panel.includes("çok güvenilir"),
  );
  check(
    "immutable",
    !existsSync(join(root, "src/app/api/deal-reviews/[id]")) &&
      !service.includes("prisma.dealReview.update") &&
      !service.includes("prisma.dealReview.delete") &&
      panel.includes("değiştirilemez"),
  );
  check(
    "pair reveal notification",
    service.includes("DEAL_REVIEWS_PUBLISHED_TITLE") &&
      DEAL_REVIEWS_PUBLISHED_TITLE === "Değerlendirmeler yayınlandı" &&
      DEAL_REVIEWS_PUBLISHED_MESSAGE ===
        "İşlem değerlendirmeleri artık görünür." &&
      !service.includes("Yeni değerlendirme aldınız") &&
      resolveNotificationDestination({
        type: "DEAL_REVIEW_RECEIVED",
        actionUrl: "/panel/mesajlar/c1",
        requestId: "r",
        offerId: "o",
        companyId: null,
      }) === "/panel/mesajlar/c1" &&
      deriveNotificationPath({
        type: "DEAL_REVIEW_RECEIVED",
        actionUrl: null,
        requestId: "r",
        offerId: "o",
        companyId: null,
      }) === "/panel/mesajlar",
  );
  check(
    "first review notification NO",
    service.includes("if (isDealReviewPairRevealed"),
  );
  check(
    "UI window hint",
    panel.includes("DEAL_REVIEW_WINDOW_HINT") &&
      DEAL_REVIEW_WINDOW_HINT.includes("14 gününüz var") &&
      panel.includes("Son tarih:") &&
      panel.includes("reviewDeadlineLabel"),
  );
  check(
    "UI expired state",
    panel.includes("DEAL_REVIEW_WINDOW_EXPIRED_MESSAGE") &&
      panel.includes("windowExpired") &&
      !panel.includes("Karşı taraf sizi değerlendirdi"),
  );
  check(
    "conversation wires window props",
    conversation.includes("canCreateReview={reviewState.canCreateReview}") &&
      conversation.includes("windowExpired={reviewState.windowExpired}") &&
      conversation.includes("reviewDeadlineLabel={reviewState.reviewDeadlineLabel}"),
  );
  check(
    "conversation state uses completedAt reveal",
    service.includes("isDealReviewRevealed") &&
      service.includes("completedAt") &&
      service.includes("getDealReviewConversationState"),
  );
  check(
    "blind hint present",
    panel.includes("DEAL_REVIEW_BLIND_HINT") &&
      DEAL_REVIEW_BLIND_HINT.includes("süre dolunca"),
  );
  check("notify type still registered", notify.includes("DEAL_REVIEW_RECEIVED"));
  check("destination still sanitizes", destination.includes("sanitizePanelActionUrl"));
}

console.log("\n=== MODEL / REGRESSION GUARDS ===\n");
{
  check("additive DealReview model", schema.includes("model DealReview"));
  check("no generic Review model", !schema.includes("model Review "));
  check("DealOutcome not rewritten", !migration.includes('ALTER TABLE "DealOutcome"'));
  check("completion panel still has no stars", !completionPanel.includes("yıldız"));
  check("min 44px stars", panel.includes("min-h-11 min-w-11"));
  check("standard can review", featuresForPlan("STANDARD").submit_offer === true);
  check("no plan gate", !service.includes("hasFeature") && !service.includes("PROFESSIONAL"));
  check("no radar coupling", !radar.includes("DealReview") && !radar.includes("revealedReviewWhere"));
  check("no offer intelligence coupling", !intelligence.includes("DealReview"));
  check("no opportunity coupling", !opportunity.includes("DealReview"));
  check("analiz no review metrics", !analiz.includes("reviewCount") && !analiz.includes("DealReview"));
  check(
    "completion still bilateral",
    dealOutcome.includes("confirmDealCompletion") &&
      dealOutcome.includes("BOTH_CONFIRMED"),
  );
  check(
    "negotiation unique still present",
    read("src/server/offer/offer-negotiation-service.ts").includes(
      "isPrismaUniqueViolation",
    ),
  );
  check(
    "offer lifecycle lock still present",
    read("src/lib/offer/submitted-commercial-lock.ts").includes(
      "OFFER_AMOUNT_IMMUTABLE_MESSAGE",
    ),
  );
  check(
    "media route untouched",
    !read("src/app/api/offers/[id]/media/route.ts").includes("DealReview"),
  );
  check(
    "Takiplerim no review ranking",
    !read("src/app/api/monetization/watchlist/route.ts").includes("DealReview"),
  );
  check(
    "OC no review ranking",
    !read("src/app/panel/firsatlar/page.tsx").includes("DealReview"),
  );
  check("FOR UPDATE race safety", service.includes("FOR UPDATE") && service.includes("$transaction"));
  check("alreadyPublished dedupe", service.includes("alreadyPublished"));
}

if (fail > 0) {
  console.log(`\nFAILED ${fail}/${pass + fail}`);
  for (const error of errors) console.log(` - ${error}`);
  process.exit(1);
}

console.log(`\nOK ${pass}/${pass + fail} — deal review V1.2 auto-reveal`);
