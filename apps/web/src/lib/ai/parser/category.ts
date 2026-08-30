import { looksLikeTelevisionScreenContext } from "@/lib/request-understanding/number-role";
import {
  APPLIANCE_BRANDS,
  AUTOMOTIVE_BRANDS,
  automotiveModelKeywordList,
  BABY_BRANDS,
  brandKeywordList,
  findTechnologyProduct,
  FURNITURE_BRANDS,
  HOME_KITCHEN_BRANDS,
  MACHINERY_BRANDS,
  TECHNOLOGY_BRANDS,
  technologyProductKeywordList,
} from "./brand-catalog";

const AUTOMOTIVE_BRAND_KEYWORDS = brandKeywordList(AUTOMOTIVE_BRANDS);
const AUTOMOTIVE_MODEL_KEYWORDS = automotiveModelKeywordList();
const TECHNOLOGY_PRODUCT_KEYWORDS = technologyProductKeywordList();
const APPLIANCE_BRAND_KEYWORDS = brandKeywordList(APPLIANCE_BRANDS);
const HOME_KITCHEN_BRAND_KEYWORDS = brandKeywordList(HOME_KITCHEN_BRANDS);
const MACHINERY_BRAND_KEYWORDS = brandKeywordList(MACHINERY_BRANDS);

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  printing: [
    "matbaa",
    "baskı",
    "baski",
    "dijital baskı",
    "dijital baski",
    "ofset",
    "flekso",
    "uv baskı",
    "uv baski",
    "kartvizit",
    "kart vizit",
    "business card",
    "broşür",
    "brosur",
    "flyer",
    "afiş",
    "afis",
    "poster",
    "katalog",
    "davetiye",
    "magnet",
    "mıknatıs",
    "miknatis",
    "sticker",
    "etiket",
    "etiket baskı",
    "etiket baski",
    "ambalaj",
    "kutu",
    "kraft kutu",
    "oluklu kutu",
    "karton",
    "mukavva",
    "kraft",
    "poşet",
    "poset",
    "shrink",
    "cepli dosya",
    "zarf",
    "antetli",
    "promosyon",
    "roll up",
    "rollup",
    "branda",
    "tabela",
    "selefon",
  ],
  automotive: [
    "araba",
    "araç",
    "arac",
    "otomobil",
    "otomotiv",
    "sedan",
    "hatchback",
    "suv",
    "pickup",
    "pick-up",
    "minivan",
    "station wagon",
    "yedek parça",
    "yedek parca",
    "tampon",
    "balata",
    "far",
    "motor",
    "şasi",
    "sasi",
    "lastik",
    "jant",
    "hatasız",
    "hatasiz",
    "boyasız",
    "boyasiz",
    "ikinci el araç",
    "ikinci el arac",
    "0 km",
    ...AUTOMOTIVE_BRAND_KEYWORDS,
    ...AUTOMOTIVE_MODEL_KEYWORDS,
  ],
  machinery: [
    "makine",
    "makina",
    "cnc",
    "pres",
    "kompresör",
    "kompresor",
    "üretim hattı",
    "uretim hatti",
    "forklift",
    "torna",
    "freze",
    "enjeksiyon",
    "extruder",
    "konveyör",
    "konveyor",
    "vinç",
    "vinc",
    "lazer kesim",
    "plazma kesim",
    "baskı makinesi",
    "baski makinesi",
    "paketleme makinesi",
    "ikinci el makine",
    "ikinci el makina",
    ...MACHINERY_BRAND_KEYWORDS,
  ],
  furniture: [
    "mobilya",
    "ofis sandalyesi",
    "çalışma masası",
    "calisma masasi",
    "toplantı masası",
    "toplantı masasi",
    "ofis masası",
    "ofis masasi",
    "ofis koltuğu",
    "ofis koltugu",
    "dosya dolabı",
    "dosya dolabi",
    "masa takımı",
    "masa takimi",
    "makam",
    "yemek masası",
    "yemek masasi",
    "sandalye",
    "koltuk",
    "dolap",
    "sehpa",
    "tezgah",
    "tezgâh",
    "büro mobilya",
    "buro mobilya",
    "ofis mobilya",
    "ergonomik",
    "kafe masa",
    "kitaplık",
    "kitaplik",
    "berjer",
    "kanepe",
    "vestiyer",
    "gardrop",
    "yatak odası",
    "yatak odasi",
    "tv ünitesi",
    "tv unitesi",
    "şaraplık",
    "saraplik",
    "gardırop",
    "ev mobilyası",
    "ev mobilyasi",
    "ofis mobilyaları",
    "ofis mobilyalari",
    ...brandKeywordList(FURNITURE_BRANDS),
  ],
  technology: [
    // Foto/kamera dünyası teknolojidir — "fotoğraf makinesi"ndeki "makine"
    // kelimesi machinery'yi şişiriyordu (Canon → machinery).
    "fotoğraf makinesi",
    "fotograf makinesi",
    "fotoğraf makinası",
    "fotograf makinasi",
    "aksiyon kamerası",
    "aksiyon kamerasi",
    "video kamera",
    "drone",
    "dron",
    "gimbal",
    "yazılım",
    "yazilim",
    "web sitesi",
    "internet sitesi",
    "e-ticaret",
    "eticaret",
    "e ticaret",
    "web hizmet",
    "uygulama",
    "bilgisayar",
    "masaüstü bilgisayar",
    "masaustu bilgisayar",
    "sunucu",
    "laptop",
    "notebook",
    "dizüstü",
    "dizustu",
    "dizüstü bilgisayar",
    "dizustu bilgisayar",
    "teknoloji",
    "telefon",
    "cep telefonu",
    "akıllı telefon",
    "akilli telefon",
    "tablet",
    "televizyon",
    "iphone",
    "android",
    "galaxy",
    "promax",
    "pro max",
    "airpods",
    "macbook",
    "ipad",
    "redmi",
    "poco",
    "monitör",
    "monitor",
    "ekran",
    "televizyon",
    "smart tv",
    "smarttv",
    "yazıcı",
    "yazici",
    "donanım",
    "donanim",
    "grafik kartı",
    "grafik karti",
    "ssd",
    "ram",
    "router",
    "switch",
    ...brandKeywordList(TECHNOLOGY_BRANDS),
    ...TECHNOLOGY_PRODUCT_KEYWORDS,
  ],
  /**
   * KB-16: "kiralık"/"satılık" bu listeden ÇIKARILDI. İkisi de bir İŞLEM
   * belirtecidir, kategori belirteci değil — araç da makine de hasta yatağı
   * da kiralık olabilir. Liste yalnız emlak NESNELERİNİ taşır; ilan sıfatının
   * emlağa katkısı aşağıdaki puanlamada emlak çıpasına bağlanmıştır.
   */
  "real-estate": [
    "ev",
    "daire",
    "villa",
    "konut",
    "emlak",
    "rezidans",
    "residans",
    "arsa",
    "apart",
    "stüdyo",
    "studyo",
    "dubleks",
    "tripleks",
    "metrekare",
    "m2",
    "m²",
    "gayrimenkul",
    "dükkan",
    "dukkan",
    "işyeri",
    "isyeri",
    "bina",
    "konut sitesi",
    "sitede",
    "site içi",
    "site ici",
    "site aidat",
    "mahalle",
    "2+1",
    "1+1",
    "3+1",
    "4+1",
    "balkon",
    "manzara",
    "tapu",
    "mustakil",
    "müstakil",
    "bahçeli",
    "bahceli",
    "havuzlu",
    "yatırım",
    "yatirim",
  ],
  appliances: [
    "beyaz eşya",
    "beyaz esya",
    "küçük ev aletleri",
    "kucuk ev aletleri",
    "buzdolabı",
    "buzdolabi",
    "çamaşır makinesi",
    "camasir makinesi",
    "bulaşık makinesi",
    "bulasik makinesi",
    "kurutma makinesi",
    "ankastre",
    "fırın",
    "firin",
    "ocak",
    "davlumbaz",
    "klima",
    "kombi",
    "derin dondurucu",
    "mikrodalga",
    "mikro dalga",
    "şarap dolabı",
    "sarap dolabi",
    "no-frost",
    "nofrost",
    "aspiratör",
    "aspirator",
    "su sebili",
    "termosifon",
    "şofben",
    "sofben",
    "ütü",
    "utu",
    "airfryer",
    "süpürge",
    "supurge",
    "robot süpürge",
    "robot supurge",
    "dikey süpürge",
    "dikey supurge",
    "elektrikli süpürge",
    "elektrikli supurge",
    "vacuum",
    "hava temizleyici",
    "hava temizleme",
    "saç kurutma",
    "sac kurutma",
    "saç bakımı",
    "sac bakimi",
    ...APPLIANCE_BRAND_KEYWORDS,
  ],
  health: [
    "sağlık",
    "saglik",
    "medikal",
    "tıbbi",
    "tibbi",
    "hastane",
    "klinik",
    "eczane",
    "ortopedi",
    "laboratuvar",
    "stetoskop",
    "tansiyon aleti",
    "oksijen",
    "hasta yatağı",
    "hasta yatagi",
    "tekerlekli sandalye",
    "dezenfektan",
    "serum",
    "protez",
    "ortez",
    "bandaj",
    "sargı",
    "sargi",
    "solunum",
    "nebulizatör",
    "nebulizator",
    "muayene",
  ],
  baby: [
    "bebek",
    "çocuk",
    "cocuk",
    "bebek arabası",
    "bebek arabasi",
    "puset",
    "mama sandalyesi",
    "emzik",
    "biberon",
    "bebek bezi",
    "beşik",
    "besik",
    "park yatak",
    "oyun parkı",
    "oyun parki",
    "yenidoğan",
    "yenidogan",
    "ana kucağı",
    "ana kucagi",
    "oyuncak",
    "tuvalet eğitimi",
    "tuvalet egitimi",
    "uyku tulumu",
    "bebek bakım",
    "bebek bakim",
    ...brandKeywordList(BABY_BRANDS),
  ],
  "home-kitchen": [
    "tabak",
    "çanak",
    "canak",
    "kahve seti",
    "çay seti",
    "cay seti",
    /**
     * KURUCU KARARI (2026-08-31): kahve makinesi (espresso / kapsüllü
     * dahil) appliances'ın malıdır; makine belirteçleri bu listeden
     * kaldırıldı. home-kitchen'da sofra/servis dünyası kalır.
     */
    "fincan",
    "bardak",
    "çatal",
    "catal",
    "bıçak seti",
    "bicak seti",
    "kaşık",
    "kasik",
    "yemek takımı",
    "yemek takimi",
    "servis takımı",
    "servis takimi",
    "mutfak eşyası",
    "mutfak esyasi",
    "porselen",
    "cam eşya",
    "cam esya",
    "tepsi",
    "sofra",
    "tencere",
    "tava",
    "süzgeç",
    "suzgec",
    "kepçe",
    "kepce",
    "termos",
    "saklama kabı",
    "saklama kabi",
    "mutfak gereci",
    ...HOME_KITCHEN_BRAND_KEYWORDS,
  ],
  services: [
    "hizmet",
    "danışmanlık",
    "danismanlik",
    "temizlik",
    "nakliye",
    "nakliyat",
    "evden eve nakliye",
    "evden eve nakliyat",
    "evden eve taşıma",
    "evden eve tasima",
    "eşya taşıma",
    "esya tasima",
    "taşımacılık",
    "tasimacilik",
    "ofis taşıma",
    "ofis tasima",
    "taşıma",
    "tasima",
    "montaj hizmeti",
    "bakım hizmeti",
    "bakim hizmeti",
    "boya",
    "badana",
    "boya badana",
    "boyama",
    "boyatacam",
    "boyatacağım",
    "boyatacagim",
    "boyatmak",
    "tadilat",
    "renovasyon",
    "tamirat",
  ],
};

function keywordScore(normalized: string, keyword: string) {
  if (!normalized.includes(keyword)) return 0;
  return Math.max(1, Math.ceil(keyword.length / 5));
}

const HOUSEHOLD_MACHINE_PATTERNS = [
  "kahve makinesi",
  "kahve makina",
  "çamaşır makinesi",
  "camasir makinesi",
  "bulaşık makinesi",
  "bulasik makinesi",
  "kurutma makinesi",
  "dikey süpürge",
  "dikey supurge",
  "elektrikli süpürge",
  "elektrikli supurge",
  "robot süpürge",
  "robot supurge",
];

const PAINT_SERVICE_PATTERNS = [
  "boya",
  "badana",
  "boyat",
  "boyama",
  "tadilat",
];

/** Minimum score before we claim a category confidently in UX. */
export const CATEGORY_CONFIDENT_MIN_SCORE = 2;

export type CategoryDetectionResult = {
  categoryId: string;
  score: number;
  /** False when match is weak/default — UI must not present as certain. */
  confident: boolean;
  runnerUpId: string | null;
  runnerUpScore: number;
};

function hasAny(normalized: string, terms: string[]) {
  return terms.some((t) => normalized.includes(t));
}

/**
 * Furniture *object* nouns beat location/use-context words like "ofis".
 * "masaüstü" / "masaj" are not furniture objects.
 */
export function hasFurnitureObjectNoun(text: string): boolean {
  const n = text.toLocaleLowerCase("tr-TR");
  if (
    /(?:koltuk|sandalye|kitaplık|kitaplik|sehpa|berjer|kanepe|gardırop|gardrop|vestiyer|dolap)/i.test(
      n,
    )
  ) {
    return true;
  }
  if (
    /(?:çalışma|calisma|toplantı|toplantı|yemek|ofis)\s*masa/i.test(n)
  ) {
    return true;
  }
  if (/masaüstü|masaustu|masaj/.test(n)) return false;
  return /(?:^|[^\p{L}\p{N}])masa(?:sı|si)?(?=[^\p{L}\p{N}]|$)/iu.test(n);
}

function hasRealEstateOfficeSignal(normalized: string): boolean {
  if (!normalized.includes("ofis")) return false;
  if (hasFurnitureObjectNoun(normalized)) return false;
  return (
    /kiralık|kiralik|satılık|satilik|kiralamak|metrekare|\bm2\b|m²|gayrimenkul|işyeri|isyeri/.test(
      normalized,
    ) || /\d+\s*m2/.test(normalized)
  );
}

/**
 * Score all categories and pick a winner.
 * IMPORTANT: score 0 must NOT confidently claim "services".
 */
export function detectCategoryResult(text: string): CategoryDetectionResult {
  const normalized = text.toLocaleLowerCase("tr-TR");

  let winner = "services";
  let winnerScore = 0;
  let runnerUpId: string | null = null;
  let runnerUpScore = 0;

  for (const [categoryId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = keywords.reduce(
      (total, keyword) => total + keywordScore(normalized, keyword),
      0,
    );

    if (categoryId === "automotive") {
      if (
        AUTOMOTIVE_BRAND_KEYWORDS.some((keyword) =>
          normalized.includes(keyword),
        ) ||
        AUTOMOTIVE_MODEL_KEYWORDS.some((keyword) =>
          normalized.includes(keyword),
        )
      ) {
        score += 4;
      }
    }

    if (categoryId === "furniture") {
      if (
        normalized.includes("masa") &&
        !normalized.includes("masaüstü") &&
        !normalized.includes("masaustu") &&
        !normalized.includes("masaj") &&
        !normalized.includes("kahve seti") &&
        !normalized.includes("yemek takımı") &&
        !normalized.includes("yemek takimi")
      ) {
        score += 2;
      }
      if (normalized.includes("ofis") && hasFurnitureObjectNoun(normalized)) {
        score += 4;
      } else if (normalized.includes("ofis") && normalized.includes("sandalye")) {
        score += 3;
      }
      if (normalized.includes("tekerlekli sandalye")) {
        score = Math.max(0, score - 4);
      }
    }

    if (categoryId === "home-kitchen") {
      if (
        normalized.includes("kahve seti") ||
        normalized.includes("çay seti") ||
        normalized.includes("cay seti") ||
        normalized.includes("tabak") ||
        normalized.includes("yemek takımı") ||
        normalized.includes("yemek takimi")
        /* kahve makinesi / espresso / lattego: kurucu kararıyla appliances
           (2026-08-31); makine takviyesi burada yaşayamaz. */
      ) {
        score += 4;
      }
      if (
        HOME_KITCHEN_BRAND_KEYWORDS.some((keyword) =>
          normalized.includes(keyword),
        )
      ) {
        score += 4;
      }
    }

    if (categoryId === "appliances") {
      if (
        normalized.includes("makine") &&
        (normalized.includes("çamaşır") ||
          normalized.includes("camasir") ||
          normalized.includes("bulaşık") ||
          normalized.includes("bulasik") ||
          normalized.includes("kurutma"))
      ) {
        score += 3;
      }
      if (
        APPLIANCE_BRAND_KEYWORDS.some((keyword) =>
          normalized.includes(keyword),
        ) &&
        !looksLikeTelevisionScreenContext(normalized)
      ) {
        score += 4;
      }
      if (
        normalized.includes("süpürge") ||
        normalized.includes("supurge") ||
        normalized.includes("vacuum")
      ) {
        score += 3;
      }
    }

    if (categoryId === "health" && normalized.includes("tekerlekli sandalye")) {
      score += 4;
    }

    if (categoryId === "baby" && normalized.includes("bebek")) {
      score += 2;
    }

    if (categoryId === "technology") {
      if (
        normalized.includes("telefon") ||
        normalized.includes("iphone") ||
        normalized.includes("ipad") ||
        normalized.includes("macbook") ||
        normalized.includes("airpods") ||
        normalized.includes("laptop") ||
        normalized.includes("notebook")
      ) {
        score += 3;
      }
      if (
        normalized.includes("televizyon") ||
        (/\btv\b/.test(normalized) &&
          !normalized.includes("tv ünitesi") &&
          !normalized.includes("tv unitesi"))
      ) {
        score += 5;
      }
      if (findTechnologyProduct(normalized)) {
        score += 6;
      }
      if (looksLikeTelevisionScreenContext(normalized)) {
        score += 6;
      }
      if (
        /\be-?ticaret\b/.test(normalized) ||
        normalized.includes("web sitesi") ||
        normalized.includes("internet sitesi") ||
        normalized.includes("web hizmet")
      ) {
        score += 6;
      }
    }

    if (categoryId === "real-estate") {
      if (/\b[1-9]\s*\+\s*[0-9]\b/.test(normalized)) {
        score += 3;
      }
      // Short lexicon anchors — enough for TENTATIVE/CONFIDENT gate
      const hasPropertyAnchor =
        /\b(emlak|daire|villa|konut|gayrimenkul|arsa|rezidans|residans)\b/i.test(
          normalized,
        );
      if (hasPropertyAnchor) {
        score += 2;
      }
      /**
       * KB-16: ilan sıfatı emlağa YALNIZ bir emlak nesnesi varken puan verir.
       * "kiralık daire" emlaktır; "kiralık araç", "satılık araç" ve "hasta
       * yatağı … kiralık" değildir. Eski sürümde sıfat tek başına +2 (ve
       * anahtar kelime olarak +2 daha) üretiyor, aracı emlağa taşıyordu.
       */
      if (
        hasPropertyAnchor &&
        (normalized.includes("kiralık") || normalized.includes("satılık"))
      ) {
        score += 2;
      }
      // Paint / renovation service verbs must not look like property search
      if (hasAny(normalized, PAINT_SERVICE_PATTERNS)) {
        score = Math.max(0, score - 6);
      }
      if (
        /\be-?ticaret\b/.test(normalized) ||
        normalized.includes("web sitesi") ||
        normalized.includes("internet sitesi") ||
        normalized.includes("web hizmet")
      ) {
        score = Math.max(0, score - 6);
      }
    }

    if (categoryId === "real-estate" && normalized.includes("ofis")) {
      if (hasFurnitureObjectNoun(normalized)) {
        score = Math.max(0, score - 6);
      } else if (hasRealEstateOfficeSignal(normalized)) {
        score += 4;
      } else if (!hasAny(normalized, PAINT_SERVICE_PATTERNS)) {
        // Bare "ofis" is too weak to claim real estate
        score = Math.max(0, score - 1);
      }
    }

    if (categoryId === "printing") {
      const strongPrintingTerms = [
        "kartvizit",
        "kart vizit",
        "broşür",
        "brosur",
        "flyer",
        "afiş",
        "afis",
        "katalog",
        "etiket",
        "ambalaj",
        "matbaa",
        "baskı",
        "baski",
        "bastır",
        "bastir",
        "davetiye",
        "sticker",
        "kraft kutu",
        "oluklu kutu",
        "kutu",
      ];
      if (strongPrintingTerms.some((term) => normalized.includes(term))) {
        score += 4;
      }
      if (
        normalized.includes("baskı makinesi") ||
        normalized.includes("baski makinesi") ||
        normalized.includes("matbaa makinesi")
      ) {
        score = Math.max(0, score - 3);
      }
    }

    if (categoryId === "machinery") {
      if (
        normalized.includes("baskı makinesi") ||
        normalized.includes("baski makinesi") ||
        normalized.includes("matbaa makinesi") ||
        normalized.includes("paketleme makinesi")
      ) {
        score += 4;
      }
      if (
        MACHINERY_BRAND_KEYWORDS.some((keyword) =>
          normalized.includes(keyword),
        )
      ) {
        score += 5;
      }
      // Household "… makinesi" must not win industrial machinery
      if (hasAny(normalized, HOUSEHOLD_MACHINE_PATTERNS)) {
        score = Math.max(0, score - 6);
      }
    }

    if (categoryId === "services") {
      if (hasAny(normalized, PAINT_SERVICE_PATTERNS)) {
        score += 5;
      }
      // Bare "hizmet" alone is weak; require actual service signal
      if (
        score > 0 &&
        score < 2 &&
        !hasAny(normalized, [
          "temizlik",
          "nakliye",
          "nakliyat",
          "danışmanlık",
          "danismanlik",
          ...PAINT_SERVICE_PATTERNS,
        ])
      ) {
        score = Math.max(0, score - 1);
      }
    }

    if (score > winnerScore) {
      runnerUpId = winnerScore > 0 ? winner : runnerUpId;
      runnerUpScore = winnerScore;
      winner = categoryId;
      winnerScore = score;
    } else if (score > runnerUpScore) {
      runnerUpId = categoryId;
      runnerUpScore = score;
    }
  }

  // No keyword signal → do not confidently claim services (historical default).
  if (winnerScore <= 0) {
    return {
      categoryId: "services",
      score: 0,
      confident: false,
      runnerUpId: null,
      runnerUpScore: 0,
    };
  }

  const margin = winnerScore - runnerUpScore;
  const retailFamily = new Set([
    "appliances",
    "home-kitchen",
    "technology",
    "baby",
    "furniture",
  ]);
  const ambiguousRetailTie =
    margin < 2 &&
    retailFamily.has(winner) &&
    runnerUpId != null &&
    retailFamily.has(runnerUpId);

  const confident =
    winnerScore >= CATEGORY_CONFIDENT_MIN_SCORE &&
    !(winner === "services" && winnerScore < 3) &&
    (ambiguousRetailTie ||
      !(margin < 2 && runnerUpScore >= CATEGORY_CONFIDENT_MIN_SCORE));

  return {
    categoryId: winner,
    score: winnerScore,
    confident,
    runnerUpId,
    runnerUpScore,
  };
}

export function detectCategoryId(text: string): string {
  return detectCategoryResult(text).categoryId;
}
