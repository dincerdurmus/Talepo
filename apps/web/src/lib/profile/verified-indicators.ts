/** Public trust badges — only real verification authority, never plan/phone presence. */

export function buildUserVerifiedIndicators(input: {
  emailVerified: Date | null;
}): string[] {
  const indicators: string[] = [];
  if (input.emailVerified) {
    indicators.push("E-posta doğrulandı");
  }
  return indicators;
}

export function buildCompanyVerifiedIndicators(input: {
  isVerified: boolean;
}): string[] {
  if (!input.isVerified) return [];
  return ["Doğrulanmış firma"];
}
