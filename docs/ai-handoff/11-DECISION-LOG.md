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
| Unresolved/zero-match sessiz kaybolamaz | **V3 shadow evet**; **legacy fanout hayır** (erken return) | shadow-match vs distribute | matching-v3; fanout gap | Sözleşme ihlali |
| Relevance ≠ ücretli plan | **V3 evet**; branch fanout’ta plan çoğunlukla **gecikmeli erişim kopyası** — eşleşen firma setini değiştirmez | delivery-policy contract, distribute-request | matching-v3 | Pro skoru şişer |
| Canlıya / fanout cutover shadow+ölçüm sonrası | **Ürün kararı**; kodda `not_wired` | shadow-match report field | matching-v3 | Erken cutover |
| Branch’te görmek = production | **Yanlış.** Deploy: `PRODUCTION-STATUS-NOT-VERIFIED` | — | — | Yanlış güven |
| Understanding snapshot update yolunda yeniden kurulmaz | **Kod gerçeği** [`CODE-VERIFIED`] — bilinçli karar değil, **boşluk**. `update-request.ts`’te `understanding` → 0 hit | `update-request.ts:162-163` | — | Audit kaydı yanlış metni anlatır |
| Türetilmiş projection AI metninden kurulabilir | **Kod gerçeği** [`CODE-VERIFIED`] — provenance kaydı yok | `create-request.ts:46-50` | — | AI yorumu izlenemeden türetilmiş gerçeğe girer |
| İkinci (“Silent backfill”) RequestMatch yazıcısı vardır | **Kod gerçeği** [`CODE-VERIFIED`] — belgelenmemişti, 2026-08-22’de eklendi | `distribute-request.ts:289+`, `take: 100` | — | Ölçüm ve dedupe tasarımı yanlış kurulur |

---

## 2026-08-22 — Ürün kararları (devralma denetimi sonrası)

### Karar A — Sonraki uygulama dilimi: **Dilim 2a**

| | |
|--|--|
| **Durum** | **ONAYLANDI** — `PROPOSED` değil |
| **Karar** | Sonraki dilim **Dilim 2a — Legacy fanout gözlemlenebilirliği**’dir. Matching V3 **henüz canlı fanout’a bağlanmayacaktır**. Dilim 2a’da bildirim davranışı, eşleşen firmalar, query limitleri, return değerleri ve `RequestMatch` yazımları **değişmeyecektir**. Önce legacy zero-match, kategori-skip, cap, city-only fallback ve ikinci/backfill yazıcı yolları ölçülebilir hâle getirilecektir. |
| **Gizlilik ilkesi (zorunlu)** | `rawInput`, `professionalDescription`, iletişim bilgisi veya başka serbest metin **loglanmayacaktır**. Yalnız PII içermeyen yapısal olaylar ve sayımlar kullanılacaktır. |
| **Sonrası** | Dilim 2b (shadow wiring + persist + compare) yalnız **gerçek legacy taban ölçümü oluştuğunda** ele alınacaktır. |
| **Dosyalar** | `09-NEXT-PHASE-RECOMMENDATION.md` (2a/2b ayrımı) |
| **Uygulama durumu** | **Plan onaylandı; kod YAZILMADI.** Bu belge yazıldığı anda `distribute-request.ts` üzerinde tek satır değişiklik yoktur (`git diff HEAD` boş). Onaylanmış planı uygulanmış sanma. |
| **Değişirse risk** | Ölçüm tabanı olmadan cutover → “yeni motor daha iyi” iddiası kanıtlanamaz; Pro’ya yanlış güven |

### Karar C — Konum telemetrisi sözleşmesi (Dilim 2a)

| | |
|--|--|
| **Durum** | **ONAYLANDI** — Dilim 2a kapsamında uygulanacak; şu an kod yok |
| **Gerekçe** | Tedarikçi boşluğu **il bazında** ölçülemezse “hangi ilde Pro yok?” sorusu cevapsız kalır. Ama ham konum metni serbest kullanıcı girdisidir ve PII taşır. |
| **Sözleşme** | `locationScope`: `province` \| `nationwide` \| `remote` \| `unspecified` · `provinceCode`: yalnız sabit, allowlist edilmiş TR il kodu (`TR-34` gibi) · `resolutionStatus`: `resolved` \| `unknown` |
| **Yasaklar** | Ham şehir/ilçe/mahalle/adres ve diğer serbest metin loglanamaz · güvenilir canonical dönüşüm yoksa `provinceCode` **yazılmaz** (`unspecified` / `unknown` kullanılır) · `provinceCode` serbest metinden türetilemez, yalnız allowlist üyesi olabilir · **ilçe seviyesi ölçüm bu dilimde yok** |
| **Zorlama** | PII verifier bu sözleşmeyi ayrıca doğrular: allowlist üyeliği, `locationScope` ↔ `provinceCode` tutarlılığı, ilçe alanının hiç bulunmaması |
| **Dikkat** | `distribute-request.ts` `matchReason` alanı ham şehir adı içerir (`` `Şehir (${company.city})` ``) — asla loglanmaz |
| **Değişirse risk** | Yeniden kimliklendirme / gereksiz PII saklama; ya da tersi: il bazında ölçüm yapılamaması |

### Karar D — Deploy ≠ ölçüm; sink doğrulama kapısı

| | |
|--|--|
| **Durum** | **ONAYLANDI** — Dilim 2a’nın tamamlanma tanımının parçası |
| **Karar** | Logların hangi production sink’e ulaştığı doğrulanmadıysa durum açıkça **`PRODUCTION-SINK-NOT-VERIFIED`** işaretlenir. Dilim 2a’nın başarılı sayılması için deploy sonrasında olayların **merkezî log sisteminde sorgulanabildiği ayrıca doğrulanmalıdır**. Yalnız uygulama konsoluna yazılan fakat sonradan sorgulanamayan loglar ölçüm altyapısı tamamlanmış **sayılmaz**. |
| **Bugünkü durum** | Bu handoff’ta hiçbir production sink doğrulanmamıştır → **`PRODUCTION-SINK-NOT-VERIFIED`** |
| **Sonuç** | Bu kapı geçilmeden Dilim 2b **başlatılmaz** (önkoşulu olan legacy taban ölçümü oluşmamış olur) |
| **Değişirse risk** | “Telemetri eklendi” denip hiçbir sayının sorgulanamaması — ölçüldüğü sanılan ama ölçülmeyen sistem; bu, `01A` §10’daki “rapor gerçek davranışı yansıtmalı” ilkesinin ihlali |

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
| B7 | Bildirimler **revizyon × firma** bazında idempotent/dedupe olur | ❌ `notification.createMany` dedupe’suz (`:269`) |

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
