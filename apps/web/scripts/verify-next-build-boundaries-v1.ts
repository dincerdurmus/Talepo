/**
 * NEXT DERLEME SINIRLARI — kalıcı doğrulayıcı (2026-09-16).
 *
 * Neden var (ölçüldü 2026-09-16): `npm run build` bu oturumdan YAPISAL OLARAK
 * koşamıyor. Üç ayrı sebep birden: bulut konteynerinde npm kayıt defteri 403,
 * cihazın Linux VM'inde kayıt defteri hiç erişilemiyor, ve `node_modules`
 * Windows'ta kurulduğu için içinde yalnız `@next/swc-win32-x64-msvc` var —
 * Linux'tan derleme SWC ikilisini indirmeye çalışıp düşüyor. Yani gerçek
 * derleme yalnız Windows'ta (`TALEPO-BUILD.cmd`) ya da GitHub Actions'ta
 * (`.github/workflows/build.yml`, her push'ta) koşar.
 *
 * `tsc --noEmit` bu boşluğu KAPATMAZ. Tip denetimi sunucu/istemci sınırını
 * bilmez: `"use client"` taşıyan bir dosya `prisma`yı ya da `next/headers`ı
 * import ettiğinde tipler geçerlidir, derleme ise düşer. Bu, bu depoda
 * derlemeyi kıran en yaygın sınıftır ve push'tan önce görülmesi gerekir.
 *
 * Bu dosya derlemenin YERİNE geçmez, onun en sık kırıldığı yeri erken
 * yakalar. Yeşil olması "derleme geçer" demek DEĞİLDİR; kırmızı olması
 * "derleme düşer" demektir.
 *
 * Kontroller:
 *   A. `"use client"` dosyaları sunucuya özel modül import etmez
 *      (prisma, server/, next/headers, auth, node: yerleşikleri).
 *   B. `"use client"` yönergesi dosyanın EN BAŞINDA durur — import'tan
 *      sonra gelen yönerge sessizce yok sayılır ve dosya sunucu bileşeni
 *      olarak derlenir.
 *   C. Her `page.tsx` ve `layout.tsx` default export taşır.
 *   D. Her `route.ts` en az bir geçerli HTTP metodu export eder ve default
 *      export TAŞIMAZ (Next bunu hata sayar).
 *   E. Route dosyaları istemci kancası (useState/useEffect) içermez.
 */
process.env.DATABASE_URL ??=
  "postgresql://verifier:verifier@127.0.0.1:5432/verifier";

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const WEB = join(__dirname, "..");
const SRC = join(WEB, "src");
const APP = join(SRC, "app");

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed++;
    console.log(
      `  FAIL ${name}\n       ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "generated" || entry === ".next") continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

const FILES = walk(SRC);
const SOURCES = new Map(FILES.map((f) => [f, readFileSync(f, "utf8")]));
const rel = (f: string) => relative(WEB, f).split(sep).join("/");

/** Yorumları çıkarır: yorumdaki bir import satırı import değildir. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * YALNIZ DEĞER import'ları. `import type { X } from "@/server/..."` derleme
 * sırasında tamamen SİLİNİR: istemci paketine hiçbir şey girmez ve derleme
 * düşmez. İlk sürüm bunları da sayıyordu ve yedi yanlış bulgu üretti —
 * kurt masalı anlatan bir kapı, kapı olmaktan çıkar.
 */
function valueImportSpecifiers(src: string): string[] {
  const out: string[] = [];
  const clean = stripComments(src);
  const re = /\bimport\s+(type\s+)?([\s\S]*?)\sfrom\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    if (m[1]) continue; // import type { ... }
    const clause = m[2] ?? "";
    /* `import { type A, type B }` — hepsi tip ise değer import'u yoktur. */
    const named = clause.match(/\{([\s\S]*)\}/);
    if (named) {
      const parts = named[1]!.split(",").map((x) => x.trim()).filter(Boolean);
      const before = clause.slice(0, clause.indexOf("{")).replace(/,/g, "").trim();
      if (parts.length > 0 && parts.every((x) => /^type\s/.test(x)) && before === "") {
        continue;
      }
    }
    out.push(m[3]!);
  }
  /* Yan etki import'u: `import "@/server/x"` — değer import'udur. */
  const re2 = /\bimport\s*["']([^"']+)["']/g;
  while ((m = re2.exec(clean))) out.push(m[1]!);
  /* Dinamik import da paketlenir. */
  const re3 = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = re3.exec(clean))) out.push(m[1]!);
  return out;
}

const CLIENT_FILES = FILES.filter((f) =>
  /^\s*["']use client["']/m.test(SOURCES.get(f)!),
);

/**
 * İstemci paketine giremeyecek modüller. `@/server/...` bilerek kapsam
 * dışıdır değil — tam tersine en tehlikelisidir: sunucu iş mantığı istemci
 * paketine girerse hem derleme düşer hem de sızıntı riski doğar.
 */
const SERVER_ONLY = [
  { pattern: /^@\/lib\/prisma$/, why: "prisma istemcisi" },
  { pattern: /^@\/server\//, why: "sunucu iş mantığı" },
  { pattern: /^next\/headers$/, why: "next/headers" },
  { pattern: /^@\/auth$/, why: "auth yapılandırması" },
  { pattern: /^server-only$/, why: "server-only" },
  { pattern: /^node:/, why: "node yerleşiği" },
  { pattern: /^(fs|path|crypto|child_process|os|net|tls)$/, why: "node yerleşiği" },
];

console.log("=== NEXT DERLEME SINIRLARI ===\n");
console.log(
  `  (${FILES.length} kaynak dosya, ${CLIENT_FILES.length} "use client")\n`,
);

/* ------------------------------------------------------------------ */
check('A. "use client" dosyaları sunucuya özel modül import etmiyor', () => {
  const ihlaller: string[] = [];
  for (const f of CLIENT_FILES) {
    for (const spec of valueImportSpecifiers(SOURCES.get(f)!)) {
      const hit = SERVER_ONLY.find((s) => s.pattern.test(spec));
      if (hit) ihlaller.push(`${rel(f)} -> ${spec} (${hit.why})`);
    }
  }
  if (ihlaller.length > 0) {
    throw new Error(
      `${ihlaller.length} sınır ihlali — derleme bunlarda düşer:\n       ` +
        ihlaller.slice(0, 15).join("\n       ") +
        (ihlaller.length > 15 ? `\n       ... ve ${ihlaller.length - 15} tane daha` : ""),
    );
  }
});

/* ------------------------------------------------------------------ */
check('B. "use client" yönergesi dosyanın en başında', () => {
  const geç: string[] = [];
  for (const f of CLIENT_FILES) {
    const src = SOURCES.get(f)!;
    /* Yönergeden önce yalnız boş satır, yorum ve BOM olabilir. */
    const before = src.slice(0, src.search(/["']use client["']/));
    const cleaned = stripComments(before).replace(/^﻿/, "").trim();
    if (cleaned.length > 0) geç.push(`${rel(f)} (önünde kod var)`);
  }
  if (geç.length > 0) {
    throw new Error(
      `yönerge sessizce yok sayılır, dosya SUNUCU bileşeni olarak derlenir:\n       ` +
        geç.join("\n       "),
    );
  }
});

/* ------------------------------------------------------------------ */
const PAGES = FILES.filter((f) => /[\\/](page|layout)\.tsx$/.test(f) && f.startsWith(APP));
check("C. her page ve layout default export taşıyor", () => {
  const eksik = PAGES.filter(
    (f) => !/export\s+default\s/.test(stripComments(SOURCES.get(f)!)),
  ).map(rel);
  if (eksik.length > 0) {
    throw new Error(`default export yok (derleme düşer):\n       ` + eksik.join("\n       "));
  }
  if (PAGES.length === 0) throw new Error("hiç page/layout bulunamadı — tarama yanlış");
});

/* ------------------------------------------------------------------ */
const ROUTES = FILES.filter((f) => /[\\/]route\.ts$/.test(f) && f.startsWith(APP));
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
check("D. her route.ts geçerli metot export ediyor, default export etmiyor", () => {
  const sorunlar: string[] = [];
  for (const f of ROUTES) {
    const src = stripComments(SOURCES.get(f)!);
    /* Üç geçerli biçim de kabul edilir. Üçüncüsü NextAuth'un kullandığı
       yeniden-export biçimidir (`export { handler as GET, handler as POST }`);
       ilk sürüm onu tanımıyor ve rotayı bozuk sanıyordu. */
    const bulunan = METHODS.filter(
      (m) =>
        new RegExp(`export\\s+(?:async\\s+)?(?:function\\s+${m}\\b|const\\s+${m}\\b)`).test(src) ||
        new RegExp(`export\\s*\\{[^}]*\\b(?:as\\s+)?${m}\\b[^}]*\\}`).test(src),
    );
    if (bulunan.length === 0) sorunlar.push(`${rel(f)} (hiç HTTP metodu export etmiyor)`);
    if (/export\s+default\s/.test(src)) sorunlar.push(`${rel(f)} (default export var — Next hata verir)`);
  }
  if (sorunlar.length > 0) {
    throw new Error(`${sorunlar.length} rota sorunu:\n       ` + sorunlar.join("\n       "));
  }
  if (ROUTES.length === 0) throw new Error("hiç route.ts bulunamadı — tarama yanlış");
});

/* ------------------------------------------------------------------ */
check("E. route dosyalarında istemci kancası yok", () => {
  const sorunlar: string[] = [];
  for (const f of ROUTES) {
    const src = stripComments(SOURCES.get(f)!);
    for (const hook of ["useState", "useEffect", "useRouter", "useMemo"]) {
      if (new RegExp(`\\b${hook}\\s*\\(`).test(src)) sorunlar.push(`${rel(f)} -> ${hook}`);
    }
  }
  if (sorunlar.length > 0) {
    throw new Error(`rota sunucuda koşar, kanca çalışmaz:\n       ` + sorunlar.join("\n       "));
  }
});

console.log(
  `\n${passed} passed, ${failed} failed` +
    `\nNOT: bu kapı gerçek derlemenin YERİNE geçmez. Yeşil olması "derleme geçer"` +
    `\ndemek değildir; kırmızı olması "derleme düşer" demektir. Gerçek derleme` +
    `\nWindows'ta TALEPO-BUILD.cmd ile ya da push'ta build.yml ile koşar.`,
);
if (failed > 0) process.exit(1);
