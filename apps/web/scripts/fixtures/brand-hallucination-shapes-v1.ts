/**
 * MARKA HALÜSİNASYONU ŞEKİL IZGARASI V1 (2026-09-20, OL-0011 devamı).
 *
 * NEDEN VAR. 1077 korpusun BRAND_HALLUCINATION=0 kapısı yalnız korpustaki
 * girdi şekilleri kadar geçerlidir. İngilizce öbek teşhisi
 * (docs/INGILIZCE-OBEK-TESHIS-2026-09-20.md) korpusta HİÇ olmayan üç canlı
 * halüsinasyon buldu: "Smart TV 55 inç" → marka SMART (otomotiv kataloğu),
 * "Galaxy S25" → FORD + VEHICLE, "iPhone 17" → VEHICLE. Bu fixture o üç
 * örneği değil, ÜRETTİKLERİ SINIFI ölçer: şekil × kategori ızgarası.
 *
 * BEKLENTİ DİSİPLİNİ. Beklentiler zemin gerçeğidir, motorun bugünkü
 * davranışı değil. Bilinemeyen beklenti UYDURULMAZ: marka kuralı
 * ONLY:<ad> olan satırda markanın hiç dönmemesi de geçerlidir (bilmemek
 * halüsinasyon değildir; YANLIŞ marka halüsinasyondur). Araç ekseni üç
 * değerlidir: MUST (gerçek araç talebi, kaybolursa H3), MUST_NOT (araç
 * olmayan talep, VEHICLE dönerse H2), FREE (iddia yok).
 *
 * EKSEN PROVENANCE'I:
 *   A ingilizce-marka-seri — teşhisin 1. şekli: [marka][seri][sayı/harf].
 *   B jenerik-ingilizce-tur — teşhisin 2. şekli: İngilizce tür adı +
 *     Türkçe ölçü; markasız yazılmıştır, marka dönerse halüsinasyon.
 *   C tr-yaprak-en-marka — kontrol ekseni: açık yabancı marka + Türkçe
 *     yaprak; yanlış markaya kayma ölçülür.
 *   D gercek-arac-tuzagi — koruma ekseni: otomotiv kataloğu BURADA
 *     doğrudur; kapı bunları yanlış kırmızı yapamaz (H3).
 *   E marka-benzeri-sozcuk — Smart/Mini/Galaxy gibi sözcükler araç dışı
 *     bağlamda marka kanıtı DEĞİLDİR (kurucu dersi A55'in genellemesi).
 *   Küçük harf / ASCII varyantları teşhisteki "büyük/küçük harf etkisiz"
 *   ölçümünü kalıcılaştırır.
 */

export type VehicleRule = "MUST" | "MUST_NOT" | "FREE";

export type HallucinationShapeCase = {
  id: string;
  axis:
    | "ingilizce-marka-seri"
    | "jenerik-ingilizce-tur"
    | "tr-yaprak-en-marka"
    | "gercek-arac-tuzagi"
    | "marka-benzeri-sozcuk";
  input: string;
  /**
   * null → markasız yazıldı: HERHANGİ bir marka dönerse H1.
   * "<ad>" → yalnız bu marka (fold-eşleşme) ya da HİÇ marka kabul;
   *          başka marka dönerse H1.
   */
  expectedBrand: string | null;
  /**
   * MUST → marka girdide AÇIKÇA yazılıdır; kesin marka alanında dönmek
   * ZORUNDADIR, dönmezse H4 (marka kaybı). ONLY (varsayılan) → doğru marka
   * ya da hiç marka; bilmemek halüsinasyon değildir. MUST yalnız markası
   * metinde geçen satırlara verilir (C ekseni tamamı, D'nin markalı 9
   * satırı, A'da adı metinde geçen A03/A09); "Galaxy S25" gibi markasız
   * yazımlar ONLY kalır — o disiplin H4 ile bozulmaz.
   */
  brandRule?: "MUST" | "ONLY";
  /**
   * Kanonik ad eşleşmesinin meşru varyantları (örn. Mercedes →
   * Mercedes-Benz). Kapı fold sonrası TAM eşitlikle karşılaştırır; eski
   * iki yönlü includes "Mi" ⊂ "Mini" türü kazara geçişe açıktı ve
   * kaldırıldı. Varyant bir karar olarak buraya yazılır, gevşeklikle
   * kazanılmaz.
   */
  brandAliases?: readonly string[];
  vehicle: VehicleRule;
  /** Bilgi alanı (kapı kuralı değil): beklenen ürün türü çekirdeği ya da null=bilinmiyor. */
  productTypeHint?: string | null;
};

export const BRAND_HALLUCINATION_SHAPES_V1: readonly HallucinationShapeCase[] = [
  /* ---- A. İngilizce marka-seri öbeği ---- */
  { id: "A01", axis: "ingilizce-marka-seri", input: "Xbox Series X arıyorum", expectedBrand: "Microsoft", vehicle: "MUST_NOT", productTypeHint: "konsol" },
  { id: "A02", axis: "ingilizce-marka-seri", input: "PlayStation 5 arıyorum", expectedBrand: "Sony", vehicle: "MUST_NOT", productTypeHint: "konsol" },
  { id: "A03", axis: "ingilizce-marka-seri", input: "Nintendo Switch arıyorum", expectedBrand: "Nintendo", brandRule: "MUST", vehicle: "MUST_NOT", productTypeHint: "konsol" },
  { id: "A04", axis: "ingilizce-marka-seri", input: "Galaxy S25 arıyorum", expectedBrand: "Samsung", vehicle: "MUST_NOT", productTypeHint: "telefon" },
  { id: "A05", axis: "ingilizce-marka-seri", input: "Galaxy S25 Ultra arıyorum", expectedBrand: "Samsung", vehicle: "MUST_NOT", productTypeHint: "telefon" },
  { id: "A06", axis: "ingilizce-marka-seri", input: "iPhone 17 arıyorum", expectedBrand: "Apple", vehicle: "MUST_NOT", productTypeHint: "telefon" },
  { id: "A07", axis: "ingilizce-marka-seri", input: "iPhone 17 Pro arıyorum", expectedBrand: "Apple", vehicle: "MUST_NOT", productTypeHint: "telefon" },
  { id: "A08", axis: "ingilizce-marka-seri", input: "MacBook Air M4 arıyorum", expectedBrand: "Apple", vehicle: "MUST_NOT", productTypeHint: "dizüstü" },
  { id: "A09", axis: "ingilizce-marka-seri", input: "Apple Watch Ultra arıyorum", expectedBrand: "Apple", brandRule: "MUST", vehicle: "MUST_NOT", productTypeHint: "saat" },
  { id: "A10", axis: "ingilizce-marka-seri", input: "iPad Pro 13 arıyorum", expectedBrand: "Apple", vehicle: "MUST_NOT", productTypeHint: "tablet" },
  { id: "A11", axis: "ingilizce-marka-seri", input: "Surface Pro 11 arıyorum", expectedBrand: "Microsoft", vehicle: "MUST_NOT", productTypeHint: "tablet" },
  { id: "A12", axis: "ingilizce-marka-seri", input: "AirPods Pro 2 arıyorum", expectedBrand: "Apple", vehicle: "MUST_NOT", productTypeHint: "kulaklık" },
  { id: "A13", axis: "ingilizce-marka-seri", input: "galaxy s25 ariyorum", expectedBrand: "Samsung", vehicle: "MUST_NOT", productTypeHint: "telefon" },
  { id: "A14", axis: "ingilizce-marka-seri", input: "iphone 17 ariyorum", expectedBrand: "Apple", vehicle: "MUST_NOT", productTypeHint: "telefon" },
  { id: "A15", axis: "ingilizce-marka-seri", input: "xbox series x ariyorum", expectedBrand: "Microsoft", vehicle: "MUST_NOT", productTypeHint: "konsol" },
  { id: "A16", axis: "ingilizce-marka-seri", input: "macbook air m4 ariyorum", expectedBrand: "Apple", vehicle: "MUST_NOT", productTypeHint: "dizüstü" },

  /* ---- B. Jenerik İngilizce tür + ölçü (markasız yazıldı) ---- */
  { id: "B01", axis: "jenerik-ingilizce-tur", input: "Smart TV 55 inç arıyorum", expectedBrand: null, vehicle: "MUST_NOT", productTypeHint: "televizyon" },
  { id: "B02", axis: "jenerik-ingilizce-tur", input: "55 inç Smart TV arıyorum", expectedBrand: null, vehicle: "MUST_NOT", productTypeHint: "televizyon" },
  { id: "B03", axis: "jenerik-ingilizce-tur", input: "Smart TV arıyorum", expectedBrand: null, vehicle: "MUST_NOT", productTypeHint: "televizyon" },
  { id: "B04", axis: "jenerik-ingilizce-tur", input: "Air Fryer arıyorum", expectedBrand: null, vehicle: "MUST_NOT", productTypeHint: "fritöz" },
  { id: "B05", axis: "jenerik-ingilizce-tur", input: "Air Fryer 5 litre arıyorum", expectedBrand: null, vehicle: "MUST_NOT", productTypeHint: "fritöz" },
  { id: "B06", axis: "jenerik-ingilizce-tur", input: "Gaming Laptop 16 inç arıyorum", expectedBrand: null, vehicle: "MUST_NOT", productTypeHint: "dizüstü" },
  { id: "B07", axis: "jenerik-ingilizce-tur", input: "Gaming Mouse arıyorum", expectedBrand: null, vehicle: "MUST_NOT", productTypeHint: "mouse" },
  { id: "B08", axis: "jenerik-ingilizce-tur", input: "Tablet 10 inç arıyorum", expectedBrand: null, vehicle: "MUST_NOT", productTypeHint: "tablet" },
  { id: "B09", axis: "jenerik-ingilizce-tur", input: "Power Bank 20000 mAh arıyorum", expectedBrand: null, vehicle: "MUST_NOT", productTypeHint: "powerbank" },
  { id: "B10", axis: "jenerik-ingilizce-tur", input: "LED TV 65 inç arıyorum", expectedBrand: null, vehicle: "MUST_NOT", productTypeHint: "televizyon" },
  { id: "B11", axis: "jenerik-ingilizce-tur", input: "Bluetooth kulaklık arıyorum", expectedBrand: null, vehicle: "MUST_NOT", productTypeHint: "kulaklık" },
  { id: "B12", axis: "jenerik-ingilizce-tur", input: "smart tv 55 inc ariyorum", expectedBrand: null, vehicle: "MUST_NOT", productTypeHint: "televizyon" },
  { id: "B13", axis: "jenerik-ingilizce-tur", input: "air fryer ariyorum", expectedBrand: null, vehicle: "MUST_NOT", productTypeHint: "fritöz" },

  /* ---- C. Türkçe yaprak + açık İngilizce/yabancı marka ---- */
  { id: "C01", axis: "tr-yaprak-en-marka", input: "Samsung buzdolabı arıyorum", expectedBrand: "Samsung", brandRule: "MUST", vehicle: "MUST_NOT", productTypeHint: "buzdolabı" },
  { id: "C02", axis: "tr-yaprak-en-marka", input: "Bosch bulaşık makinesi arıyorum", expectedBrand: "Bosch", brandRule: "MUST", vehicle: "MUST_NOT", productTypeHint: "bulaşık makinesi" },
  { id: "C03", axis: "tr-yaprak-en-marka", input: "Sony kulaklık arıyorum", expectedBrand: "Sony", brandRule: "MUST", vehicle: "MUST_NOT", productTypeHint: "kulaklık" },
  { id: "C04", axis: "tr-yaprak-en-marka", input: "LG çamaşır makinesi arıyorum", expectedBrand: "LG", brandRule: "MUST", vehicle: "MUST_NOT", productTypeHint: "çamaşır makinesi" },
  { id: "C05", axis: "tr-yaprak-en-marka", input: "Apple dizüstü bilgisayar arıyorum", expectedBrand: "Apple", brandRule: "MUST", vehicle: "MUST_NOT", productTypeHint: "dizüstü" },
  { id: "C06", axis: "tr-yaprak-en-marka", input: "Philips süpürge arıyorum", expectedBrand: "Philips", brandRule: "MUST", vehicle: "MUST_NOT", productTypeHint: "süpürge" },
  { id: "C07", axis: "tr-yaprak-en-marka", input: "Arçelik buzdolabı arıyorum", expectedBrand: "Arçelik", brandRule: "MUST", vehicle: "MUST_NOT", productTypeHint: "buzdolabı" },
  { id: "C08", axis: "tr-yaprak-en-marka", input: "Samsung televizyon arıyorum", expectedBrand: "Samsung", brandRule: "MUST", vehicle: "MUST_NOT", productTypeHint: "televizyon" },
  { id: "C09", axis: "tr-yaprak-en-marka", input: "Xiaomi robot süpürge arıyorum", expectedBrand: "Xiaomi", brandRule: "MUST", vehicle: "MUST_NOT", productTypeHint: "robot süpürge" },
  { id: "C10", axis: "tr-yaprak-en-marka", input: "samsung buzdolabi ariyorum", expectedBrand: "Samsung", brandRule: "MUST", vehicle: "MUST_NOT", productTypeHint: "buzdolabı" },

  /* ---- D. Gerçek araç tuzağı — otomotiv kataloğu burada DOĞRUDUR ---- */
  { id: "D01", axis: "gercek-arac-tuzagi", input: "Ford Focus arıyorum", expectedBrand: "Ford", brandRule: "MUST", vehicle: "MUST", productTypeHint: null },
  { id: "D02", axis: "gercek-arac-tuzagi", input: "Fiat Egea arıyorum", expectedBrand: "Fiat", brandRule: "MUST", vehicle: "MUST", productTypeHint: null },
  { id: "D03", axis: "gercek-arac-tuzagi", input: "Ford Transit arıyorum", expectedBrand: "Ford", brandRule: "MUST", vehicle: "MUST", productTypeHint: null },
  { id: "D04", axis: "gercek-arac-tuzagi", input: "İkinci el araba arıyorum", expectedBrand: null, vehicle: "MUST", productTypeHint: null },
  { id: "D05", axis: "gercek-arac-tuzagi", input: "Mercedes C200 arıyorum", expectedBrand: "Mercedes", brandRule: "MUST", brandAliases: ["Mercedes-Benz"], vehicle: "MUST", productTypeHint: null },
  { id: "D06", axis: "gercek-arac-tuzagi", input: "Smart araba arıyorum", expectedBrand: "Smart", brandRule: "MUST", vehicle: "MUST", productTypeHint: null },
  { id: "D07", axis: "gercek-arac-tuzagi", input: "Mini Cooper arıyorum", expectedBrand: "Mini", brandRule: "MUST", vehicle: "MUST", productTypeHint: null },
  { id: "D08", axis: "gercek-arac-tuzagi", input: "Seat Leon arıyorum", expectedBrand: "Seat", brandRule: "MUST", vehicle: "MUST", productTypeHint: null },
  { id: "D09", axis: "gercek-arac-tuzagi", input: "Renault Clio arıyorum", expectedBrand: "Renault", brandRule: "MUST", vehicle: "MUST", productTypeHint: null },
  { id: "D10", axis: "gercek-arac-tuzagi", input: "2020 model dizel SUV arıyorum", expectedBrand: null, vehicle: "MUST", productTypeHint: null },
  { id: "D11", axis: "gercek-arac-tuzagi", input: "ford focus ariyorum", expectedBrand: "Ford", brandRule: "MUST", vehicle: "MUST", productTypeHint: null },

  /* ---- E. Marka-benzeri sözcük, araç dışı bağlam ---- */
  { id: "E01", axis: "marka-benzeri-sozcuk", input: "Mini buzdolabı arıyorum", expectedBrand: null, vehicle: "MUST_NOT", productTypeHint: "buzdolabı" },
  { id: "E02", axis: "marka-benzeri-sozcuk", input: "Mini fırın arıyorum", expectedBrand: null, vehicle: "MUST_NOT", productTypeHint: "fırın" },
  { id: "E03", axis: "marka-benzeri-sozcuk", input: "Smart TV kumandası arıyorum", expectedBrand: null, vehicle: "MUST_NOT", productTypeHint: "kumanda" },
  { id: "E04", axis: "marka-benzeri-sozcuk", input: "Galaxy telefon kılıfı arıyorum", expectedBrand: "Samsung", vehicle: "MUST_NOT", productTypeHint: "kılıf" },
  { id: "E05", axis: "marka-benzeri-sozcuk", input: "Akıllı saat arıyorum", expectedBrand: null, vehicle: "MUST_NOT", productTypeHint: "saat" },
  { id: "E06", axis: "marka-benzeri-sozcuk", input: "Aracım için ekspertiz hizmeti arıyorum", expectedBrand: null, vehicle: "MUST_NOT", productTypeHint: null },
  { id: "E07", axis: "marka-benzeri-sozcuk", input: "mini firin ariyorum", expectedBrand: null, vehicle: "MUST_NOT", productTypeHint: "fırın" },
];
