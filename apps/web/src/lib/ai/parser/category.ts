import { looksLikeTelevisionScreenContext } from "@/lib/request-understanding/number-role";
import {
  APPLIANCE_BRANDS,
  AUTOMOTIVE_BRANDS,
  automotiveModelKeywordList,
  BABY_BRANDS,
  brandKeywordList,
  findTechnologyProduct,
  FURNITURE_BRANDS,
  HOME_KITCHEN_BRANDS,
  MACHINERY_BRANDS,
  TECHNOLOGY_BRANDS,
  technologyProductKeywordList,
} from "./brand-catalog";
import { SERVICE_LEMMAS } from "@/lib/request-understanding/requested-item-role";

const AUTOMOTIVE_BRAND_KEYWORDS = brandKeywordList(AUTOMOTIVE_BRANDS);
const AUTOMOTIVE_MODEL_KEYWORDS = automotiveModelKeywordList();
const TECHNOLOGY_PRODUCT_KEYWORDS = technologyProductKeywordList();
const APPLIANCE_BRAND_KEYWORDS = brandKeywordList(APPLIANCE_BRANDS);
const HOME_KITCHEN_BRAND_KEYWORDS = brandKeywordList(HOME_KITCHEN_BRANDS);
const MACHINERY_BRAND_KEYWORDS = brandKeywordList(MACHINERY_BRANDS);

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  printing: [
    "matbaa",
    "baskı",
    "baski",
    "dijital baskı",
    "dijital baski",
    "ofset",
    "flekso",
    "uv baskı",
    "uv baski",
    "kartvizit",
    "kart vizit",
    "business card",
    "broşür",
    "brosur",
    "flyer",
    "afiş",
    "afis",
    "poster",
    "katalog",
    "davetiye",
    "magnet",
    "mıknatıs",
    "miknatis",
    "sticker",
    "etiket",
    "etiket baskı",
    "etiket baski",
    "ambalaj",
    "kutu",
    "kraft kutu",
    "oluklu kutu",
    "karton",
    "mukavva",
    "kraft",
    "poşet",
    "poset",
    "shrink",
    "cepli dosya",
    "zarf",
    "antetli",
    "promosyon",
    "roll up",
    "rollup",
    "roll-up",
    "branda",
    "tabela",
    "kaşe",
    "kase",
    "bloknot",
    "prototip baskı",
    "selefon",
  ],
  automotive: [
    "araba",
    "araç",
    "arac",
    "otomobil",
    /** 98+ Faz I: iki tekerlekli araç dünyası da otomotivdir (ölçüldü:
     * "Motosiklet kaskı" kategorisiz kalıyordu). */
    "motosiklet",
    "motorsiklet",
    "moto kask",
    "otomotiv",
    "sedan",
    "hatchback",
    "suv",
    "pickup",
    "pick-up",
    "minivan",
    "station wagon",
    /**
     * "yedek parça" bu listeden ÇIKARILDI (98+ Faz I, 2026-09-01): ifade
     * alan-bağımsız bir parça sözüdür; her domain'in makinesi için yedek
     * parça aranır. Ölçüldü: "Torna tezgahı için yedek parça arıyorum"
     * cümlesinde +3 puanla kategoriyi automotive'e çekip makineyi ("torna"
     * +1) eziyordu. Hiçbir kategori sinyali yoksa tarihsel automotive
     * varsayılanı skor döngüsünden SONRA ayrıca korunur.
     */
    "tampon",
    "balata",
    "far",
    "motor",
    "şasi",
    "sasi",
    "lastik",
    "jant",
    "hatasız",
    "hatasiz",
    "boyasız",
    "boyasiz",
    "ikinci el araç",
    "ikinci el arac",
    "0 km",
    ...AUTOMOTIVE_BRAND_KEYWORDS,
    ...AUTOMOTIVE_MODEL_KEYWORDS,
  ],
  machinery: [
    "makine",
    "makina",
    "cnc",
    "pres",
    "kompresör",
    "kompresor",
    "üretim hattı",
    "uretim hatti",
    "forklift",
    "traktör",
    "traktor",
    "ekskavatör",
    "ekskavator",
    "torna",
    "freze",
    "enjeksiyon",
    "extruder",
    "konveyör",
    "konveyor",
    "vinç",
    "vinc",
    "lazer kesim",
    "plazma kesim",
    "baskı makinesi",
    "baski makinesi",
    "paketleme makinesi",
    "ikinci el makine",
    "ikinci el makina",
    ...MACHINERY_BRAND_KEYWORDS,
  ],
  furniture: [
    "mobilya",
    "ofis sandalyesi",
    "çalışma masası",
    "calisma masasi",
    "toplantı masası",
    "toplantı masasi",
    "ofis masası",
    "ofis masasi",
    "ofis koltuğu",
    "ofis koltugu",
    "dosya dolabı",
    "dosya dolabi",
    "masa takımı",
    "masa takimi",
    "makam",
    "yemek masası",
    "yemek masasi",
    "sandalye",
    "koltuk",
    "dolap",
    "sehpa",
    "tezgah",
    "tezgâh",
    "büro mobilya",
    "buro mobilya",
    "ofis mobilya",
    "ergonomik",
    "kafe masa",
    "kitaplık",
    "kitaplik",
    "berjer",
    "kanepe",
    "vestiyer",
    "gardrop",
    "gardirop",
    "yatak odası",
    "yatak odasi",
    "tv ünitesi",
    "tv unitesi",
    "şaraplık",
    "saraplik",
    "gardırop",
    "ev mobilyası",
    "ev mobilyasi",
    "ofis mobilyaları",
    "ofis mobilyalari",
    ...brandKeywordList(FURNITURE_BRANDS),
  ],
  technology: [
    // Foto/kamera dünyası teknolojidir — "fotoğraf makinesi"ndeki "makine"
    // kelimesi machinery'yi şişiriyordu (Canon → machinery).
    "fotoğraf makinesi",
    "fotograf makinesi",
    "fotoğraf makinası",
    "fotograf makinasi",
    "aksiyon kamerası",
    "aksiyon kamerasi",
    "video kamera",
    "drone",
    "dron",
    "gimbal",
    "yazılım",
    "otomasyon",
    "yazilim",
    "web sitesi",
    "internet sitesi",
    "e-ticaret",
    "eticaret",
    "e ticaret",
    "web hizmet",
    "uygulama",
    "bilgisayar",
    "masaüstü bilgisayar",
    "masaustu bilgisayar",
    "sunucu",
    "laptop",
    "notebook",
    "dizüstü",
    "dizustu",
    "dizüstü bilgisayar",
    "dizustu bilgisayar",
    "teknoloji",
    "telefon",
    "cep telefonu",
    "akıllı telefon",
    "akilli telefon",
    "tablet",
    "televizyon",
    "iphone",
    "android",
    "galaxy",
    "promax",
    "pro max",
    "airpods",
    "macbook",
    "ipad",
    "redmi",
    "poco",
    "monitör",
    "monitor",
    "ekran",
    "televizyon",
    "smart tv",
    "smarttv",
    "yazıcı",
    "yazar kasa",
    "pos cihazı",
    "pos cihazi",
    "yazici",
    "donanım",
    "donanim",
    "grafik kartı",
    "grafik karti",
    "ssd",
    "ram",
    "router",
    "switch",
    ...brandKeywordList(TECHNOLOGY_BRANDS),
    ...TECHNOLOGY_PRODUCT_KEYWORDS,
  ],
  /**
   * KB-16: "kiralık"/"satılık" bu listeden ÇIKARILDI. İkisi de bir İŞLEM
   * belirtecidir, kategori belirteci değil — araç da makine de hasta yatağı
   * da kiralık olabilir. Liste yalnız emlak NESNELERİNİ taşır; ilan sıfatının
   * emlağa katkısı aşağıdaki puanlamada emlak çıpasına bağlanmıştır.
   */
  "real-estate": [
    "ev",
    "daire",
    "villa",
    "konut",
    "emlak",
    "rezidans",
    "residans",
    "arsa",
    "tarla",
    "imarlı arsa",
    "imarli arsa",
    "ticari arsa",
    "sanayi arsası",
    "sanayi arsasi",
    "apart",
    "stüdyo",
    "studyo",
    "dubleks",
    "tripleks",
    "metrekare",
    "m2",
    "m²",
    "gayrimenkul",
    "dükkan",
    "dukkan",
    "işyeri",
    "isyeri",
    "ofis",
    "plaza ofisi",
    "mağaza",
    "magaza",
    "depo",
    "antrepo",
    "fabrika",
    "imalathane",
    "avm ünitesi",
    "avm unitesi",
    "otel",
    "devre mülk",
    "devre mulk",
    "devren işyeri",
    "devren isyeri",
    "müştemilat",
    "mustemilat",
    "kooperatif hissesi",
    "turistik tesis",
    "bina",
    "konut sitesi",
    "sitede",
    "site içi",
    "site ici",
    "site aidat",
    "mahalle",
    "2+1",
    "1+1",
    "3+1",
    "4+1",
    "balkon",
    "manzara",
    "tapu",
    "mustakil",
    "müstakil",
    "bahçeli",
    "bahceli",
    "havuzlu",
    "yatırım",
    "yatirim",
  ],
  appliances: [
    "beyaz eşya",
    "beyaz esya",
    "küçük ev aletleri",
    "kucuk ev aletleri",
    "buzdolabı",
    "buzdolabi",
    "çamaşır makinesi",
    "camasir makinesi",
    "bulaşık makinesi",
    "bulasik makinesi",
    "kurutma makinesi",
    "ankastre",
    "fırın",
    "firin",
    "ocak",
    "davlumbaz",
    "klima",
    "kombi",
    "derin dondurucu",
    "mikrodalga",
    "mikro dalga",
    "şarap dolabı",
    "sarap dolabi",
    "no-frost",
    "nofrost",
    "aspiratör",
    "aspirator",
    "su sebili",
    "termosifon",
    "şofben",
    "sofben",
    "ütü",
    "utu",
    "airfryer",
    "süpürge",
    "supurge",
    "robot süpürge",
    "robot supurge",
    "dikey süpürge",
    "dikey supurge",
    "elektrikli süpürge",
    "elektrikli supurge",
    "vacuum",
    "hava temizleyici",
    "hava temizleme",
    "saç kurutma",
    "sac kurutma",
    "saç bakımı",
    "sac bakimi",
    ...APPLIANCE_BRAND_KEYWORDS,
  ],
  health: [
    /** 98+ Faz I (2026-09-01): kurucu kararıyla (FD-9/I52) "Ağrı kesici
     * arıyorum" DEMAND'dir; kategori sinyali yoktu ve talep UNKNOWN
     * kalıyordu (ölçüldü). OTC ürün TAKSONOMİSİ ayrı kurucu kararıdır —
     * burada yalnız kategori yönlendirmesi verilir. */
    "ağrı kesici",
    "agri kesici",
    "sağlık",
    "saglik",
    "medikal",
    "tıbbi",
    "tibbi",
    "hastane",
    "klinik",
    "eczane",
    "ortopedi",
    "laboratuvar",
    "stetoskop",
    "tansiyon aleti",
    "tansiyon ölçer",
    "tansiyon olcer",
    "oksijen",
    "hasta yatağı",
    "hasta yatagi",
    "tekerlekli sandalye",
    "dezenfektan",
    "serum",
    "protez",
    "ortez",
    "bandaj",
    "sargı",
    "sargi",
    "solunum",
    "nebulizatör",
    "nebulizator",
    "muayene",
  ],
  baby: [
    "bebek",
    "çocuk",
    "cocuk",
    "bebek arabası",
    "bebek arabasi",
    "puset",
    "mama sandalyesi",
    "emzik",
    "biberon",
    "bebek bezi",
    "beşik",
    "besik",
    "park yatak",
    "oyun parkı",
    "oyun parki",
    "yenidoğan",
    "yenidogan",
    "ana kucağı",
    "ana kucagi",
    "oyuncak",
    "tuvalet eğitimi",
    "tuvalet egitimi",
    "uyku tulumu",
    "bebek bakım",
    "bebek bakim",
    ...brandKeywordList(BABY_BRANDS),
  ],
  "home-kitchen": [
    "tabak",
    "çanak",
    "canak",
    "kahve seti",
    "çay seti",
    "cay seti",
    /**
     * KURUCU KARARI (2026-08-31): kahve makinesi (espresso / kapsüllü
     * dahil) appliances'ın malıdır; makine belirteçleri bu listeden
     * kaldırıldı. home-kitchen'da sofra/servis dünyası kalır.
     */
    "fincan",
    "bardak",
    "çatal",
    "catal",
    "bıçak seti",
    "bicak seti",
    "kaşık",
    "kasik",
    "yemek takımı",
    "yemek takimi",
    "servis takımı",
    "servis takimi",
    "mutfak eşyası",
    "mutfak esyasi",
    "porselen",
    "cam eşya",
    "cam esya",
    "tepsi",
    "sofra",
    "tencere",
    /** 98+ Faz I (2026-09-01): çok yaygın mutfak ürünü; kategori sinyali
     * yoktu ve talep UNKNOWN kalıyordu (ölçüldü, çaydanlık). */
    "çaydanlık",
    "caydanlik",
    "tava",
    "süzgeç",
    "suzgec",
    "kepçe",
    "kepce",
    "termos",
    "saklama kabı",
    "saklama kabi",
    "mutfak gereci",
    ...HOME_KITCHEN_BRAND_KEYWORDS,
  ],
  services: [
    "müşavir",
    "musavir",
    "organizasyon",
    "kurs",
    "hizmet",
    "danışmanlık",
    "danismanlik",
    "temizlik",
    "nakliye",
    "nakliyat",
    "evden eve nakliye",
    "evden eve nakliyat",
    "evden eve taşıma",
    "evden eve tasima",
    "eşya taşıma",
    "esya tasima",
    "taşımacılık",
    "tasimacilik",
    "ofis taşıma",
    "ofis tasima",
    "taşıma",
    "tasima",
    "montaj hizmeti",
    "bakım hizmeti",
    "bakim hizmeti",
    "boya",
    "badana",
    "boya badana",
    "boyama",
    "boyatacam",
    "boyatacağım",
    "boyatacagim",
    "boyatmak",
    "tadilat",
    "renovasyon",
    "tamirat",
    "boş ev temizliği",
    "bos ev temizligi",
    "ev temizliği",
    "ev temizligi",
    "halı yıkama",
    "hali yikama",
    "koltuk yıkama",
    "koltuk yikama",
    "kombi servisi",
    "klima servisi",
    "cam balkon",
    "demirdöküm kombi",
    "demirdokum kombi",
    "eca kombi",
    "direksiyon dersi",
    "duvar dekorasyon",
    "ev dekorasyon",
    "fayans döşeme",
    "fayans doseme",
    "iç mimar",
    "ic mimar",
    "elektrikçi",
    "elektrikci",
    "parça eşya taşıma",
    "parca esya tasima",
    "ev yardımcısı",
    "ev yardimcisi",
    "evde yardımcı",
    "evde yardimci",
    "ev hizmetlisi",
    "evde hizmetli",
    "ev işleri yardımcısı",
    "ev isleri yardimcisi",
  ],
};

/**
 * Sınır-kurallı anahtar kelime isabeti (98+ Faz I, 2026-09-01): marka/model
 * bonusları da serbest substring kullanıyordu — ölçüldü: "gla" (Mercedes GLA)
 * "baGLAntı" içinde eşleşip mobilya parça talebine otomotiv +4 veriyordu.
 * Kural keywordScore ile AYNIDIR; ikinci bir eşik kurulmaz.
 */
function keywordHits(normalized: string, keyword: string): boolean {
  return keywordScore(normalized, keyword) > 0;
}

/**
 * YER SÖZCÜKLERİ — bağlam eki genişletmesinin kapsamı (2026-09-15).
 *
 * Bir talepte bu sözcükler neredeyse her zaman ürünün NEREDE kullanılacağını
 * söyler, aranan şeyin kendisini değil. Nesne adları (buzdolabı, araba,
 * bilgisayar) bu kümede DEĞİLDİR: onlarda dar iyelik kuralı yeterlidir ve
 * geniş kural ölçülen zarar veriyordu.
 */
const PLACE_CONTEXT_WORDS = new Set([
  "ev",
  "daire",
  "villa",
  "konut",
  "ofis",
  "dükkan",
  "dukkan",
  "mağaza",
  "magaza",
  "apart",
  "arsa",
  "tarla",
  "depo",
  "rezidans",
  "residans",
  "dubleks",
  "tripleks",
]);

function keywordScore(normalized: string, keyword: string) {
  const at = normalized.indexOf(keyword);
  if (at < 0) return 0;
  /**
   * İYELİK EKLİ GEÇİŞ SAHİPLİK/KULLANIM BAĞLAMIDIR (98+ Part IV,
   * 2026-09-01). "dükkanıma yazar kasa", "buzdolabım su akıtıyor" —
   * 1. tekil iyelik eki taşıyan sözcük kullanıcının KENDİ nesnesini/yerini
   * anlatır, aradığı şeyi değil; oy kullanırsa POS cihazı talebi emlağa
   * düşüyordu (ölçüldü). Böyle geçişler kategori oyu ÜRETMEZ; talebin
   * gerçek hedefi kendi sözcükleriyle oy verir.
   *
   * PARADİGMA YALNIZ YER SÖZCÜKLERİNDE GENİŞLETİLDİ (2026-09-15, kod
   * incelemesinde daraltıldı).
   *
   * Kural iyelik ekinde duruyordu; iyelik ÜSTÜNE hâl eki gelen biçimler
   * dışarıda kalıyordu ve aynı hatayı üretiyordu: "evimin salonuna halı"
   * emlağa düşüyordu, çünkü "evimin" (iyelik + ilgi hâli) desene uymuyordu.
   *
   * İLK YAZIMDA GENİŞLETME BÜTÜN ANAHTARLARA UYGULANMIŞTI VE BU ÖLÇÜLMEMİŞTİ.
   * Ölçülen yan etki: "buzdolabımın kapağı bozuldu" ve "arabamın camı kırıldı"
   * gibi NESNE bildirileri de oyunu kaybediyordu; beyaz eşya ve otomotiv
   * tedarikçisi o talepleri kategoriden hiç görmeyecekti. Çözülmek istenen
   * sorun YER bağlamıydı, nesne bağlamı değil — nesne için zaten var olan
   * iyelik kuralı yeterliydi.
   *
   * Bu yüzden genişletilmiş hâl eki kümesi YALNIZ yer sözcüklerinde geçerli.
   * Nesne adları eski, dar davranışını korur.
   */
  {
    const place = PLACE_CONTEXT_WORDS.has(keyword);
    const pattern = place
      ? /^[ıiuü]?m(?:[ıiuü]z)?(?:[ıiuüae]|[ıiuü]n|d[ae]n?|t[ae]n?)?(?![a-zçğıöşü])/
      : /^[ıiuü]?m(?:[ıiuüae]|[ıiuü]z[ae]?)?(?![a-zçğıöşü])/;
    let i = at;
    let hasNonPossessive = false;
    while (i >= 0) {
      const rest = normalized.slice(i + keyword.length);
      if (!pattern.test(rest)) { hasNonPossessive = true; break; }
      i = normalized.indexOf(keyword, i + 1);
    }
    if (!hasNonPossessive) return 0;
  }
  /**
   * KISA ANAHTAR KELİMEDE SINIR ZORUNLU (98+ Faz I, 2026-09-01). Serbest
   * substring, kısa sözcükleri alakasız sözcüklerin İÇİNDE buluyordu —
   * ölçüldü: "far" ∈ "marka FARk etmez" → çaydanlık talebi otomotive
   * kayıp bütün-araç sanılıyordu. Türkçe ek almış biçimler kaybolmasın
   * diye tam sınır aranmaz: ≤4 harflik anahtar, sözcük BAŞINDA başlamalı
   * ve ya sözcük orada bitmeli ya da devam eden harf Türkçe ek başlangıcı
   * (ünlü veya l: farı, fara, farlar, farlı) olmalıdır. "fark"taki k ek
   * başlangıcı değildir ve eşleşme düşer. Uzun anahtarlar eski davranışı
   * korur.
   */
  if (keyword.length <= 4) {
    let ok = false;
    let i = at;
    while (i >= 0) {
      const before = i === 0 ? "" : normalized[i - 1]!;
      const afterCh = normalized[i + keyword.length] ?? "";
      const startBoundary = before === "" || !/[a-zçğıöşü0-9]/.test(before);
      const endOk =
        afterCh === "" ||
        !/[a-zçğıöşü0-9]/.test(afterCh) ||
        /[aeıioöuüln]/.test(afterCh); // n: tamlama tamponu ("tavanın")
      if (startBoundary && endOk) { ok = true; break; }
      i = normalized.indexOf(keyword, i + 1);
    }
    if (!ok) return 0;
  }
  return Math.max(1, Math.ceil(keyword.length / 5));
}

const HOUSEHOLD_MACHINE_PATTERNS = [
  "kahve makinesi",
  "kahve makina",
  "çamaşır makinesi",
  "camasir makinesi",
  "bulaşık makinesi",
  "bulasik makinesi",
  "kurutma makinesi",
  "dikey süpürge",
  "dikey supurge",
  "elektrikli süpürge",
  "elektrikli supurge",
  "robot süpürge",
  "robot supurge",
];

const PAINT_SERVICE_PATTERNS = [
  "boya",
  "badana",
  "boyat",
  "boyama",
  "tadilat",
];

/** Minimum score before we claim a category confidently in UX. */


/** Mülk sözcüğü: oda deseni ya da konut/ticari mekân adı. */
const PROPERTY_WORD_PATTERN =
  /\b[1-9]\s*\+\s*[0-9]\b|\b(?:ev|daire|villa|konut|arsa|dükkan|dukkan|ofis|depo)\b/i;

/** Emlak İŞLEMİ çıpası: mülkün kendisinin istendiğini söyleyen sözcükler. */
const REAL_ESTATE_TRANSACTION_PATTERN =
  /(satılık|satilik|kiralık|kiralik|kiralamak|kiraya|satın\s*al|satin\s*al|emlak|tapu|devren|yatırımlık|yatirimlik)/i;

/** Sözlükten gelen bir sözcüğü düzenli ifadeye güvenle gömer. */
function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const CATEGORY_CONFIDENT_MIN_SCORE = 2;

export type CategoryDetectionResult = {
  categoryId: string;
  score: number;
  /** False when match is weak/default — UI must not present as certain. */
  confident: boolean;
  runnerUpId: string | null;
  runnerUpScore: number;
};

function hasAny(normalized: string, terms: string[]) {
  return terms.some((t) => normalized.includes(t));
}

/**
 * Furniture *object* nouns beat location/use-context words like "ofis".
 * "masaüstü" / "masaj" are not furniture objects.
 */
export function hasFurnitureObjectNoun(text: string): boolean {
  const n = text.toLocaleLowerCase("tr-TR");
  if (
    /(?:koltuk|sandalye|kitaplık|kitaplik|sehpa|berjer|kanepe|gardırop|gardrop|vestiyer|dolap)/i.test(
      n,
    )
  ) {
    return true;
  }
  if (
    /(?:çalışma|calisma|toplantı|toplantı|yemek|ofis)\s*masa/i.test(n)
  ) {
    return true;
  }
  if (/masaüstü|masaustu|masaj/.test(n)) return false;
  return /(?:^|[^\p{L}\p{N}])masa(?:sı|si)?(?=[^\p{L}\p{N}]|$)/iu.test(n);
}

function hasRealEstateOfficeSignal(normalized: string): boolean {
  if (!normalized.includes("ofis")) return false;
  if (hasFurnitureObjectNoun(normalized)) return false;
  return (
    /kiralık|kiralik|satılık|satilik|kiralamak|metrekare|\bm2\b|m²|gayrimenkul|işyeri|isyeri/.test(
      normalized,
    ) || /\d+\s*m2/.test(normalized)
  );
}

/**
 * Score all categories and pick a winner.
 * IMPORTANT: score 0 must NOT confidently claim "services".
 */
export function detectCategoryResult(text: string): CategoryDetectionResult {
  const normalized = text.toLocaleLowerCase("tr-TR");

  let winner = "services";
  let winnerScore = 0;
  let runnerUpId: string | null = null;
  let runnerUpScore = 0;

  /**
   * YAPI: HİZMET ADI BAŞTA İSE, MÜLK SÖZCÜĞÜ HİZMETİN NESNESİDİR (P2-8).
   *
   * Ölçüldü (A-Z koşusu): "nakliyat 3+1 ev bursa" → `real-estate`. Kullanıcı
   * taşınmak için nakliyeci arıyor; sistem ona m², kat ve bina yaşı soruyor
   * ve yayın hiç açılmıyor. Aynı cümle "evden eve nakliyat" yazılınca DOĞRU
   * kalıyordu — yani kusur sözcükte değil AĞIRLIKTAYDI: iki emlak anahtar
   * kelimesi tek hizmet sözcüğünü eziyordu.
   *
   * Kural sözcük saymaz, SIRA okur. Türkçe talep cümlesi baş adla başlar:
   * "nakliyat 3+1 ev bursa" cümlesinde istenen şey nakliyattır, "3+1 ev"
   * taşınacak olandır. Tersi de doğrudur: "3+1 daire arıyorum, servise yakın
   * olsun" cümlesinde mülk baştadır ve hizmet sözcüğü onu NİTELER — orada bu
   * kural çalışmaz ve emlak oyu korunur.
   *
   * Emlak İŞLEMİ çıpası ("satılık", "kiralık", "kiralamak", "emlak") varsa
   * kural hiç çalışmaz: o çıpa mülkün KENDİSİNİN istendiğini söyler ve hizmet
   * sözcüğü onu geçemez. Fail-closed taraf budur.
   *
   * Hizmet sözlüğü burada YENİDEN YAZILMAZ: `SERVICE_LEMMAS` hizmet dilinin
   * tek yetkili yeridir. Yarın oraya eklenen her sözcük aynı korumayı kazanır.
   *
   * Karar DÖNGÜNÜN ÜSTÜNDE hesaplanır çünkü iki kategoriyi birden ilgilendirir:
   * emlak oyu düşer, hizmet oyu yükselir. Yalnız birini yapmak ikisini de
   * kazandırmayan bir berabere üretiyordu (ölçüldü: skor 2-2 kalıyordu).
   */
  const serviceLemmaIndex = SERVICE_LEMMAS.reduce((best, lemma) => {
    const at = normalized.search(
      new RegExp(`(?:^|[^a-zçğıöşü0-9])${escapeRegexLiteral(lemma)}`, "i"),
    );
    if (at < 0) return best;
    return best < 0 ? at : Math.min(best, at);
  }, -1);
  const propertyWordIndex = normalized.search(
    PROPERTY_WORD_PATTERN,
  );
  const hasRealEstateTransaction = REAL_ESTATE_TRANSACTION_PATTERN.test(normalized);
  const serviceHeadsTheRequest =
    serviceLemmaIndex >= 0 &&
    propertyWordIndex >= 0 &&
    serviceLemmaIndex < propertyWordIndex &&
    !hasRealEstateTransaction;

  for (const [categoryId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = keywords.reduce(
      (total, keyword) => total + keywordScore(normalized, keyword),
      0,
    );

    if (categoryId === "automotive") {
      if (
        AUTOMOTIVE_BRAND_KEYWORDS.some((keyword) =>
          keywordHits(normalized, keyword),
        ) ||
        AUTOMOTIVE_MODEL_KEYWORDS.some((keyword) =>
          keywordHits(normalized, keyword),
        )
      ) {
        score += 4;
      }
    }

    if (categoryId === "furniture") {
      if (
        normalized.includes("masa") &&
        !normalized.includes("masaüstü") &&
        !normalized.includes("masaustu") &&
        !normalized.includes("masaj") &&
        !normalized.includes("kahve seti") &&
        !normalized.includes("yemek takımı") &&
        !normalized.includes("yemek takimi")
      ) {
        score += 2;
      }
      if (normalized.includes("ofis") && hasFurnitureObjectNoun(normalized)) {
        score += 4;
      } else if (normalized.includes("ofis") && normalized.includes("sandalye")) {
        score += 3;
      }
      if (normalized.includes("tekerlekli sandalye")) {
        score = Math.max(0, score - 4);
      }
    }

    if (categoryId === "home-kitchen") {
      if (
        normalized.includes("kahve seti") ||
        normalized.includes("çay seti") ||
        normalized.includes("cay seti") ||
        normalized.includes("tabak") ||
        normalized.includes("yemek takımı") ||
        normalized.includes("yemek takimi")
        /* kahve makinesi / espresso / lattego: kurucu kararıyla appliances
           (2026-08-31); makine takviyesi burada yaşayamaz. */
      ) {
        score += 4;
      }
      if (
        HOME_KITCHEN_BRAND_KEYWORDS.some((keyword) =>
          keywordHits(normalized, keyword),
        )
      ) {
        score += 4;
      }
    }

    if (categoryId === "appliances") {
      if (
        normalized.includes("makine") &&
        (normalized.includes("çamaşır") ||
          normalized.includes("camasir") ||
          normalized.includes("bulaşık") ||
          normalized.includes("bulasik") ||
          normalized.includes("kurutma"))
      ) {
        score += 3;
      }
      if (
        APPLIANCE_BRAND_KEYWORDS.some((keyword) =>
          keywordHits(normalized, keyword),
        ) &&
        !looksLikeTelevisionScreenContext(normalized)
      ) {
        score += 4;
      }
      if (
        normalized.includes("süpürge") ||
        normalized.includes("supurge") ||
        normalized.includes("vacuum")
      ) {
        score += 3;
      }
    }

    if (categoryId === "health" && normalized.includes("tekerlekli sandalye")) {
      score += 4;
    }

    if (categoryId === "baby" && normalized.includes("bebek")) {
      score += 2;
    }

    if (categoryId === "technology") {
      if (
        normalized.includes("telefon") ||
        normalized.includes("iphone") ||
        normalized.includes("ipad") ||
        normalized.includes("macbook") ||
        normalized.includes("airpods") ||
        normalized.includes("laptop") ||
        normalized.includes("notebook")
      ) {
        score += 3;
      }
      if (
        normalized.includes("televizyon") ||
        (/\btv\b/.test(normalized) &&
          !normalized.includes("tv ünitesi") &&
          !normalized.includes("tv unitesi"))
      ) {
        score += 5;
      }
      if (findTechnologyProduct(normalized)) {
        score += 6;
      }
      if (looksLikeTelevisionScreenContext(normalized)) {
        score += 6;
      }
      if (
        /\be-?ticaret\b/.test(normalized) ||
        normalized.includes("web sitesi") ||
        normalized.includes("internet sitesi") ||
        normalized.includes("web hizmet")
      ) {
        score += 6;
      }
    }

    if (categoryId === "real-estate") {
      if (/\b[1-9]\s*\+\s*[0-9]\b/.test(normalized)) {
        score += 3;
      }
      // Short lexicon anchors — enough for TENTATIVE/CONFIDENT gate
      const hasPropertyAnchor =
        /\b(emlak|daire|villa|konut|gayrimenkul|arsa|tarla|imarli|imarlı|rezidans|residans|ofis|dükkan|dukkan|mağaza|magaza|depo|antrepo|fabrika|imalathane|otel|devren|müştemilat|mustemilat|kooperatif|turistik)\b|\bdevre\s+(mülk|mulk)\b/i.test(
          normalized,
        );
      if (hasPropertyAnchor) {
        score += 2;
      }

      /**
       * HİZMET CÜMLESİNDE ODA DESENİ MÜLK TALEBİ DEĞİLDİR (P2-8, 2026-09-23).
       *
       * Ölçüldü (A-Z koşusu): "nakliyat 3+1 ev bursa" → `real-estate`.
       * Kullanıcı taşınmak için nakliyeci arıyor; sistem ona m², kat ve bina
       * yaşı soruyor ve yayın hiç açılmıyor. Aynı cümle "evden eve nakliyat"
       * yazılınca DOĞRU kalıyordu — yani kusur sözcükte değil AĞIRLIKTAYDI:
       * iki emlak anahtar kelimesi ("3+1", "ev") tek hizmet sözcüğünü eziyor.
       *
       * EKSEN. Bir hizmet cümlesinde oda deseni ve konut adı, hizmetin
       * NESNESİDİR: taşınacak, boyanacak, temizlenecek şeyi anlatır. Mülkün
       * KENDİSİ istendiğinde cümlede bir EMLAK İŞLEMİ çıpası bulunur
       * ("satılık", "kiralık", "kiralamak", "satın almak", "emlak").
       *
       * Hizmet sözlüğü burada YENİDEN YAZILMAZ: `SERVICE_LEMMAS` hizmet
       * dilinin tek yetkili yeridir ve oradan okunur. Kural kelimeye özel
       * değildir — sözlüğe yarın eklenen her hizmet sözcüğü de aynı
       * korumayı kazanır.
       */
      if (serviceHeadsTheRequest) {
        // Oda deseni (+3) ve mülk çıpası (+2) bu cümlede aranan şeyi
        // anlatmıyor; ikisi de geri alınır.
        score = Math.max(0, score - 5);
      }

      /**
       * ÖLÇÜ BİRİMİ MÜLK DEĞİLDİR (ölçüldü 2026-09-15).
       *
       * "metrekare" / "m2" emlak anahtar kelimesiydi ve tek başına oy
       * veriyordu. Ölçülen sonuç: "50 metrekare laminat parke" ve
       * "120 metrekare için parke döşeme" EMİN olarak emlağa düşüyordu —
       * yani kart bile çıkmıyordu, parke ustası talebi hiç görmüyordu,
       * emlakçı görüyordu. "80 m2 seramik" kartta tek seçenek olarak
       * emlak gösteriyordu.
       *
       * Metrekare bir NİCELİKTİR. Mülkü niteleyen bir mülk çıpası ya da
       * oda deseni varsa emlak kanıtıdır ("120 metrekare daire",
       * "3+1 140 m2"); tek başına değildir.
       */
      if (!hasPropertyAnchor && !/\b[1-9]\s*\+\s*[0-9]\b/.test(normalized)) {
        const olcuOyu =
          keywordScore(normalized, "metrekare") +
          keywordScore(normalized, "m2") +
          keywordScore(normalized, "m²");
        score = Math.max(0, score - olcuOyu);
      }

      /**
       * "X İÇİN Y" YAPISINDA X BAĞLAMDIR, ARANAN ŞEY Y'DİR
       * (ölçüldü 2026-09-15).
       *
       * "daire için mobilya", "villa bahçesi için çim biçme makinesi",
       * "apartman girişi için kamera sistemi" — üçünde de soldaki yer
       * sözcüğü ürünün NEREDE kullanılacağını söyler. Emlak oyu soldan
       * geliyorsa ve sağda emlak sinyali yoksa, o oy aranan şeyi
       * anlatmıyordur ve sayılmaz.
       *
       * FAİL-CLOSED: sağda da emlak sinyali varsa ("daire için emlak
       * danışmanı") hiçbir şey düşülmez. Metin "için" içermiyorsa kural
       * hiç çalışmaz.
       */
      /**
       * KURAL YALNIZ "için"in SAĞINDA BİR ŞEY VARKEN ÇALIŞIR
       * (daraltıldı 2026-09-15, kod incelemesinde yakalandı).
       *
       * İlk yazım Türkçenin diğer yaygın dizilişini kesiyordu: "kiralık ev
       * lazım ÖĞRENCİ İÇİN" ve "ev arıyorum AİLEM İÇİN" cümlelerinde "için"
       * SONDADIR ve aranan şey SOLDADIR. Kural sol taraftan gelen bütün emlak
       * oyunu düşürüyor, gerçek emlak talebi kategoriden sıfır tedarikçiye
       * gidiyordu (ölçüldü: ikisi de real-estate → services/0).
       *
       * Premis şudur: "X için Y" yapısında aranan şey Y'dir. Y yoksa premis
       * de yoktur. Bu yüzden sağda anlamlı içerik aranır; yoksa kural hiç
       * çalışmaz ve eski davranış aynen korunur.
       */
      const icinMatch = normalized.match(
        /(?:^|[^\p{L}])i[çc]in(?:[^\p{L}]|$)/u,
      );
      const icinAt = icinMatch?.index ?? -1;
      if (icinAt > 0) {
        const sol = normalized.slice(0, icinAt);
        const sag = normalized.slice(icinAt + (icinMatch?.[0].length ?? 0));
        /* Sağda aranan şeyi adlandırabilecek kadar içerik var mı? */
        const sagAnlamli = /[\p{L}]{3}/u.test(sag);
        if (sagAnlamli) {
          const oy = (part: string) =>
            keywords.reduce((total, k) => total + keywordScore(part, k), 0);
          const solOy = oy(sol);
          if (solOy > 0 && oy(sag) === 0) {
            score = Math.max(0, score - solOy);
          }
        }
      }
      /**
       * KB-16: ilan sıfatı emlağa YALNIZ bir emlak nesnesi varken puan verir.
       * "kiralık daire" emlaktır; "kiralık araç", "satılık araç" ve "hasta
       * yatağı … kiralık" değildir. Eski sürümde sıfat tek başına +2 (ve
       * anahtar kelime olarak +2 daha) üretiyor, aracı emlağa taşıyordu.
       */
      if (
        hasPropertyAnchor &&
        (normalized.includes("kiralık") || normalized.includes("satılık"))
      ) {
        score += 2;
      }
      // Paint / renovation service verbs must not look like property search
      if (hasAny(normalized, PAINT_SERVICE_PATTERNS)) {
        score = Math.max(0, score - 6);
      }
      if (
        /\be-?ticaret\b/.test(normalized) ||
        normalized.includes("web sitesi") ||
        normalized.includes("internet sitesi") ||
        normalized.includes("web hizmet")
      ) {
        score = Math.max(0, score - 6);
      }
    }

    if (categoryId === "real-estate" && normalized.includes("ofis")) {
      if (hasFurnitureObjectNoun(normalized)) {
        score = Math.max(0, score - 6);
      } else if (hasRealEstateOfficeSignal(normalized)) {
        score += 4;
      } else if (!hasAny(normalized, PAINT_SERVICE_PATTERNS)) {
        // Bare "ofis" is too weak to claim real estate
        score = Math.max(0, score - 1);
      }
    }

    if (categoryId === "printing") {
      const strongPrintingTerms = [
        "kartvizit",
        "kart vizit",
        "broşür",
        "brosur",
        "flyer",
        "afiş",
        "afis",
        "katalog",
        "etiket",
        "ambalaj",
        "matbaa",
        "baskı",
        "baski",
        "bastır",
        "bastir",
        "davetiye",
        "sticker",
        "kraft kutu",
        "oluklu kutu",
        "kutu",
      ];
      if (strongPrintingTerms.some((term) => normalized.includes(term))) {
        score += 4;
      }
      if (
        normalized.includes("baskı makinesi") ||
        normalized.includes("baski makinesi") ||
        normalized.includes("matbaa makinesi")
      ) {
        score = Math.max(0, score - 3);
      }
    }

    if (categoryId === "machinery") {
      if (
        normalized.includes("baskı makinesi") ||
        normalized.includes("baski makinesi") ||
        normalized.includes("matbaa makinesi") ||
        normalized.includes("paketleme makinesi")
      ) {
        score += 4;
      }
      if (
        MACHINERY_BRAND_KEYWORDS.some((keyword) =>
          keywordHits(normalized, keyword),
        )
      ) {
        score += 5;
      }
      // Household "… makinesi" must not win industrial machinery
      if (hasAny(normalized, HOUSEHOLD_MACHINE_PATTERNS)) {
        score = Math.max(0, score - 6);
      }
    }

    if (categoryId === "services") {
      // Baş addaki hizmet adı, cümlenin ne istediğini söyleyen şeydir.
      if (serviceHeadsTheRequest) {
        score += 3;
      }
      if (hasAny(normalized, PAINT_SERVICE_PATTERNS)) {
        score += 5;
      }
      // Bare "hizmet" alone is weak; require actual service signal
      if (
        score > 0 &&
        score < 2 &&
        !hasAny(normalized, [
          "temizlik",
          "nakliye",
          "nakliyat",
          "danışmanlık",
          "danismanlik",
          ...PAINT_SERVICE_PATTERNS,
        ])
      ) {
        score = Math.max(0, score - 1);
      }
    }

    if (score > winnerScore) {
      runnerUpId = winnerScore > 0 ? winner : runnerUpId;
      runnerUpScore = winnerScore;
      winner = categoryId;
      winnerScore = score;
    } else if (score > runnerUpScore) {
      runnerUpId = categoryId;
      runnerUpScore = score;
    }
  }

  // No keyword signal → do not confidently claim services (historical default).
  if (winnerScore <= 0) {
    /**
     * Çıplak "yedek parça" talebi (başka hiçbir kategori sinyali yokken)
     * tarihsel automotive varsayılanını korur; ifade artık kategori
     * SEÇTİREMEZ ama tek başına yazıldığında talep düşmesin (98+ Faz I).
     */
    if (/yedek\s*par[çc]a/.test(normalized)) {
      return {
        categoryId: "automotive",
        score: 1,
        confident: false,
        runnerUpId: null,
        runnerUpScore: 0,
      };
    }
    return {
      categoryId: "services",
      score: 0,
      confident: false,
      runnerUpId: null,
      runnerUpScore: 0,
    };
  }

  const margin = winnerScore - runnerUpScore;
  const retailFamily = new Set([
    "appliances",
    "home-kitchen",
    "technology",
    "baby",
    "furniture",
  ]);
  const ambiguousRetailTie =
    margin < 2 &&
    retailFamily.has(winner) &&
    runnerUpId != null &&
    retailFamily.has(runnerUpId);

  const confident =
    winnerScore >= CATEGORY_CONFIDENT_MIN_SCORE &&
    !(winner === "services" && winnerScore < 3) &&
    (ambiguousRetailTie ||
      !(margin < 2 && runnerUpScore >= CATEGORY_CONFIDENT_MIN_SCORE));

  return {
    categoryId: winner,
    score: winnerScore,
    confident,
    runnerUpId,
    runnerUpScore,
  };
}

export function detectCategoryId(text: string): string {
  return detectCategoryResult(text).categoryId;
}
