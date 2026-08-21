/** Stable fixture IDs — DB cuid ≠ slug ≠ taxonomy. */

export const CAT = {
  baby: { dbId: "cat_cuid_baby_001", slug: "baby", taxStroller: "tax:baby:stroller" },
  technology: {
    dbId: "cat_cuid_technology_001",
    slug: "technology",
    taxGeneric: "tax:technology:devices",
  },
  appliances: {
    dbId: "cat_cuid_appliances_001",
    slug: "appliances",
    taxTv: "tax:appliances:tv",
    taxWasher: "tax:appliances:washer",
  },
  printing: {
    dbId: "cat_cuid_printing_001",
    slug: "printing",
    taxParts: "tax:printing:parts",
  },
  machinery: {
    dbId: "cat_cuid_machinery_001",
    slug: "machinery",
    taxPress: "tax:machinery:press",
  },
  automotive: {
    dbId: "cat_cuid_automotive_001",
    slug: "automotive",
    taxCar: "tax:automotive:car",
    taxService: "tax:automotive:service",
  },
  realEstate: {
    dbId: "cat_cuid_real_estate_001",
    slug: "real-estate",
    taxFlat: "tax:real-estate:flat",
  },
  furniture: {
    dbId: "cat_cuid_furniture_001",
    slug: "furniture",
    taxSofa: "tax:furniture:sofa",
  },
  services: {
    dbId: "cat_cuid_services_001",
    slug: "services",
    taxDesign: "tax:services:design",
  },
  homeKitchen: {
    dbId: "cat_cuid_home_kitchen_001",
    slug: "home-kitchen",
    taxCookware: "tax:home-kitchen:cookware",
  },
  health: {
    dbId: "cat_cuid_health_001",
    slug: "health",
    taxDevice: "tax:health:device",
  },
} as const;
