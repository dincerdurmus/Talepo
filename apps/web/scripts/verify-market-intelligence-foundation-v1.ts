/**
 * Pazar ve Talep Zekâsı temel sözleşme kapısı (2026-08-31).
 * Run from apps/web: npx tsx scripts/verify-market-intelligence-foundation-v1.ts
 *
 * Ölçtüğü sözleşme: docs/MARKET-INTELLIGENCE-PROGRAM.md ölçüm sözlüğü.
 * - Dört kanonik olay AYRIK (kabul ≠ tamamlanan satış).
 * - PII sınırı: ham id / il-dışı konum warehouse olayına sızmaz.
 * - Idempotent eventId deterministiktir.
 * - Sink transport'suz DW_PROVISION_REQUIRED der, asla taklit etmez ve
 *   ürün akışını bloklamaz; başarısız teslim olay KAYBETMEZ.
 * - Provider veri yokken NOT_MEASURED döner, sıfır uydurmaz.
 * - Modüller operasyonel DB'ye (prisma) dokunmaz.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  MARKET_EVENT_SCHEMA_VERSION,
  MarketEventName,
  marketEventId,
  toMarketEvent,
} from "../src/lib/market-intelligence/contract";
import {
  createBufferedWarehouseSink,
  type WarehouseTransport,
} from "../src/lib/market-intelligence/sink";
import { createNotMeasuredProvider } from "../src/lib/market-intelligence/provider";
import { ProductEventName, type ProductEvent } from "../src/lib/observability/product-events";

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

function productEvent(overrides: Partial<ProductEvent>): ProductEvent {
  return {
    eventName: ProductEventName.REQUEST_PUBLISHED,
    occurredAt: "2026-08-31T00:00:00.000Z",
    actorType: "buyer",
    surface: "test",
    ...overrides,
  };
}

// A. Dört olay ayrık — kabul ve tamamlanan satış farklı adlardır.
const names = Object.values(MarketEventName);
check("A1 dört kanonik olay tanımlı", names.length === 4);
check(
  "A2 kabul ≠ tamamlanan satış",
  MarketEventName.OFFER_ACCEPTED !== MarketEventName.DEAL_COMPLETED &&
    names.includes("offer_accepted") &&
    names.includes("deal_completed"),
);

// B. Dönüşüm + PII sınırı.
const ev = toMarketEvent({
  productEvent: productEvent({ requestId: "req_RAW_123", companyId: "comp_RAW_9" }),
  categoryId: "appliances",
  provinceCode: "TR-34",
  subjectId: "req_RAW_123",
});
check("B1 geçerli girdi olaya dönüşür", ev !== null);
check(
  "B2 ham requestId taşınmaz (geri çözülemez ref)",
  Boolean(ev && !JSON.stringify(ev).includes("req_RAW_123")),
);
check(
  "B3 ham companyId taşınmaz",
  Boolean(ev && !JSON.stringify(ev).includes("comp_RAW_9")),
);
check("B4 allowlist il kodu taşınır", ev?.provinceCode === "TR-34");
const evBadProvince = toMarketEvent({
  productEvent: productEvent({ requestId: "r1" }),
  categoryId: "appliances",
  provinceCode: "Kadıköy",
  subjectId: "r1",
});
check(
  "B5 allowlist dışı konum TAŞINMAZ (ilçe/ham metin null olur)",
  evBadProvince !== null && evBadProvince.provinceCode === null,
);
check(
  "B6 kategori olmadan sayı üretilmez (null, sahte satır değil)",
  toMarketEvent({
    productEvent: productEvent({}),
    categoryId: "",
    provinceCode: "TR-34",
    subjectId: "r1",
  }) === null,
);
check("B7 şema versiyonu v1", ev?.schemaVersion === MARKET_EVENT_SCHEMA_VERSION);

// C. Idempotent kimlik deterministik.
check(
  "C1 aynı (olay, özne) → aynı eventId",
  marketEventId("offer_submitted", "abc") === marketEventId("offer_submitted", "abc"),
);
check(
  "C2 farklı olay → farklı eventId",
  marketEventId("offer_submitted", "abc") !== marketEventId("offer_accepted", "abc"),
);

// D. Sink: transport yokken dürüst; varken idempotent + kayıpsız.
async function sinkChecks() {
  const bare = createBufferedWarehouseSink();
  bare.offer(ev!);
  const bareFlush = await bare.flush();
  check(
    "D1 transport'suz durum DW_PROVISION_REQUIRED",
    bare.status().state === "DW_PROVISION_REQUIRED" &&
      !bareFlush.ok &&
      (bareFlush as { reason: string }).reason === "DW_PROVISION_REQUIRED",
  );
  check("D2 transport'suz düşen olay SAYILIR", bare.status().droppedNoTransport === 1);

  let delivered: number[] = [];
  let failNext = true;
  const transport: WarehouseTransport = {
    name: "test-batch",
    async deliverBatch(events) {
      if (failNext) {
        failNext = false;
        return { ok: false, reason: "unavailable" };
      }
      delivered.push(events.length);
      return { ok: true, delivered: events.length };
    },
  };
  const sink = createBufferedWarehouseSink({ transport });
  sink.offer(ev!);
  sink.offer(ev!); // aynı eventId — idempotent
  check("D3 aynı eventId iki kez sayılmaz", sink.status().buffered === 1);
  const firstTry = await sink.flush();
  check(
    "D4 başarısız teslim olay kaybetmez ve fırlatmaz",
    !firstTry.ok && sink.status().buffered === 1 && sink.status().failedDeliveries === 1,
  );
  const secondTry = await sink.flush();
  check(
    "D5 sonraki flush teslim eder",
    secondTry.ok && sink.status().deliveredTotal === 1 && delivered.length === 1,
  );
}

// E. Provider: veri yokken NOT_MEASURED, sıfır değil.
async function providerChecks() {
  const model = await createNotMeasuredProvider().getMarketIntelligence({
    fromIso: "2026-08-01T00:00:00.000Z",
    toIso: "2026-08-31T00:00:00.000Z",
  });
  check("E1 kaynak NOT_MEASURED", model.source === "NOT_MEASURED");
  check(
    "E2 hiçbir metrik ölçülmüş sıfır gibi görünmez",
    Object.values(model.metrics).every((m) => m.status === "NOT_MEASURED"),
  );
  check("E3 huni dört ayrı adımdır", model.funnel.length === 4);
}

// F. Operasyonel DB warehouse gibi kullanılmıyor: modüller prisma import etmez.
const root = join(__dirname, "..", "src", "lib", "market-intelligence");
for (const file of ["contract.ts", "sink.ts", "provider.ts"]) {
  const src = readFileSync(join(root, file), "utf8");
  check(`F ${file} prisma/DB import etmez`, !/from ["']@\/lib\/prisma|@prisma\//.test(src));
}

// G. DW-2 üreticileri — kanonik servis sınırından, UI'dan DEĞİL (statik).
function producerChecks() {
  const web = join(__dirname, "..", "src");
  const read = (rel: string) => readFileSync(join(web, rel), "utf8");

  const productEvents = read("lib/observability/product-events.ts");
  check(
    "G1 DEAL_COMPLETED ürün olayı tanımlı (kabul ile AYRIK)",
    /DEAL_COMPLETED:\s*"DEAL_COMPLETED"/.test(productEvents),
  );
  const contractSrc = read("lib/market-intelligence/contract.ts");
  check(
    "G2 dört kanonik olayın DÖRDÜ de ürün olayından eşlenir",
    /REQUEST_PUBLISHED\]/.test(contractSrc) &&
      /OFFER_SUBMITTED\]/.test(contractSrc) &&
      /OFFER_ACCEPTED\]/.test(contractSrc) &&
      /DEAL_COMPLETED\]/.test(contractSrc),
  );

  const dealOutcome = read("server/price-intelligence/deal-outcome.ts");
  check(
    "G3 deal_completed üreticisi justCompleted geçişine bağlı (tek sefer, DB sonrası)",
    /justCompleted/.test(dealOutcome) &&
      /trackProductEvent\(\{[\s\S]{0,400}?DEAL_COMPLETED/.test(dealOutcome),
  );

  for (const [rel, ev] of [
    ["server/request/create-request.ts", "REQUEST_PUBLISHED"],
    ["server/offer/offer-service.ts", "OFFER_SUBMITTED"],
    ["server/offer/offer-service.ts", "OFFER_ACCEPTED"],
  ] as const) {
    const src = read(rel);
    const site = src.split(`ProductEventName.${ev}`)[1]?.slice(0, 500) ?? "";
    check(
      `G4 ${ev} üreticisi köprü alanlarını taşır (categoryId + provinceCode)`,
      site.includes("categoryId") && site.includes("provinceCode"),
    );
  }
  check(
    "G5 konum yalnız kanonik çözümleyiciden taşınır (ikinci liste yok)",
    /resolveProvinceTelemetry/.test(read("server/request/create-request.ts")) &&
      /resolveProvinceTelemetry/.test(read("server/offer/offer-service.ts")) &&
      /resolveProvinceTelemetry/.test(dealOutcome),
  );
}

// H. Köprü: ürün olayı → v1 warehouse olayı → sink (davranışsal).
async function bridgeChecks() {
  const { registerMarketIntelligenceBridge } = await import(
    "../src/lib/market-intelligence/bridge"
  );
  const { createBufferedWarehouseSink: mk } = await import(
    "../src/lib/market-intelligence/sink"
  );
  const { ProductEventName: PEN, trackProductEvent } = await import(
    "../src/lib/observability/product-events"
  );

  const batches: unknown[][] = [];
  const sink = mk({
    transport: {
      name: "test",
      async deliverBatch(events) {
        batches.push(events);
        return { ok: true, delivered: events.length };
      },
    },
  });
  const off = registerMarketIntelligenceBridge(sink);

  trackProductEvent({
    eventName: PEN.REQUEST_PUBLISHED,
    actorType: "buyer",
    surface: "verify-mi",
    requestId: "req_BRIDGE_RAW",
    metadata: { categoryId: "appliances", provinceCode: "TR-34" },
  });
  check("H1 köprü ürün olayını warehouse olayına çevirip sink'e verir", sink.status().buffered === 1);

  // Aynı özne tekrar (retry) → idempotent, sayı artmaz.
  trackProductEvent({
    eventName: PEN.REQUEST_PUBLISHED,
    actorType: "buyer",
    surface: "verify-mi",
    requestId: "req_BRIDGE_RAW",
    metadata: { categoryId: "appliances", provinceCode: "TR-34" },
  });
  check("H2 retry/duplicate ikinci analitik olay üretmez", sink.status().buffered === 1);

  // Köprü alanları eksikse olay SESSİZCE sayıya dönüşmez.
  trackProductEvent({
    eventName: PEN.OFFER_SUBMITTED,
    actorType: "seller",
    surface: "verify-mi",
    metadata: {},
  });
  check("H3 sözleşmesiz olay sayılmaz (kategori/özne yoksa düşer)", sink.status().buffered === 1);

  // PII: ham id serilerde görünmez.
  const flushed = await sink.flush();
  check(
    "H4 ham id warehouse'a sızmaz",
    flushed.ok && !JSON.stringify(batches).includes("req_BRIDGE_RAW"),
  );

  // Köprü/sink hatası ürün akışını KIRAMAZ.
  const bomb = mk({ transport: { name: "bomb", async deliverBatch() { throw new Error("x"); } } });
  const offBomb = registerMarketIntelligenceBridge({
    ...bomb,
    offer() {
      throw new Error("kasıtlı köprü hatası");
    },
  });
  let threw = false;
  try {
    trackProductEvent({
      eventName: PEN.OFFER_ACCEPTED,
      actorType: "buyer",
      surface: "verify-mi",
      metadata: { categoryId: "appliances", offerId: "of_X" },
    });
  } catch {
    threw = true;
  }
  check("H5 köprü hatası trackProductEvent çağıranını kırmaz", !threw);
  offBomb();
  off();

  // H5'in geçerli OFFER_ACCEPTED olayı meşru olarak sayılmış olabilir;
  // ölçülen şey off() SONRASI teslimin durmasıdır (sayı değişmemeli).
  const bufferedBeforeOff = sink.status().buffered;
  trackProductEvent({
    eventName: PEN.REQUEST_PUBLISHED,
    actorType: "buyer",
    surface: "verify-mi",
    requestId: "req_AFTER_OFF",
    metadata: { categoryId: "appliances" },
  });
  check(
    "H6 köprü aboneliği geri alınabilir",
    sink.status().buffered === bufferedBeforeOff,
  );
}

async function main() {
  await sinkChecks();
  await providerChecks();
  producerChecks();
  await bridgeChecks();
  console.log(`\nMarket intelligence foundation: ${pass} PASS / ${fail} FAIL`);
  if (errors.length) {
    for (const e of errors) console.log(" -", e);
    process.exit(1);
  }
}

void main();
