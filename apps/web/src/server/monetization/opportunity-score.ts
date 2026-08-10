import type {
  OpportunityClassification,
  OpportunityScoreResult,
} from "@/lib/monetization/types";
import { matchCompanyToRequest } from "./smart-matching";

export type OpportunityScoreInput = {
  request: {
    id: string;
    aiScore: number | null;
    isUrgent: boolean;
    budgetMin: number | null;
    budgetMax: number | null;
    offerCount: number;
    viewCount: number;
    publishedAt: Date | null;
    createdAt: Date;
  };
  companyId?: string;
  /** Override from future knowledge engine */
  knowledgeBoost?: number;
};

function classify(score: number): OpportunityClassification {
  if (score >= 75) return "HOT";
  if (score >= 50) return "GOOD";
  return "NORMAL";
}

/**
 * Rule-based opportunity score (0–100).
 * Provider abstraction allows Talepo knowledge engine override later.
 */
export async function scoreOpportunity(
  input: OpportunityScoreInput,
): Promise<OpportunityScoreResult> {
  const { request } = input;
  let score = 0;
  const reasons: string[] = [];

  const completeness = request.aiScore ?? 0;
  if (completeness >= 70) {
    score += 15;
    reasons.push("Yüksek talep doluluk skoru");
  } else if (completeness >= 40) {
    score += 8;
  }

  if (request.isUrgent) {
    score += 20;
    reasons.push("Acil talep");
  }

  const budget = request.budgetMax ?? request.budgetMin;
  if (budget !== null && budget > 0) {
    score += 15;
    reasons.push("Bütçe bilgisi mevcut");
    if (budget >= 50_000) {
      score += 10;
      reasons.push("Yüksek bütçe");
    }
  }

  if (input.companyId) {
    const match = await matchCompanyToRequest(input.companyId, request.id);
    if (match && match.score >= 50) {
      score += Math.round(match.score * 0.25);
      reasons.push("Firma ile güçlü eşleşme");
    }
  }

  const ageHours =
    (Date.now() - (request.publishedAt ?? request.createdAt).getTime()) /
    (1000 * 60 * 60);
  if (ageHours <= 24) {
    score += 10;
    reasons.push("Yeni yayınlanmış talep");
  }

  if (request.offerCount <= 1) {
    score += 12;
    reasons.push("Düşük tahmini rekabet");
  } else if (request.offerCount <= 3) {
    score += 5;
  }

  if (input.knowledgeBoost) {
    score += input.knowledgeBoost;
  }

  score = Math.min(100, Math.max(0, score));

  return {
    score,
    classification: classify(score),
    reasons: [...new Set(reasons)].slice(0, 6),
  };
}
