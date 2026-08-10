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

export type AuthenticatedUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  membershipNumber: string | null;
  dbUnavailable: boolean;
};

export async function requireUser(options?: {
  allowDbUnavailable?: boolean;
}): Promise<AuthenticatedUser> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const email = session?.user?.email;

  if (!userId && !email) {
    throw new AuthenticationError();
  }

  const resolved = await resolveSessionUser(userId ?? email ?? "", email, {
    name: session?.user?.name,
    image: session?.user?.image,
  });

  if (!resolved) {
    throw new AuthenticationError("Oturuma bağlı kullanıcı bulunamadı.");
  }

  if (resolved.dbUnavailable && !options?.allowDbUnavailable) {
    throw new DatabaseUnavailableError();
  }

  return {
    ...resolved.user,
    membershipNumber: resolved.user.membershipNumber ?? null,
    dbUnavailable: resolved.dbUnavailable,
  };
}
