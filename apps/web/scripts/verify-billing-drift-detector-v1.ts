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
const GECMIS = new Date("2026-08-01T00:00:00.000Z");
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
      subscriptionPeriodEnd: GELECEK,
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
      subscriptionPeriodEnd: null,
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
      subscriptionPeriodEnd: null,
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
      subscriptionPeriodEnd: GELECEK,
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
      subscriptionPeriodEnd: GELECEK,
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
          subscriptionPeriodEnd: GELECEK,
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
          subscriptionPeriodEnd: GECMIS,
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
    "dönem sonu GEÇMİŞ iptal ve gecikmiş ödeme ayrışma sayılmaz",
    () => {
      /* apply-billing-event `planExpiresAt`'e tam olarak `currentPeriodEnd`
         yazar. İki durum süresiz yürürlükte sayılsaydı dönem sonu geçmiş her
         iptal ve her ödenmemiş abonelik SONSUZA KADAR ayrışmış görünürdü;
         panel hiç kapanmayan ve büyüyen bir uyarı gösterirdi. */
      for (const status of ["CANCEL_AT_PERIOD_END", "PAST_DUE"]) {
        const v = decideBillingDrift({
          subscriptionStatus: status,
          subscriptionPlanTier: "PROFESSIONAL",
          subscriptionPeriodEnd: GECMIS,
          storedPlan: "PROFESSIONAL",
          planExpiresAt: GECMIS,
          now: NOW,
        });
        assert.equal(
          v.membershipEffectivePlan,
          "STANDARD",
          `${status}: üyelik tarafı düşmemiş — kurgu yanlış`,
        );
        assert.equal(
          v.drift,
          false,
          `${status}: dönem sonu geçmiş abonelik kalıcı yalancı pozitif üretiyor`,
        );
      }
      /* Dönem sonu YOK sayılamaz: bilinmiyorsa hak sürüyor varsayılamaz. */
      const belirsiz = decideBillingDrift({
        subscriptionStatus: "PAST_DUE",
        subscriptionPlanTier: "PROFESSIONAL",
        subscriptionPeriodEnd: null,
        storedPlan: "STANDARD",
        planExpiresAt: null,
        now: NOW,
      });
      assert.equal(belirsiz.expectedTier, "STANDARD");
      assert.equal(belirsiz.drift, false);
    },
  );

  await check(
    "dönem sonu geçmiş ACTIVE abonelik GERÇEK ayrışmadır (gecikmiş yenileme)",
    () => {
      /* ACTIVE, dönem sonuna bakılmadan yürürlüktedir: burada üyelik düşmüş
         ama abonelik canlı görünüyor — para veren müşteri kapıda kalmıştır
         ve görülmesi gereken tam olarak budur. */
      const v = decideBillingDrift({
        subscriptionStatus: "ACTIVE",
        subscriptionPlanTier: "PROFESSIONAL",
        subscriptionPeriodEnd: GECMIS,
        storedPlan: "PROFESSIONAL",
        planExpiresAt: GECMIS,
        now: NOW,
      });
      assert.equal(v.drift, true);
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
          subscriptionPeriodEnd: GELECEK,
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
      subscriptionPeriodEnd: GELECEK,
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
              { subjectType: "COMPANY", subjectId: "c1", status: "ACTIVE", planTier: "PROFESSIONAL", currentPeriodEnd: GELECEK },
              /* temiz firma */
              { subjectType: "COMPANY", subjectId: "c2", status: "ACTIVE", planTier: "PREMIUM", currentPeriodEnd: GELECEK },
              /* ödemesi bitmiş ama süresiz yükseltilmiş kullanıcı → ayrışma */
              { subjectType: "USER", subjectId: "u1", status: "CANCELED", planTier: "PREMIUM", currentPeriodEnd: GECMIS },
              /* ödemesi bitmiş, süreli hakkı olan kullanıcı → ayrışma değil */
              { subjectType: "USER", subjectId: "u2", status: "CANCELED", planTier: "PREMIUM", currentPeriodEnd: GECMIS },
            ];
          },
        },
        company: {
          findMany: async (args: { where?: Record<string, unknown> }) => {
            sorgu++;
            /* İki ayrı amaç: abonelik konularının üyeliğini okumak ve
               ABONELİĞİ HİÇ OLMAYAN süresiz yükseltmeleri bulmak. */
            if (args.where && "planTier" in args.where) return [];
            return [
              { id: "c1", planTier: "STANDARD", planExpiresAt: null },
              { id: "c2", planTier: "PREMIUM", planExpiresAt: GELECEK },
            ];
          },
        },
        user: {
          findMany: async (args: { where?: Record<string, unknown> }) => {
            sorgu++;
            if (args.where && "planTier" in args.where) {
              /* u1'in zaten abonelik satırı var: ikinci kez sayılmamalı.
                 u9'un hiç aboneliği yok ve süresiz PROFESSIONAL: ayrışma. */
              return [{ id: "u1" }, { id: "u9" }];
            }
            return [
              { id: "u1", planTier: "PREMIUM", planExpiresAt: null },
              { id: "u2", planTier: "PREMIUM", planExpiresAt: GELECEK },
            ];
          },
        },
      });
      try {
        const out = await countBillingEntitlementDrift(NOW);
        /* 4 abonelik + abonelisiz 1 yetim (u9). u1 iki listede de var ama
           bir kez sayılır. */
        assert.equal(out.scanned, 5);
        assert.equal(
          out.drifting,
          3,
          "ayrışma sayısı yanlış (c1 düşürülmüş, u1 süresiz, u9 abonelisiz)",
        );
        assert.equal(out.truncated, false);
        assert.equal(
          sorgu,
          5,
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
            currentPeriodEnd: GECMIS,
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

  await check("hiç abonelik yokken bile abonelisiz yükseltmeler görülür", async () => {
    /* Erken dönüş buraya konulsaydı teşhisin İKİNCİ yönü — ürünün bedavaya
       dağıtıldığı yön — hiç görülmezdi: o hesapların abonelik satırı yoktur. */
    let uyelikSorgusu = 0;
    const restore = stub({
      billingSubscription: { findMany: async () => [] },
      company: {
        findMany: async (args: { where?: Record<string, unknown> }) => {
          if (args.where && "planTier" in args.where) return [{ id: "c9" }];
          uyelikSorgusu++;
          return [];
        },
      },
      user: {
        findMany: async (args: { where?: Record<string, unknown> }) => {
          if (args.where && "planTier" in args.where) return [];
          uyelikSorgusu++;
          return [];
        },
      },
    });
    try {
      const out = await countBillingEntitlementDrift(NOW);
      assert.equal(out.drifting, 1, "abonelisiz süresiz yükseltme sayılmıyor");
      assert.equal(out.scanned, 1);
      assert.equal(
        uyelikSorgusu,
        0,
        "boş abonelik listesinde de kimlik toplu sorgusu açılıyor",
      );
    } finally {
      restore();
    }
  });

  await check("yetim taraması SÜRESİZ yükseltmeyle sınırlıdır", () => {
    const SRC = readFileSync(
      join(WEB, "src", "server", "billing", "reconcile.ts"),
      "utf8",
    );
    /* Süreli olarak elle verilen hak ayrışma değildir; koşul düşerse her
       süreli yükseltme ayrışma sayılır ve panel gürültüye boğulur. */
    const yetim = SRC.slice(SRC.indexOf("orphanUsers"));
    assert.ok(
      (yetim.match(/planExpiresAt:\s*null/g) ?? []).length >= 2,
      "yetim taraması süreli hakları da kapsıyor",
    );
    assert.ok(
      (yetim.match(/deletedAt:\s*null/g) ?? []).length >= 2,
      "silinmiş hesaplar da ayrışma sayılıyor",
    );
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
      /billingDrift:\s*drift\s*\?/.test(ROUTE),
      "sayı metriklere yazılmıyor",
    );
    assert.equal(
      (ROUTE.match(/countBillingEntitlementDrift\(/g) ?? []).length,
      1,
      "ağır tarama tek istekte birden çok kez koşuyor",
    );
    assert.ok(
      /countBillingEntitlementDrift\(\)\.catch\(/.test(ROUTE),
      "tarama kendi hatasını yutmuyor — bir zaman aşımı bütün sağlık metriklerini düşürür",
    );
  });

  await check("kesilen tarama panele KESİK olarak ulaşır", () => {
    const ROUTE = readFileSync(
      join(WEB, "src", "app", "api", "admin", "health", "route.ts"),
      "utf8",
    );
    assert.ok(
      ROUTE.includes("billingDriftTruncated"),
      "üst sınıra dayanıldığı panele hiç ulaşmıyor — eksik sayı tam sanılır",
    );
    const UI = readFileSync(
      join(WEB, "src", "components", "admin", "HealthCenter.tsx"),
      "utf8",
    );
    assert.ok(
      UI.includes('key==="billingDriftTruncated"'),
      "kesilme uyarı listesine düşmüyor",
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
