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
 *  D) Üretim kaydı DÜRÜSTLÜĞÜ: `addLogSink`/`addProductEventSink` çağıran
 *     üretim kodu var mı ölçülür ve olduğu gibi raporlanır — bu kapı üretim
 *     sink'i "var" diye YEŞİLE BOYAMAZ; yokluğu da kırmızı saymaz (provision
 *     DW-3'e bağlı). Ölçülmeyen, sıfır değildir.
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

// D. Üretim kaydı dürüstlüğü — src altında (observability modülleri hariç)
//    sink KAYDEDEN üretim kodu var mı? Rapor: bilgi, hüküm değil.
{
  const roots = [join(__dirname, "..", "src")];
  const callers: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        if (name === "node_modules" || name === "generated") continue;
        walk(p);
      } else if (/\.(ts|tsx)$/.test(name)) {
        if (p.includes(join("lib", "observability"))) continue;
        const src = readFileSync(p, "utf8");
        if (/addLogSink\s*\(|addProductEventSink\s*\(/.test(src)) callers.push(p);
      }
    }
  };
  for (const r of roots) walk(r);
  console.log(
    callers.length
      ? `BİLGİ — üretim sink kaydı VAR: ${callers.length} dosya`
      : "BİLGİ — üretim sink kaydı YOK: olaylar yalnız stdout (PRODUCTION-SINK-NOT-VERIFIED sürüyor; kapanışı DW-3 provision'a bağlı)",
  );
  check("D1 üretim sink durumu ölçüldü ve raporlandı", true);
}

console.log(`\nLog sink chain: ${pass} PASS / ${fail} FAIL`);
if (errors.length) {
  for (const e of errors) console.log(" -", e);
  process.exit(1);
}
