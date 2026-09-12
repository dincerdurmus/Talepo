/**
 * MAIRA SESİ — AYNI SORU, BAŞKA SÖYLEYİŞ (kurucu kararı, 2026-09-12).
 *
 * Maira soruları formdaki gibi "Bütçeniz nedir?" diye değil, sohbet eder
 * gibi sorar: "Peki bütçe olarak aklında ne var? Aşağı yukarı söylesen
 * yeter." Kurucunun seçtiği ton: samimi, sen dili.
 *
 * NE DEĞİŞMEZ. Sorunun kendisi, sırası, alanı (fieldKey), seçenekleri ve
 * cevabın yazıldığı yer AYNIDIR. Bu dosya ikinci bir soru sistemi değildir;
 * zamanlayıcının seçtiği soruya yalnız bir söyleyiş ekler. Maira bu metni
 * `FocusedQuestion.mairaPrompt` üzerinden okur; kendi cümlesini uydurmaz.
 *
 * DÖRT KATMAN, TEK GİRİŞ (`toMairaVoice`):
 *   1. kategori + alan sözlüğü   ("real-estate:budget")
 *   2. form cümlesi sözlüğü      ortak çekirdeğin bağlama göre değişen
 *                                cümleleri ("Hizmet nerede verilecek?")
 *   3. alan sözlüğü              ("budget")
 *   4. genel dönüşüm             form cümlesi sen diline çevrilir, başına
 *                                küçük bir sohbet açılışı gelir
 *
 * Sözlükte olmayan bir alan kullanıcıya asla ham anahtar ya da İngilizce
 * göstermez; genel dönüşüm formun Türkçe cümlesinden yola çıkar.
 */

export type MairaVoiceInput = {
  fieldKey: string;
  /** Formun kanonik cümlesi (`ScheduledQuestion.prompt`). */
  prompt: string;
  categoryId?: string | null;
  importance?: string;
};

/* 1. Kategori + alan: aynı alan bazı kategorilerde başka sorulur. */
const BY_CATEGORY_KEY: Record<string, string> = {
  "real-estate:budget":
    "Kira ya da fiyat olarak aklında ne var? Aşağı yukarı bir rakam yeter.",
  "real-estate:city": "Hangi il ve ilçede bakıyorsun?",
  "real-estate:listingType": "Kiralık mı bakıyorsun, satılık mı?",
  "real-estate:propertyType": "Nasıl bir yer arıyorsun; daire mi, müstakil mi, dükkân mı?",
  "real-estate:roomCount": "Kaç oda olsun istersin?",
  "real-estate:area": "Aşağı yukarı kaç metrekare düşünüyorsun?",
  "services:delivery": "Ne zamana kadar halledilmesi lazım?",
  "automotive:condition": "Sıfır mı olsun, ikinci el de olur mu?",
  "automotive:needType": "Aracın kendisini mi arıyorsun, yoksa bir parça mı lazım?",
  "automotive:modelYear": "En eski kaç model olabilir senin için?",
  "automotive:brand": "Aklında bir marka var mı, yoksa açık mısın?",
  "technology:platform": "Web'de mi çalışsın, mobilde mi, ikisinde de mi?",
  "technology:userCount": "Kaç kişi kullanacak aşağı yukarı?",
  "machinery:city": "Nereye gönderelim; Türkiye geneli mi, belli bir il ve ilçe mi?",
};

/* 2. Form cümlesi sözlüğü: ortak çekirdek aynı alanı bağlama göre başka
   sorar (teslimat / hizmet / emlak); söyleyiş o bağlamı korur. Konum ve
   teslim soruları BURADAN geçer, alan sözlüğünden değil: "Hizmet nerede
   verilecek?" ile "Nereye teslim edilecek?" aynı alan olsa da aynı soru
   değildir (kurucu, 2026-09-12). */
const BY_PROMPT: Record<string, string> = {
  "Hizmet nerede verilecek?": "Hizmeti nerede alacaksın; hangi il, hangi ilçe?",
  "Nereye teslim edilecek?": "Nereye gönderelim; hangi il, hangi ilçe?",
  "Hangi il ve ilçede arıyorsunuz?": "Hangi il ve ilçede bakıyorsun?",
  "Teslimat adresi neresi? Türkiye geneli veya il ve ilçe seçin.":
    "Nereye gönderelim; Türkiye geneli mi, belli bir il ve ilçe mi?",
  "Ne zamana kadar taşınmak istiyorsunuz?": "Ne zamana kadar taşınmayı düşünüyorsun?",
  "Aylık kira bütçeniz nedir?": "Aylık kira olarak ne düşünüyorsun? Aşağı yukarı yeter.",
};

/* 3. Alan sözlüğü: en sık sorulan alanlar, sen diliyle. */
const BY_KEY: Record<string, string> = {
  budget: "Peki bütçe olarak aklında ne var? Aşağı yukarı söylesen yeter.",
  city: "Nerede arıyorsun; hangi il, hangi ilçe?",
  delivery: "Ne zamana kadar elinde olsun istersin?",
  quantity: "Kaç tane lazım?",
  needType: "Tam olarak ne arıyorsun? Bunu bir netleştirelim.",
  brand: "Aklında bir marka var mı, yoksa markaya açık mısın?",
  model: "Belirli bir model düşünüyor musun?",
  condition: "Sıfır mı olsun, ikinci el de olur mu?",
  modelYear: "En eski kaç model olabilir senin için?",
  warranty: "Garantili olması şart mı?",
  dimensions: "Ölçüleri biliyor musun? Bilmiyorsan sorun değil.",
  material: "Malzeme konusunda bir tercihin var mı?",
  color: "Renk konusunda bir tercihin var mı?",
  features: "Olmazsa olmaz dediğin bir özellik var mı?",
  usageArea: "Nerede, ne kadarlık bir alanda kullanacaksın?",
  installation: "Montajı da isteyelim mi?",
  assembly: "Kurulumu da isteyelim mi?",
  serviceType: "Tam olarak hangi hizmet lazım?",
  locationMode: "Uzaktan yapılsa senin için olur mu?",
  listingType: "Kiralık mı bakıyorsun, satılık mı?",
  propertyType: "Nasıl bir yer arıyorsun?",
  roomCount: "Kaç oda olsun istersin?",
  area: "Aşağı yukarı kaç metrekare düşünüyorsun?",
  newBuildPreference: "Sıfır bina şart mı, yoksa fark etmez mi?",
  operatingHours: "Çalışma saati için bir üst sınırın var mı?",
  inspectionAvailability: "Yerinde görüp test etmek ister misin?",
  driveType: "Çekiş olarak bir tercihin var mı?",
  designReady: "Tasarım dosyan hazır mı, yoksa tasarım da lazım mı?",
  printSize: "Hangi ebatta olsun?",
  paperWeight: "Kâğıt gramajı için bir tercihin var mı?",
  pageCount: "Kaç sayfa olacak?",
  lamination: "Üzerine selefon ister misin?",
  platform: "Hangi platformda çalışsın?",
  userCount: "Kaç kişi kullanacak aşağı yukarı?",
  integration: "Bağlanması gereken başka bir sistem var mı?",
  support: "Sonrasında bakım ve destek de isteyelim mi?",
  tireSize: "Lastik ölçüsünü biliyor musun? Yan yazısında yazar.",
  tireSeason: "Yaz lastiği mi, kış mı, dört mevsim mi?",
  tireQuantity: "Kaç lastik lazım?",
  screenSize: "Ekran kaç inç olsun?",
  capacityKg: "Kaç kilo kapasite lazım?",
  placeSetting: "Kaç kişilik olsun?",
  diningSeats: "Kaç kişilik olsun?",
  bedSize: "Hangi boyutta olsun?",
  capacity: "Kapasite olarak ne düşünüyorsun?",
  power: "Güç olarak ne lazım?",
  fuel: "Yakıt tercihin var mı?",
  transmission: "Manuel mi, otomatik mi?",
};

/* 4. Genel dönüşüm: siz dili sen diline, başa ufak bir açılış. */
const OPENERS = ["Peki,", "Bir de şunu sorayım:", "Şunu da sorayım:", "Bir de:"] as const;

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Formun "siz" cümlesini "sen" cümlesine çevirir. Kural tabanlı ve
 * muhafazakârdır; yalnız yaygın ekleri dokunur. Uydurma kelime üretmez.
 */
export function toSenDili(text: string): string {
  return (
    text
      /* ihtiyacınız → ihtiyacın, bütçeniz → bütçen, dosyanız → dosyan */
      .replace(/([aeıioöuü])n(ız|iz|uz|üz)\b/g, "$1n")
      /* arıyorsunuz → arıyorsun, musunuz → musun, ister misiniz → ister misin */
      .replace(/(s[ıiuü]n)(ız|iz|uz|üz)\b/g, "$1")
      /* biliyor musunuz zaten yukarıda; "sizin için" → "senin için" */
      .replace(/\bsizin\b/g, "senin")
      .replace(/\bsize\b/g, "sana")
      .replace(/\bsizi\b/g, "seni")
      .replace(/\bsiz\b/g, "sen")
  );
}

function lowerFirst(text: string): string {
  if (!text) return text;
  return text[0].toLocaleLowerCase("tr-TR") + text.slice(1);
}

function genericVoice(fieldKey: string, prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return "";
  /* Zamanlayıcının yedek etiketi ("X bilgisini ekleyelim.") sohbete
     çevrilir: "Peki X için ne düşünüyorsun?" */
  const fallback = /^(.+?) bilgisini ekleyelim\.?$/i.exec(trimmed);
  if (fallback) {
    return `Peki ${lowerFirst(fallback[1])} için ne düşünüyorsun?`;
  }
  if (/^Bir detayı birlikte ekleyelim/i.test(trimmed)) {
    return "Bir detay daha ekleyelim; ne düşünüyorsun?";
  }
  const sen = toSenDili(trimmed);
  const opener = OPENERS[hashKey(fieldKey) % OPENERS.length];
  return `${opener} ${lowerFirst(sen)}`;
}

/**
 * TEK GİRİŞ. Kanonik soru için Maira'nın söyleyişini döndürür. Boş
 * prompt için boş döner; arayüz o zaman formun cümlesine düşer.
 */
export function toMairaVoice(input: MairaVoiceInput): string {
  const key = input.fieldKey.trim();
  if (!key) return input.prompt;
  const cat = (input.categoryId ?? "").trim();
  const scoped = cat ? BY_CATEGORY_KEY[`${cat}:${key}`] : undefined;
  if (scoped) return scoped;
  const byPrompt = BY_PROMPT[input.prompt.trim()];
  if (byPrompt) return byPrompt;
  const direct = BY_KEY[key];
  if (direct) return direct;
  return genericVoice(key, input.prompt);
}

/** Doğrulayıcı için: sözlük kapsamı ölçülür, arayüz bunu kullanmaz. */
export function mairaVoiceDictionaryKeys(): {
  byKey: string[];
  byCategoryKey: string[];
  byPrompt: string[];
} {
  return {
    byKey: Object.keys(BY_KEY),
    byCategoryKey: Object.keys(BY_CATEGORY_KEY),
    byPrompt: Object.keys(BY_PROMPT),
  };
}
