/**
 * Doğrulayıcılar için ÜÇÜNCÜ durum: "ölçemedim" (kurucu, 2026-08-23 — KB-7).
 *
 * Kural: "ölçemedim" ile "ölçtüm, bozuk" ASLA aynı renge boyanmaz.
 *
 * Neden tek modül: kural tek cümlelik ama her doğrulayıcıda yeniden yazılırsa
 * her biri kendi yorumunu uydurur ve kural ölçülemez hâle gelir. Eşik ve
 * sınıflandırma burada tanımlıdır, doğrulayıcılar yalnız kullanır — davranışı
 * verify-understanding-invariants-v1 (I14) sınar.
 *
 * Arka plan: verify-request-publish-v1 veritabanı yokken `check(..., false)`
 * çağırıyordu. Bu, yayınlama kodu hakkında sahip olmadığımız bir bilgiyi
 * iddia etmek ve kırmızı sayısını sahte biçimde şişirmekti — çalışmayan bir
 * ölçüm, başarısız bir ölçüm değildir.
 */

/**
 * Çıkış kodu sözleşmesi:
 *   0                  = ölçülebilen her kontrol geçti, ölçülemeyen yok
 *   1                  = en az bir kontrol GERÇEKTEN başarısız
 *   NOT_MEASURED_EXIT  = hiç hata yok ama en az bir kontrol ölçülemedi
 *
 * Ayrı bir kod, çünkü CI'da "yeşil" ile "ölçemedik" farklı kararlar gerektirir:
 * biri yayınlanabilir, diğeri kanıt eksikliğidir.
 */
export const NOT_MEASURED_EXIT = 3;

/**
 * Ulaşılamayan veritabanı mı, yoksa gerçek bir kusur mu?
 *
 * YALNIZ bağlantı düzeyindeki hatalar ölçülemez sayılır. Prisma'nın doğrulama
 * ve kısıt hataları (P2002 benzersizlik ihlali, P2025 kayıt yok) ölçülmüş
 * sonuçlardır ve FAIL kalmalıdır — yoksa bu dal gerçek hataları yutan bir
 * kaçış deliğine dönüşür ve kuralın kendisi zararlı olur.
 */
export function isUnreachableDatabase(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const raw = error as { errorCode?: unknown; code?: unknown };
  const code = String(raw.errorCode ?? raw.code ?? "");

  // P1000 auth, P1001 unreachable, P1002 timeout, P1017 connection closed.
  // P2xxx BİLEREK dışarıda: onlar veritabanının verdiği gerçek cevaplardır.
  if (/^P100[0-2]$|^P1017$/.test(code)) return true;
  if (/^(ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EHOSTUNREACH|ECONNRESET)$/.test(code)) {
    return true;
  }
  return /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EHOSTUNREACH|ECONNRESET|Can't reach database server|connection closed|Connection refused/i.test(
    error.message,
  );
}

/** Ölçülemeyen kontrolleri sayan küçük defter. */
export type NotMeasuredTally = {
  count: number;
  reasons: string[];
  record: (name: string, reason: string) => void;
  /** Hata YOKKEN uygun çıkış kodu: ölçülemeyen varsa 3, yoksa 0. */
  exitCode: () => number;
};

export function createNotMeasuredTally(
  log: (line: string) => void = console.log,
): NotMeasuredTally {
  const reasons: string[] = [];
  return {
    get count() {
      return reasons.length;
    },
    reasons,
    record(name, reason) {
      const msg = `${name}: ${reason}`;
      reasons.push(msg);
      log(`NOT-MEASURED — ${msg}`);
    },
    exitCode() {
      return reasons.length > 0 ? NOT_MEASURED_EXIT : 0;
    },
  };
}
