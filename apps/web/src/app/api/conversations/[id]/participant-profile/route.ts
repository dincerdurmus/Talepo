import { NextResponse } from "next/server";

import { safeErrorResponse } from "@/lib/observability/errors";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import {
  getConversationCounterpartProfile,
  resolvePublicProfileByUserId,
} from "@/server/profile/public-profile-service";
import { PublicProfileAccessError } from "@/server/profile/public-profile-access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id: conversationId } = await params;
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");

    const profile = userId
      ? await resolvePublicProfileByUserId(user.id, userId, conversationId)
      : await getConversationCounterpartProfile(user.id, conversationId);

    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    if (error instanceof PublicProfileAccessError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 401 },
      );
    }
    return safeErrorResponse(error, {
      service: "profile",
      event: "conversation.participant-profile.failed",
    });
  }
}
