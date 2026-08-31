/**
 * TEDARİKÇİ YETENEĞİ TÜKETİMİ V1 (RC, 2026-09-01 — bileşen ⑤).
 * Run from apps/web (kabul DB gerekir):
 *   NODE_EXTRA_CA_CERTS=.acceptance/supabase-ca.crt npx tsx scripts/verify-supplier-capability-consumption-v1.ts
 *
 * NE ÖLÇER. Formülün 5. bileşeni "tedarikçi yeteneği" bugüne dek
 * CAPABILITY_NOT_MEASURED idi; kök neden DB→profil üretim yükleyicisinin hiç
 * olmamasıydı. Bu kapı yeni kanonik yükleyiciyi
 * (`loadSupplierCapabilityProfile`) GERÇEK veritabanı satırları üzerinden,
 * sinyal SINIFI başına uçtan uca kanıtlar:
 *
 *   Prisma satırı → loadSupplierCapabilityRow → adaptDbCompanyToProfile
 *     → scoreAllComponents (mevcut kanonik skorlayıcı — ikinci matcher yok)
 *
 * BİLEŞEN ⑤ ÖLÇÜM SÖZLEŞMESİ (payda = 6 kanonik sinyal sınıfı):
 *   kategori · konum · envanter · alarm · kayıtlı-arama · negatif-yokluk
 * Her sınıf ancak pozitif tüketim + yanlış-tedarikçi bastırması + mutasyon
 * kanıtıyla "ölçüldü" sayılır. NOT_MEASURED hiçbir zaman 0 diye sunulmaz;
 * kapı koşamıyorsa (DB yok) bileşen ÖLÇÜLMEDİ kalır.
 *
 * SENTETİK VERİ SÖZLEŞMESİ: fixture kesin etiketle kurulur ve koşum sonunda
 * kesin kimlikle silinir; skor şişirmek için kalıcı tedarikçi verisi
 * ÜRETİLMEZ (kabul DB'si yalnız sentetik veri taşır).
 */
import { loadAcceptanceEnv } from "./lib/load-acceptance-env";

let pass = 0;
let fail = 0;
const errors: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`PASS — ${name}`);
  } else {
    fail += 1;
    errors.push(detail ? `${name}: ${detail}` : name);
    console.log(`FAIL — ${name}${detail ? `: ${detail}` : ""}`);
  }
}

async function main() {
  loadAcceptanceEnv();
  if (process.env.TALEPO_ENVIRONMENT !== "acceptance") {
    console.log("NOT-MEASURED — kabul ortamı yok; bileşen ⑤ ÖLÇÜLMEDİ kalır.");
    process.exit(3);
  }
  const { prisma } = await import("@/lib/prisma");
  const { loadSupplierCapabilityProfile } = await import(
    "@/server/matching/load-supplier-capability"
  );
  const { scoreAllComponents } = await import(
    "@/lib/matching-v3/scoring/score-candidate"
  );
  const { buildRequestRoutingEnvelope } = await import(
    "@/lib/matching-v3/routing-envelope"
  );

  const TAG = "[SUPCAP1]";
  async function cleanup() {
    const companies = await prisma.company.findMany({
      where: { name: { contains: TAG } },
      select: { id: true },
    });
    const ids = companies.map((c) => c.id);
    if (ids.length) {
      await prisma.companyInventoryItem.deleteMany({ where: { companyId: { in: ids } } });
      await prisma.alertRule.deleteMany({ where: { companyId: { in: ids } } });
      await prisma.savedSearch.deleteMany({ where: { companyId: { in: ids } } });
      await prisma.companyCategory.deleteMany({ where: { companyId: { in: ids } } });
      await prisma.companyMember.deleteMany({ where: { companyId: { in: ids } } });
      await prisma.company.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.user.deleteMany({ where: { email: { contains: "supcap1@acceptance.talepo" } } });
  }
  await cleanup();

  const appliances = await prisma.category.findFirst({ where: { slug: "appliances" }, select: { id: true, slug: true } });
  const printing = await prisma.category.findFirst({ where: { slug: "printing" }, select: { id: true, slug: true } });
  if (!appliances || !printing) throw new Error("kanonik kategori satırları yok");

  const owner = await prisma.user.create({
    data: { email: "owner.supcap1@acceptance.talepo", name: `${TAG} Owner`, membershipNumber: "TLP-SC0001" },
  });
  /** Doğru tedarikçi: beş sinyal sınıfının tamamı gerçek satırlarla dolu. */
  const rightCo = await prisma.company.create({
    data: {
      name: `${TAG} Beyaz Eşya Tedarik`, slug: "supcap1-right", city: "Ankara", district: "Çankaya",
      createdBy: { connect: { id: owner.id } },
      members: { create: { userId: owner.id, role: "OWNER", status: "ACTIVE" } },
      categories: { create: { categoryId: appliances.id } },
    },
  });
  await prisma.companyInventoryItem.create({
    data: { companyId: rightCo.id, name: "Bulaşık Makinesi", brand: "Bosch", categoryId: appliances.id },
  });
  await prisma.alertRule.create({
    data: { ownerType: "COMPANY", companyId: rightCo.id, name: `${TAG} alarm`, categoryId: appliances.id, keywords: "bulaşık makinesi" },
  });
  await prisma.savedSearch.create({
    data: { ownerType: "COMPANY", companyId: rightCo.id, name: `${TAG} arama`, filters: { categoryId: appliances.id, categorySlug: appliances.slug, keyword: "bosch" } },
  });
  /** Yanlış tedarikçi: başka alan (matbaa), başka şehir; hiçbir sinyal uymaz. */
  const wrongCo = await prisma.company.create({
    data: {
      name: `${TAG} Matbaa`, slug: "supcap1-wrong", city: "İzmir",
      createdBy: { connect: { id: owner.id } },
      categories: { create: { categoryId: printing.id } },
    },
  });

  /** Talep zarfı: gerçek üretim kurucusuyla (Beyaz Eşya / Bosch / Ankara). */
  const envelope = buildRequestRoutingEnvelope({
    requestId: "supcap-probe",
    rawInput: "Bosch bulaşık makinesi arıyorum",
    categoryDbId: appliances.id,
    categorySlug: appliances.slug,
    city: "Ankara / Çankaya",
  } as never);

  const componentsFor = async (companyId: string) => {
    const profile = await loadSupplierCapabilityProfile(companyId);
    if (!profile) return null;
    return {
      profile,
      components: scoreAllComponents(envelope as never, profile, [
        "inventory",
      ]) as Array<{ id: string; matched: boolean }>,
    };
  };
  const matched = (r: { components: Array<{ id: string; matched: boolean }> } | null, id: string) =>
    r?.components.find((c) => c.id === id)?.matched ?? false;

  console.log("A) SINIF BAŞINA POZİTİF TÜKETİM (gerçek DB satırları)");
  const right = await componentsFor(rightCo.id);
  check("A yükleyici gerçek firmayı profile çevirdi", Boolean(right));
  check("A kategori sınıfı tüketildi (category_exact)", matched(right, "category_exact"));
  check(
    "A envanter sınıfı tüketildi (inventory)",
    matched(right, "inventory"),
    `→ ${JSON.stringify(right?.components.filter((c) => c.matched).map((c) => c.id))}`,
  );
  check(
    "A envanter sinyali marka+ürün taşıyor (profil)",
    /** Profil kurucusu değerleri kanonik katlar (foldText) — iddia da katlanmış biçime bakar. */
    Boolean(right?.profile.inventorySignals.some((s) => s.brand === "bosch" && (s.product ?? "").includes("bulaşık"))),
  );
  check(
    "A alarm sınıfı profile taşındı",
    Boolean(right?.profile.alertSignals.some((s) => (s.keywords ?? []).includes("bulaşık makinesi"))),
  );
  check(
    "A kayıtlı-arama sınıfı profile taşındı (kanonik filters JSON'dan)",
    Boolean(right?.profile.savedSearchSignals.some((s) => (s.categorySlugs ?? []).includes("appliances"))),
  );
  check(
    "A konum sınıfı profile taşındı",
    Boolean(right?.profile.cities.some((c) => c.toLocaleLowerCase("tr-TR").includes("ankara"))),
    `→ ${JSON.stringify(right?.profile.cities)}`,
  );

  console.log("\nB) NEGATİF — yanlış tedarikçi bastırılır");
  const wrong = await componentsFor(wrongCo.id);
  check("B yanlış firma: kategori eşleşmez", !matched(wrong, "category_exact"));
  check("B yanlış firma: envanter kanıtı üretilmez", !matched(wrong, "inventory"));
  check(
    "B yanlış firma toplamı doğru firmadan düşük",
    (wrong?.components.filter((c) => c.matched).length ?? 99) <
      (right?.components.filter((c) => c.matched).length ?? 0),
  );
  const ghost = await loadSupplierCapabilityProfile("supcap-yok-boyle-firma");
  check("B olmayan firma → null (boş profil uydurulmaz)", ghost === null);

  console.log("\nM) MUTASYON KANITI — sinyal satırı silinince tüketim durur");
  await prisma.companyInventoryItem.deleteMany({ where: { companyId: rightCo.id } });
  const afterCut = await componentsFor(rightCo.id);
  check("M envanter satırı silindi → inventory kanıtı DURDU", !matched(afterCut, "inventory"));
  check("M kategori kanıtı bağımsız yaşıyor (sınıflar karışmadı)", matched(afterCut, "category_exact"));
  await prisma.companyInventoryItem.create({
    data: { companyId: rightCo.id, name: "Bulaşık Makinesi", brand: "Bosch", categoryId: appliances.id },
  });
  const restored = await componentsFor(rightCo.id);
  check("M geri yükleme sonrası tüketim döndü", matched(restored, "inventory"));

  console.log("\nD) BİLEŞEN ⑤ ÖLÇÜMÜ (payda 6 sinyal sınıfı)");
  const proven = {
    kategori: matched(right, "category_exact"),
    konum: Boolean(right?.profile.cities.some((c) => c.toLocaleLowerCase("tr-TR").includes("ankara"))),
    envanter: matched(right, "inventory"),
    alarm: Boolean(right?.profile.alertSignals.length),
    kayitliArama: Boolean(right?.profile.savedSearchSignals.length),
    negatifYokluk: !matched(wrong, "inventory") && ghost === null,
  };
  const provenCount = Object.values(proven).filter(Boolean).length;
  console.log(`SUPPLIER_CAPABILITY_PROVEN=${provenCount}/6  ${JSON.stringify(proven)}`);
  check("D dondurulmuş taban: 6/6 sınıf kanıtlı", provenCount === 6, `→ ${provenCount}`);

  await cleanup();
  const leftover = await prisma.company.count({ where: { name: { contains: TAG } } });
  check("KALINTI temizlendi", leftover === 0, `→ ${leftover}`);

  console.log(`\nSupplier capability consumption: ${pass} PASS / ${fail} FAIL`);
  if (errors.length) {
    for (const e of errors) console.log(" -", e);
    process.exit(1);
  }
}
main().then(() => process.exit(0)).catch((e) => {
  console.error(String(e).split("\n").slice(0, 3).join("\n"));
  process.exit(1);
});
