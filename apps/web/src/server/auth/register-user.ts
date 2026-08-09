import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

export class RegisterValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegisterValidationError";
  }
}

export type RegisterUserInput = {
  name: string;
  email: string;
  phone?: string | null;
  password: string;
  confirmPassword: string;
};

export async function registerUserWithPassword(input: RegisterUserInput) {
  const name = input.name.trim().slice(0, 120);
  const email = input.email.trim().toLowerCase().slice(0, 160);
  const phone = input.phone?.trim().slice(0, 40) || null;
  const password = input.password;
  const confirmPassword = input.confirmPassword;

  if (name.length < 2) {
    throw new RegisterValidationError("Ad soyad en az 2 karakter olmalı.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new RegisterValidationError("Geçerli bir e-posta girin.");
  }

  const strengthError = validatePasswordStrength(password);
  if (strengthError) {
    throw new RegisterValidationError(strengthError);
  }

  if (password !== confirmPassword) {
    throw new RegisterValidationError("Şifreler eşleşmiyor.");
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  if (existing?.passwordHash) {
    throw new RegisterValidationError(
      "Bu e-posta ile zaten hesap var. Giriş yapın.",
    );
  }

  if (existing && !existing.passwordHash) {
    throw new RegisterValidationError(
      "Bu e-posta Google veya sosyal girişle kayıtlı. O yöntemle giriş yapın.",
    );
  }

  const passwordHash = hashPassword(password);
  const now = new Date();

  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      passwordHash,
      lastLoginAt: now,
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  return user;
}
