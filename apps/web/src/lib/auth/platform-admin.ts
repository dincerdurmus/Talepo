export type PlatformRole = "USER" | "SUPPORT" | "MODERATOR" | "ANALYST" | "ADMIN" | "SUPER_ADMIN";
export type AdminPermission = "admin.view" | "users.view" | "users.manage" | "roles.manage" | "billing.manage" | "moderation.view" | "moderation.manage" | "analytics.view" | "audit.view" | "sensitive.view";

const PERMISSIONS: Record<PlatformRole, readonly AdminPermission[]> = {
  USER: [],
  SUPPORT: ["admin.view", "users.view", "moderation.view"],
  MODERATOR: ["admin.view", "users.view", "moderation.view", "moderation.manage"],
  ANALYST: ["admin.view", "analytics.view"],
  ADMIN: ["admin.view", "users.view", "users.manage", "moderation.view", "moderation.manage", "analytics.view"],
  SUPER_ADMIN: ["admin.view", "users.view", "users.manage", "roles.manage", "billing.manage", "moderation.view", "moderation.manage", "analytics.view", "audit.view", "sensitive.view"],
};

export function isPlatformAdminRole(role: PlatformRole | null | undefined) { return Boolean(role && role !== "USER"); }
export function hasAdminPermission(role: PlatformRole, permission: AdminPermission) { return PERMISSIONS[role].includes(permission); }
export function adminPermissions(role: PlatformRole) { return [...PERMISSIONS[role]]; }
