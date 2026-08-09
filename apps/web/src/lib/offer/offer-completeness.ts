export type OfferCompletenessInput = {
  amount: unknown;
  currency?: string | null;
  deliveryDays?: number | null;
  title?: string | null;
  description?: string | null;
  validUntil?: Date | string | null;
  companyVerified?: boolean;
};

export type OfferCompleteness = {
  score: number;
  filled: number;
  total: number;
  label: string;
  missing: string[];
};

const CHECKS = [
  {
    key: "amount",
    label: "Tutar",
    weight: 28,
    ok: (o: OfferCompletenessInput) => {
      const n = Number(o.amount);
      return Number.isFinite(n) && n > 0;
    },
  },
  {
    key: "delivery",
    label: "Teslim süresi",
    weight: 22,
    ok: (o: OfferCompletenessInput) =>
      typeof o.deliveryDays === "number" && o.deliveryDays > 0,
  },
  {
    key: "description",
    label: "Açıklama",
    weight: 30,
    ok: (o: OfferCompletenessInput) =>
      Boolean(o.description && o.description.trim().length >= 40),
  },
  {
    key: "title",
    label: "Başlık",
    weight: 10,
    ok: (o: OfferCompletenessInput) =>
      Boolean(o.title && o.title.trim().length >= 3),
  },
  {
    key: "validUntil",
    label: "Geçerlilik",
    weight: 10,
    ok: (o: OfferCompletenessInput) => Boolean(o.validUntil),
  },
] as const;

export function scoreOfferCompleteness(
  offer: OfferCompletenessInput,
): OfferCompleteness {
  let score = 0;
  let filled = 0;
  const missing: string[] = [];

  for (const check of CHECKS) {
    if (check.ok(offer)) {
      score += check.weight;
      filled += 1;
    } else {
      missing.push(check.label);
    }
  }

  if (offer.companyVerified) {
    score = Math.min(100, score + 5);
  }

  // Longer, more useful descriptions get a small bonus.
  const descLen = offer.description?.trim().length ?? 0;
  if (descLen >= 120) {
    score = Math.min(100, score + 5);
  }

  const label =
    score >= 85 ? "Çok dolu" : score >= 65 ? "İyi" : score >= 40 ? "Orta" : "Eksik";

  return {
    score,
    filled,
    total: CHECKS.length,
    label,
    missing,
  };
}

export function compareOffersByCompleteness<T extends OfferCompletenessInput>(
  offers: T[],
): Array<T & { completeness: OfferCompleteness }> {
  return [...offers]
    .map((offer) => ({
      ...offer,
      completeness: scoreOfferCompleteness(offer),
    }))
    .sort((a, b) => {
      if (b.completeness.score !== a.completeness.score) {
        return b.completeness.score - a.completeness.score;
      }
      const aAmount = Number(a.amount);
      const bAmount = Number(b.amount);
      if (Number.isFinite(aAmount) && Number.isFinite(bAmount)) {
        return aAmount - bAmount;
      }
      return 0;
    });
}
