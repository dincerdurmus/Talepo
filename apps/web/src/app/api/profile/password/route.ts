import { NextResponse } from "next/server";

import { safeErrorResponse } from "@/lib/observability/errors";
import {
  assertRateLimit,
  clientKeyFromRequest,
} from "@/lib/observability/rate-limit";
import {
  ChangePasswordError,
  changeUserPassword,
} from "@/server/auth/change-password";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";

export async function POST(request: Request) {
  try {
    const sessionUser = await requireUser();
    assertRateLimit({
      key: clientKeyFromRequest(request, `profile.password.${sessionUser.id}`),
      limit: 8,
      windowMs: 60_000,
    });

    const body = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    const result = await changeUserPassword({
      userId: sessionUser.id,
      currentPassword:
        typeof body.currentPassword === "string" ? body.currentPassword : "",
      newPassword: typeof body.newPassword === "string" ? body.newPassword : "",
      confirmPassword:
        typeof body.confirmPassword === "string" ? body.confirmPassword : "",
    });

    return NextResponse.json({
      ok: true,
      message:
        "Şifreniz güncellendi. Bu cihazdaki oturumunuz kapatılacaktır. Diğer açık oturumlar geçerli kalabilir.",
      requiresReLogin: result.requiresReLogin,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    if (error instanceof ChangePasswordError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }
    return safeErrorResponse(error, {
      service: "profile.password",
      event: "change_password_failed",
    });
  }
}
