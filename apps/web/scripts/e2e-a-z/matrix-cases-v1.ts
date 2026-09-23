/**
 * A'DAN Z'YE E2E — FAZ 1 VAKA MATRİSİ (2026-09-23)
 *
 * Her vaka bir GİZLİ NİYET KARTI taşır: kullanıcının gerçekte istediği şey.
 * İlk yazı bu kartın yalnız bir kısmını açığa vurur; motorun görevi kalanını
 * ya çıkarmak ya da SORMAKTIR. Kart, ölçütlerin (K3 gereksiz soru, K4 eksik
 * soru, K7 niyet taşınıyor mu) tek referansıdır.
 *
 * Boyutlar: 16 kapsam × 5 yazım × 3 bilgi yoğunluğu = 240 vaka.
 * Bu dosya SALT VERİDİR — hiçbir ürün davranışı burada tanımlanmaz.
 */

export type IntentCard = {
  /** Kullanıcının gerçekte aradığı şey (insan cümlesi). */
  target: string;
  brand?: string;
  model?: string;
  quantity?: { value: number; unit?: string };
  /** Tek bütçe tutarı — Talepo'da bütçe ARALIĞI yoktur (kurucu, 2026-08-23). */
  budgetTRY?: number;
  city: string;
  district: string;
  urgency: string;
  specialCondition: string;
};

export type WritingStyle = "duzgun" | "eksik" | "argo" | "karisik" | "coklu";
export type Density = "urun" | "urun_adet" | "tam";

export const WRITING_STYLES: WritingStyle[] = [
  "duzgun",
  "eksik",
  "argo",
  "karisik",
  "coklu",
];
export const DENSITIES: Density[] = ["urun", "urun_adet", "tam"];

export type ScopeBucket = {
  /** Kapsam kovası kimliği — rapor ve matris satırlarının anahtarı. */
  id: string;
  /** İnsan etiketi. */
  label: string;
  /** Beklenen RequestScope. */
  expectedScope:
    | "DEMAND"
    | "UNSUPPORTED_SUPPLY"
    | "UNSUPPORTED_MEDICAL_ADVICE"
    | "UNSUPPORTED_PHARMACY"
    | "UNSUPPORTED_REMOVED_SCOPE";
  /**
   * Beklenen kategori kimliği. `null` = kategori beklentisi yok
   * (kapsam dışı vakalar, ya da 11 kategorinin hiçbirine ait olmayan
   * ama MEŞRU talep — orada önemli olan REDDEDİLMEMESİDİR).
   */
  expectedCategory: string | null;
  /**
   * Kategori-dışı ama meşru talep mi? Böyle bir talep yayına
   * girebilmelidir; kategori ataması serbesttir.
   */
  legitOutOfCategory?: boolean;
  intent: IntentCard;
  /** Yazım biçimine göre D1 (yalnız ürün) metinleri. */
  base: Record<WritingStyle, string>;
  /** D2'de eklenen adet ifadesi (düzgün / özensiz register). */
  qty: { proper: string; sloppy: string };
  /** D3'te eklenen bütçe + konum + tarih. */
  full: { proper: string; sloppy: string };
  /**
   * Bu kovada SORULMASI ANLAMSIZ olan alan anahtarları (kalıcı değişmez
   * satırlar — kurucu 2026-08-23: bulunan her saçma eşleşme kalıcı
   * değişmez olur, tek seferlik düzeltme olmaz).
   */
  absurdFieldKeys: string[];
};

/** K4 için: niyet kartının kritik alanları. */
export const CRITICAL_INTENT_FIELDS = [
  "budgetTRY",
  "city",
  "quantity",
  "urgency",
] as const;

export const SCOPE_BUCKETS: ScopeBucket[] = [
  {
    id: "appliances",
    label: "Beyaz eşya",
    expectedScope: "DEMAND",
    expectedCategory: "appliances",
    intent: {
      target: "No-frost buzdolabı",
      brand: "Arçelik",
      quantity: { value: 2, unit: "adet" },
      budgetTRY: 40000,
      city: "Ankara",
      district: "Çankaya",
      urgency: "iki hafta içinde",
      specialCondition: "ankastre olmayacak",
    },
    base: {
      duzgun: "Arçelik no-frost buzdolabı arıyorum, ankastre olmasın.",
      eksik: "buzdolabı",
      argo: "acil buzdolbi lazim arcelik olsun no frost ankastre istemiyorum",
      karisik: "No frost buzdolabı arıyorum, brand olarak Arçelik olsun, ankastre değil.",
      coklu:
        "Arçelik no-frost buzdolabı ve bir de bulaşık makinesi arıyorum, ankastre olmasın.",
    },
    qty: { proper: "2 adet lazım.", sloppy: "2 tane lazim" },
    full: {
      proper: "Bütçem 40.000 TL. Ankara Çankaya'da olsun, iki hafta içinde lazım.",
      sloppy: "butcem 40000 tl ankara cankaya 2 hafta icinde",
    },
    absurdFieldKeys: ["roomCount", "area", "propertyType", "modelYear", "pageCount", "paperWeight"],
  },
  {
    id: "technology",
    label: "Teknoloji",
    expectedScope: "DEMAND",
    expectedCategory: "technology",
    intent: {
      target: "55 inç 4K televizyon",
      brand: "Samsung",
      quantity: { value: 1, unit: "adet" },
      budgetTRY: 25000,
      city: "İstanbul",
      district: "Kadıköy",
      urgency: "bu hafta",
      specialCondition: "duvara montaj dahil olsun",
    },
    base: {
      duzgun: "Samsung 55 inç 4K televizyon arıyorum, duvara montaj dahil olsun.",
      eksik: "televizyon",
      argo: "55 inc samsung tv lazim 4k olsun duvara montajli",
      karisik: "55 inch Samsung 4K TV arıyorum, wall mount dahil olsun.",
      coklu:
        "Samsung 55 inç 4K televizyon ve bir soundbar arıyorum, duvara montaj dahil olsun.",
    },
    qty: { proper: "1 adet yeterli.", sloppy: "1 tane" },
    full: {
      proper: "Bütçem 25.000 TL. İstanbul Kadıköy'de olsun, bu hafta içinde lazım.",
      sloppy: "butcem 25000 tl istanbul kadikoy bu hafta",
    },
    absurdFieldKeys: ["roomCount", "area", "propertyType", "diaperSize", "capacityKg", "paperWeight"],
  },
  {
    id: "automotive",
    label: "Otomotiv",
    expectedScope: "DEMAND",
    expectedCategory: "automotive",
    intent: {
      target: "205/55 R16 kış lastiği",
      brand: "Michelin",
      quantity: { value: 4, unit: "adet" },
      budgetTRY: 12000,
      city: "İzmir",
      district: "Bornova",
      urgency: "kasım başına kadar",
      specialCondition: "jant balansı yapılsın",
    },
    base: {
      duzgun: "Michelin 205/55 R16 kış lastiği arıyorum, jant balansı da yapılsın.",
      eksik: "kış lastiği",
      argo: "205 55 r16 kis lastigi lazim michelin olsun balans da yapilsin",
      karisik: "205/55 R16 winter lastik arıyorum, Michelin brand, balans service dahil.",
      coklu:
        "Michelin 205/55 R16 kış lastiği ve bir akü arıyorum, jant balansı da yapılsın.",
    },
    qty: { proper: "4 adet lazım.", sloppy: "4 tane" },
    full: {
      proper: "Bütçem 12.000 TL. İzmir Bornova'da olsun, kasım başına kadar lazım.",
      sloppy: "butcem 12000 tl izmir bornova kasim basinda",
    },
    absurdFieldKeys: ["roomCount", "area", "propertyType", "diaperSize", "pageCount", "screenSize"],
  },
  {
    id: "services",
    label: "Hizmetler",
    expectedScope: "DEMAND",
    expectedCategory: "services",
    intent: {
      target: "Evden eve nakliyat hizmeti",
      quantity: { value: 1, unit: "ev" },
      budgetTRY: 15000,
      city: "Bursa",
      district: "Nilüfer",
      urgency: "ay sonunda",
      specialCondition: "asansörlü taşıma olsun",
    },
    base: {
      duzgun: "Evden eve nakliyat hizmeti arıyorum, asansörlü taşıma olsun.",
      eksik: "nakliyat",
      argo: "evden eve nakliyeci lazim asansorlu tasima olsun acil",
      karisik: "Evden eve nakliyat service arıyorum, asansörlü moving olsun.",
      coklu:
        "Evden eve nakliyat ve bir de ev temizliği hizmeti arıyorum, asansörlü taşıma olsun.",
    },
    qty: { proper: "3+1 tek ev taşınacak.", sloppy: "3+1 ev" },
    full: {
      proper: "Bütçem 15.000 TL. Bursa Nilüfer'de, ay sonunda taşınacağım.",
      sloppy: "butcem 15000 tl bursa nilufer ay sonu",
    },
    absurdFieldKeys: ["screenSize", "capacityKg", "diaperSize", "paperWeight", "modelYear"],
  },
  {
    id: "health",
    label: "Sağlık (cihaz)",
    expectedScope: "DEMAND",
    expectedCategory: "health",
    intent: {
      target: "Akülü tekerlekli sandalye",
      quantity: { value: 1, unit: "adet" },
      budgetTRY: 30000,
      city: "Antalya",
      district: "Muratpaşa",
      urgency: "10 gün içinde",
      specialCondition: "katlanabilir olsun",
    },
    base: {
      duzgun: "Akülü tekerlekli sandalye arıyorum, katlanabilir olsun.",
      eksik: "tekerlekli sandalye",
      argo: "akulu tekerlekli sandalye lazim katlanabilir olsun acil",
      karisik: "Akülü wheelchair arıyorum, foldable olsun.",
      coklu:
        "Akülü tekerlekli sandalye ve bir hasta yatağı arıyorum, katlanabilir olsun.",
    },
    qty: { proper: "1 adet lazım.", sloppy: "1 tane" },
    full: {
      proper: "Bütçem 30.000 TL. Antalya Muratpaşa'da olsun, 10 gün içinde lazım.",
      sloppy: "butcem 30000 tl antalya muratpasa 10 gun icinde",
    },
    absurdFieldKeys: ["roomCount", "area", "propertyType", "pageCount", "diaperSize"],
  },
  {
    id: "furniture",
    label: "Mobilya",
    expectedScope: "DEMAND",
    expectedCategory: "furniture",
    intent: {
      target: "Ofis çalışma sandalyesi",
      quantity: { value: 10, unit: "adet" },
      budgetTRY: 50000,
      city: "İstanbul",
      district: "Şişli",
      urgency: "üç hafta içinde",
      specialCondition: "file sırtlı olsun",
    },
    base: {
      duzgun: "Ofis çalışma sandalyesi arıyorum, file sırtlı olsun.",
      eksik: "ofis sandalyesi",
      argo: "ofis sandalyesi lazim file sirtli olsun ergonomik",
      karisik: "Ofis için ergonomic çalışma sandalyesi arıyorum, mesh sırtlı olsun.",
      coklu:
        "Ofis çalışma sandalyesi ve 3 adet toplantı masası arıyorum, file sırtlı olsun.",
    },
    qty: { proper: "10 adet lazım.", sloppy: "10 tane" },
    full: {
      proper: "Bütçem 50.000 TL. İstanbul Şişli'de olsun, üç hafta içinde lazım.",
      sloppy: "butcem 50000 tl istanbul sisli 3 hafta icinde",
    },
    absurdFieldKeys: ["screenSize", "roomCount", "propertyType", "diaperSize", "paperWeight"],
  },
  {
    id: "machinery",
    label: "Makine",
    expectedScope: "DEMAND",
    expectedCategory: "machinery",
    intent: {
      target: "Mini ekskavatör kiralama",
      quantity: { value: 1, unit: "adet" },
      budgetTRY: 80000,
      city: "Konya",
      district: "Selçuklu",
      urgency: "gelecek ay",
      specialCondition: "operatörlü olsun",
    },
    base: {
      duzgun: "Kiralık mini ekskavatör arıyorum, operatörlü olsun.",
      eksik: "ekskavatör",
      argo: "kiralik mini ekskavator lazim operatorlu olsun",
      karisik: "Kiralık mini excavator arıyorum, operator dahil olsun.",
      coklu:
        "Kiralık mini ekskavatör ve bir jeneratör arıyorum, operatörlü olsun.",
    },
    qty: { proper: "1 adet lazım.", sloppy: "1 tane" },
    full: {
      proper: "Bütçem 80.000 TL. Konya Selçuklu'da olsun, gelecek ay lazım.",
      sloppy: "butcem 80000 tl konya selcuklu gelecek ay",
    },
    absurdFieldKeys: ["screenSize", "diaperSize", "roomCount", "propertyType", "coffeeType"],
  },
  {
    id: "home-kitchen",
    label: "Ev & Mutfak",
    expectedScope: "DEMAND",
    expectedCategory: "home-kitchen",
    intent: {
      target: "6 kişilik porselen yemek takımı",
      quantity: { value: 2, unit: "set" },
      budgetTRY: 8000,
      city: "Eskişehir",
      district: "Tepebaşı",
      urgency: "iki hafta içinde",
      specialCondition: "bulaşık makinesinde yıkanabilir olsun",
    },
    base: {
      duzgun:
        "6 kişilik porselen yemek takımı arıyorum, bulaşık makinesinde yıkanabilir olsun.",
      eksik: "yemek takımı",
      argo: "6 kisilik porselen yemek takimi lazim bulasik makinasinda yikanabilsin",
      karisik: "6 kişilik porselen dinner set arıyorum, dishwasher safe olsun.",
      coklu:
        "6 kişilik porselen yemek takımı ve bir tencere seti arıyorum, bulaşık makinesinde yıkanabilir olsun.",
    },
    qty: { proper: "2 set lazım.", sloppy: "2 takim" },
    full: {
      proper: "Bütçem 8.000 TL. Eskişehir Tepebaşı'nda olsun, iki hafta içinde lazım.",
      sloppy: "butcem 8000 tl eskisehir tepebasi 2 hafta icinde",
    },
    absurdFieldKeys: ["screenSize", "roomCount", "propertyType", "modelYear", "diaperSize"],
  },
  {
    id: "printing",
    label: "Matbaa & Üretim",
    expectedScope: "DEMAND",
    expectedCategory: "printing",
    intent: {
      target: "Kuşe kartvizit baskısı",
      quantity: { value: 1000, unit: "adet" },
      budgetTRY: 3000,
      city: "Ankara",
      district: "Yenimahalle",
      urgency: "5 gün içinde",
      specialCondition: "mat selofan kaplama olsun",
    },
    base: {
      duzgun: "Kuşe kartvizit bastırmak istiyorum, mat selofan kaplama olsun.",
      eksik: "kartvizit",
      argo: "kuse kartvizit bastircam mat selofanli olsun acil",
      karisik: "Kuşe kartvizit print ettirmek istiyorum, mat lamination olsun.",
      coklu:
        "Kuşe kartvizit ve 200 adet broşür bastırmak istiyorum, mat selofan kaplama olsun.",
    },
    qty: { proper: "1000 adet lazım.", sloppy: "1000 tane" },
    full: {
      proper: "Bütçem 3.000 TL. Ankara Yenimahalle'de olsun, 5 gün içinde lazım.",
      sloppy: "butcem 3000 tl ankara yenimahalle 5 gun icinde",
    },
    absurdFieldKeys: ["screenSize", "roomCount", "propertyType", "capacityKg", "diaperSize", "modelYear"],
  },
  {
    id: "real-estate",
    label: "Emlak",
    expectedScope: "DEMAND",
    expectedCategory: "real-estate",
    intent: {
      target: "Kiralık 3+1 daire",
      quantity: { value: 1, unit: "adet" },
      budgetTRY: 25000,
      city: "İstanbul",
      district: "Beşiktaş",
      urgency: "ay başında",
      specialCondition: "eşyalı olsun",
    },
    base: {
      duzgun: "Kiralık 3+1 daire arıyorum, eşyalı olsun.",
      eksik: "kiralık daire",
      argo: "kiralik 3+1 daire lazim esyali olsun acil",
      karisik: "Kiralık 3+1 furnished daire arıyorum.",
      coklu:
        "Kiralık 3+1 daire ve ayrıca küçük bir depo arıyorum, daire eşyalı olsun.",
    },
    qty: { proper: "1 daire yeterli.", sloppy: "1 daire" },
    full: {
      proper: "Bütçem aylık 25.000 TL. İstanbul Beşiktaş'ta olsun, ay başında lazım.",
      sloppy: "butcem 25000 tl istanbul besiktas ay basi",
    },
    absurdFieldKeys: ["brand", "model", "screenSize", "capacityKg", "diaperSize", "paperWeight", "warranty"],
  },
  {
    id: "baby",
    label: "Anne & Çocuk",
    expectedScope: "DEMAND",
    expectedCategory: "baby",
    intent: {
      target: "Travel sistem bebek arabası",
      quantity: { value: 1, unit: "adet" },
      budgetTRY: 15000,
      city: "İzmir",
      district: "Karşıyaka",
      urgency: "bir ay içinde",
      specialCondition: "çift yönlü olsun",
    },
    base: {
      duzgun: "Travel sistem bebek arabası arıyorum, çift yönlü olsun.",
      eksik: "bebek arabası",
      argo: "travel sistem bebek arabasi lazim cift yonlu olsun",
      karisik: "Travel system bebek arabası arıyorum, reversible olsun.",
      coklu:
        "Travel sistem bebek arabası ve bir oto koltuğu arıyorum, araba çift yönlü olsun.",
    },
    qty: { proper: "1 adet lazım.", sloppy: "1 tane" },
    full: {
      proper: "Bütçem 15.000 TL. İzmir Karşıyaka'da olsun, bir ay içinde lazım.",
      sloppy: "butcem 15000 tl izmir karsiyaka 1 ay icinde",
    },
    absurdFieldKeys: ["roomCount", "propertyType", "screenSize", "paperWeight", "generatorPower"],
  },
  {
    id: "out-of-category-legit",
    label: "Kategori dışı ama meşru talep (evcil hayvan maması)",
    expectedScope: "DEMAND",
    expectedCategory: null,
    legitOutOfCategory: true,
    intent: {
      target: "Tahılsız yetişkin kedi maması",
      quantity: { value: 4, unit: "çuval" },
      budgetTRY: 6000,
      city: "Ankara",
      district: "Keçiören",
      urgency: "bu hafta",
      specialCondition: "tahılsız olsun",
    },
    base: {
      duzgun: "Yetişkin kediler için tahılsız kuru mama arıyorum.",
      eksik: "kedi maması",
      argo: "tahilsiz yetiskin kedi mamasi lazim acil",
      karisik: "Yetişkin kediler için grain free dry food arıyorum.",
      coklu:
        "Tahılsız yetişkin kedi maması ve bir kedi kumu arıyorum.",
    },
    qty: { proper: "4 çuval (10 kg) lazım.", sloppy: "4 cuval" },
    full: {
      proper: "Bütçem 6.000 TL. Ankara Keçiören'de olsun, bu hafta lazım.",
      sloppy: "butcem 6000 tl ankara kecioren bu hafta",
    },
    absurdFieldKeys: ["roomCount", "propertyType", "screenSize", "paperWeight", "modelYear"],
  },
  {
    id: "unsupported-pharmacy",
    label: "Kapsam dışı — ilaç / eczane ürünü",
    expectedScope: "UNSUPPORTED_PHARMACY",
    expectedCategory: null,
    intent: {
      target: "Ağrı kesici ilaç (kapsam dışı)",
      quantity: { value: 2, unit: "kutu" },
      budgetTRY: 500,
      city: "İstanbul",
      district: "Üsküdar",
      urgency: "bugün",
      specialCondition: "parasetamol içerikli",
    },
    base: {
      duzgun: "Parasetamol içerikli ağrı kesici arıyorum.",
      eksik: "ağrı kesici",
      argo: "agri kesici lazim parasetamol olsun acil",
      karisik: "Parasetamol içerikli painkiller arıyorum.",
      coklu: "Ağrı kesici ve bir de C vitamini takviyesi arıyorum.",
    },
    qty: { proper: "2 kutu lazım.", sloppy: "2 kutu" },
    full: {
      proper: "Bütçem 500 TL. İstanbul Üsküdar'da olsun, bugün lazım.",
      sloppy: "butcem 500 tl istanbul uskudar bugun",
    },
    absurdFieldKeys: [],
  },
  {
    id: "unsupported-medical-advice",
    label: "Kapsam dışı — tıbbi tavsiye",
    expectedScope: "UNSUPPORTED_MEDICAL_ADVICE",
    expectedCategory: null,
    intent: {
      target: "Tıbbi tavsiye sorusu (kapsam dışı)",
      city: "Ankara",
      district: "Çankaya",
      urgency: "bugün",
      specialCondition: "kişiye özel tedavi sorusu",
    },
    base: {
      duzgun: "Baş ağrım için hangi ilacı almalıyım?",
      eksik: "baş ağrısı hangi ilaç",
      argo: "bas agrim var hangi ilaci icmeliyim acil",
      karisik: "Baş ağrım için hangi medication'ı almalıyım?",
      coklu:
        "Baş ağrım ve mide bulantım için hangi ilaçları almalıyım?",
    },
    qty: { proper: "Günde kaç kez almalıyım?", sloppy: "gunde kac kere" },
    full: {
      proper: "Ankara Çankaya'dayım, bugün başlamam gerekiyor, bütçem 500 TL.",
      sloppy: "ankara cankaya bugun lazim butcem 500 tl",
    },
    absurdFieldKeys: [],
  },
  {
    id: "unsupported-supply",
    label: "Kapsam dışı — arz ilanı",
    expectedScope: "UNSUPPORTED_SUPPLY",
    expectedCategory: null,
    intent: {
      target: "Kendi aracını satma ilanı (kapsam dışı)",
      brand: "Renault",
      quantity: { value: 1, unit: "adet" },
      budgetTRY: 750000,
      city: "İzmir",
      district: "Konak",
      urgency: "bu ay",
      specialCondition: "hasar kaydı yok",
    },
    base: {
      duzgun: "Aracımı satmak istiyorum, hasar kaydı yok.",
      eksik: "araba satıyorum",
      argo: "arabami satiyorum elimde renault var hasarsiz",
      karisik: "Aracımı satmak istiyorum, sell etmek istiyorum, hasar kaydı yok.",
      coklu:
        "Aracımı ve elimdeki iki adet buzdolabını satmak istiyorum.",
    },
    qty: { proper: "1 adet araç.", sloppy: "1 arac" },
    full: {
      proper: "Fiyatım 750.000 TL. İzmir Konak'tayım, bu ay içinde satmak istiyorum.",
      sloppy: "fiyatim 750000 tl izmir konak bu ay",
    },
    absurdFieldKeys: [],
  },
  {
    id: "unsupported-removed-scope",
    label: "Kapsam dışı — kaldırılmış kapsam (tıbbi test)",
    expectedScope: "UNSUPPORTED_REMOVED_SCOPE",
    expectedCategory: null,
    intent: {
      target: "Kan tahlili yaptırma (kapsam dışı)",
      quantity: { value: 1, unit: "test" },
      budgetTRY: 1500,
      city: "Bursa",
      district: "Osmangazi",
      urgency: "yarın",
      specialCondition: "evden numune alınsın",
    },
    base: {
      duzgun: "Kan tahlili yaptırmak istiyorum, evden numune alınsın.",
      eksik: "kan tahlili",
      argo: "kan tahlili yaptircam evden numune alinsin acil",
      karisik: "Kan tahlili (blood test) yaptırmak istiyorum, evden sample alınsın.",
      coklu:
        "Kan tahlili ve idrar tahlili yaptırmak istiyorum, evden numune alınsın.",
    },
    qty: { proper: "1 test yeterli.", sloppy: "1 test" },
    full: {
      proper: "Bütçem 1.500 TL. Bursa Osmangazi'de olsun, yarın lazım.",
      sloppy: "butcem 1500 tl bursa osmangazi yarin",
    },
    absurdFieldKeys: [],
  },
];

/** Yazım biçimi hangi register'ı kullanır? */
function registerFor(style: WritingStyle): "proper" | "sloppy" {
  return style === "argo" || style === "eksik" ? "sloppy" : "proper";
}

export type MatrixCase = {
  caseId: string;
  bucketId: string;
  style: WritingStyle;
  density: Density;
  text: string;
  bucket: ScopeBucket;
  /**
   * Bu metinde AÇIKÇA yazılmış niyet alanları. K3 (gereksiz soru) bunu
   * okur: yazılmış bir bilgiyi tekrar sormak hatadır.
   */
  writtenFields: string[];
};

export function buildMatrix(): MatrixCase[] {
  const cases: MatrixCase[] = [];
  for (const bucket of SCOPE_BUCKETS) {
    for (const style of WRITING_STYLES) {
      for (const density of DENSITIES) {
        const reg = registerFor(style);
        const parts = [bucket.base[style]];
        const written: string[] = ["target"];
        if (bucket.intent.brand && new RegExp(bucket.intent.brand, "i").test(bucket.base[style])) {
          written.push("brand");
        }
        if (density === "urun_adet" || density === "tam") {
          parts.push(bucket.qty[reg]);
          written.push("quantity");
        }
        if (density === "tam") {
          parts.push(bucket.full[reg]);
          written.push("budgetTRY", "city", "district", "urgency");
        }
        cases.push({
          caseId: `${bucket.id}__${style}__${density}`,
          bucketId: bucket.id,
          style,
          density,
          text: parts.join(" ").replace(/\s+/g, " ").trim(),
          bucket,
          writtenFields: written,
        });
      }
    }
  }
  return cases;
}
