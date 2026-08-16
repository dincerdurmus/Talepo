import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/require-user";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { buildFollowUpIntelligence, type FollowUpInput } from "@/server/follow-up/follow-up-intelligence";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const entitlements = await resolveEntitlements(user.id, await getCompanyContextOptions());
    if (!entitlements.features.ai_offer_assistant && !entitlements.features.advanced_ai_pricing) return NextResponse.json({ ok: false, message: "Follow-up Intelligence PRO planınızda kapalı." }, { status: 403 });
    const body = (await request.json()) as FollowUpInput;
    const context = entitlements.subject.type === "company" ? "WORKSPACE" : "PERSONAL";
    return NextResponse.json({ ok: true, followUp: buildFollowUpIntelligence({ ...body, context }) });
  } catch { return NextResponse.json({ ok: false, message: "Takip analizi oluşturulamadı." }, { status: 500 }); }
}
