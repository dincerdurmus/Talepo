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
  }
}
