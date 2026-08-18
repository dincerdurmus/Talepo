import { moneyAmountCents } from "@/lib/offer/submitted-commercial-lock";

export type BudgetOfferCompareKind =
  | "missing_budget"
  | "invalid_budget"
  | "currency_mismatch"
  | "equal"
  | "above"
  | "below";

export type BudgetOfferCompareResult = {
  kind: BudgetOfferCompareKind;
  budgetCents: number | null;
  offerCents: number | null;
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

/** Buyer ceiling first (max), then min. Zero/invalid budgets are ignored. */
export function resolveTargetBudgetCents(input: {
  budgetMin?: number | string | null;
  budgetMax?: number | string | null;
}): number | null {
  return (
    toPositiveCents(input.budgetMax) ?? toPositiveCents(input.budgetMin) ?? null
  );
}

export function compareBuyerBudgetToOffer(input: {
  budgetMin?: number | string | null;
  budgetMax?: number | string | null;
  requestCurrency?: string | null;
  offerAmount?: number | string | null;
  offerCurrency?: string | null;
}): BudgetOfferCompareResult {
  const empty = {
    budgetCents: null as number | null,
    offerCents: null as number | null,
    diffCents: null as number | null,
    percent: null as number | null,
  };

  if (moneyCode(input.requestCurrency) !== moneyCode(input.offerCurrency)) {
    return { kind: "currency_mismatch", ...empty };
  }

  const hasBudgetField =
    (input.budgetMin != null && input.budgetMin !== "") ||
    (input.budgetMax != null && input.budgetMax !== "");
  const budgetCents = resolveTargetBudgetCents({
    budgetMin: input.budgetMin,
    budgetMax: input.budgetMax,
  });
  const offerCents = toPositiveCents(input.offerAmount);

  if (budgetCents == null) {
    return {
      kind: hasBudgetField ? "invalid_budget" : "missing_budget",
      ...empty,
      offerCents,
    };
  }
  if (offerCents == null) {
    return { kind: "invalid_budget", ...empty, budgetCents };
  }

  const diffCents = offerCents - budgetCents;
  if (diffCents === 0) {
    return {
      kind: "equal",
      budgetCents,
      offerCents,
      diffCents: 0,
      percent: 0,
    };
  }

  const percent = Math.round((Math.abs(diffCents) / budgetCents) * 100);
  return {
    kind: diffCents > 0 ? "above" : "below",
    budgetCents,
    offerCents,
    diffCents: Math.abs(diffCents),
    percent,
  };
}

export function formatOfferMoney(
  amount: number | string | null | undefined,
  currency: string,
) {
  const cents = toPositiveCents(amount);
  if (cents == null) return "—";
  return formatMoneyFromCents(cents, currency);
}

export function formatMoneyFromCents(cents: number, currency: string) {
  const amount = cents / 100;
  const fraction = cents % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: moneyCode(currency),
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  }).format(amount);
}

export function budgetCompareCopy(
  result: BudgetOfferCompareResult,
  currency: string,
): {
  deltaLabel: string;
  relativeLabel: string;
  tone: "amber" | "teal" | "neutral";
} {
  if (result.kind === "missing_budget" || result.kind === "invalid_budget") {
    return {
      deltaLabel: "Bütçe belirtilmedi",
      relativeLabel: "Yüzdesel fark gösterilmiyor",
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
      relativeLabel: "Bütçenizle aynı",
      tone: "teal",
    };
  }

  const deltaLabel =
    result.diffCents == null
      ? "—"
      : `${formatMoneyFromCents(result.diffCents, currency)} fark`;

  if (result.kind === "above") {
    return {
      deltaLabel,
      relativeLabel: `Bütçenin %${result.percent ?? 0} üstünde`,
      tone: "amber",
    };
  }
  return {
    deltaLabel,
    relativeLabel: `Bütçenin %${result.percent ?? 0} altında`,
    tone: "teal",
  };
}

export function formatRequestQuantity(input: {
  textValue?: string | null;
  numberValue?: number | string | null;
}): string | null {
  const text = input.textValue?.trim();
  if (text) return text;
  if (input.numberValue == null || input.numberValue === "") return null;
  const n = Number(input.numberValue);
  if (!Number.isFinite(n) || n <= 0) return null;
  const whole = Number.isInteger(n) ? String(n) : n.toLocaleString("tr-TR");
  return `${whole} adet`;
}
