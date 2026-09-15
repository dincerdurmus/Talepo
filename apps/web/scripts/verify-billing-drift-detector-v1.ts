/**
 * ÖDEME/ÜYELİK AYRIŞMASI — kalıcı doğrulayıcı (2026-09-15).
 *
 * Kapattığı kusur: `reconcileBillingEntitlement` bir hesabın para tarafı ile
 * yetki tarafının ayrışıp ayrışmadığını görebiliyordu ama ÇAĞIRANI YOKTU.
 * Yazılmış, hiç koşmayan bir teşhisti; yani ayrışma olduğunda kimse
 * bilmiyordu. İki yönü de para demektir: ödeyen müşteri aldığını göremez,
 * ya da ödemeyen hesap ürünü bedava alır.
 *
 * Bu dosya bir SONDA değil KAPIDIR:
 *   A. Karar tek yerdedir ve dört gerçek durumda doğrudur — ödeyen ama
 *      düşürülmüş, ödemeyen ama yükseltilmiş, süreli elle verilmiş hak
 *      (ayrışma DEĞİL) ve temiz eşleşme.
 *   B. İptal edilmiş ama dönem sonuna kadar süren ve ödemesi gecikmiş
 *      abonelikler HÂLÂ yürürlüktedir; bunların yetkisini düşürmek parasını
 *      almış olduğun müşteriyi kapıda bırakmaktır.
 *   B2. İki taraf AYNI kanonik ölçekte karşılaştırılır. Bağlarken bulunan
 *      kusur buydu: üyelik tarafı kanonikleşiyor (PREMIUM ve CORPORATE
 *      PROFESSIONAL'a katlanır), abonelik tarafı ham okunuyordu; PREMIUM
 *      abonelikli her hesap tam uyumluyken bile ayrışmış çıkıyordu. Ölçüm
 *      aracının her hesabı işaretlemesi ölçüm yapmamakla aynı şeydir.
 *   C. Toplu tarama hesap başına sorgu AÇMAZ ve üst sınırı vardır: ölçüm
 *      aracı ölçtüğü paneli yavaşlatamaz.
 *   D. Teşhis HİÇBİR ŞEY YAZMAZ. Para tarafına dokunmak ayrı ve onaylı bir
 *      iştir.
 *   E. Teşhis gerçekten BAĞLIDIR. `/admin/health` metriklerinde görünür ve
 *      sıfırdan büyükse uyarı listesine düşer. Bu satır kaybolursa teşhis
 *      yine hiç koşmayan bir export olur — kusurun ta kendisi buydu.
 */
process.env.DATABASE_URL ??=
  "postgresql://verifier:verifier@127.0.0.1:5432/verifier";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { PlanTierId } from "../src/lib/membership/plans";
import {
  BILLING_DRIFT_SCAN_LIMIT,
  countBillingEntitlementDrift,
  decideBillingDrift,
} from "../src/server/billing/reconcile";

type PrismaLike = Record<string, unknown>;

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

const NOW = new Date("2026-09-15T12:00:00.000Z");
const GELECEK = new Date("2026-12-31T00:00:00.000Z");
const WEB = join(__dirname, "..");

async function main() {
  const { prisma } = await import("../src/lib/prisma");

  console.log("=== ÖDEME/ÜYELİK AYRIŞMASI ===\n");

  /* ------------------------------------------------------------------ */
  /* A. Karar                                                            */
  /* ------------------------------------------------------------------ */
  await check("ödeyen ama üyeliği düşürülmüş hesap ayrışma sayılır", () => {
    const v = decideBillingDrift({
      subscriptionStatus: "ACTIVE",
      subscriptionPlanTier: "PROFESSIONAL",
      storedPlan: "STANDARD",
      planExpiresAt: null,
      now: NOW,
    });
    assert.equal(v.drift, true, "para veren müşterinin kaybı görülmüyor");
    assert.equal(v.expectedTier, "PROFESSIONAL");
    assert.equal(v.membershipEffectivePlan, "STANDARD");
  });

  await check("ödemesi yokken süresiz yükseltilmiş hesap ayrışma sayılır", () => {
    const v = decideBillingDrift({
      subscriptionStatus: null,
      subscriptionPlanTier: null,
      storedPlan: "PROFESSIONAL",
      planExpiresAt: null,
      now: NOW,
    });
    assert.equal(v.drift, true, "arkasında ödeme olmayan süresiz hak görülmüyor");
    assert.equal(v.billingStatus, "INACTIVE");
  });

  await check("elle verilmiş SÜRELİ hak ayrışma sayılmaz", () => {
    const v = decideBillingDrift({
      subscriptionStatus: null,
      subscriptionPlanTier: null,
      storedPlan: "PROFESSIONAL",
      planExpiresAt: GELECEK,
      now: NOW,
    });
    assert.equal(
      v.drift,
      false,
      "süreli olarak elle verilen hak yanlışlıkla ayrışma sayılıyor",
    );
  });

  await check("ödeme ile üyelik uyuşuyorsa ayrışma yoktur", () => {
    const v = decideBillingDrift({
      subscriptionStatus: "ACTIVE",
      subscriptionPlanTier: "PROFESSIONAL",
      storedPlan: "PROFESSIONAL",
      planExpiresAt: GELECEK,
      now: NOW,
    });
    assert.equal(v.drift, false);
  });

  await check("aboneliği bitmiş ve üyeliği de düşmüş hesap ayrışma değildir", () => {
    const v = decideBillingDrift({
      subscriptionStatus: "CANCELED",
      subscriptionPlanTier: "PROFESSIONAL",
      storedPlan: "STANDARD",
      planExpiresAt: null,
      now: NOW,
    });
    assert.equal(v.drift, false);
    assert.equal(v.expectedTier, "STANDARD");
  });

  /* ------------------------------------------------------------------ */
  /* B. Hangi abonelikler hâlâ yürürlükte                                */
  /* ------------------------------------------------------------------ */
  await check(
    "iptal-dönem-sonu ve gecikmiş ödeme HÂLÂ yürürlüktedir (parası alınmış müşteri)",
    () => {
      for (const status of ["ACTIVE", "CANCEL_AT_PERIOD_END", "PAST_DUE"]) {
        const v = decideBillingDrift({
          subscriptionStatus: status,
          subscriptionPlanTier: "PREMIUM",
          storedPlan: "PREMIUM",
          planExpiresAt: GELECEK,
          now: NOW,
        });
        /* Beklenen KANONİK ölçektedir: PREMIUM, PROFESSIONAL'a katlanır.
           Önemli olan "hak sürüyor mu", hangi eski adla yazıldığı değil. */
        assert.equal(
          v.expectedTier,
          "PROFESSIONAL",
          `${status}: yürürlükteki abonelik yürürlüksüz sayılıyor`,
        );
        assert.equal(v.drift, false, `${status}: yanlış ayrışma`);
      }
      for (const status of ["CANCELED", "EXPIRED", "INCOMPLETE", "UNPAID"]) {
        const v = decideBillingDrift({
          subscriptionStatus: status,
          subscriptionPlanTier: "PREMIUM",
          storedPlan: "STANDARD",
          planExpiresAt: null,
          now: NOW,
        });
        assert.equal(
          v.expectedTier,
          "STANDARD",
          `${status}: bitmiş abonelik hâlâ hak veriyor`,
        );
      }
    },
  );

  await check(
    "PREMIUM ve CORPORATE abonelikler uyumluyken ayrışma sayılmaz",
    () => {
      for (const [sub, stored] of [
        ["PREMIUM", "PREMIUM"],
        ["CORPORATE", "CORPORATE"],
        ["PREMIUM", "PROFESSIONAL"],
        ["PROFESSIONAL", "PREMIUM"],
      ] as [string, PlanTierId][]) {
        const v = decideBillingDrift({
          subscriptionStatus: "ACTIVE",
          subscriptionPlanTier: sub,
          storedPlan: stored,
          planExpiresAt: GELECEK,
          now: NOW,
        });
        assert.equal(
          v.drift,
          false,
          `abonelik ${sub} / üyelik ${stored}: uyumlu hesap ayrışmış sayılıyor`,
        );
      }
    },
  );

  await check("bozuk plan metni ücretli plan sayılmaz", () => {
    const v = decideBillingDrift({
      subscriptionStatus: "ACTIVE",
      subscriptionPlanTier: "GOLD_TIER_X",
      storedPlan: "STANDARD",
      planExpiresAt: null,
      now: NOW,
    });
    assert.equal(
      v.expectedTier,
      "STANDARD",
      "tanınmayan plan metni hak veriyor",
    );
    assert.equal(v.drift, false);
  });

  /* ------------------------------------------------------------------ */
  /* C. Toplu tarama: sabit sorgu sayısı ve üst sınır                    */
  /* ------------------------------------------------------------------ */
  let sorgu = 0;
  function stub(models: Record<string, PrismaLike>) {
    const saved: [string, PropertyDescriptor | undefined][] = [];
    for (const [model, impl] of Object.entries(models)) {
      saved.push([
        model,
        Object.getOwnPropertyDescriptor(prisma as unknown as PrismaLike, model),
      ]);
      Object.defineProperty(prisma as unknown as PrismaLike, model, {
        value: impl,
        configurable: true,
        writable: true,
      });
    }
    return () => {
      for (const [model, desc] of saved) {
        if (desc) {
          Object.defineProperty(prisma as unknown as PrismaLike, model, desc);
        } else {
          delete (prisma as unknown as PrismaLike)[model];
        }
      }
    };
  }

  await check(
    "tarama hesap başına sorgu açmaz ve ayrışanları doğru sayar",
    async () => {
      sorgu = 0;
      let takeGorulen: number | undefined;
      const restore = stub({
        billingSubscription: {
          findMany: async (args: { take?: number }) => {
            sorgu++;
            takeGorulen = args.take;
            return [
              /* ödeyen ama düşürülmüş firma → ayrışma */
              { subjectType: "COMPANY", subjectId: "c1", status: "ACTIVE", planTier: "PROFESSIONAL" },
              /* temiz firma */
              { subjectType: "COMPANY", subjectId: "c2", status: "ACTIVE", planTier: "PREMIUM" },
              /* ödemesi bitmiş ama süresiz yükseltilmiş kullanıcı → ayrışma */
              { subjectType: "USER", subjectId: "u1", status: "CANCELED", planTier: "PREMIUM" },
              /* ödemesi bitmiş, süreli hakkı olan kullanıcı → ayrışma değil */
              { subjectType: "USER", subjectId: "u2", status: "CANCELED", planTier: "PREMIUM" },
            ];
          },
        },
        company: {
          findMany: async () => {
            sorgu++;
            return [
              { id: "c1", planTier: "STANDARD", planExpiresAt: null },
              { id: "c2", planTier: "PREMIUM", planExpiresAt: GELECEK },
            ];
          },
        },
        user: {
          findMany: async () => {
            sorgu++;
            return [
              { id: "u1", planTier: "PREMIUM", planExpiresAt: null },
              { id: "u2", planTier: "PREMIUM", planExpiresAt: GELECEK },
            ];
          },
        },
      });
      try {
        const out = await countBillingEntitlementDrift(NOW);
        assert.equal(out.scanned, 4);
        assert.equal(out.drifting, 2, "ayrışma sayısı yanlış");
        assert.equal(out.truncated, false);
        assert.equal(
          sorgu,
          3,
          `tarama ${sorgu} sorgu açtı — hesap başına sorgu paneli yavaşlatır`,
        );
        assert.equal(
          takeGorulen,
          BILLING_DRIFT_SCAN_LIMIT,
          "taramanın üst sınırı yok",
        );
      } finally {
        restore();
      }
    },
  );

  await check("sınıra dayanıldığında bu gizlenmez", async () => {
    const restore = stub({
      billingSubscription: {
        findMany: async () =>
          Array.from({ length: BILLING_DRIFT_SCAN_LIMIT }, (_, i) => ({
            subjectType: "USER",
            subjectId: `u${i}`,
            status: "CANCELED",
            planTier: "PREMIUM",
          })),
      },
      company: { findMany: async () => [] },
      user: { findMany: async () => [] },
    });
    try {
      const out = await countBillingEntitlementDrift(NOW);
      assert.equal(out.truncated, true, "kesilen tarama tam sayılmış gibi dönüyor");
    } finally {
      restore();
    }
  });

  await check("abonelik yoksa tarama boş sorguya girmez", async () => {
    let cagrildi = 0;
    const restore = stub({
      billingSubscription: { findMany: async () => [] },
      company: {
        findMany: async () => {
          cagrildi++;
          return [];
        },
      },
      user: {
        findMany: async () => {
          cagrildi++;
          return [];
        },
      },
    });
    try {
      const out = await countBillingEntitlementDrift(NOW);
      assert.deepEqual(out, { scanned: 0, drifting: 0, truncated: false });
      assert.equal(cagrildi, 0, "boş listede de üyelik sorguları açılıyor");
    } finally {
      restore();
    }
  });

  /* ------------------------------------------------------------------ */
  /* D. Teşhis yazmaz                                                    */
  /* ------------------------------------------------------------------ */
  await check("teşhis hiçbir plan yazmaz", () => {
    const SRC = readFileSync(
      join(WEB, "src", "server", "billing", "reconcile.ts"),
      "utf8",
    );
    for (const yazma of [
      ".update(",
      ".updateMany(",
      ".create(",
      ".createMany(",
      ".upsert(",
      ".delete(",
      ".deleteMany(",
      "$executeRaw",
    ]) {
      assert.ok(
        !SRC.includes(yazma),
        `teşhis para tarafına yazıyor: ${yazma} — bu ayrı ve onaylı bir iş`,
      );
    }
  });

  /* ------------------------------------------------------------------ */
  /* E. Gerçekten bağlı                                                  */
  /* ------------------------------------------------------------------ */
  await check("teşhis /admin/health metriklerine bağlı (çağıransız export değil)", () => {
    const ROUTE = readFileSync(
      join(WEB, "src", "app", "api", "admin", "health", "route.ts"),
      "utf8",
    );
    assert.ok(
      ROUTE.includes("countBillingEntitlementDrift"),
      "tarama hiçbir yerden çağrılmıyor — teşhis yine hiç koşmaz",
    );
    assert.ok(
      /billingDrift:\s*billingDrift\.drifting/.test(ROUTE),
      "sayı metriklere yazılmıyor",
    );
  });

  await check("ayrışma sıfırdan büyükse panelde uyarı olur", () => {
    const UI = readFileSync(
      join(WEB, "src", "components", "admin", "HealthCenter.tsx"),
      "utf8",
    );
    assert.ok(
      UI.includes('billingDrift:"'),
      "metrik panelde adsız — kimse ne olduğunu anlamaz",
    );
    assert.ok(
      UI.includes('key==="billingDrift"'),
      "ayrışma uyarı listesine düşmüyor — sayı var, kimse görmüyor",
    );
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
