import { prisma } from "@/lib/prisma";

import { slugifyCompanyName } from "./slug";
import {
  normalizeCategorySlugs,
  syncCompanyCategories,
} from "./sync-company-categories";

export type CreateCompanyInput = {
  userId: string;
  name: string;
  city?: string | null;
  taxNumber?: string | null;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  categorySlugs?: string[];
};

export class CompanyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompanyValidationError";
  }
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugifyCompanyName(name);
  let candidate = base;
  let attempt = 0;

  while (attempt < 20) {
    const existing = await prisma.company.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    attempt += 1;
    candidate = `${base}-${attempt + 1}`.slice(0, 56);
  }

  return `${base}-${Date.now().toString(36)}`.slice(0, 56);
}

/**
 * Create a company and attach the creator as OWNER + ACTIVE member.
 * Defaults: STANDARD plan, ACTIVE status (usable immediately, unverified).
 */
export async function createCompanyForUser(input: CreateCompanyInput) {
  const name = input.name.trim().slice(0, 120);
  if (name.length < 2) {
    throw new CompanyValidationError("Firma adı en az 2 karakter olmalı.");
  }

  const city = input.city?.trim().slice(0, 80) || null;
  const taxNumber = input.taxNumber?.trim().slice(0, 32) || null;
  const description = input.description?.trim().slice(0, 2000) || null;
  const phone = input.phone?.trim().slice(0, 40) || null;
  const email = input.email?.trim().toLowerCase().slice(0, 120) || null;
  const slug = await uniqueSlug(name);
  const now = new Date();
  const categorySlugs = normalizeCategorySlugs(input.categorySlugs);

  const company = await prisma.$transaction(async (tx) => {
    return tx.company.create({
      data: {
        name,
        slug,
        city,
        taxNumber,
        description,
        phone,
        email,
        status: "ACTIVE",
        isVerified: false,
        planTier: "STANDARD",
        planExpiresAt: null,
        bonusOfferCredits: 0,
        createdById: input.userId,
        members: {
          create: {
            userId: input.userId,
            role: "OWNER",
            status: "ACTIVE",
            invitedAt: now,
            joinedAt: now,
          },
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        taxNumber: true,
        planTier: true,
        status: true,
      },
    });
  });

  if (categorySlugs.length > 0) {
    await syncCompanyCategories(company.id, categorySlugs);
  }

  return company;
}
