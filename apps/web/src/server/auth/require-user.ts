import { getServerSession } from "next-auth";

import { authOptions } from "@/auth";
import { resolveSessionUser } from "@/lib/auth/sync-google-user";

export class AuthenticationError extends Error {
  constructor(message = "Bu işlem için giriş yapmanız gerekiyor.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class DatabaseUnavailableError extends Error {
  constructor(
    message = "Veritabanına bağlanılamıyor. Supabase projenizin aktif olduğundan emin olun.",
  ) {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

export async function requireUser(options?: { allowDbUnavailable?: boolean }) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const email = session?.user?.email;

  if (!userId && !email) {
    throw new AuthenticationError();
  }

  const resolved = await resolveSessionUser(userId ?? email ?? "", email);

  if (!resolved) {
    throw new AuthenticationError("Oturuma bağlı kullanıcı bulunamadı.");
  }

  if (resolved.dbUnavailable && !options?.allowDbUnavailable) {
    throw new DatabaseUnavailableError();
  }

  return resolved.user;
}
