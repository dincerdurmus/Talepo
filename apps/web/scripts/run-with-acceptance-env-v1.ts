/**
 * Kabul ortamını yükleyip verilen doğrulayıcıyı ALT SÜREÇTE koşturur.
 *
 * Bazı tarihsel doğrulayıcılar (offer-inbox-scope, outgoing-offer-inbox,
 * my-requests-surface, auth-fix, offer-role-surfaces...) DATABASE_URL'i
 * süreç ortamından bekler ve kendi başına .env.acceptance OKUMAZ — bu
 * bilinçli bir fail-closed tasarımıdır. Bu sarmalayıcı kanonik yükleyiciyi
 * (`loadAcceptanceEnv` — hedef doğrulama + redaksiyon dahil) kullanır ve
 * İKİNCİ bir env-çözümleme yolu açmaz.
 *
 * Koşum (apps/web):
 *   npx tsx scripts/run-with-acceptance-env-v1.ts <verify-script-adi>
 * Örn:
 *   TALEPO_VERIFY_ALLOW_DB=1 npx tsx scripts/run-with-acceptance-env-v1.ts verify-offer-inbox-scope-v1
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { loadAcceptanceEnv } from "./lib/load-acceptance-env";
import { formatAcceptanceError } from "./lib/acceptance-redaction-v1";
import { isAcceptanceCliEntrypoint } from "./lib/acceptance-cli-entry-v1";

function main(): number {
  loadAcceptanceEnv();
  process.env.NODE_EXTRA_CA_CERTS = join(
    process.cwd(),
    ".acceptance",
    "supabase-ca.crt",
  );
  const target = (process.argv[2] ?? "").replace(/[^A-Za-z0-9-]/g, "");
  if (!target) {
    console.error("FAIL — hedef doğrulayıcı adı gerekli");
    return 2;
  }
  const result = spawnSync(
    "npx",
    ["--yes", "tsx", `scripts/${target}.ts`],
    { stdio: "inherit", shell: true, env: process.env },
  );
  return result.status ?? 1;
}

if (isAcceptanceCliEntrypoint(module)) {
  try {
    process.exit(main());
  } catch (thrown) {
    console.error(`FAIL — ${formatAcceptanceError(thrown)}`);
    process.exit(1);
  }
}
