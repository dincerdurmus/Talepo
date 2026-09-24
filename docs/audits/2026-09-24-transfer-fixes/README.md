# Onaylı aktarım düzeltmeleri — 24 Eylül 2026

Kullanıcının “Onay veriyorum” cevabı, önceki aktarım raporunda kalan farkların ayrı bir yerel düzeltme diliminde kapatılması için uygulandı. Bu rapor `0ba6c5d` üzerine yapılan düzeltmeleri kapsar; karşılaştırma tabanı `84fb9fa` (integration). Ortak dala merge, push, canlı cron çağrısı, deploy ve migration yapılmadı.

## Düzeltilen davranışlar

- **Ev aletleri:** `vacuumType`, `usageArea`, `coffeeType` ve `ovenType` mevcut ürün profillerine geri açıldı. Ürün eşleşmesi olmayan sorular çıkmıyor; parça ve servis sözleşmeleri bu soruları almıyor. İlk aşama bütçe/konum, bu sorular detay aşamasında. Cevaplanmamaları yayını engellemiyor. Otomotiv servis ve yedek parça sınırları aynen korunuyor.
- **Yazılı fırın tipi:** “Ankastre fırın arıyorum” ifadesindeki `ovenType=Ankastre` hem kanonik alanda hem keşif filtrelerinde korunuyor. Önceki test beklentisi gevşetilmedi.
- **Belirsiz yedek parça:** “Torna tezgahı için yedek parça” ve “Jeneratör için yedek parça” taleplerinde üst makine, cevaplanmış `productType` olarak yazılmıyor. Parça rolü, machinery kategorisi, taksonomi uyumluluk bağlamı ve kullanıcı özeti korunuyor. Belirli parça taleplerinin mevcut üst ürün alanları etkilenmiyor. İlk denemedeki fazla geniş parent filtresi I27 kontrolünü bozduğu için daraltıldı; son ölçüm I27'yi geçiyor.
- **I26 Türkçe beklentisi:** Üretim metni değiştirilmedi. Test, danışmanlık/danışmanlığı, kitaplık/kitaplığı, sağlık/sağlığı ve p→b, ç→c, t→d, k→ğ/g örneklerini tanıyor. Eksik kelime, çıplak yumuşamış kök, başka kelimenin içindeki eşleşme ve farklı türetimler negatif kontrollerle reddediliyor. Bu yardımcı yalnız doğrulayıcıda; üretim kök çözümleyicisi değil.
- **Cron:** Aktarım dalındaki saatlik ve manuel toplu çalışmaya `request-expiry` eklendi. Workflow hâlâ yalnız site rotalarını çağırıyor; checkout/build/deploy/migration adımı yok. Gerçek uç noktaya istek gönderilmeden bash blokları stub ile çalıştırıldı.
- **Eski lint hatası:** Talep sayfasında iletişim bilgisi kaldırıldığında seçim temizliği, effect içindeki senkron state güncellemesi yerine aynı bileşende koşullu render düzeltmesiyle yapılıyor. “Kalsın”, “Kaldır” ve sunucu varsayılanı korunuyor; effect kaynaklı ek render zinciri kalktı.

## Test beklentilerinin karar gerekçesi

108 senaryonun `84fb9fa` ve düzeltilmiş aktarım üzerindeki üretim çıktıları karşılaştırıldı. Alan, değer, kaynak, projection ve imza farkları [corpus-decisions.json](corpus-decisions.json) içinde 19 senaryo için ayrı ayrı kayıtlıdır.

42 davranış kontrolünün ayrı sonuçları ve adım adım sorulan sorular/uygulanan cevaplar [question-scenarios.json](question-scenarios.json) içinde bulunur. Döngü aynı soruyu yeniden sorarsa, ilgisiz ürün sorusu gösterirse veya mevcut bir soruyu kaybederse kontrol başarısız olur.

| Ölçüm | Integration tabanı | Düzeltilmiş aktarım |
| --- | ---: | ---: |
| Senaryo | 108 | 108 |
| Kanonik alan | 1302 | 1306 |
| UNKNOWN | 975 | 975 |
| Attributes | 291 | 295 |
| Constraints | 291 | 295 |

**Dört yeni değer** açık kullanıcı beyanıdır: `print-02/flatPrintFormat=A5`, `print-08/publicationPageCount=32`, `svc-06/city=Uzaktan`, `svc-06/locationMode=remote`. Üç sayaç doğrulayıcısı yalnız bu +4 fark için güncellendi. Dördüncü doğrulayıcıdaki UNKNOWN=975 beklentisi değiştirilmedi; ürün hataları düzelince kendiliğinden tabana döndü.

**Altı araç modeli** (`auto-01/02/03/04/07/10`) kullanıcının yazdığı C180, Passat, Clio veya C200 ifadesinden geliyor. Değer ve authority dışındaki payload değişmedi; bu yüzden 12 projection yüzeyinin beklentisi VERIFIED → USER_EXPLICIT oldu. Sadece C200 yazılan örnekte katalogdan türeyen Mercedes markası VERIFIED kaldı. Sunucunun create/update/clone kanaryalarında S03/S06/S08 için aynı altı model yüzeyi güncellendi; istemcinin gönderdiği sahte etiketlere güven eklenmedi.

**Dokuz payload imzası** yalnız eski integration çıktısı mevcut fixture ile zaten eşleşiyorsa yenilendi: `tech-07`, `tech-11`, `print-02`, `print-08`, `furn-02`, `furn-05`, `furn-08`, `health-06`, `svc-06`. Gerekçeler hizmetin konusu, ürün adından ayrı tutulan adet ve yukarıdaki açık değerlerdir. Önceden de kırmızı olan `mach-05`, `svc-02`, `svc-07` imzaları bu işlemle aklanmadı.

Projection doğrulayıcıları tamamen yeşil ilan edilmiyor: kalan 108 ve 26 ihlal, aktarım öncesindeki bilinen sayılarla aynı. `verify-battery.json` içindeki hiçbir `knownRed.maxFailures` değeri değiştirilmedi. 42 davranış kontrolü taşıyan `verify-stress-question-contracts-v1`, bundan sonra CI bataryasının yeşil listesine de alındı.

## Ölçüm

| Kontrol | Sonuç | Kanıt |
| --- | --- | --- |
| Soru, yayın kapısı, parça, yazılı alan davranışları | 42/42 | [question-contracts.txt](evidence/question-contracts.txt) |
| Understanding invariants | 124 geçti / 6 eski hata / 1 bilinen açık | [invariants-final.txt](evidence/invariants-final.txt) |
| Projection authority | 108 eski ihlal, tabanla aynı | [projection-final.txt](evidence/projection-final.txt) |
| Sunucu projection authority | 26 eski ihlal, tabanla aynı | [server-authority-final.txt](evidence/server-authority-final.txt) |
| Workflow gerçek bash blokları, ağsız | 11/11 | [cron-dryrun.txt](evidence/cron-dryrun.txt) |
| TypeScript | Çıkış 0 | [typecheck.txt](evidence/typecheck.txt) |
| Şirket test tipleri | Çıkış 0 | [test-types.txt](evidence/test-types.txt) |
| Tam ESLint | 0 hata, 88 mevcut uyarı | [eslint-full.txt](evidence/eslint-full.txt) |
| Next üretim derlemesi | Çıkış 0, 79 statik sayfa | [next-build.txt](evidence/next-build.txt) |
| Tam doğrulama bataryası | 176 doğrulayıcı: 165/165 yeşil, 11 bilinen kırmızı grubun sayısı aynı; çıkış 0 (485 saniye) | [battery-final.txt](evidence/battery-final.txt) |

I9 ve I26 artık geçiyor. Kalan altı invariant, tabandaki I21, I29, I31, I49b, I50h ve I51a; I25d ayrıca bilinen açık olarak sayılıyor. Bu rapor bunları düzeltilmiş saymaz. Canlı/veritabanı kabul testi bu turda yapılmadı; ölçümler DB bağımsız üretim kararları, stub ve derleme kapsamındadır.

Başarısız invariant kimlikleri taban loguyla karşılaştırıldı ve birebir aynı çıktı; yalnız toplam sayı kontrol edilmedi. Bilinen kırmızı cetvelinin 11 kaydı da önceki commit ile birebir aynı, hiçbir doğrulayıcı yeşil listeden çıkarılmadı.

Yeniden üretim (`apps/web` içinde, bağımlılıklar kurulu):

```text
node node_modules/tsx/dist/cli.mjs scripts/verify-stress-question-contracts-v1.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js .
node scripts/run-verify-battery.mjs
```

Bu Windows ölçümünde npm/npx PATH'te olmadığı için son komut, aynı kurulu `tsx` ile her script'i ayrı süreçte başlatan `TALEPO_VERIFY_CMD` adaptörü ve `VERIFY_CONCURRENCY=5` ile çalıştırıldı. Cetvel, komut argümanları ve çıkış kodu denetimi değişmedi. Üretim derlemesindeki DB URL'leri yalnız kapalı loopback portuna işaret eden dummy değerlerdi.

## Birleştirme ve devreye alma sınırı

- Bu dilim yalnız yerel feature dalına commit edilir. Push, ortak dala merge ve migration için ayrı onay sınırı sürer.
- `8723d50` cron-only main hazırlığı **değişmedi**: mevcut beş rotayı çağıran ayrı paket olarak duruyor. Altı rotalı bu sürüm, `request-expiry` rotası ve gerekli yayın/sona erme şeması uygulamada devreye alındıktan sonra main zamanlayıcısına aktarılmalı. Endpoint henüz yayında değilken altı rotalı workflow açılmamalı.
- Admin İmza, Owner + 3 Üye + 1 Analist modeli, Onayla/Reddet kuyruğu ve zeroReach/billingDrift/ölçülemedi sağlık davranışları bu dilimde değiştirilmedi; birleşik kodun bataryasında ilgili doğrulayıcılar yeniden geçti.
