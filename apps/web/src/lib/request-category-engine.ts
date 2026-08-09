export type DynamicFieldType = "text" | "number" | "select";

export type DynamicFieldOption = {
  label: string;
  value: string;
};

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
};

export function getCategoryNeedTypeDefault(categoryId: string): string | null {
  if (categoryId === "automotive") return "vehicle";
  if (categoryId === "machinery") return "machine";
  if (categoryId === "technology") return "software";
  return null;
}

/** Whole-product keys that must stay hidden unless needType is part/tire. */
const AUTOMOTIVE_PART_ONLY_KEYS = new Set([
  "part",
  "partPreference",
  "vin",
]);

export function withCategoryFieldDefaults(
  categoryId: string,
  values: Record<string, string | undefined>,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    next[key] = value ?? "";
  }

  const needDefault = getCategoryNeedTypeDefault(categoryId);
  if (needDefault && !next.needType?.trim()) {
    next.needType = needDefault;
  }

  return next;
}

export function isFieldVisible(
  field: DynamicField,
  values: Record<string, string | undefined>,
): boolean {
  if (!field.when) return true;
  const current = (values[field.when.field] ?? "").trim();
  return field.when.in.includes(current);
}

export function isFieldRequired(
  field: DynamicField,
  values: Record<string, string | undefined>,
): boolean {
  return Boolean(field.required) && isFieldVisible(field, values);
}

export function getVisibleCategoryFields(
  fields: DynamicField[],
  values: Record<string, string | undefined>,
  categoryId?: string,
): DynamicField[] {
  const resolved = categoryId
    ? withCategoryFieldDefaults(categoryId, values)
    : values;

  let visible = fields.filter((field) => isFieldVisible(field, resolved));

  // Hard safety: never ask for parts when the user wants the whole vehicle.
  if (categoryId === "automotive") {
    const needType = (resolved.needType ?? "vehicle").trim() || "vehicle";
    if (needType !== "part" && needType !== "tire") {
      visible = visible.filter(
        (field) => !AUTOMOTIVE_PART_ONLY_KEYS.has(field.key),
      );
    }
    if (needType !== "service") {
      visible = visible.filter((field) => field.key !== "serviceType");
    }
    if (needType !== "vehicle") {
      visible = visible.filter(
        (field) =>
          field.key !== "condition" && field.key !== "bodyCondition",
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
  { label: string; placeholder: string }
> = {
  title: {
    label: "Talep başlığı",
    placeholder: "Örn. 3+1 kiralık daire talebi",
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
};

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

export const REQUEST_CATEGORIES: RequestCategory[] = [
  {
    id: "printing",
    label: "Matbaa ve Ambalaj",
    description: "Baskı, etiket, kutu, ambalaj ve promosyon üretimleri",
    keywords: [
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
    subcategories: [
      "Karton Kutu",
      "Etiket Baskı",
      "Broşür ve Katalog",
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
      "mercedes",
      "bmw",
      "audi",
      "renault",
      "ford",
      "tampon",
      "balata",
      "far",
      "motor",
      "şasi",
      "sasi",
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
      },
      {
        key: "model",
        label: "Model",
        type: "text",
        placeholder: "Örn. C180",
        required: true,
      },
      {
        key: "modelYear",
        label: "Model yılı",
        type: "number",
        placeholder: "2016",
        required: true,
      },
      {
        key: "engine",
        label: "Motor",
        type: "text",
        placeholder: "Örn. 1.6 benzin",
        when: { field: "needType", in: ["vehicle", "part"] },
      },
      {
        key: "condition",
        label: "Araç durumu",
        type: "select",
        when: { field: "needType", in: ["vehicle"] },
        options: [
          { label: "Sıfır", value: "Sıfır" },
          { label: "İkinci el", value: "İkinci el" },
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
        when: { field: "needType", in: ["part", "tire"] },
      },
      {
        key: "partPreference",
        label: "Parça tercihi",
        type: "select",
        when: { field: "needType", in: ["part"] },
        options: [
          { label: "Orijinal", value: "Orijinal" },
          { label: "Muadil", value: "Muadil" },
          { label: "Fark etmez", value: "Fark etmez" },
        ],
      },
      {
        key: "serviceType",
        label: "Servis / bakım ihtiyacı",
        type: "text",
        placeholder: "Örn. Periyodik bakım, yağ değişimi",
        required: true,
        when: { field: "needType", in: ["service"] },
      },
      {
        key: "vin",
        label: "Şasi numarası",
        type: "text",
        placeholder: "Opsiyonel — parça uyumu için",
        when: { field: "needType", in: ["part"] },
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
    fields: [
      {
        key: "needType",
        label: "Ne arıyorsunuz?",
        type: "select",
        required: true,
        options: [
          { label: "Makine (satın alma)", value: "machine" },
          { label: "Yedek parça / ekipman", value: "part" },
          { label: "Servis / bakım", value: "service" },
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
        key: "serviceType",
        label: "Servis ihtiyacı",
        type: "text",
        placeholder: "Örn. Kurulum, periyodik bakım",
        required: true,
        when: { field: "needType", in: ["service"] },
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
    ],
    subcategories: [
      "Ofis Sandalyesi",
      "Çalışma / Ofis Masası",
      "Toplantı Masası",
      "Ev Mobilyası",
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
    fields: [
      {
        key: "furnitureType",
        label: "Ürün türü",
        type: "select",
        required: true,
        options: [
          { label: "Ofis sandalyesi", value: "Ofis sandalyesi" },
          { label: "Çalışma / ofis masası", value: "Çalışma / ofis masası" },
          {
            label: "Makam / yönetici masa takımı",
            value: "Makam / yönetici masa takımı",
          },
          { label: "Toplantı masası", value: "Toplantı masası" },
          { label: "Misafir koltuğu", value: "Misafir koltuğu" },
          { label: "Koltuk grubu", value: "Koltuk grubu" },
          { label: "Dolap / raf", value: "Dolap / raf" },
          { label: "Kafe masa-sandalye seti", value: "Kafe masa-sandalye seti" },
          { label: "Diğer", value: "Diğer" },
        ],
      },
      {
        key: "usageArea",
        label: "Kullanım alanı",
        type: "select",
        required: true,
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
      "teknoloji",
      "entegrasyon",
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
        key: "quantityDetail",
        label: "Adet / paket",
        type: "text",
        placeholder: "Örn. 10 adet laptop",
        when: { field: "needType", in: ["hardware"] },
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
        label: "Konut türü",
        type: "select",
        required: true,
        options: [
          { label: "Daire", value: "Daire" },
          { label: "Villa", value: "Villa" },
          { label: "Residans", value: "Residans" },
          { label: "Stüdyo", value: "Stüdyo" },
          { label: "Dubleks", value: "Dubleks" },
          { label: "İş yeri", value: "İş yeri" },
          { label: "Arsa", value: "Arsa" },
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
            "Residans",
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
        key: "location",
        label: "Konum / Adres",
        type: "text",
        placeholder: "Örn. Bahar Cd, Bağcılar",
        required: true,
      },
      {
        key: "floor",
        label: "Kat",
        type: "text",
        placeholder: "Örn. 3 / 8",
        when: {
          field: "propertyType",
          in: ["Daire", "Residans", "Stüdyo", "Dubleks", "İş yeri"],
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
            "Residans",
            "Stüdyo",
            "Dubleks",
            "İş yeri",
          ],
        },
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
      "taşıma",
      "tasima",
      "bakım",
      "bakim",
    ],
    subcategories: [
      "Danışmanlık",
      "Bakım ve Onarım",
      "Temizlik",
      "Nakliye",
      "Diğer",
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
        type: "text",
        placeholder: "Örn. Periyodik bakım",
        required: true,
      },
      {
        key: "frequency",
        label: "Sıklık",
        type: "select",
        options: [
          { label: "Tek seferlik", value: "Tek seferlik" },
          { label: "Haftalık", value: "Haftalık" },
          { label: "Aylık", value: "Aylık" },
          { label: "Yıllık", value: "Yıllık" },
        ],
      },
      {
        key: "serviceLocation",
        label: "Hizmet yeri",
        type: "text",
        placeholder: "Örn. Zeytinburnu / İstanbul",
      },
      {
        key: "duration",
        label: "Tahmini süre",
        type: "text",
        placeholder: "Örn. 3 gün",
      },
    ],
  },
];

export function getCategoryById(id: string): RequestCategory {
  return (
    REQUEST_CATEGORIES.find((category) => category.id === id) ??
    REQUEST_CATEGORIES[REQUEST_CATEGORIES.length - 1]
  );
}

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
      "Chery",
    ];
    values.brand =
      brands.find((brand) =>
        normalized.includes(brand.toLocaleLowerCase("tr-TR"))
      ) ?? "";
  }

  if ("model" in values) {
    const modelMatch = text.match(
      /\b(C180|C200|E200|A180|320i|520i|A3|A4|Clio|Megane|Focus|Egea|Corolla|Civic|Golf|Tiggo\s?[78])\b/i
    );
    values.model = modelMatch?.[0] ?? "";
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
      "temizlik",
      "nakliye",
      "danışmanlık",
      "bakım",
      "onarım",
    ];
    values.serviceType =
      services.find((item) => normalized.includes(item)) ?? "";
  }

  if ("listingType" in values) {
    if (normalized.includes("kiralık") || normalized.includes("kirilik")) {
      values.listingType = "Kiralık";
    } else if (normalized.includes("satılık") || normalized.includes("satilik")) {
      values.listingType = "Satılık";
    }
  }

  if ("propertyType" in values) {
    if (normalized.includes("villa")) values.propertyType = "Villa";
    else if (normalized.includes("stüdyo") || normalized.includes("studyo"))
      values.propertyType = "Stüdyo";
    else if (normalized.includes("dubleks")) values.propertyType = "Dubleks";
    else if (normalized.includes("rezidans") || normalized.includes("residans"))
      values.propertyType = "Residans";
    else if (normalized.includes("arsa")) values.propertyType = "Arsa";
    else if (
      normalized.includes("dükkan") ||
      normalized.includes("dukkan") ||
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
      const districtMatch = text.match(
        /\b(bağcılar|bagcilar|kadıköy|kadikoy|beşiktaş|besiktas|üsküdar|uskudar|bakırköy|bakirkoy|zeytinburnu|fatih|şişli|sisli|ataşehir|atasehir|maltepe|pendik|kartal|sarıyer|sariyer)\b/i
      );
      if (districtMatch) {
        values.location = districtMatch[0];
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

  return values;
}
