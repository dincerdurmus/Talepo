# Bilinen kırıklar

Yeşil olmayan ama bilerek taşınan doğrulama hataları. Kural: bir verifier
kırmızıysa ya düzeltilir ya buraya yazılır — sessizce geçilmez. Her satır
"hangi kontrol / ne bekleniyordu / ne oluyor / ne zamandan beri / sahibi"
sorularını cevaplamak zorundadır, yoksa kayıt geçersizdir.

---

## ÖLÇÜM TABANI — 2026-08-27, `7aa6990` (güvenilir marka kanonik otorite merdiveninden ölçülüyor)

Commit: `7aa6990` — *test(eval): measure trusted brand through typed evidence*
(parent `8c16147`). **Yalnız ölçüm otoritesi düzeltmesidir**: ürün kodu, 108
senaryoluk fixture, senaryo beklentileri ve readiness formülü DEĞİŞMEDİ. Bu
bölüm aşağıdaki `111b412` tabanını silmez; o tabanın **tek bir satırının**
(`Pro hattı %22`) yerine geçer ve marka güven eksenindeki bütün önceki
yüzdeleri yürürlükten kaldırır.

```
npx --yes tsx scripts/verify-readiness-brand-authority-v1.ts   # marka otoritesi (yeni)
npx --yes tsx scripts/verify-category-coverage-v1.ts           # kapsam + readiness
```

### İKİ AYRI KAVRAM — bir daha tek sayıya sıkıştırılamaz

| Kavram | Sayaç | Ne demek |
| --- | --- | --- |
| **Marka kanıtı MEVCUT** | `BRAND_EVIDENCE_PRESENT = 16/108` | Talepo'nun marka muhasebesinde bir kanıt KAYDI var. Tek başına güven anlamına **GELMEZ**. |
| **Marka yönlendirmede GÜVENİLİR** | `BRAND_ROUTABLE_TRUSTED = 7/108` | Routing envelope'a marka çıkıyor **VE** kanıt kanonik otorite merdiveninde en az `VERIFIED`. Pro formülüne **YALNIZ bu** girer. |

Güven kararı `request-understanding/provenance.ts` içindeki tek kanonik
merdivenden okunur (`Authority` / `AUTHORITY_RANK` / `isAtLeastAuthority`;
`UNKNOWN < INFERRED < VERIFIED < USER_EXPLICIT`). Eşik
`isAtLeastAuthority(·, "VERIFIED")`. İkinci bir rank tablosu, ikinci bir
"doğrulanmış kaynak" listesi ve ikinci bir provenance enumu **kurulmadı**.

- **`INFERRED` kayıtlar trusted SAYILMAZ.** Talepo'nun kendi çıkarımı,
  kullanıcıya doğrulatılmadığı sürece firmalara yönlendirme sinyali değildir.
- **Provenance'ı olmayan eski (legacy) kayıtlar da trusted SAYILMAZ.** D3c-b
  öncesi yazılmış snapshot'larda değer `attributes.brandEvidence` içindedir ve
  otorite bilgisi HİÇ yoktur; uydurulamaz. Kanonik legacy normalizer
  (`normalizeSnapshotInternalEvidence`) değeri tipli kanala taşır, otoritesi
  `UNKNOWN` kalır ve `UNKNOWN` güvenilir değildir.

### Ölçülen marka kanıtı evreni — 16 kimlik

```
BRAND_PRESENT               = 15/108   (envelope'a marka çıkan senaryo)
BRAND_EVIDENCE_PRESENT      = 16/108   (kanıt kaydı bulunan senaryo)
BRAND_EVIDENCE_UNKNOWN      = 0
BRAND_EVIDENCE_INFERRED     = 9
BRAND_EVIDENCE_VERIFIED     = 7
BRAND_EVIDENCE_USER_EXPLICIT= 0
BRAND_ROUTABLE_TRUSTED      = 7/108
```

Kovalar `BRAND_EVIDENCE_PRESENT`'i tam olarak böler (0 + 9 + 7 + 0 = 16).

**Trusted kimlikler (çift yönlü donduruldu, `missing = 0` · `unexpected = 0`):**
`auto-01` · `auto-02` · `auto-03` · `auto-04` · `auto-07` · `auto-08` ·
`auto-10`. Yedisi de katalog zenginleştirmesinden geçer ve kayıt
`source: FUTURE_KNOWLEDGE` taşır; merdivende `VERIFIED` seviyesindedir.

**16 ≠ 15 ≠ 7 farkı kasıtlıdır.** `mach-07` kanıt taşır ama envelope'a marka
çıkmaz (16 → 15); kalan 15 markanın 9'unun kanıtı `INFERRED` olduğu için
yönlendirmede güvenilir sayılmaz (15 → 7).

### ÜÇ AYRI ÖLÇÜM — birbirinin yerine geçmez

| Ölçüm | Commit | Güvenilir marka | Pro | Durum |
| --- | --- | --- | --- | --- |
| Tarihsel | `eb317dc` | 15/108 (anahtar **varlığı** trusted sanıldı) | ≈**%22** | **YERİNE GEÇTİ / SUPERSEDED** — geçerli readiness otoritesi DEĞİLDİR |
| Bayat | `111b412` → `8c16147` | 0/108 (doğrulayıcı eski generic `attributes` yoluna baktı) | ≈**%19** | **BAYAT ÖLÇÜM / YERİNE GEÇTİ** — ürün gerilemesi DEĞİLDİ |
| Güncel | `7aa6990` | 7/108 (kanonik merdiven) | ≈**%21** | **GEÇERLİ** |

- **≈%22 neden görülüyordu.** Ölçüm, `snapshot.attributes.brandEvidence`
  anahtarının VARLIĞINI güven sayıyordu. Kural `3f66adb` tabanında yazılmıştı:
  "routing envelope'a ulaşan HER marka denetlenebilir kanıt etiketi taşıyor".
  Bu kural Talepo'nun kendi çıkarımını da trusted yapıyordu; sayı sahte olarak
  yüksekti. **Ölçümün kendisi tarihsel kayıt olarak korunur, silinmez.**
- **≈%19 neden görüldü.** `111b412` (D3c-b) iç kanıtı tipli `internalEvidence`
  kanalına taşıdı. Doğrulayıcı hâlâ generic `attributes` yolunu okuduğu için
  kanıtı hiç göremedi ve sayaç 0'a düştü. **Bu bir ürün gerilemesi değildi**;
  kör bir ölçüm aracıydı. Bu tabanda gerçek kodla yeniden koşularak ölçüldü:
  eski yolun gördüğü kanıt `0/108`, tipli kanalınki `16/108`.
- **≈%21 neden geçerli.** Okuma önce tipli `internalEvidence.brandEvidence`
  kanalından yapılır, eski kayıtlar için kanonik legacy normalizer aynı kanala
  taşır, güven kararı merdivenden okunur.

**Tarihsel `%22`, bayat `%19` ve güncel `%21` üç ayrı ölçümdür ve birbirinin
yerine geçmez.** `%22` ve `%19` bu turda kopyalanmadı — ikisi de gerçek kodla
yeniden koşularak ölçüldü.

### Güncel readiness — ham formül ve yuvarlama

```
REQUEST_BRAIN_MEASURED_READINESS ≈ 92
  formül: 100 × PASS / ölçülen senaryo = 100 × 99 / 108

PRO_END_TO_END_MEASURED_READINESS ≈ 21
  bileşenler: envelope kategori erişimi 104/108 · GÜVENİLİR marka 7/108 ·
              ürün türü erişimi 0/108 · matching resolvedEntities okuması 0 ·
              tedarikçi yeteneği 0 (CAPABILITY_NOT_MEASURED)
  ham formül: 100 × ((104/108) + (7/108) + (0/108) + 0 + 0) / 5
  ham değer : 20.555555555555554
  yuvarlanmış: 21
```

**`%21` BÜTÜN TALEPO'NUN HAZIRLIK YÜZDESİ DEĞİLDİR.** Yalnız mevcut BEŞ
bileşenli, **ölçülen** Pro hattı metriğidir. Düşük olması marka düzeltmesinin
başarısızlığı değildir; product routing, matching entegrasyonu, tedarikçi
yeteneği ve canlı bildirim bileşenleri hâlâ ölçülmemiş/0 durumdadır. Aynı
biçimde `%92` de yalnız 108 senaryoluk talep-beyni corpus'unun ölçümüdür.

### Bu tabanda AÇIK kalanlar — kapanmış gösterilmez

- **9 kayıtta kanıt DEĞERİ ile kaydın OTORİTESİ çelişiyor (KNOWN-OPEN).**
  `tech-02` · `tech-03` · `tech-10` · `print-07` · `appl-04` · `appl-06` ·
  `appl-07` · `mach-03` · `mach-07` kayıtlarında değer `VERIFIED_CATALOG` ya da
  `USER_ASSERTED` anlamı taşırken kaydın kendi `provenance` / `source` bilgisi
  `INFERRED` / `DETERMINISTIC_INFERENCE` olarak yazılmıştır
  (`understand-request.ts`). Mevcut kanonik merdivende bu kayıtlar `INFERRED`
  seviyesindedir, bu yüzden **trusted sayılmadılar**. Ölçüm değer dizesinden
  ikinci bir güven kaynağı türetmez. **Bu turda ürün kodu düzeltilmedi ve bu 9
  kayıt güvenilir ilan edilmedi.** Doğrulayıcı sayıyı dondurur ve yayınlar
  (`KNOWN_OPEN_value_claims_more_than_record = 9`).
- **`REQUEST_BRAIN` ile Pro metriğinin `NOT_MEASURED` payda yaklaşımı
  FARKLIDIR.** `REQUEST_BRAIN` paydadan `SCENARIO_NOT_MEASURED` düşer; Pro
  metriği ölçülemeyen bileşeni paydada tutup 0 katkı verir. Bu ayrı bir
  **ölçüm-politikası kararıdır** ve bu turda değiştirilmedi.
- **Product routing `0/108`** — envelope'a ürün türü çıkmıyor.
- **Matching `resolvedEntities` okuması `0`**, tedarikçi yetkinliği `0`
  (`CAPABILITY_NOT_MEASURED`); **canlı bildirim teslimatı ölçülmemiştir.**
- **Matching V3 hâlâ `SHADOW`** ve canlı fanout'a bağlı değildir.
- **Production deploy yoktur**; `PRODUCTION-DEPLOYED` iddiası bu tabanda da
  YOKTUR.

### Korunan ölçümler (`7aa6990`)

```
readiness brand   : present 16 · unknown 0 · inferred 9 · verified 7 · user_explicit 0 · trusted 7
coverage          : 99 pass · 9 known_fail · 0 fail
publish-inference : 85 / 0 / 0 · 23 / 23 / 0
iç kanıt (D3c-b)  : 36 / 36
matching golden   : 117 passed · 0 failed
talep beyni       : %92   (yalnız 108 senaryoluk corpus)
Pro hattı         : %21   (yalnız ölçülen beş bileşenli hat)
```

Kapılar: iki deterministik coverage koşusu **byte-birebir aynı**; trusted
kimlik kümesi fixture ile **çift yönlü** (`missing = 0`, `unexpected = 0`);
gerçek snapshot üzerinde `INFERRED → VERIFIED` mutasyonu sayacı 7 → 8 çıkardı
ve geri alınca 7'ye döndü; `VERIFIED → INFERRED` mutasyonu 6'ya düşürdü;
provenance'sız legacy `VERIFIED_CATALOG` değeri `UNKNOWN` okundu ve trusted
sayılmadı; `tsc` çıkışı 0; kapsamlı lint 0 hata.

Kanıt sınıfı **`CODE-VERIFIED`**: ölçüm gerçek üretim kurucularıyla yapıldı.
Bu dilim için **tarayıcı ölçümü YAPILMADI**, yeni `BROWSER-MEASURED` iddiası
yoktur. **`PRODUCTION-DEPLOYED` DEĞİLDİR.** Bu dilimin kazanımı yüzdeye değil
şu cümleye kaydedilir: **"markayı gördük" ile "bu markaya güvenip firmaları
yönlendirebiliriz" artık iki ayrı sayıdır.**

---

## ÖLÇÜM TABANI — 2026-08-27, `111b412` (iç kanıt kullanıcı attribute'undan ayrıldı)

Commit: `111b412` — *fix(requests): separate internal evidence from user
attributes* (parent `77648d2`). Bu bölüm aşağıdaki `83be90b` tabanını **silmez
ve yerine geçmez**; o tabanın yalnız **iki cümlesinin** yerine geçer (aşağıda
adlarıyla listeleniyor) ve İKİ yüzeyi ilk kez ölçer: **snapshot/projection iç
kanıt ad alanı** ve **eski kayıtların okuma sınırı**.

Ara commit `77648d2` — *test(requests): freeze publish inference authority
baseline* — yalnız doğrulayıcı ve fixture içerir; üretim davranışı
değiştirmez. D3c-a'nın 85/23 ölçüm evrenini dondurulmuş, iki yönlü bir veri
otoritesine bağlar (kaybolan kimlik de açıklanamayan yeni kimlik de kırmızı).

```
npx --yes tsx scripts/verify-snapshot-internal-evidence-v1.ts   # D3c-b — iç kanıt ayrımı
```

### Ölçülen iç kanıt evreni — 36 kimlik

`brandCandidate` ve `brandEvidence`, Talepo'nun kendi marka tahmin
muhasebesidir; kullanıcı beyanı değildir. 108 senaryoluk tabanda ölçülen
kimlik sayısı **36**'dır ve sınıflar kanonik merdivenden okunur
(`classifyAnswerAuthority`, ikinci merdiven kurulmaz):

| Sınıf | Kimlik |
| --- | --- |
| `INFERRED` `brandCandidate` | **20** |
| `INFERRED` `brandEvidence` | **9** |
| `VERIFIED` `brandEvidence` (katalog doğrulaması, kaynak `FUTURE_KNOWLEDGE`) | **7** |
| **Toplam ölçülen iç kanıt** | **36** |

**`home-06/brandCandidate` — iki ölçüm yüzeyi karıştırılmaz.** `NOT_MEASURED`
bir kimliğin değil, **(kimlik × ölçüm yüzeyi)** çiftinin statüsüdür:

| Yüzey | Statü |
| --- | --- |
| D1 kategori/soru ölçümü (`verify-question-suppression-authority-v1`) | `category_unresolved` → **`NOT_MEASURED`** — DEĞİŞMEDİ |
| D3c-b serileştirme ölçümü (`verify-snapshot-internal-evidence-v1`) | iki ardışık koşuda **deterministik olarak ÖLÇÜLDÜ** (değer `Kürek`, `INFERRED`, güven 0.3) |

İki cümle aynı anda doğrudur. Tarihsel D1 fixture'ı, D1 kaydı ve D1'in
`not_measured = 4` sayısı **değiştirilmedi**. Kimlik ayrıca **sahte marka adayı
kanaryası** olarak adlandırıldı: "Kürek" bir ürün kelimesidir, marka değildir;
anlama katmanı bunu bir gün düzelttiğinde D3c-b tabanı kırmızıya döner ve fark
karar gerekçesiyle düşülür.

> **`83be90b` tabanının YERİNE GEÇEN iki cümlesi:** (1) "Ölçülmüş iç kanıt
> kimliği **28**'dir (19 `brandCandidate` + 9 `brandEvidence`)" → bugünkü
> serileştirme yüzeyi ölçümü **36**'dır (20 + 9 + 7); (2) "`home-06`
> … ölçülmüş 20. brandCandidate sayılmaz" → bu cümle **yalnız D1 yüzeyi için**
> geçerlidir; serileştirme yüzeyinde kimlik ölçülür. Eski satırlar tarihli
> kanıt olarak silinmeden duruyor.

### Yeni yazımlarda generic sızıntı — kimlik bazında kapandı

| Ölçüm (108 senaryo) | `111b412` öncesi | `111b412` |
| --- | --- | --- |
| `snapshot.attributes` içinde kullanıcı attribute'u gibi duran | **36** | **0** |
| `projection.attributes` içinde | **36** | **0** |
| `projection.constraints` içinde | **36** | **0** |
| Routing envelope generic `attributes` torbasında | **36** | **0** |
| `payload.fields` yayın torbasında | 0 | **0** |
| Soru adayı olarak render edilen | 0 | **0** |
| Tipli `internalEvidence` kanalında korunan | 0 | **36 / 36** |
| `provenance` / `source` / `confidence` kaybı | — | **0** |

Yeni tipli kanal `internalEvidence`'dır: additive, opsiyonel ve mevcut kanonik
`UnderstandingProvenance` / `UnderstandingSource` tiplerinden okur — **yeni bir
otorite merdiveni ya da paralel provenance enum'u kurulmadı**. Anahtar listesi
tek otoritedir (`INTERNAL_EVIDENCE_ATTRIBUTE_KEYS`).

### Eski kayıtların okuma sınırı — ilk kez ölçüldü

D3c-b öncesi yazılmış kayıtlar iç kanıtı `attributes` içinde taşır ve bu şekil
**veritabanında olduğu gibi kalır**: migration yoktur, backfill yapılmadı, yeni
Prisma kolonu açılmadı (`discoveryProjection` ve snapshot JSON kolonlarıdır).
Güvenli yorumlama tek kanonik normalizer'da, okuma sınırında yapılır
(`parseUnderstandingSnapshot` / `parseDiscoveryProjection`) — bu sınırdan
projeksiyonu okuyan bütün yollar geçer (workspace facts alanı,
`evaluateDiscoveryFilter`, fırsat akışı, kişisel/alarm eşleşmesi, routing
envelope).

| Legacy kapısı | `111b412` |
| --- | --- |
| Parser eski şekli kabul ediyor | **1** (kabul) |
| Tipli kanala ayrılan anahtar | **2 / 2** |
| Generic kullanıcı torbasında kalan | **0** |
| Filtre / `mustIncludes` eşleşmesi üreten | **0** |
| Kişisel takip eşleşmesi üreten | **0** |
| Okuma sınırında girdi mutasyonu | **0** |
| Gerçek kullanıcı attribute'u (`color`) düşmesi | **0** |

### Commit içinde kapatılan sessiz kayıp — çıplak projection yolu

Snapshot **her zaman eklenmiyor**: sunucu yeniden kurulumu
(`create-request.ts`, istemci geçerli projection göndermediğinde) ve
`talep/page.tsx`in `hybrid.state == null` dalı **çıplak** projection persist
eder. İlk uygulamada iç kanıt bu iki yolda hiçbir kalıcı kanala yazılmıyordu —
yani "taşı, silme" sözleşmesi orada **sessiz silmeye** dönüşüyordu.

| Ölçüm | Düzeltme öncesi | `111b412` |
| --- | --- | --- |
| Çıplak projection yolunda kayıp kimlik | **36 / 36** | **0** |
| Çıplak yoldan kurulan envelope'ta kayıp | **36 / 36** | **0** |
| Persist edilen dokümanda tekil kopya dışı durum (0 = kayıp, 2 = çift) | — | **0** |

Bu bulgu commit'e **girmedi**: iki salt-okunur inceleme (geriye uyumluluk ·
sessiz veri kaybı/çift kanıt) sırasında yakalandı, kırmızı kapıyla ölçüldü ve
aynı commit içinde kapatıldı. İncelemelerin diğer üç bulgusu da kapatıldı:
okuma normalizer'ı güvenilmez istemci JSON'unda non-string değerle artık
fırlatmaz, koruma koşulu varlık yerine **değer** üzerinden okunur (boş tipli
girdi gerçek değeri düşüremez) ve legacy taşıma trim disiplinini paylaşır.

> **Bunlar ECC aracı değildir.** Gerçek `ecc:database-reviewer` ve
> `ecc:silent-failure-hunter` araçları bu oturumda mevcut değildi; yapılan
> inceleme salt-okunur ikame incelemedir ve ECC diye adlandırılmaz.

### Matching V3 gölge skor etkisi — önce/sonra ölçüldü

Aynı corpus üzerinde **3.888** talep × tedarikçi çifti (108 senaryo × 36
sentetik tedarikçi) önce ve sonra ölçüldü:

| Ölçüm | Sonuç |
| --- | --- |
| Değişen çift | **11** |
| Etkilenen talep | **3** (`auto-05`, `auto-11`, `svc-06`) |
| Değişimin nedeni | **tamamı** yalnız `attributeHit` kaybı — tam **−8** puan |
| Beklenmedik / ilgisiz skor değişimi | **0** |
| Tier değişimi | `auto-05` / `sup-auto-clio`: **NEAR → REVIEW** · `svc-06` / `sup-services-logo`: **NEAR → REVIEW** |
| Golden corpus | **117 / 0** — hiçbir beklenti değiştirilmedi |

Kaybolan puanın kaynağı: `attributeHit` generic `envelope.attributes`
torbasından beslenir ve oraya yazılan tahminler alakasız kelime eşleşmesi
üretiyordu — `auto-11`'in "Araba" tahmini **dokuz bebek arabası tedarikçisiyle**
puan üretiyordu (hepsi zaten `NO_MATCH`), `auto-05` "Araç", `svc-06`
"Uzaktan". İç kanıt kaybolmadı: envelope'un tipli kanalında 36/36 duruyor.
**Matching V3 hâlâ `SHADOW`'dur ve canlı fanout'a bağlı değildir.**

### Projection otoritesi YENİDEN ÖLÇÜLDÜ — 85 değil, **56**

`83be90b` tabanındaki "`discoveryProjection.attributes/constraints` hâlâ **85**
`INFERRED` değeri provenance/otorite işareti olmadan taşıyor" cümlesi o tarihte
doğruydu ve **tarihsel ölçüm olarak siliniyor değildir**; `111b412` ile
daralmıştır. Sayı kopyalanmadı, gerçek kodla iki deterministik koşuda yeniden
ölçüldü:

| Ölçüm (108 senaryo) | Kimlik |
| --- | --- |
| Kanonik durumda `INFERRED` (değişmedi) | **85** |
| Bunlardan generic `projection.attributes`/`constraints` içinde **kalan** | **56** |
| `111b412` ile tipli `internalEvidence` kanalına **ayrılan** | **29** (20 `brandCandidate` + 9 `INFERRED` `brandEvidence`) |
| Hiçbirinde olmayan | **0** |

Kalan 56'nın alan dağılımı: `needType` **45** · `solutionType` **5** ·
`usageArea` **4** · `condition` **2**. Aynı generic torbada ayrıca 182
`USER_EXPLICIT` ve 17 `VERIFIED` değer de otorite işareti olmadan durur —
provenance boşluğu yalnız `INFERRED` değerlere özgü değildir.

**Bu satır projection otoritesi sorununu çözülmüş göstermez.** D3c-b yalnız iç
kanıt ailesini ayırdı; kalan 56 `INFERRED` kimlik generic okuma modelinde
otorite işareti olmadan durmaya devam ediyor ve **D3c'nin bütünü kapanmış
değildir**.

### Bu tabanda AÇIK kalanlar — kapanmış gösterilmez

- **Generic projection'da provenance/otorite boşluğu AÇIK** — yukarıdaki 56
  `INFERRED` kimlik (ve 199 diğer otoriteli değer) hâlâ işaretsiz. Ayrı karar
  dilimi; bkz. `04-CANONICAL` provenance boşluğu.
- **Düzenleme yolu snapshot'ı yenilemiyor** (`update-request.ts`) — düzenlenen
  talep eski anlamda kalır; bu dilimde ele alınmadı.
- **`clone-request-as-draft` ham JSON'u parse etmeden kopyalar** — normalizer
  idempotent olduğu için okuma güvenlidir, fakat legacy şekil kopyalarda
  yaşamaya devam eder.
- **Legacy constraint metadata'sı taşınmıyor** — `mode` / `strength` /
  `include` / `preferred` alanları ayrımda düşer; yalnız değer tipli kanala
  geçer. İç kanıtın constraint semantiği yoktur; bu bilinçli bir indirgemedir.
- **Eski DB kayıtlarına backfill YAPILMADI** — migration yok, DB yazımı yok.
- **Matching V3 canlı fanout'a bağlı değildir**; tedarikçi yetkinliği ve canlı
  bildirim teslimatı **ölçülmemiştir**.
- **Production deploy yoktur.**

### Korunan ölçümler (`111b412`)

```
publish-inference : 85 / 0 / 0 · 23 / 23 / 0 (dondurulmuş taban)
D3b               : duran 35 · düşen 0
D2                : 0 / 20 / 49 / 3 / 0 / 4 · kaybolan 0
authority ladder  : 11/11
user-choice       : 8/8
invariants        : 121 passed · 2 failed · 1 known_fail  (I22/I23 bilinen kırmızı)
coverage          : 99 pass · 9 known_fail · 0 fail
matching golden   : 117 passed · 0 failed
talep beyni       : %92   (yalnız 108 senaryoluk corpus)
Pro hattı         : %22   (yalnız ölçülen uçtan uca hat)   ← BAYAT, bkz. aşağıdaki düzeltme
```

> **BU SATIRIN YERİNE GEÇİLDİ (`7aa6990`, 2026-08-27).** Buradaki `Pro hattı
> %22` yeniden ölçülmemiş, önceki tabandan kopyalanmıştı; aşağıdaki "Yüzdeler
> oynatılmadı" cümlesi de bu yüzden yanlıştır. Bu commit'te aynı formüllü
> resmî doğrulayıcı gerçekte **≈%19** üretiyordu: D3c-b iç kanıtı tipli
> `internalEvidence` kanalına taşıdıktan sonra doğrulayıcı eski generic
> `attributes` yolunu okumaya devam etti ve güvenilir marka sayacını `0/108`
> gördü. **Bu bir ürün gerilemesi değildi**, kör bir ölçüm aracıydı ve ≈%19 de
> ≈%22 gibi **BAYAT ÖLÇÜM / YERİNE GEÇTİ** sayılır. Geçerli değer `7aa6990`
> tabanındadır: güvenilir marka `7/108`, Pro **≈%21**. Bu satır tarihsel kayıt
> olarak silinmeden bırakılmıştır.

Kanıt sınıfı **`CODE-VERIFIED`**: ölçüm gerçek üretim kurucularıyla yapıldı; bu
dilim için **tarayıcı ölçümü YAPILMADI**, yeni `BROWSER-MEASURED` iddiası
yoktur. **`PRODUCTION-DEPLOYED` DEĞİLDİR.** Yüzdeler oynatılmadı: aynı formüllü
resmî doğrulayıcılar başka bir sayı üretmedi. Bu dilimin kazanımı yüzdeye
değil şu cümleye kaydedilir: **Talepo'nun kendi marka tahmini artık kullanıcı
beyanı kanallarında taşınmıyor — ne yeni kayıtlarda ne eski kayıtların
okunmasında.**

---

## ÖLÇÜM TABANI — 2026-08-27, `83be90b` (onaysız çıkarım yayın kanalından çıkarıldı)

Commit: `83be90b` — *fix(requests): keep unconfirmed inference out of publish
fields* (parent `62a6bc5`). Bu bölüm aşağıdaki `b12ce53` tabanını **silmez ve
yerine geçmez**: soru yüzeyi sayılarının tamamı bu commit üzerinde yeniden
koşuldu ve **birebir aynı çıktı** (D2 `0 / 20 / 49 / 3 / 0 / 4` · kaybolan 0 ·
D1 `FIRST_SCREEN` high_risk 0 / inference_re_asked 20, `exit 3` yeşil kapanış
değildir · D3b duran 35 / düşen 0 · ladder 11/11 · user-choice 8/8 · invariants
`121 / 2 / 1` · kapsama `99 / 9 / 0`). Bu taban yalnız İLK KEZ ölçülen bir
yüzeyi ekler: **kullanıcı-cevabı yayın kanalı**.

```
npx --yes tsx scripts/verify-publish-inference-authority-v1.ts   # D3c-a — yayın kanalı
```

### Yayın kanalı — ilk kez ölçülen sızıntı ve kapanışı

`/talep` yayın payload'ının `fields[]` kanalı (sunucuda `fieldValues` olarak
kalıcılaşır ve firmalara talebin CEVAPLARI olarak görünür) `dynamicValues`
torbasından okunuyordu; `softFillFromComposerState` çıkarım değerlerini de o
torbaya kopyaladığı için tahmin, kullanıcı beyanı gibi yayına gidiyordu.

| Ölçüm (108 senaryo, kullanıcı dokunuşu yok) | `83be90b` öncesi | `83be90b` |
| --- | --- | --- |
| `INFERRED` otoriteli kimlik | 85 | 85 — kanonik durumda korunuyor |
| Kanala dolu değerle sızan kimlik | **23** | **0** |
| Öneri (`inferredSuggestion`) olarak görünen | 35 | **35** — D3b görünürlüğü korunuyor |
| `VERIFIED` / `USER_EXPLICIT` değer kaybı | 0 | **0** (206 kanarya) |

Sızan 23 benzersiz kimlik (`scenarioId/fieldKey`), kapanış kimlik bazında:
`auto-02/condition` · `furn-01/usageArea` · `furn-04/usageArea` ·
`furn-07/usageArea` · `health-03/usageArea` · `mach-01/needType` ·
`mach-02/needType` · `mach-03/needType` · `mach-07/needType` ·
`mach-08/needType` · `print-07/needType` · `tech-01/needType` ·
`tech-01/solutionType` · `tech-02/solutionType` · `tech-03/needType` ·
`tech-03/solutionType` · `tech-05/needType` · `tech-06/needType` ·
`tech-07/needType` · `tech-08/needType` · `tech-10/needType` ·
`tech-10/solutionType` · `tech-11/needType`.

Doğrulayıcı `scripts/verify-publish-inference-authority-v1.ts` önce mevcut
kodda tam bu 23 kimlikle kırmızı koştu; düzeltme sonrası 23/23 yeşil, iki
ardışık koşu birebir aynı. Süzme ölçütü kanonik cevap otoritesidir
(`isInferenceOnlyAnswer` + kullanıcı dokunuş listesi); alan, kategori ya da
senaryo adına özel dal yoktur. Kullanıcı dokunuş listesi understanding
snapshot'ının `confirmedFieldKeys` girdisiyle AYNI diziden kurulur. Ölçülen
kanaryalar: kullanıcı önerilen değerle AYNI değeri açıkça seçerse değer
`USER_EXPLICIT` olarak yayınlanır; alanı temizleyen/reddeden kullanıcıya
çıkarım `payload.fields` içine geri sızmaz; `rawInput` ve kanonik durum
mutate edilmez (frozen-girdi kanıtı). Ortak üretim girdisi kurulumu
`scripts/lib/talep-production-inputs-v1.ts` modülüne alındı; D3b doğrulayıcısı
ve yayın doğrulayıcısı aynı kurucuyu kullanır, ikinci kopya yoktur.

Kanıt sınıfı **`CODE-VERIFIED`**: yayın kanalı ölçümü gerçek yayın kurucularıyla
yapıldı; bu düzeltme için ayrıca tarayıcı ölçümü YAPILMADI, yeni
`BROWSER-MEASURED` iddiası yoktur. **Production deploy yoktur.**

### Bu tabanda AÇIK kalanlar — kapanmış gösterilmez

- **`discoveryProjection.attributes/constraints` hâlâ 85 `INFERRED` değeri
  provenance/otorite işareti olmadan taşıyor.** Kullanıcı-cevabı kanalı
  kapandı; firmaların/Matching V3'ün okuma modeli olan projection ekseni ayrı
  bir karar dilimidir (bkz. `04-CANONICAL` provenance boşluğu).
- **`brandCandidate` / `brandEvidence` snapshot ana `attributes` ad alanında
  duruyor** — D3c-b henüz yapılmadı. Ölçülmüş iç kanıt kimliği **28**'dir
  (19 `brandCandidate` + 9 `brandEvidence`); `home-06/brandCandidate` ayrıca
  `NOT-MEASURED = 1` olarak durur ve ölçülmüş 20. brandCandidate sayılmaz.
  Yayın doğrulayıcısı bu alanların kullanıcı sorusuna dönüşmediğini ölçer;
  ad alanı temizliğini ölçmez.
- Profil tanımı olmayan `needType` / `usageArea` / `solutionType` sınıflarının
  tamamı kapanmış DEĞİLDİR; kapanan yalnız kullanıcı-cevabı yayın kanalıdır.
- Matching V3 canlı fanout'a bağlı değildir; tedarikçi yetkinliği ve canlı
  bildirim teslimatı ölçülmemiştir.

**`REQUEST_BRAIN_MEASURED_READINESS ≈ %92`** — değişmedi (100 × 99/108, yalnız
corpus). **`PRO_END_TO_END_MEASURED_READINESS ≈ %22` — değişmedi**: aynı
formüllü resmî doğrulayıcı `%23` üretmediği için yüzde oynatılmadı.

> **YERİNE GEÇTİ / SUPERSEDED (`7aa6990`, 2026-08-27).** Bu tabandaki (ve
> `eb317dc` ile belgeye geçen) `≈%22`, güvenilir markayı `15/108` sayan
> ölçümdür: `snapshot.attributes.brandEvidence` **anahtarının varlığı** güven
> sayılıyordu, bu yüzden Talepo'nun kendi `INFERRED` çıkarımı da trusted
> oluyordu. Ölçüm tarihsel kayıt olarak korunur; **artık geçerli readiness
> otoritesi DEĞİLDİR.** Geçerli değer: güvenilir marka `7/108`, Pro **≈%21**
> (bkz. bu belgenin başındaki `7aa6990` ölçüm tabanı).

Bu dilimin
kazanımı yüzdeye değil şu cümleye kaydedilir: **kullanıcı-cevabı yayın kanalı
kapandı** — onaysız çıkarım artık `fieldValues` içinde kullanıcı beyanı gibi
görünmüyor.

---

## ÖLÇÜM TABANI — 2026-08-26, `b12ce53` (çıkarım onaysız öneridir; üç yüzeyde ölçüldü)

Commit: `b12ce53` — *fix(requests): require confirmation for inferred answers*
(parent `d3a64c7`). Bu bölüm aşağıdaki `3d5b2a5` tabanını **silmez**; yalnız
iki noktasının **yerine geçer** ve bir yüzeyi ilk kez ölçer. Bütün sayılar bu
commit üzerinde yeniden koşularak yazıldı.

```
npx --yes tsx scripts/verify-inference-confirmation-priority-v1.ts   # D3b — üç yüzey
npx --yes tsx scripts/verify-question-suppression-authority-v1.ts    # D1 ölçüm
npx --yes tsx scripts/verify-inference-question-authority-v2.ts      # D2 kabul
```

### `3d5b2a5` tabanının yerine geçen iki nokta

| Nokta | `3d5b2a5` | `b12ce53` |
| --- | --- | --- |
| `FIRST_SCREEN` · `high_risk_silent_suppression` | **1** (`auto-02/condition@FIRST_SCREEN`) | **0** — aynı kayıt `inference_re_asked` sınıfına geçti |
| `FIRST_SCREEN` · `inference_re_asked` | 19 | **20** |

`3d5b2a5` bölümündeki "ilk ekranda bir kaydın hâlâ bu sınıfta görünmesi üç
görünür soru sınırının bir sonucudur" cümlesi **artık geçerli değildir**: kayıt
sınıra değil, **öncelik kaybına** takılıyordu. Doğrulama soruları artık kuyruğun
önüne alınıyor. `FULL_QUEUE` ekseninde hiçbir sayı değişmedi.

### D3b — üç yüzey ilk kez ayrı ölçüldü

Motor kuyruğunun doğru olması, kullanıcının o soruyu gördüğü anlamına gelmiyordu.
Doğrulayıcı bu yüzden üç yüzeyi ayrı ölçer:

| Yüzey | Kaynak |
| --- | --- |
| `next` | `resolveHybridQuestions(state).next` — motorun iç kuyruğu |
| `candidates` | `resolveHybridQuestions(state, üretimSeçenekleri).candidates` — sıralanmış, görünür sınıra kesilmiş liste |
| `renderableCandidates` | `filterRenderableCandidates(...)` — `/talep` ekranının GERÇEKTEN render ettiği liste |

`auto-02/condition@FIRST_SCREEN` — girdi
`2020 model dizel otomatik Volkswagen Passat arıyorum`:

| | değer |
| --- | --- |
| `condition` | `İkinci el` |
| provenance / authority | `INFERRED` / `INFERRED` |
| `mayCloseQuestion` | **false** — kullanıcı cevabı değildir, soruyu kapatamaz |
| Önce | ilk ekranda **yok**; motor kuyruğunda 2. dalgaya düşüyordu, nihai render süzgecinden ise **tamamen** siliniyordu |
| Şimdi | `next` = `["condition","needType","generation"]` · `candidates` = aynı · `renderable` ilk üçü = `["budget","city","condition"]` |

### Nihai UI süzgeci — bu dilimde ilk kez ölçülen sessiz kayıp

`/talep` ekranı, aday listesini render etmeden önce kendi içinde bir kez daha
süzüyordu ve bu süzgeç hiçbir doğrulayıcı tarafından ölçülmüyordu. Ölçüldüğünde:

| Ölçüm | Düzeltme öncesi | `b12ce53` |
| --- | --- | --- |
| Nihai render yüzeyinden sessizce düşen çıkarım kimliği | **35** | **0** |
| Nihai render yüzeyinde duran çıkarım doğrulaması | 0 | **35** |
| Etkilenen benzersiz senaryo | **30** | — |
| Senaryo başına dağılım | 25 senaryoda 1 · 5 senaryoda 2 (25×1 + 5×2 = 35) | — |
| `USER_EXPLICIT` / kapatmaya yetkili `VERIFIED` yanlış tekrar | 0 | **0** |

Kök neden bir alan hatası değildi: süzgeç, kullanıcı metninden **ikinci kez**
"bu zaten cevaplanmış" kararı üretiyordu. O karar tek yerde verilir — anlama
katmanının alana yazdığı `provenance`. Süzgeç `page.tsx` içinden
`ui-helpers.ts` → `filterRenderableCandidates` altına taşındı; taşıma davranışı
değiştirmedi (108 senaryoda tek fark istenen düzeltmedir) ve bağlantı
`page.tsx`in AST'si üzerinden kanıtlanır.

### Kanonik öneri sözleşmesi — `QuestionCandidate.inferredSuggestion`

Öneri, arayüz kabuğunun prop zincirinde değil **sorunun kendi sözleşmesinde**
taşınır:

| Alan | Değer | Zorlayan |
| --- | --- | --- |
| `value` | gösterilecek tahmin metni | — |
| `authority` | yalnız `INFERRED` | `Extract<Authority, "INFERRED">` (tip) |
| `confirmed` | yalnız `false` | literal `false` (tip) |

Öneri bir kullanıcı cevabı, bir seçim ya da kalıcı bir otorite **değildir**;
seçili durum yalnız taslaktan türetilir. `TalepoAiPanel.tsx`'e özel bir prop
zinciri **kurulmadı** ve o dosya bu commit'te **değişmedi** — bugünkü panel ile
onun yerini alacak arayüz aynı kanonik soru adayını tüketebilir.

> **Maira uygulanmış değildir.** Bu yalnız arayüzün gelecekte
> değiştirilebilmesini sağlayan bir sözleşmedir; Maira ne uygulanmıştır ne de
> `BRANCH-WIRED` sayılır.

### Tarayıcı kanıtı — `BROWSER-MEASURED-LOCAL · PASS`

2026-08-26, yerel çalışma kopyası, boş portta ayrı sunucu. **Publish/create
POST'u ve veritabanı yazımı yok.** Production ya da canlı başarı iddiası
**yoktur**.

**`auto-02`** — `2020 model dizel otomatik Volkswagen Passat arıyorum`:

- `Talepo önerisi · İkinci el · Henüz seçmedik` görünür; `aria-describedby`
  ile seçenek grubuna bağlı (kimlik React `useId` üretimi).
- Başlangıçta üç seçenek de `aria-checked="false"`, seçili stil yok.
- Seçeneğe tıklamak **yalnız taslağı** seçer; soru açık kalır, listede durur.
- `Ekle`/onay **öncesi** authority `INFERRED`; **sonrası** `USER_EXPLICIT`.
- `rawInput` her aşamada birebir aynı kaldı.
- Onaydan sonra soru kapandı, çoğalmadı; `Renk tercihi` ve
  `Kasa / hasar durumu` sonraki dalgada durmaya devam etti.

**`furn-01`** — `Koltuk takımı arıyorum`:

- `Talepo önerisi · Ev · Henüz seçmedik`; hiçbir seçenek seçili değil.
- `Ekle` başlangıçta **disabled** — taslak boş, yani cevap yok.
- Açık seçim ve onaydan sonra değer cevap olur ve soru kapanır.

> **Düzeltme öncesi ölçülen kırmızı.** Aynı iki senaryoda tahmin
> `aria-checked="true"` ve seçili mavi stille geliyordu: `auto-02` → `İkinci el`,
> `furn-01` → `Ev`. Yani kullanıcı hiçbir şeye dokunmadan onaylamış görünüyordu.

### B1 — commit öncesi kapatılan regresyon

Bu dilimin **ilk** uygulaması yeni bir hata üretmişti: `updateDynamicField`
kanonik duruma yazmadığı için, kullanıcının "Bilgileri düzenle" panelinden
girdiği değer (`manualValues`) chip yeniden açıldığında taslaktan **siliniyor**
ve kullanıcının reddettiği tahmin ona **yeniden öneriliyordu**.

Kural genelleştirildi: ekrandaki değer tahminden **farklıysa** o değer
kullanıcıya aittir — taslakta korunur ve öneri üretilmez. İki kalıcı test
vakasıyla kilitlendi:

| Vaka | Beklenen |
| --- | --- |
| `INFERRED` + ekranda farklı değer (`Sıfır`) | taslak `Sıfır`, öneri yok |
| `INFERRED` + ekranda değer yok | taslak boş, öneri `İkinci el` |

Regresyon commit'e **girmedi**.

### Korunan ölçümler (`b12ce53`)

```
D1 FIRST_SCREEN : high_risk_silent_suppression 0 · inference_re_asked 20
D2              : 0 / 20 / 49 / 3 / 0 / 4 · kaybolan 0
FULL_QUEUE      : 942 kimlik — değişmedi
authority ladder: 11/11
invariants      : 121 passed · 2 failed · 1 known_fail
coverage        : 99 pass · 9 known_fail · 0 fail
talep beyni     : %92   (yalnız 108 senaryoluk corpus)
Pro hattı       : %22   (yalnız ölçülen uçtan uca hat)
```

### Bu dilimde KAPANMAYANLAR — gizlenmiyor

- **`budget` / `engine` / `specs` / `technicalSpecs` sabit elemesi.** Nihai
  süzgeçte alan adına özel, `b12ce53`'ten **önce de var olan** bir eleme,
  doğrulama kontrolünden ÖNCE çalışır: bu dört alan yalnız çıkarımdan gelen bir
  değer taşırsa doğrulama sorusu üretilmez. Ölçüldü: 108 senaryoluk tabanda
  tetiklenen kimlik **0**. Kural bu dört alan için evrensel **değildir** ve
  belgede öyle gösterilmiyor.
- **`hybrid.isSyncing` sırasında `canonicalFields = null`.** O render turunda
  doğrulama önceliği kapanır; geçicidir, senkron bitince düzelir, **ölçülmedi**.
- **AST doğrulayıcısının binding/alias sınırı.** Kapılar isim eşleştirmelidir;
  tip denetleyici tabanlı binding çözümlemesi yoktur. Gölgeleme ya da alias'lı
  import yanlış negatif/pozitif üretebilir.
- **Profil tanımı olmayan 50 çıkarım değeri.** 108 senaryoda hiçbir dalgada
  sorulmayan, yalnız çıkarımdan gelen 50 alan değeri duruyor (ör.
  `re-01/brandCandidate`). Bu dilimde ne düzeltildi ne çözülmüş gösterildi.
- **Kapasite kanaryası `NOT-MEASURED`.** Public üretim API'siyle üçten fazla
  eşzamanlı çıkarım doğrulaması üretilemedi (15 girdi denendi, tavan 2).
  Sonuç zorlanmadı.
- **Matching V3 canlı fanout'a bağlı değildir**; tedarikçi yetkinliği ve canlı
  bildirim teslimatı **ölçülmemiştir**; **production deploy yoktur**.

Bu değişiklik `BRANCH-WIRED` · `CODE-VERIFIED` · `BROWSER-MEASURED-LOCAL`'dır.
**`PRODUCTION-DEPLOYED` DEĞİLDİR.**

---

## ÖLÇÜM TABANI — 2026-08-26, `3d5b2a5` (çıkarım öneridir, kullanıcı cevabı değildir)

Commit: `3d5b2a5` — *fix(requests): treat inference as suggestion, never as
user answer* (parent `2a5b587`). Bu bölüm, aşağıdaki `47df572` tabanının
**yerine geçer**; o bölüm tarihli kanıt olarak silinmeden duruyor. Ölçümler bu
commit üzerinde yeniden koşularak yazıldı; hiçbiri önceki rapordan
kopyalanmadı.

```
npx --yes tsx scripts/verify-question-suppression-authority-v1.ts   # D1 ölçüm
npx --yes tsx scripts/verify-inference-question-authority-v2.ts     # D2 kabul
npx --yes tsx scripts/verify-geo-evidence-authority-v1.ts           # coğrafi kanıt
npx --yes tsx scripts/verify-user-choice-authority-v1.ts            # seçim otoritesi
```

### Soru bastırma ölçümü — `3d5b2a5`

| Sonuç | `FIRST_SCREEN` | `FULL_QUEUE` (kapanış ufku) |
| --- | --- | --- |
| `correctly_suppressed` | 49 | **49** |
| **`wrongly_repeated`** | **0** | **0** |
| `high_risk_silent_suppression` | 1 | **0** |
| `missing_required_question` | 377 | 366 |
| `authority_suppressed` | 3 | **3** |
| `not_measured` | 4 | **4** |
| *(bilgi)* `inference_re_asked` | 19 | **20** |
| *(bilgi)* `correctly_asked` | 61 | 148 |
| *(bilgi)* `optional_not_asked` | 213 | 137 |
| *(bilgi)* `OUT_OF_SCOPE` | 218 | 218 |
| *ayrı eksen:* `provenance_mismatch` | 69 | **69** |

**`FIRST_SCREEN`'de `high_risk_silent_suppression = 1` kaldı ve bu sayı
gizlenmiyor.** Kapanış ölçüsü yalnız `FULL_QUEUE`'dur (doğrulayıcı başka ufku
fonksiyon düzeyinde reddeder); ilk ekran ölçümü "bastırıldı" ile "sıraya
girdi"yi ayıramadığı için kapanış iddiası oradan kurulamaz. İlk ekranda bir
kaydın hâlâ bu sınıfta görünmesi, üç görünür soru sınırının bir sonucudur;
`FULL_QUEUE`'da aynı kayıt `inference_re_asked`'a düşer.

**Çıkış kodu hâlâ `3` ve bu YEŞİL DEĞİLDİR.** `0` = ölçüm tamamlandı · `1` =
doğrulayıcı sözleşmesi bozuk · `3` = sözleşme sağlam **fakat kapanış
tamamlanmadı**. Bu tabanda 8 kayıt (4 `scenarioId/fieldKey` × 2 ufuk)
`category_unresolved` nedeniyle ölçülemedi: `health-07/__scenario__`,
`health-08/__scenario__`, `tech-12/__scenario__`, `home-06/brandCandidate`.
`3`'ü "başarılı" diye okumak ölçülemeyeni ölçülmüş saymaktır.

### D2 kabul ölçümü — kayıt kimliği düzeyinde

`verify-inference-question-authority-v2` çıkışı (exit 0):

```
ASKED denkligi: D1 sorulan 142 + D1 sessiz bastirilan 20 = 162
                D2 sorulan 168 · aciklanamayan yeni 6 · kaybolan 0
```

D1'de sorulan 142 kaydın **hiçbiri** düşmedi. Fazladan sorulan 6 kayıt tek tek
listelenir ve `needType` cevaplandıktan sonra görünür hâle gelen alanlardır:
`mach-06/{brand,condition,model}` ve `print-06/{brand,condition,model}`.

### `authority_suppressed = 3` — değişmedi

| Kayıt | Otorite | Kanonik kimlik |
| --- | --- | --- |
| `auto-10/brand@FULL_QUEUE` | `findModelInText(text).record.brand_id -> brandById` | `brand_mercedes-benz` |
| `tech-02/brand@FULL_QUEUE` | `findBrand(text, TECHNOLOGY_BRANDS)` | `brand:Apple` |
| `tech-10/brand@FULL_QUEUE` | `findBrand(text, TECHNOLOGY_BRANDS)` | `brand:Apple` |

### `ce464eb` — otorite merdiveni tekilleştirildi (davranış değişmedi)

Bu taban `3d5b2a5` üzerine kurulmuştur. `ce464eb` (D3a) yalnız **yapıyı**
değiştirdi: aynı otorite sırası dört ayrı biçimde yaşıyordu
(`provenance.ts` rank tablosu + `AttributeAuthority`, besteci tarafında
`AnswerAuthority`, `mapRuProvenance` içinde elle yazılmış doğrulanmış-kaynak
çifti, `preferExplicit`'in ikili kuralı) ve hiçbiri diğerinden türemiyordu.
Artık tek `Authority` tipi ve tek `AUTHORITY_RANK` tablosu
`request-understanding/provenance.ts` içindedir; answer katmanı bağımsız bir
merdiven değil, ondan türeyen dar bir görünümdür. Doğrulanmış kaynak listesi
TypeScript denetimindedir ve enum'da bulunmayan ölü `CATALOG` / `TAXONOMY`
girdileri kaldırıldı.

**Bu turda hiçbir sayı değişmedi.** D2 `0 / 20 / 49 / 3 / 0 / 4`, kaybolan `0`,
D1 `exit 3`, invariant `121/2/1`, kapsama `99 pass` aynen ölçüldü.
`provenance_mismatch` 69'da kaldı ve 69 kaydın **kimlik listesi refactor
öncesiyle birebir aynı** (`diff` ile doğrulandı) — sayı zorla düşürülmedi,
hiçbir fixture beklentisi değiştirilmedi. Kontrol:
`verify-authority-ladder-v1` (11/11). Ayrıntı ve kod gerçeği:
`docs/ai-handoff/11-DECISION-LOG.md` → **Karar H3 uygulama durumu**.

### Bu tabanda AÇIK kalanlar (KNOWN-OPEN)

- **`provenance_mismatch = 69`** — soru kararından bağımsız etiket ekseni. Bu
  dilimde **düzeltilmedi** ve olduğundan iyi gösterilmiyor. `ce464eb` sonrası
  da kapanmadı: kimlikler değişmedi ve **bugünkü davranışsal etkisi
  ölçülmemiştir**, çünkü yayın hattı provenance okumuyor (aşağıdaki D3c
  satırı). Açık ölçüm/etiket farkı olarak duruyor.
- **D3c — yayın projection ve snapshot provenance taşımıyor.**
  `build-projection.ts` içinde `provenance` hiç geçmez; snapshot yalnız
  `confidence` taşır. Bir değerin kullanıcı beyanı mı, katalog doğrulaması mı,
  çıkarım mı olduğu yayın verisinde okunamaz. **AÇIK.**
- **D3b — `auto-02/condition@FIRST_SCREEN` riski.** Çıkarımla dolan
  `condition` (`İkinci el`, importance `optional`) ilk ekranda görünmüyor;
  kullanıcı bu soruyu hiç görmeden review/publish'e ulaşabiliyor, çünkü kapıyı
  yalnız bütçe, konum ve çıkarım taşıyan `routing_critical` alanlar kilitler.
  `FULL_QUEUE`'da `inference_re_asked`. **AÇIK.**
- **`not_measured = 4`** (ufuk başına; iki ufukta 8 kayıt) — gerçek
  ölçülemezlik, yeşile boyanmadı.
- **`MoneyRangeControl` sabit `id="budget-amount"` kullanıyor.** Aynı anda iki
  bütçe kontrolü render edilirse DOM kimliği çakışır. Ölçülmedi, düzeltilmedi.
- **Sekme kapanınca cevap ve taslak kalıcı değildir.** Açık seçim oturum
  state'inde yaşar; kalıcılık bu dilimin kapsamı dışındaydı.
- **Matching V3 canlı fanout'a bağlı değildir.**
- **Tedarikçi yetkinliği ve canlı bildirim teslimatı ölçülmemiştir.**
- **Production deploy yoktur.**

### Diğer bataryalar — `3d5b2a5`

- **Anlama invariant bataryası:** `121 passed · 2 failed · 1 known_fail`.
  Kırmızılar YALNIZ **I22** (KB-11) ve **I23** (KB-14); known_fail YALNIZ
  **I25d**. Üçü de bu tabanda açık kaldı.
- **Kategori kapsama corpus'u:** `TOTAL=108 · PASS=99 · KNOWN_FAIL=9 · FAIL=0 ·
  XPASS=0`.
- **`verify-geo-evidence-authority-v1`:** 9 vaka × 2 katman, exit 0.
- **`verify-user-choice-authority-v1`:** exit 0.

**`REQUEST_BRAIN_MEASURED_READINESS ≈ %92`** (formül: 100 × 99/108) — bu sayı
YALNIZ 108 senaryoluk **talep-beyni corpus'unun** ölçümüdür.
**Bütün Talepo'nun %92 hazır olduğu anlamına GELMEZ.**

**`PRO_END_TO_END_MEASURED_READINESS ≈ %22` — değişmedi.** Bu, YALNIZ
**ölçülen** Pro uçtan uca hattıdır; beş bileşen: envelope kategori erişimi
(104/108), güvenilir marka (15/108), ürün türü erişimi (0/108), matching'in
`resolvedEntities` okuması (0), tedarikçi yeteneği (0,
`CAPABILITY_NOT_MEASURED`). **Ürünün genel olarak %22 hazır olduğu anlamına
GELMEZ.**

---

## ÖLÇÜM TABANI — 2026-08-25, `47df572` (verilen cevabın soru akışında korunması) — **YERİNE GEÇTİ**

> **Yerine geçti:** bu bölümün sayıları 2026-08-26 tarihli `3d5b2a5` ölçümüyle
> güncellendi (yukarı bakın). Tarihli kanıt olarak korunuyor; bugünün gerçeği
> olarak okunmamalıdır.

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

> **YERİNE GEÇTİ — bkz. "SORU BASTIRMA ÖLÇÜM OTORİTESİ V1" (aşağıda).**
> Aşağıdaki tablo **2026-08-25 tarihli, ölçüm aracı repoya kaydedilmemiş,
> tek eksenli tarihsel sonuçtur; yeni sınıflarla karşılaştırılamaz.**
> Bu adları (`wrongly_suppressed`, `FIRST_SCREEN`, `FULL_QUEUE`,
> `correctly_suppressed`) üreten hiçbir script, fixture veya kaynak dosya
> repoda yoktu; sayılar komutla yeniden üretilemiyordu. Tarihli kanıt olarak
> silinmeden duruyor, **bugünün gerçeği olarak okunmamalıdır.**

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

### SORU BASTIRMA ÖLÇÜM OTORİTESİ V1 — yeniden üretilebilir ölçüm (D1)

```
npx --yes tsx scripts/verify-question-suppression-authority-v1.ts
```

**Ölçüm anı:** 2026-08-26, **D1 soru bastırma ölçüm otoritesi commit'i (bu
commit)**. Bir commit kendi nihai SHA'sını içeriğinde taşıyamayacağı için
burada SHA yazılmaz; kayıt kalıcı olarak commit'in kendisine işaret eder.

**Çıkış kodu 3 — YEŞİL KAPANIŞ DEĞİLDİR.** Sözleşme: `0` = ölçüm tamamlandı ve
sözleşme sağlam · `1` = doğrulayıcının sözleşmesi/determinizmi bozuk · `3` =
**ölçüm sözleşmesi sağlam FAKAT kapanış tamamlanmadı** (gerçek `not_measured`
kayıtları var). Bu taban `3` verir: **8 kayıt** (4 `scenarioId/fieldKey` × 2
ufuk) `category_unresolved` nedeniyle ölçülemedi. `3`'ü "başarılı" ya da
"yeşil" diye okumak, ölçülemeyeni ölçülmüş saymaktır — kaydın var oluş
nedeninin tam tersi.

**Ölçüm birimi:** `scenarioId/fieldKey@horizon`. 108 senaryo → **1890 kayıt**
(her `scenarioId/fieldKey` için iki ufuk). İki ardışık koşu **byte-birebir
aynı**; doğrulayıcı ölçümü kendi içinde de iki kez üretip karşılaştırır.

**İKİ AYRI EKSEN.** Ham kanıt (`provenance` etiketinden KOPYALANMAZ; kanıtın
kendisi aranır) ve soru kararı ayrı ölçülür. Bu yüzden aynı kayıt hem
`correctly_suppressed` hem `provenance_mismatch` olabilir.

| Sonuç | `FIRST_SCREEN` | `FULL_QUEUE` |
| --- | --- | --- |
| `correctly_suppressed` | 49 | 49 |
| **`wrongly_repeated`** | **0** | **0** |
| `high_risk_silent_suppression` | 20 | 20 |
| `missing_required_question` | 373 | 368 |
| `authority_suppressed` | 3 | 3 |
| `not_measured` | 4 | 4 |
| *(bilgi)* `correctly_asked` | 67 | 142 |
| *(bilgi)* `optional_not_asked` | 211 | 141 |
| *(bilgi)* `OUT_OF_SCOPE` | 218 | 218 |
| *ayrı eksen:* `provenance_mismatch` | 69 | 69 |

**`FIRST_SCREEN` KAPANIŞ ÖLÇÜSÜ DEĞİLDİR.** Scheduler aynı anda en çok üç soru
gösterdiği için ilk ekrandaki "sorulmadı", *bastırıldı* ile *sıraya girdi*'yi
karıştırır. Kapanış ölçüsü **yalnız `FULL_QUEUE`**'dur ve doğrulayıcıda
fonksiyon düzeyinde kapatılmıştır (başka ufuk istenirse fırlatır).

**`missing_required_question` bir BASTIRMA hatası DEĞİLDİR.** Alan evreni
(`question-profiles` + `global-core`) ile soru kararı otoritesi
(`resolveHybridQuestions`) **ayrı otoritelerdir**; bu sayı, karar otoritesinin
alan evrenini ne kadar kapsadığını gösteren bir **kapsama** göstergesidir.
Kırılım (`FULL_QUEUE`): `publish_required` 208 · `quote_critical` 157 ·
`routing_critical` 3. Gerçek bastırma ölçüsü YALNIZ değer taşıyan alanlardır:
`correctly_suppressed` 49 · `high_risk_silent_suppression` 20 ·
`authority_suppressed` 3 · `wrongly_repeated` 0.

**`high_risk_silent_suppression = 20` (FULL_QUEUE)** — kullanıcının yazmadığı
ve hiçbir çağrılabilir otoritenin doğrulamadığı bir değer soruyu sessizce
kapatıyor. Alan dağılımı: **`needType` 18**, `condition` 2. Bu, KB-17'nin
ölçülebilir çekirdeğidir.

**`authority_suppressed = 3`** — tarafsız sınıf; her kayıt çağrılan otoriteyi
ve döndürdüğü kanonik kimliği taşır:

| Kayıt | Otorite | Kanonik kimlik |
| --- | --- | --- |
| `auto-10/brand@FULL_QUEUE` | `findModelInText(text).record.brand_id -> brandById` | `brand_mercedes-benz` |
| `tech-02/brand@FULL_QUEUE` | `findBrand(text, TECHNOLOGY_BRANDS)` | `brand:Apple` |
| `tech-10/brand@FULL_QUEUE` | `findBrand(text, TECHNOLOGY_BRANDS)` | `brand:Apple` |

**`not_measured = 4` (ufuk başına; iki ufukta toplam 8 kayıt)** — hepsi
`category_unresolved`:
`health-07/__scenario__`, `health-08/__scenario__`, `tech-12/__scenario__`,
`home-06/brandCandidate`.

**`provenance_mismatch = 69`** — soru kararından bağımsız **etiket** ekseni.
En görünür sınıf: kullanıcının metninde birebir bulunan `model` değerleri
(`auto-01`, `auto-02`, `auto-03`, `auto-04`, `auto-07` …) `CATALOG_ENRICHED`
etiketi taşıyor. Bu bir davranış değil etiket hatasıdır ve KB-17 kapanış
ölçüsü #3 ile aynı bulgudur — bu ölçüm onu **bağımsız olarak** yeniden üretti.

> **ESKİ 45 İLE MATEMATİKSEL KARŞILAŞTIRMA YAPILMAZ.** Eski sayı tek eksenli
> bir sayımdı; buradaki yedi sonuç iki ayrı eksenden türer. Aradaki fark bir
> "iyileşme" ya da "kötüleşme" **değildir** — farklı şeyler ölçülmektedir.

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

> **BU KURAL YERİNE GEÇTİ / SUPERSEDED (`7aa6990`, 2026-08-27).** Yukarıdaki
> "routing envelope'a ulaşan HER marka denetlenebilir kanıt etiketi taşıyor"
> cümlesi, `BRAND_ROUTABLE_TRUSTED`'ın **anahtar varlığıyla** sayılmasının
> kaynağıdır ve Talepo'nun kendi `INFERRED` çıkarımını da trusted yapıyordu.
> Kanıtın MEVCUT olması ile yönlendirmede GÜVENİLİR olması **iki ayrı
> metriktir**; güven kanonik otorite merdiveninden okunur. Tarihsel ölçüm
> silinmedi; **artık geçerli readiness otoritesi DEĞİLDİR.** Geçerli değer:
> `BRAND_EVIDENCE_PRESENT = 16/108`, `BRAND_ROUTABLE_TRUSTED = 7/108`.

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

## KB-17 — Çıkarılan değer kullanıcıya gösterilmeden soruyu kapatıyor — **KISMEN ÇÖZÜLDÜ**

| Alan | Değer |
| --- | --- |
| Katman | Besteci alan durumu → soru otoritesi (`build-state` / `resolveHybridQuestions`) |
| Sınıf | **GERÇEK ÜRÜN HATASI** — sessiz varsayım; kullanıcı göremediği bir değerin belirlediği havuza gider |
| Kırık kontrol | `scripts/verify-question-suppression-authority-v1.ts` → `high_risk_silent_suppression` (`FULL_QUEUE`) |
| Kapanış kontrolü | `scripts/verify-inference-question-authority-v2.ts` (kayıt kimliği düzeyinde) · `scripts/verify-inference-confirmation-priority-v1.ts` (üç yüzey: `next` / `candidates` / nihai render) · `scripts/verify-publish-inference-authority-v1.ts` (yayın kanalı) · `scripts/verify-snapshot-internal-evidence-v1.ts` (iç kanıt ad alanı + eski kayıt okuma sınırı) · `scripts/verify-readiness-brand-authority-v1.ts` (ölçüm otoritesi: güvenilir marka) |
| Ne zamandan beri | **ÖLÇÜLMEDİ** (bisect yapılmadı) |
| Tespit | 2026-08-25, KB-15 dilimi sırasında ölçülür hâle geldi |
| Yeniden üretilebilir ölçüm | 2026-08-26 (D1) — önceki ölçümün aracı repoda kayıtlı değildi |
| Durum | **KISMEN ÇÖZÜLDÜ — `FULL_QUEUE` 20 kayıt `3d5b2a5`, `FIRST_SCREEN` ve nihai render yüzeyi `b12ce53`, kullanıcı-cevabı yayın kanalı `83be90b`, iç kanıt ad alanı ve eski kayıt okuma sınırı `111b412`, ölçüm otoritesi yüzeyi `7aa6990` ile kapandı; etiket ekseni, generic projection ekseni ve ölçülemeyenler AÇIK** |

### Ölçülen çekirdek KAPANDI — 20 kayıt, kimlikleriyle (`3d5b2a5`)

D1 tabanında `high_risk_silent_suppression` sınıfındaki 20 `FULL_QUEUE` kaydının
**her biri** ayrı ayrı `inference_re_asked` sınıfına taşındı. Toplamın tutması
kapanış sayılmadı; kimlikler tek tek eşleştirildi:

| # | Kayıt kimliği | Alan | D1 sınıfı | `3d5b2a5` sınıfı |
| --- | --- | --- | --- | --- |
| 1 | `auto-01/needType@FULL_QUEUE` | `needType` | `high_risk_silent_suppression` | `inference_re_asked` |
| 2 | `auto-02/condition@FULL_QUEUE` | `condition` | `high_risk_silent_suppression` | `inference_re_asked` |
| 3 | `auto-02/needType@FULL_QUEUE` | `needType` | `high_risk_silent_suppression` | `inference_re_asked` |
| 4 | `auto-03/needType@FULL_QUEUE` | `needType` | `high_risk_silent_suppression` | `inference_re_asked` |
| 5 | `auto-04/needType@FULL_QUEUE` | `needType` | `high_risk_silent_suppression` | `inference_re_asked` |
| 6 | `auto-05/needType@FULL_QUEUE` | `needType` | `high_risk_silent_suppression` | `inference_re_asked` |
| 7 | `auto-06/needType@FULL_QUEUE` | `needType` | `high_risk_silent_suppression` | `inference_re_asked` |
| 8 | `auto-07/needType@FULL_QUEUE` | `needType` | `high_risk_silent_suppression` | `inference_re_asked` |
| 9 | `auto-08/condition@FULL_QUEUE` | `condition` | `high_risk_silent_suppression` | `inference_re_asked` |
| 10 | `auto-08/needType@FULL_QUEUE` | `needType` | `high_risk_silent_suppression` | `inference_re_asked` |
| 11 | `auto-09/needType@FULL_QUEUE` | `needType` | `high_risk_silent_suppression` | `inference_re_asked` |
| 12 | `auto-10/needType@FULL_QUEUE` | `needType` | `high_risk_silent_suppression` | `inference_re_asked` |
| 13 | `auto-11/needType@FULL_QUEUE` | `needType` | `high_risk_silent_suppression` | `inference_re_asked` |
| 14 | `mach-01/needType@FULL_QUEUE` | `needType` | `high_risk_silent_suppression` | `inference_re_asked` |
| 15 | `mach-02/needType@FULL_QUEUE` | `needType` | `high_risk_silent_suppression` | `inference_re_asked` |
| 16 | `mach-03/needType@FULL_QUEUE` | `needType` | `high_risk_silent_suppression` | `inference_re_asked` |
| 17 | `mach-05/needType@FULL_QUEUE` | `needType` | `high_risk_silent_suppression` | `inference_re_asked` |
| 18 | `mach-07/needType@FULL_QUEUE` | `needType` | `high_risk_silent_suppression` | `inference_re_asked` |
| 19 | `mach-08/needType@FULL_QUEUE` | `needType` | `high_risk_silent_suppression` | `inference_re_asked` |
| 20 | `print-07/needType@FULL_QUEUE` | `needType` | `high_risk_silent_suppression` | `inference_re_asked` |

Alan dağılımı: `needType` 18 · `condition` 2 — D1'deki dağılımla birebir aynı.

### İlk ekran ve nihai render yüzeyi de KAPANDI (`b12ce53`, 2026-08-26)

**Yeni KB açılmadı.** Bu bulgu KB-17'nin kök nedeninin aynısıdır — Talepo'nun
kendi çıkarımı kullanıcı cevabı gibi davranıyor — yalnız iki yeni yüzeyde
görülmüştür. İsim benzerliğiyle değil kök nedenle eşleştiği için kayıt
genişletildi.

`3d5b2a5` kapanışı yalnız `FULL_QUEUE` ufkunu kanıtlıyordu. İki yüzey
ölçülmemişti ve ikisi de kırıktı:

| Yüzey | `3d5b2a5` | `b12ce53` |
| --- | --- | --- |
| `FIRST_SCREEN` (motor kuyruğu) | `auto-02/condition@FIRST_SCREEN` → `high_risk_silent_suppression` = **1** | **0** — aynı kayıt `inference_re_asked` |
| Nihai render (`/talep` ekranı) | **ölçülmüyordu**; 30 senaryoda 35 çıkarım kimliği sessizce düşüyordu | düşen **0**, duran **35** |

`auto-02/condition@FIRST_SCREEN` — girdi
`2020 model dizel otomatik Volkswagen Passat arıyorum`; `condition = İkinci el`,
provenance ve authority `INFERRED`, `mayCloseQuestion = false`. Kullanıcı cevabı
değildir ve soruyu kapatamaz. Artık `next`, `candidates` ve nihai
`renderableCandidates` yüzeylerinin **üçünde de** ilk üç görünür soru içinde,
doğrulama olarak duruyor.

Nihai süzgeçteki kök neden bir alan hatası değildi: süzgeç kullanıcı metninden
**ikinci kez** "bu zaten cevaplanmış" kararı üretiyordu. Karar artık tek yerde
verilir — kanonik cevap otoritesi. Ayrıntı ve tarayıcı kanıtı için bu belgenin
başındaki **`b12ce53` ölçüm tabanı** bölümüne bakın.

**Kapanış ölçüsündeki maddeler yeniden değerlendirildi:**

| Kapanış ölçüsü | `3d5b2a5` | `b12ce53` |
| --- | --- | --- |
| 1. Otoritesiz değer soruyu sessizce kapatamaz | KARŞILANDI (`FULL_QUEUE`) | **KARŞILANDI — üç yüzeyde birden** |
| 2. `U = 0` | AÇIK (`not_measured = 4`) | **AÇIK** — değişmedi |
| 3. A1 provenance etiketi | AÇIK (`provenance_mismatch = 69`) | **AÇIK** — değişmedi |
| 4. A2 kayıtları Signal facts'te görünmeli | ÖLÇÜLMEDİ | **ÖLÇÜLMEDİ** — değişmedi |
| 5. Kapanan kayıtlar kimliğiyle listelensin | KARŞILANDI | **KARŞILANDI** — 35 kimlik doğrulayıcı çıktısında tek tek basılır |

Kayıt bir bütün olarak hâlâ **KISMEN ÇÖZÜLDÜ**: 2, 3 ve 4 numaralı maddeler bu
dilimde ele alınmadı ve olduğundan iyi gösterilmiyor.

**Bu dilimde kapanmayan, aynı aileye ait açık kalemler:** nihai süzgeçteki
`budget` / `engine` / `specs` / `technicalSpecs` sabit elemesi (corpus'ta
tetiklenen kimlik **0**, parent `d3a64c7`'te de mevcut), `hybrid.isSyncing`
sırasındaki geçici `canonicalFields = null` render, AST doğrulayıcısının
binding/alias sınırı, profil tanımı olmayan **50** çıkarım değeri ve
`NOT-MEASURED` kapasite kanaryası.

### Kullanıcı-cevabı yayın kanalı da KAPANDI (`83be90b`, 2026-08-27)

**Yeni KB açılmadı.** Bu bulgu da KB-17'nin kök nedeninin aynısıdır —
Talepo'nun kendi çıkarımı kullanıcı cevabı gibi davranıyor — yalnız DÖRDÜNCÜ
bir yüzeyde görülmüştür: soru sorulsa bile değer, kullanıcı hiç dokunmadan
yayın payload'ının `fields[]` kanalına yazılıyor ve sunucuda `fieldValues`
olarak firmalara "talebin cevabı" diye görünüyordu. Kök neden eşleştiği için
kayıt yine genişletildi.

Ölçüm ve kapanış: 108 senaryoda 85 `INFERRED` kimlikten **23**'ü kanala dolu
değerle sızıyordu; `83be90b` ile **23/23 kapandı, sızan 0**. Kimlik listesi,
kanaryalar (aynı-değer onayı → `USER_EXPLICIT` yayını; temizleme/red sonrası
geri sızıntı yok; `VERIFIED`/`USER_EXPLICIT` kaybı 0; `rawInput`/kanonik durum
mutasyonsuz) ve doğrulayıcı için bu belgenin başındaki **`83be90b` ölçüm
tabanı** bölümüne bakın. Düzeltme alan/kategori dalı kullanmaz; tek ölçüt
kanonik cevap otoritesi + kullanıcı dokunuş kanıtıdır ve tahmin kanonik
durumda ve `QuestionCandidate.inferredSuggestion` önerisinde korunur
(D3b'nin 35 kimliği aynen duruyor). Ürün kararı: `11-DECISION-LOG.md` →
**Karar H, H7**.

### İç kanıt ad alanı ve eski kayıt okuma sınırı da KAPANDI (`111b412`, 2026-08-27)

**Yeni KB açılmadı.** Bu bulgu da KB-17'nin kök nedeninin aynısıdır —
Talepo'nun kendi çıkarımı kullanıcı beyanı gibi davranıyor — yalnız BEŞİNCİ ve
ALTINCI bir yüzeyde görülmüştür: (a) marka tahmin muhasebesi
(`brandCandidate` / `brandEvidence`) snapshot ve projection'ın **kullanıcı
attribute'u ad alanında** duruyordu, oradan routing envelope'un generic
torbasına ve `attributeHit` puanına geçiyordu; (b) D3c-b öncesi yazılmış eski
kayıtlarda aynı anahtarlar, projeksiyonu okuyan **her yola** (workspace facts
alanı, `evaluateDiscoveryFilter`, fırsat akışı, kişisel/alarm eşleşmesi)
kullanıcı özelliği gibi görünmeye devam ediyordu. İsim benzerliğiyle değil kök
nedenle eşleştiği için kayıt yine genişletildi; ayrı bir KB açılmadı.

Ölçüm ve kapanış: 108 senaryoda **36** iç kanıt kimliği (20 `INFERRED`
`brandCandidate` + 9 `INFERRED` `brandEvidence` + 7 `VERIFIED`
`brandEvidence`) dört generic kanalda birden duruyordu; `111b412` ile dördü de
**0**, tipli `internalEvidence` kanalında korunan **36/36**, provenance kaybı
**0**. Eski şekil kapıları: kabul 1, ayrılan 2/2, generic torbada kalan 0,
filtre eşleşmesi 0, kişisel eşleşme 0, mutasyon 0. Aynı commit içinde,
inceleme sırasında yakalanan çıplak-projection sessiz kaybı da kapatıldı
(36/36 → 0). Kimlik listeleri, gölge skor farkı (11 çift / 3 talep, tamamı
−8 `attributeHit`, iki `NEAR → REVIEW`) ve doğrulayıcı için bu belgenin
başındaki **`111b412` ölçüm tabanı** bölümüne bakın. Ürün kararı:
`11-DECISION-LOG.md` → **Karar H, H8**.

### ÖLÇÜM otoritesi yüzeyi de KAPANDI (`7aa6990`, 2026-08-27)

**Yeni KB açılmadı.** Bu bulgu da KB-17'nin kök nedeninin aynısıdır —
Talepo'nun kendi çıkarımı kullanıcı/katalog düzeyinde otorite gibi davranıyor —
yalnız YEDİNCİ bir yüzeyde görülmüştür: **readiness ölçüm aracının kendisinde.**
`BRAND_ROUTABLE_TRUSTED`, `snapshot.attributes.brandEvidence` **anahtarının
varlığını** güven sayıyordu; böylece `INFERRED` marka kanıtı da "firmalara
güvenle yönlendirilebilir marka" olarak sayılıyor ve Pro hazırlığı sahte olarak
yüksek çıkıyordu (`15/108`, ≈%22). İsim benzerliğiyle değil kök nedenle
eşleştiği için kayıt yine genişletildi.

Bu yüzey bir **ölçüm** yüzeyidir; kullanıcının gördüğü davranışı değiştirmez.
Bu yüzden kaydın `KISMEN ÇÖZÜLDÜ` durumu ve açık eksenleri **değişmedi** —
kapanan şey, kaydın kendi ilerlemesini yanlış raporlayan sayaçtır.

Ölçüm ve kapanış: güven kararı artık kanonik merdivenden okunur
(`Authority` / `AUTHORITY_RANK` / `isAtLeastAuthority`; eşik `VERIFIED`).
108 senaryoda kanıt kaydı **16**, kovalar `UNKNOWN 0 · INFERRED 9 · VERIFIED 7 ·
USER_EXPLICIT 0`, güvenilir marka **7/108**, Pro **≈%21**. `INFERRED` ve
provenance'sız legacy kayıtlar trusted sayılmaz. Ayrıntı, kimlik listesi ve üç
ölçümün (`≈%22` / `≈%19` / `≈%21`) uzlaştırması için bu belgenin başındaki
**`7aa6990` ölçüm tabanı** bölümüne bakın. Ürün kararı:
`11-DECISION-LOG.md` → **Karar H, H9**.

**AYRI KÖK NEDEN — karıştırılmasın.** Aynı düzeltmede ortaya çıkan iki başka
bulgu KB-17'nin kök nedeni DEĞİLDİR ve bu kayda yazılmaz:
(a) doğrulayıcının D3c-b sonrası eski generic `attributes` yolunu okumaya devam
etmesi bir **bayat ölçüm aracı** sorunudur, çıkarım otoritesi sorunu değil;
(b) 9 kayıtta kanıt değerinin `VERIFIED_CATALOG` derken kaydın kendi
`source`'unun `DETERMINISTIC_INFERENCE` yazılması, otoritenin **eksik
kaydedilmesidir** — çıkarımın fazla güvenilmesi değil. İkisi de `7aa6990`
tabanında KNOWN-OPEN olarak kayıtlıdır.

**Kapanış ölçüsü #3 (etiket ekseni) hâlâ AÇIK** — `provenance_mismatch = 69`
bu dilimde ele alınmadı; generic projection'da kalan **56** `INFERRED` kimlik
de otorite işareti taşımıyor. Kayıt bir bütün olarak **KISMEN ÇÖZÜLDÜ**
kalmaya devam eder.

**Bu dilimde de kapanmayan eksen:** `discoveryProjection.attributes/constraints`
85 `INFERRED` değeri otorite işareti olmadan taşımaya devam ediyor; snapshot
`attributes` içindeki `brandCandidate` / `brandEvidence` ad alanı (ölçülmüş 28
kimlik; `home-06/brandCandidate` ayrıca `NOT-MEASURED = 1`) D3c-b'ye kaldı.


**Kayıt bir bütün olarak ÇÖZÜLDÜ sayılmıyor.** Kapanış ölçüsündeki beş
maddeden yalnız birincisi kanıtlandı:

| Kapanış ölçüsü | Durum |
| --- | --- |
| 1. Otoritesiz değer soruyu sessizce kapatamaz | **KARŞILANDI** — `high_risk_silent_suppression` (`FULL_QUEUE`) 20 → **0** |
| 2. `U = 0` — her kayıt kanıtla sınıflandırılabilir | **AÇIK** — `not_measured = 4` (ufuk başına), hepsi `category_unresolved` |
| 3. A1 kayıtlarının provenance'ı kullanıcı metnine uygun olmalı | **AÇIK** — `provenance_mismatch = 69`, bu dilimde düzeltilmedi |
| 4. A2 kayıtları Signal facts içinde kullanıcıya görünmeli | **ÖLÇÜLMEDİ** — bu dilimde ele alınmadı |
| 5. Kapanan kayıtlar kimliğiyle listelenmeli | **KARŞILANDI** — yukarıdaki tablo |

**Düzeltmenin kökü.** Serbest metinden ÇIKARILAN alt kategori, gezinme seçimi
gibi davranıp "Araç mı, parça mı?" sorusunu siliyordu. İğne artık soruyu ancak
kullanıcı koyduysa kapatır. Değeri yalnız çıkarımdan gelen alanlar için
doğrulama sorusu üretilir ve kuyruğun başına konur. Ayrıntı için ürün kararı:
`docs/ai-handoff/11-DECISION-LOG.md` → **Karar H**.

**KB-15'in TERSİ yönü.** KB-15 "gereken soru tekrar soruluyor" der; bu kayıt
"gereken soru sessiz çıkarımla kapatılıyor" der. İkisi ayrı risklerdir ve
biri kapanınca diğeri kapanmaz.

### Kırık kontrol — YENİ, YENİDEN ÜRETİLEBİLİR ÖLÇÜM (D1)

```
npx --yes tsx scripts/verify-question-suppression-authority-v1.ts
```

2026-08-26, **D1 soru bastırma ölçüm otoritesi commit'i (bu commit)**. Kapanış
ufku `FULL_QUEUE`; iki ardışık koşu byte-birebir aynı. Çıkış kodu **3** —
ölçüm sözleşmesi sağlam, **kapanış tamamlanmadı** (8 kayıt = 4
scenarioId/fieldKey × 2 ufuk, hepsi `category_unresolved`);
yeşil kapanış değildir.

```
high_risk_silent_suppression = 20      (KB-17'nin ölçülebilir çekirdeği)
  needType                   = 18
  condition                  =  2
authority_suppressed         =  3      (tarafsız; otorite + kanonik kimlik taşır)
correctly_suppressed         = 49
wrongly_repeated             =  0
not_measured                 =  4      (hepsi category_unresolved)
provenance_mismatch          = 69      (AYRI eksen — soru kararından bağımsız)
```

Ayrıntı, kayıt kimlikleri ve otorite tablosu için bu belgenin başındaki
**"SORU BASTIRMA ÖLÇÜM OTORİTESİ V1"** bölümüne bakın.

### Kırık kontrol — ESKİ ölçüm (`47df572`) — **TARİHSEL, YENİDEN ÜRETİLEMEZ**

> **2026-08-25 tarihli, ölçüm aracı repoya kaydedilmemiş, tek eksenli tarihsel
> sonuç; yukarıdaki yeni sınıflarla karşılaştırılamaz.** Bu sayıları üreten
> script repoda mevcut değildir; `A1 / A2 / B / U` sınıflandırması komutla
> yeniden üretilemez. Silinmiyor — tarihli kanıt olarak duruyor; **bugünün
> gerçeği olarak okunmamalıdır** ve yeni sonuçlarla aritmetik olarak
> karşılaştırılmamalıdır.

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

## KB-20 — Çıplak ilçe adı kullanıcı konumu sayılıyor — **ÇÖZÜLDÜ**

| Alan | Değer |
| --- | --- |
| Katman | Coğrafi eşleştirme → anlama konum otoritesi (`turkey-districts` / `understand-request`) |
| Sınıf | **GERÇEK ÜRÜN HATASI** — kullanıcının yazmadığı bir şehir EXPLICIT kanıtla dolduruluyordu |
| Kırık kontrol | `scripts/verify-geo-evidence-authority-v1.ts` (bu kayıtla birlikte açıldı) |
| Ne zamandan beri | **ÖLÇÜLMEDİ** (bisect yapılmadı); `2a5b587` üzerinde ölçülerek doğrulandı |
| Tespit | 2026-08-26, D2 dilimi sırasında tarayıcı doğrulaması yapılırken |
| Durum | **ÇÖZÜLDÜ — `3d5b2a5`, `BRANCH-WIRED`** |

**Neden yeni bir numara aldı.** Belgede bu davranışı taşıyan bir kayıt yoktu;
`Kastamonu`, `ilçe adı`, `coğraf`, `findProvinceAndDistrict` ve
`textMentionsPlace` aramalarının hiçbiri eşleşmedi. Ad benzerliğiyle mevcut bir
kayıt kapatılmadı.

**Ölçülen kusur (D2'den BAĞIMSIZ; `2a5b587` üzerinde de üretiliyordu).**
Türkiye'de bazı ilçe adları gündelik Türkçe sözcüklerdir. `Araç`, Kastamonu'nun
ilçesidir. Eşleştirici bir ilçe adını metnin herhangi bir yerinde görünce, il
adı hiç geçmese ve cümlede hiçbir yer ifadesi olmasa bile konumu çözülmüş
sayıyordu:

```
"Araç kiralamak istiyorum"          → Kastamonu / Araç   (provenance EXPLICIT, source USER_EXPLICIT)
"Aracın bakımı için servis arıyorum" → Kastamonu / Araç
```

İkinci satırın ayrı bir nedeni vardı: `normalizeUnderstandingInput` eksik
Türkçe harfleri tamamlarken `aracın` ifadesini `araçın` yapıyor, böylece ilçe
adı bulunma ekiyle geçmiş gibi görünüyordu. Yani sistemin kendi normalizasyonu
olmayan bir kanıt üretiyordu — KB-17 ile aynı kusur sınıfı: sistemin ürettiği
şey kullanıcının beyanı sayılıyor.

**Düzeltme (anahtara özel değil).** `Araç` sözcüğü için yama yazılmadı. İki
genel kural kondu:

1. İl adı geçmiyorsa, bir ilçe adı ancak **açık bir yer ifadesi** taşıyorsa
   kullanıcı kanıtı sayılır: hâl eki (`Kadıköy'de`) ya da komşu idari birim
   sözcüğü (`Araç ilçesinde`). Çıplak ilçe adı tek başına kanıt değildir.
2. Yer kanıtı **ham metinden** okunur, normalize edilmiş metinden değil.
   Normalizasyon marka/ürün eşleştirmesi için doğrudur ama yer adında olmayan
   bir kanıt üretebilir.

**Kapanış ölçümü (`3d5b2a5`, exit 0).** 9 vaka, iki katmanda ayrı ayrı
(`findProvinceAndDistrictInText` ve `understanding.location.city`):

| Girdi | Beklenen | Sonuç |
| --- | --- | --- |
| `Araç kiralamak istiyorum` | konum yok | PASS |
| `Aracın bakımı için servis arıyorum` | konum yok | PASS |
| `Kastamonu Araç ilçesinde araç kiralamak istiyorum` | `Kastamonu / Araç` | PASS |
| `Kastamonu/Araç'ta araç arıyorum` | `Kastamonu / Araç` | PASS |
| `Kadıköy'de 2+1 daire arıyorum` | `İstanbul / Kadıköy` | PASS |
| `Çankaya ilçesinde ofis arıyorum` | `Ankara / Çankaya` | PASS |
| `Ankara Çankaya'da kiralık 3+1 daire arıyorum` | `Ankara / Çankaya` | PASS |
| `İstanbul / Kadıköy'de fotokopi makinesi arıyorum` | `İstanbul / Kadıköy` | PASS |
| `İzmir'de satılık arsa arıyorum` | `İzmir` | PASS |

Doğrulayıcı ayrıca eşleştirici mantığında herhangi bir il/ilçe adının **sabit
olarak** geçmediğini sınar; kurala özel bir yama eklenirse satır kırmızıya
döner. Kategori kapsama corpus'unda (108 senaryo) ham metin ile normalize
edilmiş metin okumaları arasında **tek bir fark ölçülmedi**.

**Bu kaydın kapsamadığı.** Diyakritiksiz yazılan ilçe adları (`cankayada`)
hiçbir okumada çözülmüyordu ve hâlâ çözülmüyor; bu ayrı bir eksiktir, bu
kayıtla kapanmadı.

---

## KB-21 — Üyelik dönüşünde yayın niyeti sessizce düşüyor — **ÇÖZÜLDÜ**

| Alan | Değer |
| --- | --- |
| Katman | Talep sayfası üyelik dönüşü / yayın niyeti latch'i (`talep/page.tsx`) |
| Sınıf | **GERÇEK ÜRÜN HATASI** — kullanıcının açık yayınlama niyeti hiçbir geri bildirim üretmeden kayboluyordu |
| Kırık kontrol | `scripts/verify-publish-resume-v1.ts` (bu kayıtla birlikte açıldı) |
| Ne zamandan beri | `8c9a036` (2026-08-23, *anonymous drafts survive sign-up and auto-resume publishing*) — kusurlu koşul bu commit ile geldi; blame ile doğrulandı, `f7aca7a` tabanının atası |
| Tespit | 2026-08-26, `talep/page.tsx` içindeki üç miras `set-state-in-effect` lint hatası denetlenirken |
| Durum | **ÇÖZÜLDÜ — `afc23a3` + `3279dc7` + `e02179c`, `BRANCH-WIRED`, `CODE-VERIFIED`** |
| Tarayıcı doğrulaması | **BROWSER-MEASURED-LOCAL · PASS** — en güncel ölçüm 2026-08-26, ölçülen HEAD `e02179c`, mobil 375×812; önceki ölçüm aynı gün `3a90eb4` (yerel integration çalışma kopyası). **`PRODUCTION-DEPLOYED` DEĞİL** |

**Neden yeni bir numara aldı.** Belgede bu senaryoyu taşıyan bir kayıt yoktu;
`üyelik`, `sign-in`, `sign-up`, `resume publish`, `resumePublishPending`,
`pendingPublish`, `PENDING_DRAFT` ve `niyet` aramalarının hiçbiri bu davranışa
ait bir kayıt döndürmedi. Ad benzerliğiyle mevcut bir kayıt kapatılmadı.

**Ölçülen kusur.** Anonim kullanıcı talebini yazıp "yayınla" dediğinde üyelik
adımına yönlendirilir; taslağı ve yayınlama niyeti `localStorage`'a bırakılır.
Dönüşte niyet bir latch (`resumePublishPending`) olarak geri yüklenir ve
anlama motoru metni sindirir sindirmez tek bir yayın denemesi başlaması
gerekir. Eski davranışta deneme **yalnız talep zaten yayına uygunsa**
başlıyordu:

```
if ((understanding.rawInput ?? "").trim() !== requestText.trim()) return;
setResumePublishPending(false);          // latch her hâlükârda sönüyor
if (composerReadiness.canReview) {       // ← kusurlu önkoşul
  handlePublishAttempt();
}
```

Bütçe ya da konum eksikse (`publish-readiness.ts` → `canReview = false`) latch
söndürülüyor ama `handlePublishAttempt` hiç çağrılmıyordu. Kullanıcı yayınlama
niyetiyle üye olup geri dönüyor ve **ne yayın ne de eksik alan rehberliği**
görüyordu. Latch de söndüğü için ikinci şans kalmıyordu. Oysa
`handlePublishAttempt` tam bu durumda companion'ı açıp eksik etiketleri
gösterecek şekilde yazılmıştı; yani rehberlik zaten vardı, ona hiç
ulaşılmıyordu.

Bu, KB-17 ve KB-20 ile aynı aileden değildir — orada sistemin kendi çıkarımı
kullanıcı beyanı sayılıyordu; burada kullanıcının **açık** beyanı sessizce
düşürülüyordu.

**Düzeltme.** Karar sayfanın effect gövdesinden saf bir yardımcıya alındı
(`src/lib/request-composer/resume-publish.ts`). Hazır olma yalnız metnin
sindirilmiş olmasına bakar; yayına uygunluk **kararın girdisi değildir**,
çünkü eksik alan denemeyi iptal etme sebebi değil denemenin göstereceği
rehberliğin ta kendisidir. Latch yalnız gerçek deneme başlatılırken kapanır:
beklerken açık kalır (niyet kaybolmaz), denemeden sonra erken dönüş tekrarı
engeller. Hiçbir talep otomatik olarak yayına gitmez; `rawInput`, kullanıcı
cevapları, projection ve snapshot sözleşmelerine dokunulmadı.

**Kapanış ölçümü (`afc23a3`, exit 0) — 15 passed.** Doğrulayıcı kaynak metni
grep'lemez ve sayaç fixture'ı kullanmaz; iki katmanda ölçer:

1. **Saf davranış (9 iddia).** Karar fonksiyonu ve uygulayıcısı doğrudan
   çağrılır, hangi çağrının yapıldığı gerçek çağrı kaydıyla okunur: bekleme
   hâlleri latch'i söndürmez, sindirilmiş metinde `closeLatch → attemptPublish`
   sırası üretilir, deneme sonrası ikinci tur yeni deneme üretmez, baş/son
   boşluk farkı denemeyi engellemez, kullanıcı metni değiştirdiyse eski
   analizle yayın denenmez.
2. **Production wiring sözleşmesi (6 iddia, TypeScript AST).** `page.tsx`
   AST olarak okunur — satır numarası ya da kırılgan substring araması yoktur.
   Sınanan: helper sayfada tam bir kez çağrılıyor; çağrı bir `useEffect`
   gövdesinde; çağrı effect'in **ilk çalışan ifadesi** (önünde duran her
   `if`/`return` bir önkoşuldur); effect gövdesinde `canReview`/`canPublish`
   identifier'ı hiç geçmiyor; `closeLatch` ve `attemptPublish` handler'ları
   veriliyor; `setResumePublishPending(false)` yalnız `closeLatch` handler'ının
   alt ağacında bulunuyor.

Kırmızı kanıtı iki eksende ayrı ayrı alındı. Eski `canReview` önkoşulu
yardımcıya geçici olarak geri konduğunda saf katman **4 ihlalle** kırmızıya
döndü ("eksik alan durumunda deneme başlamadı — niyet sessizce kayboluyor");
aynı önkoşul `page.tsx`'e geri konduğunda wiring katmanı **2 ihlalle** kırmızıya
döndü ("effect'in ilk ifadesi helper çağrısı değil: IfStatement" ve "readiness
referansları geri gelmiş: canReview"). Her iki geçici değişiklik de tamamen
kaldırıldı; fixture, beklenen değer veya sayaç yeşile boyamak için
değiştirilmedi.

**Tarayıcı ölçümü — 2026-08-26, `3a90eb4`, `BROWSER-MEASURED-LOCAL · PASS`.**
Senaryo, `3a90eb4` ileri alınmış **yerel integration çalışma kopyası** üzerinde
çalıştırılan geliştirme sunucusunda ölçüldü. `PENDING_DRAFT_KEY`
(`talepo:pending-request-draft:v1`) sözleşmesi ve payload biçimi koddan
okundu; **bütçe ve konum alanları boş** bırakılmış gerçek bir üyelik dönüşü
payload'ı yerleştirilip sayfa yenilendi.

| Şart | Sonuç |
| --- | --- |
| Talep metni eksiksiz geri yüklendi | PASS |
| Anlama senkronizasyonu tamamlandı | PASS — kategori, ürün ve adet çözüldü |
| `handlePublishAttempt` yolu gerçekten çalıştı | PASS |
| Bütçe · Şehir/bölge · Ürün türü rehberliği açıldı | PASS — üç eksik alan adlandırılarak |
| Gerçek talep yayınlanmadı | PASS |
| Create / publish / notification DB yazımı | PASS — hiçbiri yok |
| `rawInput` değişmedi | PASS |
| `localStorage` anahtarı tek sefer tüketildi | PASS |
| İkinci yenilemede taslak tekrar çalışmadı | PASS |
| Console / hydration hatası | PASS — 0 |

**Negatif kontrol (panelin kaynağını ayrıştırır).** Aynı metin **pending draft
olmadan** girildiğinde anlama yine çalıştı ve bütçe sorusu yine göründü, ancak
yayın rehberliği paneli **açılmadı**. Panel yalnız `publishGuidance.attempted`
doğruyken render edilir ve o bayrak yalnız `handlePublishAttempt` içinde
kurulur; dolayısıyla açılan rehberlik, sayfanın olağan durumundan değil
**üyelik dönüşü publish-attempt yolundan** gelmiştir.

**Bu ölçümün sınırı.** Doğrulama **DOM ve ağ kayıtları** üzerinden yapıldı;
görsel ekran görüntüsü alınamadı. Ölçüm **yerel bir çalışma kopyasındadır**:
`PRODUCTION-DEPLOYED` değildir, canlı bir başarı iddiası taşımaz ve gerçek
kimlik doğrulama sağlayıcısı ile uçtan uca üyelik akışı ölçülmemiştir —
üyelik dönüşü, sözleşmesi koddan okunan payload ile kontrollü olarak
canlandırılmıştır. Kaydın `BRANCH-WIRED` ve `CODE-VERIFIED` dayanakları
(`afc23a3`, doğrulayıcı 15/15) bu ölçümden bağımsız olarak geçerlidir.

**Bu kaydın kapsamadığı — dürüstçe açık kalan.** *(Aşağıdaki tarayıcı
değerlendirmesi 2026-08-26 tarihli yerel ölçümle **YERİNE GEÇTİ**; tarihli
kanıt olarak silinmeden duruyor.)* Senaryo o gün **tarayıcıda ölçülmemişti**:
üyelik dönüşü + eksik bütçe/konum rehberliği akışı gerçek kimlik doğrulama ve
veritabanı gerektiriyordu ve çalışılan dalda bu ortam kurulmamıştı.
`NOT-MEASURED` bir başarı değildir ve "rehberlik ekranda göründü" diye
okunamaz — o aşamada kanıt yalnız kod düzeyindeydi. **Hâlâ açık olan:** wiring
sözleşmesi effect'in **içindeki** önkoşulu yakalar; helper'ın kendisi bir gün
readiness alacak biçimde değiştirilirse bunu saf katman yakalar, ama çağrının
tamamen başka bir dosyaya taşınması hâlinde her iki katman da yeniden
kurulmak zorundadır. Gerçek kimlik doğrulama sağlayıcısıyla uçtan uca üyelik
akışı da ölçülmemiş durumdadır.

**Kod dayanağı genişledi — `3279dc7` ve `e02179c` (2026-08-26).** Kayıt
açıldığında tek dayanak `afc23a3` idi. Aynı gün iki commit daha aynı üretim
sözleşmesine eklendi; bu kayıt artık üçünü birden kapsar ve önceki dayanak
silinmedi.

| Commit | Bu kayda kattığı | Doğrulayıcı |
| --- | --- | --- |
| `afc23a3` | Yayın niyeti latch'i yayına uygunluk önkoşuluyla düşürülmez; karar saf yardımcıya alındı | `verify-publish-resume-v1` 15 passed |
| `3279dc7` | Kapsam kapısı (`UNSUPPORTED_SUPPLY` → `blocked`; publish/create hiç çağrılmaz), tek yayınlama hata otoritesi (`surfacePublishFailure`), `role="alert"` ile görünür hata yüzeyi, kanonik retry yolu (`handlePublishAttempt`) | 34 bağımsız üretim wiring iddiası |
| `e02179c` | Eksik alan **veya** gerçek `publishError` varken mobil companion görünürlüğü: dış `<details>` ve iç panel tek türetilmiş kararı (`publishSignalDemandsAttention`) kullanır | 42 passed, exit 0 |

**Mobil tarayıcı kabulü — 2026-08-26, ölçülen HEAD `e02179c`, 375×812,
`BROWSER-MEASURED-LOCAL · PASS`.** Ölçüm yerel integration çalışma kopyasında
alındı.

| # | Senaryo | Sonuç | Ölçülen |
| --- | --- | --- | --- |
| A | Eksik alanlı üyelik dönüşü | **PASS** | `rawInput` değişmedi; rehberlik `innerText` içinde ve görünür; dış `details` açık; iç companion görünür; latch bir kez tüketildi; ikinci yenilemede tekrar açılmadı |
| B | Kapsam dışı arz ilanı | **PASS** | `UNSUPPORTED_SUPPLY`; publish/create çağrısı yok; kapsam dışı bildirim `details` **dışında zaten görünür**; companion gereksiz yere zorla açılmadı |
| C | Kontrollü 500 | **PASS** | `POST /api/requests` tarayıcıda kesilerek 500 döndürüldü — gerçek backend'e ve veritabanına ulaşmadı; mobilde tek görünür `role="alert"`; çift hata kopyası yok; otomatik retry yok; manuel retry kanonik `handlePublishAttempt` yoluna döndü |
| D | Negatif kontrol | **PASS** | Companion zorla açılmadı; rehberlik, latch ve publish isteği oluşmadı |

Konsolda uygulama/hydration hatası **0**.

**ÖNEMLİ DÜZELTME — kapsam dışı bildirimi hakkında üretilmeyen iddia.** "Kapsam
dışı bildirim mobilde görünmüyordu ve `e02179c` ile düzeldi" **denemez; bu kayıt
böyle bir iddia taşımaz.** O tespit, önceki ölçümün **yanlış pozitifiydi**:
bildirim `<details>` ağacının dışında, ana composer kartında çizilir ve her iki
kapıdan bağımsız olarak zaten görünürdü. `e02179c` yalnız **gerçek eksik-alan ve
`publishError` sinyallerinin** mobil görünürlüğünü düzeltir. `outOfScopeNotice`,
`publishSignalDemandsAttention` hesabına **bilinçli olarak dahil edilmemiştir**
— gerekçesi `talep/page.tsx` içinde kod yorumu olarak durur ve doğrulayıcı
bildirimin yapısal konumunu ayrı bir aralıkla sabitler. Kapsam güvenliği ayrı
eksendedir: kapsam dışı talep publish/create yoluna hiç girmez (B senaryosu).

**Ölçüm ortamı etkisi — ürün hatası değildir.** Tarayıcı sekmesi arka plandayken
`talepo-rise` animasyonunun `opacity: 0`'da durması bir ölçüm ortamı etkisidir.
Ne ürün hatası ne de `e02179c` kazanımı olarak yazılmamalıdır.

**Önceki tarayıcı kanıtıyla ilişki — neyi genişletti, neyin yerine geçti.**
2026-08-26 tarihli `3a90eb4` ölçümü (yukarıdaki tablo ve negatif kontrol
paragrafı) **silinmedi**, tarihli kanıt olarak duruyor.

* **Genişletti.** O ölçüm yalnız A senaryosunu ve yalnız DOM/ağ kayıtlarını
  kapsıyordu. Yeni ölçüm aynı senaryoyu **mobil 375×812** görüntü alanında
  tekrarlar ve B (kapsam dışı arz), C (kontrollü 500) ile D (negatif kontrol)
  senaryolarını ekler.
* **Yerine geçti.** `3a90eb4` ölçümünün "rehberlik açıldı" satırı bir **mobil
  görünürlük** iddiası olarak okunamaz: o tarihte rehberlik DOM'da üretiliyor
  ama mobilde iki kapının arkasında kalabiliyordu. Bu kusur `e02179c` ile
  kapandı; görünürlük ilk kez bu yeni ölçümle ölçülmüştür.
* **Yerine geçmedi.** `afc23a3` dayanaklı `BRANCH-WIRED` / `CODE-VERIFIED`
  iddiaları ve negatif kontrolün "panel yalnız publish-attempt yolundan açılır"
  ayrıştırması aynen geçerlidir.

**Durum.** `BROWSER-MEASURED-LOCAL · PASS` · `BRANCH-WIRED` · `CODE-VERIFIED` —
**`PRODUCTION-DEPLOYED` DEĞİL.** Gerçek kimlik sağlayıcısıyla canlı uçtan uca
üyelik akışı ve production başarısı **ölçülmüş sayılmaz**. C senaryosundaki 500
tarayıcıda kesilerek üretilmiştir; gerçek bir sunucu arızası ölçülmemiştir.

**Eşlik eden lint temizliği (`341e775`) — kaydın kapsamı dışında ama aynı
dosyada.** `talep/page.tsx` içindeki üç miras `react-hooks/set-state-in-effect`
hatası kapatıldı: ölü `publishSummaryOpened` state'i ve üç yazıcısı kaldırıldı
(üç yerde yazılıyor, hiçbir yerde okunmuyordu; özet açılma telemetrisi zaten
ayrı `trackComposerEvent` ile gidiyor), kalan iki yer satır seviyesinde
gerekçeli istisna aldı — dosya ya da kural geneli kapatma yapılmadı. Bu
**yalnız bu dosyanın** bu kuralına ilişkindir: deponun genel lint durumu temiz
değildir, aynı kapsamda 26 uyarı ölçülmeye devam ediyor ve bu kayıt onları
kapatmaz.

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
