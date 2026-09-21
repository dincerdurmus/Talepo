/**
 * TAKSONOMİ DIŞI TALEP — "geçerli talep, ama 11 kökten hiçbiri" (2026-09-21).
 *
 * NEDEN VAR. Bugüne kadar kategori kararının iki hâli vardı: bir kök seçildi,
 * ya da karar UNKNOWN'a düştü. UNKNOWN iki AYRI durumu aynı kutuya koyuyordu:
 *   (a) "iki kök arasında kaldım" — ölçemedim,
 *   (b) "ölçtüm, Talepo'nun 11 kökünde bunun satıldığı yer yok" — ölçtüm, yok.
 * (b) bir başarısızlık değil, bir BULGUDUR: kullanıcının gerçek bir talebi var
 * ve taksonomimizde karşılığı yok. Onu en yakın köke zorlamak talebi yanlış
 * yere yönlendirir; reddetmek ise talebi kaybeder. Doğrusu: kabul et, taksonomi
 * dışı olarak işaretle, talep havuzunda tut.
 *
 * Bu ayrım I14'ün ("ölçemedim" ≠ "ölçtüm, yok") kategori eksenindeki
 * karşılığıdır ve depoda zaten kullanılan kanıt-etiketi deyimiyle taşınır;
 * UnderstandingDecision'a yeni alan eklenmez, DecisionStatus genişletilmez —
 * eski tüketiciler etkilenmez, karar hâlâ "kök yok" olarak okunur.
 *
 * TEK YETKİLİ BURASIDIR. Etiketi elle yazan ikinci bir yer olmamalı.
 */
import type { UnderstandingDecision } from "@/lib/request-understanding/types";

/** Kanıt etiketi — kararın "ölçtüm, kök yok" hâlini işaretler. */
export const OUT_OF_TAXONOMY_EVIDENCE = "out-of-taxonomy" as const;

/** Talebin hangi kökte olmadığı değil, HİÇBİR kökte olmadığı kararı. */
export function markOutOfTaxonomy(
  confidence: number,
  evidence: string[] = [],
): UnderstandingDecision<string> {
  return {
    value: null,
    confidence,
    status: "UNKNOWN",
    evidence: [OUT_OF_TAXONOMY_EVIDENCE, ...evidence],
  };
}

/**
 * "Bu karar, kök bulunamadığı için değil, kök OLMADIĞI için boş" mu?
 * Yayın kapısı, soru motoru ve taksonomi biriktirme kuyruğu bunu okur.
 */
export function isOutOfTaxonomy(
  decision: Pick<UnderstandingDecision<string>, "evidence"> | null | undefined,
): boolean {
  return decision?.evidence?.includes(OUT_OF_TAXONOMY_EVIDENCE) ?? false;
}
