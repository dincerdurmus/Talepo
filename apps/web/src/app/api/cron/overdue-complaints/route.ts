import { NextResponse } from "next/server";

import { dispatchOverdueComplaintEscalations } from "@/server/admin/overdue-complaints";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: "Yetkisiz zamanlanmış görev isteği." }, { status: 401 });
  }

  try {
    const result = await dispatchOverdueComplaintEscalations();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/overdue-complaints]", error);
    return NextResponse.json({ ok: false, message: "Şikayet alarmı çalıştırılamadı." }, { status: 500 });
  }
}
