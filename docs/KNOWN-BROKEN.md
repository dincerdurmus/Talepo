# Bilinen kırıklar

Yeşil olmayan ama bilerek taşınan doğrulama hataları. Kural: bir verifier
kırmızıysa ya düzeltilir ya buraya yazılır — sessizce geçilmez. Her satır
"hangi kontrol / ne bekleniyordu / ne oluyor / ne zamandan beri / sahibi"
sorularını cevaplamak zorundadır, yoksa kayıt geçersizdir.

## KB-1 — Yedek parça talebinde uyumlu araç kimliği kayboluyor

| Alan | Değer |
| --- | --- |
| Doğrulayıcı | `apps/web/scripts/verify-browse-semantic-closure-v1.ts` |
| Kırık kontroller | `B facts uyumlu marka/model` (satır 240), `B parent entity VEHICLE (compatibility)` (satır 246) |
| Bugünkü sonuç | `pass=37 fail=2` |
| Ne zamandan beri | `b0e9a22` — *feat(requests): add guided request composer v2*, 2026-08-21. Bir önceki commit `0975ab9`'da doğrulayıcı `pass=39 fail=0` idi (2026-08-23'te bisect ile ölçüldü: 192 commit'lik aralık ikili aramayla daraltıldı). |
| Kapsam | Yalnız otomotiv "yedek parça" akışı. Marka kolonları, taksonomi ve talep yayınlama yollarıyla ilgisi yok. |

**Beklenen:** Alfa Romeo 156 için yedek parça talebinde, tekrar okunan durumda
(a) anlaşılan bilgiler tablosunda `brand` ve `model` satırları "Uyumlu …"
etiketiyle görünmeli, (b) `state.understanding.requestSubject.parentEntity.kind`
`"VEHICLE"` olmalı.

**Gözlenen:** Tabloda yalnız `Talep türü=Yedek parça; Uyumlu marka=Alfa Romeo;
Parça=yedek parça` var — `model` satırı hiç üretilmiyor; `parentEntity` de
`VEHICLE` değil. Yani parçanın uyumlu olduğu aracın modeli, yeniden okumada
düşüyor.

**Şüpheli alan (doğrulanmadı):** `b0e9a22` composer v2 ile birlikte
`src/lib/request-composer/build-state.ts` (parentEntity → alan eşlemesi,
satır 245-253) ve `src/lib/request-understanding/semantic-subject.ts`
(`parentEntity` üretimi, satır 398-402) değişti. Kök neden aranmadı.

**Durum:** Açık, ayrı iş kalemi. Bu kayıt 2026-08-23'te marka kolonu çalışması
sırasında düşüldü; o çalışmanın kapsamına girmiyor ve onun sebep olduğu bir
gerileme değil (aynı hata `c5562bd` öncesinde de vardı).

## KB-2 — Hybrid UI doğrulayıcısı eski ağaç şeklini bekliyor

| Alan | Değer |
| --- | --- |
| Doğrulayıcı | `apps/web/scripts/verify-talep-hybrid-ui-v1.ts` |
| Bugünkü sonuç | `91 passed, 6 failed` |

Altı hata iki ayrı sınıftan geliyor ve bunlar **aynı işlem görmemelidir**
(kurucu, 2026-08-23): bayat beklenti kodun doğruluğu hakkında hiçbir şey
söylemez, ürün hatası ise düzeltilmesi gereken gerçek bir kusurdur. Beklenti
güncellemesiyle aynı commit'e gömülen bir ürün hatası, güncelleme sırasında
sessizce yeşile döner. Bu yüzden aşağıda ayrı kayıtlar hâlinde duruyorlar.

### KB-2a — Donanım hoist'i sonrası eskimiş beklentiler (kod doğru)

| Alan | Değer |
| --- | --- |
| Kırık kontroller | `32 TV brands include Samsung/LG/Tümü`, `32 phone brands include Apple/Samsung`, `32 laptop brands include HP/Dell/Lenovo`, `32 phone leaf is Cep Telefonu not Akıllı telefon` |
| Ne zamandan beri | `3cf4d74` (2026-08-23, *feat(browse): hoist Donanım groups, product-relevant brand columns*). Bir önceki commit `bf63264`'te doğrulayıcı `95 passed, 2 failed` idi. |
| Sınıf | Bayat beklenti — ürün hatası **değil** |

Marka kontrolleri bugün marka değil kategori grubu listesi görüyor ("Yazılım
Geliştirme, Web Sitesi, Ağ ve Modem…"), çünkü Donanım hoist edildikten sonra o
seviyede marka kolonu yok — kolon artık ürün yaprağının altında açılıyor. Ağaç
şekli bilerek değişti; doğrulayıcı eski şekli arıyor.

**Yapılacak:** Beklentiler yeni ağaca göre güncellenir — kontroller marka
kolonunu ürün yaprağının (`…:tv-ve-goruntu:televizyon` gibi) altında aramalı.
Kolonun o üst seviyeye geri getirilmesi düşünülmüyor.

### KB-2b — "Farketmez" etiketi "Tümü" oldu (kod doğru)

| Alan | Değer |
| --- | --- |
| Kırık kontrol | `6 ANY visual Farketmez` |
| Ne zamandan beri | En az `6d6bfb7` (2026-08-22); daha eskisi ölçülmedi |
| Sınıf | Bayat beklenti — ürün hatası **değil** |

Etiket kurucu kararıyla "Tümü" olarak değiştirildi, doğrulayıcı eski etiketi
arıyor. **Yapılacak:** beklenti "Tümü"ye güncellenir.

### KB-2c — Bosch cümlesinde marka ve "için" iki kez üretiliyor (GERÇEK ÜRÜN HATASI)

| Alan | Değer |
| --- | --- |
| Kırık kontrol | `37 Bosch compose no duplicate pompa clause` |
| Ne zamandan beri | En az `6d6bfb7` (2026-08-22); daha eskisi ölçülmedi |
| Sınıf | **Ürün hatası** — beklenti güncellemesine gömülmeyecek |

**Beklenen:** Bosch marka + çamaşır makinesi + pompa parçası seçildiğinde
üretilen talep metni markayı bir kez, "için" bağlacını bir kez içermeli.

**Gözlenen:** `bosch için bosch çamaşır makinesi için pompa arıyorum` — marka
iki kez, "için" iki kez. Kullanıcının gördüğü metin bu.

**Durum:** Açık, ayrı iş kalemi. Marka kolonu çalışmasının kapsamına girmiyor;
onun sebep olduğu bir gerileme de değil. KB-2a/2b beklentileri güncellenirken
bu kontrol **kırmızı bırakılacak** — yeşile dönerse metin gerçekten düzelmiş
demektir, o zaman bu kayıt kapanır.

**Durum (KB-2 geneli):** `c5562bd` commit mesajındaki "full battery green"
ifadesi bu iki doğrulayıcıyı (`verify-talep-hybrid-ui-v1`,
`verify-browse-semantic-closure-v1`) kapsamıyordu.

## KB-3 — Tek gerçek pazar verisinin üreteci depoda yok

| Alan | Değer |
| --- | --- |
| Etkilenen dosya | `data/taxonomy-sources/mediamarkt-product-brands.json` (çıktı olarak commit edilmiş) |
| Kayıp üreteç | `build-product-brands.mjs` — depoda hiçbir yerde yok |
| Tespit | 2026-08-23, marka kolonu denetimi |
| Sahibi | Açık; kurucu kararına kadar yeniden yazılmayacak |

**Ne var:** Dosya 42.498 MediaMarkt ürününden türetilmiş, **35 ürün tipi** için
gerçek marka dağılımı taşıyor. Sistemdeki ürün tipi bazlı tek gerçek pazar
verisi budur; `product-brands.ts` bütünüyle bu dosyayı okur.

**Ne yok:** Bu dosyayı üreten script. Bunun üç somut sonucu var:

1. **Envanter güncellenemez.** MediaMarkt kataloğu değiştiğinde dosya elle
   düzenlenmedikçe eskimeye devam eder ve eskidiği hiçbir yerde görünmez.
2. **Yöntem başka kaynağa uygulanamaz.** e-bebek / Koçtaş / Makinecim
   hasatlarında ürün tipi → marka kırılımı eksik olduğu için o kategorilerde
   kolon küratörlü listelerden besleniyor. Aynı çıkarımı o kaynaklara uygulamak
   isteseydik, uygulanacak kod elimizde değil.
3. **Türetme kuralları denetlenemez.** Hangi eşik altında marka elendi, ürün
   adı hangi kurala göre ürün tipine bağlandı, "toplam" alanı neyi sayıyor —
   hiçbiri doğrulanabilir değil. Dosyadaki sayılar bugün tek başına otorite.

**Bu tek dosyaya bağlı olan (ölçüm 2026-08-23):**

| Kategori | Ürün yaprağı | MediaMarkt kolonu | Küratörlü kolon |
| --- | --- | --- | --- |
| technology | 113 | **41** | 0 |
| appliances | 97 | **19** | 0 |
| home-kitchen | 141 | 0 | 28 |
| baby | 128 | 0 | 38 |
| furniture | 236 | 0 | 134 |
| machinery | 305 | 0 | 135 |

Yani `technology` ve `appliances` kategorilerinin marka kolonu **tamamen** bu
dosyaya bağlı (60 yaprak); dosya kaybolursa bu iki kategoride kolon toptan
kapanır. `home-kitchen` kuralları `product-brands.ts`'te tanımlı olsa da
(buzdolabı, fırın, süpürge…) o yaprakların hiçbiri MediaMarkt anahtarına
düşmüyor — bu kategorideki 28 kolonun tamamı küratörlü.

**Durum:** Açık, ayrı iş kalemi. Kurucu kararı (2026-08-23): script şimdi
yeniden yazılmayacak, önce kayıp olduğu kayda geçecek.

## KB-4 — "Uydu ve Kablo TV" yaprağı ürün değil, alan adı

| Alan | Değer |
| --- | --- |
| Düğüm | `tax:technology:donanim:tv-ve-goruntu:uydu-ve-kablo-tv` |
| Bugünkü tip | `PRODUCT_TYPE`, çocuğu yok |
| Kaynak | `google-product-taxonomy-tr`, *kurucu onayı 2026-08-23* (`29a004e`) |
| Tespit | 2026-08-23, ağaç geneli hizmet yaprağı taraması |
| Bu turda yapılan | Yanlış marka kolonu kapatıldı (aşağıya bak) |
| Bu turda YAPILMAYAN | Yaprağın düşürülüp gerçek çocuklarının eklenmesi |

**Sorun.** Google TR taksonomisinde bu düğümün altında iki gerçek ürün var
(uydu alıcısı, kablo TV kutusu); bize **yapraksız alan adı** olarak indi.
Kendisi satın alınabilir bir nesne değil, bir abonelik/donanım alanının adı.

**Yarısı düzeltildi (bu turda, `product-brands.ts`).** Türkçe baş isim kuralı
adın sonunu tuttuğu için yaprak `"tv"` kalıbına düşüyor ve **televizyonun
MediaMarkt marka listesinin birebir aynısını** alıyordu: Samsung, LG, TCL, Onvo,
Philips, Grundig, Peaq, Axen, İsy, Sony, Vestel, Xiaomi, Havit. Samsung uydu
aboneliği satmaz. Çıplak `"tv"` kalıbı kaldırıldı; ölçüm, bu kalıbın tüm ağaçta
yalnız bu yaprağı tuttuğunu ve gerçek televizyon yaprağının `"televizyon"`
kalıbıyla zaten eşleştiğini gösterdi — kaldırmanın maliyeti yok. Koruyucu:
`I11h`.

**Kalan iş.** Yaprağı düşürüp Google'daki iki gerçek çocuğunu ürün olarak
eklemek. Bu bir **taksonomi değişikliğidir** ve düğüm sayılarını (2151/1862)
oynatır; bu yüzden marka kolonu turundan ayrı tutuldu (kurucu, 2026-08-23).

**Sınıf tanımı — ikinci örnek için aranacak şey.** Bu tek bir yaprak hatası
değil, bir sınıfın ilk örneği: **baş ismi bir ürün pazarıyla çakışan, kendisi
ürün olmayan yaprak.** Türkçede tamlamanın başı sonda olduğu için böyle bir ad
ürün eşleştiricisinin kalıbına tam oturur ve o pazarın markalarını sessizce
devralır. Ağaç geneli tarama bugün **başka örnek bulamadı** (hizmet/abonelik
yapraklarının tamamı doğru tiplenmiş `SERVICE_TYPE` ve doğru ebeveyn altında).
Bu yüzden invariant sınıf düzeyinde **yazılmadı** — tek örnekli bir sınıfa kural
yazmak erken (kurucu kararı). `I11h` şimdilik yalnız bu yaprağı tutuyor. İkinci
örnek çıktığında sınıf invariantı yazılır.
