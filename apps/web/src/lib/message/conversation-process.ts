export type ConversationProcessFact = {
  requestTitle: string | null;
  requestAt: string | null;
  hasOffer: boolean;
  offerAmountLabel: string | null;
  offerSubmittedAt: string | null;
  hasNegotiation: boolean;
  negotiationAmountLabel: string | null;
  negotiationAt: string | null;
  offerAccepted: boolean;
  acceptedAmountLabel: string | null;
  offerAcceptedAt: string | null;
  conversationOpened: boolean;
  conversationOpenedAt: string | null;
  dealCompleted: boolean;
  dealCompletedAt: string | null;
  reviewSubmitted: boolean;
  reviewRating: number | null;
  reviewSubmittedAt: string | null;
};

export type ConversationProcessStep = {
  id: string;
  label: string;
  detail: string | null;
  at: string | null;
};

export function formatConversationMoney(
  amount: number | string | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (amount == null || amount === "") return null;
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  const code = (currency ?? "TRY").trim() || "TRY";
  return `${value.toLocaleString("tr-TR")} ${code}`;
}

/**
 * Sequence of commercial events that actually happened.
 * Does not invent future stages, percentages, or timestamps.
 */
export function buildConversationProcessSteps(
  fact: ConversationProcessFact,
): ConversationProcessStep[] {
  const steps: ConversationProcessStep[] = [];
  const requestTitle = fact.requestTitle?.trim() || null;

  if (fact.requestAt || fact.hasOffer) {
    steps.push({
      id: "request",
      label: "Talep",
      detail: requestTitle,
      at: fact.requestAt,
    });
  }

  if (fact.hasOffer) {
    steps.push({
      id: "offer",
      label: "Teklif gönderildi",
      detail: fact.offerAmountLabel
        ? `${fact.offerAmountLabel} teklif verildi`
        : null,
      at: fact.offerSubmittedAt,
    });
  }

  if (fact.hasNegotiation) {
    steps.push({
      id: "negotiation",
      label: "Karşı teklif",
      detail: fact.negotiationAmountLabel
        ? `${fact.negotiationAmountLabel} karşı teklif`
        : null,
      at: fact.negotiationAt,
    });
  }

  if (fact.offerAccepted) {
    steps.push({
      id: "accepted",
      label: "Teklif kabul edildi",
      detail: fact.acceptedAmountLabel
        ? `${fact.acceptedAmountLabel} üzerinde anlaşıldı`
        : null,
      at: fact.offerAcceptedAt,
    });
  }

  if (fact.conversationOpened && fact.offerAccepted) {
    steps.push({
      id: "messaging",
      label: "Yazışma açıldı",
      detail: "Teklif kabulü sonrası mesajlaşma açıldı",
      at: fact.conversationOpenedAt,
    });
  }

  if (fact.dealCompleted) {
    steps.push({
      id: "completed",
      label: "İşlem tamamlandı",
      detail: null,
      at: fact.dealCompletedAt,
    });
  }

  if (fact.reviewSubmitted) {
    const rating =
      fact.reviewRating != null && Number.isFinite(fact.reviewRating)
        ? Math.trunc(fact.reviewRating)
        : null;
    steps.push({
      id: "review",
      label: "Değerlendirme",
      detail:
        rating != null ? `${rating} yıldız değerlendirme verildi` : null,
      at: fact.reviewSubmittedAt,
    });
  }

  return steps;
}

export function formatConversationProcessTime(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
  }).format(date);
  const time = new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${day} · ${time}`;
}
