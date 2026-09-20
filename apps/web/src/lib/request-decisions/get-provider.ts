/**
 * KARAR SAĞLAYICISI ERİŞİMİ — kod olarak seçim, yapılandırma olarak değil
 * (2026-09-20).
 *
 * Bilerek YOK olanlar (kurucu onaylı görev tanımı, 2026-09-19): feature
 * flag, ortam değişkeni, capability registry, cache, gölge sağlayıcı.
 * Bugün tek sağlayıcı vardır ve seçim bu dosyada KODDUR. İkinci bir
 * sağlayıcı (ör. model tabanlı bir karar servisi) geldiğinde buraya kendi
 * kararı ve kendi ölçümüyle eklenir; tüketiciler (Single Brain) değişmez —
 * mimarinin doğruluk kanıtı tam olarak budur.
 */
import { createBuiltinDecisionProvider } from "./builtin-provider";
import type { RequestDecisionProvider } from "./contract";

const builtinProvider: RequestDecisionProvider = createBuiltinDecisionProvider();

export function getRequestDecisionProvider(): RequestDecisionProvider {
  return builtinProvider;
}
