/**
 * Category/product-aware option providers for composer controls.
 */

import {
  APPLIANCE_BRANDS,
  AUTOMOTIVE_BRANDS,
  BABY_BRANDS,
  FURNITURE_BRANDS,
  HOME_KITCHEN_BRANDS,
  MACHINERY_BRANDS,
  TECHNOLOGY_BRANDS,
} from "@/lib/ai/parser/brand-catalog";
import { brandsForProductName } from "@/lib/knowledge/product-brands";
import { getAutomotiveIndexes } from "@/lib/catalog/automotive/indexes";
import { TECHNOLOGY_PRODUCT_MODELS } from "@/lib/ai/parser/brand-catalog";
import {
  babyBrandsForProductName,
  furnitureBrandsForProduct,
  inferMachineryBrandFamily,
  kitchenBrandsForProductName,
  machineryBrandsForFamily,
} from "@/lib/knowledge/harvest-brands";

import type { ControlOption, ControlResolveContext } from "./question-control-types";
import { isRemoteEligibleService } from "./question-profiles";

export function quantityPresets(ctx: ControlResolveContext): ControlOption[] {
  const cat = ctx.categoryId;
  const custom: ControlOption = {
    label: "Özel adet",
    value: "__custom__",
    opensCustom: true,
  };

  if (cat === "printing") {
    return [
      { label: "100", value: "100 adet" },
      { label: "250", value: "250 adet" },
      { label: "500", value: "500 adet" },
      { label: "1.000", value: "1000 adet" },
      { label: "2.500", value: "2500 adet" },
      { label: "5.000", value: "5000 adet" },
      custom,
    ];
  }

  if (cat === "furniture") {
    return [
      { label: "1", value: "1 adet" },
      { label: "5", value: "5 adet" },
      { label: "10", value: "10 adet" },
      { label: "25", value: "25 adet" },
      { label: "50+", value: "50+ adet" },
      custom,
    ];
  }

  if (cat === "technology" || cat === "appliances" || cat === "home-kitchen") {
    return [
      { label: "1", value: "1 adet" },
      { label: "2", value: "2 adet" },
      { label: "5", value: "5 adet" },
      { label: "10", value: "10 adet" },
      { label: "25+", value: "25+ adet" },
      custom,
    ];
  }

  // Baby / consumer single-unit default
  if (cat === "baby" || cat === "health") {
    return [
      { label: "1 adet", value: "1 adet" },
      { label: "2 adet", value: "2 adet" },
      { label: "3 adet", value: "3 adet" },
      { label: "5 adet", value: "5 adet" },
      custom,
    ];
  }

  return [
    { label: "1", value: "1 adet" },
    { label: "2", value: "2 adet" },
    { label: "5", value: "5 adet" },
    { label: "10", value: "10 adet" },
    custom,
  ];
}

export function deliveryDeadlineOptions(): ControlOption[] {
  return [
    { label: "En kısa sürede", value: "En kısa sürede" },
    { label: "3 gün içinde", value: "3 gün içinde" },
    { label: "1 hafta içinde", value: "1 hafta içinde" },
    { label: "2 hafta içinde", value: "2 hafta içinde" },
    { label: "1 ay içinde", value: "1 ay içinde" },
    { label: "Tarih seç", value: "__date__", opensCustom: true },
    { label: "Esnek", value: "Esnek", soft: true },
  ];
}

export function conditionOptions(): ControlOption[] {
  return [
    { label: "Sıfır", value: "Sıfır" },
    { label: "İkinci el", value: "İkinci el" },
    { label: "Yenilenmiş", value: "Yenilenmiş" },
    { label: "Fark etmez", value: "no_preference", soft: true },
    { label: "Öneriye açığım", value: "öneriye açığım", soft: true },
  ];
}

export function budgetEntryOptions(): ControlOption[] {
  // Kurucu kararı (2026-08-23): tek bütçe alanı her zaman açık gelir;
  // tek alternatif "Teklifleri görmek istiyorum". Aralık/bilmiyorum/farketmez yok.
  return [
    {
      label: "Teklifleri görmek istiyorum",
      value: "open_to_offers",
      soft: true,
    },
  ];
}

export function locationSoftOptions(ctx: ControlResolveContext): ControlOption[] {
  if (ctx.isRealEstate) return [];
  // Kurucu kararı (2026-08-23): "Türkiye geneli" ve "Konum fark etmez"
  // çipleri kalktı — il listesindeki "Tümü" seçeneği aynı işi görür.
  // "Uzaktan" yalnız uzaktan verilebilen hizmetlerde görünür (temizliğe asla).
  const out: ControlOption[] = [];
  if (
    ctx.isRemoteService ||
    ((ctx.categoryId === "services" || ctx.categoryId === "health") &&
      isRemoteEligibleService(ctx.productType))
  ) {
    out.push({ label: "Uzaktan", value: "remote", soft: true });
  }
  return out;
}

export function roomCountOptions(): ControlOption[] {
  return [
    { label: "1+0", value: "1+0" },
    { label: "1+1", value: "1+1" },
    { label: "2+1", value: "2+1" },
    { label: "3+1", value: "3+1" },
    { label: "4+1", value: "4+1" },
    { label: "Diğer", value: "__custom__", opensCustom: true },
  ];
}

export function areaSqmPresets(): ControlOption[] {
  return [
    { label: "0–50 m²", value: "0-50 m²" },
    { label: "50–80 m²", value: "50-80 m²" },
    { label: "80–120 m²", value: "80-120 m²" },
    { label: "120–180 m²", value: "120-180 m²" },
    { label: "180+ m²", value: "180+ m²" },
    { label: "Özel m²", value: "__custom__", opensCustom: true },
  ];
}

export function listingTypeOptions(): ControlOption[] {
  // Değerler kullanıcıya görünen yerlere sızar — asla ham İngilizce ("sale")
  // saklama; motor ve rozetler Türkçe etiket değerini bekler.
  return [
    { label: "Satılık", value: "Satılık" },
    { label: "Kiralık", value: "Kiralık" },
  ];
}

export function yesNoDontCareOptions(): ControlOption[] {
  return [
    { label: "Evet", value: "Evet" },
    { label: "Hayır", value: "Hayır" },
    { label: "Fark etmez", value: "no_preference", soft: true },
  ];
}

export function printDesignReadyOptions(): ControlOption[] {
  return [
    { label: "Tasarım hazır", value: "Tasarım hazır" },
    { label: "Hazır değil", value: "Hazır değil" },
    { label: "Desteğe ihtiyacım var", value: "Desteğe ihtiyacım var" },
  ];
}

export function printSizePresets(): ControlOption[] {
  return [
    { label: "A4", value: "A4" },
    { label: "A5", value: "A5" },
    { label: "A3", value: "A3" },
    { label: "10×15 cm", value: "10x15 cm" },
    { label: "Özel ölçü", value: "__custom__", opensCustom: true },
  ];
}

/**
 * MODEL SEÇENEKLERİ MARKANIN KENDİ KATALOĞUNDAN (kurucu, 2026-09-01):
 * otomotivde 803 modellik hasat (marka başına ≤36), teknolojide 54 kayıtlı
 * ürün modeli depoda duruyordu ama model sorusu boş geliyordu. Tek yetkili
 * kaynaklar: otomotiv indeksi ve TECHNOLOGY_PRODUCT_MODELS — ikinci liste
 * yazılmaz; marka bilinmiyorsa boş döner ve serbest giriş kalır.
 */
export function modelOptionsForBrand(ctx: {
  categoryId: string;
  brand?: string | null;
}): ControlOption[] {
  const brand = (ctx.brand ?? "").trim();
  if (!brand) return [];
  const fold = (s: string) => s.toLocaleLowerCase("tr-TR");
  if (ctx.categoryId === "automotive") {
    const idx = getAutomotiveIndexes();
    const rec = idx.brands.find(
      (b) =>
        fold(b.name) === fold(brand) ||
        /* "Mercedes" ↔ "Mercedes-Benz": öne eşleşme iki yönlü kabul. */
        fold(b.name).startsWith(fold(brand)) ||
        fold(brand).startsWith(fold(b.name)) ||
        (b.aliases ?? []).some((a: string) => fold(a) === fold(brand)),
    );
    if (!rec) return [];
    const models = idx.modelsByBrand.get(rec.id) ?? [];
    /* Salt-rakam tarihî adlar ("1200", "9") listenin sonuna — kullanıcıya
       önce gerçek model adları görünür. */
    const isNumeric = (x: string) => /^\d+$/.test(x.trim());
    return models
      .map((m) => ({ label: m.name, value: m.name }))
      .sort((a, b) => {
        const na = isNumeric(a.label) ? 1 : 0;
        const nb = isNumeric(b.label) ? 1 : 0;
        if (na !== nb) return na - nb;
        return a.label.localeCompare(b.label, "tr-TR");
      });
  }
  if (ctx.categoryId === "technology") {
    return TECHNOLOGY_PRODUCT_MODELS.filter(
      (e) => fold(e.brand ?? "") === fold(brand),
    ).map((e) => {
      /* Model adında marka tekrarı olmaz: "Samsung Galaxy S24" → "Galaxy S24". */
      const stripped = fold(e.canonical).startsWith(fold(brand) + " ")
        ? e.canonical.slice(brand.length + 1)
        : e.canonical;
      return { label: stripped, value: stripped };
    });
  }
  return [];
}

export function brandModelSoftOptions(): ControlOption[] {
  return [
    { label: "Fark etmez", value: "no_preference", soft: true },
    {
      label: "Listede yok / Başka",
      value: "__custom__",
      opensCustom: true,
    },
  ];
}

/**
 * MARKA SEÇENEKLERİ KANONİK KATALOGDAN TÜRETİLİR (kurucu, 2026-09-01).
 * Elle yazılmış 4'lük "popüler" listesi kaldırıldı: tek yetkili kaynak
 * brand-catalog'dur; kategoriye düşen TÜM markalar tr alfabetik sırayla
 * sunulur. İkinci bir liste tutulmaz — katalog büyüyünce burası kendiliğinden
 * büyür. Kalabalık görünüm UI'da aç/kapa + çoklu seçimle çözülür.
 */
export function popularBrandOptions(ctx: ControlResolveContext): ControlOption[] {
  const soft = brandModelSoftOptions();
  /**
   * ÖNCE ÜRÜNÜN KENDİ PAZARI (kurucu, 2026-09-01): "televizyon arayana
   * Acer gösterilmez." Ürün türü biliniyorsa markalar kategori torbasından
   * DEĞİL, gerçek pazar dağılımından gelir (MediaMarkt hasadı —
   * brandsForProductName, 35 ürün tipi; tek yetkili kaynak). Ürün türü
   * eşleşmiyorsa kategori kataloğuna düşülür.
   */
  const pt = ctx.productType ?? "";
  const productScoped: string[] | null = (() => {
    /* 1) Gerçek pazar dağılımı (MediaMarkt hasadı, 35 tip). */
    const market = brandsForProductName(pt, ctx.categoryId);
    if (market && market.length >= 3) return market;
    if (!pt) return null;
    /* 2) Makine: Makinecim hasadının aile seçimi (metal/inşaat/enerji/
          el aleti/matbaa) — torna Caterpillar göstermez. */
    if (ctx.categoryId === "machinery") {
      const fam = inferMachineryBrandFamily({ id: pt, name: pt });
      if (fam) {
        const picks = machineryBrandsForFamily(fam);
        if (picks.length >= 3) return picks;
      }
      return null;
    }
    /* 3) Mobilya: yalnız gerçek mobilya ürününde marka kolonu. */
    if (ctx.categoryId === "furniture") {
      return furnitureBrandsForProduct({ name: pt });
    }
    /* 4) Ev & mutfak: sofra/pişirme seçimi. */
    if (ctx.categoryId === "home-kitchen") {
      return kitchenBrandsForProductName(pt);
    }
    /* 5) Anne & çocuk: aile seçimi. */
    if (ctx.categoryId === "baby") {
      return babyBrandsForProductName(pt);
    }
    return null;
  })();
  if (productScoped && productScoped.length >= 3) {
    return [
      ...productScoped.map((b) => ({ label: b, value: b })),
      ...soft,
    ];
  }
  const byCategory: Record<string, ReadonlyArray<{ canonical: string }>> = {
    automotive: AUTOMOTIVE_BRANDS,
    appliances: APPLIANCE_BRANDS,
    "home-kitchen": [...APPLIANCE_BRANDS, ...HOME_KITCHEN_BRANDS],
    machinery: MACHINERY_BRANDS,
    technology: TECHNOLOGY_BRANDS,
    furniture: FURNITURE_BRANDS,
    baby: BABY_BRANDS,
  };
  const entries = byCategory[ctx.categoryId] ?? [];
  const seen = new Set<string>();
  const options: ControlOption[] = [];
  for (const e of entries) {
    const key = e.canonical.toLocaleLowerCase("tr-TR");
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ label: e.canonical, value: e.canonical });
  }
  options.sort((a, b) => a.label.localeCompare(b.label, "tr-TR"));
  return [...options, ...soft];
}
