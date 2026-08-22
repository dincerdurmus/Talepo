/**
 * Category-aware question profiles built on REQUEST_CATEGORIES field keys.
 * Single authority for prompts / importance / soft-answer policy.
 */

import type { QuestionProfileDef } from "./question-profile-types";

/** Shared Talepo Standard keys — evaluated for every active category when relevant. */
const STANDARD: QuestionProfileDef[] = [
  {
    fieldKey: "needType",
    prompt: "Ne tür bir talep bu?",
    summaryLabel: "Talep türü",
    importance: "routing_critical",
    categories: ["automotive", "machinery"],
    rank: 100,
    allowDontCare: false,
    allowUnknown: false,
    inputHint: "select",
  },
  {
    fieldKey: "listingType",
    prompt: "Kiralık mı, satılık mı?",
    summaryLabel: "İşlem",
    importance: "routing_critical",
    categories: ["real-estate"],
    rank: 98,
    allowDontCare: false,
  },
  {
    fieldKey: "propertyType",
    prompt: "Nasıl bir emlak arıyorsunuz?",
    summaryLabel: "Emlak tipi",
    importance: "routing_critical",
    categories: ["real-estate"],
    rank: 96,
  },
  {
    fieldKey: "city",
    prompt: "Hangi ilde arıyorsunuz?",
    summaryLabel: "Konum",
    importance: "publish_required",
    categories: ["real-estate"],
    rank: 94,
    inputHint: "location",
    allowUnknown: false,
    allowDontCare: false,
  },
  {
    fieldKey: "city",
    prompt: "Nereye teslim edilecek / hangi il?",
    summaryLabel: "Teslimat ili",
    importance: "quote_critical",
    categories: [
      "technology",
      "appliances",
      "printing",
      "automotive",
      "furniture",
      "machinery",
      "baby",
      "home-kitchen",
    ],
    rank: 70,
    inputHint: "location",
    allowUnknown: true,
  },
  {
    fieldKey: "locationMode",
    prompt: "Uzaktan hizmet sizin için uygun mu?",
    summaryLabel: "Hizmet şekli",
    importance: "routing_critical",
    categories: ["services"],
    rank: 88,
    inputHint: "select",
    allowUnknown: false,
    allowDontCare: false,
  },
  {
    fieldKey: "city",
    prompt: "Hizmet nerede verilecek?",
    summaryLabel: "Hizmet yeri",
    importance: "quote_critical",
    categories: ["services", "health"],
    rank: 68,
    inputHint: "location",
    allowUnknown: true,
    allowDontCare: true,
  },
  {
    fieldKey: "budget",
    prompt: "Bütçeniz nedir?",
    summaryLabel: "Bütçe",
    importance: "quote_critical",
    rank: 60,
    inputHint: "budget",
    allowUnknown: true,
    allowDontCare: true,
    budgetBasis: "total",
  },
  {
    fieldKey: "quantity",
    prompt: "Kaç adet arıyorsunuz?",
    summaryLabel: "Adet",
    importance: "quote_critical",
    categories: ["printing", "technology", "furniture"],
    rank: 75,
    inputHint: "number",
    allowUnknown: true,
  },
  {
    fieldKey: "quantity",
    prompt: "Kaç adet arıyorsunuz?",
    summaryLabel: "Adet",
    importance: "optional",
    categories: ["appliances", "home-kitchen", "baby"],
    rank: 35,
    inputHint: "number",
    allowUnknown: true,
    allowDontCare: true,
  },
  {
    fieldKey: "delivery",
    prompt: "Ne zamana kadar ihtiyacınız var?",
    summaryLabel: "Zaman",
    importance: "quote_critical",
    rank: 55,
    allowUnknown: true,
    allowDontCare: true,
  },
  {
    fieldKey: "condition",
    prompt: "Ürün durumu tercihiniz var mı?",
    summaryLabel: "Durum",
    importance: "optional",
    categories: [
      "technology",
      "appliances",
      "automotive",
      "furniture",
      "baby",
      "home-kitchen",
    ],
    rank: 50,
    allowDontCare: true,
    allowUnknown: true,
  },
  {
    // Makine pazarında sıfır/ikinci el ayrımı fiyatın ana eksenidir
    // (makinecim.com envanteri, 2026-08-22) — optional değil, quote_critical.
    fieldKey: "condition",
    prompt: "Sıfır mı, ikinci el mi?",
    summaryLabel: "Durum",
    importance: "quote_critical",
    categories: ["machinery"],
    rank: 66,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Sıfır", value: "Sıfır" },
      { label: "İkinci el", value: "İkinci el" },
    ],
  },
  {
    fieldKey: "brand",
    prompt: "Marka tercihiniz var mı?",
    summaryLabel: "Marka",
    importance: "optional",
    // Marka/model yalnız ürün kategorilerinde anlamlı — emlak ve hizmetlerde
    // asla sorulmaz (kurucu geri bildirimi, 2026-08-23).
    categories: [
      "technology",
      "appliances",
      "home-kitchen",
      "furniture",
      "machinery",
      "printing",
      "baby",
      "automotive",
      "health",
    ],
    rank: 48,
    allowDontCare: true,
    allowUnknown: true,
  },
  {
    fieldKey: "model",
    prompt: "Model tercihiniz var mı?",
    summaryLabel: "Model",
    importance: "optional",
    categories: [
      "technology",
      "appliances",
      "home-kitchen",
      "furniture",
      "machinery",
      "baby",
      "automotive",
    ],
    rank: 46,
    allowDontCare: true,
    allowUnknown: true,
  },
  {
    fieldKey: "dimensions",
    prompt: "Ölçüleri biliyor musunuz?",
    summaryLabel: "Ölçü",
    importance: "quote_critical",
    categories: ["printing"],
    rank: 80,
    allowUnknown: true,
  },
  {
    fieldKey: "material",
    prompt: "Malzeme / kâğıt tercihiniz?",
    summaryLabel: "Malzeme",
    importance: "optional",
    categories: ["printing"],
    rank: 40,
    allowUnknown: true,
    allowDontCare: true,
  },
  {
    fieldKey: "designReady",
    prompt: "Tasarım dosyanız hazır mı?",
    summaryLabel: "Tasarım",
    importance: "quote_critical",
    categories: ["printing"],
    rank: 72,
    allowUnknown: true,
  },
  {
    fieldKey: "roomCount",
    prompt: "Oda sayısı tercihiniz?",
    summaryLabel: "Oda",
    importance: "quote_critical",
    categories: ["real-estate"],
    // Oda sayısı yalnız konut tiplerinde sorulur — arsaya asla (kurucu, 2026-08-23).
    whenProductTypes: [
      "daire",
      "rezidans",
      "müstakil",
      "mustakil",
      "villa",
      "çiftlik evi",
      "ciftlik evi",
      "köşk",
      "kosk",
      "konak",
      "yalı",
      "yali",
      "stüdyo",
      "studyo",
      "dubleks",
      "konut",
      "ev",
    ],
    rank: 72,
    allowUnknown: true,
  },
  {
    fieldKey: "area",
    prompt: "Yaklaşık metrekare?",
    summaryLabel: "m²",
    importance: "optional",
    categories: ["real-estate"],
    rank: 45,
    allowUnknown: true,
  },
  {
    fieldKey: "modelYear",
    prompt: "Hangi model yılı ve üzeri olsun?",
    summaryLabel: "Yıl",
    importance: "quote_critical",
    categories: ["automotive"],
    whenNeedTypes: ["vehicle"],
    rank: 78,
    allowUnknown: true,
  },
  {
    fieldKey: "fuel",
    prompt: "Yakıt tercihiniz?",
    summaryLabel: "Yakıt",
    importance: "optional",
    categories: ["automotive"],
    whenNeedTypes: ["vehicle"],
    rank: 42,
    allowDontCare: true,
  },
  {
    fieldKey: "transmission",
    prompt: "Vites tercihiniz?",
    summaryLabel: "Vites",
    importance: "optional",
    categories: ["automotive"],
    whenNeedTypes: ["vehicle"],
    rank: 41,
    allowDontCare: true,
  },
  {
    fieldKey: "mileage",
    prompt: "Kilometre üst sınırı var mı?",
    summaryLabel: "Kilometre",
    importance: "optional",
    categories: ["automotive"],
    whenNeedTypes: ["vehicle"],
    rank: 40,
    allowDontCare: true,
    allowUnknown: true,
  },
  // (screenSize artık ürün-kapsamlı tanımda — aşağıda; kategori-geneli sürüm
  // ürün bilinmeden ekran sorusu sorduğu için kaldırıldı.)

  /* ------------------------------------------------------------------ */
  /* Product-scoped questions — "hangi ürüne hangi soru?"                */
  /* Sourced from the MediaMarkt TR category tree (2026-08-22): each     */
  /* product family gets ONLY the questions a seller actually needs to   */
  /* quote it. Asked only when the product type is detected.             */
  /* ------------------------------------------------------------------ */

  // —— TV / monitör ——
  {
    fieldKey: "screenSize",
    prompt: "Kaç inç olsun?",
    summaryLabel: "Ekran",
    importance: "quote_critical",
    categories: ["technology"],
    whenProductTypes: ["televizyon", "tv", "monitor", "monitör"],
    rank: 70,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "43\"", value: "43" },
      { label: "50\"", value: "50" },
      { label: "55\"", value: "55" },
      { label: "65\" ve üzeri", value: "65+" },
    ],
  },
  {
    fieldKey: "panelType",
    prompt: "Panel tercihin var mı?",
    summaryLabel: "Panel",
    importance: "optional",
    categories: ["technology"],
    whenProductTypes: ["televizyon", "tv", "monitor", "monitör"],
    rank: 30,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "OLED", value: "OLED" },
      { label: "QLED", value: "QLED" },
      { label: "LED", value: "LED" },
    ],
  },
  // —— telefon / tablet ——
  {
    fieldKey: "storageCapacity",
    prompt: "Depolama ne kadar olsun?",
    summaryLabel: "Depolama",
    importance: "quote_critical",
    categories: ["technology"],
    whenProductTypes: ["telefon", "iphone", "tablet", "ipad"],
    rank: 60,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "128 GB", value: "128 GB" },
      { label: "256 GB", value: "256 GB" },
      { label: "512 GB", value: "512 GB" },
      { label: "1 TB", value: "1 TB" },
    ],
  },
  // —— laptop ——
  {
    fieldKey: "usagePurpose",
    prompt: "Ne için kullanacaksın?",
    summaryLabel: "Kullanım",
    importance: "quote_critical",
    categories: ["technology"],
    whenProductTypes: ["laptop", "notebook", "bilgisayar", "macbook"],
    rank: 60,
    allowDontCare: false,
    inputHint: "select",
    quickChoices: [
      { label: "Oyun", value: "Oyun" },
      { label: "İş / Ofis", value: "İş" },
      { label: "Okul", value: "Okul" },
      { label: "Günlük kullanım", value: "Günlük" },
    ],
  },
  // —— kulaklık ——
  {
    fieldKey: "headphoneType",
    prompt: "Nasıl bir kulaklık?",
    summaryLabel: "Kulaklık tipi",
    importance: "quote_critical",
    categories: ["technology"],
    whenProductTypes: ["kulaklik", "kulaklık", "airpods"],
    rank: 60,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Kulak içi", value: "Kulak içi" },
      { label: "Kulak üstü", value: "Kulak üstü" },
      { label: "Bluetooth", value: "Bluetooth" },
      { label: "Oyuncu kulaklığı", value: "Oyuncu" },
    ],
  },
  // —— yazıcı ——
  {
    fieldKey: "printerType",
    prompt: "Hangi tip yazıcı?",
    summaryLabel: "Yazıcı tipi",
    importance: "quote_critical",
    categories: ["technology"],
    whenProductTypes: ["yazici", "yazıcı", "printer"],
    rank: 60,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Lazer", value: "Lazer" },
      { label: "Mürekkep püskürtmeli", value: "Mürekkep püskürtmeli" },
      { label: "Tanklı", value: "Tanklı" },
    ],
  },
  // —— fotoğraf makinesi ——
  {
    fieldKey: "cameraType",
    prompt: "Nasıl bir makine arıyorsun?",
    summaryLabel: "Makine tipi",
    importance: "quote_critical",
    categories: ["technology"],
    whenProductTypes: ["fotograf", "fotoğraf", "kamera"],
    rank: 60,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Aynasız", value: "Aynasız" },
      { label: "DSLR", value: "DSLR" },
      { label: "Kompakt", value: "Kompakt" },
      { label: "Şipşak (Instax)", value: "Şipşak" },
    ],
  },
  // —— klima ——
  {
    fieldKey: "btu",
    prompt: "Kaç BTU olmalı?",
    summaryLabel: "BTU",
    importance: "quote_critical",
    categories: ["appliances"],
    whenProductTypes: ["klima"],
    rank: 70,
    allowUnknown: true,
    inputHint: "select",
    quickChoices: [
      { label: "9.000 BTU", value: "9000 BTU" },
      { label: "12.000 BTU", value: "12000 BTU" },
      { label: "18.000 BTU", value: "18000 BTU" },
      { label: "24.000 BTU", value: "24000 BTU" },
    ],
  },
  {
    fieldKey: "installation",
    prompt: "Montaj da dahil olsun mu?",
    summaryLabel: "Montaj",
    importance: "optional",
    categories: ["appliances"],
    whenProductTypes: ["klima", "kombi", "sofben", "şofben", "termosifon"],
    rank: 30,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Montaj dahil", value: "Montaj dahil" },
      { label: "Sadece ürün", value: "Sadece ürün" },
    ],
  },
  // —— buzdolabı ——
  {
    fieldKey: "fridgeType",
    prompt: "Nasıl bir buzdolabı?",
    summaryLabel: "Buzdolabı tipi",
    importance: "quote_critical",
    categories: ["appliances"],
    whenProductTypes: ["buzdolabi", "buzdolabı"],
    rank: 60,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "No-Frost", value: "No-Frost" },
      { label: "Alttan donduruculu", value: "Alttan donduruculu" },
      { label: "Gardrop tipi", value: "Gardrop tipi" },
      { label: "Mini", value: "Mini" },
    ],
  },
  // —— çamaşır / kurutma ——
  {
    fieldKey: "capacityKg",
    prompt: "Kaç kilogram kapasite?",
    summaryLabel: "Kapasite",
    importance: "quote_critical",
    categories: ["appliances"],
    whenProductTypes: ["camasir", "çamaşır", "kurutma"],
    rank: 60,
    allowUnknown: true,
    inputHint: "select",
    quickChoices: [
      { label: "8 kg", value: "8 kg" },
      { label: "9 kg", value: "9 kg" },
      { label: "10 kg", value: "10 kg" },
      { label: "12 kg", value: "12 kg" },
    ],
  },
  // —— bulaşık makinesi ——
  {
    fieldKey: "placeSetting",
    prompt: "Kaç kişilik olsun?",
    summaryLabel: "Kapasite",
    importance: "quote_critical",
    categories: ["appliances"],
    whenProductTypes: ["bulasik", "bulaşık"],
    rank: 60,
    allowUnknown: true,
    inputHint: "select",
    quickChoices: [
      { label: "12 kişilik", value: "12 kişilik" },
      { label: "14 kişilik", value: "14 kişilik" },
      { label: "16 kişilik", value: "16 kişilik" },
    ],
  },
  // —— süpürge ——
  {
    fieldKey: "vacuumType",
    prompt: "Nasıl bir süpürge?",
    summaryLabel: "Süpürge tipi",
    importance: "quote_critical",
    categories: ["appliances"],
    whenProductTypes: ["supurge", "süpürge", "vacuum"],
    rank: 60,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Robot", value: "Robot" },
      { label: "Dikey şarjlı", value: "Dikey" },
      { label: "Toz torbalı", value: "Toz torbalı" },
      { label: "Islak-kuru", value: "Islak-kuru" },
    ],
  },
  // —— hava temizleyici / nemlendirici ——
  {
    fieldKey: "usageArea",
    prompt: "Kaç metrekarelik alan için?",
    summaryLabel: "Alan",
    importance: "quote_critical",
    categories: ["appliances"],
    whenProductTypes: ["temizleyici", "nemlendirici", "temizleme cihaz", "nemlendirme"],
    rank: 60,
    allowUnknown: true,
    inputHint: "select",
    quickChoices: [
      { label: "25 m²'ye kadar", value: "25 m²" },
      { label: "25–50 m²", value: "25-50 m²" },
      { label: "50 m² üzeri", value: "50+ m²" },
    ],
  },
  // —— fırın ——
  {
    fieldKey: "ovenType",
    prompt: "Ankastre mi, solo mu?",
    summaryLabel: "Fırın tipi",
    importance: "quote_critical",
    categories: ["appliances"],
    whenProductTypes: ["firin", "fırın", "ocak"],
    rank: 60,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Ankastre", value: "Ankastre" },
      { label: "Solo / Ocaklı", value: "Solo" },
      { label: "Mini fırın", value: "Mini" },
    ],
  },
  // —— kahve makinesi ——
  {
    fieldKey: "coffeeType",
    prompt: "Hangi tip kahve makinesi?",
    summaryLabel: "Kahve tipi",
    importance: "quote_critical",
    categories: ["home-kitchen"],
    whenProductTypes: ["kahve"],
    rank: 60,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Espresso", value: "Espresso" },
      { label: "Kapsüllü", value: "Kapsüllü" },
      { label: "Filtre", value: "Filtre" },
      { label: "Türk kahvesi", value: "Türk kahvesi" },
    ],
  },
  // —— anne & bebek (e-bebek ağacından, 2026-08-22) ——
  {
    fieldKey: "strollerType",
    prompt: "Nasıl bir bebek arabası?",
    summaryLabel: "Araba tipi",
    importance: "quote_critical",
    categories: ["baby"],
    whenProductTypes: ["bebek arabasi", "bebek arabası", "puset"],
    rank: 62,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Travel sistem", value: "Travel sistem" },
      { label: "Baston puset", value: "Baston" },
      { label: "İkiz arabası", value: "İkiz" },
    ],
  },
  {
    fieldKey: "carSeatGroup",
    prompt: "Hangi kilo grubu için?",
    summaryLabel: "Kilo grubu",
    importance: "quote_critical",
    categories: ["baby"],
    whenProductTypes: ["oto koltugu", "oto koltuğu", "ana kucagi", "ana kucağı"],
    rank: 62,
    allowUnknown: true,
    inputHint: "select",
    quickChoices: [
      { label: "0–13 kg (bebek)", value: "0-13 kg" },
      { label: "9–18 kg", value: "9-18 kg" },
      { label: "15–36 kg (yükseltici)", value: "15-36 kg" },
    ],
  },
  {
    fieldKey: "diaperSize",
    prompt: "Kaç numara?",
    summaryLabel: "Beden",
    importance: "quote_critical",
    categories: ["baby"],
    whenProductTypes: ["bebek bezi", "bez"],
    rank: 62,
    allowUnknown: true,
    inputHint: "select",
    quickChoices: [
      { label: "1–2 numara", value: "1-2" },
      { label: "3–4 numara", value: "3-4" },
      { label: "5–6 numara", value: "5-6" },
    ],
  },
  // —— mobilya (Koçtaş ağacından, 2026-08-22) ——
  {
    fieldKey: "bedSize",
    prompt: "Hangi boyutta olsun?",
    summaryLabel: "Boyut",
    importance: "quote_critical",
    categories: ["furniture"],
    whenProductTypes: ["yatak", "karyola", "baza"],
    rank: 62,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Tek kişilik (90–100)", value: "Tek kişilik" },
      { label: "Çift kişilik (140–160)", value: "Çift kişilik" },
      { label: "King (180+)", value: "King" },
    ],
  },
  {
    fieldKey: "wardrobeType",
    prompt: "Nasıl bir gardırop?",
    summaryLabel: "Gardırop tipi",
    importance: "quote_critical",
    categories: ["furniture"],
    whenProductTypes: ["gardirop", "gardırop"],
    rank: 62,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Kapaklı", value: "Kapaklı" },
      { label: "Sürgülü", value: "Sürgülü" },
      { label: "Köşe", value: "Köşe" },
      { label: "Bez / Portatif", value: "Bez" },
    ],
  },
  {
    fieldKey: "seatingType",
    prompt: "Nasıl bir oturma grubu?",
    summaryLabel: "Koltuk tipi",
    importance: "quote_critical",
    categories: ["furniture"],
    whenProductTypes: ["koltuk", "kanepe", "cekyat", "çekyat", "oturma grubu", "oturma grup"],
    rank: 62,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Koltuk takımı", value: "Koltuk takımı" },
      { label: "Köşe koltuk", value: "Köşe koltuk" },
      { label: "Çekyat", value: "Çekyat" },
      { label: "Tekli / Berjer", value: "Tekli" },
    ],
  },
  {
    fieldKey: "diningSeats",
    prompt: "Kaç kişilik olsun?",
    summaryLabel: "Kişi",
    importance: "quote_critical",
    categories: ["furniture"],
    whenProductTypes: ["yemek masasi", "yemek masası", "mutfak masasi", "mutfak masası", "masa takimi", "masa takımı"],
    rank: 62,
    allowUnknown: true,
    inputHint: "select",
    quickChoices: [
      { label: "4 kişilik", value: "4" },
      { label: "6 kişilik", value: "6" },
      { label: "8+ kişilik", value: "8+" },
    ],
  },
  // —— matbaa (Matbaaloji ağacından, 2026-08-22) ——
  {
    fieldKey: "quantity",
    prompt: "Kaç adet bastırılacak?",
    summaryLabel: "Adet",
    importance: "quote_critical",
    categories: ["printing"],
    whenProductTypes: [
      "kartvizit", "brosur", "broşür", "el ilani", "el ilanı", "afis", "afiş",
      "etiket", "davetiye", "magnet", "zarf", "antetli", "katalog", "dergi",
      "bloknot", "takvim", "dosya",
    ],
    rank: 72,
    allowUnknown: false,
    inputHint: "select",
    quickChoices: [
      { label: "500", value: "500" },
      { label: "1.000", value: "1000" },
      { label: "2.000", value: "2000" },
      { label: "5.000+", value: "5000" },
    ],
  },
  {
    fieldKey: "lamination",
    prompt: "Selefon ister misin?",
    summaryLabel: "Selefon",
    importance: "optional",
    categories: ["printing"],
    whenProductTypes: ["kartvizit", "brosur", "broşür", "katalog"],
    rank: 40,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Mat selefon", value: "Mat selefon" },
      { label: "Parlak selefon", value: "Parlak selefon" },
      { label: "Selefonsuz", value: "Selefonsuz" },
    ],
  },
  {
    fieldKey: "printSize",
    prompt: "Hangi ebatta olacak?",
    summaryLabel: "Ebat",
    importance: "quote_critical",
    categories: ["printing"],
    whenProductTypes: ["brosur", "broşür", "el ilani", "el ilanı", "afis", "afiş", "etiket", "davetiye"],
    rank: 60,
    allowUnknown: true,
    inputHint: "select",
    quickChoices: [
      { label: "A6", value: "A6" },
      { label: "A5", value: "A5" },
      { label: "A4", value: "A4" },
      { label: "A3 ve üzeri", value: "A3+" },
    ],
  },
  {
    fieldKey: "paperWeight",
    prompt: "Kağıt gramajı tercihin var mı?",
    summaryLabel: "Gramaj",
    importance: "optional",
    categories: ["printing"],
    whenProductTypes: ["brosur", "broşür", "el ilani", "el ilanı"],
    rank: 30,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "115 gr", value: "115 gr" },
      { label: "130 gr", value: "130 gr" },
      { label: "150 gr", value: "150 gr" },
    ],
  },
  {
    fieldKey: "pageCount",
    prompt: "Kaç sayfa olacak?",
    summaryLabel: "Sayfa",
    importance: "quote_critical",
    categories: ["printing"],
    whenProductTypes: ["katalog", "dergi", "kitapcik", "kitapçık"],
    rank: 60,
    allowUnknown: true,
    inputHint: "select",
    quickChoices: [
      { label: "8–16 sayfa", value: "8-16" },
      { label: "16–32 sayfa", value: "16-32" },
      { label: "32 sayfa üzeri", value: "32+" },
    ],
  },
  // —— endüstriyel makineler (makinecim.com ağacından, 2026-08-22) ——
  {
    fieldKey: "generatorPower",
    prompt: "Kaç kVA güç lazım?",
    summaryLabel: "Güç",
    importance: "quote_critical",
    categories: ["machinery"],
    whenProductTypes: ["jenerator", "jeneratör"],
    rank: 62,
    allowUnknown: true,
    inputHint: "select",
    quickChoices: [
      { label: "10–50 kVA", value: "10-50 kVA" },
      { label: "50–150 kVA", value: "50-150 kVA" },
      { label: "150–500 kVA", value: "150-500 kVA" },
      { label: "500+ kVA", value: "500+ kVA" },
    ],
  },
  {
    fieldKey: "liftCapacity",
    prompt: "Kaç ton kaldırma kapasitesi?",
    summaryLabel: "Kapasite",
    importance: "quote_critical",
    categories: ["machinery"],
    whenProductTypes: ["forklift", "transpalet", "vinc", "vinç", "caraskal"],
    rank: 62,
    allowUnknown: true,
    inputHint: "select",
    quickChoices: [
      { label: "1,5–2 ton", value: "1.5-2 ton" },
      { label: "2,5–3 ton", value: "2.5-3 ton" },
      { label: "3–5 ton", value: "3-5 ton" },
      { label: "5 ton üzeri", value: "5+ ton" },
    ],
  },
  {
    fieldKey: "compressorType",
    prompt: "Vidalı mı, pistonlu mu?",
    summaryLabel: "Kompresör tipi",
    importance: "quote_critical",
    categories: ["machinery"],
    whenProductTypes: ["kompresor", "kompresör"],
    rank: 62,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Vidalı", value: "Vidalı" },
      { label: "Pistonlu", value: "Pistonlu" },
    ],
  },
  // —— el aletleri (Bauhaus ağacından) ——
  {
    fieldKey: "toolPower",
    prompt: "Akülü mü, kablolu mu?",
    summaryLabel: "Güç tipi",
    importance: "quote_critical",
    categories: ["machinery"],
    whenProductTypes: ["matkap", "vidalama", "testere", "taslama", "taşlama", "kirici", "kırıcı"],
    rank: 60,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Akülü / Şarjlı", value: "Akülü" },
      { label: "Kablolu", value: "Kablolu" },
    ],
  },
  // —— bahçe makineleri ——
  {
    fieldKey: "mowerType",
    prompt: "Nasıl çalışsın?",
    summaryLabel: "Çalışma tipi",
    importance: "quote_critical",
    categories: ["machinery"],
    whenProductTypes: ["cim bicme", "çim biçme", "budama", "tirpan", "tırpan"],
    rank: 60,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Elektrikli", value: "Elektrikli" },
      { label: "Benzinli", value: "Benzinli" },
      { label: "Akülü", value: "Akülü" },
    ],
  },
  // —— boya (yapı market) ——
  {
    fieldKey: "paintScope",
    prompt: "İç cephe mi, dış cephe mi?",
    summaryLabel: "Kullanım yeri",
    importance: "quote_critical",
    categories: ["machinery", "services"],
    whenProductTypes: ["boya"],
    rank: 60,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "İç cephe", value: "İç cephe" },
      { label: "Dış cephe", value: "Dış cephe" },
      { label: "Tavan", value: "Tavan" },
    ],
  },
  // —— mangal / barbekü ——
  {
    fieldKey: "grillType",
    prompt: "Hangi tip mangal?",
    summaryLabel: "Mangal tipi",
    importance: "quote_critical",
    categories: ["home-kitchen"],
    whenProductTypes: ["mangal", "barbeku", "barbekü"],
    rank: 60,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "Kömürlü", value: "Kömürlü" },
      { label: "Gazlı", value: "Gazlı" },
      { label: "Elektrikli", value: "Elektrikli" },
    ],
  },
  // —— airfryer ——
  {
    fieldKey: "fryerCapacity",
    prompt: "Kaç litre olsun?",
    summaryLabel: "Kapasite",
    importance: "optional",
    categories: ["home-kitchen"],
    whenProductTypes: ["airfryer", "fritoz", "fritöz"],
    rank: 40,
    allowDontCare: true,
    inputHint: "select",
    quickChoices: [
      { label: "4–5 L", value: "4-5 L" },
      { label: "6–7 L", value: "6-7 L" },
      { label: "8 L ve üzeri", value: "8+ L" },
    ],
  },
];

const PROFILE_FOLD: Record<string, string> = {
  ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u",
};
function foldProductType(value: string): string {
  let out = "";
  for (const ch of value.toLocaleLowerCase("tr-TR")) {
    out += PROFILE_FOLD[ch] ?? ch;
  }
  return out;
}

function matchesProductType(
  def: QuestionProfileDef,
  productType: string | null | undefined,
): boolean {
  if (!def.whenProductTypes || def.whenProductTypes.length === 0) return true;
  // Product-scoped questions require a detected product: with no product we
  // stay silent rather than ask an irrelevant question (Dyson ≠ ekran boyutu).
  if (!productType?.trim()) return false;
  const hay = foldProductType(productType);
  return def.whenProductTypes.some((p) => hay.includes(foldProductType(p)));
}

function matchesCategory(
  def: QuestionProfileDef,
  categoryId: string,
): boolean {
  if (!def.categories || def.categories.length === 0) return true;
  return def.categories.includes(categoryId);
}

function matchesNeedType(
  def: QuestionProfileDef,
  needType: string | null | undefined,
): boolean {
  if (!def.whenNeedTypes || def.whenNeedTypes.length === 0) return true;
  if (!needType) return true;
  return def.whenNeedTypes.includes(needType);
}

/**
 * Resolve the active profile definition for a field in a category context.
 * More specific (category-scoped) defs win over generic ones.
 */
/** Specificity: product-scoped > category-scoped > global. */
function profileSpecificity(def: QuestionProfileDef): number {
  return (
    (def.whenProductTypes?.length ? 2 : 0) + (def.categories?.length ? 1 : 0)
  );
}

export function resolveProfileForField(input: {
  fieldKey: string;
  categoryId: string;
  needType?: string | null;
  productType?: string | null;
}): QuestionProfileDef | null {
  const matches = STANDARD.filter(
    (d) =>
      d.fieldKey === input.fieldKey &&
      matchesCategory(d, input.categoryId) &&
      matchesNeedType(d, input.needType) &&
      matchesProductType(d, input.productType),
  );
  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    const as = profileSpecificity(a);
    const bs = profileSpecificity(b);
    if (as !== bs) return bs - as;
    return (b.rank ?? 0) - (a.rank ?? 0);
  });
  return matches[0]!;
}

export function listProfilesForCategory(input: {
  categoryId: string;
  needType?: string | null;
  productType?: string | null;
}): QuestionProfileDef[] {
  const byKey = new Map<string, QuestionProfileDef>();
  for (const def of STANDARD) {
    if (!matchesCategory(def, input.categoryId)) continue;
    if (!matchesNeedType(def, input.needType)) continue;
    if (!matchesProductType(def, input.productType)) continue;
    const existing = byKey.get(def.fieldKey);
    if (!existing) {
      byKey.set(def.fieldKey, def);
      continue;
    }
    if (profileSpecificity(def) > profileSpecificity(existing)) {
      byKey.set(def.fieldKey, def);
    }
  }
  return [...byKey.values()].sort(
    (a, b) => (b.rank ?? 0) - (a.rank ?? 0),
  );
}

/** Read-only view of every profile — tooling/inspection only, not scheduling. */
export function listAllProfiles(): readonly QuestionProfileDef[] {
  return STANDARD;
}

export function importanceRank(importance: QuestionProfileDef["importance"]): number {
  switch (importance) {
    case "publish_required":
      return 400;
    case "routing_critical":
      return 300;
    case "quote_critical":
      return 200;
    case "optional":
      return 100;
  }
}

export function isCriticalImportance(
  importance: QuestionProfileDef["importance"],
): boolean {
  return importance !== "optional";
}
