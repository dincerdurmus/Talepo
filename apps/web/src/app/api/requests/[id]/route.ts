import { NextResponse } from "next/server";

import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import { deleteRequest } from "@/server/request/delete-request";
import {
  parseCreateRequestInput,
  RequestValidationError,
} from "@/server/request/request-schema";
import { updateRequest } from "@/server/request/update-request";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await request.json();
    const input = parseCreateRequestInput(body);
    const updated = await updateRequest(user.id, id, input);

    return NextResponse.json({
      ok: true,
      request: updated,
      redirectTo: `/panel/taleplerim/${updated.id}`,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 401 },
      );
    }

    if (error instanceof RequestValidationError) {
      return NextResponse.json(
        { ok: false, message: error.message, issues: error.issues },
        { status: 400 },
      );
    }

    console.error("Talep güncellenemedi:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Talep güncellenirken beklenmeyen bir hata oluştu.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const deleted = await deleteRequest(user.id, id);

    return NextResponse.json({
      ok: true,
      request: deleted,
      message: "Talep silindi.",
      redirectTo: "/panel/taleplerim",
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 401 },
      );
    }

    if (error instanceof RequestValidationError) {
      return NextResponse.json(
        { ok: false, message: error.message, issues: error.issues },
        { status: 404 },
      );
    }

    console.error("Talep silinemedi:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Talep silinirken beklenmeyen bir hata oluştu.",
      },
      { status: 500 },
    );
  }
}
