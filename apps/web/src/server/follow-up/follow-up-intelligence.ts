export type FollowUpStatus = "WAIT" | "FOLLOW_UP_NOW" | "FOLLOW_UP_SOON" | "NO_ACTION" | "WON" | "LOST";
export type FollowUpPriority = "LOW" | "MEDIUM" | "HIGH";
export type FollowUpAction = "WAIT" | "SEND_FOLLOW_UP" | "REVIEW_OFFER" | "STOP_FOLLOWING" | "OPEN_CONVERSATION";

export type FollowUpInput = {
  context: "PERSONAL" | "WORKSPACE";
  offerStatus: "DRAFT" | "SUBMITTED" | "VIEWED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
  offerCreatedAt: string | Date;
  offerUpdatedAt?: string | Date;
  requestCreatedAt?: string | Date;
  now?: string | Date;
  isUrgent?: boolean;
  buyerResponded?: boolean;
  conversationLastActivityAt?: string | Date;
  opportunity?: { fit?: string; urgency?: string; recommendedAction?: string };
  price?: { confidence?: number; pricePosition?: string };
  copilot?: { strategy?: string; buyerPriorities?: string[]; scope?: { included?: string[]; excluded?: string[] } };
};

export type FollowUpResult = {
  status: FollowUpStatus; priority: FollowUpPriority; recommendedAction: FollowUpAction;
  recommendedAt: string | null; reason: string; signals: string[]; risks: string[];
  coolingRisk: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN"; responseState: "NO_RESPONSE" | "BUYER_RESPONDED" | "ACCEPTED" | "REJECTED" | "UNKNOWN";
  suggestedMessage?: string; confidence: number; context: FollowUpInput["context"];
};

const asDate = (value?: string | Date, fallback = new Date()) => value ? new Date(value) : fallback;

export function buildFollowUpIntelligence(input: FollowUpInput): FollowUpResult {
  const now = asDate(input.now);
  const created = asDate(input.offerCreatedAt, now);
  const ageHours = Math.max(0, (now.getTime() - created.getTime()) / 36e5);
  const requestAgeHours = input.requestCreatedAt ? Math.max(0, (now.getTime() - asDate(input.requestCreatedAt, now).getTime()) / 36e5) : null;
  const signals: string[] = [`offer_age_hours:${Math.floor(ageHours)}`];
  if (input.isUrgent) signals.push("urgent_request");
  if (input.opportunity?.fit) signals.push(`opportunity_fit:${input.opportunity.fit}`);
  if (input.price?.confidence != null) signals.push(`price_confidence:${Math.round(input.price.confidence * 100)}`);
  const responseState = input.offerStatus === "ACCEPTED" ? "ACCEPTED" : input.offerStatus === "REJECTED" ? "REJECTED" : input.buyerResponded ? "BUYER_RESPONDED" : "NO_RESPONSE";
  if (responseState === "ACCEPTED") return { status: "WON", priority: "LOW", recommendedAction: "STOP_FOLLOWING", recommendedAt: null, reason: "Teklif kabul edildi; takip gerekmiyor.", signals, risks: [], coolingRisk: "LOW", responseState, confidence: 1, context: input.context };
  if (responseState === "REJECTED") return { status: "LOST", priority: "LOW", recommendedAction: "STOP_FOLLOWING", recommendedAt: null, reason: "Teklif reddedildi; tekrar takip önerilmiyor.", signals, risks: [], coolingRisk: "LOW", responseState, confidence: 1, context: input.context };
  if (responseState === "BUYER_RESPONDED") return { status: "NO_ACTION", priority: "MEDIUM", recommendedAction: "OPEN_CONVERSATION", recommendedAt: null, reason: "Alıcı yanıt verdi; önce konuşmayı inceleyin.", signals: [...signals, "buyer_responded"], risks: [], coolingRisk: "LOW", responseState, confidence: .9, context: input.context };
  const urgent = Boolean(input.isUrgent || input.opportunity?.urgency === "HIGH");
  const threshold = urgent ? 24 : 72;
  const cooling: FollowUpResult["coolingRisk"] = ageHours >= threshold * 2 ? "HIGH" : ageHours >= threshold ? "MEDIUM" : "LOW";
  const status: FollowUpStatus = ageHours < threshold ? "WAIT" : ageHours < threshold * 2 ? "FOLLOW_UP_SOON" : "FOLLOW_UP_NOW";
  const priority: FollowUpPriority = urgent && status !== "WAIT" ? "HIGH" : status === "FOLLOW_UP_NOW" ? "HIGH" : status === "FOLLOW_UP_SOON" ? "MEDIUM" : "LOW";
  const recommendedAt = new Date(created.getTime() + threshold * 36e5).toISOString();
  const risks = cooling === "HIGH" ? ["Uzun sessizlik nedeniyle fırsat soğuyor olabilir."] : [];
  if (requestAgeHours != null && requestAgeHours > 24 * 14) risks.push("Talep uzun süredir açık.");
  const priceNote = input.price?.confidence != null && input.price.confidence < .55 ? " Fiyat güveni düşük olduğu için rakamı yeniden doğrulayın." : "";
  return { status, priority, recommendedAction: status === "WAIT" ? "WAIT" : "SEND_FOLLOW_UP", recommendedAt, reason: status === "WAIT" ? "Teklif henüz takip eşiğine ulaşmadı." : `Yanıt alınmadı; ${urgent ? "acil" : "standart"} takip politikası devrede.${priceNote}`, signals, risks, coolingRisk: cooling, responseState, suggestedMessage: status === "WAIT" ? undefined : "Merhaba, teklifimizi inceleme fırsatınız oldu mu? Kapsam veya teslimatla ilgili netleştirmemizi istediğiniz bir nokta varsa yardımcı olabilirim.", confidence: input.opportunity || input.price ? .82 : .62, context: input.context };
}
