/**
 * Category/product-aware option providers for composer controls.
 */

import type { ControlOption, ControlResolveContext } from "./question-control-types";

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
  return [
    {
      label: "Bütçe aralığı belirt",
      value: "__budget_range__",
      opensCustom: true,
    },
    {
      label: "Teklifleri görmek istiyorum",
      value: "open_to_offers",
      soft: true,
    },
    { label: "Henüz bilmiyorum", value: "unknown", soft: true },
    { label: "Fark etmez", value: "no_preference", soft: true },
  ];
}

export function locationSoftOptions(ctx: ControlResolveContext): ControlOption[] {
  if (ctx.isRealEstate) return [];
  // Kurucu kararı (2026-08-23): "Türkiye geneli" ve "Konum fark etmez"
  // çipleri kalktı — il listesindeki "Tümü" seçeneği aynı işi görür.
  const out: ControlOption[] = [];
  if (
    ctx.categoryId === "services" ||
    ctx.categoryId === "health" ||
    ctx.isRemoteService
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

/** Popular brand chips — catalog-backed where possible; not exhaustive. */
export function popularBrandOptions(ctx: ControlResolveContext): ControlOption[] {
  const soft = brandModelSoftOptions();
  if (ctx.categoryId === "baby") {
    return [
      { label: "Chicco", value: "Chicco" },
      { label: "Joie", value: "Joie" },
      { label: "Maxi-Cosi", value: "Maxi-Cosi" },
      { label: "Cybex", value: "Cybex" },
      ...soft,
    ];
  }
  if (ctx.categoryId === "appliances" || ctx.categoryId === "home-kitchen") {
    return [
      { label: "Bosch", value: "Bosch" },
      { label: "Arçelik", value: "Arçelik" },
      { label: "Siemens", value: "Siemens" },
      { label: "Beko", value: "Beko" },
      ...soft,
    ];
  }
  if (ctx.categoryId === "technology") {
    return [
      { label: "Apple", value: "Apple" },
      { label: "Samsung", value: "Samsung" },
      { label: "Xiaomi", value: "Xiaomi" },
      { label: "Lenovo", value: "Lenovo" },
      ...soft,
    ];
  }
  if (ctx.categoryId === "automotive") {
    return [
      { label: "Renault", value: "Renault" },
      { label: "Volkswagen", value: "Volkswagen" },
      { label: "Toyota", value: "Toyota" },
      { label: "Ford", value: "Ford" },
      ...soft,
    ];
  }
  return soft;
}
