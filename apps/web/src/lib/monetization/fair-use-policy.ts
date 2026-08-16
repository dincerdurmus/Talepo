export type FairUseScope = "USER" | "WORKSPACE";
export const INTELLIGENCE_UNIT_WEIGHTS = { opportunity: 1, price: 5, offerCopilot: 3, followUp: 1, providerQuery: 8 } as const;
export const FAIR_USE_POLICIES = {
  PERSONAL_PRO: { policyKey: "PERSONAL_PRO_V1", scope: "USER" as const, window: "MONTH", softLimit: 100, hardLimit: 160 },
  WORKSPACE_PRO: { policyKey: "WORKSPACE_PRO_V1", scope: "WORKSPACE" as const, window: "MONTH", softLimit: 500, hardLimit: 800 },
} as const;
export function intelligenceUnits(action: keyof typeof INTELLIGENCE_UNIT_WEIGHTS, count = 1) { return INTELLIGENCE_UNIT_WEIGHTS[action] * count; }
