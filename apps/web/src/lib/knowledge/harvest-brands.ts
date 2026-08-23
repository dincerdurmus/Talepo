/**
 * Hasat markalarının browse kolonları (Makinecim + Bauhaus + Koçtaş, 2026-08-23).
 * Tek otorite parser marka kataloğudur (respect-existing-authority): buradaki
 * aile kümeleri yalnız SEÇER, isimleri kopyalamaz — katalogda olmayan bir isim
 * kolona asla çıkamaz.
 */

import {
  BABY_BRANDS,
  FURNITURE_BRANDS,
  HOME_KITCHEN_BRANDS,
  MACHINERY_BRANDS,
} from "@/lib/ai/parser/brand-catalog";

import {
  foldWords,
  isAccessoryLeaf,
  matchesHeadNoun,
  matchesHeadPhrase,
  nameFragments,
} from "./head-noun";
import { foldLabel } from "./slug";

export type MachineryBrandFamily =
  | "metal"
  | "construction"
  | "energy"
  | "tools"
  | "printing-press";

/** Aile → katalog canonical isimleri (seçim kümesi). */
const MACHINERY_FAMILY_PICKS: Record<MachineryBrandFamily, string[]> = {
  metal: ["Durma", "Baykal", "Ermaksan", "Magmaweld", "Dalgakıran"],
  construction: ["Caterpillar", "JCB", "Hidromek", "Bobcat"],
  energy: ["Aksa", "Teksan", "Emsa", "Dalgakıran"],
  tools: [
    "Makita",
    "DeWalt",
    "Einhell",
    "Stanley",
    "Black+Decker",
    "İzeltaş",
    "Gardena",
    "Fiskars",
  ],
  "printing-press": ["Heidelberg", "Komori", "Manroland", "Ryobi"],
};

/**
 * Bu modülün ürettiği kolonların kaynağı KÜRATÖRLÜ seçimdir, pazar dağılımı
 * değildir: e-bebek / Koçtaş / Makinecim hasatları taksonomiye yalnız ürün
 * adı getirdi, ürün tipi → marka kırılımı getirmedi (2026-08-23 denetimi).
 * MediaMarkt tabanlı gerçek dağılımla aynı statüde durmaması için kolon bu
 * değerle işaretlenir — bkz. browse.ts / HybridComposerPanels.
 */
export const CURATED_BRAND_SOURCE = "curated" as const;

/** Yaprağın adına/idsine göre makine marka ailesi — eşleşme yoksa kolon yok. */
export function inferMachineryBrandFamily(opts: {
  id: string;
  name: string;
}): MachineryBrandFamily | null {
  if (isAccessoryLeaf(opts.name)) return null;
  const blob = foldLabel(`${opts.id} ${opts.name}`);

  if (
    /(ekskavator|yukleyici|loder|vinc|beton|silindir|kompaktor|forklift|is-makine|dozer|greyder)/.test(
      blob,
    )
  ) {
    return "construction";
  }
  if (/(jenerator|trafo|kompresor|guc-kaynagi)/.test(blob)) {
    return "energy";
  }
  if (
    /(torna|freze|cnc|pres|abkant|giyotin|lazer-kesim|plazma|kaynak|isleme-merkezi|sac-)/.test(
      blob,
    )
  ) {
    return "metal";
  }
  if (
    /(matkap|taslama|vidalama|testere|kirici|dekupaj|gonye|yikama-makinesi|el-alet|hirdavat)/.test(
      blob,
    )
  ) {
    return "tools";
  }
  if (/(matbaa-makinesi|baski-makinesi|ofset)/.test(blob)) {
    return "printing-press";
  }
  return null;
}

/** Kataloğdan türetilmiş aile listesi — katalogda olmayan isim düşer. */
export function machineryBrandsForFamily(
  family: MachineryBrandFamily,
): string[] {
  const canon = new Set(MACHINERY_BRANDS.map((b) => b.canonical));
  return MACHINERY_FAMILY_PICKS[family].filter((name) => canon.has(name));
}

/**
 * Mobilya markası yalnız GERÇEK mobilya ürününde gösterilir (kurucu,
 * 2026-08-23). Bellona/İstikbal koltuk ve dolap satar; paspas, küllük,
 * çöp kutusu gibi aksesuarlarda marka kolonu açmak yanıltıcıdır.
 * Baş isim sonda aranır ("yemek odası takımı" → takım); ünsüz yumuşaması ve
 * aksesuar reddi head-noun.ts'ten gelir, böylece "Koltuk" ile "Yönetici
 * Koltuğu" aynı davranır.
 */
const FURNITURE_HEAD_NOUNS = [
  "koltuk", "kanepe", "çekyat", "berjer", "puf", "takım",
  "masa", "sandalye", "tabure", "bank",
  "dolap", "gardırop", "komodin", "şifonyer", "vitrin", "büfe",
  "yatak", "baza", "karyola", "ranza", "başlık",
  "raf", "kitaplık", "sehpa", "ünite", "konsol", "dresuar",
  "vestiyer", "portmanto", "ayakkabılık", "zigon", "keson", "mobilya",
];

/**
 * Baş isim mobilya olsa da niteleyici ürünü başka bir pazara taşıyorsa kolon
 * açılmaz (kurucu kuralı: marka ürünün kendi pazarından gelir). Bellona dosya
 * dolabı, Doğtaş masaj koltuğu, İstikbal oyuncu koltuğu satmaz.
 *
 * "garaj" bugün hiçbir yaprağı düşürmüyor ve BİLEREK duruyor (kurucu,
 * 2026-08-23: bugün eşleşmemesi kuralın yanlış olduğunu göstermez): ileriye
 * dönüktür, Google'ın garaj dalı henüz taksonomiye alınmadı. Alındığı gün
 * garaj rafı/dolabı ev mobilyası markası almadan gelir.
 */
const FURNITURE_QUALIFIER_REJECTS = [
  "dosya", "posta", "arşiv", "ütü", "şarap", "dikiş", "poker",
  "masaj", "oyun", "armut", "asılı", "banyo", "garaj",
];

function hasFurnitureQualifierReject(name: string): boolean {
  const words = foldWords(name);
  return FURNITURE_QUALIFIER_REJECTS.some((reject) => {
    const stem = foldWords(reject)[0] ?? "";
    return words.some((word) => word === stem || word.startsWith(stem));
  });
}

/**
 * Mobilya pazarı TEK pazar değildir (kurucu, 2026-08-23). Önceki hâlde kolon
 * açan 134 yaprağın tamamı aynı 11 markayı görüyordu; bu kabul edilemez:
 * Çilek çocuk mobilyası markasıydı ve Makam Oda Takımı ile Konferans
 * koltuğunda görünüyordu, Ecza/Anahtar/Emanet/Soyunma Dolabı kurumsal
 * donanımdır ve Bellona/Yataş ürünü değildir, Bahçe Yatakları ev mobilyası
 * markası alıyordu. Marka artık ürünün kendi segmentinden gelir.
 */
export type FurnitureSegment =
  | "ev"
  | "cocuk-genc"
  | "mutfak-dolabi"
  | "ofis-kurumsal"
  | "bahce"
  | "ozel-uretim";

/**
 * Segment → katalogdan SEÇİLEN isimler. `null` = bu segment için güvenilir
 * liste kurulamadı, kolon hiç açılmaz (kurucunun kuralı: bilmiyorsak tahmin
 * etmeyiz, kullanıcı markasını kendi yazar).
 *
 * Katalog tek otorite kalır (respect-existing-authority): burada yalnız seçim
 * yapılır, katalogda olmayan bir isim kolona çıkamaz.
 */
const FURNITURE_SEGMENT_PICKS: Record<FurnitureSegment, string[] | null> = {
  // Ev mobilyası perakendecileri — kataloğun tamamı bu pazarda faaliyette.
  // Çilek DIŞARIDA: yalnız çocuk/genç odası üretir.
  ev: [
    "Adore", "Bellona", "Doğtaş", "Enza", "IKEA",
    "İstikbal", "Kelebek", "Mondi", "Tepe Home", "Yataş",
  ],
  // Uzman önce (c5562bd'deki "flagship first" ilkesi), sonra genç odası
  // serisi olan büyükler. Tepe Home / Adore / Yataş'ın genç odası serisi yok.
  "cocuk-genc": [
    "Çilek", "Bellona", "Doğtaş", "IKEA", "İstikbal", "Kelebek", "Mondi",
  ],
  // Ankastre / hazır mutfak dolabı ayrı bir pazardır. Katalogdan yalnız üçünün
  // gerçek mutfak serisi var (Kelebek Mutfak, Doğtaş Mutfak, IKEA Metod).
  // Listenin dar olduğu kabul edilir; ≥3 eşiğini geçtiği için açık.
  "mutfak-dolabi": ["Doğtaş", "IKEA", "Kelebek"],
  /**
   * KAPALI — 97 yaprak. Bu bir eksiklik değil, karardır (kurucu, 2026-08-23);
   * geri açma.
   *
   * Ofis / kurumsal mobilya AYRI bir pazardır: Nurus, Koleksiyon, Burosit,
   * Ofisel, Tuna, Ergon, Seres. Bu isimlerin HİÇBİRİ `FURNITURE_BRANDS`
   * kataloğunda yok — katalogdaki 11 ismin tamamı ev mobilyası perakendecisi.
   * Ecza / anahtar / emanet / soyunma dolabı ise metal kurumsal donanımdır ve
   * mobilya markası hiç almaz.
   *
   * Buraya ev markalarını koymak, kurucunun 2026-08-23'te adını vererek
   * reddettiği hatanın ta kendisidir (Çilek çocuk mobilyası markasıyken Makam
   * Oda Takımı ve Konferans koltuğunda görünüyordu). Kolonun boş olması,
   * yanlış dolu olmasından iyidir: kullanıcı markasını serbestçe yazabiliyor.
   *
   * Açılmasının TEK yolu: kataloğa gerçek ofis mobilyası markalarının
   * eklenmesi. O gün burası o isimlerden seçer; ev listesi buraya taşınmaz.
   */
  "ofis-kurumsal": null,
  /**
   * KAPALI — 14 yaprak. Aynı gerekçe: bahçe mobilyası ayrı pazardır (Sunset,
   * Novussi, Keter, Nurgaz) ve katalogda yok. Bellona/Yataş bahçe yatağı
   * üretmez. Kataloğa gerçek bahçe markaları girene kadar kapalı kalır.
   */
  bahce: null,
  // KAPALI — 4 yaprak. Ölçüye özel / proje bazlı üretim tanımı gereği
  // markasızdır; burası hiçbir katalog genişlemesiyle açılmaz.
  "ozel-uretim": null,
};

/** Ebeveyn alt kategorisi → segment. En güçlü sinyal ağacın kendisidir. */
const SUBCATEGORY_SEGMENTS: Record<string, FurnitureSegment> = {
  "ofis-mobilyalari": "ofis-kurumsal",
  "ofis-sandalyesi": "ofis-kurumsal",
  "calisma-ofis-masasi": "ofis-kurumsal",
  "toplanti-masasi": "ofis-kurumsal",
  "kafe-ve-restoran": "ofis-kurumsal",
  "ozel-uretim": "ozel-uretim",
};

/** Ebeveyn grubu → segment (alt kategori tek başına yetmediği yerler). */
const GROUP_SEGMENTS: Record<string, FurnitureSegment> = {
  "tax:furniture:diger:bahce-ve-balkon-mobilyasi": "bahce",
  "tax:furniture:ev-mobilyasi:cocuk-genc-odasi": "cocuk-genc",
};

/**
 * Ad düzeyi sinyal — yalnız ebeveyn grubun karışık olduğu yerde kullanılır
 * ("Diğer mobilya" altında Bahçe mobilyası, Bekleme koltuğu ve Çocuk
 * mobilyası yan yana duruyor). Ebeveyn zaten karar verdiyse buraya düşülmez.
 */
const NAME_SEGMENT_SIGNALS: Array<{ words: string[]; segment: FurnitureSegment }> = [
  { words: ["bahçe", "balkon", "veranda", "dış mekan"], segment: "bahce" },
  {
    words: ["ofis", "büro", "yönetici", "toplantı", "bekleme", "konferans", "resepsiyon", "makam", "personel", "operasyon", "misafir"],
    segment: "ofis-kurumsal",
  },
  { words: ["çocuk", "genç", "bebek", "ranza"], segment: "cocuk-genc" },
];

function segmentFromName(name: string): FurnitureSegment | null {
  const words = foldWords(name);
  for (const signal of NAME_SEGMENT_SIGNALS) {
    const hit = signal.words.some((w) => {
      const stem = foldWords(w).join(" ");
      return words.some((word) => word === stem || word.startsWith(stem));
    });
    if (hit) return signal.segment;
  }
  return null;
}

/**
 * Yaprağın mobilya segmenti. Sıra bilerek "ebeveyn önce, ad sonra": kurucunun
 * kuralı, segment atamasının yalnız isimle değil ebeveyn grubuyla birlikte
 * yapılması ("Ofis Mobilyaları > …" ebeveyni bilgiyi zaten veriyor).
 */
export function inferFurnitureSegment(leaf: {
  name: string;
  parentId?: string | null;
  subcategoryId?: string | null;
}): FurnitureSegment {
  const bySubcategory = leaf.subcategoryId
    ? SUBCATEGORY_SEGMENTS[leaf.subcategoryId]
    : undefined;
  if (bySubcategory) return bySubcategory;

  const byGroup = leaf.parentId ? GROUP_SEGMENTS[leaf.parentId] : undefined;
  if (byGroup) return byGroup;

  // Mutfak grubu karışık: dolaplar ankastre pazarı, masa/sandalye ev mobilyası.
  if (leaf.parentId === "tax:furniture:ev-mobilyasi:mutfak") {
    return matchesHeadNoun(leaf.name, ["dolap"]) ? "mutfak-dolabi" : "ev";
  }

  return segmentFromName(leaf.name) ?? "ev";
}

/** Segmentin katalogdan doğrulanmış marka listesi; güvenilir değilse null. */
export function furnitureBrandsForSegment(
  segment: FurnitureSegment,
): string[] | null {
  const picks = FURNITURE_SEGMENT_PICKS[segment];
  if (!picks) return null;
  const canon = new Set(FURNITURE_BRANDS.map((b) => b.canonical));
  const labels = picks.filter((name) => canon.has(name));
  return labels.length >= 3 ? labels : null;
}

/** Mobilya yaprağı için marka listesi — segmentine göre. */
export function furnitureBrandsForProduct(leaf: {
  name: string;
  parentId?: string | null;
  subcategoryId?: string | null;
}): string[] | null {
  if (hasFurnitureQualifierReject(leaf.name)) return null;
  if (!matchesHeadNoun(leaf.name, FURNITURE_HEAD_NOUNS)) return null;
  return furnitureBrandsForSegment(inferFurnitureSegment(leaf));
}

/**
 * Ev & Mutfak: sofra/pişirme ürünlerinde katalog markaları (kurucu,
 * 2026-08-23). Dekor ve sarf malzemesinde marka kolonu açılmaz.
 * "Set" tek başına baş isim DEĞİL (head-noun.ts'te şeffaf): "tencere seti"
 * bir tenceredir, "ankastre eviye seti" bir eviyedir ve eviye markası
 * bu katalogda yoktur.
 */
const KITCHEN_HEAD_NOUNS = [
  "takım",
  "tencere", "tava", "düdüklü", "wok", "cezve", "çaydanlık", "semaver",
  "tabak", "bardak", "kadeh", "kupa", "fincan", "kase", "sürahi", "sofra", "çay",
  "çatal", "bıçak", "kaşık", "servis", "tepsi",
  "termos", "matara", "saklama", "borcam", "güveç",
];

/**
 * Katalog karışık (küçük ev aleti + sofra + aydınlatma); sofra ve pişirme
 * markalarını seçeriz. Kahve makinesi markası porselen takıma çıkmaz.
 */
const KITCHEN_PICKS = [
  "Karaca",
  "Korkmaz",
  "WMF",
  "Fissler",
  "Tefal",
  "Bialetti",
  "Stanley",
  "KitchenAid",
];

export function kitchenBrandsForProductName(name: string): string[] | null {
  if (!matchesHeadNoun(name, KITCHEN_HEAD_NOUNS)) return null;
  const canon = new Set(HOME_KITCHEN_BRANDS.map((b) => b.canonical));
  const labels = KITCHEN_PICKS.filter((pick) => canon.has(pick));
  return labels.length >= 3 ? labels : null;
}

/**
 * Anne & Çocuk: ürün grubuna göre marka (kurucu, 2026-08-23).
 * Bebek bezi markası ile bebek arabası markası aynı değildir; e-bebek
 * envanterindeki grup yapısına göre ayrıldı. Katalog tek otorite kalır:
 * burada yalnız SEÇİM yapılır, katalogda olmayan isim kolona çıkamaz.
 */
const BABY_FAMILY_PICKS: Record<string, string[]> = {
  // Bebek arabası, oto koltuğu, ana kucağı, taşıma, beşik
  gezdirme: [
    "Chicco",
    "Joie",
    "Britax Römer",
    "Prego",
    "Kraft",
    "Babyjem",
    "Baby Home",
    "Bebe Confort",
  ],
  // Bez, ıslak mendil, bakım
  bakim: ["Prima", "Molfix", "Sleepy", "Huggies", "Uni Baby", "Babyjem"],
  // Biberon, emzik, mama, sterilizatör
  beslenme: [
    "Philips Avent",
    "Chicco",
    "Mamajoo",
    "Lansinoh",
    "Mamamil",
    "Hipp",
    "Bebelac",
  ],
  // Akülü araba, yürüteç, salıncak — sürüş & aktivite. Genel "oyuncak"
  // BİLEREK dışarıda: Pilsan akülü araba üretir, sanat-çizim oyuncağı değil;
  // oyuncak pazarının ürün tipi bazlı dağılımı elimizde yok.
  surus: ["Fisher-Price", "Pilsan", "Chicco", "Babyjem", "Hellobaby"],
};

/**
 * Baş isim kalıpları (adın SONU). Alt-dize araması bilerek terk edildi:
 * "yatak" araması "Yatak koruyucu"yu da yakalıyordu ve "Bebek Yatağı" ile
 * "Beşik" kardeş oldukları hâlde zıt davranıyorlardı.
 */
const BABY_RULES: Array<{ words: string[]; family: keyof typeof BABY_FAMILY_PICKS }> = [
  {
    // "bez" tek başına YOK: "Gaz Çıkarma ve Omuz Bezleri" bir bezdir ama
    // bebek bezi pazarı değildir, Prima omuz bezi üretmez.
    words: ["bebek bez", "ıslak mendil", "mendil", "küvet", "pişik krem", "bakım set", "alt açma minderi"],
    family: "bakim",
  },
  {
    words: ["biberon", "emzik", "mama", "mama sandalye", "mama ısıtıcı", "sterilizatör", "göğüs pompa", "alıştırma bardak", "suluk", "diş kaşıyıcı"],
    family: "beslenme",
  },
  {
    words: ["akülü araba", "yürüteç", "salıncak", "hoppala", "bisiklet", "scooter", "oyun park"],
    family: "surus",
  },
  {
    words: ["bebek araba", "puset", "oto koltuk", "ana kucak", "kanguru", "portbebe", "beşik", "park yatak", "bebek yatak", "karyola"],
    family: "gezdirme",
  },
];

/** Bebek ürünü adına göre marka listesi; eşleşme yoksa null. */
export function babyBrandsForProductName(name: string): string[] | null {
  const fragments = nameFragments(name);
  if (fragments.length === 0) return null;
  if (isAccessoryLeaf(name)) return null;
  const canon = new Set(BABY_BRANDS.map((b) => b.canonical));
  for (const rule of BABY_RULES) {
    const hit = rule.words.some((word) =>
      fragments.some((words) => matchesHeadPhrase(words, word)),
    );
    if (!hit) continue;
    const picks = BABY_FAMILY_PICKS[rule.family]!.filter((n) => canon.has(n));
    return picks.length >= 3 ? picks : null;
  }
  return null;
}
