# Firma paketi: 1 sahip + 3 üye + 1 analist

Tarih: 14 Eylül 2026 (Europe/Istanbul). Taban: cbd187c55bd0d87ef56ae97d06e9b09af939f556.
Çalışma kopyası: company-4plus1-cbd187c. Değişiklikler commit/push/merge veya deploy edilmedi.

## Uygulanan karar

- Profesyonel firma alanında dahil olan beş koltuk: **1 Sahip (Owner), 3 Üye ve 1 salt okunur Analist**. Sahip ve üç üye talep/teklif gönderebilir.
- Yeni ürün rolleri OWNER, MEMBER ve VIEWER'dır. VIEWER ekranda Analist olarak gösterilir. Yönetici ve Müdür seçenekleri kaldırıldı.
- Tek sahip, üç üye, tek analist, toplam beş ve toplam dört işlem hesabı sınırları ayrı denetlenir. Sahip yokken dördüncü üye veya analist boşken beşinci işlem hesabı kabul edilmez.
- Mevcut ek koltuk hakları yalnız üye kapasitesini artırır; sahip ve analist sayısı bir kalır. Ek eklenti satın alma/ödeme açılışı yapılmadı.
- Firma sahibinin Profesyonel üyeliğinin ekibe yansıması korunur. Kişisel abonelik, firma rolünü geçersiz kılamaz.
- Satış tablosu, ekip sayacı, davet seçenekleri, firma açıklaması ve [üyelik kuralları](../../../apps/web/MEMBERSHIP-RULES.md) aynı dağılımı açıklar.

## Yetki kontrolü

Yalnız sahip davet gönderir, üyeleri çıkarır, firma profilini/kategorilerini değiştirir, firma adına ödeme yapar ve görev atar. Firma sahibi ekipten çıkarılamaz. Yeni davetlerde yalnız MEMBER ve VIEWER kabul edilir; OWNER, ADMIN, MANAGER, SUPER_ADMIN ve geçersiz rol biçimleri reddedilir.

Eski şirket ADMIN/MANAGER üyelikleri uygulamada MEMBER olarak yorumlanır ve yönetim yetkisi taşımaz. Eski davetler kabul edildiğinde veya platform yönetimi üyeliği tekrar etkinleştirdiğinde MEMBER kaydedilir. Ekip, davet, yetki ve rol etiketleri bu dönüşümü kullanır. Platform yönetici rolleri değiştirilmedi.

Analist firma analizlerini ve ekip tekliflerini okuyabilir. Talep/teklif oluşturma veya düzenleme, silme, karşı teklif, kabul/ret, mesaj, fotoğraf ekleme, anlaşma tamamlama, değerlendirme, envanter ve ortak takip değişiklikleri sunucuda engellenir. Görev atama listesinden ve operasyonel bildirim alıcılarından analist çıkarılır; işlem yapan üyeler kapsanır.

Kontroller hem seçili çalışma alanını hem kayıt üzerindeki firma kimliğini kullanır. Başka bir çalışma alanına veya kişisel alana geçmek eski firma kayıtları üzerinde yazma yetkisi sağlamaz. Kişisel hesaptaki bağımsız işlemler korunur. Firma adına yeni talepler yetkili firmanın kimliğini kaydeder; istemcinin gönderdiği firma kimliği otorite değildir.

Davet kabulü, platform yöneticisi koltuk ataması ve toplu etkinleştirme firma satırı kilidiyle aynı kapasite kontrolünü kullanır. Şema değişikliği veya canlı veri göçü yapılmadı. Önceden kapasiteyi aşan veya çoklu sahip içeren gerçek kayıtlar otomatik silinmez; varsa ayrıca incelenmelidir. Eski STANDARD firma alanlarının genel koltuk politikası korunur; tek sahip kuralı orada da geçerlidir.

## Ölçümler

[Tam sonuç kaydı](results.json) ve bu klasördeki ham loglar son çalışma kopyasına aittir.

| Kontrol | Sonuç |
| --- | --- |
| Rol kapasitesi ve çalışma alanı senaryoları | 74/74 |
| Analist servis erişimi | 26/26 |
| Eşzamanlı davet, eski rol kabulü ve arayüz | 12/12 |
| Gerçek ekip/davet HTTP handler senaryoları | 30/30 |
| Sahip yönetimi, ödeme, firma ayarı ve görev atama | 29/29 |
| **Yeni kontroller toplamı** | **171/171** |
| Mevcut fiyat/koltuk doğrulayıcısı | 24/24 |
| Firma/kişisel alan ayrımı | 26/26 |
| Profesyonel firma ve Gizli Envanter doğrulayıcıları | İkisi de PASS |
| Karşı teklif regresyonu | 87/87 |
| Teklif fotoğrafı regresyonu | 63/63 |
| Değerlendirme regresyonu | 77/77 |
| Anlaşma tamamlama regresyonu | 41/41 |
| Talep yayın yaşam döngüsü | 9/9 |
| Kurumsal fırsat merkezi | 42/42 |
| P1 kapanış ve ödeme yetkileri | 41/41 |
| TypeScript | 0 hata |
| Değişen kodda ESLint | 0 hata, 3 mevcut uyarı |
| git diff --check | PASS |

ESLint uyarıları product-packaging.ts içindeki iki kullanılmayan _context parametresi ve verify-p1-closed-beta-closure-v1.ts içindeki kullanılmayan pinBrowseSemanticContext importudur; üçü de taban sürümde bulunur.

## Doğrulamanın sınırları

Yeni senaryolar üretim politika fonksiyonlarını, servisleri, HTTP handler'larını ve React bileşenlerini ayrılmış bellek kayıtlarıyla çalıştırır. Davet yarış testinde gerçek servis firma kilidini almak zorundadır; PostgreSQL yerine sıralanan bir bellek transaction adaptörü kullanılır. Arayüz kontrolleri React HTML render sonucunu denetler; gerçek tarayıcı/E2E çalışması değildir.

Canlı veritabanına bağlanılmadı; kullanıcı, üyelik, ilan, teklif, bildirim veya ödeme kaydı değiştirilmedi. E-posta veya dış bildirim gönderilmedi. TypeScript için aynı taban şemanın üretilmiş Prisma istemcisi yerel inceleme kopyasına alındı; migration uygulanmadı.

Ek olarak önceki turda verify-offer-role-surfaces-v1.ts dosyasının statik kontrolleri geçti; her koşuda çalışan canlı kayıt bölümü DATABASE_URL/DIRECT_URL bulunmadığı için tamamlanamadı. Bu sonuç tam geçiş sayılmadı ve başarılı test bataryasına dahil edilmedi. [İlk denemenin logu](offer-role-live-fixture-unavailable.log) saklandı.

## Yeniden çalıştırma

Depo kökünde:

~~~text
node docs/audits/2026-09-14-company-4plus1/run-checks.cjs
~~~

Node ve projenin kurulu bağımlılıkları gerekir. scripts/lib/isolated-typescript-loader.cjs Prisma erişimini varsayılan olarak kapatır; testlerin verdiği bellek adaptörleri harici bağlantı kurmaz.
