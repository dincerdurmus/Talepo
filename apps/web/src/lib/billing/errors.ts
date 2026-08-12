import { DomainError, DomainErrorCode } from "@/lib/observability/errors";

export const BillingErrorCode = {
  PAYMENT_PROVIDER_UNAVAILABLE: "PAYMENT_PROVIDER_UNAVAILABLE",
  PAYMENT_REQUIRED: "PAYMENT_REQUIRED",
  PAYMENT_PROVIDER_REQUIRED: "PAYMENT_PROVIDER_REQUIRED",
  CHECKOUT_FAILED: "CHECKOUT_FAILED",
  INVALID_WEBHOOK: "INVALID_WEBHOOK",
  BILLING_EVENT_DUPLICATE: "BILLING_EVENT_DUPLICATE",
  SUBSCRIPTION_NOT_FOUND: "SUBSCRIPTION_NOT_FOUND",
  SUBSCRIPTION_NOT_ACTIVE: "SUBSCRIPTION_NOT_ACTIVE",
  PLAN_MAPPING_INVALID: "PLAN_MAPPING_INVALID",
  CREDIT_GRANT_FAILED: "CREDIT_GRANT_FAILED",
  BILLING_FORBIDDEN: "BILLING_FORBIDDEN",
  INVALID_TRANSITION: "INVALID_TRANSITION",
  CHECKOUT_PROFILE_INCOMPLETE: "CHECKOUT_PROFILE_INCOMPLETE",
} as const;

export type BillingErrorCode =
  (typeof BillingErrorCode)[keyof typeof BillingErrorCode];

export class BillingError extends DomainError {
  constructor(options: {
    code: BillingErrorCode;
    userMessage: string;
    status?: number;
    diagnostic?: string;
  }) {
    super({
      code: options.code as unknown as DomainErrorCode,
      userMessage: options.userMessage,
      status: options.status ?? statusForBillingCode(options.code),
      diagnostic: options.diagnostic,
    });
    this.name = "BillingError";
  }
}

function statusForBillingCode(code: BillingErrorCode): number {
  switch (code) {
    case BillingErrorCode.PAYMENT_REQUIRED:
    case BillingErrorCode.PAYMENT_PROVIDER_REQUIRED:
      return 402;
    case BillingErrorCode.INVALID_WEBHOOK:
      return 401;
    case BillingErrorCode.BILLING_FORBIDDEN:
      return 403;
    case BillingErrorCode.SUBSCRIPTION_NOT_FOUND:
      return 404;
    case BillingErrorCode.PLAN_MAPPING_INVALID:
    case BillingErrorCode.INVALID_TRANSITION:
    case BillingErrorCode.CHECKOUT_PROFILE_INCOMPLETE:
      return 400;
    case BillingErrorCode.PAYMENT_PROVIDER_UNAVAILABLE:
      return 503;
    default:
      return 400;
  }
}
