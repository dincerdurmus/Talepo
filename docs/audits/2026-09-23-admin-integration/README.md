# Tuğrul → Dinçer: admin / 4+1 aktarımı ve birleşik ölçüm

Tarih: 23 Eylül 2026. Bu kayıt yerel entegrasyon dalının durumudur; ortak dala aktarım veya canlı kabul onayı değildir.

## Güvenceye alınan iş

- `wip/tugrul-admin-imza-4plus1-2026-09-23` oluşturuldu; `9189063fe1988d9cb3d3c95e3e2437a1455e950c` commit'i GitHub'a push edildi ve uzak ref ile doğrulandı.
- WIP 226 dosyayı paketler: onaylı 4+1 ve İmza tasarımı, önceki kategori/yayın yaşam döngüsü, anlama düzeltmeleri ve denetim kayıtları. Bunu yalnız bir UI değişikliği olarak değerlendirmemek gerekir.
- Güncel `origin/integration/talepo-dev` (`84fb9fa20308727c1523fef6a3bdffbd31f5dbe0`) üzerinden `feature/tugrul-admin-imza-4plus1-integration-2026-09-23` açıldı. WIP burada birleştirildi; 13 dosyadaki çatışma çözüldü. Bu dalın upstream'i yok ve push edilmedi.
- Ortak dal hâlâ `84fb9fa`; `main` hâlâ `33e11d74e11039bf7db4a89f0acd01ed7cda2931`. Uzak ref'ler çalışma sonunda yeniden kontrol edildi.
- Migration, deploy, canlı DB yazımı, gerçek bildirim ve ortak dal push'u yapılmadı. Prisma generate yalnız yerel istemci üretimidir.

## Tamamlanan admin ve koltuk davranışı

- 1 Owner + 3 Üye işlem koltuğu, 1 salt okunur Analist. Eski yönetici/müdür ayrımı satış modeline geri getirilmedi.
- İmza tasarımında ayrı yayın inceleme bölümü: talep başlığına bağlantı, kuyruğa giriş, SLA tarihi/aşımı, Onayla ve Reddet.
- Onay/red kararı, vaka kapanışı, sahip bildirimi ve admin denetim kaydı tek DB transaction'ında. Bildirim veya audit yazılamazsa tamamı geri alınır.
- Onay, yayın ve tedarikçi görünürlük zamanını belirler; bir aylık talep süresi onay anından başlar. Dağıtım commit sonrasında çalışır; dağıtım hatası tekrar denemeye bırakılır.
- Ret gerekçesi 5–2000 karakter. Talep gizli kalır; karar veren yönetici kaydedilir. Aynı veya zıt ikinci karar 409 ile durur. SUPPORT, ANALYST, USER ve MFA kontrolünden geçemeyen oturumlar karar veremez.
- Reddedilmiş ve inceleme bekleyen talep, sahibinin detayında ve listesinde ayrı açıklanır. Bir karar verilmiş talep tekrar açık inceleme listesine girmez.
- Genel vaka kapatma/toplu işlemler inceleme bekleyen talebi yayın kararı olmadan kapatamaz.
- Dinçer'in `zeroReach`, `billingDrift`, tarama sınırı ve bilinmeyen ölçüm durumu korundu. Tarama yapılamadıysa tarama sınırı da `-1 / Ölçülemedi`; yanlışlıkla “Tamamlandı” yazmıyor.
- Karar sonrası yenilemede klavye odağı kuyruk başlığında korunur. İptalde karar düğmesine döner. Seçili sekmenin hover kontrastı düzeltildi.

## Çatışmada korunan sınırlar

- Jev karar paketi API sınırında bir kez üretilir ve mevcut parse yoluna aktarılır.
- Kategori uygunluğu DB'deki aktif kayıtlarla doğrulanır; yeni yaşam döngüsü alanları silinmedi.
- Taslaktan yayın, kategori ve konum değişimi sonrası dağıtım korunur.
- Maira'nın güçlü entegrasyon beklentileri korundu: 415 profil / 410 profil kaynaklı / 413 tek seçim. Eski düşük sayılara çekilmedi.
- Dinçer'in miktar birimleri, feature-expiry görevi ve sağlık ölçümleri tutuldu.
- Ortak soru sınırları ve yayın zorunlulukları bu aktarımda yeniden tasarlanmadı. D-0034 ve D-0036 başlatılmadı.

## Ölçüm

Windows, Node 24.19.0. Yeni çalışma kopyasında bağımsız npm ci; yerel Prisma istemcisi üretildi. Baseline kaynağı ayrı, temiz `84fb9fa` çalışma ağacı. Baseline, aynı bağımlılık kurulumunu bağlantı üzerinden ve aynı üretilmiş Prisma istemcisini yalnız DB'siz testlerde kullandı; bu bir canlı DB karşılaştırması değildir.

| Kontrol | Sonuç |
|---|---|
| Firma/rol/koltuk davranışı | 171/171 |
| Admin İmza erişim sınırları | 37/37 |
| Yeni inceleme kararı / API / rollback | 24/24 |
| Bu yedi grubu çalıştıran CI kapısı | 7/7; toplam 232 kontrol |
| Billing drift kontrolü | 19/19 |
| Zero reach kontrolü | 20/20 |
| Uygulama TypeScript | 0 hata |
| Test bakımı TypeScript hedefi | 0 hata |
| Üretim derlemesi | Başarılı; 79/79 statik sayfa |
| Değişen admin/karar/test dosyaları lint | 0 hata; kaynak adaptörü testinde önceden bulunan 2 uyarı |
| Depo geneli lint | 1 hata, 88 uyarı; hata baseline'da da var (`talep/page.tsx`, effect içinde senkron setContactChoice) |
| Kaynak kodu diff whitespace kontrolü | Geçti |
| Cron dosyası kuru koşu | 10/10; curl sahte, ağ yok |
| Ek Taleplerim yüzey kontrolü | 70 yerel kontrol geçti; gerçek DB isteyen clone adımı ortam yokluğundan ölçülemedi, süreç çıkışı 1 |

`verify-admin-integration-v1` bataryanın yeşil listesine eklendi. İşlem testleri gerçek servis/API fonksiyonlarını bellek içi transaction adapter'ıyla çalıştırır; PostgreSQL kilit/yarış ve canlı bildirim kabulü yerine geçmez.

Lockfile: entegrasyon tabanındaki mevcut paketlerin sürümlerinde değişim yok. Kayıt sayısı 590 → 888, 298 yeni kayıt. Onaylı İmza bağımlılıkları ve npm'nin lock normalleştirmesi birlikte tutuldu.

### Tarayıcı kabulü

Gerçek üretim React bileşenleri Vite önizlemesine bağlandı; API cevapları yerel örnek veri. Gerçek kullanıcı oturumu veya DB kullanılmadı.

- Masaüstünde bekleyen iki talep ayrı; normal yayınlanmış içerik genel moderasyon bölümünde.
- Boş ret gerekçesiyle gönderme kapalı. Kayıt hatasında panel, gerekçe ve tekrar deneme korunuyor; tekrar denemede kayıt kuyruktan çıkıyor.
- Onay sonrası 2 → 1 bekleyen; odak `review-queue-title` üzerinde.
- 390 × 844 telefon görünümünde karar paneli 390 px genişlikte ve x=0; sayfa yatay taşmıyor.
- SUPPORT için onay/red düğmesi sayısı 0; sunucu tarafı yetki denemeleri ayrıca yapıldı.
- Sağlık hatası sonrası Tekrar dene çalışıyor. Ölçülemeyen üç drift alanı sıfır/tamamlandı gibi görünmüyor. Sınıra ulaşmış tarama açık uyarı veriyor.

## Tam batarya: ortak dala geçmeye hazır değil

Baseline: 174 doğrulayıcı; yeşil listedeki 163 kontrolün 162'si geçti. Tek hata billing-drift testinin statik import sırasında henüz dummy DB URL'sini atamamış olması. Bilinen 11 kırmızı sayısı cetvelle aynı.

İlk birleşik koşu: 174 doğrulayıcı; yeşil listede 10 kırmızı, bilinen listede üç sayı sapması. Sınırlı test bakımı sonrası son koşu: **175 doğrulayıcı, yeşil listede 159/164 geçti, 5 kırmızı; bilinen 11 kontrolden 8'i aynı, 3'ünde sapma var.** Tam batarya çıkış kodu 1. “Her şey yeşil” denemez.

Kapatılan yanıltıcı kırmızılar:

- Billing testi dummy URL'yi Prisma importundan önce kuruyor; sağlık kontrolü yeni ortak sunum fonksiyonunun gerçek çıktısını ölçüyor.
- Zero-reach kontrolü yeni UI'nin ortak sunum fonksiyonuna bağlı; metin biçimi aramasından ibaret değil.
- Iyzico kontrolü onaylı 4+1 modelinde 5 koltuk bekliyor, sağlayıcıya koltuk adedi gönderilmediğini yine kontrol ediyor.
- Teklif revizyon kontrolü aktif talep koşulunu ve SUBMITTED/VIEWED sınırını birlikte arıyor.
- Buzdolabı adaptörü testi, ürün alanlarını sorabilmek için gerçek ürün bağlamını veriyor; belirsiz kategoriye buzdolabı soruları yüklemiyor.
- Ek Taleplerim kontrolündeki firma yazma yetkisi beklentisi, eski `role !== VIEWER` metin araması yerine ortak rol fonksiyonunu ve onaylı/yasaklı rol örneklerini kontrol ediyor. Gerçek DB adımının ölçülemediği sonuç saklanmadı.

Kalanlar:

1. **Soru/alan kaybı:** I9 tabanda yeşil, birleşimde kırmızı. `vacuumType`, `usageArea`, `coffeeType` görünmüyor. Ayrıca 108 senaryonun alan karşılaştırmasında “Ankastre fırın”ın `ovenType=Ankastre` değeri düşüyor. Aynı genel appliances sözleşmesinin standart profilleri sınırlaması incelenmeli; mevcut opsiyonel soruların geri gelmesi yayın zorunluluklarını büyütmemeli.
2. **Parça/ana ürün ayrımı:** “Torna tezgâhı için yedek parça arıyorum” senaryosunda `productType`, UNKNOWN'dan “Torna tezgahı”na dönüyor. Ana ürünün istenen ürün alanına sızması şüpheli; ayrı düzeltme onayı istendi.
3. **I26 beklentisi:** kullanıcıya “genel hukuk danışmanlığı” doğru gösteriliyor, kapı `danismanlik` arıyor. İddia metin kaybı değil; Türkçe k→ğ yumuşamasını tanımayan test beklentisi. Tabanda geçtiği için toplam invariant 6 → 8 artışının birini bu, diğerini I9 oluşturuyor. Klima satırındaki I21/I29/I31 her iki sürümde de kırmızı; yeni regresyon diye sunulmadı.
4. **Dört ortak alan sayacı:** common-field / field-response / generated-field / nonvalue testleri kırmızı. Alanlar 1302 → 1305, UNKNOWN 975 → 974, attributes/constraints 291 → 295. Delta bütünüyle kötü değil: A5 baskı biçimi, 32 sayfa ve uzaktan hizmet gibi açık kullanıcı bilgileri yeni taşınıyor. Ancak aynı deltanın içinde ovenType kaybı ve torna ana ürün sızıntısı da var. Sayılar körlemesine güncellenmedi.
5. **Otorite cetveli:** projection-authority 108 → 140, projection-server-authority 26 → 33. Altı açık otomotiv modelinin kaynağının CATALOG_ENRICHED'dan EXPLICIT_TEXT'e geçmesi ve ek alan kimlikleri deltanın bir parçası. Satır kararı verilmeden hepsini ürün hatası veya hepsini bayat test saymak doğru olmaz. Cetvel yükseltilmedi.
6. **Yeni cron kaydı:** `request-expiry` birleşimdeki `vercel.json` içinde var, mevcut `scheduled-jobs.yml` içinde yok. `verify-feature-expiry-v1` 11/12. Canlı endpoint ve migration/deploy sırası onaylanmadan main'e bu yeni çağrı sessizce eklenmedi.

## main için ayrı cron paketi

- Yerel dal: `chore/tugrul-scheduled-jobs-main-2026-09-23`.
- Commit: `8723d502fd43b8041d5ed01b3a2d3bb64b59845a`.
- Taban: `33e11d7`; **tek dosya**, `.github/workflows/scheduled-jobs.yml`, 102 satır ekleme. Entegrasyondaki mevcut dosyanın aynısı.
- Checkout/build/install/deploy/migration yok. `TALEPO_BASE_URL/api/cron/...` adreslerine mevcut beş uç için Bearer başlığıyla curl çağrısı var. Sır ve cevap gövdesi loglanmıyor.
- Secret yoksa çağrı yapmadan açık mesajla çıkıyor. 401/503 denemeleri işi başarısız kılıyor. GitHub Actions'ın zamanlama gecikmeleri ayrıca canlıda gözlenmeli.
- Bu commit **push edilmedi ve main'e alınmadı**. Ayrı onay bekliyor. Yeni `request-expiry` çağrısı bu paketle karıştırılmamalı.

## Sonraki karar

WIP güvence altında; admin/koltuk/sağlık ve inceleme kuyruğu yerel olarak hazır. Ortak dala birleştirme için kalan soru/alan sapmaları, I26 beklentisi, otorite cetvelinin satır bazlı değerlendirmesi ve request-expiry zamanlaması kapanmalı. Gerçek DB kabulü için `.env.acceptance` ve CA dosyalarının yolu bu çalışma kopyalarında bulunamadı; kullanıcıya yalnız dosya yolu soruldu. Gizli değer istenmedi.

Push, ortak merge ve migration için henüz onay yok. D-0034 / D-0036 ayrı dilim olarak duruyor.

Ölçüm logları bu dizindeki `evidence/` altında; korpusun satır bazlı deltası `corpus-diff-small.json`. Tarihsel WIP audit kayıtları bugünkü ölçüm gibi sunulmadı veya yeniden yazılmadı.
