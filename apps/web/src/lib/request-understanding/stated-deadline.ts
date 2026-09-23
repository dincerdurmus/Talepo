/**
 * METİNDE YAZILAN ZAMAN — TEK OKUYUCU (D-0030, 2026-09-23).
 *
 * KURUCU KARARI: "Metinde yazılan cevap sorulmaz, otomatik doldurulur."
 *
 * ÖLÇÜLEN KUSUR (A-Z koşusu 2026-09-23, P2-9 — 240 vakanın 76'sı): kullanıcı
 * "iki hafta içinde lazım" yazıyor, sistem yine "Ne zamana kadar ihtiyacınız
 * var?" diye soruyor. Metinde bir zaman ifadesi vardı ama onu okuyan hiçbir
 * çıkarıcı yoktu: `urgencyPreference` üretiliyordu ama hiçbir tüketicisi
 * yoktu — yani ölçülüyor, hiçbir yere gitmiyordu.
 *
 * NEDEN AYRI MODÜL. Bütçe ve konumun kendi çıkarıcıları var (`parser/budget`,
 * `geo/turkey-districts`); zamanın yoktu. Bunu `understand-request` içine
 * gömmek, dördüncü bir büyük dosya bölümü daha eklerdi ve kalıp tek başına
 * test edilemezdi. Saf modül: ağ yok, katalog yok, yan etki yok.
 *
 * NE DÖNDÜRÜR. Kullanıcının CÜMLESİNDEKİ ifadeyi, normalize edilmiş ama
 * tanınabilir bir görünüm dizesi olarak. Tarihe çevirmez: "iki hafta içinde"
 * bir tarih değil bir penceredir ve onu takvime sabitlemek, kullanıcının
 * söylemediği bir şeyi söylemiş gibi göstermek olurdu.
 */
import { foldTr } from "./tr-fold";

export type StatedDeadline = {
  /** Özet kartında ve `delivery` alanında görünecek metin. */
  display: string;
  /** Kararın dayandığı ham ifade. */
  evidence: string[];
  /** Aciliyet beyanı mı (gün/tarih değil, "acil"/"hemen" gibi)? */
  urgent: boolean;
};

/** Türkçe sayı sözcükleri — "iki hafta içinde" de bir sayıdır. */
const NUMBER_WORDS: Record<string, number> = {
  bir: 1,
  iki: 2,
  uc: 3,
  dort: 4,
  bes: 5,
  alti: 6,
  yedi: 7,
  sekiz: 8,
  dokuz: 9,
  on: 10,
  onbes: 15,
  yirmi: 20,
  otuz: 30,
};

const UNIT_LABEL: Record<string, string> = {
  gun: "gün",
  hafta: "hafta",
  ay: "ay",
  saat: "saat",
};

/**
 * Sayı + birim + "içinde/içerisinde" kalıbı.
 *
 * "-e kadar" da aynı anlamı taşır ("2 hafta içinde" / "2 haftaya kadar").
 * Sondaki bağlaç zorunludur: "3 gün garanti" bir teslim süresi DEĞİLDİR ve
 * onu zaman cevabı saymak, kullanıcının yazmadığı bir cevabı kaydetmek olur.
 */
const WINDOW_PATTERN = new RegExp(
  String.raw`(?:^|[^a-z0-9])(\d{1,3}|${Object.keys(NUMBER_WORDS).join("|")})\s*` +
    String.raw`(gun|hafta|ay|saat)\s*(?:icinde|icerisinde|icersinde|ya\s*kadar|e\s*kadar|a\s*kadar)`,
);

/** Takvim sözcükleri: tek başına tam bir zaman cevabıdır. */
const CALENDAR_PHRASES: Array<{ re: RegExp; display: string }> = [
  { re: /(?:^|[^a-z0-9])bugun(?:[^a-z0-9]|$)/, display: "Bugün" },
  { re: /(?:^|[^a-z0-9])yarin(?:[^a-z0-9]|$)/, display: "Yarın" },
  { re: /(?:^|[^a-z0-9])bu\s*hafta(?:[^a-z0-9]|$)/, display: "Bu hafta" },
  { re: /(?:^|[^a-z0-9])gelecek\s*hafta(?:[^a-z0-9]|$)/, display: "Gelecek hafta" },
  { re: /(?:^|[^a-z0-9])onumuzdeki\s*hafta(?:[^a-z0-9]|$)/, display: "Gelecek hafta" },
  { re: /(?:^|[^a-z0-9])bu\s*ay(?:[^a-z0-9]|$)/, display: "Bu ay" },
  { re: /(?:^|[^a-z0-9])gelecek\s*ay(?:[^a-z0-9]|$)/, display: "Gelecek ay" },
  { re: /(?:^|[^a-z0-9])onumuzdeki\s*ay(?:[^a-z0-9]|$)/, display: "Gelecek ay" },
  { re: /(?:^|[^a-z0-9])hafta\s*sonu(?:[^a-z0-9]|$)/, display: "Hafta sonu" },
  { re: /(?:^|[^a-z0-9])ay\s*sonu(?:na|nda)?(?:[^a-z0-9]|$)/, display: "Ay sonu" },
  { re: /(?:^|[^a-z0-9])ay\s*bas(?:i|inda|ina)(?:[^a-z0-9]|$)/, display: "Ay başı" },
];

/**
 * AY ADI — "kasım başında", "aralık sonunda", "3 martta".
 *
 * AY ADI TEK BAŞINA OKUNMAZ. Türkçede iki ay adı aynı zamanda sıradan
 * sözcüktür: "ocak" bir pişirme cihazı, "ekim" bir tarım işidir. "Ocak
 * arıyorum" ya da "ekim makinesi arıyorum" yazan kullanıcıya "Zaman: Ocak"
 * yazmak, söylemediği bir cevabı ona mal etmek olurdu. Bu yüzden ay adının
 * yanında GÜN SAYISI, DÖNEM sözcüğü (başı/ortası/sonu) ya da YIL bulunmak
 * zorundadır — üçü de takvim bağlamının kendisidir.
 *
 * Takvime sabitlemeyiz: kullanıcı ne yazdıysa o görünür.
 */
const MONTHS = [
  "ocak",
  "subat",
  "mart",
  "nisan",
  "mayis",
  "haziran",
  "temmuz",
  "agustos",
  "eylul",
  "ekim",
  "kasim",
  "aralik",
];
const MONTH_DISPLAY: Record<string, string> = {
  ocak: "Ocak",
  subat: "Şubat",
  mart: "Mart",
  nisan: "Nisan",
  mayis: "Mayıs",
  haziran: "Haziran",
  temmuz: "Temmuz",
  agustos: "Ağustos",
  eylul: "Eylül",
  ekim: "Ekim",
  kasim: "Kasım",
  aralik: "Aralık",
};
const MONTH_PATTERN = new RegExp(
  String.raw`(?:^|[^a-z0-9])(?:(\d{1,2})\s+)?(${MONTHS.join("|")})[a-z]*` +
    String.raw`(?:\s*(bas[a-z]*|ortas[a-z]*|sonu[a-z]*)|\s*(\d{4}))?(?:[^a-z0-9]|$)`,
);

/**
 * Aciliyet beyanları.
 *
 * "Acil" bir zaman cevabıdır: kullanıcı ne zaman istediğini söylemiştir.
 * Tarih vermemiştir ama soruyu cevaplamıştır; ona bir de "ne zamana kadar?"
 * diye sormak, yazdığını okumamak demektir.
 */
const URGENT_PATTERN =
  /(?:^|[^a-z0-9])(acil(?:en)?|hemen|en\s*kisa\s*surede|asap|ivedi(?:likle)?)(?:[^a-z0-9]|$)/;

/**
 * Açık tarih: 12.05.2026 / 12/05.
 *
 * TİRE AYIRICI YOK ve GÜN/AY ARALIĞI DOĞRULANIR. İlk yazımda `-` de kabul
 * ediliyor ve aralık denetlenmiyordu; korpus kapısı bunu anında yakaladı:
 * "Oto koltuğu arıyorum 9-36 kg" cümlesindeki AĞIRLIK ARALIĞI tarih sanılıp
 * "Zaman: 9-36" diye kaydediliyordu. Türkçede tarih noktayla yazılır; tire
 * çok daha sık aralık demektir.
 */
const EXPLICIT_DATE = /(?:^|[^0-9])(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?:[^0-9]|$)/;

/**
 * Metinde yazılmış zaman cevabını oku.
 *
 * Sıra kanıt gücüne göredir: somut pencere > takvim sözcüğü > açık tarih >
 * aciliyet. Bir cümlede ikisi birden varsa ("acil, 3 gün içinde") somut olan
 * kazanır; "acil" onu yalnız nitelendirir.
 */
export function readStatedDeadline(rawText: string): StatedDeadline | null {
  const text = foldTr(rawText ?? "");
  if (!text.trim()) return null;

  const urgent = URGENT_PATTERN.test(text);

  const window = WINDOW_PATTERN.exec(text);
  if (window) {
    const rawCount = window[1];
    const count = /^\d+$/.test(rawCount) ? Number(rawCount) : NUMBER_WORDS[rawCount];
    const unit = UNIT_LABEL[window[2]];
    if (count && unit) {
      return {
        display: `${count} ${unit} içinde`,
        evidence: [`stated-window:${rawCount} ${window[2]}`],
        urgent,
      };
    }
  }

  for (const phrase of CALENDAR_PHRASES) {
    if (phrase.re.test(text)) {
      return { display: phrase.display, evidence: [`stated-calendar:${phrase.display}`], urgent };
    }
  }

  const month = MONTH_PATTERN.exec(text);
  // Gün, dönem ya da yıl yoksa bu bir takvim ifadesi değildir.
  if (month && (month[1] || month[3] || month[4])) {
    const day = month[1];
    const name = MONTH_DISPLAY[month[2]];
    const part = month[3]?.startsWith("bas")
      ? " başı"
      : month[3]?.startsWith("ortas")
        ? " ortası"
        : month[3]?.startsWith("sonu")
          ? " sonu"
          : "";
    return {
      display: day ? `${day} ${name}` : `${name}${part}`,
      evidence: [`stated-month:${month[0].trim()}`],
      urgent,
    };
  }

  const date = EXPLICIT_DATE.exec(text);
  if (date) {
    const day = Number(date[1]);
    const month = Number(date[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const display = date[3] ? `${date[1]}.${date[2]}.${date[3]}` : `${date[1]}.${date[2]}`;
      return { display, evidence: [`stated-date:${display}`], urgent };
    }
  }

  if (urgent) {
    return { display: "Acil", evidence: ["stated-urgency"], urgent: true };
  }

  return null;
}
