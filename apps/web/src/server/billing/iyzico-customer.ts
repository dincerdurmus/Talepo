import { prisma } from "@/lib/prisma";
import { BillingError, BillingErrorCode } from "@/lib/billing/errors";
import type { BillingSubjectRef } from "@/lib/billing/types";

export type IyzicoCheckoutCustomer = {
  name: string;
  surname: string;
  email: string;
  gsmNumber: string;
  identityNumber: string;
  billingAddress: {
    address: string;
    contactName: string;
    city: string;
    country: string;
    zipCode?: string;
  };
  buyerId: string;
  ip?: string;
  registrationAddress: string;
  city: string;
  country: string;
};

/**
 * Build minimum iyzico customer payload from Talepo profile.
 * Never invents identity/phone/address — incomplete ⇒ CHECKOUT_PROFILE_INCOMPLETE.
 *
 * COMPANY: taxNumber may satisfy identityNumber.
 * USER: identityNumber not in schema yet — checkout fails until profile/tax path exists.
 */
export async function buildIyzicoCheckoutCustomer(input: {
  actorUserId: string;
  subject: BillingSubjectRef;
  clientIp?: string | null;
}): Promise<IyzicoCheckoutCustomer> {
  const user = await prisma.user.findUnique({
    where: { id: input.actorUserId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      city: true,
      country: true,
      district: true,
    },
  });

  if (!user?.email) {
    throw new BillingError({
      code: BillingErrorCode.CHECKOUT_PROFILE_INCOMPLETE,
      userMessage:
        "Ödeme için profilinizde doğrulanmış e-posta gereklidir.",
      diagnostic: "missing_email",
    });
  }

  const missing: string[] = [];
  const fullName = (user.name ?? "").trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const name = nameParts[0] ?? "";
  const surname = nameParts.slice(1).join(" ") || nameParts[0] || "";
  if (!name || !surname) missing.push("name");

  let gsmNumber = normalizeGsm(user.phone);
  let identityNumber = "";
  let address = "";
  let city = user.city?.trim() || "";
  let country = user.country?.trim() || "Turkey";
  let zipCode: string | undefined;
  let contactName = fullName || name;

  if (input.subject.type === "COMPANY") {
    const company = await prisma.company.findUnique({
      where: { id: input.subject.id },
      select: {
        name: true,
        phone: true,
        taxNumber: true,
        address: true,
        city: true,
        country: true,
        postalCode: true,
      },
    });
    if (!company) {
      throw new BillingError({
        code: BillingErrorCode.CHECKOUT_PROFILE_INCOMPLETE,
        userMessage: "Şirket profili bulunamadı.",
      });
    }
    identityNumber = (company.taxNumber ?? "").replace(/\D/g, "");
    address = (company.address ?? "").trim();
    city = (company.city ?? city).trim();
    country = (company.country ?? country).trim() || "Turkey";
    zipCode = company.postalCode?.trim() || undefined;
    contactName = company.name || contactName;
    if (!gsmNumber) {
      gsmNumber = normalizeGsm(company.phone);
    }
  } else {
    address = [user.district, user.city].filter(Boolean).join(", ");
    // No national ID field on User — do not invent.
    identityNumber = "";
  }

  if (!gsmNumber) missing.push("phone");
  if (!identityNumber || identityNumber.length < 10) missing.push("identityNumber");
  if (!address) missing.push("address");
  if (!city) missing.push("city");

  if (missing.length > 0 || !gsmNumber) {
    throw new BillingError({
      code: BillingErrorCode.CHECKOUT_PROFILE_INCOMPLETE,
      userMessage:
        "Ödeme için fatura bilgileri eksik. Telefon, kimlik/vergi no ve adres gereklidir.",
      diagnostic: `missing:${missing.join(",") || "phone"}`,
    });
  }

  const countryOut =
    country === "Türkiye" || country.toLowerCase() === "turkiye"
      ? "Turkey"
      : country;

  return {
    name,
    surname: surname || name,
    email: user.email,
    gsmNumber,
    identityNumber,
    billingAddress: {
      address,
      contactName,
      city,
      country: countryOut,
      zipCode,
    },
    buyerId: input.subject.id,
    ip: input.clientIp ?? undefined,
    registrationAddress: address,
    city,
    country: countryOut,
  };
}

function normalizeGsm(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.startsWith("90") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+9${digits}`;
  if (digits.length === 10) return `+90${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}
