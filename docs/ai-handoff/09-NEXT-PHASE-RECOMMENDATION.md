# 09 — Next Phase Recommendation

> Kör “Dilim 2” etiketi değil; koda dayalı sıra. Öneri = `PROPOSED`. Kanıt zemini = Dilim 1 shadow + legacy riskleri.

## Karar özeti

**Dilim 2a — Legacy fanout gözlemlenebilirliği: UYGULANDI** (`466436bb438765cd42fd9031eb6ac35a530bb562`, branch üzerinde `BRANCH-WIRED`, 2026-08-22).

**Sıradaki aşama — Dilim 2b (shadow wiring + persist + compare): BAŞLAMADI.**  
Başlayamaz da: önkoşulu **canlı legacy taban ölçümüdür** ve o ölçüm için önce üç kapı geçilmelidir — sink kabul kriteri, deploy, ve merkezî sorgulanabilirlik kanıtı. Üçü de bugün açık.

> ⚠️ **Dilim 2a “kod tamamlandı” durumundadır, “ölçüm çalışıyor” durumunda değildir.** Olaylar üretiliyor fakat yalnız stdout’a gidiyor. `PRODUCTION-SINK-NOT-VERIFIED` ve `PRODUCTION-STATUS-NOT-VERIFIED` geçerlidir.

### Neden 2 ikiye bölündü? (2026-08-22 denetim bulgusu)

Bu belgenin önceki sürümü tek bir “Dilim 2” tanımlıyor ve ölçüm hedefini *“entityRescued vs legacy miss; zero-match rate”* olarak yazıyordu. **Bu hedefin önkoşulu eksikti:**

Her iki metrik de **legacy tarafında telemetri** gerektirir — ve o tarihte legacy’de telemetri **yoktu**:

- `distribute-request.ts` zero-match logsuz erken dönüş [`CODE-VERIFIED`, o tarihte]
- cap doygunluğu (200/300/40/100/400) kayıtsız
- `unresolved` kategori skip’i kayıtsız
- ikinci yazıcı `backfillMatchesForCompany` (“Silent backfill”) tamamen kayıtsız

**Bu boşluk `466436b` ile kapatıldı** — dördü de artık olay üretiyor. Kalan boşluk ölçüm altyapısının **ikinci yarısıdır**: olayların bir yere ulaşıp sorgulanabilmesi.

Shadow’u bugün persist etsek elimizde *shadow sayıları* olur ama **karşılaştıracak legacy taban çizgisi olmaz**; `compareSyntheticLegacyAndShadow` sentetiktir ve `productionShadowComparison: "not_wired"` tip seviyesinde sabittir. Yani 2b’nin kabul kriteri kendi önkoşulunu içermiyordu.

2a bu boşluğun **kod tarafını** kapattı. 2b reddedilmiş değildir; fakat hâlâ **başlatılamaz**: taban çizgisi ancak olaylar sorgulanabilir bir sink’e ulaştıktan ve canlıda 1–2 hafta biriktikten sonra oluşur.

Diğer sıralama gerekçeleri değişmedi:

1. V3 motoru var ama gerçek Request/Company şekline ve publish anına bağlı değil → laboratuvar kalır.
2. Legacy sessiz zero-match / cap / category-only riskleri ölçülmeden cutover tehlikeli.
3. Vector/semantic erken eklemek kalibrasyonsuz gürültü artırır (`08` #15).
4. Admin curation ve human labeling, shadow çıktı persist olmadan verimsiz.

## Dilim planı (additive, reversible, measurable)

### Dilim 2a (UYGULANDI — `466436b`) — Legacy fanout gözlemlenebilirliği

| | |
|--|--|
| **Durum** | **Kod tamamlandı, `BRANCH-WIRED`.** Ölçüm altyapısı **tamamlanmadı** (sink kapısı açık) |
| **Neden** | 2b’nin ölçüm hedeflerinin matematiksel önkoşulu; ayrıca `08` #2’yi tek başına ölçülebilir kılar |
| **Ne değişti** | Yalnız yapısal, PII’siz olay ve sayım logu — **14 canonical olay**. Kapsanan: zero-match + nedeni, kategori-skip, cap doygunluğu (200/300/40/100/400), city-only fallback, backfill span’i, estimator span’i, bildirim yazımı, önkoşul erken dönüşü, ve **hata terminalleri** |
| **Ne değişmedi** | **Hiçbir davranış.** Bildirim içeriği ve alıcıları, eşleşen firma kümesi, query limitleri, skorlar, sıralama, return değerleri, `RequestMatch` yazımları — hepsi aynı. Migration yok, yeni tablo yok, UI yok, flag yok, bağımlılık yok, `matching-v3` bağlanmadı |
| **Gizlilik** | `rawInput`, `professionalDescription`, `title`, `description`, `matchReason`, ham şehir/ilçe/mahalle/adres, firma adı, iletişim bilgisi ve her türlü serbest metin **loglanmaz**. Yalnız opak id, sabit slug, enum, sayım, boolean, süre. Ayrıca **aktör kimliği yok**: correlation store’dan `userId` / aktör `companyId` / transport `requestId` mirası alınmaz |
| **Hata yolu** | Fanout ve backfill istisnaları terminal failure olayı üretir (`request.fanout.failed` / `request.backfill.failed`), estimator ise `request.fanout.estimated` + `outcome: "failure"`. Üçünde de **aynı hata nesnesi yeniden fırlatılır** — davranış yutulmaz. `outcome` ortak `OperationalOutcome` sözleşmesine uyar; `"failed"` adında ikinci bir değer eklenmedi |
| **Tarama modeli** | Çalışmamış sorgu `scanStatus: "not_run"` (yalnız `cap`); gerçekten 0 bulan sorgu `"executed"` + `found: 0` + `capSaturated: false`. İkisi karışmaz; sahte sıfır/NaN/null kullanılmaz |
| **Fail-open** | Her emit `try/catch` içinde; konum türetme de `safeResolveLocation` sınırından geçer. Log sistemi bozulursa talep yayınlama etkilenmez |
| **Kabul — sonuç** | ✅ `git diff -w`: **+309 / −12**, silinenler yalnız imza/biçim ve iki tek satırlık `if` → blok dönüşümü. ✅ Cap’ler, skorlar, sıralama, 18 Prisma çağrısı, `skipDuplicates`, bildirim guard’ı ve dört dönüş şekli değişmedi (verifier ile kanıtlı). ✅ Mevcut 10 verifier aynı sayılarla yeşil. ✅ `verify-phase4a-observability-v1` 23 PASS (logger değiştiği için) |
| **Ölçüm** | Sink bağlandıktan **1–2 hafta sonra**: gerçek zero-match oranı, cap doygunluk oranı, unresolved skip oranı, backfill hacmi, **il bazında tedarikçi boşluğu**. Bugün hiçbiri hesaplanamaz |
| **Rollback** | Log satırlarını kaldırmak. Pratikte sıfır risk |
| **Kalan onay kapıları** | ~~commit onayı~~ ✅ → **push** → **deploy onayı** → **sink doğrulama kapısı** (aşağıda) |
| **Tamamlanma** | Deploy tek başına yeterli **değildir**; sink doğrulanana kadar dilim **`PRODUCTION-SINK-NOT-VERIFIED`** sayılır |

#### Konum sözleşmesi (Dilim 2a — zorunlu)

Ürün kararı (2026-08-22): tedarikçi boşluğunu **illere göre** ölçebilmemiz gerekir; ancak kullanıcının yazdığı ham konum metni loglanamaz.

| Alan | Değerler | Kural |
|---|---|---|
| `locationScope` | `province` \| `nationwide` \| `remote` \| `unspecified` | Her konum olayında **zorunlu** |
| `provinceCode` | Yalnız sabit ve **allowlist edilmiş** Türkiye il kodu (ör. `TR-34`) | Yalnız `locationScope === "province"` iken yazılabilir |
| `resolutionStatus` | `resolved` \| `unknown` | Canonical il koduna güvenilir dönüşüm yoksa `unknown` |

Kesin yasaklar:

- Ham şehir adı, ilçe, mahalle, adres ve diğer serbest metinler **loglanamaz**.
- Girdi güvenilir biçimde canonical il koduna dönüştürülemiyorsa **`provinceCode` yazılmaz**; `locationScope: "unspecified"` ve/veya `resolutionStatus: "unknown"` kullanılır.
- `provinceCode` **serbest metinden türetilmiş bir string olamaz**; yalnız sabit allowlist üyesi olabilir (allowlist dışı değer → olay reddedilir, tahmin edilmez).
- **İlçe seviyesinde ölçüm bu dilimde yapılmayacaktır.** İlçe alanı ne loglanır ne türetilir.
- PII verifier bu sözleşmeyi **ayrıca** doğrular (allowlist üyeliği, scope↔code tutarlılığı, ilçe alanının hiç bulunmaması).

Not: `distribute-request.ts` içindeki `matchReason` alanı `` `Şehir (${company.city})` `` gibi ham şehir adı içerir — bu alan **asla** loglanmaz.

#### Deploy ve sink doğrulama kapısı (Dilim 2a — zorunlu, **AÇIK**)

Ölçüm altyapısı, olaylar yalnız üretildiği için tamamlanmış **sayılmaz**:

1. Logların hangi production sink’e ulaştığı doğrulanmadığı sürece durum açıkça **`PRODUCTION-SINK-NOT-VERIFIED`** olarak işaretlenir.
2. Dilim 2a’nın başarılı sayılabilmesi için, deploy sonrasında olayların **merkezî log sisteminde sorgulanabildiği ayrıca doğrulanmalıdır** (örnek sorgu + dönen kayıt kanıtı).
3. **Yalnız uygulama konsoluna yazılan fakat sonradan sorgulanamayan loglar, ölçüm altyapısı tamamlanmış sayılmaz.** Bu durumda dilim “kod tamam, ölçüm eksik” olarak raporlanır ve 2b **başlatılmaz**.

**Bugünkü durum (`466436b` sonrası):** `addLogSink`’in `src/` altında **tek bir çağrısı yoktur**; `instrumentation.ts` sink kaydetmez. Olaylar `defaultSink` üzerinden **stdout**’a gider. Yani madde 3 tam olarak geçerlidir: **kod tamam, ölçüm eksik.**

`verify-fanout-telemetry-v1` bu durumu kalıcı bir dürüstlük kapısı olarak tutar: biri sink kaydederse test **kırmızıya döner** ve bu belgelerin güncellenmesini zorlar. Sessizce “artık ölçüyoruz” denemez.

##### Sink kabul kriteri (zorunlu)

`logOperational` sink döngüsünü **senkron** çalıştırır (`for (const sink of sinks) sink(entry)`), kuyruk veya `void` yoktur. Bu nedenle:

- Production sink **non-blocking olmalıdır.**
- **Senkron ağ çağrısı yapan sink kabul edilmez.** Böyle bir sink, publish başına yaklaşık on olay × sink gecikmesi kadar süreyi **doğrudan talep yayınlama süresine** ekler.
- Sink’in **kuyruk / arka planda flush** davranışı deploy kapısında kanıtlanmalıdır.
- Olayların **merkezî sistemde sorgulanabilirliği** aynı kapıda kanıtlanmalıdır.
- **Örnek sorgu ve dönen gerçek kayıt görülmeden sink doğrulanmış sayılmaz.** “Sink yapılandırıldı” beyanı yeterli değildir.

Bu kapı geçilmeden Dilim 2b’nin önkoşulu (gerçek legacy taban ölçümü) sağlanmış olmaz.

#### Backfill hacmi kararı (Dilim 2a)

- `backfillMatchesForCompany`, `apps/web/src/app/panel/talepler/page.tsx:206`’da koşulsuz çağrılır — yani **panel görüntülemesi başına** çalışabilir; span başına 2 olay üretir. Hacim talep sayısıyla değil **görüntüleme sayısıyla** orantılıdır.
- **Başlangıç ölçümünde sampling uygulanmamıştır.** Bu bilinçli bir karardır: taban ölçüm eksiksiz olmalıdır, aksi hâlde ilk sayılar zaten kısmi olur.
- **Sink bağlanmadan önce beklenen günlük olay hacmi ölçülmelidir.**
- İleride sampling yapılırsa **`samplingRate` olayın içinde açıkça kaydedilmeli** ve metrikler bu oranla **ağırlıklandırılmalıdır**.
- **Sessiz sampling veya oranı bilinmeyen sampling kabul edilmez.** Okuyucunun veriden geri hesaplayamadığı bir azaltma, ölçümü sessizce yanlış yapar.

### Dilim 2b (BAŞLAMADI — 2a’nın verisi geldikten sonra) — Shadow wire + persist

| | |
|--|--|
| **Durum** | **Başlamadı.** Kod yazılmadı, flag yok, tablo yok. Aşağıdaki önkoşul sağlanmadan başlatılamaz |
| **Neden** | Aynı publish olayında legacy sonuç ile V3 shadow’u yan yana yaz; bildirim hâlâ legacy |
| **Önkoşul (bugün AÇIK)** | **2a’nın legacy taban ölçümü canlıda birikmiş olmalı.** Bunun için sırasıyla: push → deploy → non-blocking sink → örnek sorgu + dönen kayıt → 1–2 hafta birikim. Hiçbiri tamamlanmadı |
| **Değişir** | Flag’li shadow runner çağrısı; shadow result store (yeni tablo veya JSON audit — tasarım onayı gerekir); compare raporu |
| **Değişmez** | Kullanıcıya giden Notification içeriği; RequestMatch’in mevcut fanout anlamı (veya dual-write açıkça ayrılır); scoring’e plan karışmaz |
| **Kabul** | Flag off = bugünkü davranış; flag on = shadow persist + bildirim davranışında sıfır değişiklik; verifier + staging shadow diff |
| **Ölçüm** | entityRescued vs **2a’dan gelen gerçek legacy miss**; zero-match rate karşılaştırması; tier histogram (shadow only) |
| **Rollback** | Flag off; shadow tablo okunmaz |
| **Onay kapıları** | Commit → (migration varsa ayrı onay) → staging → **deploy onayı** → asla sessiz prod cutover |

### Paralel yürüyebilen, koddan bağımsız iş

**rawInput revizyon şeması tasarımı.** Ürün kararı 2026-08-22’de verildi (append-only revizyon, aktör/zaman/kaynak, son revizyondan yeniden kurulan understanding, anlamlı düzenlemede re-match, revizyon × firma idempotent bildirim) fakat **bilinçli olarak koda dönüştürülmedi** → `DECIDED-NOT-IMPLEMENTED`. Ayrı şema + davranış tasarım dilimi gerektirir; 2a/2b’yi beklemesi gerekmez. Bkz. `11-DECISION-LOG.md`.

**Verifier’ları npm script’e bağlama.** `08` #21: handoff’un dayandığı **12** verifier’ın hiçbiri `package.json` scripts’te değil — Dilim 2a ile eklenen `verify-fanout-telemetry-v1.ts` de dahil. Küçük, risksiz, davranış değiştirmeyen bir dilim.

### Dilim 3 — Review / ops queue for unresolved & zero-match

Shadow ve branch fanout zero-match / unresolved category için insan kuyruğu; sessiz kayıp yasağı.

### Dilim 4 — Notification delivery log + dedupe/retry

V3 contract’taki delivery record’u branch fanout yoluna kontrollü yaklaştır; fire-and-forget’u azalt.

### Dilim 5 — Supplier expertise model (DB-shaped)

Inventory/follow/brandModelPairs coverage’ı gerçek adaptörlerle; synthetic’ten çık.

### Dilim 6 — Human labeling + threshold calibration

Precision/recall için etiket seti; EXACT/STRONG eşikleri.

### Dilim 7 — Category question knowledge deepen (6 kategori)

Composer profil boşlukları; Matching’den bağımsız ama paralel yapılabilir küçük dilimler.

### Dilim 8 — Admin curation UI

Review queue + alias/category conflict araçları.

### Dilim 9+ — Vector/semantic retrieval

Ancak labeling + shadow metrics sonrası.

## GELECEK BACKLOG (D3c / projection otoritesi SONRASINDA) — Talepo Data Platform, Market Intelligence and Learning Loop

> **Bu bölüm mevcut aktif sırayı DEĞİŞTİRMEZ.** Bugünkü sıra aynen durur:
> D3c-b (`111b412`, tamamlandı) → **generic projection otoritesi** (açık; 108
> senaryoda 56 `INFERRED` kimlik hâlâ otorite işareti olmadan taşınıyor) →
> Dilim 2a sink kapısı / 2b. Aşağıdaki başlık o sıradan SONRA ele alınacak bir
> backlog'dur; **hiçbir maddesi uygulanmadı ve hiçbiri ölçülmedi.** Durum:
> `PROPOSED` · `DECIDED-NOT-IMPLEMENTED` değil, henüz **karar da alınmadı**.
>
> > **SIRA GÜNCELLENDİ (`008a4ac`, 2026-08-27).** Generic projection otoritesi
> > **tamamlandı**: 56 / 17 / 182 değerin tamamı, iki yüzeyde 510 kimlik
> > olarak, additive `fieldAuthority` haritasında kaynağıyla duruyor (Karar H,
> > H10). Bugünkü sıra: D3c-b (`111b412`) → generic projection otoritesi
> > (`008a4ac`) → **`fieldAuthority` için sunucu güven sınırı** (ön koşul;
> > istemci metadata'sı doğrulanmadan skorlamaya giremez) → Dilim 2a sink
> > kapısı / 2b. Yukarıdaki cümle tarihsel kayıt olarak silinmedi.
>
> > **SIRA GÜNCELLENDİ (`83f3b3e` + `aa2f2e1`, 2026-08-27).** Yukarıda ÖN KOŞUL
> > olarak duran **`fieldAuthority` için sunucu güven sınırı tamamlandı**:
> > istemcinin otorite etiketi yeni create/update yazımlarında tamamen yok
> > sayılıyor, otorite sunucunun `rawInput` çözümünden ve süzülmüş structured
> > cevap kanalından yeniden türetiliyor; clone kaynağın etiketine güvenmiyor
> > (Karar H, H11). Aynı dilim düzenleme ekranını kanonik yayın süzgecine
> > bağladı ve kullanıcının "Fark etmez" tercihini kanonik `mode` ile taşıdı.
> > Taban `83f3b3e`'de 78 kimlik, `aa2f2e1` ile ölçüm kapsamı genişleyerek
> > **123 kimlik** (regresyon değil).
> >
> > Bugünkü sıra: sunucu güven sınırı (`83f3b3e` + `aa2f2e1`) → **explicit
> > `UNKNOWN` / `NOT_APPLICABLE` cevap yüzeyi kararı** (bugün projection'da
> > yüzeyleri yok; `UNKNOWN` ayrıca cevaplanmamış alanın varsayılanı olduğu
> > için "bilmiyorum dedi" ile "hiç sorulmadı" ayrılamıyor) → legacy kayıt
> > backfill kararı (bu dilimde YAPILMADI) → Dilim 2a sink kapısı / 2b.
> > Yukarıdaki cümleler tarihsel kayıt olarak silinmedi.

Sıra (bu sıra bir öneridir; her adım kendi onayını gerektirir):

1. **Veri envanteri ve veri sınıflandırması** — hangi veri nerede duruyor,
   kim üretiyor, kim okuyor.
2. **KVKK amaç / hukuki dayanak / saklama süresi matrisi** — her veri sınıfı
   için üçü birlikte yazılmadan o veri toplanmaz.
3. **Ayrı veri alanları:** `operational` · `crm` · `analytics` · `learning` ·
   `privacy` · `audit`. Alanlar birbirine serbestçe akmaz; her geçiş açık bir
   dönüşümdür.
4. **İzinli CRM ve İYS uyumlu iletişim kayıtları** — izin kaydı olmadan
   iletişim yok; izin kaydının kendisi denetlenebilir olmalı.
5. **Analitik olay sözlüğü** — olay adları, alanları ve anlamları tek yerde;
   isim uydurma yok (bkz. Dilim 2a telemetri sözleşmesi).
6. **Aylık kategori / şehir / talep / teklif / kabul istatistikleri.**
7. **Anonimleştirme ve pseudonimleştirme** — analitik ve öğrenme alanlarına
   giren her kayıt için zorunlu adım.
8. **Learning events** — sistemin neyi yanlış anladığına dair yapısal sinyaller.
9. **Knowledge candidates** — öğrenme olaylarından türeyen aday bilgi kayıtları
   (marka, eşanlam, kategori kuralı); doğrudan kanona yazılmaz.
10. **İnsan onaylı kürasyon** — aday bilgi ancak insan onayıyla kanona geçer.
11. **Gölge öğrenme ve regresyon kapıları** — öğrenilen her şey önce gölgede
    ölçülür; mevcut doğrulayıcı bataryası regresyon kapısıdır.
12. **Kontrollü otomatik onay** — yalnız gölgede ve regresyon kapılarında
    kanıtlanmış sınıflar için, sınırlı ve geri alınabilir biçimde.
13. **Sürümleme ve geri alma** — her bilgi sürümü kimliğiyle saklanır ve tek
    adımda geri alınabilir.
14. **Admin Pazar Zekâsı ekranı.**
15. **Maira Öğrenme Merkezi.**
16. **Yetki, maskeleme, erişim ve dışa aktarma kayıtları** — kimin neyi
    gördüğü ve dışa aktardığı denetlenebilir olmalı.

Bu backlog'un sözleşmeleri (şimdiden yazılıyor ki sonra kaymasın):

- **Admin panel verinin saklandığı yer DEĞİLDİR**; güvenli görüntüleme ve
  yönetim yüzeyidir. Veri kendi alanında yaşar, panel oraya bakar.
- **İlk aşamada mevcut Supabase/PostgreSQL kullanılabilir** — ayrı bir veri
  altyapısı almak bu backlog'un önkoşulu değildir.
- **E-posta ve telefon `analytics` veya `learning` tablosuna doğrudan
  konmaz.** Bu veriler `crm` / `privacy` alanında, izin kaydıyla birlikte
  yaşar; analitik ve öğrenme tarafına ancak anonimleştirilmiş/pseudonim
  biçimde geçer.
- **"Talep", "teklif", "kabul edilen teklif" ve "satış" AYNI METRİK
  DEĞİLDİR.** Dördü ayrı sayılır ve raporlarda ayrı adlarla görünür; birini
  diğerinin yerine kullanmak pazar verisini sessizce yanlış yapar.
- **Learning Loop henüz uygulanmadı ve ölçülmedi.** Bu bölüm bir plandır;
  hiçbir satırı `BRANCH-WIRED` ya da `PRODUCTION-DEPLOYED` iddiası taşımaz.


## Yerel kabul testi altyapısı (BAŞLAMADI — araç eksiği, ürün kusuru DEĞİL)

Bu madde bir ürün hatası değildir: **ölçüm yeteneği** eksiktir. Bugün panel
akışlarının (kimlik doğrulama → düzenleme → kaydetme → yeniden yükleme)
tarayıcı kabulü yapılamıyor, çünkü tek `DATABASE_URL` uzak bir veritabanını
gösteriyor ve makinede kullanılabilir bir yerel Postgres yok (denetim
2026-08-28: Docker, Podman, Windows PostgreSQL servisi, `psql`, WSL — hiçbiri
kurulu değil; depoda compose/devcontainer/test-DB kurulumu ve
`pg-mem` / `testcontainers` / `embedded-postgres` bağımlılığı yok).

Sonuç: Karar K'nin A/B/C/D maddeleri ve gerçek save→reload turu
`NOT-MEASURED` kalıyor. **KB-22** (panel render'ının kalıcı yazım yapması) bu
boşluğu daha da sertleştiriyor — sayfayı yalnızca açmak bile gerçek veriye
yazıyor, dolayısıyla uzak DB ile salt-okunur kabul testi mümkün değil.

Kapsam:

- **Tek komutla atılabilir yerel Postgres** — yalnız `127.0.0.1` üzerinde,
  ayrı bir portta (örn. `55432`), production portuna (`5432`) ve dev sunucusu
  portuna (`3000`) dokunmadan.
- **Sentetik seed** — gerçek e-posta, telefon ve talep metni KULLANILMAZ.
  Senaryolar (DRAFT + geçerli confirmation, PUBLISHED/RECEIVING_OFFERS miras
  cevap, ortak alan cevapları) tohum verisinden üretilir.
- **`test:acceptance` betiği** — depodaki MEVCUT migration'ları geçici DB'ye
  uygular (yeni migration üretmez), uygulamayı process-level `DATABASE_URL` ile
  o DB'ye bağlar, etkin host'un `127.0.0.1` olduğunu **fail-closed** doğrular
  ve tur bitince oluşturduğu container/database/volume'ü adıyla kaldırır.
- **Auth** — production bypass EKLENMEZ. Kullanıcı girişini kendisi yapar;
  altyapı yalnız güvenli bir hedef veritabanı sağlar.

Kabul ölçütü: A/B/C/D ve save→reload turu gerçek veriye dokunmadan
ölçülebilir hâle gelir ve `KNOWN-BROKEN.md` tarayıcı kanıtı tablosundaki
`NOT-MEASURED` satırları `BROWSER-MEASURED-LOCAL` ile değiştirilebilir.

## Bilinçli erteleme

- Branch fanout’u V3 ile değiştirmek (erken)
- Plan’ı relevance skoruna bağlamak (yasak)
- Büyük rewrite / tek PR’da migration+UI+cutover

---

**Bunu ne için yapıyoruz?**  
Önce “Laboratuvardaki akıllı eşleştirme, gerçek taleplerde legacy’den ne kadar iyi?” sorusunu ölçülebilir kılıyoruz; Pro’ya dokunmadan güven kazanıyoruz.
