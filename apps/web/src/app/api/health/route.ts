import { NextResponse } from "next/server";

/**
 * Liveness — process is up. No dependency checks.
 * Public endpoint: no secrets / config dump.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      status: "alive",
      service: "talepo-web",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
