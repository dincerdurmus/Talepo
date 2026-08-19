export function calculateProfileCompletion(input: {
  name?: string | null;
  biography?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  image?: string | null;
}): number {
  const checks = [
    Boolean(input.name?.trim()),
    Boolean(input.biography?.trim()),
    Boolean(input.city?.trim()),
    Boolean(input.country?.trim()),
    Boolean(input.phone?.trim()),
    Boolean(input.image?.trim()),
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}
