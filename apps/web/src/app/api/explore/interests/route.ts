import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { INTEREST_CATEGORIES_COOKIE } from "@/lib/explore/interest-categories";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";

/** Clears legacy persistent interest cookie (selection is URL-only now). */
export async function DELETE() {
  try {
    await requireUser();
    const jar = await cookies();
    jar.delete(INTEREST_CATEGORIES_COOKIE);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 401 },
      );
    }
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/** @deprecated Selection is URL-based; this only clears old cookies. */
export async function POST() {
  return DELETE();
}
