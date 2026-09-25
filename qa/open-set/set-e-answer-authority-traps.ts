/**
 * E KÜMESİ — CEVAP OTORİTESİ TUZAKLARI (D-0030'un TERS YÖNÜ, 2026-09-25).
 *
 * D-0030 şunu söyler: "metinde yazılan cevap sorulmaz". Mevcut kapı
 * (`verify-stated-answer-suppression-v1`) o kararın DOĞRU yönünü ölçer —
 * kullanıcı yazdıysa alan dolmalı ve soruyu kapatmalı. Bu küme ters yönü
 * ölçer ve aynı hata sınıfının açık küme yüzüdür:
 *
 *   Metinde cevap VAR GİBİ görünür, aslında YOKTUR.
 *
 * "bütçem yok", "Kadıköy'de değil Üsküdar'da", "Arçelik gibi bir şey ama marka
 * önemli değil" — üçünde de bir rakam, bir ilçe, bir marka adı GEÇER. Çıkarıcı
 * onu cevap sayarsa soru hiç sorulmaz ve talep yanlış yere yönlenir. Burada
 * emin-ama-yanlış tam olarak ATLANMIŞ ZORUNLU SORU demektir.
 *
 * İKİ ÖLÇÜM YÜZEYİ, TEK KÜME. Bir alanın hangi yüzeyde yaşadığı bu kümenin
 * kararı değildir, kodun gerçeğidir:
 *   - `budget`, `delivery`, `quantity`, `brand`, `model` → besteci durumu
 *     (`syncFromText` + `classifyAnswerAuthority` + `mayCloseQuestion`).
 *   - `city`, `district` → anlama katmanının konum çıkarımı
 *     (`understandRequest(...).location`), çünkü besteci bu iki alanı
 *     metinden doldurmaz. İki yüzey ayrı ölçülür; biri ötekinin yerine
 *     konuşamaz (ölçüm durumu yüzey başınadır).
 *
 * BEKLENTİ İKİ TÜRLÜDÜR VE İKİSİ DE ÖLÇÜM.
 *   MUST_NOT_CLOSE   — alan soruyu KAPATAMAZ. Asıl kapı budur.
 *   MUST_CLOSE_WITH  — düzeltme cümlesinde DOĞRU değer kapatabilir. Bu taraf
 *                      olmasa "hiçbir şeyi cevap sayma" kuralı kümeyi geçerdi
 *                      ve kullanıcıyı kendi yazdığı cevabı tekrar yazmaya
 *                      zorlamak da bir kusurdur.
 */
import type { AnswerTrapCase } from "./types";

type Row = [
  field: string,
  text: string,
  trap: AnswerTrapCase["trap"],
  expect: AnswerTrapCase["expect"],
  expectContains: string | null,
  why: string,
];

function build(prefix: string, rows: Row[]): AnswerTrapCase[] {
  return rows.map(([field, text, trap, expect, expectContains, why], i) => ({
    id: `e-${prefix}-${String(i + 1).padStart(2, "0")}`,
    field,
    text,
    trap,
    expect,
    ...(expectContains ? { expectContains } : {}),
    why,
  }));
}

/* ── BÜTÇE ───────────────────────────────────────────────────────────── */
const BUDGET = build("butce", [
  ["budget", "Buzdolabı arıyorum, bütçem yok", "negation", "MUST_NOT_CLOSE", null, "'bütçem' geçiyor ama rakam yok"],
  ["budget", "Çamaşır makinesi arıyorum, bütçe belirlemedim", "negation", "MUST_NOT_CLOSE", null, "olumsuz fiil"],
  ["budget", "Laptop arıyorum, bütçeyi sonra söyleyeceğim", "future-intent", "MUST_NOT_CLOSE", null, "gelecek zaman niyeti cevap değildir"],
  ["budget", "Laptop arıyorum, bütçem henüz belli değil", "negation", "MUST_NOT_CLOSE", null, "'belli değil'"],
  ["budget", "Ofis sandalyesi arıyorum, teklifleri görmek istiyorum", "hedge", "MUST_NOT_CLOSE", null, "teklif isteği bütçe beyanı değildir"],
  ["budget", "Kartvizit bastırmak istiyorum, bütçe konusunda bir fikrim yok", "negation", "MUST_NOT_CLOSE", null, "'fikrim yok'"],
  ["budget", "Klima arıyorum, bütçem sınırlı ama rakam veremem", "hedge", "MUST_NOT_CLOSE", null, "nitel beyan, rakam yok"],
  ["budget", "Forklift kiralamak istiyorum, bütçeyi siz söyleyin", "hedge", "MUST_NOT_CLOSE", null, "kararı karşı tarafa bırakıyor"],
  ["budget", "Jeneratör arıyorum, bütçem ne olur bilmiyorum", "negation", "MUST_NOT_CLOSE", null, "'bilmiyorum'"],
  ["budget", "Masa arıyorum, 5000 TL'ye kadar diyemem henüz", "hedge", "MUST_NOT_CLOSE", null, "rakam geçiyor ama reddedilmiş"],
  ["budget", "Buzdolabı arıyorum, bütçem 40000 TL değil 60000 TL", "correction", "MUST_CLOSE_WITH", "60", "düzeltilmiş rakam kapatır"],
  ["budget", "Laptop arıyorum, 20000 değil 30000 TL bütçem var", "correction", "MUST_CLOSE_WITH", "30", "düzeltilmiş rakam kapatır"],
  ["budget", "Klima arıyorum, bütçem 15 bin TL yanlış yazdım 25 bin TL", "correction", "MUST_CLOSE_WITH", "25", "kendini düzeltme"],
  ["budget", "Ofis masası arıyorum, bütçem 12.000 TL", "hedge", "MUST_CLOSE_WITH", "12", "tuzaksız kontrol — regresyon kapısı"],
]);

/* ── TESLİM SÜRESİ ───────────────────────────────────────────────────── */
const DELIVERY = build("teslim", [
  ["delivery", "Kartvizit bastırmak istiyorum, acil değil", "negation", "MUST_NOT_CLOSE", null, "'acil' geçiyor ama olumsuzlanmış"],
  ["delivery", "Buzdolabı arıyorum, tarih önemli değil", "negation", "MUST_NOT_CLOSE", null, "'tarih' geçiyor, cevap yok"],
  ["delivery", "Klima montajı istiyorum, ne zaman olacağını bilmiyorum", "negation", "MUST_NOT_CLOSE", null, "'ne zaman' soru sözcüğü, cevap değil"],
  ["delivery", "Laptop arıyorum, 3 yıl garantili olsun", "hedge", "MUST_NOT_CLOSE", null, "garanti süresi teslim süresi değildir"],
  ["delivery", "Araç kiralamak istiyorum, 5 günlük kiralama", "hedge", "MUST_NOT_CLOSE", null, "kiralama süresi teslim zamanı değildir"],
  ["delivery", "Broşür bastırmak istiyorum, 16 sayfa olacak", "hedge", "MUST_NOT_CLOSE", null, "sayfa sayısı zaman değildir"],
  ["delivery", "Forklift arıyorum, 2019 model olsun", "hedge", "MUST_NOT_CLOSE", null, "model yılı teslim zamanı değildir"],
  ["delivery", "Kartvizit bastırmak istiyorum, ayın 5'i değil 15'i", "correction", "MUST_NOT_CLOSE", null, "düzeltilmiş ayın günü bugün ÇIKARILMIYOR; reddedilen tarih de cevap sayılmamalı"],
  ["delivery", "Klima montajı istiyorum, bu hafta değil gelecek hafta", "correction", "MUST_CLOSE_WITH", "hafta", "düzeltilmiş zaman kapatır"],
  ["delivery", "Nakliyat arıyorum, yarın değil cumartesi", "correction", "MUST_NOT_CLOSE", null, "'yarın' reddedilmiş; 'cumartesi' bugün çıkarılmıyor"],
  ["delivery", "Ofis sandalyesi arıyorum, iki hafta içinde lazım", "hedge", "MUST_CLOSE_WITH", "hafta", "tuzaksız kontrol — regresyon kapısı"],
]);

/* ── MİKTAR ──────────────────────────────────────────────────────────── */
const QUANTITY = build("miktar", [
  ["quantity", "Buzdolabı arıyorum, 2 adet değil 5 adet", "correction", "MUST_CLOSE_WITH", "5", "düzeltilmiş adet kapatır"],
  ["quantity", "Sandalye arıyorum, 10 adet değil 20 adet olsun", "correction", "MUST_CLOSE_WITH", "20", "düzeltilmiş adet kapatır"],
  ["quantity", "Kartvizit bastırmak istiyorum, adet önemli değil", "negation", "MUST_NOT_CLOSE", null, "'adet' geçiyor, sayı yok"],
  ["quantity", "Masa arıyorum, kaç adet alacağımı bilmiyorum", "negation", "MUST_NOT_CLOSE", null, "'kaç adet' soru biçimi"],
  ["quantity", "Etiket bastırmak istiyorum, adedi sonra netleştireceğim", "future-intent", "MUST_NOT_CLOSE", null, "gelecek niyet"],
  ["quantity", "Ofis sandalyesi arıyorum, 12 adet", "hedge", "MUST_CLOSE_WITH", "12", "tuzaksız kontrol — regresyon kapısı"],
]);

/* ── MARKA ───────────────────────────────────────────────────────────── */
const BRAND = build("marka", [
  ["brand", "Laptop arıyorum, Apple olmasın", "negation", "MUST_NOT_CLOSE", null, "reddedilen marka cevap değildir"],
  ["brand", "Buzdolabı arıyorum, marka fark etmez", "negation", "MUST_NOT_CLOSE", null, "bilinçli değersiz cevap"],
  ["brand", "Buzdolabı arıyorum, Arçelik gibi bir şey ama marka önemli değil", "hedge", "MUST_NOT_CLOSE", null, "benzetme + açık olumsuzlama"],
  ["brand", "Çamaşır makinesi arıyorum, Bosch hariç herhangi biri", "negation", "MUST_NOT_CLOSE", null, "'hariç' reddeder"],
  ["brand", "Klima arıyorum, marka tavsiyesi bekliyorum", "hedge", "MUST_NOT_CLOSE", null, "tavsiye isteği cevap değildir"],
  ["brand", "Televizyon arıyorum, hangi marka iyi bilmiyorum", "negation", "MUST_NOT_CLOSE", null, "soru biçimi"],
  ["brand", "Telefon arıyorum, Samsung değil Xiaomi olsun", "correction", "MUST_CLOSE_WITH", "Xiaomi", "düzeltilmiş marka kapatır"],
  ["brand", "Buzdolabı arıyorum, Bosch değil Arçelik olsun", "correction", "MUST_CLOSE_WITH", "Arçelik", "düzeltilmiş marka kapatır"],
  ["brand", "Arçelik buzdolabı arıyorum", "hedge", "MUST_CLOSE_WITH", "Arçelik", "tuzaksız kontrol — regresyon kapısı"],
]);

/* ── MODEL ───────────────────────────────────────────────────────────── */
const MODEL = build("model", [
  ["model", "Buzdolabı arıyorum, Arçelik gibi bir şey", "hedge", "MUST_NOT_CLOSE", null, "'gibi' bir model adı değildir"],
  ["model", "Laptop arıyorum, MacBook tarzı bir şey", "hedge", "MUST_NOT_CLOSE", null, "'tarzı' bir model adı değildir"],
  ["model", "Telefon arıyorum, iPhone benzeri bir cihaz", "hedge", "MUST_NOT_CLOSE", null, "'benzeri' bir model adı değildir"],
  ["model", "Televizyon arıyorum, Samsung olsun model önemli değil", "negation", "MUST_NOT_CLOSE", null, "model açıkça reddedilmiş"],
  ["model", "Buzdolabı arıyorum, model konusunda bilgim yok", "negation", "MUST_NOT_CLOSE", null, "'bilgim yok'"],
]);

/* ── ŞEHİR ───────────────────────────────────────────────────────────── */
const CITY = build("sehir", [
  ["city", "Buzdolabı arıyorum, İstanbul'da değil Ankara'da olsun", "correction", "MUST_CLOSE_WITH", "Ankara", "reddedilen il cevap olamaz"],
  ["city", "Nakliyeci arıyorum, Ankara'dan değil İzmir'den", "correction", "MUST_CLOSE_WITH", "İzmir", "reddedilen il cevap olamaz"],
  ["city", "Forklift kiralamak istiyorum, Bursa değil İstanbul", "correction", "MUST_CLOSE_WITH", "İstanbul", "reddedilen il cevap olamaz"],
  ["city", "Klima montajı istiyorum, konum önemli değil", "negation", "MUST_NOT_CLOSE", null, "konum reddedilmiş"],
  ["city", "Buzdolabı arıyorum, nerede olduğunu henüz bilmiyorum", "negation", "MUST_NOT_CLOSE", null, "'bilmiyorum'"],
  ["city", "Jeneratör arıyorum, şehir sonra belli olacak", "future-intent", "MUST_NOT_CLOSE", null, "gelecek niyet"],
  ["city", "Ofis mobilyası arıyorum, Konya istemiyorum", "negation", "MUST_NOT_CLOSE", null, "tek il reddedilmiş, alternatif yok"],
  ["city", "Buzdolabı arıyorum İstanbul", "hedge", "MUST_CLOSE_WITH", "İstanbul", "tuzaksız kontrol — regresyon kapısı"],
]);

/* ── İLÇE ────────────────────────────────────────────────────────────── */
const DISTRICT = build("ilce", [
  ["district", "Buzdolabı arıyorum, Kadıköy'de değil Üsküdar'da", "correction", "MUST_CLOSE_WITH", "Üsküdar", "reddedilen ilçe cevap olamaz"],
  ["district", "Elektrikçi arıyorum, Beşiktaş değil Şişli", "correction", "MUST_CLOSE_WITH", "Şişli", "reddedilen ilçe cevap olamaz"],
  ["district", "Ofis mobilyası arıyorum, Çankaya'da değil Keçiören'de", "correction", "MUST_CLOSE_WITH", "Keçiören", "reddedilen ilçe cevap olamaz"],
  ["district", "Halı yıkama arıyorum, Bornova değil Karşıyaka", "correction", "MUST_CLOSE_WITH", "Karşıyaka", "reddedilen ilçe cevap olamaz"],
  ["district", "Ev temizliği arıyorum, ilçe fark etmez İstanbul olsun", "negation", "MUST_NOT_CLOSE", null, "ilçe bilinçli olarak boş"],
  ["district", "Nakliyat arıyorum, Maltepe'yi istemiyorum", "negation", "MUST_NOT_CLOSE", null, "tek ilçe reddedilmiş, alternatif yok"],
  ["district", "Buzdolabı arıyorum İstanbul Kadıköy", "hedge", "MUST_CLOSE_WITH", "Kadıköy", "tuzaksız kontrol — regresyon kapısı"],
]);

export const SET_E: AnswerTrapCase[] = [
  ...BUDGET,
  ...DELIVERY,
  ...QUANTITY,
  ...BRAND,
  ...MODEL,
  ...CITY,
  ...DISTRICT,
];
