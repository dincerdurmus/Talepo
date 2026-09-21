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
import { createJevDecisionProvider } from "./jev";
import type { JevDecisionBundle } from "./jev";
import type { RequestDecisionProvider } from "./contract";

const builtinProvider: RequestDecisionProvider = createBuiltinDecisionProvider();

/**
 * ÜRETİMDE KARAR VEREN SAĞLAYICI — 2026-09-21 itibarıyla hâlâ yerleşik motor.
 *
 * Jev (TypeSafe System One) ölçüldü ve sözleşmenin arkasına kuruldu, ama bu
 * satır DEĞİŞTİRİLMEDİ. Sebep S-16 kapsam kuralıdır: üretimdeki karar
 * sağlayıcısını değiştirmek bir davranış değişikliğidir, sıradan bir commit
 * değil — 1077 birebir çıksa bile ayrı ve açık onay ister. Geçiş tek kelimedir
 * ve KOD'dur (D-0027: sağlayıcı seçimi yapılandırma değildir):
 * `USE_JEV_IN_PRODUCTION` true yapılır ve istek yolunda bundle beslenir.
 *
 * Ölçüm: Veyra/projects/talepo/SONUC-KAPSAM-TASARIM-2026-09-21.md (D-0029).
 * Kapı: verify-jev-decision-provider-v1 — Jev'i yerleşik motorla aynı 1077
 * vakada yan yana koşar. O kapı yeşile bağlanmadan bu bayrak açılmaz.
 */
const USE_JEV_IN_PRODUCTION = false;

export function getRequestDecisionProvider(): RequestDecisionProvider {
  return builtinProvider;
}

/**
 * DEMET ÇEKİLMELİ Mİ — AYNI TEK ANAHTARDAN OKUNUR (2026-09-21).
 *
 * API sınırındaki çekim, sağlayıcı seçimiyle AYNI kararın parçasıdır: bayrak
 * kapalıyken ağ çağrısı yapmak hem para hem gecikme harcar, üstelik hiçbir
 * karara dönüşmez. Bu yüzden burada İKİNCİ bir bayrak tanımlanmaz; çekim
 * kapısı `USE_JEV_IN_PRODUCTION`'ı okur. Geçiş hâlâ tek kelimedir: o satır
 * true olduğu an hem demet çekilir hem sağlayıcı devreye girer, iki yeri
 * birbirine göre güncelleme borcu doğmaz.
 */
export function shouldFetchJevBundle(): boolean {
  return USE_JEV_IN_PRODUCTION;
}

/**
 * İSTEK BAŞINA SAĞLAYICI — Jev demeti API sınırında BİR KEZ çekilir
 * (bkz. jev/jev-provider.ts, senkron sözleşme gerekçesi) ve buraya verilir.
 * Demet yoksa ya da bayrak kapalıysa yerleşik motor karar verir: bir karar
 * servisinin düşmesi talebin kaybolması değildir.
 */
export function getRequestDecisionProviderForRequest(
  bundle: JevDecisionBundle | null,
): RequestDecisionProvider {
  if (!USE_JEV_IN_PRODUCTION) return builtinProvider;
  return createJevDecisionProvider({ bundle, fallback: builtinProvider });
}
