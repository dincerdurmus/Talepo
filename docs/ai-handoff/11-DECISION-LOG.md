# 11 — Decision Log

Her karar: uygulama durumu · dosyalar · testler · değişirse risk.  
Durum etiketleri: `BRANCH-WIRED` ≠ `PRODUCTION-DEPLOYED` (`00-START-HERE.md`).

| Karar | Durum | Dosyalar | Testler | Değişirse risk |
|-------|--------|----------|---------|----------------|
| Kategori hard allowlist değildir | **Uygulanmış (kısmen)** — free-text + unresolved soft category; browse hâlâ yönlendirir | `raw-input.ts`, authority flow, accept-free-text rule | `verify-request-authority-v1` | Alıcı engellenir (Sözleşme 1) |
| rawInput kullanıcı kalıcı kaynak metindir; AI/professionalDescription otomatik ezemez | **Kısmen uygulanmış** [`CODE-VERIFIED`]. Create’te professionalDescription rawInput olmaz (`create-request.ts:227-232`). Schema boş/omit değeri korur (`request-schema.ts:145-149`). **Ancak** açık `rawInput` update payload mevcut kodda alanı **geri dönüşsüz** değiştirir (`update-request.ts:155-156`); versiyon/history/aktör kaydı yoktur. Bu kod gerçeği **aynen korunmaktadır** — aşağıdaki ürün kararı henüz uygulanmamıştır. | `raw-input.ts`, `create-request.ts`, `update-request.ts`, Prisma `rawInput` | authority verifier (14 PASS) | AI overwrite veya istenmeyen edit kaybı |
| Professional text rawInput’u otomatik ezemez | **Uygulanmış (create yolu)**; update’te ayrı rawInput alanı | `create-request.ts` comments + store logic | authority “empty rawInput does not fall back…” | Gizli overwrite |
| Kategori güçlü ama soft sinyal | **Kısmen** — UI guidance soft; DB `categoryId` fanout’ta hard | guidance + distribute | phase2 + fanout code | Soft sanılıp hard fanout |
| Product span marka/model olamaz | **Kısmen** — entity-roles / identity | `entity-roles.ts`, product-identity | entity-global-core | Yanlış soru/match |
| Marka/model kanıt gerektirir | **V3’te uygulanmış**; legacy fanout’ta yok | matching-v3 identity/scoring | matching-v3 verifier | Sahte EXACT / cartesian |
| Bütçe+konum olmadan review açılmaz | **Uygulanmış** (`BRANCH-WIRED`) | `publish-readiness.ts`, global-core | phase2 / scheduler | Eksik teklif kalitesi |
| Sorular kategori/ürüne göre | **Uygulanmış** (`BRANCH-WIRED`) | question-profiles, scheduler | controls/scheduler | Generic form geri dönüş |
| Missing catalog ≠ hard exclusion | **V3’te uygulanmış**; legacy category miss farklı sorun | score-candidate coverage | matching-v3 | Doğru Pro silinir |
| Explicit exclusion hard conflict | **V3’te uygulanmış** | excluded + scoring | matching-v3 | Yanlış negatif |
| EXACT güçlü bağımsız kanıt ister | **V3 tier-gates** | `tier-gates.ts` | matching-v3 | Sahte kesin eşleşme |
| Unresolved/zero-match sessiz kaybolamaz | **V3 shadow evet**; **legacy fanout kısmen** — `466436b` ile zero-match/unresolved artık **olay üretir** (`zero_match`, `category_skipped`), fakat ops queue yok ve sink doğrulanmadı | shadow-match; `distribute-request.ts:253`, `fanout-telemetry.ts` | matching-v3; `verify-fanout-telemetry-v1` (69 PASS) | Sözleşme ihlali |
| Relevance ≠ ücretli plan | **V3 evet**; branch fanout’ta plan çoğunlukla **gecikmeli erişim kopyası** — eşleşen firma setini değiştirmez | delivery-policy contract, distribute-request | matching-v3 | Pro skoru şişer |
| Canlıya / fanout cutover shadow+ölçüm sonrası | **Ürün kararı**; kodda `not_wired` | shadow-match report field | matching-v3 | Erken cutover |
| Branch’te görmek = production | **Yanlış.** Deploy: `PRODUCTION-STATUS-NOT-VERIFIED` | — | — | Yanlış güven |
| Understanding snapshot update yolunda yeniden kurulmaz | **Kod gerçeği** [`CODE-VERIFIED`] — bilinçli karar değil, **boşluk**. `update-request.ts`’te `understanding` → 0 hit | `update-request.ts:162-163` | — | Audit kaydı yanlış metni anlatır |
| Türetilmiş projection AI metninden kurulabilir | **Kod gerçeği** [`CODE-VERIFIED`] — provenance kaydı yok | `create-request.ts:46-50` | — | AI yorumu izlenemeden türetilmiş gerçeğe girer |
| İkinci (“Silent backfill”) RequestMatch yazıcısı vardır | **Kod gerçeği** [`CODE-VERIFIED`] — belgelenmemişti, 2026-08-22’de eklendi; **`466436b` ile ölçülür hâle geldi** (`request.backfill.*`) | `distribute-request.ts:431+`, `take: 100` (`:522`) | `verify-fanout-telemetry-v1` | Ölçüm ve dedupe tasarımı yanlış kurulur |

---

## 2026-08-22 — Ürün kararları (devralma denetimi sonrası)

### Karar A — Sonraki uygulama dilimi: **Dilim 2a**

| | |
|--|--|
| **Durum** | **UYGULANDI** — `466436bb438765cd42fd9031eb6ac35a530bb562`, `BRANCH-WIRED` |
| **Karar** | Sonraki dilim **Dilim 2a — Legacy fanout gözlemlenebilirliği**’dir. Matching V3 **henüz canlı fanout’a bağlanmayacaktır**. Dilim 2a’da bildirim davranışı, eşleşen firmalar, query limitleri, return değerleri ve `RequestMatch` yazımları **değişmeyecektir**. Önce legacy zero-match, kategori-skip, cap, city-only fallback ve ikinci/backfill yazıcı yolları ölçülebilir hâle getirilecektir. |
| **Gizlilik ilkesi (zorunlu)** | `rawInput`, `professionalDescription`, iletişim bilgisi veya başka serbest metin **loglanmayacaktır**. Yalnız PII içermeyen yapısal olaylar ve sayımlar kullanılacaktır. |
| **Sonrası** | Dilim 2b (shadow wiring + persist + compare) yalnız **gerçek legacy taban ölçümü oluştuğunda** ele alınacaktır. |
| **Dosyalar** | `distribute-request.ts`, `fanout-telemetry.ts`, `province-allowlist.ts`, `logger.ts`, `verify-fanout-telemetry-v1.ts`; `09-NEXT-PHASE-RECOMMENDATION.md` |
| **Uygulama durumu** | **Kod yazıldı ve commit edildi (`466436b`).** Kararın tamamı karşılandı: 14 olay üretiliyor, davranış değişmedi (`git diff -w` +309/−12), 10 verifier aynı sayılarla yeşil. **Ancak dilim tamamlanmadı:** olaylar yalnız stdout’a gidiyor → **`PRODUCTION-SINK-NOT-VERIFIED`**, deploy → `PRODUCTION-STATUS-NOT-VERIFIED`. “Kod tamamlandı” doğru, “ölçüm çalışıyor” **yanlış**. |
| **Değişirse risk** | Ölçüm tabanı olmadan cutover → “yeni motor daha iyi” iddiası kanıtlanamaz; Pro’ya yanlış güven |

### Karar C — Konum telemetrisi sözleşmesi (Dilim 2a)

| | |
|--|--|
| **Durum** | **UYGULANDI** — `466436b`, `src/lib/observability/province-allowlist.ts` |
| **Gerekçe** | Tedarikçi boşluğu **il bazında** ölçülemezse “hangi ilde Pro yok?” sorusu cevapsız kalır. Ama ham konum metni serbest kullanıcı girdisidir ve PII taşır. |
| **Sözleşme** | `locationScope`: `province` \| `nationwide` \| `remote` \| `unspecified` · `provinceCode`: yalnız sabit, allowlist edilmiş TR il kodu (`TR-34` gibi) · `resolutionStatus`: `resolved` \| `unknown` |
| **Yasaklar** | Ham şehir/ilçe/mahalle/adres ve diğer serbest metin loglanamaz · güvenilir canonical dönüşüm yoksa `provinceCode` **yazılmaz** (`unspecified` / `unknown` kullanılır) · `provinceCode` serbest metinden türetilemez, yalnız allowlist üyesi olabilir · **ilçe seviyesi ölçüm bu dilimde yok** |
| **Tek authority** | İl **adları** yeniden yazılmadı: `TURKEY_IL_NAMES`’ten (`@/lib/geo/turkey-districts`) load anında türetilir. Modülün tek yeni katkısı ISO 3166-2:TR **kod ataması**dır — repoda başka kaynağı yoktur (`TR-NN`, plaka, `provinceCode` araması `src/` altında 0 hit; Prisma şemasında province alanı yok). Kod tablosu ASCII-fold edilmiş adla anahtarlanır; `getProvinceAllowlistDrift()` iki yönlü sapmayı raporlar ve verifier boş olduğunu assert eder. Drift hâlinde davranış **fail-safe**: eşleşmeyen il kod almaz, `unknown`’a düşer |
| **Zorlama** | `verify-fanout-telemetry-v1` doğrular: allowlist üyeliği, `locationScope` ↔ `provinceCode` tutarlılığı, ilçe alanının hiç bulunmaması, 81 ilin ayrı koda çözülmesi, ASCII-fold çakışması olmaması, ve **973 ilçe adının hiçbirinin bir il adına eşit olmaması** (yani yalnız ilçe saklanmış bir `city` yanlış ile değil `unknown`’a düşer) |
| **Dikkat** | `distribute-request.ts` `matchReason` alanı ham şehir adı içerir (`` `Şehir (${company.city})` ``) — hiçbir olayda loglanmaz [`TEST-VERIFIED`] |
| **Bilinçli taviz** | Çözüm **katıdır**: yalnız kanonik ada birebir (veya deterministik ASCII karşılığına) eşleşme kod üretir. `"İstanbul Anadolu Yakası"` gibi girdiler `unknown` sayılır. Hata yönü **eksik ölçüm**, **yanlış ölçüm** değil. `unknown` oranı yüksek çıkarsa alias listesi ayrı bir kararla genişletilebilir |
| **Değişirse risk** | Yeniden kimliklendirme / gereksiz PII saklama; ya da tersi: il bazında ölçüm yapılamaması |

### Karar D — Deploy ≠ ölçüm; sink doğrulama kapısı

| | |
|--|--|
| **Durum** | **ONAYLANDI** — Dilim 2a’nın tamamlanma tanımının parçası |
| **Karar** | Logların hangi production sink’e ulaştığı doğrulanmadıysa durum açıkça **`PRODUCTION-SINK-NOT-VERIFIED`** işaretlenir. Dilim 2a’nın başarılı sayılması için deploy sonrasında olayların **merkezî log sisteminde sorgulanabildiği ayrıca doğrulanmalıdır**. Yalnız uygulama konsoluna yazılan fakat sonradan sorgulanamayan loglar ölçüm altyapısı tamamlanmış **sayılmaz**. |
| **Sink kabul kriteri (2026-08-22 eklendi)** | `logOperational` sink döngüsünü **senkron** çalıştırır (kuyruk yok). Bu yüzden: production sink **non-blocking olmalıdır**; **senkron ağ çağrısı yapan sink kabul edilmez** (publish başına ~10 olay × sink gecikmesi doğrudan yayın süresine eklenir); kuyruk / arka planda flush davranışı ve merkezî sorgulanabilirlik **deploy kapısında kanıtlanmalıdır**; **örnek sorgu ve dönen gerçek kayıt görülmeden sink doğrulanmış sayılmaz** |
| **Bugünkü durum (`466436b` sonrası)** | Kod tarafı tamam, ölçüm tarafı **açık**. `addLogSink`’in `src/` altında **0 çağrısı** var; `instrumentation.ts` sink kaydetmiyor; olaylar `defaultSink` → stdout. → **`PRODUCTION-SINK-NOT-VERIFIED`** |
| **Zorlama** | `verify-fanout-telemetry-v1` bunu kalıcı kapı olarak tutar: bir sink kaydedilirse test **kırmızıya döner** ve `09` / `11` güncellenmeden yeşile dönmez. Sessizce “artık ölçüyoruz” denemez |
| **Sonuç** | Bu kapı geçilmeden Dilim 2b **başlatılmaz** (önkoşulu olan legacy taban ölçümü oluşmamış olur) |
| **Değişirse risk** | “Telemetri eklendi” denip hiçbir sayının sorgulanamaması — ölçüldüğü sanılan ama ölçülmeyen sistem; bu, `01A` §10’daki “rapor gerçek davranışı yansıtmalı” ilkesinin ihlali |

### Karar E — Telemetri olay sözleşmesi ve gizlilik sınırı (Dilim 2a)

| | |
|--|--|
| **Durum** | **UYGULANDI** — `466436b` |
| **Olay sözleşmesi** | **14 canonical olay**, `fanout-telemetry.ts` `FANOUT_EVENTS` içinde tek kaynak: `request.fanout.{started, precondition_skipped, category_skipped, category_scan, city_scan, city_only_fallback, zero_match, notifications_written, completed, failed, estimated}` + `request.backfill.{started, completed, failed}`. Verifier sözleşmeyi iki yönlü kilitler: sözleşme dışı ad da, çağrılmayan ad da kırmızıdır |
| **Span denklemleri** | fanout `started = precondition_skipped + zero_match + completed + failed` · backfill `started = completed + failed`. Her erken dönüş **ve** her istisna yolu bir terminale bağlıdır |
| **Hata davranışı** | Failure olayı üretilir, ardından **aynı hata nesnesi yeniden fırlatılır**. Hata yutulmaz, başarıya çevrilmez; `create-request.ts:335`’teki mevcut yakalama davranışı korunur. Payload yalnız `reason: "unexpected_error"` + allowlist `failureStage` + `errorName` (hata **sınıfı** adı) taşır; mesaj, stack, SQL veya kullanıcı girdisi **asla** |
| **`outcome` değeri** | Ortak `OperationalOutcome` sözleşmesine uyar → hata için **`"failure"`**. `"failed"` adında ikinci bir değer **eklenmedi** (2026-08-22 kararı); eşanlamlı iki değer 20+ çağrı noktasında belirsizlik yaratırdı |
| **Tarama modeli** | Çalışmamış sorgu `scanStatus: "not_run"` (yalnız `cap`); gerçekten 0 bulan sorgu `"executed"` + `found: 0` + `capSaturated: false`. **Sahte sıfır, NaN veya null kullanılmaz.** Aksi hâlde cap doygunluk oranının paydası çalışmamış taramalarla şişerdi |
| **Fail-open** | Her emit `try/catch` içinde; konum türetme de `safeResolveLocation` sınırından geçer. Telemetri veya sink hatası talep yayınlamayı **durduramaz** |
| **Aktör kimliği** | `logger.ts`’e additive `LogOptions { omitActorCorrelation }` eklendi. Fanout/backfill/estimator olayları correlation store’dan `userId`, aktör `companyId` ve transport `requestId` **miras almaz**; yalnız açıkça geçilen operasyonel `requestId` / `companyId` ve opak `correlationId` bulunur. **Diğer logger tüketicilerinin varsayılan davranışı değişmedi** (`verify-phase4a-observability-v1` 23 PASS ile doğrulandı) |
| **Değişirse risk** | Olay adı değişirse geçmiş sorgular sessizce boşa düşer; failure terminali kaldırılırsa oran matematiği bozulur; `not_run` ayrımı kaldırılırsa cap doygunluk oranı yanlış hesaplanır; aktör kimliği geri gelirse il kodu ile eşleşip yeniden kimliklendirme riski doğar |

### Karar B — rawInput revizyon modeli · `PRODUCT-INTENT` / `DECIDED-NOT-IMPLEMENTED`

> ⚠️ **Bu karar bugünkü kodda UYGULANMAMIŞTIR.** Kod hâlâ açık payload’la üzerine yazar (`update-request.ts:155-156`, `CODE-VERIFIED`). Kararı okuyup “uygulanmış” sanma.

| # | Karar | Bugünkü kod |
|---|---|---|
| B1 | İlk kullanıcı `rawInput` metni **değiştirilemez orijinal kayıttır** | ❌ Üzerine yazılabilir |
| B2 | AI veya `professionalDescription` bu alanı **hiçbir zaman** değiştiremez | ✅ Sağlanıyor (create zinciri + schema guard) |
| B3 | Kullanıcı talebini düzenleyebilir, fakat üzerine yazmak yerine **yeni, kullanıcı tarafından oluşturulmuş bir revizyon** açılır | ❌ Revizyon kavramı yok |
| B4 | Revizyonda **aktör/kullanıcı, zaman ve kaynak** tutulur | ❌ Hiçbiri tutulmuyor |
| B5 | Güncel canonical understanding ve snapshot **son kullanıcı revizyonundan yeniden kurulur** | ❌ Update’te rebuild yok |
| B6 | **Anlamlı düzenleme sonrası yeniden eşleştirme** çalışır | ❌ Update’te `distribute` yok |
| B7 | Bildirimler **revizyon × firma** bazında idempotent/dedupe olur | ❌ `notification.createMany` dedupe’suz (`:375`) |

| | |
|--|--|
| **Durum** | `PRODUCT-INTENT` · **`DECIDED-NOT-IMPLEMENTED`** |
| **Uygulama** | **Bilinçli olarak ertelendi.** Ayrı şema + davranış tasarım dilimi gerektirir; Dilim 2a kapsamında **değildir** |
| **İlgili dosyalar (gelecekte)** | `update-request.ts`, `request-schema.ts`, `understanding-snapshot.ts`, `publish-understanding.ts`, `prisma/schema.prisma`, `distribute-request.ts` |
| **Testler (gelecekte)** | `verify-request-authority-v1.ts` genişletmesi: “hiç kimse rawInput’u ezemez” (bugünkü test yalnız “AI otomatik ezemez”i kapsar) |
| **Değişirse risk** | Kullanıcının orijinal metni denetlenemez biçimde kaybolur — Sözleşme 1’in adını taşıyan yarısı |

Vizyon-only kalanlar: production precision hedefleri, attachment-first UX, tam admin kürasyon — `PRODUCT-INTENT` / `PROPOSED`.

---

**Bunu ne için yapıyoruz?**  
“Neden böyle kodlandı?” sorusunun cevabını kaybedip yarın tersine çevirerek alıcı veya Pro’yu incitmemek; özellikle rawInput’u gerçekte olduğundan daha sıkı sanmamak için kararları mühürlüyoruz.


---

## 2026-08-23 — Paket yapısı tek katmana indirildi

### Karar D — Yalnız **Profesyonel**; Premium ve Kurumsal kaldırıldı

| | |
|--|--|
| **Durum** | **UYGULANMIŞ** — kod karşılığı `d7839b0` (2026-08-16), `BRANCH-WIRED` |
| **Karar** | Ücretli paket yapısı tek katmana indirildi: kullanıcıya sunulan tek ücretli paket **Profesyonel**'dir. **Premium ve Kurumsal üründen kaldırılmıştır.** `AVAILABLE_PLAN_IDS = ["STANDARD", "PROFESSIONAL"]`. `PREMIUM` / `CORPORATE` yalnız **legacy depolama/enum değeri** olarak yaşar ve `canonicalizePlanTier` ile `PROFESSIONAL` yetkisine eşlenir. Yeni hiçbir yerde yeniden kullanılmazlar. |
| **Kod karşılığı** | `d7839b0` — `resolvePlanTierFromProviderPriceId` mock dalı `PREMIUM \|\| PROFESSIONAL \|\| CORPORATE`'ten yalnız `PROFESSIONAL`'a daraltıldı. `mock_price_PREMIUM` ve `mock_price_CORPORATE` için `null` dönmesi **doğru davranıştır**. |
| **Kaydın eksikliği (asıl mesele)** | **Karar 2026-08-16'da hiçbir yere yazılmadı.** Kodda yalnız gerekçesiz bir daraltma kaldı. Sonuç: 2026-08-23'te bu daraltma bisect ile bulundu, "ödeme yolunda gerçek hata" sanıldı, KB-6a olarak kayda geçirildi ve **az kalsın geri alınıyordu** — yani kaldırılan iki paket sessizce ürüne geri dönecekti. Gerekçesiz bir daraltma, altı ay sonra biri tarafından "düzeltilir". |
| **Dosyalar** | `plans.ts` (`AVAILABLE_PLAN_IDS`, `canonicalizePlanTier`, `isLegacyCorporateAccount`), `plan-mapping.ts:84-89`, `pricing-config.ts` |
| **Testler** | `verify-phase4c-billing-v1` "2 plan mapping" — 2026-08-23'te tek paketi bekleyecek şekilde güncellendi ve kaldırılan tier'ların `null` dönmesini **açıkça** sınıyor, böylece geri gelmeleri de gerileme sayılır |
| **Değişirse risk** | Kaldırılmış paketler koda geri sızar; `PLAN_PRICING` iki farklı fiyatı (990 / 2490) aynı "Profesyonel" etiketiyle taşıdığı için yanlış fiyat gösterilebilir |

**Kalıntı denetimi (2026-08-23):** Kararın kod karşılığı tamamlanmamıştır —
`PLAN_PRICING`, iyzico sandbox kataloğu ve bazı doğrulayıcılar hâlâ üç paketli
dünyayı taşıyor. Kalıntı listesi çıkarıldı, **bu turda düzeltilmedi**; ayrı iş
kalemi.