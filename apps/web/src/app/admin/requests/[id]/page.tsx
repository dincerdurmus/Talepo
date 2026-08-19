import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Header } from "@/components/layout/Header";
import { hasAdminPermission } from "@/lib/auth/platform-admin";
import { prisma } from "@/lib/prisma";
import { formatRequestNumber } from "@/lib/request-number";
import { ADMIN_MFA_COOKIE, verifyMfaSession } from "@/server/admin/mfa";
import { verifySupportRequestAccessToken } from "@/server/admin/support-request-access";
import { PlatformAuthorizationError, requirePlatformAdmin } from "@/server/auth/require-platform-admin";
import { AuthenticationError } from "@/server/auth/require-user";

export default async function RequestSummary({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ supportAccess?: string }> }) {
  let admin;
  try { admin = await requirePlatformAdmin("admin.view"); } catch (error) { if (error instanceof AuthenticationError || error instanceof PlatformAuthorizationError) notFound(); throw error; }
  if (!verifyMfaSession((await cookies()).get(ADMIN_MFA_COOKIE)?.value, admin.id)) notFound();
  const { id } = await params;
  const { supportAccess } = await searchParams;
  if (!hasAdminPermission(admin.platformRole, "requests.view") && !verifySupportRequestAccessToken(supportAccess, admin.id, id)) notFound();
  const request = await prisma.request.findFirst({ where: { id, deletedAt: null }, select: { id: true, requestNumber: true, title: true, status: true, createdAt: true, offerCount: true, category: { select: { name: true } }, offers: { orderBy: { createdAt: "desc" }, take: 50, select: { id: true, amount: true, currency: true, status: true, createdAt: true } } } });
  if (!request) notFound();
  return <div className="min-h-screen bg-[#071310] text-white"><Header tone="ink" /><main className="mx-auto max-w-4xl px-5 py-8"><Link href="/admin" className="text-sm text-white/45 hover:text-white">← Admin panele dön</Link><p className="mt-6 text-xs uppercase tracking-[.18em] text-emerald-300/60">Talep özeti</p><h1 className="mt-2 text-3xl font-semibold">{formatRequestNumber(request.requestNumber)}</h1><p className="mt-2 text-white/60">{request.title}</p><div className="mt-4 grid gap-3 sm:grid-cols-4"><Stat label="Kategori" value={request.category.name} /><Stat label="Durum" value={request.status} /><Stat label="Teklif sayısı" value={String(request.offerCount)} /><Stat label="Tarih" value={request.createdAt.toLocaleDateString("tr-TR")} /></div><section className="mt-8"><h2 className="text-xl font-semibold">Anonim teklif özeti</h2><div className="mt-4 grid gap-3">{request.offers.length ? request.offers.map((offer, index) => <div key={offer.id} className="rounded-2xl border border-white/[.08] bg-white/[.035] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><span className="font-semibold">Teklif #{index + 1}</span><span className="text-lg font-semibold text-emerald-200">{offer.amount.toString()} {offer.currency}</span></div><p className="mt-2 text-sm text-white/50">{offer.status} · {offer.createdAt.toLocaleDateString("tr-TR")}</p></div>) : <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">Bu talep için teklif bulunmuyor.</p>}</div></section></main></div>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/[.08] bg-white/[.035] p-4"><p className="text-xs text-white/40">{label}</p><p className="mt-2 text-sm font-semibold">{value}</p></div>; }
