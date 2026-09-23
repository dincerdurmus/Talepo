# Ayrı test bakımı — 14 Eylül 2026

Çalışma kopyası: `company-4plus1-cbd187c`. Taban: `cbd187c55bd0d87ef56ae97d06e9b09af939f556`; önceki 1 Owner + 3 Üye + 1 Analist düzenlemeleri korunmuştur.

Önceki [lint etki incelemesinde](../2026-09-14-lint-cleanup-review/README.md) görülen iki eski ödeme testi beklentisi ve yedi test tip hatası düzeltildi. Bu bakım sırasında uygulama veya backend davranışı değiştirilmedi.

## Yapılan düzeltmeler

- `verify-phase4c-billing-v1.ts`: 4 ve 14 numaralı kontroller kaynak metninde ADMIN veya hata mesajı aramak yerine gerçek `canMutateCompanyBilling` işlevini çalıştırıyor. OWNER kabul ediliyor; MEMBER, VIEWER, eski ADMIN/MANAGER ve geçersiz roller reddediliyor. Gerçek `assertCanMutateBilling` servisinin de aynı kuralı uyguladığı mevcut firma yetki testleriyle doğrulandı.
- `verify-p1-closed-beta-closure-v1.ts`: eksik kategori açık hata üretiyor; nullable konu değerleri yalnız hata ayrıntısında `UNRESOLVED` olarak gösteriliyor; katalogdaki mevcut `generation.name` alanı kullanılıyor. PART beklentileri korunuyor. Kullanılmayan `pinBrowseSemanticContext` importu kaldırıldı. Dört tip hatası kapandı.
- `verify-standard-pro-packaging-v1.ts` ve `verify-two-plan-packaging-v1.ts`: kaldırılmış ürün adlarının geri gelmediğini denetleyen kontroller, çalışma anındaki etiket listesi üzerinden korunuyor. Üç literal tip karşılaştırması hatası kapandı.
- `scripts/tsconfig.company-tests.json` ve `verify:company-test-types` komutu eklendi. Normal uygulama derlemesi `scripts/` klasörünü dışladığı için bu hedef dört düzenlenen doğrulayıcıyı, iki parametreli çağrılar içeren görsel sistem doğrulayıcısını ve bunların bağımlılıklarını ayrıca denetliyor. Mevcut strict seçenekler ve tip bildirimleri kullanılıyor; tip veya lint kuralı devre dışı bırakılmadı.

## Sonuçlar

| Kontrol | Sonuç |
| --- | --- |
| Phase 4C ödeme | 35/35 |
| P1 kapanış senaryoları | 41/41 |
| Firma sahibi/yetki kontrolleri | 29/29 |
| Standard/Pro, iki paket, genel panel görünümü | Üçü de PASS |
| Kasıtlı hataların yakalanması | 6/6 |
| İlgili beş test dosyası ve bağımlılıklarında TypeScript | 0 hata |
| Normal uygulama TypeScript kapsamı | 0 hata |
| Düzenlenen dört test dosyasında ESLint | 0 hata, 0 uyarı |
| Kaynak ve Prisma dosyalarının önce/sonra SHA-256 karşılaştırması | 899 dosya aynı; eklenen/silinen yok |
| `git diff --check` | PASS |

Testleri yalnız yeşile çevirmediğimizi sınamak için bellekte altı hata oluşturuldu: OWNER yetkisinin kaldırılması, eski ADMIN'e ödeme yetkisi verilmesi, kaldırılmış Offer Copilot etiketinin iki paket testine geri eklenmesi, Price Intelligence etiketinin geri eklenmesi ve otomotiv kategorisinin bulunamaması. Her durumda ilgili doğrulayıcı beklenen nedenle başarısız oldu. Bu denemeler kaynak dosyalarını değiştirmez.

[Toplu sonuçlar](results.json), [kasıtlı hata sonuçları](guards.json), [kaynak karşılaştırması](production-scope.json) ve koşu logları bu klasördedir. `before.json` bu bakımın başlangıç ölçümünü saklar.

## Tekrar çalıştırma

Depo kökünden:

```text
node docs/audits/2026-09-14-test-maintenance/run-checks.cjs
```

Bu denetim, başlangıçtaki kaynak dosyalarının değişmediğini de kontrol eder. Daha sonraki ürün geliştirmelerinde kaynak karşılaştırmasının farklı çıkması beklenebilir; bakımın tarihsel kapsamını ölçer.

Yalnız kalıcı test tip kontrolü için `apps/web` içinden:

```text
npm run verify:company-test-types
```

Bu makinede npm PATH üzerinde bulunmadığından aynı hedef doğrudan `node node_modules/typescript/bin/tsc -p scripts/tsconfig.company-tests.json` ile çalıştırıldı.

## Kapsam

Bu sonuç bütün `scripts/` klasörünün tip kontrolünden geçtiği anlamına gelmez; kapsam yukarıdaki beş doğrulayıcı ve bağımlılıklarıdır. Backend kontrolleri üretim işlevlerini bellek kayıtlarıyla çalıştırır; canlı uçtan uca ödeme testi değildir.

`product-packaging.ts` içindeki iki kullanılmayan `_context` uyarısı bu bakımın dışında bırakıldı; önceki incelemedeki ürün kodu temizliği uygulanmadı. Bağımlılık veya lockfile değişmedi. Migration, canlı veritabanı işlemi, push, merge ve deploy yapılmadı.
