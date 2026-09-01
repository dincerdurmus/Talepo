/**
 * İSTENEN ŞEYİN ROLÜ — tek yetkili tanım (KB-12, 2026-08-24; rol sınıflaması 1G).
 *
 * Bu modül iki soruyu birden yanıtlar ve ikisi de "bağlacın SAĞINDA duran şey
 * nedir?" sorusunun parçasıdır:
 *
 *   1) KONUMSAL rol — istenen şey üst ürünün modeli olamaz
 *      (`isRequestedItemNotModel`, KB-12).
 *   2) SEMANTİK rol — istenen şey bütün bir ürün mü, bir bileşen/aksesuar mı,
 *      yoksa bir hizmet mi (`classifyRequestedTargetRole`, 1G).
 *
 * Kural hem `understand-request.ts` hem `build-state.ts` hem `part-relation.ts`
 * hem de `semantic-subject.ts` tarafından kullanılır; üç yerde birden
 * tanımlanmasın diye tek adres burasıdır. `semantic-subject.ts` doğrudan
 * buradan okur: `understand-request.ts` zaten `semantic-subject.ts`'i içe
 * aktardığı için ters yönde bir içe aktarım döngü yaratırdı.
 *
 * Bu modül YENİ BİR PARALEL SÖZLÜK KURMAZ. Rol sözcük dağarcığının tamamı —
 * parça, aksesuar ve hizmet lemmaları — daha önce `semantic-subject.ts`
 * içinde dağınık duruyordu ve BURAYA TAŞINDI; `semantic-subject.ts` artık
 * onları buradan içe aktarır. Kanonik taksonomi hâlâ üstün yetkidir: sözlük
 * yalnız taksonomide düğümü OLMAYAN baş sözcükler için konuşur.
 */
import {
  isCanonicalWholeProductPhrase,
  listCanonicalPhraseNodeTypes,
} from "@/lib/taxonomy/phrase-classification";

/** Türkçe katlama — rol kuralı için (KB-12). */
export function foldRoleToken(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u");
}

/**
 * İSTENEN ŞEY, ÜST ÜRÜNÜN MODELİ OLAMAZ (KB-12, 2026-08-24).
 *
 * Türkçede uyumluluk bağlacı "için" cümleyi ikiye böler: solunda parçanın ait
 * olduğu ÜST ÜRÜN, sağında İSTENEN ŞEY durur. Model, üst ürünü niteler; bu
 * yüzden yalnızca bağlacın sağında geçen bir jeton model olamaz.
 *
 * Ölçülen hata: "Arçelik bulaşık makinesi için rezistans arıyorum" →
 * `model = "rezistans"`, "Siemens ankastre fırın için termostat lazım" →
 * `model = "termostat"`. Siemens vakasında parça kataloğu "termostat"ı zaten
 * PARÇA olarak tanıyordu; aynı jeton iki rol birden üstleniyordu.
 *
 * Kural kelimeye özel DEĞİL, konumsaldır — yeni parça adları için liste
 * güncellemesi gerektirmez. `isProductTypePhrase` guard'ının kardeşidir:
 * o "bu şey NE" sorusunu, bu "bu şey KİMİN İÇİN" sorusunu korur.
 *
 * Bağlaç yoksa kural uygulanmaz ("Dyson V15 filtresi" → V15 model kalır).
 * Jeton bağlacın solunda da geçiyorsa model olmaya devam eder
 * ("Heidelberg SM 74 için …" → SM 74 solda, korunur).
 */
export function isRequestedItemNotModel(input: string, token: string): boolean {
  const hay = foldRoleToken(String(input ?? ""));
  const needle = foldRoleToken(token).trim();
  if (!hay.trim() || !needle) return false;
  const match = hay.match(/(^|[^a-z0-9])icin([^a-z0-9]|$)/);
  if (!match || match.index == null) return false;
  const before = hay.slice(0, match.index);
  const after = hay.slice(match.index);
  if (after.includes(needle) && !before.includes(needle)) return true;

  /**
   * SENTEZLENMİŞ JETON — ilişkinin İKİ YAKASINI birden kapsayan aday (1B).
   *
   * Kimlik katmanı bitişik olmayan sözcükleri birleştirip aday model
   * üretebiliyor. Ölçülen uydurmalar:
   *   "Bosch kampanya için destek arıyorum" → model = "kampanya destek"
   *   "Bosch acil için servis arıyorum"     → model = "acil servis"
   * İkisi de metinde HİÇ geçmez; "kampanya"/"acil" solda, "destek"/"servis"
   * sağdadır. Bütün olarak arandığında bulunamadıkları için yukarıdaki
   * kontrolden kaçıyorlardı.
   *
   * Model üst ürünü niteler; üst ürün ise bağlacın SOLUNDA durur. Bu yüzden
   * adayın herhangi bir sözcüğü yalnız SAĞDA geçiyorsa aday ilişki sınırını
   * ihlal ediyordur ve model olamaz.
   *
   * Solda da geçen jetonlar korunur: "Heidelberg SM 74 için …" → "sm" ve "74"
   * solda, model bozulmaz.
   */
  const parts = needle.split(/[^a-z0-9]+/).filter(Boolean);
  if (parts.length < 2) return false;
  return parts.some((w) => after.includes(w) && !before.includes(w));
}

/* ------------------------------------------------------------------ *
 *  ROL SÖZCÜK DAĞARCIĞI — `semantic-subject.ts` içinden taşındı (1G)  *
 * ------------------------------------------------------------------ */

/** Component / spare-part lexicon (generic Turkish) */
export const PART_LEMMAS = [
  "tampon",
  "far",
  "ayna",
  "filtre",
  "kapak",
  "motor",
  "pompa",
  "merdane",
  "balata",
  "kart",
  "parça",
  "parca",
  "yedek parça",
  "yedek parca",
  "kablo",
  "adaptör",
  "adaptor",
  "hazne",
  "batarya",
  "akü",
  "aku",
  "mandren",
  "radyatör",
  "radyator",
  "egzoz",
  "disk",
  "kampana",
  "amortisör",
  "amortisor",
  "rot",
  "şanzıman",
  "sanziman",
  "debriyaj",
  "fren",
  "rulman",
  "şarj adaptörü",
  "sarj adaptoru",
  "şarj adaptoru",
  "sarj adaptörü",
] as const;

export const ACCESSORY_LEMMAS = [
  /** 98+ Faz I: "kask" koruyucu aksesuardır — motosiklet kaskı bütün araç
   * sanılıyordu (ölçüldü). */
  "kask",
  "kılıf",
  "kilif",
  "stand",
  "aparat",
  "çanta",
  "canta",
  "aksesuar",
  "uzatma",
  "başlık",
  "baslik",
  "şarj",
  "sarj",
] as const;

export const SERVICE_LEMMAS = [
  "bakım",
  "bakim",
  "onarım",
  "onarim",
  "tamir",
  "boyama",
  "boya",
  "badana",
  "montaj",
  "kurulum",
  "kaplama",
  "servis",
  "revizyon",
  "temizlik",
  /** 98+ Faz I (2026-09-01): "Evden eve nakliye arıyorum" hizmet dilidir;
   * lemma eksik olduğu için kind PRODUCT çıkıyordu (ölçüldü). */
  "nakliye",
  "nakliyat",
  /**
   * Destek, danışmanlık ve hizmet de hizmettir (1G). Taksonomi bunu zaten
   * böyle adlandırıyor: technology/yazilim-gelistirme altında "Bakım /
   * destek sözleşmesi" ve "Yazılım danışmanlığı" SERVICE_TYPE yapraklarıdır.
   * Sözcükler hizmet dilinin tek yetkili yerine eklendi; paralel bir liste
   * kurulmadı.
   */
  "destek",
  "danışmanlık",
  "danismanlik",
  "hizmet",
  /**
   * Hizmetin kendisini ya da hizmeti veren rolü adlandıran sözcükler (1I).
   * "BMW için ekspertiz", "düğün fotoğrafçısı", "özel ders öğretmeni" birer
   * hizmet talebidir; sözcükler müşteri cümlesi değil, hizmet dilinin
   * parçasıdır ve tek yetkili hizmet sözlüğüne eklendi.
   */
  "ekspertiz",
  "entegrasyon",
  "fotoğrafçı",
  "fotografci",
  "öğretmen",
  "ogretmen",
  "ders",
  /**
   * "emlakçı" AYNI SINIFTIR ama ölçülünce eksikti (kapsam kapanışı,
   * 2026-08-25). "Evimi kiraya vermek için emlakçı arıyorum" cümlesinde
   * hedefin rolü UNKNOWN kalıyor, bu yüzden hedef kendi kategorisini
   * üretemiyor ve I45e gereği SOLDAKİ kullanım bağlamının kategorisi
   * (real-estate) ayakta kalıyordu: talep, aracı arayan kişiyi ev satın
   * almak isteyenlerin havuzuna gönderiyor ve ona ilan türü / oda sayısı
   * soruyordu. "emlakçı" bir MÜLK değil, bir hizmet sağlayıcı adıdır.
   */
  /** 98+ Faz I: "muhasebeci" da hizmet sağlayıcı rol adıdır (ölçüldü:
   * "Muhasebeci arıyorum aylık" UNKNOWN kalıyordu). */
  "muhasebeci",
  "tamirci",
  "usta",
  "değişim",
  "degisim",
  "emlakçı",
  "emlakci",
] as const;

/* ------------------------------------------------------------------ *
 *  SEMANTİK ROL — bütün ürün / bileşen / hizmet                       *
 * ------------------------------------------------------------------ */

export type RequestedTargetRole =
  | "WHOLE_PRODUCT"
  | "COMPONENT_OR_ACCESSORY"
  | "SERVICE"
  | "UNKNOWN";

/** Kanonik teknoloji kök kategorisi — taksonomi kök kimliğiyle aynı slug. */
const TECHNOLOGY_DOMAIN = "technology";

export type RequestedTargetRoleVerdict = {
  role: RequestedTargetRole;
  /**
   * Baş sözcüğün adlandırdığı uzmanlık alanı (varsa). Yalnız rol sözlüğünden
   * gelir; taksonomiden çözülen ifadelerde alan kanonik düğümden okunur.
   */
  domain: string | null;
  /** Rolü belirleyen Türkçe baş sözcüğün katlanmış hâli. */
  head: string | null;
  confidence: number;
  provenance:
    | "ROLE_HEAD_VOCABULARY"
    | "TAXONOMY_PHRASE"
    | "TAXONOMY_HEAD"
    | "NONE";
  evidence: string[];
};

/**
 * TAKSONOMİDE DÜĞÜMÜ OLMAYAN BAŞ SÖZCÜKLERİN ROLÜ — küçük, merkezî, tek
 * yetkili sözlük (1G).
 *
 * Ölçüm: `yazılım`, `uygulama`, `sistem`, `modül`, `eklenti`, `tema`,
 * `entegrasyon`, `bağlantı`, `destek`, `kurulum`, `servis` sözcüklerinin
 * HİÇBİRİ 2151 düğümlük kanonik ağaçta bir düğüm değildir. Kanonik veri bu
 * ayrımı bugün yapamıyor; bu yüzden ayrım burada, TEK yerde ve baş sözcük
 * düzeyinde tanımlanır — kategori regex'i başka bir katmana taşınmaz,
 * müşteri cümleleri üretim koduna yazılmaz.
 *
 * `entegrasyon`, `bağlantı`, `paket` gibi rolü gerçekten belirsiz sözcükler
 * KASITLI olarak dışarıdadır: onlar `UNKNOWN` kalır, talep düşmez, yalnız
 * kesinlik iddia edilmez.
 */
const HEAD_ROLE_VOCABULARY: ReadonlyArray<
  readonly [string, RequestedTargetRole, string]
> = [
  // Bütün dijital ürün — "muhasebe yazılımı", "CRM uygulaması", "ERP sistemi".
  ["yazilim", "WHOLE_PRODUCT", TECHNOLOGY_DOMAIN],
  ["uygulama", "WHOLE_PRODUCT", TECHNOLOGY_DOMAIN],
  ["sistem", "WHOLE_PRODUCT", TECHNOLOGY_DOMAIN],
  ["program", "WHOLE_PRODUCT", TECHNOLOGY_DOMAIN],
  ["platform", "WHOLE_PRODUCT", TECHNOLOGY_DOMAIN],
  // Dijital bileşen / eklenti — bütün üründen ayrı roldür.
  ["modul", "COMPONENT_OR_ACCESSORY", TECHNOLOGY_DOMAIN],
  ["eklenti", "COMPONENT_OR_ACCESSORY", TECHNOLOGY_DOMAIN],
  ["tema", "COMPONENT_OR_ACCESSORY", TECHNOLOGY_DOMAIN],
  ["uzanti", "COMPONENT_OR_ACCESSORY", TECHNOLOGY_DOMAIN],
  ["baglayici", "COMPONENT_OR_ACCESSORY", TECHNOLOGY_DOMAIN],
];

/**
 * Bu sözcüklerin ADLANDIRDIĞI uzmanlık alanı (1I).
 *
 * "ERP sistemi" bir yazılım ürünüdür ve kanonik ağaçta düğümü yoktur; alanı
 * anlatan tek şey baş sözcüğün kendisidir. Alan bilgisi bu yüzden rol
 * sözlüğünün YANINDA durur — ikinci bir eşleme tablosu kurulmaz. Slug,
 * kanonik taksonominin kök kategori kimliğidir; sapma olursa invariant
 * gürültülü biçimde kırılır.
 */
const ROLE_VOCABULARY_DOMAIN: ReadonlyMap<string, string> = new Map(
  HEAD_ROLE_VOCABULARY.map(([head, , domain]) => [head, domain] as const),
);

/**
 * SAĞLAYICI ADLARI — rolü kendi üstlerine almazlar.
 *
 * "danışmanlık firması" bir firma değil, bir danışmanlık talebidir; "montaj
 * ustası" bir usta değil, bir montaj talebidir. Bu sözcükler baş konumunda
 * görüldüğünde rol soldaki sözcüğe devredilir.
 */
const PROVIDER_HEADS: ReadonlySet<string> = new Set([
  "firma",
  "sirket",
  "usta",
  "ekip",
  "ajans",
]);

/** İstek kuyruğu ve bağlaçlar — baş sözcük taraması bunlarda durur. */
const TAIL_TOKENS: ReadonlySet<string> = new Set([
  "ariyorum",
  "arıyorum",
  "ariyoruz",
  "lazim",
  "istiyorum",
  "istiyoruz",
  "gerekiyor",
  "gerek",
  "alacagim",
  "alicam",
  /**
   * Satın-alma fiilleri de istek kuyruğudur (2026-08-30): "araba lastiği
   * almak istiyorum" cümlesinde baş isim "almak" değil "lastik"tir. Bunlar
   * eklenmeden geriye tarama fiilde duruyor ve baş isim hiç bulunmuyordu.
   */
  "almak",
  /** 98+ Faz I: aciliyet/selamlama sözleri de istek kuyruğudur — "… acil",
   * "Merhaba, …" baş taramasını ve kanonik ifade adayını bozuyordu. */
  "acil",
  /** 98+ Part IV: periyot sıfatları baş olamaz ve hizmet başlığını bozmaz
   * ("villa temizliği haftalık" ölçüldü). */
  "haftalık",
  "haftalik",
  "aylık",
  "aylik",
  "günlük",
  "gunluk",
  "yıllık",
  "yillik",
  "saatlik",
  "merhaba",
  "selam",
  "bakiyorum",
  "bakıyorum",
  "lütfen",
  "lutfen",
  "satin",
  "yaptirmak",
  "olsun",
  "olmasin",
  "icin",
  "ve",
  "veya",
  "ile",
  "ya",
]);

const ROLE_BY_HEAD: ReadonlyMap<string, RequestedTargetRole> = new Map([
  ...HEAD_ROLE_VOCABULARY.map(([h, r]) => [h, r] as const),
  ...PART_LEMMAS.map(
    (l) => [foldRoleToken(l), "COMPONENT_OR_ACCESSORY"] as const,
  ),
  ...ACCESSORY_LEMMAS.map(
    (l) => [foldRoleToken(l), "COMPONENT_OR_ACCESSORY"] as const,
  ),
  ...SERVICE_LEMMAS.map((l) => [foldRoleToken(l), "SERVICE"] as const),
]);

/**
 * Bir sözcüğün olası kök biçimleri — Türkçe iyelik eki ve ünsüz yumuşaması.
 *
 * "yazılımı→yazılım", "modülü→modül", "eklentisi→eklenti", "desteği→destek",
 * "ayağı→ayak", "danışmanlığı→danışmanlık". Adaylar sırayla denenir ve
 * BİLİNEN ilk biçim kabul edilir; hiçbiri bilinmiyorsa sözcük olduğu gibi
 * kalır, uydurma kök üretilmez.
 */
function headForms(word: string): string[] {
  const w = foldRoleToken(word).replace(/[^a-z0-9]+$/u, "");
  if (!w) return [];
  const out = [w];
  if (/g[iu]$/u.test(w) && w.length > 3) out.push(`${w.slice(0, -2)}k`);
  if (/(?:si|su)$/u.test(w) && w.length > 3) out.push(w.slice(0, -2));
  if (/[iu]$/u.test(w) && w.length > 2) out.push(w.slice(0, -1));
  return out;
}

const NONE: RequestedTargetRoleVerdict = {
  role: "UNKNOWN",
  domain: null,
  head: null,
  confidence: 0,
  provenance: "NONE",
  evidence: [],
};

function roleForNodeTypes(types: readonly string[]): RequestedTargetRole {
  if (!types.length) return "UNKNOWN";
  if (types.includes("SERVICE_TYPE") && !types.some((t) => t !== "SERVICE_TYPE")) {
    return "SERVICE";
  }
  if (types.includes("PART_TYPE") && !types.some((t) => t !== "PART_TYPE")) {
    return "COMPONENT_OR_ACCESSORY";
  }
  return "UNKNOWN";
}

/**
 * İSTENEN ŞEYİN SEMANTİK ROLÜ — tek kanonik sınıflandırıcı (1G).
 *
 * Kanıt sırası ve gerekçesi:
 *
 *   1) TÜRKÇE BAŞ SÖZCÜK. Ad tamlamasında baş SONDADIR: "muhasebe yazılımı"
 *      bir yazılımdır, "e-fatura modülü" bir modüldür, "destek ayağı" bir
 *      ayaktır. Baş sözcüğün rolü bilinmiyorsa karar taksonomiye devredilir.
 *      Sağlayıcı adları ("firma", "usta") baş sayılmaz, rol soluna geçer.
 *   2) İFADENİN TAMAMI kanonik taksonomide. Bütün adaylar değerlendirilir;
 *      bir ifade herhangi bir kategoride bütün ürün adıysa bütün üründür.
 *   3) BAŞ SÖZCÜK kanonik taksonomide.
 *   4) Hiçbiri değilse `UNKNOWN` — bu bir RET DEĞİLDİR. Talep düşmez;
 *      yalnız kesinlik iddia edilmez.
 *
 * Sıra bilerek böyledir: taksonomi "danışmanlık"ı bir SUBCATEGORY olarak
 * tutar ve tek başına sorulursa "bütün ürün" gibi görünür; oysa baş sözcük
 * onu hizmet olarak adlandırır (ölçüldü).
 */
export function classifyRequestedTargetRole(
  phrase: string,
): RequestedTargetRoleVerdict {
  const t = String(phrase ?? "").trim();
  if (!t) return NONE;
  const tokens = t.split(/\s+/u).filter(Boolean);

  // (1) Baş sözcük — sondan başa, sağlayıcı adlarını atlayarak. Taramanın
  // DURDUĞU sözcük ifadenin başıdır ve (3) numaralı taksonomi denetimi de
  // aynı sözcüğü kullanır; cümledeki literal son sözcük (çoğu zaman istek
  // fiili) değil. Ölçüldü (2026-08-30): "araba lastiği arıyorum" cümlesinde
  // (3) "arıyorum"u deniyor ve taksonomiye baş isim hiç sorulmadan NONE
  // dönüyordu; aynı ifade fiilsiz verilince TAXONOMY_HEAD buluyordu.
  let headToken: string | null = null;
  for (let i = tokens.length - 1; i >= 0; i--) {
    /**
     * SAYI/SPEC JETONU BAŞ OLAMAZ (98+ Faz I, 2026-09-01). Türkçe ad
     * tamlamasının başı bir SÖZCÜKTÜR; "205/55", "R16", "12000" gibi rakam
     * içeren ölçü/spec jetonları başı gizler. Ölçüldü: "Araba lastiği
     * arıyorum 205/55 R16" cümlesinde baş taraması "R16"da durup NONE
     * dönüyor, gerçek baş "lastik" taksonomiye hiç sorulmadan NONE dönüyordu.
     * Kural kelimeye özel DEĞİLDİR: rakam içeren jeton atlanır, karar bir
     * sonraki gerçek sözcüğe kalır.
     */
    if (/\d/.test(tokens[i] ?? "")) continue;
    /** Sayıyı izleyen kısa birim jetonu ("100 kVA") da baş olamaz (98+
     *  Faz I): tarama birimde durup gerçek başı gizliyordu (ölçüldü,
     *  "Jeneratör arıyorum 100 kVA"). */
    if ((tokens[i] ?? "").length <= 4 && /\d/.test(tokens[i - 1] ?? "")) {
      continue;
    }
    /**
     * FİİL KUYRUĞU EKİ (98+ Faz I, 2026-09-01): "aryorum" (typo), "arıyom"
     * (konuşma) TAIL_TOKENS'ta yoktur ama yapıca istek fiilidir; baş
     * sayılırsa gerçek baş isim taksonomiye hiç sorulmuyor ve araç/ürün
     * çöküşü doğuyordu (ölçüldü: "Araba lastği aryorum" → VEHICLE).
     * ≥6 harfli, yorum/iyom ekiyle biten jeton baş olamaz.
     */
    if (
      (tokens[i] ?? "").length >= 6 &&
      /(?:yorum|iyom)$/u.test(foldRoleToken(tokens[i] ?? ""))
    ) {
      continue;
    }
    /**
     * EDAT NESNESİ BAŞ OLAMAZ (98+ Part IV, 2026-09-01). "için"in hemen
     * solundaki jeton edatın nesnesidir — kullanım bağlamı, istenen şey
     * değil. Ölçüldü: "Klima arıyorum salon için" cümlesinde baş "salon"
     * seçilip ürün kanalına iniyordu; gerçek baş "klima"dır. Kural
     * konumsaldır, kelimeye özel değildir.
     */
    {
      const nextFold = foldRoleToken((tokens[i + 1] ?? "").replace(/[^\p{L}\p{N}]+/gu, ""));
      if (nextFold === "için" || nextFold === "icin") continue;
    }
    const forms = headForms(tokens[i] ?? "");
    if (!forms.length) continue;
    if (forms.some((f) => TAIL_TOKENS.has(f))) continue;
    if (forms.some((f) => PROVIDER_HEADS.has(f))) continue;
    for (const f of forms) {
      const role = ROLE_BY_HEAD.get(f);
      if (role) {
        return {
          role,
          domain: ROLE_VOCABULARY_DOMAIN.get(f) ?? null,
          head: f,
          confidence: 0.8,
          provenance: "ROLE_HEAD_VOCABULARY",
          evidence: [tokens[i] ?? f],
        };
      }
    }
    // Baş sözcük bulundu ama rolü sözlükte yok — karar taksonomiye kalır.
    headToken = tokens[i] ?? null;
    break;
  }

  // (2) İfadenin tamamı kanonik taksonomide — istek kuyruğu SOYULARAK da
  // denenir. "360 kamera almak istiyorum" cümlesinde kanonik ifade "360
  // kamera"dır; kuyruk fiilleri taksonomi araması yapılmadan önce atılmazsa
  // çok sözcüklü kanonik adlar hiç bulunamıyordu (ölçüldü 2026-08-30).
  let coreEnd = tokens.length;
  while (coreEnd > 0) {
    /**
     * Kuyruktaki rakamlı ölçü/spec jetonları da soyulur (98+ Faz I):
     * "araba lastiği arıyorum 205/55 R16" için kanonik aday "araba
     * lastiği"dir. Tam ifade adayı (t) zaten rakamlı hâliyle deneniyor;
     * burada yalnız EK aday üretilir, bilgi kaybolmaz.
     */
    if (/\d/.test(tokens[coreEnd - 1] ?? "")) {
      coreEnd--;
      continue;
    }
    if (
      (tokens[coreEnd - 1] ?? "").length <= 4 &&
      /\d/.test(tokens[coreEnd - 2] ?? "")
    ) {
      // Sayıyı izleyen kısa birim jetonu ("100 kVA") kuyruktan soyulur.
      coreEnd--;
      continue;
    }
    if (
      (tokens[coreEnd - 1] ?? "").length >= 6 &&
      /(?:yorum|iyom)$/u.test(foldRoleToken(tokens[coreEnd - 1] ?? ""))
    ) {
      coreEnd--;
      continue;
    }
    {
      // Edat nesnesi kuyruktan da soyulur ("… salon için" → "salon" düşer).
      const nextFold = foldRoleToken((tokens[coreEnd] ?? "").replace(/[^\p{L}\p{N}]+/gu, ""));
      if (nextFold === "için" || nextFold === "icin") {
        coreEnd--;
        continue;
      }
    }
    const forms = headForms(tokens[coreEnd - 1] ?? "");
    if (forms.length && forms.some((f) => TAIL_TOKENS.has(f))) {
      coreEnd--;
      continue;
    }
    break;
  }
  const corePhrase =
    coreEnd > 0 && coreEnd < tokens.length
      ? tokens.slice(0, coreEnd).join(" ")
      : null;
  /**
   * SON YAN CÜMLE DE ADAYDIR (98+ Faz I, 2026-09-01): "Merhaba, logo
   * tasarımı arıyorum" cümlesinde kanonik ifade son yan cümlededir;
   * selamlama öbeği bütün-ifade adayını bozuyor ve rol UNKNOWN kalıyordu
   * (ölçüldü).
   */
  const lastClause = (() => {
    const parts = t.split(/[,;:!?]/).map((x) => x.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    const last = parts[parts.length - 1]!;
    const lt = last.split(/\s+/u).filter(Boolean);
    let end = lt.length;
    while (end > 0) {
      const w = lt[end - 1] ?? "";
      const forms = headForms(w);
      if (/\d/.test(w) || (forms.length && forms.some((f) => TAIL_TOKENS.has(f)))) {
        end--;
        continue;
      }
      if (w.length >= 6 && /(?:yorum|iyom)$/u.test(foldRoleToken(w))) { end--; continue; }
      break;
    }
    const core = end > 0 ? lt.slice(0, end).join(" ") : null;
    return core && core !== t ? core : null;
  })();
  const adaylar = [t, ...(corePhrase ? [corePhrase] : []), ...(lastClause ? [lastClause] : [])];
  for (const aday of adaylar) {

    if (isCanonicalWholeProductPhrase(aday)) {
      return {
        role: "WHOLE_PRODUCT",
        domain: null,
        head: null,
        confidence: 0.9,
        provenance: "TAXONOMY_PHRASE",
        evidence: [aday],
      };
    }
    const phraseRole = roleForNodeTypes(listCanonicalPhraseNodeTypes(aday));
    if (phraseRole !== "UNKNOWN") {
      return {
        role: phraseRole,
        domain: null,
        head: null,
        confidence: 0.85,
        provenance: "TAXONOMY_PHRASE",
        evidence: [aday],
      };
    }
  }

  // (3) Baş sözcük kanonik taksonomide — (1)'in bulduğu baş kullanılır.
  const last = headToken;
  if (last && tokens.length > 1) {
    for (const f of headForms(last)) {
      if (isCanonicalWholeProductPhrase(f)) {
        return {
          role: "WHOLE_PRODUCT",
          domain: null,
          head: f,
          confidence: 0.7,
          provenance: "TAXONOMY_HEAD",
          evidence: [last],
        };
      }
      const role = roleForNodeTypes(listCanonicalPhraseNodeTypes(f));
      if (role !== "UNKNOWN") {
        return {
          role,
          domain: null,
          head: f,
          confidence: 0.7,
          provenance: "TAXONOMY_HEAD",
          evidence: [last],
        };
      }
    }
  }

  return NONE;
}

/**
 * HİZMET LEMMASI GERÇEKTEN BAŞ MI? (1G)
 *
 * Türkçe ad tamlamasında baş sondadır; hizmet adı bir NİTELEYİCİ olarak da
 * geçebilir. Ölçülen hata: "destek ayağı arıyorum" ve "koltuk destek
 * mekanizması arıyorum" yalnız `destek` lemması eşleştiği için SERVICE
 * oluyordu. Bir hizmet sözcüğünün ardından başka bir ad geliyorsa hizmet o
 * adın niteleyicisidir, talebin kendisi değildir.
 *
 * Ardından gelen sözcük istek kuyruğu, bağlaç, sağlayıcı adı ya da yine bir
 * hizmet adıysa ("bakım desteği", "kurulum hizmeti") lemma baş sayılır.
 */
export function serviceLemmaIsPhraseHead(
  text: string,
  hitIndex: number,
  hitRaw: string,
): boolean {
  const rest = String(text ?? "").slice(hitIndex + hitRaw.length);
  const next = rest.match(/[\p{L}\p{N}][\p{L}\p{N}-]*/u);
  if (!next || next.index == null) return true;
  /**
   * Noktalama ad tamlamasını KAPATIR. "Ev için klima servisi, İstanbul
   * Kadıköy" cümlesinde virgülden sonrası ayrı bir öbektir; "İstanbul"
   * hizmetin başı değildir. Noktalama görülürse lemma baş sayılır.
   */
  if (/[,;:.!?()/\n]/u.test(rest.slice(0, next.index))) return true;
  const forms = headForms(next[0]);
  if (!forms.length) return true;
  if (forms.some((f) => TAIL_TOKENS.has(f) || PROVIDER_HEADS.has(f))) return true;
  return forms.some((f) => ROLE_BY_HEAD.get(f) === "SERVICE");
}
