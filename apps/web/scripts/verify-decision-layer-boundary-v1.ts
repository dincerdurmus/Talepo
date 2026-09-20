/**
 * KARAR KATMANI SINIRI V1 (2026-09-20).
 *
 * NEDEN VAR. Single Brain karar motorlarını (kategori kapısı, kanonik varlık
 * çözücü, ürün kimliği kurucusu) doğrudan import ediyordu; karar katmanı bu
 * üç kararı bir sözleşmenin (request-decisions/contract) arkasına aldı ve
 * ilk sağlayıcı mevcut motorların kendisi oldu. Bu doğrulayıcı O SINIRIN
 * kapısıdır: sınır sessizce delinirse, sağlayıcı sessizce ikinci bir beyin
 * olursa ya da sözleşme yüzeyi sessizce büyürse kırmızı verir.
 *
 * BÖLÜMLER
 *   §1 Sözleşme yüzeyi — sağlayıcı TAM üç yetenek + ad taşır; sessiz yetenek
 *      birikimi (devasa DecisionEngine'e sürüklenme) kırmızıdır.
 *   §2 Delegasyon kimliği — sağlayıcı çıktısı, sarılan motorun çıktısıyla
 *      1077 vakalık korpusun örneklemi üzerinde BİREBİR aynıdır. Sağlayıcının
 *      içine giren tek bir karar satırı bile burada görünür.
 *   §3 Sınır — understand-request artık bu üç kararı doğrudan çağırmaz;
 *      sözleşme üzerinden alır. Doğrudan import geri gelirse kırmızı.
 *   §4 Sağlayıcı saflığı — builtin-provider dosyasında karar mantığı yoktur
 *      (if/switch/regex yasak); sağlayıcı yalnız delege eder.
 *
 * Davranış kapısı DEĞİLDİR: davranışı verify-brain-adversarial-corpus-v1 ve
 * verify-discovery-quality-v1 ölçer. Burası mimari sınırın kapısıdır.
 */
process.env.DATABASE_URL ??=
  "postgresql://verifier:verifier@127.0.0.1:5432/verifier";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildAdversarialCorpus } from "./fixtures/brain-adversarial-corpus-v1";
import { getRequestDecisionProvider } from "../src/lib/request-decisions/get-provider";
import { gateCategory } from "../src/lib/request-understanding/category-gate";
import { resolveDomainEntity } from "../src/lib/catalog";
import { buildProductIdentity } from "../src/lib/product-identity/identity-builder";
import type { RequestIntent } from "../src/lib/request-understanding/types";

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

const provider = getRequestDecisionProvider();
const WEB = join(__dirname, "..");
const brainSource = readFileSync(
  join(WEB, "src/lib/request-understanding/understand-request.ts"),
  "utf8",
);
const providerSource = readFileSync(
  join(WEB, "src/lib/request-decisions/builtin-provider.ts"),
  "utf8",
);

// ---------------------------------------------------------------- §1 yüzey
check("§1 sağlayıcı adı boş değil", () => {
  assert.ok(provider.name.trim().length > 0);
});

check("§1 sözleşme yüzeyi tam üç yetenek + ad (sessiz büyüme yok)", () => {
  const keys = Object.keys(provider).sort();
  assert.deepEqual(keys, [
    "buildProductIdentity",
    "decideRequestCategory",
    "name",
    "resolveCanonicalEntity",
  ]);
});

// ------------------------------------------------------- §2 delegasyon kimliği
/**
 * Örneklem: korpusun her 10. vakası (deterministik, ~108 vaka) + lossy
 * varyantlar dahil. Niyet ekseni beynin kendi çözümüne bağlanmaz (mantık
 * kopyası olurdu); sabit niyet kümesiyle her metin × her niyet karşılaştırılır.
 */
const corpus = buildAdversarialCorpus();
const sample = corpus.filter((_, i) => i % 10 === 0);
const INTENTS: RequestIntent[] = ["BUY", "RENT", "SERVICE", "PART", "UNKNOWN"];

check(`§2 kategori kararı: örneklem ${sample.length} vaka × ${INTENTS.length} niyet birebir`, () => {
  for (const c of sample) {
    for (const intent of INTENTS) {
      assert.deepEqual(
        provider.decideRequestCategory({ text: c.input, intent }),
        gateCategory(c.input, intent),
        `sapan vaka: ${c.id} intent=${intent}`,
      );
    }
  }
});

check(`§2 kanonik varlık kararı: örneklem ${sample.length} vaka birebir`, () => {
  for (const c of sample) {
    assert.deepEqual(
      provider.resolveCanonicalEntity({ text: c.input }),
      resolveDomainEntity(c.input),
      `sapan vaka: ${c.id}`,
    );
  }
});

check(`§2 ürün kimliği kararı: örneklem ${sample.length} vaka × 3 kategori birebir`, () => {
  for (const c of sample) {
    for (const slug of ["technology", "automotive", "unknown"]) {
      assert.deepEqual(
        provider.buildProductIdentity({
          categoryId: slug,
          categorySlug: slug,
          title: c.input,
        }),
        buildProductIdentity({
          categoryId: slug,
          categorySlug: slug,
          title: c.input,
        }),
        `sapan vaka: ${c.id} slug=${slug}`,
      );
    }
  }
});

// ---------------------------------------------------------------- §3 sınır
check("§3 beyin kategori kararını doğrudan çağırmaz (gateCategory yok)", () => {
  assert.ok(
    !/\bgateCategory\b/.test(brainSource),
    "understand-request.ts gateCategory'ye doğrudan dokunuyor",
  );
});

check("§3 beyin kanonik varlığı doğrudan çözmez (resolveDomainEntity yok)", () => {
  assert.ok(
    !/\bresolveDomainEntity\b/.test(brainSource),
    "understand-request.ts resolveDomainEntity'yi doğrudan çağırıyor",
  );
});

check("§3 beyin ürün kimliğini doğrudan kurmaz (buildProductIdentity import'u yok)", () => {
  assert.ok(
    !/import[^;]*\bbuildProductIdentity\b[^;]*from\s*["']@\/lib\/product-identity\/identity-builder["']/.test(
      brainSource,
    ),
    "understand-request.ts identity-builder'ı doğrudan import ediyor",
  );
});

check("§3 beyin kararları sözleşmeden alır (getRequestDecisionProvider bağlı)", () => {
  assert.ok(
    /\bgetRequestDecisionProvider\b/.test(brainSource),
    "understand-request.ts karar sağlayıcısını hiç kullanmıyor",
  );
  const count = (re: RegExp) => (brainSource.match(re) ?? []).length;
  assert.equal(
    count(/\.decideRequestCategory\(/g),
    2,
    "kategori kararının beyinde tam iki çağrı noktası olmalı (ana + kullanım-bağlamı hedefi)",
  );
  assert.equal(count(/\.resolveCanonicalEntity\(/g), 1);
  assert.equal(count(/\.buildProductIdentity\(/g), 1);
});

// ------------------------------------------------------ §4 sağlayıcı saflığı
check("§4 yerleşik sağlayıcıda karar mantığı yok (if/switch/regex yasak)", () => {
  const body = providerSource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  assert.ok(!/\bif\s*\(/.test(body), "sağlayıcıya if girmiş — delegasyon bozuluyor");
  assert.ok(!/\bswitch\s*\(/.test(body), "sağlayıcıya switch girmiş");
  assert.ok(!/\bcase\s+/.test(body), "sağlayıcıya case girmiş");
  assert.ok(!/[^/]\/(?![/*])[^\n/]*\/[gimsuy]*\.test\(/.test(body), "sağlayıcıya regex kararı girmiş");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
