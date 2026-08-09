import {
  APPLIANCE_BRANDS,
  AUTOMOTIVE_BRANDS,
  automotiveModelKeywordList,
  BABY_BRANDS,
  brandKeywordList,
  findTechnologyProduct,
  FURNITURE_BRANDS,
  TECHNOLOGY_BRANDS,
  technologyProductKeywordList,
} from "./brand-catalog";

const AUTOMOTIVE_BRAND_KEYWORDS = brandKeywordList(AUTOMOTIVE_BRANDS);
const AUTOMOTIVE_MODEL_KEYWORDS = automotiveModelKeywordList();
const TECHNOLOGY_PRODUCT_KEYWORDS = technologyProductKeywordList();

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
    ...brandKeywordList(FURNITURE_BRANDS),
  ],
  technology: [
    "yazılım",
    "yazilim",
    "web sitesi",
    "uygulama",
    "bilgisayar",
    "masaüstü bilgisayar",
    "masaustu bilgisayar",
    "sunucu",
    "laptop",
    "notebook",
    "teknoloji",
    "telefon",
    "akıllı telefon",
    "akilli telefon",
    "tablet",
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
  "real-estate": [
    "ev",
    "daire",
    "villa",
    "konut",
    "kiralık",
    "kirilik",
    "satılık",
    "satilik",
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
    "site",
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
    "derin dondurucu",
    "mikrodalga",
    "mikro dalga",
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
    "robot süpürge",
    "robot supurge",
    "hava temizleyici",
    ...brandKeywordList(APPLIANCE_BRANDS),
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
  ],
  services: [
    "hizmet",
    "danışmanlık",
    "danismanlik",
    "temizlik",
    "nakliye",
    "nakliyat",
    "taşıma",
    "tasima",
    "montaj hizmeti",
    "bakım hizmeti",
    "bakim hizmeti",
  ],
};

function keywordScore(normalized: string, keyword: string) {
  if (!normalized.includes(keyword)) return 0;
  return Math.max(1, Math.ceil(keyword.length / 5));
}

export function detectCategoryId(text: string): string {
  const normalized = text.toLocaleLowerCase("tr-TR");

  let winner = "services";
  let winnerScore = 0;

  for (const [categoryId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = keywords.reduce(
      (total, keyword) => total + keywordScore(normalized, keyword),
      0
    );

    if (categoryId === "automotive") {
      // Brand or model alone should beat generic "services"
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
      if (normalized.includes("ofis") && normalized.includes("sandalye")) {
        score += 3;
      }
      // Tekerlekli sandalye sağlık; ofis sandalyesi mobilya
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
      // Slang device models ("16 pro max", "s24 ultra") must beat default "services"
      if (findTechnologyProduct(normalized)) {
        score += 6;
      }
    }

    if (categoryId === "real-estate") {
      if (/\b[1-9]\s*\+\s*[0-9]\b/.test(normalized)) {
        score += 3;
      }
      if (
        normalized.includes("kiralık") ||
        normalized.includes("satılık")
      ) {
        score += 2;
      }
    }

    if (categoryId === "real-estate" && normalized.includes("ofis")) {
      // "ofis sandalyesi / masası" emlak değil
      if (
        normalized.includes("sandalye") ||
        normalized.includes("masa") ||
        normalized.includes("mobilya")
      ) {
        score = Math.max(0, score - 2);
      } else {
        score += 1;
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
        "davetiye",
        "sticker",
        "kraft kutu",
        "oluklu kutu",
      ];
      if (strongPrintingTerms.some((term) => normalized.includes(term))) {
        score += 4;
      }
      // Matbaa ekipmanı makine kategorisine kaymasın
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
    }

    if (score > winnerScore) {
      winner = categoryId;
      winnerScore = score;
    }
  }

  return winner;
}
