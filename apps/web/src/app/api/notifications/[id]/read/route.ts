import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import { markNotificationAsRead } from "@/server/notifications/mark-notifications-read";

/**
 * TEK BİLDİRİMİ OKUNDU İŞARETLE — AÇIK SINIR (KB-22 Dilim 1, 2026-08-28).
 *
 * Bu yazım eskiden `/panel/bildirimler/r/[id]` sayfasının RSC render'ında
 * koşuyordu. "Okundu" bir kullanıcı eylemidir; sayfanın render edilmesi
 * değildir. Artık ekran açıldıktan SONRA istemciden çağrılan açık bir POST'tur.
 *
 * SAHİPLİK. Kullanıcı yalnız `requireUser()` ile belirlenir; istemciden gelen
 * hiçbir kimlik okunmaz. Yazım `where { id, userId, status: UNREAD }` ile
 * kapsamlıdır: başka kullanıcının bildirimi 0 satır günceller ve yanıt
 * bildirimin VARLIĞI hakkında bilgi sızdırmaz — her iki durumda da aynı
 * gövde döner.
 *
 * İDEMPOTENT. İkinci çağrı `UNREAD` koşulunu sağlamadığı için 0 satır yazar.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    const result = await markNotificationAsRead(user.id, id, {
      revalidate: false,
    });

    revalidatePath("/panel", "layout");
    revalidatePath("/panel/bildirimler");

    return NextResponse.json({ ok: true, updated: result.count });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 401 },
      );
    }
    console.error("[notifications/read]", error);
    return NextResponse.json(
      { ok: false, message: "Bildirim okundu işaretlenemedi." },
      { status: 500 },
    );
  }
}
