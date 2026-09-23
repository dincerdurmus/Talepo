import { hasAdminPermission, type AdminPermission, type PlatformRole } from "@/lib/auth/platform-admin";

export type AdminNavigationItem = {
  href: string;
  label: string;
  icon: "overview" | "users" | "companies" | "requests" | "offers" | "categories" | "operations" | "health" | "notifications" | "curation" | "notes";
  group: "Platform" | "Operasyon";
  permission: AdminPermission;
};

const navigation: AdminNavigationItem[] = [
  { href: "/admin", label: "Genel bakış", icon: "overview", group: "Platform", permission: "admin.view" },
  { href: "/admin/users", label: "Kullanıcılar", icon: "users", group: "Platform", permission: "users.view" },
  { href: "/admin/companies", label: "Firmalar", icon: "companies", group: "Platform", permission: "analytics.view" },
  { href: "/admin/requests", label: "Talepler", icon: "requests", group: "Platform", permission: "requests.view" },
  { href: "/admin/offers", label: "Teklifler", icon: "offers", group: "Platform", permission: "offers.view" },
  { href: "/admin#categories", label: "Kategoriler", icon: "categories", group: "Platform", permission: "categories.manage" },
  { href: "/admin#operations", label: "Operasyon merkezi", icon: "operations", group: "Operasyon", permission: "admin.view" },
  { href: "/admin/health", label: "Platform sağlığı", icon: "health", group: "Operasyon", permission: "analytics.view" },
  { href: "/admin/notifications", label: "Bildirim akışı", icon: "notifications", group: "Operasyon", permission: "analytics.view" },
  { href: "/admin/curation", label: "Varlık kürasyonu", icon: "curation", group: "Operasyon", permission: "analytics.view" },
  { href: "/admin/notlar", label: "İç notlar", icon: "notes", group: "Operasyon", permission: "admin.view" },
];

// Visibility follows the existing page gates. The server remains authoritative.
export function getAdminNavigation(role: PlatformRole) {
  return navigation.filter((item) => hasAdminPermission(role, item.permission));
}

export const adminRoleLabels: Record<PlatformRole, string> = {
  USER: "Kullanıcı", SUPPORT: "Destek", MODERATOR: "Moderatör", ANALYST: "Analist", ADMIN: "Yönetici", SUPER_ADMIN: "Süper yönetici",
};
