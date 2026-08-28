import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import { markConversationAsRead } from "@/server/message/mark-conversation-read";

/**
 * SOHBETİ OKUNDU İŞARETLE — AÇIK SINIR (KB-22 Dilim 1, 2026-08-28).
 *
 * Bu yazım eskiden `/panel/mesajlar/[id]` sayfasının RSC render'ında
 * koşuyordu; sohbet linklerinde `prefetch` kapalı olmadığı için bir
 * bağlantının ÜSTÜNE GELMEK bile konuşmayı okundu işaretleyebiliyordu.
 *
 * SAHİPLİK FAIL-CLOSED. Kullanıcı `requireUser()` ile belirlenir. Yazımdan
 * ÖNCE, çağıranın konuşmanın gerçek bir katılımcısı olduğu doğrulanır;
 * değilse 404 döner ve konuşmanın varlığı hakkında bilgi sızdırmaz.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId: id,
        leftAt: null,
        OR: [
          { userId: user.id },
          { company: { members: { some: { userId: user.id, status: "ACTIVE" } } } },
        ],
      },
      select: { id: true },
    });

    if (!participant) {
      return NextResponse.json(
        { ok: false, message: "Konuşma bulunamadı." },
        { status: 404 },
      );
    }

    await markConversationAsRead(user.id, id);

    revalidatePath("/panel", "layout");
    revalidatePath("/panel/mesajlar");

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 401 },
      );
    }
    console.error("[messages/read]", error);
    return NextResponse.json(
      { ok: false, message: "Konuşma okundu işaretlenemedi." },
      { status: 500 },
    );
  }
}
