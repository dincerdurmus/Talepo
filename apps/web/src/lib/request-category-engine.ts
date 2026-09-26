import {
  APPLIANCE_BRANDS,
  AUTOMOTIVE_BRANDS,
  automotiveModelKeywordList,
  BABY_BRANDS,
  brandKeywordList,
  findAutomotiveModel,
  findBrand,
  FURNITURE_BRANDS,
  TECHNOLOGY_BRANDS,
} from "@/lib/ai/parser/brand-catalog";
import { findProvinceAndDistrictInText } from "@/lib/geo/turkey-districts";
import { resolveBrowseSemanticRole } from "@/lib/request-composer/browse-semantic-role";
import { resolveTaxonomyAlias } from "@/lib/taxonomy/registry";

export type DynamicFieldType = "text" | "number" | "select";

/**
 * A measurement is a category contract, not a field-name convention.
 * The same `dimensions` storage key may mean a paper format or a physical
 * object size; the declared contract is the sole UI decision source.
 */
export type MeasurementKind = "print_format" | "physical_dimensions";
export type MeasurementAxis = "width" | "height" | "depth";
export type MeasurementContract = {
  kind: MeasurementKind;
  example: string;
  unit?: "mm" | "cm" | "inch";
  axes?: MeasurementAxis[];
  variants?: Array<{
    whenProductTypes: string[];
    kind: MeasurementKind;
    example: string;
    unit?: "mm" | "cm" | "inch";
    axes?: MeasurementAxis[];
  }>;
};

/**
 * Ürün türüne göre soru sözleşmesi. Bu, alan adından tahmin yürütmek yerine
 * kategorinin hangi ürününde hangi detayların sorulabileceğini açıkça tanımlar.
 * `allowedCandidateFieldKeys` özellikle çıkarım katmanından gelen ilgisiz soru
 * adaylarını süzer; ortak yayın soruları ayrı çekirdekten gelmeye devam eder.
 */
export type ProductQuestionContractQuestion = {
  fieldKey: string;
  prompt: string;
  summaryLabel: string;
  importance: "publish_required" | "routing_critical" | "quote_critical" | "optional";
  quickChoices?: DynamicFieldOption[];
  allowUnknown?: boolean;
  allowDontCare?: boolean;
  inputHint?: "text" | "select" | "budget" | "location" | "number";
  rank?: number;
};

export type ProductQuestionContract = {
  whenProductTypes?: string[];
  whenNeedTypes?: string[];
  /** A parent product's purchasing questions do not describe its part or repair. */
  excludeNeedTypes?: string[];
  allowedCandidateFieldKeys: string[];
  /**
   * Dar ailelerde standart kategori profillerini de bu sözleşmenin anahtar
   * listesiyle sınırla. Global yayın soruları (bütçe/konum/zaman) bundan
   * etkilenmez; yalnız marka/model gibi ek hızlı sorular gizlenir.
   */
  restrictStandardProfiles?: boolean;
  /** Omit the shared time question when this flow does not request it. */
  omitDeliveryQuestion?: boolean;
  /** Product-owned controls such as physical dimensions. */
  measurementContracts?: Record<string, MeasurementContract>;
  questions: ProductQuestionContractQuestion[];
};

/** Keep the existing shared/identity questions when the requested object is a
 * component. This declares no new questions; product specifications stay with
 * the whole-product contracts instead of leaking through their parent names. */
const COMPONENT_QUESTION_CONTRACT: ProductQuestionContract = {
  whenNeedTypes: ["part", "accessory"],
  restrictStandardProfiles: true,
  allowedCandidateFieldKeys: [
    "brand", "model", "condition", "quantity", "city", "delivery", "budget",
  ],
  questions: [],
};

const GENERIC_APPLIANCE_PRODUCT_CONTRACT: ProductQuestionContract = {
  restrictStandardProfiles: true,
  allowedCandidateFieldKeys: [
    "brand", "model", "condition", "quantity", "city", "delivery", "budget",
    // Existing product-scoped detail profiles; component/service contracts
    // remain separate and publication still requires only budget/location.
    "vacuumType", "usageArea", "ovenType", "coffeeType",
  ],
  questions: [],
};

const GENERIC_BABY_PRODUCT_CONTRACT: ProductQuestionContract = {
  restrictStandardProfiles: true,
  allowedCandidateFieldKeys: [
    "brand", "model", "condition", "quantity", "city", "delivery", "budget",
  ],
  questions: [],
};

const PRODUCT_SERVICE_QUESTION_CONTRACT: ProductQuestionContract = {
  whenNeedTypes: ["service"],
  restrictStandardProfiles: true,
  allowedCandidateFieldKeys: ["serviceType", "brand", "model", "city", "delivery", "budget"],
  questions: [],
};

const NON_PURCHASE_NEED_TYPES = ["part", "accessory", "service"];

export type DynamicFieldOption = {
  label: string;
  value: string;
};

const FURNITURE_COMMON_CANDIDATE_KEYS = [
  "furnitureType",
  "usageArea",
  "dimensions",
  "material",
  "color",
  "features",
  "condition",
  "assembly",
  "quantity",
  "city",
  "delivery",
  "budget",
];

const FURNITURE_PRODUCT_QUESTION_CONTRACTS: ProductQuestionContract[] = [
  COMPONENT_QUESTION_CONTRACT,
  {
    whenProductTypes: [
      "makam odası",
      "makam odasi",
      "makam",
      "yönetici masa",
      "yonetici masa",
    ],
    allowedCandidateFieldKeys: [
      ...FURNITURE_COMMON_CANDIDATE_KEYS,
      "executiveDeskConfiguration",
      "cableManagement",
    ],
    questions: [
      {
        fieldKey: "executiveDeskConfiguration",
        prompt: "Nasıl bir yönetici masa takımı arıyorsunuz?",
        summaryLabel: "Takım içeriği",
        importance: "quote_critical",
        rank: 66,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Tek yönetici masası", value: "Tek masa" },
          { label: "Masa + etajer", value: "Masa + etajer" },
          { label: "Masa + dolap / kitaplık", value: "Masa + dolap" },
          { label: "Komple takım", value: "Komple takım" },
        ],
      },
      {
        fieldKey: "cableManagement",
        prompt: "Kablo kanalı veya masa üstü priz modülü gerekli mi?",
        summaryLabel: "Kablo / priz çözümü",
        importance: "optional",
        rank: 36,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Gerekli", value: "Gerekli" },
          { label: "Gerekli değil", value: "Gerekli değil" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["toplantı masası", "toplanti masasi"],
    allowedCandidateFieldKeys: [
      ...FURNITURE_COMMON_CANDIDATE_KEYS,
      "meetingCapacity",
      "meetingTableShape",
    ],
    questions: [
      {
        fieldKey: "meetingCapacity",
        prompt: "Kaç kişilik toplantı masası gerekli?",
        summaryLabel: "Kapasite",
        importance: "quote_critical",
        rank: 66,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "4–6 kişilik", value: "4-6" },
          { label: "8 kişilik", value: "8" },
          { label: "10–12 kişilik", value: "10-12" },
          { label: "14+ kişilik", value: "14+" },
        ],
      },
      {
        fieldKey: "meetingTableShape",
        prompt: "Masa formu için bir tercihiniz var mı?",
        summaryLabel: "Masa formu",
        importance: "optional",
        rank: 36,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Dikdörtgen", value: "Dikdörtgen" },
          { label: "Oval", value: "Oval" },
          { label: "Yuvarlak", value: "Yuvarlak" },
          { label: "U düzeni", value: "U düzeni" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "ofis sandalyesi",
      "ofis koltuğu",
      "ofis koltugu",
      "büro sandalyesi",
      "buro sandalyesi",
      "yönetici koltuğu",
      "yonetici koltugu",
    ],
    allowedCandidateFieldKeys: [
      ...FURNITURE_COMMON_CANDIDATE_KEYS,
      "officeChairMechanism",
      "officeChairErgonomics",
    ],
    questions: [
      {
        fieldKey: "officeChairMechanism",
        prompt: "Mekanizma tercihiniz var mı?",
        summaryLabel: "Mekanizma",
        importance: "quote_critical",
        rank: 66,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Senkron mekanizma", value: "Senkron" },
          { label: "Tilt mekanizma", value: "Tilt" },
          { label: "Sabit / mekanizmasız", value: "Sabit" },
        ],
      },
      {
        fieldKey: "officeChairErgonomics",
        prompt: "Öncelikli ergonomi özelliğiniz nedir?",
        summaryLabel: "Ergonomi",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Bel destekli", value: "Bel destekli" },
          { label: "Başlıklı", value: "Başlıklı" },
          { label: "Ayarlanabilir kolçaklı", value: "Ayarlanabilir kolçaklı" },
          { label: "Temel kullanım", value: "Temel kullanım" },
        ],
      },
    ],
  },
];

const APPLIANCE_COMMON_CANDIDATE_KEYS = [
  "applianceType",
  "usageArea",
  "brand",
  "energyClass",
  "features",
  "condition",
  "installation",
  "dimensions",
  "quantity",
  "city",
  "delivery",
  "budget",
];

const APPLIANCE_PRODUCT_QUESTION_CONTRACTS: ProductQuestionContract[] = [
  COMPONENT_QUESTION_CONTRACT,
  PRODUCT_SERVICE_QUESTION_CONTRACT,
  GENERIC_APPLIANCE_PRODUCT_CONTRACT,
  {
    whenProductTypes: ["buzdolabı", "buzdolabi"],
    excludeNeedTypes: NON_PURCHASE_NEED_TYPES,
    allowedCandidateFieldKeys: [
      ...APPLIANCE_COMMON_CANDIDATE_KEYS,
      "fridgeType",
      "fridgeCapacity",
      "fridgeCoolingSystem",
    ],
    measurementContracts: {
      dimensions: {
        kind: "physical_dimensions",
        axes: ["width", "depth", "height"],
        unit: "cm",
        example: "75 × 70 × 185 cm",
      },
    },
    questions: [
      {
        fieldKey: "fridgeType",
        prompt: "Nasıl bir buzdolabı arıyorsunuz?",
        summaryLabel: "Buzdolabı tipi",
        importance: "quote_critical",
        rank: 70,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Alttan donduruculu", value: "Alttan donduruculu" },
          { label: "Üstten donduruculu", value: "Üstten donduruculu" },
          { label: "Gardrop tipi", value: "Gardrop tipi" },
          { label: "Mini / ofis tipi", value: "Mini" },
        ],
      },
      {
        fieldKey: "fridgeCapacity",
        prompt: "Yaklaşık hangi net hacim aralığı gerekli?",
        summaryLabel: "Net hacim",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "200–300 litre", value: "200-300 L" },
          { label: "300–400 litre", value: "300-400 L" },
          { label: "400–500 litre", value: "400-500 L" },
          { label: "500 litre ve üzeri", value: "500+ L" },
        ],
      },
      {
        fieldKey: "fridgeCoolingSystem",
        prompt: "Soğutma sistemi tercihiniz var mı?",
        summaryLabel: "Soğutma sistemi",
        importance: "optional",
        rank: 42,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "No-Frost", value: "No-Frost" },
          { label: "Statik", value: "Statik" },
        ],
      },
      {
        fieldKey: "energyClass",
        prompt: "Enerji sınıfı için bir tercihiniz var mı?",
        summaryLabel: "Enerji sınıfı",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "A", value: "A" },
          { label: "B", value: "B" },
          { label: "C", value: "C" },
          { label: "D ve altı", value: "D ve altı" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["çamaşır makinesi", "camasir makinesi"],
    excludeNeedTypes: NON_PURCHASE_NEED_TYPES,
    allowedCandidateFieldKeys: [
      ...APPLIANCE_COMMON_CANDIDATE_KEYS,
      "capacityKg",
      "washerLoadType",
      "washerDryFeature",
      "spinSpeed",
    ],
    measurementContracts: {
      dimensions: {
        kind: "physical_dimensions",
        axes: ["width", "depth", "height"],
        unit: "cm",
        example: "60 × 60 × 85 cm",
      },
    },
    questions: [
      {
        fieldKey: "capacityKg",
        prompt: "Kaç kilogram kapasite gerekli?",
        summaryLabel: "Kapasite",
        importance: "quote_critical",
        rank: 70,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "7 kg", value: "7 kg" },
          { label: "8 kg", value: "8 kg" },
          { label: "9 kg", value: "9 kg" },
          { label: "10 kg", value: "10 kg" },
          { label: "12 kg ve üzeri", value: "12+ kg" },
        ],
      },
      {
        fieldKey: "washerDryFeature",
        prompt: "Kurutma özelliği gerekli mi?",
        summaryLabel: "Kurutma özelliği",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Sadece çamaşır makinesi", value: "Sadece çamaşır" },
          { label: "Kurutmalı çamaşır makinesi", value: "Kurutmalı" },
        ],
      },
      {
        fieldKey: "washerLoadType",
        prompt: "Yükleme tipi için tercihiniz var mı?",
        summaryLabel: "Yükleme tipi",
        importance: "optional",
        rank: 42,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Önden yüklemeli", value: "Önden yüklemeli" },
          { label: "Üstten yüklemeli", value: "Üstten yüklemeli" },
        ],
      },
      {
        fieldKey: "spinSpeed",
        prompt: "Sıkma devri için bir tercihiniz var mı?",
        summaryLabel: "Sıkma devri",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "1.000 devir", value: "1000 rpm" },
          { label: "1.200 devir", value: "1200 rpm" },
          { label: "1.400 devir", value: "1400 rpm" },
          { label: "1.600 devir ve üzeri", value: "1600+ rpm" },
        ],
      },
      {
        fieldKey: "energyClass",
        prompt: "Enerji sınıfı için bir tercihiniz var mı?",
        summaryLabel: "Enerji sınıfı",
        importance: "optional",
        rank: 38,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "A", value: "A" },
          { label: "B", value: "B" },
          { label: "C", value: "C" },
          { label: "D ve altı", value: "D ve altı" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["klima"],
    excludeNeedTypes: NON_PURCHASE_NEED_TYPES,
    allowedCandidateFieldKeys: [
      ...APPLIANCE_COMMON_CANDIDATE_KEYS,
      "airConditionerType",
      "capacityBtu",
      "climateRoomSize",
      "inverterPreference",
      "heatingFunction",
    ],
    measurementContracts: {
      dimensions: {
        kind: "physical_dimensions",
        axes: ["width", "depth", "height"],
        unit: "cm",
        example: "90 × 23 × 30 cm (iç ünite)",
      },
    },
    questions: [
      {
        fieldKey: "airConditionerType",
        prompt: "Hangi klima tipini arıyorsunuz?",
        summaryLabel: "Klima tipi",
        importance: "quote_critical",
        rank: 72,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Duvar tipi split", value: "Split" },
          { label: "Salon tipi", value: "Salon tipi" },
          { label: "Portatif", value: "Portatif" },
        ],
      },
      {
        fieldKey: "capacityBtu",
        prompt: "Kaç BTU olmalı?",
        summaryLabel: "BTU",
        importance: "quote_critical",
        rank: 70,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "9.000 BTU", value: "9000 BTU" },
          { label: "12.000 BTU", value: "12000 BTU" },
          { label: "18.000 BTU", value: "18000 BTU" },
          { label: "24.000 BTU", value: "24000 BTU" },
        ],
      },
      {
        fieldKey: "climateRoomSize",
        prompt: "Yaklaşık kaç metrekarelik alan için?",
        summaryLabel: "Alan büyüklüğü",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "10–15 m²", value: "10-15 m²" },
          { label: "16–25 m²", value: "16-25 m²" },
          { label: "26–35 m²", value: "26-35 m²" },
          { label: "36 m² ve üzeri", value: "36+ m²" },
        ],
      },
      {
        fieldKey: "inverterPreference",
        prompt: "Inverter özelliği gerekli mi?",
        summaryLabel: "Inverter",
        importance: "optional",
        rank: 42,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Inverter olsun", value: "Inverter" },
          { label: "Inverter olmasa da olur", value: "Inverter değil" },
        ],
      },
      {
        fieldKey: "heatingFunction",
        prompt: "Isıtma fonksiyonu da gerekli mi?",
        summaryLabel: "Isıtma",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Isıtma + soğutma", value: "Isıtma + soğutma" },
          { label: "Sadece soğutma", value: "Sadece soğutma" },
        ],
      },
      {
        fieldKey: "energyClass",
        prompt: "Enerji sınıfı için bir tercihiniz var mı?",
        summaryLabel: "Enerji sınıfı",
        importance: "optional",
        rank: 38,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "A", value: "A" },
          { label: "B", value: "B" },
          { label: "C", value: "C" },
          { label: "D ve altı", value: "D ve altı" },
        ],
      },
      {
        fieldKey: "installation",
        prompt: "Montaj da dahil olsun mu?",
        summaryLabel: "Montaj",
        importance: "optional",
        rank: 36,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Montaj dahil", value: "Montaj dahil" },
          { label: "Sadece ürün", value: "Sadece ürün" },
        ],
      },
    ],
  },
];

/**
 * Donanım ürünlerinde ortak kalan ticari bilgiler. Ürüne özgü teknik sorular
 * aşağıdaki sözleşmelerde yaşar; örneğin TV için RAM veya telefon için ekran
 * kartı adayının görünmesine izin verilmez.
 */
const TECHNOLOGY_COMMON_CANDIDATE_KEYS = [
  "needType",
  "solutionType",
  "brand",
  "model",
  "condition",
  "warranty",
  "specs",
  "quantity",
  "city",
  "delivery",
  "budget",
];

const TECHNOLOGY_PRODUCT_QUESTION_CONTRACTS: ProductQuestionContract[] = [
  COMPONENT_QUESTION_CONTRACT,
  PRODUCT_SERVICE_QUESTION_CONTRACT,
  /**
   * YAZILIM / WEB PROJESİ KENDİ SÖZLEŞMESİYLE SORULUR (kurucu, 2026-09-12).
   *
   * Ölçüldü: "Kurumsal web sitesi yaptırmak istiyorum" için marka, adet,
   * ürün durumu ve model soruluyordu; donanım profilleri yazılım akışına
   * sızıyordu. Bu sözleşme donanım sorularını kapatır, yazılımın kendi dört
   * sorusunu seçenekli sorar. Konum sorusu küresel çekirdekten hizmet
   * diliyle gelir ve "Uzaktan" kaçışı açıktır; bütçe ve zaman aynen kalır.
   */
  {
    whenNeedTypes: ["software"],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      "needType",
      "solutionType",
      "platform",
      "userCount",
      "integration",
      "support",
      "city",
      "budget",
      "delivery",
    ],
    questions: [
      {
        fieldKey: "platform",
        prompt: "Hangi platformda çalışacak?",
        summaryLabel: "Platform",
        importance: "quote_critical",
        rank: 74,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "Web", value: "Web" },
          { label: "iOS", value: "iOS" },
          { label: "Android", value: "Android" },
          { label: "Masaüstü", value: "Masaüstü" },
          { label: "Çoklu platform", value: "Çoklu platform" },
        ],
      },
      {
        fieldKey: "userCount",
        prompt: "Yaklaşık kaç kullanıcı olacak?",
        summaryLabel: "Kullanıcı sayısı",
        importance: "optional",
        rank: 60,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "1-10", value: "1-10" },
          { label: "10-100", value: "10-100" },
          { label: "100-1000", value: "100-1000" },
          { label: "1000+", value: "1000+" },
        ],
      },
      {
        fieldKey: "integration",
        prompt: "Bağlanması gereken bir sistem var mı?",
        summaryLabel: "Entegrasyon",
        importance: "optional",
        rank: 55,
        inputHint: "select",
        allowUnknown: true,
        allowDontCare: true,
        quickChoices: [
          { label: "Yok", value: "Yok" },
          { label: "ERP / muhasebe", value: "ERP / muhasebe" },
          { label: "Ödeme sistemi", value: "Ödeme sistemi" },
          { label: "Kargo", value: "Kargo" },
          { label: "Pazaryeri", value: "Pazaryeri" },
        ],
      },
      {
        fieldKey: "support",
        prompt: "Teslim sonrası bakım ve destek gerekli mi?",
        summaryLabel: "Bakım ve destek",
        importance: "optional",
        rank: 50,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "Gerekli", value: "Gerekli" },
          { label: "Gerekli değil", value: "Gerekli değil" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["hardware"],
    whenProductTypes: ["televizyon", "tv", "monitor", "monitör"],
    allowedCandidateFieldKeys: [
      ...TECHNOLOGY_COMMON_CANDIDATE_KEYS,
      "screenSize",
      "panelType",
      "resolution",
      "refreshRate",
    ],
    questions: [
      {
        fieldKey: "screenSize",
        prompt: "Kaç inç ekran arıyorsunuz?",
        summaryLabel: "Ekran boyutu",
        importance: "quote_critical",
        rank: 70,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "32 inç", value: "32" },
          { label: "43 inç", value: "43" },
          { label: "50 inç", value: "50" },
          { label: "55 inç", value: "55" },
          { label: "65 inç ve üzeri", value: "65+" },
        ],
      },
      {
        fieldKey: "resolution",
        prompt: "Çözünürlük tercihiniz var mı?",
        summaryLabel: "Çözünürlük",
        importance: "quote_critical",
        rank: 66,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Full HD", value: "Full HD" },
          { label: "4K UHD", value: "4K UHD" },
          { label: "8K", value: "8K" },
        ],
      },
      {
        fieldKey: "panelType",
        prompt: "Panel teknolojisi tercihiniz var mı?",
        summaryLabel: "Panel",
        importance: "optional",
        rank: 42,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "OLED", value: "OLED" },
          { label: "QLED", value: "QLED" },
          { label: "Mini LED", value: "Mini LED" },
          { label: "LED", value: "LED" },
        ],
      },
      {
        fieldKey: "refreshRate",
        prompt: "Yenileme hızı için tercihiniz var mı?",
        summaryLabel: "Yenileme hızı",
        importance: "optional",
        rank: 38,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "60 Hz", value: "60 Hz" },
          { label: "120 Hz", value: "120 Hz" },
          { label: "144 Hz ve üzeri", value: "144+ Hz" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["hardware"],
    whenProductTypes: ["laptop", "notebook", "macbook", "dizüstü", "dizustu"],
    allowedCandidateFieldKeys: [
      ...TECHNOLOGY_COMMON_CANDIDATE_KEYS,
      "usagePurpose",
      "processor",
      "ram",
      "storage",
      "graphics",
      "screenSize",
    ],
    questions: [
      {
        fieldKey: "usagePurpose",
        prompt: "Laptopu öncelikle ne için kullanacaksınız?",
        summaryLabel: "Kullanım amacı",
        importance: "quote_critical",
        rank: 72,
        inputHint: "select",
        allowDontCare: false,
        quickChoices: [
          { label: "İş / ofis", value: "İş / ofis" },
          { label: "Okul", value: "Okul" },
          { label: "Yazılım / profesyonel", value: "Profesyonel" },
          { label: "Oyun", value: "Oyun" },
          { label: "Günlük kullanım", value: "Günlük" },
        ],
      },
      {
        fieldKey: "processor",
        prompt: "İşlemci için bir tercihiniz var mı?",
        summaryLabel: "İşlemci",
        importance: "quote_critical",
        rank: 66,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Apple M serisi", value: "Apple M serisi" },
          { label: "Intel Core i5 / Ultra 5", value: "Intel Core i5 / Ultra 5" },
          { label: "Intel Core i7 / Ultra 7", value: "Intel Core i7 / Ultra 7" },
          { label: "AMD Ryzen 5", value: "AMD Ryzen 5" },
          { label: "AMD Ryzen 7", value: "AMD Ryzen 7" },
        ],
      },
      {
        fieldKey: "ram",
        prompt: "Ne kadar RAM gerekli?",
        summaryLabel: "RAM",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "8 GB", value: "8 GB" },
          { label: "16 GB", value: "16 GB" },
          { label: "32 GB", value: "32 GB" },
          { label: "64 GB ve üzeri", value: "64+ GB" },
        ],
      },
      {
        fieldKey: "storage",
        prompt: "Depolama kapasitesi ne olsun?",
        summaryLabel: "Depolama",
        importance: "quote_critical",
        rank: 62,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "256 GB SSD", value: "256 GB SSD" },
          { label: "512 GB SSD", value: "512 GB SSD" },
          { label: "1 TB SSD", value: "1 TB SSD" },
          { label: "2 TB ve üzeri", value: "2 TB+" },
        ],
      },
      {
        fieldKey: "screenSize",
        prompt: "Ekran boyutu tercihiniz var mı?",
        summaryLabel: "Ekran boyutu",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "13–14 inç", value: "13-14" },
          { label: "15–16 inç", value: "15-16" },
          { label: "17 inç ve üzeri", value: "17+" },
        ],
      },
      {
        fieldKey: "graphics",
        prompt: "Harici ekran kartı gerekli mi?",
        summaryLabel: "Ekran kartı",
        importance: "optional",
        rank: 36,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Gerekli değil", value: "Gerekli değil" },
          { label: "RTX 4050 / eşdeğeri", value: "RTX 4050" },
          { label: "RTX 4060 / eşdeğeri", value: "RTX 4060" },
          { label: "RTX 4070 ve üzeri", value: "RTX 4070+" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["hardware"],
    whenProductTypes: [
      "masaüstü",
      "masaustu",
      "desktop",
      "oyun bilgisayarı",
      "oyun bilgisayari",
      "gaming pc",
      "bilgisayar",
      "pc",
    ],
    allowedCandidateFieldKeys: [
      ...TECHNOLOGY_COMMON_CANDIDATE_KEYS,
      "usagePurpose",
      "processor",
      "ram",
      "storage",
      "graphics",
    ],
    questions: [
      {
        fieldKey: "usagePurpose",
        prompt: "Bilgisayarı öncelikle ne için kullanacaksınız?",
        summaryLabel: "Kullanım amacı",
        importance: "quote_critical",
        rank: 72,
        inputHint: "select",
        allowDontCare: false,
        quickChoices: [
          { label: "İş / ofis", value: "İş / ofis" },
          { label: "Yazılım / profesyonel", value: "Profesyonel" },
          { label: "Oyun", value: "Oyun" },
          { label: "Tasarım / video", value: "Tasarım / video" },
          { label: "Günlük kullanım", value: "Günlük" },
        ],
      },
      {
        fieldKey: "processor",
        prompt: "İşlemci için bir tercihiniz var mı?",
        summaryLabel: "İşlemci",
        importance: "quote_critical",
        rank: 66,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Intel Core i5 / Ultra 5", value: "Intel Core i5 / Ultra 5" },
          { label: "Intel Core i7 / Ultra 7", value: "Intel Core i7 / Ultra 7" },
          { label: "Intel Core i9 / Ultra 9", value: "Intel Core i9 / Ultra 9" },
          { label: "AMD Ryzen 5", value: "AMD Ryzen 5" },
          { label: "AMD Ryzen 7", value: "AMD Ryzen 7" },
        ],
      },
      {
        fieldKey: "ram",
        prompt: "Ne kadar RAM gerekli?",
        summaryLabel: "RAM",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "16 GB", value: "16 GB" },
          { label: "32 GB", value: "32 GB" },
          { label: "64 GB", value: "64 GB" },
          { label: "128 GB ve üzeri", value: "128+ GB" },
        ],
      },
      {
        fieldKey: "storage",
        prompt: "Depolama kapasitesi ne olsun?",
        summaryLabel: "Depolama",
        importance: "quote_critical",
        rank: 62,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "512 GB SSD", value: "512 GB SSD" },
          { label: "1 TB SSD", value: "1 TB SSD" },
          { label: "2 TB SSD", value: "2 TB SSD" },
          { label: "4 TB ve üzeri", value: "4 TB+" },
        ],
      },
      {
        fieldKey: "graphics",
        prompt: "Ekran kartı için bir tercihiniz var mı?",
        summaryLabel: "Ekran kartı",
        importance: "quote_critical",
        rank: 60,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Dahili grafik yeterli", value: "Dahili grafik" },
          { label: "RTX 4060 / eşdeğeri", value: "RTX 4060" },
          { label: "RTX 4070 / eşdeğeri", value: "RTX 4070" },
          { label: "RTX 4080 ve üzeri", value: "RTX 4080+" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["hardware"],
    whenProductTypes: [
      "telefon",
      "iphone",
      "akıllı telefon",
      "akilli telefon",
      "smartphone",
    ],
    allowedCandidateFieldKeys: [
      ...TECHNOLOGY_COMMON_CANDIDATE_KEYS,
      "storageCapacity",
      "mobileNetwork",
      "cameraPriority",
    ],
    questions: [
      {
        fieldKey: "storageCapacity",
        prompt: "Depolama kapasitesi ne olsun?",
        summaryLabel: "Depolama",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "128 GB", value: "128 GB" },
          { label: "256 GB", value: "256 GB" },
          { label: "512 GB", value: "512 GB" },
          { label: "1 TB", value: "1 TB" },
        ],
      },
      {
        fieldKey: "mobileNetwork",
        prompt: "5G desteği gerekli mi?",
        summaryLabel: "Mobil bağlantı",
        importance: "optional",
        rank: 42,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "5G gerekli", value: "5G gerekli" },
          { label: "4.5G yeterli", value: "4.5G yeterli" },
        ],
      },
      {
        fieldKey: "cameraPriority",
        prompt: "Kamera performansı önceliğiniz mi?",
        summaryLabel: "Kamera önceliği",
        importance: "optional",
        rank: 38,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Öncelikli", value: "Öncelikli" },
          { label: "Temel kullanım yeterli", value: "Temel kullanım" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["hardware"],
    whenProductTypes: ["tablet", "ipad"],
    allowedCandidateFieldKeys: [
      ...TECHNOLOGY_COMMON_CANDIDATE_KEYS,
      "storageCapacity",
      "tabletConnectivity",
      "tabletAccessory",
    ],
    questions: [
      {
        fieldKey: "storageCapacity",
        prompt: "Depolama kapasitesi ne olsun?",
        summaryLabel: "Depolama",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "64 GB", value: "64 GB" },
          { label: "128 GB", value: "128 GB" },
          { label: "256 GB", value: "256 GB" },
          { label: "512 GB ve üzeri", value: "512 GB+" },
        ],
      },
      {
        fieldKey: "tabletConnectivity",
        prompt: "Bağlantı tipi tercihiniz var mı?",
        summaryLabel: "Bağlantı",
        importance: "optional",
        rank: 42,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Wi‑Fi", value: "Wi‑Fi" },
          { label: "Wi‑Fi + hücresel", value: "Wi‑Fi + hücresel" },
        ],
      },
      {
        fieldKey: "tabletAccessory",
        prompt: "Klavye veya kalem desteği gerekli mi?",
        summaryLabel: "Aksesuar uyumu",
        importance: "optional",
        rank: 38,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Kalem desteği gerekli", value: "Kalem desteği" },
          { label: "Klavye desteği gerekli", value: "Klavye desteği" },
          { label: "İkisi de gerekli", value: "Kalem + klavye" },
          { label: "Gerekli değil", value: "Gerekli değil" },
        ],
      },
    ],
  },
];

/**
 * Anne & Çocuk ürünleri için ortak ticari çekirdek. Ürün ailesinin kendine
 * ait güvenlik, kullanım ve uyumluluk soruları aşağıdaki sözleşmelerde
 * yaşar; böylece pusetin ISOFIX, oto koltuğunun da katlanma sorusu alması
 * engellenir.
 */
const BABY_COMMON_CANDIDATE_KEYS = [
  "babyProductType",
  "ageRange",
  "brandPreference",
  "brand",
  "condition",
  "quantity",
  "city",
  "delivery",
  "budget",
];

const BABY_PRODUCT_QUESTION_CONTRACTS: ProductQuestionContract[] = [
  COMPONENT_QUESTION_CONTRACT,
  GENERIC_BABY_PRODUCT_CONTRACT,
  {
    excludeNeedTypes: NON_PURCHASE_NEED_TYPES,
    whenProductTypes: [
      "bebek arabası",
      "bebek arabasi",
      "puset",
      "travel sistem",
      "baston bebek arabası",
      "baston bebek arabasi",
      "cep tipi",
      "cabin boy",
      "ikiz bebek arabası",
      "ikiz bebek arabasi",
      "jogger",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "strollerType",
      "strollerUseCase",
      "strollerFoldPreference",
    ],
    questions: [
      {
        fieldKey: "strollerType",
        prompt: "Nasıl bir bebek arabası arıyorsunuz?",
        summaryLabel: "Araba tipi",
        importance: "quote_critical",
        rank: 70,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Travel sistem", value: "Travel sistem" },
          { label: "Baston puset", value: "Baston" },
          { label: "Cabin boy / kompakt", value: "Cabin boy" },
          { label: "İkiz arabası", value: "İkiz" },
        ],
      },
      {
        fieldKey: "strollerUseCase",
        prompt: "En çok hangi kullanım için gerekli?",
        summaryLabel: "Kullanım senaryosu",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Günlük şehir kullanımı", value: "Şehir" },
          { label: "Seyahat / kabin bagajı", value: "Seyahat" },
          { label: "Arazi / uzun yürüyüş", value: "Arazi" },
          { label: "Koşu", value: "Koşu" },
        ],
      },
      {
        fieldKey: "strollerFoldPreference",
        prompt: "Katlanma / taşıma beklentiniz nedir?",
        summaryLabel: "Katlanma",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Tek elle katlansın", value: "Tek elle" },
          { label: "Çok kompakt kapansın", value: "Kompakt" },
          { label: "Bagajda az yer kaplasın", value: "Bagaj dostu" },
        ],
      },
    ],
  },
  {
    excludeNeedTypes: NON_PURCHASE_NEED_TYPES,
    whenProductTypes: [
      "oto koltuğu",
      "oto koltugu",
      "ana kucağı",
      "ana kucagi",
      "yükseltici",
      "yukseltici",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "carSeatGroup",
      "carSeatMount",
      "carSeatDirection",
    ],
    questions: [
      {
        fieldKey: "carSeatGroup",
        prompt: "Hangi kilo grubu için gerekli?",
        summaryLabel: "Kilo grubu",
        importance: "quote_critical",
        rank: 70,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "0–13 kg (bebek)", value: "0-13 kg" },
          { label: "9–18 kg", value: "9-18 kg" },
          { label: "15–36 kg (yükseltici)", value: "15-36 kg" },
        ],
      },
      {
        fieldKey: "carSeatMount",
        prompt: "Araçta hangi sabitleme sistemi kullanılacak?",
        summaryLabel: "Sabitleme",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "ISOFIX", value: "ISOFIX" },
          { label: "Araç kemeri", value: "Araç kemeri" },
          { label: "Her ikisi de uyumlu olsun", value: "ISOFIX / kemer" },
        ],
      },
      {
        fieldKey: "carSeatDirection",
        prompt: "Kullanım yönü tercihiniz var mı?",
        summaryLabel: "Kullanım yönü",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Geriye dönük", value: "Geriye dönük" },
          { label: "Öne dönük", value: "Öne dönük" },
          { label: "Çift yönlü", value: "Çift yönlü" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "kanguru aksesuar",
      "kanguru aksesuari",
      "bebek taşıyıcı aksesuar",
      "bebek tasiyici aksesuar",
      "baby carrier accessory",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "carrierAccessoryType",
      "carrierAccessoryCompatibility",
    ],
    questions: [
      {
        fieldKey: "carrierAccessoryType",
        prompt: "Hangi kanguru / bebek taşıyıcı aksesuarı gerekli?",
        summaryLabel: "Aksesuar tipi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Baş / boyun desteği", value: "Baş / boyun desteği" },
          { label: "Yağmur / hava koruması", value: "Hava koruması" },
          { label: "Bel desteği / kemer", value: "Bel desteği" },
          { label: "Yedek parça", value: "Yedek parça" },
        ],
      },
      {
        fieldKey: "carrierAccessoryCompatibility",
        prompt: "Uyumlu olması gereken kanguru marka / modeli var mı?",
        summaryLabel: "Marka / model uyumu",
        importance: "quote_critical",
        rank: 64,
        inputHint: "text",
        allowUnknown: true,
      },
    ],
  },
  {
    whenProductTypes: [
      "kanguru",
      "bebek taşıyıcı",
      "bebek tasiyici",
      "baby carrier",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "carrierAgeWeightRange",
      "carrierCarryPosition",
      "carrierErgonomicSupport",
    ],
    questions: [
      {
        fieldKey: "carrierAgeWeightRange",
        prompt: "Hangi yaş / kilo aralığı için taşıyıcı gerekli?",
        summaryLabel: "Yaş / kilo aralığı",
        importance: "quote_critical",
        rank: 70,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "Yenidoğan (0+ ay)", value: "Yenidoğan" },
          { label: "3–9 ay", value: "3-9 ay" },
          { label: "9 ay ve üzeri", value: "9+ ay" },
          { label: "20 kg'a kadar", value: "20 kg'a kadar" },
        ],
      },
      {
        fieldKey: "carrierCarryPosition",
        prompt: "Hangi taşıma pozisyonu gerekli?",
        summaryLabel: "Taşıma pozisyonu",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Ön içe dönük", value: "Ön içe dönük" },
          { label: "Ön dışa dönük", value: "Ön dışa dönük" },
          { label: "Sırtta taşıma", value: "Sırtta" },
          { label: "Kalçada taşıma", value: "Kalçada" },
        ],
      },
      {
        fieldKey: "carrierErgonomicSupport",
        prompt: "Öncelikli ergonomi / destek tercihiniz nedir?",
        summaryLabel: "Ergonomi / destek",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Ergonomik oturma paneli", value: "Ergonomik panel" },
          { label: "Bel desteği", value: "Bel desteği" },
          { label: "Ayarlanabilir baş desteği", value: "Baş desteği" },
          { label: "Nefes alan kumaş", value: "Nefes alan kumaş" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["portbebe", "carrycot"],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "carrycotUseCase",
      "carrycotCompatibility",
      "carrycotFeature",
    ],
    questions: [
      {
        fieldKey: "carrycotUseCase",
        prompt: "Portbebe nasıl kullanılacak?",
        summaryLabel: "Kullanım tipi",
        importance: "quote_critical",
        rank: 70,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Bebek arabasına takılacak", value: "Bebek arabası uyumlu" },
          { label: "Tek başına taşımak için", value: "Bağımsız taşıma" },
          { label: "Seyahat / kısa süreli uyku", value: "Seyahat" },
        ],
      },
      {
        fieldKey: "carrycotCompatibility",
        prompt: "Uyumlu olması gereken bebek arabası marka / modeli var mı?",
        summaryLabel: "Marka / model uyumu",
        importance: "quote_critical",
        rank: 64,
        inputHint: "text",
        allowUnknown: true,
      },
      {
        fieldKey: "carrycotFeature",
        prompt: "Öncelikli taşıma / koruma özelliğiniz nedir?",
        summaryLabel: "Kullanım özelliği",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Sert tabanlı", value: "Sert taban" },
          { label: "Tenteli", value: "Tenteli" },
          { label: "Havalandırmalı", value: "Havalandırmalı" },
          { label: "Katlanabilir", value: "Katlanabilir" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "bebek arabası aksesuar",
      "bebek arabasi aksesuar",
      "bebek arabası örtü",
      "bebek arabasi ortu",
      "bebek arabası tulum",
      "bebek arabasi tulum",
      "alışveriş arabası kılıf",
      "alisveris arabasi kilif",
      "mama sandalyesi kılıf",
      "mama sandalyesi kilif",
      "stroller accessory",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "strollerAccessoryType",
      "strollerAccessoryCompatibility",
      "strollerAccessoryWeatherUse",
    ],
    questions: [
      {
        fieldKey: "strollerAccessoryType",
        prompt: "Hangi bebek arabası aksesuarı gerekli?",
        summaryLabel: "Aksesuar tipi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Yağmurluk / sineklik", value: "Koruyucu örtü" },
          { label: "Ayak tulumu / kışlık örtü", value: "Ayak tulumu" },
          { label: "Çanta / düzenleyici", value: "Düzenleyici" },
          { label: "Adaptör / bağlantı parçası", value: "Adaptör" },
        ],
      },
      {
        fieldKey: "strollerAccessoryCompatibility",
        prompt: "Uyumlu olması gereken bebek arabası marka / modeli var mı?",
        summaryLabel: "Marka / model uyumu",
        importance: "quote_critical",
        rank: 64,
        inputHint: "text",
        allowUnknown: true,
      },
      {
        fieldKey: "strollerAccessoryWeatherUse",
        prompt: "Hangi kullanım koşulu için gerekli?",
        summaryLabel: "Kullanım koşulu",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Yağmur / rüzgâr", value: "Yağmur / rüzgâr" },
          { label: "Soğuk hava", value: "Soğuk hava" },
          { label: "Güneş", value: "Güneş" },
          { label: "Günlük kullanım", value: "Günlük" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "oto koltuğu aksesuar",
      "oto koltugu aksesuar",
      "bebek ve küçük çocuk oto koltuğu aksesuar",
      "bebek ve kucuk cocuk oto koltugu aksesuar",
      "car seat accessory",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "carSeatAccessoryType",
      "carSeatAccessoryCompatibility",
      "carSeatAccessoryPurpose",
    ],
    questions: [
      {
        fieldKey: "carSeatAccessoryType",
        prompt: "Hangi oto koltuğu aksesuarı gerekli?",
        summaryLabel: "Aksesuar tipi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "ISOFIX tabanı / baz", value: "ISOFIX baz" },
          { label: "Koruyucu kılıf", value: "Kılıf" },
          { label: "Araç aynası", value: "Araç aynası" },
          { label: "Güneşlik / koruyucu", value: "Güneşlik" },
        ],
      },
      {
        fieldKey: "carSeatAccessoryCompatibility",
        prompt: "Uyumlu olması gereken oto koltuğu marka / modeli var mı?",
        summaryLabel: "Marka / model uyumu",
        importance: "quote_critical",
        rank: 64,
        inputHint: "text",
        allowUnknown: true,
      },
      {
        fieldKey: "carSeatAccessoryPurpose",
        prompt: "Aksesuarın öncelikli kullanım amacı nedir?",
        summaryLabel: "Kullanım amacı",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Güvenlik / sabitleme", value: "Güvenlik" },
          { label: "Konfor", value: "Konfor" },
          { label: "Temizlik / koruma", value: "Koruma" },
          { label: "Seyahat", value: "Seyahat" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "alt açma",
      "alt acma",
      "alt alma",
      "alt değiştirme",
      "alt degistirme",
      "bez değiştirme",
      "bez degistirme",
      "bebek bezi",
      "diaper",
      "changing pad",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "diaperCareProduct",
      "diaperCareMaterial",
      "diaperCareUseCase",
    ],
    questions: [
      {
        fieldKey: "diaperCareProduct",
        prompt: "Hangi alt değiştirme / bez bakım ürünü gerekli?",
        summaryLabel: "Ürün tipi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Alt açma minderi / mat", value: "Alt açma matı" },
          { label: "Bez / bez astarı", value: "Bez / astar" },
          { label: "Örtü / kılıf", value: "Örtü / kılıf" },
          { label: "Alt alma seti", value: "Alt alma seti" },
        ],
      },
      {
        fieldKey: "diaperCareMaterial",
        prompt: "Malzeme veya kullanım tercihiniz nedir?",
        summaryLabel: "Malzeme / kullanım",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Sıvı geçirmez", value: "Sıvı geçirmez" },
          { label: "Yıkanabilir", value: "Yıkanabilir" },
          { label: "Tek kullanımlık", value: "Tek kullanımlık" },
          { label: "Pamuklu", value: "Pamuklu" },
        ],
      },
      {
        fieldKey: "diaperCareUseCase",
        prompt: "En çok hangi kullanım için gerekli?",
        summaryLabel: "Kullanım yeri",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Evde", value: "Ev" },
          { label: "Seyahatte", value: "Seyahat" },
          { label: "Bebek odasında sabit alan", value: "Sabit alan" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "bez saklama",
      "atık yönetimi",
      "atik yonetimi",
      "bebek bezi kutu",
      "bebek bezi çöp",
      "bebek bezi cop",
      "çöp kovası",
      "cop kovasi",
      "kirli bebek bezi çanta",
      "kirli bebek bezi canta",
      "diaper pail",
    ],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "model",
      "diaperDisposalProduct",
      "diaperDisposalCapacity",
      "diaperDisposalCompatibility",
    ],
    questions: [
      {
        fieldKey: "diaperDisposalProduct",
        prompt: "Hangi bez saklama / atık ürünü gerekli?",
        summaryLabel: "Ürün tipi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Bez çöp kovası", value: "Bez çöp kovası" },
          { label: "Yedek poşet / kaset", value: "Yedek poşet / kaset" },
          { label: "Kirli bez çantası", value: "Kirli bez çantası" },
          { label: "Bez saklama kutusu", value: "Saklama kutusu" },
        ],
      },
      {
        fieldKey: "diaperDisposalCapacity",
        prompt: "Kapasite tercihiniz nedir?",
        summaryLabel: "Kapasite",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Kompakt / günlük", value: "Kompakt" },
          { label: "Orta kapasite", value: "Orta" },
          { label: "Yüksek kapasite", value: "Yüksek" },
        ],
      },
      {
        fieldKey: "diaperDisposalCompatibility",
        prompt: "Uyumlu olması gereken kova veya marka / model var mı?",
        summaryLabel: "Marka / model uyumu",
        importance: "optional",
        rank: 40,
        inputHint: "text",
        allowUnknown: true,
      },
    ],
  },
  {
    whenProductTypes: [
      "ıslak mendil",
      "islak mendil",
      "mendil ısıtıcı",
      "mendil isitici",
      "mendil dispanser",
      "pişik",
      "pisik",
      "pişik tedavi",
      "pisik tedavi",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "skinCareProduct",
      "skinCareSensitivity",
      "skinCarePackSize",
    ],
    questions: [
      {
        fieldKey: "skinCareProduct",
        prompt: "Hangi cilt bakım ürünü gerekli?",
        summaryLabel: "Ürün tipi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Islak mendil", value: "Islak mendil" },
          { label: "Pişik bakım ürünü", value: "Pişik bakımı" },
          { label: "Mendil dispanseri / ısıtıcısı", value: "Mendil cihazı" },
        ],
      },
      {
        fieldKey: "skinCareSensitivity",
        prompt: "Cilt hassasiyeti veya içerik tercihiniz var mı?",
        summaryLabel: "Hassasiyet / içerik",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Hassas cilt", value: "Hassas cilt" },
          { label: "Parfümsüz", value: "Parfümsüz" },
          { label: "Alkolsüz", value: "Alkolsüz" },
          { label: "Doğal içerik", value: "Doğal içerik" },
        ],
      },
      {
        fieldKey: "skinCarePackSize",
        prompt: "Paket / set miktarı tercihiniz var mı?",
        summaryLabel: "Paket / set",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Tekli", value: "Tekli" },
          { label: "Çoklu paket", value: "Çoklu paket" },
          { label: "Ekonomik koli", value: "Ekonomik koli" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "bebek banyo",
      "bebek küvet",
      "bebek kuvet",
      "banyo küvet",
      "banyo kuvet",
      "banyo tabure",
      "banyo şapka",
      "banyo sapka",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "babyBathProduct",
      "babyBathStage",
      "babyBathFeature",
    ],
    questions: [
      {
        fieldKey: "babyBathProduct",
        prompt: "Hangi bebek banyo ürünü gerekli?",
        summaryLabel: "Banyo ürünü",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Bebek küveti", value: "Bebek küveti" },
          { label: "Küvet / banyo taburesi", value: "Banyo taburesi" },
          { label: "Banyo şapkası", value: "Banyo şapkası" },
        ],
      },
      {
        fieldKey: "babyBathStage",
        prompt: "Hangi yaş / kullanım dönemi için gerekli?",
        summaryLabel: "Kullanım dönemi",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Yenidoğan", value: "Yenidoğan" },
          { label: "0–12 ay", value: "0-12 ay" },
          { label: "1 yaş ve üzeri", value: "1+ yaş" },
        ],
      },
      {
        fieldKey: "babyBathFeature",
        prompt: "Öncelikli banyo özelliğiniz nedir?",
        summaryLabel: "Banyo özelliği",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Katlanabilir", value: "Katlanabilir" },
          { label: "Kaydırmaz", value: "Kaydırmaz" },
          { label: "Sıcaklık göstergeli", value: "Sıcaklık göstergeli" },
          { label: "Gider tıpalı", value: "Gider tıpalı" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "bebek sağlık",
      "bebek saglik",
      "ateş ölçer",
      "ates olcer",
      "thermometer",
      "tırnak makası",
      "tirnak makasi",
      "bakım seti",
      "bakim seti",
      "burun aspiratör",
      "burun aspirator",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "babyHealthProduct",
      "babyHealthOperation",
      "babyHealthFeature",
    ],
    questions: [
      {
        fieldKey: "babyHealthProduct",
        prompt: "Hangi bebek sağlık / bakım ürünü gerekli?",
        summaryLabel: "Ürün tipi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Ateş ölçer", value: "Ateş ölçer" },
          { label: "Burun aspiratörü", value: "Burun aspiratörü" },
          { label: "Tırnak / bakım seti", value: "Bakım seti" },
        ],
      },
      {
        fieldKey: "babyHealthOperation",
        prompt: "Kullanım yöntemi tercihiniz nedir?",
        summaryLabel: "Kullanım yöntemi",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Dijital / elektronik", value: "Dijital" },
          { label: "Manuel", value: "Manuel" },
          { label: "Set halinde", value: "Set" },
        ],
      },
      {
        fieldKey: "babyHealthFeature",
        prompt: "Öncelikli özellik tercihiniz nedir?",
        summaryLabel: "Öncelikli özellik",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Temassız ölçüm", value: "Temassız" },
          { label: "Yıkanabilir uç / parça", value: "Yıkanabilir" },
          { label: "Taşıma çantalı", value: "Taşıma çantası" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "emzik aksesuar",
      "emzik temiz",
      "emzik mendil",
      "emzik klips",
      "emzik tutucu",
      "pacifier accessory",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "pacifierAccessoryProduct",
      "pacifierAccessoryMaterial",
      "pacifierAccessoryFeature",
    ],
    questions: [
      {
        fieldKey: "pacifierAccessoryProduct",
        prompt: "Hangi emzik aksesuarı / temizlik ürünü gerekli?",
        summaryLabel: "Ürün tipi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Emzik klipsi / tutucu", value: "Klips / tutucu" },
          { label: "Emzik mendili", value: "Emzik mendili" },
          { label: "Saklama kutusu", value: "Saklama kutusu" },
        ],
      },
      {
        fieldKey: "pacifierAccessoryMaterial",
        prompt: "Malzeme tercihiniz nedir?",
        summaryLabel: "Malzeme",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Silikon", value: "Silikon" },
          { label: "Kumaş", value: "Kumaş" },
          { label: "Ahşap detaylı", value: "Ahşap" },
          { label: "BPA içermeyen plastik", value: "BPA içermeyen plastik" },
        ],
      },
      {
        fieldKey: "pacifierAccessoryFeature",
        prompt: "Öncelikli kullanım özelliğiniz nedir?",
        summaryLabel: "Kullanım özelliği",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Tek elle takılabilsin", value: "Tek elle" },
          { label: "Yıkanabilir", value: "Yıkanabilir" },
          { label: "Çoklu paket", value: "Çoklu paket" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "lazımlık",
      "lazimlik",
      "tuvalet eğitimi",
      "tuvalet egitimi",
      "potty",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "toiletTrainingProduct",
      "toiletTrainingStage",
      "toiletTrainingFeature",
    ],
    questions: [
      {
        fieldKey: "toiletTrainingProduct",
        prompt: "Hangi tuvalet eğitimi ürünü gerekli?",
        summaryLabel: "Ürün tipi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Lazımlık", value: "Lazımlık" },
          { label: "Klozet adaptörü", value: "Klozet adaptörü" },
          { label: "Basamaklı set", value: "Basamaklı set" },
        ],
      },
      {
        fieldKey: "toiletTrainingStage",
        prompt: "Hangi kullanım dönemi için gerekli?",
        summaryLabel: "Kullanım dönemi",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Tuvalet eğitimine başlangıç", value: "Başlangıç" },
          { label: "Bağımsız kullanım", value: "Bağımsız kullanım" },
          { label: "Seyahat", value: "Seyahat" },
        ],
      },
      {
        fieldKey: "toiletTrainingFeature",
        prompt: "Öncelikli özellik tercihiniz nedir?",
        summaryLabel: "Kullanım özelliği",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Kaydırmaz", value: "Kaydırmaz" },
          { label: "Katlanabilir", value: "Katlanabilir" },
          { label: "Müzikli / ödüllendirici", value: "Müzikli" },
          { label: "Kolay temizlenir", value: "Kolay temizlenir" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "bebek güvenlik ürünü",
      "emniyet kilit",
      "güvenlik kilit",
      "guvenlik kilit",
      "muhafaza",
      "güvenlik kayış",
      "guvenlik kayis",
      "güvenlik çit",
      "guvenlik cit",
      "bebek kapı",
      "bebek kapi",
      "evcil hayvan kapı",
      "evcil hayvan kapi",
      "bebek izleme cihaz",
      "bebek izleme cihazi",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "safetyProtectionTarget",
      "safetyInstallation",
      "safetyCompatibility",
    ],
    questions: [
      {
        fieldKey: "safetyProtectionTarget",
        prompt: "Hangi alan veya eşya için güvenlik çözümü gerekli?",
        summaryLabel: "Korunacak alan",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Dolap / çekmece", value: "Dolap / çekmece" },
          { label: "Kapı / merdiven", value: "Kapı / merdiven" },
          { label: "Oda / oyun alanı", value: "Oda / oyun alanı" },
          { label: "Bebek / çocuk taşıma güvenliği", value: "Taşıma güvenliği" },
        ],
      },
      {
        fieldKey: "safetyInstallation",
        prompt: "Montaj tercihiniz nedir?",
        summaryLabel: "Montaj tipi",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Yapışkanlı / delmeden", value: "Yapışkanlı" },
          { label: "Vidalı", value: "Vidalı" },
          { label: "Basınçla sabitlenen", value: "Basınçlı" },
          { label: "Taşınabilir", value: "Taşınabilir" },
        ],
      },
      {
        fieldKey: "safetyCompatibility",
        prompt: "Uyumlu olması gereken kapı, mobilya veya ölçü bilgisi var mı?",
        summaryLabel: "Uyumluluk",
        importance: "optional",
        rank: 40,
        inputHint: "text",
        allowUnknown: true,
      },
    ],
  },
  {
    whenProductTypes: [
      "oyun / gezi ürünü",
      "oyun ve gezi",
      "akülü araba",
      "akulu araba",
      "yürüteç",
      "yurutec",
      "salıncak",
      "salincak",
      "oyun halısı",
      "oyun halisi",
      "üç teker",
      "uc teker",
      "scooter",
      "hoppala",
      "dönence",
      "donence",
      "itme oyuncak",
      "itmeli oyuncak",
      "çekme oyuncak",
      "cekme oyuncak",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "playTravelAgeStage",
      "playTravelUseSetting",
      "playTravelFeature",
    ],
    questions: [
      {
        fieldKey: "playTravelAgeStage",
        prompt: "Hangi yaş / gelişim dönemi için gerekli?",
        summaryLabel: "Yaş / gelişim dönemi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "6–12 ay", value: "6-12 ay" },
          { label: "1–3 yaş", value: "1-3 yaş" },
          { label: "3–5 yaş", value: "3-5 yaş" },
          { label: "5+ yaş", value: "5+ yaş" },
        ],
      },
      {
        fieldKey: "playTravelUseSetting",
        prompt: "En çok hangi kullanım ortamı için gerekli?",
        summaryLabel: "Kullanım ortamı",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Ev içi", value: "Ev içi" },
          { label: "Bahçe / açık alan", value: "Açık alan" },
          { label: "Seyahat / dışarı", value: "Dışarı" },
          { label: "Fiziksel aktivite", value: "Fiziksel aktivite" },
        ],
      },
      {
        fieldKey: "playTravelFeature",
        prompt: "Hareket veya kurulum tercihiniz nedir?",
        summaryLabel: "Hareket / kurulum",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Manuel / itmeli", value: "Manuel" },
          { label: "Akülü", value: "Akülü" },
          { label: "Sabit kurulum", value: "Sabit kurulum" },
          { label: "Katlanabilir", value: "Katlanabilir" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "oyuncak",
      "eğitici",
      "egitici",
      "müzikli",
      "muzikli",
      "kurmalı",
      "kurmali",
      "figür",
      "figur",
      "yapı oyuncağı",
      "yapi oyuncagi",
      "robotik",
      "uzaktan kumandalı",
      "uzaktan kumandali",
      "oyuncak taşıt",
      "oyuncak tasit",
      "plaj ve kum",
      "sanat ve çizim",
      "sanat ve cizim",
      "top havuzu",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "toyAgeStage",
      "toyPlayTheme",
      "toyOperationFeature",
    ],
    questions: [
      {
        fieldKey: "toyAgeStage",
        prompt: "Oyuncak hangi yaş grubu için olacak?",
        summaryLabel: "Yaş grubu",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "0–12 ay", value: "0-12 ay" },
          { label: "1–3 yaş", value: "1-3 yaş" },
          { label: "3–6 yaş", value: "3-6 yaş" },
          { label: "6+ yaş", value: "6+ yaş" },
        ],
      },
      {
        fieldKey: "toyPlayTheme",
        prompt: "Hangi oyun / gelişim teması öncelikli?",
        summaryLabel: "Oyun teması",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Eğitici / gelişim", value: "Eğitici" },
          { label: "Yapı / kurma", value: "Yapı / kurma" },
          { label: "Müzik / duyusal", value: "Müzik / duyusal" },
          { label: "Taşıt / hareket", value: "Taşıt / hareket" },
          { label: "Sanat / yaratıcılık", value: "Sanat / yaratıcılık" },
        ],
      },
      {
        fieldKey: "toyOperationFeature",
        prompt: "Hareket veya enerji tercihiniz var mı?",
        summaryLabel: "Hareket / enerji",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Pilsiz / manuel", value: "Pilsiz" },
          { label: "Pilli / elektronik", value: "Pilli" },
          { label: "Uzaktan kumandalı", value: "Uzaktan kumandalı" },
          { label: "Kurmalı", value: "Kurmalı" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "diğer bebek ürünü",
      "diger bebek urunu",
      "bebek monitör",
      "bebek monitor",
      "oyun parkı",
      "oyun parki",
      "activity gym",
      "bebek tekstil",
      "bebek textil",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "otherBabyProduct",
      "otherBabyUseStage",
      "otherBabyPriority",
    ],
    questions: [
      {
        fieldKey: "otherBabyProduct",
        prompt: "Hangi bebek ürünü gerekli?",
        summaryLabel: "Ürün tipi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Bebek monitörü", value: "Bebek monitörü" },
          { label: "Oyun parkı / aktivite gym", value: "Oyun parkı / aktivite gym" },
          { label: "Bebek tekstili", value: "Bebek tekstili" },
        ],
      },
      {
        fieldKey: "otherBabyUseStage",
        prompt: "Hangi kullanım dönemi için gerekli?",
        summaryLabel: "Kullanım dönemi",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Yenidoğan", value: "Yenidoğan" },
          { label: "0–12 ay", value: "0-12 ay" },
          { label: "1 yaş ve üzeri", value: "1+ yaş" },
        ],
      },
      {
        fieldKey: "otherBabyPriority",
        prompt: "Öncelikli özellik veya kullanım beklentiniz nedir?",
        summaryLabel: "Öncelikli özellik",
        importance: "optional",
        rank: 40,
        inputHint: "text",
        allowDontCare: true,
      },
    ],
  },
  {
    whenProductTypes: [
      "beşik",
      "besik",
      "park yatak",
      "anne yanı",
      "anne yani",
      "bebek yatağı",
      "bebek yatagi",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "dimensions",
      "sleepSetupType",
      "sleepSafetyFeature",
    ],
    measurementContracts: {
      dimensions: {
        kind: "physical_dimensions",
        axes: ["width", "depth"],
        unit: "cm",
        example: "60 × 120 cm",
      },
    },
    questions: [
      {
        fieldKey: "sleepSetupType",
        prompt: "Hangi uyku çözümü gerekli?",
        summaryLabel: "Uyku ürünü",
        importance: "quote_critical",
        rank: 70,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Klasik beşik", value: "Beşik" },
          { label: "Park yatak", value: "Park yatak" },
          { label: "Anne yanı yatak", value: "Anne yanı" },
          { label: "Bebek yatağı", value: "Bebek yatağı" },
        ],
      },
      {
        fieldKey: "dimensions",
        prompt: "Yatak / iç ölçü tercihiniz nedir?",
        summaryLabel: "Yatak ölçüsü",
        importance: "quote_critical",
        rank: 64,
        inputHint: "text",
        allowUnknown: true,
      },
      {
        fieldKey: "sleepSafetyFeature",
        prompt: "Öncelikli güvenlik veya kullanım özelliğiniz nedir?",
        summaryLabel: "Güvenlik / kullanım",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Sabit yan korkuluk", value: "Sabit korkuluk" },
          { label: "Ayarlanabilir yükseklik", value: "Ayarlanabilir yükseklik" },
          { label: "Tekerlekli", value: "Tekerlekli" },
          { label: "Alt depolamalı", value: "Alt depolamalı" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["mama sandalyesi", "high chair"],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "highChairUseStage",
      "highChairHarness",
      "highChairAdjustability",
    ],
    questions: [
      {
        fieldKey: "highChairUseStage",
        prompt: "Mama sandalyesi hangi dönem için kullanılacak?",
        summaryLabel: "Kullanım dönemi",
        importance: "quote_critical",
        rank: 70,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Ek gıdaya başlangıç", value: "Ek gıdaya başlangıç" },
          { label: "Bebek dönemi", value: "Bebek" },
          { label: "Yürümeye başlayan çocuk", value: "Çocuk" },
        ],
      },
      {
        fieldKey: "highChairHarness",
        prompt: "Emniyet kemeri tercihiniz nedir?",
        summaryLabel: "Emniyet kemeri",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "5 nokta kemer", value: "5 nokta" },
          { label: "3 nokta kemer", value: "3 nokta" },
          { label: "Kemerli olması yeterli", value: "Kemerli" },
        ],
      },
      {
        fieldKey: "highChairAdjustability",
        prompt: "Hangi kullanım özelliği öncelikli?",
        summaryLabel: "Kullanım özelliği",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Katlanabilir", value: "Katlanabilir" },
          { label: "Yükseklik ayarlı", value: "Yükseklik ayarlı" },
          { label: "Yatış pozisyonlu", value: "Yatış pozisyonlu" },
          { label: "Çıkarılabilir tepsili", value: "Çıkarılabilir tepsi" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "biberon",
      "alıştırma bardağı",
      "alistirma bardagi",
      "suluk",
      "sippy cup",
      "bottle",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "feedingBottleCapacity",
      "feedingBottleMaterial",
      "feedingBottleFeature",
    ],
    questions: [
      {
        fieldKey: "feedingBottleCapacity",
        prompt: "Hangi hacim aralığı gerekli?",
        summaryLabel: "Hacim",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "120–150 ml", value: "120-150 ml" },
          { label: "240–260 ml", value: "240-260 ml" },
          { label: "300 ml ve üzeri", value: "300+ ml" },
        ],
      },
      {
        fieldKey: "feedingBottleMaterial",
        prompt: "Malzeme tercihiniz nedir?",
        summaryLabel: "Malzeme",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Cam", value: "Cam" },
          { label: "PP plastik", value: "PP plastik" },
          { label: "Silikon", value: "Silikon" },
          { label: "Paslanmaz çelik", value: "Paslanmaz çelik" },
        ],
      },
      {
        fieldKey: "feedingBottleFeature",
        prompt: "Öncelikli kullanım özelliğiniz nedir?",
        summaryLabel: "Kullanım özelliği",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Antikolik", value: "Antikolik" },
          { label: "Sızdırmaz", value: "Sızdırmaz" },
          { label: "Kulplu", value: "Kulplu" },
          { label: "Set halinde", value: "Set" },
        ],
      },
    ],
  },
  {
    excludeNeedTypes: NON_PURCHASE_NEED_TYPES,
    whenProductTypes: [
      "biberon ucu",
      "biberon uç",
      "biberon uclari",
      "emzik",
      "diş kaşıyıcı",
      "dis kasiyici",
      "pacifier",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "feedingNippleStage",
      "feedingNippleMaterial",
      "feedingNippleFeature",
    ],
    questions: [
      {
        fieldKey: "feedingNippleStage",
        prompt: "Hangi yaş / akış dönemi için gerekli?",
        summaryLabel: "Yaş / akış",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "Yenidoğan / yavaş akış", value: "Yenidoğan" },
          { label: "Orta akış", value: "Orta akış" },
          { label: "Hızlı akış", value: "Hızlı akış" },
          { label: "6+ ay", value: "6+ ay" },
        ],
      },
      {
        fieldKey: "feedingNippleMaterial",
        prompt: "Malzeme tercihiniz nedir?",
        summaryLabel: "Malzeme",
        importance: "optional",
        rank: 42,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Silikon", value: "Silikon" },
          { label: "Lateks", value: "Lateks" },
          { label: "Doğal kauçuk", value: "Doğal kauçuk" },
        ],
      },
      {
        fieldKey: "feedingNippleFeature",
        prompt: "Özel bir form / özellik gerekli mi?",
        summaryLabel: "Form / özellik",
        importance: "optional",
        rank: 38,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Ortodontik", value: "Ortodontik" },
          { label: "Damaklı", value: "Damaklı" },
          { label: "Damlama önleyici", value: "Damlama önleyici" },
          { label: "Klips / tutuculu", value: "Klips / tutucu" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "sterilizatör",
      "sterilizator",
      "mama ısıtıcı",
      "mama isitici",
      "mama hazırlama",
      "mama hazirlama",
      "biberon ısıtıcı",
      "biberon isitici",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "feedingDeviceType",
      "feedingDeviceCapacity",
      "feedingDeviceOperation",
    ],
    questions: [
      {
        fieldKey: "feedingDeviceType",
        prompt: "Hangi beslenme cihazı gerekli?",
        summaryLabel: "Cihaz tipi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Sterilizatör", value: "Sterilizatör" },
          { label: "Biberon / mama ısıtıcı", value: "Isıtıcı" },
          { label: "Mama hazırlama makinesi", value: "Mama hazırlama" },
          { label: "Çok fonksiyonlu", value: "Çok fonksiyonlu" },
        ],
      },
      {
        fieldKey: "feedingDeviceCapacity",
        prompt: "Aynı anda kaç biberon / parça işleyebilmeli?",
        summaryLabel: "Kapasite",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "1 adet", value: "1 adet" },
          { label: "2–3 adet", value: "2-3 adet" },
          { label: "4–6 adet", value: "4-6 adet" },
          { label: "6+ adet", value: "6+ adet" },
        ],
      },
      {
        fieldKey: "feedingDeviceOperation",
        prompt: "Çalışma yöntemi tercihiniz var mı?",
        summaryLabel: "Çalışma yöntemi",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Buharlı", value: "Buharlı" },
          { label: "Elektrikli ısıtma", value: "Elektrikli" },
          { label: "Seyahat tipi", value: "Seyahat tipi" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "göğüs pompası",
      "gogus pompasi",
      "breast pump",
      "göğüs pompası aksesuar",
      "gogus pompasi aksesuar",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "breastPumpOperation",
      "breastPumpConfiguration",
      "breastPumpCompatibility",
    ],
    questions: [
      {
        fieldKey: "breastPumpOperation",
        prompt: "Pompa çalışma tipi nasıl olmalı?",
        summaryLabel: "Çalışma tipi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Manuel", value: "Manuel" },
          { label: "Elektrikli", value: "Elektrikli" },
          { label: "Giyilebilir", value: "Giyilebilir" },
        ],
      },
      {
        fieldKey: "breastPumpConfiguration",
        prompt: "Tekli mi, çiftli mi gerekli?",
        summaryLabel: "Pompa seti",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Tekli", value: "Tekli" },
          { label: "Çiftli", value: "Çiftli" },
          { label: "Aksesuar / yedek parça", value: "Aksesuar" },
        ],
      },
      {
        fieldKey: "breastPumpCompatibility",
        prompt: "Uyumlu olması gereken marka / model var mı?",
        summaryLabel: "Marka / model uyumu",
        importance: "optional",
        rank: 40,
        inputHint: "text",
        allowUnknown: true,
      },
    ],
  },
  {
    whenProductTypes: [
      "anne sütü depolama",
      "anne sutu depolama",
      "göğüs pedi",
      "gogus pedi",
      "emzirme yastığı",
      "emzirme yastigi",
      "emzirme önlüğü",
      "emzirme onlugu",
      "gaz çıkarma",
      "gaz cikarma",
      "omuz bezi",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "maternalFeedingItem",
      "maternalFeedingMaterial",
      "maternalFeedingPackSize",
    ],
    questions: [
      {
        fieldKey: "maternalFeedingItem",
        prompt: "Hangi emzirme / saklama ürünü gerekli?",
        summaryLabel: "Ürün amacı",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Süt saklama", value: "Süt saklama" },
          { label: "Göğüs pedi / koruyucu", value: "Göğüs pedi" },
          { label: "Emzirme yastığı", value: "Emzirme yastığı" },
          { label: "Emzirme tekstili", value: "Emzirme tekstili" },
        ],
      },
      {
        fieldKey: "maternalFeedingMaterial",
        prompt: "Malzeme tercihiniz nedir?",
        summaryLabel: "Malzeme",
        importance: "optional",
        rank: 42,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Silikon", value: "Silikon" },
          { label: "Tek kullanımlık", value: "Tek kullanımlık" },
          { label: "Yıkanabilir kumaş", value: "Yıkanabilir kumaş" },
          { label: "BPA içermeyen plastik", value: "BPA içermeyen plastik" },
        ],
      },
      {
        fieldKey: "maternalFeedingPackSize",
        prompt: "Paket / set miktarı tercihiniz var mı?",
        summaryLabel: "Paket / set",
        importance: "optional",
        rank: 38,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Tekli", value: "Tekli" },
          { label: "2'li / 3'lü", value: "2-3'lü" },
          { label: "Çoklu paket", value: "Çoklu paket" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "bebek gıdası",
      "bebek gidasi",
      "bebek / çocuk gıdası",
      "bebek / cocuk gidasi",
      "küçük çocuk gıdası",
      "kucuk cocuk gidasi",
      "mama",
      "püre",
      "pure",
      "atıştırmalık",
      "atistirmalik",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "babyFoodType",
      "babyFoodPackageSize",
      "babyFoodPreference",
    ],
    questions: [
      {
        fieldKey: "babyFoodType",
        prompt: "Hangi tür bebek / çocuk gıdası arıyorsunuz?",
        summaryLabel: "Gıda türü",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Sütlü / tahıllı mama", value: "Mama" },
          { label: "Püre", value: "Püre" },
          { label: "Atıştırmalık", value: "Atıştırmalık" },
          { label: "İçecek", value: "İçecek" },
        ],
      },
      {
        fieldKey: "babyFoodPackageSize",
        prompt: "Paket miktarı tercihiniz nedir?",
        summaryLabel: "Paket miktarı",
        importance: "optional",
        rank: 42,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Deneme / tekli", value: "Tekli" },
          { label: "Orta paket", value: "Orta paket" },
          { label: "Ekonomik çoklu paket", value: "Çoklu paket" },
        ],
      },
      {
        fieldKey: "babyFoodPreference",
        prompt: "Belirgin bir içerik tercihiniz var mı?",
        summaryLabel: "İçerik tercihi",
        importance: "optional",
        rank: 38,
        inputHint: "text",
        allowDontCare: true,
      },
    ],
  },
  {
    whenProductTypes: ["uyku tulumu", "sleeping bag"],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "sleepBagTog",
      "sleepBagClosure",
    ],
    questions: [
      {
        fieldKey: "sleepBagTog",
        prompt: "Hangi ısı derecesi (tog) gerekli?",
        summaryLabel: "Isı derecesi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "0,5 tog", value: "0,5 tog" },
          { label: "1 tog", value: "1 tog" },
          { label: "2,5 tog", value: "2,5 tog" },
          { label: "3,5 tog", value: "3,5 tog" },
        ],
      },
      {
        fieldKey: "sleepBagClosure",
        prompt: "Kapanış / kullanım tipi tercihiniz var mı?",
        summaryLabel: "Kapanış tipi",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Fermuarlı", value: "Fermuarlı" },
          { label: "Çıtçıtlı", value: "Çıtçıtlı" },
          { label: "Ayaklı", value: "Ayaklı" },
          { label: "Kolsuz", value: "Kolsuz" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "bebek battaniye",
      "bebek battaniyeleri",
      "kundak",
      "kundak battaniye",
      "kundak battaniyeleri",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "sleepTextileType",
      "sleepTextileMaterial",
      "sleepTextileSize",
    ],
    questions: [
      {
        fieldKey: "sleepTextileType",
        prompt: "Hangi uyku tekstili gerekli?",
        summaryLabel: "Tekstil tipi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Battaniye", value: "Battaniye" },
          { label: "Kundak battaniyesi", value: "Kundak" },
          { label: "Çok amaçlı örtü", value: "Çok amaçlı örtü" },
        ],
      },
      {
        fieldKey: "sleepTextileMaterial",
        prompt: "Kumaş / doku tercihiniz nedir?",
        summaryLabel: "Kumaş / doku",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Pamuk", value: "Pamuk" },
          { label: "Müslin", value: "Müslin" },
          { label: "Bambu", value: "Bambu" },
          { label: "Polar / sıcak tutan", value: "Polar" },
        ],
      },
      {
        fieldKey: "sleepTextileSize",
        prompt: "Hangi ölçü aralığı gerekli?",
        summaryLabel: "Ölçü",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "75 × 100 cm", value: "75 × 100 cm" },
          { label: "90 × 120 cm", value: "90 × 120 cm" },
          { label: "100 × 150 cm", value: "100 × 150 cm" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "bebek odası mobilya seti",
      "bebek odasi mobilya seti",
      "bebek odası",
      "bebek odasi",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "dimensions",
      "babyRoomSetContents",
      "babyRoomMaterial",
    ],
    measurementContracts: {
      dimensions: {
        kind: "physical_dimensions",
        axes: ["width", "depth", "height"],
        unit: "cm",
        example: "280 × 50 × 200 cm",
      },
    },
    questions: [
      {
        fieldKey: "babyRoomSetContents",
        prompt: "Set içinde hangi modüller olmalı?",
        summaryLabel: "Set içeriği",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Beşik + şifonyer", value: "Beşik + şifonyer" },
          { label: "Beşik + dolap", value: "Beşik + dolap" },
          { label: "Tam oda seti", value: "Tam oda seti" },
          { label: "Tek modül", value: "Tek modül" },
        ],
      },
      {
        fieldKey: "dimensions",
        prompt: "Yerleşebileceği yaklaşık alan / ölçü nedir?",
        summaryLabel: "Yerleşim ölçüsü",
        importance: "quote_critical",
        rank: 64,
        inputHint: "text",
        allowUnknown: true,
      },
      {
        fieldKey: "babyRoomMaterial",
        prompt: "Gövde / kapak malzemesi tercihiniz var mı?",
        summaryLabel: "Malzeme",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "MDFLAM", value: "MDFLAM" },
          { label: "Ahşap", value: "Ahşap" },
          { label: "Lake", value: "Lake" },
          { label: "Suntalam", value: "Suntalam" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "yatak koruyucu",
      "nest",
      "bebek nest",
      "uyku nest",
    ],
    allowedCandidateFieldKeys: [
      ...BABY_COMMON_CANDIDATE_KEYS,
      "sleepSupportType",
      "sleepSupportMaterial",
      "sleepSupportFeature",
    ],
    questions: [
      {
        fieldKey: "sleepSupportType",
        prompt: "Hangi uyku destek ürünü gerekli?",
        summaryLabel: "Ürün tipi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Yatak koruyucu", value: "Yatak koruyucu" },
          { label: "Nest", value: "Nest" },
          { label: "Yatak bariyeri", value: "Yatak bariyeri" },
        ],
      },
      {
        fieldKey: "sleepSupportMaterial",
        prompt: "Malzeme tercihiniz nedir?",
        summaryLabel: "Malzeme",
        importance: "optional",
        rank: 42,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Pamuklu", value: "Pamuklu" },
          { label: "Sıvı geçirmez", value: "Sıvı geçirmez" },
          { label: "Nefes alabilen", value: "Nefes alabilen" },
          { label: "Yıkanabilir", value: "Yıkanabilir" },
        ],
      },
      {
        fieldKey: "sleepSupportFeature",
        prompt: "Öncelikli kullanım özelliğiniz nedir?",
        summaryLabel: "Kullanım özelliği",
        importance: "optional",
        rank: 38,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Katlanabilir / taşınabilir", value: "Taşınabilir" },
          { label: "Fermuarlı çıkarılabilir kılıf", value: "Çıkarılabilir kılıf" },
          { label: "Kaydırmaz taban", value: "Kaydırmaz" },
        ],
      },
    ],
  },
];

/**
 * Ev & Mutfak'ta aile sahibi olmayan serbest soru adayı yayınlanmaz.
 * Aynı "Diğer" torbasının tencereye fincan, fincana indüksiyon sorusu
 * sormasını önleyen sınır budur.
 */
const HOME_KITCHEN_COMMON_CANDIDATE_KEYS = [
  "kitchenProductType",
  "pieceCount",
  "material",
  "usageArea",
  "color",
  "features",
  "brand",
  "condition",
  "quantity",
  "city",
  "delivery",
  "budget",
];

const HOME_KITCHEN_PRODUCT_QUESTION_CONTRACTS: ProductQuestionContract[] = [
  {
    whenProductTypes: [
      "yemek / tabak takımı",
      "yemek takımı",
      "yemek takimi",
      "porselen yemek",
      "bone china",
      "günlük servis",
      "gunluk servis",
    ],
    allowedCandidateFieldKeys: [
      ...HOME_KITCHEN_COMMON_CANDIDATE_KEYS,
      "serviceCount",
      "dishwasherSafe",
    ],
    questions: [
      {
        fieldKey: "serviceCount",
        prompt: "Kaç kişilik yemek takımı gerekli?",
        summaryLabel: "Kişilik",
        importance: "quote_critical",
        rank: 70,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "4 kişilik", value: "4 kişilik" },
          { label: "6 kişilik", value: "6 kişilik" },
          { label: "12 kişilik", value: "12 kişilik" },
          { label: "24 kişilik ve üzeri", value: "24+ kişilik" },
        ],
      },
      {
        fieldKey: "pieceCount",
        prompt: "Parça sayısı için bir tercihiniz var mı?",
        summaryLabel: "Parça sayısı",
        importance: "quote_critical",
        rank: 66,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "18–24 parça", value: "18-24 parça" },
          { label: "36 parça", value: "36 parça" },
          { label: "48–60 parça", value: "48-60 parça" },
          { label: "72 parça ve üzeri", value: "72+ parça" },
        ],
      },
      {
        fieldKey: "material",
        prompt: "Malzeme tercihiniz nedir?",
        summaryLabel: "Malzeme",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Porselen", value: "Porselen" },
          { label: "Bone china", value: "Bone china" },
          { label: "Seramik", value: "Seramik" },
          { label: "Cam", value: "Cam" },
        ],
      },
      {
        fieldKey: "dishwasherSafe",
        prompt: "Bulaşık makinesinde yıkanabilmesi gerekli mi?",
        summaryLabel: "Bulaşık makinesi uyumu",
        importance: "optional",
        rank: 38,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Gerekli", value: "Gerekli" },
          { label: "Gerekli değil", value: "Gerekli değil" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "kayık tabak",
      "kayik tabak",
      "kase / çorba",
      "kase / corba",
    ],
    allowedCandidateFieldKeys: [
      ...HOME_KITCHEN_COMMON_CANDIDATE_KEYS,
      "pieceCount",
      "dishwasherSafe",
    ],
    questions: [
      {
        fieldKey: "pieceCount",
        prompt: "Kaç parça sunum ürünü gerekli?",
        summaryLabel: "Parça sayısı",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "1–2 parça", value: "1-2 parça" },
          { label: "4–6 parça", value: "4-6 parça" },
          { label: "8–12 parça", value: "8-12 parça" },
          { label: "12+ parça", value: "12+ parça" },
        ],
      },
      {
        fieldKey: "material",
        prompt: "Malzeme tercihiniz nedir?",
        summaryLabel: "Malzeme",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Porselen", value: "Porselen" },
          { label: "Seramik", value: "Seramik" },
          { label: "Cam", value: "Cam" },
          { label: "Melamin", value: "Melamin" },
        ],
      },
      {
        fieldKey: "dishwasherSafe",
        prompt: "Bulaşık makinesinde yıkanabilmesi gerekli mi?",
        summaryLabel: "Bulaşık makinesi uyumu",
        importance: "optional",
        rank: 38,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Gerekli", value: "Gerekli" },
          { label: "Gerekli değil", value: "Gerekli değil" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "tencere",
      "tava",
      "döküm",
      "dokum",
      "düdüklü",
      "duduklu",
      "ocak ve fırında",
      "ocak ve firinda",
    ],
    allowedCandidateFieldKeys: [
      ...HOME_KITCHEN_COMMON_CANDIDATE_KEYS,
      "cookwareSetType",
      "cooktopCompatibility",
      "cookwareSize",
      "ovenSafe",
    ],
    questions: [
      {
        fieldKey: "cookwareSetType",
        prompt: "Nasıl bir pişirme ürünü arıyorsunuz?",
        summaryLabel: "Ürün tipi",
        importance: "quote_critical",
        rank: 70,
        inputHint: "select",
        allowDontCare: false,
        quickChoices: [
          { label: "Tencere seti", value: "Tencere seti" },
          { label: "Tava / tava seti", value: "Tava" },
          { label: "Düdüklü tencere", value: "Düdüklü tencere" },
          { label: "Döküm tencere / tava", value: "Döküm" },
        ],
      },
      {
        fieldKey: "material",
        prompt: "Malzeme tercihiniz nedir?",
        summaryLabel: "Malzeme",
        importance: "quote_critical",
        rank: 66,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Paslanmaz çelik", value: "Paslanmaz çelik" },
          { label: "Döküm", value: "Döküm" },
          { label: "Granit / seramik kaplama", value: "Granit / seramik" },
          { label: "Alüminyum", value: "Alüminyum" },
        ],
      },
      {
        fieldKey: "cooktopCompatibility",
        prompt: "Hangi ocak tipiyle uyumlu olmalı?",
        summaryLabel: "Ocak uyumu",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "İndüksiyon", value: "İndüksiyon" },
          { label: "Gazlı ocak", value: "Gazlı ocak" },
          { label: "Elektrikli / seramik", value: "Elektrikli / seramik" },
          { label: "Tüm ocak tipleri", value: "Tüm ocak tipleri" },
        ],
      },
      {
        fieldKey: "cookwareSize",
        prompt: "Kapasite veya çap için tercihiniz var mı?",
        summaryLabel: "Kapasite / çap",
        importance: "optional",
        rank: 40,
        inputHint: "text",
        allowDontCare: true,
      },
      {
        fieldKey: "ovenSafe",
        prompt: "Fırında kullanıma uygun olması gerekli mi?",
        summaryLabel: "Fırın kullanımı",
        importance: "optional",
        rank: 36,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Gerekli", value: "Gerekli" },
          { label: "Gerekli değil", value: "Gerekli değil" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "kahve seti",
      "çay seti",
      "cay seti",
      "kahve fincan",
      "espresso fincan",
    ],
    allowedCandidateFieldKeys: [
      ...HOME_KITCHEN_COMMON_CANDIDATE_KEYS,
      "serviceCount",
      "drinkwareSetContents",
      "dishwasherSafe",
    ],
    questions: [
      {
        fieldKey: "serviceCount",
        prompt: "Kaç kişilik set gerekli?",
        summaryLabel: "Kişilik",
        importance: "quote_critical",
        rank: 70,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "2 kişilik", value: "2 kişilik" },
          { label: "4 kişilik", value: "4 kişilik" },
          { label: "6 kişilik", value: "6 kişilik" },
          { label: "12 kişilik ve üzeri", value: "12+ kişilik" },
        ],
      },
      {
        fieldKey: "material",
        prompt: "Malzeme tercihiniz nedir?",
        summaryLabel: "Malzeme",
        importance: "quote_critical",
        rank: 66,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Porselen", value: "Porselen" },
          { label: "Cam", value: "Cam" },
          { label: "Seramik", value: "Seramik" },
          { label: "Çelik", value: "Çelik" },
        ],
      },
      {
        fieldKey: "drinkwareSetContents",
        prompt: "Set içeriğinde ne olmalı?",
        summaryLabel: "Set içeriği",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Fincan + tabak", value: "Fincan + tabak" },
          { label: "Fincan + tabak + ikramlık", value: "İkramlıklı set" },
          { label: "Sadece fincan / bardak", value: "Sadece fincan / bardak" },
        ],
      },
      {
        fieldKey: "dishwasherSafe",
        prompt: "Bulaşık makinesinde yıkanabilmesi gerekli mi?",
        summaryLabel: "Bulaşık makinesi uyumu",
        importance: "optional",
        rank: 38,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Gerekli", value: "Gerekli" },
          { label: "Gerekli değil", value: "Gerekli değil" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["french press", "chemex", "pour over"],
    allowedCandidateFieldKeys: [
      ...HOME_KITCHEN_COMMON_CANDIDATE_KEYS,
      "brewCapacity",
      "filterPreference",
    ],
    questions: [
      {
        fieldKey: "brewCapacity",
        prompt: "Yaklaşık kaç fincanlık demleme kapasitesi gerekli?",
        summaryLabel: "Demleme kapasitesi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "1–2 fincan", value: "1-2 fincan" },
          { label: "3–4 fincan", value: "3-4 fincan" },
          { label: "5–6 fincan", value: "5-6 fincan" },
          { label: "6+ fincan", value: "6+ fincan" },
        ],
      },
      {
        fieldKey: "filterPreference",
        prompt: "Filtre tercihiniz var mı?",
        summaryLabel: "Filtre",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Metal filtre", value: "Metal filtre" },
          { label: "Kâğıt filtre", value: "Kâğıt filtre" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["termos", "sürahi", "surahi"],
    allowedCandidateFieldKeys: [
      ...HOME_KITCHEN_COMMON_CANDIDATE_KEYS,
      "drinkwareVolume",
      "insulationPreference",
    ],
    questions: [
      {
        fieldKey: "drinkwareVolume",
        prompt: "Hangi hacim aralığı gerekli?",
        summaryLabel: "Hacim",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "350–500 ml", value: "350-500 ml" },
          { label: "750 ml", value: "750 ml" },
          { label: "1 litre", value: "1 litre" },
          { label: "1,5 litre ve üzeri", value: "1,5 L+" },
        ],
      },
      {
        fieldKey: "insulationPreference",
        prompt: "Isı yalıtımı gerekli mi?",
        summaryLabel: "Isı yalıtımı",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Sıcak tutmalı", value: "Sıcak tutmalı" },
          { label: "Soğuk tutmalı", value: "Soğuk tutmalı" },
          { label: "İkisi de", value: "Sıcak ve soğuk" },
          { label: "Gerekli değil", value: "Gerekli değil" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "çatal-bıçak",
      "catal-bicak",
      "çatal bıçak",
      "catal bicak",
      "bıçak seti",
      "bicak seti",
      "steak knife",
      "kaşık seti",
      "kasik seti",
    ],
    allowedCandidateFieldKeys: [
      ...HOME_KITCHEN_COMMON_CANDIDATE_KEYS,
      "cutleryServiceCount",
      "cutleryFinish",
    ],
    questions: [
      {
        fieldKey: "cutleryServiceCount",
        prompt: "Kaç kişilik çatal-bıçak takımı gerekli?",
        summaryLabel: "Kişilik",
        importance: "quote_critical",
        rank: 70,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "6 kişilik", value: "6 kişilik" },
          { label: "12 kişilik", value: "12 kişilik" },
          { label: "24 kişilik", value: "24 kişilik" },
          { label: "24+ kişilik", value: "24+ kişilik" },
        ],
      },
      {
        fieldKey: "pieceCount",
        prompt: "Parça sayısı tercihiniz var mı?",
        summaryLabel: "Parça sayısı",
        importance: "quote_critical",
        rank: 66,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "24 parça", value: "24 parça" },
          { label: "36 parça", value: "36 parça" },
          { label: "60 parça", value: "60 parça" },
          { label: "84 parça ve üzeri", value: "84+ parça" },
        ],
      },
      {
        fieldKey: "material",
        prompt: "Malzeme tercihiniz nedir?",
        summaryLabel: "Malzeme",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "18/10 paslanmaz çelik", value: "18/10 çelik" },
          { label: "18/0 paslanmaz çelik", value: "18/0 çelik" },
          { label: "Gümüş kaplama", value: "Gümüş kaplama" },
        ],
      },
      {
        fieldKey: "cutleryFinish",
        prompt: "Yüzey / renk tercihiniz var mı?",
        summaryLabel: "Yüzey",
        importance: "optional",
        rank: 38,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Parlak", value: "Parlak" },
          { label: "Mat", value: "Mat" },
          { label: "Altın / bakır ton", value: "Altın / bakır" },
          { label: "Siyah", value: "Siyah" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["bardak seti", "kadeh seti", "bardak", "kadeh"],
    allowedCandidateFieldKeys: [
      ...HOME_KITCHEN_COMMON_CANDIDATE_KEYS,
      "glasswareCapacity",
      "dishwasherSafe",
    ],
    questions: [
      {
        fieldKey: "serviceCount",
        prompt: "Kaç kişilik bardak / kadeh seti gerekli?",
        summaryLabel: "Kişilik",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "2 kişilik", value: "2 kişilik" },
          { label: "4 kişilik", value: "4 kişilik" },
          { label: "6 kişilik", value: "6 kişilik" },
          { label: "12 kişilik ve üzeri", value: "12+ kişilik" },
        ],
      },
      {
        fieldKey: "glasswareCapacity",
        prompt: "Hacim tercihiniz var mı?",
        summaryLabel: "Hacim",
        importance: "optional",
        rank: 42,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "200 ml altı", value: "200 ml altı" },
          { label: "200–350 ml", value: "200-350 ml" },
          { label: "350–500 ml", value: "350-500 ml" },
          { label: "500 ml ve üzeri", value: "500+ ml" },
        ],
      },
      {
        fieldKey: "dishwasherSafe",
        prompt: "Bulaşık makinesinde yıkanabilmesi gerekli mi?",
        summaryLabel: "Bulaşık makinesi uyumu",
        importance: "optional",
        rank: 38,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Gerekli", value: "Gerekli" },
          { label: "Gerekli değil", value: "Gerekli değil" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["fırın kabı", "firin kabi", "borcam"],
    allowedCandidateFieldKeys: [
      ...HOME_KITCHEN_COMMON_CANDIDATE_KEYS,
      "bakewareCapacity",
      "ovenSafe",
    ],
    questions: [
      {
        fieldKey: "material",
        prompt: "Malzeme tercihiniz nedir?",
        summaryLabel: "Malzeme",
        importance: "quote_critical",
        rank: 66,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Borcam / temperli cam", value: "Cam" },
          { label: "Seramik", value: "Seramik" },
          { label: "Döküm", value: "Döküm" },
        ],
      },
      {
        fieldKey: "bakewareCapacity",
        prompt: "Yaklaşık kapasite veya ölçü tercihiniz var mı?",
        summaryLabel: "Kapasite / ölçü",
        importance: "quote_critical",
        rank: 64,
        inputHint: "text",
        allowUnknown: true,
      },
      {
        fieldKey: "ovenSafe",
        prompt: "Fırında kullanıma uygun olması gerekli mi?",
        summaryLabel: "Fırın kullanımı",
        importance: "optional",
        rank: 38,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Gerekli", value: "Gerekli" },
          { label: "Gerekli değil", value: "Gerekli değil" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "saklama kabı",
      "saklama kabi",
      "saklama / düzenleyici",
      "saklama / duzenleyici",
      "yiyecek saklama",
      "saklama ve düzenleme",
      "saklama ve duzenleme",
    ],
    allowedCandidateFieldKeys: [
      ...HOME_KITCHEN_COMMON_CANDIDATE_KEYS,
      "storageCapacity",
      "storageSeal",
      "dishwasherSafe",
    ],
    questions: [
      {
        fieldKey: "storageCapacity",
        prompt: "Hangi saklama kapasitesi gerekli?",
        summaryLabel: "Kapasite",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "Küçük (0–1 L)", value: "0-1 L" },
          { label: "Orta (1–3 L)", value: "1-3 L" },
          { label: "Büyük (3–5 L)", value: "3-5 L" },
          { label: "Çoklu set", value: "Çoklu set" },
        ],
      },
      {
        fieldKey: "storageSeal",
        prompt: "Sızdırmaz kapak gerekli mi?",
        summaryLabel: "Kapak / sızdırmazlık",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Tam sızdırmaz", value: "Tam sızdırmaz" },
          { label: "Standart kapak yeterli", value: "Standart kapak" },
          { label: "Vakumlu tercih edilir", value: "Vakumlu" },
        ],
      },
      {
        fieldKey: "material",
        prompt: "Malzeme tercihiniz nedir?",
        summaryLabel: "Malzeme",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Cam", value: "Cam" },
          { label: "Plastik", value: "Plastik" },
          { label: "Çelik", value: "Çelik" },
          { label: "Silikon", value: "Silikon" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "mutfak gereçleri",
      "mutfak gerecleri",
      "mutfak aletleri",
      "mutfak robotu aksesuarı",
      "mutfak robotu aksesuari",
      "kesme tahtası",
      "kesme tahtasi",
    ],
    allowedCandidateFieldKeys: [
      ...HOME_KITCHEN_COMMON_CANDIDATE_KEYS,
      "kitchenToolPurpose",
      "kitchenToolMaterial",
      "accessoryCompatibility",
    ],
    questions: [
      {
        fieldKey: "kitchenToolPurpose",
        prompt: "Ürünü hangi iş için kullanacaksınız?",
        summaryLabel: "Kullanım amacı",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Hazırlık / doğrama", value: "Hazırlık / doğrama" },
          { label: "Pişirme", value: "Pişirme" },
          { label: "Servis", value: "Servis" },
          { label: "Mutfak robotu aksesuarı", value: "Robot aksesuarı" },
        ],
      },
      {
        fieldKey: "kitchenToolMaterial",
        prompt: "Malzeme tercihiniz nedir?",
        summaryLabel: "Malzeme",
        importance: "optional",
        rank: 42,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Paslanmaz çelik", value: "Paslanmaz çelik" },
          { label: "Silikon", value: "Silikon" },
          { label: "Ahşap / bambu", value: "Ahşap / bambu" },
          { label: "Plastik", value: "Plastik" },
        ],
      },
      {
        fieldKey: "accessoryCompatibility",
        prompt: "Uyumlu olması gereken cihaz / model var mı?",
        summaryLabel: "Cihaz uyumu",
        importance: "optional",
        rank: 40,
        inputHint: "text",
        allowUnknown: true,
      },
    ],
  },
  {
    whenProductTypes: ["prefabrike mutfak", "modüler mutfak", "moduler mutfak"],
    allowedCandidateFieldKeys: [
      ...HOME_KITCHEN_COMMON_CANDIDATE_KEYS,
      "dimensions",
      "kitchenLayout",
      "cabinetMaterial",
      "installation",
    ],
    measurementContracts: {
      dimensions: {
        kind: "physical_dimensions",
        axes: ["width", "depth", "height"],
        unit: "cm",
        example: "300 × 60 × 220 cm",
      },
    },
    questions: [
      {
        fieldKey: "kitchenLayout",
        prompt: "Mutfak yerleşimi nasıl olmalı?",
        summaryLabel: "Yerleşim",
        importance: "quote_critical",
        rank: 70,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Düz hat", value: "Düz hat" },
          { label: "L tipi", value: "L tipi" },
          { label: "U tipi", value: "U tipi" },
          { label: "Ada mutfak", value: "Ada mutfak" },
        ],
      },
      {
        fieldKey: "cabinetMaterial",
        prompt: "Dolap kapağı / gövde malzemesi tercihiniz var mı?",
        summaryLabel: "Dolap malzemesi",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "MDFLAM", value: "MDFLAM" },
          { label: "Lake", value: "Lake" },
          { label: "Membran", value: "Membran" },
          { label: "Ahşap kaplama", value: "Ahşap kaplama" },
        ],
      },
      {
        fieldKey: "installation",
        prompt: "Montaj dahil olsun mu?",
        summaryLabel: "Montaj",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Montaj dahil", value: "Montaj dahil" },
          { label: "Sadece ürün", value: "Sadece ürün" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["eviye", "lavabo", "ankastre eviye"],
    allowedCandidateFieldKeys: [
      ...HOME_KITCHEN_COMMON_CANDIDATE_KEYS,
      "dimensions",
      "sinkMountType",
      "fixtureMaterial",
    ],
    measurementContracts: {
      dimensions: {
        kind: "physical_dimensions",
        axes: ["width", "depth"],
        unit: "cm",
        example: "80 × 50 cm",
      },
    },
    questions: [
      {
        fieldKey: "sinkMountType",
        prompt: "Montaj tipi tercihiniz nedir?",
        summaryLabel: "Montaj tipi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Tezgâh üstü", value: "Tezgâh üstü" },
          { label: "Tezgâh altı", value: "Tezgâh altı" },
          { label: "Gömme", value: "Gömme" },
        ],
      },
      {
        fieldKey: "fixtureMaterial",
        prompt: "Malzeme tercihiniz nedir?",
        summaryLabel: "Malzeme",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Paslanmaz çelik", value: "Paslanmaz çelik" },
          { label: "Granit", value: "Granit" },
          { label: "Seramik", value: "Seramik" },
          { label: "Kompozit", value: "Kompozit" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["batarya", "musluk", "duş bataryası", "dus bataryasi"],
    allowedCandidateFieldKeys: [
      ...HOME_KITCHEN_COMMON_CANDIDATE_KEYS,
      "faucetType",
      "fixtureFinish",
      "installation",
    ],
    questions: [
      {
        fieldKey: "faucetType",
        prompt: "Nasıl bir batarya / musluk arıyorsunuz?",
        summaryLabel: "Ürün tipi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Eviye bataryası", value: "Eviye bataryası" },
          { label: "Lavabo bataryası", value: "Lavabo bataryası" },
          { label: "Duş bataryası", value: "Duş bataryası" },
          { label: "Çekilebilir spiralli", value: "Çekilebilir spiralli" },
        ],
      },
      {
        fieldKey: "fixtureFinish",
        prompt: "Renk / yüzey tercihiniz var mı?",
        summaryLabel: "Yüzey",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Krom", value: "Krom" },
          { label: "Mat siyah", value: "Mat siyah" },
          { label: "Altın", value: "Altın" },
          { label: "Nikel", value: "Nikel" },
        ],
      },
      {
        fieldKey: "installation",
        prompt: "Montaj dahil olsun mu?",
        summaryLabel: "Montaj",
        importance: "optional",
        rank: 38,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Montaj dahil", value: "Montaj dahil" },
          { label: "Sadece ürün", value: "Sadece ürün" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["klozet", "duşakabin", "dusakabin", "lavabo dolabı", "lavabo dolabi"],
    allowedCandidateFieldKeys: [
      ...HOME_KITCHEN_COMMON_CANDIDATE_KEYS,
      "dimensions",
      "bathroomFixtureType",
      "installation",
    ],
    measurementContracts: {
      dimensions: {
        kind: "physical_dimensions",
        axes: ["width", "depth", "height"],
        unit: "cm",
        example: "90 × 90 × 190 cm",
      },
    },
    questions: [
      {
        fieldKey: "bathroomFixtureType",
        prompt: "Hangi banyo ürünü / formu gerekli?",
        summaryLabel: "Banyo ürünü",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Duşakabin", value: "Duşakabin" },
          { label: "Klozet", value: "Klozet" },
          { label: "Lavabo dolabı", value: "Lavabo dolabı" },
          { label: "Set", value: "Set" },
        ],
      },
      {
        fieldKey: "installation",
        prompt: "Montaj dahil olsun mu?",
        summaryLabel: "Montaj",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Montaj dahil", value: "Montaj dahil" },
          { label: "Sadece ürün", value: "Sadece ürün" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["sunum tabağı", "sunum tabagi", "servis / tepsi", "kesme tahtası", "kesme tahtasi"],
    allowedCandidateFieldKeys: [
      ...HOME_KITCHEN_COMMON_CANDIDATE_KEYS,
      "pieceCount",
      "dishwasherSafe",
    ],
    questions: [
      {
        fieldKey: "pieceCount",
        prompt: "Kaç parça servis / sunum ürünü gerekli?",
        summaryLabel: "Parça sayısı",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "1 parça", value: "1 parça" },
          { label: "2–4 parça", value: "2-4 parça" },
          { label: "6 parça", value: "6 parça" },
          { label: "12+ parça", value: "12+ parça" },
        ],
      },
      {
        fieldKey: "material",
        prompt: "Malzeme tercihiniz nedir?",
        summaryLabel: "Malzeme",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Ahşap / bambu", value: "Ahşap / bambu" },
          { label: "Porselen", value: "Porselen" },
          { label: "Cam", value: "Cam" },
          { label: "Çelik", value: "Çelik" },
        ],
      },
      {
        fieldKey: "dishwasherSafe",
        prompt: "Bulaşık makinesinde yıkanabilmesi gerekli mi?",
        summaryLabel: "Bulaşık makinesi uyumu",
        importance: "optional",
        rank: 38,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Gerekli", value: "Gerekli" },
          { label: "Gerekli değil", value: "Gerekli değil" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["duvar kağıdı", "duvar kagidi", "pencere dekor", "çıkartma", "cikartma", "kapı numarası", "kapi numarasi"],
    allowedCandidateFieldKeys: [
      ...HOME_KITCHEN_COMMON_CANDIDATE_KEYS,
      "coverageArea",
      "installation",
      "decorStyle",
    ],
    questions: [
      {
        fieldKey: "coverageArea",
        prompt: "Uygulanacak alanın yaklaşık ölçüsü nedir?",
        summaryLabel: "Uygulama alanı",
        importance: "quote_critical",
        rank: 68,
        inputHint: "text",
        allowUnknown: true,
      },
      {
        fieldKey: "decorStyle",
        prompt: "Stil / desen tercihiniz var mı?",
        summaryLabel: "Stil / desen",
        importance: "optional",
        rank: 42,
        inputHint: "text",
        allowDontCare: true,
      },
      {
        fieldKey: "installation",
        prompt: "Montaj / uygulama dahil olsun mu?",
        summaryLabel: "Uygulama",
        importance: "optional",
        rank: 38,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Dahil olsun", value: "Dahil" },
          { label: "Sadece ürün", value: "Sadece ürün" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["kilim", "kırlent", "kirlent", "yastık", "yastik", "koltuk kılıf", "koltuk kilif", "paspas", "minder"],
    allowedCandidateFieldKeys: [
      ...HOME_KITCHEN_COMMON_CANDIDATE_KEYS,
      "dimensions",
      "homeTextileMaterial",
      "decorStyle",
    ],
    measurementContracts: {
      dimensions: {
        kind: "physical_dimensions",
        axes: ["width", "height"],
        unit: "cm",
        example: "80 × 150 cm",
      },
    },
    questions: [
      {
        fieldKey: "homeTextileMaterial",
        prompt: "Kumaş / doku tercihiniz nedir?",
        summaryLabel: "Kumaş / doku",
        importance: "quote_critical",
        rank: 66,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Pamuk", value: "Pamuk" },
          { label: "Yün", value: "Yün" },
          { label: "Polyester", value: "Polyester" },
          { label: "Kadife", value: "Kadife" },
        ],
      },
      {
        fieldKey: "decorStyle",
        prompt: "Renk / stil tercihiniz var mı?",
        summaryLabel: "Renk / stil",
        importance: "optional",
        rank: 40,
        inputHint: "text",
        allowDontCare: true,
      },
    ],
  },
  {
    whenProductTypes: ["vazo", "dekoratif", "mum", "çerçeve", "cerceve", "heykel", "kar küre", "kar kure", "saat"],
    allowedCandidateFieldKeys: [
      ...HOME_KITCHEN_COMMON_CANDIDATE_KEYS,
      "dimensions",
      "decorStyle",
      "displayLocation",
    ],
    measurementContracts: {
      dimensions: {
        kind: "physical_dimensions",
        axes: ["width", "height"],
        unit: "cm",
        example: "20 × 35 cm",
      },
    },
    questions: [
      {
        fieldKey: "decorStyle",
        prompt: "Dekorasyon stili tercihiniz nedir?",
        summaryLabel: "Stil",
        importance: "quote_critical",
        rank: 66,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Modern", value: "Modern" },
          { label: "Klasik", value: "Klasik" },
          { label: "Rustik", value: "Rustik" },
          { label: "Minimal", value: "Minimal" },
        ],
      },
      {
        fieldKey: "displayLocation",
        prompt: "Nerede kullanılacak?",
        summaryLabel: "Kullanım yeri",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "İç mekân", value: "İç mekân" },
          { label: "Dış mekân", value: "Dış mekân" },
          { label: "Hediye", value: "Hediye" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["bahçe", "bahce", "kuş", "kus", "fıskiye", "fiskiye", "havuz", "rüzgar", "ruzgar", "çim", "cim", "yağmur", "yagmur", "çatı", "cati"],
    allowedCandidateFieldKeys: [
      ...HOME_KITCHEN_COMMON_CANDIDATE_KEYS,
      "outdoorUse",
      "weatherResistance",
      "dimensions",
    ],
    measurementContracts: {
      dimensions: {
        kind: "physical_dimensions",
        axes: ["width", "height"],
        unit: "cm",
        example: "50 × 80 cm",
      },
    },
    questions: [
      {
        fieldKey: "outdoorUse",
        prompt: "Nerede kullanılacak?",
        summaryLabel: "Kullanım alanı",
        importance: "quote_critical",
        rank: 66,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Bahçe", value: "Bahçe" },
          { label: "Balkon / teras", value: "Balkon / teras" },
          { label: "Çatı", value: "Çatı" },
          { label: "İç mekân", value: "İç mekân" },
        ],
      },
      {
        fieldKey: "weatherResistance",
        prompt: "Hava koşullarına dayanıklılık gerekli mi?",
        summaryLabel: "Dış ortam dayanımı",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "UV ve yağmur dayanımı", value: "UV ve yağmur dayanımı" },
          { label: "Suya dayanıklı", value: "Suya dayanıklı" },
          { label: "Temel kullanım", value: "Temel kullanım" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["temizlik", "çöp", "cop", "çamaşırhane", "camasirhane", "haşere", "hasere", "nem emici", "ayakkabı bakım", "ayakkabi bakim"],
    allowedCandidateFieldKeys: [
      ...HOME_KITCHEN_COMMON_CANDIDATE_KEYS,
      "careProductPurpose",
      "packageSize",
      "scentPreference",
    ],
    questions: [
      {
        fieldKey: "careProductPurpose",
        prompt: "Ürünün öncelikli kullanım amacı nedir?",
        summaryLabel: "Kullanım amacı",
        importance: "quote_critical",
        rank: 66,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Temizlik", value: "Temizlik" },
          { label: "Koku / nem kontrolü", value: "Koku / nem kontrolü" },
          { label: "Haşere kontrolü", value: "Haşere kontrolü" },
          { label: "Atık / çöp yönetimi", value: "Atık yönetimi" },
        ],
      },
      {
        fieldKey: "packageSize",
        prompt: "Paket / kullanım miktarı tercihiniz var mı?",
        summaryLabel: "Paket miktarı",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Tekli", value: "Tekli" },
          { label: "Ekonomik paket", value: "Ekonomik paket" },
          { label: "Toplu / işletme paketi", value: "Toplu paket" },
        ],
      },
      {
        fieldKey: "scentPreference",
        prompt: "Koku tercihiniz var mı?",
        summaryLabel: "Koku tercihi",
        importance: "optional",
        rank: 36,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Kokusuz", value: "Kokusuz" },
          { label: "Hafif kokulu", value: "Hafif kokulu" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["düzenleme", "duzenleme", "çekmece", "cekmece", "raf kaplama", "zemin koruma", "kaydırmaz", "kaydirmaz", "halı altlık", "hali altlik"],
    allowedCandidateFieldKeys: [
      ...HOME_KITCHEN_COMMON_CANDIDATE_KEYS,
      "organizationPurpose",
      "dimensions",
      "protectionSurface",
    ],
    measurementContracts: {
      dimensions: {
        kind: "physical_dimensions",
        axes: ["width", "height"],
        unit: "cm",
        example: "50 × 120 cm",
      },
    },
    questions: [
      {
        fieldKey: "organizationPurpose",
        prompt: "Hangi alan için çözüm arıyorsunuz?",
        summaryLabel: "Kullanım alanı",
        importance: "quote_critical",
        rank: 66,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Çekmece / raf", value: "Çekmece / raf" },
          { label: "Zemin", value: "Zemin" },
          { label: "Mobilya koruması", value: "Mobilya koruması" },
          { label: "Genel düzenleme", value: "Genel düzenleme" },
        ],
      },
      {
        fieldKey: "protectionSurface",
        prompt: "Korunacak yüzey nedir?",
        summaryLabel: "Korunacak yüzey",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Ahşap", value: "Ahşap" },
          { label: "Seramik / taş", value: "Seramik / taş" },
          { label: "Halı / kilim", value: "Halı / kilim" },
          { label: "Metal", value: "Metal" },
        ],
      },
    ],
  },
];

const AUTOMOTIVE_COMMON_CANDIDATE_KEYS = [
  "needType",
  "brand",
  "condition",
  "warranty",
  "city",
  "budget",
];

const AUTOMOTIVE_PRODUCT_QUESTION_CONTRACTS: ProductQuestionContract[] = [
  {
    whenNeedTypes: ["vehicle"],
    allowedCandidateFieldKeys: [
      ...AUTOMOTIVE_COMMON_CANDIDATE_KEYS,
      "model",
      "generation",
      "modelYear",
      "engine",
      "fuel",
      "transmission",
      "mileage",
      "bodyType",
      "driveType",
      "color",
      "bodyCondition",
    ],
    questions: [
      {
        fieldKey: "condition",
        prompt: "Araç durumu tercihiniz nedir?",
        summaryLabel: "Araç durumu",
        importance: "quote_critical",
        rank: 80,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Sıfır", value: "Sıfır" },
          { label: "İkinci el", value: "İkinci el" },
          { label: "Hasar kayıtlı", value: "Hasar kayıtlı" },
          { label: "Fark etmez", value: "Fark etmez" },
        ],
      },
      {
        fieldKey: "modelYear",
        prompt: "Hangi model yılı ve üzeri olsun?",
        summaryLabel: "Yıl",
        importance: "quote_critical",
        rank: 78,
        inputHint: "number",
        allowUnknown: true,
      },
      {
        fieldKey: "mileage",
        prompt: "Kilometre üst sınırı var mı?",
        summaryLabel: "Kilometre",
        importance: "optional",
        rank: 46,
        inputHint: "number",
        allowDontCare: true,
        allowUnknown: true,
      },
      {
        fieldKey: "fuel",
        prompt: "Yakıt tercihiniz nedir?",
        summaryLabel: "Yakıt",
        importance: "optional",
        rank: 44,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Benzin", value: "Benzin" },
          { label: "Dizel", value: "Dizel" },
          { label: "Hibrit", value: "Hibrit" },
          { label: "Elektrik", value: "Elektrik" },
          { label: "LPG", value: "LPG" },
        ],
      },
      {
        fieldKey: "transmission",
        prompt: "Vites tercihiniz nedir?",
        summaryLabel: "Vites",
        importance: "optional",
        rank: 43,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Otomatik", value: "Otomatik" },
          { label: "Manuel", value: "Manuel" },
          { label: "Yarı otomatik", value: "Yarı otomatik" },
        ],
      },
      {
        fieldKey: "bodyType",
        prompt: "Kasa tipi için tercihiniz var mı?",
        summaryLabel: "Kasa tipi",
        importance: "optional",
        rank: 42,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Sedan", value: "Sedan" },
          { label: "Hatchback", value: "Hatchback" },
          { label: "SUV", value: "SUV" },
          { label: "Station wagon", value: "Station wagon" },
          { label: "Coupe", value: "Coupe" },
          { label: "Pickup", value: "Pickup" },
        ],
      },
      {
        fieldKey: "color",
        prompt: "Renk tercihiniz var mı?",
        summaryLabel: "Renk",
        importance: "optional",
        rank: 38,
        inputHint: "text",
        allowDontCare: true,
      },
    ],
  },
  {
    whenNeedTypes: ["part"],
    restrictStandardProfiles: true,
    omitDeliveryQuestion: true,
    allowedCandidateFieldKeys: [
      "needType",
      "brand",
      "model",
      "part",
      "partPreference",
      "partVehicleYear",
      "city",
      "budget",
    ],
    questions: [
      {
        fieldKey: "brand",
        prompt: "Aracın markası nedir?",
        summaryLabel: "Araç markası",
        importance: "quote_critical",
        rank: 82,
        inputHint: "text",
        allowUnknown: true,
      },
      {
        fieldKey: "model",
        prompt: "Aracın modeli nedir?",
        summaryLabel: "Araç modeli",
        importance: "quote_critical",
        rank: 80,
        inputHint: "text",
        allowUnknown: true,
      },
      {
        fieldKey: "part",
        prompt: "Hangi yedek parçayı arıyorsunuz? (Motor, şanzıman, aydınlatma gibi)",
        summaryLabel: "Parça",
        importance: "quote_critical",
        rank: 76,
        inputHint: "text",
        allowUnknown: false,
      },
      {
        fieldKey: "partPreference",
        prompt: "Parça tercihiniz nedir?",
        summaryLabel: "Parça tercihi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Sıfır / OEM", value: "Sıfır / OEM" },
          { label: "Çıkma / ikinci el", value: "Çıkma / ikinci el" },
        ],
      },
      {
        fieldKey: "partVehicleYear",
        prompt: "Parçanın uyacağı araç yılı nedir?",
        summaryLabel: "Uyumlu araç yılı",
        importance: "quote_critical",
        rank: 66,
        inputHint: "text",
        allowUnknown: true,
      },
    ],
  },
  {
    whenNeedTypes: ["tire"],
    /**
     * LASTİK AKIŞINA GENEL ÜRÜN SORULARI SIZMAZ (kurucu, 2026-09-12).
     *
     * Ölçüldü: "Araba lastiği arıyorum" akışında kategori geneli `condition`
     * ("Ürün durumu") ve `model` ("Model tercihi") profilleri soruluyordu;
     * lastik için ikisi de anlamsız. Jant ve lastik-servis sözleşmeleri bu
     * kapıyı zaten taşıyordu, lastik sözleşmesi taşımıyordu. Aday anahtar
     * listesi de ortak automotive listesinden ayrıldı: `condition` ve
     * `warranty` lastikte sorulmaz. Bütçe, konum ve zaman küresel çekirdekten
     * gelmeye devam eder.
     */
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      "needType",
      "brand",
      "city",
      "budget",
      "tireItemType",
      "tireSize",
      "tireSeason",
      "tireQuantity",
    ],
    questions: [
      {
        fieldKey: "tireItemType",
        prompt: "Lastik mi, jant mı arıyorsunuz?",
        summaryLabel: "Ürün tipi",
        importance: "quote_critical",
        rank: 74,
        inputHint: "select",
        allowDontCare: false,
        quickChoices: [
          { label: "Lastik", value: "Lastik" },
          { label: "Jant", value: "Jant" },
          { label: "Lastik + jant", value: "Lastik + jant" },
        ],
      },
      {
        fieldKey: "tireSize",
        prompt: "Lastik / jant ebadı nedir?",
        summaryLabel: "Ebat",
        importance: "quote_critical",
        rank: 72,
        inputHint: "text",
        allowUnknown: true,
      },
      {
        fieldKey: "tireSeason",
        prompt: "Mevsim tercihiniz nedir?",
        summaryLabel: "Mevsim",
        importance: "optional",
        rank: 42,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Yaz", value: "Yaz" },
          { label: "Kış", value: "Kış" },
          { label: "Dört mevsim", value: "Dört mevsim" },
        ],
      },
      {
        fieldKey: "tireQuantity",
        prompt: "Kaç adet gerekli?",
        summaryLabel: "Adet",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "1 adet", value: "1" },
          { label: "2 adet", value: "2" },
          { label: "4 adet", value: "4" },
          { label: "4+ adet", value: "4+" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["tire"],
    whenProductTypes: [
      "jant",
      "çelik jant",
      "alaşım jant",
      "forged jant",
      "celik jant",
      "alasim jant",
    ],
    restrictStandardProfiles: true,
    omitDeliveryQuestion: true,
    allowedCandidateFieldKeys: [
      "needType",
      "tireSize",
      "tireQuantity",
      "condition",
      "city",
      "budget",
    ],
    questions: [
      {
        fieldKey: "tireSize",
        prompt: "Jant çapı nedir?",
        summaryLabel: "Jant çapı",
        importance: "quote_critical",
        rank: 76,
        inputHint: "text",
        allowUnknown: true,
      },
      {
        fieldKey: "tireQuantity",
        prompt: "Kaç adet jant gerekli?",
        summaryLabel: "Adet",
        importance: "quote_critical",
        rank: 72,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "1 adet", value: "1" },
          { label: "2 adet", value: "2" },
          { label: "4 adet", value: "4" },
          { label: "4+ adet", value: "4+" },
        ],
      },
      {
        fieldKey: "condition",
        prompt: "Jant sıfır mı, ikinci el mi olsun?",
        summaryLabel: "Durum",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Sıfır", value: "Sıfır" },
          { label: "İkinci el", value: "İkinci el" },
          { label: "Fark etmez", value: "Fark etmez" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["service"],
    restrictStandardProfiles: true,
    omitDeliveryQuestion: true,
    allowedCandidateFieldKeys: [
      "needType",
      "serviceType",
      "brand",
      "model",
      "mileage",
      "city",
      "budget",
    ],
    questions: [
      {
        fieldKey: "brand",
        prompt: "Aracın markası nedir?",
        summaryLabel: "Araç markası",
        importance: "quote_critical",
        rank: 80,
        inputHint: "text",
        allowUnknown: true,
      },
      {
        fieldKey: "model",
        prompt: "Aracın modeli nedir?",
        summaryLabel: "Araç modeli",
        importance: "quote_critical",
        rank: 78,
        inputHint: "text",
        allowUnknown: true,
      },
      {
        fieldKey: "mileage",
        prompt: "Araç kaç kilometrede?",
        summaryLabel: "Kilometre",
        importance: "quote_critical",
        rank: 70,
        inputHint: "number",
        allowUnknown: true,
      },
    ],
  },
  {
    whenNeedTypes: ["tire"],
    whenProductTypes: [
      "lastik değişimi",
      "rot ayarı",
      "balans",
      "lastik otel",
      "lastik saklama",
      "rot balans",
    ],
    restrictStandardProfiles: true,
    omitDeliveryQuestion: true,
    allowedCandidateFieldKeys: [
      "needType",
      "serviceType",
      "tireQuantity",
      "serviceDate",
      "city",
      "budget",
    ],
    questions: [
      {
        fieldKey: "tireQuantity",
        prompt: "Kaç lastik için işlem yapılacak?",
        summaryLabel: "Lastik adedi",
        importance: "quote_critical",
        rank: 70,
        inputHint: "number",
        allowUnknown: true,
      },
      {
        fieldKey: "serviceDate",
        prompt: "İşlem için tahmini tarih nedir?",
        summaryLabel: "Tahmini tarih",
        importance: "quote_critical",
        rank: 66,
        inputHint: "text",
        allowUnknown: true,
      },
    ],
  },
  {
    whenProductTypes: ["koruma filmi", "kaplama", "ppf", "wrapping"],
    restrictStandardProfiles: true,
    omitDeliveryQuestion: true,
    allowedCandidateFieldKeys: [
      "needType",
      "brand",
      "model",
      "color",
      "city",
      "budget",
    ],
    questions: [
      {
        fieldKey: "brand",
        prompt: "Aracın markası nedir?",
        summaryLabel: "Araç markası",
        importance: "quote_critical",
        rank: 80,
        inputHint: "text",
        allowUnknown: true,
      },
      {
        fieldKey: "model",
        prompt: "Aracın modeli nedir?",
        summaryLabel: "Araç modeli",
        importance: "quote_critical",
        rank: 78,
        inputHint: "text",
        allowUnknown: true,
      },
      {
        fieldKey: "color",
        prompt: "Renk / şeffaflık tercihiniz nedir?",
        summaryLabel: "Renk / şeffaflık",
        importance: "quote_critical",
        rank: 68,
        inputHint: "text",
        allowUnknown: true,
      },
    ],
  },
  {
    whenProductTypes: ["aksesuar", "oto aksesuar", "çeki demiri", "tavan", "bagaj sistemleri"],
    restrictStandardProfiles: true,
    omitDeliveryQuestion: true,
    allowedCandidateFieldKeys: ["needType", "brand", "model", "city", "budget"],
    questions: [
      {
        fieldKey: "brand",
        prompt: "Aracın markası nedir?",
        summaryLabel: "Araç markası",
        importance: "quote_critical",
        rank: 80,
        inputHint: "text",
        allowUnknown: true,
      },
      {
        fieldKey: "model",
        prompt: "Aracın modeli nedir?",
        summaryLabel: "Araç modeli",
        importance: "quote_critical",
        rank: 78,
        inputHint: "text",
        allowUnknown: true,
      },
    ],
  },
];

const MACHINERY_COMMON_CANDIDATE_KEYS = [
  "needType",
  "machineType",
  "brand",
  "condition",
  "quantity",
  "city",
  "delivery",
  "budget",
];

/**
 * Makine sözleşmeleri yalnız ürün ailesinin teknik gerçeklerini sorar.
 * Yedek parça niyeti ayrı sözleşmeye bırakılır: bir forklift yedek parçası
 * kaldırma kapasitesi görmemelidir.
 */
const MACHINERY_PRODUCT_QUESTION_CONTRACTS: ProductQuestionContract[] = [
  PRODUCT_SERVICE_QUESTION_CONTRACT,
  {
    // Protective consumables share the hardware category, not machine specs.
    whenProductTypes: ["koruyucu eldiven"],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: ["quantity", "city", "delivery", "budget"],
    questions: [],
  },
  {
    // Makine yedek parçasında teknik sınıflandırmayı talep metnine ve
    // serbest forma bırakıyoruz. Kullanıcıyı CNC ekseni, kaldırma kapasitesi
    // ya da voltaj gibi parça için çoğu kez yanıltıcı sorularla yormuyoruz.
    whenNeedTypes: ["part"],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: ["needType", "partPreference"],
    questions: [
      {
        fieldKey: "partPreference",
        prompt: "Orijinal mi, muadil parça mı arıyorsunuz?",
        summaryLabel: "Parça tercihi",
        importance: "quote_critical",
        rank: 76,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Orijinal", value: "Orijinal" },
          { label: "Muadil", value: "Muadil" },
        ],
      },
    ],
  },
  {
    // Jeneratör için fiyat/eşleşmeyi belirleyen iki teknik eksen kVA ve
    // yakıttır. Faz, ATS ve ses seviyesi gibi detaylar serbest forma kalır.
    whenNeedTypes: ["machine"],
    whenProductTypes: ["jeneratör", "jenerator", "generator"],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      "needType",
      "condition",
      "generatorPower",
      "generatorFuel",
    ],
    questions: [
      {
        fieldKey: "generatorFuel",
        prompt: "Hangi yakıt türünü tercih ediyorsunuz?",
        summaryLabel: "Yakıt türü",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Dizel", value: "Dizel" },
          { label: "Benzin", value: "Benzin" },
          { label: "LPG / doğalgaz", value: "LPG / doğalgaz" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: [
      "mini ekskavatör",
      "mini ekskavator",
      "mini excavator",
    ],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      "needType",
      "condition",
      "excavatorWeightClass",
      "excavatorAttachment",
      "miniExcavatorDigDepth",
      "miniExcavatorCabin",
      "operatingHours",
    ],
    questions: [
      {
        fieldKey: "excavatorWeightClass",
        prompt: "Hangi çalışma ağırlığı sınıfı gerekli?",
        summaryLabel: "Makine sınıfı",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "3 tona kadar", value: "≤3 ton" },
          { label: "3–6 ton", value: "3-6 ton" },
          { label: "6–10 ton", value: "6-10 ton" },
          { label: "10 ton üzeri", value: "10+ ton" },
        ],
      },
      {
        fieldKey: "excavatorAttachment",
        prompt: "Öncelikli ataşman ihtiyacınız nedir?",
        summaryLabel: "Ataşman",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Standart kepçe", value: "Standart kepçe" },
          { label: "Kırıcı", value: "Kırıcı" },
          { label: "Burgu", value: "Burgu" },
          { label: "Ataşman gerekmiyor", value: "Gerekmiyor" },
        ],
      },
      {
        fieldKey: "miniExcavatorDigDepth",
        prompt: "Minimum kazı derinliği ihtiyacınız nedir?",
        summaryLabel: "Kazı derinliği",
        importance: "quote_critical",
        rank: 60,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "2,5 metreye kadar", value: "≤2,5 m" },
          { label: "2,5–3,5 metre", value: "2,5-3,5 m" },
          { label: "3,5 metre üzeri", value: "3,5+ m" },
        ],
      },
      {
        fieldKey: "miniExcavatorCabin",
        prompt: "Kabin tercihiniz nedir?",
        summaryLabel: "Kabin",
        importance: "optional",
        rank: 48,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Kapalı kabin", value: "Kapalı kabin" },
          { label: "Açık kabin yeterli", value: "Açık kabin" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: [
      "ekskavatör",
      "ekskavator",
      "excavator",
      "paletli ekskavatör",
      "paletli ekskavator",
      "lastikli ekskavatör",
      "lastikli ekskavator",
    ],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      "needType",
      "condition",
      "fullExcavatorWeightClass",
      "fullExcavatorAttachment",
      "excavatorUndercarriage",
      "fullExcavatorDigDepth",
      "operatingHours",
    ],
    questions: [
      {
        fieldKey: "fullExcavatorWeightClass",
        prompt: "Hangi çalışma ağırlığı sınıfı gerekli?",
        summaryLabel: "Makine sınıfı",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "10–20 ton", value: "10-20 ton" },
          { label: "20–30 ton", value: "20-30 ton" },
          { label: "30–45 ton", value: "30-45 ton" },
          { label: "45 ton üzeri", value: "45+ ton" },
        ],
      },
      {
        fieldKey: "fullExcavatorAttachment",
        prompt: "Öncelikli ataşman ihtiyacınız nedir?",
        summaryLabel: "Ataşman",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Standart kepçe", value: "Standart kepçe" },
          { label: "Hidrolik kırıcı", value: "Hidrolik kırıcı" },
          { label: "Kıskaç / grapple", value: "Kıskaç / grapple" },
          { label: "Riper", value: "Riper" },
        ],
      },
      {
        fieldKey: "excavatorUndercarriage",
        prompt: "Paletli mi, lastikli mi gerekli?",
        summaryLabel: "Yürüyüş takımı",
        importance: "quote_critical",
        rank: 60,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Paletli", value: "Paletli" },
          { label: "Lastikli", value: "Lastikli" },
        ],
      },
      {
        fieldKey: "fullExcavatorDigDepth",
        prompt: "Minimum kazı derinliği ihtiyacınız nedir?",
        summaryLabel: "Kazı derinliği",
        importance: "quote_critical",
        rank: 58,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "5 metreye kadar", value: "≤5 m" },
          { label: "5–7 metre", value: "5-7 m" },
          { label: "7 metre üzeri", value: "7+ m" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: [
      "yükleyici",
      "yukleyici",
      "loder",
      "loader",
      "beko loder",
    ],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      "needType",
      "condition",
      "loaderCapacity",
      "loaderAttachment",
      "loaderMachineType",
      "loaderLiftHeight",
      "operatingHours",
    ],
    questions: [
      {
        fieldKey: "loaderCapacity",
        prompt: "Hangi yükleme kapasitesi sınıfı gerekli?",
        summaryLabel: "Yükleme kapasitesi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "2 tona kadar", value: "≤2 ton" },
          { label: "2–3 ton", value: "2-3 ton" },
          { label: "3–5 ton", value: "3-5 ton" },
          { label: "5 ton üzeri", value: "5+ ton" },
        ],
      },
      {
        fieldKey: "loaderAttachment",
        prompt: "Öncelikli ataşman ihtiyacınız nedir?",
        summaryLabel: "Ataşman",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Standart kepçe", value: "Standart kepçe" },
          { label: "Palet çatalı", value: "Palet çatalı" },
          { label: "Kıskaç / grapple", value: "Kıskaç / grapple" },
          { label: "Ataşman gerekmiyor", value: "Gerekmiyor" },
        ],
      },
      {
        fieldKey: "loaderMachineType",
        prompt: "Hangi yükleyici düzeni gerekli?",
        summaryLabel: "Yükleyici tipi",
        importance: "quote_critical",
        rank: 60,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Tekerlekli yükleyici", value: "Tekerlekli" },
          { label: "Beko loder", value: "Beko loder" },
          { label: "Paletli yükleyici", value: "Paletli" },
        ],
      },
      {
        fieldKey: "loaderLiftHeight",
        prompt: "Minimum kaldırma yüksekliği ihtiyacınız nedir?",
        summaryLabel: "Kaldırma yüksekliği",
        importance: "optional",
        rank: 48,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "3 metreye kadar", value: "≤3 m" },
          { label: "3–4,5 metre", value: "3-4,5 m" },
          { label: "4,5 metre üzeri", value: "4,5+ m" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: ["beton santrali", "hazır beton santrali"],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      "needType",
      "condition",
      "concretePlantType",
      "concretePlantCapacity",
    ],
    questions: [
      {
        fieldKey: "concretePlantType",
        prompt: "Hangi santral tipine ihtiyacınız var?",
        summaryLabel: "Santral tipi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Sabit santral", value: "Sabit" },
          { label: "Mobil santral", value: "Mobil" },
          { label: "Tercihim yok", value: "Fark etmez" },
        ],
      },
      {
        fieldKey: "concretePlantCapacity",
        prompt: "Hangi saatlik üretim kapasitesi gerekli?",
        summaryLabel: "Saatlik kapasite",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "30 m³/saat'e kadar", value: "≤30 m³/saat" },
          { label: "30–60 m³/saat", value: "30-60 m³/saat" },
          { label: "60–120 m³/saat", value: "60-120 m³/saat" },
          { label: "120 m³/saat üzeri", value: "120+ m³/saat" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: ["beton pompası", "beton pompasi"],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      "needType",
      "condition",
      "concretePumpType",
      "concretePumpReach",
    ],
    questions: [
      {
        fieldKey: "concretePumpType",
        prompt: "Hangi pompa tipine ihtiyacınız var?",
        summaryLabel: "Pompa tipi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Bomlu pompa", value: "Bomlu" },
          { label: "Sabit hat pompası", value: "Sabit hat" },
          { label: "Tercihim yok", value: "Fark etmez" },
        ],
      },
      {
        fieldKey: "concretePumpReach",
        prompt: "Hangi erişim / bom uzunluğu sınıfı gerekli?",
        summaryLabel: "Erişim sınıfı",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "28 metreye kadar", value: "≤28 m" },
          { label: "28–42 metre", value: "28-42 m" },
          { label: "42 metre üzeri", value: "42+ m" },
          { label: "Erişim sınıfı fark etmez", value: "Fark etmez" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: ["kule vinç", "kule vinc", "tower crane"],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      "needType",
      "condition",
      "towerCraneCapacity",
      "towerCraneJibLength",
      "towerCraneHookHeight",
      "towerCraneMounting",
    ],
    questions: [
      {
        fieldKey: "towerCraneCapacity",
        prompt: "Hangi kaldırma kapasitesi sınıfı gerekli?",
        summaryLabel: "Kaldırma kapasitesi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "5 tona kadar", value: "≤5 ton" },
          { label: "5–10 ton", value: "5-10 ton" },
          { label: "10–16 ton", value: "10-16 ton" },
          { label: "16 ton üzeri", value: "16+ ton" },
        ],
      },
      {
        fieldKey: "towerCraneJibLength",
        prompt: "Hangi bom / jib uzunluğu sınıfı gerekli?",
        summaryLabel: "Bom uzunluğu",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "40 metreye kadar", value: "≤40 m" },
          { label: "40–60 metre", value: "40-60 m" },
          { label: "60 metre üzeri", value: "60+ m" },
          { label: "Uzunluk fark etmez", value: "Fark etmez" },
        ],
      },
      {
        fieldKey: "towerCraneHookHeight",
        prompt: "Minimum kanca yüksekliği ihtiyacınız nedir?",
        summaryLabel: "Kanca yüksekliği",
        importance: "quote_critical",
        rank: 60,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "40 metreye kadar", value: "≤40 m" },
          { label: "40–70 metre", value: "40-70 m" },
          { label: "70 metre üzeri", value: "70+ m" },
        ],
      },
      {
        fieldKey: "towerCraneMounting",
        prompt: "Kurulum tipi tercihiniz nedir?",
        summaryLabel: "Kurulum tipi",
        importance: "optional",
        rank: 48,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Sabit temel", value: "Sabit temel" },
          { label: "Raylı", value: "Raylı" },
          { label: "İç tırmanır", value: "İç tırmanır" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: ["mobil vinç", "mobil vinc", "mobile crane"],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      "needType",
      "condition",
      "mobileCraneCapacity",
      "mobileCraneReach",
      "mobileCraneSiteAccess",
    ],
    questions: [
      {
        fieldKey: "mobileCraneCapacity",
        prompt: "Hangi kaldırma kapasitesi sınıfı gerekli?",
        summaryLabel: "Kaldırma kapasitesi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "25 tona kadar", value: "≤25 ton" },
          { label: "25–50 ton", value: "25-50 ton" },
          { label: "50–100 ton", value: "50-100 ton" },
          { label: "100 ton üzeri", value: "100+ ton" },
        ],
      },
      {
        fieldKey: "mobileCraneReach",
        prompt: "Hangi erişim / bom uzunluğu sınıfı gerekli?",
        summaryLabel: "Erişim sınıfı",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "30 metreye kadar", value: "≤30 m" },
          { label: "30–50 metre", value: "30-50 m" },
          { label: "50 metre üzeri", value: "50+ m" },
          { label: "Erişim fark etmez", value: "Fark etmez" },
        ],
      },
      {
        fieldKey: "mobileCraneSiteAccess",
        prompt: "Dar veya zorlu sahada çalışma gerekli mi?",
        summaryLabel: "Saha erişimi",
        importance: "optional",
        rank: 48,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Dar şehir içi saha", value: "Dar saha" },
          { label: "Arazi / şantiye", value: "Arazi / şantiye" },
          { label: "Özel gereksinim yok", value: "Yok" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: [
      "silindir (kompaktör)",
      "silindir (kompaktor)",
      "kompaktör",
      "kompaktor",
      "road roller",
    ],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      "needType",
      "condition",
      "compactorType",
      "compactorWeightClass",
    ],
    questions: [
      {
        fieldKey: "compactorType",
        prompt: "Hangi silindir / kompaktör tipi gerekli?",
        summaryLabel: "Makine tipi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Tek tamburlu", value: "Tek tamburlu" },
          { label: "Çift tamburlu", value: "Çift tamburlu" },
          { label: "Lastik tekerlekli", value: "Lastik tekerlekli" },
          { label: "El kompaktörü", value: "El kompaktörü" },
        ],
      },
      {
        fieldKey: "compactorWeightClass",
        prompt: "Hangi çalışma ağırlığı sınıfı gerekli?",
        summaryLabel: "Makine sınıfı",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "3 tona kadar", value: "≤3 ton" },
          { label: "3–7 ton", value: "3-7 ton" },
          { label: "7–12 ton", value: "7-12 ton" },
          { label: "12 ton üzeri", value: "12+ ton" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: [
      "ağaç yonga makineleri",
      "ağaç yonga makinesi",
      "agac yonga makineleri",
      "agac yonga makinesi",
      "dal öğütücü",
      "dal ogutucu",
      "wood chipper",
    ],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      "needType",
      "condition",
      "woodChipperFeedDiameter",
      "woodChipperDriveType",
    ],
    questions: [
      {
        fieldKey: "woodChipperFeedDiameter",
        prompt: "Maksimum dal / odun çapı ne olmalı?",
        summaryLabel: "Besleme çapı",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "10 cm'ye kadar", value: "≤10 cm" },
          { label: "10–20 cm", value: "10-20 cm" },
          { label: "20–30 cm", value: "20-30 cm" },
          { label: "30 cm üzeri", value: "30+ cm" },
        ],
      },
      {
        fieldKey: "woodChipperDriveType",
        prompt: "Hangi tahrik tipi gerekli?",
        summaryLabel: "Tahrik tipi",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Elektrikli", value: "Elektrikli" },
          { label: "Benzinli / dizel", value: "Yakıtlı" },
          { label: "Traktör PTO", value: "Traktör PTO" },
          { label: "Tahrik fark etmez", value: "Fark etmez" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: [
      "arazi ölçümü",
      "arazi olcumu",
      "arazi ölçüm cihazı",
      "arazi olcum cihazi",
      "gnss",
      "gps rtk",
      "total station",
      "teodolit",
      "nivelman",
    ],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      "needType",
      "condition",
      "surveyEquipmentType",
      "surveyAccuracyLevel",
      "surveyCorrectionSource",
      "surveyDataExport",
    ],
    questions: [
      {
        fieldKey: "surveyEquipmentType",
        prompt: "Hangi arazi ölçüm cihazı türü gerekli?",
        summaryLabel: "Cihaz türü",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "GNSS / RTK", value: "GNSS / RTK" },
          { label: "Total station", value: "Total station" },
          { label: "Nivo / teodolit", value: "Nivo / teodolit" },
          { label: "Cihaz türü fark etmez", value: "Fark etmez" },
        ],
      },
      {
        fieldKey: "surveyAccuracyLevel",
        prompt: "Hangi ölçüm hassasiyeti gerekli?",
        summaryLabel: "Hassasiyet",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Santimetre düzeyi", value: "Santimetre" },
          { label: "Milimetre düzeyi", value: "Milimetre" },
          { label: "Temel ölçüm yeterli", value: "Temel" },
          { label: "Hassasiyet fark etmez", value: "Fark etmez" },
        ],
      },
      {
        fieldKey: "surveyCorrectionSource",
        prompt: "RTK düzeltme bağlantısı gerekli mi?",
        summaryLabel: "RTK bağlantısı",
        importance: "quote_critical",
        rank: 60,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "CORS / network RTK", value: "CORS / network" },
          { label: "Kendi base-rover seti", value: "Base-rover" },
          { label: "Gerekli değil", value: "Gerekli değil" },
        ],
      },
      {
        fieldKey: "surveyDataExport",
        prompt: "CAD veya GIS veri çıktısı gerekli mi?",
        summaryLabel: "Veri çıktısı",
        importance: "optional",
        rank: 48,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "CAD / DXF gerekli", value: "CAD / DXF" },
          { label: "GIS gerekli", value: "GIS" },
          { label: "Temel çıktı yeterli", value: "Temel çıktı" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: ["traktör", "traktor", "tractor"],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      "needType",
      "condition",
      "brand",
      "tractorPowerClass",
      "tractorDriveType",
      "tractorCabinType",
      "tractorLoaderNeed",
    ],
    questions: [
      {
        fieldKey: "tractorPowerClass",
        prompt: "Hangi motor gücü sınıfı gerekli?",
        summaryLabel: "Motor gücü",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "50 HP'ye kadar", value: "≤50 HP" },
          { label: "50–75 HP", value: "50-75 HP" },
          { label: "75–110 HP", value: "75-110 HP" },
          { label: "110 HP üzeri", value: "110+ HP" },
        ],
      },
      {
        fieldKey: "tractorDriveType",
        prompt: "Hangi çekiş tipi gerekli?",
        summaryLabel: "Çekiş tipi",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "2 çeker", value: "2WD" },
          { label: "4 çeker", value: "4WD" },
          { label: "Çekiş tipi fark etmez", value: "Fark etmez" },
        ],
      },
      {
        fieldKey: "tractorCabinType",
        prompt: "Kabin tercihiniz nedir?",
        summaryLabel: "Kabin",
        importance: "optional",
        rank: 60,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Kapalı kabin", value: "Kapalı kabin" },
          { label: "Açık kabin yeterli", value: "Açık kabin" },
        ],
      },
      {
        fieldKey: "tractorLoaderNeed",
        prompt: "Ön yükleyici gerekli mi?",
        summaryLabel: "Ön yükleyici",
        importance: "optional",
        rank: 48,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Gerekli", value: "Gerekli" },
          { label: "Gerekli değil", value: "Gerekli değil" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: ["balya makinesi", "balya", "baler"],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      "needType",
      "condition",
      "balerForm",
      "balerCropType",
    ],
    questions: [
      {
        fieldKey: "balerForm",
        prompt: "Hangi balya formu gerekli?",
        summaryLabel: "Balya formu",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Yuvarlak balya", value: "Yuvarlak" },
          { label: "Kare / dikdörtgen balya", value: "Kare / dikdörtgen" },
          { label: "Balya formu fark etmez", value: "Fark etmez" },
        ],
      },
      {
        fieldKey: "balerCropType",
        prompt: "En çok hangi materyal için kullanılacak?",
        summaryLabel: "Materyal",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Saman", value: "Saman" },
          { label: "Yonca / ot", value: "Yonca / ot" },
          { label: "Sap / hasat artığı", value: "Sap / hasat artığı" },
          { label: "Materyal fark etmez", value: "Fark etmez" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: [
      "mibzer",
      "ekim makinesi",
      "pnömatik ekim",
      "pnomatik ekim",
      "seeder",
    ],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      "needType",
      "condition",
      "seederMethod",
      "seederWorkingWidth",
    ],
    questions: [
      {
        fieldKey: "seederMethod",
        prompt: "Ekim makinesi (mibzer) hangi ekim yöntemi için gerekli?",
        summaryLabel: "Ekim yöntemi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Tahıl ekimi", value: "Tahıl" },
          { label: "Hassas ekim (mısır / ayçiçeği)", value: "Hassas ekim" },
          { label: "Üniversal", value: "Üniversal" },
          { label: "Ekim yöntemi fark etmez", value: "Fark etmez" },
        ],
      },
      {
        fieldKey: "seederWorkingWidth",
        prompt: "Hangi çalışma genişliği gerekli?",
        summaryLabel: "Çalışma genişliği",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "3 metreye kadar", value: "≤3 m" },
          { label: "3–4 metre", value: "3-4 m" },
          { label: "4 metre üzeri", value: "4+ m" },
          { label: "Genişlik fark etmez", value: "Fark etmez" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: ["pulluk", "plow"],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      "needType",
      "condition",
      "plowType",
      "plowFurrowCount",
    ],
    questions: [
      {
        fieldKey: "plowType",
        prompt: "Hangi pulluk tipi gerekli?",
        summaryLabel: "Pulluk tipi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Sabit kulaklı", value: "Sabit kulaklı" },
          { label: "Dönerli", value: "Dönerli" },
          { label: "Diskli", value: "Diskli" },
          { label: "Tip fark etmez", value: "Fark etmez" },
        ],
      },
      {
        fieldKey: "plowFurrowCount",
        prompt: "Kaç kulaklı pulluk gerekli?",
        summaryLabel: "Kulak sayısı",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "2 kulak", value: "2" },
          { label: "3 kulak", value: "3" },
          { label: "4 kulak", value: "4" },
          { label: "5 kulak ve üzeri", value: "5+" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: [
      "süt sağım makinesi",
      "sut sagim makinesi",
      "süt sağım",
      "sut sagim",
      "milking machine",
    ],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      "needType",
      "condition",
      "milkingSystemType",
      "milkingUnitCount",
    ],
    questions: [
      {
        fieldKey: "milkingSystemType",
        prompt: "Hangi sağım sistemi gerekli?",
        summaryLabel: "Sistem tipi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Taşınabilir", value: "Taşınabilir" },
          { label: "Sabit / boru hatlı", value: "Sabit" },
          { label: "Sistem tipi fark etmez", value: "Fark etmez" },
        ],
      },
      {
        fieldKey: "milkingUnitCount",
        prompt: "Aynı anda kaç hayvan için sağım ünitesi gerekli?",
        summaryLabel: "Sağım ünitesi",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "1 ünite", value: "1" },
          { label: "2 ünite", value: "2" },
          { label: "4 ünite", value: "4" },
          { label: "6 ünite ve üzeri", value: "6+" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: [
      "yem karma makinesi",
      "yem karma",
      "yem mikseri",
      "feed mixer",
    ],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      "needType",
      "condition",
      "feedMixerType",
      "feedMixerCapacity",
    ],
    questions: [
      {
        fieldKey: "feedMixerType",
        prompt: "Hangi karıştırıcı düzeni gerekli?",
        summaryLabel: "Karıştırıcı tipi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Dikey", value: "Dikey" },
          { label: "Yatay", value: "Yatay" },
          { label: "Karıştırıcı tipi fark etmez", value: "Fark etmez" },
        ],
      },
      {
        fieldKey: "feedMixerCapacity",
        prompt: "Hangi hazne kapasitesi gerekli?",
        summaryLabel: "Hazne kapasitesi",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "5 m³'e kadar", value: "≤5 m³" },
          { label: "5–10 m³", value: "5-10 m³" },
          { label: "10–20 m³", value: "10-20 m³" },
          { label: "20 m³ üzeri", value: "20+ m³" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: [
      "paketleme makinesi",
      "paketleme hattı",
      "paketleme hatti",
      "shrink paketleme",
      "shrink tunnel",
      "flowpack",
      "yatay paketleme",
      "dikey form-fill-seal",
      "vffs",
      "karton doldurma",
      "cartoner",
      "palet streç",
      "palet strec",
      "pallet wrapper",
      "etiketleme makinesi",
      "labeler",
      "dozaj",
      "dolum makinesi",
      "filler",
      "kapak kapama",
      "capper",
    ],
    allowedCandidateFieldKeys: [
      ...MACHINERY_COMMON_CANDIDATE_KEYS,
      "packagingProcess",
      "packagingFormat",
      "packagingThroughput",
      "packagingAutomation",
    ],
    questions: [
      {
        fieldKey: "packagingProcess",
        prompt: "Hangi paketleme işlemi gerekli?",
        summaryLabel: "Paketleme işlemi",
        importance: "quote_critical",
        rank: 70,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Shrink / streç", value: "Shrink / streç" },
          { label: "Flowpack / poşetleme", value: "Flowpack" },
          { label: "Dikey dolum / VFFS", value: "VFFS" },
          { label: "Kartonlama", value: "Kartonlama" },
          { label: "Etiketleme / kapaklama", value: "Etiketleme / kapaklama" },
        ],
      },
      {
        fieldKey: "packagingFormat",
        prompt: "Hangi ambalaj formatı işlenecek?",
        summaryLabel: "Ambalaj formatı",
        importance: "quote_critical",
        rank: 66,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Poşet / film", value: "Poşet / film" },
          { label: "Şişe / kavanoz", value: "Şişe / kavanoz" },
          { label: "Kutu / karton", value: "Kutu / karton" },
          { label: "Palet", value: "Palet" },
          { label: "Etiketli ürün", value: "Etiketli ürün" },
        ],
      },
      {
        fieldKey: "packagingThroughput",
        prompt: "Hedef üretim hızı nedir?",
        summaryLabel: "Hat hızı",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "30 adede kadar / dk", value: "≤30 adet/dk" },
          { label: "30–80 adet / dk", value: "30-80 adet/dk" },
          { label: "80–150 adet / dk", value: "80-150 adet/dk" },
          { label: "150+ adet / dk", value: "150+ adet/dk" },
        ],
      },
      {
        fieldKey: "packagingAutomation",
        prompt: "Otomasyon seviyesi tercihiniz nedir?",
        summaryLabel: "Otomasyon",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Manuel destekli", value: "Manuel destekli" },
          { label: "Yarı otomatik", value: "Yarı otomatik" },
          { label: "Tam otomatik hat", value: "Tam otomatik" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: [
      "kesim teknolojisi",
      "lazer kesim",
      "fiber lazer",
      "laser cutter",
      "plazma kesim",
      "oksijen kesim",
      "su jeti",
      "waterjet",
      "giyotin kesim",
      "şerit testere",
      "serit testere",
      "disk testere",
      "cnc router",
      "ahşap kesim",
      "ahsap kesim",
    ],
    allowedCandidateFieldKeys: [
      ...MACHINERY_COMMON_CANDIDATE_KEYS,
      "cuttingTechnology",
      "cuttingMaterial",
      "dimensions",
      "cuttingThickness",
    ],
    measurementContracts: {
      dimensions: {
        kind: "physical_dimensions",
        axes: ["width", "height"],
        unit: "mm",
        example: "1.500 × 3.000 mm",
      },
    },
    questions: [
      {
        fieldKey: "cuttingTechnology",
        prompt: "Hangi kesim teknolojisi gerekli?",
        summaryLabel: "Kesim yöntemi",
        importance: "quote_critical",
        rank: 70,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Fiber lazer", value: "Fiber lazer" },
          { label: "Plazma", value: "Plazma" },
          { label: "Oksijen", value: "Oksijen" },
          { label: "Su jeti", value: "Su jeti" },
          { label: "Testere / router", value: "Testere / router" },
        ],
      },
      {
        fieldKey: "cuttingMaterial",
        prompt: "Başlıca hangi malzeme kesilecek?",
        summaryLabel: "İşlenecek malzeme",
        importance: "quote_critical",
        rank: 66,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Sac / metal", value: "Metal" },
          { label: "Paslanmaz", value: "Paslanmaz" },
          { label: "Ahşap / MDF", value: "Ahşap / MDF" },
          { label: "Plastik / kompozit", value: "Plastik / kompozit" },
          { label: "Taş / cam", value: "Taş / cam" },
        ],
      },
      {
        fieldKey: "dimensions",
        prompt: "Gerekli kesim tablası / çalışma alanı nedir?",
        summaryLabel: "Kesim alanı",
        importance: "quote_critical",
        rank: 64,
        inputHint: "text",
        allowUnknown: true,
      },
      {
        fieldKey: "cuttingThickness",
        prompt: "Hedef malzeme kalınlığı nedir?",
        summaryLabel: "Malzeme kalınlığı",
        importance: "optional",
        rank: 40,
        inputHint: "text",
        allowUnknown: true,
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: [
      "cnc",
      "torna",
      "freze",
      "işleme merkezi",
      "isleme merkezi",
      "taşlama",
      "taslama",
      "edm",
      "elektroerozyon",
    ],
    allowedCandidateFieldKeys: [
      ...MACHINERY_COMMON_CANDIDATE_KEYS,
      "dimensions",
      "machiningControl",
      "machiningPrecision",
    ],
    measurementContracts: {
      dimensions: {
        kind: "physical_dimensions",
        axes: ["width", "depth", "height"],
        unit: "mm",
        example: "800 × 500 × 500 mm",
      },
    },
    questions: [
      {
        fieldKey: "machiningControl",
        prompt: "Kontrol / çalışma tipi nasıl olmalı?",
        summaryLabel: "Kontrol tipi",
        importance: "quote_critical",
        rank: 70,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "CNC kontrollü", value: "CNC" },
          { label: "Manuel / universal", value: "Manuel" },
          { label: "Otomatik takım değiştiricili", value: "Otomatik takım değiştirici" },
        ],
      },
      {
        fieldKey: "dimensions",
        prompt: "Gerekli işleme alanı / strok ölçüsü nedir?",
        summaryLabel: "İşleme alanı",
        importance: "quote_critical",
        rank: 66,
        inputHint: "text",
        allowUnknown: true,
      },
      {
        fieldKey: "machiningPrecision",
        prompt: "Hassasiyet veya işleme önceliğiniz var mı?",
        summaryLabel: "Hassasiyet",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Genel imalat", value: "Genel imalat" },
          { label: "Hassas parça", value: "Hassas" },
          { label: "Seri üretim", value: "Seri üretim" },
          { label: "Kalıp / takım işi", value: "Kalıp / takım" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: [
      "pres",
      "abkant",
      "giyotin",
      "punch",
      "punç",
      "punc",
      "rulo açıcı",
      "rulo acici",
      "straightener",
    ],
    allowedCandidateFieldKeys: [
      ...MACHINERY_COMMON_CANDIDATE_KEYS,
      "formingMachineType",
      "pressCapacity",
      "formingControl",
    ],
    questions: [
      {
        fieldKey: "formingMachineType",
        prompt: "Hangi şekillendirme işlemi için makine gerekli?",
        summaryLabel: "İşlem tipi",
        importance: "quote_critical",
        rank: 70,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Kesme / giyotin", value: "Kesme" },
          { label: "Büküm / abkant", value: "Büküm" },
          { label: "Presleme", value: "Presleme" },
          { label: "Rulo açma / doğrultma", value: "Rulo" },
        ],
      },
      {
        fieldKey: "pressCapacity",
        prompt: "Gerekli presleme kapasitesi nedir?",
        summaryLabel: "Pres kapasitesi",
        importance: "quote_critical",
        rank: 66,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "50 ton altı", value: "<50 ton" },
          { label: "50–150 ton", value: "50-150 ton" },
          { label: "150–300 ton", value: "150-300 ton" },
          { label: "300 ton üzeri", value: "300+ ton" },
        ],
      },
      {
        fieldKey: "formingControl",
        prompt: "Kontrol / otomasyon tercihiniz nedir?",
        summaryLabel: "Kontrol / otomasyon",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Manuel", value: "Manuel" },
          { label: "NC / CNC", value: "NC / CNC" },
          { label: "Servo kontrollü", value: "Servo" },
          { label: "Otomatik beslemeli", value: "Otomatik besleme" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: [
      "plastik enjeksiyon",
      "enjeksiyon makinesi",
      "şişirme makinesi",
      "sisirme makinesi",
      "ekstruder",
      "extruder",
      "extrusion",
    ],
    allowedCandidateFieldKeys: [
      ...MACHINERY_COMMON_CANDIDATE_KEYS,
      "plasticProcess",
      "plasticThroughput",
      "plasticMaterial",
    ],
    questions: [
      {
        fieldKey: "plasticProcess",
        prompt: "Hangi plastik işleme yöntemi gerekli?",
        summaryLabel: "İşleme yöntemi",
        importance: "quote_critical",
        rank: 70,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Enjeksiyon", value: "Enjeksiyon" },
          { label: "Şişirme", value: "Şişirme" },
          { label: "Ekstrüzyon", value: "Ekstrüzyon" },
        ],
      },
      {
        fieldKey: "plasticThroughput",
        prompt: "Hedef üretim kapasitesi nedir?",
        summaryLabel: "Üretim kapasitesi",
        importance: "quote_critical",
        rank: 66,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "Düşük / pilot üretim", value: "Düşük" },
          { label: "Orta kapasite", value: "Orta" },
          { label: "Yüksek / seri üretim", value: "Yüksek" },
        ],
      },
      {
        fieldKey: "plasticMaterial",
        prompt: "İşlenecek plastik türü belli mi?",
        summaryLabel: "Malzeme",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "PP / PE", value: "PP / PE" },
          { label: "ABS / PS", value: "ABS / PS" },
          { label: "PET", value: "PET" },
          { label: "Mühendislik plastiği", value: "Mühendislik plastiği" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: [
      "mig",
      "mıg",
      "mag",
      "gazaltı",
      "gazalti",
      "tig",
      "tıg",
      "robot kaynak",
      "spot kaynak",
      "nokta kaynak",
    ],
    allowedCandidateFieldKeys: [
      ...MACHINERY_COMMON_CANDIDATE_KEYS,
      "weldingProcess",
      "weldingPower",
      "weldingAutomation",
    ],
    questions: [
      {
        fieldKey: "weldingProcess",
        prompt: "Hangi kaynak işlemi gerekli?",
        summaryLabel: "Kaynak tipi",
        importance: "quote_critical",
        rank: 70,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "MIG / MAG", value: "MIG / MAG" },
          { label: "TIG", value: "TIG" },
          { label: "Spot / nokta kaynak", value: "Spot" },
          { label: "Robotik hücre", value: "Robotik" },
        ],
      },
      {
        fieldKey: "weldingPower",
        prompt: "Gerekli kaynak akımı / güç aralığı nedir?",
        summaryLabel: "Kaynak gücü",
        importance: "quote_critical",
        rank: 66,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "200 A altı", value: "<200 A" },
          { label: "200–350 A", value: "200-350 A" },
          { label: "350 A üzeri", value: "350+ A" },
        ],
      },
      {
        fieldKey: "weldingAutomation",
        prompt: "Otomasyon seviyesi tercihiniz nedir?",
        summaryLabel: "Otomasyon",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Manuel", value: "Manuel" },
          { label: "Yarı otomatik", value: "Yarı otomatik" },
          { label: "Robotik / otomatik", value: "Robotik" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: [
      "kompresör",
      "kompresor",
      "vakum pompası",
      "vakum pompasi",
      "chiller",
      "soğutma grubu",
      "sogutma grubu",
    ],
    allowedCandidateFieldKeys: [
      ...MACHINERY_COMMON_CANDIDATE_KEYS,
      "compressorType",
      "fluidMachineType",
      "fluidCapacity",
      "fluidOperation",
    ],
    questions: [
      {
        fieldKey: "fluidMachineType",
        prompt: "Hangi akışkan / iklimlendirme makinesi gerekli?",
        summaryLabel: "Makine tipi",
        importance: "quote_critical",
        rank: 70,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Hava kompresörü", value: "Kompresör" },
          { label: "Vakum pompası", value: "Vakum pompası" },
          { label: "Endüstriyel chiller", value: "Chiller" },
        ],
      },
      {
        fieldKey: "fluidCapacity",
        prompt: "Gerekli debi / kapasite aralığı nedir?",
        summaryLabel: "Debi / kapasite",
        importance: "quote_critical",
        rank: 66,
        inputHint: "text",
        allowUnknown: true,
      },
      {
        fieldKey: "fluidOperation",
        prompt: "Çalışma önceliğiniz nedir?",
        summaryLabel: "Çalışma önceliği",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Kesintisiz çalışma", value: "Kesintisiz" },
          { label: "Düşük ses", value: "Düşük ses" },
          { label: "Enerji verimliliği", value: "Enerji verimliliği" },
          { label: "Taşınabilir", value: "Taşınabilir" },
        ],
      },
    ],
  },
  {
    whenNeedTypes: ["machine"],
    whenProductTypes: [
      "forklift",
      "reach truck",
      "transpalet",
      "vinç",
      "vinc",
      "monoray",
      "konveyör",
      "konveyor",
    ],
    allowedCandidateFieldKeys: [
      ...MACHINERY_COMMON_CANDIDATE_KEYS,
      "liftCapacity",
      "liftingPowerDrive",
      "liftingOperation",
    ],
    questions: [
      {
        fieldKey: "liftCapacity",
        prompt: "Gerekli kaldırma / taşıma kapasitesi nedir?",
        summaryLabel: "Kapasite",
        importance: "quote_critical",
        rank: 70,
        inputHint: "select",
        allowUnknown: true,
        quickChoices: [
          { label: "1,5–2 ton", value: "1.5-2 ton" },
          { label: "2,5–3 ton", value: "2.5-3 ton" },
          { label: "3–5 ton", value: "3-5 ton" },
          { label: "5 ton üzeri", value: "5+ ton" },
        ],
      },
      {
        fieldKey: "liftingPowerDrive",
        prompt: "Tahrik / güç tipi tercihiniz nedir?",
        summaryLabel: "Tahrik tipi",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Elektrikli", value: "Elektrikli" },
          { label: "Dizel", value: "Dizel" },
          { label: "Manuel", value: "Manuel" },
          { label: "Farklı / uygun olan", value: "Uygun olan" },
        ],
      },
      {
        fieldKey: "liftingOperation",
        prompt: "Ana kullanım alanı nedir?",
        summaryLabel: "Kullanım alanı",
        importance: "optional",
        rank: 40,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Depo içi", value: "Depo içi" },
          { label: "Yükleme / boşaltma", value: "Yükleme / boşaltma" },
          { label: "Üretim hattı", value: "Üretim hattı" },
          { label: "Açık saha", value: "Açık saha" },
        ],
      },
    ],
  },
];

/**
 * Konut sözleşmeleri satış ve kiralama için aynı fiziksel ihtiyacı taşır;
 * ayrım işlem türü/bütçe çekirdeğinde kalır. Daire katı ile villa katı
 * aynı soru değildir, bu yüzden iki aile bilinçli olarak ayrıdır.
 */
const RESIDENTIAL_COMMON_CANDIDATE_KEYS = [
  "listingType",
  "propertyType",
  "roomCount",
  "area",
  "buildingAge",
  "newBuildPreference",
  /**
   * ÖLÇÜLDÜ (2026-09-14): bu üç alan `whenProductTypes: BUILDING_PROPERTY_TYPES`
   * ile tanımlıydı ama hiçbir konut sözleşmesinin izin listesinde yoktu —
   * 19 emlak alanından 7'si hiçbir üründe sorulamıyordu. Isıtma, banyo ve
   * eşya durumu konut aramasının çekirdek sorularıdır; I10 zaten Daire için
   * `heating` bekliyordu (DECIDED-NOT-IMPLEMENTED). Arsa ve ticari aileler
   * ayrı izin listeleri kullandığı için oralara SIZMAZ.
   */
  "heating",
  "bathroomCount",
  "furnished",
  "city",
  "budget",
];

const DETACHED_RESIDENTIAL_CANDIDATE_KEYS = [
  ...RESIDENTIAL_COMMON_CANDIDATE_KEYS,
  "totalFloors",
];

/**
 * Arsa aileleri yapı değil arazidir. İmar türü ürün tipinde seçilir; burada
 * yalnız her arazi aramasında anlamlı olan büyüklük ve tapu tercihi kalır.
 */
const LAND_CANDIDATE_KEYS = [
  "listingType",
  "propertyType",
  "area",
  "deedStatus",
  "city",
  "budget",
];

const COMMERCIAL_PROPERTY_CANDIDATE_KEYS = [
  "listingType",
  "propertyType",
  "area",
  "newBuildPreference",
  "city",
  "budget",
];

const OTHER_REAL_ESTATE_CANDIDATE_KEYS = [
  "listingType",
  "propertyType",
  "newBuildPreference",
  "city",
  "budget",
];

const REAL_ESTATE_PRODUCT_QUESTION_CONTRACTS: ProductQuestionContract[] = [
  {
    whenProductTypes: [
      "daire",
      "rezidans",
      "yalı dairesi",
      "yali dairesi",
      "stüdyo",
      "studyo",
      "dubleks",
    ],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      ...RESIDENTIAL_COMMON_CANDIDATE_KEYS,
      "floor",
      // Asansör yalnız apartman ailesinde anlamlı; müstakil/villa listesine girmez.
      "elevator",
    ],
    questions: [
      {
        fieldKey: "roomCount",
        prompt: "Oda sayısı tercihiniz nedir?",
        summaryLabel: "Oda",
        importance: "quote_critical",
        rank: 76,
        inputHint: "select",
        allowUnknown: true,
      },
      {
        fieldKey: "area",
        prompt: "Minimum metrekare beklentiniz nedir?",
        summaryLabel: "m²",
        importance: "quote_critical",
        rank: 70,
        inputHint: "number",
        allowUnknown: true,
      },
      {
        fieldKey: "floor",
        prompt: "Kat tercihiniz nedir?",
        summaryLabel: "Kat",
        importance: "optional",
        rank: 48,
        inputHint: "text",
        allowDontCare: true,
      },
      {
        fieldKey: "buildingAge",
        prompt: "Bina yaşı için bir tercihiniz var mı?",
        summaryLabel: "Bina yaşı",
        importance: "optional",
        rank: 44,
        inputHint: "number",
        allowDontCare: true,
      },
    ],
  },
  {
    whenProductTypes: [
      "müstakil ev",
      "mustakil ev",
      "villa",
      "çiftlik evi",
      "ciftlik evi",
      "köşk",
      "kosk",
      "yalı",
      "yali",
    ],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: DETACHED_RESIDENTIAL_CANDIDATE_KEYS,
    questions: [
      {
        fieldKey: "roomCount",
        prompt: "Oda sayısı tercihiniz nedir?",
        summaryLabel: "Oda",
        importance: "quote_critical",
        rank: 76,
        inputHint: "select",
        allowUnknown: true,
      },
      {
        fieldKey: "area",
        prompt: "Minimum metrekare beklentiniz nedir?",
        summaryLabel: "m²",
        importance: "quote_critical",
        rank: 70,
        inputHint: "number",
        allowUnknown: true,
      },
      {
        fieldKey: "totalFloors",
        prompt: "Yapı kaç katlı olsun?",
        summaryLabel: "Kat sayısı",
        importance: "optional",
        rank: 50,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Tek katlı", value: "1" },
          { label: "2 katlı", value: "2" },
          { label: "3 katlı", value: "3" },
          { label: "4 kat ve üzeri", value: "4+" },
        ],
      },
      {
        fieldKey: "buildingAge",
        prompt: "Bina yaşı için bir tercihiniz var mı?",
        summaryLabel: "Bina yaşı",
        importance: "optional",
        rank: 44,
        inputHint: "number",
        allowDontCare: true,
      },
    ],
  },
  {
    whenProductTypes: [
      "arsa",
      "imarlı arsa",
      "imarli arsa",
      "konut imarlı arsa",
      "konut imarli arsa",
      "ticari arsa",
      "sanayi arsası",
      "sanayi arsasi",
      "tarla",
    ],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: LAND_CANDIDATE_KEYS,
    questions: [
      {
        fieldKey: "area",
        prompt: "Minimum arazi büyüklüğü ne olsun?",
        summaryLabel: "m²",
        importance: "quote_critical",
        rank: 72,
        inputHint: "number",
        allowUnknown: true,
      },
      {
        fieldKey: "deedStatus",
        prompt: "Tapu tercihiniz var mı?",
        summaryLabel: "Tapu",
        importance: "optional",
        rank: 44,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Müstakil tapu", value: "Müstakil tapu" },
          { label: "Hisseli tapu", value: "Hisseli tapu" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["iş yeri", "is yeri", "isyeri"],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: COMMERCIAL_PROPERTY_CANDIDATE_KEYS,
    questions: [
      {
        fieldKey: "area",
        prompt: "Minimum ticari alan ihtiyacınız nedir?",
        summaryLabel: "m²",
        importance: "quote_critical",
        rank: 72,
        inputHint: "number",
        allowUnknown: true,
      },
    ],
  },
  {
    whenProductTypes: ["ofis", "plaza ofisi"],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      ...COMMERCIAL_PROPERTY_CANDIDATE_KEYS,
      "floor",
      "parking",
    ],
    questions: [
      {
        fieldKey: "area",
        prompt: "Minimum ofis alanı ihtiyacınız nedir?",
        summaryLabel: "m²",
        importance: "quote_critical",
        rank: 72,
        inputHint: "number",
        allowUnknown: true,
      },
      {
        fieldKey: "floor",
        prompt: "Kat tercihiniz var mı?",
        summaryLabel: "Kat",
        importance: "optional",
        rank: 46,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "1–5. kat", value: "1-5. kat" },
          { label: "6. kat ve üzeri", value: "6+ kat" },
        ],
      },
      {
        fieldKey: "parking",
        prompt: "Otopark gerekli mi?",
        summaryLabel: "Otopark",
        importance: "optional",
        rank: 42,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Gerekli", value: "Gerekli" },
          { label: "Gerekli değil", value: "Gerekli değil" },
        ],
      },
    ],
  },
  {
    whenProductTypes: [
      "dükkan / mağaza",
      "dükkan",
      "mağaza",
      "dukkan / magaza",
      "avm ünitesi",
      "avm unitesi",
    ],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      ...COMMERCIAL_PROPERTY_CANDIDATE_KEYS,
      "floor",
      "storefrontNeed",
    ],
    questions: [
      {
        fieldKey: "area",
        prompt: "Minimum mağaza alanı ihtiyacınız nedir?",
        summaryLabel: "m²",
        importance: "quote_critical",
        rank: 72,
        inputHint: "number",
        allowUnknown: true,
      },
      {
        fieldKey: "floor",
        prompt: "Zemin kat tercihiniz var mı?",
        summaryLabel: "Kat",
        importance: "optional",
        rank: 46,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Zemin kat şart", value: "Zemin kat" },
          { label: "Üst kat da olur", value: "Üst kat olur" },
        ],
      },
      {
        fieldKey: "storefrontNeed",
        prompt: "Vitrin veya cadde cephesi gerekli mi?",
        summaryLabel: "Vitrin / cephe",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Vitrin / cadde cephesi şart", value: "Şart" },
          { label: "Gerekli değil", value: "Gerekli değil" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["depo / antrepo"],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      ...COMMERCIAL_PROPERTY_CANDIDATE_KEYS,
      "loadingAccess",
      "ceilingHeight",
    ],
    questions: [
      {
        fieldKey: "area",
        prompt: "Minimum depo / üretim alanı ihtiyacınız nedir?",
        summaryLabel: "m²",
        importance: "quote_critical",
        rank: 72,
        inputHint: "number",
        allowUnknown: true,
      },
      {
        fieldKey: "loadingAccess",
        prompt: "Tır veya kamyon erişimi gerekli mi?",
        summaryLabel: "Yükleme erişimi",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Tır / kamyon girişi şart", value: "Giriş şart" },
          { label: "Yükleme alanı yeterli", value: "Yükleme alanı" },
        ],
      },
      {
        fieldKey: "ceilingHeight",
        prompt: "Minimum tavan yüksekliği ihtiyacınız nedir?",
        summaryLabel: "Tavan yüksekliği",
        importance: "optional",
        rank: 48,
        inputHint: "number",
        allowUnknown: true,
        allowDontCare: true,
      },
    ],
  },
  {
    whenProductTypes: ["fabrika / imalathane"],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      ...COMMERCIAL_PROPERTY_CANDIDATE_KEYS,
      "loadingAccess",
      "ceilingHeight",
      "industrialPower",
    ],
    questions: [
      {
        fieldKey: "area",
        prompt: "Minimum üretim alanı ihtiyacınız nedir?",
        summaryLabel: "m²",
        importance: "quote_critical",
        rank: 72,
        inputHint: "number",
        allowUnknown: true,
      },
      {
        fieldKey: "loadingAccess",
        prompt: "Tır veya kamyon erişimi gerekli mi?",
        summaryLabel: "Yükleme erişimi",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Tır / kamyon girişi şart", value: "Giriş şart" },
          { label: "Yükleme alanı yeterli", value: "Yükleme alanı" },
        ],
      },
      {
        fieldKey: "ceilingHeight",
        prompt: "Minimum tavan yüksekliği ihtiyacınız nedir?",
        summaryLabel: "Tavan yüksekliği",
        importance: "quote_critical",
        rank: 58,
        inputHint: "number",
        allowUnknown: true,
        allowDontCare: true,
      },
      {
        fieldKey: "industrialPower",
        prompt: "Sanayi elektriği / üç faz gerekli mi?",
        summaryLabel: "Elektrik altyapısı",
        importance: "quote_critical",
        rank: 56,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Üç faz gerekli", value: "Üç faz gerekli" },
          { label: "Standart elektrik yeterli", value: "Standart yeterli" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["otel / apart"],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      ...COMMERCIAL_PROPERTY_CANDIDATE_KEYS,
      "roomCount",
      "lodgingPermit",
    ],
    questions: [
      {
        fieldKey: "roomCount",
        prompt: "En az kaç oda olsun?",
        summaryLabel: "Oda",
        importance: "quote_critical",
        rank: 74,
        inputHint: "number",
        allowUnknown: true,
      },
      {
        fieldKey: "area",
        prompt: "Minimum işletme alanı ihtiyacınız nedir?",
        summaryLabel: "m²",
        importance: "quote_critical",
        rank: 72,
        inputHint: "number",
        allowUnknown: true,
      },
      {
        fieldKey: "lodgingPermit",
        prompt: "Konaklama işletmesi ruhsatı gerekli mi?",
        summaryLabel: "Ruhsat",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Mevcut ruhsat gerekli", value: "Mevcut ruhsat gerekli" },
          { label: "Ruhsat süreci yürütülebilir", value: "Süreç yürütülebilir" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["devren işyeri"],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      ...OTHER_REAL_ESTATE_CANDIDATE_KEYS,
      "businessActivity",
      "transferScope",
      "businessPermitStatus",
    ],
    questions: [
      {
        fieldKey: "businessActivity",
        prompt: "Hangi faaliyet alanındaki işletmeyi arıyorsunuz?",
        summaryLabel: "Faaliyet alanı",
        importance: "quote_critical",
        rank: 72,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Kafe / restoran", value: "Kafe / restoran" },
          { label: "Perakende", value: "Perakende" },
          { label: "Hizmet işletmesi", value: "Hizmet" },
          { label: "Atölye / üretim", value: "Atölye / üretim" },
        ],
      },
      {
        fieldKey: "transferScope",
        prompt: "Devir kapsamı ne olsun?",
        summaryLabel: "Devir kapsamı",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Sadece işletme hakkı", value: "İşletme hakkı" },
          { label: "Demirbaşlar dahil", value: "Demirbaş dahil" },
          { label: "Demirbaş ve stok dahil", value: "Demirbaş + stok" },
        ],
      },
      {
        fieldKey: "businessPermitStatus",
        prompt: "Mevcut ruhsat ve izinlerin devre uygun olması gerekli mi?",
        summaryLabel: "Ruhsat / izin",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Mevcut izinler devre uygun olmalı", value: "Devre uygun olmalı" },
          { label: "Süreci ben yürütebilirim", value: "Süreç yürütülebilir" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["müştemilat", "mustemilat"],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      ...OTHER_REAL_ESTATE_CANDIDATE_KEYS,
      "outbuildingUsage",
      "area",
      "independentAccess",
      "utilityInfrastructure",
    ],
    questions: [
      {
        fieldKey: "outbuildingUsage",
        prompt: "Müştemilatı hangi amaçla kullanacaksınız?",
        summaryLabel: "Kullanım amacı",
        importance: "quote_critical",
        rank: 72,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Depolama", value: "Depolama" },
          { label: "Konaklama / misafir alanı", value: "Konaklama" },
          { label: "Atölye", value: "Atölye" },
          { label: "Tarım amaçlı", value: "Tarım" },
        ],
      },
      {
        fieldKey: "area",
        prompt: "Minimum kapalı alan ihtiyacınız nedir?",
        summaryLabel: "m²",
        importance: "quote_critical",
        rank: 68,
        inputHint: "number",
        allowUnknown: true,
      },
      {
        fieldKey: "independentAccess",
        prompt: "Bağımsız giriş gerekli mi?",
        summaryLabel: "Bağımsız giriş",
        importance: "optional",
        rank: 48,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Gerekli", value: "Gerekli" },
          { label: "Gerekli değil", value: "Gerekli değil" },
        ],
      },
      {
        fieldKey: "utilityInfrastructure",
        prompt: "Su ve elektrik altyapısı gerekli mi?",
        summaryLabel: "Altyapı",
        importance: "optional",
        rank: 44,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "İkisi de gerekli", value: "Su + elektrik" },
          { label: "Elektrik yeterli", value: "Elektrik" },
          { label: "Gerekli değil", value: "Gerekli değil" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["kooperatif hissesi"],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      ...OTHER_REAL_ESTATE_CANDIDATE_KEYS,
      "cooperativePurpose",
      "cooperativeStage",
      "cooperativeShareCount",
      "cooperativePaymentPlan",
    ],
    questions: [
      {
        fieldKey: "cooperativePurpose",
        prompt: "Kooperatif projesi hangi amaçla olsun?",
        summaryLabel: "Proje amacı",
        importance: "quote_critical",
        rank: 72,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Konut", value: "Konut" },
          { label: "Arsa", value: "Arsa" },
          { label: "Ticari proje", value: "Ticari" },
        ],
      },
      {
        fieldKey: "cooperativeStage",
        prompt: "Projenin hangi aşamada olmasını tercih edersiniz?",
        summaryLabel: "Proje aşaması",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Başlangıç / planlama", value: "Başlangıç" },
          { label: "İnşaat aşaması", value: "İnşaat" },
          { label: "Teslime yakın", value: "Teslime yakın" },
          { label: "Tamamlanmış", value: "Tamamlanmış" },
        ],
      },
      {
        fieldKey: "cooperativeShareCount",
        prompt: "Kaç hisse arıyorsunuz?",
        summaryLabel: "Hisse adedi",
        importance: "optional",
        rank: 48,
        inputHint: "number",
        allowUnknown: true,
        allowDontCare: true,
      },
      {
        fieldKey: "cooperativePaymentPlan",
        prompt: "Devam eden ödeme planı kabul eder misiniz?",
        summaryLabel: "Ödeme planı",
        importance: "optional",
        rank: 44,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Kabul ederim", value: "Kabul ederim" },
          { label: "Sadece borçsuz hisse", value: "Borçsuz" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["turistik tesis"],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      ...OTHER_REAL_ESTATE_CANDIDATE_KEYS,
      "tourismFacilityType",
      "roomCount",
      "lodgingPermit",
      "tourismOperationStatus",
    ],
    questions: [
      {
        fieldKey: "tourismFacilityType",
        prompt: "Hangi turistik tesis türünü arıyorsunuz?",
        summaryLabel: "Tesis türü",
        importance: "quote_critical",
        rank: 72,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Otel", value: "Otel" },
          { label: "Pansiyon", value: "Pansiyon" },
          { label: "Bungalov tesisi", value: "Bungalov" },
          { label: "Kamp / glamping", value: "Kamp / glamping" },
        ],
      },
      {
        fieldKey: "roomCount",
        prompt: "En az kaç oda veya ünite olsun?",
        summaryLabel: "Oda / ünite",
        importance: "quote_critical",
        rank: 68,
        inputHint: "number",
        allowUnknown: true,
      },
      {
        fieldKey: "lodgingPermit",
        prompt: "Mevcut turizm / konaklama ruhsatı gerekli mi?",
        summaryLabel: "Ruhsat",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Mevcut ruhsat gerekli", value: "Mevcut ruhsat gerekli" },
          { label: "Ruhsat süreci yürütülebilir", value: "Süreç yürütülebilir" },
        ],
      },
      {
        fieldKey: "tourismOperationStatus",
        prompt: "Tesisi hangi işletme durumunda arıyorsunuz?",
        summaryLabel: "İşletme durumu",
        importance: "optional",
        rank: 44,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Hemen işletmeye hazır", value: "Hazır" },
          { label: "Tadilat / dönüşüm olabilir", value: "Dönüşüm olabilir" },
        ],
      },
    ],
  },
  {
    whenProductTypes: ["devre mülk", "devre mulk"],
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [
      ...OTHER_REAL_ESTATE_CANDIDATE_KEYS,
      "timeshareFacilityType",
      "timesharePeriod",
      "timeshareSeason",
    ],
    questions: [
      {
        fieldKey: "timeshareFacilityType",
        prompt: "Hangi tesis türündeki devre mülkü arıyorsunuz?",
        summaryLabel: "Tesis türü",
        importance: "quote_critical",
        rank: 72,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Tatil köyü", value: "Tatil köyü" },
          { label: "Otel", value: "Otel" },
          { label: "Apart / rezidans", value: "Apart / rezidans" },
          { label: "Termal tesis", value: "Termal tesis" },
        ],
      },
      {
        fieldKey: "timesharePeriod",
        prompt: "Kullanım süresi tercihiniz nedir?",
        summaryLabel: "Kullanım süresi",
        importance: "quote_critical",
        rank: 68,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "1 hafta", value: "1 hafta" },
          { label: "2 hafta", value: "2 hafta" },
          { label: "3 hafta ve üzeri", value: "3+ hafta" },
        ],
      },
      {
        fieldKey: "timeshareSeason",
        prompt: "Hangi dönem tercihiniz var?",
        summaryLabel: "Dönem",
        importance: "quote_critical",
        rank: 64,
        inputHint: "select",
        allowDontCare: true,
        quickChoices: [
          { label: "Yaz dönemi", value: "Yaz" },
          { label: "Kış / termal dönemi", value: "Kış / termal" },
          { label: "Bayram dönemi", value: "Bayram" },
          { label: "Dönem fark etmez", value: "Fark etmez" },
        ],
      },
    ],
  },
];

const PRINTING_COMMON_CANDIDATE_KEYS = ["quantity", "city", "delivery", "budget"];

function printingQuestionContract(
  whenProductTypes: string[],
  fieldKeys: string[],
  questions: ProductQuestionContractQuestion[],
): ProductQuestionContract {
  return {
    whenProductTypes,
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [...PRINTING_COMMON_CANDIDATE_KEYS, ...fieldKeys],
    questions,
  };
}

const PRINTING_PRODUCT_QUESTION_CONTRACTS: ProductQuestionContract[] = [
  printingQuestionContract(
    ["karton kutu", "mikro oluklu kutu", "tek oluklu kutu", "çift oluklu kutu", "üç oluklu kutu", "kilitli taban kutu", "teleskopik kutu", "pizza kutusu", "şekerleme kutusu", "parfüm kutusu", "e-ticaret kolisi", "display / stand kutu", "separatörlü kutu"],
    ["boxDimensions", "boxMaterial", "boxPrintCoverage", "boxDieLine", "boxDesignReady"],
    [
      { fieldKey: "boxDimensions", prompt: "Kutunun en × boy × yükseklik ölçüsü nedir?", summaryLabel: "Kutu ölçüsü", importance: "quote_critical", rank: 78, inputHint: "text", allowUnknown: true },
      { fieldKey: "boxMaterial", prompt: "Kutu malzemesi ve dayanımı nasıl olmalı?", summaryLabel: "Malzeme", importance: "quote_critical", rank: 72, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Kraft karton", value: "Kraft" }, { label: "Karton / bristol", value: "Karton" }, { label: "Mikro oluklu", value: "Mikro oluklu" }, { label: "Çift oluklu", value: "Çift oluklu" }] },
      { fieldKey: "boxPrintCoverage", prompt: "Baskı kapsamı nedir?", summaryLabel: "Baskı", importance: "quote_critical", rank: 66, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Baskısız", value: "Baskısız" }, { label: "Tek renk", value: "Tek renk" }, { label: "Çok renkli", value: "Çok renkli" }, { label: "İç ve dış baskı", value: "İç / dış baskı" }] },
      { fieldKey: "boxDieLine", prompt: "Bıçak izi / kesim kalıbı hazır mı?", summaryLabel: "Bıçak izi", importance: "quote_critical", rank: 60, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Hazır", value: "Hazır" }, { label: "Hazırlanacak", value: "Hazırlanacak" }, { label: "Standart kutu yeterli", value: "Standart" }] },
      { fieldKey: "boxDesignReady", prompt: "Baskı tasarım dosyanız hazır mı?", summaryLabel: "Tasarım", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Baskıya hazır", value: "Hazır" }, { label: "Tasarım desteği gerekli", value: "Tasarım gerekli" }] },
    ],
  ),
  printingQuestionContract(
    ["rulo etiket", "yaprak etiket", "şeffaf etiket", "barkod etiketi", "gıda etiketi", "ilaç etiketi", "tekstil etiket", "care label", "güvenlik", "hologram etiket", "termal etiket", "transfer termal etiket"],
    ["labelDimensions", "labelMaterial", "labelAdhesive", "labelFormat", "labelDesignReady"],
    [
      { fieldKey: "labelDimensions", prompt: "Etiketin en × boy ölçüsü nedir?", summaryLabel: "Etiket ölçüsü", importance: "quote_critical", rank: 78, inputHint: "text", allowUnknown: true },
      { fieldKey: "labelMaterial", prompt: "Etiket malzemesi nedir?", summaryLabel: "Malzeme", importance: "quote_critical", rank: 72, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Kuşe", value: "Kuşe" }, { label: "PP / plastik", value: "PP" }, { label: "Şeffaf", value: "Şeffaf" }, { label: "Termal", value: "Termal" }, { label: "Tekstil", value: "Tekstil" }] },
      { fieldKey: "labelAdhesive", prompt: "Yapışkan özelliği nasıl olmalı?", summaryLabel: "Yapışkan", importance: "quote_critical", rank: 66, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Standart", value: "Standart" }, { label: "Güçlü", value: "Güçlü" }, { label: "Sökülebilir", value: "Sökülebilir" }, { label: "Bilmiyorum", value: "Bilmiyorum" }] },
      { fieldKey: "labelFormat", prompt: "Etiket teslim şekli nasıl olsun?", summaryLabel: "Teslim şekli", importance: "optional", rank: 52, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Rulo", value: "Rulo" }, { label: "Yaprak", value: "Yaprak" }, { label: "Tek tek kesilmiş", value: "Tekli" }] },
      { fieldKey: "labelDesignReady", prompt: "Etiket tasarım dosyası hazır mı?", summaryLabel: "Tasarım", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Baskıya hazır", value: "Hazır" }, { label: "Tasarım desteği gerekli", value: "Tasarım gerekli" }] },
    ],
  ),
  printingQuestionContract(
    ["katalog", "kitapçık", "kitapcik", "dergi"],
    ["publicationFormat", "publicationPageCount", "publicationBinding", "publicationPaper", "publicationDesignReady"],
    [
      { fieldKey: "publicationFormat", prompt: "Yayın formatı nedir?", summaryLabel: "Format", importance: "quote_critical", rank: 76, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "A4", value: "A4" }, { label: "A5", value: "A5" }, { label: "Kare", value: "Kare" }, { label: "Özel ölçü", value: "Özel ölçü" }] },
      { fieldKey: "publicationPageCount", prompt: "Yaklaşık kaç iç sayfa olacak?", summaryLabel: "Sayfa sayısı", importance: "quote_critical", rank: 70, inputHint: "text", allowUnknown: true },
      { fieldKey: "publicationBinding", prompt: "Cilt tercihiniz nedir?", summaryLabel: "Cilt", importance: "quote_critical", rank: 64, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Tel dikiş", value: "Tel dikiş" }, { label: "Amerikan cilt", value: "Amerikan cilt" }, { label: "İplik dikiş", value: "İplik dikiş" }, { label: "Bilmiyorum", value: "Bilmiyorum" }] },
      { fieldKey: "publicationPaper", prompt: "İç sayfa / kapak kâğıdı tercihiniz var mı?", summaryLabel: "Kâğıt", importance: "optional", rank: 50, inputHint: "text", allowDontCare: true },
      { fieldKey: "publicationDesignReady", prompt: "Baskı tasarım dosyası hazır mı?", summaryLabel: "Tasarım", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Baskıya hazır", value: "Hazır" }, { label: "Tasarım desteği gerekli", value: "Tasarım gerekli" }] },
    ],
  ),
  printingQuestionContract(
    ["broşür", "brosur", "antetli kağıt", "antetli kagit", "poster / afiş", "poster / afis"],
    ["flatPrintFormat", "flatPrintSides", "flatPrintPaperWeight", "flatPrintFold", "flatPrintDesignReady"],
    [
      { fieldKey: "flatPrintFormat", prompt: "Baskı ölçüsü nedir?", summaryLabel: "Format", importance: "quote_critical", rank: 76, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "A4", value: "A4" }, { label: "A5", value: "A5" }, { label: "A6", value: "A6" }, { label: "Özel ölçü", value: "Özel ölçü" }] },
      { fieldKey: "flatPrintSides", prompt: "Baskı tek yüz mü çift yüz mü?", summaryLabel: "Yüz", importance: "quote_critical", rank: 70, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Tek yüz", value: "Tek yüz" }, { label: "Çift yüz", value: "Çift yüz" }] },
      { fieldKey: "flatPrintPaperWeight", prompt: "Kâğıt gramajı tercihiniz var mı?", summaryLabel: "Gramaj", importance: "optional", rank: 54, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "90–115 gr", value: "90–115 gr" }, { label: "130–170 gr", value: "130–170 gr" }, { label: "200–300 gr", value: "200–300 gr" }] },
      { fieldKey: "flatPrintFold", prompt: "Katlama gerekli mi?", summaryLabel: "Katlama", importance: "optional", rank: 48, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Gerekli değil", value: "Yok" }, { label: "Tek kırımlı", value: "Tek kırımlı" }, { label: "Çift kırımlı", value: "Çift kırımlı" }] },
      { fieldKey: "flatPrintDesignReady", prompt: "Baskı tasarım dosyası hazır mı?", summaryLabel: "Tasarım", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Baskıya hazır", value: "Hazır" }, { label: "Tasarım desteği gerekli", value: "Tasarım gerekli" }] },
    ],
  ),
  /**
   * KARTVİZİT KENDİ SORU AİLESİ (D-0041, kurucu kararı 2026-09-25).
   *
   * Kartvizit "kart ailesi"nin içinde davetiye ve klasörle aynı soruları
   * paylaşıyordu; ayrı alt kategori olunca teklifi belirleyen şeyler de
   * ayrıştı: ebat, kâğıt/gramaj, kaplama ve baskı yüzü teklif için kritik;
   * köşe, özel işlem ve tasarım isteğe bağlı. Teslim zamanı zaten matbaa
   * kökünün ortak alanıdır (`PRINTING_COMMON_CANDIDATE_KEYS`), burada
   * ikinci kez tanımlanmaz. Yayın zorunluluğu icat edilmedi: adet, konum ve
   * bütçe kuralları matbaa kökünde olduğu gibi kalır.
   */
  printingQuestionContract(
    ["kartvizit"],
    ["cardFormat", "cardStock", "cardCoating", "cardPrintSides", "cardFinish", "cardCorner", "cardDesignReady"],
    [
      { fieldKey: "cardFormat", prompt: "Kartvizit ebadı ne olsun?", summaryLabel: "Ebat", importance: "quote_critical", rank: 76, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Standart (85 × 55 mm)", value: "Standart (85 × 55 mm)" }, { label: "Özel ölçü", value: "Özel ölçü" }] },
      { fieldKey: "cardStock", prompt: "Kâğıt ve gramaj tercihiniz nedir?", summaryLabel: "Kâğıt / gramaj", importance: "quote_critical", rank: 68, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Kuşe 300 gr", value: "Kuşe 300 gr" }, { label: "Kuşe 350 gr", value: "Kuşe 350 gr" }, { label: "Bristol 300 gr", value: "Bristol 300 gr" }, { label: "Dokulu kâğıt", value: "Dokulu kâğıt" }, { label: "Bilmiyorum", value: "Bilmiyorum" }] },
      { fieldKey: "cardCoating", prompt: "Kaplama isteniyor mu?", summaryLabel: "Kaplama", importance: "quote_critical", rank: 64, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Mat selefon", value: "Mat selefon" }, { label: "Parlak selefon", value: "Parlak selefon" }, { label: "Yok", value: "Yok" }] },
      { fieldKey: "cardPrintSides", prompt: "Baskı tek yüze mi, çift yüze mi?", summaryLabel: "Baskı yüzü", importance: "quote_critical", rank: 60, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Tek yüz", value: "Tek yüz" }, { label: "Çift yüz", value: "Çift yüz" }] },
      { fieldKey: "cardFinish", prompt: "Özel işlem ister misiniz?", summaryLabel: "Özel işlem", importance: "optional", rank: 50, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Yok", value: "Yok" }, { label: "Yaldız", value: "Yaldız" }, { label: "Kabartma", value: "Kabartma" }, { label: "Lak", value: "Lak" }] },
      { fieldKey: "cardCorner", prompt: "Köşeler nasıl olsun?", summaryLabel: "Köşe", importance: "optional", rank: 46, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Düz", value: "Düz" }, { label: "Oval", value: "Oval" }] },
      { fieldKey: "cardDesignReady", prompt: "Baskı tasarım dosyası hazır mı?", summaryLabel: "Tasarım", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Baskıya hazır", value: "Hazır" }, { label: "Tasarım desteği gerekli", value: "Tasarım gerekli" }] },
    ],
  ),
  printingQuestionContract(
    ["davetiye", "kapak / klasör"],
    ["cardFormat", "cardStock", "cardFinish", "cardDesignReady"],
    [
      { fieldKey: "cardFormat", prompt: "Ölçü veya kart tipi nedir?", summaryLabel: "Kart tipi", importance: "quote_critical", rank: 76, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Davetiye", value: "Davetiye" }, { label: "Klasör / kapak", value: "Klasör / kapak" }, { label: "Özel ölçü", value: "Özel ölçü" }] },
      { fieldKey: "cardStock", prompt: "Kâğıt / karton tercihiniz nedir?", summaryLabel: "Malzeme", importance: "quote_critical", rank: 68, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Kuşe", value: "Kuşe" }, { label: "Bristol", value: "Bristol" }, { label: "Dokulu kâğıt", value: "Dokulu" }, { label: "Bilmiyorum", value: "Bilmiyorum" }] },
      { fieldKey: "cardFinish", prompt: "Özel yüzey işlemi ister misiniz?", summaryLabel: "Yüzey işlemi", importance: "optional", rank: 50, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Yok", value: "Yok" }, { label: "Mat / parlak selefon", value: "Selefon" }, { label: "Kabartma lak", value: "Lak" }, { label: "Yaldız", value: "Yaldız" }] },
      { fieldKey: "cardDesignReady", prompt: "Baskı tasarım dosyası hazır mı?", summaryLabel: "Tasarım", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Baskıya hazır", value: "Hazır" }, { label: "Tasarım desteği gerekli", value: "Tasarım gerekli" }] },
    ],
  ),
  printingQuestionContract(
    ["tişört baskı", "tisort baski", "çanta baskı", "canta baski", "şapka", "sapka", "tekstil aksesuar"],
    ["promoTextilePrintMethod", "promoTextileSizing", "promoTextilePlacement", "promoDesignReady"],
    [
      { fieldKey: "promoTextilePrintMethod", prompt: "Baskı / uygulama yöntemi tercihiniz var mı?", summaryLabel: "Uygulama", importance: "quote_critical", rank: 72, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "DTF", value: "DTF" }, { label: "Serigrafi", value: "Serigrafi" }, { label: "Nakış", value: "Nakış" }, { label: "Bilmiyorum", value: "Bilmiyorum" }] },
      { fieldKey: "promoTextileSizing", prompt: "Beden veya ürün dağılımı nasıl olacak?", summaryLabel: "Beden / dağılım", importance: "quote_critical", rank: 66, inputHint: "text", allowUnknown: true },
      { fieldKey: "promoTextilePlacement", prompt: "Baskı hangi bölgede olacak?", summaryLabel: "Baskı konumu", importance: "optional", rank: 50, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Ön", value: "Ön" }, { label: "Arka", value: "Arka" }, { label: "Ön ve arka", value: "Ön / arka" }, { label: "Kol / yan", value: "Kol / yan" }] },
      { fieldKey: "promoDesignReady", prompt: "Logo / tasarım dosyası hazır mı?", summaryLabel: "Tasarım", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Hazır", value: "Hazır" }, { label: "Tasarım desteği gerekli", value: "Tasarım gerekli" }] },
    ],
  ),
  printingQuestionContract(
    ["kalem baskı", "kupa", "usb", "powerbank", "ajanda", "defter", "magnet", "rozet", "takvim", "anahtarlık", "anahtarlik"],
    ["promoObjectPrintMethod", "promoObjectBrandingArea", "promoObjectPackaging", "promoDesignReady"],
    [
      { fieldKey: "promoObjectPrintMethod", prompt: "Baskı yöntemi tercihiniz var mı?", summaryLabel: "Baskı yöntemi", importance: "quote_critical", rank: 72, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "UV baskı", value: "UV" }, { label: "Lazer kazıma", value: "Lazer" }, { label: "Tampon baskı", value: "Tampon" }, { label: "Bilmiyorum", value: "Bilmiyorum" }] },
      { fieldKey: "promoObjectBrandingArea", prompt: "Logo / baskı alanı nasıl olsun?", summaryLabel: "Baskı alanı", importance: "quote_critical", rank: 66, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Tek yüz", value: "Tek yüz" }, { label: "Çift yüz", value: "Çift yüz" }, { label: "Ürüne göre önerilsin", value: "Öneri" }] },
      { fieldKey: "promoObjectPackaging", prompt: "Tekli kutu veya özel paketleme gerekli mi?", summaryLabel: "Paketleme", importance: "optional", rank: 50, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Gerekli değil", value: "Yok" }, { label: "Tekli kutu", value: "Tekli kutu" }, { label: "Özel paketleme", value: "Özel paketleme" }] },
      { fieldKey: "promoDesignReady", prompt: "Logo / tasarım dosyası hazır mı?", summaryLabel: "Tasarım", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Hazır", value: "Hazır" }, { label: "Tasarım desteği gerekli", value: "Tasarım gerekli" }] },
    ],
  ),
  printingQuestionContract(
    ["büyük format baskı", "afiş", "afis", "branda baskı", "branda baski", "roll-up banner", "fuar standı", "fuar standi", "fuar standları", "fuar stantları", "numune / prototip baskı"],
    ["largeFormatDimensions", "largeFormatPlacement", "largeFormatInstall", "largeFormatDesignReady"],
    [
      { fieldKey: "largeFormatDimensions", prompt: "Baskının en × boy ölçüsü nedir?", summaryLabel: "Ölçü", importance: "quote_critical", rank: 76, inputHint: "text", allowUnknown: true },
      { fieldKey: "largeFormatPlacement", prompt: "Nerede kullanılacak?", summaryLabel: "Kullanım alanı", importance: "quote_critical", rank: 68, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "İç mekân", value: "İç mekân" }, { label: "Dış mekân", value: "Dış mekân" }, { label: "Fuar / etkinlik", value: "Fuar / etkinlik" }] },
      { fieldKey: "largeFormatInstall", prompt: "Montaj / kurulum gerekli mi?", summaryLabel: "Montaj", importance: "optional", rank: 50, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Gerekli değil", value: "Yok" }, { label: "Gerekli", value: "Gerekli" }, { label: "Teklifte belirtin", value: "Belirtin" }] },
      { fieldKey: "largeFormatDesignReady", prompt: "Baskı tasarım dosyası hazır mı?", summaryLabel: "Tasarım", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Baskıya hazır", value: "Hazır" }, { label: "Tasarım desteği gerekli", value: "Tasarım gerekli" }] },
    ],
  ),
  printingQuestionContract(
    ["poşet / torba baskı", "poset / torba baski", "streç / shrink etiket", "strec / shrink etiket", "karton askı / hang tag", "karton aski / hang tag", "sertifika", "kaşe", "kase", "bloknot"],
    ["customPrintSpecs", "customPrintMaterial", "customPrintDesignReady"],
    [
      { fieldKey: "customPrintSpecs", prompt: "Ürün ölçüsü ve istediğiniz temel özellikler nelerdir?", summaryLabel: "Ölçü / özellik", importance: "quote_critical", rank: 72, inputHint: "text", allowUnknown: true },
      { fieldKey: "customPrintMaterial", prompt: "Malzeme veya üretim tercihiniz var mı?", summaryLabel: "Malzeme", importance: "quote_critical", rank: 64, inputHint: "text", allowDontCare: true },
      { fieldKey: "customPrintDesignReady", prompt: "Baskı tasarım dosyası hazır mı?", summaryLabel: "Tasarım", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Baskıya hazır", value: "Hazır" }, { label: "Tasarım desteği gerekli", value: "Tasarım gerekli" }] },
    ],
  ),
];

const HEALTH_COMMON_CANDIDATE_KEYS = [
  "healthProductType", "productName", "usageArea", "certification", "features",
  "condition", "quantity", "city", "delivery", "budget",
];

function healthQuestionContract(
  whenProductTypes: string[],
  fieldKeys: string[],
  questions: ProductQuestionContractQuestion[],
): ProductQuestionContract {
  return {
    whenProductTypes,
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [...HEALTH_COMMON_CANDIDATE_KEYS, ...fieldKeys],
    questions,
  };
}

/** Sağlıkta yalnız tedarik ve kullanım bağlamı toplanır; teşhis/tedavi yoktur. */
const HEALTH_PRODUCT_QUESTION_CONTRACTS: ProductQuestionContract[] = [
  healthQuestionContract(
    ["hasta monitörü", "ventilatör", "ventilator", "defibrilatör", "ultrason cihazı", "ekg cihazı", "infüzyon pompası", "oksijen konsantratörü", "nebulizatör", "tansiyon aleti", "tansiyon ölçer", "tansiyon olcer", "pulse oksimetre"],
    ["medicalDeviceSetting", "medicalDeviceCondition", "medicalDeviceSpec", "medicalDeviceService"],
    [
      { fieldKey: "medicalDeviceSetting", prompt: "Cihaz hangi kullanım ortamı için?", summaryLabel: "Kullanım ortamı", importance: "quote_critical", rank: 74, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Hastane", value: "Hastane" }, { label: "Klinik", value: "Klinik" }, { label: "Evde bakım", value: "Evde bakım" }] },
      { fieldKey: "medicalDeviceCondition", prompt: "Sıfır, yenilenmiş veya ikinci el mi arıyorsunuz?", summaryLabel: "Durum", importance: "quote_critical", rank: 68, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Sıfır", value: "Sıfır" }, { label: "Yenilenmiş", value: "Yenilenmiş" }, { label: "İkinci el", value: "İkinci el" }] },
      { fieldKey: "medicalDeviceSpec", prompt: "Zorunlu teknik özellik veya kapasite nedir?", summaryLabel: "Teknik gereksinim", importance: "quote_critical", rank: 60, inputHint: "text", allowUnknown: true },
      { fieldKey: "medicalDeviceService", prompt: "Kurulum, eğitim veya kalibrasyon gerekli mi?", summaryLabel: "Hizmet ihtiyacı", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Gerekli", value: "Gerekli" }, { label: "Gerekli değil", value: "Gerekli değil" }, { label: "Teklifte belirtin", value: "Belirtin" }] },
    ],
  ),
  healthQuestionContract(
    ["muayene masası", "hasta yatağı", "sedye", "tıbbi dolap", "ecza dolabı", "muayene lambası", "sterilizatör", "otoklav"],
    ["clinicalEquipmentMode", "clinicalDimensions", "clinicalAccessories", "clinicalCondition"],
    [
      { fieldKey: "clinicalEquipmentMode", prompt: "Manuel mi elektrikli / motorlu mu olmalı?", summaryLabel: "Çalışma tipi", importance: "quote_critical", rank: 72, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Manuel", value: "Manuel" }, { label: "Elektrikli / motorlu", value: "Elektrikli" }, { label: "Ürüne göre", value: "Ürüne göre" }] },
      { fieldKey: "clinicalDimensions", prompt: "Ölçü, taşıma kapasitesi veya sterilizasyon hacmi nedir?", summaryLabel: "Kapasite / ölçü", importance: "quote_critical", rank: 66, inputHint: "text", allowUnknown: true },
      { fieldKey: "clinicalAccessories", prompt: "Aksesuar veya ek donanım gerekli mi?", summaryLabel: "Aksesuar", importance: "optional", rank: 50, inputHint: "text", allowDontCare: true },
      { fieldKey: "clinicalCondition", prompt: "Sıfır, yenilenmiş veya ikinci el mi arıyorsunuz?", summaryLabel: "Durum", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Sıfır", value: "Sıfır" }, { label: "Yenilenmiş", value: "Yenilenmiş" }, { label: "İkinci el", value: "İkinci el" }] },
    ],
  ),
  healthQuestionContract(
    ["diş üniti", "apex locator", "kavitron", "scaler", "diş hekimi sandalyesi", "santrifüj", "santrifuj", "mikroskop", "analizör", "analizor"],
    ["labUseCase", "labDeviceSpec", "labCalibration", "labCondition"],
    [
      { fieldKey: "labUseCase", prompt: "Hangi klinik veya laboratuvar kullanımı için?", summaryLabel: "Kullanım", importance: "quote_critical", rank: 72, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Diş kliniği", value: "Diş kliniği" }, { label: "Tıbbi laboratuvar", value: "Laboratuvar" }, { label: "Eğitim / araştırma", value: "Eğitim" }] },
      { fieldKey: "labDeviceSpec", prompt: "Zorunlu teknik özellik, kapasite veya uyumluluk nedir?", summaryLabel: "Teknik gereksinim", importance: "quote_critical", rank: 66, inputHint: "text", allowUnknown: true },
      { fieldKey: "labCalibration", prompt: "Kalibrasyon veya bakım kaydı gerekli mi?", summaryLabel: "Kalibrasyon", importance: "optional", rank: 50, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Gerekli", value: "Gerekli" }, { label: "Gerekli değil", value: "Gerekli değil" }, { label: "Teklifte belirtin", value: "Belirtin" }] },
      { fieldKey: "labCondition", prompt: "Sıfır, yenilenmiş veya ikinci el mi arıyorsunuz?", summaryLabel: "Durum", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Sıfır", value: "Sıfır" }, { label: "Yenilenmiş", value: "Yenilenmiş" }, { label: "İkinci el", value: "İkinci el" }] },
    ],
  ),
  healthQuestionContract(
    ["ortopedi ürünleri", "işitme cihazı", "evde bakım cihazı", "medikal mobilya"],
    ["supportProductUsage", "supportProductFit", "supportProductCondition", "supportProductRequirement"],
    [
      { fieldKey: "supportProductUsage", prompt: "Ürün hangi kullanım ortamı için?", summaryLabel: "Kullanım ortamı", importance: "quote_critical", rank: 72, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Evde kullanım", value: "Ev" }, { label: "Klinik / kurum", value: "Kurum" }, { label: "Bilmiyorum", value: "Bilmiyorum" }] },
      { fieldKey: "supportProductFit", prompt: "Beden, ölçü veya kişiye özel uyum gereksinimi var mı?", summaryLabel: "Ölçü / uyum", importance: "quote_critical", rank: 66, inputHint: "text", allowUnknown: true },
      { fieldKey: "supportProductCondition", prompt: "Sıfır veya ikinci el tercihiniz nedir?", summaryLabel: "Durum", importance: "optional", rank: 50, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Sıfır", value: "Sıfır" }, { label: "İkinci el", value: "İkinci el" }] },
      { fieldKey: "supportProductRequirement", prompt: "Özellikle gerekli bir özellik var mı?", summaryLabel: "Özel gereksinim", importance: "optional", rank: 44, inputHint: "text", allowDontCare: true },
    ],
  ),
];

const SERVICE_COMMON_CANDIDATE_KEYS = ["serviceType", "city", "budget"];

function serviceQuestionContract(
  whenProductTypes: string[],
  fieldKeys: string[],
  questions: ProductQuestionContractQuestion[],
): ProductQuestionContract {
  return {
    whenProductTypes,
    restrictStandardProfiles: true,
    allowedCandidateFieldKeys: [...SERVICE_COMMON_CANDIDATE_KEYS, ...fieldKeys],
    questions,
  };
}

const SERVICES_PRODUCT_QUESTION_CONTRACTS: ProductQuestionContract[] = [
  /* Grafik/logo talepleri şu an bilinçli olarak kısa tutulur: hizmet türü,
     konum ve bütçe yeterlidir; yaratıcı kapsam serbest metinde bırakılır. */
  serviceQuestionContract(
    ["grafik ve logo tasarımı", "grafik ve logo tasarimi", "logo tasarımı", "logo tasarimi", "grafik tasarım", "grafik tasarim"],
    [],
    [],
  ),
  serviceQuestionContract(
    ["evde bakım desteği", "evde bakim destegi", "evde bakım", "evde bakim", "hasta refakati", "yaşlı bakım", "yasli bakim", "hasta bakım", "hasta bakim", "yaşlı bakıcı", "yasli bakici", "hasta bakıcı", "hasta bakici"],
    ["homeCareSupportScope", "homeCareSchedule", "homeCareDuration", "homeCareStart"],
    [
      { fieldKey: "homeCareSupportScope", prompt: "Hangi tür evde bakım / destek hizmetine ihtiyacınız var?", summaryLabel: "Destek türü", importance: "quote_critical", rank: 74, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Günlük yaşam desteği", value: "Günlük yaşam" }, { label: "Refakat", value: "Refakat" }, { label: "Hareket / ulaşım desteği", value: "Hareket / ulaşım" }, { label: "Ev içi destek", value: "Ev içi destek" }] },
      { fieldKey: "homeCareSchedule", prompt: "Hizmet ne sıklıkta gerekli?", summaryLabel: "Sıklık", importance: "quote_critical", rank: 68, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Tek sefer", value: "Tek sefer" }, { label: "Haftada birkaç gün", value: "Haftalık" }, { label: "Her gün", value: "Her gün" }, { label: "Yatılı", value: "Yatılı" }] },
      { fieldKey: "homeCareDuration", prompt: "Bir günde yaklaşık kaç saat destek gerekli?", summaryLabel: "Süre", importance: "optional", rank: 50, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "1–3 saat", value: "1–3 saat" }, { label: "4–8 saat", value: "4–8 saat" }, { label: "8 saatten fazla", value: "8+ saat" }] },
      { fieldKey: "homeCareStart", prompt: "Hizmet ne zaman başlamalı?", summaryLabel: "Başlangıç", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Hemen", value: "Hemen" }, { label: "Bu hafta", value: "Bu hafta" }, { label: "Tarih esnek", value: "Esnek" }] },
    ],
  ),
  serviceQuestionContract(
    [
      "ev yardımcısı / ev hizmetlisi",
      "ev yardimcisi / ev hizmetlisi",
      "ev yardımcısı",
      "ev yardimcisi",
      "evde yardımcı",
      "evde yardimci",
      "ev hizmetlisi",
      "evde hizmetli",
      "ev işleri yardımcısı",
      "ev isleri yardimcisi",
    ],
    ["homeHelperScope", "homeHelperSchedule", "homeHelperDuration", "homeHelperStart"],
    [
      { fieldKey: "homeHelperScope", prompt: "Ev yardımcısı hangi işleri yapmalı?", summaryLabel: "Destek kapsamı", importance: "quote_critical", rank: 74, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Temizlik", value: "Temizlik" }, { label: "Yemek", value: "Yemek" }, { label: "Çamaşır / ütü", value: "Çamaşır / ütü" }, { label: "Alışveriş ve günlük işler", value: "Alışveriş ve günlük işler" }, { label: "Birden fazla iş", value: "Birden fazla iş" }] },
      { fieldKey: "homeHelperSchedule", prompt: "Çalışma düzeni nasıl olmalı?", summaryLabel: "Çalışma düzeni", importance: "quote_critical", rank: 68, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Tek sefer", value: "Tek sefer" }, { label: "Haftada birkaç gün", value: "Haftalık" }, { label: "Her gün", value: "Her gün" }, { label: "Yatılı", value: "Yatılı" }] },
      { fieldKey: "homeHelperDuration", prompt: "Bir günde yaklaşık kaç saat çalışmalı?", summaryLabel: "Günlük süre", importance: "optional", rank: 50, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "1–3 saat", value: "1–3 saat" }, { label: "4–8 saat", value: "4–8 saat" }, { label: "8 saatten fazla", value: "8+ saat" }] },
      { fieldKey: "homeHelperStart", prompt: "Hizmet ne zaman başlamalı?", summaryLabel: "Başlangıç", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Hemen", value: "Hemen" }, { label: "Bu hafta", value: "Bu hafta" }, { label: "Tarih esnek", value: "Esnek" }] },
    ],
  ),
  serviceQuestionContract(
    ["boş ev temizliği", "bos ev temizligi"],
    ["emptyHomeSize", "emptyHomeCondition", "emptyHomeSupplies"],
    [
      { fieldKey: "emptyHomeSize", prompt: "Evin büyüklüğü nedir?", summaryLabel: "Ev büyüklüğü", importance: "quote_critical", rank: 72, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "1+0 / 1+1", value: "1+0 / 1+1" }, { label: "2+1", value: "2+1" }, { label: "3+1", value: "3+1" }, { label: "4+1 ve üzeri", value: "4+1+" }] },
      { fieldKey: "emptyHomeCondition", prompt: "Evin temizlik durumu nasıl?", summaryLabel: "Temizlik durumu", importance: "quote_critical", rank: 68, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Normal boş ev temizliği", value: "Normal" }, { label: "Yoğun kir / uzun süre boş", value: "Yoğun" }, { label: "Tadilat sonrası", value: "Tadilat sonrası" }] },
      { fieldKey: "emptyHomeSupplies", prompt: "Temizlik malzemesini kim sağlayacak?", summaryLabel: "Malzeme", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Hizmet veren getirsin", value: "Hizmet veren" }, { label: "Ben sağlayacağım", value: "Müşteri" }] },
    ],
  ),
  serviceQuestionContract(
    ["boya badana", "boya", "badana"],
    ["paintArea", "paintPrep", "paintSupply"],
    [
      { fieldKey: "paintArea", prompt: "Boyanacak yaklaşık alan ne kadar?", summaryLabel: "Alan", importance: "quote_critical", rank: 72, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Tek oda / küçük alan", value: "Küçük alan" }, { label: "1–2 oda", value: "1–2 oda" }, { label: "Tüm ev", value: "Tüm ev" }, { label: "Ofis / geniş alan", value: "Geniş alan" }] },
      { fieldKey: "paintPrep", prompt: "Alçı, çatlak onarımı veya zımpara gerekli mi?", summaryLabel: "Yüzey hazırlığı", importance: "quote_critical", rank: 66, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Sadece boya", value: "Sadece boya" }, { label: "Küçük onarım gerekli", value: "Küçük onarım" }, { label: "Kapsamlı hazırlık gerekli", value: "Kapsamlı hazırlık" }] },
      { fieldKey: "paintSupply", prompt: "Boyayı kim sağlayacak?", summaryLabel: "Boya malzemesi", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Usta sağlasın", value: "Hizmet veren" }, { label: "Ben sağlayacağım", value: "Müşteri" }] },
    ],
  ),
  serviceQuestionContract(
    ["cam balkon"],
    ["balconySize", "balconySystem", "balconyGlass"],
    [
      { fieldKey: "balconySize", prompt: "Balkonun yaklaşık ölçüsü nedir?", summaryLabel: "Balkon ölçüsü", importance: "quote_critical", rank: 72, inputHint: "text", allowUnknown: true },
      { fieldKey: "balconySystem", prompt: "Hangi cam balkon sistemi olsun?", summaryLabel: "Sistem", importance: "quote_critical", rank: 68, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Katlanır", value: "Katlanır" }, { label: "Sürgülü", value: "Sürgülü" }, { label: "Giyotin", value: "Giyotin" }] },
      { fieldKey: "balconyGlass", prompt: "Cam tercihiniz var mı?", summaryLabel: "Cam tercihi", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Isıcamlı", value: "Isıcamlı" }, { label: "Temperli", value: "Temperli" }, { label: "Standart", value: "Standart" }] },
    ],
  ),
  serviceQuestionContract(
    ["kombi servisi"],
    ["boilerBrand", "boilerServiceNeed", "boilerIssue", "boilerUrgency"],
    [
      { fieldKey: "boilerBrand", prompt: "Kombinizin markası nedir?", summaryLabel: "Kombi markası", importance: "quote_critical", rank: 76, inputHint: "select", allowUnknown: true, quickChoices: [{ label: "Arçelik", value: "Arçelik" }, { label: "Baymak", value: "Baymak" }, { label: "Bosch", value: "Bosch" }, { label: "Buderus", value: "Buderus" }, { label: "Demirdöküm", value: "Demirdöküm" }, { label: "E.C.A.", value: "E.C.A." }, { label: "Vaillant", value: "Vaillant" }, { label: "Viessmann", value: "Viessmann" }] },
      { fieldKey: "boilerServiceNeed", prompt: "Kombi için hangi hizmete ihtiyacınız var?", summaryLabel: "Hizmet ihtiyacı", importance: "quote_critical", rank: 72, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Periyodik bakım", value: "Bakım" }, { label: "Arıza tespiti / onarım", value: "Arıza / onarım" }, { label: "Montaj", value: "Montaj" }] },
      { fieldKey: "boilerIssue", prompt: "Belirgin bir arıza veya sorun var mı?", summaryLabel: "Arıza", importance: "quote_critical", rank: 66, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Isıtmıyor / sıcak su yok", value: "Isıtma / sıcak su" }, { label: "Su basıncı / sızıntı", value: "Basınç / sızıntı" }, { label: "Hata kodu var", value: "Hata kodu" }, { label: "Sadece bakım", value: "Sadece bakım" }] },
      { fieldKey: "boilerUrgency", prompt: "Ne kadar acil?", summaryLabel: "Aciliyet", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Bugün", value: "Bugün" }, { label: "1–3 gün içinde", value: "1–3 gün" }, { label: "Tarih esnek", value: "Esnek" }] },
    ],
  ),
  serviceQuestionContract(
    ["klima servisi"],
    ["airConditionerBrand", "airConditionerNeed", "airConditionerIssue", "airConditionerType"],
    [
      { fieldKey: "airConditionerBrand", prompt: "Klima markası nedir?", summaryLabel: "Klima markası", importance: "quote_critical", rank: 76, inputHint: "select", allowUnknown: true, quickChoices: [{ label: "Arçelik", value: "Arçelik" }, { label: "Baymak", value: "Baymak" }, { label: "Bosch", value: "Bosch" }, { label: "Daikin", value: "Daikin" }, { label: "Mitsubishi Electric", value: "Mitsubishi Electric" }, { label: "Vestel", value: "Vestel" }] },
      { fieldKey: "airConditionerNeed", prompt: "Klima için hangi hizmete ihtiyacınız var?", summaryLabel: "Hizmet ihtiyacı", importance: "quote_critical", rank: 72, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Periyodik bakım", value: "Bakım" }, { label: "Arıza tespiti / onarım", value: "Arıza / onarım" }, { label: "Montaj / söküm", value: "Montaj / söküm" }] },
      { fieldKey: "airConditionerIssue", prompt: "Belirgin bir sorun var mı?", summaryLabel: "Sorun", importance: "quote_critical", rank: 66, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Soğutmuyor / ısıtmıyor", value: "Soğutma / ısıtma" }, { label: "Su akıtıyor", value: "Su akıtma" }, { label: "Ses / koku / hata kodu", value: "Diğer arıza" }, { label: "Sadece bakım", value: "Sadece bakım" }] },
      { fieldKey: "airConditionerType", prompt: "Klima tipi nedir?", summaryLabel: "Klima tipi", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Split klima", value: "Split" }, { label: "Salon tipi", value: "Salon tipi" }, { label: "Multi sistem", value: "Multi sistem" }] },
    ],
  ),
  serviceQuestionContract(
    ["direksiyon dersi"],
    ["drivingLicenseClass", "drivingLevel", "drivingSchedule"],
    [
      { fieldKey: "drivingLicenseClass", prompt: "Hangi ehliyet sınıfı için ders istiyorsunuz?", summaryLabel: "Ehliyet sınıfı", importance: "quote_critical", rank: 72, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "B sınıfı", value: "B" }, { label: "Otomatik vites", value: "B otomatik" }, { label: "Diğer sınıf", value: "Diğer" }] },
      { fieldKey: "drivingLevel", prompt: "Mevcut sürüş seviyeniz nedir?", summaryLabel: "Seviye", importance: "quote_critical", rank: 68, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Yeni başlıyorum", value: "Başlangıç" }, { label: "Trafik pratiği istiyorum", value: "Trafik pratiği" }, { label: "Sınav hazırlığı", value: "Sınav hazırlığı" }] },
      { fieldKey: "drivingSchedule", prompt: "Ders zamanınız için tercihiniz var mı?", summaryLabel: "Ders zamanı", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Hafta içi", value: "Hafta içi" }, { label: "Hafta sonu", value: "Hafta sonu" }, { label: "Esnek", value: "Esnek" }] },
    ],
  ),
  serviceQuestionContract(
    ["duvar dekorasyon"],
    ["wallDecorArea", "wallDecorType", "wallDecorPrep"],
    [
      { fieldKey: "wallDecorArea", prompt: "Uygulama yapılacak alan ne kadar?", summaryLabel: "Uygulama alanı", importance: "quote_critical", rank: 72, inputHint: "text", allowUnknown: true },
      { fieldKey: "wallDecorType", prompt: "Hangi duvar dekorasyonu istiyorsunuz?", summaryLabel: "Dekor türü", importance: "quote_critical", rank: 68, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Duvar kâğıdı", value: "Duvar kâğıdı" }, { label: "Panel / çıta", value: "Panel / çıta" }, { label: "Dekoratif boya", value: "Dekoratif boya" }] },
      { fieldKey: "wallDecorPrep", prompt: "Mevcut kaplama sökülecek mi?", summaryLabel: "Hazırlık", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Evet, söküm gerekli", value: "Söküm gerekli" }, { label: "Hayır, yüzey hazır", value: "Yüzey hazır" }] },
    ],
  ),
  serviceQuestionContract(
    ["elektrikçi", "elektrikci"],
    ["electricalWork", "electricalPlace", "electricalUrgency"],
    [
      { fieldKey: "electricalWork", prompt: "Hangi elektrik işine ihtiyacınız var?", summaryLabel: "Elektrik işi", importance: "quote_critical", rank: 72, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Arıza tespiti", value: "Arıza" }, { label: "Priz / anahtar / aydınlatma", value: "Montaj" }, { label: "Tesisat yenileme", value: "Tesisat" }] },
      { fieldKey: "electricalPlace", prompt: "Hizmet nerede yapılacak?", summaryLabel: "Mekân", importance: "quote_critical", rank: 66, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Ev", value: "Ev" }, { label: "Ofis / iş yeri", value: "İş yeri" }, { label: "Ortak alan", value: "Ortak alan" }] },
      { fieldKey: "electricalUrgency", prompt: "Ne kadar acil?", summaryLabel: "Aciliyet", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Bugün", value: "Bugün" }, { label: "1–3 gün içinde", value: "1–3 gün" }, { label: "Tarih esnek", value: "Esnek" }] },
    ],
  ),
  serviceQuestionContract(
    ["parça eşya taşıma", "parca esya tasima"],
    ["partialMoveItems", "partialMoveFloors", "partialMoveDate"],
    [
      { fieldKey: "partialMoveItems", prompt: "Taşınacak eşyalar nelerdir?", summaryLabel: "Eşya", importance: "quote_critical", rank: 72, inputHint: "text", allowUnknown: true },
      { fieldKey: "partialMoveFloors", prompt: "Alış ve teslim katlarında asansör var mı?", summaryLabel: "Kat / asansör", importance: "quote_critical", rank: 66, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "İkisinde de var", value: "İki tarafta var" }, { label: "Bir tarafta var", value: "Tek tarafta var" }, { label: "Yok", value: "Yok" }] },
      { fieldKey: "partialMoveDate", prompt: "Taşıma için ne zaman uygunsunuz?", summaryLabel: "Taşıma zamanı", importance: "optional", rank: 44, inputHint: "text", allowDontCare: true },
    ],
  ),
  serviceQuestionContract(
    ["ev dekorasyon"],
    ["homeDecorScope", "homeDecorArea", "homeDecorDelivery"],
    [
      { fieldKey: "homeDecorScope", prompt: "Hangi alanlar için dekorasyon istiyorsunuz?", summaryLabel: "Kapsam", importance: "quote_critical", rank: 72, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Tek oda", value: "Tek oda" }, { label: "Birden fazla oda", value: "Birden fazla oda" }, { label: "Tüm ev", value: "Tüm ev" }] },
      { fieldKey: "homeDecorArea", prompt: "Yaklaşık alan ne kadar?", summaryLabel: "Alan", importance: "quote_critical", rank: 66, inputHint: "text", allowUnknown: true },
      { fieldKey: "homeDecorDelivery", prompt: "Yalnız tasarım mı, uygulama dahil mi?", summaryLabel: "Teslim modeli", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Yalnız tasarım", value: "Yalnız tasarım" }, { label: "Tasarım + uygulama", value: "Tasarım + uygulama" }] },
    ],
  ),
  serviceQuestionContract(
    ["ev temizliği", "ev temizligi"],
    ["homeCleaningSize", "homeCleaningFrequency", "homeCleaningSupplies"],
    [
      { fieldKey: "homeCleaningSize", prompt: "Evin büyüklüğü nedir?", summaryLabel: "Ev büyüklüğü", importance: "quote_critical", rank: 72, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "1+0 / 1+1", value: "1+0 / 1+1" }, { label: "2+1", value: "2+1" }, { label: "3+1", value: "3+1" }, { label: "4+1 ve üzeri", value: "4+1+" }] },
      { fieldKey: "homeCleaningFrequency", prompt: "Hizmeti ne sıklıkla istiyorsunuz?", summaryLabel: "Sıklık", importance: "quote_critical", rank: 66, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Tek seferlik", value: "Tek seferlik" }, { label: "Haftalık", value: "Haftalık" }, { label: "Aylık", value: "Aylık" }] },
      { fieldKey: "homeCleaningSupplies", prompt: "Temizlik malzemesini kim sağlayacak?", summaryLabel: "Malzeme", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Hizmet veren getirsin", value: "Hizmet veren" }, { label: "Ben sağlayacağım", value: "Müşteri" }] },
    ],
  ),
  serviceQuestionContract(
    ["evden eve nakliyat"],
    ["movingHomeSize", "movingFloors", "movingPacking", "movingDate"],
    [
      { fieldKey: "movingHomeSize", prompt: "Kaç odalı ev taşınacak?", summaryLabel: "Ev büyüklüğü", importance: "quote_critical", rank: 72, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "1+1", value: "1+1" }, { label: "2+1", value: "2+1" }, { label: "3+1", value: "3+1" }, { label: "4+1 ve üzeri", value: "4+1+" }] },
      { fieldKey: "movingFloors", prompt: "Alış ve teslim katlarında asansör var mı?", summaryLabel: "Kat / asansör", importance: "quote_critical", rank: 66, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "İkisinde de var", value: "İki tarafta var" }, { label: "Bir tarafta var", value: "Tek tarafta var" }, { label: "Yok", value: "Yok" }] },
      { fieldKey: "movingPacking", prompt: "Paketleme hizmeti gerekli mi?", summaryLabel: "Paketleme", importance: "optional", rank: 48, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Gerekli", value: "Gerekli" }, { label: "Kendim paketleyeceğim", value: "Gerekli değil" }] },
      { fieldKey: "movingDate", prompt: "Taşınma için ne zaman uygunsunuz?", summaryLabel: "Taşınma zamanı", importance: "optional", rank: 44, inputHint: "text", allowDontCare: true },
    ],
  ),
  serviceQuestionContract(
    ["fayans döşeme", "fayans doseme"],
    ["tileArea", "tileSpace", "tileRemoval", "tileSupply"],
    [
      { fieldKey: "tileArea", prompt: "Fayans döşenecek alan ne kadar?", summaryLabel: "Alan", importance: "quote_critical", rank: 72, inputHint: "text", allowUnknown: true },
      { fieldKey: "tileSpace", prompt: "Uygulama hangi alanda yapılacak?", summaryLabel: "Uygulama alanı", importance: "quote_critical", rank: 66, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Banyo", value: "Banyo" }, { label: "Mutfak", value: "Mutfak" }, { label: "Balkon / teras", value: "Balkon / teras" }, { label: "Diğer", value: "Diğer" }] },
      { fieldKey: "tileRemoval", prompt: "Mevcut fayans sökülecek mi?", summaryLabel: "Söküm", importance: "optional", rank: 48, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Evet", value: "Söküm gerekli" }, { label: "Hayır", value: "Söküm gerekmiyor" }] },
      { fieldKey: "tileSupply", prompt: "Fayans malzemesini kim sağlayacak?", summaryLabel: "Malzeme", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Usta sağlasın", value: "Hizmet veren" }, { label: "Ben sağlayacağım", value: "Müşteri" }] },
    ],
  ),
  serviceQuestionContract(
    ["halı yıkama / temizleme", "hali yikama / temizleme", "halı yıkama", "hali yikama"],
    ["carpetLoad", "carpetPickup", "carpetIssue"],
    [
      { fieldKey: "carpetLoad", prompt: "Kaç halı ve yaklaşık hangi ölçülerde?", summaryLabel: "Halı miktarı", importance: "quote_critical", rank: 72, inputHint: "text", allowUnknown: true },
      { fieldKey: "carpetPickup", prompt: "Adresten alma ve teslim gerekli mi?", summaryLabel: "Alma / teslim", importance: "quote_critical", rank: 66, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Alma ve teslim gerekli", value: "Gerekli" }, { label: "Kendim bırakacağım", value: "Gerekli değil" }] },
      { fieldKey: "carpetIssue", prompt: "Özel leke veya koku sorunu var mı?", summaryLabel: "Özel durum", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Yok", value: "Yok" }, { label: "Leke", value: "Leke" }, { label: "Koku", value: "Koku" }] },
    ],
  ),
  serviceQuestionContract(
    ["koltuk yıkama / temizleme", "koltuk yikama / temizleme", "koltuk yıkama", "koltuk yikama"],
    ["upholsterySeatCount", "upholsteryOnSite", "upholsteryIssue", "upholsteryFabric"],
    [
      { fieldKey: "upholsterySeatCount", prompt: "Kaç parça koltuk yıkanacak?", summaryLabel: "Koltuk miktarı", importance: "quote_critical", rank: 72, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Tekli / ikili koltuk", value: "1–2 parça" }, { label: "3'lü koltuk takımı", value: "3 parça" }, { label: "Koltuk takımı", value: "4+ parça" }] },
      { fieldKey: "upholsteryOnSite", prompt: "Yıkama nerede yapılsın?", summaryLabel: "Hizmet yeri", importance: "quote_critical", rank: 66, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Evde yerinde yıkama", value: "Yerinde" }, { label: "Alınıp tesiste yıkansın", value: "Tesiste" }] },
      { fieldKey: "upholsteryIssue", prompt: "Özel leke veya koku sorunu var mı?", summaryLabel: "Özel durum", importance: "optional", rank: 48, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Yok", value: "Yok" }, { label: "Leke", value: "Leke" }, { label: "Koku", value: "Koku" }, { label: "Evcil hayvan tüyü", value: "Evcil hayvan tüyü" }] },
      { fieldKey: "upholsteryFabric", prompt: "Kumaş türünü biliyor musunuz?", summaryLabel: "Kumaş", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Kumaş", value: "Kumaş" }, { label: "Deri / suni deri", value: "Deri" }, { label: "Kadife", value: "Kadife" }] },
    ],
  ),
  serviceQuestionContract(
    ["iç mimar", "ic mimar"],
    ["interiorDesignScope", "interiorDesignArea", "interiorDesignDelivery", "interiorDesignStyle"],
    [
      { fieldKey: "interiorDesignScope", prompt: "Hangi alanlar için iç mimarlık istiyorsunuz?", summaryLabel: "Kapsam", importance: "quote_critical", rank: 72, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Tek oda", value: "Tek oda" }, { label: "Birden fazla oda", value: "Birden fazla oda" }, { label: "Tüm ev / iş yeri", value: "Tüm alan" }] },
      { fieldKey: "interiorDesignArea", prompt: "Yaklaşık alan ne kadar?", summaryLabel: "Alan", importance: "quote_critical", rank: 66, inputHint: "text", allowUnknown: true },
      { fieldKey: "interiorDesignDelivery", prompt: "Hangi teslim modelini istiyorsunuz?", summaryLabel: "Teslim modeli", importance: "quote_critical", rank: 60, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Konsept / proje", value: "Proje" }, { label: "3D görselleştirme", value: "3D görselleştirme" }, { label: "Anahtar teslim uygulama", value: "Anahtar teslim" }] },
      { fieldKey: "interiorDesignStyle", prompt: "Tarz tercihiniz var mı?", summaryLabel: "Tarz", importance: "optional", rank: 44, inputHint: "select", allowDontCare: true, quickChoices: [{ label: "Modern", value: "Modern" }, { label: "Klasik", value: "Klasik" }, { label: "Minimal", value: "Minimal" }] },
    ],
  ),
];

/** Field is shown (and can be required) only when another field matches. */
export type FieldWhen = {
  field: string;
  in: string[];
};

export type DynamicField = {
  key: string;
  label: string;
  type: DynamicFieldType;
  placeholder?: string;
  unit?: string;
  required?: boolean;
  options?: DynamicFieldOption[];
  when?: FieldWhen;
  /**
   * Product-scoped fields: visible only when the detected product type
   * (diacritic-folded substring match) hits one of these. A TV must never
   * be asked for RAM; without a detected product the field stays hidden.
   */
  whenProductTypes?: string[];
};

export function getCategoryNeedTypeDefault(categoryId: string): string | null {
  // Automotive root is ambiguous (vehicle vs part vs service). Never assume
  // vehicle purchase — that made modelYear required and flashed Araç Satın Alma.
  if (categoryId === "automotive") return null;
  if (categoryId === "machinery") return "machine";
  // Technology: never blindly force software — hardware signals win in withCategoryFieldDefaults
  if (categoryId === "technology") return "software";
  return null;
}

/** Whole-product keys that must stay hidden unless needType is part/tire. */
const AUTOMOTIVE_PART_ONLY_KEYS = new Set([
  "part",
  "partPreference",
  "vin",
]);

/** Managed by RealEstateLocationFields (searchable multi-select), not free text. */
const REAL_ESTATE_STRUCTURED_KEYS = new Set(["neighborhoods"]);

export const TECH_HARDWARE_SIGNAL =
  /televizyon|\btv\b|laptop|dizüstü|dizustu|notebook|telefon|iphone|ipad|tablet|monitör|monitor|bilgisayar|donanım|donanim|hardware|kulaklık|kulaklik|smartwatch|yazıcı|yazici|printer|drone|dron\b|kamera|fotoğraf makinesi|fotograf makinesi|gimbal|objektif|tripod|hoparlör|hoparlor|soundbar|mikrofon|modem|router|mesh|access point|konsol|gamepad|vr gözlük|vr gozluk|akıllı saat|akilli saat|bileklik|tarayıcı|tarayici|klavye|\bmouse\b|webcam|projeksiyon|media player/i;

export const TECH_SOFTWARE_SIGNAL =
  /yazılım|yazilim|web\s*sitesi|e-?ticaret|erp|crm|uygulama|saas|platform|entegrasyon|software/i;

function looksLikeTechHardware(
  values: Record<string, string | undefined>,
): boolean {
  if ((values.needType ?? "").trim() === "hardware") return true;
  const bag = [
    values.productType,
    values.solutionType,
    values.applianceType,
    values.brand,
  ]
    .filter(Boolean)
    .join(" ");
  if (TECH_HARDWARE_SIGNAL.test(bag)) return true;
  if (TECH_SOFTWARE_SIGNAL.test(bag)) return false;
  return false;
}

function selectedFieldValues(value?: string): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Normalize browse/engine spelling drift for visibility gates. */
function normalizeWhenValue(fieldKey: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (fieldKey === "propertyType") {
    const fold = trimmed.toLocaleLowerCase("tr-TR");
    if (fold === "residans" || fold === "rezidans") return "Rezidans";
    if (fold === "daire") return "Daire";
    if (fold === "villa") return "Villa";
    if (fold === "stüdyo" || fold === "studyo") return "Stüdyo";
    if (fold === "dubleks") return "Dubleks";
    if (fold === "müstakil ev" || fold === "mustakil ev") return "Müstakil Ev";
    if (fold === "yalı" || fold === "yali") return "Yalı";
    if (fold === "yalı dairesi" || fold === "yali dairesi") return "Yalı Dairesi";
    if (fold === "çiftlik evi" || fold === "ciftlik evi") return "Çiftlik Evi";
    if (fold === "köşk & konak" || fold === "kosk & konak") return "Köşk & Konak";
    if (fold === "dükkan / mağaza" || fold === "dukkan / magaza" || fold === "dükkan" || fold === "dukkan" || fold === "mağaza" || fold === "magaza") return "Dükkan / mağaza";
    if (fold === "ofis") return "Ofis";
    if (fold === "plaza ofisi") return "Plaza ofisi";
    if (fold === "depo / antrepo" || fold === "depo" || fold === "antrepo") return "Depo / antrepo";
    if (fold === "fabrika / imalathane" || fold === "fabrika" || fold === "imalathane") return "Fabrika / imalathane";
    if (fold === "avm ünitesi" || fold === "avm unitesi") return "AVM ünitesi";
    if (fold === "otel / apart" || fold === "otel") return "Otel / apart";
    if (fold === "devren işyeri" || fold === "devren isyeri") return "Devren işyeri";
    if (fold === "müştemilat" || fold === "mustemilat") return "Müştemilat";
    if (fold === "kooperatif hissesi") return "Kooperatif hissesi";
    if (fold === "turistik tesis") return "Turistik tesis";
    if (fold === "devre mülk" || fold === "devre mulk") return "Devre mülk";
    if (fold === "iş yeri" || fold === "is yeri" || fold === "işyeri") {
      return "İş yeri";
    }
    if (fold === "arsa") return "Arsa";
  }
  return trimmed;
}

/**
 * Canonical FormField.key plus legacy spellings that store the same fact.
 * Explore/alerts query both; do not treat them as two metrics.
 */
export function formFieldKeyAliases(fieldKey: string): string[] {
  if (fieldKey === "brand" || fieldKey === "brandPreference") {
    return ["brand", "brandPreference"];
  }
  return [fieldKey];
}

/**
 * Stored text values that should match a user-selected filter.
 * Canonical spelling comes from normalizeWhenValue; legacy rows stay readable.
 */
export function storedFieldValueAliases(
  fieldKey: string,
  value: string,
): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const canonical = normalizeWhenValue(fieldKey, trimmed) || trimmed;
  const aliases = new Set<string>([trimmed, canonical]);
  if (fieldKey === "propertyType") {
    const fold = canonical.toLocaleLowerCase("tr-TR");
    if (fold === "rezidans") {
      aliases.add("Rezidans");
      aliases.add("Residans");
    }
  }
  if (fieldKey === "condition") {
    const fold = canonical.toLocaleLowerCase("tr-TR");
    if (fold === "ikinci el") {
      aliases.add("İkinci el");
      aliases.add("Ikinci el");
      aliases.add("2. el");
    }
    if (fold === "sıfır" || fold === "sifir") {
      aliases.add("Sıfır");
      aliases.add("Sifir");
    }
  }
  return [...aliases];
}

export function withCategoryFieldDefaults(
  categoryId: string,
  values: Record<string, string | undefined>,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    next[key] = value ?? "";
  }

  // Normalize RE property spelling so when-gates (roomCount/floor) fire
  if (next.propertyType?.trim()) {
    next.propertyType = next.propertyType
      .split(",")
      .map((value) => normalizeWhenValue("propertyType", value.trim()))
      .filter(Boolean)
      .join(", ");
  }

  if (categoryId === "technology") {
    const selectedNeedTypes = selectedFieldValues(next.needType);
    if (selectedNeedTypes.length === 0) {
      next.needType = looksLikeTechHardware(next) ? "hardware" : "software";
    } else if (
      selectedNeedTypes.includes("software") &&
      !selectedNeedTypes.includes("hardware") &&
      looksLikeTechHardware(next) &&
      !TECH_SOFTWARE_SIGNAL.test(
        [next.productType, next.solutionType].filter(Boolean).join(" "),
      )
    ) {
      // Soft default was software but demand is clearly hardware
      next.needType = "hardware";
    }
    if (
      next.needType === "hardware" &&
      !next.solutionType?.trim() &&
      next.productType?.trim()
    ) {
      next.solutionType = next.productType.trim();
    }
  } else {
    const needDefault = getCategoryNeedTypeDefault(categoryId);
    if (needDefault && !next.needType?.trim()) {
      next.needType = needDefault;
    }
  }

  // Furniture: soft-default usage area from leaf (home vs office)
  if (categoryId === "furniture" && !next.usageArea?.trim()) {
    const ft = (next.furnitureType ?? "").toLocaleLowerCase("tr-TR");
    if (ft) {
      if (/ofis|toplantı|makam|çalışma|calisma|personel/.test(ft)) {
        next.usageArea = "Ofis";
      } else {
        next.usageArea = "Ev";
      }
    }
  }

  return next;
}

export function isFieldVisible(
  field: DynamicField,
  values: Record<string, string | undefined>,
): boolean {
  if (!field.when) return true;
  const raw = (values[field.when.field] ?? "").trim();
  if (!raw) return false;
  const selectedValues = raw
    .split(",")
    .map((value) => normalizeWhenValue(field.when!.field, value.trim()))
    .filter(Boolean);
  return selectedValues.some((current) => {
    const currentFold = current.toLocaleLowerCase("tr-TR");
    return field.when!.in.some((candidate) => {
      const normalized = normalizeWhenValue(field.when!.field, candidate);
      return (
        normalized === current ||
        normalized.toLocaleLowerCase("tr-TR") === currentFold
      );
    });
  });
}

/** Soft fields: useful for matching, never hard-block publish alone. */
const SOFT_PUBLISH_KEYS = new Set([
  "brand",
  "model",
  "budget",
  "dimensions",
  "material",
  "printType",
  "designReady",
]);

export function isFieldRequired(
  field: DynamicField,
  values: Record<string, string | undefined>,
): boolean {
  if (SOFT_PUBLISH_KEYS.has(field.key)) return false;
  return Boolean(field.required) && isFieldVisible(field, values);
}

const PRODUCT_FOLD_MAP: Record<string, string> = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", İ: "i",
  ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
};

function foldProductContext(value: string): string {
  return value
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (m) => PRODUCT_FOLD_MAP[m] ?? m)
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Bina/konut soruları yalnız üzerinde yapı olan emlak tiplerinde anlamlıdır —
 * arsa/tarla akışına ısıtma, kat, banyo sorusu asla gitmez (kurucu, 2026-08-23).
 */
const BUILDING_PROPERTY_TYPES = [
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
  "iş yeri",
  "is yeri",
  "isyeri",
  "ofis",
  "dükkan",
  "dukkan",
  "mağaza",
  "magaza",
  "depo",
];

/** Fields like RAM/graphics belong to computers, never TVs or printers. */
const COMPUTER_PRODUCT_TYPES = [
  "bilgisayar",
  "laptop",
  "notebook",
  "macbook",
  "masaustu",
  "masaüstü",
  "all in one",
  "pc",
];

export function getVisibleCategoryFields(
  fields: DynamicField[],
  values: Record<string, string | undefined>,
  categoryId?: string,
  opts?: {
    subcategorySlug?: string | null;
    taxonomyNodeId?: string | null;
    /**
     * Konu iğnesini kullanıcı mı koydu? (KB-17) Belirtilmezse `true` —
     * yani bu alanı taşımayan çağıranların davranışı DEĞİŞMEZ.
     */
    subjectPinIsUserAuthored?: boolean;
  },
): DynamicField[] {
  const resolved: Record<string, string> = categoryId
    ? withCategoryFieldDefaults(categoryId, values)
    : Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, v ?? ""]),
      );

  // Taxonomy subcategory / part leaf pins commercial subject — do not fall back
  // to category default (e.g. automotive → vehicle) when browse already chose PART.
  let browsePinnedNeed: string | null = null;
  if (categoryId) {
    const role = resolveBrowseSemanticRole({
      categoryId,
      subcategorySlug: opts?.subcategorySlug ?? null,
      taxonomyNodeId: opts?.taxonomyNodeId ?? null,
      productType: resolved.applianceType || resolved.productType || null,
    });
    if (role.needType) {
      browsePinnedNeed = role.needType;
      resolved.needType = role.needType;
    }
  }

  let visible = fields.filter((field) => isFieldVisible(field, resolved));

  // Product-scoped fields: only when the detected product matches.
  // Real estate: propertyType (Daire / İmarlı arsa / İş yeri) is the context.
  const productContext = foldProductContext(
    (categoryId === "automotive" && (resolved.needType === "service" || resolved.needType === "tire") && resolved.serviceType) ||
      resolved.productType ||
      resolved.solutionType ||
      resolved.applianceType ||
      resolved.furnitureType ||
      resolved.babyProductType ||
      resolved.kitchenProductType ||
      resolved.propertyType ||
      resolved.serviceType ||
      resolved.machineType ||
      resolved.tireItemType ||
      "",
  );
  const productQuestionContract = categoryId
    ? resolveCategoryQuestionContract({
        categoryId,
        productType: productContext,
        needType: resolved.needType,
      })
    : null;
  visible = visible.filter((field) => {
    if (!field.whenProductTypes?.length) return true;
    if (!productContext) return false;
    return field.whenProductTypes.some((p) =>
      productContext.includes(foldProductContext(p)),
    );
  });

  // Bir ürün/niyet sözleşmesi eşleştiğinde, legacy form alanları da aynı
  // izin listesinden geçer. Örn. lastikte araç model/yıl alanı gösterilmez;
  // lastik ebatı ve mevsimi sorulur.
  if (productQuestionContract) {
    visible = visible.filter(
      (field) =>
        field.key === "needType" ||
        productQuestionContract.allowedCandidateFieldKeys.includes(field.key),
    );
  }

  /**
   * Kullanıcının SEÇTİĞİ konu: "Araç mı, parça mı?" bir daha sorulmaz.
   *
   * KB-17 düzeltmesi: iğne serbest metinden ÇIKARILDIYSA bu silme yapılamaz.
   * Alt kategori ("arac-satin-alma") kullanıcının seçimi değil Talepo'nun
   * tahminiyse, o tahmini doğrulayacak tek soruyu silmek tahmini cevap yerine
   * koymaktır — talep yanlış havuza gider ve kullanıcı bunu hiç görmez.
   * İğne yine `resolved.needType` olarak DURUR: alakasız alanlar (parça
   * soruları) açılmaz; kapanan tek şey sorunun kendisidir.
   */
  if (browsePinnedNeed && opts?.subjectPinIsUserAuthored !== false) {
    visible = visible.filter((field) => field.key !== "needType");
  }

  // Servis niyeti (kombi bakımı gibi): ürün-spec soruları (enerji sınıfı,
  // kullanım alanı…) tamir/bakım talebinde saçmadır — süpür (kurucu, 2026-08-23).
  if (categoryId === "appliances" || categoryId === "technology") {
    const needTypes = selectedFieldValues(resolved.needType || "");
    if (needTypes.includes("service")) {
      const SERVICE_KEEP = new Set([
        "title",
        "city",
        "budget",
        "delivery",
        "quantity",
        "brand",
        "model",
        "applianceType",
        "productType",
        "serviceType",
        "needType",
        "support",
      ]);
      visible = visible.filter((field) => SERVICE_KEEP.has(field.key));
    }
  }

  // Hard safety: never ask for parts when the user wants the whole vehicle.
  if (categoryId === "automotive") {
    const needTypes = selectedFieldValues(resolved.needType || "vehicle");
    if (!needTypes.includes("part") && !needTypes.includes("tire")) {
      visible = visible.filter(
        (field) => !AUTOMOTIVE_PART_ONLY_KEYS.has(field.key),
      );
    }
    if (!needTypes.includes("service")) {
      visible = visible.filter((field) => field.key !== "serviceType");
    }
    if (!needTypes.includes("vehicle")) {
      visible = visible.filter(
        (field) =>
          field.key !== "condition" && field.key !== "bodyCondition",
      );
    }
  }

  if (categoryId === "machinery") {
    const needTypes = selectedFieldValues(resolved.needType || "machine");
    if (!needTypes.includes("machine")) {
      visible = visible.filter(
        (field) =>
          field.key !== "capacity" &&
          field.key !== "power" &&
          field.key !== "voltage",
      );
    }
  }

  if (categoryId === "real-estate") {
    visible = visible.filter(
      (field) => !REAL_ESTATE_STRUCTURED_KEYS.has(field.key),
    );
  }

  // Technology: hide software-only filters when demand is hardware (and vice versa)
  if (categoryId === "technology") {
    const needTypes = selectedFieldValues(resolved.needType || "software");
    if (needTypes.includes("hardware") && !needTypes.includes("software")) {
      visible = visible.filter(
        (field) =>
          field.key !== "platform" &&
          field.key !== "users" &&
          field.key !== "integration",
      );
    } else if (
      !needTypes.includes("hardware") &&
      (needTypes.includes("software") || needTypes.includes("service"))
    ) {
      visible = visible.filter(
        (field) =>
          field.key !== "quantityDetail" && field.key !== "specs",
      );
    }
  }

  return visible;
}

export type CommonFieldKey =
  | "title"
  | "quantity"
  | "city"
  | "delivery"
  | "budget";

export type CommonFieldConfig = {
  key: CommonFieldKey;
  label?: string;
  placeholder?: string;
};

export const COMMON_FIELD_DEFAULTS: Record<
  CommonFieldKey,
  { label: string; placeholder: string; generated?: true }
> = {
  title: {
    label: "Talep başlığı",
    placeholder: "Örn. 2015 Toyota Corolla",
    /**
     * ÜRETİLEN ETİKET — CEVAP ALANI DEĞİL (kurucu kararı, 2026-08-28).
     *
     * Başlık kullanıcıya "Bilmiyorum / Fark etmez / Uygulanamaz" diye
     * sorulmaz; talebin gerçek içeriğinden `composeRequestTitle` ile
     * üretilir. Kullanıcı elbette KENDİ başlığını yazabilir — yasak olan
     * DEĞER TAŞIMAYAN bir cevaptır: "kullanıcı kendi başlığını bilmiyor"
     * kaydı anlamsızdır ve `Request.title` gerçek bir başlık taşırken
     * çelişkili bir çift yüzey üretir.
     *
     * Bu bayrak, soru motorunun zaten uyguladığı gerçeği VERİYE taşır:
     * `title` hiçbir zaman soru olarak zamanlanmaz. Böylece aynı gerçek
     * kodda üç ayrı yerde `key === "title"` diye tekrarlanmak yerine tek
     * kanonik kaynaktan okunur.
     */
    generated: true,
  },
  quantity: {
    label: "Miktar",
    placeholder: "Örn. 5.000 adet",
  },
  city: {
    label: "Şehir",
    placeholder: "Örn. İstanbul",
  },
  delivery: {
    label: "Teslim süresi",
    placeholder: "Örn. 10 gün",
  },
  budget: {
    label: "Bütçe",
    placeholder: "Örn. ₺50.000",
  },
};

export type RequestCategory = {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  subcategories: string[];
  commonFields: CommonFieldConfig[];
  fields: DynamicField[];
  /**
   * Category-owned measurement contracts. They also cover knowledge-only
   * fields that are not rendered as a legacy DynamicField.
   */
  measurementContracts?: Record<string, MeasurementContract>;
  /** Category-owned product contracts used by the question scheduler. */
  questionContracts?: ProductQuestionContract[];
};

/**
 * BU ALAN ÜRETİLEN BİR ETİKET Mİ? (D3f Dilim 3g, 2026-08-28)
 *
 * Üretilen alan bir CEVAP alanı değildir: kullanıcıya değer taşımayan bir
 * seçenek ("Bilmiyorum" / "Fark etmez" / "Uygulanamaz") sunulmaz ve hiçbir
 * kanalda böyle bir cevap taşıyamaz. Kullanıcının kendi yazdığı DEĞER
 * elbette geçerlidir.
 *
 * Karar tek kanonik kaynaktan — ortak alan registry'sinden — okunur; cevap
 * taşıyan yolların hiçbiri kendi `key === "title"` istisnasını yazmaz.
 */
export function isGeneratedCommonField(key: string): boolean {
  const defaults = (
    COMMON_FIELD_DEFAULTS as Record<
      string,
      { generated?: true } | undefined
    >
  )[key];
  return defaults?.generated === true;
}

export function resolveCommonField(
  config: CommonFieldConfig
): CommonFieldConfig & { label: string; placeholder: string } {
  const defaults = COMMON_FIELD_DEFAULTS[config.key];

  return {
    ...config,
    label: config.label ?? defaults.label,
    placeholder: config.placeholder ?? defaults.placeholder,
  };
}

const CATEGORY_DEFINITIONS: RequestCategory[] = [
  {
    id: "printing",
    label: "Matbaa ve Ambalaj",
    description: "Baskı, etiket, kutu, ambalaj ve promosyon üretimleri",
    keywords: [
      "matbaa",
      "baskı",
      "baski",
      "dijital baskı",
      "dijital baski",
      "ofset",
      "flekso",
      "kartvizit",
      "kart vizit",
      "broşür",
      "brosur",
      "flyer",
      "afiş",
      "afis",
      "poster",
      "katalog",
      "davetiye",
      "magnet",
      "sticker",
      "etiket",
      "ambalaj",
      "kutu",
      "kraft kutu",
      "oluklu kutu",
      "karton",
      "mukavva",
      "kraft",
      "poşet",
      "poset",
      "cepli dosya",
      "zarf",
      "antetli",
      "promosyon",
      "roll up",
      "roll-up",
      "branda",
      "tabela",
      "selefon",
      "kaşe",
      "kase",
      "bloknot",
      "prototip baskı",
    ],
    subcategories: [
      "Karton Kutu",
      "Etiket Baskı",
      "Broşür ve Katalog",
      // Kurucu kararı D-0041 (2026-09-25): kartvizit artık Broşür ve
      // Katalog'un altında bir ürün türü değil, kendi alt kategorisi.
      "Kartvizit",
      "Promosyon",
      "Diğer",
    ],
    commonFields: [
      { key: "title" },
      { key: "quantity" },
      { key: "city" },
      { key: "delivery" },
      { key: "budget" },
    ],
    measurementContracts: {
      dimensions: {
        kind: "print_format",
        example: "A4 veya 21 × 29,7 cm",
        variants: [
          {
            whenProductTypes: [
              "karton kutu",
              "kutu",
              "etiket",
              "label",
            ],
            kind: "physical_dimensions",
            axes: ["width", "height", "depth"],
            unit: "mm",
            example: "350 × 250 × 80 mm",
          },
        ],
      },
      size: {
        kind: "physical_dimensions",
        axes: ["width", "height"],
        unit: "mm",
        example: "100 × 50 mm",
      },
      printSize: { kind: "print_format", example: "A4 veya 21 × 29,7 cm" },
      paperSize: { kind: "print_format", example: "A4 veya 21 × 29,7 cm" },
    },
    questionContracts: PRINTING_PRODUCT_QUESTION_CONTRACTS,
    fields: [
      {
        key: "dimensions",
        label: "Ölçü",
        type: "text",
        placeholder: "Örn. 35x25x8",
        unit: "cm",
        required: true,
      },
      {
        key: "paperWeight",
        label: "Gramaj",
        type: "number",
        placeholder: "300",
        unit: "gr",
      },
      {
        key: "material",
        label: "Malzeme",
        type: "select",
        options: [
          { label: "Bristol", value: "Bristol" },
          { label: "Kraft", value: "Kraft" },
          { label: "Kuşe", value: "Kuşe" },
          { label: "Oluklu Mukavva", value: "Oluklu Mukavva" },
        ],
      },
      {
        key: "printType",
        label: "Baskı türü",
        type: "select",
        options: [
          { label: "4 renk ofset", value: "4 renk ofset" },
          { label: "Dijital baskı", value: "Dijital baskı" },
          { label: "Flekso baskı", value: "Flekso baskı" },
          { label: "Baskısız", value: "Baskısız" },
        ],
      },
      {
        key: "lamination",
        label: "Yüzey işlemi",
        type: "select",
        options: [
          { label: "Mat selefon", value: "Mat selefon" },
          { label: "Parlak selefon", value: "Parlak selefon" },
          { label: "Lak", value: "Lak" },
          { label: "Yok", value: "Yok" },
        ],
      },
      {
        key: "dieLine",
        label: "Bıçak izi",
        type: "select",
        options: [
          { label: "Hazır", value: "Hazır" },
          { label: "Hazırlanacak", value: "Hazırlanacak" },
          { label: "Gerekli değil", value: "Gerekli değil" },
        ],
      },
    ],
  },
  {
    id: "automotive",
    label: "Otomotiv",
    description: "Araç, yedek parça, bakım ve otomotiv ekipmanları",
    keywords: [
      "araba",
      "otomobil",
      "araç",
      "arac",
      "otomotiv",
      "sedan",
      "suv",
      "tampon",
      "balata",
      "far",
      "motor",
      "şasi",
      "sasi",
      "yedek parça",
      "yedek parca",
      "hatasız",
      "hatasiz",
      ...brandKeywordList(AUTOMOTIVE_BRANDS),
      ...automotiveModelKeywordList(),
    ],
    subcategories: [
      "Araç Satın Alma",
      "Yedek Parça",
      "Araç Bakım",
      "Lastik ve Jant",
      "Diğer",
    ],
    commonFields: [
      { key: "title" },
      { key: "city", placeholder: "Örn. İstanbul" },
      { key: "budget", placeholder: "Örn. ₺850.000" },
    ],
    questionContracts: AUTOMOTIVE_PRODUCT_QUESTION_CONTRACTS,
    fields: [
      {
        key: "needType",
        label: "Araç mı, parça mı?",
        type: "select",
        required: true,
        options: [
          { label: "Aracın kendisi (satın alma)", value: "vehicle" },
          { label: "Yedek parça", value: "part" },
          { label: "Bakım / servis", value: "service" },
          { label: "Lastik / jant", value: "tire" },
        ],
      },
      {
        key: "brand",
        label: "Marka",
        type: "text",
        placeholder: "Örn. Mercedes",
        required: true,
        when: { field: "needType", in: ["vehicle", "part", "service", "tire"] },
      },
      {
        key: "model",
        label: "Model",
        type: "text",
        placeholder: "Örn. C180",
        required: true,
        when: { field: "needType", in: ["vehicle", "part", "service"] },
      },
      {
        key: "generation",
        label: "Nesil",
        type: "text",
        placeholder: "Örn. Golf VII",
        when: { field: "needType", in: ["vehicle"] },
      },
      {
        key: "modelYear",
        label: "Model yılı",
        type: "number",
        placeholder: "2016",
        required: true,
        when: { field: "needType", in: ["vehicle"] },
      },
      {
        key: "engine",
        label: "Motor",
        type: "text",
        placeholder: "Örn. 1.6 benzin",
        when: { field: "needType", in: ["vehicle"] },
      },
      {
        key: "fuel",
        label: "Yakıt türü",
        type: "select",
        when: { field: "needType", in: ["vehicle"] },
        options: [
          { label: "Benzin", value: "Benzin" },
          { label: "Dizel", value: "Dizel" },
          { label: "Hibrit", value: "Hibrit" },
          { label: "Elektrik", value: "Elektrik" },
          { label: "LPG", value: "LPG" },
          { label: "Fark etmez", value: "Fark etmez" },
        ],
      },
      {
        key: "transmission",
        label: "Şanzıman",
        type: "select",
        when: { field: "needType", in: ["vehicle"] },
        options: [
          { label: "Otomatik", value: "Otomatik" },
          { label: "Manuel", value: "Manuel" },
          { label: "Yarı otomatik", value: "Yarı otomatik" },
          { label: "Fark etmez", value: "Fark etmez" },
        ],
      },
      {
        key: "color",
        label: "Renk tercihi",
        type: "text",
        placeholder: "Örn. Siyah, beyaz, fark etmez",
        when: { field: "needType", in: ["vehicle"] },
      },
      {
        key: "condition",
        label: "Araç durumu",
        type: "select",
        when: { field: "needType", in: ["vehicle"] },
        options: [
          { label: "Sıfır", value: "Sıfır" },
          { label: "İkinci el", value: "İkinci el" },
          { label: "Hasar kayıtlı", value: "Hasar kayıtlı" },
          { label: "Fark etmez", value: "Fark etmez" },
        ],
      },
      {
        key: "bodyCondition",
        label: "Kasa / hasar durumu",
        type: "text",
        placeholder: "Örn. Hatasız, boyasız, ekspertizli",
        when: { field: "needType", in: ["vehicle"] },
      },
      {
        key: "part",
        label: "Parça / ihtiyaç",
        type: "text",
        placeholder: "Örn. Ön tampon",
        required: true,
        when: { field: "needType", in: ["part"] },
      },
      {
        key: "partPreference",
        label: "Parça tercihi",
        type: "select",
        when: { field: "needType", in: ["part"] },
        options: [
          { label: "Sıfır / OEM", value: "Sıfır / OEM" },
          { label: "Çıkma / ikinci el", value: "Çıkma / ikinci el" },
        ],
      },
      {
        key: "serviceType",
        label: "Servis / bakım ihtiyacı",
        type: "select",
        required: true,
        when: { field: "needType", in: ["service"] },
        options: [
          { label: "Periyodik bakım", value: "Periyodik bakım" },
          { label: "Triger değişimi", value: "Triger değişimi" },
          { label: "Fren bakımı", value: "Fren bakımı" },
          { label: "Klima gaz dolumu", value: "Klima gaz dolumu" },
          { label: "Rot balans", value: "Rot balans" },
          { label: "Detaylı ekspertiz", value: "Detaylı ekspertiz" },
          { label: "Kaporta / boya", value: "Kaporta / boya" },
          { label: "Mekanik onarım", value: "Mekanik onarım" },
          { label: "Elektrik arıza", value: "Elektrik arıza" },
          { label: "Yazılım / beyin güncelleme", value: "Yazılım / beyin güncelleme" },
        ],
      },
    ],
  },
  {
    id: "machinery",
    label: "Makine",
    description: "Sanayi makineleri, üretim ekipmanları ve teknik çözümler",
    keywords: [
      "makine",
      "makina",
      "pres",
      "kompresör",
      "kompresor",
      "cnc",
      "kesim",
      "üretim hattı",
      "uretim hatti",
    ],
    subcategories: [
      "Üretim Makinesi",
      "Kesim Makinesi",
      "Paketleme Makinesi",
      "Yedek Parça",
      "İkinci El Makine",
      "Diğer",
    ],
    commonFields: [
      { key: "title" },
      { key: "quantity", placeholder: "Örn. 1 adet" },
      { key: "city" },
      { key: "delivery" },
      { key: "budget" },
    ],
    measurementContracts: {
      bedSize: {
        kind: "physical_dimensions",
        axes: ["width", "height"],
        unit: "mm",
        example: "1.500 × 3.000 mm",
      },
    },
    questionContracts: MACHINERY_PRODUCT_QUESTION_CONTRACTS,
    fields: [
      {
        key: "needType",
        label: "Ne arıyorsunuz?",
        type: "select",
        required: true,
        options: [
          { label: "Makine (satın alma)", value: "machine" },
          { label: "Yedek parça / ekipman", value: "part" },
        ],
      },
      {
        key: "machineType",
        label: "Makine türü",
        type: "text",
        placeholder: "Örn. CNC kesim",
        required: true,
      },
      {
        key: "part",
        label: "Parça / ekipman",
        type: "text",
        placeholder: "Örn. Bıçak seti, rulman",
        required: true,
        when: { field: "needType", in: ["part"] },
      },
      {
        key: "capacity",
        label: "Kapasite",
        type: "text",
        placeholder: "Örn. 500 adet/saat",
        when: { field: "needType", in: ["machine"] },
      },
      {
        key: "power",
        label: "Güç",
        type: "text",
        placeholder: "Örn. 7.5 kW",
        when: { field: "needType", in: ["machine"] },
      },
      {
        key: "voltage",
        label: "Voltaj",
        type: "select",
        when: { field: "needType", in: ["machine"] },
        options: [
          { label: "220V", value: "220V" },
          { label: "380V", value: "380V" },
          { label: "Fark etmez", value: "Fark etmez" },
        ],
      },
      {
        key: "condition",
        label: "Durum",
        type: "select",
        when: { field: "needType", in: ["machine", "part"] },
        options: [
          { label: "Sıfır", value: "Sıfır" },
          { label: "İkinci el", value: "İkinci el" },
          { label: "Fark etmez", value: "Fark etmez" },
        ],
      },
    ],
  },
  {
    id: "furniture",
    label: "Mobilya ve Ofis",
    description: "Masa, sandalye, ofis ve ev mobilyası ihtiyaçları",
    keywords: [
      "mobilya",
      "masa",
      "sandalye",
      "ofis sandalyesi",
      "çalışma masası",
      "calisma masasi",
      "toplantı masası",
      "toplantı masasi",
      "ofis masası",
      "dolap",
      "koltuk",
      "sehpa",
      "tezgah",
      "tezgâh",
      "büro",
      "buro",
      "ergonomik",
      ...brandKeywordList(FURNITURE_BRANDS),
    ],
    subcategories: [
      "Ev Mobilyası",
      "Ofis Mobilyaları",
      "Ofis Sandalyesi",
      "Çalışma / Ofis Masası",
      "Toplantı Masası",
      "Kafe ve Restoran",
      "Özel Üretim",
      "Diğer",
    ],
    commonFields: [
      {
        key: "title",
        placeholder: "Örn. 50 adet ofis sandalyesi talebi",
      },
      { key: "quantity", placeholder: "Örn. 50 adet" },
      { key: "city" },
      { key: "delivery", placeholder: "Örn. 2 hafta" },
      { key: "budget", placeholder: "Örn. ₺150.000" },
    ],
    measurementContracts: {
      dimensions: {
        kind: "physical_dimensions",
        axes: ["width", "depth", "height"],
        unit: "cm",
        example: "180 × 80 × 75 cm",
      },
    },
    questionContracts: FURNITURE_PRODUCT_QUESTION_CONTRACTS,
    fields: [
      {
        key: "furnitureType",
        label: "Ürün türü",
        type: "text",
        required: true,
        placeholder: "Örn. Şaraplık, koltuk takımı, çalışma masası",
      },
      {
        key: "usageArea",
        label: "Kullanım alanı",
        type: "select",
        required: false,
        options: [
          { label: "Ofis", value: "Ofis" },
          { label: "Ev", value: "Ev" },
          { label: "Kafe / restoran", value: "Kafe / restoran" },
          { label: "Okul / eğitim", value: "Okul / eğitim" },
          { label: "Mağaza / showroom", value: "Mağaza / showroom" },
          { label: "Diğer", value: "Diğer" },
        ],
      },
      {
        key: "dimensions",
        label: "Ölçü",
        type: "text",
        placeholder: "Örn. 140x70 masa veya standart sandalye",
        unit: "cm",
      },
      {
        key: "material",
        label: "Malzeme",
        type: "select",
        options: [
          { label: "MDFLAM / suntalam", value: "MDFLAM / suntalam" },
          { label: "Masif ahşap", value: "Masif ahşap" },
          { label: "Metal", value: "Metal" },
          { label: "Plastik", value: "Plastik" },
          { label: "File / mesh", value: "File / mesh" },
          { label: "Kumaş döşeme", value: "Kumaş döşeme" },
          { label: "Deri / suni deri", value: "Deri / suni deri" },
          { label: "Karışık / fark etmez", value: "Karışık / fark etmez" },
        ],
      },
      {
        key: "color",
        label: "Renk",
        type: "text",
        placeholder: "Örn. Siyah, antrasit, meşe",
      },
      {
        key: "features",
        label: "Özellikler",
        type: "text",
        placeholder: "Örn. kolluklu, tekerlekli, yükseklik ayarlı, bel destekli",
      },
      {
        key: "condition",
        label: "Durum",
        type: "select",
        options: [
          { label: "Sıfır", value: "Sıfır" },
          { label: "İkinci el", value: "İkinci el" },
          { label: "Fark etmez", value: "Fark etmez" },
        ],
      },
      {
        key: "assembly",
        label: "Montaj",
        type: "select",
        options: [
          { label: "Dahil olsun", value: "Dahil olsun" },
          { label: "Hariç", value: "Hariç" },
          { label: "Fark etmez", value: "Fark etmez" },
        ],
      },
    ],
  },
  {
    id: "technology",
    label: "Teknoloji",
    description: "Yazılım, donanım, web ve kurumsal teknoloji ihtiyaçları",
    keywords: [
      "yazılım",
      "yazilim",
      "web sitesi",
      "uygulama",
      "bilgisayar",
      "sunucu",
      "laptop",
      "notebook",
      "teknoloji",
      "entegrasyon",
      "telefon",
      "tablet",
      "iphone",
      "android",
      ...brandKeywordList(TECHNOLOGY_BRANDS),
    ],
    subcategories: [
      "Yazılım Geliştirme",
      "Web Sitesi",
      "Donanım",
      "Sistem ve Altyapı",
      "Diğer",
    ],
    commonFields: [
      { key: "title" },
      { key: "city" },
      {
        key: "delivery",
        label: "Proje süresi",
        placeholder: "Örn. 6 hafta",
      },
      { key: "budget" },
    ],
    questionContracts: TECHNOLOGY_PRODUCT_QUESTION_CONTRACTS,
    fields: [
      {
        key: "needType",
        label: "Ne arıyorsunuz?",
        type: "select",
        required: true,
        options: [
          { label: "Yazılım / proje", value: "software" },
          { label: "Donanım (satın alma)", value: "hardware" },
          { label: "Bakım / destek", value: "service" },
        ],
      },
      {
        key: "solutionType",
        label: "Çözüm / ürün",
        type: "text",
        placeholder: "Örn. Kurumsal web uygulaması veya laptop",
        required: true,
      },
      {
        key: "platform",
        label: "Platform",
        type: "select",
        when: { field: "needType", in: ["software"] },
        options: [
          { label: "Web", value: "Web" },
          { label: "iOS", value: "iOS" },
          { label: "Android", value: "Android" },
          { label: "Masaüstü", value: "Masaüstü" },
          { label: "Çoklu platform", value: "Çoklu platform" },
        ],
      },
      {
        key: "userCount",
        label: "Kullanıcı sayısı",
        type: "number",
        placeholder: "100",
        when: { field: "needType", in: ["software"] },
      },
      {
        key: "integration",
        label: "Entegrasyonlar",
        type: "text",
        placeholder: "Örn. ERP, ödeme, kargo",
        when: { field: "needType", in: ["software"] },
      },
      {
        key: "brand",
        label: "Marka",
        type: "text",
        placeholder: "Örn. Apple, Samsung, HP",
        when: { field: "needType", in: ["hardware"] },
      },
      {
        key: "condition",
        label: "Durum",
        type: "select",
        when: { field: "needType", in: ["hardware"] },
        options: [
          { label: "Sıfır", value: "Sıfır" },
          { label: "İkinci el", value: "İkinci el" },
          { label: "Yenilenmiş", value: "Yenilenmiş" },
          { label: "Fark etmez", value: "Fark etmez" },
        ],
      },
      {
        key: "specs",
        label: "Teknik özellikler",
        type: "text",
        placeholder: "Örn. i7, 16GB RAM, 512GB SSD",
        when: { field: "needType", in: ["hardware"] },
      },
      {
        key: "support",
        label: "Bakım ve destek",
        type: "select",
        when: { field: "needType", in: ["software", "service"] },
        options: [
          { label: "Gerekli", value: "Gerekli" },
          { label: "Gerekli değil", value: "Gerekli değil" },
          { label: "Kararsızım", value: "Kararsızım" },
        ],
      },
    ],
  },
  {
    id: "real-estate",
    label: "Emlak",
    description: "Konut, ticari gayrimenkul, kiralık ve satılık ilan talepleri",
    keywords: [
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
      "tarla",
      "imarlı",
      "imarli",
      "ticari arsa",
      "sanayi arsası",
      "sanayi arsasi",
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
      "ofis",
      "plaza ofisi",
      "mağaza",
      "magaza",
      "depo",
      "antrepo",
      "fabrika",
      "imalathane",
      "avm ünitesi",
      "avm unitesi",
      "otel",
      "bina",
      "site",
      "mahalle",
      "kat",
      "oda",
    ],
    subcategories: [
      "Kiralık Konut",
      "Satılık Konut",
      "Ticari Gayrimenkul",
      "Arsa",
      "Diğer",
    ],
    commonFields: [
      { key: "title" },
      {
        key: "city",
        label: "Şehir / İlçe",
        placeholder: "Örn. İstanbul / Bağcılar",
      },
      {
        key: "budget",
        label: "Bütçe / Kira",
        placeholder: "Örn. ₺25.000 / ay",
      },
    ],
    fields: [
      {
        key: "listingType",
        label: "İlan türü",
        type: "select",
        required: true,
        options: [
          { label: "Kiralık", value: "Kiralık" },
          { label: "Satılık", value: "Satılık" },
        ],
      },
      {
        key: "propertyType",
        label: "Gayrimenkul türü",
        type: "select",
        required: true,
        options: [
          { label: "Daire", value: "Daire" },
          { label: "Rezidans", value: "Rezidans" },
          { label: "Müstakil Ev", value: "Müstakil Ev" },
          { label: "Villa", value: "Villa" },
          { label: "Çiftlik Evi", value: "Çiftlik Evi" },
          { label: "Köşk & Konak", value: "Köşk & Konak" },
          { label: "Yalı", value: "Yalı" },
          { label: "Yalı Dairesi", value: "Yalı Dairesi" },
          { label: "Stüdyo", value: "Stüdyo" },
          { label: "Dubleks", value: "Dubleks" },
          { label: "İş yeri", value: "İş yeri" },
          { label: "Dükkan / mağaza", value: "Dükkan / mağaza" },
          { label: "Ofis", value: "Ofis" },
          { label: "Plaza ofisi", value: "Plaza ofisi" },
          { label: "Depo / antrepo", value: "Depo / antrepo" },
          { label: "Fabrika / imalathane", value: "Fabrika / imalathane" },
          { label: "AVM ünitesi", value: "AVM ünitesi" },
          { label: "Otel / apart", value: "Otel / apart" },
          { label: "Devren işyeri", value: "Devren işyeri" },
          { label: "Müştemilat", value: "Müştemilat" },
          { label: "Kooperatif hissesi", value: "Kooperatif hissesi" },
          { label: "Turistik tesis", value: "Turistik tesis" },
          { label: "Devre mülk", value: "Devre mülk" },
          { label: "Arsa", value: "Arsa" },
          { label: "İmarlı arsa", value: "İmarlı arsa" },
          { label: "Konut imarlı arsa", value: "Konut imarlı arsa" },
          { label: "Ticari arsa", value: "Ticari arsa" },
          { label: "Sanayi arsası", value: "Sanayi arsası" },
          { label: "Tarla", value: "Tarla" },
        ],
      },
      {
        key: "roomCount",
        label: "Oda sayısı",
        type: "select",
        when: {
          field: "propertyType",
          in: [
            "Daire",
            "Villa",
            "Rezidans",
            "Müstakil Ev",
            "Çiftlik Evi",
            "Köşk & Konak",
            "Yalı",
            "Yalı Dairesi",
            "Stüdyo",
            "Dubleks",
            "İş yeri",
          ],
        },
        options: [
          { label: "1+0", value: "1+0" },
          { label: "1+1", value: "1+1" },
          { label: "2+1", value: "2+1" },
          { label: "3+1", value: "3+1" },
          { label: "4+1", value: "4+1" },
          { label: "5+1 ve üzeri", value: "5+1+" },
        ],
      },
      {
        key: "area",
        label: "Metrekare",
        type: "number",
        placeholder: "120",
        unit: "m²",
      },
      {
        key: "neighborhoods",
        label: "Mahalle",
        type: "text",
        placeholder: "Seçilen mahalleler",
      },
      {
        key: "location",
        label: "Adres detayı",
        type: "text",
        placeholder: "Mahalle, cadde veya sokak bilgisi girin",
      },
      {
        key: "floor",
        label: "Kat",
        type: "text",
        placeholder: "Örn. 3 / 8",
        when: {
          field: "propertyType",
          in: [
            "Daire",
            "Rezidans",
            "Yalı Dairesi",
            "Stüdyo",
            "Dubleks",
            "İş yeri",
          ],
        },
      },
      {
        key: "buildingAge",
        label: "Bina yaşı",
        type: "number",
        placeholder: "5",
        unit: "yıl",
        when: {
          field: "propertyType",
          in: [
            "Daire",
            "Villa",
            "Rezidans",
            "Müstakil Ev",
            "Çiftlik Evi",
            "Köşk & Konak",
            "Yalı",
            "Yalı Dairesi",
            "Stüdyo",
            "Dubleks",
            "İş yeri",
          ],
        },
      },
      {
        key: "newBuildPreference",
        label: "Bina durumu",
        type: "select",
        when: {
          field: "propertyType",
          in: [
            "Daire",
            "Villa",
            "Rezidans",
            "Müstakil Ev",
            "Çiftlik Evi",
            "Köşk & Konak",
            "Yalı",
            "Yalı Dairesi",
            "Stüdyo",
            "Dubleks",
            "İş yeri",
            "Dükkan / mağaza",
            "Ofis",
            "Plaza ofisi",
            "Depo / antrepo",
            "Fabrika / imalathane",
            "AVM ünitesi",
            "Otel / apart",
            "Müştemilat",
            "Turistik tesis",
            "Devre mülk",
          ],
        },
        options: [
          { label: "Sıfır / yeni bina şart", value: "Yeni bina şart" },
          { label: "Yeni veya yakın tarihli", value: "Yeni / yakın tarihli" },
          { label: "Fark etmez", value: "Fark etmez" },
        ],
      },
    ],
    questionContracts: REAL_ESTATE_PRODUCT_QUESTION_CONTRACTS,
  },
  {
    id: "appliances",
    label: "Beyaz Eşya",
    description:
      "Küçük ev aletleri, beyaz eşya, ısıtma/soğutma ve havalandırma",
    keywords: [
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
      "mikro dalga",
      "mikrodalga",
      "şarap dolabı",
      "sarap dolabi",
      "airfryer",
      "ütü",
      "utu",
      "süpürge",
      "supurge",
      "ısıtma",
      "isitma",
      "havalandırma",
      ...brandKeywordList(APPLIANCE_BRANDS),
    ],
    subcategories: [
      "Küçük Ev Aletleri",
      "Beyaz Eşya",
      "Isıtma, Soğutma ve Havalandırma",
      "Diğer",
    ],
    commonFields: [
      { key: "title", placeholder: "Örn. 10 adet buzdolabı talebi" },
      { key: "quantity", placeholder: "Örn. 10 adet" },
      { key: "city" },
      { key: "delivery", placeholder: "Örn. 1 hafta" },
      { key: "budget", placeholder: "Örn. ₺250.000" },
    ],
    measurementContracts: {
      dimensions: {
        kind: "physical_dimensions",
        axes: ["width", "depth", "height"],
        unit: "cm",
        example: "90 × 60 × 180 cm",
      },
    },
    questionContracts: APPLIANCE_PRODUCT_QUESTION_CONTRACTS,
    fields: [
      {
        // Free text so taxonomy leaves (Blender, Robot Süpürge, …) persist & match explore
        key: "applianceType",
        label: "Ürün türü",
        type: "text",
        required: true,
        placeholder: "Örn. Buzdolabı, Klima, Elektrikli Süpürge",
      },
      {
        key: "usageArea",
        label: "Kullanım alanı",
        type: "select",
        options: [
          { label: "Ev", value: "Ev" },
          { label: "Ofis", value: "Ofis" },
          { label: "Otel / pansiyon", value: "Otel / pansiyon" },
          { label: "Restoran / kafe", value: "Restoran / kafe" },
          { label: "Kurumsal / toplu", value: "Kurumsal / toplu" },
          { label: "Diğer", value: "Diğer" },
        ],
      },
      {
        key: "energyClass",
        label: "Enerji sınıfı",
        type: "select",
        options: [
          { label: "A ve üzeri", value: "A ve üzeri" },
          { label: "B", value: "B" },
          { label: "Fark etmez", value: "Fark etmez" },
        ],
      },
      {
        // Canonical key = brand (explore/alerts). Legacy rows may still use brandPreference.
        key: "brand",
        label: "Marka",
        type: "text",
        placeholder: "Örn. Bosch, Arçelik, fark etmez",
      },
      {
        key: "features",
        label: "Özellikler",
        type: "text",
        placeholder: "Örn. no-frost, 9 kg, ankastre, inverter",
      },
      {
        key: "condition",
        label: "Durum",
        type: "select",
        options: [
          { label: "Sıfır", value: "Sıfır" },
          { label: "İkinci el", value: "İkinci el" },
          { label: "Fark etmez", value: "Fark etmez" },
        ],
      },
      {
        key: "installation",
        label: "Kurulum / montaj",
        type: "select",
        options: [
          { label: "Dahil olsun", value: "Dahil olsun" },
          { label: "Hariç", value: "Hariç" },
          { label: "Fark etmez", value: "Fark etmez" },
        ],
      },
    ],
  },
  {
    id: "health",
    label: "Sağlık",
    description: "Medikal cihaz, sağlık malzemesi ve klinik ihtiyaçlar",
    keywords: [
      "sağlık",
      "saglik",
      "medikal",
      "tıbbi",
      "tibbi",
      "hastane",
      "klinik",
      "eczane",
      "diş",
      "dis",
      "ortopedi",
      "laboratuvar",
      "stetoskop",
      "tansiyon aleti",
      "tansiyon ölçer",
      "tansiyon olcer",
      "oksijen konsantratör",
      "hasta yatağı",
      "hasta yatagi",
      "tekerlekli sandalye",
    ],
    subcategories: [
      "Medikal Cihaz",
      "Klinik Donanım",
      "Diş / Laboratuvar",
      "Diğer",
    ],
    commonFields: [
      { key: "title", placeholder: "Örn. Hasta yatağı talebi" },
      { key: "quantity", placeholder: "Örn. 20 adet" },
      { key: "city" },
      { key: "delivery", placeholder: "Örn. 10 gün" },
      { key: "budget" },
    ],
    questionContracts: HEALTH_PRODUCT_QUESTION_CONTRACTS,
    fields: [
      {
        key: "healthProductType",
        label: "Ürün / ihtiyaç türü",
        type: "select",
        required: true,
        options: [
          { label: "Medikal cihaz", value: "Medikal cihaz" },
          { label: "Hasta bakım ekipmanı", value: "Hasta bakım ekipmanı" },
          { label: "Diş / laboratuvar", value: "Diş / laboratuvar" },
          { label: "Koruyucu ekipman", value: "Koruyucu ekipman" },
          { label: "Diğer", value: "Diğer" },
        ],
      },
      {
        key: "productName",
        label: "Ürün adı",
        type: "text",
        required: true,
        placeholder: "Örn. Tekerlekli sandalye, tansiyon aleti",
      },
      {
        key: "usageArea",
        label: "Kullanım yeri",
        type: "select",
        options: [
          { label: "Hastane", value: "Hastane" },
          { label: "Klinik", value: "Klinik" },
          { label: "Eczane", value: "Eczane" },
          { label: "Evde bakım", value: "Evde bakım" },
          { label: "Kurumsal", value: "Kurumsal" },
          { label: "Diğer", value: "Diğer" },
        ],
      },
      {
        key: "certification",
        label: "Belge / sertifika",
        type: "select",
        options: [
          { label: "CE gerekli", value: "CE gerekli" },
          { label: "ISO tercih", value: "ISO tercih" },
          { label: "Fark etmez", value: "Fark etmez" },
        ],
      },
      {
        key: "features",
        label: "Teknik / özellik notu",
        type: "text",
        placeholder: "Örn. ayarlanabilir yükseklik, steril ambalaj",
      },
      {
        key: "condition",
        label: "Durum",
        type: "select",
        options: [
          { label: "Sıfır", value: "Sıfır" },
          { label: "İkinci el", value: "İkinci el" },
          { label: "Fark etmez", value: "Fark etmez" },
        ],
      },
    ],
  },
  {
    id: "baby",
    label: "Anne & Çocuk",
    description: "Bebek arabası, mama ürünleri, çocuk mobilyası, anne ve bakım ihtiyaçları",
    keywords: [
      "bebek",
      "çocuk",
      "cocuk",
      "anne",
      "anne çocuk",
      "anne cocuk",
      "anne bebek",
      "bebek arabası",
      "bebek arabasi",
      "puset",
      "mama sandalyesi",
      "mama",
      "emzik",
      "biberon",
      "bebek bezi",
      "beşik",
      "besik",
      "park yatak",
      "oyun parkı",
      "oyun parki",
      "hamile",
      "yenidoğan",
      "yenidogan",
      ...brandKeywordList(BABY_BRANDS),
    ],
    subcategories: [
      "Bebek Arabası",
      "Beslenme",
      "Uyku / Beşik",
      "Bakım",
      "Diğer",
    ],
    commonFields: [
      { key: "title", placeholder: "Örn. 5 adet bebek arabası" },
      { key: "quantity", placeholder: "Örn. 5 adet" },
      { key: "city" },
      { key: "delivery" },
      { key: "budget" },
    ],
    questionContracts: BABY_PRODUCT_QUESTION_CONTRACTS,
    fields: [
      {
        key: "babyProductType",
        label: "Ürün türü",
        type: "select",
        required: true,
        options: [
          { label: "Bebek arabası / puset", value: "Bebek arabası / puset" },
          { label: "Oto koltuğu / ana kucağı", value: "Oto koltuğu / ana kucağı" },
          { label: "Kanguru / bebek taşıyıcı", value: "Kanguru / bebek taşıyıcı" },
          { label: "Portbebe", value: "Portbebe" },
          { label: "Bebek arabası aksesuarı", value: "Bebek arabası aksesuarı" },
          { label: "Oto koltuğu aksesuarı", value: "Oto koltuğu aksesuarı" },
          { label: "Kanguru aksesuarı", value: "Kanguru aksesuarı" },
          { label: "Bebek bezi / alt değiştirme", value: "Bebek bezi / alt değiştirme" },
          { label: "Bez saklama / atık yönetimi", value: "Bez saklama / atık yönetimi" },
          { label: "Islak mendil / pişik bakımı", value: "Islak mendil / pişik bakımı" },
          { label: "Bebek banyo ürünü", value: "Bebek banyo ürünü" },
          { label: "Bebek sağlık / bakım ürünü", value: "Bebek sağlık / bakım ürünü" },
          { label: "Emzik aksesuarı / temizliği", value: "Emzik aksesuarı / temizliği" },
          { label: "Lazımlık / tuvalet eğitimi", value: "Lazımlık / tuvalet eğitimi" },
          { label: "Bebek güvenlik ürünü", value: "Bebek güvenlik ürünü" },
          { label: "Oyun / gezi ürünü", value: "Oyun / gezi ürünü" },
          { label: "Oyuncak", value: "Oyuncak" },
          { label: "Diğer bebek ürünü", value: "Diğer bebek ürünü" },
          { label: "Mama sandalyesi", value: "Mama sandalyesi" },
          { label: "Beşik / park yatak", value: "Beşik / park yatak" },
          { label: "Uyku tulumu", value: "Uyku tulumu" },
          { label: "Bebek battaniyesi / kundak", value: "Bebek battaniyesi / kundak" },
          { label: "Bebek odası mobilyası", value: "Bebek odası mobilyası" },
          { label: "Yatak koruyucu / nest", value: "Yatak koruyucu / nest" },
          { label: "Biberon / suluk", value: "Biberon / suluk" },
          { label: "Emzik / diş kaşıyıcı", value: "Emzik / diş kaşıyıcı" },
          { label: "Sterilizatör / mama hazırlama", value: "Sterilizatör / mama hazırlama" },
          { label: "Göğüs pompası / süt saklama", value: "Göğüs pompası / süt saklama" },
          { label: "Bebek / çocuk gıdası", value: "Bebek / çocuk gıdası" },
          { label: "Beslenme ürünleri", value: "Beslenme ürünleri" },
          { label: "Bebek bezi / bakım", value: "Bebek bezi / bakım" },
          { label: "Oyuncak / gelişim", value: "Oyuncak / gelişim" },
          { label: "Diğer", value: "Diğer" },
        ],
      },
      {
        key: "ageRange",
        label: "Yaş aralığı",
        type: "select",
        options: [
          { label: "0–6 ay", value: "0–6 ay" },
          { label: "6–12 ay", value: "6–12 ay" },
          { label: "1–3 yaş", value: "1–3 yaş" },
          { label: "3+ yaş", value: "3+ yaş" },
          { label: "Fark etmez", value: "Fark etmez" },
        ],
      },
      {
        key: "brandPreference",
        label: "Marka tercihi",
        type: "text",
        placeholder: "Örn. Chicco, Joie, fark etmez",
      },
      {
        key: "features",
        label: "Özellikler",
        type: "text",
        placeholder: "Örn. katlanır, çift yönlü, güvenlik kemeri",
      },
      {
        key: "condition",
        label: "Durum",
        type: "select",
        options: [
          { label: "Sıfır", value: "Sıfır" },
          { label: "İkinci el", value: "İkinci el" },
          { label: "Fark etmez", value: "Fark etmez" },
        ],
      },
    ],
  },
  {
    id: "home-kitchen",
    label: "Ev ve Mutfak",
    description: "Tabak, çanak, kahve seti, çatal-bıçak ve mutfak eşyaları",
    keywords: [
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
      "bıçak",
      "bicak",
      "kaşık",
      "kasik",
      "çorba kasesi",
      "corba kasesi",
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
      "sürahi",
      "surahi",
      "sofra",
    ],
    subcategories: [
      "Yemek Takımı",
      "Kahve / Çay Seti",
      "Çatal Bıçak",
      "Cam / Porselen",
      "Diğer",
    ],
    commonFields: [
      { key: "title", placeholder: "Örn. 20 kişilik yemek takımı" },
      { key: "quantity", placeholder: "Örn. 20 takım" },
      { key: "city" },
      { key: "delivery" },
      { key: "budget" },
    ],
    measurementContracts: {
      dimensions: {
        kind: "physical_dimensions",
        axes: ["width", "depth", "height"],
        unit: "cm",
        example: "60 × 45 × 20 cm",
      },
    },
    questionContracts: HOME_KITCHEN_PRODUCT_QUESTION_CONTRACTS,
    fields: [
      {
        key: "kitchenProductType",
        label: "Ürün türü",
        type: "select",
        required: true,
        options: [
          { label: "Yemek / tabak takımı", value: "Yemek / tabak takımı" },
          { label: "Kahve seti", value: "Kahve seti" },
          { label: "Çay seti", value: "Çay seti" },
          { label: "Tencere / tava", value: "Tencere / tava" },
          { label: "Çatal-bıçak takımı", value: "Çatal-bıçak takımı" },
          { label: "Bardak / kadeh", value: "Bardak / kadeh" },
          { label: "Servis / tepsi", value: "Servis / tepsi" },
          { label: "Mutfak gereçleri", value: "Mutfak gereçleri" },
          { label: "Mutfak / banyo armatürü", value: "Mutfak / banyo armatürü" },
          { label: "Ev dekorasyonu", value: "Ev dekorasyonu" },
          { label: "Ev bakım / düzen", value: "Ev bakım / düzen" },
          { label: "Diğer mutfak eşyası", value: "Diğer mutfak eşyası" },
        ],
      },
      {
        key: "pieceCount",
        label: "Parça / kişilik",
        type: "text",
        placeholder: "Örn. 12 kişilik, 24 parça",
      },
      {
        key: "material",
        label: "Malzeme",
        type: "select",
        options: [
          { label: "Porselen", value: "Porselen" },
          { label: "Cam", value: "Cam" },
          { label: "Seramik", value: "Seramik" },
          { label: "Çelik", value: "Çelik" },
          { label: "Melamin", value: "Melamin" },
          { label: "Karışık / fark etmez", value: "Karışık / fark etmez" },
        ],
      },
      {
        key: "usageArea",
        label: "Kullanım alanı",
        type: "select",
        options: [
          { label: "Ev", value: "Ev" },
          { label: "Kafe / restoran", value: "Kafe / restoran" },
          { label: "Otel", value: "Otel" },
          { label: "Ofis", value: "Ofis" },
          { label: "Hediye / kurumsal", value: "Hediye / kurumsal" },
          { label: "Diğer", value: "Diğer" },
        ],
      },
      {
        key: "color",
        label: "Renk / desen",
        type: "text",
        placeholder: "Örn. beyaz, altın yaldız, sade",
      },
      {
        key: "features",
        label: "Özellikler",
        type: "text",
        placeholder: "Örn. bulaşık makinesinde yıkanabilir, hediye kutulu",
      },
    ],
  },
  {
    id: "services",
    label: "Hizmetler",
    description: "Genel profesyonel ve kurumsal hizmet talepleri",
    keywords: [
      "hizmet",
      "danışmanlık",
      "danismanlik",
      "temizlik",
      "nakliye",
      "nakliyat",
      "evden eve",
      "taşımacılık",
      "tasimacilik",
      "eşya taşıma",
      "esya tasima",
      "taşıma",
      "tasima",
      "bakım",
      "bakim",
      "boş ev temizliği",
      "bos ev temizligi",
      "ev temizliği",
      "ev temizligi",
      "halı yıkama",
      "hali yikama",
      "koltuk yıkama",
      "koltuk yikama",
      "cam balkon",
      "boya badana",
      "boya",
      "badana",
      "demirdöküm kombi",
      "demirdokum kombi",
      "eca kombi",
      "kombi servisi",
      "klima servisi",
      "direksiyon dersi",
      "duvar dekorasyon",
      "ev dekorasyon",
      "fayans döşeme",
      "fayans doseme",
      "iç mimar",
      "ic mimar",
      "elektrikçi",
      "elektrikci",
      "parça eşya taşıma",
      "parca esya tasima",
      "logo tasarımı",
      "logo tasarimi",
      "grafik tasarım",
      "grafik tasarim",
      "evde bakım desteği",
      "evde bakim destegi",
      "evde bakım",
      "evde bakim",
      "hasta refakati",
      "ev yardımcısı",
      "ev yardimcisi",
      "evde yardımcı",
      "evde yardimci",
      "ev hizmetlisi",
      "evde hizmetli",
      "ev işleri yardımcısı",
      "ev isleri yardimcisi",
    ],
    subcategories: [
      "Temizlik",
      "Ev Tadilat ve Dekorasyon",
      "Teknik Servis",
      "Nakliye",
      "Eğitim",
      "Grafik ve Tasarım",
      "Evde Bakım ve Destek",
    ],
    commonFields: [
      { key: "title" },
      { key: "city" },
      { key: "budget" },
    ],
    fields: [
      {
        key: "serviceType",
        label: "Hizmet türü",
        type: "select",
        required: true,
        options: [
          { label: "Boş ev temizliği", value: "Boş ev temizliği" },
          { label: "Boya badana", value: "Boya badana" },
          { label: "Cam balkon", value: "Cam balkon" },
          { label: "Kombi servisi", value: "Kombi servisi" },
          { label: "Direksiyon dersi", value: "Direksiyon dersi" },
          { label: "Duvar dekorasyon", value: "Duvar dekorasyon" },
          { label: "Klima servisi", value: "Klima servisi" },
          { label: "Elektrikçi", value: "Elektrikçi" },
          { label: "Parça eşya taşıma", value: "Parça eşya taşıma" },
          { label: "Ev dekorasyon", value: "Ev dekorasyon" },
          { label: "Ev temizliği", value: "Ev temizliği" },
          { label: "Evden eve nakliyat", value: "Evden eve nakliyat" },
          { label: "Fayans döşeme", value: "Fayans döşeme" },
          { label: "Halı yıkama / temizleme", value: "Halı yıkama / temizleme" },
          { label: "Koltuk yıkama / temizleme", value: "Koltuk yıkama / temizleme" },
          { label: "İç mimar", value: "İç mimar" },
          { label: "Grafik ve logo tasarımı", value: "Grafik ve logo tasarımı" },
          { label: "Evde bakım desteği", value: "Evde bakım desteği" },
          { label: "Ev yardımcısı / ev hizmetlisi", value: "Ev yardımcısı / ev hizmetlisi" },
        ],
      },
    ],
    questionContracts: SERVICES_PRODUCT_QUESTION_CONTRACTS,
  },
];

/**
 * Vitrin sırası — kurucu kararı (2026-08-23). Kimlikler ve tanımlar yukarıda
 * kalır; burası yalnız sunum sırasını belirler. Listede olmayan bir id
 * eklenirse aşağıdaki kontrol yüksek sesle patlar.
 */
const CATEGORY_DISPLAY_ORDER: readonly string[] = [
  "real-estate",
  "automotive",
  "technology",
  "appliances",
  "furniture",
  "printing",
  "machinery",
  "baby",
  "home-kitchen",
  "health",
  "services",
];

for (const def of CATEGORY_DEFINITIONS) {
  if (!CATEGORY_DISPLAY_ORDER.includes(def.id)) {
    throw new Error(`CATEGORY_DISPLAY_ORDER eksik id: ${def.id}`);
  }
}

export const REQUEST_CATEGORIES: RequestCategory[] = [...CATEGORY_DEFINITIONS].sort(
  (a, b) => CATEGORY_DISPLAY_ORDER.indexOf(a.id) - CATEGORY_DISPLAY_ORDER.indexOf(b.id),
);

/**
 * Admin tarafından veritabanından eklenen kategoriler için istemci çalışma
 * zamanı kaydı. Bunlar statik beyin sözleşmelerinin yerine geçmez; yalnızca
 * seçilebilir bir kategori ve ortak, güvenli talep akışı sağlar. Kategoriye
 * özel sorular ileride ayrı bir sözleşmeyle tanımlanır.
 */
const RUNTIME_CATEGORIES = new Map<string, RequestCategory>();

export type RuntimeCategoryInput = {
  name: string;
  slug: string;
  description?: string | null;
  sortOrder?: number;
};

export function registerRuntimeCategories(
  categories: RuntimeCategoryInput[],
): RequestCategory[] {
  RUNTIME_CATEGORIES.clear();
  const staticIds = new Set(REQUEST_CATEGORIES.map((category) => category.id));
  for (const category of categories) {
    const slug = category.slug.trim();
    if (!slug || staticIds.has(slug)) continue;
    RUNTIME_CATEGORIES.set(slug, {
      id: slug,
      label: category.name.trim() || slug,
      description: category.description?.trim() || "Talep kategorisi",
      keywords: [],
      subcategories: [],
      commonFields: [{ key: "title" }, { key: "city" }, { key: "budget" }],
      fields: [],
    });
  }
  return [...RUNTIME_CATEGORIES.values()].sort(
    (a, b) => a.label.localeCompare(b.label, "tr-TR"),
  );
}

export function getRuntimeCategories(): RequestCategory[] {
  return [...RUNTIME_CATEGORIES.values()];
}

export function getBuiltInCategoryById(id: string): RequestCategory | null {
  const trimmed = id?.trim() ?? "";
  return REQUEST_CATEGORIES.find((category) => category.id === trimmed) ?? null;
}

/**
 * Sahibinden-style marketplace filter parity, adapted for Talepo's reverse
 * marketplace. Keep this isolated so the experiment can be rolled back by
 * changing one flag; none of these fields becomes a publishing requirement.
 */
export const MARKETPLACE_FILTER_PARITY_V1_ENABLED = true;

const MARKETPLACE_FILTER_PARITY_V1: Partial<
  Record<RequestCategory["id"], DynamicField[]>
> = {
  automotive: [
    {
      key: "mileage",
      label: "Kilometre",
      type: "number",
      placeholder: "Örn. 80.000",
      unit: "km",
      when: { field: "needType", in: ["vehicle"] },
    },
    {
      key: "bodyType",
      label: "Kasa tipi",
      type: "select",
      when: { field: "needType", in: ["vehicle"] },
      options: [
        { label: "Sedan", value: "Sedan" },
        { label: "Hatchback", value: "Hatchback" },
        { label: "SUV", value: "SUV" },
        { label: "Station wagon", value: "Station wagon" },
        { label: "Coupe", value: "Coupe" },
        { label: "Cabrio", value: "Cabrio" },
        { label: "Pickup", value: "Pickup" },
        { label: "Fark etmez", value: "Fark etmez" },
      ],
    },
    {
      key: "driveType",
      label: "Çekiş",
      type: "select",
      when: { field: "needType", in: ["vehicle"] },
      options: [
        { label: "Önden çekiş", value: "Önden çekiş" },
        { label: "Arkadan itiş", value: "Arkadan itiş" },
        { label: "4x4", value: "4x4" },
        { label: "Fark etmez", value: "Fark etmez" },
      ],
    },
    {
      key: "warranty",
      label: "Garanti",
      type: "select",
      when: { field: "needType", in: ["vehicle", "part"] },
      options: [
        { label: "Garantili", value: "Garantili" },
        { label: "Garanti gerekmiyor", value: "Garanti gerekmiyor" },
        { label: "Fark etmez", value: "Fark etmez" },
      ],
    },
  ],
  machinery: [
    {
      key: "brand",
      label: "Marka",
      type: "text",
      placeholder: "Örn. Caterpillar, Atlas Copco",
      when: { field: "needType", in: ["machine", "part"] },
    },
    {
      key: "model",
      label: "Model",
      type: "text",
      placeholder: "Örn. XAS 88",
      when: { field: "needType", in: ["machine", "part"] },
    },
    {
      key: "modelYear",
      label: "Model yılı",
      type: "number",
      placeholder: "Örn. 2022",
      when: { field: "needType", in: ["machine"] },
    },
    {
      key: "operatingHours",
      label: "Çalışma saati",
      type: "number",
      placeholder: "Örn. 4.500",
      unit: "saat",
      when: { field: "needType", in: ["machine"] },
    },
    {
      key: "warranty",
      label: "Garanti",
      type: "select",
      when: { field: "needType", in: ["machine", "part"] },
      options: [
        { label: "Garantili", value: "Garantili" },
        { label: "Garanti gerekmiyor", value: "Garanti gerekmiyor" },
        { label: "Fark etmez", value: "Fark etmez" },
      ],
    },
  ],
  technology: [
    { key: "model", label: "Model", type: "text", when: { field: "needType", in: ["hardware"] } },
    { key: "processor", label: "İşlemci", type: "text", placeholder: "Örn. Core i7 veya Apple M4", when: { field: "needType", in: ["hardware"] }, whenProductTypes: [...COMPUTER_PRODUCT_TYPES, "tablet"] },
    { key: "ram", label: "RAM", type: "text", placeholder: "Örn. 16 GB ve üzeri", when: { field: "needType", in: ["hardware"] }, whenProductTypes: [...COMPUTER_PRODUCT_TYPES, "tablet"] },
    { key: "storage", label: "Depolama", type: "text", placeholder: "Örn. 512 GB SSD", when: { field: "needType", in: ["hardware"] }, whenProductTypes: [...COMPUTER_PRODUCT_TYPES, "tablet", "telefon"] },
    { key: "graphics", label: "Ekran kartı", type: "text", placeholder: "Örn. RTX 4060 veya fark etmez", when: { field: "needType", in: ["hardware"] }, whenProductTypes: COMPUTER_PRODUCT_TYPES },
    /**
     * ÖLÇÜLDÜ (2026-09-14): `screenSize` ürün kapsamı taşımadığı için
     * kulaklık, fotoğraf makinesi ve hatta ürünsüz akışta da görünüyordu.
     * I9 sözleşmesi bunu açıkça yasaklar (Laptop / Kulaklık / Fotoğraf
     * Makinesi → never: screenSize) ve yalnız Televizyon için ister.
     */
    { key: "screenSize", label: "Ekran boyutu", type: "text", placeholder: "Örn. 55 inç", whenProductTypes: ["televizyon", "tv", "monitör", "monitor"], when: { field: "needType", in: ["hardware"] } },
    {
      key: "warranty",
      label: "Garanti",
      type: "select",
      when: { field: "needType", in: ["hardware"] },
      options: [
        { label: "Garantili", value: "Garantili" },
        { label: "Garanti gerekmiyor", value: "Garanti gerekmiyor" },
        { label: "Fark etmez", value: "Fark etmez" },
      ],
    },
  ],
  "real-estate": [
    { key: "grossArea", label: "Brüt alan", type: "number", placeholder: "Örn. 140", unit: "m²", whenProductTypes: BUILDING_PROPERTY_TYPES },
    { key: "netArea", label: "Net alan", type: "number", placeholder: "Örn. 120", unit: "m²", whenProductTypes: BUILDING_PROPERTY_TYPES },
    { key: "totalFloors", label: "Bina kat sayısı", type: "number", placeholder: "Örn. 8", whenProductTypes: BUILDING_PROPERTY_TYPES },
    {
      key: "heating",
      whenProductTypes: BUILDING_PROPERTY_TYPES,
      label: "Isıtma",
      type: "select",
      options: [
        { label: "Doğalgaz / kombi", value: "Doğalgaz / kombi" },
        { label: "Merkezi sistem", value: "Merkezi sistem" },
        { label: "Yerden ısıtma", value: "Yerden ısıtma" },
        { label: "Klima", value: "Klima" },
        { label: "Fark etmez", value: "Fark etmez" },
      ],
    },
    { key: "bathroomCount", label: "Banyo sayısı", type: "number", placeholder: "Örn. 2", whenProductTypes: BUILDING_PROPERTY_TYPES },
    {
      key: "furnished",
      whenProductTypes: BUILDING_PROPERTY_TYPES,
      label: "Eşyalı",
      type: "select",
      options: [
        { label: "Eşyalı", value: "Eşyalı" },
        { label: "Eşyasız", value: "Eşyasız" },
        { label: "Fark etmez", value: "Fark etmez" },
      ],
    },
    {
      key: "parking",
      whenProductTypes: BUILDING_PROPERTY_TYPES,
      label: "Otopark",
      type: "select",
      options: [
        { label: "Açık otopark", value: "Açık otopark" },
        { label: "Kapalı otopark", value: "Kapalı otopark" },
        { label: "Gerekli değil", value: "Gerekli değil" },
      ],
    },
    {
      key: "elevator",
      whenProductTypes: BUILDING_PROPERTY_TYPES,
      label: "Asansör",
      type: "select",
      options: [
        { label: "Olmalı", value: "Olmalı" },
        { label: "Gerekli değil", value: "Gerekli değil" },
        { label: "Fark etmez", value: "Fark etmez" },
      ],
    },
    {
      key: "loanEligibility",
      label: "Krediye uygunluk",
      type: "select",
      when: { field: "listingType", in: ["Satılık"] },
      options: [
        { label: "Krediye uygun", value: "Krediye uygun" },
        { label: "Fark etmez", value: "Fark etmez" },
      ],
    },
    {
      key: "deedStatus",
      label: "Tapu durumu",
      type: "text",
      placeholder: "Örn. Kat mülkiyetli",
      when: { field: "listingType", in: ["Satılık"] },
    },
  ],
};

if (MARKETPLACE_FILTER_PARITY_V1_ENABLED) {
  for (const category of REQUEST_CATEGORIES) {
    const additions = MARKETPLACE_FILTER_PARITY_V1[category.id] ?? [];
    const existingKeys = new Set(category.fields.map((field) => field.key));
    category.fields.push(
      ...additions.filter((field) => !existingKeys.has(field.key)),
    );
  }
}

export const UNKNOWN_REQUEST_CATEGORY: RequestCategory = {
  id: "",
  label: "Talep",
  description: "Kategori henüz net değil",
  keywords: [],
  subcategories: [],
  commonFields: [
    { key: "title" },
    { key: "city" },
    { key: "budget" },
  ],
  fields: [],
};

/**
 * Resolve an engine category by id/slug.
 * - empty / "unknown" / "unresolved" → explicit UNKNOWN shell (not a product category)
 * - known id → category
 * - unknown id → null (never silent-fallback to the last category)
 */
export function getCategoryById(id: string): RequestCategory | null {
  const trimmed = id?.trim() ?? "";
  if (!trimmed || trimmed === "unknown" || trimmed === "unresolved") {
    return UNKNOWN_REQUEST_CATEGORY;
  }
  return getBuiltInCategoryById(trimmed) ??
    RUNTIME_CATEGORIES.get(trimmed) ??
    null;
}

/**
 * Ürün bağlamına uyan kategori sözleşmesini döndürür. Eşleşme yoksa `null`
 * dönmek kasıtlıdır: ürün türü belirsizken dar bir soru kümesi uydurulmaz.
 */
export function resolveCategoryQuestionContract(input: {
  categoryId: string;
  productType?: string | null;
  needType?: string | null;
}): ProductQuestionContract | null {
  const productType = foldProductContext(input.productType ?? "");
  const alias = input.productType ? resolveTaxonomyAlias(input.productType, input.categoryId) : null;
  const productForms = [productType];
  if (alias && (!alias.ambiguous || alias.canonicalNameUnambiguous)) {
    productForms.push(foldProductContext(alias.node.canonicalName));
  }
  const needType = (input.needType ?? "").trim();
  const contracts = getCategoryById(input.categoryId)?.questionContracts ?? [];
  let selected: ProductQuestionContract | null = null;
  let selectedScore = -1;

  for (const contract of contracts) {
    if (contract.excludeNeedTypes?.includes(needType)) continue;
    const matchesNeed =
      !contract.whenNeedTypes?.length ||
      (Boolean(needType) && contract.whenNeedTypes.includes(needType));
    if (!matchesNeed) continue;

    const matchingProductTokens = (contract.whenProductTypes ?? []).filter(
      (value) => productForms.some((form) => form.includes(foldProductContext(value))),
    );
    const matchesProduct =
      !contract.whenProductTypes?.length ||
      (Boolean(productType) && matchingProductTokens.length > 0);
    if (!matchesProduct) continue;

    /**
     * "Biberon ucu" gibi dar ürünler, "biberon" gibi üst ailelerle de
     * eşleşebilir. Sıra bağımlılığı yerine en uzun ürün işaretini seçmek,
     * ürünün kendi sözleşmesini her zaman üstün kılar.
     */
    const productSpecificity = Math.max(
      0,
      ...matchingProductTokens.map((value) => foldProductContext(value).length),
    );
    const needSpecificity = contract.whenNeedTypes?.length ? 1 : 0;
    const directMatch = matchingProductTokens.some((value) => productType.includes(foldProductContext(value)));
    const score = (directMatch ? 10000 : 0) + productSpecificity * 10 + needSpecificity;
    if (score > selectedScore) {
      selected = contract;
      selectedScore = score;
    }
  }

  return selected;
}

/** UI-safe resolve: unknown ids become UNKNOWN shell, never an unrelated category. */
export function resolveRequestCategory(
  id: string | null | undefined,
  availableCategories?: readonly RequestCategory[],
): RequestCategory {
  if (id == null) return UNKNOWN_REQUEST_CATEGORY;
  if (availableCategories) return availableCategories.find((category) => category.id === id) ?? UNKNOWN_REQUEST_CATEGORY;
  return getCategoryById(id) ?? UNKNOWN_REQUEST_CATEGORY;
}

/**
 * @deprecated Not authoritative for request understanding.
 * Use only as a non-locking UX hint (e.g. Home composer label).
 * Canonical category comes from understandRequest().
 */
export function detectCategory(text: string): RequestCategory {
  const normalized = text.toLocaleLowerCase("tr-TR");

  let bestCategory = REQUEST_CATEGORIES[REQUEST_CATEGORIES.length - 1];
  let bestScore = 0;

  for (const category of REQUEST_CATEGORIES) {
    const score = category.keywords.reduce(
      (total, keyword) => total + (normalized.includes(keyword) ? 1 : 0),
      0
    );

    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

/** Explicit non-authoritative home/UX hint label — never locks category. */
export function detectCategoryHintLabel(text: string): string | null {
  const normalized = text.toLocaleLowerCase("tr-TR");
  if (normalized.trim().length < 8) return null;
  const category = detectCategory(normalized);
  const matched = category.keywords.some((keyword) =>
    normalized.includes(keyword),
  );
  return matched ? category.label : null;
}

export function createInitialDynamicValues(
  category: RequestCategory
): Record<string, string> {
  return Object.fromEntries(category.fields.map((field) => [field.key, ""]));
}

export function parseDynamicValues(
  text: string,
  category: RequestCategory
): Record<string, string> {
  const normalized = text.toLocaleLowerCase("tr-TR");
  const values = createInitialDynamicValues(category);

  const dimensionMatch = text.match(
    /(\d+\s?[x×]\s?\d+(?:\s?[x×]\s?\d+)?)\s*(cm|mm)?/i
  );
  const yearMatch = text.match(/\b(19|20)\d{2}\b/);
  const gramMatch = text.match(/(\d{2,4})\s*(gr|gram)\b/i);

  if (dimensionMatch && "dimensions" in values) {
    values.dimensions = `${dimensionMatch[1].replace(/\s/g, "")} ${
      dimensionMatch[2] ?? "cm"
    }`;
  }

  if (yearMatch && "modelYear" in values) {
    values.modelYear = yearMatch[0];
  }

  if (gramMatch && "paperWeight" in values) {
    values.paperWeight = gramMatch[1];
  }

  if ("brand" in values) {
    const auto = findBrand(text, AUTOMOTIVE_BRANDS);
    const other =
      findBrand(text, APPLIANCE_BRANDS) ||
      findBrand(text, TECHNOLOGY_BRANDS) ||
      findBrand(text, FURNITURE_BRANDS) ||
      findBrand(text, BABY_BRANDS);
    // Prefer category-appropriate brand; don't wipe an explicit value with ""
    const hit = auto || other;
    if (hit) values.brand = hit;
  }

  if ("model" in values) {
    values.model = findAutomotiveModel(text, values.brand || undefined) ?? "";
  }

  if ("brandPreference" in values) {
    const preference =
      findBrand(text, APPLIANCE_BRANDS) ||
      findBrand(text, BABY_BRANDS) ||
      findBrand(text, TECHNOLOGY_BRANDS) ||
      findBrand(text, FURNITURE_BRANDS);
    values.brandPreference = preference ?? values.brand ?? "";
  }

  if ("part" in values) {
    const parts = [
      "ön tampon",
      "arka tampon",
      "ön balata",
      "arka balata",
      "far",
      "stop",
      "kaput",
      "çamurluk",
      "motor",
      "şanzıman",
    ];
    values.part = parts.find((part) => normalized.includes(part)) ?? "";
  }

  if ("material" in values) {
    if (normalized.includes("kraft")) values.material = "Kraft";
    else if (normalized.includes("bristol")) values.material = "Bristol";
    else if (normalized.includes("oluklu")) values.material = "Oluklu Mukavva";
    else if (normalized.includes("mdflam")) values.material = "MDFLAM";
    else if (normalized.includes("masif")) values.material = "Masif ahşap";
  }

  if ("printType" in values) {
    if (normalized.includes("ofset")) values.printType = "4 renk ofset";
    else if (normalized.includes("dijital")) values.printType = "Dijital baskı";
    else if (normalized.includes("flekso")) values.printType = "Flekso baskı";
  }

  if ("lamination" in values) {
    if (normalized.includes("mat selefon"))
      values.lamination = "Mat selefon";
    else if (normalized.includes("parlak selefon"))
      values.lamination = "Parlak selefon";
    else if (normalized.includes("lak")) values.lamination = "Lak";
  }

  if ("machineType" in values) {
    const machineKeywords = [
      "cnc kesim",
      "paketleme makinesi",
      "kompresör",
      "pres makinesi",
      "baskı makinesi",
    ];
    values.machineType =
      machineKeywords.find((item) => normalized.includes(item)) ?? "";
  }

  if ("furnitureType" in values) {
    if (
      normalized.includes("ofis sandalyesi") ||
      (normalized.includes("sandalye") && normalized.includes("ofis"))
    ) {
      values.furnitureType = "Ofis sandalyesi";
    } else if (
      normalized.includes("toplantı masası") ||
      normalized.includes("toplantı masasi")
    ) {
      values.furnitureType = "Toplantı masası";
    } else if (
      normalized.includes("masa takımı") ||
      normalized.includes("masa takimi") ||
      normalized.includes("makam") ||
      normalized.includes("yönetici masa") ||
      normalized.includes("yonetici masa")
    ) {
      values.furnitureType = "Makam / yönetici masa takımı";
    } else if (
      normalized.includes("çalışma masası") ||
      normalized.includes("calisma masasi") ||
      normalized.includes("ofis masası") ||
      normalized.includes("ofis masasi")
    ) {
      values.furnitureType = "Çalışma / ofis masası";
    } else if (normalized.includes("kafe") && normalized.includes("masa")) {
      values.furnitureType = "Kafe masa-sandalye seti";
    } else if (normalized.includes("sandalye")) {
      values.furnitureType = "Ofis sandalyesi";
    } else if (normalized.includes("koltuk")) {
      values.furnitureType = "Koltuk grubu";
    } else if (normalized.includes("dolap")) {
      values.furnitureType = "Dolap / raf";
    } else if (
      normalized.includes("masa") &&
      !normalized.includes("masaüstü") &&
      !normalized.includes("masaustu")
    ) {
      values.furnitureType = "Çalışma / ofis masası";
    }
  }

  if ("usageArea" in values) {
    if (normalized.includes("kafe") || normalized.includes("restoran")) {
      values.usageArea = "Kafe / restoran";
    } else if (normalized.includes("okul") || normalized.includes("eğitim")) {
      values.usageArea = "Okul / eğitim";
    } else if (
      normalized.includes("makam") ||
      normalized.includes("ofis") ||
      normalized.includes("büro") ||
      normalized.includes("buro")
    ) {
      values.usageArea = "Ofis";
    } else if (normalized.includes("mağaza") || normalized.includes("magaza")) {
      values.usageArea = "Mağaza / showroom";
    } else if (normalized.includes("ev")) {
      values.usageArea = "Ev";
    }
  }

  if ("solutionType" in values) {
    if (normalized.includes("web sitesi"))
      values.solutionType = "Kurumsal web sitesi";
    else if (normalized.includes("uygulama"))
      values.solutionType = "Web / mobil uygulama";
    else if (normalized.includes("bilgisayar"))
      values.solutionType = "Bilgisayar ve donanım";
  }

  if ("serviceType" in values) {
    const services = [
      { value: "Boş ev temizliği", terms: ["boş ev temizliği", "bos ev temizligi"] },
      { value: "Grafik ve logo tasarımı", terms: ["logo tasarımı", "logo tasarimi", "grafik tasarım", "grafik tasarim"] },
      { value: "Boya badana", terms: ["boya badana", "boya", "badana", "boyat"] },
      { value: "Cam balkon", terms: ["cam balkon"] },
      { value: "Koltuk yıkama / temizleme", terms: ["koltuk yıkama", "koltuk yikama"] },
      { value: "Evde bakım desteği", terms: ["evde bakım desteği", "evde bakim destegi", "evde bakım", "evde bakim", "hasta refakati", "yaşlı bakım", "yasli bakim", "hasta bakım", "hasta bakim", "yaşlı bakıcı", "yasli bakici", "hasta bakıcı", "hasta bakici"] },
      { value: "Ev yardımcısı / ev hizmetlisi", terms: ["ev yardımcısı", "ev yardimcisi", "evde yardımcı", "evde yardimci", "ev hizmetlisi", "evde hizmetli", "ev işleri yardımcısı", "ev isleri yardimcisi"] },
      { value: "Kombi servisi", terms: ["kombi servisi", "demirdöküm kombi", "demirdokum kombi", "eca kombi"] },
      { value: "Klima servisi", terms: ["klima servisi", "klima bakım", "klima bakim"] },
      { value: "Direksiyon dersi", terms: ["direksiyon dersi"] },
      { value: "Duvar dekorasyon", terms: ["duvar dekorasyon"] },
      { value: "Elektrikçi", terms: ["elektrikçi", "elektrikci"] },
      { value: "Parça eşya taşıma", terms: ["parça eşya taşıma", "parca esya tasima"] },
      { value: "Ev dekorasyon", terms: ["ev dekorasyon"] },
      { value: "Ev temizliği", terms: ["ev temizliği", "ev temizligi"] },
      { value: "Evden eve nakliyat", terms: ["evden eve nakliyat", "evden eve nakliye"] },
      { value: "Fayans döşeme", terms: ["fayans döşeme", "fayans doseme"] },
      { value: "Halı yıkama / temizleme", terms: ["halı yıkama", "hali yikama"] },
      { value: "İç mimar", terms: ["iç mimar", "ic mimar"] },
    ];
    values.serviceType =
      services.find((service) => service.terms.some((term) => normalized.includes(term)))
        ?.value ?? "";
  }

  if ("listingType" in values) {
    if (normalized.includes("kiralık") || normalized.includes("kirilik")) {
      values.listingType = "Kiralık";
    } else if (normalized.includes("satılık") || normalized.includes("satilik")) {
      values.listingType = "Satılık";
    }
  }

  if ("propertyType" in values) {
    if (normalized.includes("devre mülk") || normalized.includes("devre mulk")) {
      values.propertyType = "Devre mülk";
    } else if (normalized.includes("devren işyeri") || normalized.includes("devren isyeri")) {
      values.propertyType = "Devren işyeri";
    } else if (normalized.includes("müştemilat") || normalized.includes("mustemilat")) {
      values.propertyType = "Müştemilat";
    } else if (normalized.includes("kooperatif hissesi")) {
      values.propertyType = "Kooperatif hissesi";
    } else if (normalized.includes("turistik tesis")) {
      values.propertyType = "Turistik tesis";
    } else if (normalized.includes("konut imarlı arsa") || normalized.includes("konut imarli arsa")) {
      values.propertyType = "Konut imarlı arsa";
    } else if (normalized.includes("ticari arsa")) {
      values.propertyType = "Ticari arsa";
    } else if (normalized.includes("sanayi arsası") || normalized.includes("sanayi arsasi")) {
      values.propertyType = "Sanayi arsası";
    } else if (normalized.includes("imarlı arsa") || normalized.includes("imarli arsa")) {
      values.propertyType = "İmarlı arsa";
    } else if (normalized.includes("tarla")) {
      values.propertyType = "Tarla";
    } else if (normalized.includes("plaza ofisi")) {
      values.propertyType = "Plaza ofisi";
    } else if (normalized.includes("dükkan") || normalized.includes("dukkan") || normalized.includes("mağaza") || normalized.includes("magaza")) {
      values.propertyType = "Dükkan / mağaza";
    } else if (normalized.includes("depo") || normalized.includes("antrepo")) {
      values.propertyType = "Depo / antrepo";
    } else if (normalized.includes("fabrika") || normalized.includes("imalathane")) {
      values.propertyType = "Fabrika / imalathane";
    } else if (normalized.includes("avm ünitesi") || normalized.includes("avm unitesi")) {
      values.propertyType = "AVM ünitesi";
    } else if (normalized.includes("otel") || /(?:öğrenci|ogrenci)\s+apart\b|\bapart\s*otel\b/i.test(normalized)) {
      values.propertyType = "Otel / apart";
    } else if (normalized.includes("ofis")) {
      values.propertyType = "Ofis";
    } else if (normalized.includes("villa")) values.propertyType = "Villa";
    else if (normalized.includes("stüdyo") || normalized.includes("studyo"))
      values.propertyType = "Stüdyo";
    else if (normalized.includes("dubleks")) values.propertyType = "Dubleks";
    else if (normalized.includes("rezidans") || normalized.includes("residans"))
      values.propertyType = "Rezidans";
    else if (normalized.includes("arsa")) values.propertyType = "Arsa";
    else if (
      normalized.includes("işyeri") ||
      normalized.includes("isyeri")
    )
      values.propertyType = "İş yeri";
    else if (
      normalized.includes("ev") ||
      normalized.includes("daire") ||
      normalized.includes("konut") ||
      normalized.includes("apart")
    )
      values.propertyType = "Daire";
  }

  if ("roomCount" in values) {
    const roomMatch = text.match(/\b([1-9]\s?\+\s?[0-9])\b/);
    if (roomMatch) {
      values.roomCount = roomMatch[1].replace(/\s/g, "");
    }
  }

  if ("area" in values) {
    const areaMatch = text.match(/(\d{2,4})\s*(m2|m²|metrekare)\b/i);
    if (areaMatch) values.area = areaMatch[1];
  }

  if ("location" in values) {
    const locationMatch = text.match(
      /([a-zçğıöşü\s]+(?:cd|cadde|sokak|sk|mah\.?|mahalle)[a-zçğıöşü0-9\s]*)/i
    );
    if (locationMatch) {
      values.location = locationMatch[1].trim();
    } else {
      const geoMatch = findProvinceAndDistrictInText(text);
      if (geoMatch?.ilce) {
        values.location = geoMatch.ilce;
      }
    }
  }

  if ("floor" in values) {
    const floorMatch = text.match(/(\d+)\s*\/\s*(\d+)\s*kat/i);
    if (floorMatch) values.floor = `${floorMatch[1]} / ${floorMatch[2]}`;
  }

  if ("buildingAge" in values) {
    const ageMatch = text.match(/(\d{1,2})\s*yıllık/i);
    if (ageMatch) values.buildingAge = ageMatch[1];
  }

  if ("newBuildPreference" in values) {
    if (/\b(sıfır|sifir|yeni)\s+(bina|yapı|yapi|ev|konut|daire|villa|mülk|mulk)\b/i.test(text)) {
      values.newBuildPreference = "Yeni bina şart";
    }
  }

  return values;
}
