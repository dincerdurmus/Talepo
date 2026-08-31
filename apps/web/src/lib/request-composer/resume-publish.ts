import type { RequestScope } from "../request-understanding/types";
import { isUnsupportedRequestScope } from "../request-understanding/types";

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
 * İKİ AYRI ENGEL, İKİ AYRI SONUÇ (ECC denetimi, 2026-08-26).
 *
 * 1. **Eksik alan denemeyi İPTAL ETMEZ.** Bütçe, konum ya da kritik soru
 *    eksikliği bu kararın girdisi değildir: eksik alan, denemeyi iptal etme
 *    sebebi değil, denemenin kullanıcıya göstereceği rehberliğin ta
 *    kendisidir. Deneme başlar ve yayın kapısı eksikleri rehberliğe çevirir.
 *
 * 2. **Kapsam dışı talep yayın yoluna HİÇ girmez.** Arz ilanında
 *    (`UNSUPPORTED_SUPPLY`) review de publish de açılmaz; bu, `canReview`
 *    üzerinden tesadüfen değil, kurucu kararı olarak açıkça uygulanır
 *    (bkz. `v2/publish-readiness.ts`, "KAPSAM KAPISI HER ŞEYDEN ÖNCE
 *    GELİR"). Sunucudaki kapı bağımsız olarak ayrıca çalışır; burası
 *    istemcinin bile bile geçersiz bir istek göndermesini engeller ve
 *    kullanıcıyı yayınlanamayacak bir yolda yürütmez. Kapsam kararı bu
 *    dosyanın kendi listesinden değil, anlama katmanının kanonik
 *    `RequestScope` otoritesinden gelir.
 */

export type ResumePublishAction =
  /** Henüz hazır değil. Latch AÇIK kalır; sonraki turda yeniden sorulur. */
  | { kind: "wait"; reason: ResumePublishWaitReason; closeLatch: false }
  /**
   * Kapsam dışı. Latch KAPANIR — aksi hâlde her senkronizasyonda yeniden
   * tetiklenir — ama yayın denemesi BAŞLATILMAZ. Kullanıcı bestecinin
   * kapsam dışı rehberliğini görmeye devam eder ve metnini düzenleyerek
   * geçerli bir talebe çevirebilir.
   */
  | { kind: "blocked"; reason: "out_of_scope"; closeLatch: true }
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
  /**
   * Anlama katmanının kanonik kapsam kararı. Sindirme bitmeden güvenilir
   * olmadığı için kapsam dalı metin eşitliğinden SONRA değerlendirilir.
   */
  requestScope: RequestScope | null | undefined;
};

export type ResumePublishHandlers = {
  /** Latch'i söndürür. Yalnız karar bunu istediğinde çağrılır. */
  closeLatch: () => void;
  /**
   * Yayın denemesini başlatır. Senkron ya da asenkron olabilir; her iki
   * hâlde de hata `onAttemptFailed`'e yönlendirilir.
   */
  attemptPublish: () => void | Promise<void>;
  /**
   * Deneme başarısız olduğunda çağrılır. Hata SESSİZCE YUTULMAZ: çağıran
   * taraf kullanıcıya görünür bir hata ya da rehberlik göstermek
   * zorundadır. Latch bilerek geri açılmaz — otomatik tekrar sonsuz
   * döngüye döner; kullanıcının kendi yeniden deneme yolu açık kalır.
   */
  onAttemptFailed: (error: unknown) => void;
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
  if (isUnsupportedRequestScope(input.requestScope)) {
    return { kind: "blocked", reason: "out_of_scope", closeLatch: true };
  }
  return { kind: "attempt", closeLatch: true };
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/**
 * Kararı uygular. Latch yalnız karar bunu istediğinde kapanır, böylece
 * beklerken niyet kaybolmaz ve denemeden sonra ikinci kez tetiklenmez.
 * Başarısız deneme — senkron hata ya da reddedilen Promise — sessizce
 * yutulmaz, `onAttemptFailed` üzerinden çağırana bildirilir.
 */
export function applyResumePublishAction(
  action: ResumePublishAction,
  handlers: ResumePublishHandlers,
): void {
  if (action.kind === "wait") return;

  handlers.closeLatch();
  if (action.kind === "blocked") return;

  try {
    const result = handlers.attemptPublish();
    if (isPromiseLike(result)) {
      result.then(undefined, handlers.onAttemptFailed);
    }
  } catch (error) {
    handlers.onAttemptFailed(error);
  }
}
