# TALEPO — Dış Fiyat Zekâsı Faz 1 Raporu

> **Proje:** Talepo B2B talep-teklif platformu  
> **Repo:** `apps/web`  
> **Tarih:** 2026-08-10  
> **Önkoşul:** Data Foundation V1 + Dinamik 11 Kategori Mimarisi  
> **Kapsam dışı:** Keepa, eBay, Harici LLM, Ödeme

---

## 1. Migration Durumu

| Madde | Durum |
|-------|-------|
| Migration dosyası additive (DROP/RESET yok) | **ÇALIŞIYOR** |
| `npx prisma migrate deploy` | **ÇALIŞIYOR** |

**Uygulanan migration:** `20260810180000_data_foundation_v1`

**Veritabanı hedefi (migrate deploy çıktısı):**
- Sağlayıcı: PostgreSQL (Supabase)
- Host: `aws-0-eu-central-1.pooler.supabase.com:5432`
- Veritabanı: `postgres`
- Şema: `public`

**Oluşturulan objeler:** `DealOutcome`, `PriceObservation`, enum'lar (`PriceSignalType`, `DealOutcomeStatus`, `TransactionConfirmationLevel`, `PriceConfidenceLevel`)

---

## 2. Backfill Dry-Run

**Komut:** `npx tsx scripts/backfill-price-observations.ts --dry-run`

| Sinyal | Oluşturulacak |
|--------|-----------------|
| TALEPO_REQUEST | **3** (4 talep tarandı, 1 bütçesiz) |
| TALEPO_OFFER | **2** |
| TALEPO_ACCEPTED_OFFER | **1** |
| TALEPO_CONFIRMED_TRANSACTION | **0** (bilinçli olarak atlandı) |

**Kategori kapsamı:** 3 farklı categoryId'de talep mevcut. Tüm engine kategorileri desteklenir; veritabanında henüz sınırlı veri var.

---

## 3. Backfill Uygulama Durumu

**Komut:** `npx tsx scripts/backfill-price-observations.ts`

| Sonuç | Değer |
|-------|-------|
| TALEPO_REQUEST | **3** oluşturuldu |
| TALEPO_OFFER | **2** oluşturuldu |
| TALEPO_ACCEPTED_OFFER | **1** oluşturuldu |
| TALEPO_CONFIRMED_TRANSACTION | **0** (asla backfill edilmedi) |
| Fingerprint | 6/6 dolu |
| Idempotent | **ÇALIŞIYOR** (idempotencyKey ile upsert) |

---

## 4. Kategori Kapsamı

**Tek kaynak:** `REQUEST_CATEGORIES` (11 kategori — ayrı hardcoded `PRICE_CATEGORIES` listesi **yok**)

| Metrik | Değer |
|--------|-------|
| Aktif kategori (engine) | **11** |
| Normalizasyon desteği | **11 / 11** |
| Provider sorgusu üretebilen | **11 / 11** |
| Harici alışveriş uygun (kategori baz çizgisi ≥ 0.5) | **4** |
| Internal-ağırlıklı kategoriler | **5** |

### Ürün bazlı harici uygunluk dağılımı (örnek senaryolar)

| Senaryo | Uygunluk | Bant | Harici çağrı? |
|---------|----------|------|---------------|
| Teknoloji — iPhone 15 Pro Max 256GB | **0.855** | kullan | Evet |
| Beyaz eşya — Bosch çamaşır makinesi | **0.905** | kullan | Evet |
| Hizmetler — Ofis temizliği | **0.000** | atla | Hayır |
| Matbaa — özel kraft kutu | **< 0.60** | atla/opsiyonel | Hayır |

**Önemli:** Aynı `technology` kategorisinde "kurumsal yazılım geliştirme" gibi standart ürün olmayan talepler düşük uygunluk alır (`needType=software`, hizmet sinyalleri).

---

## 5. Provider Uygunluk Sistemi

**Durum:** **ÇALIŞIYOR**

- Dosya: `src/lib/price-intelligence/product-suitability.ts`
- Skor aralığı: **0.0 – 1.0** (ürün özellikleri birincil; kategori baz çizgisi en fazla ~%15)
- Sinyaller: marka, model, varyant, SKU/GTIN/EAN, depolama/özellik/kapasite, donanım needType, hizmet cezaları
- Yapılandırma: `src/lib/price-intelligence/provider-config.ts`

| Bant | Eşik | Davranış |
|------|------|----------|
| atla | ≤ 0.29 | Harici provider çağrılmaz |
| opsiyonel | 0.30 – 0.59 | Düşük öncelik |
| kullan | ≥ 0.60 | Provider kullanılabilir |

Ortam değişkenleri: `PROVIDER_SUITABILITY_SKIP`, `PROVIDER_SUITABILITY_USE`, `EXTERNAL_MATCH_QUALITY_MIN`

---

## 6. DataForSEO Provider

**Durum:** **ALTYAPI HAZIR** (canlı API **TEST EDİLMEDİ** — kimlik bilgisi yok)

| Alan | Değer |
|------|-------|
| Provider ID | `dataforseo-google-shopping` |
| Dosya | `src/server/price-intelligence/providers/dataforseo.ts` |
| API | `POST /v3/merchant/google/products/task_post` + poll `GET .../task_get/advanced/{id}` |
| Yetenekler | LISTING_PRICE ✅, SOLD_PRICE ❌, HISTORICAL_PRICE ❌ |
| Konum | `Turkey` (env: `DATAFORSEO_LOCATION_NAME`) |
| Dil | `tr` (env: `DATAFORSEO_LANGUAGE_CODE`) |
| Para birimi | `TRY` |

Kullanımdan kalkan HTML endpoint kullanılmıyor — resmi Merchant Google Products API.

---

## 7. Kimlik Bilgileri Durumu

| Ortam değişkeni | Durum |
|-----------------|-------|
| `DATAFORSEO_LOGIN` | **YAPILANDIRILMADI** |
| `DATAFORSEO_PASSWORD` | **YAPILANDIRILMADI** |

Kimlik bilgisi yokken:
- Build: **GEÇTİ**
- Provider durumu: `NOT_CONFIGURED`
- Dahili fiyat zekâsı: **çalışmaya devam eder**
- Harici fetch: atlanır, hata fırlatılmaz

---

## 8. Sorgu Üretimi

**Durum:** **ÇALIŞIYOR**

- `buildQueryFromNormalizedProduct()` — marka + model + varyant + önemli nitelikler
- Yalnızca başlık fallback'i — başka sinyal yoksa devreye girer
- Örnek çıktılar:
  - `Apple iPhone 15 Pro Max 256 GB`
  - `Bosch Çamaşır makinesi A+++`
  - Hizmet talebi → uygunluk düşük → sorgu üretilse bile API çağrılmaz

---

## 9. Harici Sonuç Normalizasyonu

**Durum:** **ÇALIŞIYOR** (mock test geçti)

Provider yanıtı → `ExternalPriceObservation`:
- `provider`, `externalId`, `title`, `price`, `currency`, `condition`, `location`, `observedAt`, `sourceType=EXTERNAL_LISTING`, `url`, `rawMetadata`
- Geçersiz fiyat (≤ 0, NaN) filtrelenir
- Para birimi: aggregate'de TRY öncelikli; farklı para birimleri dahili istatistiklere karıştırılmaz

---

## 10. Ürün Eşleşme Kalitesi

**Durum:** **ÇALIŞIYOR**

- Dosya: `src/server/price-intelligence/external-match-quality.ts`
- Kural tabanlı: marka eşleşmesi, model eşleşmesi, varyant/depolama, sorgu token örtüşmesi
- `matchQuality: 0..1` → `rawMetadata.matchQuality`
- Minimum eşik: **0.4** (env: `EXTERNAL_MATCH_QUALITY_MIN`)
- Yanlış ürün (Samsung vs iPhone) aggregate dışı bırakılır — test geçti

---

## 11. Harici Veri Politikası (ExternalDataPolicy)

**Durum:** **ÇALIŞIYOR** (muhafazakâr)

- `canPersist: false`
- `retentionPolicy: "in-memory-cache-only"`
- `termsReference: https://dataforseo.com/terms-of-service`

Harici ilan verisi veritabanına yazılmıyor — yalnızca istek kapsamlı bellek içi önbellek + canlı aggregate.

---

## 12. Önbellek (Cache)

**Durum:** **ÇALIŞIYOR**

- Dosya: `src/server/price-intelligence/provider-cache.ts`
- Bellek içi Map (Redis yok)
- Önbellek anahtarı: `provider|queryFingerprint|location|currency`
- TTL: `DATAFORSEO_CACHE_TTL_MS` (varsayılan 1 saat)

---

## 13. Maliyet Telemetrisi

**Durum:** **ÇALIŞIYOR**

- Dosya: `src/server/price-intelligence/provider-telemetry.ts`
- Kayıt: provider, queryFingerprint, requestedAt, durationMs, resultCount, success, cached, errorCode
- Kimlik bilgisi / ham yanıt **loglanmaz**
- Ring buffer en fazla 500 kayıt

---

## 14. Fiyat Motoru Entegrasyonu

**Durum:** **ÇALIŞIYOR**

Motor artık dahili ve harici sinyalleri **ayrı** hesaplar:

- `sources.talepoRequests` — Talepo talep bütçeleri
- `sources.talepoOffers` — Talepo teklifleri
- `sources.acceptedOffers` — kabul edilen teklifler
- `sources.confirmedTransactions` — teyit edilmiş işlemler
- `sources.externalListings` — dış piyasa ilanları
- `sources.externalSold` — dış satış (henüz bağlı değil)

**API:** `GET /api/price-intelligence?includeExternal=1&requestId=...` → canlı harici fetch (uygunluk ≥ 0.60)

**UI hazırlığı:** `signalSummary` — "Talepo verileri" / "Dış piyasa ilanları" / toplam sinyal sayısı

Teyit edilmiş işlem ≠ harici ilan güven seviyesi.

---

## 15. Güven (Confidence)

**Durum:** **ÇALIŞIYOR**

- Güven skoru **yalnızca dahili örneklem** ile hesaplanır
- Yüksek harici ilan sayısı otomatik HIGH güven üretmez
- `computeAggregateConfidence({ internalSample, confirmedSample })`

---

## 16. Yedekleme (Fallback)

**Durum:** **ÇALIŞIYOR**

| Durum | Davranış |
|-------|----------|
| Kimlik bilgisi yok | Yalnızca dahili, `NOT_CONFIGURED` |
| Uygunluk düşük | `SKIPPED`, API çağrılmaz |
| Zaman aşımı / hata | `ERROR`, gözlem=[], dahili devam |
| MVP akışları | **etkilenmez** |

---

## 17. Gizlilik

**Durum:** **ÇALIŞIYOR**

- API yalnızca toplu (aggregate) istatistik döner
- Bireysel firma teklif fiyatı başka firmaya açılmaz
- `MIN_AGGREGATE_SAMPLE = 5` kuralı korunur
- Ham harici ilanlar istemciye tek tek gönderilmez

---

## 18. Arayüz (UI)

**Durum:** **ALTYAPI HAZIR**

Bu fazda büyük UI yok. API yanıtı ileride şunları gösterebilecek şekilde hazır:
- Kaynak dağılımı (`sources`)
- "Talepo verileri" / "Dış piyasa ilanları" etiketleri
- Provider yoksa sahte harici veri gösterilmez

---

## 19. Test Sonuçları

| Test | Durum |
|------|-------|
| A) iPhone → yüksek uygunluk | **GEÇTİ** (0.855) |
| B) Hizmet → düşük, çağrı yok | **GEÇTİ** (0.000) |
| C) Matbaa özel baskı → dahili ağırlıklı | **GEÇTİ** |
| D) Beyaz eşya → yüksek uygunluk | **GEÇTİ** (0.905) |
| E) Kimlik bilgisi yok → build geçer | **GEÇTİ** |
| F) Mock DataForSEO → ExternalPriceObservation | **GEÇTİ** |
| G) Yanlış ürün → matchQuality filtresi | **GEÇTİ** |
| H) Provider timeout → fallback | **GEÇTİ** |
| I) Backfill idempotent | **GEÇTİ** |
| J) Accepted ≠ CONFIRMED backfill | **GEÇTİ** |

**Script:** `npx tsx scripts/verify-external-price-intelligence.ts` → **GEÇTİ**

---

## 20. Build

```
npx prisma format    → GEÇTİ
npx prisma validate  → GEÇTİ
npx prisma generate  → GEÇTİ
npm run build        → GEÇTİ (57 route)
verify-price-intelligence.ts          → GEÇTİ
verify-external-price-intelligence.ts → GEÇTİ
verify-production-qa.mjs              → GEÇTİ (statik)
```

---

## 21. Manuel / Production Kalanlar

| Madde | Durum |
|-------|-------|
| DataForSEO canlı API testi (kimlik bilgisi gerekli) | **TEST EDİLMEDİ** |
| Production'da DATAFORSEO_LOGIN/PASSWORD | **YAPILANDIRILMADI** |
| Harici ilanın DB'de kalıcı saklanması (lisans sonrası) | **UYGULANMADI** |
| Tarayıcı E2E fiyat zekâsı UI | **UYGULANMADI** |
| Redis / dağıtık önbellek | **UYGULANMADI** |
| Harici ilanlarda zaman aşımı (time decay) | **UYGULANMADI** |

---

## 22. Sonraki Provider Önerisi

1. **Emlak provider** — `real-estate` için ayrı adapter (`propertyType`, `listingType` sinyalleri)
2. **Makine / endüstriyel provider** — `machineType + marka + model` için sektörel marketplace
3. **DataForSEO canlı production testi** — kimlik bilgisi + maliyet izleme paneli
4. **Kalıcılık politikası gözden geçirme** — DataForSEO ToS onayı sonrası `canPersist` değerlendirmesi

---

## Dosya Envanteri (Yeni / Değişen)

| Dosya | Rol |
|-------|-----|
| `src/lib/price-intelligence/provider-config.ts` | Eşikler + DataForSEO yapılandırması |
| `src/lib/price-intelligence/product-suitability.ts` | Ürün bazlı 0–1 skor |
| `src/server/price-intelligence/providers/dataforseo.ts` | DataForSEO adapter |
| `src/server/price-intelligence/fetch-external-listings.ts` | Orkestrasyon |
| `src/server/price-intelligence/external-match-quality.ts` | Eşleşme kalitesi filtresi |
| `src/server/price-intelligence/provider-cache.ts` | Bellek içi önbellek |
| `src/server/price-intelligence/provider-telemetry.ts` | Operasyon telemetrisi |
| `src/server/price-intelligence/provider-query-builder.ts` | NormalizedProduct sorgusu |
| `src/server/price-intelligence/provider-query.ts` | Ürün bazlı yönlendirme |
| `src/server/price-intelligence/price-intelligence-engine.ts` | Kaynaklar + harici meta |
| `src/app/api/price-intelligence/route.ts` | includeExternal parametresi |
| `scripts/backfill-price-observations.ts` | --dry-run desteği |
| `scripts/verify-external-price-intelligence.ts` | Faz 1 testleri |

---

## Özet Durum Tablosu

| Bileşen | Durum |
|---------|-------|
| Migration deploy | **ÇALIŞIYOR** |
| Backfill | **ÇALIŞIYOR** |
| Ürün uygunluğu | **ÇALIŞIYOR** |
| DataForSEO adapter | **ALTYAPI HAZIR** |
| Canlı harici API | **YAPILANDIRILMADI** |
| Eşleşme kalitesi | **ÇALIŞIYOR** |
| Önbellek + telemetri | **ÇALIŞIYOR** |
| Motor entegrasyonu | **ÇALIŞIYOR** |
| Gizlilik / fallback | **ÇALIŞIYOR** |
| Build | **ÇALIŞIYOR** |

*Dinamik 11 kategori mimarisi korundu. Hardcoded kategori listesi eklenmedi.*

---

## Canlı Harici Fiyat İçin Sonraki Adım

Production ortamında şu değişkenleri tanımlayın:

```
DATAFORSEO_LOGIN=...
DATAFORSEO_PASSWORD=...
```

Ardından `includeExternal=1` ile API'yi test edin. Kimlik bilgisi olmadan canlı provider testi **TEST EDİLMEDİ** olarak kalır — sahte piyasa verisi üretilmedi.
