# Zamanlanmış işler — bugünkü gerçek durum

**Son ölçüm: 2026-09-16.**

## Özet

Depoda beş zamanlanmış iş rotası var. **Bugüne kadar hiçbiri koşmadı.**
2026-09-16'da host'tan bağımsız bir zamanlayıcı bağlandı
(`.github/workflows/scheduled-jobs.yml`); iki secret tanımlanana kadar hâlâ
hiçbiri koşmuyor.

Tek kayıt yeri `vercel.json`. Dinçer'in 2026-09-16'daki ifadesi: proje
Vercel'e hiç kurulmadı, hiç olmadı. Depodaki kanıt bunu destekliyor: `.vercel`
dizini yok, Dockerfile yok, başka bir host yapılandırması yok ve
`.github/workflows` içindeki iki iş (`build.yml`, `verify.yml`) yalnız derleme
ve doğrulama yapıyor — hiçbiri deploy etmiyor.

Yani `vercel.json` bir **plan**dır, çalışan bir yapılandırma değil.
Zamanlayıcı bağlanana kadar aşağıdaki rotalar yalnız elle çağrıldıklarında
koşar.

## Rotalar ve koşmadıklarında ne olmuyor

| Rota | Plandaki sıklık | Koşmazsa |
|---|---|---|
| `/api/cron/urgent-nudge` | dakikada bir | Acil talebe teklif gelmediğinde alıcıya gönderilen uyarı hiç yazılmaz |
| `/api/cron/match-backfill` | 15 dakikada bir | Paneli açmayan firmalar eski uygun talepler için hiç eşleşme almaz |
| `/api/cron/overdue-complaints` | saatte bir | Süresi geçen şikâyetler öne çıkmaz |
| `/api/cron/category-provisioning` | günde bir | Kategori sağlama turu hiç işlemez |
| `/api/cron/feature-expiry` | 15 dakikada bir | Satın alınan öne çıkarma süresi hiç bitmez (2026-09-15'te eklendi) |

Beşi de `CRON_SECRET` ile fail-closed: sır tanımsızsa ya da başlık
uyuşmazsa 401 döner ve iş koşmaz.

## Şu an bağlı olan: GitHub Actions

Site `https://talepo.ardakayacan.com` adresinde bir arkadaşın host'unda
duruyor; Supabase bağlanmadığı için henüz veri tarafı çalışmıyor. Host bizim
kontrolümüzde olmadığı için zamanlayıcı host'tan bağımsız seçildi:
`.github/workflows/scheduled-jobs.yml` beş rotayı HTTPS ile çağırıyor.

**Çalışması için depo ayarlarında iki secret gerekir** — ikisi de tanımlanana
kadar iş hiçbir istek atmaz ve neden atmadığını yazar:

- `TALEPO_BASE_URL` — sitenin kök adresi, sonda `/` olmadan
- `CRON_SECRET` — uygulamadaki `CRON_SECRET` ile birebir aynı değer

Sır yalnız Authorization başlığına giriyor, hiçbir adımda yazdırılmıyor ve
yanıt gövdesi loga basılmıyor. Bir rota 200 dışında bir şey dönerse iş
kırmızı veriyor; 401'de "sır uyuşmuyor" diye ayrıca uyarıyor.

**Kabul edilen taviz:** GitHub Actions cron'u en sık beş dakikada bir
tetiklenir ve yoğunlukta gecikebilir. `urgent-nudge` planda dakikada bir
koşuyordu, bu yolla en iyi ihtimalle beş dakikada bir koşacak. Acil talep
uyarısı için beş dakikalık gecikme kabul edilebilir ama bu bir tavizdir;
host'un kendi zamanlayıcısı bağlandığında geri alınmalıdır.

## Host'un kendi zamanlayıcısına geçilirse

Hangi host seçilirse seçilsin iki şey şart: rotaların dışarıdan HTTPS ile
çağrılabilmesi ve `CRON_SECRET` değerinin hem zamanlayıcıda hem uygulamada
tanımlı olması.

Arda'nın host'unda bir zamanlayıcı varsa (Vercel Cron, Railway/Render cron,
systemd timer, klasik crontab) o daha iyidir: bağımlılık azalır ve
`urgent-nudge` planlandığı gibi dakikada bir koşabilir. O gün
`scheduled-jobs.yml` kapatılmalı, yoksa iki zamanlayıcı aynı işi çift
koşturur. Rotalar tekrar koşmaya karşı güvenlidir ama gereksiz yüktür.

## Kural

Bu dosya `vercel.json` ile birlikte güncellenir. Kayıtlı ama koşmayan bir iş,
yazılmış ama okunmayan bir alanla aynı şeydir: yeşil sanılan ölçülmemiş
şeydir.
