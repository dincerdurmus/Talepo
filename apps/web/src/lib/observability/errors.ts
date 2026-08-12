import { NextResponse } from "next/server";

import { EntitlementError } from "@/lib/membership/types";

import { logOperational } from "./logger";

/**
 * Canonical domain error codes for API/ops.
 * Extend existing EntitlementError / auth errors — do not duplicate stacks.
 */
export const DomainErrorCode = {
  AUTH_REQUIRED: "AUTH_REQUIRED",
  FORBIDDEN: "FORBIDDEN",
  ENTITLEMENT_REQUIRED: "ENTITLEMENT_REQUIRED",
  FEATURE_NOT_AVAILABLE: "FEATURE_NOT_AVAILABLE",
  PLAN_REQUIRED: "PLAN_REQUIRED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  COMPANY_SCOPE_VIOLATION: "COMPANY_SCOPE_VIOLATION",
  INVALID_REQUEST: "INVALID_REQUEST",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  REQUEST_NOT_FOUND: "REQUEST_NOT_FOUND",
  OFFER_NOT_ALLOWED: "OFFER_NOT_ALLOWED",
  OFFER_ALREADY_EXISTS: "OFFER_ALREADY_EXISTS",
  OFFER_QUOTA_EXCEEDED: "OFFER_QUOTA_EXCEEDED",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  PROVIDER_TIMEOUT: "PROVIDER_TIMEOUT",
  RATE_LIMITED: "RATE_LIMITED",
  DATABASE_UNAVAILABLE: "DATABASE_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type DomainErrorCode =
  (typeof DomainErrorCode)[keyof typeof DomainErrorCode];

export class DomainError extends Error {
  code: DomainErrorCode;
  status: number;
  /** Safe for UI; never put Prisma/internal detail here. */
  userMessage: string;
  /** Ops-only; may be logged after redaction. */
  diagnostic?: string;

  constructor(options: {
    code: DomainErrorCode;
    userMessage: string;
    status?: number;
    diagnostic?: string;
  }) {
    super(options.userMessage);
    this.name = "DomainError";
    this.code = options.code;
    this.userMessage = options.userMessage;
    this.status = options.status ?? statusForCode(options.code);
    this.diagnostic = options.diagnostic;
  }
}

function statusForCode(code: DomainErrorCode): number {
  switch (code) {
    case DomainErrorCode.AUTH_REQUIRED:
      return 401;
    case DomainErrorCode.RATE_LIMITED:
      return 429;
    case DomainErrorCode.QUOTA_EXCEEDED:
    case DomainErrorCode.OFFER_QUOTA_EXCEEDED:
      return 402;
    case DomainErrorCode.INVALID_REQUEST:
    case DomainErrorCode.VALIDATION_FAILED:
      return 400;
    case DomainErrorCode.REQUEST_NOT_FOUND:
      return 404;
    case DomainErrorCode.PROVIDER_UNAVAILABLE:
    case DomainErrorCode.PROVIDER_TIMEOUT:
    case DomainErrorCode.DATABASE_UNAVAILABLE:
      return 503;
    case DomainErrorCode.INTERNAL_ERROR:
      return 500;
    default:
      return 403;
  }
}

const USER_SAFE_FALLBACK =
  "İşlem tamamlanamadı. Lütfen biraz sonra tekrar deneyin.";

export type SafeErrorBody = {
  ok: false;
  code: DomainErrorCode | string;
  message: string;
  correlationId?: string;
};

export function mapUnknownToSafeError(
  error: unknown,
  correlationId?: string,
): { status: number; body: SafeErrorBody; logCode: string } {
  if (error instanceof DomainError) {
    return {
      status: error.status,
      body: {
        ok: false,
        code: error.code,
        message: error.userMessage,
        correlationId,
      },
      logCode: error.code,
    };
  }

  if (error instanceof EntitlementError) {
    const code =
      error.code === "FEATURE_NOT_AVAILABLE" || error.code === "PLAN_REQUIRED"
        ? DomainErrorCode.ENTITLEMENT_REQUIRED
        : error.code;
    return {
      status: error.status,
      body: {
        ok: false,
        code,
        message: error.message,
        correlationId,
      },
      logCode: error.code,
    };
  }

  if (error instanceof Error && error.name === "AuthenticationError") {
    return {
      status: 401,
      body: {
        ok: false,
        code: DomainErrorCode.AUTH_REQUIRED,
        message: error.message || "Bu işlem için giriş yapmanız gerekiyor.",
        correlationId,
      },
      logCode: DomainErrorCode.AUTH_REQUIRED,
    };
  }

  if (error instanceof Error && error.name === "DatabaseUnavailableError") {
    return {
      status: 503,
      body: {
        ok: false,
        code: DomainErrorCode.DATABASE_UNAVAILABLE,
        message: error.message,
        correlationId,
      },
      logCode: DomainErrorCode.DATABASE_UNAVAILABLE,
    };
  }

  if (error instanceof Error && error.name === "OfferQuotaExceededError") {
    return {
      status: 402,
      body: {
        ok: false,
        code: DomainErrorCode.OFFER_QUOTA_EXCEEDED,
        message: error.message,
        correlationId,
      },
      logCode: DomainErrorCode.OFFER_QUOTA_EXCEEDED,
    };
  }

  if (
    error instanceof Error &&
    (error.name === "OfferValidationError" ||
      error.name === "RequestValidationError" ||
      error.name === "RegisterValidationError")
  ) {
    return {
      status: 400,
      body: {
        ok: false,
        code: DomainErrorCode.VALIDATION_FAILED,
        message: error.message || "Geçersiz istek.",
        correlationId,
      },
      logCode: DomainErrorCode.VALIDATION_FAILED,
    };
  }

  const diagnostic =
    error instanceof Error ? `${error.name}: ${error.message}` : "unknown";

  return {
    status: 500,
    body: {
      ok: false,
      code: DomainErrorCode.INTERNAL_ERROR,
      message: USER_SAFE_FALLBACK,
      correlationId,
    },
    logCode: diagnostic.includes("P2002")
      ? "PRISMA_UNIQUE_VIOLATION"
      : DomainErrorCode.INTERNAL_ERROR,
  };
}

export function safeErrorResponse(
  error: unknown,
  options?: {
    service?: string;
    event?: string;
    correlationId?: string;
    context?: Record<string, unknown>;
  },
): NextResponse {
  const mapped = mapUnknownToSafeError(error, options?.correlationId);
  const isInternal = mapped.status >= 500;

  logOperational({
    level: isInternal ? "error" : "warn",
    event: options?.event ?? "api.request.failed",
    service: options?.service ?? "api",
    outcome: mapped.body.code === DomainErrorCode.ENTITLEMENT_REQUIRED ||
      mapped.body.code === "FEATURE_NOT_AVAILABLE"
      ? "denied"
      : "failure",
    errorCode: mapped.logCode,
    correlationId: options?.correlationId,
    context: {
      status: mapped.status,
      ...options?.context,
      diagnostic:
        error instanceof DomainError
          ? error.diagnostic
          : error instanceof Error
            ? error.name
            : "unknown",
    },
  });

  return NextResponse.json(mapped.body, { status: mapped.status });
}
