/**
 * Category / subcategory knowledge profiles.
 * Source of truth for category IDs: REQUEST_CATEGORIES (request-category-engine).
 * Profiles describe WHAT EXISTS / WHAT MATTERS / WHAT TO ASK — not intent.
 */

import type {
  BrowseNodeKind,
  ExternalIngestionPolicy,
  KnowledgeCapability,
  KnowledgeProfile,
} from "./types";
import { profileId, subcategorySlug } from "./slug";

function base(
  categoryId: string,
  label: string,
  capabilities: KnowledgeCapability[],
  externalPolicy: ExternalIngestionPolicy,
  browseHierarchy: BrowseNodeKind[],
  notes?: string,
): KnowledgeProfile {
  return {
    id: categoryId,
    categoryId,
    label,
    capabilities,
    externalPolicy,
    browseHierarchy,
    notes,
  };
}

function override(
  categoryId: string,
  subcategoryLabel: string,
  patch: Partial<
    Pick<
      KnowledgeProfile,
      "capabilities" | "externalPolicy" | "browseHierarchy" | "notes" | "label"
    >
  >,
  parent: KnowledgeProfile,
): KnowledgeProfile {
  const slug = subcategorySlug(subcategoryLabel);
  return {
    id: profileId(categoryId, slug),
    categoryId,
    subcategorySlug: slug,
    subcategoryLabel,
    label: patch.label ?? `${parent.label} / ${subcategoryLabel}`,
    capabilities: patch.capabilities ?? parent.capabilities,
    externalPolicy: patch.externalPolicy ?? parent.externalPolicy,
    browseHierarchy: patch.browseHierarchy ?? parent.browseHierarchy,
    notes: patch.notes ?? parent.notes,
  };
}

const AUTOMOTIVE = base(
  "automotive",
  "Otomotiv",
  ["ENTITY_CATALOG", "ENTITY_SPEC"],
  "REQUIRED",
  [
    "category",
    "subcategory",
    "brand",
    "model",
    "generation",
    "variant",
    "part_system",
    "part",
    "position",
  ],
  "Golden reference. Canonical vehicle graph lives in CatalogRegistry automotive provider.",
);

const MACHINERY = base(
  "machinery",
  "Makine",
  ["ENTITY_CATALOG", "ATTRIBUTE_SCHEMA"],
  "SELECTIVE",
  [
    "category",
    "subcategory",
    "brand",
    "model",
    "attribute_bucket",
  ],
  "Manufacturer/model selective; capacity/power/dimensions often dominate.",
);

const PRINTING = base(
  "printing",
  "Matbaa ve Ambalaj",
  ["ATTRIBUTE_SCHEMA", "SERVICE_SCHEMA"],
  "DISABLED",
  ["category", "subcategory", "group", "product_type"],
  "No global brand/model product crawling. Master taxonomy product tree + specs.",
);

const FURNITURE = base(
  "furniture",
  "Mobilya ve Ofis",
  ["ATTRIBUTE_SCHEMA"],
  "DISABLED",
  ["category", "subcategory", "group", "product_type"],
  "Blind global furniture crawling disabled. Master taxonomy product tree.",
);

const TECHNOLOGY = base(
  "technology",
  "Teknoloji",
  ["ENTITY_CATALOG", "ENTITY_SPEC", "SERVICE_SCHEMA"],
  "SELECTIVE",
  [
    "category",
    "subcategory",
    "brand",
    "product_family",
    "model",
    "variant",
    "attribute_bucket",
  ],
  "Hardware entity catalog selective; software/services use SERVICE_SCHEMA.",
);

const REAL_ESTATE = base(
  "real-estate",
  "Emlak",
  ["ATTRIBUTE_SCHEMA", "SERVICE_SCHEMA"],
  "DISABLED",
  ["category", "subcategory", "group", "product_type"],
  "Location/attributes dominate; taxonomy property types + sale/rent attrs.",
);

const APPLIANCES = base(
  "appliances",
  "Beyaz Eşya",
  ["ENTITY_CATALOG", "ENTITY_SPEC"],
  "SELECTIVE",
  [
    "category",
    "subcategory",
    "brand",
    "product_family",
    "series",
    "model",
    "variant",
  ],
  "Scope ingestion to appliance family under Talepo category — not whole OEM universe.",
);

const HEALTH = base(
  "health",
  "Sağlık",
  ["ENTITY_CATALOG", "ENTITY_SPEC", "ATTRIBUTE_SCHEMA"],
  "SELECTIVE",
  [
    "category",
    "subcategory",
    "brand",
    "model",
    "attribute_bucket",
  ],
  "High provenance required for devices; consumables lean ATTRIBUTE/COMMODITY.",
);

const BABY = base(
  "baby",
  "Bebek ve Çocuk",
  ["ENTITY_CATALOG", "ATTRIBUTE_SCHEMA"],
  "SELECTIVE",
  [
    "category",
    "subcategory",
    "brand",
    "product_family",
    "model",
    "attribute_bucket",
  ],
);

const HOME_KITCHEN = base(
  "home-kitchen",
  "Ev ve Mutfak",
  ["ATTRIBUTE_SCHEMA"],
  "DISABLED",
  ["category", "subcategory", "group", "product_type"],
  "Master taxonomy product tree. Kitchen/bath fixtures under Diğer (no dedicated root).",
);

const SERVICES = base(
  "services",
  "Hizmetler",
  ["SERVICE_SCHEMA"],
  "DISABLED",
  ["category", "subcategory", "group", "service_type"],
  "No entity crawling. Master taxonomy service types.",
);

/** Domain defaults — one per REQUEST_CATEGORIES id. */
export const DOMAIN_KNOWLEDGE_PROFILES: KnowledgeProfile[] = [
  AUTOMOTIVE,
  MACHINERY,
  PRINTING,
  FURNITURE,
  TECHNOLOGY,
  REAL_ESTATE,
  APPLIANCES,
  HEALTH,
  BABY,
  HOME_KITCHEN,
  SERVICES,
];

/** Subcategory overrides (parent capabilities/policy can be replaced). */
export const SUBCATEGORY_KNOWLEDGE_PROFILES: KnowledgeProfile[] = [
  // Automotive
  override(
    "automotive",
    "Araç Satın Alma",
    {
      capabilities: ["ENTITY_CATALOG", "ENTITY_SPEC"],
      browseHierarchy: [
        "category",
        "subcategory",
        "brand",
        "model",
        "generation",
        "variant",
      ],
      notes: "Whole vehicle purchase — same vehicle graph.",
    },
    AUTOMOTIVE,
  ),
  override(
    "automotive",
    "Yedek Parça",
    {
      capabilities: [
        "ENTITY_CATALOG",
        "ENTITY_COMPATIBILITY",
        "ATTRIBUTE_SCHEMA",
      ],
      externalPolicy: "REQUIRED",
      browseHierarchy: [
        "category",
        "subcategory",
        "brand",
        "model",
        "generation",
        "variant",
        "part_system",
        "part",
        "position",
      ],
      notes:
        "Reuse automotive vehicle graph; add part taxonomy + OEM + compatibility. High provenance.",
    },
    AUTOMOTIVE,
  ),
  override(
    "automotive",
    "Araç Bakım",
    {
      capabilities: ["ENTITY_CATALOG", "SERVICE_SCHEMA"],
      externalPolicy: "SELECTIVE",
      browseHierarchy: [
        "category",
        "subcategory",
        "brand",
        "model",
        "service_type",
      ],
    },
    AUTOMOTIVE,
  ),
  override(
    "automotive",
    "Lastik ve Jant",
    {
      capabilities: ["ENTITY_CATALOG", "ATTRIBUTE_SCHEMA", "ENTITY_COMPATIBILITY"],
      externalPolicy: "SELECTIVE",
      browseHierarchy: [
        "category",
        "subcategory",
        "brand",
        "model",
        "attribute_bucket",
      ],
    },
    AUTOMOTIVE,
  ),
  override(
    "automotive",
    "Diğer",
    { externalPolicy: "DISCOVERY_ONLY" },
    AUTOMOTIVE,
  ),

  // Machinery
  override(
    "machinery",
    "Yedek Parça",
    {
      capabilities: ["ENTITY_CATALOG", "ENTITY_COMPATIBILITY", "ATTRIBUTE_SCHEMA"],
      externalPolicy: "SELECTIVE",
    },
    MACHINERY,
  ),
  override(
    "machinery",
    "Üretim Makinesi",
    {
      capabilities: ["ENTITY_CATALOG", "ATTRIBUTE_SCHEMA"],
      externalPolicy: "SELECTIVE",
    },
    MACHINERY,
  ),
  override(
    "machinery",
    "Kesim Makinesi",
    {
      capabilities: ["ENTITY_CATALOG", "ATTRIBUTE_SCHEMA"],
      externalPolicy: "SELECTIVE",
    },
    MACHINERY,
  ),
  override(
    "machinery",
    "Paketleme Makinesi",
    {
      capabilities: ["ENTITY_CATALOG", "ATTRIBUTE_SCHEMA"],
      externalPolicy: "SELECTIVE",
    },
    MACHINERY,
  ),
  override(
    "machinery",
    "İkinci El Makine",
    {
      capabilities: ["ENTITY_CATALOG", "ATTRIBUTE_SCHEMA"],
      externalPolicy: "DISCOVERY_ONLY",
    },
    MACHINERY,
  ),
  override("machinery", "Diğer", { externalPolicy: "DISCOVERY_ONLY" }, MACHINERY),

  // Printing — all DISABLED product crawl
  ...["Karton Kutu", "Etiket Baskı", "Broşür ve Katalog", "Promosyon", "Diğer"].map(
    (label) =>
      override(
        "printing",
        label,
        {
          capabilities: ["ATTRIBUTE_SCHEMA", "SERVICE_SCHEMA"],
          externalPolicy: "DISABLED",
          browseHierarchy: ["category", "subcategory", "group", "product_type"],
        },
        PRINTING,
      ),
  ),

  // Furniture
  override(
    "furniture",
    "Özel Üretim",
    {
      capabilities: ["ATTRIBUTE_SCHEMA", "SERVICE_SCHEMA"],
      externalPolicy: "DISABLED",
    },
    FURNITURE,
  ),
  override(
    "furniture",
    "Ofis Sandalyesi",
    {
      capabilities: ["ATTRIBUTE_SCHEMA"],
      externalPolicy: "DISABLED",
      notes: "Brand optional; mechanism/material/dimensions dominate.",
    },
    FURNITURE,
  ),
  override(
    "furniture",
    "Çalışma / Ofis Masası",
    { capabilities: ["ATTRIBUTE_SCHEMA"], externalPolicy: "DISABLED" },
    FURNITURE,
  ),
  override(
    "furniture",
    "Toplantı Masası",
    { capabilities: ["ATTRIBUTE_SCHEMA"], externalPolicy: "DISABLED" },
    FURNITURE,
  ),
  override(
    "furniture",
    "Ev Mobilyası",
    { capabilities: ["ATTRIBUTE_SCHEMA"], externalPolicy: "DISABLED" },
    FURNITURE,
  ),
  override(
    "furniture",
    "Kafe ve Restoran",
    { capabilities: ["ATTRIBUTE_SCHEMA"], externalPolicy: "DISABLED" },
    FURNITURE,
  ),
  override("furniture", "Diğer", { externalPolicy: "DISCOVERY_ONLY" }, FURNITURE),

  // Technology
  override(
    "technology",
    "Donanım",
    {
      capabilities: ["ENTITY_CATALOG", "ENTITY_SPEC"],
      externalPolicy: "SELECTIVE",
      browseHierarchy: [
        "category",
        "subcategory",
        "brand",
        "product_family",
        "model",
        "variant",
      ],
    },
    TECHNOLOGY,
  ),
  override(
    "technology",
    "Yazılım Geliştirme",
    {
      capabilities: ["SERVICE_SCHEMA", "ATTRIBUTE_SCHEMA"],
      externalPolicy: "DISABLED",
      browseHierarchy: ["category", "subcategory", "service_type", "attribute_bucket"],
    },
    TECHNOLOGY,
  ),
  override(
    "technology",
    "Web Sitesi",
    {
      capabilities: ["SERVICE_SCHEMA", "ATTRIBUTE_SCHEMA"],
      externalPolicy: "DISABLED",
      browseHierarchy: ["category", "subcategory", "service_type", "attribute_bucket"],
    },
    TECHNOLOGY,
  ),
  override(
    "technology",
    "Sistem ve Altyapı",
    {
      capabilities: ["SERVICE_SCHEMA", "ENTITY_CATALOG", "ATTRIBUTE_SCHEMA"],
      externalPolicy: "SELECTIVE",
    },
    TECHNOLOGY,
  ),
  override(
    "technology",
    "Diğer",
    { externalPolicy: "DISCOVERY_ONLY" },
    TECHNOLOGY,
  ),

  // Real estate
  ...["Kiralık Konut", "Satılık Konut", "Ticari Gayrimenkul", "Arsa", "Diğer"].map(
    (label) =>
      override(
        "real-estate",
        label,
        {
          capabilities: ["ATTRIBUTE_SCHEMA", "SERVICE_SCHEMA"],
          externalPolicy: "DISABLED",
        },
        REAL_ESTATE,
      ),
  ),

  // Appliances — family scoped
  override(
    "appliances",
    "Buzdolabı",
    {
      capabilities: ["ENTITY_CATALOG", "ENTITY_SPEC"],
      externalPolicy: "SELECTIVE",
      notes: "Ingest only refrigerator family under brand.",
    },
    APPLIANCES,
  ),
  override(
    "appliances",
    "Çamaşır Makinesi",
    {
      capabilities: ["ENTITY_CATALOG", "ENTITY_SPEC"],
      externalPolicy: "SELECTIVE",
    },
    APPLIANCES,
  ),
  override(
    "appliances",
    "Bulaşık Makinesi",
    {
      capabilities: ["ENTITY_CATALOG", "ENTITY_SPEC"],
      externalPolicy: "SELECTIVE",
    },
    APPLIANCES,
  ),
  override(
    "appliances",
    "Fırın / Ocak",
    {
      capabilities: ["ENTITY_CATALOG", "ENTITY_SPEC"],
      externalPolicy: "SELECTIVE",
      notes: "Built-in kitchen appliances — ENTITY_CATALOG + ENTITY_SPEC.",
    },
    APPLIANCES,
  ),
  override(
    "appliances",
    "Klima",
    {
      capabilities: ["ENTITY_CATALOG", "ENTITY_SPEC"],
      externalPolicy: "SELECTIVE",
    },
    APPLIANCES,
  ),
  override(
    "appliances",
    "Diğer",
    { externalPolicy: "DISCOVERY_ONLY" },
    APPLIANCES,
  ),

  // Health
  override(
    "health",
    "Medikal Cihaz",
    {
      capabilities: ["ENTITY_CATALOG", "ENTITY_SPEC"],
      externalPolicy: "SELECTIVE",
      notes: "High provenance; AI_INFERRED/USER_DISCOVERED cannot auto-SAFE.",
    },
    HEALTH,
  ),
  override(
    "health",
    "Sarf Malzeme",
    {
      capabilities: ["COMMODITY_SCHEMA", "ATTRIBUTE_SCHEMA"],
      externalPolicy: "DISCOVERY_ONLY",
      browseHierarchy: [
        "category",
        "subcategory",
        "group",
        "commodity_type",
        "attribute_bucket",
      ],
      notes: "Commodity/spec logic — master taxonomy; not brand catalog crawling.",
    },
    HEALTH,
  ),
  override(
    "health",
    "Klinik Donanım",
    {
      capabilities: ["ENTITY_CATALOG", "ATTRIBUTE_SCHEMA"],
      externalPolicy: "SELECTIVE",
    },
    HEALTH,
  ),
  override(
    "health",
    "Diş / Laboratuvar",
    {
      capabilities: ["ENTITY_CATALOG", "ATTRIBUTE_SCHEMA", "COMMODITY_SCHEMA"],
      externalPolicy: "SELECTIVE",
    },
    HEALTH,
  ),
  override("health", "Diğer", { externalPolicy: "DISCOVERY_ONLY" }, HEALTH),

  // Baby
  override(
    "baby",
    "Bebek Arabası",
    {
      capabilities: ["ENTITY_CATALOG", "ENTITY_SPEC"],
      externalPolicy: "SELECTIVE",
    },
    BABY,
  ),
  override(
    "baby",
    "Beslenme",
    {
      capabilities: ["ATTRIBUTE_SCHEMA", "COMMODITY_SCHEMA"],
      externalPolicy: "DISCOVERY_ONLY",
    },
    BABY,
  ),
  override(
    "baby",
    "Uyku / Beşik",
    {
      capabilities: ["ENTITY_CATALOG", "ATTRIBUTE_SCHEMA"],
      externalPolicy: "SELECTIVE",
    },
    BABY,
  ),
  override(
    "baby",
    "Bakım",
    {
      capabilities: ["ATTRIBUTE_SCHEMA", "COMMODITY_SCHEMA"],
      externalPolicy: "DISCOVERY_ONLY",
    },
    BABY,
  ),
  override("baby", "Diğer", { externalPolicy: "DISCOVERY_ONLY" }, BABY),

  // Home & kitchen (covers kitchen/bath attribute products; built-ins → appliances)
  override(
    "home-kitchen",
    "Yemek Takımı",
    {
      capabilities: ["ATTRIBUTE_SCHEMA"],
      externalPolicy: "DISABLED",
    },
    HOME_KITCHEN,
  ),
  override(
    "home-kitchen",
    "Kahve / Çay Seti",
    {
      capabilities: ["ATTRIBUTE_SCHEMA"],
      externalPolicy: "DISABLED",
    },
    HOME_KITCHEN,
  ),
  override(
    "home-kitchen",
    "Çatal Bıçak",
    {
      capabilities: ["ATTRIBUTE_SCHEMA"],
      externalPolicy: "DISABLED",
    },
    HOME_KITCHEN,
  ),
  override(
    "home-kitchen",
    "Cam / Porselen",
    {
      capabilities: ["ATTRIBUTE_SCHEMA"],
      externalPolicy: "DISABLED",
    },
    HOME_KITCHEN,
  ),
  override(
    "home-kitchen",
    "Diğer",
    { externalPolicy: "DISCOVERY_ONLY" },
    HOME_KITCHEN,
  ),

  // Services
  ...["Danışmanlık", "Bakım ve Onarım", "Temizlik", "Nakliye", "Diğer"].map(
    (label) =>
      override(
        "services",
        label,
        {
          capabilities: ["SERVICE_SCHEMA"],
          externalPolicy: "DISABLED",
          browseHierarchy: ["category", "subcategory", "group", "service_type"],
        },
        SERVICES,
      ),
  ),
];

export const ALL_KNOWLEDGE_PROFILES: KnowledgeProfile[] = [
  ...DOMAIN_KNOWLEDGE_PROFILES,
  ...SUBCATEGORY_KNOWLEDGE_PROFILES,
];
