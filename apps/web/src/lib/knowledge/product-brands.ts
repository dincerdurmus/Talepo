/**
 * Ürün tipine göre marka listesi (kurucu, 2026-08-23).
 *
 * Kaynak: MediaMarkt envanterinden türetilmiş gerçek dağılım —
 * data/taxonomy-sources/mediamarkt-product-brands.json (42.498 ürün taranarak
 * scratchpad/build-product-brands.mjs ile üretilir, elle düzenlenmez).
 *
 * Neden: "aile" bazlı marka listesi mikrofon, megafon ve ses aksesuarına
 * aynı kolonu veriyordu. Marka artık ürünün kendi pazarından gelir.
 */
import productBrands from "../../../../../data/taxonomy-sources/mediamarkt-product-brands.json";

type ProductBrandFile = {
  source: string;
  productTypes: Record<string, { total: number; brands: string[] }>;
};

const DATA = productBrands as ProductBrandFile;

const FOLD: Record<string, string> = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", İ: "i",
  ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
};

function fold(value: string): string {
  return value
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (m) => FOLD[m] ?? m)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Taksonomi yaprağının adı → MediaMarkt ürün tipi anahtarı.
 * Sıra önemlidir: en özel imza önce denenir.
 */
const NAME_TO_TYPE: Array<[RegExp, string]> = [
  [/soundbar/, "soundbar"],
  [/kulaklik|kulak ici|kulak-ici/, "kulaklik"],
  [/megafon/, "megafon"],
  [/mikrofon/, "mikrofon"],
  [/hoparlor/, "hoparlor"],
  [/televizyon|(^| )tv( |$)/, "televizyon"],
  [/projeksiyon|projektor/, "projeksiyon"],
  [/monitor/, "monitor"],
  [/oyun konsolu|konsol/, "oyun-konsolu"],
  [/gamepad|oyun kolu/, "gamepad"],
  [/drone|dron/, "drone"],
  [/objektif/, "objektif"],
  [/fotograf makinesi|aynasiz|dslr|kompakt fotograf/, "fotograf-makinesi"],
  [/kamera/, "kamera"],
  [/akilli saat|smartwatch/, "akilli-saat"],
  [/bileklik/, "bileklik"],
  [/modem|router|mesh|access point/, "modem"],
  [/yazici/, "yazici"],
  [/tarayici/, "tarayici"],
  [/klavye/, "klavye"],
  [/mouse|fare/, "mouse"],
  [/webcam/, "webcam"],
  [/dizustu|laptop|notebook|oyun bilgisayari/, "dizustu-bilgisayar"],
  [/masaustu|all in one|mini pc|is istasyonu/, "masaustu-bilgisayar"],
  [/ag anahtari|switch/, "modem"],
  [/tablet/, "tablet"],
  [/cep telefonu|akilli telefon/, "cep-telefonu"],
  [/buzdolabi/, "buzdolabi"],
  [/camasir makinesi/, "camasir-makinesi"],
  [/bulasik makinesi/, "bulasik-makinesi"],
  [/firin|ocak/, "firin"],
  [/klima/, "klima"],
  [/supurge/, "supurge"],
  [/kahve makinesi|espresso/, "kahve-makinesi"],
  [/utu/, "utu"],
  [/sac kurutma|fon makinesi/, "sac-kurutma"],
  [/tiras makinesi/, "tiras-makinesi"],
];

/** Ürün adı için gerçek pazar markaları; eşleşme yoksa null (aileye düşer). */
export function brandsForProductName(name: string): string[] | null {
  const folded = fold(name);
  if (!folded) return null;
  for (const [pattern, key] of NAME_TO_TYPE) {
    if (!pattern.test(folded)) continue;
    const entry = DATA.productTypes[key];
    if (entry && entry.brands.length >= 3) return entry.brands;
    return null;
  }
  return null;
}

/** Kaç ürün tipinin gerçek marka listesi var (doğrulayıcılar için). */
export function productBrandTypeCount(): number {
  return Object.keys(DATA.productTypes).length;
}
