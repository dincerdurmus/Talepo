import { prisma } from "@/lib/prisma";

export const MEMBERSHIP_NUMBER_PREFIX = "TLP";

const MEMBERSHIP_NUMBER_PATTERN = /^TLP-\d{5,8}$/;

export function formatMembershipNumber(seq: number): string {
  return `${MEMBERSHIP_NUMBER_PREFIX}-${seq}`;
}

/** Kullanıcı girdisini TLP-123456 formatına çevirir; geçersizse null. */
export function normalizeMembershipNumberInput(input: string): string | null {
  const trimmed = input.trim().toUpperCase();

  if (MEMBERSHIP_NUMBER_PATTERN.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{5,8}$/.test(trimmed)) {
    const candidate = `${MEMBERSHIP_NUMBER_PREFIX}-${trimmed}`;
    if (MEMBERSHIP_NUMBER_PATTERN.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function isMembershipNumberInput(input: string): boolean {
  return normalizeMembershipNumberInput(input) !== null;
}

export async function allocateMembershipNumber(): Promise<string> {
  const result = await prisma.$queryRaw<{ nextval: bigint }[]>`
    SELECT nextval('"User_membershipNumber_seq"') AS nextval
  `;
  const seq = Number(result[0]?.nextval);
  if (!Number.isFinite(seq) || seq <= 0) {
    throw new Error("Üyelik numarası üretilemedi.");
  }
  return formatMembershipNumber(seq);
}

/** Eski kayıtlar için güvenlik ağı — migration sonrası nadiren gerekir. */
export async function ensureUserMembershipNumber(userId: string): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { membershipNumber: true },
  });

  if (existing?.membershipNumber) {
    return existing.membershipNumber;
  }

  const membershipNumber = await allocateMembershipNumber();
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { membershipNumber },
    select: { membershipNumber: true },
  });

  return updated.membershipNumber;
}
