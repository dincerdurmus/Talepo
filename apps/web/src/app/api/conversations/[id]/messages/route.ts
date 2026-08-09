import { NextResponse } from "next/server";

import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import {
  MessageValidationError,
  sendMessage,
} from "@/server/message/send-message";
import { sendImageMessage } from "@/server/message/send-image-message";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const content = String(form.get("content") ?? "");
      const file = form.get("image");

      if (file instanceof File && file.size > 0) {
        const bytes = Buffer.from(await file.arrayBuffer());
        const mime = file.type || "image/jpeg";
        const imageDataUrl = `data:${mime};base64,${bytes.toString("base64")}`;

        const message = await sendImageMessage(user.id, id, {
          imageDataUrl,
          caption: content,
          fileName: file.name,
        });

        return NextResponse.json({ ok: true, message }, { status: 201 });
      }

      const message = await sendMessage(user.id, id, content);
      return NextResponse.json({ ok: true, message }, { status: 201 });
    }

    const body = (await request.json()) as {
      content?: string;
      imageDataUrl?: string;
      fileName?: string;
    };

    if (body.imageDataUrl) {
      const message = await sendImageMessage(user.id, id, {
        imageDataUrl: String(body.imageDataUrl),
        caption: body.content ?? "",
        fileName: body.fileName ?? null,
      });
      return NextResponse.json({ ok: true, message }, { status: 201 });
    }

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
