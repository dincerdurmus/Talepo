const CATEGORY_KEYWORDS: Record<string, string[]> = {
  printing: [
    "matbaa",
    "baskı",
    "baski",
    "kutu",
    "karton",
    "etiket",
    "ambalaj",
    "broşür",
    "brosur",
    "selefon",
    "ofset",
  ],
  automotive: [
    "araba",
    "araç",
    "arac",
    "otomobil",
    "mercedes",
    "bmw",
    "audi",
    "tampon",
    "balata",
    "far",
    "motor",
    "şasi",
    "sasi",
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
    "teknoloji",
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

    if (categoryId === "furniture") {
      if (
        normalized.includes("masa") &&
        !normalized.includes("masaüstü") &&
        !normalized.includes("masaustu") &&
        !normalized.includes("masaj")
      ) {
        score += 2;
      }
      if (normalized.includes("ofis") && normalized.includes("sandalye")) {
        score += 3;
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

    if (score > winnerScore) {
      winner = categoryId;
      winnerScore = score;
    }
  }

  return winner;
}
