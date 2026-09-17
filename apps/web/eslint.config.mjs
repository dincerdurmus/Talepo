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
  /**
   * `scripts/probe-*.ts` tek seferlik ÖLÇÜM ARAÇLARIDIR: bir soruyu cevaplamak
   * için yazılır, cevabı rapora geçer, bir daha çalıştırılmaz. Kural motorundan
   * dönen tipsiz JSON'u okurlar; onlara ürün tipi uydurmak ölçümü değil yalnız
   * lint'i memnun eder. `verify-*` ayrıdır — onlar kapıdır ve standarda tabidir.
   */
  {
    files: ["scripts/probe-*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    /**
     * `public/` tarayıcıya olduğu gibi servis edilen statik dosyalardır;
     * kaynak kodu değildir. Altındaki iki JS (Google Draco'nun emscripten
     * çıktısı: draco_decoder.js, draco_wasm_wrapper.js) üçüncü taraf üretimi
     * ve elle düzenlenmez — `require()`, `this` alias'ı ve ölü değişkenler
     * emscripten'in kendi çıktı biçimidir, bizim kusurumuz değil.
     *
     * Ölçüldü (2026-09-16): CI'daki `Doğrulama` iş akışı kurulduğu günden
     * beri HER koşuda bu dosyalar yüzünden kırmızıydı (#1 ve #2, ikisi de).
     * Yerelde `eslint` kapsamlı koşturulduğu için görülmüyordu. Kırmızı kalan
     * bir kapı kapı değildir: batarya adımına hiç sıra gelmiyordu.
     */
    "public/**",
  ]),
]);

export default eslintConfig;
