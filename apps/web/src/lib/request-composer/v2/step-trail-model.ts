/**
 * KATLANAN İZ — CEVAPLANAN ADIMIN TEK SATIRLIK KAYDI (kurucu, 2026-09-27).
 *
 * Kurucunun cümlesi: "Kadıköy'de … arıyorum yazdı, gönderdi, başka bir soru
 * sekmesi açıldı ya — tekrar geriye dönmesi için biraz farklı bir tasarım
 * yap." D-0047'de cevaplanan adım yumuşak kapanıyor ve geri dönüş yolu kart
 * satırıydı; kart satırı KALIR ama artık tek başına değil. Kapanan adım aktif
 * adımın ÜSTÜNDE tek satırlık bir İZE katlanır ve iz sırası kullanıcının
 * yolunu anlatır: cümlesi → kategori → bütçe.
 *
 * NEDEN SAF BİR MODÜL. İz listesi "kullanıcı ne yaptı" sorusunun cevabıdır ve
 * bu cevap YALAN SÖYLEYEBİLİR: JSX içinde kurulsaydı, ekranda görünen iz
 * sayısı ile gerçekten cevaplanmış adım sayısının ayrışması sessizce mümkün
 * olurdu. Burada tek kural geçerli: `entries` kullanıcının kapattığı
 * adımlardır, `visible` onların bir ALT KÜMESİDİR ve `foldedCount` tam olarak
 * `entries.length - visible.length`'tir.
 *
 * SINIR — NE YAPMAZ. Soru üretmez, sıralamaz, zorunluluk ya da yayın kararı
 * vermez, kategori kararına dokunmaz. Girdisi zaten kanonik olan üç şeydir:
 * kullanıcının metni, kategori kararının kart yüzeyinde gösterilen etiketi ve
 * `buildRequestCardModel`ın ürettiği satırlar. İkinci bir etiket listesi,
 * ikinci bir değer biçimleyici YOKTUR.
 *
 * ADI OLMAYAN İZ YAZILMAZ. Bir alanın kanonik etiketi çözülemiyorsa o adım ize
 * girmez — ham alan anahtarı ("subcategorySlug") kullanıcıya gösterilmez.
 */

/** Aynı anda açık duran en fazla iz sayısı; fazlası "+N adım"a toplanır. */
export const TRAIL_VISIBLE_MAX = 2;

/**
 * İz gövdesinin üst sınırı. Cümle izi kullanıcının kendi cümlesidir ve uzun
 * olabilir; iz TEK SATIRDIR, bu yüzden metin burada deterministik olarak
 * kısaltılır. Kısaltma CSS'e bırakılmaz: erişilebilir ad da aynı metni
 * taşıdığı için ekran okuyucu üç paragraf okumasın.
 */
export const TRAIL_VALUE_MAX_CHARS = 120;

/** Cümle ve kategori izlerinin kararlı anahtarları (alan anahtarı değildir). */
export const TRAIL_SENTENCE_KEY = "__sentence__";
export const TRAIL_CATEGORY_KEY = "__category__";

export type StepTrailKind = "sentence" | "category" | "answer";

export type StepTrailEntry = {
  /** İz düğmesinin `data-trail-key` değeri; odak devri bunu arar. */
  key: string;
  kind: StepTrailKind;
  /** Solda duran kısa ad ("Kategori", "Bütçe"); cümle izinde yoktur. */
  label: string | null;
  /** İzin gövdesi: kullanıcının cümlesi ya da kaydedilen değer. */
  value: string | null;
  /** Ekran okuyucu adı — "Değiştir: Bütçe, 60 bin TL". */
  accessibleLabel: string;
  /**
   * İz YERİNDE açılır mı? Kategori ve cevap izleri katlanmanın tersini yapar:
   * adım bloğu izin durduğu yerde açılır. Cümle izi bugünkü "Cümlemi düzenle"
   * yolunu kullanır — başlangıç ekranına döner, yerinde açılmaz.
   */
  opensInPlace: boolean;
};

export type StepTrailModel = {
  /** Kullanıcının yolu, kapanma sırasında. */
  entries: StepTrailEntry[];
  /** Ekranda açık duran izler (son `visibleMax` tanesi ya da hepsi). */
  visible: StepTrailEntry[];
  /** "+N adım" satırının N'i. `entries.length - visible.length`. */
  foldedCount: number;
};

export type StepTrailAnswerInput = {
  key: string;
  label?: string | null;
  value?: string | null;
};

function tekSatir(value: string | null | undefined): string | null {
  const flat = (value ?? "").replace(/\s+/gu, " ").trim();
  if (!flat) return null;
  if (flat.length <= TRAIL_VALUE_MAX_CHARS) return flat;
  return `${flat.slice(0, TRAIL_VALUE_MAX_CHARS - 1).trimEnd()}…`;
}

function girdi(
  key: string,
  kind: StepTrailKind,
  label: string | null | undefined,
  value: string | null | undefined,
  opensInPlace: boolean,
): StepTrailEntry | null {
  const ad = tekSatir(label);
  const deger = tekSatir(value);
  /*
    Ne adı ne değeri olan bir iz kullanıcıya hiçbir şey söylemez ve dokunulacak
    boş bir satır bırakır; yazılmaz.
  */
  if (!ad && !deger) return null;
  return {
    key,
    kind,
    label: ad,
    value: deger,
    accessibleLabel: `Değiştir: ${[ad, deger].filter(Boolean).join(", ")}`,
    opensInPlace,
  };
}

export function buildStepTrail(input: {
  /** Kullanıcının kendi cümlesi — ilk iz. */
  sentence?: string | null;
  /** Kategori kararı kart yüzeyinde güvenle gösteriliyorsa etiketi. */
  category?: { label: string; value: string | null } | null;
  /** Cevaplanan alanlar, CEVAPLANMA sırasında. */
  answers?: readonly StepTrailAnswerInput[];
  /** "+N adım" açıldı mı? Açıksa bütün izler görünür. */
  expanded?: boolean;
  visibleMax?: number;
}): StepTrailModel {
  const entries: StepTrailEntry[] = [];

  const cumle = girdi(
    TRAIL_SENTENCE_KEY,
    "sentence",
    null,
    input.sentence,
    false,
  );
  if (cumle) entries.push(cumle);

  if (input.category) {
    const kategori = girdi(
      TRAIL_CATEGORY_KEY,
      "category",
      input.category.label,
      input.category.value,
      true,
    );
    if (kategori) entries.push(kategori);
  }

  const gorulen = new Set<string>([TRAIL_SENTENCE_KEY, TRAIL_CATEGORY_KEY]);
  for (const answer of input.answers ?? []) {
    if (!answer.key || gorulen.has(answer.key)) continue;
    gorulen.add(answer.key);
    const iz = girdi(answer.key, "answer", answer.label, answer.value, true);
    if (iz) entries.push(iz);
  }

  const max = Math.max(input.visibleMax ?? TRAIL_VISIBLE_MAX, 1);
  const visible =
    input.expanded === true || entries.length <= max
      ? entries
      : entries.slice(entries.length - max);

  return { entries, visible, foldedCount: entries.length - visible.length };
}
