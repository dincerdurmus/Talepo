/** Minimum company profile signals for meaningful smart matching. */
export type CompanyProfileReadiness = {
  ready: boolean;
  missing: string[];
};

export function assessCompanyProfileReadiness(input: {
  city: string | null;
  description: string | null;
  categoryCount: number;
}): CompanyProfileReadiness {
  const missing: string[] = [];

  if (input.categoryCount === 0) missing.push("hizmet kategorileri");
  if (!input.city?.trim()) missing.push("şehir");
  if (!input.description?.trim()) missing.push("firma açıklaması");

  return { ready: missing.length === 0, missing };
}
