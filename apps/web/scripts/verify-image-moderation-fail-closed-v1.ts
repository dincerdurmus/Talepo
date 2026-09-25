/**
 * GÖRSEL MODERASYONU HATA DURUMUNDA KAPALI KALIR (L4).
 *
 * Neden var (prompt denetimi, 2026-09-25): `moderate-message-image.ts` içindeki
 * yorum "Fail closed" diyordu, kod ise sağlayıcı hatası, zaman aşımı ve
 * beklenmeyen/eksik yanıt yollarının ÜÇÜNDE de `ok: true` dönüyordu. Yani
 * denetlenemeyen bir görsel, denetlenmiş görselle aynı yoldan mesaja
 * yazılıyordu. Bir kapı, hata anında açılıyorsa kapı değildir.
 *
 * NE ÖLÇÜLÜR: gerçek üretim fonksiyonu `moderateMessageImage`. Burada karar
 * kopyası kurulmaz; yalnız ağ sınırı (`globalThis.fetch`) ve yapılandırma
 * (`OPENAI_API_KEY`) taklit edilir.
 *
 * KAPILAR
 *   1. Hata yolları KAPALI: sağlayıcı HTTP hatası, fetch'in fırlatması
 *      (zaman aşımı), ayrıştırılamayan gövde, eksik karar, moderations ucunun
 *      hata vermesi ve moderations yanıtının eksik olması.
 *   2. Yapılandırma eksikse (anahtar yok) yine KAPALI — üretimde sessizce
 *      açılmaz.
 *   3. Mutlu yol ve gerçek retler DEĞİŞMEDİ: temiz görsel geçer, müstehcen ve
 *      alakasız kararlar kendi gerekçeleriyle reddedilir.
 *   4. SIZINTI YOK: hiçbir log satırı görselin data URL'ini ya da base64
 *      gövdesini taşımaz.
 *
 * Veritabanı, ağ ve sır gerekmez.
 */
import assert from "node:assert/strict";

import {
  moderateMessageImage,
  type ImageModerationContext,
} from "../src/server/message/moderate-message-image";

/* ------------------------------------------------------------------ */
/* Sabit girdiler                                                       */
/* ------------------------------------------------------------------ */

/** 64×32 boyut alanı doğru okunan, sihirli baytları geçerli minimal PNG. */
function pngDataUrl(): string {
  const buffer = Buffer.alloc(64);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(64, 16);
  buffer.writeUInt32BE(64, 20);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

const DATA_URL = pngDataUrl();
const BASE64_BODY = DATA_URL.split(",")[1] ?? "";

const CONTEXT: ImageModerationContext = {
  requestTitle: "Klima montaj hizmeti",
  categoryName: "Hizmetler",
  city: "İstanbul",
  caption: null,
  fileName: "montaj-fotografi.jpg",
};

const MODERATIONS_URL = "https://api.openai.com/v1/moderations";

/* ------------------------------------------------------------------ */
/* Sahte ağ sınırı                                                      */
/* ------------------------------------------------------------------ */

type StubStep =
  | { kind: "json"; status?: number; body: unknown }
  | { kind: "text"; status?: number; body: string }
  | { kind: "status"; status: number }
  | { kind: "throw"; error: Error };

function respond(step: StubStep): Response {
  if (step.kind === "throw") throw step.error;
  const status = step.status ?? 200;
  const ok = status >= 200 && status < 300;
  const payload =
    step.kind === "json" ? JSON.stringify(step.body) : step.kind === "text" ? step.body : "";
  return {
    ok,
    status,
    json: async () => JSON.parse(payload) as unknown,
    text: async () => payload,
  } as unknown as Response;
}

const realFetch = globalThis.fetch;
const realWarn = console.warn;
const realError = console.error;

let loggedLines: string[] = [];

function installStub(plan: { moderations: StubStep; vision: StubStep }) {
  loggedLines = [];
  console.warn = (...args: unknown[]) => {
    loggedLines.push(args.map((a) => String(a)).join(" "));
  };
  console.error = (...args: unknown[]) => {
    loggedLines.push(args.map((a) => String(a)).join(" "));
  };
  globalThis.fetch = (async (input: unknown) => {
    const url = typeof input === "string" ? input : String((input as { url?: string })?.url ?? input);
    const step = url.startsWith(MODERATIONS_URL) ? plan.moderations : plan.vision;
    return respond(step);
  }) as typeof globalThis.fetch;
}

function restore() {
  globalThis.fetch = realFetch;
  console.warn = realWarn;
  console.error = realError;
}

const CLEAN_MODERATIONS: StubStep = {
  kind: "json",
  body: { results: [{ flagged: false, categories: {} }] },
};

function visionVerdict(body: Record<string, unknown>): StubStep {
  return {
    kind: "json",
    body: { choices: [{ message: { content: JSON.stringify(body) } }] },
  };
}

/* ------------------------------------------------------------------ */
/* Koşucu                                                              */
/* ------------------------------------------------------------------ */

const results: Array<{ name: string; passed: boolean; error?: string }> = [];
const cases: Array<{ name: string; body: () => Promise<void> }> = [];

/** Sıra korunur: iki koşunun raporu karşılaştırılabilir kalsın. */
function test(name: string, body: () => Promise<void>) {
  cases.push({ name, body });
}

async function moderateWith(
  plan: { moderations: StubStep; vision: StubStep },
  options?: { apiKey?: string | null },
) {
  const previousKey = process.env.OPENAI_API_KEY;
  const key = options && "apiKey" in options ? options.apiKey : "sk-test-anahtar";
  if (key === null || key === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = key;

  installStub(plan);
  try {
    return await moderateMessageImage(DATA_URL, CONTEXT);
  } finally {
    restore();
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
}

function assertClosed(
  result: Awaited<ReturnType<typeof moderateMessageImage>>,
  label: string,
) {
  assert.equal(result.ok, false, `${label}: görsel hata yolunda YAYINA ÇIKTI (fail-open)`);
  if (result.ok) return;
  assert.equal(
    result.reason,
    "unavailable",
    `${label}: hata yolu "unavailable" gerekçesiyle kapanmalı`,
  );
  assert.match(
    result.message,
    /kontrol edilemedi/i,
    `${label}: kullanıcıya nazik "şu an kontrol edilemedi" mesajı gösterilmeli`,
  );
}

function assertNoImageLeak(label: string) {
  for (const line of loggedLines) {
    assert.ok(
      !line.includes(DATA_URL) && !line.includes(BASE64_BODY),
      `${label}: log satırı görsel içeriğini taşıyor`,
    );
  }
}

/* --- 1. Hata yolları ---------------------------------------------- */

test("sağlayıcı hatası (vision HTTP 500) görseli geçirmez", async () => {
  const result = await moderateWith({
    moderations: CLEAN_MODERATIONS,
    vision: { kind: "status", status: 500 },
  });
  assertClosed(result, "vision 500");
  assertNoImageLeak("vision 500");
});

test("zaman aşımı (fetch fırlatıyor) görseli geçirmez", async () => {
  const timeout = new Error("The operation was aborted due to timeout");
  timeout.name = "TimeoutError";
  const result = await moderateWith({
    moderations: CLEAN_MODERATIONS,
    vision: { kind: "throw", error: timeout },
  });
  assertClosed(result, "zaman aşımı");
  assertNoImageLeak("zaman aşımı");
});

test("ayrıştırılamayan yanıt gövdesi görseli geçirmez", async () => {
  const result = await moderateWith({
    moderations: CLEAN_MODERATIONS,
    vision: { kind: "json", body: { choices: [{ message: { content: "JSON değil" } }] } },
  });
  assertClosed(result, "bozuk gövde");
  assertNoImageLeak("bozuk gövde");
});

test("eksik yanıt (karar alanı yok) görseli geçirmez", async () => {
  const result = await moderateWith({
    moderations: CLEAN_MODERATIONS,
    vision: { kind: "json", body: {} },
  });
  assertClosed(result, "eksik karar");
  assertNoImageLeak("eksik karar");
});

test("moderations ucu hata verirse görsel geçmez", async () => {
  const result = await moderateWith({
    moderations: { kind: "status", status: 503 },
    vision: visionVerdict({ safe: true, relevant: true, reason: "ok", detail: "uygun" }),
  });
  assertClosed(result, "moderations 503");
  assertNoImageLeak("moderations 503");
});

test("moderations yanıtı eksikse görsel geçmez", async () => {
  const result = await moderateWith({
    moderations: { kind: "json", body: {} },
    vision: visionVerdict({ safe: true, relevant: true, reason: "ok", detail: "uygun" }),
  });
  assertClosed(result, "moderations eksik");
  assertNoImageLeak("moderations eksik");
});

/* --- 2. Yapılandırma eksik ---------------------------------------- */

test("moderasyon anahtarı yoksa görsel yine geçmez", async () => {
  const result = await moderateWith(
    {
      moderations: CLEAN_MODERATIONS,
      vision: visionVerdict({ safe: true, relevant: true, reason: "ok", detail: "uygun" }),
    },
    { apiKey: null },
  );
  assertClosed(result, "anahtar yok");
  assertNoImageLeak("anahtar yok");
});

test("anahtar yokken olay sessiz kalmaz — loglanır", async () => {
  const previousEnv = process.env.NODE_ENV;
  try {
    const result = await moderateWith(
      {
        moderations: CLEAN_MODERATIONS,
        vision: visionVerdict({ safe: true, relevant: true, reason: "ok", detail: "uygun" }),
      },
      { apiKey: null },
    );
    assert.equal(result.ok, false);
    assert.ok(
      loggedLines.length > 0,
      "yapılandırma eksikken karar sessizce alınamaz; en az bir uyarı loglanmalı",
    );
  } finally {
    if (previousEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnv;
  }
});

/* --- 3. Değişmemesi gerekenler ------------------------------------ */

test("temiz görsel yayına çıkmaya devam eder", async () => {
  const result = await moderateWith({
    moderations: CLEAN_MODERATIONS,
    vision: visionVerdict({ safe: true, relevant: true, reason: "ok", detail: "uygun" }),
  });
  assert.equal(result.ok, true, "temiz görsel reddedilmemeli");
  if (result.ok) assert.equal(result.mimeType, "image/png");
});

test("müstehcen karar kendi gerekçesiyle reddedilir", async () => {
  const result = await moderateWith({
    moderations: {
      kind: "json",
      body: { results: [{ flagged: true, categories: { sexual: true } }] },
    },
    vision: visionVerdict({ safe: true, relevant: true, reason: "ok", detail: "uygun" }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "obscene");
});

test("alakasız karar kendi gerekçesiyle reddedilir", async () => {
  const result = await moderateWith({
    moderations: CLEAN_MODERATIONS,
    vision: visionVerdict({
      safe: true,
      relevant: false,
      reason: "irrelevant",
      detail: "alakasız",
    }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "irrelevant");
});

test("yapısal ret (geçersiz görsel) hata yoluna karışmaz", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-test-anahtar";
  installStub({
    moderations: CLEAN_MODERATIONS,
    vision: visionVerdict({ safe: true, relevant: true, reason: "ok", detail: "uygun" }),
  });
  try {
    const result = await moderateMessageImage("data:image/png;base64,Z2Vs", CONTEXT);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "invalid");
  } finally {
    restore();
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

/* ------------------------------------------------------------------ */

async function main() {
  for (const item of cases) {
    try {
      await item.body();
      results.push({ name: item.name, passed: true });
    } catch (error) {
      results.push({ name: item.name, passed: false, error: String(error) });
    } finally {
      restore();
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);

  for (const failure of failed) {
    console.log(`KIRMIZI — ${failure.name}\n    ${failure.error}`);
  }

  console.log(
    `verify-image-moderation-fail-closed-v1: ${passed} passed, ${failed.length} failed`,
  );

  if (failed.length > 0) process.exitCode = 1;
}

void main();
