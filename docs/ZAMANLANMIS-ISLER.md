# Zamanlanmış işler — bugünkü gerçek durum

**Son ölçüm: 2026-09-16.**

## Özet

Depoda beş zamanlanmış iş rotası var. **Bugün hiçbiri koşmuyor.**

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

## Bağlanınca ne gerekir

Hangi host seçilirse seçilsin iki şey şart: rotaların dışarıdan HTTPS ile
çağrılabilmesi ve `CRON_SECRET` değerinin hem zamanlayıcıda hem uygulamada
tanımlı olması.

- **Host'un kendi zamanlayıcısı.** Vercel Cron, Railway/Render cron, bir
  VPS'te systemd timer ya da klasik crontab. En az bağımlılık bu.
- **Host'tan bağımsız: GitHub Actions `schedule`.** Depo zaten GitHub'da ve
  zaten Actions kullanıyor; tek gereken site adresi ve `CRON_SECRET`
  repository secret. Sınırı bilmek gerekir: GitHub Actions cron'u en sık
  5 dakikada bir tetiklenir ve yoğunlukta gecikebilir, yani
  `urgent-nudge`'ın dakikada bir koşması bu yolla sağlanamaz — o iş ya
  host zamanlayıcısına kalır ya da sıklığı düşürülür.

## Kural

Bu dosya `vercel.json` ile birlikte güncellenir. Kayıtlı ama koşmayan bir iş,
yazılmış ama okunmayan bir alanla aynı şeydir: yeşil sanılan ölçülmemiş
şeydir.
