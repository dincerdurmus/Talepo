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
 * ÖLÇÜM UYARISI — simülasyon artefaktı:
 *   Yürüyücünün doldurduğu `__ANSWERED__` değerleri GERÇEK kullanıcı cevabı
 *   değildir. Kanıt ölçen bir tüketici bunları kanıt sayarsa kendi
 *   simülasyonunu "kullanıcı böyle yazmış" diye okur. Bu yüzden yürüyücü
 *   işaretlediği anahtarları `simulatedBrowseKeys` olarak AYRICA döndürür ve
 *   tüketicinin onları dışlaması beklenir.
 */

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
  /** Yürüyücünün simülasyon için doldurduğu anahtarlar — kanıt sayılamaz. */
  simulatedBrowseKeys: string[];
  /** Dalga dalga anahtar listesi. */
  waves: string[][];
  waveCount: number;
  /** Boş dalgayla bittiyse true; MAX_WAVES tavanına çarptıysa false. */
  reachedReview: boolean;
};

/** Hazır bir durumdan yürü. Verilen durum DEĞİŞTİRİLMEZ; kopya üzerinde çalışılır. */
export function walkQuestionWaves(
  state: CanonicalRequestState,
): QuestionWaveWalkResult {
  const fields = state.fields as Record<
    string,
    { kind?: string; value?: unknown }
  >;
  const prefilled: Record<string, string> = {};
  for (const [k, f] of Object.entries(fields)) {
    if (f?.kind === "VALUE" && f.value != null && String(f.value) !== "") {
      prefilled[k] = String(f.value);
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
      next?: Array<{ key: string }>;
    };
    const wave = (qr.next ?? []).map((q) => q.key).filter((k) => !seen.has(k));
    if (wave.length === 0) {
      reachedReview = true;
      break;
    }
    waves.push(wave);
    for (const k of wave) {
      seen.add(k);
      (working.fields as Record<string, unknown>)[k] = {
        kind: "VALUE",
        value: SIMULATED_ANSWER_VALUE,
        provenance: "EXPLICIT_BROWSE",
      };
    }
  }

  const asked = [...seen];
  return {
    firstScreen: waves[0] ? [...waves[0]] : [],
    asked,
    prefilled,
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
