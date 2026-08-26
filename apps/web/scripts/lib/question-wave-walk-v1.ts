/**
 * SORU DALGASI YÜRÜYÜCÜSÜ — TEK OTORİTE (D1, 2026-08-25).
 *
 * Neden tek modül: bu yürüyüş daha önce `verify-understanding-invariants-v1`
 * içinde private `hybridFullQueue` olarak duruyordu. Soru bastırma ölçümü de
 * aynı yürüyüşe ihtiyaç duyunca iki seçenek vardı: kopyalamak ya da çıkarmak.
 * Kopyalanan yürüyüş iki doğrulayıcının sessizce ayrışmasına yol açardı —
 * biri "review'a kadar" derken diğeri başka bir şeyi kastederdi ve fark
 * kimseye görünmezdi. Bu yüzden mantık buraya taşındı; iki doğrulayıcı da
 * BURAYI kullanır ve ikinci kopya bırakılmaz.
 *
 * DAVRANIŞ SÖZLEŞMESİ (taşımadan önceki private sürümle birebir aynı):
 *   - En çok MAX_WAVES dalga yürünür.
 *   - Her dalgada `resolveHybridQuestions(...).next` okunur; daha önce
 *     görülmemiş anahtarlar o dalganın içeriğidir.
 *   - Boş dalga görülürse review'a ulaşılmış sayılır ve döngü biter.
 *   - Görülen her anahtar, bir sonraki dalgada tekrar çıkmasın diye
 *     SİMÜLASYON amaçlı `EXPLICIT_BROWSE` provenance ile doldurulur.
 *
 * SİMÜLE CEVAP, ALANIN KABUL ETTİĞİ BİR CEVAP OLMALIDIR (D2, 2026-08-26).
 *   Yürüyücü önceden her alana sabit `__ANSWERED__` yazıyordu. Bu değer hiçbir
 *   `select` alanının kanonik seçeneği değildir; `visibleWhen` / `dependsOn`
 *   koşulları onu tanımaz ve o alana bağlı bütün alanlar bir sonraki dalgada
 *   ŞEMADAN DÜŞER. Sonuç: yürüyüş "review'a ulaştı" der, oysa cevaplanabilir
 *   dalgalar tamamlanmadan koşullu bir kapı kapanmıştır. Bu, ölçümü sessizce
 *   iyimser yapar — sorulmayan alanlar "sorulacak alan kalmadı" gibi görünür.
 *
 *   Kural (deterministik, kategoriye özel değil):
 *     1. Alanın o anki değeri kendi kanonik seçenekleri arasındaysa O DEĞER
 *        korunur — yalnız provenance kullanıcı cevabına yükseltilir. Bu,
 *        "kullanıcı önerilen cevabı onayladı" yolunun ta kendisidir.
 *     2. Değilse ve alanın kanonik seçenekleri varsa İLK seçenek yazılır.
 *     3. Seçeneksiz (serbest metin) alanlarda `__ANSWERED__` yazılır.
 *
 * ÖLÇÜM UYARISI — simülasyon artefaktı:
 *   Yürüyücünün doldurduğu değerler GERÇEK kullanıcı cevabı değildir. Kanıt
 *   ölçen bir tüketici bunları kanıt sayarsa kendi simülasyonunu "kullanıcı
 *   böyle yazmış" diye okur. Bu yüzden yürüyücü işaretlediği anahtarları
 *   `simulatedBrowseKeys` olarak AYRICA döndürür ve tüketicinin onları
 *   dışlaması beklenir. Kanıt her zaman YÜRÜYÜŞ ÖNCESİ durumdan okunur.
 */

import {
  classifyAnswerAuthority,
  mayCloseQuestion,
} from "../../src/lib/request-composer/answer-authority";
import { foldLabel } from "../../src/lib/knowledge/slug";
import { syncFromText } from "../../src/lib/request-composer";
import { resolveHybridQuestions } from "../../src/lib/request-composer/questions";
import type { CanonicalRequestState } from "../../src/lib/request-composer/types";

/** Review'a kadar yürünecek en fazla dalga sayısı. */
export const MAX_WAVES = 25;

/** Simülasyon dolgusunun değeri — gerçek bir kullanıcı cevabı DEĞİLDİR. */
export const SIMULATED_ANSWER_VALUE = "__ANSWERED__";

export type QuestionWaveWalkResult = {
  /** İlk dalgada sorulan anahtarlar — FIRST_SCREEN ufku. */
  firstScreen: string[];
  /** Herhangi bir dalgada sorulan anahtarlar, ilk görülme sırasıyla — FULL_QUEUE ufku. */
  asked: string[];
  /** Yürüyüş BAŞLAMADAN önce metinden dolmuş alanlar (anahtar → değer). */
  prefilled: Record<string, string>;
  /**
   * `prefilled`in SORU KAPATMAYA YETKİLİ alt kümesi (KB-17).
   *
   * "Değer var" ile "kullanıcı cevapladı" ayrı eksenlerdir. Kullanıcının
   * yazdığı / seçtiği ya da çağrılabilir bir katalog otoritesinin doğruladığı
   * değer soruyu kapatır; YALNIZ çıkarımdan gelen değer kapatamaz. Bu alt
   * küme, "dolmuş alan tekrar sorulamaz" sözleşmesini ölçen tüketiciler
   * içindir — çıkarımın tekrar sorulması artık DOĞRU davranıştır.
   */
  prefilledUserAnswered: Record<string, string>;
  /** Yürüyücünün simülasyon için doldurduğu anahtarlar — kanıt sayılamaz. */
  simulatedBrowseKeys: string[];
  /** Dalga dalga anahtar listesi. */
  waves: string[][];
  waveCount: number;
  /** Boş dalgayla bittiyse true; MAX_WAVES tavanına çarptıysa false. */
  reachedReview: boolean;
};

/** Soru otoritesinin döndürdüğü alanın yürüyüş için gereken yüzeyi. */
type WalkableField = {
  key: string;
  options?: Array<{ label?: string; value?: string }>;
};

/**
 * Simüle cevabı seçer. Karar sırası modül başlığındaki üç kuraldır; burada
 * kategoriye, anahtara ya da kelimeye özel hiçbir dal YOKTUR.
 */
function simulatedAnswerFor(
  field: WalkableField | undefined,
  working: CanonicalRequestState,
  key: string,
): string {
  const options = (field?.options ?? []).filter(
    (o) => typeof o?.value === "string" && o.value.trim() !== "",
  );
  if (options.length === 0) return SIMULATED_ANSWER_VALUE;

  const current = (working.fields as Record<string, { kind?: string; value?: unknown }>)[key];
  const currentValue =
    current?.kind === "VALUE" && current.value != null
      ? String(current.value)
      : "";
  if (currentValue) {
    const folded = foldLabel(currentValue);
    const hit = options.find(
      (o) =>
        foldLabel(String(o.value)) === folded ||
        (o.label != null && foldLabel(String(o.label)) === folded),
    );
    // Kullanıcı önerilen cevabı onaylamış gibi: DEĞER korunur, kaynak yükselir.
    if (hit) return String(hit.value);
  }
  return String(options[0]!.value);
}

/** Hazır bir durumdan yürü. Verilen durum DEĞİŞTİRİLMEZ; kopya üzerinde çalışılır. */
export function walkQuestionWaves(
  state: CanonicalRequestState,
): QuestionWaveWalkResult {
  const fields = state.fields as Record<
    string,
    { kind?: string; value?: unknown }
  >;
  const prefilled: Record<string, string> = {};
  const prefilledUserAnswered: Record<string, string> = {};
  for (const [k, f] of Object.entries(fields)) {
    if (f?.kind === "VALUE" && f.value != null && String(f.value) !== "") {
      prefilled[k] = String(f.value);
      // Sınıflandırma burada üretilmez; deponun tek cevap otoritesi okunur.
      if (mayCloseQuestion(classifyAnswerAuthority(f))) {
        prefilledUserAnswered[k] = String(f.value);
      }
    }
  }

  const seen = new Set<string>();
  const waves: string[][] = [];
  let reachedReview = false;
  const working = {
    ...state,
    fields: { ...state.fields },
  } as CanonicalRequestState;

  for (let i = 0; i < MAX_WAVES; i += 1) {
    const qr = resolveHybridQuestions(working) as unknown as {
      next?: Array<WalkableField>;
    };
    const offered = qr.next ?? [];
    const wave = offered.map((q) => q.key).filter((k) => !seen.has(k));
    if (wave.length === 0) {
      reachedReview = true;
      break;
    }
    waves.push(wave);
    const offeredByKey = new Map(offered.map((q) => [q.key, q]));
    for (const k of wave) {
      seen.add(k);
      (working.fields as Record<string, unknown>)[k] = {
        kind: "VALUE",
        value: simulatedAnswerFor(offeredByKey.get(k), working, k),
        provenance: "EXPLICIT_BROWSE",
      };
    }
  }

  const asked = [...seen];
  return {
    firstScreen: waves[0] ? [...waves[0]] : [],
    asked,
    prefilled,
    prefilledUserAnswered,
    // Yürüyücü sorulan HER anahtarı işaretler; liste bilerek ayrı döndürülür
    // ki tüketici "kanıt" ile "simülasyon dolgusu"nu karıştırmasın.
    simulatedBrowseKeys: [...asked],
    waves,
    waveCount: waves.length,
    reachedReview,
  };
}

/** Ham metinden yürü — `syncFromText` ile durumu kurar, sonra yürür. */
export function walkQuestionWavesFromText(
  raw: string,
): QuestionWaveWalkResult & { state: CanonicalRequestState } {
  const { state } = syncFromText(null, raw);
  return { ...walkQuestionWaves(state), state };
}
