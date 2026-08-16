import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PlatformAuthorizationError, requirePlatformAdmin } from "@/server/auth/require-platform-admin";
import { AuthenticationError } from "@/server/auth/require-user";
import { writeAdminAudit } from "@/server/admin/audit";
import { assertMfaSession } from "@/server/admin/mfa";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin("sensitive.view");
    assertMfaSession(_request, admin.id);
    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, phone: true, country: true, city: true, district: true,
        biography: true, membershipNumber: true, status: true, platformRole: true, planTier: true,
        bonusOfferCredits: true, createdAt: true, updatedAt: true, lastLoginAt: true, emailVerified: true,
        accounts: { select: { provider: true } },
        createdRequests: { orderBy: { createdAt: "desc" }, take: 25, select: { id: true, title: true, status: true, offerCount: true, createdAt: true, publishedAt: true } },
        submittedOffers: { orderBy: { createdAt: "desc" }, take: 25, select: { id: true, title: true, status: true, amount: true, currency: true, createdAt: true, submittedAt: true, request: { select: { id: true, title: true } } } },
        companyMemberships: { orderBy: { joinedAt: "desc" }, take: 20, select: { id: true, role: true, status: true, joinedAt: true, company: { select: { id: true, name: true } } } },
        adminAuditTargets: { orderBy: { createdAt: "desc" }, take: 30, select: { id: true, action: true, reason: true, createdAt: true, actor: { select: { name: true, email: true } } } },
        _count: { select: { createdRequests: true, submittedOffers: true } },
      },
    });
    if (!user) return NextResponse.json({ ok: false, message: "Kullanıcı bulunamadı." }, { status: 404 });
    await prisma.$transaction(async tx=>writeAdminAudit(tx,{actorId:admin.id,targetUserId:user.id,action:"SENSITIVE_DATA_VIEWED",reason:"Admin kullanıcı dosyası görüntülendi",metadata:{surface:"admin-user-detail"},request:_request}));
    const timeline=[
      {id:`registration-${user.id}`,type:"REGISTERED",title:"Hesap oluşturuldu",occurredAt:user.createdAt.toISOString()},
      ...(user.lastLoginAt?[{id:`login-${user.id}`,type:"LOGIN",title:"Son başarılı giriş",occurredAt:user.lastLoginAt.toISOString()}]:[]),
      ...user.createdRequests.map(x=>({id:`request-${x.id}`,type:"REQUEST",title:`Talep: ${x.title}`,occurredAt:x.createdAt.toISOString(),meta:x.status})),
      ...user.submittedOffers.map(x=>({id:`offer-${x.id}`,type:"OFFER",title:`Teklif: ${x.request.title}`,occurredAt:x.createdAt.toISOString(),meta:x.status})),
      ...user.companyMemberships.map(x=>({id:`company-${x.id}`,type:"COMPANY",title:`${x.company.name} şirket üyeliği`,occurredAt:(x.joinedAt??user.createdAt).toISOString(),meta:`${x.role} · ${x.status}`})),
      ...user.adminAuditTargets.map(x=>({id:`audit-${x.id}`,type:"ADMIN",title:`Yönetim işlemi: ${x.action}`,occurredAt:x.createdAt.toISOString(),meta:`${x.actor.name??x.actor.email??"Admin"} · ${x.reason}`})),
    ].sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt));
    return NextResponse.json({ ok: true, user: { ...user, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString(), lastLoginAt: user.lastLoginAt?.toISOString() ?? null, emailVerified: user.emailVerified?.toISOString() ?? null, createdRequests: user.createdRequests.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), publishedAt: item.publishedAt?.toISOString() ?? null })), submittedOffers: user.submittedOffers.map((item) => ({ ...item, amount: item.amount.toString(), createdAt: item.createdAt.toISOString(), submittedAt: item.submittedAt?.toISOString() ?? null })), companyMemberships:user.companyMemberships.map(x=>({...x,joinedAt:x.joinedAt?.toISOString()??null})), adminAuditTargets:user.adminAuditTargets.map(x=>({...x,createdAt:x.createdAt.toISOString()})), timeline } });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    if (error instanceof PlatformAuthorizationError) return NextResponse.json({ ok: false, message: error.message }, { status: 403 });
    console.error("[admin/users/detail] failed", error);
    return NextResponse.json({ ok: false, message: "Kullanıcı bilgileri alınamadı." }, { status: 500 });
  }
}
