import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  /**
   * MairaStage LOCKED_WIP'tir (kurucu kararı) — kaynağına lint yorumu bile
   * eklenmez. Bu dosya-bazlı istisna kilit kalkınca kaldırılır; Maira
   * dosyasına dokunmadan lint hatası sıfırlanır.
   */
  {
    files: ["src/components/request/maira/MairaStage.tsx"],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  /**
   * Sunucu bileşenlerinde erişim-hatası eşlemesi try/catch içinde JSX döner
   * (PublicProfileAccessError → nazik ekran). Bu RSC deseni istemci
   * error-boundary kuralının kapsamı dışındadır; kural yalnız bu iki
   * sayfada, belgeli olarak kapatılır.
   */
  {
    files: [
      "src/app/panel/firma-profil/\\[id\\]/page.tsx",
      "src/app/panel/profil/\\[userId\\]/page.tsx",
    ],
    rules: { "react-hooks/error-boundaries": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
