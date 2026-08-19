export type PlatformRole = "USER" | "SUPPORT" | "MODERATOR" | "ANALYST" | "ADMIN" | "SUPER_ADMIN";
export type AdminPermission = "admin.view" | "users.view" | "users.manage" | "roles.manage" | "roles.manage.limited" | "billing.view" | "billing.manage" | "companies.manage" | "moderation.view" | "moderation.manage" | "analytics.view" | "audit.view" | "sensitive.view" | "requests.view" | "offers.view";

const PERMISSIONS: Record<PlatformRole, readonly AdminPermission[]> = {
  USER: [],
  SUPPORT: ["admin.view", "users.view", "moderation.view", "moderation.manage", "offers.view", "billing.view"],
  MODERATOR: ["admin.view", "users.view", "companies.manage", "moderation.view", "moderation.manage", "analytics.view"],
  ANALYST: ["admin.view", "users.view", "analytics.view", "requests.view", "offers.view", "billing.view"],
  ADMIN: ["admin.view", "users.view", "users.manage", "roles.manage.limited", "companies.manage", "moderation.view", "moderation.manage", "analytics.view", "requests.view", "offers.view", "billing.view", "billing.manage", "sensitive.view"],
  SUPER_ADMIN: ["admin.view", "users.view", "users.manage", "roles.manage", "companies.manage", "billing.manage", "billing.view", "moderation.view", "moderation.manage", "analytics.view", "audit.view", "sensitive.view", "requests.view", "offers.view"],
};

export function isPlatformAdminRole(role: PlatformRole | null | undefined) { return Boolean(role && role !== "USER"); }
export function hasAdminPermission(role: PlatformRole, permission: AdminPermission) { return PERMISSIONS[role].includes(permission); }
export function adminPermissions(role: PlatformRole) { return [...PERMISSIONS[role]]; }
