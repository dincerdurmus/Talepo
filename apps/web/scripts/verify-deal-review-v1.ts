/**
 * Deal review / trust summary V1.
 * Run: npx tsx scripts/verify-deal-review-v1.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  DEAL_REVIEW_BLIND_HINT,
  DEAL_REVIEW_COMMENT_MAX,
  DEAL_REVIEWS_PUBLISHED_MESSAGE,
  DEAL_REVIEWS_PUBLISHED_TITLE,
  averageRatingFrom,
  dealIsReviewEligible,
  formatAverageRating,
  formatReviewCount,
  formatTrustRatingMeta,
  isDealReviewPairRevealed,
  isDealReviewRevealed,
  isValidDealRating,
  resolveDealReviewTarget,
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

console.log("\n=== ELIGIBILITY ===\n");
{
  check("1 accepted but not completed denied", !dealIsReviewEligible(acceptedLike));
  check("2 buyer confirmed only denied", !dealIsReviewEligible(buyerOnly));
  check("3 provider confirmed only denied", !dealIsReviewEligible(providerOnly));
  check("4 bilateral completed eligible", dealIsReviewEligible(bilateral));
  check("pending deal denied", !dealIsReviewEligible(pendingDeal));
  check(
    "create uses bilateral where",
    service.includes("BILATERAL_COMPLETED_WHERE") &&
      service.includes("dealIsReviewEligible"),
  );
}

console.log("\n=== CREATE / DUPLICATE / TARGET ===\n");
{
  check("5 buyer create path", service.includes('reviewerSide: side') && service.includes("createDealReview"));
  check("6 provider create path", service.includes('resolveNegotiationActorSide'));
  check(
    "7/8 unique duplicate",
    schema.includes("@@unique([dealOutcomeId, reviewerSide])") &&
      migration.includes("DealReview_dealOutcomeId_reviewerSide_key") &&
      service.includes("isPrismaUniqueViolation") &&
      service.includes("DEAL_REVIEW_DUPLICATE_MESSAGE"),
  );
  check(
    "9 company two members share provider side",
    service.includes("reviewerSide: side") &&
      schema.includes("@@unique([dealOutcomeId, reviewerSide])"),
  );

  check("10 rating 1 pass", isValidDealRating(1));
  check("11 rating 5 pass", isValidDealRating(5));
  check("12 rating 0 reject", !isValidDealRating(0));
  check("13 rating 6 reject", !isValidDealRating(6));
  check("14 decimal reject", !isValidDealRating(4.5) && !isValidDealRating(2.2));
  check("integer 3 pass", isValidDealRating(3));
  check("string rating reject", !isValidDealRating("5"));
  check("null rating reject", !isValidDealRating(null));

  check("15 comment optional", panel.includes("comment.trim() || null") && domain.includes("DEAL_REVIEW_COMMENT_MAX"));
  check("16 comment max 800", DEAL_REVIEW_COMMENT_MAX === 800 && service.includes("DEAL_REVIEW_COMMENT_MAX"));
  check(
    "contact blocker reused",
    service.includes("containsBlockedContactInfo") &&
      service.includes("sanitizeCommercialText"),
  );

  const createCall = api.slice(api.indexOf("await createDealReview"));
  check(
    "17 target spoof ignored",
    !createCall.includes("body.targetUserId") &&
      !createCall.includes("body.targetCompanyId") &&
      service.includes("resolveDealReviewTarget"),
  );
  check(
    "18 unrelated user forbidden",
    service.includes("Bu işlem için değerlendirme yazamazsınız.") &&
      service.includes("DomainErrorCode.FORBIDDEN"),
  );

  const companyTarget = resolveDealReviewTarget(
    { companyId: "co1", submittedById: "member1", requestCreatedById: "buyer1" },
    "BUYER",
  );
  check(
    "19 company target correct",
    companyTarget.targetType === "COMPANY" &&
      companyTarget.targetCompanyId === "co1" &&
      companyTarget.targetUserId == null,
  );

  const personalTarget = resolveDealReviewTarget(
    { companyId: null, submittedById: "prov1", requestCreatedById: "buyer1" },
    "BUYER",
  );
  check(
    "20 personal provider target correct",
    personalTarget.targetType === "USER" &&
      personalTarget.targetUserId === "prov1" &&
      personalTarget.targetCompanyId == null,
  );

  const buyerTarget = resolveDealReviewTarget(
    { companyId: "co1", submittedById: "member1", requestCreatedById: "buyer1" },
    "PROVIDER",
  );
  check(
    "21 buyer target correct",
    buyerTarget.targetType === "USER" &&
      buyerTarget.targetUserId === "buyer1" &&
      buyerTarget.targetCompanyId == null,
  );
}

console.log("\n=== TRUST AGGREGATE ===\n");
{
  check(
    "22 completed count authority unchanged",
    trust.includes("countCompletedTransactions") &&
      dealOutcome.includes("BILATERAL_COMPLETED_WHERE") &&
      formatCompletedTransactionCount(18) === "18 tamamlanan işlem",
  );
  check(
    "23 reviewCount from revealed reviews",
    trust.includes("_count: { _all: true }") &&
      trust.includes("REVEALED_REVIEW_WHERE") &&
      (trust.match(/REVEALED_REVIEW_WHERE/g) ?? []).length >= 4,
  );
  check(
    "24 averageRating arithmetic mean",
    averageRatingFrom([5, 4]) === 4.5 &&
      averageRatingFrom([5]) === 5 &&
      averageRatingFrom([]) == null,
  );
  check(
    "25 low sample no fake trust label",
    formatAverageRating(5) === "5,0 / 5" &&
      formatReviewCount(1) === "1 değerlendirme" &&
      formatTrustRatingMeta({
        completedTransactions: 1,
        reviewCount: 1,
        averageRating: 5,
      }) === "5,0 / 5 · 1 değerlendirme" &&
      !badge.includes("çok güvenilir") &&
      !badge.includes("En iyi satıcı") &&
      !badge.includes("%100 güven") &&
      !panel.includes("çok güvenilir") &&
      !trust.includes("trustScore") &&
      !schema.includes("reputation"),
  );
  check(
    "26 immutable",
    !existsSync(join(root, "src/app/api/deal-reviews/[id]")) &&
      !service.includes("prisma.dealReview.update") &&
      !service.includes("prisma.dealReview.delete") &&
      panel.includes("Değerlendirmeniz alındı") &&
      panel.includes("değiştirilemez"),
  );
  check(
    "27 pair reveal notification",
    schema.includes("DEAL_REVIEW_RECEIVED") &&
      notify.includes("DEAL_REVIEW_RECEIVED") &&
      service.includes('type: "DEAL_REVIEW_RECEIVED"') &&
      service.includes("DEAL_REVIEWS_PUBLISHED_TITLE") &&
      service.includes("isDealReviewPairRevealed") &&
      service.includes("alreadyPublished") &&
      !service.includes("Yeni değerlendirme aldınız") &&
      !service.includes("rating}") &&
      !DEAL_REVIEWS_PUBLISHED_MESSAGE.includes("yıldız") &&
      DEAL_REVIEWS_PUBLISHED_TITLE === "Değerlendirmeler yayınlandı" &&
      destination.includes("DEAL_REVIEW_RECEIVED") &&
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
    "28 profile aggregate helpers",
    trust.includes("getUserTrustSummary") &&
      trust.includes("getCompanyTrustSummary") &&
      trust.includes("getBuyerTrustSummary"),
  );
  check(
    "29 identity privacy",
    !panel.includes("existingCounterpart") &&
      conversation.includes("DealReviewPanel") &&
      conversation.includes("getDealReviewConversationState") &&
      conversation.includes("oppositeReview={reviewState.oppositeReview}") &&
      !conversation.includes("counterpartReview") &&
      !panel.includes("Karşı taraf sizi değerlendirdi") &&
      !panel.includes("Karşı taraf değerlendirmesini tamamladı"),
  );
}

console.log("\n=== BLIND REVIEW / REVEAL ===\n");
{
  check("1 no reviews visible count 0", !isDealReviewRevealed({ sides: [] }));
  check(
    "2 buyer-only hidden",
    !isDealReviewRevealed({ sides: ["BUYER"] }) &&
      !isDealReviewPairRevealed(["BUYER"]),
  );
  check(
    "3 provider-only hidden",
    !isDealReviewRevealed({ sides: ["PROVIDER"] }),
  );
  check(
    "4 both reviews revealed",
    isDealReviewRevealed({ sides: ["BUYER", "PROVIDER"] }) &&
      isDealReviewPairRevealed(["PROVIDER", "BUYER"]),
  );
  check(
    "5 buyer own hidden self-view",
    service.includes("ownReview") &&
      panel.includes("Değerlendirmeniz alındı") &&
      panel.includes("existingReview"),
  );
  check(
    "6/7 opposite hidden until pair",
    service.includes("getDealReviewConversationState") &&
      service.includes("isDealReviewPairRevealed") &&
      service.includes("oppositeReview") &&
      service.includes("row.reviewerSide !== side"),
  );
  check(
    "8 both submitted each sees opposite",
    conversation.includes("oppositeReview={reviewState.oppositeReview}") &&
      panel.includes("Karşı tarafın değerlendirmesi"),
  );
  check(
    "9/10/11/12/14/15 hidden-aware aggregates",
    trust.includes("REVEALED_REVIEW_WHERE") &&
      domain.includes("REVEALED_REVIEW_WHERE") &&
      trust.includes("getUserTrustSummary") &&
      trust.includes("loadProviderTrustSummaries"),
  );
  check(
    "13 completed transactions unchanged",
    trust.includes("countCompletedTransactions") &&
      !trust.includes("dealReview.count") &&
      formatCompletedTransactionCount(18) === "18 tamamlanan işlem",
  );
  check(
    "16 no fake trust label",
    panel.includes("DEAL_REVIEW_BLIND_HINT") &&
      DEAL_REVIEW_BLIND_HINT.includes("iki taraf") &&
      !panel.includes("çok güvenilir"),
  );
  check(
    "17 first review notification NO",
    service.includes("if (isDealReviewPairRevealed") &&
      !service.includes("Yeni değerlendirme aldınız"),
  );
  check(
    "18 second review reveal notification",
    service.includes("DEAL_REVIEWS_PUBLISHED_TITLE") &&
      DEAL_REVIEWS_PUBLISHED_TITLE === "Değerlendirmeler yayınlandı" &&
      DEAL_REVIEWS_PUBLISHED_MESSAGE ===
        "İşlem değerlendirmeleri artık görünür.",
  );
  check(
    "19 no rating/comment in notification body",
    !DEAL_REVIEWS_PUBLISHED_MESSAGE.includes("yıldız") &&
      !DEAL_REVIEWS_PUBLISHED_MESSAGE.includes("rating") &&
      !service.slice(service.indexOf("tx.notification.create")).includes("created.rating"),
  );
  check(
    "20 duplicate second-submit notification prevented",
    service.includes("alreadyPublished") &&
      service.includes("title: DEAL_REVIEWS_PUBLISHED_TITLE"),
  );
  check(
    "21 simultaneous reviews race",
    service.includes("FOR UPDATE") && service.includes("$transaction"),
  );
  check(
    "22 company two members race",
    schema.includes("@@unique([dealOutcomeId, reviewerSide])"),
  );
  check(
    "23 immutable remains",
    !service.includes("prisma.dealReview.update") &&
      !service.includes("prisma.dealReview.delete") &&
      panel.includes("değiştirilemez"),
  );
  check(
    "24 legacy one-sided review hidden",
    !isDealReviewRevealed({ sides: ["BUYER"] }) &&
      !schema.includes("revealedAt") &&
      !schema.includes("visibleAt"),
  );
  check(
    "25 legacy paired reviews visible",
    isDealReviewRevealed({ sides: ["BUYER", "PROVIDER"] }),
  );
  check(
    "timeout hook exists but unused",
    domain.includes("autoRevealAfterMs") &&
      !domain.includes("7 * 24") &&
      !domain.includes("14 * 24") &&
      !domain.includes("30 * 24") &&
      !service.includes("autoRevealAfterMs"),
  );
  check("no cron job added", !service.includes("cron") && !trust.includes("cron"));
}

console.log("\n=== MODEL / SECURITY / COPY ===\n");
{
  check("additive DealReview model", schema.includes("model DealReview"));
  check("no generic Review model", !schema.includes("model Review "));
  check("DealOutcome not rewritten", !migration.includes("ALTER TABLE \"DealOutcome\""));
  check("rating check constraint", migration.includes("DealReview_rating_range"));
  check("completion panel still has no stars", !completionPanel.includes("yıldız"));
  check("review UI copy", panel.includes("Deneyiminizi değerlendirin") && panel.includes("Değerlendirmeyi gönder"));
  check("min 44px stars", panel.includes("min-h-11 min-w-11"));
  check("role derived server-side", !api.includes("body.reviewerSide") && !api.includes("body.role"));
  check("standard can review", featuresForPlan("STANDARD").submit_offer === true);
  check("no plan gate", !service.includes("hasFeature") && !service.includes("PROFESSIONAL"));
  check("no radar coupling", !radar.includes("dealReview") && !radar.includes("DealReview"));
  check("no offer intelligence coupling", !intelligence.includes("dealReview") && !intelligence.includes("averageRating"));
  check("no opportunity coupling", !opportunity.includes("dealReview") && !opportunity.includes("DealReview"));
  check("analiz not redesigned for reviews", !analiz.includes("dealReview") && !analiz.includes("averageRating"));
  check("no backfill reviews", !service.includes("backfill"));
  check("legacy one-sided not eligible", !dealIsReviewEligible(buyerOnly));
}

console.log("\n=== REGRESSION SOURCE GUARDS ===\n");
{
  check(
    "30 completion still bilateral",
    dealOutcome.includes("confirmDealCompletion") &&
      dealOutcome.includes("BOTH_CONFIRMED"),
  );
  check(
    "31 negotiation unique still present",
    read("src/server/offer/offer-negotiation-service.ts").includes(
      "isPrismaUniqueViolation",
    ),
  );
  check(
    "32 offer lifecycle lock still present",
    read("src/lib/offer/submitted-commercial-lock.ts").includes(
      "OFFER_AMOUNT_IMMUTABLE_MESSAGE",
    ),
  );
  check(
    "33 media route untouched by review",
    !read("src/app/api/offers/[id]/media/route.ts").includes("DealReview"),
  );
  check(
    "34 notifications sanitizer kept",
    destination.includes("sanitizePanelActionUrl"),
  );
  check("35 Radar file unchanged coupling", !radar.includes("trust-summary"));
  check("36 Analiz no review metrics", !analiz.includes("reviewCount"));
  check(
    "37 Takiplerim no review ranking",
    !read("src/app/api/monetization/watchlist/route.ts").includes("DealReview"),
  );
  check(
    "38 OC no review ranking",
    !read("src/app/panel/firsatlar/page.tsx").includes("DealReview"),
  );
}

if (fail > 0) {
  console.log(`\nFAILED ${fail}/${pass + fail}`);
  for (const error of errors) console.log(` - ${error}`);
  process.exit(1);
}

console.log(`\nOK ${pass}/${pass + fail} — deal review V1`);
