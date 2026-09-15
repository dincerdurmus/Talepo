/**
 * SIFIR ULAŞIM KURTARMASI — kalıcı doğrulayıcı (2026-09-15).
 *
 * Kapattığı kusur: bir talep hiçbir tedarikçiye ulaşmadığında sistem bunu
 * biliyor (`request.fanout.zero_match`) ama alıcıya söylemiyordu. Alıcı
 * "teklif bekleniyor" ekranına bakıp bekliyordu; oysa talebi kimseye
 * gitmemişti.
 *
 * Bu dosya bir SONDA değil KAPIDIR. Beş şeyi çalıştırarak kanıtlar:
 *   A. Dört sıfır-ulaşım sebebinin DÖRDÜ de bir metne bağlanır — sebep
 *      listesi `deriveZeroMatchReason`'ın kendi 2x2 girdi matrisinden
 *      türetilir, elle yazılmaz. Yeni bir sebep eklenirse ve metni
 *      yazılmazsa bu kapı kırmızıya döner.
 *   B. Alıcının elinde OLMAYAN sebep (kategoride hiç tedarikçi yok) onu
 *      suçlamaz ve ona yapamayacağı bir iş buyurmaz; düzenleme ekranına da
 *      göndermez. Yanlış yere göndermek hiç göndermemekten kötüdür.
 *   C. Bir talep için BİR kez yazılır. Fanout yeniden koşabilir (düzenleme,
 *      hatırlatma); aynı uyarı üst üste yığılmaz.
 *   D. ASLA FIRLATMAZ. Veritabanı hem okumada hem yazmada patlatılır; talep
 *      yayımlaması bir bildirim yazılamadı diye düşemez.
 *   E. Talep başlığı ve alıcı kimliği LOG'A sızmaz. Başlık alıcının kendi
 *      metnidir ve bildirimin gövdesine girer; operasyonel loga girmez.
 * Ayrıca dağıtımdaki BAĞLANTI statik olarak denetlenir: çağrı sıfır-eşleşme
 * dalında, erken dönüşten ÖNCE, non-blocking ve loglanan sebebin AYNISIYLA
 * yapılmalıdır — ikinci bir türetme, log ile bildirimin sessizce ayrışması
 * demektir.
 *
 * Gerçek veritabanına dokunmaz: sahte bağlantı dizesi verilir ve
 * `prisma.notification` stub ile değiştirilir.
 */
process.env.DATABASE_URL ??=
  "postgresql://verifier:verifier@127.0.0.1:5432/verifier";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  addLogSink,
  type OperationalLogEvent,
} from "../src/lib/observability/logger";
import {
  deriveZeroMatchReason,
  type ZeroMatchReason,
} from "../src/server/request/fanout-telemetry";

type PrismaLike = Record<string, unknown>;
type CreatedRow = {
  userId: string;
  type: string;
  title: string;
  message: string;
  actionUrl: string;
  requestId: string;
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

/**
 * Sebep listesi elle yazılmaz: derleyicinin bildiği 2x2 girdiden türetilir.
 * Böylece doğrulayıcı üretim kodunun kendi kararına bağlanır.
 */
const REASONS: ZeroMatchReason[] = [...new Set(
  [true, false].flatMap((categorySkipped) =>
    [true, false].map((hasCityInput) =>
      deriveZeroMatchReason({ categorySkipped, hasCityInput }),
    ),
  ),
)];

/** Alıcının kendi metni. Hiçbir log satırında görünmemeli. */
const BASLIK = "Kadıköy'de 3+1 daire — ali@example.com 05551112233";
const REQ = "cmzeroreach0001";
const BUYER = "cmbuyer00000001";

/** Alıcıya "sen yap" diyen emir kipleri. D sebebinde bulunmamalı. */
const EMIR_KIPLERI = ["düzenle", "ekle", "seç", "güncelle"];

/**
 * Sıfır-eşleşme dalını dosyadan çıkarır. Dalın ÖNÜNDE de
 * `return { matchedCompanyCount: 0 ... }` biçiminde erken dönüşler vardır;
 * bitiş noktası bu yüzden dalın başlangıcından SONRA aranır.
 */
function zeroBranch(src: string): string {
  const bas = src.indexOf("if (matches.length === 0)");
  assert.ok(bas >= 0, "sıfır-eşleşme dalı bulunamadı");
  const son = src.indexOf("return { matchedCompanyCount: 0", bas);
  assert.ok(son > bas, "sıfır-eşleşme dalının dönüşü bulunamadı");
  return src.slice(bas, son);
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { notifyZeroReach, ZERO_REACH_NOTIFICATION_TITLE } = await import(
    "../src/server/request/zero-reach-rescue"
  );

  const captured: OperationalLogEvent[] = [];
  const detach = addLogSink((event) => {
    captured.push(event);
  });

  function stubNotification(impl: PrismaLike) {
    const desc = Object.getOwnPropertyDescriptor(
      prisma as unknown as PrismaLike,
      "notification",
    );
    Object.defineProperty(prisma as unknown as PrismaLike, "notification", {
      value: impl,
      configurable: true,
      writable: true,
    });
    return () => {
      if (desc) {
        Object.defineProperty(
          prisma as unknown as PrismaLike,
          "notification",
          desc,
        );
      } else {
        delete (prisma as unknown as PrismaLike).notification;
      }
    };
  }

  /** Boş kutu: hiç bildirim yok, yazılanı toplar. */
  function freshStore() {
    const rows: CreatedRow[] = [];
    return {
      rows,
      impl: {
        findFirst: async () => null,
        create: async (args: { data: CreatedRow }) => {
          rows.push(args.data);
          return { id: `n${rows.length}` };
        },
      } as PrismaLike,
    };
  }

  console.log("=== SIFIR ULAŞIM KURTARMASI ===\n");

  /* ---------------------------------------------------------------- */
  /* A. Dört sebebin dördü de bir metne bağlanır                        */
  /* ---------------------------------------------------------------- */
  await check("dört sıfır-ulaşım sebebi türetilir (2x2 girdi, tekrarsız)", () => {
    assert.equal(
      REASONS.length,
      4,
      `beklenen 4 sebep, gelen ${REASONS.length}: ${REASONS.join(", ")}`,
    );
  });

  const yazilan = new Map<ZeroMatchReason, CreatedRow>();

  for (const reason of REASONS) {
    await check(`"${reason}" için bildirim yazılır`, async () => {
      const store = freshStore();
      const restore = stubNotification(store.impl);
      try {
        const out = await notifyZeroReach({
          requestId: REQ,
          buyerUserId: BUYER,
          requestTitle: BASLIK,
          reason,
        });
        assert.equal(out.notified, true, "bildirim yazılmadı");
        assert.equal(store.rows.length, 1, "tam bir satır yazılmalı");
        const row = store.rows[0]!;
        yazilan.set(reason, row);
        assert.equal(row.userId, BUYER, "bildirim alıcıya gitmiyor");
        assert.equal(row.requestId, REQ, "bildirim talebe bağlı değil");
        assert.equal(
          row.title,
          ZERO_REACH_NOTIFICATION_TITLE,
          "başlık sabit değil — tekrar engeli buna dayanıyor",
        );
        assert.ok(
          row.message.includes(BASLIK),
          "mesaj hangi talepten söz ettiğini söylemiyor",
        );
        assert.ok(row.message.length > 60, "mesaj alıcıya bir şey anlatmıyor");
        assert.ok(
          row.actionUrl.includes(REQ),
          "bağlantı talebin kendisine gitmiyor",
        );
      } finally {
        restore();
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* B. Alıcının elinde olmayan sebep onu suçlamaz                      */
  /* ---------------------------------------------------------------- */
  await check(
    "tedarikçi yoksa alıcıya iş buyrulmaz ve düzenleme ekranına gönderilmez",
    () => {
      const row = yazilan.get("no_category_companies_and_no_city_match");
      assert.ok(row, "bu sebep için satır yazılmamış");
      assert.ok(
        !row.actionUrl.includes("/duzenle"),
        `elinde bir şey olmayan alıcı düzenleme ekranına gönderiliyor: ${row.actionUrl}`,
      );
      const dusuk = row.message.toLocaleLowerCase("tr");
      for (const kip of EMIR_KIPLERI) {
        assert.ok(
          !dusuk.includes(kip),
          `alıcıya yapamayacağı iş buyruluyor: "${kip}"`,
        );
      }
    },
  );

  await check(
    "düzeltilebilir sebepler düzenleme ekranına ve somut bir adıma bağlanır",
    () => {
      const fixable = REASONS.filter(
        (r) => r !== "no_category_companies_and_no_city_match",
      );
      for (const reason of fixable) {
        const row = yazilan.get(reason);
        assert.ok(row, `${reason} için satır yok`);
        assert.ok(
          row.actionUrl.endsWith("/duzenle"),
          `${reason}: düzeltilebilir ama düzenleme ekranına bağlanmıyor (${row.actionUrl})`,
        );
        const dusuk = row.message.toLocaleLowerCase("tr");
        assert.ok(
          EMIR_KIPLERI.some((k) => dusuk.includes(k)),
          `${reason}: alıcıya ne yapacağı söylenmiyor`,
        );
      }
    },
  );

  await check("her sebep kendi metnini taşır (kopyala-yapıştır tek metin değil)", () => {
    const mesajlar = new Set([...yazilan.values()].map((r) => r.message));
    assert.ok(
      mesajlar.size >= 3,
      `dört sebep için yalnız ${mesajlar.size} farklı metin var`,
    );
  });

  /* ---------------------------------------------------------------- */
  /* C. Bir talep için bir kez                                          */
  /* ---------------------------------------------------------------- */
  await check("aynı talep için ikinci kez yazılmaz", async () => {
    let createCalls = 0;
    const restore = stubNotification({
      findFirst: async (args: { where: Record<string, unknown> }) => {
        assert.equal(args.where.requestId, REQ, "tekrar sorgusu talebe dayanmıyor");
        assert.equal(args.where.userId, BUYER, "tekrar sorgusu alıcıya dayanmıyor");
        assert.equal(
          args.where.title,
          ZERO_REACH_NOTIFICATION_TITLE,
          "tekrar sorgusu başlığa dayanmıyor — başka bildirimleri de bastırır",
        );
        assert.ok(
          typeof args.where.message === "string" && args.where.message.length > 0,
          "tekrar sorgusu SEBEBE dayanmıyor: sebep değişse de alıcı eski tavsiyeye bakar",
        );
        return { id: "mevcut" };
      },
      create: async () => {
        createCalls++;
        return { id: "olmamali" };
      },
    });
    try {
      const out = await notifyZeroReach({
        requestId: REQ,
        buyerUserId: BUYER,
        requestTitle: BASLIK,
        reason: "system_category_and_no_city_input",
      });
      assert.equal(out.notified, false);
      assert.equal(out.reason, "already_notified");
      assert.equal(createCalls, 0, "ikinci bildirim yazıldı");
    } finally {
      restore();
    }
  });

  await check("sebep değişince ikinci bildirim yazılır", async () => {
    /* Alıcı "kategoriyi seçin" denileni yapar, kategori çözülür ama o
       kategoride tedarikçi yoktur: doğru tavsiye artık başkadır. Engel yalnız
       sabit başlığa dayansaydı alıcı ömür boyu ilk metne bakardı — yani
       kapatılmak istenen kusurun aynısı. */
    const yazilanlar: CreatedRow[] = [];
    const restore = stubNotification({
      findFirst: async (args: { where: { message?: string } }) =>
        yazilanlar.some((r) => r.message === args.where.message)
          ? { id: "mevcut" }
          : null,
      create: async (args: { data: CreatedRow }) => {
        yazilanlar.push(args.data);
        return { id: `n${yazilanlar.length}` };
      },
    });
    try {
      const ilk = await notifyZeroReach({
        requestId: REQ, buyerUserId: BUYER, requestTitle: BASLIK,
        reason: "system_category_and_no_city_match",
      });
      assert.equal(ilk.notified, true);
      const ayni = await notifyZeroReach({
        requestId: REQ, buyerUserId: BUYER, requestTitle: BASLIK,
        reason: "system_category_and_no_city_match",
      });
      assert.equal(ayni.notified, false, "aynı sebep ikinci kez yazıldı");
      const yeni = await notifyZeroReach({
        requestId: REQ, buyerUserId: BUYER, requestTitle: BASLIK,
        reason: "no_category_companies_and_no_city_input",
      });
      assert.equal(
        yeni.notified,
        true,
        "sebep değişti ama alıcı hâlâ eski tavsiyeye bakıyor",
      );
      assert.equal(yazilanlar.length, 2);
    } finally {
      restore();
    }
  });

  /* ---------------------------------------------------------------- */
  /* D. Asla fırlatmaz                                                  */
  /* ---------------------------------------------------------------- */
  for (const [ad, impl] of [
    [
      "okuma",
      {
        findFirst: async () => {
          throw new Error("db down");
        },
        create: async () => ({ id: "x" }),
      },
    ],
    [
      "yazma",
      {
        findFirst: async () => null,
        create: async () => {
          throw new Error("db down");
        },
      },
    ],
  ] as [string, PrismaLike][]) {
    await check(`${ad} patlarsa fırlatmaz, yayımlamayı düşürmez`, async () => {
      const restore = stubNotification(impl);
      try {
        const out = await notifyZeroReach({
          requestId: REQ,
          buyerUserId: BUYER,
          requestTitle: BASLIK,
          reason: "no_category_companies_and_no_city_input",
        });
        assert.equal(out.notified, false);
        assert.equal(out.reason, "error");
      } finally {
        restore();
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* E. Başlık ve alıcı kimliği loga sızmaz                             */
  /* ---------------------------------------------------------------- */
  await check("talep başlığı ve alıcı kimliği operasyonel loga girmez", () => {
    assert.ok(captured.length > 0, "hiç log üretilmedi — sızıntı testi anlamsız");
    const blob = JSON.stringify(captured);
    assert.ok(!blob.includes(BASLIK), "talep başlığı loga sızdı");
    assert.ok(!blob.includes("ali@example.com"), "e-posta loga sızdı");
    assert.ok(!blob.includes("05551112233"), "telefon loga sızdı");
    assert.ok(!blob.includes(BUYER), "alıcı kimliği loga sızdı");
  });

  detach();

  /* ---------------------------------------------------------------- */
  /* F. Dağıtımdaki bağlantı                                            */
  /* ---------------------------------------------------------------- */
  const DIST = readFileSync(
    join(__dirname, "..", "src", "server", "request", "distribute-request.ts"),
    "utf8",
  );

  await check("dağıtım sıfır-eşleşme dalında kurtarmayı çağırır", () => {
    assert.ok(
      /import\s*\{[^}]*notifyZeroReach[^}]*\}\s*from\s*"@\/server\/request\/zero-reach-rescue"/.test(
        DIST,
      ),
      "notifyZeroReach dağıtıma hiç bağlanmamış",
    );
    const dal = zeroBranch(DIST);
    assert.ok(
      dal.includes("notifyZeroReach("),
      "kurtarma çağrısı erken dönüşten sonra kalmış — hiç koşmaz",
    );
    assert.ok(
      /void\s+notifyZeroReach\(/.test(dal),
      "çağrı await ediliyor — bir bildirim gecikmesi dağıtımı bekletir",
    );
  });

  await check("bildirilen sebep loglanan sebebin aynısıdır", () => {
    const dal = zeroBranch(DIST);
    const turetme = dal.match(/deriveZeroMatchReason\(/g) ?? [];
    assert.equal(
      turetme.length,
      1,
      `sebep dalda ${turetme.length} kez türetiliyor — log ile bildirim ayrışabilir`,
    );
    const cagri = dal.slice(dal.indexOf("void notifyZeroReach("));
    assert.ok(
      /reason:\s*zeroReason/.test(cagri),
      "bildirim, loglanan sebep değişkenini kullanmıyor",
    );
    const logCagri = dal.slice(
      dal.indexOf("logFanoutZeroMatch("),
      dal.indexOf("void deliverAlertRuleNotifications"),
    );
    assert.ok(
      /reason:\s*zeroReason/.test(logCagri),
      "log, türetilen sebep değişkenini kullanmıyor",
    );
  });

  await check(
    "bildirimin istediği düzeltme dağıtımı GERÇEKTEN yeniden koşturur",
    () => {
      /* Ölçülen kusur: metin "talebe şehir ekleyin" diyordu ama düzenleme
         yolundaki yeniden dağıtım koşulu yalnız yayımlama ve KATEGORİ
         değişimine bakıyordu. Alıcı denileni yapıyor, hiçbir şey olmuyordu.
         Şehir dağıtımın ikinci kanalının tek girdisidir. */
      const UPD = readFileSync(
        join(__dirname, "..", "src", "server", "request", "update-request.ts"),
        "utf8",
      );
      const karar = UPD.slice(UPD.indexOf("const publishedNow"));
      assert.ok(
        /shouldDistribute:\s*\n?\s*publishedNow \|\| categoryChanged \|\| locationChanged/.test(
          karar.replace(/\s+/g, " ").replace(/ /g, " "),
        ) || /locationChanged/.test(karar.slice(0, karar.indexOf("});"))),
        "konum değişimi yeniden dağıtımı tetiklemiyor — bildirim tutulmayan bir söz veriyor",
      );
      assert.ok(
        /existing\.city/.test(karar) && /existing\.district/.test(karar),
        "karar eski konumu okumuyor — değişimi göremez",
      );
      assert.ok(
        /city:\s*true/.test(UPD) && /district:\s*true/.test(UPD),
        "eski konum select'e alınmamış",
      );
    },
  );

  await check("kurtarma alarm teslimini geciktirmez veya bastırmaz", () => {
    const dal = zeroBranch(DIST);
    assert.ok(
      dal.indexOf("deliverAlertRuleNotifications") <
        dal.indexOf("notifyZeroReach("),
      "alarm teslimi kurtarmanın arkasına düşmüş",
    );
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
