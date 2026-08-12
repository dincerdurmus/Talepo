import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import type { PlanTierId } from "@/lib/membership/plans";
import { PLAN_PRICING } from "@/lib/membership/pricing-config";

export const TALEPO_IYZICO_SUBSCRIPTION_PRODUCT_NAME = "Talepo Membership";

export type CanonicalIyzicoPlan = {
  tier: Extract<PlanTierId, "PREMIUM" | "PROFESSIONAL" | "CORPORATE">;
  name: string;
  priceTry: number;
  currencyCode: "TRY";
  paymentInterval: "MONTHLY";
  paymentIntervalCount: 1;
  planPaymentType: "RECURRING";
  trialPeriodDays: 0;
};

export const CANONICAL_IYZICO_MONTHLY_PLANS: readonly CanonicalIyzicoPlan[] = [
  {
    tier: "PREMIUM",
    name: "Talepo Premium Monthly",
    priceTry: PLAN_PRICING.PREMIUM.priceTry!,
    currencyCode: "TRY",
    paymentInterval: "MONTHLY",
    paymentIntervalCount: 1,
    planPaymentType: "RECURRING",
    trialPeriodDays: 0,
  },
  {
    tier: "PROFESSIONAL",
    name: "Talepo Professional Monthly",
    priceTry: PLAN_PRICING.PROFESSIONAL.priceTry!,
    currencyCode: "TRY",
    paymentInterval: "MONTHLY",
    paymentIntervalCount: 1,
    planPaymentType: "RECURRING",
    trialPeriodDays: 0,
  },
  {
    tier: "CORPORATE",
    name: "Talepo Corporate Monthly",
    priceTry: PLAN_PRICING.CORPORATE.priceTry!,
    currencyCode: "TRY",
    paymentInterval: "MONTHLY",
    paymentIntervalCount: 1,
    planPaymentType: "RECURRING",
    trialPeriodDays: 0,
  },
] as const;

export const IYZICO_PLAN_ENV_KEYS = [
  "TALEPO_IYZICO_PLAN_PREMIUM_MONTHLY",
  "TALEPO_IYZICO_PLAN_PROFESSIONAL_MONTHLY",
  "TALEPO_IYZICO_PLAN_CORPORATE_MONTHLY",
] as const;

export type IyzicoPlanEnvKey = (typeof IYZICO_PLAN_ENV_KEYS)[number];

export type IyzicoPlanSnapshot = {
  name?: string;
  price?: number | string;
  currencyCode?: string;
  paymentInterval?: string;
  paymentIntervalCount?: number | string;
  planPaymentType?: string;
};

export function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function planMatchesCanonical(
  plan: IyzicoPlanSnapshot,
  canonical: CanonicalIyzicoPlan,
): boolean {
  return (
    (plan.name ?? "").trim() === canonical.name &&
    asFiniteNumber(plan.price) === canonical.priceTry &&
    (plan.currencyCode ?? "").toUpperCase() === canonical.currencyCode &&
    (plan.paymentInterval ?? "").toUpperCase() === canonical.paymentInterval &&
    asFiniteNumber(plan.paymentIntervalCount) ===
      canonical.paymentIntervalCount &&
    (plan.planPaymentType ?? "").toUpperCase() === canonical.planPaymentType
  );
}

export function findCanonicalPlanByName(
  name: string,
): CanonicalIyzicoPlan | null {
  return (
    CANONICAL_IYZICO_MONTHLY_PLANS.find((p) => p.name === name.trim()) ?? null
  );
}

/**
 * Classify subscription catalog API failures without over-claiming root cause.
 * 100001 is treated as provider capability unconfirmed — not auth failure.
 */
export function classifySubscriptionCatalogError(input: {
  errorCode?: string | null;
  httpStatus?: number | null;
  errorMessage?: string | null;
}): {
  code: string;
  classification: "AUTH_FAILED" | "PROVIDER_BLOCKED" | "OTHER";
} {
  const errorCode = (input.errorCode ?? "").trim();
  const message = (input.errorMessage ?? "").toLowerCase();
  if (
    errorCode === "8" ||
    message.includes("authentication token is not verified") ||
    input.httpStatus === 401
  ) {
    return { code: "AUTH_FAILED", classification: "AUTH_FAILED" };
  }
  if (errorCode === "100001") {
    return {
      code: "IYZICO_SUBSCRIPTION_API_UNAVAILABLE",
      classification: "PROVIDER_BLOCKED",
    };
  }
  return {
    code: errorCode || "IYZICO_SUBSCRIPTION_API_ERROR",
    classification: "OTHER",
  };
}

/** Upsert only allowlisted plan ref keys into `.env.local` (never `.env`). */
export function upsertIyzicoPlanRefsInEnvLocal(
  entries: Partial<Record<IyzicoPlanEnvKey, string>>,
  options?: { cwd?: string },
): { path: string; updatedKeys: IyzicoPlanEnvKey[] } {
  const cwd = options?.cwd ?? process.cwd();
  const filePath = join(cwd, ".env.local");
  if (basename(filePath) !== ".env.local") {
    throw new Error("env_write_refused_non_env_local");
  }

  const sanitized: Partial<Record<IyzicoPlanEnvKey, string>> = {};
  for (const key of IYZICO_PLAN_ENV_KEYS) {
    const value = entries[key]?.trim();
    if (value) sanitized[key] = value;
  }
  const keys = Object.keys(sanitized) as IyzicoPlanEnvKey[];
  if (keys.length === 0) {
    throw new Error("env_write_refused_empty");
  }

  const existing = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  const lines = existing.length
    ? existing.replace(/\r\n/g, "\n").split("\n")
    : [];
  const next: string[] = [];
  const seen = new Set<IyzicoPlanEnvKey>();

  for (const line of lines) {
    const m = /^([A-Z0-9_]+)=/.exec(line);
    if (m && (IYZICO_PLAN_ENV_KEYS as readonly string[]).includes(m[1])) {
      const key = m[1] as IyzicoPlanEnvKey;
      if (sanitized[key]) {
        next.push(`${key}=${sanitized[key]}`);
        seen.add(key);
      } else {
        next.push(line);
      }
    } else {
      next.push(line);
    }
  }

  for (const key of keys) {
    if (!seen.has(key) && sanitized[key]) {
      if (next.length && next[next.length - 1] !== "") next.push("");
      next.push(`${key}=${sanitized[key]}`);
      seen.add(key);
    }
  }

  writeFileSync(filePath, `${next.join("\n").replace(/\n+$/, "")}\n`, "utf8");
  return { path: filePath, updatedKeys: [...seen] };
}
