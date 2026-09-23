/** D-0032: request visibility, case closure and owner notification commit together. */
import { prisma } from "@/lib/prisma";
import { createSubsystemLogger } from "@/lib/observability/logger";
import { REVIEW_HOLD_STATUS } from "@/lib/request/review-hold";
import { REQUEST_REVIEW_MODERATION_CATEGORY } from "@/lib/request-understanding/publish-disposition";
import { writeAdminAudit } from "@/server/admin/audit";
import { addOneCalendarMonth } from "./public-visibility";
import { distributeRequestToCompanies } from "./distribute-request";

const log = createSubsystemLogger("request");
const activeCases = ["OPEN", "INVESTIGATING"] as const;
export type ReviewHoldOutcome = {
  requestId: string;
  applied: boolean;
  distribution: { matchedCompanyCount: number; notifiedUserCount: number };
};
type DecisionInput = { requestId: string; adminUserId: string; caseId?: string; reason?: string; request?: Request };

export class ReviewHoldDecisionError extends Error {
  constructor(message: string, public readonly status: 400 | 409) {
    super(message);
    this.name = "ReviewHoldDecisionError";
  }
}

async function decideHeldRequest(input: DecisionInput, decision: "APPROVE" | "REJECT"): Promise<ReviewHoldOutcome> {
  const reason = input.reason?.trim() || (decision === "APPROVE" ? "İnceleme sonucu yayınlanması uygun bulundu." : "");
  if (reason.length < 5 || reason.length > 2000) throw new ReviewHoldDecisionError("Karar gerekçesi 5 ile 2000 karakter arasında olmalı.", 400);
  const now = new Date();
  const applied = await prisma.$transaction(async (tx) => {
    const current = await tx.request.findFirst({
      where: { id: input.requestId, deletedAt: null },
      select: { id: true, title: true, createdById: true, status: true, moderationHiddenById: true, category: { select: { isActive: true } } },
    });
    // A previous rejection keeps the request hidden and is a completed decision.
    if (!current || current.status !== REVIEW_HOLD_STATUS || current.moderationHiddenById) return false;
    if (decision === "APPROVE" && !current.category.isActive) throw new ReviewHoldDecisionError("Talebin kategorisi kapalı. Yayınlamadan önce aktif bir kategori seçilmeli.", 409);
    const moderationCase = input.caseId ? await tx.moderationCase.findUnique({ where: { id: input.caseId } }) : null;
    if (input.caseId && (!moderationCase || moderationCase.subjectType !== "REQUEST" || moderationCase.subjectId !== current.id || !activeCases.some(status => status === moderationCase.status))) return false;

    const changed = await tx.request.updateMany({
      where: { id: current.id, status: REVIEW_HOLD_STATUS, deletedAt: null, moderationHiddenById: null },
      data: decision === "APPROVE" ? {
        status: "PUBLISHED", publishedAt: now, visibleToSuppliersAt: now, expiresAt: addOneCalendarMonth(now),
        isModerationHidden: false, moderationHiddenAt: null, moderationHiddenById: null, moderationReason: null,
      } : {
        isModerationHidden: true, moderationHiddenAt: now, moderationHiddenById: input.adminUserId,
        moderationReason: reason, publishedAt: null, visibleToSuppliersAt: null, expiresAt: null,
      },
    });
    if (changed.count !== 1) return false;
    const closed = await tx.moderationCase.updateMany({
      where: {
        ...(input.caseId ? { id: input.caseId } : { subjectType: "REQUEST", subjectId: current.id, category: REQUEST_REVIEW_MODERATION_CATEGORY }),
        status: { in: [...activeCases] },
      },
      data: { status: "RESOLVED", resolutionNote: reason, resolvedAt: now },
    });
    if (input.caseId && closed.count !== 1) throw new ReviewHoldDecisionError("Bu kayıt başka bir yönetici tarafından güncellendi. Listeyi yenileyin.", 409);
    await tx.notification.create({ data: {
      userId: current.createdById,
      type: decision === "APPROVE" ? "REQUEST_PUBLISHED" : "GENERAL",
      title: decision === "APPROVE" ? "Talebiniz yayınlandı" : "Talebiniz yayınlanamadı",
      message: decision === "APPROVE" ? `“${current.title}” başlıklı talebiniz kontrolden geçti ve yayınlandı.` : `“${current.title}” başlıklı talebiniz yayınlanamadı. Gerekçe: ${reason}`,
      actionUrl: `/panel/taleplerim/${current.id}`, requestId: current.id,
    } });
    await writeAdminAudit(tx, {
      actorId: input.adminUserId, targetUserId: current.createdById, action: "MODERATION_CASE_UPDATED", reason,
      before: { requestStatus: current.status, caseStatus: moderationCase?.status ?? null },
      after: { requestStatus: decision === "APPROVE" ? "PUBLISHED" : REVIEW_HOLD_STATUS, caseStatus: "RESOLVED", reviewDecision: decision },
      metadata: { caseId: input.caseId ?? null, subjectType: "REQUEST", subjectId: current.id, reviewDecision: decision },
      request: input.request,
    });
    return true;
  });

  let distribution = { matchedCompanyCount: 0, notifiedUserCount: 0 };
  if (applied && decision === "APPROVE") {
    // Fanout stays outside the transaction; backfill can retry a failed delivery.
    try { distribution = await distributeRequestToCompanies(input.requestId); }
    catch (error) {
      log.warn("request.review_hold.distribute_failed", { outcome: "fallback", requestId: input.requestId, context: { errorName: error instanceof Error ? error.name : "unknown" } });
    }
  }
  if (applied) log.info(decision === "APPROVE" ? "request.review_hold.approved" : "request.review_hold.rejected", { outcome: "success", requestId: input.requestId, context: { adminUserId: input.adminUserId } });
  return { requestId: input.requestId, applied, distribution };
}

export function approveHeldRequest(input: DecisionInput): Promise<ReviewHoldOutcome> {
  return decideHeldRequest(input, "APPROVE");
}

export function rejectHeldRequest(input: DecisionInput & { reason: string }): Promise<ReviewHoldOutcome> {
  return decideHeldRequest(input, "REJECT");
}
