import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { RoleNoteComposer } from "@/components/admin/RoleNoteComposer";
import { Header } from "@/components/layout/Header";
import { prisma } from "@/lib/prisma";
import { ADMIN_MFA_COOKIE, verifyMfaSession } from "@/server/admin/mfa";
import { PlatformAuthorizationError, requirePlatformAdmin } from "@/server/auth/require-platform-admin";
import { AuthenticationError } from "@/server/auth/require-user";

const labels: Record<string, string> = { SUPPORT: "Support", MODERATOR: "Moderatör", ANALYST: "Analist", ADMIN: "Admin", SUPER_ADMIN: "Süper Admin" };
const rank: Record<string, number> = { USER: 0, SUPPORT: 1, MODERATOR: 1, ANALYST: 1, ADMIN: 2, SUPER_ADMIN: 3 };

export default async function RoleNoteLogPage() {
  let admin;
  try { admin = await requirePlatformAdmin("admin.view", { skipMfa: true }); }
  catch (error) { if (error instanceof AuthenticationError || error instanceof PlatformAuthorizationError) notFound(); throw error; }
  if (!verifyMfaSession((await cookies()).get(ADMIN_MFA_COOKIE)?.value, admin.id)) notFound();
  const notes = await prisma.roleUserNote.findMany({ where: { OR: [{ authorId: admin.id }, { visibleToRoles: { has: admin.platformRole } }] }, orderBy: { updatedAt: "desc" }, take: 200, select: { id: true, body: true, createdAt: true, updatedAt: true, deletedAt: true, targetUser: { select: { platformRole: true } }, author: { select: { id: true, name: true, email: true, platformRole: true } } } });

  return <div className="min-h-screen bg-[#071310] text-white"><Header tone="ink" /><main className="mx-auto max-w-5xl px-5 py-8 sm:px-6 lg:px-8 lg:py-12"><Link href="/admin" className="text-sm text-emerald-100/55 transition hover:text-emerald-100">← Admin panele dön</Link><div className="mt-7 flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-200 text-[#08211d]"><ClipboardList className="h-6 w-6" /></span><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-sky-200/70">Yetkili iç iletişim</p><h1 className="mt-1 text-3xl font-semibold">İç not kayıtları</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Yalnız size açılmış notlar görünür. Alt rütbedeki not sahiplerinin ad-soyadı gösterilir; eşit seviyede yalnız rol bilgisi görünür.</p></div></div><RoleNoteComposer userId={admin.id} role={admin.platformRole as "SUPPORT" | "MODERATOR" | "ANALYST" | "ADMIN" | "SUPER_ADMIN"} /><section className="mt-7 space-y-3">{notes.length ? notes.map((note) => { const canSeeAuthorName = note.author.id === admin.id || rank[admin.platformRole] > rank[note.author.platformRole]; const authorLabel = note.author.id === admin.id ? "Siz" : canSeeAuthorName ? note.author.name ?? note.author.email ?? "İsimsiz kullanıcı" : "Kişi bilgisi gizli"; return <article key={note.id} className="rounded-2xl border border-white/[.08] bg-white/[.035] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-sky-100">{note.deletedAt ? "Silinmiş iç not" : "İç not"}</p><p className="mt-1 text-xs text-white/45">Notu bırakan: <span className="font-medium text-white/75">{authorLabel}</span> · Rol: <span className="font-medium text-white/75">{labels[note.author.platformRole] ?? note.author.platformRole}</span> · Hedef rol: <span className="font-medium text-white/75">{labels[note.targetUser.platformRole] ?? note.targetUser.platformRole}</span></p></div><time className="text-xs text-white/35">{note.updatedAt.toLocaleString("tr-TR")}</time></div><p className="mt-4 whitespace-pre-wrap rounded-xl bg-black/20 p-4 text-sm leading-6 text-white/80">{note.body}</p></article>; }) : <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-white/40">Size açılmış bir iç not yok.</div>}</section></main></div>;
}
