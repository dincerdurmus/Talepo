import { moneyAmountCents } from "@/lib/offer/submitted-commercial-lock";

import {
  formatMoneyFromCents,
  formatOfferMoney,
} from "@/lib/offer/budget-offer-compare";

export type NegotiationPriceCompareKind =
  | "missing"
  | "invalid"
  | "currency_mismatch"
  | "equal"
  | "up"
  | "down";

export type NegotiationPriceCompareResult = {
  kind: NegotiationPriceCompareKind;
  originalCents: number | null;
  pendingCents: number | null;
  diffCents: number | null;
  percent: number | null;
};

function moneyCode(value: string | null | undefined) {
  const raw = (value || "TRY").trim().toUpperCase();
  if (raw === "USD" || raw === "EUR" || raw === "GBP") return raw;
  return "TRY";
}

function toPositiveCents(
  value: number | string | null | undefined,
): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return moneyAmountCents(n);
}

/** Compare original offer amount to the latest pending negotiation amount. */
export function compareNegotiationPrices(input: {
  originalAmount?: number | string | null;
  pendingAmount?: number | string | null;
  originalCurrency?: string | null;
  pendingCurrency?: string | null;
}): NegotiationPriceCompareResult {
  const empty = {
    originalCents: null as number | null,
    pendingCents: null as number | null,
    diffCents: null as number | null,
    percent: null as number | null,
  };

  if (moneyCode(input.originalCurrency) !== moneyCode(input.pendingCurrency)) {
    return { kind: "currency_mismatch", ...empty };
  }

  const originalCents = toPositiveCents(input.originalAmount);
  const pendingCents = toPositiveCents(input.pendingAmount);
  if (originalCents == null || pendingCents == null) {
    return {
      kind: originalCents == null && pendingCents == null ? "missing" : "invalid",
      ...empty,
      originalCents,
      pendingCents,
    };
  }

  const rawDiff = pendingCents - originalCents;
  if (rawDiff === 0) {
    return {
      kind: "equal",
      originalCents,
      pendingCents,
      diffCents: 0,
      percent: 0,
    };
  }

  const percent = Math.round((Math.abs(rawDiff) / originalCents) * 100);
  return {
    kind: rawDiff > 0 ? "up" : "down",
    originalCents,
    pendingCents,
    diffCents: Math.abs(rawDiff),
    percent,
  };
}

export function negotiationCompareCopy(
  result: NegotiationPriceCompareResult,
  currency: string,
): {
  deltaLabel: string;
  relativeLabel: string;
  tone: "amber" | "teal" | "neutral";
} {
  if (result.kind === "missing" || result.kind === "invalid") {
    return {
      deltaLabel: "Karşılaştırma yok",
      relativeLabel: "Güncel tur okunamadı",
      tone: "neutral",
    };
  }
  if (result.kind === "currency_mismatch") {
    return {
      deltaLabel: "Para birimleri farklı",
      relativeLabel: "Karşılaştırma yapılamadı",
      tone: "neutral",
    };
  }
  if (result.kind === "equal") {
    return {
      deltaLabel: `${formatMoneyFromCents(0, currency)} fark`,
      relativeLabel: "İlk teklifle aynı",
      tone: "teal",
    };
  }

  const deltaLabel =
    result.diffCents == null
      ? "—"
      : `${formatMoneyFromCents(result.diffCents, currency)} fark`;

  if (result.kind === "up") {
    return {
      deltaLabel,
      relativeLabel: `İlk teklifin %${result.percent ?? 0} üstünde`,
      tone: "amber",
    };
  }
  return {
    deltaLabel,
    relativeLabel: `İlk teklifin %${result.percent ?? 0} altında`,
    tone: "teal",
  };
}

export { formatOfferMoney };
