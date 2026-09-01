/**
 * BEYİN ADVERSARIAL KORPUSU V1 (98+ Faz I, 2026-09-01).
 *
 * 1000+ üretim-eşdeğer talep varyasyonu: 11 kategori ailesi × gerçekçi taban
 * cümleler × deterministik kaos dönüşümleri (diyakritiksiz, küçük/büyük
 * harf, konuşma dili, typo, boşluk, ANY eki, bütçe eki).
 *
 * ZEMİN GERÇEĞİ ŞABLONDAN GELİR: her taban cümle beklenen kategori kümesini,
 * tür kümesini, beyan edilen marka/model/sayı rollerini ve ANY alanlarını
 * kendisi taşır. Doğrulayıcı hiçbir beklentiyi motora sızdırmaz (girdi yalnız
 * ham metindir) ve motorun çıktısını bu beyanlarla karşılaştırır.
 *
 * DÜRÜSTLÜK SÖZLEŞMESİ:
 *  - TYPO varyantında doğru çözüm ZORUNLU DEĞİLDİR; zorunlu olan, YÜKSEK
 *    GÜVENLE YANLIŞ kategori/tür iddia etmemektir (kalibrasyon).
 *  - Diyakritiksiz varyantta tam doğruluk beklenir (Türk kullanıcı gerçeği).
 *  - Halüsinasyon evrenseldir: beyan edilmemiş marka/model/adet/bütçe hiçbir
 *    varyantta DEĞER olarak üretilemez.
 *
 * DETERMİNİZM: Date/Math.random yok; typo konumu girdinin kendi
 * karakterlerinden türetilir.
 */

export type CorpusExpected = {
  /** Kabul edilen kategori kümesi; boş küme = kategori iddiası serbest. */
  categories: readonly string[];
  /** Kabul edilen requestSubject.kind kümesi; boş = serbest. */
  kinds: readonly string[];
  /** Kullanıcının beyan ettiği marka (katlanmış karşılaştırma) — yoksa null. */
  brand: string | null;
  /** Marka beyanı yokken markanın DEĞER üretmesi halüsinasyondur (her zaman). */
  model: string | null;
  /** Beyan edilen adet (value+unit) — yoksa null. */
  quantity: { value: number; unit?: string } | null;
  /** Beyan edilen bütçe (max) — yoksa null. */
  budgetMax: number | null;
  /** Bu sayılar adet YA DA bütçe kanalına ASLA yazılamaz (rol saldırısı). */
  forbiddenNumbers: readonly number[];
  /** ANY beklenen alanlar (ANY eki uygulanınca doldurulur). */
  anyFields: readonly string[];
  /** Beklenen talep kapsamı. */
  scope: "SUPPORTED" | "UNSUPPORTED_SUPPLY" | "UNSUPPORTED_MEDICAL_ADVICE";
  /** Kullanıcı zaten söylediği için SORULMAMASI gereken soru anahtarları. */
  answeredKeys: readonly string[];
  /** Ürün türü zemin gerçeği: envelope product kanalı bu jetonlardan en az
   * birini (katlanmış) içermelidir. Boş dizi = NOT_APPLICABLE. */
  productTokens: readonly string[];
  /** Beklenen kanonik varlık (resolvedEntities). null = ölçüm evreni dışı. */
  expectedEntity: string | null;
};

export type CorpusCase = {
  id: string;
  baseId: string;
  variant: string;
  input: string;
  /** Kaos varyantı mı (typo) — kalibrasyon kuralı uygulanır. */
  lossy: boolean;
  expected: CorpusExpected;
};

type BaseTemplate = {
  id: string;
  input: string;
  expected: Partial<CorpusExpected> & {
    categories: readonly string[];
    kinds: readonly string[];
  };
  /** ANY eki uygulanabilir mi ("marka fark etmez"). */
  allowAnyBrand?: boolean;
  /** Bütçe eki uygulanabilir mi ("bütçem 20 bin TL"). */
  allowBudgetSuffix?: boolean;
};

function full(e: BaseTemplate["expected"]): CorpusExpected {
  return {
    brand: null,
    model: null,
    quantity: null,
    budgetMax: null,
    forbiddenNumbers: [],
    anyFields: [],
    productTokens: [],
    expectedEntity: null,
    scope: "SUPPORTED",
    answeredKeys: [],
    ...e,
  };
}

/* ------------------------------------------------------------------ *
 * TABAN ŞABLONLAR — 11 kategori ailesi                                *
 * ------------------------------------------------------------------ */
const BASES: BaseTemplate[] = [
  // AUTOMOTIVE
  { id: "auto-a", input: "Volkswagen Passat 2020 model arıyorum", allowBudgetSuffix: true, expected: { productTokens: [], categories: ["automotive"], kinds: ["VEHICLE"], brand: "volkswagen", model: "passat", forbiddenNumbers: [2020], answeredKeys: ["brand", "model", "modelYear"] } },
  { id: "auto-b", input: "İkinci el araba almak istiyorum", allowBudgetSuffix: true, expected: { categories: ["automotive"], kinds: ["VEHICLE"], answeredKeys: ["condition"] } },
  { id: "auto-c", input: "Golf 7 için ön far arıyorum", expected: { categories: ["automotive"], kinds: ["PART"], brand: "volkswagen", model: "golf" } },
  { id: "auto-d", input: "Araba lastiği arıyorum 205/55 R16", expected: { productTokens: ["lasti"], categories: ["automotive"], kinds: ["PRODUCT", "PART"], forbiddenNumbers: [205, 55, 16] } },
  { id: "auto-e", input: "Renault Clio bakımı yaptırmak istiyorum", expected: { categories: ["automotive"], kinds: ["SERVICE"], brand: "renault", model: "clio" } },
  { id: "auto-f", input: "Tofaş Şahin için tampon lazım", expected: { categories: ["automotive"], kinds: ["PART"], brand: "tofas", model: "sahin" } },
  { id: "auto-g", input: "0 km SUV arıyorum bütçem 2 milyon TL", expected: { categories: ["automotive"], kinds: ["VEHICLE"], budgetMax: 2_000_000, answeredKeys: ["budget", "condition"] } },
  { id: "auto-h", input: "BMW 320i arıyorum", allowBudgetSuffix: true, expected: { categories: ["automotive"], kinds: ["VEHICLE"], brand: "bmw", model: "320" } },
  // TECHNOLOGY
  { id: "tech-a", input: "iPhone 15 Pro Max arıyorum", allowBudgetSuffix: true, expected: { productTokens: ["iphone", "telefon"], categories: ["technology"], kinds: ["PRODUCT"], brand: "apple", model: "iphone 15", answeredKeys: ["brand"] } },
  { id: "tech-b", input: "Oyun bilgisayarı arıyorum 32 GB RAM olsun", allowAnyBrand: true, allowBudgetSuffix: true, expected: { productTokens: ["bilgisayar"], categories: ["technology"], kinds: ["PRODUCT"], forbiddenNumbers: [32] } },
  { id: "tech-c", input: "Muhasebe yazılımı lisansı arıyorum", expected: { productTokens: ["yazılım", "yazilim"], categories: ["technology"], kinds: ["PRODUCT"] } },
  { id: "tech-d", input: "Samsung televizyon arıyorum 55 inç", expected: { productTokens: ["televizyon"], categories: ["technology"], kinds: ["PRODUCT"], brand: "samsung", forbiddenNumbers: [55], answeredKeys: ["brand", "screenSize"] } },
  { id: "tech-e", input: "Sunucu bakım hizmeti arıyorum", expected: { categories: ["technology"], kinds: ["SERVICE"] } },
  { id: "tech-f", input: "Laptop lazım acil", allowAnyBrand: true, allowBudgetSuffix: true, expected: { productTokens: ["laptop"], categories: ["technology"], kinds: ["PRODUCT"] } },
  { id: "tech-g", input: "Logo muhasebe programı arıyorum", expected: { categories: ["technology"], kinds: ["PRODUCT"] } },
  { id: "tech-h", input: "Web sitesi yaptırmak istiyorum", expected: { categories: ["services", "technology"], kinds: ["SERVICE", "MANUFACTURED_ITEM", "PRODUCT"] } },
  // APPLIANCES
  { id: "appl-a", input: "Çamaşır makinesi arıyorum 9 kg", allowAnyBrand: true, allowBudgetSuffix: true, expected: { productTokens: ["çamaşır", "camasir"], categories: ["appliances"], kinds: ["PRODUCT"], forbiddenNumbers: [9], answeredKeys: ["capacity"] } },
  { id: "appl-b", input: "Arçelik bulaşık makinesi bakıyorum", allowBudgetSuffix: true, expected: { productTokens: ["bulaşık", "bulasik"], categories: ["appliances"], kinds: ["PRODUCT"], brand: "arcelik", answeredKeys: ["brand"] } },
  { id: "appl-c", input: "İnverter klima arıyorum 12000 BTU", expected: { productTokens: ["klima"], categories: ["appliances"], kinds: ["PRODUCT"], forbiddenNumbers: [12000] } },
  { id: "appl-d", input: "Buzdolabı arıyorum, no-frost olsun", allowAnyBrand: true, expected: { productTokens: ["buzdolab"], categories: ["appliances"], kinds: ["PRODUCT"] } },
  { id: "appl-e", input: "Bosch ankastre fırın arıyorum", expected: { productTokens: ["fırın", "firin"], categories: ["appliances"], kinds: ["PRODUCT"], brand: "bosch", answeredKeys: ["brand"] } },
  { id: "appl-f", input: "Klima için dış ünite fan motoru arıyorum", expected: { categories: ["automotive", "appliances"], kinds: ["PART"] } },
  { id: "appl-g", input: "Dikey süpürge arıyorum", allowAnyBrand: true, allowBudgetSuffix: true, expected: { productTokens: ["süpürge", "supurge"], categories: ["appliances"], kinds: ["PRODUCT"] } },
  // FURNITURE
  { id: "furn-a", input: "Yemek masası arıyorum 6 kişilik ahşap", expected: { productTokens: ["masa"], categories: ["furniture"], kinds: ["PRODUCT"], forbiddenNumbers: [6], answeredKeys: ["material"] } },
  { id: "furn-b", input: "Ergonomik ofis koltuğu arıyorum", allowAnyBrand: true, allowBudgetSuffix: true, expected: { productTokens: ["koltu"], categories: ["furniture"], kinds: ["PRODUCT"] } },
  { id: "furn-c", input: "Koltuk takımı arıyorum", allowAnyBrand: true, allowBudgetSuffix: true, expected: { productTokens: ["koltu"], categories: ["furniture"], kinds: ["PRODUCT"] } },
  { id: "furn-d", input: "Masa için özel bağlantı aparatı arıyorum", expected: { categories: ["furniture", "machinery"], kinds: ["PART", "ACCESSORY", "PRODUCT"] } },
  { id: "furn-e", input: "Sandalye arıyorum 4 adet", expected: { productTokens: ["sandalye"], categories: ["furniture"], kinds: ["PRODUCT"], quantity: { value: 4, unit: "adet" }, answeredKeys: ["quantity"] } },
  // HOME-KITCHEN
  { id: "home-a", input: "Çelik tencere kapağı arıyorum 24 cm", expected: { categories: ["home-kitchen"], kinds: ["PART", "PRODUCT", "ACCESSORY"], forbiddenNumbers: [24] } },
  { id: "home-b", input: "Tabak takımı arıyorum", allowAnyBrand: true, allowBudgetSuffix: true, expected: { productTokens: ["tabak"], categories: ["home-kitchen"], kinds: ["PRODUCT"] } },
  { id: "home-c", input: "6 kişilik kahve fincanı seti arıyorum", expected: { productTokens: ["fincan"], categories: ["home-kitchen"], kinds: ["PRODUCT"], forbiddenNumbers: [6] } },
  { id: "home-d", input: "Çaydanlık arıyorum", allowAnyBrand: true, expected: { productTokens: ["çaydanlık", "caydanlik"], categories: ["home-kitchen", "appliances"], kinds: ["PRODUCT"] } },
  // BABY
  { id: "baby-a", input: "Bebek arabası arıyorum", allowAnyBrand: true, allowBudgetSuffix: true, expected: { productTokens: ["bebek arabası", "bebek arabasi"], categories: ["baby"], kinds: ["PRODUCT"] } },
  { id: "baby-b", input: "Bebek arabası için tekerlek arıyorum", expected: { categories: ["baby"], kinds: ["PART"] } },
  { id: "baby-c", input: "Mama sandalyesi arıyorum", allowAnyBrand: true, expected: { productTokens: ["mama sandalyesi"], categories: ["baby"], kinds: ["PRODUCT"] } },
  { id: "baby-d", input: "Bebek bezi arıyorum 4 numara", expected: { productTokens: ["bez"], categories: ["baby"], kinds: ["PRODUCT"], forbiddenNumbers: [4] } },
  // HEALTH
  { id: "hlth-a", input: "Tansiyon aleti arıyorum", allowAnyBrand: true, allowBudgetSuffix: true, expected: { productTokens: ["tansiyon"], categories: ["health"], kinds: ["PRODUCT", "MEDICAL_DEVICE"] } },
  { id: "hlth-b", input: "Tekerlekli sandalye arıyorum", allowAnyBrand: true, expected: { productTokens: ["sandalye"], categories: ["health"], kinds: ["PRODUCT", "MEDICAL_DEVICE"] } },
  { id: "hlth-c", input: "Hasta yatağı kiralamak istiyorum", expected: { productTokens: ["yatak", "yatağı", "yatagi"], categories: ["health"], kinds: ["PRODUCT", "MEDICAL_DEVICE"] } },
  { id: "hlth-d", input: "Hangi tansiyon ilacını kullanmalıyım", expected: { categories: [], kinds: [], scope: "UNSUPPORTED_MEDICAL_ADVICE" } },
  { id: "hlth-e", input: "Ağrı kesici arıyorum", expected: { categories: ["health"], kinds: ["PRODUCT"] } },
  // REAL-ESTATE
  { id: "re-a", input: "Kiralık daire arıyorum 2+1", expected: { categories: ["real-estate"], kinds: ["REAL_ESTATE", "PROPERTY"], productTokens: ["daire"], forbiddenNumbers: [2, 1, 3], answeredKeys: ["roomCount", "listingType"] } },
  { id: "re-b", input: "Satılık arsa arıyorum", allowBudgetSuffix: true, expected: { categories: ["real-estate"], kinds: ["REAL_ESTATE", "PROPERTY"], productTokens: ["arsa"], answeredKeys: ["listingType"] } },
  { id: "re-c", input: "3+1 daire arıyorum Kadıköy", expected: { categories: ["real-estate"], kinds: ["REAL_ESTATE", "PROPERTY"], productTokens: ["daire"], forbiddenNumbers: [3, 1, 4], answeredKeys: ["roomCount"] } },
  { id: "re-d", input: "Ofis kiralamak istiyorum", expected: { categories: ["real-estate"], kinds: ["REAL_ESTATE", "PROPERTY"], productTokens: ["ofis"], answeredKeys: ["listingType"] } },
  // SERVICES
  { id: "svc-a", input: "Ev temizliği hizmeti arıyorum", expected: { categories: ["services"], kinds: ["SERVICE"] } },
  { id: "svc-b", input: "Evden eve nakliye arıyorum", expected: { categories: ["services"], kinds: ["SERVICE"] } },
  { id: "svc-c", input: "Düğün fotoğrafçısı arıyorum", expected: { categories: ["services"], kinds: ["SERVICE"] } },
  { id: "svc-d", input: "logo tasarımı arıyorum", expected: { categories: ["services", "printing"], kinds: ["SERVICE"] } },
  { id: "svc-e", input: "Boya badana yaptırmak istiyorum", expected: { categories: ["services"], kinds: ["SERVICE"] } },
  { id: "svc-f", input: "Matematik özel ders arıyorum", expected: { categories: ["services"], kinds: ["SERVICE"] } },
  { id: "svc-g", input: "Evimi kiraya vermek için emlakçı arıyorum", expected: { categories: ["services"], kinds: ["SERVICE"] } },
  { id: "svc-h", input: "Aracımı satmak istiyorum", expected: { categories: [], kinds: [], scope: "UNSUPPORTED_SUPPLY" } },
  // MACHINERY
  { id: "mach-a", input: "CNC tezgahı arıyorum", allowBudgetSuffix: true, expected: { productTokens: ["cnc"], expectedEntity: "machine-type:cnc-tezgahi", categories: ["machinery"], kinds: ["INDUSTRIAL_EQUIPMENT", "PRODUCT"] } },
  { id: "mach-b", input: "Torna tezgahı için yedek parça arıyorum", expected: { categories: ["machinery"], kinds: ["PART"] } },
  { id: "mach-c", input: "Forklift kiralamak istiyorum", expected: { categories: ["machinery"], kinds: ["INDUSTRIAL_EQUIPMENT", "PRODUCT"] } },
  { id: "mach-d", input: "Paketleme makinesi arıyorum", allowBudgetSuffix: true, expected: { productTokens: ["paketleme"], categories: ["machinery"], kinds: ["INDUSTRIAL_EQUIPMENT", "PRODUCT"] } },
  { id: "mach-e", input: "500 litre kompresör arıyorum", expected: { productTokens: ["kompresör", "kompresor"], categories: ["machinery"], kinds: ["INDUSTRIAL_EQUIPMENT", "PRODUCT"], forbiddenNumbers: [500] } },
  // EK TABANLAR (98+ genisletme - 1000+ hedefi)
  { id: "auto-i", input: "Fiat Egea dizel otomatik arıyorum", allowBudgetSuffix: true, expected: { categories: ["automotive"], kinds: ["VEHICLE"], brand: "fiat", model: "egea", answeredKeys: ["brand", "model", "fuel", "transmission"] } },
  { id: "auto-j", input: "Motosiklet kaskı arıyorum", allowAnyBrand: true, expected: { categories: ["automotive"], kinds: ["PRODUCT", "ACCESSORY"] } },
  { id: "tech-i", input: "PlayStation 5 arıyorum", allowBudgetSuffix: true, expected: { productTokens: ["playstation"], categories: ["technology"], kinds: ["PRODUCT"], brand: "sony", model: "playstation" } },
  { id: "tech-j", input: "Kablosuz kulaklık arıyorum", allowAnyBrand: true, allowBudgetSuffix: true, expected: { productTokens: ["kulaklık", "kulaklik"], categories: ["technology"], kinds: ["PRODUCT"] } },
  { id: "tech-k", input: "Excel raporlama otomasyonu yaptırmak istiyorum", expected: { categories: ["technology", "services"], kinds: ["SERVICE", "MANUFACTURED_ITEM", "PRODUCT"] } },
  { id: "appl-h", input: "Solo kahve makinesi arıyorum", allowBudgetSuffix: true, expected: { productTokens: ["kahve"], categories: ["appliances"], kinds: ["PRODUCT"] } },
  { id: "home-e", input: "Granit tava seti arıyorum", allowAnyBrand: true, expected: { productTokens: ["tava"], categories: ["home-kitchen"], kinds: ["PRODUCT"] } },
  { id: "home-f", input: "Cam saklama kabı arıyorum 10 adet", expected: { productTokens: ["saklama"], categories: ["home-kitchen"], kinds: ["PRODUCT"], quantity: { value: 10, unit: "adet" }, answeredKeys: ["quantity"] } },
  { id: "furn-f", input: "Beyaz gardırop arıyorum 2 kapaklı", expected: { productTokens: ["gardırop", "gardirop"], categories: ["furniture"], kinds: ["PRODUCT"], forbiddenNumbers: [2] } },
  { id: "hlth-f", input: "İşitme cihazı arıyorum", allowAnyBrand: true, expected: { productTokens: ["işitme", "isitme"], categories: ["health"], kinds: ["PRODUCT", "MEDICAL_DEVICE"] } },
  { id: "svc-i", input: "Klima montajı yaptırmak istiyorum", expected: { categories: ["services", "appliances"], kinds: ["SERVICE"] } },
  { id: "svc-j", input: "Muhasebeci arıyorum aylık", expected: { categories: ["services"], kinds: ["SERVICE"] } },
  { id: "svc-k", input: "Web sitem için SEO danışmanlığı arıyorum", expected: { categories: ["technology", "services"], kinds: ["SERVICE"] } },
  { id: "mach-f", input: "Ekskavatör kiralamak istiyorum", allowBudgetSuffix: true, expected: { productTokens: ["ekskavatör", "ekskavator"], categories: ["machinery"], kinds: ["INDUSTRIAL_EQUIPMENT", "PRODUCT"] } },
  { id: "prnt-e", input: "Düğün davetiyesi bastırmak istiyorum 200 adet", expected: { productTokens: ["davetiye"], categories: ["printing"], kinds: ["MANUFACTURED_ITEM"], quantity: { value: 200, unit: "adet" }, answeredKeys: ["quantity"] } },
  // VARLIK TABANLARI (98+ Part II — component 4 zemin gerçeği)
  { id: "ent-a", input: "WordPress sitem için bakım hizmeti arıyorum", expected: { categories: ["technology", "services"], kinds: ["SERVICE"], expectedEntity: "platform:wordpress" } },
  { id: "ent-b", input: "WooCommerce eklentisi yaptırmak istiyorum", expected: { categories: ["technology"], kinds: ["SERVICE", "MANUFACTURED_ITEM", "PRODUCT"], expectedEntity: "platform:woocommerce" } },
  { id: "ent-c", input: "Shopify entegrasyonu arıyorum", expected: { categories: ["technology"], kinds: ["SERVICE", "PRODUCT"], expectedEntity: "platform:shopify" } },
  { id: "ent-d", input: "Ticimax mağazam için SEO danışmanlığı arıyorum", expected: { categories: ["technology", "services"], kinds: ["SERVICE"], expectedEntity: "platform:ticimax" } },
  // PRINTING
  { id: "prnt-a", input: "1000 adet kartvizit bastırmak istiyorum", expected: { productTokens: ["kartvizit"], categories: ["printing"], kinds: ["MANUFACTURED_ITEM"], quantity: { value: 1000, unit: "adet" }, answeredKeys: ["quantity"] } },
  { id: "prnt-b", input: "Broşür bastırmak istiyorum", expected: { productTokens: ["broşür", "brosur"], categories: ["printing"], kinds: ["MANUFACTURED_ITEM"] } },
  { id: "prnt-c", input: "50 bin adet karton kutu ürettirmek istiyorum", expected: { productTokens: ["kutu"], categories: ["printing"], kinds: ["MANUFACTURED_ITEM"], quantity: { value: 50000, unit: "adet" }, answeredKeys: ["quantity"] } },
  { id: "prnt-d", input: "Rollup banner bastırmak istiyorum 85x200", expected: { categories: ["printing"], kinds: ["MANUFACTURED_ITEM"], forbiddenNumbers: [85, 200] } },
];

/* ------------------------------------------------------------------ *
 * DETERMİNİSTİK DÖNÜŞÜMLER                                            *
 * ------------------------------------------------------------------ */

function stripDiacritics(s: string): string {
  return s
    .replace(/ç/g, "c").replace(/Ç/g, "C")
    .replace(/ğ/g, "g").replace(/Ğ/g, "G")
    .replace(/ı/g, "i").replace(/İ/g, "I")
    .replace(/ö/g, "o").replace(/Ö/g, "O")
    .replace(/ş/g, "s").replace(/Ş/g, "S")
    .replace(/ü/g, "u").replace(/Ü/g, "U");
}

/** Deterministik typo: en uzun (≥7) sözcükten, uzunluğa göre seçilen İÇ harf düşer. */
function dropLetter(s: string): string | null {
  const words = s.split(/\s+/);
  let bestIdx = -1;
  let bestLen = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i] ?? "";
    if (/\d/.test(w)) continue; // sayılar/speçler typo'lanmaz — rol saldırısı ayrı eksendir
    if (w.length > bestLen && w.length >= 7) { bestLen = w.length; bestIdx = i; }
  }
  if (bestIdx < 0) return null;
  const w = words[bestIdx] ?? "";
  const cut = 2 + (w.length % (w.length - 4 > 1 ? w.length - 4 : 1)); // iç harf, deterministik
  words[bestIdx] = w.slice(0, cut) + w.slice(cut + 1);
  return words.join(" ");
}

function swapVerb(s: string): string | null {
  if (/arıyorum/.test(s)) return s.replace(/arıyorum/, "arıyom");
  if (/istiyorum/.test(s)) return s.replace(/istiyorum/, "istiyom");
  if (/bakıyorum/.test(s)) return s.replace(/bakıyorum/, "bakıyom");
  return null;
}

function dropVerb(s: string): string | null {
  const out = s
    .replace(/\s*(arıyorum|bakıyorum|istiyorum|lazım|yaptırmak istiyorum|bastırmak istiyorum|ürettirmek istiyorum|kiralamak istiyorum|almak istiyorum)\.?\s*$/u, "")
    .trim();
  return out && out !== s.trim() && out.split(/\s+/).length >= 2 ? out : null;
}

export function buildAdversarialCorpus(): CorpusCase[] {
  const out: CorpusCase[] = [];
  const push = (
    base: BaseTemplate,
    variant: string,
    input: string,
    lossy: boolean,
    extra?: Partial<CorpusExpected>,
  ) => {
    out.push({
      id: `${base.id}~${variant}`,
      baseId: base.id,
      variant,
      input,
      lossy,
      expected: { ...full(base.expected), ...extra },
    });
  };

  for (const base of BASES) {
    const raw = base.input;
    push(base, "orijinal", raw, false);
    push(base, "kucuk", raw.toLocaleLowerCase("tr-TR"), false);
    push(base, "BUYUK", raw.toLocaleUpperCase("tr-TR"), false);
    push(base, "ascii", stripDiacritics(raw), false);
    push(base, "ascii-kucuk", stripDiacritics(raw).toLowerCase(), false);
    const typo = dropLetter(raw);
    if (typo) push(base, "typo", typo, true);
    const typoAscii = dropLetter(stripDiacritics(raw).toLowerCase());
    if (typoAscii) push(base, "typo-ascii", typoAscii, true);
    const verb = swapVerb(raw);
    if (verb) push(base, "konusma", verb, false);
    const noVerb = dropVerb(raw);
    if (noVerb) push(base, "fiilsiz", noVerb, false);
    push(base, "bosluk", raw.replace(/\s+/g, "  "), false);
    push(base, "selam", `Merhaba, ${raw}`, false);
    push(base, "acil", `${raw} acil`, false);
    push(
      base,
      "duz-ascii",
      stripDiacritics(raw)
        .toLowerCase()
        .replace(/[,;:.!?]/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
      false,
    );

    if (base.allowAnyBrand) {
      push(base, "any-marka", `${raw}, marka fark etmez`, false, {
        anyFields: ["brand"],
      });
      push(base, "any-marka-ascii", stripDiacritics(`${raw} marka farketmez`).toLowerCase(), false, {
        anyFields: ["brand"],
      });
    }
    if (base.allowBudgetSuffix) {
      push(base, "butce", `${raw}, bütçem 20 bin TL`, false, {
        budgetMax: 20_000,
        answeredKeys: [...(base.expected.answeredKeys ?? []), "budget"],
        forbiddenNumbers: [...(base.expected.forbiddenNumbers ?? []), 20_000],
      });
    }
  }
  return out;
}
