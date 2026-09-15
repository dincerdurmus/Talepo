/**
 * OTURUM ŞİFRE DÖNEMİ — kalıcı doğrulayıcı (2026-09-15).
 *
 * Ölçülen kusur: şifre sıfırlama ve değiştirme MEVCUT OTURUMLARI
 * DÜŞÜRMÜYORDU. Oturum JWT ve 30 gün; hesabı ele geçirilmiş kullanıcı
 * şifresini sıfırlasa bile saldırganın oturumu çalışmaya devam ediyordu.
 *
 * Burada ölçülen dört güvence:
 *   1. Parmak izi ham şifre özetini TAŞIMAZ.
 *   2. Şifre değişince parmak izi DEĞİŞİR (oturum ölür).
 *   3. Şifresiz (sosyal giriş) hesapta kontrol HİÇ çalışmaz.
 *   4. Veritabanı okunamazsa oturum DÜŞÜRÜLMEZ — bilinçli fail-open;
 *      kesin uyuşmazlık ise her zaman kapatır.
 */
process.env.DATABASE_URL ??= "postgresql://p:p@127.0.0.1:5432/p";
process.env.NEXTAUTH_SECRET = "test-secret-at-least-16-chars-long";

import assert from "node:assert/strict";
import { hashPassword } from "../src/lib/auth/password";

let pass = 0;
let fail = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      pass += 1;
      console.log("PASS  " + name);
    })
    .catch((e: Error) => {
      fail += 1;
      console.log("FAIL  " + name + " :: " + e.message.slice(0, 140));
    });
}

(async () => {
  const mod = await import("../src/lib/auth/session-password-epoch");
  const { passwordEpoch, checkPasswordEpoch } = mod;

  const hashA = hashPassword("EskiSifre123!");
  const hashB = hashPassword("YeniSifre456!");

  await check("parmak izi uretiliyor", () => {
    assert.ok(passwordEpoch(hashA));
  });

  await check("parmak izi HAM ozeti tasimaz", () => {
    const e = passwordEpoch(hashA)!;
    assert.ok(!e.includes(hashA));
    assert.ok(!hashA.includes(e));
    assert.ok(e.length <= 16, "parmak izi kisa olmali");
  });

  await check("ayni ozet ayni parmak izi (oturum bosuna olmez)", () => {
    assert.equal(passwordEpoch(hashA), passwordEpoch(hashA));
  });

  await check("sifre degisince parmak izi DEGISIR (oturum olur)", () => {
    assert.notEqual(passwordEpoch(hashA), passwordEpoch(hashB));
  });

  await check("ayni sifre yeniden hashlenince de DEGISIR (tuz rastgele)", () => {
    assert.notEqual(
      passwordEpoch(hashA),
      passwordEpoch(hashPassword("EskiSifre123!")),
    );
  });

  await check("sifresiz hesapta parmak izi yok", () => {
    assert.equal(passwordEpoch(null), null);
  });

  await check("sir yoksa parmak izi URETILMEZ (sabit sirra dusmez)", () => {
    const saved = process.env.NEXTAUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    const e = passwordEpoch(hashA);
    process.env.NEXTAUTH_SECRET = saved;
    assert.equal(e, null);
  });

  await check("jetonda donem yoksa kontrol HIC calismaz", async () => {
    const r = await checkPasswordEpoch({ userId: "u-1", tokenEpoch: undefined });
    assert.equal(r.state, "no_password");
  });

  await check("veritabani okunamazsa oturum DUSURULMEZ", async () => {
    const { prisma } = await import("../src/lib/prisma");
    const p = prisma as unknown as Record<string, unknown>;
    const saved = p.user;
    p.user = {
      findUnique: () => Promise.reject(new Error("db down")),
    };
    const r = await checkPasswordEpoch({ userId: "u-1", tokenEpoch: "abc" });
    p.user = saved;
    assert.equal(r.state, "unavailable");
  });

  await check("ozet degismisse UYUSMAZLIK (oturum kapanir)", async () => {
    const { prisma } = await import("../src/lib/prisma");
    const p = prisma as unknown as Record<string, unknown>;
    const saved = p.user;
    p.user = { findUnique: () => Promise.resolve({ passwordHash: hashB }) };
    const r = await checkPasswordEpoch({
      userId: "u-1",
      tokenEpoch: passwordEpoch(hashA)!,
    });
    p.user = saved;
    assert.equal(r.state, "mismatch");
  });

  await check("ozet ayniysa oturum YASAR", async () => {
    const { prisma } = await import("../src/lib/prisma");
    const p = prisma as unknown as Record<string, unknown>;
    const saved = p.user;
    p.user = { findUnique: () => Promise.resolve({ passwordHash: hashA }) };
    const r = await checkPasswordEpoch({
      userId: "u-1",
      tokenEpoch: passwordEpoch(hashA)!,
    });
    p.user = saved;
    assert.equal(r.state, "match");
  });

  await check("sifre kaldirilmissa oturum KAPANIR", async () => {
    const { prisma } = await import("../src/lib/prisma");
    const p = prisma as unknown as Record<string, unknown>;
    const saved = p.user;
    p.user = { findUnique: () => Promise.resolve({ passwordHash: null }) };
    const r = await checkPasswordEpoch({
      userId: "u-1",
      tokenEpoch: passwordEpoch(hashA)!,
    });
    p.user = saved;
    assert.equal(r.state, "mismatch");
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})();
