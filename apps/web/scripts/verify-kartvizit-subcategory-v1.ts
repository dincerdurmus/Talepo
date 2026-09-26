/**
 * KARTVİZİT AYRI ALT KATEGORİ — KALICI DOĞRULAYICI (D-0041).
 *
 * Kurucu kararı (2026-09-25): "Kartvizit ayrı bir kategori olması lazım."
 * Kartvizit artık `tax:printing:brosur-ve-katalog:urunler:kartvizit` değil,
 * Matbaa ve Ambalaj'ın kendi alt kategorisidir.
 *
 * NE ÖLÇÜLÜR (hepsi GERÇEK üretim fonksiyonlarıyla; ikinci bir karar kopyası
 * kurulmaz):
 *   1. Serbest metin → Kartvizit alt kategorisi. Yirmiden fazla cümle; yazım
 *      hatası, büyük harf, diyakritiksiz yazım ve TR-EN "business card"
 *      eksenleri ayrı ayrı temsil edilir.
 *   2. Eski düğüm kimliği yeni düğüme çözülür (kayıtlı talepler için okuma
 *      katmanı yönlendirmesi; veriye hiçbir şey yazılmaz).
 *   3. Komşu matbaa ürünleri YERİNDE KALIR — broşür, katalog, davetiye,
 *      antetli kâğıt, poster hâlâ Broşür ve Katalog altındadır.
 *   4. Şema ve sorular: `printing/kartvizit` çözülür, kartvizit soruları
 *      gelir, komşu ailelerin soruları sızmaz.
 *
 * MUTASYON KONTROLÜ: `--mutate` ile taksonomi D-0041 ÖNCESİ şekle geri
 * döndürülür (yeni düğümler çıkarılır, eski düğüm yeniden canlandırılır) ve
 * doğrulayıcının KIRMIZI döndüğü gösterilir. Kapı, kapı olduğunu kanıtlar.
 */
import { REQUEST_CATEGORIES } from "../src/lib/request-category-engine";
import { subcategorySlug } from "../src/lib/knowledge/slug";
import { resolveRequestSchema } from "../src/lib/knowledge/request-schema";
import { syncFromText } from "../src/lib/request-composer";
import { listProfilesForCategory } from "../src/lib/request-composer/v2/question-profiles";
import { loadAllTaxonomyNodes } from "../src/lib/taxonomy/loader";
import {
  ensureTaxonomyLoaded,
  getSubcategoryTaxonomyNode,
  getTaxonomyNode,
  resolveSchemaIdForNode,
  resolveTaxonomyNodeId,
  type TaxonomyNode,
} from "../src/lib/taxonomy";

const MUTATE = process.argv.includes("--mutate");

const SUBCATEGORY_LABEL = "Kartvizit";
const SUBCATEGORY_SLUG = "kartvizit";
const NEW_LEAF_ID = "tax:printing:kartvizit:urunler:kartvizit";
const OLD_LEAF_ID = "tax:printing:brosur-ve-katalog:urunler:kartvizit";

/**
 * MUTASYON: D-0041 öncesi ağaç. Yeni alt kategori dalı silinir, devredilmiş
 * yaprak yeniden canlandırılır. Kararın kendisine dokunulmaz — yalnız veri
 * eski hâline döner; kapı bunu görmek zorundadır.
 */
if (MUTATE) {
  const pre: TaxonomyNode[] = loadAllTaxonomyNodes()
    .filter((node) => !node.id.startsWith("tax:printing:kartvizit"))
    .map((node) =>
      node.id === OLD_LEAF_ID
        ? { ...node, status: "active" as const, supersededBy: undefined }
        : node,
    );
  ensureTaxonomyLoaded(pre);
} else {
  ensureTaxonomyLoaded();
}

let pass = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`GEÇTİ — ${name}`);
    return;
  }
  const line = detail ? `${name} (${detail})` : name;
  failures.push(line);
  console.log(`KIRMIZI — ${line}`);
}

/* ─────────────── 1. Yapı: alt kategori gerçekten var mı ─────────────── */

const printing = REQUEST_CATEGORIES.find((c) => c.id === "printing");
check(
  "Matbaa ve Ambalaj alt kategorileri arasında Kartvizit var",
  Boolean(printing?.subcategories.includes(SUBCATEGORY_LABEL)),
  printing?.subcategories.join(" · "),
);
check(
  "etiketin slug'ı kanonik slug üreticisinden kartvizit çıkar",
  subcategorySlug(SUBCATEGORY_LABEL) === SUBCATEGORY_SLUG,
  subcategorySlug(SUBCATEGORY_LABEL),
);

const subNode = getSubcategoryTaxonomyNode("printing", SUBCATEGORY_SLUG);
check(
  "tax:printing:kartvizit düğümü SUBCATEGORY olarak var",
  subNode?.nodeType === "SUBCATEGORY" && subNode.depth === 1,
  subNode ? `${subNode.nodeType}/depth=${subNode.depth}` : "yok",
);
check(
  "kaynağı kurucu kararıdır ve D-0041 notunu taşır",
  subNode?.provenance?.source === "founder-decision" &&
    subNode?.provenance?.note === "D-0041",
  JSON.stringify(subNode?.provenance ?? null),
);
check(
  "alt kategori talep şemasını printing/kartvizit olarak gösterir",
  subNode?.requestSchemaId === "printing/kartvizit",
  subNode?.requestSchemaId ?? "yok",
);

/* ─────────────── 2. Eski kimlik yeni düğüme çözülür ─────────────── */

check(
  "eski yaprak kimliği yeni düğüme çözülür",
  resolveTaxonomyNodeId(OLD_LEAF_ID) === NEW_LEAF_ID,
  resolveTaxonomyNodeId(OLD_LEAF_ID),
);
check(
  "eski kimlikle düğüm okunduğunda yeni düğüm döner",
  getTaxonomyNode(OLD_LEAF_ID)?.id === NEW_LEAF_ID,
  getTaxonomyNode(OLD_LEAF_ID)?.id ?? "yok",
);
check(
  "eski kimliğin şeması yeni alt kategorinin şemasıdır",
  resolveSchemaIdForNode(OLD_LEAF_ID) === "printing/kartvizit",
  resolveSchemaIdForNode(OLD_LEAF_ID) ?? "yok",
);
check(
  "devredilmiş düğüm gezinme ağacında görünmez",
  getSubcategoryTaxonomyNode("printing", "brosur-ve-katalog") !== undefined &&
    getTaxonomyNode(OLD_LEAF_ID)?.subcategoryId === SUBCATEGORY_SLUG,
  getTaxonomyNode(OLD_LEAF_ID)?.subcategoryId ?? "yok",
);

/* ─────────────── 3. Serbest metin → Kartvizit alt kategorisi ─────────────── */

type Cumle = { eksen: string; metin: string };

const KARTVIZIT_CUMLELERI: Cumle[] = [
  { eksen: "düz", metin: "1000 adet kartvizit, mat selefonlu, Topkapı" },
  { eksen: "düz", metin: "kartvizit bastırmak istiyorum" },
  { eksen: "düz", metin: "500 adet kartvizit istanbul" },
  { eksen: "düz", metin: "2000 adet kartvizit çift yüz baskı" },
  { eksen: "düz", metin: "kartvizit baskısı yaptırmak istiyorum" },
  { eksen: "düz", metin: "Ankara'da 1000 adet kartvizit istiyorum" },
  { eksen: "düz", metin: "kuşe 350 gram kartvizit bastıracağım" },
  { eksen: "düz", metin: "oval köşeli kartvizit arıyorum" },
  { eksen: "tek-sözcük", metin: "Kartvizit" },
  { eksen: "tek-sözcük", metin: "kartvizit" },
  { eksen: "büyük-harf", metin: "KARTVİZİT BASTIRMAK İSTİYORUM" },
  { eksen: "büyük-harf", metin: "1000 ADET KARTVİZİT, İZMİR" },
  { eksen: "büyük-harf", metin: "Kartvizit Baskısı İstiyorum" },
  { eksen: "diyakritiksiz", metin: "1000 adet kartvizit bastirmak istiyorum" },
  { eksen: "diyakritiksiz", metin: "kartvızıt bastiracagim" },
  { eksen: "diyakritiksiz", metin: "500 adet kartvizit izmir" },
  { eksen: "yazım-hatası", metin: "kartvzit bastırmak istiyorum" },
  { eksen: "yazım-hatası", metin: "kartvizt bastırmak istiyorum" },
  { eksen: "yazım-hatası", metin: "kartviyit bastırmak istiyorum" },
  { eksen: "yazım-hatası", metin: "1000 adet kartvizitt istiyorum" },
  { eksen: "yazım-hatası", metin: "kartvizirt bastıracağım" },
  { eksen: "TR-EN", metin: "business card printing istanbul 1000 adet" },
  { eksen: "TR-EN", metin: "1000 adet business card bastırmak istiyorum" },
  { eksen: "TR-EN", metin: "kart vizit bastırmak istiyorum" },
];

check(
  "kartvizit cümlesi sayısı en az 20",
  KARTVIZIT_CUMLELERI.length >= 20,
  String(KARTVIZIT_CUMLELERI.length),
);

const eksenSayaci = new Map<string, { toplam: number; gecen: number }>();

for (const { eksen, metin } of KARTVIZIT_CUMLELERI) {
  const { state } = syncFromText(null, metin);
  const ok =
    state.categoryId === "printing" && state.subcategorySlug === SUBCATEGORY_SLUG;
  const sayac = eksenSayaci.get(eksen) ?? { toplam: 0, gecen: 0 };
  sayac.toplam += 1;
  if (ok) sayac.gecen += 1;
  eksenSayaci.set(eksen, sayac);
  check(
    `[${eksen}] "${metin}" → Matbaa ve Ambalaj › Kartvizit`,
    ok,
    `kategori=${state.categoryId ?? "yok"} alt=${state.subcategorySlug ?? "yok"}`,
  );
}

for (const eksen of ["düz", "büyük-harf", "diyakritiksiz", "yazım-hatası", "TR-EN"]) {
  const sayac = eksenSayaci.get(eksen);
  check(
    `eksen "${eksen}" tamamen karşılandı`,
    Boolean(sayac && sayac.gecen === sayac.toplam),
    sayac ? `${sayac.gecen}/${sayac.toplam}` : "eksen yok",
  );
}

/* ─────────────── 4. Komşu ürünler yerinde kalır ─────────────── */

const YERINDE_KALANLAR: Array<{ metin: string; beklenen: string }> = [
  { metin: "1000 adet broşür A5 istanbul", beklenen: "brosur-ve-katalog" },
  { metin: "200 adet katalog bastırmak istiyorum", beklenen: "brosur-ve-katalog" },
  { metin: "500 adet davetiye bastıracağım", beklenen: "brosur-ve-katalog" },
  { metin: "1000 adet antetli kağıt", beklenen: "brosur-ve-katalog" },
  { metin: "50 adet poster bastırmak istiyorum", beklenen: "brosur-ve-katalog" },
  { metin: "1000 adet kitapçık bastıracağım", beklenen: "brosur-ve-katalog" },
  { metin: "5000 adet rulo etiket istiyorum", beklenen: "etiket-baski" },
  { metin: "1000 adet pizza kutusu istiyorum", beklenen: "karton-kutu" },
];

for (const { metin, beklenen } of YERINDE_KALANLAR) {
  const { state } = syncFromText(null, metin);
  check(
    `"${metin}" yerinde kalır → ${beklenen}`,
    state.categoryId === "printing" && state.subcategorySlug === beklenen,
    `kategori=${state.categoryId ?? "yok"} alt=${state.subcategorySlug ?? "yok"}`,
  );
}

/* ─────────────── 5. Şema ve sorular ─────────────── */

const schema = resolveRequestSchema({
  categoryId: "printing",
  subcategorySlug: SUBCATEGORY_SLUG,
});
check(
  "printing/kartvizit profili çözülür",
  schema.profileId === "printing/kartvizit",
  schema.profileId,
);

const profilKeys = listProfilesForCategory({
  categoryId: "printing",
  productType: "Kartvizit",
}).map((p) => p.fieldKey);

const TEKLIF_KRITIK = ["cardFormat", "cardStock", "cardCoating", "cardPrintSides"];
const ISTEGE_BAGLI = ["cardFinish", "cardCorner", "cardDesignReady"];
for (const key of [...TEKLIF_KRITIK, ...ISTEGE_BAGLI]) {
  check(
    `kartvizit sorusu "${key}" sorulabilir`,
    profilKeys.includes(key),
    profilKeys.join(","),
  );
}
check(
  "teslim zamanı matbaa kökünün ortak alanından gelir",
  profilKeys.includes("delivery"),
  profilKeys.join(","),
);

const SIZMAMALI = [
  "publicationPageCount",
  "publicationBinding",
  "flatPrintFold",
  "boxDieLine",
  "labelAdhesive",
];
for (const key of SIZMAMALI) {
  check(
    `komşu ailenin sorusu "${key}" kartvizite sızmaz`,
    !profilKeys.includes(key),
  );
}

/* ─────────────── Sonuç ─────────────── */

const toplam = pass + failures.length;
console.log(
  `\n=== KARTVİZİT ALT KATEGORİSİ (D-0041): ${pass} geçti, ${failures.length} kaldı (${toplam}) ===`,
);
if (MUTATE) {
  console.log("MUTASYON MODU: D-0041 öncesi ağaç yüklendi.");
  if (failures.length === 0) {
    console.error(
      "MUTASYON KONTROLÜ BAŞARISIZ — kusur geri getirildiği hâlde kapı yeşil kaldı.",
    );
    process.exit(1);
  }
  console.log(
    `MUTASYON KONTROLÜ GEÇTİ — kapı ${failures.length} başarısızlıkla kırmızıya döndü.`,
  );
  process.exit(0);
}
if (failures.length) {
  console.error("\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
