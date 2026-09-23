/**
 * KAPI: METİNDE YAZILAN CEVAP SORULMAZ (kurucu kararı D-0030, 2026-09-23).
 *
 * NE KANITLAR. Kullanıcının kendi cümlesinde verdiği cevap kanonik alana
 * DEĞER olarak yazılıyor mu ve o değer soruyu KAPATMAYA YETKİLİ mi?
 *
 * İKİ EKSEN AYRI ÖLÇÜLÜR — ve bu ayrım KB-17'nin kendisidir:
 *   1. Alan doldu mu?                → `kind === "VALUE"`
 *   2. Bu değer soruyu kapatır mı?   → `mayCloseQuestion(classifyAnswerAuthority(...))`
 * Bir alanın ÇIKARIMLA dolması soruyu kapatmaz ve kapatmamalıdır; bu kapı o
 * sözleşmeyi bozmaz, yalnız "kullanıcı yazdıysa değer kullanıcınındır"
 * tarafını ölçer.
 *
 * İKİNCİ BİR BASTIRMA YOLU AÇMAZ. Kapanış kararını bu betik kurmaz;
 * `answer-authority.ts` içindeki TEK otoriteye sorar. Burada yeniden yazılan
 * bir eşik ya da kelime listesi yoktur.
 *
 * MUTASYON KONTROLÜ (T9): kanıt etiketi çıkarıma düşürülünce kapının kırmızı
 * verdiği kanıtlanır — yoksa "yetkili" ölçüsü hiçbir şey ayırt etmiyordur.
 */
import { syncFromText } from "@/lib/request-composer";
import {
  classifyAnswerAuthority,
  mayCloseQuestion,
} from "@/lib/request-composer/answer-authority";
import type { CanonicalFieldState } from "@/lib/request-composer/types";

type Case = {
  text: string;
  /** Metinde cevabı yazılmış olan kanonik alan. */
  field: string;
  /** Beklenen görünüm değerinin içermesi gereken parça. */
  expectContains: string;
  why: string;
};

/**
 * ZAMAN — D-0030'un en büyük kovası (A-Z koşusunda 240 vakanın 76'sı).
 * Kullanıcı ne zaman istediğini yazmışken "Ne zamana kadar?" sorulamaz.
 */
const TIME_CASES: Case[] = [
  { text: "Arçelik buzdolabı arıyorum. Bütçem 40000 TL. Ankara Çankaya. İki hafta içinde.", field: "delivery", expectContains: "hafta", why: "sayı sözcüğü + birim + içinde" },
  { text: "3 gün içinde ofis sandalyesi lazım İstanbul Kadıköy bütçem 5000 TL", field: "delivery", expectContains: "gün", why: "rakam + birim + içinde" },
  { text: "Bir ay içerisinde klima montajı yaptırmak istiyorum Ankara", field: "delivery", expectContains: "ay", why: "içerisinde yazımı" },
  { text: "2 haftaya kadar 10 adet masa lazım İzmir", field: "delivery", expectContains: "hafta", why: "-ya kadar kalıbı" },
  { text: "Yarın lazım kartvizit bastırmak istiyorum İstanbul", field: "delivery", expectContains: "Yarın", why: "takvim sözcüğü" },
  { text: "Bugün teslim alabileceğim bir forklift kiralamak istiyorum Bursa", field: "delivery", expectContains: "Bugün", why: "takvim sözcüğü" },
  { text: "Gelecek hafta taşınmak için nakliyat firması arıyorum İstanbul", field: "delivery", expectContains: "Gelecek hafta", why: "takvim ifadesi" },
  { text: "Hafta sonu için ses sistemi kiralamak istiyorum Ankara", field: "delivery", expectContains: "Hafta sonu", why: "takvim ifadesi" },
  { text: "Acil olarak jeneratör arıyorum İzmir bütçem 50000 TL", field: "delivery", expectContains: "Acil", why: "aciliyet beyanı bir zaman cevabıdır" },
  { text: "En kısa sürede laptop arıyorum İstanbul bütçem 30000 TL", field: "delivery", expectContains: "Acil", why: "aciliyet beyanı" },
  { text: "12.05.2026 tarihine kadar 500 adet broşür bastırmak istiyorum", field: "delivery", expectContains: "12.05.2026", why: "açık tarih" },
];

/** BÜTÇE — zaten çalışıyordu; regresyonu yakalamak için kapıda durur. */
const BUDGET_CASES: Case[] = [
  { text: "Bütçem 25.000 TL olan bir bulaşık makinesi arıyorum Ankara", field: "budget", expectContains: "25", why: "açık bütçe beyanı" },
  { text: "40000 tl butcem var buzdolabi ariyorum istanbul", field: "budget", expectContains: "40", why: "diyakritiksiz bütçe" },
];

/** METİNDE ZAMAN YOKSA ALAN DOLMAMALI — kapı ters yönde de tutmalı. */
const NEGATIVE_CASES: Array<{ text: string; field: string; why: string }> = [
  { text: "Ofis için ergonomik çalışma sandalyesi arıyorum İstanbul", field: "delivery", why: "metinde zaman yok" },
  { text: "3 yıl garantili buzdolabı arıyorum Ankara", field: "delivery", why: "garanti süresi teslim süresi değildir" },
  { text: "5 günlük kiralama için araç arıyorum İzmir", field: "delivery", why: "kiralama süresi teslim zamanı değildir" },
];

let red = 0;
const lines: string[] = [];

function fieldOf(text: string, key: string): CanonicalFieldState | undefined {
  const { state } = syncFromText(null, text);
  return (state.fields as Record<string, CanonicalFieldState | undefined>)[key];
}

function runPositive(title: string, cases: Case[]): void {
  lines.push(`\n--- ${title} (${cases.length}) ---`);
  for (const c of cases) {
    const field = fieldOf(c.text, c.field);
    const value = field?.kind === "VALUE" ? String(field.value ?? "") : "";
    const filled = value.length > 0;
    const closes = filled && mayCloseQuestion(classifyAnswerAuthority(field));
    const matches = filled && value.toLocaleLowerCase("tr-TR").includes(c.expectContains.toLocaleLowerCase("tr-TR"));
    const ok = filled && closes && matches;
    if (!ok) red += 1;
    lines.push(
      `  ${ok ? "yesil " : "KIRMIZI"} ${c.field} — "${c.text.slice(0, 48)}..." ` +
        `deger=${value || "(bos)"} kanit=${field?.provenance ?? "-"} kapatir=${closes} · ${c.why}`,
    );
  }
}

function runNegative(): void {
  lines.push(`\n--- METINDE CEVAP YOKSA ALAN DOLMAZ (${NEGATIVE_CASES.length}) ---`);
  for (const c of NEGATIVE_CASES) {
    const field = fieldOf(c.text, c.field);
    const value = field?.kind === "VALUE" ? String(field.value ?? "") : "";
    const ok = value.length === 0;
    if (!ok) red += 1;
    lines.push(
      `  ${ok ? "yesil " : "KIRMIZI"} ${c.field} — "${c.text.slice(0, 48)}..." ` +
        `deger=${value || "(bos)"} · ${c.why}`,
    );
  }
}

/**
 * MUTASYON KONTROLÜ: aynı değer ÇIKARIM kanıtıyla gelseydi soru kapanmamalıydı.
 *
 * Üretim kodu değiştirilmez; yalnız alanın bellekteki kopyasının kanıtı
 * düşürülür ve TEK otoriteye yeniden sorulur.
 */
function mutationControl(): boolean {
  const field = fieldOf(TIME_CASES[0].text, "delivery");
  if (!field || field.kind !== "VALUE") return false;
  const closesAsWritten = mayCloseQuestion(classifyAnswerAuthority(field));
  const downgraded = { ...field, provenance: "INFERRED" } as CanonicalFieldState;
  const closesAsInference = mayCloseQuestion(classifyAnswerAuthority(downgraded));
  return closesAsWritten && !closesAsInference;
}

console.log("=== verify-stated-answer-suppression-v1 ===");
runPositive("ZAMAN — metinde yazilan zaman sorulmaz", TIME_CASES);
runPositive("BUTCE — regresyon kapisi", BUDGET_CASES);
runNegative();
for (const line of lines) console.log(line);

const mutationOk = mutationControl();
console.log(
  `\nMUTASYON KONTROLU: ${mutationOk ? "gecti" : "GECMEDI"} — ` +
    "ayni deger CIKARIM kanitiyla gelseydi soru kapanmazdi",
);
if (!mutationOk) red += 1;

const total = TIME_CASES.length + BUDGET_CASES.length + NEGATIVE_CASES.length;
console.log(`\n${total - red}/${total} yesil  ·  kirmizi ${red}`);
if (red === 0) {
  console.log("PASS — metinde yazilan cevap kanonik alana yaziliyor ve soruyu kapatiyor");
  process.exit(0);
}
console.log(`KIRMIZI — ${red} vaka`);
process.exit(1);
