import { NextResponse } from "next/server";

import { safeErrorResponse } from "@/lib/observability/errors";
import {
  assertRateLimit,
  clientKeyFromRequest,
} from "@/lib/observability/rate-limit";
import {
  RegisterValidationError,
  registerUserWithPassword,
} from "@/server/auth/register-user";

function clean(value: unknown, max = 200) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export async function POST(request: Request) {
  try {
    assertRateLimit({
      key: clientKeyFromRequest(request, "auth.register"),
      limit: 10,
      windowMs: 60_000,
    });

    const body = (await request.json()) as {
      name?: string;
      email?: string;
      phone?: string;
      password?: string;
      confirmPassword?: string;
    };

    const user = await registerUserWithPassword({
      name: clean(body.name, 120),
      email: clean(body.email, 160),
      phone: clean(body.phone, 40) || null,
      password: typeof body.password === "string" ? body.password : "",
      confirmPassword:
        typeof body.confirmPassword === "string" ? body.confirmPassword : "",
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Hesabınız oluşturuldu.",
        user: { id: user.id, email: user.email, name: user.name },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof RegisterValidationError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 400 },
      );
    }

    return safeErrorResponse(error, {
      service: "auth",
      event: "auth.register.failed",
    });
  }
}
