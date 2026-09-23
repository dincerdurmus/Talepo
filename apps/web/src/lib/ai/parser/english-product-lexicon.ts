/**
 * İKİ DİLLİ ÜRÜN SÖZLÜĞÜ — İNGİLİZCE ÜRÜN ADI → TÜRKÇE KARŞILIK (P1-3).
 *
 * ÖLÇÜLEN KUSUR (A-Z koşusu, 2026-09-23). "Akülü wheelchair arıyorum" ve
 * "Kiralık mini excavator arıyorum" kategorisiz kalıyordu. Türkiye'de
 * insanlar ürün adını sıkça İngilizce yazar; sözlük tek dilliydi.
 *
 * NEDEN NORMALİZASYON KATMANINDA. Kusur tek bir kategoriye ait değildir:
 * aynı sözcük kategoriyi, özneyi, ürün türünü ve soruları birden düşürür.
 * Her listeye ayrı ayrı İngilizce eş anlamlı eklemek dört ayrı yama olurdu
 * ve dördü sessizce ayrışırdı. Metin BİR KEZ, en başta çevrilir; aşağıdaki
 * bütün eksenler kazancı birlikte alır.
 *
 * ÇEVRİLMEYENLER — VE NEDEN. Türkçeye yerleşmiş ödünç sözcükler
 * ("laptop", "notebook", "drone", "smart tv", "forklift", "tablet") burada
 * YOKTUR. Onlar zaten kanonik sözlükte Türkçe sayılır; çevirmek bugün yeşil
 * olan vakaları bozar. Sözlüğe bir sözcük eklemenin ölçütü tektir: Türkçe
 * karşılığı kanonik listede VAR, İngilizcesi YOK.
 *
 * ETİKET: kürelenmiş (curated) ve kapsamı TAM DEĞİLDİR. Liste, ölçülen
 * kusurlardan ve yaygın ticari ürün adlarından derlendi; kamuya açık bir
 * sözlükten türetilmedi ve öyle raporlanmaz.
 *
 * Saf modül: ağ yok, dosya yok, yan etki yok.
 */

/**
 * Sıra ÖNEMLİDİR: uzun ifade önce gelir, yoksa "washing machine" içindeki
 * "machine" tek başına eşleşip ifadeyi bozar.
 */
export const ENGLISH_PRODUCT_LEXICON: Array<[string, string]> = [
  /**
   * BİLEŞİK AD, PARÇASINDAN ÖNCE GELİR.
   *
   * Yönlendirme matrisi bunu ilk koşuda kırmızı verdi: "high chair" bir
   * mama sandalyesidir (baby), "ac compressor" bir klima kompresörüdür
   * (automotive). Tek sözcüğü çevirmek ("chair" → sandalye) ürünü
   * DEĞİŞTİRİYOR ve talebi yanlış kategoriye gönderiyordu. Taksonomi bu
   * ifadeleri zaten tanıyor; sözlük onun cevabını bozmamak için bileşik
   * adı kendi Türkçe kanonik karşılığına çevirir.
   */
  ["high chair", "mama sandalyesi"],
  ["baby chair", "mama sandalyesi"],
  ["ac compressor", "klima kompresörü"],
  ["a/c compressor", "klima kompresörü"],

  // --- sağlık / medikal ---
  ["wheel chair", "tekerlekli sandalye"],
  ["wheelchair", "tekerlekli sandalye"],
  ["hospital bed", "hasta yatağı"],
  ["blood pressure monitor", "tansiyon aleti"],

  // --- iş makinesi ---
  ["excavator", "ekskavatör"],
  ["bulldozer", "buldozer"],
  ["crane", "vinç"],
  ["generator", "jeneratör"],
  ["compressor", "kompresör"],
  ["conveyor", "konveyör"],

  // --- beyaz eşya ---
  ["washing machine", "çamaşır makinesi"],
  ["dish washer", "bulaşık makinesi"],
  ["dishwasher", "bulaşık makinesi"],
  ["refrigerator", "buzdolabı"],
  ["fridge", "buzdolabı"],
  ["dryer", "kurutma makinesi"],
  ["air conditioner", "klima"],

  // --- mobilya ---
  ["conference table", "toplantı masası"],
  ["meeting table", "toplantı masası"],
  ["office chair", "ofis sandalyesi"],
  ["dining table", "yemek masası"],
  ["bookshelf", "kitaplık"],
  ["wardrobe", "gardırop"],
  ["armchair", "koltuk"],
  ["chair", "sandalye"],
  ["desk", "çalışma masası"],

  // --- teknoloji ---
  ["printer", "yazıcı"],
  ["scanner", "tarayıcı"],
  ["keyboard", "klavye"],
  ["headphone", "kulaklık"],
  ["wall mount", "duvar askısı"],

  // --- matbaa ---
  ["business card", "kartvizit"],
  ["lamination", "laminasyon"],
  ["brochure", "broşür"],

  // --- hizmet ---
  ["moving service", "nakliyat"],
  ["cleaning service", "temizlik"],
  ["maintenance service", "bakım"],
];

/**
 * Sözlüğü metne uygular.
 *
 * Sözcük sınırı Unicode duyarlıdır: JS `\b` yalnız ASCII bilir ve Türkçe
 * bir harfin yanındaki İngilizce sözcüğü ("Akülü wheelchair") yanlış
 * sınırlayabilir. Bu yüzden sınır, harf/rakam OLMAYAN karakterle tanımlanır.
 */
export function applyEnglishProductLexicon(text: string): string {
  let result = text;
  for (const [english, turkish] of ENGLISH_PRODUCT_LEXICON) {
    const pattern = new RegExp(
      `(^|[^\\p{L}\\p{N}])${english.replace(/ /g, "\\s+")}(?![\\p{L}\\p{N}])`,
      "giu",
    );
    result = result.replace(pattern, (_match, prefix: string) => `${prefix}${turkish}`);
  }
  return result;
}
