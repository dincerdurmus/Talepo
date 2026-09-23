import Link from "next/link";
import { ArrowRight, ArrowUpRight, Building2, ChevronRight, FileText, FolderTree, HandCoins, ShieldCheck, StickyNote, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminActivityChart } from "@/components/admin/AdminActivityChart";
import { hasAdminPermission, type PlatformRole } from "@/lib/auth/platform-admin";

type Counts = { userCount: number; companyCount: number; requestCount: number; offerCount: number };

export function AdminOverview({ name, role, counts, dateLabel }: { name: string | null; role: PlatformRole; counts: Counts; dateLabel: string }) {
  const analytics = hasAdminPermission(role, "analytics.view");
  return <>
    <div className="admin-heading">
      <div><p className="admin-kicker">Talepo yönetim merkezi</p><h1>Platforma <span>genel bakış.</span></h1><p>Hoş geldin{name ? `, ${name.split(" ")[0]}` : ""}. Platform hareketleri ve yönetim araçları bir arada.</p></div>
      <div className="admin-heading-actions"><span className="admin-date">{dateLabel}</span><Button asChild size="sm"><Link href="/admin/requests">Talepleri incele<ArrowUpRight /></Link></Button></div>
    </div>
    <section className="admin-metrics" aria-label="Platform toplamları">
      {hasAdminPermission(role, "users.view") && <Metric href="/admin/users" icon={Users} label="Toplam kullanıcı" value={counts.userCount} primary />}
      {analytics && <Metric href="/admin/companies" icon={Building2} label="Kayıtlı firma" value={counts.companyCount} />}
      {hasAdminPermission(role, "requests.view") && <Metric href="/admin/requests" icon={FileText} label="Toplam talep" value={counts.requestCount} />}
      {hasAdminPermission(role, "offers.view") && <Metric href="/admin/offers" icon={HandCoins} label="Toplam teklif" value={counts.offerCount} />}
    </section>
    <div className="admin-overview-grid" data-chart={analytics}>
      {analytics && <AdminActivityChart />}
      <Card className="admin-panel">
        <div className="admin-panel-heading"><div><h2>Yönetim araçları</h2><p>Günlük işlemlerine hızlıca ulaş</p></div><ArrowUpRight size={17} className="text-primary" /></div>
        <div className="admin-shortcuts">
          {hasAdminPermission(role, "moderation.view") ? <Shortcut href="/admin#operations" icon={ShieldCheck} label="Moderasyon ve operasyon" description="Vakalar ve yönetim işlemleri" /> : analytics ? <Shortcut href="/admin/health" icon={ShieldCheck} label="Platform sağlığı" description="Metrikler ve uyarılar" /> : null}
          {hasAdminPermission(role, "categories.manage") ? <Shortcut href="/admin#categories" icon={FolderTree} label="Kategori yönetimi" description="Kategoriler ve yayın durumları" /> : <Shortcut href="/admin/requests" icon={FileText} label="Talep kayıtları" description="Talep ve teklif özetleri" />}
          <Shortcut href="/admin/notlar" icon={StickyNote} label="İç notlar" description="Size açılan notlar ve ekip iletişimi" />
          {hasAdminPermission(role, "users.view") && <Shortcut href="/admin#memberships" icon={Users} label="Üyelik yönetimi" description="Kullanıcı kayıtları ve yetkiler" />}
        </div>
      </Card>
    </div>
  </>;
}

function Metric({ href, icon: Icon, label, value, primary = false }: { href: string; icon: typeof Users; label: string; value: number; primary?: boolean }) {
  return <Link href={href} prefetch={false}><Card className={`admin-metric${primary ? " admin-metric-primary" : ""}`}>
    <div className="admin-metric-label"><span>{label}</span><span className="admin-metric-icon"><Icon size={17} /></span></div>
    <strong className="admin-metric-value">{value.toLocaleString("tr-TR")}</strong>
    <div className="admin-metric-foot"><span>Kayıtları görüntüle</span><ArrowRight size={14} /></div>
  </Card></Link>;
}

function Shortcut({ href, icon: Icon, label, description }: { href: string; icon: typeof Users; label: string; description: string }) {
  return <Link className="admin-shortcut" href={href} prefetch={false}><span><Icon size={18} /></span><span><strong>{label}</strong><small>{description}</small></span><ChevronRight size={15} /></Link>;
}
