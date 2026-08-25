# Bilinen kırıklar

Yeşil olmayan ama bilerek taşınan doğrulama hataları. Kural: bir verifier
kırmızıysa ya düzeltilir ya buraya yazılır — sessizce geçilmez. Her satır
"hangi kontrol / ne bekleniyordu / ne oluyor / ne zamandan beri / sahibi"
sorularını cevaplamak zorundadır, yoksa kayıt geçersizdir.

---

## ÖLÇÜM TABANI — 2026-08-25, `47df572` (verilen cevabın soru akışında korunması)

Commit: `47df572` — *fix(requests): preserve resolved answers across question
flow* (parent `757508a`). Bu bölüm, aşağıdaki `a44c23d` tabanının **yerine
geçer**; o bölüm tarihli kanıt olarak silinmeden duruyor.

**Kategori kapsama corpus'u (108 gerçek talep senaryosu):**
`TOTAL=108 · PASS=99 · KNOWN_FAIL=9 · FAIL=0 · XPASS=0` (iki deterministik
koşu, aynı sonuç). Sayılar `a44c23d` ölçümüyle **aynı**: bu dilim soru
kalitesini düzeltti, corpus senaryo sonucunu değiştirmedi.

**Anlama invariant bataryası:** `121 passed · 2 failed · 1 known_fail` —
kırmızılar YALNIZ **I22** (KB-11'in kalan başlık yarısı) ve **I23** (KB-14);
known_fail YALNIZ **I25d**. Batarya 102 passed ölçümünden 121 passed ölçümüne
çıktı: **I49** (yazılan değerin alana bağlanması), **I50** (tüm soru kuyruğu
ve kompozit ölçü sözleşmesi) ve **I51** (kanonik ürün kimliğinin yayın
zincirinde yaşaması, sunum tekilliği) satırları eklendi.

### Tekrar sorulan soru ölçümü — İKİ AYRI ÖLÇÜM

Bu iki sayı **birbirinin yerine kullanılamaz**. İlk ekran ölçümü iyimserdir:
"kullanıcı ölçüyü yazdı ama iki dalga sonra en/boy soruldu" sınıfını
göremez. Bu yüzden ikisi ayrı isimle tutulur.

| | `FIRST_SCREEN` | `FULL_QUEUE` |
| --- | --- | --- |
| measured | 240 | 406 |
| correctly_suppressed | 106 | 106 |
| correctly_asked | 89 | 255 |
| **wrongly_repeated** | **0** | **0** |
| wrongly_suppressed | 45 | 45 |
| not_measured | 986 | 861 |
| accuracy | ≈ %81 | ≈ %89 |

`wrongly_repeated = 0` iddiası metriğe değil **invariant'a** bağlıdır
(`I50g`: açık provenance ile dolan hiçbir alan hiçbir dalgada tekrar
sorulamaz). Metrik yarın daralırsa iddia sessizce doğru görünmez.

**`REQUEST_BRAIN_MEASURED_READINESS ≈ %92`** (formül: 100 × 99/108) — bu sayı
YALNIZ 108 senaryoluk **talep-beyni corpus'unun** ölçümüdür.
**Bütün Talepo'nun %92 hazır olduğu anlamına GELMEZ.**

**`PRO_END_TO_END_MEASURED_READINESS ≈ %22` — değişmedi.** Bu, **ölçülen** Pro
uçtan uca hattıdır; beş bileşen: envelope kategori erişimi (104/108),
güvenilir marka (15/108), ürün türü erişimi (0/108), matching'in
`resolvedEntities` okuması (0), tedarikçi yeteneği (0,
`CAPABILITY_NOT_MEASURED`). **Ürünün genel olarak %22 hazır olduğu anlamına
GELMEZ.** Sınırlar aynen duruyor: **Matching V3 canlı fanout'a bağlı
değildir**, **tedarikçi yetkinliği tamamlanmış ve ölçülmüş değildir**, **canlı
bildirim teslimatı ölçülmemiştir**, **production deploy yoktur**.

### Bu tabanda kapanan ölçülmüş davranışlar

Ayrıntı ve kapanmayan yarısı için bkz. **KB-15 — KISMEN ÇÖZÜLDÜ**.

---

## ÖLÇÜM TABANI — 2026-08-25, `a44c23d` (talep niyeti / arz ilanı ayrımı) — **YERİNE GEÇTİ**

> **Yerine geçti:** bu bölümün corpus, invariant ve hazırlık sayıları
> 2026-08-25 tarihli `47df572` ölçümüyle güncellendi (yukarı bakın). Tarihli
> kanıt olarak korunuyor; bugünün gerçeği olarak okunmamalıdır.

Commit: `a44c23d` — *fix(requests): separate demand intent from supply
listings* (parent `2facc3c`). Bu bölüm, aşağıdaki `3eed002` tabanının
**yerine geçer**; o bölüm tarihli kanıt olarak silinmeden duruyor.

**Kategori kapsama corpus'u (108 gerçek talep senaryosu):**
`TOTAL=108 · PASS=99 · KNOWN_FAIL=9 · FAIL=0 · XPASS=0` (iki deterministik
koşu, aynı sonuç). Önceki `PASS=95 · KNOWN_FAIL=13` ölçümü (2026-08-25,
`3eed002`) bu ölçümle **yer değiştirdi**; silinmedi.

**Kalan 9 KNOWN_FAIL'in dağılımı:** `CATEGORY_SPECIFIC=5 · RC_SPLIT=3 ·
RC_NUMBER=1`. **`RC_RENT` satırı artık yok** — ailenin dört senaryosu
(`auto-05`, `auto-06`, `mach-04`, `health-02`) XPASS olarak ölçüldü, ardından
fixture'daki `knownIssue` kayıtları kaldırıldı ve üçüne `expectedIntent`
beklentisi eklendi. Bkz. **KB-16 — ÇÖZÜLDÜ**.

**Anlama invariant bataryası:** `102 passed · 2 failed · 1 known_fail` —
kırmızılar YALNIZ **I22** (KB-11'in kalan başlık yarısı) ve **I23** (KB-14);
known_fail YALNIZ **I25d**. Üçü de bu turda yeniden ölçüldü, **açık kaldı**.
Batarya 79 passed ölçümünden 102 passed ölçümüne çıktı: **I46** (işlem türü
kanıt önceliği), **I47** (Talepo kapsamı) ve **I48** (kapsam kapılarının
kapanışı) satırları eklendi.

**`REQUEST_BRAIN_MEASURED_READINESS ≈ %92`** (formül: 100 × 99/108) — bu sayı
YALNIZ 108 senaryoluk **talep-beyni corpus'unun** ölçümüdür.
**Bütün Talepo'nun %92 hazır olduğu anlamına GELMEZ.**

**`PRO_END_TO_END_MEASURED_READINESS ≈ %22` — değişmedi.** Beş bileşen:
envelope kategori erişimi (104/108), güvenilir marka (15/108), ürün türü
erişimi (0/108), matching'in `resolvedEntities` okuması (0), tedarikçi
yeteneği (0, `CAPABILITY_NOT_MEASURED`). **Ürünün genel olarak %22 hazır
olduğu anlamına GELMEZ.** Sınırlar bu turda da aynen duruyor: **Matching V3
üretime bağlı değil**, **tedarikçi yetkinliği ölçülmedi**, **canlı bildirim
teslimatı ölçülmedi**, **ürün/varlık sinyalleri canlı matching tarafından
okunmuyor**, **production deploy yok**.

### Kapsam kararının uygulama durumu (`a44c23d`, `BRANCH-WIRED`)

Talepo'nun yalnız talep tarafını kabul ettiği kurucu kararı (bkz.
`docs/ai-handoff/11-DECISION-LOG.md` → **Karar F**) bu commit'te tipli bir
`RequestScope` kararıyla temsil edildi: `DEMAND | UNSUPPORTED_SUPPLY`.
Ölçülen kod gerçeği:

| Sözleşme | Durum |
| --- | --- |
| Karar tek yerde, uzlaştırılmış işlem türünden okunur (`SELL` → kapsam dışı) | Uygulanmış |
| Publish snapshot alanı **additive ve opsiyonel** (`requestScope?`) | Uygulanmış — alan yoksa eski snapshot `DEMAND` gibi okunur, **Prisma kolonu ve migration gerekmedi** |
| Snapshot **denetim bilgisidir, karar yetkisi değildir** | Uygulanmış — sunucu kararı `rawInput`, yoksa `description` üzerinden **yeniden türetir**; istemcinin `DEMAND` diyen snapshot'ı kapıyı açamaz |
| Create, rawInput taşımayan legacy create ve update yolları korunur | Uygulanmış — kapı `parseCreateRequestInput` içinde, `createRequest` çağrılmadan önce |
| Kapsam dışında soru / review / publish kapalı | Uygulanmış |
| Kullanıcı metnini düzenlemeye yönlendirilir | Uygulanmış — açıklama metni ve "Metnimi düzenle" eylemi; tarayıcıda DOM ile doğrulandı |
| Fanout ve bildirime erişilemez | **Yapısal** — Request satırı hiç oluşmaz; `distributeRequestToCompanies` ve `tx.notification.create` yalnız var olan bir Request satırı üzerinden çalışır |

**Bu bölüm hiçbir production iddiası taşımaz.** Yukarıdaki satırlar
`BRANCH-WIRED` kod gerçeğidir; **deploy edilmedi**, **canlı Pro teslim
başarısı ölçülmedi**.

### Yeni bir KB kaydı AÇILMADI

*"Aracımı satmak istiyorum"* girdisinin kategori ve konu türü çözmemesi bir
hata **değildir**: ürün politikası gereği ölçülmüş `UNSUPPORTED_SUPPLY`
sonucudur. Kapsam dışı bir girdinin yönlendirilecek bir talebi yoktur; bu
yüzden kategori ve konu bilerek `UNKNOWN` bırakılır ve gerekçe kanıt olarak
yazılır. Bu turda **hiçbir yeni KB kaydı açılmadı**, **bir KB kaydı kapandı**
(KB-16).

---

## ÖLÇÜM TABANI — 2026-08-25, `3eed002` (istenen hedef / kullanım bağlamı ayrımı) — **YERİNE GEÇTİ**

> **Yerine geçti:** bu bölümün corpus ve invariant sayıları 2026-08-25
> tarihli `a44c23d` ölçümüyle güncellendi (yukarı bakın). Tarihli kanıt
> olarak korunuyor; bugünün gerçeği olarak okunmamalıdır.

Commit: `3eed002` — *fix(requests): distinguish requested target from usage
context* (parent `658dea2`). Bu bölüm, aşağıdaki `80f2bcf` tabanının
**yerine geçer**; o bölüm tarihli kanıt olarak silinmeden duruyor.

**Kategori kapsama corpus'u (108 gerçek talep senaryosu):**
`TOTAL=108 · PASS=95 · KNOWN_FAIL=13 · FAIL=0 · XPASS=0` (iki deterministik
koşu, aynı sonuç). Önceki `PASS=93 · KNOWN_FAIL=15` ölçümü (2026-08-25,
`80f2bcf`) bu ölçümle **yer değiştirdi**; silinmedi.

**Kalan 13 KNOWN_FAIL'in dağılımı:** `RC_RENT=4 · CATEGORY_SPECIFIC=5 ·
RC_SPLIT=3 · RC_NUMBER=1`. `RC_RENT` üçten dörde çıktı: bu bir gerileme
değil, `auto-06`'nın gerçek kusurunun **ilk kez ölçülür hâle gelmesidir**
(aşağıya bakın).

**Anlama invariant bataryası:** `79 passed · 2 failed · 1 known_fail` —
kırmızılar YALNIZ **I22** (KB-11'in kalan başlık yarısı) ve **I23** (KB-14);
known_fail YALNIZ **I25d**. Üçü de bu turda yeniden ölçüldü, **açık kaldı**.

**`REQUEST_BRAIN_MEASURED_READINESS ≈ %88`** (formül: 100 × 95/108) — bu sayı
YALNIZ 108 senaryoluk **talep-beyni corpus'unun** ölçümüdür.
**Bütün Talepo'nun %88 hazır olduğu anlamına GELMEZ.**

**`PRO_END_TO_END_MEASURED_READINESS ≈ %22` — değişmedi.** Beş bileşen:
envelope kategori erişimi (104/108), güvenilir marka (15/108), ürün türü
erişimi (0/108), matching'in `resolvedEntities` okuması (0), tedarikçi
yeteneği (0, `CAPABILITY_NOT_MEASURED`). **Ürünün genel olarak %22 hazır
olduğu anlamına GELMEZ.** Sınırlar bu turda da aynen duruyor: **Matching V3
üretime bağlı değil** (`buildRequestRoutingEnvelope`'un `matching-v3/` dışında
üretim çağrısı yok), **tedarikçi yetkinliği ölçülmedi**, **canlı bildirim
teslimatı ölçülmedi**, **ürün/varlık sinyalleri canlı matching tarafından
okunmuyor**.

### `auto-06` — kategori doğru, işlem türü hâlâ yanlış (RC_RENT KNOWN_FAIL)

Girdi: *"Şirketim için 10 araçlık filo kiralama arıyorum"* (aynı sınıf:
*"10 Clio kiralamak istiyorum"*). Yeniden ölçüm (`3eed002`):
`category = automotive` ✅, `kind = VEHICLE` ✅, **`intent = BUY`** ❌ —
beklenen `RENT`. Cümledeki "kiralama" adı işlem türünü belirlemiyor, sondaki
"arıyorum" fiili kazanıyor.

Bu senaryo S2A ile geçici olarak XPASS verdi, çünkü corpus **niyet eksenini
hiç ölçmüyordu**. Sözleşmeye en dar biçimde `expectedIntent` beklentisi ve
`intentEquals` imzası eklendi; senaryo artık **PASS ya da XPASS DEĞİL**,
`RC_RENT` kök nedeniyle **KNOWN_FAIL**. **Kiralama davranışı üretim kodunda
düzeltilmedi** — bkz. **KB-16**.

Bu satır, `80f2bcf` tabanındaki "auto-06 … `kind` hâlâ PART" satırının
yerine geçer: `kind` düzeldi, kusur işlem türüne kaydı.

### `print-04` ve `print-12` — yalnız kategori/rol tarafı kapandı

| Senaryo | Kapanan | AÇIK kalan |
| --- | --- | --- |
| `print-04` *E-ticaret için karton kutu ürettirmek* | Yanlış `technology` yönlendirmesi düzeldi: `category = printing`, `kind = MANUFACTURED_ITEM`. Legacy kategori fanout'u talebi artık matbaa/ambalaj firmalarına tarıyor — **gerçek kazanım** | `productType` alanı boş kaldığı için kullanıcının yazdığı "karton kutu" bilgisi **tekrar sorulabiliyor** |
| `print-12` *Ambalaj için özel kesim kutu, ölçüler 20x15x10* | `kind` PART → **PRODUCT**, `category = printing`, ürün ifadesi profesyonel metinde korunuyor | `dimensions` alanı boş kaldığı için **"20x15x10" kullanıcıya yeniden soruluyor** |

İkisinde de kapanan şey **kategori/rol kararıdır**; **uçtan uca kullanıcı
deneyimi kapanmadı**. Yazılan değerin alana bağlanmaması ayrı bir kusurdur ve
**KB-15** olarak kayıtlıdır.

**Bu turda kapatılan KB kaydı yok.** İki yeni kayıt açıldı: **KB-15** (yazılı
değer alana bağlanmadığı için soru tekrar soruluyor) ve **KB-16** (kiralama
işlem türü modellenmemiş). Buradaki her sayı **yerel doğrulayıcı ölçümüdür**;
bu bölüm production, deploy ya da gerçek Pro bildirim başarısı hakkında
hiçbir iddia taşımaz.

---

## ÖLÇÜM TABANI — 2026-08-25, `80f2bcf` (tipli sayı-birim otoritesi) — **YERİNE GEÇTİ**

> **Yerine geçti:** bu bölümün corpus ve invariant sayıları 2026-08-25
> tarihli `3eed002` ölçümüyle güncellendi (yukarı bakın). Tarihli kanıt
> olarak korunuyor; bugünün gerçeği olarak okunmamalıdır.

Commit: `80f2bcf` — *fix(requests): classify numeric roles before model
identity* (parent `1042721`). Bu bölüm, aşağıdaki `3f66adb` tabanının
**yerine geçer**; o bölüm tarihli kanıt olarak silinmeden duruyor.

**Kategori kapsama corpus'u (108 gerçek talep senaryosu):**
`TOTAL=108 · PASS=93 · KNOWN_FAIL=15 · FAIL=0 · XPASS=0` (iki deterministik
koşu, aynı sonuç). Önceki `PASS=91 · KNOWN_FAIL=17` ölçümü (2026-08-25,
`3f66adb`) bu ölçümle **yer değiştirdi**; silinmedi.

**Kalan 15 KNOWN_FAIL'in dağılımı:** `CATEGORY_SPECIFIC=8 · RC_RENT=3 ·
RC_SPLIT=3 · RC_NUMBER=1` — her biri fixture'da kök neden + makine
doğrulanabilir imzayla kayıtlı.

**Tam kapanan iki senaryo:** `baby-02` (*Oto koltuğu arıyorum 9-36 kg* —
ağırlık aralığı artık ekran boyutu üretmiyor, başlık "9"a bozulmuyor) ve
`health-04` (*Klinik için steril eldiven arıyorum, 100 kutu* — miktar birimi
üretim talebi kurmuyor; `kind=PRODUCT`, `quantity=100`). İkisi de XPASS
olarak ölçüldü, ardından fixture'daki `knownIssue` kayıtları kaldırıldı.
**Bu iki senaryo bir KB kaydına karşılık gelmiyor:** belge KB-1…KB-14
kayıtlarında `screenSize`, "9-36 kg", "100 kutu" ve MANUFACTURED_ITEM
sınıfları arandı, eşleşen kayıt bulunamadı. Bu turda **hiçbir KB kaydı
kapatılmadı** — isim benzerliğiyle kapatma yapılmadı.

**Kısmen iyileşen ama AÇIK kalan beş senaryo** (yüzdenin arkasına
saklanmamalıdır; hiçbiri ÇÖZÜLDÜ değildir):

| Senaryo | Bu commit'te düzelen | AÇIK kalan gerçek kök |
| --- | --- | --- |
| `auto-11` *Araba lastiği arıyorum 205/55 R16* | `envelope.model` sızıntısı temizlendi, `tireSize = "205/55 R16"` doldu | Taksonomi alias'ı ("lastiği" → Lastik düğümü) ve lastik ailesinin `kind` kararı — hâlâ VEHICLE |
| `furn-07` *Yemek masası arıyorum 6 kişilik ahşap* | Yanlış `model="6"` ve "6" başlığı temizlendi, `seatingCapacity` tutuluyor | "ahşap" malzeme çıkarımı yok; malzeme kullanıcıya yeniden soruluyor |
| `auto-06` *Şirketim için 10 araçlık filo kiralama* | `quantity = 10` yakalanıyor | Kiralama işlem türü modellenmemiş; `kind` hâlâ PART |
| `appl-02` *İnverter klima arıyorum 12000 BTU* | `capacityBtu = 12000` tutuluyor | "İnverter" hâlâ parça alanına yazılıyor |
| `mach-05` *Torna tezgahı için yedek parça* | `model="tezgahı"` sızıntısı temizlendi | Machinery taksonomi boşluğu + kategori yönlendirmesi (automotive'e gidiyor) |

**Marka güven metrikleri (değişmedi):** `BRAND_PRESENT = 15/108` ve
`BRAND_ROUTABLE_TRUSTED = 15/108`. Yeni model sızıntısı: **0**. Katalog
modeli kaybı: **0**. `USER_ASSERTED` marka kaybı: **0**.

**`REQUEST_BRAIN_MEASURED_READINESS ≈ %86`** (formül: 100 × 93/108) — bu
sayı YALNIZ 108 senaryoluk **talep-beyni corpus'unun** ölçümüdür.
**Bütün Talepo'nun hazırlık yüzdesi DEĞİLDİR.**

**`PRO_END_TO_END_MEASURED_READINESS ≈ %22` — değişmedi.** Beş bileşenli
ölçülen Pro hattı metriği: envelope kategori erişimi (104/108), güvenilir
marka (15/108), ürün türü erişimi (0/108), matching'in `resolvedEntities`
okuması (0) ve tedarikçi yeteneği (0, `CAPABILITY_NOT_MEASURED`). Sayı-birim
dilimi bu bileşenlerin hiçbirine dokunmadı; bu yüzden sabit kalması
beklenen sonuçtur. **Ürünün genel olarak %22 hazır olduğu anlamına
gelmez.** Matching entegrasyonu, tedarikçi yetkinliği ve bildirim teslimatı
hâlâ **ölçülmemiş / bağlanmamış** durumdadır.

**Anlama invariant bataryası:** `74 passed · 2 failed · 1 known_fail` —
kırmızılar YALNIZ **I22** (KB-11'in kalan başlık yarısı) ve **I23** (KB-14,
"ön ön far" bitişik tekrarı); known_fail YALNIZ **I25d**. Üçü de bu turda
yeniden ölçüldü ve **açık kaldı**; bu dilimin kapsamına girmediler.

**Bu turda testlerle kilitlenen kalıcı sözleşmeler:**

- **I44a — sayı-birim truth table:** bir sayının görevini bağlamı ve birimi
  belirler. Ayrışan roller: `tireSize`, oturma/kişi kapasitesi (`seating`),
  `quantity`, BTU kapasitesi, ağırlık, `screenSize`, `modelYear` ve
  doğrulanmış model jetonu.
- **I44b:** aynı sayı span'i çelişen iki exact role yazılamaz.
- **I44c/I44e:** miktar, ağırlık, kapasite veya ölçü span'i `envelope.model`
  olamaz; birim/bağlam yokken `screenSize` oluşamaz; çıplak sayı exact model
  olamaz.
- **I44d:** gerçek modeller korunur — `C180`, `SM 74`, `Goody Plus`,
  `A55 D`, `Clio` (ve `Passat`, `iPhone 15 Pro`).
- **I44f:** miktar biriminin ürün adı ("100 kutu" içindeki *kutu*) üretim
  niyeti kuramaz; açık üretim fiili davranışı korunur.
- **I44g:** doğrulanmış bir markayı izleyen ürün veya parça kelimesi, sırf
  markadan sonra geldiği için model olamaz ("Bosch pompa" → `model = null`,
  marka ve parça alanları korunur).

Buradaki her sayı **yerel doğrulayıcı ölçümüdür**; bu bölüm production,
deploy ya da gerçek Pro bildirim başarısı hakkında hiçbir iddia taşımaz.

---

## ÖLÇÜM TABANI — 2026-08-25, `3f66adb` (kanıta dayalı marka otoritesi) — **YERİNE GEÇTİ**

> **Yerine geçti:** bu bölümün corpus ve invariant sayıları 2026-08-25
> tarihli `80f2bcf` ölçümüyle güncellendi (yukarı bakın). Tarihli kanıt
> olarak korunuyor; bugünün gerçeği olarak okunmamalıdır.

Commit: `3f66adb` — *fix(requests): govern brand evidence without losing
intent* (parent `c440f69` = 108 senaryoluk kategori kapsama tabanı,
`verify-category-coverage-v1`).

**Kategori kapsama corpus'u (108 gerçek talep senaryosu):**
`TOTAL=108 · PASS=91 · KNOWN_FAIL=17 · FAIL=0 · XPASS=0`

**Kapanan kök neden aileleri:** `RC_BRAND = 0` (sahte marka üretimi — RAM,
Ticari, Torna, Kompresör, Tekerlekli, Toptan, Kürek, Çelik, Logolu,
E-ticaret artık kesin marka olamıyor) ve `RC_COMPOSER = 0` (bağlaçsız
cümlede öznesiz profesyonel metin). **Kalan 17 KNOWN_FAIL'in dağılımı:**
`CATEGORY_SPECIFIC=9 · RC_RENT=3 · RC_SPLIT=3 · RC_NUMBER=2` — her biri
fixture'da kök neden + makine-doğrulanabilir imzayla kayıtlı.

**Marka güven metrikleri:** `BRAND_PRESENT = 15/108` ve
`BRAND_ROUTABLE_TRUSTED = 15/108` — routing envelope'a ulaşan HER marka
denetlenebilir kanıt etiketi taşıyor (`VERIFIED_CATALOG` ya da
`USER_ASSERTED`). Katalog markası kaybı: **0**. Kullanıcı beyanlı marka
kaybı: **0** ("eufy marka bebek arabası" küçük harfe rağmen USER_ASSERTED
çözülüyor; sözdizimsiz "Nordex klima" tasarım gereği yalnız CANDIDATE
kalır ve metinden silinmez).

**`REQUEST_BRAIN_MEASURED_READINESS ≈ %84`** — bu, YALNIZ 108 senaryoluk
talep-beyni corpus'unun ölçümüdür (formül: 100 × 91/108; KNOWN_FAIL paya
girmez). **Bütün Talepo'nun hazırlık yüzdesi DEĞİLDİR.**

**`PRO_END_TO_END_MEASURED_READINESS ≈ %22`** — beş bileşenli ölçülen Pro
hattı metriğidir: envelope kategori erişimi (104/108), güvenilir marka
(15/108), ürün türü erişimi (0/108), matching'in `resolvedEntities`
okuması (0) ve tedarikçi yeteneği (0, `CAPABILITY_NOT_MEASURED`). Düşük
olması marka düzeltmesinin başarısızlığı değildir; product routing,
matching entegrasyonu, tedarikçi yeteneği ve canlı bildirim bileşenlerinin
henüz ölçülmemiş/0 olmasındandır. **Ürünün genel olarak %22 hazır olduğu
anlamına gelmez.**

**Anlama invariant bataryası:** `67 passed · 2 failed · 1 known_fail` —
kırmızılar YALNIZ **I22** (KB-11'in kalan başlık yarısı) ve **I23**
(KB-14, "ön ön far" bitişik tekrarı); known_fail YALNIZ **I25d**'nin
"koltuk destek mekanizması" yarısı ("destek ayağı" yarısı bu commit'le
kapandı).

**Yerine geçme notu:** 2026-08-24 tarihli KB-11/KB-12/KB-13 durum satırları
ve TRIAGE'daki `verify-semantic-request-subject` satırı bu ölçümle
**güncellendi** (aşağıda kayıt içlerinde); o günkü ölçümler silinmedi,
tarihli kanıt olarak duruyor. Production/deploy durumu hakkında bu bölüm
hiçbir iddia taşımaz — buradaki her sayı yerel doğrulayıcı ölçümüdür.

---

## KB-1 — Yedek parça talebinde uyumlu araç kimliği kayboluyor

| Alan | Değer |
| --- | --- |
| Doğrulayıcı | `apps/web/scripts/verify-browse-semantic-closure-v1.ts` |
| Kırık kontroller | `B facts uyumlu marka/model` (satır 240), `B parent entity VEHICLE (compatibility)` (satır 246) |
| Bugünkü sonuç | `pass=37 fail=2` — **yeniden ölçüm 2026-08-25, HEAD `7bbe0c9`: değişmedi**, aynı iki kontrol kırmızı |
| Ne zamandan beri | `b0e9a22` — *feat(requests): add guided request composer v2*, 2026-08-21. Bir önceki commit `0975ab9`'da doğrulayıcı `pass=39 fail=0` idi (2026-08-23'te bisect ile ölçüldü: 192 commit'lik aralık ikili aramayla daraltıldı). |
| Kapanış ölçüsü | `verify-browse-semantic-closure-v1` → **`pass=39 fail=0`** (regresyon öncesi `0975ab9`'da ölçülen değer). Ayrıca browse yolunda `requestSubject.parentEntity.kind = VEHICLE`, uyumluluk **markası ve modeli** görünür, istenen parça ile üst araç rolleri karışmaz. |
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

### KB-6a — ~~GERÇEK HATA~~ → **BAYAT BEKLENTİ** (yeniden sınıflandırıldı, ÇÖZÜLDÜ)

| Alan | Değer |
| --- | --- |
| Kırık kontrol | `2 plan mapping` |
| Ne zamandan beri | `d7839b0` (2026-08-16); sınır iki uçta doğrudan doğrulandı |
| İlk sınıflandırma | ~~Ürün hatası — ödeme yolu~~ **YANLIŞTI** |
| Doğru sınıf | **Bayat beklenti** — kod doğru |
| Durum | **Kapandı** 2026-08-23: beklenti güncellendi, kontrol yeşil |

**Neden yanlış sınıflandırıldı.** `resolvePlanTierFromProviderPriceId` mock
dalı `d7839b0`'da üç tier'dan yalnız `PROFESSIONAL`'a daraltılmıştı ve
**yanında gerekçe yoktu**. Bisect bunu "ödeme yolunda gerileme" gibi gösterdi;
kayda öyle geçti ve düzeltme onayı alındı. Kurucu düzeltmeyi durdurdu:

> **Premium ve Kurumsal paketler üründen kaldırıldı; tek paket var, o da
> Profesyonel.** `d7839b0`'daki daraltma kaza değil, bu kararın kod
> karşılığıydı.

Yani `mock_price_PREMIUM` için `null` dönmesi **doğru davranıştır**. Kırık olan
doğrulayıcının beklentisiydi — hâlâ üç paketli dünyayı bekliyordu.

**Yapılan:** `plan-mapping.ts`'e **dokunulmadı** (değişiklik geri alındı).
`verify-phase4c-billing-v1` "2 plan mapping" tek Profesyonel paketi bekleyecek
şekilde güncellendi ve kaldırılan tier'ların `null` dönmesini açıkça sınıyor —
böylece paketlerin sessizce geri gelmesi de gerileme sayılır.

**Asıl kusur burada değil, kayıttaydı.** Karar 2026-08-16'da hiçbir yere
yazılmamıştı; kodda yalnız gerekçesiz bir daraltma kaldı. Bu yüzden altı gün
sonra hata sanıldı ve kaldırılan iki paket az kalsın ürüne geri döndü. Karar
şimdi `docs/ai-handoff/11-DECISION-LOG.md` → *Karar D* olarak mühürlendi.

**Ders (genel):** Gerekçesiz bir daraltma, altı ay sonra biri tarafından
"düzeltilir". Kapsam kaldıran her ürün kararı karar kaydına, kod karşılığı
(commit) ile birlikte yazılmalıdır.

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

## KB-9 — Doğrulayıcılar ortak veritabanına yazabiliyordu (KAPATILDI)

| Alan | Değer |
| --- | --- |
| Etkilenen | `verify-request-publish-v1`, `verify-my-requests-surface-v1`, `verify-personal-saved-search-alert-ownership-v1`, `verify-offer-inbox-scope-v1`, `verify-phase4b-soft-launch-v1` |
| Mekanizma | `src/lib/verification/db-guard.ts` |
| Koruyucu | `I15` |
| Durum | **Kapandı** 2026-08-23 |

**Neydi.** `apps/web/.env` Tuğrul ile **ortak kullanılan Supabase pooler'ına**
bakıyor. Yukarıdaki beş doğrulayıcı gerçek prisma istemcisiyle `Request`,
`User`, `Company`, `SavedSearch` satırları oluşturuyordu. Veritabanı
2026-08-23 sabahına kadar kapalıydı (`ECONNREFUSED`), bu yüzden yazımlar
sessizce başarısız oluyordu — **bizi koruyan şey bir kural değil, bir
arızaydı.** Veritabanı gün içinde açıldı.

**Kapatma biçimi: konvansiyon değil mekanizma.** Üç koşul birden aranır; biri
eksikse prisma **import bile edilmez**, bağlantı denenmez, sonuç NOT-MEASURED
olur:

1. `TALEPO_VERIFY_ALLOW_DB=1` açıkça verilmiş,
2. host bir test kalıbına uyuyor (`localhost`, `127.0.0.1`, `*test*`, `*staging*`),
3. host yasak listede değil — `pooler.supabase.com`, `supabase.co`, `rds.amazonaws.com`, `neon.tech`, `prod`, `production` **adıyla** listede.

Bayrak verilse bile ortak host reddedilir; red gerekçesi yasak host'u adıyla
söyler. `verify-fanout-telemetry-v1` taramada çıktı ama **yanlış pozitif**:
sahte bağlantı dizgisi kurup kaynak metni üzerinde dize kontrolü yapıyor.

**`verify-offer-inbox-scope-v1` hakkında — bu bir gerileme DEĞİLDİR.**
Sayı `48 passed` → `0 passed, ÖLÇÜLMEDİ` oldu. O 48 kontrol **ortak veriye
yazarak** yeşil oluyordu; yani meşru kapsam zaten **0**'dı ve 48 sayısı
gerçekte var olmayan bir güvenceyi temsil ediyordu. Kaybedilen kapsam değil,
geri alınan sahte güvencedir. Gerçek kapsam ancak bir test veritabanı
bağlandığında **ilk kez** oluşacaktır.

**Kalan iş:** test veritabanı (ayrı Supabase test projesi/branch). Bağlanana
kadar bu beş doğrulayıcının canlı bölümleri ölçülmez — ve bu, ortak veriye
yazmaktan iyidir.

## KB-10 — Beyaz eşya parçasında cihaz adı cümleden düşüyor — **ÇÖZÜLDÜ**

| Alan | Değer |
| --- | --- |
| Sınıf | **GERÇEK ÜRÜN HATASI** — bayat beklenti değil |
| Ne zamandan beri | **ÖLÇÜLMEDİ** (bisect yapılmadı) |
| Tespit | 2026-08-24, KB-2c düzeltmesi sırasında görünür oldu |
| **Durum** | **ÇÖZÜLDÜ** — `bac6d20d56c0f44f1ae80c5509cf185a4df3caf7` |
| Koruyucu | `I17` (`verify-understanding-invariants-v1`) |

**Beklenen:** "Bosch çamaşır makinesi için pompa arıyorum" girdisinde üretilen
metin, parçanın hangi cihaza ait olduğunu taşımalı.

**Gözlenen (düzeltmeden önce):** `Bosch için pompa arıyorum.` — "çamaşır
makinesi" düşüyordu.

### Kök neden — ilk kayıt YANLIŞTI, ölçümle düzeltildi

> ⚠️ Bu kaydın ilk hâli kök nedeni **`compose-text.ts:533`** (o günkü
> numaralandırmayla `compatibility_part` dalı) diye gösteriyordu. **Bu yanlış ve
> eksikti** ve kod okunarak yazılmıştı, ölçülerek değil. Ölçüm bunu çürüttü;
> o kayda dayanan aday düzeltme uygulansaydı **hata düzelmezdi.**

Ölçülen gerçek (2026-08-24):

| Girdi | `composeDomainId` | `compositionMode` | Gerçek rota |
| --- | --- | --- | --- |
| `Bosch çamaşır makinesi için pompa arıyorum` | `appliances` | **`generic`** | genel `isAutoPart → composeAutoPart` yolu |
| `Mercedes C180 için su pompası arıyorum` | `automotive` | `compatibility_part` | `compatibility_part` dalı |

Bosch vakasının `compositionMode`'u `compatibility_part` **değil `generic`**
olduğu için o dala **hiç girilmiyordu**; bozulma, aşağıdaki genel düşüş
yolundaydı:

```ts
if (isAutoPart(state)) return composeAutoPart(state);   // kategoriye bakmıyor
```

`isAutoPart()` (bugün `compose-text.ts:64`) her `needType === "part"` için
`true` döner — kategori beyaz eşya veya makine olsa bile. `composeAutoPart`
(bugün `:304`) ise `composeCompatibilityPartSentence`'a `parentProduct`
**geçmez**: otomotivde ebeveyn araçtır ve marka/model üzerinden taşınır.
Beyaz eşyada ebeveyn `applianceType` alanındadır ve o yol hiç okunmaz.

`compatibility_part` dalı bozulmanın **kaynağı değildi**, ama aynı
kategori-otoritesi eksikliğini taşıyordu (`state.categoryId === "automotive" ||
isAutoPart(state)`); bu yüzden ikisi **birlikte** sertleştirildi.

**Neden bugün fark edildi.** Daha önce "çamaşır makinesi" cümlede görünüyordu,
ama **yalnızca bozuk parça adının içinde** (`part = "Bosch çamaşır makinesi
için pompa"` — KB-2c). Bilgi, hatanın kazasıyla oradaydı. KB-2c kapanınca parça
adı doğru şekilde `"pompa"`ya indi ve ebeveynin hiçbir zaman düzgün taşınmadığı
ortaya çıktı: gerileme değil, **maskesi kalkmış eski bir eksik**.

### Uygulanan düzeltme — iki parça, birlikte

Yalnız rotayı kapatmak **yetmez, kötüleştirir**: kategori gövdesine düşen talep
`part` alanını hiç okumaz ve pompa **tamamen** kaybolur (ölçüldü). Bu yüzden:

**A — Kategori sınırı.** Otomotiv bestecisi yalnız canonical alan otomotivken
yetkili: `isAutomotiveDomain(state)` = `composeDomainId(state) === "automotive"`
(`:366`). `composeDomainId` bu dosyanın **mevcut** kategori otoritesidir
(`isFurniture`/`isAppliances` de ona dayanır); yeni otorite uydurulmadı. Her iki
rota da buna bağlandı (`:599` ve `:627`). Tek başına `needType === "part"`,
`requestSubject.kind === "PART"`, "parça" kelimesi, ürün adı veya ham metin
otomotiv kanıtı sayılmaz.

**B — Otomotiv dışı uyumluluk yolu.** `composeNonAutomotiveCompatibilityPart`
(`:405`): alan otomotiv değilse ve gerçek `part` varsa marka, model/family,
generation, **üst ürün** ve parça birlikte korunur.

**Üst ürün zinciri tek kaynakta.** `compatibilityParentProduct` (`:382`) —
`applianceType → productType → machineType`. İlk denemede bu zincir iki rotada
ayrı yazılmıştı ve `compatibility_part` dalı `machineType`'ı okumuyordu; o
daldan geçen **sanayi makinesi** parçası üst makine adını yine kaybediyordu.
Zincir artık üç `parentProduct` çağrısının tamamında tek yardımcıdan gelir.
Kategoriye özel metin yok.

### Çözüm kanıtı

| Girdi | Önce | Sonra |
| --- | --- | --- |
| `Bosch çamaşır makinesi için pompa arıyorum` | `Bosch için pompa arıyorum.` | **`Bosch Çamaşır Makinesi için pompa arıyorum.`** |
| `Mercedes C180 için su pompası arıyorum` | `Mercedes C180 için devirdaim pompası arıyorum.` | değişmedi |
| `Alfa Romeo 156 için fren balatası arıyorum` | `Alfa Romeo için fren balatası arıyorum.` | değişmedi |
| `Golf 7 için debriyaj seti arıyorum` | `Volkswagen Golf VII için debriyaj seti arıyorum.` | değişmedi |

`verify-understanding-invariants-v1`: **30 passed, 0 failed**.
`I16` (fazla tekrar koruması) yeşil kaldı — KB-2c tekrarı geri gelmedi.
`I17` hem beyaz eşya hem sanayi makinesi senaryosunu, hem de her iki rotayı
ayrı ayrı tutuyor; makine senaryosu kontrollü canonical state fixture ile
sınanır (doğal dil `machineType`'ı bugün güvenilir doldurmuyor).

**Not:** `I16` bu sınıfı yakalamaz ve yakalaması beklenmez — I16 fazladan
tekrarı, `I17` eksik bilgiyi kovalar. İkisi birlikte çalışır.

## KB-11 — "için" içeren cümlede çok kelimeli parça adı kısalıyor — **KISMEN ÇÖZÜLDÜ**

| Alan | Değer |
| --- | --- |
| Dosya | `apps/web/src/lib/request-composer/build-state.ts` (parça adı zenginleştirme) |
| Sınıf | **GERÇEK ÜRÜN HATASI** — bilgi kaybı |
| Ne zamandan beri | **ÖLÇÜLMEDİ** (bisect yapılmadı) |
| Tespit | 2026-08-24, KB-10 ölçümü sırasında |
| Durum | **Kısmen çözüldü** (ölçüm 2026-08-25, HEAD `3f66adb`) — cümle ve `part` alanı çözüldü (`e564b7d`, baştaki bağlacı kırpan kural); **başlık kısmı AÇIK** |
| Son doğrulama | 2026-08-25, HEAD `80f2bcf` — I22 **hâlâ kırmızı**; sayı-birim dilimi bu kaydın kapsamına girmedi |

**2026-08-25 yeniden ölçümü (aynı girdi):**
`Heidelberg SM 74 için nemlendirme pompası arıyorum`
→ `part = "nemlendirme pompası"`, cümle `Heidelberg SM 74 için nemlendirme
pompası arıyorum.` — kayıt açıldığındaki cümle kaybı **kapandı** ve
`verify-understanding-invariants-v1` I17/I25c ile kilitli.
→ **Başlık hâlâ** `Heidelberg SM 74 için pompa` — "nemlendirme" başlıkta
kayıp. Bu kalan yarı, bataryada **I22 kırmızısı** olarak izleniyor
("başlık zenginleştirilmiş parça adını kaybetmez (KB-11 başlık)") ve bu
kayıt kapatılmadan yeşil sayılamaz.

**Girdi:** `Heidelberg SM 74 için nemlendirme pompası arıyorum`
**Gözlenen:** `Heidelberg SM 74 için pompa arıyorum.` — **"nemlendirme" kayıp.**
**Beklenen:** parça adı `nemlendirme pompası` olarak korunmalı.

**`için` içermeyen biçim bugün DOĞRU çalışıyor:**
`Heidelberg SM 74 nemlendirme pompası` → `Heidelberg SM 74 için nemlendirme
pompası arıyorum.` (`part = "nemlendirme pompası"`). Yani hata, cümlede
uyumluluk bağlacı bulunmasına bağlı.

**Kök neden — ŞÜPHE, kanıtlanmadı.** Parça adını zenginleştiren geri yayılma
kalıbı ham metinden `"için nemlendirme pompası"` adayını üretiyor olabilir;
KB-2c kuralı adayda bağlaç görünce **adayın tamamını** reddediyor ve ham
`"pompa"`ya düşüyor olabilir. Bu okuma kod incelemesine dayanır; **ölçülerek
doğrulanmadı** ve KB-2c öncesi davranış bu makinede karşılaştırmalı olarak
çalıştırılmadı. Düzeltme dilimi önce bunu ölçmelidir.

**Olası yön (karar verilmedi):** adaydan **baştaki** bağlacı kırpıp bağlaç /
ebeveyn-kelime kontrolünü ondan sonra uygulamak. Bu, Heidelberg'i kurtarırken
Bosch'u reddetmeye devam eder (`"Bosch çamaşır makinesi için pompa"` adayında
başta bağlaç yok, ebeveyn kelimeleri var). Denenmedi.

**Kapsam notu:** KB-10 düzeltmesi bu davranışı **değiştirmedi** — önce ve sonra
çıktı aynı ölçüldü, kötüleşme yok.

## KB-12 — Beyaz eşya parçası model/identity alanına düşüyor, cümleden kayboluyor — **ÇÖZÜLDÜ**

| Alan | Değer |
| --- | --- |
| Katman | **Anlama / identity** — besteci değil |
| Sınıf | **GERÇEK ÜRÜN HATASI** |
| Ne zamandan beri | **ÖLÇÜLMEDİ** |
| Tespit | 2026-08-24, KB-10 ölçümü sırasında |
| Durum | **ÇÖZÜLDÜ** (`1186070` — istenen şey üst ürünün modeli olamaz kuralı; yeniden ölçüm 2026-08-25, HEAD `3f66adb`) |

**2026-08-25 yeniden ölçümü — iki vaka da aynı girdilerle:**
(a) `Arçelik bulaşık makinesi için rezistans arıyorum`
→ `part = "rezistans"`, `model = null`, `subject = PART`, cümle
`Arçelik Bulaşık Makinesi için rezistans arıyorum.` — parça artık modele
düşmüyor ve cümlede.
(b) `Siemens ankastre fırın için termostat lazım`
→ `part = "termostat"`, `model = null`, cümle `Siemens Fırın için termostat
arıyorum.` — bağlaç da geri geldi.
**Kilit:** `verify-understanding-invariants-v1` I19/I25c (rol kuralı +
uyumluluk yüzeyleri) ve kategori kapsama corpus'u `appl-06`
(`requiredBrand: Arçelik`, `requiredSurfaceTerms: rezistans`). Hata geri
gelirse bu iki doğrulayıcı kırmızıya düşer.

**2026-08-25 ek kilit (`80f2bcf`).** Aynı sınıfın "istenen şey model olamaz"
kuralı artık tipli model kanıt kapısıyla da korunuyor: **I44g** doğrulanmış
markayı izleyen ürün/parça kelimesinin (`Bosch pompa`, `Siemens fırın için
termostat`) model alanına düşemeyeceğini ölçerek kilitler. Bu, KB-12'nin
durumunu değiştirmez — kayıt zaten ÇÖZÜLDÜ; yalnız geri dönüş yolu bir
doğrulayıcı daha ile kapatıldı.

İki ayrı ağırlıkta, aynı kök:

**(a) Parça tamamen kayboluyor.**
`Arçelik bulaşık makinesi için rezistans arıyorum`
→ `Arçelik Bulaşık Makinesi arıyorum.`
Ölçülen state: `part = null`, `subject = PRODUCT` (PART değil),
`model = "rezistans"`. Yani "rezistans" parça olarak hiç tanınmıyor, **model**
alanına düşüyor ve cümleye hiç girmiyor. Tedarikçi ne istendiğini göremiyor.

**(b) Parça korunuyor ama cümle kusurlu.**
`Siemens ankastre fırın için termostat lazım`
→ KB-10 **öncesi**: `Siemens Fırın arıyorum.` (termostat kayıp)
→ KB-10 **sonrası**: `Siemens Fırın termostat arıyorum.`
Burada `part = "Termostat"` dolu olduğu için KB-10'un genel kuralı parçayı
cümlede tutuyor — bu bir iyileşme. Ama `model` alanına da `"termostat"`
düştüğü için cümle bağlaçsız kalıyor ("Fırın **için** termostat" değil).

**Kök neden.** Besteci değil: her iki vakada da hata, `part` alanının
doldurulmasında ve "rezistans"/"termostat" gibi parça adlarının `model` alanına
atanmasındadır. Bu, `request-understanding` / identity katmanının işidir.

**Kapsam notu.** KB-10 bu kaydı **çözmez**. (a) hiç değişmedi; (b) yalnız
parçanın cümlede kalmasını sağladı, kök nedeni gidermedi. Düzeltme ayrı dilim.

## KB-13 — `verify-semantic-request-subject`: C180 başlığında yasaklı marka — **ÇÖZÜLDÜ**

| Alan | Değer |
| --- | --- |
| Doğrulayıcı | `apps/web/scripts/verify-semantic-request-subject.ts` |
| Kırık kontrol | `C180 ön far` — *headline contains forbidden Mercedes* |
| 2026-08-25 sonucu | **`VERIFY SEMANTIC REQUEST SUBJECT: PASS`** (HEAD `3f66adb`) |
| Ne zamandan beri | **ÖLÇÜLMEDİ** |
| Tespit | 2026-08-24 |
| Durum | **ÇÖZÜLDÜ** (`1186070` — çıkarımla eklenen marka başlıkta kesin gerçek gibi görünemez; yeniden ölçüm 2026-08-25: başlık `C180 için ön far`, "Mercedes" yok) |

**Aynı senaryoda yeni görünür olan AYRI açık:** cümle `Mercedes-Benz C180
için ön ön far arıyorum.` — konum belirteci **"ön" bitişik iki kez**
üretiliyor. Bu, KB-13'ün konusu (başlıkta yasaklı marka) değil; ayrı kayıt:
**KB-14**.

## KB-14 — Konum belirteci parça adına bitişik iki kez ekleniyor

| Alan | Değer |
| --- | --- |
| Katman | Besteci / parça adı birleştirme |
| Kırık kontrol | `verify-understanding-invariants-v1` → **I23** |
| Gözlenen | `C180 ön far` → cümle `Mercedes-Benz C180 için ön ön far arıyorum.` |
| Beklenen | `… için ön far arıyorum.` — belirteç tek kez |
| Ne zamandan beri | **ÖLÇÜLMEDİ** (KB-13 ölçümü sırasında görünür oldu) |
| Tespit | 2026-08-25 |
| Durum | **Açık** — bataryada I23 kırmızısı olarak izleniyor |
| Son doğrulama | 2026-08-25, HEAD `80f2bcf` — I23 **hâlâ kırmızı**; sayı-birim dilimi bu kaydın kapsamına girmedi |

**Senaryo:** Kullanıcı yalnız `C180 ön far` yazıyor; "Mercedes" yazmıyor.
Doğrulayıcı, üretilen başlığın **"Mercedes" içermemesini** şart koşuyor
(`headlineExcludes: ["Mercedes"]`) — marka çıkarımla eklenmiş olsa bile
kullanıcının yazmadığı bir marka başlıkta görünmemeli. Bugün görünüyor.

**KB-10 ile ilgisi YOK — kanıt.** Bu doğrulayıcı `compose-text.ts`'i
**hiç import etmiyor**; kullandıkları: `understand-request`,
`activation-bridge` (başlık buradan gelir), `question-priority`,
`human-question-layer`, `request-category-engine`, `price-strategy-registry`.
`bac6d20` yalnız `compose-text.ts` ve invariant dosyasını değiştirdi; bu
doğrulayıcıya ulaşan bir yol yok. **Mevcut taban kırmızısıdır.**

**Neden bugüne kadar kayıtlı değildi.** Bu script'in özet satırı
(`VERIFY SEMANTIC REQUEST SUBJECT: FAIL`) önceki batarya taramalarında
kullanılan `passed|pass=` desenine takılmıyordu, bu yüzden hem KB kayıtlarına
hem TRIAGE tablosuna girmemişti. Yeni bir hata değil, **yeni görünür oldu**.

## KB-15 — Kullanıcının yazdığı değer alana bağlanmadığı için soru tekrar soruluyor — **KISMEN ÇÖZÜLDÜ**

| Alan | Değer |
| --- | --- |
| Katman | Anlama → besteci alan eşlemesi (`build-state` / soru otoritesi girdisi) |
| Sınıf | **GERÇEK ÜRÜN HATASI** — kullanıcı deneyimi; bilgi ekranda kayboluyor |
| Kırık kontrol | Artık kalıcı: `verify-understanding-invariants-v1` → **I49**, **I50**, **I51** satırları |
| Ne zamandan beri | **ÖLÇÜLMEDİ** (bisect yapılmadı) |
| Tespit | 2026-08-25, S2A ölçümü sırasında (HEAD `3eed002`) |
| **Durum** | **KISMEN ÇÖZÜLDÜ** — `47df572` (2026-08-25, parent `757508a`): **ölçülen** tekrar vakaları kapandı; **sistemin tamamı ölçülmedi** |

### Kapanan ölçülmüş davranışlar (`47df572`)

- Yazılmış toplu ölçü, **sonraki dalgalarda da** en/boy/derinlik sorularını
  sözleşmeye göre kapatır. İlk ekranı ölçen bir kontrol bunu göremiyordu.
- **İki bileşenli** ölçü (`20x15`) en ve boy kapsamı sağlar.
- **Üç bileşenli** ölçü (`20x15x10`) ayrıca derinlik kapsamı da sağlar.
- **Eksen sırası uydurulmaz:** hangi sayının en olduğu şemada tanımlı
  olmadığı için eksen alanlarına değer yazılmaz; karşılama tipli bir kapsama
  kararıyla (`coveredByAggregate`) kurulur.
- **Yazılmamış birim uydurulmaz.** Yazılmış birim korunur (`20x15x10 cm`).
- `Karton kutu` kullanıcıya **etiket** olarak görünür; kanonik değer
  `karton-kutu` ayrı tipli rolde taşınır ve koşullu alanlar onu okur.
- `Toplantı Masası` soruyu kapatırken değer **hem** kanonik `productType`
  **hem de** legacy `furnitureType` alanında kalıcılıkta taşınır.
- **Legacy furniture filtre round-trip eşleşir** (`RequestFieldValue.textValue
  = "Toplantı Masası"`, filtre `input=text` → `contains`).
- **Matching V3 üretim çağrı yolu `discoveryProjection`'ı okur**; envelope
  ürün kimliği `Toplantı Masası` olur. (Önceki bir raporda `product=null`
  yazılmıştı; o **ölçüm hatasıydı** — probe projeksiyonu geçirmiyordu.)
- **Aynı Signal fact iki kez gösterilmez**; çakışmada kanonik alan görünür,
  uyumluluk alanı kalıcılıkta kalır.
- Beş ölçülmüş full-queue senaryosunda **`wrongly_repeated = 0`**.

### Neden TAM kapanmadı

`FULL_QUEUE` ölçümünde **`NOT_MEASURED = 861`** alan-senaryo çifti var. Bu
yüzden **bütün kategori/alan birleşimleri için "tekrar yok" iddiası
üretilemez**; kapanan şey ölçülebilen kısımdır.

Ayrıca **KB-17 ters yöndeki ayrı risktir**: bu kayıt "gereken soru tekrar
soruluyor" kusurudur; KB-17 ise "gereken soru sessiz çıkarımla kapatılıyor"
kusurudur. KB-15'in kapanması KB-17'yi kapatmaz.

**Ölçülen üç vaka (aynı kök, `resolveHybridQuestions` gerçek `/talep` soru
otoritesinden okundu):**

| Girdi | Kullanıcının yazdığı | Alan | Yine de sorulan |
| --- | --- | --- | --- |
| `Ambalaj için özel kesim kutu arıyorum, ölçüler 20x15x10` | `20x15x10` | `dimensions = null` | `dimensions` |
| `E-ticaret için karton kutu ürettirmek istiyorum` | `karton kutu` | `productType = null` | `productType` |
| `Yemek masası arıyorum 6 kişilik ahşap` | `ahşap` | `material = null` | `material` |

**Beklenen:** yazılı değer ilgili alana bağlanmalı ve o soru sorulmamalı.
**Gözlenen:** değer serbest metinde duruyor ama alan boş; soru motoru alanı
"eksik zorunlu" sayıp tekrar soruyor. Kurucunun kuralı gereği bu bir soru
kalitesi kusurudur: kullanıcı yazdığı şeyi ikinci kez yazmak zorunda kalıyor.

**Kapsam notu — S2A ile KARIŞTIRILMAMALI.** `print-04` ve `print-12`de
kategori ve rol kararı `3eed002` ile düzeldi; bu kayıt onların **açık kalan
uçtan uca UX yarısıdır**. Kategori düzelmesi bu kaydı kapatmaz.

**Bu kayıt kapanmadan önce gerekenler:** düzeltme dilimi, sayı/ölçü ve nitelik
span'lerini kanonik alanlara bağlayan tek otoriteyi kullanmalı (ayrı bir
çıkarıcı kurulmamalı) ve kapanış kalıcı bir invariant satırıyla kilitlenmeli.

## KB-16 — Kiralama işlem türü modellenmemiş; arama fiili niyeti ele geçiriyor — **ÇÖZÜLDÜ**

| Alan | Değer |
| --- | --- |
| Katman | Anlama / niyet (`intent-signals`) |
| Sınıf | **GERÇEK ÜRÜN HATASI** — yanlış teklif havuzu |
| Kırık kontrol | `verify-category-coverage-v1` → `auto-06` (`RC_RENT`, imza `intentEquals: "BUY"`) |
| Ne zamandan beri | **ÖLÇÜLMEDİ** (bisect yapılmadı) |
| Tespit | 2026-08-25, S2A ölçümü sırasında (HEAD `3eed002`) |
| **Durum** | **ÇÖZÜLDÜ** — `a44c23d` (2026-08-25, parent `2facc3c`) |
| Koruyucu | `I46a`–`I46f` (`verify-understanding-invariants-v1`) + corpus'ta dört senaryonun `expectedIntent` beklentisi |

### Kapanış kanıtı (yeniden ölçüm, `a44c23d`)

`RC_RENT` ailesinin **dört senaryosu da PASS**; ölçüm sırası: dördü önce XPASS
verdi, ardından fixture'daki `knownIssue` kayıtları kaldırıldı.

| Senaryo | Düzeltme öncesi | Düzeltme sonrası |
| --- | --- | --- |
| `auto-05` *Araç kiralamak istiyorum İstanbul'da* | `RENT` / **`REAL_ESTATE`** / automotive | `RENT` / **`VEHICLE`** / automotive |
| `auto-06` *Şirketim için 10 araçlık filo kiralama arıyorum* | **`BUY`** / `VEHICLE` / automotive | **`RENT`** / `VEHICLE` / automotive |
| `mach-04` *Forklift kiralamak istiyorum* | `RENT` / **`REAL_ESTATE`** / machinery | `RENT` / **`INDUSTRIAL_EQUIPMENT`** / machinery |
| `health-02` *Hasta yatağı arıyorum kiralık* | `RENT` / **`REAL_ESTATE`** / **real-estate** | `RENT` / **`PRODUCT`** / **health** |

Corpus: `TOTAL=108 · PASS=99 · KNOWN_FAIL=9 · FAIL=0 · XPASS=0`; kök neden
dağılımında **`RC_RENT` satırı kalmadı** ve fixture'da hiçbir `RC_RENT`
`knownIssue` kaydı yok. Invariant bataryası: `102 passed · 2 failed ·
1 known_fail`; kırmızılar **yalnız önceden açık olan I22 ve I23**.

### Kök neden — ilk kayıttaki ŞÜPHE doğrulandı, ama EKSİKTİ

Kaydın ilk hâli kökü "kiralama bir AD olarak geçiyor, sondaki `arıyorum` BUY
desenini tetikliyor" diye gösteriyor ve bunun **kod incelemesine dayandığını,
ölçülmediğini** açıkça yazıyordu. Ölçüm bu okumayı **doğruladı** fakat kusurun
yalnız bir parçası olduğunu gösterdi. Ölçülen dört kök:

1. Sözlük düz eşleşmeydi: `kiralama` (ad biçimi) hiç tanınmıyordu.
2. `intent === "RENT"` konu türünü doğrudan gayrimenkul yapıyordu
   (`semantic-subject`), nesne kanıtı yokken `"gayrimenkul"` uyduruluyordu.
3. `extractListingType` kullanıcının yazmadığı sözü `USER_EXPLICIT` kanıt
   gibi kaydediyor, bu uydurma kanıt 2. maddeyi besliyordu.
4. `kiralık` / `satılık` real-estate **kategori anahtar kelimesiydi**.

Düzeltme kelimeye özel yama değildir: işlem ekseninde kanıt sınıfı önceliği
kuruldu (açık işlem ifadesi > ilan sıfatı > genel arama fiili) ve kullanım
bağlamındaki işlem belirtecinin karar verememesi mevcut
`readUsageContextSplit` otoritesinden okundu, ayrı bir çözümleyici
kurulmadı.

### Ölçümde çıkan, kayıtta OLMAYAN iki kusur da kapandı

Ailenin dışında, corpus'ta hiç bulunmayan iki vaka ölçümde görüldü:
*"Satılık araç arıyorum"* `SELL` / `REAL_ESTATE` / real-estate veriyordu (araç
alıcısı emlak havuzuna gidiyordu) ve *"Aracımı satmak istiyorum"* konu türünü
`REAL_ESTATE` yapıyordu. İkisi de aynı kökün ürünüydü ve aynı düzeltmeyle
kapandı.

### Kapsam dışı bırakılanlar

Birinci sınıf bir `LET` niyeti eklenmedi; arz yönü mevcut `SELL` üzerinden
temsil ediliyor ve hangi ilanın verildiği `listingType` alanında korunuyor.
`SELL` talebinde konu türü çözülmüyor — önceki **yanlış** `REAL_ESTATE`
değeri yerine **iddiasız** kalıyor.

### Kaydın açıkken taşıdığı ölçüm (tarihli kanıt — `3eed002`)

Aşağıdaki satırlar kayıt **açıkken** ölçülmüştü; silinmiyor, kapanışın neyi
düzelttiğini gösterdiği için duruyor.

**Girdi:** `Şirketim için 10 araçlık filo kiralama arıyorum` (aynı sınıf:
`10 Clio kiralamak istiyorum`).
**Ölçülen (`3eed002`):** `category = automotive` ✅, `kind = VEHICLE` ✅,
`intent = BUY` ❌. **Beklenen:** `intent = RENT`.

**Neden bugüne kadar görünmüyordu.** Corpus **niyet eksenini hiç ölçmüyordu**;
`auto-06` yalnız kategori ve konu türüyle değerlendiriliyordu ve S2A'dan sonra
bu iki eksen düzelince senaryo XPASS verdi. `3eed002` ile sözleşmeye
`expectedIntent` beklentisi ve `intentEquals` imzası eklendi; senaryo o
noktada **PASS veya XPASS sayılmıyordu**. Yeni bir hata değildi, **yeni
ölçülür olmuştu**.

**Aynı ailedeki diğer kayıtlar (`3eed002` ölçümü):** `auto-05` (*Araç
kiralamak istiyorum İstanbul'da*), `mach-04` (*Forklift kiralamak
istiyorum*), `health-02` (*Hasta yatağı arıyorum kiralık*) — üçünde
`intent = RENT` doğru çözülüyor ama konu türü `REAL_ESTATE`'e düşüyordu.
Toplam `RC_RENT = 4` idi. Kaydın o günkü talebi ("düzeltme dilimi bu dördünü
birlikte ele almalıdır") `a44c23d` ile karşılandı: dördü tek dilimde ele
alındı ve dördü birden PASS oldu.

---

## KB-17 — Çıkarılan değer kullanıcıya gösterilmeden soruyu kapatıyor

| Alan | Değer |
| --- | --- |
| Katman | Besteci alan durumu → soru otoritesi (`build-state` / `resolveHybridQuestions`) |
| Sınıf | **GERÇEK ÜRÜN HATASI** — sessiz varsayım; kullanıcı göremediği bir değerin belirlediği havuza gider |
| Kırık kontrol | Tekrar sorma süpürmesi (108 senaryoluk corpus) → `wrongly_suppressed` |
| Ne zamandan beri | **ÖLÇÜLMEDİ** (bisect yapılmadı) |
| Tespit | 2026-08-25, KB-15 dilimi sırasında ölçülür hâle geldi |
| Durum | **AÇIK — bu turda düzeltilmedi** |

**KB-15'in TERSİ yönü.** KB-15 "gereken soru tekrar soruluyor" der; bu kayıt
"gereken soru sessiz çıkarımla kapatılıyor" der. İkisi ayrı risklerdir ve
biri kapanınca diğeri kapanmaz.

### Kırık kontrol — ölçülen değerler (`47df572`)

```
wrongly_suppressed = 45
  A1 EXACT_TEXT                    = 9
  A2 AUTHORITY_VERIFIED_EQUIVALENT = 2
  B  HIGH_RISK_SILENT_INFERENCE    = 34
  U  NOT_MEASURED / AMBIGUOUS      = 0
  A1 + A2 + B + U = 45 == wrongly_suppressed
```

`FIRST_SCREEN` ve `FULL_QUEUE` ölçümlerinde aynı 45 kayıt görülür.

**Dağılımlar (toplam 45 ile tutar):**

| Provenance | | Kategori | | Alan | |
| --- | --- | --- | --- | --- | --- |
| `INFERRED` | 36 | automotive | 23 | `needType` | 26 |
| `CATALOG_ENRICHED` | 9 | technology | 12 | `model` | 6 |
| | | machinery | 6 | `solutionType` | 4 |
| | | furniture | 3 | `usageArea` | 4 |
| | | health | 1 | `condition` | 2 |
| | | | | `part` | 2 |
| | | | | `brand` | 1 |

### Sınıf sözleşmesi

- **A1 — EXACT_TEXT:** normalize edilmiş tam değer kullanıcı metninde açıkça
  bulunur. Tek ortak sözcük ya da substring **yeterli değildir**.
- **A2 — AUTHORITY_VERIFIED_EQUIVALENT:** değer metinde birebir yoktur, ancak
  **çağrılabilir** bir katalog / taksonomi / alias otoritesi dönüşümü açıkça
  doğrular. Kayıt, kullanılan otoritenin adını ve varsa varlık kimliğini
  taşımak zorundadır. Anlam benzerliği veya gündelik çıkarım kanıt sayılmaz.
- **B — HIGH_RISK_SILENT_INFERENCE:** değer metinde yoktur ve doğrulanmış bir
  otorite yoktur; buna rağmen soru kapanır.
- **U — NOT_MEASURED / AMBIGUOUS:** A1/A2/B için yeterli kanıt yoktur. Zorla
  sınıflandırma yapılmaz.

### A2 kanıt örnekleri (ikisi de gerçek otoriteyle doğrulandı)

| Kayıt | Dönüşüm | Otorite |
| --- | --- | --- |
| `auto-04/part` | `su pompası` → `devirdaim pompası` | `resolveTaxonomyAlias("su pompası")` → `tax:automotive:yedek-parca:cooling:cooling:devirdaim-pompasi` (`PART_TYPE`); ayrıca `data/catalogs/automotive/automotive-part-aliases-tr.json` → `"devirdaim pompası": ["su pompası", "water pump"]` |
| `auto-10/brand` | `C200` → `Mercedes-Benz` | `findModelInText("C200 …")` → `model_mercedes-benz_c-serisi` (`brand_id = brand_mercedes-benz`) → `data/catalogs/automotive/automotive-brands.json` → `"name": "Mercedes-Benz"` |

> **Uyarı — yorum satırı veri değildir.** `AUTOMOTIVE_MODEL_TOKENS` içindeki
> `// Mercedes` başlığı markayı **veri olarak taşımaz**; C200 → Mercedes-Benz
> bağı yalnız katalogdaki `brand_id` alanıdır. İlk ölçümde bu otorite
> çağrılmadığı için kayıt **yanlışlıkla B** sayılmıştı. Yanlış B, yanlış A2
> kadar zararlıdır: kapanmış bir açığı açık gösterir.

### B örnekleri

- `iPhone 15 Pro` → `solutionType = "cep telefonu"` — teknoloji ürün kataloğu
  yalnız `canonical / brand / aliases` taşır, **ürün türü alanı yoktur**.
- `MacBook Pro` → `solutionType = "dizüstü bilgisayar"` — aynı gerekçe.
- `Tekerlekli sandalye arıyorum` → `usageArea = "Ev"`.
- `BMW için ekspertiz arıyorum` → `condition = "İkinci el"`.
- Kullanıcının yazmadığı **`needType`** değerleri (26 kayıtla listenin başı).

### Kapanış ölçüsü

1. **B = 0** — kullanıcının yazmadığı ve hiçbir otoritenin doğrulamadığı
   hiçbir değer soruyu sessizce kapatamaz; böyle bir değer ya doğrulama
   kulvarına ("Bunu doğru anladık mı? · Onayla · Düzenle") düşer ya da soru
   sorulmaya devam eder.
2. **U = 0** — her kayıt kanıtla sınıflandırılabilir olmalıdır.
3. **A1 kayıtlarının provenance'ı kullanıcı metnine uygun olmalıdır**
   (kullanıcı yazdıysa `EXPLICIT_TEXT`). Bugün 9 A1 kaydının tamamı
   `CATALOG_ENRICHED` / `INFERRED` etiketi taşıyor; bu bir davranış değil
   **etiket** hatasıdır.
4. **A2 kayıtlarının her biri typed authority kanıtı taşımalı ve Signal facts
   içinde kullanıcıya görünmelidir** — "su pompası yazdınız, devirdaim
   pompası olarak anladık" görünmeden kapatılamaz.
5. Kapanış raporunda `A1 + A2 + B + U = wrongly_suppressed` eşitliği
   gösterilmeli ve kapanan kayıtlar **`scenarioId/fieldKey`** kimliğiyle
   listelenmelidir.

---

## KB-18 — **GEÇERSİZ: KB-1'in kopyası olarak açıldı, geri çekildi**

| Alan | Değer |
| --- | --- |
| Durum | **GEÇERSİZ — yeni bir kusur değil.** Aynı doğrulayıcı, aynı iki kırık kontrol ve aynı sonuç **KB-1** olarak 2026-08-23'ten beri kayıtlı |
| Doğru kayıt | **KB-1 — Yedek parça talebinde uyumlu araç kimliği kayboluyor** |
| Geri çekilme | 2026-08-25, HEAD `7bbe0c9` üzerinde yeniden ölçüm sırasında |

**Nasıl oluştu ve neden burada duruyor.** 2026-08-25'te
`verify-browse-semantic-closure-v1` kırmızı ölçüldü (`pass=37 fail=2`) ve
belgede kayıtlı olup olmadığı kontrol edilirken **grep çıktısı yanlış
okundu**: sayaç `2` döndüğü hâlde "kayıtlı değil" diye yorumlandı. Bunun
üzerine kayıt hem KB-18 olarak açıldı hem de TRIAGE tablosuna "kayıtsız
kırmızı" satırı eklendi. **İkisi de yanlıştı.** KB-1 zaten aynı iki kontrolü
(`B facts uyumlu marka/model`, `B parent entity VEHICLE (compatibility)`),
aynı beklenen/gözlenen ayrıntısını ve **bisect ile bulunmuş regresyon
noktasını** (`b0e9a22`; öncesi `0975ab9` = `pass=39 fail=0`) taşıyordu.

Kayıt **silinmiyor**: numaranın bir kez kullanıldığı ve neden geri çekildiği
görünür kalsın diye duruyor. Yeni bir KB-18 açılmamalıdır.

**`39/0` ile `37/2` çelişkisinin çözümü.** İkisi de doğrudur ve farklı şeyleri
söyler: **`pass=37 fail=2` bugünkü ölçümdür** (2026-08-25, HEAD `7bbe0c9` —
yeniden ölçüldü, değişmedi); **`pass=39 fail=0` ise regresyon öncesi
`0975ab9`'da ölçülen değerdir** ve bu yüzden aynı zamanda KB-1'in kapanış
ölçüsüdür. Doğrulayıcıda toplam 39 kontrol vardır (37 + 2), dolayısıyla iki
sayı aritmetik olarak da tutarlıdır.

---

## KB-19 — Select filtrelerinde kullanıcı etiketi ile kanonik seçenek değeri eşleşmiyor

| Alan | Değer |
| --- | --- |
| Katman | Besteci alan değeri → yayınlanan `RequestFieldValue` → Pro explore filtresi |
| Sınıf | **ÖLÇÜLMÜŞ SINIR** — Pro tarafında talep kaçabilir |
| Kırık kontrol | **NOT-MEASURED** — bu kayda özel bir doğrulayıcı **henüz yok** |
| Ne zamandan beri | **ÖLÇÜLMEDİ** (bisect yapılmadı) |
| Tespit | 2026-08-25, KB-15 dilimi sırasında filtre round-trip ölçülürken |
| Durum | **AÇIK — ölçülmüş sınır; bu turda düzeltilmedi** |

**Kanıt (elle ölçüldü, sayı üretilmedi).** Kullanıcı `ahşap` yazar; talep
`material = "ahşap"` değerini **kullanıcının kendi sözcüğüyle** korur — bu
doğru sözleşmedir. Ancak Pro explore filtresinde `material` alanı
`input = select` olduğu için karşılaştırma **eşitliktir**; Pro kanonik
seçenekten (`Masif ahşap`) filtrelediğinde `"ahşap" !== "Masif ahşap"` olur ve
ilgili talep **filtre sonucunda kaçar**.

Kullanıcının metnini değiştirmek doğru değildir; eksik olan, **kanonik filtre
değerinin ayrı bir rolde taşınmamasıdır**. (`text` girdili filtreler
`contains` karşılaştırdığı için etkilenmez; ölçülen `furnitureType` ve
`material` round-trip'lerinden yalnız select olan bu sınıra takılır.)

**Bu kayıt için sahte pass/fail sayısı üretilmedi.** Doğrulayıcı yazılana
kadar durumu **NOT-MEASURED**'dır; NOT-MEASURED bir sonuç değildir, ne PASS ne
FAIL sayılır (bkz. KB-7).

**Önerilen kapanış ölçüsü:**

- Görünen etiket / profesyonel metin **kullanıcının ifadesini korur**.
- Kanonik filtre değeri mevcut registry / taksonomi otoritesinden gelir
  (yeni bir liste kurulmaz).
- **Select filtre round-trip testi eşleşir** ve kalıcı bir doğrulayıcı satırı
  olarak kaydedilir.
- Kayıt dışı bir değer görünürlük (`visibleWhen`) veya filtre koşullarını
  **sessizce bozmaz**.
- Kullanıcının yazmadığı bir `material` değeri **uydurulmaz**.


> **Paket kalıntıları** (PREMIUM / CORPORATE'ten kalanlar; kasıtlı legacy ile
> gerçek kalıntı ayrımı dahil): bkz. `docs/ai-handoff/11-DECISION-LOG.md` →
> **Karar D**.

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

Taban ölçümü 2026-08-23, commit `2dd488b`.

**2026-08-24 güncellemesi (commit `bac6d20`).** Aşağıdaki dört satır yeniden
ölçüldü; kalan satırlar **2026-08-23 ölçümünde kaldı** ve yeniden
çalıştırılmadı — o değerler bugünün gerçeği olarak okunmamalıdır. Tabloda 14
satır var: **2'si çözüldü** (`verify-phase4d-iyzico-v1`,
`verify-request-trust-paid-plan-closure-v1` — kanıtı satırlarında), **12'si
açık**. Açık olanların 1'i artık kayıtlı (`verify-semantic-request-subject` →
KB-13), 11'i hâlâ kayıtsız.

`NOT-MEASURED` bir sonuç değildir: ne PASS ne FAIL sayılır, ayrı tutulur
(bkz. KB-7). `verify-my-requests-surface-v1`'in canlı bölümü, ortak
veritabanına yazmayı engelleyen kapı (KB-9) nedeniyle **hiç çalıştırılmadı**;
o kontrolün sonucu bilinmiyor.

| Script | Bugünkü sonuç | Ne zamandan beri |
| --- | --- | --- |
| `verify-corporate-workspace-isolation-v1` | 24 passed, 2 failed | ÖLÇÜLMEDİ |
| `verify-my-requests-surface-v1` | 69 pass / 1 fail / **1 NOT-MEASURED** (ölçüm 2026-08-24) | ÖLÇÜLMEDİ |
| `verify-offer-media-v1` | 62 passed, 1 failed | ÖLÇÜLMEDİ |
| `verify-outgoing-offer-inbox-v1` | 58 passed, 1 failed | ÖLÇÜLMEDİ |
| `verify-p1-closed-beta-closure-v1` | pass=38 fail=3 | ÖLÇÜLMEDİ |
| `verify-phase1-single-brain-closure-v1` | 46 passed, 1 failed | ÖLÇÜLMEDİ |
| `verify-phase3a-discovery-foundation-v1` | 45 passed, 1 failed | ÖLÇÜLMEDİ |
| `verify-phase3c-corporate-opportunity-center-v1` | 40 passed, 2 failed | ÖLÇÜLMEDİ |
| `verify-phase4d-iyzico-v1` | **47 passed, 0 failed — ÇÖZÜLDÜ** (ölçüm 2026-08-24) | çözüldü: `1eb8690`, KB-6b ikizi |
| `verify-provider-routing` | AssertionError: 1 routing fixture failed | ÖLÇÜLMEDİ |
| `verify-request-trust-paid-plan-closure-v1` | **pass=59 fail=0 — ÇÖZÜLDÜ** (ölçüm 2026-08-24) | çözüldü: `af8ec5c`, KB-2c |
| `verify-sayfam-home-v1` | 80 passed, 1 failed | ÖLÇÜLMEDİ |
| `verify-semantic-request-subject` | **PASS — ÇÖZÜLDÜ** (ölçüm 2026-08-25) | çözüldü: `1186070`, KB-13 |
| `verify-unified-preference-criteria-v1` | pass=34 fail=1 | ÖLÇÜLMEDİ |

**Bisect yaparken dikkat (2026-08-23'te bu turda yaşandı).** Sondayı bir kabuk
döngüsünde `sh probe.sh; echo "... exit=$?"` biçiminde çalıştırmayın: `echo`
argümanındaki `$(git log …)` komut ikamesi `$?` değerini **ezer** ve sonda hep
"good" görünür. Bu, iki bisect'in yanlış "good" ucuyla başlamasına ve
`verify-phase4c-billing-v1` için yanlış bir commit'e (`c0a973d`) işaret
etmesine yol açtı; doğru cevap (`d7839b0`) sınırın iki ucu doğrudan
çalıştırılarak bulundu. **Her bisect sonucu, `X^` yeşil / `X` kırmızı diye
elle doğrulanmadan kayda geçirilmemelidir.**
