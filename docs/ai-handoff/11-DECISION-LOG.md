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
| Bütçe+konum olmadan review açılmaz | **Uygulanmış** (`BRANCH-WIRED`) — 2026-08-26'da DAR bir ek geldi: cevaplanmamış **çıkarım doğrulaması** olan `routing_critical` alan da kilitler (bkz. Karar H4); önerisi olmayan routing sorusu kilitlemez | `publish-readiness.ts`, global-core, `question-scheduler.ts` | phase2 / scheduler, `verify-inference-question-authority-v2` | Eksik teklif kalitesi |
| Talepo çıkarımı kullanıcı cevabı değildir; yalnız öneridir | **Uygulanmış** (`BRANCH-WIRED`) — `3d5b2a5`, bkz. Karar H | `answer-authority.ts`, `provenance.ts`, `questions.ts`, `question-scheduler.ts`, `FocusedQuestionsPanel.tsx` | `verify-inference-question-authority-v2`, `verify-user-choice-authority-v1` | Kullanıcı görmediği bir değerin belirlediği havuza gider (KB-17) |
| Otorite sırası TEK kanonik merdivendir | **Uygulanmış** (`BRANCH-WIRED`, `CODE-VERIFIED`) — `ce464eb`; tek `AUTHORITY_RANK`, answer katmanı dar görünüm, verified kaynak listesi tipli | `provenance.ts`, `answer-authority.ts`, `build-state.ts` | `verify-authority-ladder-v1` (11/11) | Dört kopyadan biri değişip ötekilerle sessizce ayrışır; kullanıcı beyanı bir katmanda çıkarıma düşer |
| `rawInput` soru cevaplarıyla değiştirilmez | **Uygulanmış** (`BRANCH-WIRED`) — `3d5b2a5`, 2026-08-23 kararının yerine geçer (Karar G) | `talep/page.tsx`, `sync.ts` | `verify-user-choice-authority-v1` | Bestecinin yazdığı sözcük başka alanın kullanıcı kanıtı sayılır (KB-20) |
| Çıplak ilçe adı konum kanıtı değildir | **Uygulanmış** (`BRANCH-WIRED`) — `3d5b2a5`, bkz. KB-20 | `turkey-districts.ts`, `understand-request.ts` | `verify-geo-evidence-authority-v1` | Kullanıcının yazmadığı şehir talebe yazılır |
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
---

## 2026-08-25 — Talepo kapsamı: yalnız talep tarafı

### Karar F — Talepo demand-only bir talep platformudur; arz ilanı kabul edilmez

| | |
|--|--|
| **Durum** | **UYGULANMIŞ** — kod karşılığı `a44c23d` (2026-08-25, parent `2facc3c`), `BRANCH-WIRED`. **`PRODUCTION-DEPLOYED` DEĞİL.** |
| **Karar** | Talepo, ihtiyacı olan tarafın talebini kabul eder: ürün satın alma, ürün/araç/makine kiralama, hizmet alma, üretim/baskı yaptırma. Kullanıcının **kendi** ürününü satacağı, **kendi** aracını/makinesini satacağı, **kendi** taşınmazını/ürününü kiraya vereceği bir arz/ilan platformu **değildir**. Kapsam dışı metin yayınlanmaz, eşleştirilmez, bildirim üretmez. |
| **Ayrımın kuralı** | Esas alınan **satılan nesne değil, kullanıcının talep ettiği hedeftir**. “Aracımı satmak için ekspertiz hizmeti arıyorum”, “Evimi kiraya vermek için emlakçı arıyorum”, “Ürünlerimi satmak için e-ticaret yazılımı arıyorum” **geçerli taleplerdir**. İlan sıfatı da arayanı talep tarafına koyar: “satılık araç arıyorum” alıcıdır, “kiralık daire arıyorum” kiracıdır. |
| **Kod karşılığı** | Tipli `RequestScope = "DEMAND" \| "UNSUPPORTED_SUPPLY"` (`request-understanding/types.ts`). Karar tek yerde, uzlaştırılmış işlem türünden okunur: `SELL` kapsam dışıdır. `SELL` bu commit'ten sonra **yalnız** açık elden çıkarma ifadesiyle üretilir (ilan sıfatları artık `SELL` üretmez), ve kullanım bağlamındaki elden çıkarma ifadesi karar veremez — bu ayrım yeni bir çözümleyiciyle değil, mevcut `readUsageContextSplit` otoritesinin sonucuyla yapılır. Kapsam dışında kategori ve konu **UNKNOWN** bırakılır, gerekçe kanıt olarak yazılır. |
| **Snapshot** | `RequestUnderstandingSnapshot.requestScope?` — **additive ve opsiyonel**. Alan yoksa eski snapshot `DEMAND` gibi okunur. Snapshot `discoveryProjection` JSON kolonunun altında yaşadığı için **Prisma kolonu açılmadı, migration gerekmedi**. Snapshot **denetim bilgisidir; karar yetkisi değildir.** |
| **Yayın kapısı** | `parseCreateRequestInput` içinde, `createRequest` çağrılmadan **önce**. Kapsam metni `rawInput`, yoksa `description` üzerinden okunur; böylece `rawInput` göndermemek bir kaçış yolu değildir. Aynı fonksiyon PATCH yolunda da çalıştığı için **create, legacy create ve update** birlikte korunur. Karar istemciden gelen snapshot'a güvenilerek verilmez, sunucuda metinden **yeniden türetilir**; `DEMAND` diyen bir istemci snapshot'ı kapıyı açamaz. `rawInput` gönderilmediğinde mevcut değer ezilmez. |
| **Fanout/bildirim** | **Yapısal olarak erişilemez.** Kapı Request satırı oluşmadan fırlar; fanout'un tek girişi `distributeRequestToCompanies` ve bildirim `tx.notification.create`, ikisi de var olan bir Request satırı üzerinden çalışır. **Matching V3, fanout ve bildirim kodu bu kararla değiştirilmedi.** |
| **Kullanıcı deneyimi** | Kapsam dışında soru motoru başlamaz, review ve publish açılmaz. Kullanıcı boş ekranda bırakılmaz: ne kabul edildiğini söyleyen kısa, suçlayıcı olmayan bir açıklama ve metne dönmek için tek bir eylem (“Metnimi düzenle”) gösterilir. `/talep` akışında **tarayıcıda DOM ile doğrulandı**. |
| **Dosyalar** | `request-understanding/types.ts`, `intent-signals.ts`, `semantic-subject.ts`, `understand-request.ts`, `requested-item-role.ts`, `ai/parser/category.ts`, `request/understanding-snapshot.ts`, `request/publish-understanding.ts`, `request-composer/questions.ts`, `request-composer/v2/publish-readiness.ts`, `request-composer/v2/composer-flow.ts`, `server/request/request-schema.ts`, `app/talep/page.tsx` |
| **Testler** | `verify-understanding-invariants-v1` → **I46** (işlem türü kanıt önceliği), **I47** (kapsam kararı ve kapıları), **I48** (geçerli hizmet taleplerinin yönlenmesi, create/legacy create/update truth table, kullanıcı deneyimi). Batarya: `102 passed · 2 failed · 1 known_fail`; kırmızılar yalnız önceden açık **I22** ve **I23**. `verify-category-coverage-v1`: `TOTAL=108 · PASS=99 · KNOWN_FAIL=9 · FAIL=0 · XPASS=0`. |
| **Değişirse risk** | Kapsam kapısı gevşerse arz ilanları ücretli Pro akışına girer ve profesyonelin karşılayamayacağı taleplerle dikkati harcanır. Ayrım “satılan nesne”ye kaydırılırsa **gerçek hizmet talepleri engellenir** — “aracımı satmak için ekspertiz arıyorum” yayınlanamaz hâle gelir. İlan sıfatı yeniden arz sayılırsa “satılık araç arıyorum” diyen **alıcı** engellenir. |

**Bu kararla birlikte iki doğrulayıcı beklentisi güncellendi.**
`verify-request-understanding-brain` ve `verify-single-brain-closure`,
*“kiracılı satılık dükkan arıyorum”* senaryosu için `intent = SELL`
bekliyordu. Bu beklenti, ilan sıfatının niyeti belirlediği **eski modelden**
geliyordu ve korunsaydı gerçek bir **alıcı** arz ilanı sayılıp
engellenecekti. Senaryo artık `BUY` ve `DEMAND` bekliyor; testin asıl
koruduğu kural (“kiracı” sözcüğü bunu kiralama talebi yapmasın) aynen
duruyor.

**Kapsam dışı bırakılanlar.** Birinci sınıf bir `LET` (kiraya verme) niyeti
eklenmedi; arz yönü mevcut `SELL` üzerinden temsil ediliyor ve hangi ilanın
verildiği `listingType` alanında korunuyor. Ayrı bir `LET` niyeti eklemek
`RequestIntent` enum'ını genişletir ve soru/strateji sistemlerine yayılır;
ayrı bir karardır. `SELL` talebinde konu türü çözülmüyor — önceki **yanlış**
`REAL_ESTATE` değeri yerine **iddiasız** kalıyor.

**Yeni bir KB kaydı açılmadı.** “Aracımı satmak istiyorum” girdisinin
kategori ve konu çözmemesi bir hata değil, ürün politikası gereği ölçülmüş
`UNSUPPORTED_SUPPLY` sonucudur. Bu turda **KB-16 kapandı**; KB-11/I22,
KB-14/I23, I25d known_fail, KB-15 ve kalan 9 kapsama `KNOWN_FAIL`'i
**açık kalmaya devam ediyor**. Matching V3 hâlâ üretime bağlı değil,
tedarikçi yetkinliği ve canlı bildirim teslimatı **ölçülmedi**.

---

## 2026-08-26 — Kullanıcı metni otoritesi ve çıkarımın rolü

### Karar G — “Verilen cevap serbest metne de işlenir” — **YERİNE GEÇTİ / SUPERSEDED**

| | |
|--|--|
| **Alınma tarihi** | 2026-08-23 |
| **Nerede yaşıyordu** | Bu günlükte **kayıtlı değildi**; yalnız `apps/web/src/app/talep/page.tsx` içinde bir kod yorumu olarak duruyordu (“Kurucu (2026-08-23): verilen cevap serbest metne de otomatik işlenir — metin talebin tek gerçek kaydıdır”) |
| **Durum** | **YERİNE GEÇTİ — 2026-08-26, `3d5b2a5`.** Silinmiyor; neden alındığı ve neden geri alındığı görünür kalsın diye duruyor |
| **Özgün gerekçe** | Metnin talebin tek gerçek kaydı olması; soru panelinde verilen cevabın metinde de görünmesi |
| **Geri alma gerekçesi (ölçülmüş)** | Bestecinin kullanıcının cümlesine yazdığı sözcük, bir sonraki okumada **başka bir alanın** kullanıcı kanıtı sayılabiliyordu. `needType = vehicle` cevabı `“Talep türü: Araç.”` diye yazıldığında konum otoritesi `Araç`ı Kastamonu'nun ilçesi olarak okuyup kullanıcının hiç yazmadığı bir konumu `EXPLICIT` kanıtla dolduruyordu (bkz. **KB-20**). Etiket yerine kayıt değeri yazıldığında ise kullanıcı kendi cümlesinde makine slug'ı (`“Talep türü: vehicle.”`) görüyordu |
| **Değişirse risk** | Cevap metne geri yazılırsa iki kusur birlikte döner: kullanıcıya slug gösterilir ve besteci kendi yazdığını kullanıcı beyanı sayar |

### Karar H — Kullanıcı metni otoritesi · cevap otoritesi sırası

| | |
|--|--|
| **Durum** | **UYGULANMIŞ** — `3d5b2a5`, `BRANCH-WIRED`. **`PRODUCTION-DEPLOYED` DEĞİL** |
| **Dosyalar** | `answer-authority.ts`, `provenance.ts`, `understand-request.ts`, `questions.ts`, `sync.ts`, `question-scheduler.ts`, `focused-questions.ts`, `FocusedQuestionsPanel.tsx`, `talep/page.tsx`, `turkey-districts.ts` |
| **Testler** | `verify-inference-question-authority-v2` (exit 0), `verify-question-suppression-authority-v1` (exit 3 — ölçülemeyen 4 kayıt), `verify-geo-evidence-authority-v1` (exit 0), `verify-user-choice-authority-v1` (exit 0) |
| **Değişirse risk** | Talepo kendi tahminini kullanıcı cevabı sanar; talep, kullanıcının hiç görmediği bir değerin belirlediği havuza gider |

Kararın beş maddesi:

**H1 — `rawInput` kullanıcının orijinal metnidir ve soru cevaplarıyla
değiştirilmez.** Ne makine değeri (`vehicle`) ne arayüz etiketi (`Araç`) o
metne eklenir. Tarayıcıda ölçüldü: seçim öncesi ve sonrası `rawInput` birebir
`“Mercedes C180 satın almak istiyorum”`.

**H2 — Açık cevaplar yapılandırılmış alan değerlerinde ve besteci durumunda
tutulur.** Soru panelindeki cevap `applyQuickOption` üzerinden kanonik duruma
`EXPLICIT_BROWSE` kaynağıyla yazılır; o yol `rawInput`'u bilerek korur.

**H3 — Yalnız açık kullanıcı seçimi `USER_EXPLICIT` / `USER_CONFIRMED`
otoritesi kazanır.** Otorite sırası tek yerde tanımlıdır ve aşağı doğru yazım
reddedilir: `USER_CONFIRMED / USER_EXPLICIT > VERIFIED > INFERRED > UNKNOWN`.
`understand-request` içindeki PART ve SERVICE dalları artık kullanıcının
seçtiği `needType` değerini `INFERRED` seviyesine düşüremez.

> **H3 uygulama durumu — `BRANCH-WIRED` · `CODE-VERIFIED` · dayanak commit
> `ce464eb` (D3a).** `3d5b2a5`'te sıra doğru uygulanmıştı ama **tek yerde
> değildi**: aynı merdiven `provenance.ts` içinde `AttributeAuthority`,
> besteci tarafında `AnswerAuthority`, `mapRuProvenance` içinde elle yazılmış
> bir doğrulanmış-kaynak çifti ve `preferExplicit`'in ikili kuralı olarak dört
> ayrı biçimde yaşıyordu. `ce464eb` bunları tek kanonik merdivene indirdi ve
> kod gerçeği şudur:
>
> - Tek `Authority` tipi ve **tek** `AUTHORITY_RANK` tablosu
>   `request-understanding/provenance.ts` içindedir; depoda ikinci bir rank
>   tanımı yoktur.
> - Sıra: `UNKNOWN < INFERRED < VERIFIED < USER_EXPLICIT`. Karşılaştırma
>   `authorityRank` / `isAtLeastAuthority` üzerinden yapılır; çağıranlar kendi
>   eşiklerini kurmaz.
> - Answer katmanı (`answer-authority.ts`) **bağımsız bir merdiven değildir**;
>   kanonik otoriteden türeyen dar bir görünümdür ve kendi rank tablosu
>   yoktur. Soru kapatma eşiği `isAtLeastAuthority(authority, "VERIFIED")`.
> - Doğrulanmış kaynak listesi TypeScript denetimindedir
>   (`as const satisfies readonly UnderstandingSource[]`); enum'da bulunmayan
>   `CATALOG` ve `TAXONOMY` ölü girdileri kaldırıldı. `mapRuProvenance` ve
>   `preferExplicit` aynı kanonik kaynağı okur.
> - Daha zayıf bir kaynak daha güçlü bir değeri veya provenance'ı düşüremez.
>
> Kontrol: `verify-authority-ladder-v1` — **11/11 PASS**. Refactor öncesi bu
> satırlardan altısı kırmızıydı.
>
> **Bu bir davranış değişikliği değildir ve production iddiası taşımaz.**
> Ölçüm `3d5b2a5` ile birebir aynı kaldı: D2 `0 / 20 / 49 / 3 / 0 / 4`,
> kaybolan `0`, D1 `exit 3`, invariant bataryası `121 passed · 2 failed ·
> 1 known_fail`, kategori kapsaması `99 pass`. Değişiklik
> **integration'a taşınmadı, deploy edilmedi; production durumu yoktur ve
> doğrulanmamıştır.**

**H4 — Talepo'nun çıkarımı yalnız öneridir, kullanıcı cevabı değildir.** Değeri
yalnız çıkarımdan gelen alan soruyu kapatmaz; soru sorulur ve çıkarım ayrı bir
öneri rozetiyle gösterilir. Rozet seçilmiş cevap görünümü almaz
(`aria-pressed=false`, tik yok, dolu zemin yok) ve kontrole `aria-describedby`
ile bağlanır. Cevabı ve provenance yükselmesini yalnız kullanıcının dokunuşu
oluşturur. Cevaplanmamış bir çıkarım doğrulaması `routing_critical` bir
alandaysa review ve publish kapısını kilitler; **önerisi olmayan** routing
sorusu eskisi gibi atlanabilir kalır, çünkü yayını yalnız bütçe ve konum
kilitler (bkz. üstteki “Bütçe+konum olmadan review açılmaz” satırı).

**H5 — Yapılandırılmış cevap yayın verisine taşınır.** Yalnız React state'inde
kalan cevap başarı sayılmaz. Veritabanına yazmadan, gerçek yayın çağrısının
kullandığı kurucularla ölçüldü: `discoveryProjection.attributes.needType =
"vehicle"`, `discoveryProjection.constraints.needType = {mode: "VALUE", value:
"vehicle"}`, understanding snapshot `attributes.needType = "vehicle"`.

**Kapsam dışı bırakılanlar.** `provenance_mismatch = 69` etiket ekseni bu
dilimde düzeltilmedi ve olduğundan iyi gösterilmiyor. Soru bastırma ölçümünde
gerçek `not_measured = 4` kaydı ölçülemez olarak duruyor ve D1'in `exit 3`
durumu yeşil kapanış değildir. `MoneyRangeControl` sabit `budget-amount`
kimliğini kullanmaya devam ediyor. Sekme kapanınca cevap ve taslak kalıcı
değildir. Matching V3 canlı fanout'a bağlı değildir; tedarikçi yetkinliği ve
canlı bildirim teslimatı ölçülmemiştir; production deploy yoktur.

**Bunu ne için yapıyoruz?**
Talepo'nun kendi yazdığı ya da tahmin ettiği hiçbir şey kullanıcının beyanı
sayılmasın; kullanıcı görmediği bir değerin belirlediği havuza gitmesin.

## 2026-08-26 — Üyelik dönüşünde yayın niyeti sözleşmesi

### Karar I — Üyelik dönüşü yayın niyeti `canReview` önkoşuluyla düşürülemez

| | |
|--|--|
| **Durum** | **UYGULANMIŞ** — `afc23a3`, `BRANCH-WIRED` · `CODE-VERIFIED` · `BROWSER-MEASURED-LOCAL · PASS` (2026-08-26, ölçülen HEAD `3a90eb4`). **`PRODUCTION-DEPLOYED` DEĞİL** |
| **Dosyalar** | `request-composer/resume-publish.ts` (yeni), `talep/page.tsx`, `scripts/verify-publish-resume-v1.ts` (yeni) |
| **Testler** | `verify-publish-resume-v1` — 15 passed, exit 0 (9 saf davranış + 6 production wiring AST iddiası) |
| **Kayıt** | **KB-21** |
| **Değişirse risk** | Kullanıcı yayınlama niyetiyle üye olur, geri döner ve ekranda hiçbir şey olmaz: ne yayın ne eksik alan rehberliği. Niyet, hiçbir sayaca girmeden kaybolur |

Kararın üç maddesi:

**I1 — Üyelik dönüşündeki yayın niyeti, talebin yayına uygunluğuna bakılarak
sessizce düşürülemez.** Hazır olma kararı YALNIZ anlama senkronizasyonunun
tamamlanmış olmasına bakar: niyet var mı, motor sindirmeyi bitirdi mi,
`rawInput` kullanıcının o anki metnine eşit mi. Bütçe, konum ve kritik soru
durumu bu kararın **girdisi değildir**. Önceki davranışta `canReview = false`
iken latch söndürülüyor ve hiçbir deneme başlatılmıyordu; bu, kullanıcının
açık beyanını sistemin sessizce iptal etmesiydi.

**I2 — Readiness eksikse yayın yapılmaz, ama mevcut eksik alan rehberliği
açılır.** Eksik alan denemeyi iptal etme sebebi değil, denemenin kullanıcıya
göstereceği şeyin ta kendisidir. `handlePublishAttempt` eksik etiketleri
companion üzerinden zaten gösteriyordu; sözleşme, ona her hazır durumda
ulaşılmasını garanti eder. Hiçbir talep bu yolla otomatik olarak yayına
gitmez: kapı hâlâ `handlePublishAttempt` ve sunucudaki yayın kapısıdır.

**I3 — Latch yalnız gerçek deneme başlatıldığında kapanır.** Beklerken açık
kalır, böylece niyet bir sonraki turda hâlâ oradadır; denemeden sonra kapanır,
böylece aynı niyet ikinci bir yayın denemesi üretmez. Sönme noktası tek
yerdedir: karar uygulayıcısına verilen `closeLatch` handler'ı.

> **Uygulama durumu — `BRANCH-WIRED` · `CODE-VERIFIED` · dayanak commit
> `afc23a3`.** Karar mantığı sayfanın effect gövdesinden saf bir yardımcıya
> alındı; doğrulayıcı hem o yardımcıyı hem de `talep/page.tsx`'teki gerçek
> bağlantıyı TypeScript AST'i üzerinden sınar — helper effect'in ilk çalışan
> ifadesi olmalı ve effect gövdesinde `canReview`/`canPublish` geçmemelidir.
> Kırmızı kanıtı iki eksende ayrı ayrı alındı (saf katman 4 ihlal, wiring
> katmanı 2 ihlal) ve geçici değişiklikler tamamen kaldırıldı.
>
> **Tarayıcı ölçümü — 2026-08-26, `3a90eb4`, `BROWSER-MEASURED-LOCAL · PASS`.**
> Yerel integration çalışma kopyasında, bütçe ve konumu boş bırakılmış gerçek
> bir üyelik dönüşü payload'ı ile ölçüldü: metin eksiksiz geri yüklendi,
> anlama tamamlandı, `handlePublishAttempt` yolu çalıştı ve Bütçe · Şehir/bölge
> · Ürün türü rehberliği açıldı; gerçek talep yayınlanmadı, create/publish/
> notification DB yazımı olmadı, `rawInput` değişmedi, latch tek sefer tüketildi
> ve ikinci yenilemede tekrarlanmadı, console/hydration hatası 0. Negatif
> kontrolde aynı metin pending draft olmadan girildiğinde rehberlik paneli
> açılmadı — panel böylece publish-attempt yoluna ayrıştırıldı. Doğrulama DOM
> ve ağ kayıtlarıyla yapıldı; ekran görüntüsü alınamadı. Bu ölçüm **yerel bir
> çalışma kopyasındadır**: canlı başarı iddiası taşımaz ve gerçek kimlik
> doğrulama sağlayıcısıyla uçtan uca üyelik akışı ölçülmemiştir. Bkz. **KB-21**.
