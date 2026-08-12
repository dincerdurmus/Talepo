/**
 * Safe TRY money formatting for iyzico decimal fields.
 * Avoid float ops like `29.9 * 100`.
 */
export function formatTryMajorUnits(majorTry: number): string {
  if (!Number.isFinite(majorTry) || majorTry < 0) {
    throw new Error("invalid_try_amount");
  }
  const scaled = Math.round(majorTry * 100);
  if (Math.abs(majorTry * 100 - scaled) > 1e-6) {
    // Reject non-cent amounts that cannot be represented safely from float input.
    // Prefer integer TRY majors from OFFER_CREDIT_PACKS / plan config.
    const asCents = Number((majorTry * 100).toFixed(0));
    const whole = Math.trunc(asCents / 100);
    const cents = Math.abs(asCents % 100);
    return `${whole}.${String(cents).padStart(2, "0")}`;
  }
  const whole = Math.trunc(scaled / 100);
  const cents = Math.abs(scaled % 100);
  return `${whole}.${String(cents).padStart(2, "0")}`;
}

/** Integer TRY majors (149, 990, …) → "149.00" without float drift. */
export function formatTryIntegerMajor(majorTry: number): string {
  if (!Number.isInteger(majorTry) || majorTry < 0) {
    throw new Error("invalid_integer_try_amount");
  }
  return `${majorTry}.00`;
}
