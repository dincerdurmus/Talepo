/**
 * ÜYELİK DÖNÜŞÜ YAYIN NİYETİ — SAF KARAR (2026-08-26).
 *
 * NEDEN VAR. Anonim kullanıcı talebini yazıp "yayınla" dediğinde üyelik
 * adımına yönlendirilir; taslağı ve yayınlama niyeti localStorage'a
 * bırakılır. Dönüşte niyet bir latch (`pending`) olarak geri yüklenir ve
 * anlama motoru metni sindirir sindirmez tek bir yayın denemesi başlar.
 *
 * BU DOSYA NEDEN AYRI. Karar daha önce sayfanın effect gövdesinde, React
 * state'ine gömülü hâlde duruyordu ve test edilemiyordu. Orada sessiz bir
 * kusur barındırıyordu: bütçe ya da konum eksikse latch söndürülüyor ama
 * hiçbir deneme başlatılmıyordu; kullanıcı yayınlama niyetiyle üye olup
 * geri döndüğünde ne yayın ne de eksik alan rehberliği görüyordu. Niyet
 * sessizce kayboluyordu.
 *
 * KURAL. Hazır olma kararı YALNIZ metnin sindirilmiş olmasına bakar.
 * Talebin yayına uygun olup olmadığı (bütçe, konum, kritik sorular) bu
 * kararın girdisi DEĞİLDİR: eksik alan, denemeyi iptal etme sebebi değil,
 * denemenin kullanıcıya göstereceği rehberliğin ta kendisidir.
 */

export type ResumePublishAction =
  /** Henüz hazır değil. Latch AÇIK kalır; sonraki turda yeniden sorulur. */
  | { kind: "wait"; reason: ResumePublishWaitReason; closeLatch: false }
  /** Hazır. Latch KAPANIR ve tek bir yayın denemesi başlatılır. */
  | { kind: "attempt"; closeLatch: true };

export type ResumePublishWaitReason =
  | "not_pending"
  | "syncing"
  | "text_not_digested";

export type ResumePublishInput = {
  /** Üyelik dönüşünde geri yüklenen yayınlama niyeti (latch). */
  pending: boolean;
  /** Anlama motoru hâlâ metni sindiriyor mu? */
  isSyncing: boolean;
  /** Anlama motorunun üzerinde çalıştığı metin. */
  understandingRawInput: string | null | undefined;
  /** Kullanıcının o an düzenlemekte olduğu metin. */
  composerText: string;
};

export function decideResumePublishAction(
  input: ResumePublishInput,
): ResumePublishAction {
  if (!input.pending) {
    return { kind: "wait", reason: "not_pending", closeLatch: false };
  }
  if (input.isSyncing) {
    return { kind: "wait", reason: "syncing", closeLatch: false };
  }
  if ((input.understandingRawInput ?? "").trim() !== input.composerText.trim()) {
    return { kind: "wait", reason: "text_not_digested", closeLatch: false };
  }
  return { kind: "attempt", closeLatch: true };
}

/**
 * Kararı uygular. Latch yalnız gerçek deneme başlatılırken kapanır, böylece
 * beklerken niyet kaybolmaz ve denemeden sonra ikinci kez tetiklenmez.
 */
export function applyResumePublishAction(
  action: ResumePublishAction,
  handlers: { closeLatch: () => void; attemptPublish: () => void },
): void {
  if (action.kind !== "attempt") return;
  handlers.closeLatch();
  handlers.attemptPublish();
}
