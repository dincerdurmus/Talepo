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
| Talepo çıkarımı kullanıcı cevabı değildir; yalnız öneridir | **Uygulanmış** (`BRANCH-WIRED`) — `3d5b2a5`; yayın kanalı `83be90b`, bkz. Karar H (H7); projection okuma modeli `008a4ac`, bkz. Karar H (H10); **sunucu güven sınırı `83f3b3e` ve structured cevap modu `aa2f2e1`, bkz. Karar H (H11)** | `answer-authority.ts`, `provenance.ts`, `questions.ts`, `question-scheduler.ts`, `FocusedQuestionsPanel.tsx`, `ui-helpers.ts` (`buildPublishFieldValues`, `applyPublishAnswersToState`), `request-composer/types.ts` (`FIELD_VALUE_KINDS`), `discovery/types.ts`, `discovery/build-projection.ts`, `discovery/validate-filter.ts`, `discovery/server-authority.ts`, `server/request/request-schema.ts`, `server/request/create-request.ts`, `server/request/update-request.ts`, `server/request/clone-request-as-draft.ts`, `EditRequestForm.tsx` | `verify-inference-question-authority-v2`, `verify-user-choice-authority-v1`, `verify-publish-inference-authority-v1`, `verify-projection-authority-v1`, `verify-projection-server-authority-v1` | Kullanıcı görmediği bir değerin belirlediği havuza gider (KB-17); istemci sahte `VERIFIED` damgasıyla yönlendirme sinyali üretir |
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
| **Durum** | **UYGULANMIŞ** — `3d5b2a5` (H1–H5) + `ce464eb` (H3 tekilleştirme) + `b12ce53` (H6 · `BROWSER-MEASURED-LOCAL · PASS`, 2026-08-26) + `83be90b` (H7 · `CODE-VERIFIED`, 2026-08-27) + `111b412` (H8 · `CODE-VERIFIED`, 2026-08-27) + `7aa6990` (H9 · `CODE-VERIFIED`, 2026-08-27) + `008a4ac` (H10 · `CODE-VERIFIED`, 2026-08-27) + `83f3b3e` ve `aa2f2e1` (H11 · `CODE-VERIFIED`, 2026-08-27), `BRANCH-WIRED` · `CODE-VERIFIED`. **`PRODUCTION-DEPLOYED` DEĞİL** |
| **Dosyalar**. **`b12ce53` eki:** `ui-helpers.ts`, `request-brain/types.ts`, `request-composer/index.ts`, `EnrichmentChips.tsx`, `talep/page.tsx`, `scripts/verify-inference-confirmation-priority-v1.ts` (yeni) | `answer-authority.ts`, `provenance.ts`, `understand-request.ts`, `questions.ts`, `sync.ts`, `question-scheduler.ts`, `focused-questions.ts`, `FocusedQuestionsPanel.tsx`, `talep/page.tsx`, `turkey-districts.ts` |
| **Testler**. **`b12ce53` eki:** `verify-inference-confirmation-priority-v1` (exit 0, iki koşuda byte-birebir) | `verify-inference-question-authority-v2` (exit 0), `verify-question-suppression-authority-v1` (exit 3 — ölçülemeyen 4 kayıt), `verify-geo-evidence-authority-v1` (exit 0), `verify-user-choice-authority-v1` (exit 0) |
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

**H6 — Çıkarım, kanonik soru adayında taşınan ONAYSIZ ÖNERİDİR; kullanıcı
açıkça seçip onaylamadan cevap ya da `USER_EXPLICIT` otorite olamaz.**
(`b12ce53`, 2026-08-26 — H4'ün ölçülmüş ve tamamlanmış hâli.)

> **H4'ün bir cümlesi ölçüldüğünde YANLIŞ çıktı ve burada düzeltiliyor.**
> H4, `3d5b2a5` tarihinde "rozet seçilmiş cevap görünümü almaz
> (`aria-pressed=false`, tik yok, dolu zemin yok)" diyordu. Tarayıcıda
> ölçüldüğünde gerçek bunun tersiydi: `/talep` ekranında çıkarım
> `aria-checked="true"` ve seçili mavi zeminle geliyordu — `auto-02` →
> `İkinci el`, `furn-01` → `Ev`. Yani kullanıcı hiçbir şeye dokunmadan
> onaylamış görünüyordu. H4'ün geri kalanı (çıkarım soruyu kapatmaz, cevabı
> yalnız kullanıcının dokunuşu oluşturur) geçerlidir; yalnız bu görünüm
> iddiası `b12ce53` ile **yerine geçmiştir** ve artık ölçülmektedir.

Kararın üç maddesi:

1. **Öneri, sorunun kendi sözleşmesinde taşınır.** Kanonik taşıyıcı
   `QuestionCandidate.inferredSuggestion` = `{ value, authority, confirmed }`.
   `authority` tip düzeyinde yalnız `INFERRED`
   (`Extract<Authority, "INFERRED">`), `confirmed` tip düzeyinde yalnız
   `false`. Bir öneri tip düzeyinde cevaba dönüşemez.

2. **Öneri seçim durumu üretmez.** Seçili seçenekler yalnız taslaktan
   türetilir; öneri hiçbir kontrolü `aria-checked="true"` yapmaz, seçili stil
   almaz ve soruyu kapatmaz. Öneriye dokunmak en fazla taslağı seçer; otorite
   yükselmesini yalnız mevcut Ekle/Onay eylemi oluşturur ve `rawInput`'a hiçbir
   metin eklenmez. Ekranda duran değer tahminden **farklıysa** o değer
   kullanıcıya aittir: taslakta korunur ve reddedilen tahmin geri önerilmez.

3. **Arayüz kabuğuna özel prop zinciri kurulmaz.** `TalepoAiPanel` geçici bir
   kabuktur; ona özel bir öneri prop'u eklenmedi ve dosya `b12ce53`'te
   **değişmedi**. Bugünkü panel ile onun yerini alacak arayüz aynı kanonik soru
   adayını tüketir, böylece kabuk değişince bu bilgi sessizce düşmez.
   **Maira uygulanmış değildir**; bu madde yalnız gelecekte arayüzün
   değiştirilebilmesini sağlayan sözleşmedir, ne `BRANCH-WIRED` ne
   `PRODUCTION-DEPLOYED` bir Maira iddiası taşır.

**Nasıl ölçüldü.** Doğrulayıcı üç yüzeyi ayrı ölçer: motor kuyruğu (`next`),
sıralanmış aday listesi (`candidates`) ve `/talep` ekranının gerçekten render
ettiği liste (`renderableCandidates`). Nihai süzgeç bu dilimde `page.tsx`ten
`ui-helpers.ts` → `filterRenderableCandidates` altına taşındı; taşıma davranışı
değiştirmedi ve bağlantı `page.tsx`in AST'si üzerinden kanıtlanır.
`auto-02/condition@FIRST_SCREEN` üç yüzeyde de ilk üç görünür soru içindedir.
Nihai render yüzeyinden sessizce düşen çıkarım kimliği 35 → **0**; etkilenen 30
benzersiz senaryo (25 senaryoda 1, 5 senaryoda 2). `USER_EXPLICIT` ya da
kapatmaya yetkili `VERIFIED` hiçbir değer yanlışlıkla yeniden sorulmadı (0).

**Commit öncesi kapatılan regresyon (B1).** İlk uygulama, `updateDynamicField`
kanonik duruma yazmadığı için kullanıcının `manualValues` değerini taslaktan
siliyor ve reddettiği tahmini yeniden öneriyordu. Kural genelleştirildi ve iki
kalıcı test vakasıyla kilitlendi; regresyon commit'e girmedi.

**Korunan ölçümler.** D1 `FIRST_SCREEN` high_risk **0** / inference_re_asked
**20**; D2 `0 / 20 / 49 / 3 / 0 / 4`, kaybolan `0`; `FULL_QUEUE` 942 kimlik
değişmedi; authority ladder 11/11; invariants `121 passed · 2 failed ·
1 known_fail`; kategori kapsaması `99 pass · 9 known_fail · 0 fail`. Talep
beyni **%92** (yalnız 108 senaryoluk corpus), Pro hattı **%22** (yalnız ölçülen
uçtan uca hat).

**Kapsam dışı bırakılanlar — gizlenmiyor.** Nihai süzgeçteki
`budget` / `engine` / `specs` / `technicalSpecs` sabit elemesi doğrulama
kontrolünden önce çalışmaya devam ediyor (corpus'ta tetiklenen kimlik **0**;
parent `d3a64c7`'te de mevcut). `hybrid.isSyncing` sırasındaki geçici
`canonicalFields = null` render ölçülmedi. AST kapıları isim eşleştirmelidir;
binding/alias çözümlemesi yoktur. Profil tanımı olmayan **50** çıkarım değeri
hâlâ hiçbir dalgada sorulmuyor. Kapasite kanaryası `NOT-MEASURED`. Matching V3
canlı fanout'a bağlı değildir; tedarikçi yetkinliği ve canlı bildirim
teslimatı ölçülmemiştir; **production deploy yoktur**.


**Kapsam dışı bırakılanlar.** `provenance_mismatch = 69` etiket ekseni bu
dilimde düzeltilmedi ve olduğundan iyi gösterilmiyor. Soru bastırma ölçümünde
gerçek `not_measured = 4` kaydı ölçülemez olarak duruyor ve D1'in `exit 3`
durumu yeşil kapanış değildir. `MoneyRangeControl` sabit `budget-amount`
kimliğini kullanmaya devam ediyor. Sekme kapanınca cevap ve taslak kalıcı
değildir. Matching V3 canlı fanout'a bağlı değildir; tedarikçi yetkinliği ve
canlı bildirim teslimatı ölçülmemiştir; production deploy yoktur.

**H7 — Onaysız çıkarım kullanıcı-cevabı YAYIN kanalına yazılmaz.**
(`83be90b`, 2026-08-27 — H4/H6'nın yayın tarafındaki tamamlayıcısı; H5'in
tersi yönü: H5 "yapılandırılmış CEVAP yayına taşınır" der, H7 "onaysız TAHMİN
taşınmaz" der.)

> Ölçülen kusur: soru sorulsa bile değer, kullanıcı hiç dokunmadan yayın
> payload'ının `fields[]` kanalına (`dynamicValues` üzerinden) yazılıyor ve
> sunucuda `fieldValues` olarak firmalara "kullanıcı böyle dedi" diye
> görünüyordu. 108 senaryoda 85 `INFERRED` kimliğin **23**'ü böyle sızıyordu;
> `83be90b` ile **23/23 kapandı, sızan 0**.
>
> Uygulama: kanal artık tek kurucudan geçer —
> `request-composer/ui-helpers.ts` → `buildPublishFieldValues`. Süzme ölçütü
> kanonik cevap otoritesi (`isInferenceOnlyAnswer`) ile kullanıcı dokunuş
> kanıtıdır; karşılaştırma kuralı sunum katmanıyla ortaktır
> (`isUnconfirmedInferredValue`) ve alan/kategori adına özel dal ya da ikinci
> bir otorite listesi yoktur. Kullanıcı dokunuş listesi (`userTouchedKeys`)
> understanding snapshot'ının `confirmedFieldKeys` girdisiyle AYNI diziden
> kurulur; bu listeye yalnız kullanıcı olay işleyicileri yazar, `INFERRED`
> değer kendiliğinden giremez.
>
> Ölçülen kanaryalar: kullanıcı önerilen değerle AYNI değeri açıkça seçerse
> değer `USER_EXPLICIT` olarak yayınlanır; alanı temizleyen/reddeden
> kullanıcıya çıkarım `payload.fields` içine geri sızmaz; `VERIFIED` ve
> `USER_EXPLICIT` kanaryalarında değer kaybı 0 (206 kimlik); `rawInput` ve
> kanonik durum mutate edilmez. Tahmin kaybolmaz: kanonik understanding'de ve
> `QuestionCandidate.inferredSuggestion` önerisinde durur; D3b'nin 35 öneri
> kimliği aynen görünüyor.
>
> Kontrol: `scripts/verify-publish-inference-authority-v1.ts` — önce mevcut
> kodda tam 23 kimlikle kırmızı, düzeltme sonrası yeşil; iki ardışık koşu
> birebir aynı; sayfa bağlantısı AST ile kanıtlı. Ortak sayfa-girdisi
> kurulumu `scripts/lib/talep-production-inputs-v1.ts` modülüne alındı; D3b
> doğrulayıcısı da aynı kurucuyu kullanır, ikinci kopya yoktur (D3b 35 duran /
> 0 düşen ile değişmedi).
>
> **Kapsam dışı — gizlenmiyor:** `discoveryProjection.attributes/constraints`
> 85 `INFERRED` değeri hâlâ otorite işareti olmadan taşır (04 belgesindeki
> provenance boşluğu açık); snapshot `attributes` içindeki
> `brandCandidate`/`brandEvidence` ad alanı D3c-b'dedir.
> *(Bu iki kapsam-dışı madde sonradan kapandı: ad alanı `111b412` / H8,
> projection otorite işareti `008a4ac` / H10. Tarihsel cümle silinmedi.)* Bu düzeltme için
> tarayıcı ölçümü yapılmadı — kanıt sınıfı `CODE-VERIFIED`; production deploy
> yoktur. Talep beyni **%92**, Pro hattı **%22** — aynı formüllü resmî
> doğrulayıcı `%23` üretmediği için yüzde değişmedi; kazanım "kullanıcı-cevabı
> yayın kanalı kapandı" olarak kaydedildi.

> **`Pro hattı %22` YERİNE GEÇTİ / SUPERSEDED (`7aa6990`, 2026-08-27).** Bu
> tabanda (ve `eb317dc` ile belgeye geçen kayıtta) güvenilir marka `15/108`
> sayılıyordu, çünkü `snapshot.attributes.brandEvidence` **anahtarının
> varlığı** güven sayılıyordu ve Talepo'nun kendi `INFERRED` çıkarımı da
> trusted oluyordu. Ölçüm tarihsel kayıt olarak korunur; **artık geçerli
> readiness otoritesi DEĞİLDİR.** Geçerli değer: güvenilir marka `7/108`,
> Pro **≈%21** — bkz. **H9**.

**H8 — Talepo'nun kendi kanıtı kullanıcı attribute'u AD ALANINDA taşınmaz;
tipli iç kanıt kanalında yaşar ve kaybolmaz.**
(`111b412`, 2026-08-27 — H7'nin ad alanı tarafındaki tamamlayıcısı. H7 bir
DEĞERİN yayın kanalına yazılmasını yasaklar; H8 bir ANAHTARIN kullanıcı beyanı
ad alanında durmasını yasaklar.)

> Ölçülen kusur: `brandCandidate` ve `brandEvidence` — Talepo'nun marka tahmin
> muhasebesi — `snapshot.attributes`, `projection.attributes`,
> `projection.constraints` ve routing envelope'un generic `attributes`
> torbasında kullanıcı özelliği gibi duruyordu. Oradan `attributeHit` puanına
> geçiyordu: `auto-11`'in "Araba" tahmini dokuz bebek arabası tedarikçisiyle,
> `auto-05` "Araç" ve `svc-06` "Uzaktan" alakasız kelime eşleşmeleriyle puan
> üretiyordu. 108 senaryoda ölçülen iç kanıt kimliği **36**'dır (20 `INFERRED`
> `brandCandidate` + 9 `INFERRED` `brandEvidence` + 7 `VERIFIED`
> `brandEvidence`); dört generic kanalın hepsinde 36 → **0**.
>
> Uygulama iki katmanlıdır. **Yazım:** snapshot'a additive ve opsiyonel tipli
> `internalEvidence` alanı eklendi; `buildUnderstandingSnapshot` anahtarı
> `attributes`tan çıkarıp tipli kanala taşıyarak tek şekli zorlar,
> `buildPublishUnderstandingSnapshot` kanonik
> `provenance` / `source` / `confidence` / `evidence` bilgisini olduğu gibi
> kopyalar, `buildDiscoveryProjectionFromState` generic torbaya yazmaz ama
> **kendi tipli kanalını yazar** — çünkü snapshot her zaman eklenmez (sunucu
> yeniden kurulumu ve `hybrid.state == null` dalı çıplak projection persist
> eder) ve "taşı, silme" sözleşmesi snapshot'ın varlığına bağlanamaz.
> `withUnderstandingSnapshot` snapshot eklendiğinde daha zengin nested kopya
> kazandığı için top-level kopyayı düşürür: persist edilen dokümanda anahtar
> **tam bir** tipli kanalda durur. **Okuma:** tek kanonik normalizer
> (`parseUnderstandingSnapshot` / `parseDiscoveryProjection`) eski şekli kabul
> eder, anahtarları generic torbalardan çıkarır ve tipli kanala ayırır; mevcut
> tipli değer legacy ile ezilmez, çift veri üretilmez, girdi mutate edilmez,
> yeni şekil aynı referansla geçer. Okuyucular alan adına özel mantık
> kopyalamaz; anahtar listesi tek otoritedir
> (`INTERNAL_EVIDENCE_ATTRIBUTE_KEYS`).
>
> **Yeni merdiven ya da paralel provenance enum'u kurulmadı**: tipli alan
> mevcut `UnderstandingProvenance` / `UnderstandingSource` tiplerinden okur.
> **Migration yoktur**: snapshot ve projection JSON kolonlarıdır, yeni Prisma
> kolonu açılmadı, **backfill yapılmadı**. Eski kayıtlar veritabanında eski
> şekliyle durur; güvenli yorumlama yalnız okuma sınırında yapılır.
> `understand-request`, `build-state`, `compose-text` ve `page.tsx`
> **değişmedi** — iç kanıt kanonik anlama kaydında (`understanding.attributes`)
> durmaya devam eder ve compose-text marka çapası oradan okur.
>
> Ölçülen kanaryalar: gerçek kullanıcı attribute'ları (`color` dahil)
> torbalarında kalır (düşen 0); `payload.fields` ve soru adayı sızıntısı 0;
> eski şekil kapıları kabul 1 / ayrılan 2 / generic torbada kalan 0 / filtre
> eşleşmesi 0 / kişisel eşleşme 0 / mutasyon 0; çıplak projection ve ondan
> kurulan envelope kaybı 36/36 → 0.
>
> Kontrol: `scripts/verify-snapshot-internal-evidence-v1.ts` — üç ayrı kırmızı
> aşamayla ölçüldü (yeni şekil 227 ihlal, legacy okuyucu kapıları 13 ihlal,
> çıplak projection 36/36 kayıp), üçü de kapandıktan sonra yeşil; iki ardışık
> koşu byte-birebir. Dondurulmuş 36 kimlikli taban
> `scripts/fixtures/snapshot-internal-evidence-v1.ts` içinde bağımsız veri
> otoritesidir. Gölge skor: 3.888 çiftte 11 çift / 3 talep değişti, tamamı
> yalnız `attributeHit` kaybı (tam −8), beklenmedik değişim 0, iki tier
> düşüşü (`auto-05/sup-auto-clio` ve `svc-06/sup-services-logo`:
> `NEAR → REVIEW`), golden 117/0 ve hiçbir beklenti değiştirilmedi.
>
> **`home-06/brandCandidate` — yüzey ayrımı.** D1 kategori/soru ölçümünde
> statü `category_unresolved → NOT_MEASURED` olarak **DEĞİŞMEDİ**; D3c-b
> serileştirme ölçümünde aynı kimlik deterministik olarak **ÖLÇÜLDÜ**. İkisi
> aynı anda doğrudur, çünkü `NOT_MEASURED` bir kimliğin değil (kimlik × ölçüm
> yüzeyi) çiftinin statüsüdür. Tarihsel D1 fixture'ı ve kaydı
> **değiştirilmedi**.
>
> **Kapsam dışı — gizlenmiyor:** generic
> `discoveryProjection.attributes/constraints` otorite işareti taşımamaya
> devam ediyor. Sayı yeniden ölçüldü, kopyalanmadı: kanonik `INFERRED` 85
> kimlikten **56**'sı generic torbada kaldı, **29**'u bu commit ile tipli
> kanala ayrıldı (kalan dağılımı `needType` 45 · `solutionType` 5 ·
> `usageArea` 4 · `condition` 2; aynı torbada 182 `USER_EXPLICIT` ve 17
> `VERIFIED` değer de işaretsiz). **D3c bir bütün olarak kapanmış değildir.**
>
> > **KISMEN YERİNE GEÇİLDİ (`008a4ac`, 2026-08-27 — bkz. H10).** Bu paragrafın
> > "otorite işareti taşımamaya devam ediyor" kısmı artık geçerli DEĞİLDİR:
> > 56 / 17 / 182 değerin tamamı `fieldAuthority` haritasında kaynağıyla durur.
> > Ölçülen dağılım DEĞİŞMEDİ. D3c yine de bütün olarak kapanmış sayılmaz:
> > istemci metadata'sı için sunucu güven sınırı ve düzenleme yolunun sunucu
> > doğrulaması AÇIKTIR. Tarihsel paragraf silinmedi.
>
> Düzenleme yolu snapshot'ı yenilemez; `clone-request-as-draft` legacy şekli
> kopyalar (okuma güvenli, şekil yaşar); legacy constraint metadata'sı
> taşınmaz. Bu düzeltme için **tarayıcı ölçümü yapılmadı** — kanıt sınıfı
> `CODE-VERIFIED`; **production deploy yoktur**; Matching V3 hâlâ `SHADOW` ve
> canlı fanout'a bağlı değildir; tedarikçi yetkinliği ve canlı bildirim
> teslimatı ölçülmemiştir. Talep beyni **%92**, Pro hattı **%22** — aynı
> formüllü resmî doğrulayıcı başka sayı üretmediği için yüzdeler oynatılmadı.

> **YUKARIDAKİ SON CÜMLE DÜZELTİLDİ (`7aa6990`, 2026-08-27).** Buradaki `Pro
> hattı %22` yeniden ölçülmemiş, önceki tabandan kopyalanmıştı. `111b412`'te
> aynı formüllü resmî doğrulayıcı gerçekte **≈%19** üretiyordu: iç kanıt tipli
> kanala taşınınca doğrulayıcı eski generic `attributes` yolunu okumaya devam
> etti ve güvenilir marka sayacını `0/108` gördü. **Ürün gerilemesi değildi**;
> ≈%19 **BAYAT ÖLÇÜM / YERİNE GEÇTİ** sayılır. Geçerli değer: güvenilir marka
> `7/108`, Pro **≈%21** — bkz. **H9** ve `KNOWN-BROKEN.md` → `7aa6990` ölçüm
> tabanı. Tarihsel cümle silinmedi.

**H9 — "Marka kanıtı MEVCUT" ile "marka yönlendirmede GÜVENİLİR" iki ayrı
metriktir; güven kararı kanonik otorite merdiveninden okunur.**
(`7aa6990`, 2026-08-27 — H8'in ÖLÇÜM tarafındaki tamamlayıcısı. H8 anahtarın
nerede durduğunu belirler; H9 o anahtarın hangi düzeyde güven ürettiğini
belirler.)

> **Kurucu kararı.** `INFERRED` marka kanıtı güvenilir sayılamaz. Yalnız
> kanonik otorite merdiveninde `VERIFIED` ya da `USER_EXPLICIT` düzeyindeki
> marka kanıtı trusted sayılır; provenance'ı bilinmeyen eski (legacy) kayıt
> `UNKNOWN`'dır ve o da trusted değildir. Eşik merdivenin kendisinden okunur
> (`isAtLeastAuthority(·, "VERIFIED")`); yeni bir rank tablosu, yeni bir
> "doğrulanmış kaynak" listesi ve ikinci bir provenance enumu KURULMAZ.
>
> **Ölçülen kusur.** `BRAND_ROUTABLE_TRUSTED`,
> `snapshot.attributes.brandEvidence` anahtarının VARLIĞINI güven sayıyordu.
> Bunun iki ayrı yanlış sonucu vardı: `eb317dc`'de Talepo'nun kendi çıkarımı da
> trusted sayılıp `15/108` (≈%22, sahte yüksek); `111b412` sonrasında ise D3c-b
> anahtarı tipli `internalEvidence` kanalına taşıdığı için ölçüm kör kalıp
> `0/108` (≈%19, sahte düşük). Üçü ayrı ölçümdür ve birbirinin yerine geçmez;
> `%22` ve `%19` kopyalanmadı, gerçek kodla yeniden ölçüldü.
>
> **Ölçülen sonuç (`7aa6990`).** Kanıt kaydı `16/108`; kovalar `UNKNOWN 0` ·
> `INFERRED 9` · `VERIFIED 7` · `USER_EXPLICIT 0`; güvenilir marka **`7/108`**
> (`auto-01` · `auto-02` · `auto-03` · `auto-04` · `auto-07` · `auto-08` ·
> `auto-10`, hepsi katalog zenginleştirmesinden `source: FUTURE_KNOWLEDGE`).
> `16 → 15` farkı `mach-07`'nin envelope'a marka çıkarmamasından, `15 → 7`
> farkı 9 kanıtın `INFERRED` olmasından gelir. Ham formül:
> `100 × ((104/108) + (7/108) + (0/108) + 0 + 0) / 5` = `20.555555555555554`,
> yuvarlanmış **≈%21**. Talep beyni **%92** (100 × 99/108).
>
> **`%21` bütün Talepo'nun hazırlık yüzdesi DEĞİLDİR** — yalnız mevcut beş
> bileşenli, ölçülen Pro hattı metriğidir.
>
> **Kapsam dışı — gizlenmiyor.** Ürün kodu, 108 senaryoluk fixture, senaryo
> beklentileri ve readiness formülü değişmedi; bu yalnız ölçüm otoritesi
> düzeltmesidir. KNOWN-OPEN: 9 kayıtta (`tech-02` · `tech-03` · `tech-10` ·
> `print-07` · `appl-04` · `appl-06` · `appl-07` · `mach-03` · `mach-07`) kanıt
> DEĞERİ `VERIFIED_CATALOG` / `USER_ASSERTED` anlamı taşırken kaydın kendi
> `source`'u `DETERMINISTIC_INFERENCE`; mevcut merdivende `INFERRED` oldukları
> için trusted sayılmadılar, **ürün kodu bu turda düzeltilmedi ve bu 9 kayıt
> güvenilir ilan edilmedi.** `REQUEST_BRAIN` ile Pro metriğinin `NOT_MEASURED`
> payda yaklaşımı farklıdır ve bu ayrı bir ölçüm-politikası kararıdır; bu turda
> değiştirilmedi. Product routing `0/108`, matching `resolvedEntities` okuması
> `0`, tedarikçi yetkinliği `0`, canlı bildirim teslimatı **ölçülmemiştir**.
> Kanıt sınıfı `CODE-VERIFIED`; **tarayıcı ölçümü yapılmadı**; **production
> deploy yoktur**. Kayıt: `KNOWN-BROKEN.md` → `7aa6990` ölçüm tabanı ve KB-17
> yedinci yüzey.

**H10 — Projection'a giren her değer KAYNAĞINI da taşır; kaynak generic
torbada kaybolamaz.**
(`008a4ac`, 2026-08-27 — H7/H8/H9'un PROJECTION tarafındaki tamamlayıcısı. H7
bir DEĞERİN yayın kanalına yazılmasını yasaklar, H8 bir ANAHTARIN kullanıcı
beyanı ad alanında durmasını yasaklar, H9 o anahtarın hangi düzeyde güven
ürettiğini belirler; H10 firmaların ve Matching V3'ün okuduğu OKUMA MODELİNDE
kaynağın kaydedilmesini zorunlu kılar.)

> **Kurucu kararı.** `discoveryProjection.attributes` ve `constraints`
> içindeki bir değerin kullanıcı beyanı mı, doğrulanmış bilgi mi, yoksa
> Talepo tahmini mi olduğu projection boyunca kaybolamaz. Kaynak, değerin
> yanında ve alan başına, kanonik merdivenin diliyle kaydedilir.
>
> **Sözleşme.** `RequestDiscoveryProjection.fieldAuthority` additive ve
> opsiyoneldir; mevcut `attributes` / `constraints` değer şekli değişmez. Her
> GERÇEK yüzey kendi otorite değerini taşır ve var olmayan yüzeye otorite
> yazılmaz. Otorite YALNIZ mevcut kanonik merdivenden gelir
> (`UNKNOWN < INFERRED < VERIFIED < USER_EXPLICIT`); yeni enum, yeni rank
> tablosu ve yeni "doğrulanmış kaynak" listesi KURULMAZ. Okuma tek yardımcıdan
> yapılır (`projectionAuthorityOf`); tüketiciler kendi varsayılanını, kendi tip
> kontrolünü ve kendi eşiğini kurmaz.
>
> **Facet başına otorite üretilmez.** Upstream (`CanonicalFieldState.provenance`)
> provenance'ı ALAN seviyesinde taşır; `strength` / `preferred` / `excluded` /
> `range` facet'lerinin kendi kaynağı yoktur. Her facet'e ayrı otorite yazmak
> var olmayan bir ayrımı uydurmak olurdu.
>
> **Değer taşımayan `ANY` kullanıcı cevabıdır.** `classifyAnswerAuthority`
> yalnız `kind === "VALUE"` alanlara bakar ve ötekilere `UNKNOWN` der; onun
> cevapladığı soru "bu değer soruyu kapatabilir mi" sorusudur. Projection'ın
> sorduğu soru başkadır: bu kaydı kim koydu. Kullanıcının gezinmeden açıkça
> seçtiği "Fark etmez" `kind: "ANY"` ve `provenance: "EXPLICIT_BROWSE"` taşır;
> bilinçli bir cevaptır ve `USER_EXPLICIT` sayılır. Değer yokken merdivenin
> AYNI modülündeki dar görünüm (`answerAuthorityOfProvenance`) okunur.
>
> **Eksik metadata güvenilir sayılmaz.** Metadata'sı olmayan veya bozuk legacy
> kayıt `UNKNOWN` okunur ve hiçbir koşulda `USER_EXPLICIT` ya da `VERIFIED`
> sayılamaz. Bozuk runtime değeri throw etmez. Otorite adının geçerliliği
> kanonik `authorityRank` tablosuna sorulur; ikinci bir string allowlist
> tutulmaz. Migration ve backfill yapılmadı; JSON şekli additive olduğu için
> eski kayıtlar okunmaya devam eder.
>
> **İç kanıt geri girmez.** `brandCandidate` / `brandEvidence` `internalEvidence`
> sınırında kalır (H8) ve generic `fieldAuthority` haritasına yazılmaz;
> doğrulayıcı bunu ayrıca ölçer.
>
> **`fieldAuthority` bir YETKİ KANITI DEĞİLDİR.** Açıklayıcı provenance
> metadata'sıdır ve istemciden gelen bir payload'da da bulunabilir. Bugün
> hiçbir skor, filtre ya da yetki kararına girmediği için zarar üretmez; fakat
> skorlamada veya yönlendirmede kullanılmadan ÖNCE sunucu tarafında yeniden
> türetilmesi ya da doğrulanması gerekir. `update-request.ts` istemci
> projection'ını parse etmeden persist eder ve `create-request.ts` istemci
> projection'ını kabul eder; bu güven sınırı kurulmadan `fieldAuthority`
> güvenilir sayılamaz. Bu bir ön koşuldur, öneri değildir.
>
> **Ölçülen sonuç.** Kimlik biçimi `senaryo/alan/yüzey`; yüzey kimliğin
> parçasıdır. 108 senaryoda **510** kimlik donduruldu ve iki yönlü
> karşılaştırıldı: `attributes` yüzeyinde `UNKNOWN 0 · INFERRED 56 ·
> VERIFIED 17 · USER_EXPLICIT 182`, `constraints` yüzeyinde aynı dağılım;
> missing 0, unexpected 0, duplicate 0, otorite uyuşmazlığı 0, çapraz yüzey
> uyuşmazlığı 0, iç kanıt sızması 0, değer payload'ı drift 0. Dağılım
> `111b412` tabanındakiyle AYNIDIR; kapanan şey sayı değil, o değerlerin artık
> kaynağını taşımasıdır.
>
> **Test-first.** Kırmızı test commit'i oluşturulmadı; kırmızı oturumda kanıt
> olarak ölçüldü ve test ile üretim düzeltmesi tek atomik commit oldu. Düzeltme
> öncesi: `fieldAuthority` 0/108, otoritesi okunamayan kimlik 510, browse-`ANY`
> `UNKNOWN`, TypeScript `projectionAuthorityOf` ve `ProjectionAuthoritySurface`
> ihraçlarını bulamıyor. Kapının canlı olduğu üç geçici mutasyonla gösterildi:
> `INFERRED → VERIFIED` 112, `VERIFIED → INFERRED` 34, `USER_EXPLICIT →
> INFERRED` 364 uyuşmazlık.
>
> **Kapsam dışı — gizlenmiyor.** Bu commit Matching V3 skorunu, filtrelemeyi,
> routing davranışını ve mevcut projection değerlerini DEĞİŞTİRMEDİ; golden
> 117/0, iç kanıt 36/36, publish-inference 85/0/0 ve 23/23/0, D3b 35/0, D2
> 0/20/49/3/0/4, coverage 99/9/0, readiness present 16 / trusted 7 / Pro
> **≈%21**, talep beyni **%92** — hepsi yeniden koşuldu ve değişmedi. KNOWN-OPEN:
> istemci metadata'sı için sunucu güven sınırı, 9 brand evidence provenance
> tutarsızlığı, düzenleme/güncelleme yolunun sunucu doğrulaması ve snapshot
> yenilemesi, forma elle yazılan `dynamicValues`ın projection'a girmemesi,
> `clone-request-as-draft`ın legacy şekli yaşatması, legacy constraint
> metadata kaybı, `NOT_MEASURED` payda politikası, Matching V3'ün `SHADOW`
> olması. Bağımsız inceleme kapısı koşulamadı: `ecc:typescript-reviewer` ve
> `ecc:security-reviewer` bu worktree'de kayıtlı ajan türleri değildir ve
> yerlerine başka bir ajan ECC diye adlandırılmadı. Kanıt sınıfı
> `CODE-VERIFIED`; **tarayıcı ölçümü yapılmadı** — bu bir serialization / tip /
> doğrulayıcı sözleşmesidir; **production deploy yoktur**. Kayıt:
> `KNOWN-BROKEN.md` → `008a4ac` ölçüm tabanı ve KB-17 sekizinci yüzey.

**H11 — Projection otoritesi istemci ETİKETİ değil, SUNUCUNUN yeniden
türettiği kayıttır; kullanıcının değer taşımayan cevabı da bu kanaldan
taşınır.**
(`83f3b3e` + `aa2f2e1`, 2026-08-27 — H10'un bıraktığı ÖN KOŞULUN kapanışı.
H10 kaynağın projection'a YAZILMASINI zorunlu kıldı ve o kaydın "istemciden
gelen bir payload'da da bulunabileceğini, skorlamada kullanılmadan önce
sunucu tarafında yeniden türetilmesi gerektiğini" açıkça bir ön koşul olarak
bıraktı. H11 o ön koşulu kapatır.)

> **Kurucu kararı.** İstemcinin gönderdiği `fieldAuthority` bir kanıt
> değildir. Kullanıcının gönderdiği DEĞER bir kullanıcı beyanı olabilir; ama
> kullanıcının gönderdiği `"VERIFIED"` ETİKETİ doğrulama kanıtı değildir. Yeni
> create ve update yazımlarında bu harita TAMAMEN yok sayılır ve otorite
> sunucunun kendi girdilerinden sıfırdan yeniden türetilir.
>
> **Sunucunun güvendiği iki girdi.** (a) Kalıcılaştırdığı `rawInput` üzerinde
> YENİDEN koşturulan üretim anlama beyni — otorite mantığı ikinci kez
> yazılmaz, projection'ı üretimde kuran fonksiyonun ta kendisi çalıştırılır.
> (b) `RequestFieldValue` olarak sakladığı, süzülmüş structured cevap kanalı
> (`fields[]`). Bu ikisinden türetilemeyen her alan `UNKNOWN`'a düşer ve ASLA
> yukarı yükseltilmez.
>
> **Seviye kaynakları.** `VERIFIED` yalnız sunucunun katalog / kanonik
> çözümünden gelir ve cevap kanalıyla EZİLMEZ: metinden `VERIFIED` türeyen bir
> değer (C200 → Mercedes-Benz) yalnız `fields[]` listesinde göründüğü için
> kullanıcı beyanına dönüşmez — "bu bilgi nereden geldi" sorusunun cevabı
> değişmemiştir. `INFERRED` yalnız sunucunun kendi çıkarımından gelir.
> `USER_EXPLICIT` yalnız açık metinden ya da geçerli structured kullanıcı
> cevabından gelir.
>
> **İstek reddedilmez.** Sahte etiket yayını engellemez, yalnız
> güvenilirliğini kaybeder. Bu bir kullanıcı hatası değil istemci artefaktı
> olabilir ve talebin kaybolması yanlış etiketten pahalıdır.
>
> **Düzenleme ekranı kanonik yayın süzgecine bağlandı.** `EditRequestForm`
> `fields[]` değerlerini ham `dynamicValues`tan okuyordu; `dynamicValues`
> kullanıcı dokunmadığı alanları anlama katmanının TAHMİNİYLE doldurur. Yani
> Talepo'nun kendi tahmini, düzenleme kaydedildiği anda kullanıcının cevabı
> olarak kalıcılaşıyordu — ve güven sınırı bu listeyi kullanıcı beyanı saydığı
> için tahmin `USER_EXPLICIT` damgası alabilirdi. Artık `/talep` yayın yolunun
> kullandığı süzgecin AYNISI kullanılır (`buildPublishFieldValues`); ikinci bir
> süzgeç yazılmadı. Bu yüzden iki değişiklik AYNI dilimde kapandı: yarısı
> eksik bir güven sınırı, kapalı görünürken Talepo'nun tahminlerine sunucunun
> imzasını atardı.
>
> **Değer taşımayan cevap kanonik `mode` ile taşınır.** Kullanıcının UI'den
> seçtiği "Fark etmez" kanonik durumda `kind:"ANY", value:null` üretir ve
> `rawInput`'a BİLEREK yazılmaz (yayın akışı kullanıcının özgün metnini
> korur — H1). Cevap kanalı yalnız `string` taşıdığı sürece bu tercih sunucuya
> ulaşamıyordu. `RequestFieldInput.mode` additive ve opsiyoneldir, kanonik
> `FieldValueKind`tir ve yeni bir enum DEĞİLDİR; tip artık `FIELD_VALUE_KINDS`
> listesinden türer, böylece sunucunun çalışma anında ihtiyaç duyduğu
> doğrulama ikinci bir "geçerli mode" listesi açmadan aynı otoriteden okunur.
> `mode` yoksa legacy `VALUE` davranışı birebir korunur; tanınmayan `mode`
> cevap kanalına hiç girmez.
>
> **Karar etikete değil moda bakar.** Yerelleştirilmiş `"Fark etmez"` metni
> sunucuda bir kanıt değildir. Değer taşımayan bir cevap YALNIZ `constraints`
> yüzeyini onaylayabilir; `attributes` yüzeyini ASLA onaylayamaz ve
> `"Fark etmez"` hiçbir koşulda bir attribute DEĞERİ olmaz. Mod ile
> projection'ın iddiası uyuşmuyorsa fail-closed `UNKNOWN` kalır.
>
> **`rawInput` değişmez.** Cevaplar yalnız kanonik duruma uygulanır
> (`applyPublishAnswersToState`, üretimin kendi `syncFromBrowse` yolundan;
> kategoriye ya da alana özel dal yok). Metne hiçbir sentetik ifade yazılmaz.
> Bunun yan etkisi olarak düzenleme projection'ı artık `mode:"ANY"`
> constraint'in KENDİSİNİ de kaybetmiyor — bu kayıp `83f3b3e` öncesinden beri
> vardı.
>
> **Clone yeni kullanıcı beyanı üretmez.** Kaynak kaydın `fieldAuthority`'si
> güvenilir sayılmaz (kaynak bu sınırdan önce yazılmış olabilir ve klonlamak
> onu aklamaz); otorite kaynağın kendi `rawInput`'undan yeniden türetilir ve
> cevap kanalı BİLİNÇLİ olarak verilmez. Kopyalanan `fieldValues` eski talebin
> cevaplarıdır; onları yeni taslağın cevap kanalı saymak, kullanıcının bu
> taslak için hiç vermediği bir beyanı üretmek olurdu.
>
> **İç kanıt ve nesne modeli anahtarları elenir.** `brandCandidate` /
> `brandEvidence` (H8) generic otorite haritasına giremez; `__proto__` /
> `constructor` / `prototype` bir alan adı değil JavaScript nesne modelinin
> anahtarıdır. İkisi de hem YAZMA hem OKUMA sınırında elenir ve eleme tek
> yerde tanımlıdır — okuma sınırı bu kuralı sınırdan ÖNCE yazılmış kayıtlara da
> uygular.
>
> **Ölçülen sonuç.** `83f3b3e` tabanı 78 kimlik taşıyordu. `aa2f2e1` structured
> cevap modu sözleşmesini eklerken 5 yeni senaryo × 9 kimlik = 45 kimlik
> ekledi; bugün geçerli taban **123 kimlik**: `UNKNOWN 9 · INFERRED 28 ·
> VERIFIED 18 · USER_EXPLICIT 68`, missing 0, unexpected 0, mismatch 0, edit
> kanalı drift 0, edit uçtan uca drift 0. **78 → 123 artışı bir regresyon ya da
> otorite değişimi DEĞİLDİR; ölçüm kapsamının genişlemesidir** — hiçbir mevcut
> kimliğin seviyesi değişmedi. 78 sayısı `83f3b3e`'nin tarihsel tabanı olarak
> korunuyor.
>
> **Test-first.** Kırmızı test commit'i oluşturulmadı; kırmızı oturumda üretim
> davranışı geçici olarak düzeltme öncesine çevrilerek ölçüldü ve test ile
> üretim düzeltmesi tek atomik commit oldu. `83f3b3e` kırmızısı: 63 ihlal, 47
> otorite uyuşmazlığı. `aa2f2e1` kırmızısı: 7 ihlal,
> `S22/brand/constraints` kimliği tamamen kayboldu.
>
> **Kapsam dışı — gizlenmiyor.** Bu iki commit Matching V3 skorunu,
> filtrelemeyi, routing davranışını ve mevcut projection değerlerini
> DEĞİŞTİRMEDİ; projection authority 510/510 ve 56/17/182, payload drift 0,
> golden 117/0, iç kanıt 36/36, publish-inference 85/0/0 ve 23/23/0, D3b 35/0,
> **D2 kabul testi** (`verify-inference-question-authority-v2`) 0/20/49/3/0/4
> kaybolan 0 exit 0, coverage 99/9/0, readiness present 16 / trusted 7 / Pro
> ≈%21, talep beyni ≈%92 — hepsi yeniden koşuldu ve değişmedi. TypeScript
> gerçek worktree üzerinde `tsc --noEmit` exit 0. **D1 taban ölçümü**
> (`verify-question-suppression-authority-v1`) `not_measured = 8`, `exit 3` —
> PASS DEĞİLDİR ve AÇIK. KNOWN-OPEN: explicit `UNKNOWN` otoritesi kapatılmadı
> (kanonik modelde `UNKNOWN` cevaplanmamış her alanın varsayılanıdır — 108
> senaryoda 988 alan — bu yüzden "bilmiyorum dedi" ile "hiç sorulmadı"
> ayrılamıyor), `NOT_APPLICABLE` için projection yüzeyi yok,
> `applyBrowseSelectionToState` içindeki `__NOT_APPLICABLE__` sentineli
> `VALUE`ya dönüyor (ayrı kusur), `"Fark etmez"` etiketi `RequestFieldValue`
> içinde display değeri gibi persist ediliyor, legacy kayıtlar backfill'siz ve
> eski iyi-biçimli sahte otorite metadata'sı veritabanında kalabilir, üretimde
> `fieldAuthority` tüketicisi yok ve Matching V3 `SHADOW`, snapshot yenilemesi
> ve `provenance_mismatch = 69` etiket ekseni AÇIK. Bağımsız inceleme kapısı
> koşulamadı: `ecc:typescript-reviewer` ve `ecc:security-reviewer` bu
> worktree'de kayıtlı ajan türleri değildir ve yerlerine başka bir ajan ECC
> diye adlandırılmadı. Kanıt sınıfı `CODE-VERIFIED`; **tarayıcı ölçümü
> yapılmadı** — bu bir sunucu sınırı / tip / doğrulayıcı sözleşmesidir;
> **production deploy yoktur**. Kayıt: `KNOWN-BROKEN.md` → `83f3b3e` +
> `aa2f2e1` ölçüm tabanı ve KB-17 dokuzuncu yüzey.

**Bunu ne için yapıyoruz?**
Talepo'nun kendi yazdığı ya da tahmin ettiği hiçbir şey kullanıcının beyanı
sayılmasın; kullanıcı görmediği bir değerin belirlediği havuza gitmesin. Ve
ölçüm bunu doğru raporlasın: "markayı gördük" ile "bu markaya güvenip
firmaları yönlendirebiliriz" yönetim ekranında da, yatırım kararında da
birbirine karışmasın.

## 2026-08-26 — Üyelik dönüşünde yayın niyeti sözleşmesi

### Karar I — Üyelik dönüşü yayın niyeti `canReview` önkoşuluyla düşürülemez

| | |
|--|--|
| **Durum** | **UYGULANMIŞ** — `afc23a3` + `3279dc7` + `e02179c`, `BRANCH-WIRED` · `CODE-VERIFIED` · `BROWSER-MEASURED-LOCAL · PASS` (2026-08-26, ölçülen HEAD `e02179c`, mobil 375×812; önceki ölçüm aynı gün `3a90eb4`). **`PRODUCTION-DEPLOYED` DEĞİL** |
| **Dosyalar** | `request-composer/resume-publish.ts` (yeni), `talep/page.tsx`, `components/request/TalepoAiPanel.tsx`, `scripts/verify-publish-resume-v1.ts` (yeni) |
| **Testler** | `verify-publish-resume-v1` — `afc23a3`'te 15 passed (9 saf davranış + 6 production wiring AST iddiası); `3279dc7` ile 34 bağımsız üretim wiring iddiası; `e02179c` ile **42 passed, exit 0** |
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

**I4 — Kapsam kapısı ve tek yayınlama hata otoritesi bu sözleşmenin
parçasıdır (dayanak `3279dc7`, 2026-08-26).** Niyet korunurken iki koruma
birlikte gerekir. Karar kanonik `RequestScope` otoritesini **girdi** alır:
`UNSUPPORTED_SUPPLY` bir `blocked` sonucu üretir, latch söner ve yayın denemesi
hiç başlamaz — kapsam dışı istek istemciden sunucuya bilerek gönderilmez,
sunucudaki kapı bağımsız ikinci savunma olarak durur. Ayrıca her yayınlama
hatası tek görünür otoriteden (`surfacePublishFailure`) geçer, `role="alert"`
taşıyan görünür bir yüzeye yazılır ve tekrar denemesi kanonik
`handlePublishAttempt` kapısından döner; doğrudan `requestPublish` çağrısıyla
kapsam ve eksik alan kapılarını atlayan yol kaldırılmıştır.

**I5 — Rehberliğin üretilmiş olması yetmez; görünmesi gerekir (dayanak
`e02179c`, 2026-08-26).** Mobilde companion iki kapının arkasındadır: onu
taşıyan dış `<details>` ve `aiCompanionOpen` ile yönetilen iç panel. Eksik alan
ya da gerçek `publishError` varken iki kapı da **aynı türetilmiş** kararı
(`publishSignalDemandsAttention`) kullanır. Zorlama kalıcı mandala dönmez:
sinyal, rehberliğin kendi render koşuluyla (`attempted && missingLabels > 0`)
eşleşir, eksik alan doldurulunca kendiliğinden kalkar ve kullanıcının kendi
tercihi korunur. **`outOfScopeNotice` bu hesaba bilinçli olarak dahil
değildir**; bildirim `<details>` ağacının dışında, ana composer kartında
çizilir ve her iki kapıdan bağımsız olarak zaten görünürdür.

> **Mobil tarayıcı kabulü — 2026-08-26, `e02179c`, 375×812,
> `BROWSER-MEASURED-LOCAL · PASS`.** Yerel integration çalışma kopyasında dört
> senaryo ölçüldü. **A — eksik alanlı üyelik dönüşü:** `rawInput` değişmedi,
> rehberlik `innerText` içinde ve görünür, dış `details` açık, iç companion
> görünür, latch bir kez tüketildi, ikinci yenilemede tekrar açılmadı.
> **B — kapsam dışı arz ilanı:** `UNSUPPORTED_SUPPLY`, publish/create çağrısı
> yok, kapsam dışı bildirim `details` dışında zaten görünür, companion
> gereksiz yere zorla açılmadı. **C — kontrollü 500:** `POST /api/requests`
> tarayıcıda kesilerek 500 döndürüldü (gerçek backend'e ve veritabanına
> ulaşmadı), mobilde tek görünür `role="alert"`, çift hata kopyası yok,
> otomatik retry yok, manuel retry kanonik `handlePublishAttempt` yoluna
> döndü. **D — negatif kontrol:** companion zorla açılmadı; rehberlik, latch ve
> publish isteği oluşmadı. Konsolda uygulama/hydration hatası 0.
>
> **Üretilmeyen iddia.** "Kapsam dışı bildirim mobilde görünmüyordu ve
> `e02179c` ile düzeldi" **denmemektedir**; bu, önceki ölçümün yanlış
> pozitifiydi ve bildirim zaten `<details>` dışında görünürdü. `e02179c` yalnız
> gerçek eksik-alan ve `publishError` sinyallerinin mobil görünürlüğünü
> düzeltir. Tarayıcı sekmesi arka plandayken `talepo-rise` animasyonunun
> `opacity: 0`'da durması bir ölçüm ortamı etkisidir; ürün hatası ya da
> `e02179c` kazanımı olarak yazılamaz.
>
> **Önceki kanıtla ilişki.** Yukarıdaki `3a90eb4` ölçümü silinmedi. Yeni ölçüm
> onu **genişletir** (aynı A senaryosu mobil 375×812'de tekrarlandı; B, C ve D
> eklendi) ve yalnız tek bir noktada **yerine geçer**: `3a90eb4`'ün "rehberlik
> açıldı" satırı bir mobil görünürlük iddiası olarak okunamaz — o tarihte
> rehberlik DOM'da üretiliyor ama iki kapının arkasında kalabiliyordu.
> `afc23a3` dayanaklı `BRANCH-WIRED` / `CODE-VERIFIED` iddiaları ve negatif
> kontrolün ayrıştırması aynen geçerlidir.
>
> **Sınır.** Ölçüm yerel bir çalışma kopyasındadır: `PRODUCTION-DEPLOYED`
> değildir. Gerçek kimlik sağlayıcısıyla canlı uçtan uca üyelik akışı ve
> production başarısı ölçülmüş sayılmaz; C'deki 500 tarayıcıda kesilerek
> üretilmiştir. Bkz. **KB-21**.
