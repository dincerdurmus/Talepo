/**
 * ORTAK ALAN KALICILIK SINIRI V1 — D3f Dilim 3a (2026-08-28).
 *
 * SORUN (ölçüldü, 2026-08-27). Dilim 2b kullanıcının bilinçli "Bilmiyorum" /
 * "Fark etmez" cevabını sunucuya taşıdı ve `fieldResponses` yüzeyi doğru
 * kuruldu. Ama aynı talep, dedicated kolonlarda BAŞKA bir şey söylüyordu:
 *
 *   budget: fieldResponses = UNKNOWN   ||  budgetMin = budgetMax = 0
 *   city:   fieldResponses = UNKNOWN   ||  Request.city = "Konum fark etmez"
 *
 * Kök neden `parseMoney`: rakam-dışı karakterleri silip `Number("")` = `0`
 * üretiyor ve `0 >= 0` olduğu için geçerli sayıyordu. Kurucunun TEK bütçe
 * kaçışı ("Teklifleri görmek istiyorum") her yayında ₺0 bütçe olarak
 * kalıcılaşıyordu; `routing-envelope` bu kolonu okuyor.
 *
 * KARAR. Dedicated kolonun değeri, kullanıcının STRUCTURED cevabına bağlanır:
 * doğrulanmış `fields[].mode` değer taşımayan bir mod ise kolon TEMİZLENİR,
 * cevap hiç gönderilmemişse mevcut değer KORUNUR. Karar yerelleştirilmiş
 * etiketi okuyarak verilmez — ekranda yazan metin bir sözleşme değildir.
 *
 * SALT-OKUNUR ÖLÇÜM. Bu doğrulayıcı VERİTABANINA YAZMAZ: `create-request` ve
 * `update-request` Prisma'ya bağlıdır, bu yüzden kararın kendisi saf
 * fonksiyonlara alınmıştır ve burada o fonksiyonlar ölçülür. Yazma
 * yollarının GERÇEKTEN bu fonksiyonları kullandığı ayrıca kaynak taramasıyla
 * denetlenir — karar iki yerde ayrı ayrı yazılamaz.
 *
 * KAPSAM DIŞI (ölçülmedi): `RequestFieldValue.jsonValue.mode` kalıcılığı
 * (Dilim 3b), edit/reload state kurulumu (Dilim 3c), clone geri yükleme,
 * `quantity` için kolon ve `title` davranış kararı. Bu YEŞİL onları KAPSAMAZ.
 */

import fs from "node:fs";
import path from "node:path";

import { COMMON_FIELD_DEFAULTS } from "../src/lib/request-category-engine";
import {
  parseBudgetRange,
  parseDeliveryDeadline,
  parseMoney,
  resolveDedicatedBudget,
  resolveDedicatedCity,
  resolveDedicatedDeadline,
} from "../src/server/request/mapper";
import type { RequestFieldInput } from "../src/server/request/request-schema";

const problems: string[] = [];

function ok(id: string, condition: boolean, detail: string): void {
  if (!condition) problems.push(`${id}: ${detail}`);
}

/** `/talep` ve düzenleme ekranının gönderdiği kaçış metinleri. */
const ESCAPE_DRAFTS = [
  "Teklifleri görmek istiyorum",
  "Henüz bilmiyorum",
  "Fark etmez",
  "Esnek",
  "Konum fark etmez",
  "Belirtilmedi",
];

const NON_VALUE_MODES = ["ANY", "UNKNOWN", "NOT_APPLICABLE"] as const;

function field(
  key: string,
  mode?: string,
  value = "",
): RequestFieldInput {
  return {
    key,
    label: key,
    type: "text",
    value,
    ...(mode === undefined ? {} : { mode: mode as RequestFieldInput["mode"] }),
  };
}

/* ------------------------------------------------------------------ *
 * 1. PARSER FAIL-CLOSED
 * ------------------------------------------------------------------ */

function measureParsers(): void {
  for (const draft of ESCAPE_DRAFTS) {
    ok(
      `A-money:'${draft}'`,
      parseMoney(draft) === undefined,
      `rakamsız metin para değeri üretti → ${String(parseMoney(draft))}`,
    );
    const range = parseBudgetRange(draft);
    ok(
      `A-range:'${draft}'`,
      range.min === undefined && range.max === undefined,
      `rakamsız metin bütçe aralığı üretti → ${JSON.stringify(range)}`,
    );
    ok(
      `A-deadline:'${draft}'`,
      parseDeliveryDeadline(draft) === undefined,
      "rakamsız metin teslim tarihi üretti",
    );
  }

  /**
   * GERÇEK SAYISAL GİRDİ BOZULMAZ. `"0"` bilinçli bir cevaptır ve fail-closed
   * düzeltme onu sessizce düşüremez.
   */
  const REAL: readonly [string, number][] = [
    ["0", 0],
    ["15000", 15000],
    ["15.000", 15000],
    ["50 bin", 50_000],
    ["2 milyon", 2_000_000],
    ["₺15.000", 15000],
  ];
  for (const [raw, expected] of REAL) {
    ok(
      `A-real:'${raw}'`,
      parseMoney(raw) === expected,
      `gerçek sayısal girdi bozuldu → ${String(parseMoney(raw))} (beklenen ${expected})`,
    );
  }
  ok(
    "A-real-range",
    parseBudgetRange("0").min === 0 && parseBudgetRange("0").max === 0,
    "gerçek '0' bütçesi düştü",
  );
  ok(
    "A-real-deadline",
    parseDeliveryDeadline("10 gün") instanceof Date,
    "gerçek teslim süresi bozuldu",
  );
}

/* ------------------------------------------------------------------ *
 * 2. DEDICATED KOLON KARAR MATRİSİ
 * ------------------------------------------------------------------ */

type Decision = "set" | "clear" | "keep";

function classify(value: unknown): Decision {
  if (value === undefined) return "keep";
  if (value === null) return "clear";
  return "set";
}

function budgetDecision(input: {
  budget?: string;
  fields: RequestFieldInput[];
}): { min: Decision; max: Decision; value: unknown } {
  const out = resolveDedicatedBudget(input);
  return { min: classify(out.min), max: classify(out.max), value: out.min };
}

function measureDedicatedMatrix(): void {
  /* --- BÜTÇE --- */
  ok(
    "B-budget/absent",
    budgetDecision({ fields: [] }).min === "keep",
    "cevap yokken bütçe değiştirildi",
  );
  ok(
    "B-budget/VALUE",
    budgetDecision({ budget: "15000", fields: [field("budget", "VALUE", "15000")] })
      .value === 15000,
    "gerçek bütçe değeri kayboldu",
  );
  ok(
    "B-budget/zero",
    budgetDecision({ budget: "0", fields: [field("budget", "VALUE", "0")] })
      .value === 0,
    "gerçek '0' bütçesi kayboldu",
  );
  for (const mode of NON_VALUE_MODES) {
    for (const draft of ESCAPE_DRAFTS) {
      const d = budgetDecision({
        budget: draft,
        fields: [field("budget", mode)],
      });
      ok(
        `B-budget/${mode}/'${draft}'`,
        d.min === "clear" && d.max === "clear",
        `değer taşımayan cevapta bütçe temizlenmedi → ${d.min}/${d.max}`,
      );
    }
  }
  ok(
    "B-budget/INFERRED-yok",
    budgetDecision({ budget: "15000", fields: [] }).value === 15000,
    "cevap kanalı yokken mevcut parse davranışı bozuldu",
  );
  ok(
    "B-budget/gecersiz-mode",
    budgetDecision({ budget: "15000", fields: [field("budget", "MAYBE", "")] })
      .value === 15000,
    "geçersiz mod bütçeyi etkiledi",
  );

  /* --- ŞEHİR --- */
  ok(
    "B-city/absent",
    classify(resolveDedicatedCity({ fields: [] })) === "keep",
    "cevap yokken şehir değiştirildi",
  );
  ok(
    "B-city/VALUE",
    resolveDedicatedCity({
      city: "İstanbul",
      fields: [field("city", "VALUE", "İstanbul")],
    }) === "İstanbul",
    "gerçek şehir kayboldu",
  );
  for (const mode of NON_VALUE_MODES) {
    for (const draft of ESCAPE_DRAFTS) {
      const out = resolveDedicatedCity({
        city: draft,
        fields: [field("city", mode)],
      });
      ok(
        `B-city/${mode}/'${draft}'`,
        out === null,
        `değer taşımayan cevapta şehir temizlenmedi → ${JSON.stringify(out)}`,
      );
    }
  }
  /* Etiket hiçbir koşulda şehir ADI olarak saklanamaz. */
  for (const draft of ESCAPE_DRAFTS) {
    const out = resolveDedicatedCity({
      city: draft,
      fields: [field("city", "UNKNOWN")],
    });
    ok(
      `B-city-label:'${draft}'`,
      out !== draft,
      "kaçış etiketi şehir adı olarak saklandı",
    );
  }

  /* --- TESLİM --- */
  ok(
    "B-delivery/absent",
    classify(resolveDedicatedDeadline({ fields: [] })) === "keep",
    "cevap yokken teslim tarihi değiştirildi",
  );
  ok(
    "B-delivery/VALUE",
    resolveDedicatedDeadline({
      delivery: "10 gün",
      fields: [field("delivery", "VALUE", "10 gün")],
    }) instanceof Date,
    "gerçek teslim tarihi kayboldu",
  );
  for (const mode of NON_VALUE_MODES) {
    for (const draft of ESCAPE_DRAFTS) {
      const out = resolveDedicatedDeadline({
        delivery: draft,
        fields: [field("delivery", mode)],
      });
      ok(
        `B-delivery/${mode}/'${draft}'`,
        out === null,
        `değer taşımayan cevapta teslim tarihi temizlenmedi → ${JSON.stringify(out)}`,
      );
    }
  }
  ok(
    "B-delivery/gecersiz-tarih",
    classify(
      resolveDedicatedDeadline({
        delivery: "yakında",
        fields: [field("delivery", "VALUE", "yakında")],
      }),
    ) === "keep",
    "geçersiz tarih sahte tarih üretti",
  );
}

/* ------------------------------------------------------------------ *
 * 3. İSTEMCİ SAHTECİLİĞİ
 * ------------------------------------------------------------------ */

/**
 * Kolon temizliği YALNIZ doğrulanmış `fields[].mode` kararından doğar.
 * İstemcinin projection'a yazdığı `fieldResponses` ya da uydurma bir anahtar
 * hiçbir kolonu temizleyemez.
 */
function measureForgery(): void {
  const forged = [
    { id: "C1 sahte fieldResponses", fields: [] as RequestFieldInput[] },
    { id: "C2 uydurma anahtar", fields: [field("__hack__", "UNKNOWN")] },
    { id: "C3 iç kanıt anahtarı", fields: [field("brandCandidate", "UNKNOWN")] },
    { id: "C4 nesne modeli anahtarı", fields: [field("__proto__", "UNKNOWN")] },
    { id: "C5 geçersiz mod", fields: [field("budget", "USER_EXPLICIT")] },
    { id: "C6 başka alanın modu", fields: [field("energyClass", "UNKNOWN")] },
  ];
  for (const attack of forged) {
    const b = resolveDedicatedBudget({ budget: "15000", fields: attack.fields });
    ok(
      `${attack.id}/budget`,
      b.min === 15000,
      `sahte girdi bütçeyi etkiledi → ${JSON.stringify(b)}`,
    );
    const c = resolveDedicatedCity({ city: "İstanbul", fields: attack.fields });
    ok(
      `${attack.id}/city`,
      c === "İstanbul",
      `sahte girdi şehri etkiledi → ${JSON.stringify(c)}`,
    );
    const d = resolveDedicatedDeadline({
      delivery: "10 gün",
      fields: attack.fields,
    });
    ok(
      `${attack.id}/delivery`,
      d instanceof Date,
      `sahte girdi teslim tarihini etkiledi → ${JSON.stringify(d)}`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * 4. MUTASYONSUZ + İDEMPOTENT
 * ------------------------------------------------------------------ */

function measurePurity(): void {
  const input = {
    budget: "Teklifleri görmek istiyorum",
    city: "Konum fark etmez",
    delivery: "Esnek",
    fields: [
      field("budget", "UNKNOWN"),
      field("city", "ANY"),
      field("delivery", "NOT_APPLICABLE"),
    ],
  };
  const before = JSON.stringify(input);
  const first = [
    resolveDedicatedBudget(input),
    resolveDedicatedCity(input),
    resolveDedicatedDeadline(input),
  ];
  const second = [
    resolveDedicatedBudget(input),
    resolveDedicatedCity(input),
    resolveDedicatedDeadline(input),
  ];
  ok("D1", JSON.stringify(input) === before, "girdi mutate edildi");
  ok(
    "D2",
    JSON.stringify(first) === JSON.stringify(second),
    "idempotent değil",
  );
}

/* ------------------------------------------------------------------ *
 * 5. YAZMA YOLLARI KARARI GERÇEKTEN KULLANIYOR MU?
 * ------------------------------------------------------------------ */

/**
 * Karar saf fonksiyonlara alındı ki veritabanına yazmadan ölçülebilsin. Bu
 * yalnız yazma yolları O FONKSİYONLARI kullanıyorsa anlamlıdır; aksi hâlde
 * doğrulayıcı üretimde çalışmayan bir kopyayı ölçerdi.
 */
function measureWritePathWiring(): void {
  const HELPERS = [
    "resolveDedicatedBudget",
    "resolveDedicatedCity",
    "resolveDedicatedDeadline",
  ];
  for (const file of ["create-request.ts", "update-request.ts"]) {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src", "server", "request", file),
      "utf8",
    );
    for (const helper of HELPERS) {
      ok(
        `E:${file}/${helper}`,
        source.includes(helper),
        "yazma yolu kanonik kararı kullanmıyor",
      );
    }
    /**
     * Ham ayrıştırıcılar yazma yolunda DOĞRUDAN çağrılamaz: karar structured
     * moda bakmadan verilirse değer taşımayan cevap yine kolona sızardı.
     */
    ok(
      `E:${file}/ham-parse`,
      !/parseBudgetRange\(\s*input\.budget/.test(source) &&
        !/parseDeliveryDeadline\(\s*input\.delivery/.test(source),
      "yazma yolu ham ayrıştırıcıyı doğrudan çağırıyor",
    );
    ok(
      `E:${file}/ham-city`,
      !/city:\s*input\.city\b/.test(source),
      "şehir payload'dan doğrudan yazılıyor",
    );
  }
}

/* ------------------------------------------------------------------ *
 * 6. KNOWN-OPEN — ÇÖZÜLMEMİŞ, ÖLÇÜLMÜŞ
 * ------------------------------------------------------------------ */

function reportKnownOpen(): string[] {
  const notes: string[] = [];
  notes.push(
    `quantity: Request modelinde kolon YOK — cevap hiçbir yerde kalıcılaşmıyor ` +
      `(registry'de tanımlı: ${"quantity" in COMMON_FIELD_DEFAULTS})`,
  );
  notes.push(
    "title: Request.title NOT NULL — değer taşımayan cevap için fallback " +
      "kararı bu dilimde VERİLMEDİ",
  );
  notes.push(
    "RequestFieldValue.jsonValue.mode kalıcılığı (Dilim 3b) ve edit/reload " +
      "state kurulumu (Dilim 3c) yapılmadı",
  );
  notes.push(
    "clone davranışı DEĞİŞTİRİLMEDİ: dedicated kolonlar kaynaktan aynen " +
      "kopyalanır; kaynak temizse kopya da temizdir",
  );
  return notes;
}

/* ------------------------------------------------------------------ *
 * RAPOR
 * ------------------------------------------------------------------ */

function main(): void {
  console.log("===== ORTAK ALAN KALICILIK SINIRI V1 =====");

  measureParsers();
  measureDedicatedMatrix();
  measureForgery();
  measurePurity();
  measureWritePathWiring();

  console.log(`ESCAPE_DRAFTS=${ESCAPE_DRAFTS.length} MODES=${NON_VALUE_MODES.length}`);
  console.log(`PROBLEMS=${problems.length}`);
  console.log("\n--- KNOWN-OPEN (cozulmedi) ---");
  for (const note of reportKnownOpen()) console.log(`  - ${note}`);

  console.log("\n===== HUKUM =====");
  if (problems.length) {
    console.error("KIRMIZI — deger tasimayan cevap dedicated kolona sizyor:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    "YESIL — bilincli deger tasimayan cevap dedicated kolonlara sahte deger\n" +
      "yazmiyor: butce ve teslim tarihi temizleniyor, sehir null kaliyor ve\n" +
      "kacis etiketi hicbir kolonda saklanmiyor; gercek sayisal girdi ('0'\n" +
      "dahil) ve gercek sehir/tarih davranisi korunuyor; cevap gonderilmemisse\n" +
      "mevcut deger korunuyor; karar yalnizca dogrulanmis fields[].mode'dan\n" +
      "geliyor ve istemci sahteciligi hicbir kolonu temizleyemiyor; islem\n" +
      "mutasyonsuz ve idempotent; yazma yollari kanonik karari kullaniyor.\n" +
      "\nKAPSAM DISI: jsonValue.mode kaliciligi (3b), edit/reload (3c), clone\n" +
      "geri yukleme, quantity kolonu ve title karari.",
  );
  process.exit(0);
}

main();
