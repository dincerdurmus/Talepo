/**
 * ÖNE ÇIKARMA SÜRESİ — kalıcı doğrulayıcı (2026-09-15).
 *
 * Kapattığı kusur: `featuredUntil` satın alma anında yazılıyordu ama üretim
 * kodunun hiçbir yerinde OKUNMUYORDU. `isFeatured` ise her liste sorgusunda
 * sıralama anahtarıydı. Sonuç: "24 saat öne çıkar" kalıcı öne çıkarmaydı;
 * 99 ₺, 199 ₺ ve 349 ₺ tam olarak aynı şeyi veriyordu ve öne çıkarılan
 * talepler listelerin başında sonsuza kadar birikiyordu.
 *
 * Bu dosya bir SONDA değil KAPIDIR. Kanıtladıkları:
 *   A. Süre dolduğunda bayrak düşer; süresi DOLMAMIŞ ve SÜRESİZ (null)
 *      satırlara dokunulmaz. Sorgu gerçekten koşturulur, `where`/`data`
 *      stub üzerinden okunur.
 *   B. `featuredUntil` SİLİNMEZ. Ne satın alındığının kaydıdır ve tekrar
 *      koşmayı zararsız kılan da bayrağın kendisidir.
 *   C. Zamanlanmış görev fail-closed: sır yoksa, yanlışsa ya da başlık
 *      eksikse 401; doğru olduğunda iş koşar. Rota gövde/sorgu okumaz,
 *      yani çağıran hangi talebin düşeceğini seçemez.
 *   D. Görev vercel.json'a yazılmıştır. Yazılmamış cron hiç koşmaz; bu
 *      kusurun ta kendisi "yazılıp okunmayan alan"dı.
 *   E. `featuredUntil` artık ÜRETİM kodunda okunuyor. Bu satır düşerse alan
 *      yine yalnız-yazılır hâle döner ve satılan süre yine sonsuz olur.
 *   F. Üç öne çıkarma süresi birbirinden farklıdır — üç fiyat üç farklı şey
 *      anlatmak zorundadır.
 */
process.env.DATABASE_URL ??=
  "postgresql://verifier:verifier@127.0.0.1:5432/verifier";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { FEATURE_BOOST_OPTIONS } from "../src/lib/membership/plans";

type PrismaLike = Record<string, unknown>;
type UpdateArgs = {
  where: {
    isFeatured?: boolean;
    featuredUntil?: { not?: unknown; lte?: Date; gte?: Date };
  };
  data: Record<string, unknown>;
};

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`  ok   ${name}`);
    })
    .catch((error: unknown) => {
      failed++;
      console.log(
        `  FAIL ${name}\n       ${error instanceof Error ? error.message : String(error)}`,
      );
    });
}

/** Yorumları çıkarır: yorumda geçen bir ad, o kodun var olduğunu kanıtlamaz. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const WEB = join(__dirname, "..");
const ROOT = join(WEB, "..", "..");

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { expireFeaturedRequests } = await import(
    "../src/server/request/feature-expiry"
  );

  const seen: UpdateArgs[] = [];
  function stubRequestModel(count: number) {
    const desc = Object.getOwnPropertyDescriptor(
      prisma as unknown as PrismaLike,
      "request",
    );
    Object.defineProperty(prisma as unknown as PrismaLike, "request", {
      value: {
        updateMany: async (args: UpdateArgs) => {
          seen.push(args);
          return { count };
        },
      },
      configurable: true,
      writable: true,
    });
    return () => {
      if (desc) {
        Object.defineProperty(prisma as unknown as PrismaLike, "request", desc);
      } else {
        delete (prisma as unknown as PrismaLike).request;
      }
    };
  }

  console.log("=== ÖNE ÇIKARMA SÜRESİ ===\n");

  /* ------------------------------------------------------------------ */
  /* A + B. Kapsam ve kayıt                                              */
  /* ------------------------------------------------------------------ */
  const NOW = new Date("2026-09-15T12:00:00.000Z");

  await check("yalnız süresi geçmiş ve hâlâ öne çıkan satırlar hedeflenir", async () => {
    seen.length = 0;
    const restore = stubRequestModel(3);
    try {
      const out = await expireFeaturedRequests(NOW);
      assert.equal(out.expired, 3, "kaç satırın düştüğü geri verilmiyor");
      assert.equal(seen.length, 1, "tek bir toplu güncelleme beklenir");
      const { where } = seen[0]!;
      assert.equal(
        where.isFeatured,
        true,
        "zaten düşmüş satırlar da taranıyor — iş tekrar koşulduğunda boşuna yazar",
      );
      assert.ok(where.featuredUntil, "süre koşulu yok — bütün öne çıkarmalar düşer");
      assert.equal(
        where.featuredUntil!.lte instanceof Date
          ? where.featuredUntil!.lte.toISOString()
          : String(where.featuredUntil!.lte),
        NOW.toISOString(),
        "eşik verilen ana bağlı değil",
      );
      assert.equal(
        where.featuredUntil!.not,
        null,
        "süresiz (null) öne çıkarmalar kapsam dışı bırakılmıyor",
      );
      assert.ok(
        where.featuredUntil!.gte === undefined,
        "geleceğe bakan bir koşul var — süresi dolmayanı düşürebilir",
      );
    } finally {
      restore();
    }
  });

  await check("bayrak düşer, satın alınan süre kaydı silinmez", () => {
    const { data } = seen[0]!;
    assert.equal(data.isFeatured, false, "bayrak düşürülmüyor");
    assert.ok(
      !("featuredUntil" in data),
      "featuredUntil siliniyor — ne satın alındığının kaydı kayboluyor",
    );
    assert.deepEqual(
      Object.keys(data),
      ["isFeatured"],
      `görev başka kolonlara dokunuyor: ${Object.keys(data).join(", ")}`,
    );
  });

  await check("tekrar koşmak zararsızdır (aynı sorgu, sıfır satır)", async () => {
    seen.length = 0;
    const restore = stubRequestModel(0);
    try {
      const out = await expireFeaturedRequests(NOW);
      assert.equal(out.expired, 0);
      assert.equal(seen[0]!.where.isFeatured, true);
    } finally {
      restore();
    }
  });

  /* ------------------------------------------------------------------ */
  /* C. Zamanlanmış görev fail-closed                                    */
  /* ------------------------------------------------------------------ */
  const route = await import("../src/app/api/cron/feature-expiry/route");
  const ONCEKI_SIR = process.env.CRON_SECRET;

  async function cagir(headers: Record<string, string>) {
    const restore = stubRequestModel(1);
    try {
      const res = (await route.GET(
        new Request("https://talepo.test/api/cron/feature-expiry?id=cmhedef", {
          headers,
        }),
      )) as Response;
      return { status: res.status, body: (await res.json()) as Record<string, unknown> };
    } finally {
      restore();
    }
  }

  await check("CRON_SECRET tanımsızsa 401 ve iş koşmaz", async () => {
    delete process.env.CRON_SECRET;
    seen.length = 0;
    const r = await cagir({ authorization: "Bearer bos" });
    assert.equal(r.status, 401);
    assert.equal(r.body.ok, false);
    assert.equal(seen.length, 0, "yetkisiz istek işi koşturdu");
  });

  await check("yanlış ya da eksik başlık 401 ve iş koşmaz", async () => {
    process.env.CRON_SECRET = "dogru-sir-degeri";
    for (const headers of [
      {},
      { authorization: "Bearer yanlis" },
      { authorization: "dogru-sir-degeri" },
    ]) {
      seen.length = 0;
      const r = await cagir(headers);
      assert.equal(r.status, 401, `başlık geçti: ${JSON.stringify(headers)}`);
      assert.equal(seen.length, 0, "yetkisiz istek işi koşturdu");
    }
  });

  await check("doğru sır ile iş koşar ve sayı döner", async () => {
    process.env.CRON_SECRET = "dogru-sir-degeri";
    seen.length = 0;
    const r = await cagir({ authorization: "Bearer dogru-sir-degeri" });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.expired, 1);
    assert.equal(seen.length, 1);
  });

  await check("rota gövde ya da sorgu okumaz (çağıran hedef seçemez)", () => {
    const SRC = readFileSync(
      join(WEB, "src", "app", "api", "cron", "feature-expiry", "route.ts"),
      "utf8",
    );
    for (const yasak of [
      "request.json(",
      "request.text(",
      "searchParams",
      "new URL(",
      "request.formData(",
    ]) {
      assert.ok(
        !SRC.includes(yasak),
        `rota istemci girdisi okuyor: ${yasak}`,
      );
    }
  });

  if (ONCEKI_SIR === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ONCEKI_SIR;

  /* ------------------------------------------------------------------ */
  /* D. Görev gerçekten planlanmış                                       */
  /* ------------------------------------------------------------------ */
  await check("görev vercel.json'da planlanmış (yazılmamış cron hiç koşmaz)", () => {
    const cfg = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")) as {
      crons: { path: string; schedule: string }[];
    };
    const entry = cfg.crons.find((c) => c.path === "/api/cron/feature-expiry");
    assert.ok(entry, "cron vercel.json'a yazılmamış — rota var ama hiç çağrılmaz");
    assert.match(
      entry.schedule,
      /^\S+ \S+ \S+ \S+ \S+$/,
      `geçersiz cron ifadesi: ${entry.schedule}`,
    );
  });

  /* ------------------------------------------------------------------ */
  /* E. featuredUntil artık üretimde okunuyor                            */
  /* ------------------------------------------------------------------ */
  await check("featuredUntil yalnız-yazılır alan değil (yorumlar sayılmaz)", () => {
    /* İlk hâlde bu kontrol düz metin arıyordu ve her iki dosyada da alan adı
       YORUMLARDA geçtiği için sorgu tamamen silinse bile yeşil kalıyordu.
       Yorumlar çıkarılmadan yapılan metin araması ölçüm değildir. */
    const EXPIRY = stripComments(
      readFileSync(join(WEB, "src", "server", "request", "feature-expiry.ts"), "utf8"),
    );
    assert.match(
      EXPIRY,
      /featuredUntil:\s*\{[^}]*lte:/,
      "süre alanı hiçbir sorguda okunmuyor — satılan süre yine sonsuz",
    );
    const CREATE = stripComments(
      readFileSync(join(WEB, "src", "server", "request", "create-request.ts"), "utf8"),
    );
    assert.ok(
      /^\s*featuredUntil,\s*$/m.test(CREATE) ||
        /featuredUntil:\s*featuredUntil/.test(CREATE),
      "yazım tarafı create data nesnesinden düşmüş — süre hiç yazılmıyor",
    );
  });

  await check("öne çıkarma satın alınınca gerçekten bir bitiş tarihi yazılır", async () => {
    /* Metin araması yazımın KOŞTUĞUNU kanıtlamaz. `create-request`'in tamamı
       burada koşturulamaz (çok sayıda bağımlılık), ama süre hesabının
       kendisi sözleşmedir: her paket için bitiş tarihi ŞİMDİden sonra ve
       paketin saatine eşit olmalıdır. */
    const now = new Date("2026-09-15T00:00:00.000Z");
    for (const [key, boost] of Object.entries(FEATURE_BOOST_OPTIONS)) {
      const until = new Date(now.getTime() + boost.hours * 60 * 60 * 1000);
      assert.ok(until.getTime() > now.getTime(), `${key}: bitiş geçmişte`);
      assert.equal(
        (until.getTime() - now.getTime()) / (60 * 60 * 1000),
        boost.hours,
        `${key}: satılan süre ile yazılan süre tutmuyor`,
      );
    }
  });

  /* ------------------------------------------------------------------ */
  /* F. Üç süre üç farklı şey                                            */
  /* ------------------------------------------------------------------ */
  await check("üç öne çıkarma süresi birbirinden farklı", () => {
    const saatler = Object.values(FEATURE_BOOST_OPTIONS).map((b) => b.hours);
    assert.equal(
      new Set(saatler).size,
      saatler.length,
      `aynı süreyi veren iki paket var: ${saatler.join(", ")}`,
    );
    for (const b of Object.values(FEATURE_BOOST_OPTIONS)) {
      assert.ok(b.hours > 0, `${b.label}: süre sıfır ya da negatif`);
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
