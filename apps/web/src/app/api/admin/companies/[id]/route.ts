import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { normalizeMembershipNumberInput } from "@/lib/auth/membership-number";
import { EntitlementError } from "@/lib/membership/types";
import { writeAdminAudit } from "@/server/admin/audit";
import { assertMfaSession } from "@/server/admin/mfa";
import { assertCanActivateCompanySeat } from "@/server/company/assert-company-seat";
import { createNotification } from "@/server/notifications/create-notification";
import { PlatformAuthorizationError, requirePlatformAdmin } from "@/server/auth/require-platform-admin";
import { AuthenticationError } from "@/server/auth/require-user";
import {
  BACKFILL_ELIGIBLE_COMPANY_STATUSES,
  backfillMatchesForCompany,
} from "@/server/request/distribute-request";

const PLANS = ["STANDARD", "PREMIUM", "PROFESSIONAL", "CORPORATE"] as const;
const COMPANY_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
const MEMBER_STATUSES = ["ACTIVE", "REMOVED"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin("companies.manage");
    assertMfaSession(request, admin.id);
    const { id } = await params;
    const body = await request.json() as {
      action?: "company" | "members" | "assignSeat";
      status?: string;
      planTier?: string;
      memberStatus?: string;
      membershipNumber?: string;
      reason?: string;
    };
    if (!body.action) {
      return NextResponse.json({ ok: false, message: "İşlem seçilmedi." }, { status: 400 });
    }
    if (body.action !== "assignSeat" && (!body.reason?.trim() || body.reason.trim().length < 5)) {
      return NextResponse.json({ ok: false, message: "İşlem gerekçesi en az 5 karakter olmalı." }, { status: 400 });
    }
    const reason = body.reason?.trim() || "Yönetici tarafından üyelik numarasıyla firma koltuğu atandı.";

    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true, name: true, status: true, planTier: true, createdById: true, deletedAt: true },
    });
    if (!company || company.deletedAt) return NextResponse.json({ ok: false, message: "Firma bulunamadı." }, { status: 404 });

    if (body.action === "assignSeat") {
      const membershipNumber = normalizeMembershipNumberInput(body.membershipNumber ?? "");
      if (!membershipNumber) return NextResponse.json({ ok: false, message: "Geçerli bir kullanıcı üyelik numarası girin." }, { status: 400 });
      if (!["ACTIVE", "DRAFT", "PENDING_VERIFICATION"].includes(company.status)) return NextResponse.json({ ok: false, message: "Askıdaki veya kapalı firmaya koltuk atanamaz." }, { status: 409 });
      const user = await prisma.user.findUnique({ where: { membershipNumber }, select: { id: true, name: true, email: true, status: true, deletedAt: true } });
      if (!user || user.status !== "ACTIVE" || user.deletedAt) return NextResponse.json({ ok: false, message: "Aktif kayıtlı kullanıcı bulunamadı." }, { status: 404 });
      const result = await prisma.$transaction(async (tx) => {
        // Serialize activations for this company so a concurrent assignment cannot oversubscribe seats.
        await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${company.id} FOR UPDATE`;
        const existing = await tx.companyMember.findUnique({ where: { companyId_userId: { companyId: company.id, userId: user.id } }, select: { id: true, role: true, status: true } });
        if (existing?.status === "ACTIVE") return { kind: "alreadyActive" as const, memberId: existing.id };
        await assertCanActivateCompanySeat({ companyId: company.id, db: tx });
        const member = existing
          ? await tx.companyMember.update({ where: { id: existing.id }, data: { status: "ACTIVE", joinedAt: new Date(), removedAt: null }, select: { id: true } })
          : await tx.companyMember.create({ data: { companyId: company.id, userId: user.id, role: "MEMBER", status: "ACTIVE", joinedAt: new Date() }, select: { id: true } });
        await writeAdminAudit(tx, { actorId: admin.id, targetUserId: user.id, action: "USER_UPDATED", reason, before: { companyId: company.id, membershipNumber, membershipStatus: existing?.status ?? null }, after: { companyId: company.id, membershipNumber, membershipStatus: "ACTIVE", companyMemberId: member.id }, metadata: { resourceType: "COMPANY", companyId: company.id, operation: "ASSIGN_SEAT" }, request });
        return { kind: "assigned" as const, memberId: member.id };
      });
      if (result.kind === "alreadyActive") return NextResponse.json({ ok: true, message: "Bu kullanıcı zaten firmanın aktif koltuğunda." });
      await createNotification({ userId: user.id, type: "COMPANY_MEMBER_JOINED", title: "Firma koltuğu atandı", message: `${company.name} firmasında aktif koltuk atandı.`, actionUrl: "/panel/ekip", companyId: company.id });
      return NextResponse.json({ ok: true, message: `${user.name ?? user.email ?? membershipNumber} firmaya aktif koltukla eklendi.` });
    }

    await requirePlatformAdmin("billing.manage");
    if (body.action === "company") {
      if (!COMPANY_STATUSES.includes(body.status as typeof COMPANY_STATUSES[number]) || !PLANS.includes(body.planTier as typeof PLANS[number])) {
        return NextResponse.json({ ok: false, message: "Geçersiz firma durumu veya planı." }, { status: 400 });
      }
      const after = { status: body.status as typeof COMPANY_STATUSES[number], planTier: body.planTier as typeof PLANS[number] };
      if (after.status === company.status && after.planTier === company.planTier) return NextResponse.json({ ok: true, message: "Değişiklik bulunmuyor." });

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.company.update({ where: { id: company.id }, data: after, select: { id: true, status: true, planTier: true } });
        await writeAdminAudit(tx, {
          actorId: admin.id,
          targetUserId: company.createdById,
          action: after.planTier !== company.planTier ? "PLAN_CHANGED" : "USER_UPDATED",
          reason,
          before: { companyId: company.id, companyName: company.name, status: company.status, planTier: company.planTier },
          after: { companyId: company.id, ...after },
          metadata: { resourceType: "COMPANY", companyId: company.id, changedFields: Object.keys(after).filter((key) => company[key as "status" | "planTier"] !== after[key as "status" | "planTier"]) },
          request,
        });
        return result;
      });

      /**
       * DURUM DAĞITILABİLİR OLDUYSA ESKİ TALEPLER İÇİN EŞLEŞME (KB-22 Dilim 2).
       *
       * Uygunluk, backfill'in kendi dağıtılabilir küme tanımından okunur —
       * burada ikinci bir liste tutulmaz. BU ROTA BUGÜN YALNIZ `ACTIVE` ya da
       * `SUSPENDED` üretebilir (`COMPANY_STATUSES`); `PENDING_VERIFICATION`
       * şirkete oluşturulurken verilir ve bu yoldan geçmez. Küme üzerinden
       * kontrol, `COMPANY_STATUSES` ileride genişlerse tetikleyicinin sessizce
       * kör kalmamasını sağlar.
       *
       * `companyId` istemci gövdesinden DEĞİL, sunucuda güncellenen gerçek
       * kaydın kimliğinden gelir. Backfill başarısız olursa admin mutasyonu
       * GERİ ALINMAZ; hata loglanır ve zamanlanmış tur telafi eder.
       */
      if (
        (BACKFILL_ELIGIBLE_COMPANY_STATUSES as readonly string[]).includes(
          updated.status,
        )
      ) {
        try {
          await backfillMatchesForCompany(updated.id);
        } catch (error) {
          console.error("[admin/companies] backfill başarısız:", error);
        }
      }

      return NextResponse.json({ ok: true, message: "Firma ayarları kaydedildi.", company: updated });
    }

    if (!MEMBER_STATUSES.includes(body.memberStatus as typeof MEMBER_STATUSES[number])) {
      return NextResponse.json({ ok: false, message: "Geçersiz firma üyeliği durumu." }, { status: 400 });
    }
    const memberStatus = body.memberStatus as typeof MEMBER_STATUSES[number];
    const result = await prisma.$transaction(async (tx) => {
      const members = await tx.companyMember.updateMany({
        where: { companyId: company.id, status: memberStatus === "REMOVED" ? "ACTIVE" : "REMOVED" },
        data: memberStatus === "REMOVED" ? { status: "REMOVED", removedAt: new Date() } : { status: "ACTIVE", removedAt: null },
      });
      await writeAdminAudit(tx, {
        actorId: admin.id,
        targetUserId: company.createdById,
        action: "USER_UPDATED",
        reason,
        before: { companyId: company.id, activeMembersChanged: memberStatus === "REMOVED" },
        after: { companyId: company.id, memberStatus, affectedMembers: members.count },
        metadata: { resourceType: "COMPANY", companyId: company.id, operation: "BULK_MEMBER_STATUS", memberStatus },
        request,
      });
      return members;
    });
    return NextResponse.json({ ok: true, message: `${result.count} firma üyeliği güncellendi. Kişilerin bireysel hesaplarına dokunulmadı.`, affectedMembers: result.count });
  } catch (error) {
    if (error instanceof EntitlementError) return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    if (error instanceof PlatformAuthorizationError) return NextResponse.json({ ok: false, message: error.message }, { status: 403 });
    console.error("[admin/company]", error);
    return NextResponse.json({ ok: false, message: "Firma işlemi kaydedilemedi." }, { status: 500 });
  }
}
