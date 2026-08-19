export type AccountAuthMethod = {
  hasPassword: boolean;
  oauthProviders: string[];
  primaryLabel: "E-posta ve şifre" | "Google" | "Google ve şifre";
};

export function resolveAccountAuthMethod(input: {
  passwordHash: string | null;
  accounts: Array<{ provider: string }>;
}): AccountAuthMethod {
  const hasPassword = Boolean(input.passwordHash);
  const oauthProviders = [
    ...new Set(
      input.accounts
        .map((row) => row.provider.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];

  let primaryLabel: AccountAuthMethod["primaryLabel"] = "E-posta ve şifre";
  if (oauthProviders.includes("google") && hasPassword) {
    primaryLabel = "Google ve şifre";
  } else if (oauthProviders.includes("google")) {
    primaryLabel = "Google";
  }

  return { hasPassword, oauthProviders, primaryLabel };
}
