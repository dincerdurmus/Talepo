import { NextResponse } from "next/server";

import { getConfiguredSocialProviders } from "@/lib/auth/providers";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getConfiguredSocialProviders());
}
