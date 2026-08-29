/**
 * Composer v2 question control types — option-first UI authority.
 */

export type QuestionControlType =
  | "single_choice"
  | "multi_choice"
  | "number_presets"
  | "number_with_unit"
  | "money_range"
  | "location_picker"
  | "date_or_deadline"
  | "searchable_entity"
  | "dimensions"
  | "yes_no"
  | "text_fallback";

export type ControlOption = {
  label: string;
  value: string;
  /** Opens custom input instead of answering immediately */
  opensCustom?: boolean;
  /** Soft / escape semantics */
  soft?: boolean;
};

export type QuestionControlDef = {
  controlType: QuestionControlType;
  options: ControlOption[];
  softOptions: ControlOption[];
  allowCustom: boolean;
  customLabel?: string;
  multi?: boolean;
  unit?: string;
  /** Currency for money_range */
  currency?: string;
  budgetBasis?: "total" | "per_unit" | "monthly" | "daily" | "service";
  placeholder?: string;
  /** Immediate commit on single chip select */
  commitOnSelect: boolean;
};

export type ControlResolveContext = {
  /**
   * SORU PROFİLİNİN KANONİK HIZLI SEÇENEKLERİ (2026-08-29).
   *
   * Kontrol tipi kararının sahibi bu kayıttır; seçeneklerin sahibi ise soru
   * profilidir. İkinci bir eşleme tablosu kurmamak için profil, seçeneklerini
   * buradan GİRDİ olarak verir. Kayıt kendi özel dallarını her zaman önce
   * çözer; bu kanal yalnız hiçbir özel kontrol eşleşmediğinde okunur.
   *
   * Bu liste KAPALI BİR EVREN DEĞİLDİR: profil kaydında seçeneklerin
   * tükenmişliğini söyleyen bir metadata yoktur, bu yüzden üretilen kontrol
   * serbest cevap yolunu korur.
   */
  profileChoices?: ControlOption[];
  categoryId: string;
  fieldKey: string;
  needType?: string | null;
  productType?: string | null;
  importance?: string;
  allowUnknown?: boolean;
  allowDontCare?: boolean;
  isRemoteService?: boolean;
  isRealEstate?: boolean;
  listingType?: string | null;
};
