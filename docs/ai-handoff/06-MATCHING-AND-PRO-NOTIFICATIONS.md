# 06 — Matching and Pro Notifications

> Legacy fanout = **`BRANCH-WIRED`**. Matching V3 = **`SHADOW` + `TEST-ONLY`**. Delivery policy V3 = contract only.  
> Production deploy: **`PRODUCTION-STATUS-NOT-VERIFIED`**.

## Üç katman ayrımı (koru)

1. **Relevance Engine** — kim ne kadar uygun? (V3 shadow; plan bağımsız)
2. **Delivery / Entitlement Policy** — Pro vs Standard ne zaman/nasıl haberdar? (V3 contract-only; branch fanout’ta `getPlanDefinition` / `visibleToSuppliersAt` kopya/gecikme dünyası)
3. **Notification Delivery** — kuyruk, retry, dedupe, delivery log (V3’de tip contract; branch’te klasik `Notification` create)

Ücretli planı relevance skoruna karıştırma. [`PRODUCT-INTENT` + V3 `CODE-VERIFIED`]

---

## A) Legacy fanout (`BRANCH-WIRED`)

**Dosya:** `apps/web/src/server/request/distribute-request.ts`  
**Çağrı:** `apps/web/src/server/request/create-request.ts` publish yolunda `await distributeRequestToCompanies`. [`CODE-VERIFIED`]

### Candidate nasıl bulunur?

1. ACTIVE companies with `categories.some.categoryId = request.category.id` (`take: 200`, `:161`), creator companies excluded
2. If request.city set: city scan (`take: 300`, `:193`), city-only eklemeler max **40** (`:230`), skor 50
3. Category+city skor 100; category-only 80
4. `unresolved` system slug → **category fanout skip** (`isSystemCategorySlug`, `:128`)

Bu aday bulma mantığı Dilim 2a’da **değişmedi** — yalnız ölçülür hâle geldi.

### ⚠️ Bu dosyada üç ayrı DB yolu vardır (2026-08-22 denetim eklemesi)

Önceki sürüm yalnız ana fanout’u anlatıyordu. `distribute-request.ts` içinde **üç** yol var ve ikisi belgelenmemişti:

| # | Fonksiyon | Cap | RequestMatch yazar mı? | Bildirim gönderir mi? | Telemetri span’i (Dilim 2a) | Kanıt |
|---|---|---|---|---|---|---|
| 1 | Ana fanout `distributeRequestToCompanies` (`:76+`) | `200` / `300` / `40` | ✅ `:273` `createMany` + `skipDuplicates` | ✅ `:375` | `request.fanout.*` (11 olay) | `CODE-VERIFIED` |
| 2 | **`backfillMatchesForCompany`** (`:431+`) — dosya yorumu: *“**Silent backfill:** score open requests against one company and create missing…”* | **`take: 100`** (`:522`) | ✅ `:577` `createMany` + `skipDuplicates` | ❌ (bu yolda bildirim yok) | `request.backfill.{started,completed,failed}` | `CODE-VERIFIED` |
| 3 | Estimator (tahminleyici) (`:612+`) | **`take: 400`** (`:680`) | ❌ | ❌ | `request.fanout.estimated` | `CODE-VERIFIED` |

**Neden önemli:** “Kaç firma tarandı / kaç eşleşme yazıldı?” sorusunun cevabı 200/300/40 değildir. `RequestMatch` tablosuna **iki farklı yazıcı** vardır ve ikincisinin adı literal olarak *silent*’tır.

**Durum (2026-08-22, `466436b`):** Üç yolun da artık **ayrı span’i** vardır — Dilim 2a’nın gereği karşılandı. Ad hâlâ “silent backfill”dir ama davranışı değildir. Yine de bu **ölçülebilirlik**tir, **ölçüm** değil: sink doğrulanmadan hiçbir sayı sorgulanamaz.

### Marka / model / taxonomy / semantic

Legacy distribute path’te brand/model/taxonomy semantic skor **yok** (category name string reason). [`CODE-VERIFIED`]

### Bildirim

- `RequestMatch` createMany (score + matchReason, `skipDuplicates`)
- Member OWNER/ADMIN/MANAGER → `NEW_REQUEST_MATCH` (`notification.createMany`; notification tarafında skipDuplicates yok)
- **Plan / entitlement etkisi (branch kodu):** `getPlanDefinition(planTier).instantRequestAccess` + `visibleToSuppliersAt` çoğunlukla **kopya/gecikmeli erişim mesajı** için; **kimlerin eşleştiğini değiştirmez**. [`CODE-VERIFIED` — `distribute-request.ts`]

### Alert / SavedSearch / Inventory

- `void deliverAlertRuleNotifications(request.id).catch(...)` — `apps/web/src/server/monetization/alert-notifications.ts`
- `void runAutomaticOpportunityHunter(request.id).catch(...)` — `apps/web/src/server/monetization/opportunity-hunter.ts`
- Fire-and-forget; hata yutulur

### Queue / retry / delivery log

Klasik Notification modeli var; V3 tarzı `NotificationDeliveryRecordContract` branch fanout’a **wired değil**. Robust queue/retry `NOT-VERIFIED` / kısmi eksik varsayımı risk listesinde.

### Pro kaçırma yolları (koddan)

- Yanlış/eksik `categoryId` → category set’e girmeme
- Cap 200/300/40 (+ backfill `100`) → uygun firma tarama dışı — **artık ölçülebilir** (`cap` / `found` / `capSaturated`)
- Unresolved soft category → category fanout yok; city-only’ye düşebilir veya zero — **artık `category_skipped` olayı üretir**
- Zero match → `{0,0}` return; **ops queue hâlâ yok** ama artık sessiz değil (`zero_match` olayı + neden + il). Kaybın *kendisi* duruyor; görünmezliği bitti
- Brand/model uzmanı kategori dışında kalırsa kaçırma
- Talep düzenlenirse re-fanout yok (`update-request.ts`’te `distribute` → 0 hit) → eski eşleşme kümesinde kalır

### ✅ Zero-match artık kayıt bırakıyor (Dilim 2a, `466436b`)

**Önceki durum (tarihsel):** `distribute-request.ts` dosyasının tamamında tek bir log çağrısı yoktu; zero-match logsuz/metriksiz erken dönüştü. “Kaç talep sıfır tedarikçiye gitti ve neden?” sorusunun cevabı hiçbir yerde kayıtlı değildi.

**Bugün:**

```
:252    const matches = [...scored.values()].sort((a, b) => b.score - a.score);
:253    if (matches.length === 0) {
:254      logFanoutZeroMatch({ … reason, categoryLinkedCount, cityCandidateCount, hasCityInput, durationMs, location });
:267      return { matchedCompanyCount: 0, notifiedUserCount: 0 };
:268    }
```

`reason` dört değerli kapalı bir enum’dur (`deriveZeroMatchReason`): sistem kategorisi mi engelledi, şehir girdisi var mıydı, kategori bacağı neden boştu. `:107`’deki önkoşul erken dönüşü de `request.fanout.precondition_skipped` üretir. [`CODE-VERIFIED`]

**Canonical sözleşme — 14 olay:**

| Olay | Ne ölçer |
|---|---|
| `request.fanout.started` | Tüm fanout oranlarının **paydası** |
| `request.fanout.precondition_skipped` | Dağıtılamayan talep |
| `request.fanout.category_skipped` | `unresolved` kategori skip oranı |
| `request.fanout.category_scan` | Kategori aday hacmi + 200 cap doygunluğu |
| `request.fanout.city_scan` | Şehir aday hacmi + 300 cap doygunluğu |
| `request.fanout.city_only_fallback` | Fallback kullanımı + 40 cap doygunluğu |
| `request.fanout.zero_match` | **Sessiz zero-match oranı + nedeni + ili** |
| `request.fanout.notifications_written` | Bildirim yazımı, dedupe filtresi hacmi |
| `request.fanout.completed` | Başarılı fanout, süre, il |
| `request.fanout.failed` | Beklenmeyen hata (terminal) |
| `request.backfill.started` / `.completed` / `.failed` | İkinci yazıcının gerçek hacmi |
| `request.fanout.estimated` | AI panel tahmini + 400 cap doygunluğu |

**Gizlilik ve dayanıklılık garantileri** [`CODE-VERIFIED` + `TEST-VERIFIED`]:

- `matchReason` ham şehir adı taşır (`` `Şehir (${company.city})` ``) — **hiçbir olayda loglanmaz**. `title`, `description`, `rawInput`, firma adı, iletişim bilgisi de aynı şekilde
- Konum yalnız `locationScope` + allowlist `provinceCode` (`TR-NN`) + `resolutionStatus`. Güvenilir kanonik dönüşüm yoksa kod **yazılmaz**, `unknown` yazılır. İlçe hiç türetilmez
- İl adları `TURKEY_IL_NAMES`’ten türetilir — ikinci bir liste tutulmaz; drift verifier ile iki yönlü kilitlidir
- **Fail-open:** her emit `try/catch` içinde, konum türetme dahil. Log sistemi bozulsa da talep yayınlama etkilenmez
- **Hata yutulmaz:** failure olayı üretilir, ardından **aynı hata nesnesi yeniden fırlatılır**. `create-request.ts:335` bu hatayı bugüne kadar olduğu gibi yakalamaya devam eder
- **Aktör kimliği yok:** `userId` / aktör `companyId` / transport `requestId` correlation mirası alınmaz

### 🔴 Ama bu ölçüm değil — henüz

Olaylar **yalnız stdout’a** gidiyor: `addLogSink`’in `src/` altında tek bir çağrısı yok, `instrumentation.ts` sink kaydetmiyor. Durum **`PRODUCTION-SINK-NOT-VERIFIED`**.

“Kod tamamlandı” doğrudur. **“Ölçüm çalışıyor” veya “merkezî olarak sorgulanabiliyor” yanlıştır.** Dilim 2b’nin önkoşulu olan canlı taban ölçümü henüz **oluşmamıştır** (bkz. `09` sink kapısı, `11` Karar D).

### Çift bildirim riski

- `skipAlreadyNotifiedUsers` opsiyonu var (reminder path)
- Alert/hunter + primary fanout paralel → potansiyel çoklu kanal gürültüsü (`CODE-VERIFIED` çağrı yapısı; production ölçüm `NOT-VERIFIED`)
- **Asimetri (`CODE-VERIFIED`, Dilim 2a’da değişmedi):** `requestMatch.createMany` → `skipDuplicates: true` (`:273`, `:577`); ama `notification.createMany({ data: notifications })` (`:375`) → **`skipDuplicates` yok**. Yani eşleşme satırları dedupe edilirken bildirimler edilmiyor. Artık `request.fanout.notifications_written` olayı `memberCount` / `recipientCount` / `notificationCount` / `dedupeFiltered` alanlarıyla bu asimetrinin hacmini **ölçülebilir** kılıyor — ama düzeltmiyor.
- Ürün kararı (2026-08-22): bildirimler **revizyon × firma** bazında idempotent/dedupe olmalıdır → `DECIDED-NOT-IMPLEMENTED` (bkz. `11`)

---

## B) Matching V3 shadow

**Kök:** `apps/web/src/lib/matching-v3/`  
**Verifier:** `apps/web/scripts/verify-matching-v3-shadow.ts`  
**Version:** `matching-v3/shadow/0.1.0`  
**Wire:** `distribute-request.ts` içinde import **yok**. [`CODE-VERIFIED`]  
**Durum:** `SHADOW` + `TEST-ONLY`

### Envelope

`RequestRoutingEnvelope`: rawInput, professionalDescription, categoryResolution (dbId/slug/taxonomy ayrı), product/brand/family/series/model/variant, attributes, location, budget, timing, confidence, evidence, versions.

### Supplier profile

products/brands/models/families, `brandModelPairs`, coverage `unknown|partial|exhaustive` (default unknown; auto-exhaustive yok), inventory/alert/savedSearch signals, excluded.*, budgetCapability / availabilityCapability.

### Kanallar (10)

primary_category, candidate_categories, taxonomy_leaf, taxonomy_ancestor, product_entity, brand_model_family, alias_keyword, inventory, alert_saved_search, lexical_semantic.

### Scoring + tiers

- Components: category_*, taxonomy_leaf, product, brand, family_model, attribute, inventory, explicit_follow, location, budget, timing, lexical, negative_conflict
- Budget/timing points yalnız supplier capability bayrakları varken
- `tierFromScore` = scoreBand only
- `deriveEffectiveTier` evidence gates (category-only max NEAR, cartesian max NEAR, EXACT kimlik+corroboration, …)

### Missing / excluded truth table

| Durum | Sonuç |
|--------|--------|
| Partial/unknown list miss | Aday kalır; max NEAR/REVIEW; evidence reason |
| Explicit excluded.* | NO_MATCH |
| Exhaustive coverage conflict (verified pair yok) | NO_MATCH |
| Verified pair başka markada aynı model | NO_MATCH |
| brands[]×models[] cartesian | Recall olabilir; EXACT değil |

### Brand/model doğrulama

Yüksek güven: aynı inventory satırı **veya** `brandModelPairs`.  

### Zero-match review

Aday yoksa `zeroMatch` + `reviewRequired` / replayRecommended; sessiz kayıp yok (shadow report). Branch fanout’ta eşdeğer ops queue yok.

### Golden corpus

89 scenarios (adversarial 31); structured expectations; self-fulfilling mustKeepSignal kaldırıldı. [`TEST-VERIFIED` 117 PASS]

### Legacy comparison

`compareSyntheticLegacyAndShadow` — synthetic; `productionShadowComparison: "not_wired"`.

### Delivery policy

`apps/web/src/lib/matching-v3/contracts/delivery-policy.ts` — proposed urgency by tier; dosya yorumu: henüz runtime bildirim sürmemeli (contract only).

---

**Bunu ne için yapıyoruz?**  
Bugün Pro’ya giden branch yolunun “kategori+şehir yaklaşık eşleştirme” olduğunu ve yeni akıllı motorun henüz fanout fişine takılmadığını açıkça ayırıyoruz; “matcher yazıldı = production’da Pro güvende” yanılgısı oluşmaz.
