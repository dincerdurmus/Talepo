import {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

export class ChangePasswordError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "ChangePasswordError";
  }
}

export async function changeUserPassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const currentPassword = input.currentPassword;
  const newPassword = input.newPassword;
  const confirmPassword = input.confirmPassword;

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new ChangePasswordError("Tüm alanları doldurun.");
  }

  if (newPassword !== confirmPassword) {
    throw new ChangePasswordError("Yeni şifreler eşleşmiyor.");
  }

  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) {
    throw new ChangePasswordError(strengthError);
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { passwordHash: true },
  });

  if (!user?.passwordHash) {
    throw new ChangePasswordError(
      "Bu hesap şifre ile giriş kullanmıyor.",
      403,
    );
  }

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    throw new ChangePasswordError("Mevcut şifre hatalı.");
  }

  if (verifyPassword(newPassword, user.passwordHash)) {
    throw new ChangePasswordError("Yeni şifre mevcut şifreden farklı olmalı.");
  }

  await prisma.user.update({
    where: { id: input.userId },
    data: { passwordHash: hashPassword(newPassword) },
    select: { id: true },
  });

  return { requiresReLogin: true as const };
}
