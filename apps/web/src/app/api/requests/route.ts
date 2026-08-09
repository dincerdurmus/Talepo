import { NextResponse } from "next/server";

import { EntitlementError } from "@/lib/membership/types";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import { createRequest } from "@/server/request/create-request";
import {
  parseCreateRequestInput,
  RequestValidationError,
} from "@/server/request/request-schema";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const input = parseCreateRequestInput(body);
    const createdRequest = await createRequest(user.id, input);

    return NextResponse.json(
      {
        ok: true,
        request: createdRequest,
        redirectTo: `/panel/taleplerim/${createdRequest.id}`,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 401 },
      );
    }

    if (error instanceof EntitlementError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message },
        { status: error.status },
      );
    }

    if (error instanceof RequestValidationError) {
      return NextResponse.json(
        { ok: false, message: error.message, issues: error.issues },
        { status: 400 },
      );
    }

    console.error("Talep oluşturulamadı:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Talep kaydedilirken beklenmeyen bir hata oluştu.",
      },
      { status: 500 },
    );
  }
}
