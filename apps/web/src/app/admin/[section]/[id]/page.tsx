import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Header } from "@/components/layout/Header";
import { prisma } from "@/lib/prisma";
import { ADMIN_MFA_COOKIE, verifyMfaSession } from "@/server/admin/mfa";
import { PlatformAuthorizationError, requirePlatformAdmin } from "@/server/auth/require-platform-admin";
import { AuthenticationError } from "@/server/auth/require-user";
import { CompanyMembersDrawer } from "@/components/admin/CompanyMembersDrawer";
import { UserDetailDrawer } from "@/components/admin/UserDetailDrawer";

const sections = ["users", "companies", "requests", "offers"] as const;
type Section = (typeof sections)[number];

export default async function AdminDetailPage({ params }: { params: Promise<{ section: string; id: string }> }) {
  const { section, id } = await params;
  if (!sections.includes(section as Section)) notFound();
  let admin;
  try { admin = await requirePlatformAdmin("admin.view", { skipMfa: true }); }
  catch (error) { if (error instanceof AuthenticationError || error instanceof PlatformAuthorizationError) notFound(); throw error; }
  if (!verifyMfaSession((await cookies()).get(ADMIN_MFA_COOKIE)?.value, admin.id)) notFound();
  const record = await getRecord(section as Section, id);
  if (!record) notFound();
  const members = section === "companies" && Array.isArray(record.members) ? record.members as Array<{ id: string; name: string | null; email: string | null; membershipNumber: string; role: string; status: string }> : [];
  const fields = Object.entries(record).filter(([key]) => key !== "members" && key !== "_count");
  return <div className="min-h-screen bg-[#071310] text-white"><Header tone="ink" /><main className="mx-auto max-w-4xl px-5 py-8 sm:px-6 lg:py-12"><Link href={`/admin/${section}`} className="text-sm text-emerald-100/55 hover:text-emerald-100">← Listeye dön</Link><div className="mt-8 rounded-[26px] border border-white/[.08] bg-white/[.045] p-6"><p className="text-xs uppercase tracking-[.2em] text-amber-200/65">Admin detay</p><h1 className="mt-2 text-3xl font-semibold">{String(record.title ?? record.name ?? record.id)}</h1><dl className="mt-8 grid gap-4 sm:grid-cols-2">{fields.map(([key, value]) => <div key={key} className="rounded-2xl border border-white/[.07] bg-black/15 p-4"><dt className="text-xs uppercase tracking-[.12em] text-white/35">{fieldLabels[key] ?? key}</dt><dd className="mt-2 break-words text-sm text-white/75">{key === "seats" && section === "companies" ? <CompanyMembersDrawer members={members}>{String(value)}</CompanyMembersDrawer> : key === "owner" && section === "companies" && typeof value === "object" && value !== null && "id" in value ? <UserDetailDrawer user={value as { id: string; name: string | null; email: string | null; membershipNumber: string }}>{String("name" in value ? value.name : "Firma sahibi")}</UserDetailDrawer> : formatValue(key, value)}</dd></div>)}</dl></div></main></div>;
}

const fieldLabels: Record<string, string> = { id: "Kimlik", name: "Firma adı", legalName: "Yasal ad", status: "Durum", planTier: "Plan", email: "E-posta", phone: "Telefon", createdAt: "Oluşturulma tarihi", seats: "Koltuk sayısı", requests: "Talep sayısı", offers: "Teklif sayısı", title: "Başlık", description: "Açıklama", offerCount: "Teklif sayısı", publishedAt: "Yayınlanma tarihi", owner: "Firma sahibi", category: "Kategori" };
function formatValue(key: string, value: unknown) { if (value === null || value === undefined) return "—"; if (key === "status") return ({ ACTIVE: "Aktif", DRAFT: "Taslak", PENDING_VERIFICATION: "Doğrulama bekliyor", REJECTED: "Reddedildi", SUSPENDED: "Askıya alındı", DELETED: "Silindi" } as Record<string, string>)[String(value)] ?? String(value); if (key === "planTier") return ({ STANDARD: "Bireysel", PREMIUM: "Profesyonel" } as Record<string, string>)[String(value)] ?? String(value); return String(value); }

async function getRecord(section: Section, id: string): Promise<Record<string, unknown> | null> {
  if (section === "users") return prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, platformRole: true, planTier: true, status: true, createdAt: true, lastLoginAt: true } }).then((x) => x ? { ...x, createdAt: x.createdAt.toLocaleString("tr-TR"), lastLoginAt: x.lastLoginAt?.toLocaleString("tr-TR") } : null);
  if (section === "companies") return prisma.company.findUnique({ where: { id }, select: { id: true, name: true, legalName: true, status: true, planTier: true, email: true, phone: true, createdAt: true, createdBy: { select: { id: true, name: true, email: true, membershipNumber: true } }, members: { orderBy: { joinedAt: "desc" }, select: { id: true, role: true, status: true, user: { select: { id: true, name: true, email: true, membershipNumber: true } } } }, _count: { select: { members: true, requests: true, offers: true } } } }).then((x) => x ? { id: x.id, name: x.name, legalName: x.legalName, status: x.status, planTier: x.planTier, email: x.email, phone: x.phone, createdAt: x.createdAt.toLocaleString("tr-TR"), owner: x.createdBy, seats: x._count.members, requests: x._count.requests, offers: x._count.offers, members: x.members.map((member) => ({ id: member.user.id, name: member.user.name, email: member.user.email, membershipNumber: member.user.membershipNumber, role: member.role, status: member.status })) } : null);
  if (section === "requests") return prisma.request.findUnique({ where: { id }, select: { id: true, title: true, description: true, status: true, offerCount: true, createdAt: true, publishedAt: true, category: { select: { name: true } }, createdBy: { select: { name: true, email: true } } } }).then((x) => x ? { ...x, category: x.category.name, owner: x.createdBy.name ?? x.createdBy.email, createdAt: x.createdAt.toLocaleString("tr-TR"), publishedAt: x.publishedAt?.toLocaleString("tr-TR") } : null);
  return prisma.offer.findUnique({ where: { id }, select: { id: true, title: true, description: true, amount: true, currency: true, status: true, createdAt: true, submittedAt: true, request: { select: { title: true } }, submittedBy: { select: { name: true, email: true } } } }).then((x) => x ? { ...x, amount: `${x.amount.toString()} ${x.currency}`, request: x.request.title, submittedBy: x.submittedBy.name ?? x.submittedBy.email, createdAt: x.createdAt.toLocaleString("tr-TR"), submittedAt: x.submittedAt?.toLocaleString("tr-TR") } : null);
}
