/**
 * Billing gates — entitlement ≠ payment.
 * Mock monetization mutations are DEVELOPMENT_ONLY and never allowed in production.
 */

export function isProductionRuntime(
  nodeEnv = process.env.NODE_ENV ?? "development",
): boolean {
  return nodeEnv === "production";
}

/** Mock plan upgrade — local/test only. */
export function isMockUpgradeAllowed(
  nodeEnv = process.env.NODE_ENV ?? "development",
): boolean {
  if (isProductionRuntime(nodeEnv)) return false;
  return process.env.ALLOW_MOCK_UPGRADE === "true";
}

/**
 * Mock credit grants without payment verification.
 * Production: always denied until real payment webhooks exist.
 */
export function isMockCreditPurchaseAllowed(
  nodeEnv = process.env.NODE_ENV ?? "development",
): boolean {
  if (isProductionRuntime(nodeEnv)) return false;
  return (
    process.env.ALLOW_MOCK_CREDITS === "true" ||
    process.env.ALLOW_MOCK_UPGRADE === "true"
  );
}

export const PAYMENT_REQUIRED_MESSAGE =
  "Bu işlem için ödeme doğrulaması gerekli. Ödeme entegrasyonu tamamlanana kadar production'da plan/credit yükseltme kapalıdır.";
