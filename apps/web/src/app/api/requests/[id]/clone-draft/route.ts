import { NextResponse } from "next/server";

import { readIdempotencyKeyFromRequest } from "@/lib/observability/idempotency";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import {
  cloneRequestAsDraft,
  RequestCloneNotAllowedError,
} from "@/server/request/clone-request-as-draft";
import { RequestValidationError } from "@/server/request/request-schema";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const headerKey = readIdempotencyKeyFromRequest(request);
    // Body companyId/userId/status are ignored. Scope comes from the DB row.
    await request.text().catch(() => "");
    const cloned = await cloneRequestAsDraft(user.id, id, {
      idempotencyKey: headerKey,
    });

    return NextResponse.json({
      ok: true,
      request: cloned,
      message: "Yeni taslağın hazır.",
      redirectTo: `/panel/taleplerim/${cloned.id}/duzenle?yeni=1`,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 401 },
      );
    }

    if (error instanceof RequestCloneNotAllowedError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 409 },
      );
    }

    if (error instanceof RequestValidationError) {
      return NextResponse.json(
        { ok: false, message: error.message, issues: error.issues },
        { status: 404 },
      );
    }

    console.error("Talep taslak olarak kopyalanamadı:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Taslak oluşturulurken beklenmeyen bir hata oluştu.",
      },
      { status: 500 },
    );
  }
}
