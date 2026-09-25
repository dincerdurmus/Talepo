/**
 * "MAIRA OKUYOR" ANININ VURGULARI — TEK TÜRETME NOKTASI (2026-09-25).
 *
 * Kurucu kararı: gönderilen cümle büyük puntoyla görünür ve ANLAŞILAN
 * parçalar sırayla vurgulanır. Vurgulanan şey burada ÜRETİLMEZ: girdisi
 * zaten var olan anlama sonucundan (`buildUnderstoodFacts` → olgu satırları)
 * gelir. Bu modül yalnız "bu olgunun karşılığı kullanıcının cümlesinde
 * NEREDE geçiyor" sorusunu cevaplar.
 *
 * NEDEN AYRI BİR MODÜL. Ölçülebilir olması için. Vurgu mantığı JSX'in içine
 * gömülseydi "metinde bulunmayan alan vurgulanmaz" kuralı ancak tarayıcıda
 * gözle kontrol edilebilirdi; burada saf bir fonksiyon olarak durduğu için
 * doğrulayıcı onu doğrudan koşturur.
 *
 * SINIR — NE YAPMAZ. Yeni çıkarım yapmaz, model çağırmaz, eş anlamlı
 * üretmez, kategoriye özel dal taşımaz. Bir olgunun gösterilen değeri
 * cümlede harfi harfine (Türkçe büyük/küçük ve aksan katlamasıyla)
 * bulunamıyorsa o olgu VURGULANMAZ — yalnız talep kartında görünür.
 */

export type ReadingFactInput = {
  key: string;
  label: string;
  displayValue: string;
};

export type ReadingSpan = {
  /** Olgunun kanonik alan anahtarı; vurgu satırla eşleşsin diye taşınır. */
  key: string;
  /** Vurgunun üstünde görünen küçük mono etiket (MARKA, ÜRÜN, KONUM…). */
  label: string;
  /** Kullanıcının kendi yazdığı parça — normalize edilmiş hâli değil. */
  text: string;
  start: number;
  end: number;
};

const FOLD: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
  i̇: "i",
};

/**
 * Türkçe katlama. `toLocaleLowerCase("tr-TR")` tek başına yetmez: kullanıcı
 * "ARÇELİK" yazıp anlama "Arçelik" döndürdüğünde eşleşme aksan üzerinden
 * kopar. Katlama İKİ TARAFA DA aynı şekilde uygulanır ve uzunluk korunur —
 * aksi hâlde bulunan konum ham metinde kayar.
 */
function fold(value: string): string {
  let out = "";
  for (const ch of value.toLocaleLowerCase("tr-TR")) {
    const mapped = FOLD[ch];
    /* Uzunluk korunmalı: çok karakterli katlama kabul edilmez. */
    out += mapped && mapped.length === 1 ? mapped : ch;
  }
  return out;
}

/** Aranabilir parça: baştaki/sondaki boşluk ve noktalama temizlenir. */
function searchable(value: string): string {
  return value.replace(/^[\s.,;:!?()[\]"'-]+|[\s.,;:!?()[\]"'-]+$/gu, "").trim();
}

/**
 * Bir olgunun cümlede aranacak adayları. SIRA ÖNEMLİ: önce tam değer, sonra
 * sayısal öneki (55 inç → 55), sonra ilk kelimesi. Uydurma eş anlamlı yok;
 * hepsi olgunun KENDİ değerinden türer.
 */
function candidatesFor(displayValue: string): string[] {
  const base = searchable(displayValue);
  if (!base) return [];
  const out = [base];

  /* "Kadıköy, İstanbul" gibi birleşik konum: parçaları da aranır. */
  for (const part of base.split(/\s*[,/·]\s*/u)) {
    const piece = searchable(part);
    if (piece && piece !== base && piece.length >= 2) out.push(piece);
  }

  /* "1.000 adet" / "55 inç": sayı kullanıcının yazdığı hâliyle geçebilir. */
  const numeric = base.match(/^\d[\d.\s]*/u)?.[0];
  if (numeric) {
    const trimmed = searchable(numeric);
    if (trimmed && trimmed !== base) out.push(trimmed);
    const digitsOnly = trimmed.replace(/[.\s]/g, "");
    if (digitsOnly && digitsOnly !== trimmed) out.push(digitsOnly);
  }

  const firstWord = base.split(/\s+/u)[0];
  if (firstWord && firstWord !== base && firstWord.length >= 3) {
    out.push(firstWord);
  }
  return out;
}

function overlaps(
  spans: ReadingSpan[],
  start: number,
  end: number,
): boolean {
  return spans.some((s) => start < s.end && end > s.start);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Bir adayın cümledeki İLK ÇAKIŞMAYAN yerini bulur.
 *
 * Tamamı rakamdan oluşan adaylarda düz arama yetmez: anlama "1000" der,
 * kullanıcı "1.000 adet" yazar (ölçüldü 2026-09-25) ve adet vurgulanmadan
 * kalırdı. Bu yüzden rakam dizileri, aralarında binlik ayracı ya da boşluk
 * bulunabilen bir desenle aranır. Harf içeren adaylarda davranış aynıdır.
 */
function locate(
  folded: string,
  needle: string,
  spans: ReadingSpan[],
): { start: number; end: number } | null {
  const digitsOnly = /^\d+$/.test(needle);
  if (!digitsOnly) {
    let from = 0;
    while (from <= folded.length) {
      const at = folded.indexOf(needle, from);
      if (at < 0) return null;
      if (!overlaps(spans, at, at + needle.length)) {
        return { start: at, end: at + needle.length };
      }
      from = at + 1;
    }
    return null;
  }
  const pattern = new RegExp(
    `(?<!\\d)${needle.split("").map(escapeRegExp).join("[.\\s]?")}(?!\\d)`,
    "g",
  );
  for (const match of folded.matchAll(pattern)) {
    const start = match.index ?? -1;
    if (start < 0) continue;
    const end = start + match[0].length;
    if (!overlaps(spans, start, end)) return { start, end };
  }
  return null;
}

/**
 * Cümledeki vurgu aralıklarını üretir.
 *
 * - Her alan anahtarı EN FAZLA bir kez vurgulanır (aynı marka iki kez
 *   altı çizili görünmez).
 * - Aralıklar çakışmaz; önce gelen kazanır ve olgular uzun değerden kısaya
 *   denenir ki "İstanbul Kadıköy" bütünüyle yakalansın, "Kadıköy" onu
 *   bölmesin.
 * - Bulunamayan olgu sessizce atlanır.
 */
export function buildReadingHighlights(input: {
  text: string;
  facts: readonly ReadingFactInput[];
  /** Vurgulanacak en fazla parça sayısı; okuma anı uzamasın diye sınırlı. */
  limit?: number;
}): ReadingSpan[] {
  const text = input.text ?? "";
  if (!text.trim()) return [];
  const folded = fold(text);
  const limit = input.limit ?? 6;

  const ordered = [...input.facts]
    .filter((fact) => searchable(fact.displayValue ?? "").length >= 2)
    .sort(
      (a, b) =>
        searchable(b.displayValue).length - searchable(a.displayValue).length,
    );

  const spans: ReadingSpan[] = [];
  const usedKeys = new Set<string>();

  for (const fact of ordered) {
    if (usedKeys.has(fact.key)) continue;
    for (const candidate of candidatesFor(fact.displayValue)) {
      const needle = fold(candidate);
      if (needle.length < 2) continue;
      const hit = locate(folded, needle, spans);
      if (!hit) continue;
      spans.push({
        key: fact.key,
        label: fact.label,
        text: text.slice(hit.start, hit.end),
        start: hit.start,
        end: hit.end,
      });
      usedKeys.add(fact.key);
      break;
    }
    if (spans.length >= limit) break;
  }

  return spans.sort((a, b) => a.start - b.start);
}

export type ReadingSegment =
  | { kind: "plain"; text: string }
  | { kind: "entity"; text: string; label: string; key: string; index: number };

/** Vurgu aralıklarını doğrudan render edilebilir parçalara böler. */
export function toReadingSegments(
  text: string,
  spans: readonly ReadingSpan[],
): ReadingSegment[] {
  const segments: ReadingSegment[] = [];
  let cursor = 0;
  spans.forEach((span, index) => {
    if (span.start > cursor) {
      segments.push({ kind: "plain", text: text.slice(cursor, span.start) });
    }
    segments.push({
      kind: "entity",
      text: text.slice(span.start, span.end),
      label: span.label,
      key: span.key,
      index,
    });
    cursor = span.end;
  });
  if (cursor < text.length) {
    segments.push({ kind: "plain", text: text.slice(cursor) });
  }
  return segments;
}
