/**
 * KATEGORİ BELİRSİZLİĞİ POLİTİKASI — TEK TİPLİ OTORİTE (2026-08-30).
 *
 * Kanonik taksonomide AYNI ifade birden fazla ana kategorinin altında
 * yaşayabilir ("koltuk" hem mobilya hem araç koltuğudur). Bu çakışmalar
 * VERİ değil KARARDIR: hangi ifadenin kullanıcıya sorulabileceğine ürün
 * karar verir, kod tahmin etmez.
 *
 * ÜÇ POLİTİKA:
 *   EXACT_ROUTE          — ifade tek kategoriye gider; netleştirme sorusu
 *                          GÖSTERİLMEZ. (Politika tablosunda yer almayan ve
 *                          taksonomide tek kategorisi olan her ifade budur;
 *                          tabloya yazılmaz.)
 *   ALLOWED_CLARIFICATION— ifade gerçekten çok anlamlıdır; kullanıcıya
 *                          YALNIZ `allowedCategoryIds` kümesindeki
 *                          kategoriler gösterilebilir.
 *   FORBIDDEN_ROUTE      — ifade bu kategoriye HİÇBİR koşulda gidemez;
 *                          netleştirme kartında bile gösterilemez.
 *
 * Tablo ELLE SEÇİLMİŞTİR (curated): girdileri taksonomideki gerçek
 * çakışmalardan gelir ve `verify-request-routing-matrix-v1` her koşuda iki
 * yönde doğrular — (1) taksonomide çakışan ama burada kaydı olmayan ifade
 * kapıyı KIRMIZI yapar, (2) burada olup taksonomide artık çakışmayan kayıt
 * da KIRMIZI yapar. Böylece tablo sessizce eskiyemez.
 *
 * Buraya alias LİSTESİ taşınmaz; yalnız çok-anlamlılık KARARI durur.
 * İfadelerin kendisi kanonik taksonomiden okunur.
 */

export type RoutingAmbiguityPolicy =
  | "EXACT_ROUTE"
  | "ALLOWED_CLARIFICATION"
  | "FORBIDDEN_ROUTE";

export type AmbiguityRule = {
  /** Katlanmış (küçük harf, aksansız) ifade — taksonomideki yazımıyla. */
  phrase: string;
  policy: Exclude<RoutingAmbiguityPolicy, "EXACT_ROUTE">;
  /**
   * ALLOWED_CLARIFICATION için: netleştirme kartının gösterebileceği
   * kategoriler. FORBIDDEN_ROUTE için: ifadenin ASLA gidemeyeceği
   * kategoriler.
   */
  categoryIds: readonly string[];
  /** Kararın tek cümlelik gerekçesi — tablo okunabilir kalsın. */
  reason: string;
};

/**
 * Taksonomide bugün ölçülen 9 kategoriler-arası çakışmanın kararları
 * (ölçüm: 2026-08-30, 2.020 PRODUCT/PART/SERVICE/GROUP düğümü üzerinde).
 */
export const AMBIGUITY_RULES: readonly AmbiguityRule[] = [
  {
    phrase: "koltuk",
    policy: "ALLOWED_CLARIFICATION",
    categoryIds: ["furniture", "automotive"],
    reason: "Ev koltuğu da araç koltuğu da kanonik üründür.",
  },
  {
    phrase: "aksesuar",
    policy: "ALLOWED_CLARIFICATION",
    categoryIds: ["furniture", "automotive"],
    reason: "Tek başına aksesuar hangi dünyaya ait olduğunu söylemez.",
  },
  {
    phrase: "davlumbaz",
    policy: "ALLOWED_CLARIFICATION",
    categoryIds: ["appliances", "automotive"],
    reason: "Mutfak davlumbazı ile araç parçası aynı adı taşır.",
  },
  {
    phrase: "klima",
    policy: "ALLOWED_CLARIFICATION",
    categoryIds: ["appliances", "automotive"],
    reason: "Ev kliması da araç klima parçası da kataloktadır.",
  },
  {
    phrase: "vakum pompasi",
    policy: "ALLOWED_CLARIFICATION",
    categoryIds: ["machinery", "automotive"],
    reason: "Endüstriyel pompa ile araç fren pompası ayrışmalıdır.",
  },
  {
    phrase: "cam",
    policy: "ALLOWED_CLARIFICATION",
    categoryIds: ["machinery", "automotive"],
    reason: "Cam işleme makinesi ile araç camı aynı sözcüktür.",
  },
  {
    phrase: "ev",
    policy: "ALLOWED_CLARIFICATION",
    categoryIds: ["real-estate", "automotive"],
    reason:
      "Tek başına 'ev' emlaktır; araç dünyasında yalnız karavan/mobil ev bağlamında geçer.",
  },
  {
    phrase: "bakim hizmetleri",
    policy: "ALLOWED_CLARIFICATION",
    categoryIds: ["services", "automotive"],
    reason: "Genel bakım ile araç bakımı ayrı otoritelerdir.",
  },
  {
    phrase: "salincak",
    policy: "ALLOWED_CLARIFICATION",
    categoryIds: ["baby", "automotive"],
    reason: "Bebek salıncağı ile araç yedek parçası aynı adı taşır.",
  },
  {
    phrase: "yedek parca",
    policy: "ALLOWED_CLARIFICATION",
    categoryIds: ["automotive", "machinery", "appliances"],
    reason:
      "Yedek parça üç dünyada da kanonik alt ağaçtır; tek başına yazıldığında hangisine ait olduğu sorulabilir.",
  },
  {
    phrase: "diger",
    policy: "FORBIDDEN_ROUTE",
    categoryIds: [
      "appliances","automotive","baby","furniture","health","home-kitchen",
      "machinery","printing","real-estate","services","technology",
    ],
    reason:
      "'Diğer' bir katalog doldurucu etiketidir; kullanıcı ifadesi olarak hiçbir kategoriye yönlendirilemez.",
  },
];

/** Katlama — taksonomi tarama ile aynı biçim (küçük harf + aksansız). */
export function foldAmbiguityPhrase(s: string): string {
  return String(s ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/û/g, "u")
    .trim();
}

const RULES_BY_PHRASE: ReadonlyMap<string, AmbiguityRule> = new Map(
  AMBIGUITY_RULES.map((r) => [r.phrase, r]),
);

export function ambiguityRuleFor(phrase: string): AmbiguityRule | null {
  return RULES_BY_PHRASE.get(foldAmbiguityPhrase(phrase)) ?? null;
}

/**
 * Bir netleştirme kartının bu ifade için gösterebileceği kategoriler.
 * Kayıt yoksa ifade EXACT_ROUTE'tur: yalnız kanonik kategorisi gösterilir.
 */
export function allowedClarificationCategories(
  phrase: string,
  canonicalCategoryId: string,
): readonly string[] {
  const rule = ambiguityRuleFor(phrase);
  if (rule && rule.policy === "ALLOWED_CLARIFICATION") return rule.categoryIds;
  return [canonicalCategoryId];
}
