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
 *
 * PARALEL KOŞAR (2026-09-18). Cetvel 30'dan 143'e çıkınca seri koşu CI'ı
 * kabaca 17 dakika uzatıyordu. Doğrulayıcılar birbirinden bağımsız ayrı
 * süreçler olduğu için paralelleştirmek davranışı değiştirmez. İKİ ŞEY
 * BİLEREK KORUNDU: çıktı HER ZAMAN cetvel sırasında basılır (paralel koşu
 * sırası değişse de log aynı kalır, iki koşu karşılaştırılabilir), ve
 * ratchet mantığına hiç dokunulmadı. Eşzamanlılık `VERIFY_CONCURRENCY` ile
 * verilir; verilmezse makinenin çekirdek sayısı (en az 2, en çok 8).
 */
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
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
function runAsync(script) {
  const started = Date.now();
  const override = process.env.TALEPO_VERIFY_CMD?.trim();
  const child = override
    ? spawn(override, [script], { shell: true })
    : spawn("npx", ["--yes", "tsx", path.join(here, `${script}.ts`)], {
        shell: process.platform === "win32",
      });
  return new Promise((resolve) => {
    let out = "";
    let bytes = 0;
    const MAX = 64 * 1024 * 1024;
    const take = (chunk) => {
      bytes += chunk.length;
      if (bytes <= MAX) out += chunk;
    };
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", take);
    child.stderr?.on("data", take);
    // Süreç hiç başlayamazsa (komut yok) `error` gelir ve `close` gelmeyebilir.
    // Sessizce yeşil sayılmasın: açıkça kırmızı bir çıkış kodu üret.
    let settled = false;
    const done = (code) => {
      if (settled) return;
      settled = true;
      resolve({ code: code ?? 1, out, ms: Date.now() - started });
    };
    child.on("error", (err) => {
      out += `\n[koşucu] süreç başlatılamadı: ${err.message}`;
      done(1);
    });
    child.on("close", (code) => done(code));
  });
}

/**
 * Sabit büyüklükte havuz. Sonuçlar GİRDİ SIRASINDA döner — koşu sırası
 * değil. Bu bilerek: rapor iki koşuda aynı görünmezse karşılaştırılamaz.
 */
async function runAll(scripts, etiket) {
  const limit = Math.max(
    1,
    Number(process.env.VERIFY_CONCURRENCY) ||
      Math.min(8, Math.max(2, os.availableParallelism?.() ?? os.cpus().length ?? 2)),
  );
  const results = new Array(scripts.length);
  let next = 0;
  let bitti = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= scripts.length) return;
      results[i] = await runAsync(scripts[i]);
      bitti += 1;
      // İLERLEME STDERR'E. Rapor (stdout) cetvel sırasında ve sessiz kalmalı,
      // ama on dakika hiç satır basmayan bir CI adımı donmuş görünür. Bu satır
      // bitiş sırasında akar; karşılaştırılacak olan rapor değil, nabızdır.
      process.stderr.write(
        `[${etiket} ${String(bitti).padStart(3)}/${scripts.length}] ${scripts[i]} ` +
          `${results[i].code === 0 ? "geçti" : "KIRMIZI"} (${(results[i].ms / 1000).toFixed(1)}s)\n`,
      );
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, scripts.length) }, worker));
  return { results, limit };
}

const failures = [];
const drifted = [];
let ran = 0;

const greenList = config.green.filter((script) => !only || script === only);
const redList = config.knownRed.filter((entry) => !only || entry.script === only);

const wallStarted = Date.now();
const { results: greenResults, limit } = await runAll(greenList, "yeşil");
const redRun = await runAll(redList.map((entry) => entry.script), "bilinen-kırmızı");

console.log(`=== YEŞİL OLMASI GEREKENLER === (${limit} paralel)`);
for (let i = 0; i < greenList.length; i += 1) {
  const script = greenList[i];
  const { code, ms } = greenResults[i];
  ran += 1;
  const mark = code === 0 ? "GEÇTİ" : "KIRMIZI";
  console.log(`  ${mark.padEnd(8)} ${script} (${(ms / 1000).toFixed(1)}s)`);
  if (code !== 0) failures.push(`${script}: çıkış kodu ${code} (yeşil olmalıydı)`);
}

console.log("\n=== BİLİNEN KIRMIZILAR (cetvelle karşılaştırılır) ===");
for (let i = 0; i < redList.length; i += 1) {
  const entry = redList[i];
  const { out, ms } = redRun.results[i];
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

console.log(`\n=== ÖZET === koşan: ${ran} · duvar saati: ${((Date.now() - wallStarted) / 1000).toFixed(1)}s · paralel: ${limit}`);
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
