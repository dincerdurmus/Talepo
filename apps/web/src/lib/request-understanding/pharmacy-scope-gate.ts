/**
 * İLAÇ / ECZANE KAPSAM KAPISI — YAPISAL OKUMA (D-0028'in ikinci sürümü).
 *
 * NEDEN AYRI BİR MODÜL. Karar önce `understand-request.ts` içinde iki regex'ti:
 * "ilaç adı var mı" ve "kap sözcüğü var mı". İkincisi metnin HERHANGİ bir
 * yerinde geçen bir sözcüğe bakıyordu, yani "2 kutu ağrı kesici" cümlesinde
 * ÖLÇÜ BİRİMİ olan "kutu"yu "ilaç kutusu" sanıp kapıyı açıyordu (ölçüldü,
 * 2026-09-23 A-Z koşusu, P0-1: 15 ilaç vakasının 10'u DEMAND, 5'i yayına
 * açıktı). Aynı delik "1 şişe öksürük şurubu", "ağrı kesici stok" ve
 * "etiketli antibiyotik" için de açıktı.
 *
 * EKSEN SÖZCÜK VARLIĞI DEĞİL, İSTENEN BAŞ ADDIR. Türkçede bunu belirleyen
 * yapı bellidir:
 *
 *   - `<ilaç adı> <kap adı>+iyelik`  → istenen şey KAP     ("ilaç kutusu")
 *   - `<ilaç adı> için <kap adı>`    → istenen şey KAP     ("ilaç için kutu")
 *   - `<sayı> <birim> <ilaç adı>`    → istenen şey İLAÇ    ("2 kutu ağrı kesici")
 *   - `<ilaç adı> <sayı> <birim>`    → istenen şey İLAÇ    ("ağrı kesici 2 kutu")
 *   - `<birim> <ilaç adı>`           → istenen şey İLAÇ    ("kutu ilaç")
 *
 * BELİRSİZLİKTE KAPALI KALINIR. İlaç sinyali ile kap sözcüğü bir arada ama
 * yapı yukarıdakilerin hiçbirine oturmuyorsa ("ağrı kesici kutu") karar
 * DEMAND değildir: netleştirme gerekir. Bu modül o üçüncü sonucu adıyla
 * döndürür; ne yapılacağına (engelle / incelemeye al) çağıran karar verir.
 *
 * SAF MODÜL. Dosya okumaz, ağa çıkmaz, `understandRequest`'in çıkarımlarını
 * görmez: yalnız tr-katlanmış ham metni okur. Kapsam kararının özne/kategori
 * çıkarımından ÖNCE ve ondan BAĞIMSIZ verilmesi bunun içindir — kategori
 * motoru bir ilaç metnini "printing"e taşıyabiliyordu, artık karar ona hiç
 * bağlı değil.
 */

import { withinOneEdit } from "@/lib/text/within-one-edit";

import titckNames from "../../../../../data/medicine-names/titck-skrs-v1.json";

/**
 * TİTCK MARKA / ETKEN MADDE SÖZLÜĞÜ.
 *
 * Kaynak ve provenance `data/medicine-names/titck-skrs-v1.json` içindedir
 * (SKRS e-reçete listesi, indirme tarihi ve dosya SHA-256'sı ile). Liste elle
 * yazılmaz; üreticisi `scripts/build-titck-medicine-names-v1.ts`.
 *
 * İKİ KOVA, İKİ FARKLI YETKİ. Günlük bir sözcükle çakışmayan marka ("parol",
 * "augmentin") ilaç sinyalidir. Günlük sözcükle çakışan marka ("aptamil" —
 * Talepo'nun `baby` kategorisinde meşru bir ürün, "serum", "smart") ASLA
 * blok üretemez; en fazla netleştirme üretir. Çakışma listesi ölçülmüştür ve
 * evreniyle birlikte veri dosyasında yazılıdır.
 */
const BLOCKING_BRANDS: ReadonlySet<string> = new Set(titckNames.blockingBrands);
const COLLIDING_BRANDS: ReadonlySet<string> = new Set(titckNames.collidingBrands);
const SUBSTANCES: ReadonlySet<string> = new Set(titckNames.substances);

/** Metni sözcüklere ayırır — sözlük araması yalnız TAM sözcükle yapılır. */
function tokens(foldedText: string): string[] {
  return foldedText.split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Metin katlaması BU MODÜLDE TANIMLANMAZ. `tr-fold.ts` zaten Talepo'nun tek
 * yetkili tr-katlamasıdır (kategori kapısı da onu okur); ikinci bir tanım
 * yazmak iki otorite yaratırdı. Buradaki kalıplar bu yüzden yalnız ASCII
 * yazılır: `ı` değil `i`, `ş` değil `s`.
 */

/** Kapının üç sonucu + "bu metin ilaçla ilgili değil". */
export type PharmacyReadingKind =
  | "NOT_PHARMACY"
  | "MEDICINE_ITSELF"
  | "CONTAINER_OR_DEVICE"
  | "AMBIGUOUS";

export type PharmacyReading = {
  kind: PharmacyReadingKind;
  /** Kararın dayandığı sinyaller — admin kuyruğunda "neden" olarak görünür. */
  evidence: string[];
};

/**
 * İLAÇ ADI (baş ad adayları).
 *
 * ÜNSÜZ YUMUŞAMASI (2026-09-21'de kapı kırmızısından öğrenildi): p/ç/t/k ekten
 * önce b/c/d/g olur — "şurup" → "şurub-u", "antibiyotik" → "antibiyoti-ği".
 * Yumuşayabilen kökler iki harfli sınıfla yazılır; yumuşamayanlar olduğu gibi
 * kalır, çünkü gereksiz sınıf yanlış eşleşme üretir.
 *
 * "İLAÇLAMA" BİR HİZMETTİR, İLAÇ DEĞİLDİR (2026-09-25). `ilac[a-z]*` kalıbı
 * sözcüğün bütün türevlerini yutuyordu; Türkçede `-lama` eki bir EYLEM adı
 * üretir. Ölçüldü (`qa/open-set` B kümesi): "Haşere ilaçlama hizmeti arıyorum,
 * 200 metrekare" — tamamen meşru bir hizmet talebi — `UNSUPPORTED_PHARMACY`
 * ile ENGELLENİYORDU. Bu D-0028'in gevşetilmesi değil, kapsamının doğru
 * çizilmesidir: kapsam dışı olan şey ilacın KENDİSİDİR, ondan türeyen bir
 * hizmet adı değil. Aynı ayrım `boya`/`boyama` için de yapıldı; eksen tek:
 * ürün adı ile eylem adı ayrı şeylerdir. Ekli biçimler ("ilacı", "ilaçları")
 * eskisi gibi eşleşir — yalnız `-lam`/`-lat` bacakları dışarıda kalır.
 */
const MEDICINE_NOUN =
  /(?:^|[^a-z0-9])(agri\s*kesici[a-z]*|ates\s*dusurucu[a-z]*|antibiyoti[kg][a-z]*|antidepresan[a-z]*|antihistamin[a-z]*|ilac(?!lam|lat)[a-z]*|hap[a-z]*|suru[pb][a-z]*|merhem[a-z]*|poma[td][a-z]*|aspirin[a-z]*|parasetamol[a-z]*|ibuprofen[a-z]*|recete[a-z]*|vitamin\s*hap[a-z]*)(?:[^a-z0-9]|$)/;

/**
 * DOZAJ SİNYALLERİ İKİ KATMANDIR — VE BU AYRIM ÖLÇÜMLE GELDİ.
 *
 * İlk yazımda "kapsül, ampul, draje, fitil, blister" tek başına ilaç sayılmıştı.
 * Kapı hemen kırmızı verdi: `nespresso kahve makinesi kapsüllü` (I8) artık
 * kategorisiz kalıyordu. Türkçede bu sözcüklerin ÇOĞU tıbbi değildir — "ampul"
 * en sık ampuldür, "kapsül" kahve kapsülüdür, "fitil" mumdur, "blister"
 * ambalajdır. Sözcüğün varlığı eczane demek değildir; eksen yine BAĞLAMDIR.
 *
 * KATMAN A — kendi başına yeter. Bir kap ya da kahve makinesi talebinde
 * "500 mg", "reçeteli" ya da "etken madde" yazılmaz.
 *
 * "kutu ilaç" burada BİLEREK YOK. Katman A'ya konulduğunda "2 kutu ilaç
 * kutusu arıyorum" cümlesi hem güçlü sinyal hem kap başı taşıyor görünüp
 * netleştirmeye düşüyordu; oysa istenen şey açıkça kutudur. Aynı ifadeyi
 * ölçü birimi okuması (`UNIT_THEN_MEDICINE`) zaten ilaç sayar.
 */
const STRONG_DOSAGE_SIGNAL =
  /(?:^|[^a-z0-9])(?:\d+\s*(?:mg|mcg|iu)|receteli|recetesiz|etken\s*madde[a-z]*|efervesan[a-z]*)(?:[^a-z0-9]|$)/;

/**
 * KATMAN B — farmasötik biçim sözcükleri ve iki anlamlı biçimler.
 *
 * Sayıyla birlikte gelen biçim ("2 tablet", "30 kapsül") ilaç okumasına çok
 * daha yakındır ama yine tek başına karar vermez; eczane bağlamı gerekir.
 * Karar vermedikleri için bunlar BLOK değil ŞÜPHE üretir.
 */
const DOSAGE_FORM_WORD =
  /(?:^|[^a-z0-9])(?:\d+\s*(?:tablet|kapsul|ampul|draje|fitil|blister)|kapsul[a-z]*|ampul[a-z]*|draje[a-z]*|fitil[a-z]*|blister[a-z]*|krem[a-z]*|sprey[a-z]*|damla[a-z]*|tablet[a-z]*)(?:[^a-z0-9]|$)/;

/**
 * Eczane bağlamı: biçim sözcüğünü şüpheli hâle getiren çevre.
 *
 * `mg`/`ml` bilerek YOK: "250 ml" bir şişe hacmidir ve kahve makinesi
 * talebinde de geçer. Dozaj birimi Katman A'da zaten sayıyla birlikte aranır.
 */
const PHARMACY_CONTEXT =
  /(?:^|[^a-z0-9])(eczane[a-z]*|eczaci[a-z]*|recete[a-z]*|ilac[a-z]*|etken\s*madde[a-z]*)(?:[^a-z0-9]|$)/;

/**
 * KAP / CİHAZ BAŞ ADI — YALNIZ İYELİKLİ BİÇİM.
 *
 * Türkçede belirtisiz isim tamlamasının ikinci ögesi iyelik eki alır:
 * "ilaç kutu-su", "ilaç dolab-ı", "şurup şişe-si". İyelik eki burada YAPISAL
 * KANITTIR — ölçü birimi okumasında ("2 kutu ağrı kesici") o ek yoktur.
 * Bu yüzden liste iyelikli yazımları sayar, eksiz kökleri değil.
 *
 * Metin `foldTr` ile katlandığı için hepsi ASCII yazılır.
 */
const CONTAINER_HEAD_FORMS = [
  "kutusu",
  "kutulari",
  "kutusunu",
  "dolabi",
  "kabi",
  "sisesi",
  "cantasi",
  "sepeti",
  "muhafazasi",
  "rafi",
  "raflari",
  "cihazi",
  "cihazlari",
  "aleti",
  "makinesi",
  "otomati",
  "yazilimi",
  "programi",
  "uygulamasi",
  "etiketi",
  "organizeri",
  "tasiyicisi",
  "ambalaji",
  "kavanozu",
  "seti",
  "kiti",
  "sehpasi",
  "dispenseri",
  "kasasi",
  "standi",
  "tepsisi",
];

/**
 * Ek kuyruğu SINIRLIDIR, serbest harf dizisi değil.
 *
 * Önce `[a-z]*` yazılmıştı; metamorfik kapı bunu hemen yakaladı: "etiketli"
 * sözcüğünde tek harflik bir yazım hatası "etiketil" üretince kalıp eşleşti ve
 * "Etiketil antibiyotik arıyorum" kapsam içine düştü. İyelikli biçimin
 * ardından yalnız Türkçe durum ekleri gelebilir.
 */
const CASE_SUFFIX = "(?:n|ni|nin|nin|ne|na|nda|nde|ndan|nden|yle|yla|dir|dur|i|e|a|de|da|den|dan)?";

const CONTAINER_HEAD = new RegExp(
  `(?:^|[^a-z0-9])(?:${CONTAINER_HEAD_FORMS.join("|")})${CASE_SUFFIX}(?:[^a-z0-9]|$)`,
);

/**
 * "<ilaç> İÇİN <kap>" — iyelik eki olmadan da baş adı kap yapan tek yapı.
 * Araya en çok iki sözcük girebilir ("ilaç için küçük kutu").
 */
const FOR_CONTAINER =
  /(?:^|[^a-z0-9])(?:ilac[a-z]*|hap[a-z]*|suru[pb][a-z]*|recete[a-z]*|vitamin[a-z]*)\s+icin(?:\s+[a-z0-9]+){0,2}\s+(?:kutu|dolap|kap|sise|canta|sepet|raf|organizer|kasa|tepsi|ambalaj|kavanoz|muhafaza|sehpa|stant|dispenser)(?:[^a-z0-9]|$)/;

/** Eksiz kap/birim kökleri — ölçü birimi okuması için gerekli. */
const UNIT_WORD_SOURCE =
  "adet|kutu|sise|tup|paket|koli|duzine|kavanoz|sandik|cuval|rulo|torba|poset|bidon|kasa";

/** Sayı: rakam ya da Türkçe sayı sözcüğü. */
const NUMBER_WORD_SOURCE =
  "\\d+|bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on|yirmi|otuz|kirk|elli|altmis|yetmis|seksen|doksan|yuz|bin|birkac|birer";

/** "<sayı> <birim>" — "2 kutu", "üç şişe", "birkaç paket". */
const NUMBER_PLUS_UNIT = new RegExp(
  `(?:^|[^a-z0-9])(?:${NUMBER_WORD_SOURCE})\\s+(?:${UNIT_WORD_SOURCE})(?:[^a-z0-9]|$)`,
);

/** "<birim> <ilaç>" — sayısız da olsa ilaç okumasıdır ("kutu ilaç"). */
const UNIT_THEN_MEDICINE = new RegExp(
  `(?:^|[^a-z0-9])(?:${UNIT_WORD_SOURCE})\\s+(?:agri\\s*kesici|ates\\s*dusurucu|antibiyoti[kg]|ilac|hap|suru[pb]|merhem|poma[td]|aspirin|parasetamol|ibuprofen|vitamin)[a-z]*(?:[^a-z0-9]|$)`,
);

/** Eksiz kap/cihaz kökü metinde var mı — belirsizlik ölçmek için. */
const BARE_CONTAINER_WORD = new RegExp(
  `(?:^|[^a-z0-9])(?:${UNIT_WORD_SOURCE}|dolap|muhafaza|raf|organizer|cihaz|alet|makine|otomat|yazilim|program|uygulama|etiket|tasiyici|ambalaj|sehpa|stant|dispenser|tepsi|canta|sepet|kap|kit|set)(?:[^a-z0-9]|$)`,
);

/**
 * YAZIM HATASI EKSENİ — YAKLAŞIK EŞLEŞME, AMA YALNIZ ŞÜPHE ÜRETİR.
 *
 * Metamorfik kapı ölçtü (2026-09-23): tek harflik bir hata ilaç adını yok
 * ediyordu — "ağrı kesiai arıyorum" DEMAND oluyordu. Kullanıcılar tam da böyle
 * yazar, bu yüzden kapı yazım hatasına kör olamaz.
 *
 * AMA YAKLAŞIK EŞLEŞME ASLA ENGELLEMEZ. Bir harf oynayınca "eğri kesici" de
 * "ağrı kesici"ye benzer; benzerlik üstüne mevzuata tabi bir engel kurmak
 * yanlış olur. Bu yüzden yaklaşık eşleşme yalnız NETLEŞTİRME üretir: talep
 * yayına girmez, kullanıcıya ne aradığı sorulur. Kesin eşleşme engeller,
 * benzerlik sorar.
 *
 * SÖZLÜK DAR TUTULUR. Yalnız günlük Türkçede karşılığı olmayan ilaç adları
 * girer. "ilaç" ve "hap" bilerek YOKTUR: "ilaç"ın bir harflik komşusu "ilan",
 * "hap"ınki "hac"tır ve ikisi de sık kullanılan sözcüklerdir.
 */
const NEAR_MISS_SINGLE = [
  "surup",
  "surubu",
  "merhem",
  "pomat",
  "aspirin",
  "parasetamol",
  "ibuprofen",
  "antibiyotik",
  "antidepresan",
  "antihistaminik",
  "recete",
  "receteli",
  "recetesiz",
  "vitamin",
];

/** İki sözcüklü ilaç adları: her iki sözcük de ayrı ayrı yaklaşık eşleşmeli. */
const NEAR_MISS_PHRASE: Array<[string, string]> = [
  ["agri", "kesici"],
  ["ates", "dusurucu"],
];

/**
 * DIŞA AÇIK: aynı yaklaşık eşleşme ölçütü kapsam FİİLLERİ (`intent-signals`,
 * `understand-request`) ve taksonomi alias çözücüsü için de gerekiyor. Ölçüt
 * kopyalanmadı; tek tanım `@/lib/text/within-one-edit` dosyasına taşındı ve
 * buradan yeniden dışa açılır — bu modülün eski çağıranları değişmez.
 */
export { withinOneEdit };

/**
 * Kap/cihaz BAŞ ADINA bir harf uzaklıkta bir sözcük var mı?
 *
 * Simetrinin gereği: yazım hatası ilaç adını bozabiliyorsa kap adını da
 * bozar. "Hap kutsuu arıyorum" cümlesinde istenen şey hâlâ kutudur; tek
 * harflik bir hata yüzünden mevzuata tabi bir ENGEL kurmak, düzeltilmek
 * istenen kusurun aynadaki hâli olurdu. Bu yüzden bozuk kap adı da
 * netleştirmeye düşer, engele değil.
 */
/**
 * Yaklaşık eşleşme sözlüğü, kesin eşleşme sözlüğünden DARDIR.
 *
 * "etiketi" bir harf uzağında "etiketli" sıfatını taşıyor; onu yaklaşık
 * sayınca "Etiketli antibiyotik arıyorum" engelden netleştirmeye düştü ve
 * mutasyon kontrolü bunu anında kırmızı verdi. Günlük bir sözcüğe bir harf
 * uzaklıktaki biçim, yaklaşık eşleşmeye giremez.
 */
const NEAR_MISS_CONTAINER_FORMS = CONTAINER_HEAD_FORMS.filter(
  (form) => form.length >= 6 && form !== "etiketi",
);

function hasNearMissContainerHead(words: string[]): boolean {
  for (const w of words) {
    if (w.length < 5) continue;
    for (const form of NEAR_MISS_CONTAINER_FORMS) {
      if (w !== form && withinOneEdit(w, form)) return true;
    }
  }
  return false;
}

/** Metinde ilaç adına BİR HARF uzaklıkta bir sözcük var mı? */
function hasNearMissMedicineName(words: string[]): boolean {
  for (const w of words) {
    if (w.length < 5) continue;
    for (const root of NEAR_MISS_SINGLE) {
      if (w !== root && withinOneEdit(w, root)) return true;
    }
  }
  for (let i = 0; i < words.length - 1; i += 1) {
    for (const [a, b] of NEAR_MISS_PHRASE) {
      const exact = words[i] === a && words[i + 1] === b;
      if (exact) continue;
      if (withinOneEdit(words[i], a) && withinOneEdit(words[i + 1], b)) return true;
    }
  }
  return false;
}

/**
 * Metni oku ve ilaç ekseninde ne istendiğini söyle.
 *
 * Sıra kanıt gücüne göredir; kelime sırasına göre değil:
 *  1. İlaç adı yoksa bu kapının söyleyeceği bir şey yoktur.
 *  2. Kap baş adı + güçlü dozaj birlikteyse yapı çözülmemiştir (şüpheli).
 *  3. Kap baş adı ("kutusu", "için kutu") → kap istenmiştir.
 *  4. Ölçü birimi okuması ya da hiç kap sözcüğü yok → ilacın kendisi.
 *  5. Kalan her şey şüphelidir; DEMAND'e düşmez.
 */
export function readPharmacyScope(foldedText: string): PharmacyReading {
  const words = tokens(foldedText);
  const hasBlockingBrand = words.some((w) => BLOCKING_BRANDS.has(w) || SUBSTANCES.has(w));
  const hasCollidingBrand = words.some((w) => COLLIDING_BRANDS.has(w));
  const hasMedicineNoun = MEDICINE_NOUN.test(foldedText) || hasBlockingBrand;
  const hasStrongDosage = STRONG_DOSAGE_SIGNAL.test(foldedText);
  const hasDosageForm = DOSAGE_FORM_WORD.test(foldedText);
  const hasPharmacyContext = PHARMACY_CONTEXT.test(foldedText);

  if (!hasMedicineNoun && !hasStrongDosage) {
    // Günlük sözcükle çakışan marka tek başına ENGELLEMEZ; yalnız şüphe
    // üretir ve o da ancak eczane bağlamı varsa.
    if (hasCollidingBrand && hasPharmacyContext) {
      return { kind: "AMBIGUOUS", evidence: ["colliding-brand-name", "pharmacy-context"] };
    }
    // İki anlamlı biçim sözcüğü + eczane bağlamı: ilaç adı yok ama "eczane
    // için krem" gibi bir cümle de tek başına DEMAND diye geçirilmez.
    if (hasDosageForm && hasPharmacyContext) {
      return { kind: "AMBIGUOUS", evidence: ["dosage-form-word", "pharmacy-context"] };
    }
    // Yazım hatası ekseni: benzerlik engellemez, yalnız sorar.
    if (hasNearMissMedicineName(words)) {
      return { kind: "AMBIGUOUS", evidence: ["near-miss-medicine-name"] };
    }
    return { kind: "NOT_PHARMACY", evidence: [] };
  }

  const containerHead = CONTAINER_HEAD.test(foldedText) || FOR_CONTAINER.test(foldedText);

  if (containerHead && hasStrongDosage) {
    return {
      kind: "AMBIGUOUS",
      evidence: ["container-head-noun", "strong-dosage-signal"],
    };
  }

  if (containerHead) {
    return { kind: "CONTAINER_OR_DEVICE", evidence: ["container-head-noun"] };
  }

  if (hasStrongDosage) {
    return { kind: "MEDICINE_ITSELF", evidence: ["strong-dosage-signal"] };
  }

  const unitReading = NUMBER_PLUS_UNIT.test(foldedText) || UNIT_THEN_MEDICINE.test(foldedText);
  if (unitReading) {
    return { kind: "MEDICINE_ITSELF", evidence: ["measure-unit-reading"] };
  }

  // Bozuk yazılmış kap başı: engelleme, sor.
  if (hasNearMissContainerHead(words)) {
    return { kind: "AMBIGUOUS", evidence: ["near-miss-container-head"] };
  }

  if (!BARE_CONTAINER_WORD.test(foldedText)) {
    return {
      kind: "MEDICINE_ITSELF",
      evidence: hasBlockingBrand
        ? ["titck-brand-or-substance", "no-container-word"]
        : ["medicine-noun-without-container"],
    };
  }

  return {
    kind: "AMBIGUOUS",
    evidence: ["medicine-noun", "container-word-without-structure"],
  };
}

/**
 * KALDIRILMIŞ KAPSAM: TIBBİ TEST / TAHLİL.
 *
 * Önceki hâli yalnız "tıbbi test" ifadesini tanıyordu; "kan tahlili yaptırmak
 * istiyorum" Hizmetler'e gidiyordu (ölçüldü 2026-09-23, P1-2: 15/15 hatalı).
 *
 * SINIR BİLEREK DAR: "tahlil" ve "analiz" tek başına TIBBİ DEĞİLDİR — "su
 * tahlili", "toprak analizi", "yağ analizi" meşru laboratuvar hizmetleridir
 * ve bu kapıdan geçmemelidir. Bu yüzden ya adın kendisi tıbbi olmalı (kan
 * tahlili, hemogram, biyopsi, PCR testi) ya da "tıbbi/medikal" niteleyicisi
 * bulunmalıdır. Kapsayıcı bir "tahlil" kalıbı yazmak daha çok vakayı
 * kapatırdı ama meşru talepleri de keserdi.
 */
const MEDICAL_TESTING_PHRASE =
  /(?:^|[^a-z0-9])(?:(?:tibbi|medikal)\s+(?:test|tahlil|analiz)|kan\s+tahlil[a-z]*|idrar\s+tahlil[a-z]*|kan\s+test[a-z]*|hemogram[a-z]*|biyopsi[a-z]*|pcr\s*test[a-z]*|check\s*-?\s*up|tomografi[a-z]*|mamografi[a-z]*|ultrason[a-z]*|rontgen[a-z]*|emar|mr\s+cektir[a-z]*|hormon\s+test[a-z]*|alerji\s+test[a-z]*)(?:[^a-z0-9]|$)/;

/**
 * Ürün sinyali varsa talep hizmet değil, cihaz/kit alımıdır — kapı açılmaz.
 *
 * SARF MALZEMESİ DE BİR ÜRÜNDÜR (2026-09-25). Kapının kendi sözleşmesi
 * "'tıbbi test cihazı' veya 'tıbbi test kiti' gibi açık ürün talepleri bu
 * kapıya girmez" diyordu; liste yalnız dayanıklı cihaz adlarını sayıyordu.
 * Ölçüldü (`qa/open-set`, B kümesi): "Ultrason jeli arıyorum, 20 litre" —
 * meşru bir medikal sarf alımı — anlam koruyan 14 dönüşümün tamamında
 * `UNSUPPORTED_REMOVED_SCOPE` ile ENGELLENİYORDU. Bu bir gevşetme değil,
 * kapının zaten yazılı olan niyetinin tamamlanmasıdır: kaldırılan kapsam
 * tıbbi test HİZMETİDİR, o hizmette kullanılan ürün değil.
 */
const MEDICAL_TESTING_PRODUCT_SIGNAL =
  /(?:^|[^a-z0-9])(?:cihaz[a-z]*|kit[a-z]*|alet[a-z]*|set[a-z]*|makine[a-z]*|ekipman[a-z]*|tarayici[a-z]*|sarf[a-z]*|malzeme[a-z]*|jel[a-z]*|solusyon[a-z]*|reaktif[a-z]*|elektrod[a-z]*)(?:[^a-z0-9]|$)/;

/**
 * Ürün sinyali sözcükleri de yazım hatasına uğrar: "kan tahlili cihaı
 * arıyorum" hâlâ bir CİHAZ talebidir ve kapının onu kapsam dışı sayması
 * meşru bir alıcıyı keser. Yaklaşık eşleşme burada kapıyı AÇAR, kapatmaz —
 * yani hep güvenli yönde çalışır.
 */
const MEDICAL_TESTING_PRODUCT_ROOTS = [
  "cihaz",
  "cihazi",
  "cihazlari",
  "kiti",
  "aleti",
  "seti",
  "makinesi",
  "ekipman",
  "ekipmani",
  "tarayici",
];

/**
 * TIBBİ TEST SÖZCÜKLERİNİN YAZIM ONARIMI.
 *
 * "Kan tahliil yaptırmak istiyorum" hâlâ bir kan tahlilidir; tek harflik bir
 * hata kaldırılmış kapsam kapısını tamamen düşürüyordu. Onarım KAPALI bir
 * sözlükle yapılır ve YALNIZ bu kapı için geçerlidir: metin genel olarak
 * değiştirilmez, kapı kendi kalıbını onarılmış kopya üstünde bir kez daha dener.
 */
const MEDICAL_TEST_ROOTS = [
  "tahlili",
  "tahlil",
  "hemogram",
  "biyopsi",
  "tomografi",
  "mamografi",
  "ultrason",
  "rontgen",
  "analiz",
  "test",
  "testi",
  "tibbi",
  "medikal",
];

function repairMedicalTestWords(foldedText: string): string {
  return foldedText
    .split(/([^a-z0-9]+)/)
    .map((piece) => {
      if (!/^[a-z0-9]+$/.test(piece) || piece.length < 4) return piece;
      for (const root of MEDICAL_TEST_ROOTS) {
        if (piece === root) return piece;
        if (withinOneEdit(piece, root)) return root;
      }
      return piece;
    })
    .join("");
}

export function isRemovedMedicalTestingRequest(foldedText: string): boolean {
  if (!MEDICAL_TESTING_PHRASE.test(foldedText)) {
    const repaired = repairMedicalTestWords(foldedText);
    if (repaired === foldedText || !MEDICAL_TESTING_PHRASE.test(repaired)) return false;
    return isRemovedMedicalTestingRequest(repaired);
  }
  if (MEDICAL_TESTING_PRODUCT_SIGNAL.test(foldedText)) return false;
  const words = tokens(foldedText);
  for (const w of words) {
    if (w.length < 5) continue;
    for (const root of MEDICAL_TESTING_PRODUCT_ROOTS) {
      if (withinOneEdit(w, root)) return false;
    }
  }
  return true;
}
