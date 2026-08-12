/**
 * Canonical Actor × Resource × Action matrix — must stay aligned with server gates.
 */

export type AuthzActor =
  | "anonymous"
  | "buyer"
  | "seller"
  | "professional"
  | "company_member"
  | "company_manager"
  | "company_admin_owner"
  | "system";

export type AuthzResource =
  | "request"
  | "offer"
  | "conversation"
  | "message"
  | "opportunity"
  | "saved_search"
  | "alert_rule"
  | "inventory"
  | "team"
  | "entitlement";

export type AuthzAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "publish"
  | "submit"
  | "accept"
  | "assign"
  | "import"
  | "manage";

export type AuthzRule = {
  actor: AuthzActor;
  resource: AuthzResource;
  action: AuthzAction;
  condition: string;
  enforcedBy: string;
};

export const AUTHORIZATION_MATRIX: AuthzRule[] = [
  {
    actor: "buyer",
    resource: "request",
    action: "publish",
    condition: "authenticated; own create path",
    enforcedBy: "POST /api/requests + createRequest + requireUser",
  },
  {
    actor: "buyer",
    resource: "request",
    action: "update",
    condition: "createdById === userId",
    enforcedBy: "request mutation routes / panel ownership filters",
  },
  {
    actor: "buyer",
    resource: "offer",
    action: "accept",
    condition: "request.createdById === userId; offer status SUBMITTED|VIEWED",
    enforcedBy: "acceptOffer",
  },
  {
    actor: "seller",
    resource: "offer",
    action: "submit",
    condition: "entitlement submit_offer + quota; not own request",
    enforcedBy: "createOffer + assertCanSubmitOffer",
  },
  {
    actor: "company_member",
    resource: "opportunity",
    action: "read",
    condition: "ACTIVE membership for companyId; feature lead_distribution / discovery",
    enforcedBy: "requireCompanyFeature + companyId from membership not body alone",
  },
  {
    actor: "company_manager",
    resource: "opportunity",
    action: "assign",
    condition: "role OWNER|ADMIN|MANAGER",
    enforcedBy: "canAssignOpportunities + opportunities API",
  },
  {
    actor: "company_admin_owner",
    resource: "team",
    action: "manage",
    condition: "OWNER|ADMIN",
    enforcedBy: "company team APIs / membership roles",
  },
  {
    actor: "company_member",
    resource: "inventory",
    action: "import",
    condition: "company feature + membership",
    enforcedBy: "inventory import API + requireCompanyFeature",
  },
  {
    actor: "professional",
    resource: "saved_search",
    action: "create",
    condition: "authenticated entitlement for monetization features",
    enforcedBy: "saved-searches API + entitlements",
  },
  {
    actor: "professional",
    resource: "alert_rule",
    action: "create",
    condition: "authenticated; company scope when corporate",
    enforcedBy: "alerts API",
  },
  {
    actor: "anonymous",
    resource: "request",
    action: "read",
    condition: "public surfaces only; mutations denied",
    enforcedBy: "requireUser on mutating APIs",
  },
];
