import { NextResponse } from "next/server";

import { EntitlementError } from "@/lib/membership/types";

export function entitlementErrorResponse(error: unknown) {
  if (error instanceof EntitlementError) {
    return NextResponse.json(
      { ok: false, code: error.code, message: error.message },
      { status: error.status },
    );
  }
  return null;
}

export function authErrorResponse(error: unknown) {
  if (error instanceof Error && error.name === "AuthenticationError") {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 401 },
    );
  }
  return null;
}
