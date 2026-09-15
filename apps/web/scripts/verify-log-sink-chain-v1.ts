/**
 * DW-1 — log/product sink zinciri kapısı (KNOWN-RISKS #23, 2026-08-31).
 * Run from apps/web: npx tsx scripts/verify-log-sink-chain-v1.ts
 *
 * Ölçtüğü sözleşme:
 *  A) Kayıtlı sink'e olay GERÇEKTEN ulaşır (iki kanal: operasyonel log +
 *     ürün olayı) ve abonelik geri alınabilir.
 *  B) Başarısız gönderim davranışı: FIRLATAN bir sink ürün akışını
 *     KIRAMAZ ve diğer sink'leri açlığa mahkûm edemez; düşen teslim
 *     sayaçla görünür (sessiz kayıp yok).
 *  C) Hiç sink yokken varsayılan stdout davranışı korunur (regresyon değil).
 *  D) Üretim kaydı DÜRÜSTLÜĞÜ — KANAL BAŞINA ve TANIM/KAYIT AYRIMIYLA
 *     (düzeltildi 2026-09-15). Eski sürüm iki ayrı kanalı tek regex'te arayıp
 *     tek bir "sink kaydı VAR: N dosya" satırı yazıyordu. Üç yerde yanıltıcıydı:
 *       1. İKİ KANAL BİR SAYI. Operasyonel kanalda (fanout telemetrisi) sink
 *          olup olmaması ile ürün olayı kanalındaki durum ayrı gerçeklerdir;
 *          birinde bulunan bir çağrı diğeri hakkında hiçbir şey söylemez.
 *       2. TANIMI KAYIT SANIYORDU. Bulduğu tek dosya bir sink KAYDETMİYOR;
 *          kaydeden bir fonksiyon TANIMLIYOR. O fonksiyonu `src` altında
 *          çağıran yoksa üretimde kurulu sink yoktur.
 *       3. HÜKÜM VERMEYEN BİR KONTROL. `check(..., true)` hiçbir koşulda
 *          kırmızıya dönemezdi; ölçüm değil süstü.
 *     Yeni sürüm kanal başına KURULU sink sayar ve bu sayı belgelenen
 *     durumdan (PRODUCTION-SINK-NOT-VERIFIED = her iki kanalda 0) saparsa
 *     KIRMIZI verir — sink kurmak serbesttir, sessizce kurmak değil.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  addLogSink,
  getSinkDeliveryFailures,
  logOperational,
  type OperationalLogEvent,
} from "../src/lib/observability/logger";
import {
  addProductEventSink,
  getProductSinkDeliveryFailures,
  ProductEventName,
  trackProductEvent,
  type ProductEvent,
} from "../src/lib/observability/product-events";

let pass = 0;
let fail = 0;
const errors: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`PASS — ${name}`);
  } else {
    fail += 1;
    errors.push(detail ? `${name}: ${detail}` : name);
    console.log(`FAIL — ${name}${detail ? `: ${detail}` : ""}`);
  }
}

// A. Teslim + abonelik geri alma — operasyonel kanal.
{
  const got: OperationalLogEvent[] = [];
  const off = addLogSink((e) => got.push(e));
  logOperational({ level: "info", event: "dw1.chain.test", service: "verify" });
  check("A1 operasyonel olay kayıtlı sink'e ulaşır", got.some((e) => e.event === "dw1.chain.test"));
  off();
  const before = got.length;
  logOperational({ level: "info", event: "dw1.after.off", service: "verify" });
  check("A2 abonelik geri alınınca teslim durur", got.length === before);
}

// A. Teslim + geri alma — ürün olayı kanalı.
{
  const got: ProductEvent[] = [];
  const off = addProductEventSink((e) => got.push(e));
  trackProductEvent({
    eventName: ProductEventName.REQUEST_PUBLISHED,
    actorType: "system",
    surface: "verify-log-sink-chain",
  });
  check("A3 ürün olayı kayıtlı sink'e ulaşır", got.length === 1);
  off();
  trackProductEvent({
    eventName: ProductEventName.REQUEST_PUBLISHED,
    actorType: "system",
    surface: "verify-log-sink-chain",
  });
  check("A4 ürün aboneliği geri alınınca teslim durur", got.length === 1);
}

// B. Fırlatan sink akışı kıramaz, diğer sink'ler teslim almaya devam eder,
//    düşen teslim sayaçta görünür.
{
  const got: OperationalLogEvent[] = [];
  const offBad = addLogSink(() => {
    throw new Error("dw1 kasıtlı sink hatası");
  });
  const offGood = addLogSink((e) => got.push(e));
  const failuresBefore = getSinkDeliveryFailures();
  let threw = false;
  try {
    logOperational({ level: "info", event: "dw1.throwing.sink", service: "verify" });
  } catch {
    threw = true;
  }
  check("B1 fırlatan sink logOperational çağıranını KIRMAZ", !threw);
  check(
    "B2 diğer sink'ler teslim almaya devam eder",
    got.some((e) => e.event === "dw1.throwing.sink"),
  );
  check(
    "B3 düşen teslim sayaçla görünür (sessiz kayıp yok)",
    getSinkDeliveryFailures() === failuresBefore + 1,
  );
  offBad();
  offGood();
}
{
  const offBad = addProductEventSink(() => {
    throw new Error("dw1 kasıtlı ürün sink hatası");
  });
  const failuresBefore = getProductSinkDeliveryFailures();
  let threw = false;
  try {
    trackProductEvent({
      eventName: ProductEventName.OFFER_SUBMITTED,
      actorType: "system",
      surface: "verify-log-sink-chain",
    });
  } catch {
    threw = true;
  }
  check("B4 fırlatan ürün sink'i trackProductEvent çağıranını KIRMAZ", !threw);
  check(
    "B5 ürün kanalında düşen teslim sayaçla görünür",
    getProductSinkDeliveryFailures() === failuresBefore + 1,
  );
  offBad();
}

// D. Üretim kaydı dürüstlüğü — KANAL BAŞINA, tanım ile kayıt ayrı.
{
  /**
   * BELGELENEN DURUM. Bu iki sayı `KNOWN-RISKS #23` / PRODUCTION-SINK-NOT-VERIFIED
   * ile aynı gerçeği söyler: bugün hiçbir kanalda kurulu üretim sink'i yoktur.
   * Bir sink kurulduğunda bu kapı kırmızıya döner; doğru hamle sayıyı burada
   * güncellemek VE durumu belgede kapatmaktır.
   */
  const DOCUMENTED_INSTALLED = { operational: 0, product: 0 } as const;

  type Channel = "operational" | "product";
  type Site = {
    file: string;
    channel: Channel;
    /** Modül gövdesinde mi (import anında koşar) yoksa bir fonksiyonun içinde mi. */
    moduleScope: boolean;
    /** Fonksiyon içindeyse: onu saran export'un adı (bulunabildiyse). */
    enclosing: string | null;
  };

  const stripForScan = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        if (name === "node_modules" || name === "generated") continue;
        walk(p);
      } else if (/\.(ts|tsx)$/.test(name)) {
        if (p.includes(join("lib", "observability"))) continue;
        files.push(p);
      }
    }
  };
  walk(join(__dirname, "..", "src"));

  const sources = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));
  const sites: Site[] = [];

  for (const [file, raw] of sources) {
    const src = stripForScan(raw);
    for (const [channel, re] of [
      ["operational", /\baddLogSink\s*\(/g],
      ["product", /\baddProductEventSink\s*\(/g],
    ] as [Channel, RegExp][]) {
      for (const m of src.matchAll(re)) {
        /**
         * KAPSAM, SÜSLÜ PARANTEZ DERİNLİĞİYLE BELİRLENİR. Bir tokenizer değildir
         * ve string içindeki süslü parantez sayımı şaşırtabilir; bu yüzden
         * belirsizlik KAYIT LEHİNE değil, RAPOR LEHİNE çözülür — şüpheli her
         * çağrı yerel olarak yazdırılır, sessizce elenmez.
         */
        const before = src.slice(0, m.index);
        const depth =
          (before.match(/\{/g) ?? []).length - (before.match(/\}/g) ?? []).length;
        let enclosing: string | null = null;
        if (depth > 0) {
          const decls = [
            ...before.matchAll(
              /\bexport\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)|\bexport\s+const\s+([A-Za-z0-9_$]+)\s*=/g,
            ),
          ];
          const last = decls[decls.length - 1];
          enclosing = last ? (last[1] ?? last[2] ?? null) : null;
        }
        sites.push({ file, channel, moduleScope: depth === 0, enclosing });
      }
    }
  }

  /** Saran export'u `src` altında BAŞKA bir dosya çağırıyor mu. */
  const hasProductionCaller = (name: string, ownFile: string) => {
    const re = new RegExp(`\\b${name}\\s*\\(`);
    for (const [file, raw] of sources) {
      if (file === ownFile) continue;
      if (re.test(stripForScan(raw))) return true;
    }
    return false;
  };

  const installedBy: Record<Channel, string[]> = { operational: [], product: [] };
  const dormantBy: Record<Channel, string[]> = { operational: [], product: [] };

  for (const site of sites) {
    const rel = site.file.slice(site.file.indexOf(join("src", "")));
    if (site.moduleScope) {
      installedBy[site.channel].push(`${rel} (modül gövdesi)`);
      continue;
    }
    const name = site.enclosing;
    if (name && hasProductionCaller(name, site.file)) {
      installedBy[site.channel].push(`${rel} → ${name}() çağrılıyor`);
    } else {
      dormantBy[site.channel].push(
        `${rel} → ${name ?? "adsız fonksiyon"}() — src altında çağıran yok`,
      );
    }
  }

  for (const channel of ["operational", "product"] as Channel[]) {
    const label = channel === "operational" ? "operasyonel log" : "ürün olayı";
    const installed = installedBy[channel];
    const dormant = dormantBy[channel];
    console.log(
      `BİLGİ — ${label} kanalı: KURULU sink ${installed.length}, uyuyan tanım ${dormant.length}`,
    );
    for (const line of installed) console.log(`         kurulu:  ${line}`);
    for (const line of dormant) console.log(`         uyuyan:  ${line}`);
    check(
      `D-${channel} kurulu sink sayısı belgelenen durumla uyuşuyor`,
      installed.length === DOCUMENTED_INSTALLED[channel],
      `kurulu ${installed.length}, belgelenen ${DOCUMENTED_INSTALLED[channel]} — sink durumu yeniden doğrulanmalı ve belge güncellenmeli`,
    );
  }

  const totalInstalled =
    installedBy.operational.length + installedBy.product.length;
  console.log(
    totalInstalled === 0
      ? "BİLGİ — iki kanalda da kurulu üretim sink'i YOK: olaylar yalnız stdout'a düşer (PRODUCTION-SINK-NOT-VERIFIED sürüyor; kapanışı DW-3 provision'a bağlı). Bir tanımın var olması kayıt değildir."
      : `BİLGİ — kurulu üretim sink'i VAR: ${totalInstalled}`,
  );
}

console.log(`\nLog sink chain: ${pass} PASS / ${fail} FAIL`);
if (errors.length) {
  for (const e of errors) console.log(" -", e);
  process.exit(1);
}
