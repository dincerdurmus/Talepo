import { prisma } from "@/lib/prisma";

export class CompanyUpdateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompanyUpdateError";
  }
}

export type UpdateCompanyInput = {
  name?: string | null;
  legalName?: string | null;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  taxNumber?: string | null;
  taxOffice?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
};

function cleanText(value: string | null | undefined, max: number) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function cleanImageDataUrl(
  value: string | null | undefined,
  maxChars: number,
  label: string,
) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const trimmed = value.trim();
  if (
    !trimmed.startsWith("data:image/jpeg") &&
    !trimmed.startsWith("data:image/png") &&
    !trimmed.startsWith("data:image/webp") &&
    !trimmed.startsWith("http://") &&
    !trimmed.startsWith("https://") &&
    !trimmed.startsWith("/uploads/")
  ) {
    throw new CompanyUpdateError(
      `${label} için geçerli bir görsel yükleyin (JPEG, PNG veya WebP).`,
    );
  }

  if (trimmed.length > maxChars) {
    throw new CompanyUpdateError(
      `${label} çok büyük. Daha küçük bir görsel seçin.`,
    );
  }

  return trimmed;
}

export async function updateCompanyProfile(
  companyId: string,
  input: UpdateCompanyInput,
) {
  const name = cleanText(input.name, 120);
  if (name !== undefined && (!name || name.length < 2)) {
    throw new CompanyUpdateError("Firma adı en az 2 karakter olmalı.");
  }

  const data = {
    ...(name !== undefined ? { name } : {}),
    ...(input.legalName !== undefined
      ? { legalName: cleanText(input.legalName, 160) }
      : {}),
    ...(input.description !== undefined
      ? { description: cleanText(input.description, 2000) }
      : {}),
    ...(input.phone !== undefined ? { phone: cleanText(input.phone, 40) } : {}),
    ...(input.email !== undefined
      ? { email: cleanText(input.email, 120)?.toLowerCase() ?? null }
      : {}),
    ...(input.websiteUrl !== undefined
      ? { websiteUrl: cleanText(input.websiteUrl, 240) }
      : {}),
    ...(input.city !== undefined ? { city: cleanText(input.city, 80) } : {}),
    ...(input.district !== undefined
      ? { district: cleanText(input.district, 80) }
      : {}),
    ...(input.address !== undefined
      ? { address: cleanText(input.address, 400) }
      : {}),
    ...(input.taxNumber !== undefined
      ? { taxNumber: cleanText(input.taxNumber, 32) }
      : {}),
    ...(input.taxOffice !== undefined
      ? { taxOffice: cleanText(input.taxOffice, 80) }
      : {}),
    ...(input.logoUrl !== undefined
      ? { logoUrl: cleanImageDataUrl(input.logoUrl, 450_000, "Logo") }
      : {}),
    ...(input.coverUrl !== undefined
      ? { coverUrl: cleanImageDataUrl(input.coverUrl, 900_000, "Kapak") }
      : {}),
  };

  return prisma.company.update({
    where: { id: companyId },
    data,
    select: {
      id: true,
      name: true,
      legalName: true,
      description: true,
      phone: true,
      email: true,
      websiteUrl: true,
      city: true,
      district: true,
      address: true,
      taxNumber: true,
      taxOffice: true,
      logoUrl: true,
      coverUrl: true,
    },
  });
}
