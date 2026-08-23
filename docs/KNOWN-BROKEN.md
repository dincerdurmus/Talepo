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

**Sınıf tanımı — ikinci örnek için aranacak şey (KB-4).** Bu tek bir yaprak hatası
değil, bir sınıfın ilk örneği: **baş ismi bir ürün pazarıyla çakışan, kendisi
ürün olmayan yaprak.** Türkçede tamlamanın başı sonda olduğu için böyle bir ad
ürün eşleştiricisinin kalıbına tam oturur ve o pazarın markalarını sessizce
devralır. Ağaç geneli tarama bugün **başka örnek bulamadı** (hizmet/abonelik
yapraklarının tamamı doğru tiplenmiş `SERVICE_TYPE` ve doğru ebeveyn altında).
Bu yüzden invariant sınıf düzeyinde **yazılmadı** — tek örnekli bir sınıfa kural
yazmak erken (kurucu kararı). `I11h` şimdilik yalnız bu yaprağı tutuyor. İkinci
örnek çıktığında sınıf invariantı yazılır.

## KB-5 — Bildirim doğrulayıcısı çağrının metnini arıyor, davranışını değil

| Alan | Değer |
| --- | --- |
| Doğrulayıcı | `apps/web/scripts/verify-notifications-v1.ts` |
| Kırık kontrol | `single mark read before redirect` (satır 224-227) |
| Bugünkü sonuç | `50 passed, 1 failed` |
| Ne zamandan beri | `3f67103` — *fix(dev): unbreak npm run dev and render-time revalidation*, 2026-08-22. Bir önceki commit `48e2b09` yeşildi (bisect ile ölçüldü, sınır iki uçta da doğrudan doğrulandı). |
| Sınıf | **Bayat beklenti** — kod doğru |

**Beklenen:** Bildirime tıklanınca yönlendirmeden önce okundu işareti tam bir
kez atılmalı.

**Gözlenen:** Davranış aynen böyle; kırılan yalnız kontrolün kendisi. Kontrol
kaynak metninde birebir `markNotificationAsRead(user.id, notification.id)`
dizisini arıyor. `3f67103` render sırasında `revalidatePath` çağrısını
kaldırmak için çağrıya üçüncü bir argüman ekledi:
`markNotificationAsRead(user.id, notification.id, { revalidate: false })`.
Dizi artık birebir tutmuyor, çağrı hâlâ tek ve hâlâ yönlendirmeden önce.

**Kök neden (doğrulandı):** Kontrol davranışı değil kaynak metnini ölçüyor.
Argüman eklemek gibi zararsız bir değişiklik onu kırıyor.

**Yapılacak:** Beklenti `markNotificationAsRead(user.id, notification.id`
öneki (veya çağrı sayımı) hâline getirilir. İkinci sözleşme — "Pro sessizce
kaçmasın" — bu kırmızıdan **etkilenmiyor**; tıklama akışı sağlam.

## KB-6 — Faz 4C faturalama: iki kırmızı, iki AYRI sınıf

| Alan | Değer |
| --- | --- |
| Doğrulayıcı | `apps/web/scripts/verify-phase4c-billing-v1.ts` |
| Bugünkü sonuç | `33 passed, 2 failed` |

İki hata aynı işlem görmemelidir (KB-2'deki gerekçenin aynısı): biri gerçek bir
ödeme yolu kusuru, diğeri yalnız boşluk hassasiyeti.

### KB-6a — `mock_price_PREMIUM` ve `mock_price_CORPORATE` plana çözülmüyor (GERÇEK HATA)

| Alan | Değer |
| --- | --- |
| Kırık kontrol | `2 plan mapping` (satır 56-61) |
| Ne zamandan beri | `d7839b0` — *feat(monetization): integrate recovered entitlement foundation*, 2026-08-16. `d7839b0^` (`0db561c`) yeşildi; sınır iki uçta doğrudan doğrulandı. |
| Sınıf | **Ürün hatası** — ödeme yolu |

**Beklenen:** `resolvePlanTierFromProviderPriceId("mock_price_PREMIUM") === "PREMIUM"`.
Fiyatın kendisi doğru (`displayPriceTry = 990`), kırılan yalnız çözümleme.

**Gözlenen:** `null` dönüyor. `src/lib/billing/plan-mapping.ts` satır 84-89:

```ts
if (providerPriceId.startsWith("mock_price_")) {
  const tier = providerPriceId.replace("mock_price_", "").toUpperCase();
  if (tier === "PROFESSIONAL") {      // ← önce üç tier de vardı
    return tier;
  }
}
```

`d7839b0` bu koşulu `tier === "PREMIUM" || tier === "PROFESSIONAL" ||
tier === "CORPORATE"` hâlinden yalnız `PROFESSIONAL`'a daralttı. Değişikliğin
yanında gerekçe yok; daraltma kasıtlı görünmüyor.

**Neden önemli:** Bu dal mock/sandbox ödeme yolunu besliyor. Gerçek sağlayıcı
fiyat id'leri env üzerinden çözüldüğü için canlı yapılandırmada etkisi yok;
ama Talepo bugün tam olarak sandbox yolunda. Mock sağlayıcı
`mock_price_PREMIUM` ile bir webhook döndürürse plan tier'ı çözülmez ve
**Premium/Kurumsal aboneliği uygulanmaz**.

**Yapılacak:** Koşul üç tier'a geri açılır. Ayrı iş kalemi.

### KB-6b — Şema kontrolü boşluk hizalamasına takılıyor (kod doğru)

| Alan | Değer |
| --- | --- |
| Kırık kontrol | `23 duplicate credit event` (satır 200-205) |
| Ne zamandan beri | `0db561c` — *feat(admin): integrate recovered operations foundation*, 2026-08-16. `0db561c^` (`43068a7`) yeşildi. |
| Sınıf | **Bayat/kırılgan beklenti** — kod doğru |

**Beklenen:** `prisma/schema.prisma` içinde `providerEventId String? @unique`.

**Gözlenen:** Şemada alan **var ve gerçekten `@unique`**, yalnız prisma format
hizalamasıyla araya boşluk girmiş:
`providerEventId String?               @unique`. Yani mükerrer kredi olayını
engelleyen benzersiz indeks yerinde; kırılan yalnız birebir dize araması.

**Yapılacak:** Beklenti boşluğa duyarsız hâle getirilir (regex ya da şema
parse). Garanti zaten sağlanıyor.

## KB-7 — Talep yayınlama doğrulayıcısı veritabanı olmadan asla yeşil olamaz

| Alan | Değer |
| --- | --- |
| Doğrulayıcı | `apps/web/scripts/verify-request-publish-v1.ts` |
| Kırık kontrol | `live createRequest` (satır 260-264) |
| Bugünkü sonuç | `16 passed, 1 failed` |
| Ne zamandan beri | **ÖLÇÜLMEDİ — ve bisect anlamsız** (aşağıya bak) |
| Sınıf | **Ortam eksiği** — kod hakkında bilgi vermiyor |

**Gözlenen:** `PrismaClientKnownRequestError: connect ECONNREFUSED
postgresql://…`. `DATABASE_URL` tanımlı ama veritabanı ayakta değil.

**Neden bisect edilmedi (kurucuya not).** Bu kontrol her commit'te kırmızı
olur; ölçtüğü şey kodun değil, çalıştıran makinenin durumudur. Bisect yalnız
"veritabanının ne zaman kapandığını" bulurdu. Kurucunun bu doğrulayıcıya
yüklediği **birinci sözleşme — "alıcı engellenmesin"** bu yüzden bugün
**ölçülmüyor**: yerelde bu satır sözleşme hakkında hiçbir şey söylemiyor.

**İkinci kusur (asıl mesele).** Doğrulayıcı veritabanı yokken de **başarısız
sayıyor**, atlamıyor:

```ts
if (!hasDb) {
  check("live publish skipped (no DATABASE_URL)", false, "env missing");
  return;
}
```

Yani bu script tanım gereği veritabanı olmadan yeşil olamaz. Bir doğrulayıcının
"ölçemedim" ile "ölçtüm, bozuk" durumlarını aynı renge boyaması, bu deponun
ölçüm dürüstlüğü kuralının ihlalidir — atlanan kontrol *atlandı* diye
raporlanmalı, `fail` diye değil.

**Yapılacak:** (1) Canlı bölüm `skipped` olarak raporlanır, `fail` olarak
değil; (2) sözleşmenin gerçekten ölçülmesi için veritabanlı bir koşu ortamı
gerekir. İkisi de ayrı iş kalemi.

## KB-8 — Bir doğrulayıcı izlenen bir dosyaya yazıyor

| Alan | Değer |
| --- | --- |
| Doğrulayıcı | `apps/web/scripts/verify-catalog-transmissions-v2c.ts` (satır 500-509, `allowNetwork: true` ile canlı sonda) |
| Yazdığı dosya | `data/catalog-ingestion/sources/registry.status.json` (git tarafından izleniyor) |
| Yazma yolu | `src/lib/knowledge/ingestion/adapters/automotive-epa-fueleconomy.ts:225` → `markSourceStatus("auto-epa-fueleconomy", "ACTIVE", { persist: true })` → `source-registry.ts:498` `writeFileSync` |
| Tespit | 2026-08-23, taban ölçümü sırasında |
| Sınıf | **Doğrulayıcı hijyeni** — ürün hatası değil |

**Ne oluyor:** Canlı sonda ağa çıkabildiğinde EPA kaynağını `ACTIVE` işaretler
ve durum dosyasını yeni `updatedAt` / `lastCheckedAt` damgalarıyla diske yazar.
Ağ engelliyse yazmaz — yani **her koşuda değil, bazen**.

**Neden kayda değer (kurucu, 2026-08-23): doğrulayıcı read-only olmalıdır.**
Bugün bu durum taban ölçümünü az kalsın bozuyordu: mevcut iş `git stash` ile
kenara alınıp batarya `c5562bd`'de yeniden çalıştırıldı; o koşu bu dosyayı
değiştirdi ve `stash pop` sonrası değişiklik çalışma ağacına karıştı. Fark
yalnız zaman damgası olduğu için görülüp geri alındı, ama içerik farkı olsaydı
sessizce commit'e girebilirdi. Yazan bir doğrulayıcı, "bu kırmızı benden mi
geldi" sorusunun cevabını üreten yöntemin ta kendisini kirletir.

**Yapılacak:** Canlı sonda `persist` olmadan çalışmalı (ya da doğrulayıcı
koşularında persist kapatan bir bayrak). Ayrı iş kalemi.

---

# TRIAGE — kaydı tamamlanmamış kırmızılar

**Bu bölüm KB kaydı DEĞİLDİR.** Buradaki satırlar yalnız "böyle bir kırmızı
var" der; sebebi, kapsamı ve ne zamandan beri kırmızı olduğu **bilinmiyor**.
Bir triage satırına dayanarak "şu bileşen bozuk" ya da "şu commit yüzünden"
denemez.

**Kural:** Bu bölümdeki her satır ya tam bir KB kaydına yükselir (bisect
edilir, beklenen/gözlenen yazılır, sahibi belirlenir) ya da düzeltilir.
**Bu bölüm kalıcı bir park yeri değildir.** Satır sayısının turdan tura
azalması beklenir; artıyorsa bu başlı başına bir sorun işaretidir.

Ölçüm 2026-08-23, commit `2dd488b`. Toplam kırmızı doğrulayıcı: 16 — bunların
5'i kayıtlı (KB-1, KB-2, KB-5, KB-6, KB-7), 13'ü aşağıda bekliyor.

| Script | Bugünkü sonuç | Ne zamandan beri |
| --- | --- | --- |
| `verify-corporate-workspace-isolation-v1` | 24 passed, 2 failed | ÖLÇÜLMEDİ |
| `verify-my-requests-surface-v1` | 73 passed, 2 failed | ÖLÇÜLMEDİ |
| `verify-offer-media-v1` | 62 passed, 1 failed | ÖLÇÜLMEDİ |
| `verify-outgoing-offer-inbox-v1` | 58 passed, 1 failed | ÖLÇÜLMEDİ |
| `verify-p1-closed-beta-closure-v1` | pass=38 fail=3 | ÖLÇÜLMEDİ |
| `verify-phase1-single-brain-closure-v1` | 46 passed, 1 failed | ÖLÇÜLMEDİ |
| `verify-phase3a-discovery-foundation-v1` | 45 passed, 1 failed | ÖLÇÜLMEDİ |
| `verify-phase3c-corporate-opportunity-center-v1` | 40 passed, 2 failed | ÖLÇÜLMEDİ |
| `verify-phase4d-iyzico-v1` | 46 passed, 1 failed | ÖLÇÜLMEDİ |
| `verify-provider-routing` | AssertionError: 1 routing fixture failed | ÖLÇÜLMEDİ |
| `verify-request-trust-paid-plan-closure-v1` | pass=58 fail=1 | ÖLÇÜLMEDİ |
| `verify-sayfam-home-v1` | 80 passed, 1 failed | ÖLÇÜLMEDİ |
| `verify-unified-preference-criteria-v1` | pass=34 fail=1 | ÖLÇÜLMEDİ |

**Bisect yaparken dikkat (2026-08-23'te bu turda yaşandı).** Sondayı bir kabuk
döngüsünde `sh probe.sh; echo "... exit=$?"` biçiminde çalıştırmayın: `echo`
argümanındaki `$(git log …)` komut ikamesi `$?` değerini **ezer** ve sonda hep
"good" görünür. Bu, iki bisect'in yanlış "good" ucuyla başlamasına ve
`verify-phase4c-billing-v1` için yanlış bir commit'e (`c0a973d`) işaret
etmesine yol açtı; doğru cevap (`d7839b0`) sınırın iki ucu doğrudan
çalıştırılarak bulundu. **Her bisect sonucu, `X^` yeşil / `X` kırmızı diye
elle doğrulanmadan kayda geçirilmemelidir.**
