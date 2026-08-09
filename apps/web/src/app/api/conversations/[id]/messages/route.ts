import { NextResponse } from "next/server";

import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import {
  MessageValidationError,
  sendMessage,
} from "@/server/message/send-message";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = (await request.json()) as { content?: string };

    const message = await sendMessage(user.id, id, String(body.content ?? ""));

    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }

    if (error instanceof MessageValidationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }

    console.error("Mesaj gönderilemedi:", error);
    return NextResponse.json(
      { ok: false, message: "Mesaj gönderilirken bir hata oluştu." },
      { status: 500 },
    );
  }
}
