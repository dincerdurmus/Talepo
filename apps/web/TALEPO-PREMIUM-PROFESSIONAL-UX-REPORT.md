# TALEPO — Premium & Professional UX Implementasyon Raporu

> **Amaç:** Bu doküman ChatGPT veya başka bir AI'ya bağlam olarak verilebilir.  
> **Proje:** Talepo B2B talep-teklif platformu (Next.js 16 + Prisma + Supabase/Postgres)  
> **Repo yolu:** `apps/web`  
> **Tarih:** 2026-08-10  
> **Durum:** Monetization V2 altyapısı panel UX'e bağlandı; ödeme, ERP, harici LLM bu fazda YOK

---

## 1. Proje bağlamı (kısa)

Talepo'da alıcı talep açar → tedarikçi teklif verir → kabul → mesajlaşma.

Plan katmanları:
- **STANDARD** — temel keşif + teklif kotası
- **PREMIUM** — hız + erişim (alarmlar, kayıtlı arama, gelişmiş filtre, smart match)
- **PROFESSIONAL** — fırsat intelligence + analiz
- **CORPORATE** — Professional + kurumsal özellikler (bu fazda ayrı UI yok; Professional deneyimini kullanır)

Monetization V2 Prisma modelleri (migration `20260810170000_monetization_v2` — daha önce uygulandı):
`AlertRule`, `SavedSearch`, `OpportunityWatchlistItem`, `RequestChange`, `OpportunityMatch`

---

## 2. Master özellik tablosu

| Özellik | Statü | Açıklama |
|---------|-------|----------|
| Akıllı alarm kuralları (`/panel/uyarilar`) | WORKING | DB CRUD via `/api/monetization/alerts` |
| Alarm — kategoriye özel `attributes` | PARTIAL | Schema'da var; UI/API POST'ta yok |
| Alarm eşleşme → bildirim teslimi | INFRASTRUCTURE_READY | Motor var; push/e-posta yok |
| Kayıtlı aramalar (`/panel/kayitli-aramalar`) | WORKING | CRUD + filtre geri yükleme |
| Keşiften "Aramayı kaydet" | WORKING | `SaveExploreSearchButton` |
| Kayıtlı arama — ilçe geri yükleme | PARTIAL | URL'e yazılır; keşif parser'ında `district` yok |
| Gelişmiş filtreler (Premium+) | WORKING | Server-side entitlement enforcement |
| Smart matching (keşif listesi) | WORKING | Rule-based; max 50 talep batch |
| Eşleşme skoru UI (tüm sekmeler) | PARTIAL | Yalnızca "Size uygun" sekmesinde |
| Smart matching (talep detay) | NOT_IMPLEMENTED | `/panel/talepler/[id]`'de yok |
| Profil tamamlama CTA | WORKING | Eksik kategori/şehir/açıklama banner |
| AI Teklif Asistanı | MOCK | Rule-based şablon; harici LLM yok |
| Fırsatlar merkezi (`/panel/firsatlar`) | WORKING | Gerçek DB verisi |
| Opportunity Score | WORKING | Rule-based 0–100 |
| Yüksek bütçe bölümü | PARTIAL | UI var; referans verisi yok → hep boş |
| Rekabet sinyalleri | WORKING | offerCount/viewCount |
| Watchlist | WORKING | Add/remove API + UI |
| RequestChange gösterimi | WORKING | Kayıt varsa kartlarda |
| RequestChange kaydı | PARTIAL | Yalnızca alıcı talep güncellemesinde |
| Profesyonel analiz (`/panel/analiz`) | WORKING | 7/30/90 gün; gerçek DB |
| Temel piyasa özeti (Premium analiz) | WORKING | Anonim aggregate; min 5 talep |
| Talepo Insights (Pro detaylı) | INFRASTRUCTURE_READY | API var; analiz UI'da yok |
| Upgrade / paywall ekranları | WORKING | `FeatureUpgradeGate` + marketing copy |
| Ödeme / checkout | NOT_IMPLEMENTED | `/panel/plan` mock |
| ERP entegrasyonu | NOT_IMPLEMENTED | — |
| Harici LLM | NOT_IMPLEMENTED | Provider boundary hazır |

**Statü tanımları:**
- **WORKING** — Kodda uçtan uca bağlı, gerçek veri
- **PARTIAL** — Kısmen çalışır veya spec'ten eksik
- **INFRASTRUCTURE_READY** — Backend/boundary var; ürün deneyimi tam değil
- **MOCK** — Bilinçli stub; gerçek servis değil
- **NOT_IMPLEMENTED** — Yok veya bu fazda kasıtlı olarak yapılmadı

---

## 3. Plan bazında kullanıcı yetenekleri

### STANDARD kullanıcı
**Yapamaz (paywall görür):**
- `/panel/uyarilar`, `/panel/kayitli-aramalar`, `/panel/firsatlar`, `/panel/analiz` → upgrade ekranı
- Gelişmiş filtreler (sunucu filtreleri sıfırlar)
- Smart match skoru, kayıtlı arama kaydetme

**Yapabilir:** Temel keşif, teklif (kota dahilinde), mevcut MVP akışları

### PREMIUM kullanıcı
**Yapabilir:**
- Alarm CRUD (ad, kategori, şehir, ilçe, min/max bütçe, keyword, aktif/pasif)
- Kayıtlı arama CRUD + keşiften kaydet
- Gelişmiş filtreler
- "Size uygun" sekmesinde % eşleşme + reason listesi
- Talep detayında kural tabanlı taslak ("Talepo taslak önerisi")
- Analiz sayfasında temel piyasa özeti (son 30 gün aggregate)

**Yapamaz:** Fırsatlar hub, watchlist, pro analiz dashboard, Talepo Insights

### PROFESSIONAL / CORPORATE kullanıcı
Premium'un tamamı **artı:**
- `/panel/firsatlar` — sıcak fırsatlar, watchlist, rekabet, değişiklik göstergeleri
- `/panel/analiz` — performans dashboard (teklif, kabul oranı, yanıt süresi vb.)
- Acil talep önceliği (keşif sıralaması)

---

## 4. Teknik detaylar

### 4.1 Smart Matching (`smart-matching.ts`)

**Firma verisi:** `city`, `district`, `description`, `categories[]`  
**Talep verisi:** `categoryId`, `city`, `district`, `title`, `description`, `fieldValues[]`

**Skor kuralları (0–100):**
- Kategori eşleşmesi: +40
- Aynı şehir: +25 (farklı: +5)
- Aynı ilçe: +15
- Kategori token → talep metninde: +8
- Alan değeri uyumu: +5

En fazla 5 reason. Envanter/teklif geçmişi/AI kullanılmaz.

### 4.2 Opportunity Score (`opportunity-score.ts`)

- `aiScore ≥ 70`: +15 | `≥ 40`: +8
- `isUrgent`: +20
- Bütçe var: +15 | bütçe ≥ 50.000: +10
- Firma match ≥ 50: +round(match×0.25)
- Yayın ≤ 24 saat: +10
- offerCount ≤ 1: +12 | ≤ 3: +5

Sınıflandırma: ≥75 HOT, ≥50 GOOD, else NORMAL

### 4.3 Competition Signals (`competition-signals.ts`)

- Kaynak: `Request.offerCount`, `Request.viewCount`
- 0–2 teklif: LOW | 3–5: MEDIUM | ≥6: HIGH
- Rakip adı/fiyat ASLA gösterilmez

### 4.4 Budget Opportunity (`budget-opportunity.ts`)

- `referenceMedian` yoksa → status: **UNKNOWN**
- Feed'de referans medyan beslenmiyor → yüksek bütçe bölümü pratikte boş

### 4.5 RequestChange

- **Kayıt:** yalnızca `update-request.ts` (alıcı talep düzenlerken)
- **Alanlar:** budgetMin, budgetMax, isUrgent, deadlineAt, status
- **Gösterim:** fırsatlar kartlarında son 14 gün

### 4.6 Professional Analytics (`professional-analytics.ts`)

| Metrik | Kaynak |
|--------|--------|
| Gönderilen teklif | `Offer.count` — companyId, submittedAt, status ∉ DRAFT/WITHDRAWN |
| Kabul edilen | `Offer.count` — acceptedAt, status ACCEPTED |
| Kabul oranı | accepted/submitted |
| Ort. yanıt süresi | submittedAt − createdAt (max 500 offer) |
| Eşleşen talep | `RequestMatch.count` |
| Takip edilen | `OpportunityWatchlistItem.count` (dönemde **eklenen**) |

### 4.7 Basic Market Insights (`talepo-insights.ts`)

- Anonim `Request` aggregate, son 30 gün
- Min 5 talep; altında "yeterli veri yok"
- Bireysel firma/kullanıcı sızdırılmaz

### 4.8 AI Offer Assistant (`ai-offer-assistant.ts`)

- `RuleBasedOfferAssistant` — şablon paragraf
- `provider: "rule-based-stub"`
- UI açıkça "harici AI kullanılmaz" der
- API: `POST /api/monetization/offer-assistant` (entitlement: `ai_offer_assistant`)

### 4.9 Alert Rules

- **Panel:** DB-backed ✅ (`/api/monetization/alerts`)
- **Cookie sistemi:** panelden kaldırıldı ✅
- **Legacy:** `/api/alert-rules` (cookie) hâlâ repoda — kullanılmıyor
- **Bildirim:** eşleşme motoru (`alert-matching.ts`) var; kullanıcıya teslimat yok
- Alert match sabit skor: 85 (kural sabiti, demo değil)

---

## 5. Entitlement & güvenlik

### Server-side API gate (`requireCompanyFeature`)

| Endpoint | Feature |
|----------|---------|
| `/api/monetization/alerts` | smart_alerts |
| `/api/monetization/saved-searches` | saved_searches |
| `/api/monetization/watchlist` | watchlist |
| `/api/monetization/opportunities` | hot_opportunities |
| `/api/monetization/analytics?type=performance` | professional_analytics |
| `/api/monetization/analytics?type=market` | talepo_insights |
| `/api/monetization/offer-assistant` | ai_offer_assistant |

### Sayfa veri gate
- Entitled değilse sunucu DB verisi yüklemez (boş + upgrade UI)
- Tüm sorgular `companyId` ile scope'lanır
- UI gate tek başına güvenlik değil; API 403 döner

---

## 6. Dosya envanteri

### Yeni dosyalar
```
src/components/panel/SavedSearchesManager.tsx
src/components/panel/SaveExploreSearchButton.tsx
src/components/panel/OpportunitiesHub.tsx
src/components/panel/AnalyticsDashboard.tsx
src/components/panel/OfferDraftSuggestion.tsx
src/lib/membership/upgrade-copy.ts
src/lib/monetization/company-profile-readiness.ts
src/lib/monetization/saved-search-url.ts
src/server/monetization/opportunities-feed.ts
src/server/monetization/batch-matching.ts
```

### Değiştirilen dosyalar
```
src/components/panel/AlertRulesManager.tsx      → DB API
src/components/panel/FeatureUpgradeGate.tsx     → upgrade copy
src/components/panel/ExploreCategoryFilterBar.tsx
src/components/panel/ExploreRequestCard.tsx
src/app/panel/uyarilar/page.tsx
src/app/panel/kayitli-aramalar/page.tsx
src/app/panel/firsatlar/page.tsx
src/app/panel/analiz/page.tsx
src/app/panel/talepler/page.tsx
src/app/panel/talepler/[id]/page.tsx
src/server/request/update-request.ts            → recordRequestChanges
```

---

## 7. MVP akışları

**Değişmedi:** Talep oluşturma, teklif gönder/kabul/red, mesajlaşma, contact filter

**Eklenen (MVP'yi bozmaz):**
- Keşif: smart match overlay, save search, profil CTA
- Talep detay: OfferDraftSuggestion (Premium+)
- Alıcı talep güncelleme: RequestChange kaydı

---

## 8. Fake / hardcoded alanlar

| Alan | Tür |
|------|-----|
| AI taslak | Bilinçli stub, etiketli |
| Alert match score 85 | Sabit kural skoru |
| Demo metrik kartları | YOK |
| Sahte piyasa yüzdesi | YOK — UNKNOWN gösterilir |

---

## 9. Bilinen bug / teknik borç

1. Legacy `/api/alert-rules` cookie endpoint kaldırılmadı
2. Alarm `attributes` — schema var, UI yok
3. Smart match UI yalnızca "Size uygun" sekmesi (spec: liste + detay)
4. `district` saved search ↔ keşif parser uyumsuz
5. Yüksek bütçe bölümü pratikte sürekli empty
6. Watchlist yalnızca fırsatlar hub'dan (detay sayfası yok)
7. Alarm eşleşmesi → bildirim yok
8. `watchedRequests` metrik adı yanıltıcı (dönemde eklenen, aktif takip değil)

---

## 10. Build & test

```
npm run build → ✅ exit 0 (Next.js 16.2.10, 56 route)
Prisma: bu UX fazında yeni migration YOK
```

**Manuel tarayıcı testi:** YAPILMADI (kod inceleme + build doğrulama)

**Test edilmemiş kritik alanlar:**
- Plan geçişleri ile gate davranışı
- Cross-company API erişimi (403)
- Saved search → keşif filtre birebir eşleşmesi
- RequestChange E2E (alıcı güncelle → fırsatlar kartı)
- AI taslak → teklif formu aktarımı

---

## 11. Production öncesi yapılacaklar

1. STANDARD / PREMIUM / PRO / CORPORATE manuel QA
2. Legacy cookie alert API temizliği
3. Alarm eşleşmesi → in-app bildirim
4. Cross-tenant güvenlik testi
5. Smart match görünürlüğü (tüm sekmeler + detay)
6. District filtre parity
7. Yüksek bütçe için referans medyan veya bölümü gizle

---

## 12. Önerilen sonraki faz

1. **Alarm teslimatı** — Premium değer önermesini tamamlar
2. **Ödeme entegrasyonu** — mock plan → gerçek checkout
3. **Piyasa referans katmanı** — yüksek bütçe + Talepo Insights UI
4. **Harici LLM** — mevcut OfferAssistantProvider boundary
5. **Corporate UX** — envanter hunter, ERP (ayrı faz)

---

## 13. ChatGPT'ye verilecek talimat örneği

Aşağıdaki metni ChatGPT'ye yapıştırıp devam edebilirsin:

```
Bu doküman Talepo projesinin Premium & Professional UX implementasyon durumunu anlatıyor.
Lütfen:
1. Bu raporu referans alarak eksik/hatalı gördüğün noktaları listele
2. Production öncesi QA checklist'i üret
3. Sonraki sprint için önceliklendirilmiş backlog öner
4. STANDARD/PREMIUM/PRO kullanıcı test senaryolarını adım adım yaz

Varsayım yapma — rapordaki WORKING/PARTIAL/MOCK statülerine sadık kal.
Ödeme, ERP ve harici LLM bu fazda kasıtlı olarak yapılmadı.
```

---

*Son güncelleme: 2026-08-10 — kod tabanı doğrulamasına dayalı, plan metnine değil.*
