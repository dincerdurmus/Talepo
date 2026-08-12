/**
 * Next.js server boot hook — production env hard gate before traffic.
 * Secret values are never logged.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const { assertProductionEnvironmentHardGate } = await import(
    "@/lib/observability/env"
  );
  assertProductionEnvironmentHardGate({ exitProcess: true });
}
