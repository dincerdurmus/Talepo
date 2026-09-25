import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  /**
   * İKİNCİ BİR DEV SUNUCUSU AYNI ÇIKTI KLASÖRÜNÜ PAYLAŞMAZ (2026-09-25).
   *
   * `next dev` çıktısını `.next/dev` altına yazar ve oraya bir kilit koyar
   * (pid + port). Aynı depoda ikinci bir oturum kanıt için kendi sunucusunu
   * açmak istediğinde ya kilide takılıyor ya da çalışan sunucunun derleme
   * çıktısına giriyordu. Değişken VERİLMEZSE davranış aynıdır (`.next`);
   * yalnız QA koşumları kendi klasörünü ister.
   */
  distDir: process.env.NEXT_QA_DIST_DIR || ".next",
  // Include monorepo data/ JSON in production traces. Do not set
  // turbopack.root to the repo root — that breaks apps/web node_modules
  // resolution (lucide-react MODULE_NOT_FOUND in `next dev`).
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
