import {
  APPLIANCE_BRANDS,
  AUTOMOTIVE_BRANDS,
  BABY_BRANDS,
  findAutomotiveModel,
  findBrand,
  findTechnologyProduct,
  TECHNOLOGY_BRANDS,
} from "./brand-catalog";

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
  "appliances",
  "health",
  "baby",
  "home-kitchen",
]);

const DELIVERY_CATEGORIES = new Set([
  "printing",
  "machinery",
  "furniture",
  "technology",
  "appliances",
  "health",
  "baby",
  "home-kitchen",
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
    const brand = findBrand(text, AUTOMOTIVE_BRANDS);
    if (brand) attributes.brand = brand;

    const yearMatch = text.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) attributes.modelYear = Number(yearMatch[0]);

    const model = findAutomotiveModel(text, brand);
    if (model) attributes.model = model;

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
      "telefon",
      "tablet",
      "iphone",
      "ipad",
      "macbook",
      "airpods",
      "airpod",
      "android",
      "galaxy",
      "galaksi",
      "redmi",
      "poco",
      "playstation",
      "ps5",
      "ps4",
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

    const techProduct = findTechnologyProduct(text);
    const techBrand =
      techProduct?.brand || findBrand(text, TECHNOLOGY_BRANDS);

    if (techProduct) {
      attributes.needType = "hardware";
      attributes.solutionType = techProduct.canonical;
      attributes.brand = techProduct.brand;
    } else if (
      hardwareSignals.some((item) => normalized.includes(item)) ||
      techBrand
    ) {
      attributes.needType = "hardware";
      const hit = hardwareSignals.find((item) => normalized.includes(item));
      if (
        techBrand === "Apple" &&
        (hit === "iphone" || normalized.includes("iphone"))
      ) {
        attributes.solutionType = "iPhone";
        attributes.brand = "Apple";
      } else if (techBrand && hit) {
        attributes.solutionType = `${techBrand} ${hit}`;
        attributes.brand = techBrand;
      } else if (techBrand) {
        attributes.solutionType = techBrand;
        attributes.brand = techBrand;
      } else if (hit) {
        attributes.solutionType = hit === "iphone" ? "iPhone" : hit;
      }
    } else if (
      serviceSignals.some((item) => normalized.includes(item)) &&
      !softwareSignals.some((item) => normalized.includes(item))
    ) {
      attributes.needType = "service";
      attributes.solutionType = "Bakım ve destek";
    } else {
      attributes.needType = "software";
    }

    // Device condition / price preferences from casual speech (after normalize)
    if (attributes.needType === "hardware") {
      const prefs: string[] = [];
      if (
        normalized.includes("temiz durumda") ||
        normalized.includes("temiz") ||
        normalized.includes("iyi durumda")
      ) {
        prefs.push("Temiz / iyi durumda");
      }
      if (
        normalized.includes("uygun fiyat") ||
        normalized.includes("uygun fiyatlı") ||
        normalized.includes("ucuz")
      ) {
        prefs.push("Uygun fiyatlı tedarik");
      }
      if (prefs.length && !attributes.specs) {
        attributes.specs = prefs.join(", ");
      }
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

  if (categoryId === "appliances") {
    if (normalized.includes("buzdolab") || normalized.includes("buzdolabı")) {
      attributes.applianceType = "Buzdolabı";
    } else if (
      normalized.includes("çamaşır makinesi") ||
      normalized.includes("camasir makinesi")
    ) {
      attributes.applianceType = "Çamaşır makinesi";
    } else if (
      normalized.includes("bulaşık makinesi") ||
      normalized.includes("bulasik makinesi")
    ) {
      attributes.applianceType = "Bulaşık makinesi";
    } else if (normalized.includes("kurutma")) {
      attributes.applianceType = "Kurutma makinesi";
    } else if (normalized.includes("klima")) {
      attributes.applianceType = "Klima";
    } else if (normalized.includes("fırın") || normalized.includes("firin")) {
      attributes.applianceType = "Fırın";
    } else if (normalized.includes("ocak")) {
      attributes.applianceType = "Ocak";
    } else if (normalized.includes("davlumbaz")) {
      attributes.applianceType = "Davlumbaz";
    } else if (
      normalized.includes("mikrodalga") ||
      normalized.includes("mikro dalga")
    ) {
      attributes.applianceType = "Mikrodalga";
    } else if (normalized.includes("derin dondurucu")) {
      attributes.applianceType = "Derin dondurucu";
    }

    if (normalized.includes("otel") || normalized.includes("pansiyon")) {
      attributes.usageArea = "Otel / pansiyon";
    } else if (normalized.includes("restoran") || normalized.includes("kafe")) {
      attributes.usageArea = "Restoran / kafe";
    } else if (normalized.includes("ofis")) {
      attributes.usageArea = "Ofis";
    } else if (normalized.includes("ankastre") || normalized.includes("ev")) {
      attributes.usageArea = attributes.usageArea || "Ev";
    }

    if (normalized.includes("ankastre")) {
      attributes.features = attributes.features
        ? `${attributes.features}, ankastre`
        : "ankastre";
    }
    if (normalized.includes("no-frost") || normalized.includes("nofrost")) {
      attributes.features = attributes.features
        ? `${attributes.features}, no-frost`
        : "no-frost";
    }

    if (normalized.includes("ikinci el") || normalized.includes("2. el")) {
      attributes.condition = "İkinci el";
    } else if (normalized.includes("sıfır") || normalized.includes("sifir")) {
      attributes.condition = "Sıfır";
    }

    if (normalized.includes("kurulum") || normalized.includes("montaj")) {
      attributes.installation = "Dahil olsun";
    }

    const applianceBrand = findBrand(text, APPLIANCE_BRANDS);
    if (applianceBrand) {
      attributes.brandPreference = applianceBrand;
      attributes.brand = applianceBrand;
    }
  }

  if (categoryId === "health") {
    if (normalized.includes("tekerlekli sandalye")) {
      attributes.healthProductType = "Hasta bakım ekipmanı";
      attributes.productName = "Tekerlekli sandalye";
    } else if (
      normalized.includes("hasta yatağı") ||
      normalized.includes("hasta yatagi")
    ) {
      attributes.healthProductType = "Hasta bakım ekipmanı";
      attributes.productName = "Hasta yatağı";
    } else if (
      normalized.includes("tansiyon") ||
      normalized.includes("stetoskop") ||
      normalized.includes("oksijen")
    ) {
      attributes.healthProductType = "Medikal cihaz";
    } else if (
      normalized.includes("maske") ||
      normalized.includes("eldiven") ||
      normalized.includes("dezenfektan")
    ) {
      attributes.healthProductType = "Sarf malzeme";
    } else if (normalized.includes("diş") || normalized.includes("dis ")) {
      attributes.healthProductType = "Diş / laboratuvar";
    } else if (normalized.includes("medikal") || normalized.includes("tıbbi")) {
      attributes.healthProductType = "Medikal cihaz";
    }

    if (normalized.includes("hastane")) attributes.usageArea = "Hastane";
    else if (normalized.includes("klinik")) attributes.usageArea = "Klinik";
    else if (normalized.includes("eczane")) attributes.usageArea = "Eczane";
    else if (normalized.includes("evde") || normalized.includes("ev "))
      attributes.usageArea = "Evde bakım";
  }

  if (categoryId === "baby") {
    if (
      normalized.includes("bebek arabası") ||
      normalized.includes("bebek arabasi") ||
      normalized.includes("puset")
    ) {
      attributes.babyProductType = "Bebek arabası / puset";
    } else if (normalized.includes("mama sandalyesi")) {
      attributes.babyProductType = "Mama sandalyesi";
    } else if (
      normalized.includes("beşik") ||
      normalized.includes("besik") ||
      normalized.includes("park yatak")
    ) {
      attributes.babyProductType = "Beşik / park yatak";
    } else if (normalized.includes("bebek bezi")) {
      attributes.babyProductType = "Bebek bezi / bakım";
    } else if (
      normalized.includes("mama") ||
      normalized.includes("biberon") ||
      normalized.includes("emzik")
    ) {
      attributes.babyProductType = "Beslenme ürünleri";
    }

    if (normalized.includes("yenidoğan") || normalized.includes("yenidogan")) {
      attributes.ageRange = "0–6 ay";
    }

    const babyBrand = findBrand(text, BABY_BRANDS);
    if (babyBrand) attributes.brandPreference = babyBrand;
  }

  if (categoryId === "home-kitchen") {
    if (normalized.includes("kahve seti")) {
      attributes.kitchenProductType = "Kahve seti";
    } else if (
      normalized.includes("çay seti") ||
      normalized.includes("cay seti")
    ) {
      attributes.kitchenProductType = "Çay seti";
    } else if (
      normalized.includes("yemek takımı") ||
      normalized.includes("yemek takimi") ||
      normalized.includes("tabak") ||
      normalized.includes("çanak") ||
      normalized.includes("canak")
    ) {
      attributes.kitchenProductType = "Yemek / tabak takımı";
    } else if (
      normalized.includes("çatal") ||
      normalized.includes("catal") ||
      normalized.includes("bıçak") ||
      normalized.includes("bicak") ||
      normalized.includes("kaşık") ||
      normalized.includes("kasik")
    ) {
      attributes.kitchenProductType = "Çatal-bıçak takımı";
    } else if (normalized.includes("bardak") || normalized.includes("kadeh")) {
      attributes.kitchenProductType = "Bardak / kadeh";
    } else if (normalized.includes("tepsi") || normalized.includes("servis")) {
      attributes.kitchenProductType = "Servis / tepsi";
    }

    if (normalized.includes("porselen")) attributes.material = "Porselen";
    else if (normalized.includes("cam")) attributes.material = "Cam";
    else if (normalized.includes("seramik")) attributes.material = "Seramik";
    else if (normalized.includes("çelik") || normalized.includes("celik"))
      attributes.material = "Çelik";

    if (normalized.includes("restoran") || normalized.includes("kafe")) {
      attributes.usageArea = "Kafe / restoran";
    } else if (normalized.includes("otel")) {
      attributes.usageArea = "Otel";
    } else if (normalized.includes("hediye") || normalized.includes("kurumsal")) {
      attributes.usageArea = "Hediye / kurumsal";
    } else {
      attributes.usageArea = attributes.usageArea || "Ev";
    }

    const pieceMatch = normalized.match(/(\d+)\s*(kişilik|kisilik|parça|parca)/i);
    if (pieceMatch) {
      attributes.pieceCount = `${pieceMatch[1]} ${pieceMatch[2]}`;
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
