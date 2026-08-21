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

1. ACTIVE companies with `categories.some.categoryId = request.category.id` (`take: 200`, `:100`), creator companies excluded
2. If request.city set: city scan (`take: 300`, `:123`), city-only eklemeler max **40** (`:151`), skor 50 (`:156`)
3. Category+city skor 100; category-only 80 (`:141`)
4. `unresolved` system slug → **category fanout skip** (`isSystemCategorySlug`, `:81`)

### ⚠️ Bu dosyada üç ayrı DB yolu vardır (2026-08-22 denetim eklemesi)

Önceki sürüm yalnız ana fanout’u anlatıyordu. `distribute-request.ts` içinde **üç** yol var ve ikisi belgelenmemişti:

| # | Fonksiyon | Cap | RequestMatch yazar mı? | Bildirim gönderir mi? | Kanıt |
|---|---|---|---|---|---|
| 1 | Ana fanout `distributeRequestToCompanies` | `200` / `300` / `40` | ✅ `:170` `createMany` + `skipDuplicates` | ✅ `:269` | `CODE-VERIFIED` |
| 2 | **`backfillMatchesForCompany`** — dosya yorumu: *“**Silent backfill:** score open requests against one company and create missing…”* | **`take: 100`** (`:349`) | ✅ `:389` `createMany` + `skipDuplicates` | ❌ (bu yolda bildirim yok) | `CODE-VERIFIED` — `:289+` |
| 3 | Estimator (tahminleyici) | **`take: 400`** (`:442`) | ❌ | ❌ | `CODE-VERIFIED` — `:418+` |

**Neden önemli:** “Kaç firma tarandı / kaç eşleşme yazıldı?” sorusunun cevabı 200/300/40 değildir. `RequestMatch` tablosuna **iki farklı yazıcı** vardır ve ikincisinin adı literal olarak *silent*’tır. Zero-match ölçümü, dedupe tasarımı ve ileride shadow karşılaştırması bu yolu hesaba katmazsa sayılar yanlış çıkar. Dilim 2a bu üç yolu da ayrı ayrı etiketlemelidir.

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
- Cap 200/300/40 (+ backfill `100`) → uygun firma tarama dışı
- Unresolved soft category → category fanout yok; city-only’ye düşebilir veya zero
- Zero match → `{0,0}` return; ops queue yok → **sessiz zero-match**
- Brand/model uzmanı kategori dışında kalırsa kaçırma
- Talep düzenlenirse re-fanout yok (`update-request.ts`’te `distribute` → 0 hit) → eski eşleşme kümesinde kalır

### 🔴 Zero-match: logsuz / metriksiz erken dönüş

```
:163  const matches = [...scored.values()].sort((a, b) => b.score - a.score);
:164  if (matches.length === 0) {
:165    return { matchedCompanyCount: 0, notifiedUserCount: 0 };
:166  }
```

Bu bloğun öncesinde ve sonrasında hiçbir log / metrik / kuyruk çağrısı yoktur. Dahası: **`distribute-request.ts` dosyasının tamamında tek bir log çağrısı yoktur** — `log.` / `logger` / logger import’u araması **0 hit** verir. Karşılaştırma için `create-request.ts` aynı subsystem logger’ını kullanır (`:17` `import { createSubsystemLogger } from "@/lib/observability/logger"`, `:37` `const log = createSubsystemLogger("request")`). [`CODE-VERIFIED`]

Yani legacy fanout, Talepo’nun **en kritik güven yolu** olmasına rağmen gözlemlenebilirlik açısından tamamen karanlıktır — yalnız zero-match değil, hiçbir kararı iz bırakmaz.

Sonuç: bugün **“kaç talep sıfır tedarikçiye gitti ve neden?”** sorusunun cevabı hiçbir yerde kayıtlı değildir. Bu yalnız bir kayıp değil, **ölçülemeyen** bir kayıptır: düzeltip düzeltmediğinizi de doğrulayamazsınız.

Aynı sessizlik `:67`’deki erken dönüşte de geçerlidir (talep/kategori önkoşulu sağlanmadığında).

**Bu, Dilim 2a’nın birincil hedefidir** (bkz. `09`).

### Çift bildirim riski

- `skipAlreadyNotifiedUsers` opsiyonu var (reminder path)
- Alert/hunter + primary fanout paralel → potansiyel çoklu kanal gürültüsü (`CODE-VERIFIED` çağrı yapısı; production ölçüm `NOT-VERIFIED`)
- **Asimetri (`CODE-VERIFIED`):** `requestMatch.createMany` → `skipDuplicates: true` (`:178`, `:391`); ama `notification.createMany({ data: notifications })` (`:269`) → **`skipDuplicates` yok**. Yani eşleşme satırları dedupe edilirken bildirimler edilmiyor.
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
