import { NextResponse } from "next/server";

import { safeErrorResponse } from "@/lib/observability/errors";
import {
  assertRateLimit,
  clientKeyFromRequest,
} from "@/lib/observability/rate-limit";
import {
  completePasswordReset,
  PasswordResetError,
} from "@/server/auth/password-reset";

export async function POST(request: Request) {
  try {
    assertRateLimit({
      key: clientKeyFromRequest(request, "auth.password.reset"),
      limit: 10,
      windowMs: 60_000,
    });

    const body = (await request.json()) as {
      token?: unknown;
      newPassword?: unknown;
      confirmPassword?: unknown;
    };

    await completePasswordReset({
      token: typeof body.token === "string" ? body.token : "",
      newPassword:
        typeof body.newPassword === "string" ? body.newPassword : "",
      confirmPassword:
        typeof body.confirmPassword === "string" ? body.confirmPassword : "",
    });

    return NextResponse.json({
      ok: true,
      message: "Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.",
    });
  } catch (error) {
    if (error instanceof PasswordResetError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }
    return safeErrorResponse(error, { event: "auth.password_reset.failed" });
  }
}
