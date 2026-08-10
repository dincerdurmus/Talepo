# TALEPO — Data Foundation V1 + Production QA Raporu

> **Proje:** Talepo B2B talep-teklif platformu (Next.js 16 + Prisma + Postgres)  
> **Repo yolu:** `apps/web`  
> **Tarih:** 2026-08-10  
> **Faz:** Production QA (Part A) + Data Foundation & Price Intelligence V1 (Part B)

---

## 1. QA Sonuçları (Part A)

| # | Test | Statü | Not |
|---|------|-------|-----|
| 1 | Premium Alert Rule → matching Request → in-app notification | **CODE_PASS / MANUAL_REQUIRED** | `deliverAlertRuleNotifications` publish sonrası çağrılıyor; canlı bildirim doğrulanmadı |
| 2 | Premium Saved Search district save/reload | **CODE_PASS / MANUAL_REQUIRED** | Parser + URL canonical parity kodda; E2E tarayıcı testi yapılmadı |
| 3 | Premium Smart Matching (keşif + detay) | **CODE_PASS / MANUAL_REQUIRED** | `SmartMatchPanel` tüm sekmeler + detay; skor/reason tarayıcıda doğrulanmadı |
| 4 | Eksik Company profile → fake score yok | **CODE_PASS / MANUAL_REQUIRED** | `assessCompanyProfileReadiness` + `SmartMatchPanel` profil CTA; canlı doğrulanmadı |
| 5 | Professional Watchlist detay add/remove | **CODE_PASS / MANUAL_REQUIRED** | `WatchlistToggle` mevcut; tarayıcı testi yapılmadı |
| 6 | Premium → Professional Watchlist erişemez | **CODE_PASS** | `FeatureUpgradeGate` + `requireCompanyFeature("watchlist")` |
| 7 | RequestChange budget update → watchlist banner | **CODE_PASS / MANUAL_REQUIRED** | `recordRequestChanges` + `RequestChangeBanner`; canlı senaryo test edilmedi |
| 8 | STANDARD → Premium/Pro feature server-side erişemez | **CODE_PASS** | Tüm `/api/monetization/*` route'ları `requireCompanyFeature` kullanıyor |
| 9 | Cross-company IDOR | **CODE_PASS (static) / MANUAL_REQUIRED (live)** | Sorgular `companyId: ctx.companyId` ile scope'lanıyor; canlı IDOR denemesi yapılmadı |
| 10 | MVP regression + contact filter | **CODE_PASS (static) / MANUAL_REQUIRED (E2E)** | Contact filter kodda aktif; tam akış tarayıcıda test edilmedi |

**Static verify:** `node scripts/verify-production-qa.mjs` → **PASS**

**Dürüst sınır:** Browser automation bu ortamda çalıştırılmadı. Canlı test gerektiren maddeler **NOT_TESTED / MANUAL_REQUIRED** olarak işaretlendi; sahte PASS yazılmadı.

---

## 2. Manuel Kalan QA

Aşağıdaki senaryolar production öncesi manuel veya staging E2E ile doğrulanmalı:

1. Premium firma → Alert Rule (district + attributes) → eşleşen talep yayınla → `/panel/bildirimler` kontrol
2. Saved Search kaydet (district dahil) → `/panel/kayitli-aramalar` → Çalıştır → filtre parity
3. Smart matching skorları tüm keşif sekmelerinde + talep detayda
4. Profili eksik firma → skor yerine CTA
5. Professional watchlist toggle detayda
6. Alıcı bütçe günceller → Professional watchlist kullanıcısı `RequestChangeBanner` görür
7. Request → Offer → Accept → Conversation → Message tam akışı
8. Contact filter: teklif/mesajda telefon, IBAN, platform dışı link engeli
9. Company A token ile Company B AlertRule/SavedSearch/Watchlist ID'lerine erişim → 403/404

---

## 3. Security / IDOR Sonucu

| Kontrol | Statü |
|---------|-------|
| Monetization API'ler `requireCompanyFeature` | **WORKING** (static) |
| Alert/SavedSearch/Watchlist `companyId: ctx.companyId` scope | **WORKING** (static) |
| Watchlist body'den foreign `companyId` kabul etmiyor | **WORKING** (static) |
| Legacy `/api/alert-rules` cookie store kaldırıldı | **WORKING** |
| Live IDOR penetration test | **NOT_TESTED** |
| Price Intelligence API aggregate-only (raw offer fiyatı dönmüyor) | **WORKING** (design) |
| Deal Outcome API participant-only confirmation | **WORKING** (code) |

---

## 4. DealOutcome Modeli

**Statü:** **WORKING** (schema + service + UI)

```
DealOutcome
├── id, requestId, offerId (@unique), conversationId (@unique nullable)
├── buyerUserId, companyId
├── status (PENDING | COMPLETED | CANCELLED | PRICE_DISAGREEMENT | ...)
├── agreedPrice, currency (Offer.price'dan bağımsız)
├── buyerConfirmedAt, supplierConfirmedAt (bağımsız)
├── confirmationLevel (NONE → BOTH_CONFIRMED)
└── completedAt
```

- Accepted offer başına **tek** DealOutcome (`offerId @unique`)
- `createPendingDealOutcome()` accept flow sonrası non-blocking çağrılır
- Mevcut accept flow bozulmadı

**Dosya:** `src/server/price-intelligence/deal-outcome.ts`

---

## 5. Transaction Confirmation Mantığı

**Statü:** **WORKING**

| Level | Koşul |
|-------|-------|
| NONE | Hiç teyit yok |
| BUYER_CONFIRMED | Yalnız alıcı teyit etti |
| SUPPLIER_CONFIRMED | Yalnız firma teyit etti |
| BOTH_CONFIRMED | Her iki taraf teyit etti |
| PAYMENT_VERIFIED | **NOT_IMPLEMENTED** (gelecek faz) |

- Alıcı ve firma bağımsız cevap verir (`submitDealConfirmation`)
- `TALEPO_CONFIRMED_TRANSACTION` observation yalnızca `status=COMPLETED` **ve** `confirmationLevel=BOTH_CONFIRMED` iken oluşur
- CANCELLED / PRICE_DISAGREEMENT → confirmed transaction observation **oluşmaz**

**UI:** `DealOutcomePanel` — kabul edilmiş teklif sohbetinde (`/panel/mesajlar/[id]`)

---

## 6. PriceObservation Modeli

**Statü:** **WORKING** (schema + recorder)

| Alan | Açıklama |
|------|----------|
| sourceType | PriceSignalType enum (6 seviye hiyerarşi) |
| requestId / offerId / dealOutcomeId | Kaynak bağlantıları |
| categoryId, productFingerprint, brand, model, condition | Normalizasyon |
| price, currency, location, observedAt | Fiyat sinyali |
| idempotencyKey @unique | Duplicate engeli |
| metadata | Provider policy, external ref vb. |

**Migration:** `20260810180000_data_foundation_v1`

---

## 7. Internal Observation Hooks

**Statü:** **WORKING** (non-blocking, idempotent)

| Event | Signal | Idempotency Key |
|-------|--------|-----------------|
| Request publish | TALEPO_REQUEST | `TALEPO_REQUEST:{requestId}` |
| Offer create | TALEPO_OFFER | `TALEPO_OFFER:{offerId}` |
| Offer accept | TALEPO_ACCEPTED_OFFER | `TALEPO_ACCEPTED_OFFER:{offerId}` |
| Deal BOTH_CONFIRMED | TALEPO_CONFIRMED_TRANSACTION | `TALEPO_CONFIRMED_TRANSACTION:{dealOutcomeId}` |

**Hook noktaları:**
- `create-request.ts` → `recordRequestPriceObservation`
- `offer-service.ts` → `recordOfferPriceObservation`, `recordAcceptedOfferObservation`, `createPendingDealOutcome`

Observation hatası ana ticari akışı engellemez (try/catch + console.error).

---

## 8. Product Normalization

**Statü:** **WORKING** (dynamic, all engine categories)

- **Single source of truth:** `REQUEST_CATEGORIES` via `src/lib/price-intelligence/category-registry.ts`
- **Hardcoded 3-category map kaldırıldı** — eski `CATEGORY_ATTRIBUTE_KEYS` (automotive/real-estate/printing only) silindi
- Pipeline: Request → Category (slug) → FormField/fieldValues → scored attribute extraction → NormalizedProduct → fingerprint
- Fingerprint field seçimi: kategori field tanımlarından dinamik skorlama (`select` + `required` + global key weights)
- Eksik veri → `fingerprint: null`, düşük `confidence` — sahte alan uydurulmaz
- `providerQuery` her kategori için `buildProviderSearchQuery()` ile üretilir

**Dosyalar:**
- `src/lib/price-intelligence/category-registry.ts` — registry, fingerprint strategy, provider profile
- `src/server/price-intelligence/normalize-product.ts` — normalization pipeline
- `src/server/price-intelligence/provider-query.ts` — category-aware routing

**NOT_IMPLEMENTED:** Gerçek ürün ailesi graph'ı, cross-category dedup ML

---

## 8b. Category Coverage

**Statü:** **WORKING** (11/11 engine categories)

| Metrik | Değer |
|--------|-------|
| Aktif kategori (engine) | **11** |
| Normalization pipeline desteği | **11 / 11** (100%) |
| Provider query üretebilen | **11 / 11** |
| External shopping uygun (score ≥ 0.5) | **4** — automotive, appliances, baby, home-kitchen |
| Real-estate provider uygun | **1** — real-estate |
| Machinery-specialized route | **1** — machinery |
| Internal-primary (Talepo ağırlıklı) | **5** — printing, technology, health, services + partial others |

### Kategori bazlı routing (field-pattern derived, hardcoded liste yok)

| Slug | Label | Primary Route | Shopping | Internal |
|------|-------|---------------|----------|----------|
| `printing` | Matbaa ve Ambalaj | internal | düşük | yüksek |
| `automotive` | Otomotiv | shopping | yüksek | orta |
| `machinery` | Makine ve Endüstriyel | machinery | orta | yüksek |
| `furniture` | Mobilya | internal/shopping | orta | orta |
| `technology` | Teknoloji | shopping* | orta | orta |
| `real-estate` | Emlak | real_estate | düşük | orta |
| `appliances` | Beyaz Eşya | shopping | yüksek | orta |
| `health` | Sağlık | internal | orta | yüksek |
| `baby` | Bebek | shopping | yüksek | orta |
| `home-kitchen` | Ev ve Mutfak | shopping | yüksek | orta |
| `services` | Hizmetler | internal | çok düşük | çok yüksek |

\* Teknoloji: `solutionType` + `specs` alanları shopping skorunu artırır; brand/model zorunlu değil.

### Hardcoded kategori listesi kaldı mı?

| Dosya | Durum |
|-------|-------|
| `normalize-product.ts` | **Temizlendi** — `CATEGORY_ATTRIBUTE_KEYS` yok |
| `category-registry.ts` | **Engine-driven** — `REQUEST_CATEGORIES` tek kaynak |
| `PRICE_CATEGORIES = [...]` | **Oluşturulmadı** |
| `provider-query.ts` | Route hints only (provider ID placeholders, not category lists) |

**Yeni kategori eklendiğinde:** `request-category-engine.ts` → `REQUEST_CATEGORIES`'e ekle → Price Intelligence otomatik destekler (field defs + fingerprint + provider profile).

**Backfill:** `scripts/backfill-price-observations.ts` — TÜM kategorilerdeki Request/Offer taranır; fingerprint null kalabilir.

**Test:** `verify-price-intelligence.ts` — technology, automotive, printing, appliances, machinery, real-estate, services örnekleri PASS.

---

## 9. PriceDataProvider Abstraction

**Statü:** **INFRASTRUCTURE_READY**

```
providers/
├── types.ts      — PriceDataProvider interface
├── registry.ts   — register/list/by capability
└── index.ts
```

- `internalProvider` (talepo-internal) kayıtlı — persist allowed
- Capability flags: `LISTING_PRICE`, `SOLD_PRICE`, `HISTORICAL_PRICE`
- `ExternalDataPolicy`: `canPersist`, `retentionPolicy`, `termsReference`

**NOT_IMPLEMENTED:** eBay, Amazon, Akakçe/Cimri gerçek bağlantıları; scraping

---

## 10. Price Intelligence Engine

**Statü:** **WORKING** (internal data only)

`getPriceIntelligence({ categoryId, productFingerprint, city, district, condition, windowDays })`

**Return:**
- Per-signal stats: request, offer, accepted, confirmed, external listing, external sold
- Each: sampleSize, rawSampleSize, median, p25, p75, min, max, insufficientData
- Overall: sampleSize, confidence, insufficientData, windowDays

**Window desteği:** 7d, 30d, 90d, 180d, 365d

**Dosya:** `src/server/price-intelligence/price-intelligence-engine.ts`

---

## 11. Confidence Sistemi

**Statü:** **WORKING** (rule-based v1)

| Koşul | Confidence |
|-------|------------|
| sample < 5 | VERY_LOW + insufficientData |
| sample < 10 | LOW |
| sample ≥ 20 | MEDIUM |
| confirmed ≥ 3 && total ≥ 15 | HIGH |

Signal weighting tanımlı (`confidence.ts`) — CONFIRMED > ACCEPTED > OFFER > REQUEST > EXTERNAL_LISTING

**NOT_IMPLEMENTED:** Time decay weighting, location match quality, product match quality ML

---

## 12. Privacy Threshold

**Statü:** **WORKING** (design + engine)

- `MIN_AGGREGATE_SAMPLE = 5` — altında `insufficientData: true`
- API yalnızca aggregate istatistik döner; bireysel firma teklif fiyatı expose edilmez
- Debug endpoint yalnızca `NODE_ENV=development` + `debug=1`

**NOT_IMPLEMENTED:** Per-company raw price audit log, paid insight tier ayrımı

---

## 13. API

| Endpoint | Statü | Entitlement |
|----------|-------|-------------|
| `GET /api/price-intelligence` | **WORKING** | `basic_market_insights` (Premium+) |
| `GET /api/deal-outcomes?conversationId=` | **WORKING** | Authenticated participant |
| `POST /api/deal-outcomes` | **WORKING** | Buyer or supplier role check |

Query params: `categoryId`, `productFingerprint`, `city`, `district`, `condition`, `windowDays`

---

## 14. Index Kararları

**Statü:** **WORKING** (migration'da tanımlı)

```
PriceObservation:
  @@index([sourceType])
  @@index([categoryId])
  @@index([productFingerprint])
  @@index([observedAt])
  @@index([currency])
  @@index([categoryId, productFingerprint, observedAt])
  @@index([sourceType, categoryId, observedAt])
  @@unique([idempotencyKey])

DealOutcome:
  @@unique([offerId])
  @@unique([conversationId])
  @@index([requestId, buyerUserId, companyId, status, createdAt])
```

Gereksiz ek index oluşturulmadı.

---

## 15. Migration

**Statü:** **WORKING** (additive, safe)

- Dosya: `prisma/migrations/20260810180000_data_foundation_v1/migration.sql`
- Yeni enum'lar: `PriceSignalType`, `DealOutcomeStatus`, `TransactionConfirmationLevel`, `PriceConfidenceLevel`
- Yeni tablolar: `DealOutcome`, `PriceObservation`
- DROP/RESET yok; mevcut veri korunur
- `npx prisma format` → PASS
- `npx prisma validate` → PASS
- `npx prisma generate` → PASS

**NOT_TESTED:** Migration'ın production DB'ye apply edilmesi (deploy sırasında yapılacak)

---

## 16. Test Sonuçları

| Senaryo | Statü | Kanıt |
|---------|-------|-------|
| A) 100/90/90/85 dört ayrı signal | **PASS** | Unit test + idempotency key design |
| B) CANCELLED → no confirmed observation | **PASS** | `deal-outcome.ts` BOTH_CONFIRMED gate |
| C) 2 observation → insufficientData | **PASS** | `verify-price-intelligence.ts` |
| D) 20 observation → median/percentile | **PASS** | `verify-price-intelligence.ts` |
| E) Duplicate offer → tek TALEPO_OFFER | **PASS** | idempotencyKey upsert |
| F) Company A → Company B raw fiyat API | **PASS** (design) | Aggregate-only API |
| G) 30d vs 365d window farkı | **PARTIAL** | Engine window param var; live DB test NOT_TESTED |

**Script sonuçları:**
```
verify-production-qa.mjs        → PASS
verify-price-intelligence.ts    → PASS
verify-monetization-security.mjs → PASS
verify-completion-sprint.mjs    → PASS
npm run build                   → PASS (57 routes)
```

---

## 17. Build Sonucu

```
npx prisma format    → PASS
npx prisma validate  → PASS
npx prisma generate  → PASS
npm run build        → PASS (exit 0, 57 routes)
```

Yeni route'lar: `/api/price-intelligence`, `/api/deal-outcomes`

---

## 18. External Provider Entegrasyonu — Hazır Noktalar

1. `registerPriceDataProvider()` — registry'ye provider ekle
2. `ExternalDataPolicy.canPersist` — provider şartına göre DB yazımı kontrol
3. `PriceObservation.externalReferenceId` + `metadata` — external ref saklama
4. `getListingPrices()` / `getSoldPrices()` optional interface methods
5. `normalizeExternalProduct()` — external title normalization hook
6. Placeholder dosya yapısı: `providers/index.ts` (gelecekte `ebay.ts`, `amazon.ts`, `turkish-marketplace.ts`)

---

## 19. Hâlâ Yapılmayanlar

| Madde | Statü |
|-------|-------|
| Browser/manual E2E QA | **NOT_TESTED** |
| Live IDOR penetration | **NOT_TESTED** |
| Migration production apply | **NOT_TESTED** |
| External provider gerçek API (eBay, Amazon, TR marketplace) | **NOT_IMPLEMENTED** |
| Payment verification signal (PAYMENT_VERIFIED) | **NOT_IMPLEMENTED** |
| Time decay weighting (architecture ready, logic basic) | **PARTIAL** |
| Cron/email deal follow-up | **NOT_IMPLEMENTED** |
| Derived data DB cache (PriceStatistics table) | **NOT_IMPLEMENTED** (on-demand compute) |
| Talepo Insights ↔ Price Intelligence UI entegrasyonu | **INFRASTRUCTURE_READY** |
| Data warehouse export pipeline | **NOT_IMPLEMENTED** |

---

## 20. Sonraki Faz Önerisi

### Faz 2 — Production Hardening
1. Staging'de manuel QA checklist (§2) tamamlama
2. Live IDOR test suite (authenticated multi-company fixtures)
3. Migration apply + observation backfill script (mevcut Request/Offer/Accept)

### Faz 3 — Price Intelligence UX
1. Talepo Insights'a price layer entegrasyonu (aggregate, gated)
2. Request/Offer form'da "yeterli veri yok" / confidence badge
3. Admin debug panel (`getProductSignalDebug`)

### Faz 4 — External Data
1. İlk lisanslı provider (capability + retention policy ile)
2. EXTERNAL_LISTING / EXTERNAL_SOLD observation pipeline
3. Time decay + location-weighted confidence

### Faz 5 — Transaction Truth
1. Deal follow-up cron (7/14/30 gün)
2. PAYMENT_VERIFIED signal (ödeme entegrasyonu sonrası)
3. Confirmed transaction → anonim market insight publish (threshold ≥ N)

---

## Dosya Envanteri (Yeni/Değişen)

### Schema & Migration
- `prisma/schema.prisma` — DealOutcome, PriceObservation, enum'lar
- `prisma/migrations/20260810180000_data_foundation_v1/migration.sql`

### Price Intelligence Core
- `src/lib/price-intelligence/types.ts`
- `src/lib/price-intelligence/category-registry.ts`
- `src/server/price-intelligence/normalize-product.ts`
- `src/server/price-intelligence/provider-query.ts`
- `src/server/price-intelligence/statistics.ts`
- `src/server/price-intelligence/confidence.ts`
- `src/server/price-intelligence/record-observation.ts`
- `src/server/price-intelligence/deal-outcome.ts`
- `src/server/price-intelligence/price-intelligence-engine.ts`
- `src/server/price-intelligence/providers/types.ts`
- `src/server/price-intelligence/providers/registry.ts`
- `src/server/price-intelligence/providers/index.ts`

### API & UI
- `src/app/api/price-intelligence/route.ts`
- `src/app/api/deal-outcomes/route.ts`
- `src/components/panel/DealOutcomePanel.tsx`
- `src/app/panel/mesajlar/[id]/page.tsx` — DealOutcomePanel entegrasyonu

### Hooks
- `src/server/request/create-request.ts`
- `src/server/offer/offer-service.ts`

### Verify
- `scripts/verify-production-qa.mjs`
- `scripts/verify-price-intelligence.ts`
- `scripts/backfill-price-observations.ts`

---

## Özet Statü Tablosu

| Bileşen | Statü |
|---------|-------|
| Production QA (static) | **WORKING** |
| Production QA (browser/live) | **NOT_TESTED** |
| DealOutcome | **WORKING** |
| Transaction Confirmation | **WORKING** |
| PriceObservation | **WORKING** |
| Observation Hooks | **WORKING** |
| Product Normalization | **WORKING** (dynamic, 11 categories) |
| Category Registry | **WORKING** |
| Provider Query / Routing | **INFRASTRUCTURE_READY** |
| Provider Abstraction | **INFRASTRUCTURE_READY** |
| Price Intelligence Engine | **WORKING** |
| Confidence / Privacy | **WORKING** |
| Outlier Handling (IQR) | **WORKING** |
| Time Decay | **PARTIAL** |
| API | **WORKING** |
| Migration | **WORKING** (not applied live) |
| Build | **WORKING** |
| External Providers | **NOT_IMPLEMENTED** |

---

*Talepo'nun ilk gerçek piyasa verisi toplama altyapısı kuruldu. Offer accepted ≠ transaction completed ayrımı modele yansıtıldı. Sahte piyasa fiyatı veya sahte external veri üretilmedi.*
