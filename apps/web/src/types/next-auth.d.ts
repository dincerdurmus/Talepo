import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      platformRole: "USER" | "SUPPORT" | "MODERATOR" | "ANALYST" | "ADMIN" | "SUPER_ADMIN";
    };
    dbUnavailable?: boolean;
    platformRole?: "USER" | "SUPPORT" | "MODERATOR" | "ANALYST" | "ADMIN" | "SUPER_ADMIN";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub: string;
    dbUnavailable?: boolean;
    /**
     * Şifre dönemi parmak izi (2026-09-15). Yalnız şifreyle giriş yapılmış
     * oturumlarda bulunur. Şifre değiştiğinde veritabanındaki değerle
     * uyuşmaz ve oturum geçersizleşir. Ham şifre özeti DEĞİLDİR.
     */
    pwe?: string;
    /** Şifre değiştiği için geçersizleşmiş oturum işareti. */
    revoked?: boolean;
  }
}
