import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { addOneCalendarMonth, publicRequestExpiryFilter } from "@/server/request/public-visibility";

const OPEN_STATUSES = ["PUBLISHED", "RECEIVING_OFFERS"] as const;

/** Backfills legacy publish dates and expires open requests without touching offers. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: "Yetkisiz zamanlanmış görev isteği." }, { status: 401 });
  }

  try {
    const legacy = await prisma.request.findMany({
      where: { status: { in: [...OPEN_STATUSES] }, deletedAt: null, expiresAt: null, publishedAt: { not: null } },
      select: { id: true, publishedAt: true },
      take: 2000,
    });
    for (const requestRow of legacy) {
      if (!requestRow.publishedAt) continue;
      await prisma.request.update({ where: { id: requestRow.id }, data: { expiresAt: addOneCalendarMonth(requestRow.publishedAt) } });
    }

    const now = new Date();
    const expired = await prisma.request.updateMany({
      where: {
        status: { in: [...OPEN_STATUSES] },
        deletedAt: null,
        OR: [
          { expiresAt: { lte: now } },
          { expiresAt: null, publishedAt: null },
          { expiresAt: null, NOT: publicRequestExpiryFilter(now) },
        ],
      },
      data: { status: "EXPIRED" },
    });

    return NextResponse.json({ ok: true, backfilled: legacy.length, expired: expired.count });
  } catch (error) {
    console.error("[cron/request-expiry]", error);
    return NextResponse.json({ ok: false, message: "İlan süreleri güncellenemedi." }, { status: 500 });
  }
}
