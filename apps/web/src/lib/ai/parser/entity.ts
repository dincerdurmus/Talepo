import {
  findProvinceAndDistrictInText,
  formatRealEstateCity,
  textMentionsPlace,
} from "@/lib/geo/turkey-districts";
import {
  APPLIANCE_BRANDS,
  AUTOMOTIVE_BRANDS,
  BABY_BRANDS,
  findAutomotiveModel,
  findBrand,
  MACHINERY_BRANDS,
  findTechnologyProduct,
  TECHNOLOGY_BRANDS,
} from "./brand-catalog";

const CITIES: Array<{ name: string; aliases?: string[] }> = [
  { name: "İstanbul", aliases: ["istanbul", "ıstanbul"] },
  { name: "Ankara" },
  { name: "İzmir", aliases: ["izmir"] },
  { name: "Bursa" },
  { name: "Antalya" },
  { name: "Adana" },
  { name: "Konya" },
  { name: "Gaziantep" },
  { name: "Kocaeli" },
  { name: "Mersin" },
];

export function detectCity(text: string) {
  // Major metros first so short district tokens (e.g. "Of" in "ofis") never win.
  const metro = CITIES.find(
    (item) =>
      textMentionsPlace(text, item.name) ||
      item.aliases?.some((alias) => textMentionsPlace(text, alias)),
  )?.name;
  if (metro) {
    const fromGeo = findProvinceAndDistrictInText(text);
    if (fromGeo?.il === metro && fromGeo.ilce) {
      return formatRealEstateCity(fromGeo.il, fromGeo.ilce);
    }
    return metro;
  }

  const fromGeo = findProvinceAndDistrictInText(text);
  if (fromGeo?.il && fromGeo.ilce) {
    return formatRealEstateCity(fromGeo.il, fromGeo.ilce);
  }
  if (fromGeo?.il) return fromGeo.il;

  return undefined;
}

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

export function detectDeliveryDays(text: string, categoryId: string) {
  if (!DELIVERY_CATEGORIES.has(categoryId)) return undefined;

  const match = text.match(/(\d+)\s*(gün|hafta)/i);
  if (!match) return undefined;

  const amount = Number(match[1]);
  return match[2].toLocaleLowerCase("tr-TR") === "hafta"
    ? amount * 7
    : amount;
}

export {
  detectBudget,
  extractBudgetFromText,
  type DetectedBudget,
} from "./budget";

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

    const wantsTire = /\b(lastik|lastiği|lastigi|jant|stepne)\b/i.test(text);

    const wantsService =
      normalized.includes("periyodik bakım") ||
      normalized.includes("yağ değişimi") ||
      normalized.includes("yag degisimi") ||
      normalized.includes("bakım yaptır") ||
      normalized.includes("bakim yaptir") ||
      normalized.includes("ppf") ||
      normalized.includes("kaplama") ||
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
      attributes.tireItemType = normalized.includes("jant") ? "Jant" : "Lastik";
      if (!attributes.part) {
        attributes.part = normalized.includes("jant") ? "jant" : "lastik";
      }
    } else if (!rejectsPart && wantsPartExplicitly) {
      attributes.needType = "part";
    } else if (!rejectsPart && wantsService) {
      attributes.needType = "service";
      if (normalized.includes("periyodik")) {
        attributes.serviceType = "Periyodik bakım";
      } else if (normalized.includes("yağ") || normalized.includes("yag")) {
        attributes.serviceType = "Yağ değişimi";
      } else if (normalized.includes("ppf") || normalized.includes("kaplama")) {
        attributes.serviceType = "Koruma filmi / kaplama";
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
    const machineryBrand = findBrand(text, MACHINERY_BRANDS);
    if (machineryBrand) attributes.brand = machineryBrand;

    const isUsedMachine =
      normalized.includes("ikinci el") ||
      /\b2\s*\.?\s*el\b/u.test(normalized) ||
      normalized.includes("second hand");
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
    if (partSignals.some((item) => normalized.includes(item))) {
      attributes.needType = "part";
      const part = partSignals.find((item) => normalized.includes(item));
      if (part && !part.includes("yedek")) attributes.part = part;
    } else {
      attributes.needType = "machine";
    }

    if (isUsedMachine && attributes.needType === "machine") {
      attributes.condition = "İkinci el";
    }

    if (attributes.needType === "part") {
      if (
        normalized.includes("orijinal") ||
        normalized.includes("orjinal")
      ) {
        attributes.partPreference = "Orijinal";
      } else if (normalized.includes("muadil")) {
        attributes.partPreference = "Muadil";
      }
    }

    if (
      normalized.includes("mini ekskavatör") ||
      normalized.includes("mini ekskavator") ||
      normalized.includes("mini excavator")
    ) {
      attributes.machineType = "Mini ekskavatör";
    } else if (
      normalized.includes("ekskavatör") ||
      normalized.includes("ekskavator") ||
      normalized.includes("excavator")
    ) {
      attributes.machineType = "Ekskavatör";
    } else if (
      normalized.includes("yükleyici") ||
      normalized.includes("yukleyici") ||
      normalized.includes("loder") ||
      normalized.includes("loader")
    ) {
      attributes.machineType = "Yükleyici (loder)";
    } else if (
      normalized.includes("beton santrali") ||
      normalized.includes("hazır beton santrali") ||
      normalized.includes("hazir beton santrali")
    ) {
      attributes.machineType = "Beton Santrali";
    } else if (
      normalized.includes("beton pompası") ||
      normalized.includes("beton pompasi")
    ) {
      attributes.machineType = "Beton Pompası";
    } else if (
      normalized.includes("kule vinç") ||
      normalized.includes("kule vinc") ||
      normalized.includes("tower crane")
    ) {
      attributes.machineType = "Kule Vinç";
    } else if (
      normalized.includes("mobil vinç") ||
      normalized.includes("mobil vinc") ||
      normalized.includes("mobile crane")
    ) {
      attributes.machineType = "Mobil Vinç";
    } else if (
      normalized.includes("kompaktör") ||
      normalized.includes("kompaktor") ||
      normalized.includes("road roller") ||
      normalized.includes("silindir")
    ) {
      attributes.machineType = "Silindir (kompaktör)";
    } else if (
      normalized.includes("ağaç yonga") ||
      normalized.includes("agac yonga") ||
      normalized.includes("dal öğütücü") ||
      normalized.includes("dal ogutucu") ||
      normalized.includes("wood chipper")
    ) {
      attributes.machineType = "Ağaç yonga makinesi";
    } else if (
      normalized.includes("arazi ölçümü") ||
      normalized.includes("arazi olcumu") ||
      normalized.includes("gnss") ||
      normalized.includes("gps rtk") ||
      normalized.includes("total station") ||
      normalized.includes("teodolit") ||
      normalized.includes("nivelman")
    ) {
      attributes.machineType = "Arazi ölçüm cihazı";
    } else if (
      normalized.includes("traktör") ||
      normalized.includes("traktor") ||
      normalized.includes("tractor")
    ) {
      attributes.machineType = "Traktör";
    } else if (
      normalized.includes("balya makinesi") ||
      normalized.includes("balya") ||
      normalized.includes("baler")
    ) {
      attributes.machineType = "Balya makinesi";
    } else if (
      normalized.includes("mibzer") ||
      normalized.includes("ekim makinesi") ||
      normalized.includes("pnömatik ekim") ||
      normalized.includes("pnomatik ekim") ||
      normalized.includes("seeder")
    ) {
      attributes.machineType = "Ekim makinesi (mibzer)";
    } else if (
      normalized.includes("pulluk") ||
      normalized.includes("plow")
    ) {
      attributes.machineType = "Pulluk";
    } else if (
      normalized.includes("süt sağım") ||
      normalized.includes("sut sagim") ||
      normalized.includes("milking machine")
    ) {
      attributes.machineType = "Süt sağım makinesi";
    } else if (
      normalized.includes("yem karma") ||
      normalized.includes("yem mikseri") ||
      normalized.includes("feed mixer")
    ) {
      attributes.machineType = "Yem karma makinesi";
    } else if (
      normalized.includes("jeneratör") ||
      normalized.includes("jenerator") ||
      normalized.includes("generator")
    ) {
      attributes.machineType = "Jeneratör";
      if (normalized.includes("dizel")) {
        attributes.generatorFuel = "Dizel";
      } else if (normalized.includes("benzin")) {
        attributes.generatorFuel = "Benzin";
      } else if (
        normalized.includes("lpg") ||
        normalized.includes("doğalgaz") ||
        normalized.includes("dogalgaz")
      ) {
        attributes.generatorFuel = "LPG / doğalgaz";
      }
    } else if (
      normalized.includes("shrink paketleme") ||
      normalized.includes("shrink tunnel") ||
      normalized.includes("paketleme hattı") ||
      normalized.includes("paketleme hatti") ||
      normalized.includes("flowpack") ||
      normalized.includes("yatay paketleme") ||
      normalized.includes("dikey form-fill-seal") ||
      normalized.includes("vffs") ||
      normalized.includes("karton doldurma") ||
      normalized.includes("cartoner") ||
      normalized.includes("palet streç") ||
      normalized.includes("palet strec") ||
      normalized.includes("pallet wrapper") ||
      normalized.includes("etiketleme makinesi") ||
      normalized.includes("labeler") ||
      normalized.includes("dolum makinesi") ||
      normalized.includes("dozaj makinesi") ||
      normalized.includes("kapak kapama") ||
      normalized.includes("capper")
    ) {
      attributes.machineType = "Paketleme makinesi";
    } else if (
      normalized.includes("lazer kesim") ||
      normalized.includes("fiber lazer") ||
      normalized.includes("laser cutter") ||
      normalized.includes("plazma kesim") ||
      normalized.includes("oksijen kesim") ||
      normalized.includes("su jeti") ||
      normalized.includes("waterjet") ||
      normalized.includes("giyotin kesim") ||
      normalized.includes("şerit testere") ||
      normalized.includes("serit testere") ||
      normalized.includes("disk testere") ||
      normalized.includes("cnc router") ||
      normalized.includes("ahşap kesim") ||
      normalized.includes("ahsap kesim")
    ) {
      attributes.machineType = "Kesim teknolojisi";
    } else if (
      normalized.includes("cnc") ||
      normalized.includes("torna") ||
      normalized.includes("freze") ||
      normalized.includes("işleme merkezi") ||
      normalized.includes("isleme merkezi") ||
      normalized.includes("taşlama") ||
      normalized.includes("taslama") ||
      normalized.includes("elektroerozyon") ||
      normalized.includes("edm")
    ) {
      attributes.machineType = "CNC / talaşlı imalat";
    } else if (
      /(^|[^\p{L}\p{N}])pres(?=[^\p{L}\p{N}]|$)/u.test(normalized) ||
      normalized.includes("press") ||
      normalized.includes("abkant") ||
      normalized.includes("giyotin") ||
      normalized.includes("punç") ||
      normalized.includes("punc")
    ) {
      attributes.machineType = "Pres / şekillendirme";
    } else if (
      normalized.includes("plastik enjeksiyon") ||
      normalized.includes("enjeksiyon makinesi") ||
      normalized.includes("şişirme makinesi") ||
      normalized.includes("sisirme makinesi") ||
      normalized.includes("ekstruder") ||
      normalized.includes("extruder")
    ) {
      attributes.machineType = "Plastik enjeksiyon / ekstrüzyon";
    } else if (
      normalized.includes("mig") ||
      normalized.includes("mıg") ||
      normalized.includes("mag") ||
      normalized.includes("gazaltı") ||
      normalized.includes("gazalti") ||
      normalized.includes("tig") ||
      normalized.includes("tıg") ||
      normalized.includes("spot kaynak") ||
      normalized.includes("robot kaynak")
    ) {
      attributes.machineType = "Kaynak / birleştirme";
    } else if (
      normalized.includes("kompresör") ||
      normalized.includes("kompresor") ||
      normalized.includes("vakum pompası") ||
      normalized.includes("vakum pompasi") ||
      normalized.includes("chiller") ||
      normalized.includes("soğutma grubu") ||
      normalized.includes("sogutma grubu")
    ) {
      attributes.machineType = "Kompresör / akışkan sistemi";
    } else if (
      normalized.includes("forklift") ||
      normalized.includes("reach truck") ||
      normalized.includes("transpalet") ||
      normalized.includes("vinç") ||
      normalized.includes("vinc") ||
      normalized.includes("monoray") ||
      normalized.includes("konveyör") ||
      normalized.includes("konveyor")
    ) {
      attributes.machineType = "Taşıma / istifleme";
    }

    if (isUsedMachine && typeof attributes.machineType === "string") {
      attributes.machineType = `2. el ${attributes.machineType}`;
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
    // Canonical names must match taxonomy / explore filters
    if (normalized.includes("buzdolab") || normalized.includes("buzdolabı")) {
      attributes.applianceType = "Buzdolabı";
    } else if (
      normalized.includes("çamaşır kurutma") ||
      normalized.includes("camasir kurutma") ||
      normalized.includes("kurutma makinesi")
    ) {
      attributes.applianceType = "Çamaşır Kurutma Makinesi";
    } else if (
      normalized.includes("çamaşır makinesi") ||
      normalized.includes("camasir makinesi")
    ) {
      attributes.applianceType = "Çamaşır Makinesi";
    } else if (
      normalized.includes("bulaşık makinesi") ||
      normalized.includes("bulasik makinesi")
    ) {
      attributes.applianceType = "Bulaşık Makinesi";
    } else if (normalized.includes("klima")) {
      attributes.applianceType = "Klima";
    } else if (
      normalized.includes("mikrodalga") ||
      normalized.includes("mikro dalga")
    ) {
      attributes.applianceType = "Mikrodalga Fırın";
    } else if (normalized.includes("fırın") || normalized.includes("firin")) {
      attributes.applianceType = "Fırın";
    } else if (normalized.includes("set üstü") || normalized.includes("ocak")) {
      attributes.applianceType = "Set Üstü Ocak";
    } else if (
      normalized.includes("davlumbaz") ||
      normalized.includes("aspiratör") ||
      normalized.includes("aspirator")
    ) {
      attributes.applianceType = "Aspiratör & Davlumbaz";
    } else if (normalized.includes("derin dondurucu")) {
      attributes.applianceType = "Derin Dondurucu";
    } else if (
      normalized.includes("şarap dolabı") ||
      normalized.includes("sarap dolabi")
    ) {
      attributes.applianceType = "Şarap Dolabı";
    } else if (
      normalized.includes("süpürge") ||
      normalized.includes("supurge")
    ) {
      attributes.applianceType = "Elektrikli Süpürge";
    } else if (normalized.includes("airfryer") || normalized.includes("fritöz")) {
      attributes.applianceType = "Fritöz & Airfryer";
    } else if (normalized.includes("ütü") || normalized.includes("utu")) {
      attributes.applianceType = "Ütü";
    } else if (normalized.includes("kombi")) {
      attributes.applianceType = "Kombi";
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
      attributes.brand = applianceBrand;
      // Legacy dual-write for older price/alert consumers
      attributes.brandPreference = applianceBrand;
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
      normalized.includes("emniyet kilit") ||
      normalized.includes("güvenlik kilit") ||
      normalized.includes("guvenlik kilit") ||
      normalized.includes("güvenlik çit") ||
      normalized.includes("guvenlik cit") ||
      normalized.includes("güvenlik kayış") ||
      normalized.includes("guvenlik kayis") ||
      normalized.includes("bebek kapı") ||
      normalized.includes("bebek kapi") ||
      normalized.includes("bebek izleme cihaz") ||
      normalized.includes("bebek izleme cihazi")
    ) {
      attributes.babyProductType = "Bebek güvenlik ürünü";
    } else if (
      normalized.includes("bebek monitör") ||
      normalized.includes("bebek monitor") ||
      normalized.includes("oyun parkı") ||
      normalized.includes("oyun parki") ||
      normalized.includes("activity gym") ||
      normalized.includes("bebek tekstil")
    ) {
      attributes.babyProductType = "Diğer bebek ürünü";
    } else if (
      normalized.includes("akülü araba") ||
      normalized.includes("akulu araba") ||
      normalized.includes("yürüteç") ||
      normalized.includes("yurutec") ||
      normalized.includes("salıncak") ||
      normalized.includes("salincak") ||
      normalized.includes("oyun halısı") ||
      normalized.includes("oyun halisi") ||
      normalized.includes("üç teker") ||
      normalized.includes("uc teker") ||
      normalized.includes("scooter") ||
      normalized.includes("hoppala") ||
      normalized.includes("dönence") ||
      normalized.includes("donence") ||
      normalized.includes("itmeli oyuncak") ||
      normalized.includes("çekmeli oyuncak") ||
      normalized.includes("cekmeli oyuncak")
    ) {
      attributes.babyProductType = "Oyun / gezi ürünü";
    } else if (
      normalized.includes("oyuncak") ||
      normalized.includes("robotik") ||
      normalized.includes("uzaktan kumandalı") ||
      normalized.includes("uzaktan kumandali") ||
      normalized.includes("yapı oyuncağı") ||
      normalized.includes("yapi oyuncagi") ||
      normalized.includes("top havuzu")
    ) {
      attributes.babyProductType = "Oyuncak";
    } else if (
      normalized.includes("bez saklama") ||
      normalized.includes("atık yönetimi") ||
      normalized.includes("atik yonetimi") ||
      normalized.includes("bebek bezi kutu") ||
      normalized.includes("bebek bezi çöp") ||
      normalized.includes("bebek bezi cop") ||
      normalized.includes("kirli bebek bezi çanta") ||
      normalized.includes("kirli bebek bezi canta")
    ) {
      attributes.babyProductType = "Bez saklama / atık yönetimi";
    } else if (
      normalized.includes("ıslak mendil") ||
      normalized.includes("islak mendil") ||
      normalized.includes("pişik") ||
      normalized.includes("pisik")
    ) {
      attributes.babyProductType = "Islak mendil / pişik bakımı";
    } else if (
      normalized.includes("alt açma") ||
      normalized.includes("alt acma") ||
      normalized.includes("alt alma") ||
      normalized.includes("alt değiştirme") ||
      normalized.includes("alt degistirme") ||
      normalized.includes("bez değiştirme") ||
      normalized.includes("bez degistirme")
    ) {
      attributes.babyProductType = "Bebek bezi / alt değiştirme";
    } else if (
      normalized.includes("bebek küvet") ||
      normalized.includes("bebek kuvet") ||
      normalized.includes("banyo küvet") ||
      normalized.includes("banyo kuvet") ||
      normalized.includes("banyo tabure") ||
      normalized.includes("banyo şapka") ||
      normalized.includes("banyo sapka")
    ) {
      attributes.babyProductType = "Bebek banyo ürünü";
    } else if (
      normalized.includes("ateş ölçer") ||
      normalized.includes("ates olcer") ||
      normalized.includes("tırnak makası") ||
      normalized.includes("tirnak makasi") ||
      normalized.includes("burun aspiratör") ||
      normalized.includes("burun aspirator") ||
      normalized.includes("bebek sağlık seti") ||
      normalized.includes("bebek saglik seti") ||
      normalized.includes("bebek bakım seti") ||
      normalized.includes("bebek bakim seti")
    ) {
      attributes.babyProductType = "Bebek sağlık / bakım ürünü";
    } else if (
      normalized.includes("emzik mendil") ||
      normalized.includes("emzik klips") ||
      normalized.includes("emzik tutucu")
    ) {
      attributes.babyProductType = "Emzik aksesuarı / temizliği";
    } else if (
      normalized.includes("lazımlık") ||
      normalized.includes("lazimlik") ||
      normalized.includes("tuvalet eğitimi") ||
      normalized.includes("tuvalet egitimi")
    ) {
      attributes.babyProductType = "Lazımlık / tuvalet eğitimi";
    } else if (
      normalized.includes("oto koltuğu aksesuar") ||
      normalized.includes("oto koltugu aksesuar")
    ) {
      attributes.babyProductType = "Oto koltuğu aksesuarı";
    } else if (
      normalized.includes("bebek arabası aksesuar") ||
      normalized.includes("bebek arabasi aksesuar") ||
      normalized.includes("puset aksesuar") ||
      normalized.includes("bebek arabası örtü") ||
      normalized.includes("bebek arabasi ortu") ||
      normalized.includes("bebek arabası tulum") ||
      normalized.includes("bebek arabasi tulum") ||
      normalized.includes("bebek arabası yağmurluk") ||
      normalized.includes("bebek arabasi yagmurluk") ||
      normalized.includes("bebek arabası yağmurlu") ||
      normalized.includes("bebek arabasi yagmurlu") ||
      normalized.includes("puset yağmurluk") ||
      normalized.includes("puset yagmurluk") ||
      normalized.includes("puset yağmurlu") ||
      normalized.includes("puset yagmurlu") ||
      normalized.includes("puset ayak tulumu") ||
      normalized.includes("alışveriş arabası kılıf") ||
      normalized.includes("alisveris arabasi kilif") ||
      normalized.includes("mama sandalyesi kılıf") ||
      normalized.includes("mama sandalyesi kilif")
    ) {
      attributes.babyProductType = "Bebek arabası aksesuarı";
    } else if (
      normalized.includes("kanguru aksesuar") ||
      normalized.includes("bebek taşıyıcı aksesuar") ||
      normalized.includes("bebek tasiyici aksesuar")
    ) {
      attributes.babyProductType = "Kanguru aksesuarı";
    } else if (
      normalized.includes("kanguru") ||
      normalized.includes("bebek taşıyıcı") ||
      normalized.includes("bebek tasiyici") ||
      normalized.includes("baby carrier")
    ) {
      attributes.babyProductType = "Kanguru / bebek taşıyıcı";
    } else if (
      normalized.includes("portbebe") || normalized.includes("carrycot")
    ) {
      attributes.babyProductType = "Portbebe";
    } else if (
      normalized.includes("bebek arabası") ||
      normalized.includes("bebek arabasi") ||
      normalized.includes("puset")
    ) {
      attributes.babyProductType = "Bebek arabası / puset";
    } else if (
      normalized.includes("oto koltuğu") ||
      normalized.includes("oto koltugu") ||
      normalized.includes("ana kucağı") ||
      normalized.includes("ana kucagi") ||
      normalized.includes("yükseltici") ||
      normalized.includes("yukseltici")
    ) {
      attributes.babyProductType = "Oto koltuğu / ana kucağı";
    } else if (normalized.includes("mama sandalyesi")) {
      attributes.babyProductType = "Mama sandalyesi";
    } else if (
      normalized.includes("sterilizatör") ||
      normalized.includes("sterilizator") ||
      normalized.includes("mama ısıtıcı") ||
      normalized.includes("mama isitici") ||
      normalized.includes("mama hazırlama") ||
      normalized.includes("mama hazirlama") ||
      normalized.includes("biberon ısıtıcı") ||
      normalized.includes("biberon isitici")
    ) {
      attributes.babyProductType = "Sterilizatör / mama hazırlama";
    } else if (
      normalized.includes("göğüs pompası") ||
      normalized.includes("gogus pompasi") ||
      normalized.includes("anne sütü depolama") ||
      normalized.includes("anne sutu depolama") ||
      normalized.includes("emzirme yastığı") ||
      normalized.includes("emzirme yastigi") ||
      normalized.includes("emzirme önlüğü") ||
      normalized.includes("emzirme onlugu")
    ) {
      attributes.babyProductType = "Göğüs pompası / süt saklama";
    } else if (
      normalized.includes("biberon") ||
      normalized.includes("alıştırma bardağı") ||
      normalized.includes("alistirma bardagi") ||
      normalized.includes("suluk")
    ) {
      attributes.babyProductType = "Biberon / suluk";
    } else if (
      normalized.includes("emzik") ||
      normalized.includes("diş kaşıyıcı") ||
      normalized.includes("dis kasiyici")
    ) {
      attributes.babyProductType = "Emzik / diş kaşıyıcı";
    } else if (
      normalized.includes("bebek odası mobilya") ||
      normalized.includes("bebek odasi mobilya") ||
      normalized.includes("bebek odası seti") ||
      normalized.includes("bebek odasi seti")
    ) {
      attributes.babyProductType = "Bebek odası mobilyası";
    } else if (
      normalized.includes("uyku tulumu") ||
      normalized.includes("sleeping bag")
    ) {
      attributes.babyProductType = "Uyku tulumu";
    } else if (
      normalized.includes("bebek battaniye") ||
      normalized.includes("kundak")
    ) {
      attributes.babyProductType = "Bebek battaniyesi / kundak";
    } else if (
      normalized.includes("yatak koruyucu") ||
      normalized.includes("bebek nest") ||
      normalized.includes("uyku nest")
    ) {
      attributes.babyProductType = "Yatak koruyucu / nest";
    } else if (
      normalized.includes("beşik") ||
      normalized.includes("besik") ||
      normalized.includes("park yatak")
    ) {
      attributes.babyProductType = "Beşik / park yatak";
    } else if (normalized.includes("bebek bezi")) {
      attributes.babyProductType = "Bebek bezi / bakım";
    } else if (
      normalized.includes("bebek gıdası") ||
      normalized.includes("bebek gidasi") ||
      normalized.includes("çocuk gıdası") ||
      normalized.includes("cocuk gidasi") ||
      normalized.includes("püre") ||
      normalized.includes("pure") ||
      normalized.includes("atıştırmalık") ||
      normalized.includes("atistirmalik")
    ) {
      attributes.babyProductType = "Bebek / çocuk gıdası";
    } else if (normalized.includes("mama")) {
      attributes.babyProductType = "Bebek / çocuk gıdası";
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

    if (normalized.includes("yalı dairesi") || normalized.includes("yali dairesi")) {
      attributes.propertyType = "Yalı Dairesi";
    } else if (normalized.includes("çiftlik evi") || normalized.includes("ciftlik evi")) {
      attributes.propertyType = "Çiftlik Evi";
    } else if (normalized.includes("müstakil") || normalized.includes("mustakil")) {
      attributes.propertyType = "Müstakil Ev";
    } else if (normalized.includes("villa")) attributes.propertyType = "Villa";
    else if (normalized.includes("köşk") || normalized.includes("kosk")) {
      attributes.propertyType = "Köşk & Konak";
    } else if (normalized.includes("yalı") || normalized.includes("yali")) {
      attributes.propertyType = "Yalı";
    }
    else if (normalized.includes("stüdyo") || normalized.includes("studyo"))
      attributes.propertyType = "Stüdyo";
    else if (normalized.includes("dubleks")) attributes.propertyType = "Dubleks";
    else if (normalized.includes("rezidans") || normalized.includes("residans"))
      attributes.propertyType = "Rezidans";
    else if (normalized.includes("devre mülk") || normalized.includes("devre mulk")) {
      attributes.propertyType = "Devre mülk";
    } else if (normalized.includes("devren işyeri") || normalized.includes("devren isyeri")) {
      attributes.propertyType = "Devren işyeri";
    } else if (normalized.includes("müştemilat") || normalized.includes("mustemilat")) {
      attributes.propertyType = "Müştemilat";
    } else if (normalized.includes("kooperatif hissesi")) {
      attributes.propertyType = "Kooperatif hissesi";
    } else if (normalized.includes("turistik tesis")) {
      attributes.propertyType = "Turistik tesis";
    }
    else if (normalized.includes("plaza ofisi")) {
      attributes.propertyType = "Plaza ofisi";
    } else if (normalized.includes("dükkan") || normalized.includes("dukkan") || normalized.includes("mağaza") || normalized.includes("magaza")) {
      attributes.propertyType = "Dükkan / mağaza";
    } else if (normalized.includes("depo") || normalized.includes("antrepo")) {
      attributes.propertyType = "Depo / antrepo";
    } else if (normalized.includes("fabrika") || normalized.includes("imalathane")) {
      attributes.propertyType = "Fabrika / imalathane";
    } else if (normalized.includes("avm ünitesi") || normalized.includes("avm unitesi")) {
      attributes.propertyType = "AVM ünitesi";
    } else if (
      normalized.includes("otel") ||
      /(?:öğrenci|ogrenci)\s+apart\b|\bapart\s*otel\b/i.test(normalized)
    ) {
      attributes.propertyType = "Otel / apart";
    } else if (normalized.includes("ofis")) {
      attributes.propertyType = "Ofis";
    }
    else if (normalized.includes("konut imarlı arsa") || normalized.includes("konut imarli arsa")) {
      attributes.propertyType = "Konut imarlı arsa";
    } else if (normalized.includes("ticari arsa")) {
      attributes.propertyType = "Ticari arsa";
    } else if (normalized.includes("sanayi arsası") || normalized.includes("sanayi arsasi")) {
      attributes.propertyType = "Sanayi arsası";
    } else if (normalized.includes("imarlı arsa") || normalized.includes("imarli arsa")) {
      attributes.propertyType = "İmarlı arsa";
    } else if (normalized.includes("tarla")) {
      attributes.propertyType = "Tarla";
    } else if (normalized.includes("arsa")) attributes.propertyType = "Arsa";
    else if (
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
      const geoMatch = findProvinceAndDistrictInText(text);
      if (geoMatch?.ilce) {
        attributes.location = geoMatch.ilce;
      }
    }

    const floorMatch = text.match(/(\d+)\s*\/\s*(\d+)\s*kat/i);
    if (floorMatch) attributes.floor = `${floorMatch[1]} / ${floorMatch[2]}`;

    const detachedResidentialTypes = new Set([
      "Müstakil Ev",
      "Villa",
      "Çiftlik Evi",
      "Köşk & Konak",
      "Yalı",
    ]);
    const totalFloorsMatch = text.match(/\b(\d+)\s*katlı(?=\s|$|[.,;!?])/i);
    if (
      totalFloorsMatch &&
      detachedResidentialTypes.has(String(attributes.propertyType ?? ""))
    ) {
      attributes.totalFloors = Number(totalFloorsMatch[1]);
    }

    const ageMatch = text.match(/(\d{1,2})\s*yıllık/i);
    if (ageMatch) attributes.buildingAge = Number(ageMatch[1]);
    if (/\b(sıfır|sifir|yeni)\s+(bina|yapı|yapi|ev|konut|daire|villa|mülk|mulk)\b/i.test(text)) {
      attributes.newBuildPreference = "Yeni bina şart";
    }
  }

  return attributes;
}
