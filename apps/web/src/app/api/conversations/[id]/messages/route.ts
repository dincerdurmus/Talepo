import { NextResponse } from "next/server";

import { safeErrorResponse } from "@/lib/observability/errors";
import {
  assertRateLimit,
  clientKeyFromRequest,
  userKey,
} from "@/lib/observability/rate-limit";
import { MAX_MESSAGE_IMAGES } from "@/lib/message/limits";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import {
  MessageValidationError,
  sendMessage,
} from "@/server/message/send-message";
import {
  sendImageMessage,
  sendImageMessages,
} from "@/server/message/send-image-message";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertRateLimit({
      key: clientKeyFromRequest(request, "message.send"),
      limit: 60,
      windowMs: 60_000,
    });

    const user = await requireUser();
    assertRateLimit({
      key: userKey("message.send", user.id),
      limit: 40,
      windowMs: 60_000,
    });

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
      images?: Array<{ imageDataUrl?: string; fileName?: string | null }>;
    };

    if (Array.isArray(body.images) && body.images.length > 0) {
      if (body.images.length > MAX_MESSAGE_IMAGES) {
        throw new MessageValidationError(
          "Bir mesaja en fazla 3 fotoğraf ekleyebilirsiniz.",
        );
      }

      const messages = await sendImageMessages(user.id, id, {
        images: body.images.map((item) => ({
          imageDataUrl: String(item.imageDataUrl ?? ""),
          fileName: item.fileName ?? null,
        })),
        caption: body.content ?? "",
      });
      return NextResponse.json({ ok: true, messages }, { status: 201 });
    }

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
    if (
      error instanceof AuthenticationError ||
      error instanceof MessageValidationError
    ) {
      return safeErrorResponse(error, {
        service: "messaging",
        event: "message.send.failed",
      });
    }

    return safeErrorResponse(error, {
      service: "messaging",
      event: "message.send.failed",
    });
  }
}
