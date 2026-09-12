/**
 * Category-aware question profiles built on REQUEST_CATEGORIES field keys.
 * Single authority for prompts / importance / soft-answer policy.
 */

import {
  REQUEST_CATEGORIES,
  resolveCategoryQuestionContract,
  type ProductQuestionContract,
} from "@/lib/request-category-engine";

import type { QuestionProfileDef } from "./question-profile-types";

/** Shared Talepo Standard keys — evaluated for every active category when relevant. */
/**
 * Uzaktan verilebilen hizmet imzaları — fiziksel hizmetler (temizlik,
 * nakliye, bakım-onarım, boya…) bu listede DEĞİLDİR ve asla "uzaktan"
 * sorusu almaz (kurucu, 2026-08-23).
 */
export const REMOTE_ELIGIBLE_SERVICE_TOKENS = [
  "yazılım",
  "yazilim",
  "web",
  "tasarım",
  "tasarim",
  "grafik",
  "logo",
  "danışman",
  "danisman",
  "çeviri",
  "ceviri",
  "muhasebe",
  "hukuk",
  "eğitim",
  "egitim",
  "ders",
  "koçluk",
  "kocluk",
  "seo",
  "sosyal medya",
  "dijital",
  "reklam",
  "içerik",
  "icerik",
  "mimari çizim",
  "mimari cizim",
] as const;

const REMOTE_FOLD: Record<string, string> = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", İ: "i",
  ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
};

export function isRemoteEligibleService(
  context: string | null | undefined,
): boolean {
  if (!context) return false;
  const fold = context
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (m) => REMOTE_FOLD[m] ?? m)
    .toLowerCase();
  return REMOTE_ELIGIBLE_SERVICE_TOKENS.some((t) =>
    fold.includes(
      t.replace(/[çÇğĞıİöÖşŞüÜ]/g, (m) => REMOTE_FOLD[m] ?? m).toLowerCase(),
    ),
  );
}

/**
 * Bebekte ikinci el pazarı ve model ayrımı olan dayanıklı ürünler
 * (katlanmış alt dize eşleşmesi, `whenProductTypes` sözleşmesi).
 */
const BABY_DURABLE_PRODUCT_TYPES = [
  "bebek arabası",
  "bebek arabasi",
  "puset",
  "oto koltuğu",
  "oto koltugu",
  "beşik",
  "besik",
  "park yatak",
  "mama sandalyesi",
  "portbebe",
  "kanguru",
  "bebek odası",
  "bebek odasi",
  "salıncak",
  "salincak",
  "ana kucağı",
  "ana kucagi",
  "yürüteç",
  "yurutec",
  "oyun parkı",
  "oyun parki",
];

const STANDARD: QuestionProfileDef[] = [
  {
    fieldKey: "needType",
    prompt: "Ne tür bir talep bu?",
    summaryLabel: "Talep türü",
    importance: "routing_critical",
    categories: ["automotive", "machinery"],
    rank: 100,
    allowDontCare: false,
    allowUnknown: false,
    inputHint: "select",
  },
  {
    fieldKey: "listingType",
    prompt: "Kiralık mı, satılık mı?",
    summaryLabel: "İşlem",
    importance: "routing_critical",
    categories: ["real-estate"],
    rank: 98,
    allowDontCare: false,
  },
  {
    fieldKey: "propertyType",
    prompt: "Nasıl bir emlak arıyorsunuz?",
    summaryLabel: "Emlak tipi",
    importance: "routing_critical",
    categories: ["real-estate"],
    rank: 96,
  },
  {
    fieldKey: "city",
    prompt: "Hangi ilde arıyorsunuz?",
    summaryLabel: "Konum",
    importance: "publish_required",
    categories: ["real-estate"],
    rank: 94,
    inputHint: "location",
    allowUnknown: false,
    allowDontCare: false,
  },
  {
    fieldKey: "city",
    prompt: "Nereye teslim edilecek / hangi il?",
    summaryLabel: "Teslimat ili",
    importance: "quote_critical",
    categories: [
      "technology",
      "appliances",
      "printing",
      "automotive",
      "furniture",
      "machinery",
      "baby",
      "home-kitchen",
    ],
    rank: 70,
    inputHint: "location",
    allowUnknown: true,
  },
  {
    fieldKey: "locationMode",
    prompt: "Uzaktan hizmet sizin için uygun mu?",
    summaryLabel: "Hizmet şekli",
    importance: "routing_critical",
    categories: ["services"],
    // Kurucu (2026-08-23): temizlik/nakliye gibi fiziksel hizmetlere
    // "uzaktan" sorusu saçmadır — yalnız uzaktan verilebilen hizmetlerde sor.
    whenProductTypes: [...REMOTE_ELIGIBLE_SERVICE_TOKENS],
    rank: 88,
    inputHint: "select",
    allowUnknown: false,
    allowDontCare: false,
  },
  {
    fieldKey: "serviceType",
    prompt: "Hangi hizmete ihtiyacınız var?",
    summaryLabel: "Hizmet türü",
    importance: "routing_critical",
    categories: ["services"],
    whenNeedTypes: ["service"],
    rank: 96,
    inputHint: "select",
    allowUnknown: false,
    allowDontCare: false,
  },
  {
    fieldKey: "city",
    prompt: "Hizmet nerede verilecek?",
    summaryLabel: "Hizmet yeri",
    importance: "quote_critical",
    categories: ["services", "health"],
    rank: 68,
    inputHint: "location",
    allowUnknown: true,
    allowDontCare: true,
  },
  {
    fieldKey: "budget",
    prompt: "Bütçeniz nedir?",
    summaryLabel: "Bütçe",
    importance: "quote_critical",
    rank: 60,
    inputHint: "budget",
    allowUnknown: true,
    allowDontCare: true,
    budgetBasis: "total",
  },
  {
    fieldKey: "quantity",
    prompt: "Kaç adet arıyorsunuz?",
    summaryLabel: "Adet",
    importance: "quote_critical",
    categories: ["printing", "technology", "furniture"],
    rank: 75,
    inputHint: "number",
    allowUnknown: true,
  },
  {
    fieldKey: "quantity",
    prompt: "Kaç adet arıyorsunuz?",
    summaryLabel: "Adet",
    importance: "optional",
    categories: ["appliances", "home-kitchen", "baby"],
    rank: 35,
    inputHint: "number",
    allowUnknown: true,
    allowDontCare: true,
  },
  {
    fieldKey: "delivery",
    prompt: "Ne zamana kadar ihtiyacınız var?",
    summaryLabel: "Zaman",
    importance: "quote_critical",
    rank: 55,
    allowUnknown: true,
    allowDontCare: true,
  },
  /**
   * İKİNCİ EL SORUSU YALNIZ İKİNCİ EL PAZARI OLAN ÜRÜNE (kurucu, 2026-09-12).
   *
   * Ölçüldü: ıslak mendil, bebek gıdası, biberon ucu, ev temizlik
   * malzemesi ve yemek takımı için "Ürün durumu (sıfır / ikinci el)?"
   * soruluyordu. Ev-mutfak listeden çıktı; bebekte yalnız dayanıklı
   * ürünler (araba, oto koltuğu, beşik, mama sandalyesi, mobilya, portbebe,
   * kanguru, park yatak, salıncak, yürüteç) ayrı ve ürün kapılı bir
   * profille sorulur. `model` için aynı ayrım aşağıda.
   */
  {
    fieldKey: "condition",
    prompt: "Ürün durumu tercihiniz var mı?",
    summaryLabel: "Durum",
    importance: "optional",
    categories: ["technology", "appliances", "automotive", "furniture"],
    rank: 50,
    allowDontCare: true,
    allowUnknown: true,
  },
  {
    fieldKey: "condition",
    prompt: "Ürün durumu tercihiniz var mı?",
    summaryLabel: "Durum",
    importance: "optional",
    categories: ["baby"],
    whenProductTypes: BABY_DURABLE_PRODUCT_TYPES,
    rank: 50,
    allowDontCare: true,
    allowUnknown: true,
  },
  {
    // Emlakta ikinci el karşılığı yoktur; yalnız yeni bina isteği anlamlıdır.
    fieldKey: "newBuildPreference",
    prompt: "Sıfır / yeni bina tercihiniz var mı?",
    summaryLabel: "Bina durumu",
    importance: "optional",
    categories: ["real-estate"],
    whenProductTypes: [
      "daire",
      "rezidans",
      "müstakil",
      "villa",
      "çiftlik evi",
      "köşk",
      "konak",
      "yalı",
      "stüdyo",
      "dubleks",
      "iş yeri",
      "ofis",
      "plaza",
      "dükkan",
      "mağaza",
      "depo",
      "antrepo",
      "fabrika",
      "imalathane",
      "avm",
      "otel",
      "apart",
      "müştemilat",
      "turistik tesis",
      "devre mülk",
    ],
    rank: 43,
    inputHint: "select",
    allowDontCare: true,
    quickChoices: [
      { label: "Sıfır / yeni bina şart", value: "Yeni bina şart" },
      { label: "Yeni veya yakın tarihli", value: "Yeni / yakın tarihli" },
    ],
  },
  {
    // Makine pazarında sıfır/ikinci el ayrımı fiyatın ana eksenidir
    // (makinecim.com envanteri, 2026-08-22) — optional değil, quote_critical.
    fieldKey: "condition",
    prompt: "Sıfır mı, ikinci el mi?",
    summaryLabel: "Durum",
    importance: "quote_critical",
    categories: ["machinery"],
    whenNeedTypes: ["machine"],
    rank: 66,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Sıfır", value: "Sıfır" },
      { label: "İkinci el", value: "İkinci el" },
    ],
  },
  {
    fieldKey: "modelYear",
    prompt: "En eski kabul edilebilir model yılı nedir?",
    summaryLabel: "En eski model yılı",
    importance: "quote_critical",
    categories: ["machinery"],
    whenNeedTypes: ["machine"],
    whenProductTypes: ["ikinci el", "2. el", "2.el", "second hand"],
    rank: 65,
    inputHint: "number",
    allowUnknown: true,
    allowDontCare: true,
    quickChoices: [
      { label: "2015 ve sonrası", value: "2015+" },
      { label: "2018 ve sonrası", value: "2018+" },
      { label: "2021 ve sonrası", value: "2021+" },
    ],
  },
  {
    fieldKey: "operatingHours",
    prompt: "Maksimum çalışma saati tercihiniz nedir?",
    summaryLabel: "Maksimum çalışma saati",
    importance: "quote_critical",
    categories: ["machinery"],
    whenNeedTypes: ["machine"],
    whenProductTypes: ["ikinci el", "2. el", "2.el", "second hand"],
    rank: 63,
    inputHint: "number",
    allowUnknown: true,
    allowDontCare: true,
    quickChoices: [
      { label: "5.000 saate kadar", value: "≤5.000 saat" },
      { label: "10.000 saate kadar", value: "≤10.000 saat" },
      { label: "20.000 saate kadar", value: "≤20.000 saat" },
      { label: "20.000 saat üzeri de olur", value: "20.000+ saat" },
    ],
  },
  {
    fieldKey: "inspectionAvailability",
    prompt: "Yerinde test veya ekspertiz imkânı gerekli mi?",
    summaryLabel: "Test / ekspertiz",
    importance: "quote_critical",
    categories: ["machinery"],
    whenNeedTypes: ["machine"],
    whenProductTypes: ["ikinci el", "2. el", "2.el", "second hand"],
    rank: 61,
    inputHint: "select",
    allowDontCare: true,
    quickChoices: [
      { label: "Ekspertiz şart", value: "Ekspertiz şart" },
      { label: "Yerinde test yeterli", value: "Yerinde test yeterli" },
      { label: "Gerekli değil", value: "Gerekli değil" },
    ],
  },
  {
    fieldKey: "brand",
    prompt: "Marka tercihiniz var mı?",
    summaryLabel: "Marka",
    /**
     * Kurucu (2026-09-01): marka, ürün kategorilerinde profesyonel
     * eşleşmenin ana filtresidir — detay sorularının önünde gelir.
     * "Fark etmez" kaçışı durur; soru asla yayını bloklamaz.
     */
    importance: "quote_critical",
    // Marka/model yalnız ürün kategorilerinde anlamlı — emlak ve hizmetlerde
    // asla sorulmaz (kurucu geri bildirimi, 2026-08-23).
    categories: [
      "technology",
      "appliances",
      "home-kitchen",
      "furniture",
      "printing",
      "baby",
      "automotive",
      "health",
    ],
    rank: 76,
    allowDontCare: true,
    allowUnknown: true,
  },
  {
    fieldKey: "brand",
    prompt: "Marka tercihiniz var mı?",
    summaryLabel: "Marka",
    importance: "quote_critical",
    categories: ["machinery"],
    // Yedek parçada marka/model teknik serbest forma yazılır; yalnız makine
    // satın alma niyetinde hızlı soru olarak kalır.
    whenNeedTypes: ["machine"],
    rank: 76,
    allowDontCare: true,
    allowUnknown: true,
  },
  {
    fieldKey: "model",
    prompt: "Model tercihiniz var mı?",
    summaryLabel: "Model",
    importance: "optional",
    categories: ["technology", "appliances", "furniture", "automotive"],
    rank: 46,
    allowDontCare: true,
    allowUnknown: true,
  },
  {
    fieldKey: "model",
    prompt: "Model tercihiniz var mı?",
    summaryLabel: "Model",
    importance: "optional",
    categories: ["baby"],
    whenProductTypes: BABY_DURABLE_PRODUCT_TYPES,
    rank: 46,
    allowDontCare: true,
    allowUnknown: true,
  },
  /**
   * ARAÇ: ÇEKİŞ VE GARANTİ SEÇENEKLİ OPSİYONEL SORU OLARAK KALIR (kurucu,
   * 2026-09-12). Eski form alanları profil kapısıyla düştü; kurucu bu ikisini
   * geri istedi. Nesil, motor ve kasa/hasar durumu bilinçli olarak dışarıda:
   * ilk ikisi serbest metin kutusu, üçüncüsü "Araç durumu" ile tekrar.
   */
  {
    fieldKey: "driveType",
    prompt: "Çekiş tercihiniz var mı?",
    summaryLabel: "Çekiş",
    importance: "optional",
    categories: ["automotive"],
    whenNeedTypes: ["vehicle"],
    rank: 30,
    inputHint: "select",
    quickChoices: [
      { label: "Önden çekiş", value: "Önden çekiş" },
      { label: "Arkadan itiş", value: "Arkadan itiş" },
      { label: "4x4", value: "4x4" },
    ],
    allowDontCare: true,
    allowUnknown: false,
  },
  {
    fieldKey: "warranty",
    prompt: "Garanti şartınız var mı?",
    summaryLabel: "Garanti",
    importance: "optional",
    categories: ["automotive"],
    whenNeedTypes: ["vehicle"],
    rank: 28,
    inputHint: "select",
    quickChoices: [
      { label: "Garantili olsun", value: "Garantili" },
    ],
    allowDontCare: true,
    allowUnknown: false,
  },
  {
    fieldKey: "model",
    prompt: "Model tercihiniz var mı?",
    summaryLabel: "Model",
    importance: "optional",
    categories: ["machinery"],
    whenNeedTypes: ["machine"],
    rank: 46,
    allowDontCare: true,
    allowUnknown: true,
  },
  {
    fieldKey: "dimensions",
    prompt: "Ölçüleri biliyor musunuz?",
    summaryLabel: "Ölçü",
    importance: "quote_critical",
    categories: ["printing"],
    rank: 80,
    allowUnknown: true,
  },
  {
    fieldKey: "material",
    prompt: "Malzeme / kâğıt tercihiniz?",
    summaryLabel: "Malzeme",
    importance: "optional",
    categories: ["printing"],
    rank: 40,
    allowUnknown: true,
    allowDontCare: true,
  },
  {
    fieldKey: "designReady",
    prompt: "Tasarım dosyanız hazır mı?",
    summaryLabel: "Tasarım",
    importance: "quote_critical",
    categories: ["printing"],
    rank: 72,
    allowUnknown: true,
  },
  {
    fieldKey: "roomCount",
    prompt: "Oda sayısı tercihiniz?",
    summaryLabel: "Oda",
    importance: "quote_critical",
    categories: ["real-estate"],
    // Oda sayısı yalnız konut tiplerinde sorulur — arsaya asla (kurucu, 2026-08-23).
    whenProductTypes: [
      "daire",
      "rezidans",
      "müstakil",
      "mustakil",
      "villa",
      "çiftlik evi",
      "ciftlik evi",
      "köşk",
      "kosk",
      "konak",
      "yalı",
      "yali",
      "stüdyo",
      "studyo",
      "dubleks",
      "konut",
      "ev",
    ],
    rank: 72,
    allowUnknown: true,
  },
  {
    fieldKey: "area",
    prompt: "Yaklaşık metrekare?",
    summaryLabel: "m²",
    importance: "optional",
    categories: ["real-estate"],
    rank: 45,
    allowUnknown: true,
  },
  /* ------------------------------------------------------------------ */
  /* Legacy product-scoped questions. The core technology families now */
  /* live in their category-owned contracts; their next batch remains  */
  /* here until it is migrated with an equivalent contract.             */
  /* ------------------------------------------------------------------ */
  // —— kulaklık ——
  {
    fieldKey: "headphoneType",
    prompt: "Nasıl bir kulaklık?",
    summaryLabel: "Kulaklık tipi",
    importance: "quote_critical",
    categories: ["technology"],
    whenProductTypes: ["kulaklik", "kulaklık", "airpods"],
    rank: 60,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Kulak içi", value: "Kulak içi" },
      { label: "Kulak üstü", value: "Kulak üstü" },
      { label: "Bluetooth", value: "Bluetooth" },
      { label: "Oyuncu kulaklığı", value: "Oyuncu" },
    ],
  },
  // —— yazıcı ——
  {
    fieldKey: "printerType",
    prompt: "Hangi tip yazıcı?",
    summaryLabel: "Yazıcı tipi",
    importance: "quote_critical",
    categories: ["technology"],
    whenProductTypes: ["yazici", "yazıcı", "printer"],
    rank: 60,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Lazer", value: "Lazer" },
      { label: "Mürekkep püskürtmeli", value: "Mürekkep püskürtmeli" },
      { label: "Tanklı", value: "Tanklı" },
    ],
  },
  // —— fotoğraf makinesi ——
  {
    fieldKey: "cameraType",
    prompt: "Nasıl bir makine arıyorsun?",
    summaryLabel: "Makine tipi",
    importance: "quote_critical",
    categories: ["technology"],
    whenProductTypes: ["fotograf", "fotoğraf", "kamera"],
    rank: 60,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Aynasız", value: "Aynasız" },
      { label: "DSLR", value: "DSLR" },
      { label: "Kompakt", value: "Kompakt" },
      { label: "Şipşak (Instax)", value: "Şipşak" },
    ],
  },
  {
    fieldKey: "installation",
    prompt: "Montaj da dahil olsun mu?",
    summaryLabel: "Montaj",
    importance: "optional",
    categories: ["appliances"],
    whenProductTypes: ["kombi", "sofben", "şofben", "termosifon"],
    rank: 30,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Montaj dahil", value: "Montaj dahil" },
      { label: "Sadece ürün", value: "Sadece ürün" },
    ],
  },
  // —— kurutma makinesi (çamaşır makinesi sözleşmesinden ayrıdır) ——
  {
    fieldKey: "capacityKg",
    prompt: "Kaç kilogram kapasite?",
    summaryLabel: "Kapasite",
    importance: "quote_critical",
    categories: ["appliances"],
    whenProductTypes: ["kurutma"],
    rank: 60,
    allowUnknown: true,
    inputHint: "select",
    quickChoices: [
      { label: "8 kg", value: "8 kg" },
      { label: "9 kg", value: "9 kg" },
      { label: "10 kg", value: "10 kg" },
      { label: "12 kg", value: "12 kg" },
    ],
  },
  // —— bulaşık makinesi ——
  {
    fieldKey: "placeSetting",
    prompt: "Kaç kişilik olsun?",
    summaryLabel: "Kapasite",
    importance: "quote_critical",
    categories: ["appliances"],
    whenProductTypes: ["bulasik", "bulaşık"],
    rank: 60,
    allowUnknown: true,
    inputHint: "select",
    quickChoices: [
      { label: "12 kişilik", value: "12 kişilik" },
      { label: "14 kişilik", value: "14 kişilik" },
      { label: "16 kişilik", value: "16 kişilik" },
    ],
  },
  // —— süpürge ——
  {
    fieldKey: "vacuumType",
    prompt: "Nasıl bir süpürge?",
    summaryLabel: "Süpürge tipi",
    importance: "quote_critical",
    categories: ["appliances"],
    whenProductTypes: ["supurge", "süpürge", "vacuum"],
    rank: 60,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Robot", value: "Robot" },
      { label: "Dikey şarjlı", value: "Dikey" },
      { label: "Toz torbalı", value: "Toz torbalı" },
      { label: "Islak-kuru", value: "Islak-kuru" },
    ],
  },
  // —— hava temizleyici / nemlendirici ——
  {
    fieldKey: "usageArea",
    prompt: "Kaç metrekarelik alan için?",
    summaryLabel: "Alan",
    importance: "quote_critical",
    categories: ["appliances"],
    whenProductTypes: ["temizleyici", "nemlendirici", "temizleme cihaz", "nemlendirme"],
    rank: 60,
    allowUnknown: true,
    inputHint: "select",
    quickChoices: [
      { label: "25 m²'ye kadar", value: "25 m²" },
      { label: "25–50 m²", value: "25-50 m²" },
      { label: "50 m² üzeri", value: "50+ m²" },
    ],
  },
  // —— fırın ——
  {
    fieldKey: "ovenType",
    prompt: "Ankastre mi, solo mu?",
    summaryLabel: "Fırın tipi",
    importance: "quote_critical",
    categories: ["appliances"],
    whenProductTypes: ["firin", "fırın", "ocak"],
    rank: 60,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Ankastre", value: "Ankastre" },
      { label: "Solo / Ocaklı", value: "Solo" },
      { label: "Mini fırın", value: "Mini" },
    ],
  },
  // —— kahve makinesi ——
  {
    fieldKey: "coffeeType",
    prompt: "Hangi tip kahve makinesi?",
    summaryLabel: "Kahve tipi",
    importance: "quote_critical",
    /**
     * KURUCU KARARI (2026-08-31): kahve makinesinin kanonik sahibi
     * appliances'tır; soru sahibiyle birlikte yaşar. home-kitchen'da
     * kalan kahve ürünleri (fincan takımı, kahve seti) bu soruyu zaten
     * tetiklemez.
     */
    categories: ["appliances"],
    whenProductTypes: ["kahve"],
    rank: 60,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Espresso", value: "Espresso" },
      { label: "Kapsüllü", value: "Kapsüllü" },
      { label: "Filtre", value: "Filtre" },
      { label: "Türk kahvesi", value: "Türk kahvesi" },
    ],
  },
  // —— bebek bezi (Anne & Çocuk sözleşmesine sonraki bakım diliminde taşınacak) ——
  {
    fieldKey: "diaperSize",
    prompt: "Kaç numara?",
    summaryLabel: "Beden",
    importance: "quote_critical",
    categories: ["baby"],
    whenProductTypes: ["bebek bezi", "bez"],
    rank: 62,
    allowUnknown: true,
    inputHint: "select",
    quickChoices: [
      { label: "1–2 numara", value: "1-2" },
      { label: "3–4 numara", value: "3-4" },
      { label: "5–6 numara", value: "5-6" },
    ],
  },
  // —— mobilya (Koçtaş ağacından, 2026-08-22) ——
  {
    fieldKey: "bedSize",
    prompt: "Hangi boyutta olsun?",
    summaryLabel: "Boyut",
    importance: "quote_critical",
    categories: ["furniture"],
    whenProductTypes: ["yatak", "karyola", "baza"],
    rank: 62,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Tek kişilik (90–100)", value: "Tek kişilik" },
      { label: "Çift kişilik (140–160)", value: "Çift kişilik" },
      { label: "King (180+)", value: "King" },
    ],
  },
  {
    fieldKey: "wardrobeType",
    prompt: "Nasıl bir gardırop?",
    summaryLabel: "Gardırop tipi",
    importance: "quote_critical",
    categories: ["furniture"],
    whenProductTypes: ["gardirop", "gardırop"],
    rank: 62,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Kapaklı", value: "Kapaklı" },
      { label: "Sürgülü", value: "Sürgülü" },
      { label: "Köşe", value: "Köşe" },
      { label: "Bez / Portatif", value: "Bez" },
    ],
  },
  {
    fieldKey: "seatingType",
    prompt: "Nasıl bir oturma grubu?",
    summaryLabel: "Koltuk tipi",
    importance: "quote_critical",
    categories: ["furniture"],
    whenProductTypes: ["koltuk", "kanepe", "cekyat", "çekyat", "oturma grubu", "oturma grup"],
    rank: 62,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Koltuk takımı", value: "Koltuk takımı" },
      { label: "Köşe koltuk", value: "Köşe koltuk" },
      { label: "Çekyat", value: "Çekyat" },
      { label: "Tekli / Berjer", value: "Tekli" },
    ],
  },
  {
    fieldKey: "diningSeats",
    prompt: "Kaç kişilik olsun?",
    summaryLabel: "Kişi",
    importance: "quote_critical",
    categories: ["furniture"],
    whenProductTypes: [
      "yemek masasi",
      "yemek masası",
      "yemek odası takımı",
      "yemek odasi takimi",
      "mutfak masasi",
      "mutfak masası",
    ],
    rank: 62,
    allowUnknown: true,
    inputHint: "select",
    quickChoices: [
      { label: "4 kişilik", value: "4" },
      { label: "6 kişilik", value: "6" },
      { label: "8+ kişilik", value: "8+" },
    ],
  },
  // —— matbaa (Matbaaloji ağacından, 2026-08-22) ——
  {
    fieldKey: "quantity",
    prompt: "Kaç adet bastırılacak?",
    summaryLabel: "Adet",
    importance: "quote_critical",
    categories: ["printing"],
    whenProductTypes: [
      "kartvizit", "brosur", "broşür", "el ilani", "el ilanı", "afis", "afiş",
      "etiket", "davetiye", "magnet", "zarf", "antetli", "katalog", "dergi",
      "bloknot", "takvim", "dosya",
    ],
    rank: 72,
    allowUnknown: false,
    inputHint: "select",
    quickChoices: [
      { label: "500", value: "500" },
      { label: "1.000", value: "1000" },
      { label: "2.000", value: "2000" },
      { label: "5.000+", value: "5000" },
    ],
  },
  {
    fieldKey: "lamination",
    prompt: "Selefon ister misin?",
    summaryLabel: "Selefon",
    importance: "optional",
    categories: ["printing"],
    whenProductTypes: ["kartvizit", "brosur", "broşür", "katalog"],
    rank: 40,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Mat selefon", value: "Mat selefon" },
      { label: "Parlak selefon", value: "Parlak selefon" },
      { label: "Selefonsuz", value: "Selefonsuz" },
    ],
  },
  {
    fieldKey: "printSize",
    prompt: "Hangi ebatta olacak?",
    summaryLabel: "Ebat",
    importance: "quote_critical",
    categories: ["printing"],
    whenProductTypes: ["brosur", "broşür", "el ilani", "el ilanı", "afis", "afiş", "etiket", "davetiye"],
    rank: 60,
    allowUnknown: true,
    inputHint: "select",
    quickChoices: [
      { label: "A6", value: "A6" },
      { label: "A5", value: "A5" },
      { label: "A4", value: "A4" },
      { label: "A3 ve üzeri", value: "A3+" },
    ],
  },
  {
    fieldKey: "paperWeight",
    prompt: "Kağıt gramajı tercihin var mı?",
    summaryLabel: "Gramaj",
    importance: "optional",
    categories: ["printing"],
    whenProductTypes: ["brosur", "broşür", "el ilani", "el ilanı"],
    rank: 30,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "115 gr", value: "115 gr" },
      { label: "130 gr", value: "130 gr" },
      { label: "150 gr", value: "150 gr" },
    ],
  },
  {
    fieldKey: "pageCount",
    prompt: "Kaç sayfa olacak?",
    summaryLabel: "Sayfa",
    importance: "quote_critical",
    categories: ["printing"],
    whenProductTypes: ["katalog", "dergi", "kitapcik", "kitapçık"],
    rank: 60,
    allowUnknown: true,
    inputHint: "select",
    quickChoices: [
      { label: "8–16 sayfa", value: "8-16" },
      { label: "16–32 sayfa", value: "16-32" },
      { label: "32 sayfa üzeri", value: "32+" },
    ],
  },
  // —— endüstriyel makineler (makinecim.com ağacından, 2026-08-22) ——
  {
    fieldKey: "generatorPower",
    prompt: "Kaç kVA güç lazım?",
    summaryLabel: "Güç",
    importance: "quote_critical",
    categories: ["machinery"],
    whenNeedTypes: ["machine"],
    whenProductTypes: ["jenerator", "jeneratör"],
    rank: 62,
    allowUnknown: true,
    inputHint: "select",
    quickChoices: [
      { label: "10–50 kVA", value: "10-50 kVA" },
      { label: "50–150 kVA", value: "50-150 kVA" },
      { label: "150–500 kVA", value: "150-500 kVA" },
      { label: "500+ kVA", value: "500+ kVA" },
    ],
  },
  {
    fieldKey: "liftCapacity",
    prompt: "Kaç ton kaldırma kapasitesi?",
    summaryLabel: "Kapasite",
    importance: "quote_critical",
    categories: ["machinery"],
    whenNeedTypes: ["machine"],
    whenProductTypes: ["forklift", "transpalet", "vinc", "vinç", "caraskal"],
    rank: 62,
    allowUnknown: true,
    inputHint: "select",
    quickChoices: [
      { label: "1,5–2 ton", value: "1.5-2 ton" },
      { label: "2,5–3 ton", value: "2.5-3 ton" },
      { label: "3–5 ton", value: "3-5 ton" },
      { label: "5 ton üzeri", value: "5+ ton" },
    ],
  },
  {
    fieldKey: "compressorType",
    prompt: "Vidalı mı, pistonlu mu?",
    summaryLabel: "Kompresör tipi",
    importance: "quote_critical",
    categories: ["machinery"],
    whenNeedTypes: ["machine"],
    whenProductTypes: ["kompresor", "kompresör"],
    rank: 62,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Vidalı", value: "Vidalı" },
      { label: "Pistonlu", value: "Pistonlu" },
    ],
  },
  // —— el aletleri (Bauhaus ağacından) ——
  {
    fieldKey: "toolPower",
    prompt: "Akülü mü, kablolu mu?",
    summaryLabel: "Güç tipi",
    importance: "quote_critical",
    categories: ["machinery"],
    whenNeedTypes: ["machine"],
    whenProductTypes: ["matkap", "vidalama", "testere", "taslama", "taşlama", "kirici", "kırıcı"],
    rank: 60,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Akülü / Şarjlı", value: "Akülü" },
      { label: "Kablolu", value: "Kablolu" },
    ],
  },
  // —— bahçe makineleri ——
  {
    fieldKey: "mowerType",
    prompt: "Nasıl çalışsın?",
    summaryLabel: "Çalışma tipi",
    importance: "quote_critical",
    categories: ["machinery"],
    whenNeedTypes: ["machine"],
    whenProductTypes: ["cim bicme", "çim biçme", "budama", "tirpan", "tırpan"],
    rank: 60,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Elektrikli", value: "Elektrikli" },
      { label: "Benzinli", value: "Benzinli" },
      { label: "Akülü", value: "Akülü" },
    ],
  },
  // —— boya (yapı market) ——
  {
    fieldKey: "paintScope",
    prompt: "İç cephe mi, dış cephe mi?",
    summaryLabel: "Kullanım yeri",
    importance: "quote_critical",
    categories: ["machinery", "services"],
    whenNeedTypes: ["machine"],
    whenProductTypes: ["boya"],
    rank: 60,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "İç cephe", value: "İç cephe" },
      { label: "Dış cephe", value: "Dış cephe" },
      { label: "Tavan", value: "Tavan" },
    ],
  },
  // —— mangal / barbekü ——
  {
    fieldKey: "grillType",
    prompt: "Hangi tip mangal?",
    summaryLabel: "Mangal tipi",
    importance: "quote_critical",
    categories: ["home-kitchen"],
    whenProductTypes: ["mangal", "barbeku", "barbekü"],
    rank: 60,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Kömürlü", value: "Kömürlü" },
      { label: "Gazlı", value: "Gazlı" },
      { label: "Elektrikli", value: "Elektrikli" },
    ],
  },
  // —— airfryer ——
  {
    fieldKey: "fryerCapacity",
    prompt: "Kaç litre olsun?",
    summaryLabel: "Kapasite",
    importance: "optional",
    categories: ["home-kitchen"],
    whenProductTypes: ["airfryer", "fritoz", "fritöz"],
    rank: 40,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "4–5 L", value: "4-5 L" },
      { label: "6–7 L", value: "6-7 L" },
      { label: "8 L ve üzeri", value: "8+ L" },
    ],
  },
];

/**
 * Kategori sözleşmelerini zamanlayıcının profil biçimine uyarlar. Soru metni,
 * seçenekler ve ürün türü eşleşmesi kategori motorunda yaşar; burada ikinci
 * bir mobilya kural listesi tutulmaz.
 */
function categoryContractProfiles(
  categoryId: string,
  contracts: readonly ProductQuestionContract[],
): QuestionProfileDef[] {
  return contracts.flatMap((contract) =>
    contract.questions.map((question) => ({
      ...question,
      categories: [categoryId],
      whenProductTypes: contract.whenProductTypes,
      whenNeedTypes: contract.whenNeedTypes,
      requiresNeedType: Boolean(contract.whenNeedTypes?.length),
      contractScope: contract,
    })),
  );
}

const CATEGORY_CONTRACT_PROFILES: QuestionProfileDef[] =
  REQUEST_CATEGORIES.flatMap((category) =>
    categoryContractProfiles(category.id, category.questionContracts ?? []),
  );

const ALL_PROFILES: readonly QuestionProfileDef[] = [
  ...STANDARD,
  ...CATEGORY_CONTRACT_PROFILES,
];

const PROFILE_FOLD: Record<string, string> = {
  ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u",
};
function foldProductType(value: string): string {
  let out = "";
  for (const ch of value.toLocaleLowerCase("tr-TR")) {
    out += PROFILE_FOLD[ch] ?? ch;
  }
  return out;
}

function matchesProductType(
  def: QuestionProfileDef,
  productType: string | null | undefined,
): boolean {
  if (!def.whenProductTypes || def.whenProductTypes.length === 0) return true;
  // Product-scoped questions require a detected product: with no product we
  // stay silent rather than ask an irrelevant question (Dyson ≠ ekran boyutu).
  if (!productType?.trim()) return false;
  const hay = foldProductType(productType);
  return def.whenProductTypes.some((p) => hay.includes(foldProductType(p)));
}

function matchesCategory(
  def: QuestionProfileDef,
  categoryId: string,
): boolean {
  if (!def.categories || def.categories.length === 0) return true;
  return def.categories.includes(categoryId);
}

function matchesNeedType(
  def: QuestionProfileDef,
  needType: string | null | undefined,
): boolean {
  if (!def.whenNeedTypes || def.whenNeedTypes.length === 0) return true;
  if (!needType) return !def.requiresNeedType;
  return def.whenNeedTypes.includes(needType);
}

function matchesProfileContext(
  def: QuestionProfileDef,
  input: {
    categoryId: string;
    needType?: string | null;
    productType?: string | null;
  },
  activeContract: ProductQuestionContract | null,
): boolean {
  if (!matchesCategory(def, input.categoryId)) return false;
  // Contract resolution already applies its product aliases and need gate.
  // Rechecking the raw spelling here can hide every question of that contract.
  if (def.contractScope) return def.contractScope === activeContract;
  if (!matchesNeedType(def, input.needType)) return false;
  if (!matchesProductType(def, input.productType)) return false;
  if (activeContract?.omitDeliveryQuestion && def.fieldKey === "delivery") return false;
  if (
    activeContract?.restrictStandardProfiles &&
    !def.contractScope &&
    def.categories?.includes(input.categoryId) &&
    !activeContract.allowedCandidateFieldKeys.includes(def.fieldKey)
  ) {
    return false;
  }
  return !def.contractScope || def.contractScope === activeContract;
}

/**
 * Resolve the active profile definition for a field in a category context.
 * More specific (category-scoped) defs win over generic ones.
 */
/** Specificity: product-scoped > category-scoped > global. */
function profileSpecificity(def: QuestionProfileDef): number {
  return (
    (def.whenProductTypes?.length ? 2 : 0) +
    (def.categories?.length ? 1 : 0) +
    (def.contractScope ? 1 : 0)
  );
}

export function resolveProfileForField(input: {
  fieldKey: string;
  categoryId: string;
  needType?: string | null;
  productType?: string | null;
}): QuestionProfileDef | null {
  const activeContract = resolveCategoryQuestionContract(input);
  const matches = ALL_PROFILES.filter(
    (d) =>
      d.fieldKey === input.fieldKey &&
      matchesProfileContext(d, input, activeContract),
  );
  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    const as = profileSpecificity(a);
    const bs = profileSpecificity(b);
    if (as !== bs) return bs - as;
    return (b.rank ?? 0) - (a.rank ?? 0);
  });
  return matches[0]!;
}

export function listProfilesForCategory(input: {
  categoryId: string;
  needType?: string | null;
  productType?: string | null;
}): QuestionProfileDef[] {
  const activeContract = resolveCategoryQuestionContract(input);
  const byKey = new Map<string, QuestionProfileDef>();
  for (const def of ALL_PROFILES) {
    if (!matchesProfileContext(def, input, activeContract)) continue;
    const existing = byKey.get(def.fieldKey);
    if (!existing) {
      byKey.set(def.fieldKey, def);
      continue;
    }
    if (profileSpecificity(def) > profileSpecificity(existing)) {
      byKey.set(def.fieldKey, def);
    }
  }
  return [...byKey.values()].sort(
    (a, b) => (b.rank ?? 0) - (a.rank ?? 0),
  );
}

/** Read-only view of every profile — tooling/inspection only, not scheduling. */
export function listAllProfiles(): readonly QuestionProfileDef[] {
  return ALL_PROFILES;
}

/**
 * BU KATEGORİDE SORULABİLECEK BÜTÜN PROFİL ANAHTARLARI (D3f Dilim 3h).
 *
 * `listProfilesForCategory`ten farkı, `needType` / `productType` süzgecini
 * UYGULAMAMASIDIR. O süzgeç ZAMANLAMA içindir: "şu an bu soruyu sor". Cevap
 * evreni ise zamanlamaya bağlı olamaz — kullanıcı ürün tipi henüz
 * çözülmemişken bir soruya cevap verip sonra ürün tipini değiştirirse, cevabı
 * evren dışına düşerdi. Ölçüldü (2026-08-28): `fridgeType`,
 * `whenProductTypes` süzgeci yüzünden ürün tipi geçilmeden kurulan evrende
 * bulunmuyordu; kullanıcının gerçekten verdiği "Fark etmez" cevabı bu yüzden
 * reddedilirdi.
 *
 * Kategori eşleşmesi kararı burada TEK kopya olarak durur (`matchesCategory`);
 * çağıran taraf kendi kopyasını kurmaz.
 */
export function listProfileKeysForCategory(categoryId: string): string[] {
  const keys = new Set<string>();
  for (const def of ALL_PROFILES) {
    if (!matchesCategory(def, categoryId)) continue;
    keys.add(def.fieldKey);
  }
  return [...keys].sort();
}

export function importanceRank(importance: QuestionProfileDef["importance"]): number {
  switch (importance) {
    case "publish_required":
      return 400;
    case "routing_critical":
      return 300;
    case "quote_critical":
      return 200;
    case "optional":
      return 100;
  }
}

export function isCriticalImportance(
  importance: QuestionProfileDef["importance"],
): boolean {
  return importance !== "optional";
}
