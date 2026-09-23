# Üç lint uyarısının temizliği — etki incelemesi

Tarih: 14 Eylül 2026. İncelenen çalışma kopyası: company-4plus1-cbd187c; cbd187c tabanı üzerinde önceki 1 Owner + 3 Üye + 1 Analist düzenlemeleri.

Takip notu: Bu rapor temizlik öncesindeki tarihsel ölçümdür. İki eski ödeme testi beklentisi ve yedi test tip hatası daha sonra [ayrı test bakımında](../2026-09-14-test-maintenance/README.md) düzeltildi; kullanılmayan P1 importu da kaldırıldı. Ürün kodundaki `_context` temizliği uygulanmadı. Buradaki yama ve `review.cjs` eski dosya içeriklerini bekler; güncel tekrar çalıştırma komutu takip raporundadır.

## Sonuç

Mevcut çağrı sözleşmesini koruyan temizlikte yeni uygulama tip hatası veya davranış gerilemesi bulunmadı. Üç lint uyarısı kalkıyor. Temizlik uygulama kaynaklarına uygulanmadı; önerilen iki dosyalık değişiklik bellekte denenip [uygulanabilir yama](proposed-cleanup.patch) olarak hazırlandı. git apply --check başarılı.

**Parametreleri doğrudan silmek aynı şey değildir:** ikinci parametreyi kullanan 5 test çağrısı TS2554 üretir. Önerilen düzenleme, ikinci parametreyi kabul eden TypeScript bildirimini korur; çalıştırılan fonksiyon gövdesindeki kullanılmayan parametreyi kaldırır. Fonksiyonların dönüş değerleri ve çalışma anındaki argüman sayısı bilgisi aynıdır.

## İncelenen bağımlılıklar

- getPublicProductLabel ürün kodunda HomeOnePlans, PricingPlans ve FeatureUpgradeGate tarafından çağrılıyor. Üçü de yalnız planı gönderiyor; işlev paket etiketini seçiyor.
- İkinci parametreyle yapılan çağrılar verify-global-panel-visual-system-v1.ts içinde 3, verify-standard-pro-packaging-v1.ts içinde 1 ve verify-two-plan-packaging-v1.ts içinde 1 adet.
- getPublicProduct çağrıları test dosyalarında. ProductContext tipi bu iki işlevin bildirimleri dışında kullanılmıyor; öneride dışa aktarım korunuyor.
- Gerçek firma/kişisel alan ayrımı company-context.ts ve resolve-entitlements.ts üzerinden yapılır. Ödeme sahibi resolve-billing-subject.ts, ödeme yetkisi assert-billing-permission.ts üzerinden belirlenir. Kullanılmayan _context bu yolları yönetmez.
- pinBrowseSemanticContext uygulamada useHybridRequestComposer.ts içinde üç yerde ve başka doğrulayıcılarda kullanılıyor. İşlev ve diğer importları korunur; yalnız verify-p1-closed-beta-closure-v1.ts içindeki kullanılmayan import kaldırılır.
- Importu kaldırılmış P1 testinin üretilen CommonJS JavaScript kodu önceki hâliyle birebir aynı.

## Karşılaştırmalı ölçümler

[Ham sonuçlar](results.json), [lint ve davranış karşılaştırması](inspection.json) ve bütün koşu logları bu klasördedir.

| Kontrol | Temizlik öncesi | Önerilen temizlik |
| --- | --- | --- |
| İki dosyada ESLint | 0 hata, 3 uyarı | 0 hata, 0 uyarı |
| Normal uygulama TypeScript kapsamı | 0 hata | 0 hata |
| Test dosyaları da eklenmiş geniş TypeScript kapsamı | 7 mevcut hata | Aynı 7 hata, 0 yeni hata |
| Dört plan × dört çağrı biçimi × iki fonksiyon | 32 sonuç | 32/32 aynı |
| Firma rolü/koltuk ve erişim kontrolleri | 171/171 | 171/171 |
| Üç paket/görsel sistem doğrulayıcısı | 3 PASS | 3 PASS |
| P1 kapanış | 41/41 | 41/41 |
| Firma/kişisel alan ayrımı | 26/26 | 26/26 |
| Profesyonel firma gelir modeli | PASS | PASS |
| Fiyat/koltuk politikası | 24/24 | 24/24 |
| Eski Phase 4C ödeme doğrulayıcısı | 33 geçti, 2 başarısız | Aynı 33 geçti, aynı 2 başarısız |

13 test grubunun 12'si önce ve sonra geçti. Kalan gruptaki iki eski beklenti aşağıda açıklanıyor; tam geçiş olarak sunulmuyor. Önerilen temizlik için yeni çalışma testi hatası ve yeni tip hatası yok.

Kontrol deneyi olarak parametreler çağrı sözleşmesi korunmadan kaldırıldı: geniş kapsamda hata sayısı 7'den 12'ye çıktı. Beş yeni hata yalnız iki argümanlı çağrılarda TS2554. [Kontrol deneyinin çıktısı](naive-types.json).

## Bu incelemede görülen ayrı test bakım eksikleri

### 1. Önceki rol değişikliğine uyarlanmamış iki ödeme testi

verify-phase4c-billing-v1.ts içindeki 4 ve 14 numaralı kontroller, kaynak metinde ADMIN ve OWNER veya ADMIN ifadelerini arıyor. Önceki 1+3+1 düzenlemesi şirket ödemesini yalnız OWNER'a verdiğinden bu beklentiler geçersiz kaldı. Bu inceleme için yapılan lint temizliğinden önce de sonra da başarısızlar.

Üretim assertCanMutateBilling servisini kullanan bellek testlerinde OWNER kabul edilir; MEMBER, VIEWER, eski ADMIN ve eski MANAGER reddedilir. Firma ayarı, görev atama ve kişisel ödeme ayrımı kontrolleri de geçer. Dolayısıyla bu iki metin beklentisi ödeme yetkisinin bozuk olduğunu göstermiyor. İlgili eski testlerin davranış ölçen kontrollerle güncellenmesi ayrı bakım işidir; bu incelemede değiştirilmediler.

### 2. Normal derlemenin dışındaki test dosyalarında 7 tip hatası

tsconfig.json normalde scripts klasörünü dışlar. İncelemeyi genişletip ilgili testleri tip denetimine eklediğimizde:

- verify-p1-closed-beta-closure-v1.ts: 4 hata — null olabilen kategori/konu değerleri ve generation.label alanı.
- verify-standard-pro-packaging-v1.ts: 1 hata — kaldırılmış Offer Copilot etiketiyle literal tip karşılaştırması.
- verify-two-plan-packaging-v1.ts: 2 hata — kaldırılmış Offer Copilot ve Price Intelligence etiketleriyle literal tip karşılaştırmaları.

[Önceki tip sonuçları](baseline-types.json) ile [önerilen temizlik sonuçları](proposed-types.json) aynı hataları içerir. Bir import satırı kalktığı için P1 satır numaraları bir azalır. Bunlar uygulamanın normal TypeScript kontrolündeki 0 hata sonucu ile çelişmez; daha geniş bir dosya kümesinde ölçülmüştür. Testler transpile edilerek çalıştırıldığında geçiyor. Tip bakım eksikleri bu incelemede düzeltilmedi.

## Kapsam ve tekrar çalıştırma

Uygulama kaynakları değiştirilmedi; iki hedef dosyanın önce/sonra SHA-256 değerleri sonuç kaydında aynıdır. Canlı veritabanı, ödeme sağlayıcısı, bildirim gönderimi, migration, push, merge veya deploy kullanılmadı. Backend testleri üretim işlevlerini ayrılmış bellek kayıtlarıyla çalıştırır. Bu ölçüm canlı ortam uçtan uca testi değildir.

Depo kökünden:

~~~text
node docs/audits/2026-09-14-lint-cleanup-review/review.cjs run
~~~

Çıkış kodu yeni gerileme bulunup bulunmadığını belirtir. Eski başarısız kontroller results.json ve loglarda korunur; bunlar başarıya çevrilmez.
