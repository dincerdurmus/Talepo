/**
 * KANIT KOŞUMU İÇİN KENDİ DEV SUNUCUSU (2026-09-25).
 *
 * NEDEN VAR. Aynı depoda ikinci bir oturum çalışırken `next dev` iki şeyi
 * paylaşamaz: portu ve `.next/dev` çıktı klasörünü (orada pid + port taşıyan
 * bir kilit durur). Bu betik kendi portunu ve KENDİ çıktı klasörünü açar
 * (`NEXT_QA_DIST_DIR`), böylece başkasının sunucusuna dokunmadan tarayıcı
 * kanıtı üretilebilir.
 *
 * SINIR. Başka hiçbir süreci durdurmaz, kilit dosyası silmez, port taramaz.
 * Açtığı tek şey kendi çocuk sürecidir; kendisi kapatıldığında onu da
 * kapatır.
 *
 * Koşum:  node scripts/qa-dev-server-v1.cjs [port] [distDir]
 */
const { spawn } = require("child_process");
const path = require("path");

const port = process.argv[2] || "3221";
const distDir = process.argv[3] || ".next-qa";
const root = path.join(__dirname, "..");

const child = spawn(
  process.execPath,
  [path.join(root, "node_modules", "next", "dist", "bin", "next"), "dev", "-p", port],
  {
    cwd: root,
    env: { ...process.env, NEXT_QA_DIST_DIR: distDir },
    stdio: "inherit",
  },
);

console.log(`QA DEV SERVER pid=${child.pid} port=${port} distDir=${distDir}`);

const stop = () => {
  try {
    child.kill();
  } catch {
    /* zaten kapalı */
  }
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("exit", stop);

child.on("exit", (code) => process.exit(code ?? 0));
