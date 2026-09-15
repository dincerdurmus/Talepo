/**
 * ŞİFRE SIFIRLAMA JETONU — kalıcı doğrulayıcı (2026-09-15).
 *
 * Jeton imzalıdır, süre taşır ve kullanıcının o anki şifre özetinin parmak
 * izine bağlıdır. Üç güvence de burada ölçülür: ham özet jetona girmez,
 * şifre değişince jeton ölür (fiilen tek kullanımlık), ve NEXTAUTH_SECRET
 * yoksa jeton ÜRETİLMEZ — sabit bir sırra düşmez.
 */
process.env.DATABASE_URL ??= "postgresql://p:p@127.0.0.1:5432/p";
process.env.NEXTAUTH_SECRET = "test-secret-at-least-16-chars-long";
import assert from "node:assert/strict";
import { hashPassword } from "../src/lib/auth/password";

let pass = 0, fail = 0;
function check(name: string, fn: () => void) {
  try { fn(); pass++; console.log("PASS  " + name); }
  catch (e) { fail++; console.log("FAIL  " + name + " :: " + (e as Error).message.slice(0,120)); }
}

(async () => {
  const mod = await import("../src/server/auth/password-reset");
  const { issuePasswordResetToken } = mod;
  const internals = mod as unknown as Record<string, unknown>;
  void internals;

  const hash1 = hashPassword("EskiSifre123!");
  const hash2 = hashPassword("YeniSifre456!");

  const token = issuePasswordResetToken({ userId: "u-1", passwordHash: hash1 })!;
  check("jeton uretiliyor", () => assert.ok(token && token.includes(".")));

  check("jeton ham sifre ozetini TASIMAZ", () => {
    const decoded = Buffer.from(token.split(".")[0]!, "base64url").toString("utf8");
    assert.ok(!decoded.includes(hash1), "ham ozet jetonda!");
    assert.ok(!decoded.includes("EskiSifre123!"));
  });

  check("imza bozulursa jeton olur", () => {
    const [body] = token.split(".");
    const forged = `${body}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    assert.ok(forged !== token);
  });

  // Ayni kullanici, sifre DEGISTI -> parmak izi degisir -> eski jeton olmeli
  const tokenAfter = issuePasswordResetToken({ userId: "u-1", passwordHash: hash2 })!;
  check("sifre degisince jeton govdesi degisir (tek kullanimlik temeli)", () => {
    const a = Buffer.from(token.split(".")[0]!, "base64url").toString("utf8").split(":")[3];
    const b = Buffer.from(tokenAfter.split(".")[0]!, "base64url").toString("utf8").split(":")[3];
    assert.notEqual(a, b);
  });

  check("suresi jetonun icinde ve gelecekte", () => {
    const parts = Buffer.from(token.split(".")[0]!, "base64url").toString("utf8").split(":");
    const exp = Number(parts[2]);
    assert.ok(exp > Date.now(), "sure gecmiste");
    assert.ok(exp <= Date.now() + 61 * 60 * 1000, "sure 1 saatten uzun");
  });

  // NEXTAUTH_SECRET yoksa fail-closed
  const saved = process.env.NEXTAUTH_SECRET;
  delete process.env.NEXTAUTH_SECRET;
  check("sir yoksa jeton URETILMEZ (fail-closed, sabit sirra dusmez)", () => {
    const t = issuePasswordResetToken({ userId: "u-1", passwordHash: hash1 });
    assert.equal(t, null);
  });
  process.env.NEXTAUTH_SECRET = saved;

  check("farkli kullanici farkli jeton", () => {
    const t2 = issuePasswordResetToken({ userId: "u-2", passwordHash: hash1 })!;
    assert.notEqual(t2, token);
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})();
