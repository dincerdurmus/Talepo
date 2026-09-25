/**
 * AÇIK KÜME ÖLÇÜM KÜMESİ — paylaşılan biçimler (2026-09-25).
 *
 * Bu klasör bir ÖLÇÜM kümesidir, bir fixture koleksiyonu değil. Kurallar
 * `README.md` içinde yazılıdır ve en önemlisi şudur: test yarısına bakarak
 * kural yazmak yasaktır. Biçimler burada tek yerde durur ki A/B/E kümeleri
 * birbirinden ayrı biçimler icat etmesin.
 */

/** 11 kökün kanonik kimlikleri — `request-category-engine` ile birebir. */
export const TALEPO_ROOTS = [
  "appliances",
  "automotive",
  "baby",
  "furniture",
  "health",
  "home-kitchen",
  "machinery",
  "printing",
  "real-estate",
  "services",
  "technology",
] as const;

export type TalepoRoot = (typeof TALEPO_ROOTS)[number];

/**
 * A KÜMESİ — kategori dışı ama MEŞRU talep.
 *
 * `domain` insanın anladığı alan adıdır (gıda, evcil hayvan…), Talepo kökü
 * DEĞİLDİR: bu cümlelerin Talepo kökü yoktur, kümenin varlık sebebi tam olarak
 * budur. `nearRoot` "bu cümle hangi köke yanlışlıkla çekilebilir" tahminidir ve
 * yalnız raporlama içindir; hüküm değildir.
 */
export type OutOfTaxonomyCase = {
  id: string;
  domain: string;
  text: string;
  /** Neden 11 kökün dışında — tek cümlelik gerekçe, elle doğrulandı. */
  why: string;
  /** Yakın komşu tuzağı: yanlış çekilebileceği kök (varsa). */
  nearRoot?: TalepoRoot;
};

/**
 * B KÜMESİ — gerçekten İÇERİDE olan ama zor yazılmış talep.
 *
 * `root` bu talebin doğru kökü olarak ELLE verilmiş etikettir; kanonik
 * taksonomi ya da kürasyonlu sözlük dayanağı `verify-open-set-v1` içinde
 * ayrıca ölçülür. Etiket ile dayanak ayrışırsa bu bir bulgudur, bir hata
 * değildir: katalog eksikliği de ölçülmesi gereken şeydir.
 */
export type InTaxonomyCase = {
  id: string;
  root: TalepoRoot;
  text: string;
  /** Zorluk ekseni: jargon, marka+ürün, olağandışı ad, kısaltma. */
  hardness: "jargon" | "brand-product" | "unusual-name" | "abbreviation";
  why: string;
};

/**
 * E KÜMESİ — cevap otoritesi tuzağı (D-0030'un ters yönü).
 *
 * Metinde cevap VAR GİBİ görünür, aslında yoktur: olumsuzlama ("bütçem yok"),
 * düzeltme ("Kadıköy'de değil Üsküdar'da"), varsayım ("marka önemli değil").
 * Burada emin-ama-yanlış, SORULMASI GEREKEN SORUNUN ATLANMASI demektir.
 */
export type AnswerTrapCase = {
  id: string;
  /** Kanonik alan anahtarı — `syncFromText` durumundaki adla birebir. */
  field: string;
  text: string;
  /** Tuzağın sınıfı. */
  trap: "negation" | "correction" | "hedge" | "future-intent";
  /**
   * Beklenen davranış:
   *   "MUST_NOT_CLOSE" — alan soruyu KAPATAMAZ (asıl ölçüm).
   *   "MUST_CLOSE_WITH" — düzeltmede DOĞRU değer kapatabilir; beklenen parça.
   */
  expect: "MUST_NOT_CLOSE" | "MUST_CLOSE_WITH";
  /** `MUST_CLOSE_WITH` için değerin içermesi gereken parça. */
  expectContains?: string;
  why: string;
};
