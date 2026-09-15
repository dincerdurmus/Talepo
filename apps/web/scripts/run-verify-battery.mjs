#!/usr/bin/env node
/**
 * TALEPO DOĞRULAMA BATARYASI — CETVELLİ KOŞUCU.
 *
 * Neden var (ölçüldü 2026-09-15): depoda hiç CI yoktu. 183 doğrulayıcı vardı
 * ve hiçbirini hiçbir şey otomatik koşmuyordu. Sonucu somut: iki kontrol
 * KB-22 refactor'undan beri bayat kalmıştı, kırmızı oldukları için kimse
 * bakmıyordu, ve o kırmızının ARKASINDA gerçek bir yüzey değişikliği fark
 * edilmeden geçmişti. Kırmızı kalan bir kapı, kapı değildir.
 *
 * KURAL: bilinen kırmızı SİLİNMEZ, SAYIYLA tutulur.
 *   - Sayı ARTARSA → yeni regresyon → CI kırmızı.
 *   - Sayı AZALIRSA → iyi haber, ama cetvel güncellenmeli → CI kırmızı.
 *     Bilerek: kazanılan zemin cetvele yazılmazsa sessizce geri verilebilir.
 *   - Sayı AYNIYSA → geçer, ama raporda görünür kalır; unutulmaz.
 *
 * Veritabanı GEREKMEZ. Buradaki doğrulayıcıların hepsi saf mantık ya da
 * kendi stub istemcisiyle koşar; CI'da sır yoktur.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(
  readFileSync(path.join(here, "verify-battery.json"), "utf8"),
);

const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;

/**
 * TS KOŞUCUSU SABİT DEĞİLDİR. CI `npx tsx` kullanır; farklı bir ortamda
 * (ağı kapalı bir kutu, önceden derlenmiş bir çıktı) başka bir koşucu
 * gerekebilir. `TALEPO_VERIFY_CMD` verilirse o komut, doğrulayıcının ADIYLA
 * çağrılır. Cetvelin kendisi değişmez — yalnız çalıştırma yolu değişir.
 */
function run(script) {
  const started = Date.now();
  const override = process.env.TALEPO_VERIFY_CMD?.trim();
  const result = override
    ? spawnSync(override, [script], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        shell: true,
      })
    : spawnSync(
        "npx",
        ["--yes", "tsx", path.join(here, `${script}.ts`)],
        {
          encoding: "utf8",
          maxBuffer: 64 * 1024 * 1024,
          shell: process.platform === "win32",
        },
      );
  return {
    code: result.status ?? 1,
    out: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    ms: Date.now() - started,
  };
}

const failures = [];
const drifted = [];
let ran = 0;

console.log("=== YEŞİL OLMASI GEREKENLER ===");
for (const script of config.green) {
  if (only && script !== only) continue;
  const { code, ms } = run(script);
  ran += 1;
  const mark = code === 0 ? "GEÇTİ" : "KIRMIZI";
  console.log(`  ${mark.padEnd(8)} ${script} (${(ms / 1000).toFixed(1)}s)`);
  if (code !== 0) failures.push(`${script}: çıkış kodu ${code} (yeşil olmalıydı)`);
}

console.log("\n=== BİLİNEN KIRMIZILAR (cetvelle karşılaştırılır) ===");
for (const entry of config.knownRed) {
  if (only && entry.script !== only) continue;
  const { out, ms } = run(entry.script);
  ran += 1;
  const match = out.match(new RegExp(entry.pattern));
  if (!match) {
    console.log(`  ÖLÇÜLEMEDİ ${entry.script} — çıktı deseni değişmiş`);
    failures.push(
      `${entry.script}: başarısızlık sayısı okunamadı; desen değişmişse cetvel de değişmeli`,
    );
    continue;
  }
  const actual = Number(match[entry.group]);
  const expected = entry.maxFailures;
  if (actual > expected) {
    console.log(`  ARTMIŞ    ${entry.script}: ${actual} (cetvel: ${expected}) (${(ms / 1000).toFixed(1)}s)`);
    failures.push(
      `${entry.script}: başarısızlık ${expected} → ${actual}. YENİ REGRESYON.`,
    );
  } else if (actual < expected) {
    console.log(`  AZALMIŞ   ${entry.script}: ${actual} (cetvel: ${expected}) (${(ms / 1000).toFixed(1)}s)`);
    drifted.push(
      `${entry.script}: başarısızlık ${expected} → ${actual}. İyi haber — cetveli güncelle (scripts/verify-battery.json).`,
    );
  } else {
    console.log(`  AYNI      ${entry.script}: ${actual} (${(ms / 1000).toFixed(1)}s)`);
  }
}

console.log(`\n=== ÖZET === koşan: ${ran}`);
if (drifted.length) {
  console.log("\nCETVEL GÜNCELLENMELİ:");
  for (const line of drifted) console.log("  - " + line);
}
if (failures.length) {
  console.log("\nKIRMIZI:");
  for (const line of failures) console.log("  - " + line);
}

if (failures.length || drifted.length) {
  process.exit(1);
}
console.log("\nBATARYA GEÇTİ.");
