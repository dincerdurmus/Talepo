# Admin İmza arayüzü — 21 Eylül 2026

Kullanıcının seçtiği 1 numaralı Talepo İmza prototipi gerçek admin kaynaklarına uygulandı.
Çalışma kopyası: `Talepo/worktrees/company-4plus1-cbd187c`; taban `cbd187c`.
Bu kopyadaki önceden onaylanmış firma 4+1 ve test bakım değişiklikleri korundu.
Dinçer'in integration dalındaki yeni değişiklikleri bu görsel çalışmaya birleştirilmedi.

## Uygulananlar

- Ortak koyu yeşil gezinme menüsü, beyaz üst çubuk, açık zemin ve Talepo renkleri.
- Altı admin sayfası aynı `AdminShell` bileşenine taşındı. Giriş/MFA kontrolleri her sayfada, kabuk çizilmeden önce korunuyor.
- Menü öğeleri mevcut sayfa yetkilerini izliyor. Firma listesi için mevcut `analytics.view` kuralı aynen kullanılıyor.
- Ana sayfa sayaçları mevcut sorguları kullanıyor. Grafik mevcut `/api/admin/health` yanıtındaki günlük yayınlanan talep ve teklif sayılarını gösteriyor; hata, boş veri, yükleme ve yeniden deneme durumları var.
- shadcn Button, Card, Badge, Table ve Radix tabanlı Sheet bileşenleri eklendi. Mobil menü portalına da aynı tema uygulanıyor.
- Mevcut admin tabloları, formlar, kategori yönetimi, notlar, moderasyon ve detay pencereleri açık temaya geçirildi. İşlem endpointleri ve kayıt gerekçeleri korundu.
- Kategori satırlarının ve operasyon düğmelerinin telefon ekranında taşması giderildi. Kullanıcı tablosu kendi içinde yatay kayıyor.
- Kullanıcı tablosu ilk açılışta görünür. Yetki açıklaması artık tüm rolleri analist diye tanımlamıyor veya yönetici ekranının salt okunur olduğunu söylemiyor.

## Doğrulama

| Kontrol | Sonuç |
|---|---|
| Prisma istemci üretimi | Başarılı; yerel dosya üretimi, migration yok |
| TypeScript | Hata yok |
| Next.js üretim derlemesi | Başarılı; son UI değişiklikleri sonrası tekrar doğrulandı |
| Değişen admin/UI kaynaklarında ESLint | 0 hata, 0 uyarı |
| `node scripts/verify-admin-imza-access-v1.cjs` | 37 geçti, 0 kaldı |
| `node scripts/verify-company-4plus1-v1.cjs` | 74 geçti, 0 kaldı |
| Tarayıcı: masaüstü ve 390 px telefon | Kontrol edildi; telefon içerik/viewport genişliği 375/375 px (scrollbar hariç) |
| Mobil menü | Açılma, Escape ile kapanma ve odağın menü düğmesine dönmesi doğrulandı |
| Analist görünümü | Kaydet düğmesi ve kategori yönetimi görünmüyor; hassas bilgiler maskeli |
| Grafik | 7/30 gün değişimi, boş yanıt, hata ve yeniden deneme kontrol edildi |
| Kullanıcı değişiklik penceresi | Gerekçe penceresi açıldı ve kaydetmeden iptal edildi |

Erişim testleri bağımsız stub kullanır; gerçek veritabanına veya ağa bağlanmaz.
Tarayıcı doğrulaması gerçek admin bileşenlerini yükleyen, örnek veri kullanan ayrı bir önizleme üzerinde yapıldı. Canlı oturumla kayıt değiştirme testi yapılmadı.

## Kapsam dışındaki mevcut lint durumu

Tüm depoda ESLint: **15 hata, 362 uyarı**. Hata bulunan aşağıdaki 8 dosya, satır sonları normalize edilerek HEAD ile karşılaştırıldı ve aynı olduğu doğrulandı. Bu arayüz değişikliğinden kaynaklanmıyorlar.

- `public/draco/draco_decoder.js`: 2 hata
- `public/draco/draco_wasm_wrapper.js`: 5 hata
- `scripts/verify-hybrid-request-composer-v1.ts`: 2 hata
- `scripts/verify-market-intelligence-foundation-v1.ts`: 1 hata
- `scripts/verify-phase1-single-brain-closure-v1.ts`: 2 hata
- `scripts/verify-phase2-constraint-preference-v1.ts`: 1 hata
- `scripts/verify-phase3b-professional-discovery-workspace-v1.ts`: 1 hata
- `scripts/verify-talep-hybrid-ui-v1.ts`: 1 hata

Bağımlılıklar eklenirken lockfile'da mevcut paketlerin sürümlerinin değişmediği doğrulandı. Yeni bağımlılıklar worktree'nin kendi `node_modules` klasörüne kuruldu; ortak çalışma kopyasının bağımlılıklarına yazılmadı.

## Önizleme ve teslim sınırı

Yerel önizleme: `http://127.0.0.1:5182/`. Sayfa örnek veri kullandığını açıkça belirtir; yazma işlemleri önizleme katmanında engellenir. Üretim uygulamasına örnek veri veya doğrulama atlama yolu eklenmedi.

Yerel görseller ve doğrulama logları: `Talepo/reports/admin-imza-20260921/`.
Değişiklikler yereldir; push, deployment veya veritabanı migration'ı yapılmadı.
