const CITIES = [
  "İstanbul",
  "Ankara",
  "İzmir",
  "Bursa",
  "Antalya",
  "Adana",
  "Konya",
  "Gaziantep",
  "Kocaeli",
  "Mersin",
];

const DISTRICTS: Record<string, string> = {
  bağcılar: "İstanbul / Bağcılar",
  bagcilar: "İstanbul / Bağcılar",
  kadıköy: "İstanbul / Kadıköy",
  kadikoy: "İstanbul / Kadıköy",
  beşiktaş: "İstanbul / Beşiktaş",
  besiktas: "İstanbul / Beşiktaş",
  üsküdar: "İstanbul / Üsküdar",
  uskudar: "İstanbul / Üsküdar",
  bakırköy: "İstanbul / Bakırköy",
  bakirkoy: "İstanbul / Bakırköy",
  zeytinburnu: "İstanbul / Zeytinburnu",
  fatih: "İstanbul / Fatih",
  şişli: "İstanbul / Şişli",
  sisli: "İstanbul / Şişli",
  ataşehir: "İstanbul / Ataşehir",
  atasehir: "İstanbul / Ataşehir",
  maltepe: "İstanbul / Maltepe",
  pendik: "İstanbul / Pendik",
  kartal: "İstanbul / Kartal",
  sarıyer: "İstanbul / Sarıyer",
  sariyer: "İstanbul / Sarıyer",
};

const QUANTITY_CATEGORIES = new Set([
  "printing",
  "machinery",
  "furniture",
]);

const DELIVERY_CATEGORIES = new Set([
  "printing",
  "machinery",
  "furniture",
  "technology",
]);

export function detectQuantity(text: string, categoryId: string) {
  if (!QUANTITY_CATEGORIES.has(categoryId)) return {};

  const match = text.match(
    /(\d[\d.]*)\s*(adet|tane|kutu|masa|sandalye|bilgisayar|parça)?/i
  );

  if (!match) return {};

  return {
    quantity: Number(match[1].replace(/\./g, "")),
    unit: match[2] ?? "adet",
  };
}

export function detectCity(text: string) {
  const normalized = text.toLocaleLowerCase("tr-TR");

  const city = CITIES.find((item) =>
    normalized.includes(item.toLocaleLowerCase("tr-TR"))
  );
  if (city) return city;

  for (const [district, label] of Object.entries(DISTRICTS)) {
    if (normalized.includes(district)) {
      return label;
    }
  }

  return undefined;
}

export function detectDeliveryDays(text: string, categoryId: string) {
  if (!DELIVERY_CATEGORIES.has(categoryId)) return undefined;

  const match = text.match(/(\d+)\s*(gün|hafta)/i);
  if (!match) return undefined;

  const amount = Number(match[1]);
  return match[2].toLocaleLowerCase("tr-TR") === "hafta"
    ? amount * 7
    : amount;
}

export function detectBudget(text: string) {
  const match = text.match(/(\d[\d.]*)\s*(bin)?\s*(tl|₺)/i);
  if (!match) return undefined;

  const base = Number(match[1].replace(/\./g, ""));
  return match[2] ? base * 1000 : base;
}

export function detectAttributes(text: string, categoryId: string) {
  const normalized = text.toLocaleLowerCase("tr-TR");
  const attributes: Record<string, string | number | boolean> = {};

  const dimensionMatch = text.match(
    /(\d+\s?[x×]\s?\d+(?:\s?[x×]\s?\d+)?)\s*(cm|mm)?/i
  );

  if (dimensionMatch) {
    attributes.dimensions = `${dimensionMatch[1].replace(/\s/g, "")} ${
      dimensionMatch[2] ?? "cm"
    }`;
  }

  if (categoryId === "printing") {
    const gramMatch = text.match(/(\d{2,4})\s*(gr|gram)\b/i);
    if (gramMatch) attributes.paperWeight = Number(gramMatch[1]);

    if (normalized.includes("kraft")) attributes.material = "Kraft";
    if (normalized.includes("bristol")) attributes.material = "Bristol";
    if (normalized.includes("mat selefon"))
      attributes.lamination = "Mat selefon";
    if (normalized.includes("parlak selefon"))
      attributes.lamination = "Parlak selefon";
  }

  if (categoryId === "automotive") {
    const brands = [
      "Mercedes",
      "BMW",
      "Audi",
      "Renault",
      "Ford",
      "Fiat",
      "Toyota",
      "Honda",
      "Volkswagen",
      "Opel",
      "Hyundai",
      "Peugeot",
      "Skoda",
      "Volvo",
    ];
    const brand = brands.find((item) =>
      normalized.includes(item.toLocaleLowerCase("tr-TR")),
    );
    if (brand) attributes.brand = brand;

    const yearMatch = text.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) attributes.modelYear = Number(yearMatch[0]);

    const modelMatch = text.match(
      /\b(C180|C200|C220|E200|E220|A180|A200|320i|520i|A3|A4|Clio|Megane|Focus|Egea|Corolla|Civic|Golf)\b/i,
    );
    const kasaMatch = text.match(
      /\b([cesa])\s*[- ]?\s*(kasa|sınıfı|sinifi|class|serisi)\b/i,
    );
    if (modelMatch) {
      attributes.model = modelMatch[0].toUpperCase();
    } else if (kasaMatch) {
      attributes.model = `${kasaMatch[1].toUpperCase()} kasa`;
    }

    const partPhrases = [
      "yedek parça",
      "yedek parca",
      "ön tampon",
      "arka tampon",
      "ön balata",
      "arka balata",
      "stop lambası",
      "stop lambasi",
      "muadil parça",
      "orijinal parça",
      "çamurluk",
      "camurluk",
      "şanzıman",
      "sanziman",
      "debriyaj",
      "radyatör",
      "radyator",
      "kaput",
    ];
    const partWord =
      partPhrases.find((item) => normalized.includes(item)) ||
      (/\b(far|balata|tampon)\b/i.test(text)
        ? text.match(/\b(far|balata|tampon)\b/i)?.[0]
        : undefined);
    if (partWord) attributes.part = partWord;

    const wantsPartExplicitly =
      Boolean(partWord) ||
      normalized.includes("yedek parça") ||
      normalized.includes("yedek parca") ||
      normalized.includes("parça arıyorum") ||
      normalized.includes("parca ariyorum") ||
      normalized.includes("parça lazım") ||
      normalized.includes("parca lazim");

    const wantsTire =
      /\b(lastik|jant|stepne)\b/i.test(text) &&
      !normalized.includes("araba") &&
      !normalized.includes("araç") &&
      !normalized.includes("arac");

    const wantsService =
      normalized.includes("periyodik bakım") ||
      normalized.includes("yağ değişimi") ||
      normalized.includes("yag degisimi") ||
      normalized.includes("bakım yaptır") ||
      normalized.includes("bakim yaptir") ||
      (normalized.includes("servis") &&
        !normalized.includes("servis kaydı") &&
        wantsPartExplicitly === false &&
        !brand);

    const rejectsPart =
      normalized.includes("parça değil") ||
      normalized.includes("parca degil") ||
      normalized.includes("parça aramıyorum") ||
      normalized.includes("parca aramiyorum") ||
      normalized.includes("kendisini arıyorum") ||
      normalized.includes("kendisini ariyorum") ||
      normalized.includes("arabanın kendisi") ||
      normalized.includes("arabanin kendisi") ||
      normalized.includes("aracın kendisi") ||
      normalized.includes("aracin kendisi");

    const wantsVehicle =
      rejectsPart ||
      normalized.includes("arıyorum") ||
      normalized.includes("ariyorum") ||
      normalized.includes("araba") ||
      normalized.includes("otomobil") ||
      normalized.includes("araç") ||
      normalized.includes("arac") ||
      normalized.includes("satın al") ||
      normalized.includes("satin al") ||
      normalized.includes("ikinci el") ||
      normalized.includes("2. el") ||
      normalized.includes("0 km") ||
      normalized.includes("hatasız") ||
      normalized.includes("hatasiz") ||
      normalized.includes("boyasız") ||
      normalized.includes("boyasiz") ||
      normalized.includes("kasa") ||
      Boolean(brand) ||
      Boolean(attributes.model);

    // Default = whole vehicle. Parts only when clearly asked.
    if (!rejectsPart && wantsTire) {
      attributes.needType = "tire";
      if (!attributes.part) {
        attributes.part = normalized.includes("jant") ? "jant" : "lastik";
      }
    } else if (!rejectsPart && wantsPartExplicitly) {
      attributes.needType = "part";
    } else if (!rejectsPart && wantsService && !wantsVehicle) {
      attributes.needType = "service";
      if (normalized.includes("periyodik")) {
        attributes.serviceType = "Periyodik bakım";
      } else if (normalized.includes("yağ") || normalized.includes("yag")) {
        attributes.serviceType = "Yağ değişimi";
      }
    } else {
      attributes.needType = "vehicle";
      if (
        normalized.includes("hatasız") ||
        normalized.includes("hatasiz") ||
        normalized.includes("boyasız") ||
        normalized.includes("boyasiz")
      ) {
        attributes.bodyCondition = "Hatasız / boyasız tercih";
      }
      if (
        normalized.includes("sıfır") ||
        normalized.includes("sifir") ||
        normalized.includes("0 km")
      ) {
        attributes.condition = "Sıfır";
      } else if (
        normalized.includes("ikinci el") ||
        normalized.includes("2. el")
      ) {
        attributes.condition = "İkinci el";
      }
    }
  }

  if (categoryId === "machinery") {
    const partSignals = [
      "yedek parça",
      "yedek parca",
      "rulman",
      "bıçak",
      "bicak",
      "filtre",
      "kayış",
      "kayis",
    ];
    const serviceSignals = [
      "servis",
      "bakım",
      "bakim",
      "kurulum",
      "montaj",
      "tamir",
    ];

    if (partSignals.some((item) => normalized.includes(item))) {
      attributes.needType = "part";
      const part = partSignals.find((item) => normalized.includes(item));
      if (part && !part.includes("yedek")) attributes.part = part;
    } else if (serviceSignals.some((item) => normalized.includes(item))) {
      attributes.needType = "service";
    } else {
      attributes.needType = "machine";
    }

    if (
      normalized.includes("cnc") ||
      normalized.includes("pres") ||
      normalized.includes("kompresör") ||
      normalized.includes("kompresor")
    ) {
      if (normalized.includes("cnc")) attributes.machineType = "CNC";
      else if (normalized.includes("pres")) attributes.machineType = "Pres";
      else attributes.machineType = "Kompresör";
    }
  }

  if (categoryId === "technology") {
    const hardwareSignals = [
      "laptop",
      "bilgisayar",
      "sunucu",
      "monitor",
      "monitör",
      "yazıcı",
      "yazici",
      "donanım",
      "donanim",
      "notebook",
    ];
    const serviceSignals = ["bakım", "bakim", "destek", "hosting bakımı"];
    const softwareSignals = [
      "yazılım",
      "yazilim",
      "web sitesi",
      "uygulama",
      "mobil uygulama",
      "erp",
      "crm",
      "entegrasyon",
    ];

    if (hardwareSignals.some((item) => normalized.includes(item))) {
      attributes.needType = "hardware";
      const hit = hardwareSignals.find((item) => normalized.includes(item));
      if (hit) attributes.solutionType = hit;
    } else if (
      serviceSignals.some((item) => normalized.includes(item)) &&
      !softwareSignals.some((item) => normalized.includes(item))
    ) {
      attributes.needType = "service";
      attributes.solutionType = "Bakım ve destek";
    } else {
      attributes.needType = "software";
    }
  }

  if (categoryId === "furniture") {
    if (
      normalized.includes("ofis sandalyesi") ||
      (normalized.includes("sandalye") && normalized.includes("ofis"))
    ) {
      attributes.furnitureType = "Ofis sandalyesi";
      attributes.usageArea = "Ofis";
    } else if (
      normalized.includes("toplantı masası") ||
      normalized.includes("toplantı masasi")
    ) {
      attributes.furnitureType = "Toplantı masası";
      attributes.usageArea = "Ofis";
    } else if (
      normalized.includes("masa takımı") ||
      normalized.includes("masa takimi") ||
      normalized.includes("makam") ||
      normalized.includes("yönetici masa") ||
      normalized.includes("yonetici masa")
    ) {
      attributes.furnitureType = "Makam / yönetici masa takımı";
      attributes.usageArea = "Ofis";
    } else if (
      normalized.includes("çalışma masası") ||
      normalized.includes("calisma masasi") ||
      normalized.includes("ofis masası") ||
      normalized.includes("ofis masasi")
    ) {
      attributes.furnitureType = "Çalışma / ofis masası";
      attributes.usageArea = "Ofis";
    } else if (normalized.includes("sandalye")) {
      attributes.furnitureType = "Ofis sandalyesi";
    } else if (
      normalized.includes("masa") &&
      !normalized.includes("masaüstü") &&
      !normalized.includes("masaustu")
    ) {
      attributes.furnitureType = "Çalışma / ofis masası";
    } else if (normalized.includes("koltuk")) {
      attributes.furnitureType = "Koltuk grubu";
    } else if (normalized.includes("dolap")) {
      attributes.furnitureType = "Dolap / raf";
    }

    if (normalized.includes("kafe") || normalized.includes("restoran")) {
      attributes.usageArea = "Kafe / restoran";
      if (!attributes.furnitureType) {
        attributes.furnitureType = "Kafe masa-sandalye seti";
      }
    } else if (normalized.includes("okul") || normalized.includes("eğitim")) {
      attributes.usageArea = "Okul / eğitim";
    } else if (
      normalized.includes("makam") ||
      normalized.includes("ofis") ||
      normalized.includes("büro") ||
      normalized.includes("buro")
    ) {
      attributes.usageArea = attributes.usageArea || "Ofis";
    } else if (normalized.includes("ev ") || normalized.startsWith("ev")) {
      attributes.usageArea = attributes.usageArea || "Ev";
    }

    if (normalized.includes("mdflam") || normalized.includes("suntalam")) {
      attributes.material = "MDFLAM / suntalam";
    } else if (normalized.includes("masif")) {
      attributes.material = "Masif ahşap";
    } else if (normalized.includes("mesh") || normalized.includes("file")) {
      attributes.material = "File / mesh";
    } else if (normalized.includes("deri")) {
      attributes.material = "Deri / suni deri";
    } else if (normalized.includes("metal")) {
      attributes.material = "Metal";
    } else if (normalized.includes("kumaş") || normalized.includes("kumas")) {
      attributes.material = "Kumaş döşeme";
    }

    const featureBits = [
      "kolluklu",
      "kolçaklı",
      "tekerlekli",
      "yükseklik ayarlı",
      "yukseklik ayarli",
      "bel destekli",
      "ergonomik",
      "ayaklıklı",
      "ayarlanabilir",
    ].filter((item) => normalized.includes(item));

    if (featureBits.length) {
      attributes.features = featureBits.join(", ");
    }

    if (normalized.includes("ikinci el") || normalized.includes("2. el")) {
      attributes.condition = "İkinci el";
    } else if (normalized.includes("sıfır") || normalized.includes("sifir")) {
      attributes.condition = "Sıfır";
    }

    if (normalized.includes("montaj dahil")) {
      attributes.assembly = "Dahil olsun";
    } else if (normalized.includes("montaj hariç")) {
      attributes.assembly = "Hariç";
    }
  }

  if (categoryId === "real-estate") {
    if (normalized.includes("kiralık") || normalized.includes("kirilik")) {
      attributes.listingType = "Kiralık";
    } else if (normalized.includes("satılık") || normalized.includes("satilik")) {
      attributes.listingType = "Satılık";
    }

    if (normalized.includes("villa")) attributes.propertyType = "Villa";
    else if (normalized.includes("stüdyo") || normalized.includes("studyo"))
      attributes.propertyType = "Stüdyo";
    else if (normalized.includes("dubleks")) attributes.propertyType = "Dubleks";
    else if (normalized.includes("rezidans") || normalized.includes("residans"))
      attributes.propertyType = "Residans";
    else if (normalized.includes("arsa")) attributes.propertyType = "Arsa";
    else if (
      normalized.includes("dükkan") ||
      normalized.includes("dukkan") ||
      normalized.includes("işyeri") ||
      normalized.includes("isyeri")
    )
      attributes.propertyType = "İş yeri";
    else if (
      normalized.includes("ev") ||
      normalized.includes("daire") ||
      normalized.includes("konut") ||
      normalized.includes("apart")
    )
      attributes.propertyType = "Daire";

    const roomMatch = text.match(/\b([1-9]\s?\+\s?[0-9])\b/);
    if (roomMatch) {
      attributes.roomCount = roomMatch[1].replace(/\s/g, "");
    }

    const areaMatch = text.match(/(\d{2,4})\s*(m2|m²|metrekare)\b/i);
    if (areaMatch) attributes.area = Number(areaMatch[1]);

    const locationMatch = text.match(
      /([a-zçğıöşüA-ZÇĞİÖŞÜ\s]+(?:cd|cadde|sokak|sk|mah\.?|mahalle)[a-zçğıöşüA-ZÇĞİÖŞÜ0-9\s]*)/i
    );
    if (locationMatch) {
      attributes.location = locationMatch[1].trim();
    } else {
      for (const [district, label] of Object.entries(DISTRICTS)) {
        if (normalized.includes(district)) {
          attributes.location = label.split(" / ").pop() ?? district;
          break;
        }
      }
    }

    const floorMatch = text.match(/(\d+)\s*\/\s*(\d+)\s*kat/i);
    if (floorMatch) attributes.floor = `${floorMatch[1]} / ${floorMatch[2]}`;

    const ageMatch = text.match(/(\d{1,2})\s*yıllık/i);
    if (ageMatch) attributes.buildingAge = Number(ageMatch[1]);
  }

  return attributes;
}
