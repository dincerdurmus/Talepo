# Talepo — üyelik ve firma rolleri

Güncelleme: 14 Eylül 2026. Dahil olan firma paketi: **1 sahip (Owner) + 3 üye + 1 analist**.

## Üyelik ve çalışma alanı

- Üyelikler Bireysel (STANDARD) ve Profesyonel (PROFESSIONAL). PREMIUM ve CORPORATE eski kayıt değerleridir; geçerli hakları Profesyonel olarak yorumlanır.
- Firma Profesyonel üyelikle oluşturulur. Sahibin geçerli Profesyonel üyeliği ekibe yansır; firma kaydındaki plan değiştirilmez.
- Başka bir firmaya üye olan kişinin kişisel aboneliği o firmanın planını yükseltmez.
- Kişisel ve firma alanları açıkça seçilir. Teklif kotası ve ek kredi havuzları ayrıdır.
- Üyelik özelliği ile firma rolü birlikte kontrol edilir. Kişisel Profesyonel üyelik, firma içindeki Analist rolüne işlem yetkisi kazandırmaz.

## Firma paketi: 1 + 3 + 1

| Rol | Dahil | Kayıt değeri | Yetki |
| --- | ---: | --- | --- |
| Sahip (Owner) | 1 | OWNER | Talep, teklif ve mesaj; ekip, firma ayarları, görev atama ve ödeme yönetimi |
| Üye | 3 | MEMBER | Firma adına talep, teklif, karşı teklif, anlaşma ve mesaj işlemleri; yönetim/ödeme yetkisi yok |
| Analist | 1 | VIEWER | Firma analizlerini, yetkili olduğu firma verilerini ve ekip tekliflerini görüntüleme |

Sahip ve üç üye toplam dört işlem hesabını oluşturur. Üç rolün kapasitesi ayrı sayılır; toplam beş koltuk ve dört işlem hesabı sınırı da korunur. Boş sahip veya analist koltuğu dördüncü üyeye verilemez. İkinci sahip kabul edilmez. Firma sahibi ekipten çıkarılamaz.

Yalnız ACTIVE üyeler sayılır. Bekleyen davet koltuk tüketmez. Kabul sırasında firma satırı kilitlenir ve hedef rolün kapasitesi yeniden kontrol edilir. Davet kabulü, platform yöneticisinin koltuk ataması ve toplu yeniden etkinleştirme aynı aktivasyon kuralını kullanır.

Önceden tanımlanmış ek koltuk hakları yalnız üye kapasitesini artırır; sahip ve analist kapasiteleri bir olarak kalır. Ek koltuk ve Gizli Envanter satın alma akışları kapalıdır. Gizli Envanter Profesyonel üyeliğe dahil değildir; etkin firma eklentisi gerektirir. Eski STANDARD firma alanlarının genel koltuk politikası değiştirilmez; tek sahip kuralı bu alanlarda da geçerlidir.

## Rol sınırları ve eski kayıtlar

- Yalnız sahip Üye veya Analist davet edebilir, üyeleri çıkarabilir, firma profilini/kategorilerini değiştirebilir, şirket adına ödeme yapabilir ve görev atayabilir.
- Analist talep/teklif oluşturamaz veya değiştiremez; karşı teklif, kabul/ret, mesaj, fotoğraf ekleme, anlaşma onayı, değerlendirme, envanter ve ortak takip değişikliği yapamaz. Analiz ve okuma erişimi devam eder.
- Operasyonel fırsat/görev hedefleri sahibi ve üyeleri kapsar. Analiste işlem görevi atanamaz. Talep ve alarm bildirimlerinin alıcılarına üyeler dahildir.
- Eski şirket ADMIN ve MANAGER kayıtları uygulamada MEMBER olarak yorumlanır, Üye olarak gösterilir ve yönetim/ödeme yetkisi vermez. Yeni davetlerde bu değerler reddedilir. Eski davet kabulünde veya yeniden etkinleştirmede MEMBER kaydedilir.
- VIEWER depolama değeri arayüzde Analist olarak gösterilir. Şema değişikliği veya veri göçü gerekmez. Platform ADMIN, ANALYST ve diğer platform rolleri bu firma rollerinden ayrıdır.

Analist kısıtı hem seçili firma hem işlemin bağlı olduğu firma üzerinden kontrol edilir. Kişisel alana geçmek eski firma kayıtlarını düzenleme yetkisi vermez; kişinin kendi bağımsız hesabındaki işlemleri devam eder.

Canlı kullanıcılar topluca çıkarılmaz veya veritabanında yeniden yazılmaz. Eski bir ekip kapasiteyi aşıyorsa sonraki aktivasyonlar kısıtlanır. Eski çoklu sahip veya kapasite fazlası kayıtların düzeltilmesi, gerçek veriler incelenerek ayrı bir veri işlemi olarak ele alınmalıdır.

## Kod ve doğrulama

- src/lib/membership/company-permissions.ts: Üç şirket rolü, eski kayıt uyumluluğu ve sahip yetkileri.
- src/lib/membership/seat-policy.ts: Sahip/üye/analist kapasitesi ve toplam sınır.
- src/server/company/assert-company-seat.ts: Aktivasyon öncesi rol kapasitesi.
- src/server/company/company-write-access.ts: Seçili firma ve kaynak firma yazma kontrolü.
- src/lib/membership/workspace-effective-plan.ts: Sahip üyeliğinin firmaya yansıması.
- scripts/verify-company-4plus1-v1.cjs, verify-company-analysis-access-v1.cjs, verify-company-seat-lifecycle-v1.cjs, verify-company-invite-api-v1.cjs, verify-company-owner-management-v1.cjs: Veritabanından yalıtılmış senaryolar.
