/**
 * `/talep` EKRANINA ÖZEL SAF YARDIMCILAR.
 *
 * Burada tek bir iş var: kullanıcının VERDİĞİ cevapları, standart görünümün
 * bugünkü "Talepo'nun anladıkları" panosunda da görünür kılmak.
 *
 * Neden gerekliydi. Pano `buildUnderstoodFacts` çıktısını basar; o çıktı
 * yalnız anlama katmanının olgularını taşır. Tarayıcı turunda ölçüldü
 * (2026-08-30): Maira'da verilen `delivery` cevabı ve "Yanıtlarım"dan
 * düzeltilen `fridgeType` standart görünümde HİÇBİR yerde görünmüyordu —
 * kullanıcı cevabını verdiği hâlde ekranda izini bulamıyordu.
 *
 * Neden ikinci bir sözlük DEĞİL. Cevaplar zaten `projectUserAnswers` ile tek
 * yerde türetiliyor: etiket, gösterilecek değer, mod ve çelişki kararı orada
 * verilmiş durumda. Bu dosya yeni bir alan sözlüğü, yeni bir soru eşlemesi ya
 * da ikinci bir state kurmaz; iki hazır listeyi AÇIK bir öncelik kuralıyla
 * birleştirir.
 *
 * Öncelik kuralı — kör birleştirme yok:
 *   1. Kullanıcının kanonik cevabı, aynı alandaki eski anlama olgusunu YENER;
 *      eski değer yanında bırakılmaz.
 *   2. Aynı etiket + aynı değer ikinci bir satır üretmez.
 *   3. Cevabı olmayan anlama olguları olduğu gibi kalır.
 */
import type { EditableUnderstoodFact } from "@/lib/request-composer/v2/understood-facts";
import type { UserAnswerRow } from "@/lib/request-composer/v2/answer-apply-plan";
import { trustLabelForTone } from "@/lib/request-composer/v2/trust-labels";

/**
 * Kullanıcının kendi verdiği cevap bir tahmin değildir: panoda en yüksek
 * güven tonuyla ve "kullanıcı onayladı" işaretiyle durur.
 */
function factFromAnswer(row: UserAnswerRow): EditableUnderstoodFact {
  return {
    key: row.fieldKey,
    label: row.label,
    displayValue: row.displayValue,
    tone: "understood",
    trustLabel: trustLabelForTone("understood"),
    userConfirmed: true,
  };
}

export function mergeAnswersIntoUnderstoodFacts(input: {
  facts: EditableUnderstoodFact[];
  answers: UserAnswerRow[];
}): EditableUnderstoodFact[] {
  const answers = input.answers ?? [];
  const answeredKeys = new Set(answers.map((a) => a.fieldKey));

  const merged: EditableUnderstoodFact[] = [];
  const shownPairs = new Set<string>();
  const shownKeys = new Set<string>();

  const push = (fact: EditableUnderstoodFact) => {
    const pair = `${fact.label}=${fact.displayValue}`;
    if (shownKeys.has(fact.key) || shownPairs.has(pair)) return;
    shownKeys.add(fact.key);
    shownPairs.add(pair);
    merged.push(fact);
  };

  /* 1. Kullanıcı cevapları önce girer — eski olgu onları ezemesin. */
  for (const row of answers) push(factFromAnswer(row));

  /* 2. Cevabı olmayan anlama olguları korunur; cevabı olan alan tekrar edilmez. */
  for (const fact of input.facts ?? []) {
    if (answeredKeys.has(fact.key)) continue;
    push(fact);
  }

  return merged;
}
