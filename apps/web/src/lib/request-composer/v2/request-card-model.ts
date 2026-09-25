/**
 * TALEP KARTI = FORMUN KENDİSİ (kurucu kararı, 2026-09-25).
 *
 * Yeni /talep tasarımında ayrı bir "bilgiler" panosu yoktur: anlaşılan her
 * bilgi kartta bir SATIRDIR, eksik olan da aynı kartta "sorulacak" satırı
 * olarak durur. Kullanıcı satıra dokunduğunda o alanın kanonik sorusu açılır.
 *
 * NEDEN SAF BİR MODÜL. Doluluk çubuğu ("3/4 bilgi") bir SAYIDIR ve sayı
 * yalan söyleyebilir. Satır listesi JSX içinde kurulsaydı, çubuğun paydası
 * ile ekranda görünen satır sayısının ayrışması sessizce mümkün olurdu.
 * Burada tek kural geçerli: ÇUBUK TAM OLARAK RENDER EDİLEN SATIRLARI SAYAR —
 * `totalCount === rows.length`, `filledCount === filled satır sayısı`.
 *
 * SINIR — NE YAPMAZ. Soru üretmez, sıralamaz, hangi sorunun zorunlu
 * olduğuna karar vermez. Girdisi zaten kanonik olan iki listedir: anlaşılan
 * olgular (`buildUnderstoodFacts` → `enrichUnderstoodFacts`) ve zamanlayıcının
 * görünür soruları (`scheduleComposerQuestions`). Soru otoritesi değişmez.
 */

export type RequestCardFact = {
  key: string;
  label: string;
  displayValue: string;
};

export type RequestCardQuestion = {
  fieldKey: string;
  label?: string;
  summaryLabel?: string;
};

export type RequestCardOptionalField = {
  key: string;
  label: string;
};

export type RequestCardRowState = "filled" | "asking" | "pending";

export type RequestCardRow = {
  key: string;
  label: string;
  /** Dolu satırın değeri; eksik satırda `null`. */
  value: string | null;
  state: RequestCardRowState;
  /** Satıra dokunmak o alanın sorusunu açabiliyorsa true. */
  askable: boolean;
};

export type RequestCardModel = {
  rows: RequestCardRow[];
  filledCount: number;
  totalCount: number;
  /**
   * "İstersen ekle, teklifler netleşir" chip'leri. YALNIZ kategori şemasından
   * gelir ve yalnız zorunlu bilgi kalmadığında dolar; şema opsiyonel alan
   * vermiyorsa liste boştur ve bölüm hiç çizilmez.
   */
  extras: RequestCardOptionalField[];
};

/** Kartta en fazla kaç DOLU satır gösterilir. Eksik satırlar hiç kırpılmaz. */
const DEFAULT_MAX_FILLED_ROWS = 6;

/**
 * KIRPMA SIRASI — ÇEKİRDEK ALANLAR ÖNCE (ölçüldü 2026-09-25, tarayıcıda).
 *
 * Kart satır üstü sınırına dayandığında olgular geliş sırasına göre
 * kırpılıyordu ve "Şehir" satırı, "Net hacim" gibi ikincil bir nitelik uğruna
 * karttan düşüyordu. Oysa konum ve bütçe yayının ÖN KOŞULU; tedarikçinin ilk
 * baktığı iki satır onlar. Sıra burada, tek yerde tanımlanır: listede olan
 * alan önce gelir, olmayanlar kendi aralarında geliş sırasını korur.
 */
const CORE_ROW_ORDER = [
  "productType",
  "brand",
  "model",
  "quantity",
  "city",
  "budget",
] as const;

function corePriority(key: string): number {
  const index = CORE_ROW_ORDER.indexOf(key as (typeof CORE_ROW_ORDER)[number]);
  return index === -1 ? CORE_ROW_ORDER.length : index;
}

function normalizeLabel(value: string | undefined, fallback: string): string {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export function buildRequestCardModel(input: {
  facts: readonly RequestCardFact[];
  questions: readonly RequestCardQuestion[];
  /** Şu an ekranda sorulan alan — satırı "şimdi soruluyor" olur. */
  askingFieldKey?: string | null;
  optionalFields?: readonly RequestCardOptionalField[];
  /** Cevaplanmış / atlanmış opsiyonel alanlar chip listesinden düşer. */
  answeredFieldKeys?: readonly string[];
  maxFilledRows?: number;
}): RequestCardModel {
  const maxFilled = input.maxFilledRows ?? DEFAULT_MAX_FILLED_ROWS;
  const rows: RequestCardRow[] = [];
  const seen = new Set<string>();

  /**
   * Kırpma kararı SIRALAMADAN önce verilir: önce hangi olguların kartta
   * duracağı seçilir (çekirdek alanlar öncelikli), sonra satırlar olguların
   * KENDİ geliş sırasında yazılır — kart her render'da aynı görünür.
   */
  const candidates: RequestCardFact[] = [];
  const candidateKeys = new Set<string>();
  for (const fact of input.facts) {
    const value = (fact.displayValue ?? "").trim();
    if (!value || candidateKeys.has(fact.key)) continue;
    candidateKeys.add(fact.key);
    candidates.push(fact);
  }
  const kept = new Set(
    candidates
      .map((fact, index) => ({ fact, index }))
      .sort(
        (a, b) =>
          corePriority(a.fact.key) - corePriority(b.fact.key) ||
          a.index - b.index,
      )
      .slice(0, maxFilled)
      .map((entry) => entry.fact.key),
  );

  for (const fact of candidates) {
    seen.add(fact.key);
    if (!kept.has(fact.key)) continue;
    rows.push({
      key: fact.key,
      label: normalizeLabel(fact.label, fact.key),
      value: fact.displayValue.trim(),
      state: "filled",
      askable: true,
    });
  }

  const filledCount = rows.length;

  for (const question of input.questions) {
    if (!question.fieldKey) continue;
    if (seen.has(question.fieldKey)) continue;
    seen.add(question.fieldKey);
    rows.push({
      key: question.fieldKey,
      label: normalizeLabel(
        question.summaryLabel ?? question.label,
        question.fieldKey,
      ),
      value: null,
      state:
        input.askingFieldKey && input.askingFieldKey === question.fieldKey
          ? "asking"
          : "pending",
      askable: true,
    });
  }

  /**
   * Ek alan chip'leri yalnız eksik satır kalmadığında görünür: kullanıcıya
   * önce zorunlu olan sorulur, "istersen ekle" ondan sonra gelir.
   */
  const answered = new Set(input.answeredFieldKeys ?? []);
  /**
   * ETİKET DÜZEYİNDE TEKİLLEŞTİRME. Aynı bilgi iki ayrı anahtarla gelebilir
   * (soru profili + kategori şeması); kullanıcı "Enerji sınıfı"nı üç kez
   * görmemeli. Anahtar tekilliği yetmez, gösterilen etiket de tekil olmalı.
   */
  const seenLabels = new Set<string>();
  const extras =
    rows.length > 0 && filledCount === rows.length
      ? (input.optionalFields ?? []).filter((field) => {
          if (!field.key || seen.has(field.key) || answered.has(field.key)) {
            return false;
          }
          const label = normalizeLabel(field.label, "");
          if (!label) return false;
          const id = label.toLocaleLowerCase("tr-TR");
          if (seenLabels.has(id)) return false;
          seenLabels.add(id);
          return true;
        })
      : [];

  return {
    rows,
    filledCount,
    totalCount: rows.length,
    extras: extras.slice(0, 6),
  };
}
