/**
 * Ürün tipine göre marka listesi (kurucu, 2026-08-23).
 *
 * Kaynak: MediaMarkt envanterinden türetilmiş gerçek dağılım —
 * data/taxonomy-sources/mediamarkt-product-brands.json (42.498 ürün tarandı;
 * üreteç script depoda DEĞİLDİR, dosya çıktı olarak commit edilir).
 *
 * Neden: "aile" bazlı marka listesi mikrofon, megafon ve ses aksesuarına
 * aynı kolonu veriyordu. Marka artık ürünün kendi pazarından gelir.
 */
import productBrands from "../../../../../data/taxonomy-sources/mediamarkt-product-brands.json";

import { isAccessoryLeaf, matchesHeadPhrase, nameFragments } from "./head-noun";

type ProductBrandFile = {
  source: string;
  productTypes: Record<string, { total: number; brands: string[] }>;
};

const DATA = productBrands as ProductBrandFile;

/**
 * Bu modülün ürettiği kolonun kaynağı GERÇEK PAZAR VERİSİ. Küratörlü
 * listelerle (harvest-brands.ts) aynı statüde durmaması için kolon bu değerle
 * işaretlenir — bkz. browse.ts / HybridComposerPanels.
 */
export const MARKET_BRAND_SOURCE = "mediamarkt" as const;

/**
 * Taksonomi yaprağının adı → MediaMarkt ürün tipi anahtarı.
 *
 * İki kural (kurucu denetimi, 2026-08-23):
 *  - Kelime sınırı zorunlu: "oluklu kutu" ÜTÜ değildir, "fırın kabı" FIRIN
 *    değildir. Alt-dize eşleşmesi saçma marka kolonları üretiyordu.
 *  - Kategori kapsamı: "monitör" yalnız teknolojide bilgisayar monitörüdür;
 *    sağlıktaki "hasta monitörü" bilgisayar markası almaz.
 */
type BrandRule = {
  /** Kelime dizisi kalıpları — tam kelime eşleşir, alt-dize eşleşmez. */
  words: string[];
  type: string;
  /** Yalnız bu kategorilerde geçerli (yoksa: her kategoride). */
  cats?: string[];
};

const TECH = ["technology"];
/**
 * `home-kitchen` bugün ÖLÜ bir kapsam girdisidir ve bilerek duruyor (kurucu,
 * 2026-08-23: "sil deme, neden ölü olduğunu yaz"). Ölçüm: aşağıdaki HOME
 * kurallarının hiçbiri tek bir ev & mutfak yaprağını tutmuyor — o kategorideki
 * yakın adlar aksesuar ("Buzdolabı Magnetleri") ya da kap ("Fırın kabı")
 * olduğu için baş isim kuralında zaten düşüyor. Girdi kaldırılırsa, ev & mutfak
 * ağacına ileride gerçek bir beyaz eşya yaprağı eklendiğinde (ankastre fırın,
 * ankastre ocak) kolon sessizce açılmaz ve bunu kimse fark etmez. Kapsam
 * durduğu sürece o gün kolon kendiliğinden doğru davranır.
 */
const HOME = ["appliances", "home-kitchen"];

const RULES: BrandRule[] = [
  // —— Ses / görüntü ——
  { words: ["soundbar"], type: "soundbar", cats: TECH },
  { words: ["kulaklik", "kulak ici kulaklik"], type: "kulaklik", cats: TECH },
  { words: ["megafon"], type: "megafon", cats: TECH },
  { words: ["mikrofon"], type: "mikrofon", cats: TECH },
  { words: ["hoparlor", "bluetooth hoparlor"], type: "hoparlor", cats: TECH },
  /**
   * Çıplak "tv" kalıbı KALDIRILDI (kurucu, 2026-08-23). Türkçe baş isim kuralı
   * adın sonunu tuttuğu için "Uydu ve Kablo TV" yaprağı bu kalıba düşüyor ve
   * televizyonun MediaMarkt listesini (Samsung, LG, TCL…) aynen alıyordu. Uydu
   * ve kablo TV bir abonelik alanıdır, televizyon değil — Samsung uydu
   * aboneliği satmaz. Ölçüm: "tv" kalıbı tüm ağaçta YALNIZ o yaprağı tutuyordu;
   * gerçek televizyon yaprağı "televizyon" kalıbıyla zaten eşleşiyor, yani
   * kaldırmanın hiçbir maliyeti yok.
   */
  { words: ["televizyon"], type: "televizyon", cats: TECH },
  { words: ["projeksiyon cihaz", "projeksiyon", "projektor"], type: "projeksiyon", cats: TECH },
  { words: ["monitor", "bilgisayar monitoru"], type: "monitor", cats: TECH },
  // —— Oyun ——
  { words: ["oyun konsol", "konsol"], type: "oyun-konsolu", cats: TECH },
  { words: ["gamepad", "oyun kol"], type: "gamepad", cats: TECH },
  // —— Kamera ——
  { words: ["drone", "dron"], type: "drone", cats: TECH },
  { words: ["objektif"], type: "objektif", cats: TECH },
  {
    words: ["fotograf makine", "aynasiz fotograf makine", "dslr fotograf makine", "kompakt fotograf makine"],
    type: "fotograf-makinesi",
    cats: TECH,
  },
  { words: ["kamera", "aksiyon kamera", "video kamera"], type: "kamera", cats: TECH },
  // —— Giyilebilir / ağ / çevre ——
  { words: ["akilli saat", "smartwatch"], type: "akilli-saat", cats: TECH },
  { words: ["akilli bileklik", "bileklik"], type: "bileklik", cats: TECH },
  { words: ["modem", "router", "mesh wi fi sistem", "access point", "ag anahtar switch"], type: "modem", cats: TECH },
  { words: ["yazici"], type: "yazici", cats: TECH },
  { words: ["tarayici"], type: "tarayici", cats: TECH },
  { words: ["klavye"], type: "klavye", cats: TECH },
  { words: ["mouse", "fare"], type: "mouse", cats: TECH },
  { words: ["webcam"], type: "webcam", cats: TECH },
  // —— Bilgisayar / telefon ——
  {
    words: ["dizustu bilgisayar", "laptop", "notebook", "oyun bilgisayar"],
    type: "dizustu-bilgisayar",
    cats: TECH,
  },
  {
    words: ["masaustu bilgisayar", "masaustu", "all in one", "mini pc", "is istasyon"],
    type: "masaustu-bilgisayar",
    cats: TECH,
  },
  { words: ["tablet", "tablet bilgisayar"], type: "tablet", cats: TECH },
  { words: ["cep telefon", "akilli telefon", "telefon"], type: "cep-telefonu", cats: TECH },
  // —— Beyaz eşya / mutfak (yalnız o kategorilerde) ——
  { words: ["buzdolabi", "buzdolap", "mini buzdolabi"], type: "buzdolabi", cats: HOME },
  { words: ["camasir makine"], type: "camasir-makinesi", cats: HOME },
  { words: ["bulasik makine"], type: "bulasik-makinesi", cats: HOME },
  { words: ["firin", "ankastre firin", "set ustu ocak", "ankastre ocak"], type: "firin", cats: HOME },
  { words: ["klima"], type: "klima", cats: HOME },
  {
    words: ["supurge", "robot supurge", "dikey supurge", "elektrikli supurge", "islak kuru supurge"],
    type: "supurge",
    cats: HOME,
  },
  { words: ["kahve makine", "espresso makine"], type: "kahve-makinesi", cats: HOME },
  { words: ["utu", "utu istasyon"], type: "utu", cats: HOME },
  { words: ["sac kurutma makine", "fon makine"], type: "sac-kurutma", cats: HOME },
  { words: ["tiras makine"], type: "tiras-makinesi", cats: HOME },
];

/**
 * Ürün adı (ve kategorisi) için gerçek pazar markaları; eşleşme yoksa null.
 * Kategori verilmezse kapsam kontrolü yapılmaz (geriye dönük uyum).
 *
 * Baş isim kuralı, ünsüz yumuşaması ve aksesuar reddi head-noun.ts'te tek
 * yerde tanımlıdır; burada yalnız MediaMarkt tablosuna bakılır.
 */
export function brandsForProductName(
  name: string,
  categoryId?: string | null,
): string[] | null {
  const fragments = nameFragments(name);
  if (fragments.length === 0) return null;
  if (isAccessoryLeaf(name)) return null;
  for (const rule of RULES) {
    if (rule.cats && categoryId && !rule.cats.includes(categoryId)) continue;
    const hit = rule.words.some((word) =>
      fragments.some((words) => matchesHeadPhrase(words, word)),
    );
    if (!hit) continue;
    const entry = DATA.productTypes[rule.type];
    if (entry && entry.brands.length >= 3) return entry.brands;
    return null;
  }
  return null;
}

/** Kaç ürün tipinin gerçek marka listesi var (doğrulayıcılar için). */
export function productBrandTypeCount(): number {
  return Object.keys(DATA.productTypes).length;
}
