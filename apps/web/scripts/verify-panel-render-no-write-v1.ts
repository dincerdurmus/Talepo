/**
 * RENDER SINIRI SALT-OKUNURDUR — KB-22 (2026-08-28).
 *
 * SORUN. `app/panel/layout.tsx` her RSC render'ında
 * `processUrgentNoOfferNudges` çağırıyordu; o da `prisma.request.updateMany`
 * ile kalıcı damga ve `createNotification` ile kalıcı bildirim üretiyordu.
 * Layout `force-dynamic` + `revalidate = 0` olduğu için iş her istekte
 * koşuyordu: navigasyon, `router.refresh()` ve `<Link>` prefetch'i dâhil.
 *
 * NE ÖLÇÜLÜR — ÇAĞRI GRAFİĞİ, IMPORT DEĞİL. İlk yazımda ölçüm yalnız import
 * ulaşılabilirliğine bakıyordu ve 25 modülü suçluyordu; oysa bir server
 * action'ı ya da route yardımcısını IMPORT ETMEK render sırasında yazmak
 * DEĞİLDİR. Ölçüm artık aşağıdaki çağrı grafiği üzerinden
 * yapılır: render girişinin default export gövdesinden başlayarak yalnız
 * GERÇEKTEN ÇAĞRILAN fonksiyonlara inilir.
 *
 * SINIFLAR.
 *   A — render çalışırken gerçekten koşan kalıcı yazım (ölçülen budur)
 *   B — import edilmiş ama yalnız handler/action/route üzerinden çağrılan
 *       yazım (çağrı grafiği bunu ELER)
 *   C — yanlış pozitif, örn. `url.searchParams.delete(...)`
 *       (`NON_DB_RECEIVERS` bunu ELER)
 *
 * SALT-OKUNUR. Hiçbir veritabanı bağlantısı açılmaz.
 */

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const SRC = join(ROOT, "src");
const APP = join(SRC, "app");

const problems: string[] = [];

/* ------------------------------------------------------------------ *
 * ÇAĞRI GRAFİĞİ — import değil, GERÇEK ÇAĞRI
 * ------------------------------------------------------------------ */

const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

function resolveLocal(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null;
  for (const ext of ["", ...EXTENSIONS]) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

const fileCache = new Map<string, string>();
function read(file: string): string {
  const cached = fileCache.get(file);
  if (cached !== undefined) return cached;
  const text = stripComments(readFileSync(file, "utf8"));
  fileCache.set(file, text);
  return text;
}

/** `import { a as b }` / `import c` / `import * as d` bağlamaları. */
type Binding = { module: string; exported: string };

function importBindings(file: string): Map<string, Binding> {
  const source = read(file);
  const out = new Map<string, Binding>();
  const pattern = /import\s+([\s\S]*?)\s+from\s*["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const clause = match[1] ?? "";
    const target = resolveLocal(match[2] ?? "", file);
    if (!target) continue;
    const named = clause.match(/\{([\s\S]*?)\}/);
    if (named) {
      for (const raw of (named[1] ?? "").split(",")) {
        const piece = raw.trim().replace(/^type\s+/, "");
        if (!piece) continue;
        const [exported, local] = piece.split(/\s+as\s+/).map((s) => s.trim());
        out.set(local || exported || "", {
          module: target,
          exported: exported || "",
        });
      }
    }
    const def = clause.replace(/\{[\s\S]*?\}/g, "").trim().split(",")[0]?.trim();
    if (def && !def.startsWith("*")) {
      out.set(def, { module: target, exported: "default" });
    }
  }
  return out;
}

/**
 * Bir modüldeki üst düzey fonksiyon gövdeleri (`function f(){}`,
 * `const f = () => {}`, `export default function(){}`) ve re-export'lar.
 */
function functionBodies(file: string): Map<string, string> {
  const source = read(file);
  const out = new Map<string, string>();

  /**
   * Gövde, PARAMETRE LİSTESİ KAPANDIKTAN sonra başlar. Doğrudan ilk `{`
   * aranırsa `function Page({ params })` gibi bir imzada gövde olarak
   * `{ params }` yakalanır ve fonksiyon boş görünür — ölçüldü: bildirim
   * yönlendirme sayfasının gerçek yazımı bu yüzden görünmüyordu.
   */
  function capture(name: string, parenIndex: number): void {
    let startIndex = parenIndex;
    if (source[parenIndex] === "(") {
      let parens = 0;
      for (let i = parenIndex; i < source.length; i++) {
        if (source[i] === "(") parens += 1;
        else if (source[i] === ")") {
          parens -= 1;
          if (parens === 0) {
            startIndex = i + 1;
            break;
          }
        }
      }
    }
    const braceStart = source.indexOf("{", startIndex);
    if (braceStart < 0) return;
    let depth = 0;
    for (let i = braceStart; i < source.length; i++) {
      const ch = source[i];
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          out.set(name, source.slice(braceStart, i + 1));
          return;
        }
      }
    }
  }

  const fnPattern =
    /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)?\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = fnPattern.exec(source)) !== null) {
    const isDefault = /default/.test(match[0]);
    const name = match[1] ?? (isDefault ? "default" : "");
    if (!name) continue;
    /* Parametre listesinin AÇILIŞ parantezi — eşleşmenin son karakteri. */
    capture(name, match.index + match[0].length - 1);
    /* Adı olan default export ikinci kez yakalanmaz; aynı gövde paylaşılır. */
    if (isDefault && match[1]) {
      const body = out.get(match[1]);
      if (body !== undefined) out.set("default", body);
    }
  }

  const constPattern =
    /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?\([^)]*\)\s*(?::[^=>]+)?=>\s*/g;
  while ((match = constPattern.exec(source)) !== null) {
    capture(match[1] ?? "", source.indexOf("(", match.index));
  }

  return out;
}

/** Bir gövdede çağrılan tanımlayıcılar (`foo(`, `await foo(`). */
function calledNames(body: string): string[] {
  const out = new Set<string>();
  const pattern = /\b([A-Za-z_$][\w$]*)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    out.add(match[1] ?? "");
  }
  return [...out];
}

const WRITE_METHODS = [
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
];

const WRITE_SHAPE = new RegExp(
  `\\b([A-Za-z_$][\\w$]*)\\s*\\.\\s*([A-Za-z_$][\\w$]*)\\s*\\.\\s*(?:${WRITE_METHODS.join("|")})\\s*\\(`,
  "g",
);
const RAW_SHAPE = /\.\s*\$(?:executeRaw|executeRawUnsafe)\s*\(/;

/** JS yerleşikleri aynı şekli taşır — yanlış pozitif (C sınıfı) eler. */
const NON_DB_RECEIVERS = new Set([
  "searchParams",
  "headers",
  "cookies",
  "params",
  "query",
  "localStorage",
  "sessionStorage",
  "classList",
  "dataset",
  "style",
]);

function bodyWrites(body: string): string | null {
  if (RAW_SHAPE.test(body)) return "$executeRaw";
  WRITE_SHAPE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WRITE_SHAPE.exec(body)) !== null) {
    if (NON_DB_RECEIVERS.has(match[2] ?? "")) continue;
    return match[0].replace(/\s*\($/, "");
  }
  return null;
}

type RenderWrite = {
  entry: string;
  chain: string[];
  write: string;
};

/**
 * Render girişinin default export'undan başlayarak GERÇEKTEN ÇAĞRILAN
 * fonksiyonlara iner ve ilk kalıcı yazımı döndürür.
 *
 * `"use client"` modülleri atlanır: gövdeleri sunucu render'ında koşmaz.
 */
function renderWritesOf(entry: string): RenderWrite[] {
  const found: RenderWrite[] = [];
  const seen = new Set<string>();

  function visit(file: string, fnName: string, chain: string[]): void {
    const key = `${file}#${fnName}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (/^\s*["']use client["']/m.test(readFileSync(file, "utf8").slice(0, 300))) {
      return;
    }
    const bodies = functionBodies(file);
    const body = bodies.get(fnName);
    if (body === undefined) return;

    const write = bodyWrites(body);
    if (write) {
      found.push({ entry, chain: [...chain, `${file}#${fnName}`], write });
      return;
    }

    const bindings = importBindings(file);
    for (const name of calledNames(body)) {
      const local = bodies.get(name);
      if (local !== undefined) {
        visit(file, name, [...chain, `${file}#${fnName}`]);
        continue;
      }
      const binding = bindings.get(name);
      if (!binding) continue;
      visit(binding.module, binding.exported, [...chain, `${file}#${fnName}`]);
    }
  }

  visit(entry, "default", []);
  return found;
}


function ok(id: string, condition: boolean, detail: string): void {
  if (!condition) problems.push(`${id}: ${detail}`);
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full, out);
      continue;
    }
    if (entry === "page.tsx" || entry === "layout.tsx") out.push(full);
  }
  return out;
}

function rel(file: string): string {
  return file.slice(ROOT.length + 1).replace(/\\/g, "/");
}

function shortChain(chain: string[]): string {
  return chain
    .map((step) => {
      const [file, fn] = step.split("#");
      return `${rel(resolve(file ?? ""))}#${fn ?? ""}`;
    })
    .join(" → ");
}

/* ------------------------------------------------------------------ *
 * ÖLÇÜM — YALNIZ PANEL RENDER GİRİŞLERİ
 * ------------------------------------------------------------------ */

const PANEL_ENTRIES = walk(join(APP, "panel"));

ok(
  "K0-kapsam",
  PANEL_ENTRIES.length >= 25,
  `panel render girişi az bulundu (${PANEL_ENTRIES.length}) — evren kurulamadı`,
);

type Finding = { entry: string; chain: string; write: string; id: string };

const findings: Finding[] = [];
for (const entry of PANEL_ENTRIES) {
  for (const write of renderWritesOf(entry)) {
    findings.push({
      entry: rel(entry),
      chain: shortChain(write.chain),
      write: write.write,
      id: `${rel(entry)} → ${write.write}`,
    });
  }
}

/* ------------------------------------------------------------------ *
 * KB-22'NİN SERT KAPISI — ACİL NUDGE RENDER'DA KOŞMAZ
 * ------------------------------------------------------------------ */

const nudgeFindings = findings.filter((finding) =>
  /urgent-no-offer-nudge|urgent-nudge-core/.test(finding.chain),
);
ok(
  "K1-nudge-render-disinda",
  nudgeFindings.length === 0,
  `acil nudge işi hâlâ render sırasında koşuyor: ${nudgeFindings
    .map((finding) => finding.chain)
    .join(" | ")}`,
);

/* ------------------------------------------------------------------ *
 * KALAN GERÇEK RENDER YAZIMLARI — TEK SAYI DEĞİL, AÇIK KİMLİKLER
 * ------------------------------------------------------------------ *
 *
 * Bunlar KB-22'nin kökü DEĞİLDİR ve bu dilimde düzeltilmez; her biri kendi
 * kimliğiyle listelenir ki "panel render write 0" iddiası yanlışlıkla
 * üretilmesin. Yeni bir kimlik eklenirse doğrulayıcı kırmızı olur; buradaki
 * kimliklerden biri düzeltilirse listeden ÇIKARILMASI gerekir.
 */
/**
 * DİLİM 1'DE İKİ KİMLİK GERÇEKTEN KALKTI (2026-08-28).
 *
 * `bildirimler/r/[id] → prisma.notification.updateMany` ve
 * `mesajlar/[id] → prisma.conversationParticipant.updateMany` listeden SAYAÇ
 * DÜŞÜRMEK için değil, üretimdeki ÇAĞRI kalktığı için çıkarıldı: iki yazım da
 * artık açık POST sınırında yürüyor (bkz. `verify-read-receipt-boundary-v1`).
 * `K2-kimlik-kaybolmadi` kapısı bu çıkarmayı ZORUNLU kılar — ölçülmeyen bir
 * kimliği listede bırakmak doğrulayıcıyı kırmızı yapar.
 */
const FROZEN_RENDER_WRITE_IDENTITIES = [
  "src/app/panel/talepler/page.tsx → prisma.category.upsert",
  "src/app/panel/talepler/page.tsx → prisma.requestMatch.createMany",
] as const;

const frozen = new Set<string>(FROZEN_RENDER_WRITE_IDENTITIES);
const measured = new Set(findings.map((finding) => finding.id));

const unexpected = [...measured].filter((id) => !frozen.has(id)).sort();
const disappeared = [...frozen].filter((id) => !measured.has(id)).sort();

ok(
  "K2-yeni-render-yazimi",
  unexpected.length === 0,
  `dondurulmuş kimliklerde olmayan render yazımı: ${unexpected.join(", ")}`,
);
ok(
  "K2-kimlik-kaybolmadi",
  disappeared.length === 0,
  `dondurulmuş kimlik ölçülmedi (düzeltildiyse listeden çıkarılmalı): ${disappeared.join(", ")}`,
);

/* ------------------------------------------------------------------ *
 * DEDEKTÖR KONTROLLERİ
 * ------------------------------------------------------------------ */

/* Pozitif: gerçek bir A sınıfı yazım YAKALANMALI. */
/* Pozitif çıpa, Dilim 1'de kalkan bildirim yazımından hâlâ AÇIK olan
 * provisioning yazımına taşındı; çıpa düzeltilen bir kimliğe bağlı kalırsa
 * dedektör sessizce ölçmez olurdu. */
ok(
  "K3-pozitif-kontrol",
  findings.some((finding) => finding.write === "prisma.category.upsert"),
  "bilinen A sınıfı yazım yakalanamadı — çağrı grafiği ölçmüyor",
);

/* Negatif: yalnız IMPORT edilen yazıcı kırmızı ÜRETMEMELİ. */
const layoutFindings = findings.filter(
  (finding) => finding.entry === "src/app/panel/layout.tsx",
);
ok(
  "K3-negatif-kontrol",
  layoutFindings.length === 0,
  `panel layout render'ında yazım: ${layoutFindings.map((f) => f.chain).join(" | ")}`,
);

console.log(`panel render girişi: ${PANEL_ENTRIES.length}`);
console.log(`A sınıfı render yazımı: ${findings.length}`);
for (const finding of findings) {
  console.log(`  A | ${finding.id}`);
  console.log(`      ${finding.chain}`);
}
console.log(`PROBLEMS=${problems.length}`);
for (const problem of problems.slice(0, 20)) console.log(`  - ${problem}`);
console.log("===== HUKUM =====");
console.log(
  problems.length === 0
    ? "GECTI: acil nudge render'dan çıktı; kalan render yazımları dondurulmuş kimliklerle sınırlı (panel render write 0 DEĞİLDİR)."
    : "KALDI: render sınırı sözleşmeyi ihlal ediyor.",
);
process.exit(problems.length === 0 ? 0 : 1);
