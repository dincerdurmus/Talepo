/** Shared acceptance persona identifiers — safe to import from seed/verify scripts. */
export const ACCEPTANCE_MARKER = "acceptance:v1";

export const ACCEPTANCE_COMPANY = {
  name: "Talepo Acceptance Corp",
  slug: "talepo-acceptance-corp-v1",
} as const;

/** Test-only password for browser/API login in staging. Never use in production. */
export const ACCEPTANCE_TEST_PASSWORD = "AcceptanceV1!test";

export type PersonaKey = "A" | "B" | "C" | "D" | "E" | "F";

export type PersonaSpec = {
  key: PersonaKey;
  label: string;
  email: `acceptance-v1-${Lowercase<PersonaKey>}@talepo.test`;
  membershipNumber: string;
  planTier: "STANDARD" | "PREMIUM" | "PROFESSIONAL";
};

export const PERSONAS: Record<PersonaKey, PersonaSpec> = {
  A: {
    key: "A",
    label: "Standard Buyer",
    email: "acceptance-v1-a@talepo.test",
    membershipNumber: "TLP-990001",
    planTier: "STANDARD",
  },
  B: {
    key: "B",
    label: "Premium",
    email: "acceptance-v1-b@talepo.test",
    membershipNumber: "TLP-990002",
    planTier: "PREMIUM",
  },
  C: {
    key: "C",
    label: "Professional",
    email: "acceptance-v1-c@talepo.test",
    membershipNumber: "TLP-990003",
    planTier: "PROFESSIONAL",
  },
  D: {
    key: "D",
    label: "Corporate Owner",
    email: "acceptance-v1-d@talepo.test",
    membershipNumber: "TLP-990004",
    planTier: "STANDARD",
  },
  E: {
    key: "E",
    label: "Corporate Member",
    email: "acceptance-v1-e@talepo.test",
    membershipNumber: "TLP-990005",
    planTier: "STANDARD",
  },
  F: {
    key: "F",
    label: "External",
    email: "acceptance-v1-f@talepo.test",
    membershipNumber: "TLP-990006",
    planTier: "STANDARD",
  },
};

export const BLOCKED_PRIMARY_PROJECT_REF = "jgfwofiygnsylaclykkb";
export const TARGET_PROJECT_REF = "cpeoiqppesacjlyrszrl";
