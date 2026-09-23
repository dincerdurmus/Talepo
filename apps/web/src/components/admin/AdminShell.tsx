"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Activity, ArrowUpRight, Bell, Building2, ChevronRight, FileText, FolderTree, HandCoins, LayoutDashboard, Menu, PanelsTopLeft, ShieldCheck, StickyNote, Tags, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { adminRoleLabels, getAdminNavigation } from "@/lib/admin-navigation";
import type { PlatformRole } from "@/lib/auth/platform-admin";

const icons = { overview: LayoutDashboard, users: Users, companies: Building2, requests: FileText, offers: HandCoins, categories: FolderTree, operations: ShieldCheck, health: Activity, notifications: Bell, curation: Tags, notes: StickyNote };

type AdminShellProps = {
  name: string | null;
  role: PlatformRole;
  title: string;
  children: ReactNode;
};

export function AdminShell({ name, role, title, children }: AdminShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = getAdminNavigation(role);
  const initials = (name || "Talepo").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("tr-TR");

  function navigation() {
    return <>
      <div className="admin-brand-area">
        <Link href="/admin" className="admin-wordmark" aria-label="Talepo yönetim merkezi" onClick={() => setMobileOpen(false)}>
          <span className="admin-logo-mark" aria-hidden="true">t<span>+</span></span>talepo<span className="admin-logo-dot">.</span>
        </Link>
        <div className="admin-workspace"><span><ShieldCheck size={17} /></span><div>Yönetim merkezi<small>{adminRoleLabels[role]}</small></div></div>
      </div>
      <nav className="admin-navigation" aria-label="Yönetim menüsü">
        {(["Platform", "Operasyon"] as const).map((group) => <div className="admin-nav-group" key={group}>
          <p>{group}</p>
          {items.filter((item) => item.group === group).map((item) => {
            const Icon = icons[item.icon];
            const active = !item.href.includes("#") && (item.href === "/admin" ? pathname === "/admin" : pathname === item.href || pathname.startsWith(`${item.href}/`));
            return <Link key={item.href} href={item.href} prefetch={false} className="admin-nav-link" data-active={active} aria-current={active ? "page" : undefined} onClick={() => setMobileOpen(false)}><Icon size={18} /><span>{item.label}</span></Link>;
          })}
        </div>)}
      </nav>
      <div className="admin-sidebar-footer">
        <Link href="/panel" className="admin-return-link"><PanelsTopLeft size={17} />Kullanıcı paneline dön<ArrowUpRight size={15} /></Link>
        <div className="admin-sidebar-user"><span className="admin-avatar">{initials}</span><div><strong>{name || "Talepo yöneticisi"}</strong><small>{adminRoleLabels[role]}</small></div></div>
      </div>
    </>;
  }

  return <div className="admin-signature admin-shell">
    <a href="#admin-main" className="admin-skip-link">İçeriğe geç</a>
    <aside className="admin-sidebar" aria-label="Yönetim gezinmesi">{navigation()}</aside>
    <div className="admin-main-column">
      <header className="admin-topbar">
        <div className="admin-breadcrumb">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild><Button variant="ghost" size="icon" className="admin-mobile-trigger" aria-label="Yönetim menüsünü aç"><Menu /></Button></SheetTrigger>
            <SheetContent side="left" className="admin-signature admin-mobile-sidebar">
              <SheetHeader className="sr-only"><SheetTitle>Yönetim menüsü</SheetTitle><SheetDescription>Yetkiniz olan Talepo yönetim sayfaları.</SheetDescription></SheetHeader>
              {navigation()}
            </SheetContent>
          </Sheet>
          <Link href="/admin">Yönetim</Link><ChevronRight size={14} aria-hidden="true" /><span>{title}</span>
        </div>
        <div className="admin-topbar-actions">
          <Button asChild variant="ghost" size="sm" className="admin-notes-link"><Link href="/admin/notlar"><StickyNote />İç notlar</Link></Button>
          <Badge variant="secondary" className="admin-header-role">{adminRoleLabels[role]}</Badge>
          <span className="admin-avatar" title={name || "Talepo yöneticisi"} aria-label={name || "Talepo yöneticisi"}>{initials}</span>
        </div>
      </header>
      <main id="admin-main" tabIndex={-1} className="admin-content">{children}</main>
      <footer className="admin-page-footer"><ShieldCheck size={14} />Yönetim işlemleri oturumunuz ve yetkileriniz kapsamında doğrulanır.<span>Talepo yönetim merkezi</span></footer>
    </div>
  </div>;
}
