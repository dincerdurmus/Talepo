# Talepo — Üyelik / Feature Entitlement Mimari İnceleme ve Sağlamlaştırma Planı

**Durum:** Planlama aşaması — henüz kod yok  
**Tarih:** 9 Ağustos 2026  
**Amaç:** Mevcut entitlement mimarisini analiz etmek, zayıf noktaları tespit etmek, implementasyon öncesi onaylanacak değişiklik listesini çıkarmak

---

## 1. Özet

Talepo'da üyelik mantığı şu an **dağınık ve kısmen uygulanmış** durumda. Temel supplier-side kurallar (teklif kotası, 24 saat gecikme) çalışıyor; ancak plan tanımlarındaki birçok özellik (`aiOfferAssistant`, `alertRules`, `hiddenInventory` vb.) **sadece tanımlı, hiçbir yerde enforce edilmiyor**. Ayrıca `planExpiresAt` yazılıyor ama okunmuyor; upgrade API'si ödeme kontrolü olmadan herkesi Premium yapabiliyor.

**Önerilen yön:** Tek bir **Entitlement katmanı** (`resolveEntitlements → assertEntitlement`) oluşturmak; tüm server-side ve UI gate'leri buradan beslemek.

---

## 2. Mevcut Mimari Haritası

### 2.1 Dosya envanteri

| Dosya | Rol | Entitlement sorumluluğu |
|-------|-----|-------------------------|
| `src/lib/membership/plans.ts` | Plan tanımları, fiyat, feature flag'ler | **Kaynak of truth (statik config)** |
| `src/lib/membership/get-membership.ts` | Runtime context + visibility filter | **Kısmi resolver** |
| `src/lib/membership/plan-visuals.ts` | UI renkleri, pazarlama metinleri | Sadece görsel |
| `src/lib/membership/contact-filter.ts` | Telefon/IBAN filtreleme | Platform kuralı (plan-bağımsız) |
| `src/app/api/membership/route.ts` | Plan yükseltme, kredi satın alma | **Güvensiz mock upgrade** |
| `src/server/offer/offer-service.ts` | Kotası + visibility gate | **Enforcement noktası #1** |
| `src/server/request/create-request.ts` | `visibleToSuppliersAt` hesaplama | Buyer-side (supplier gecikmesi) |
| `src/app/panel/talepler/page.tsx` | Liste filtresi | UI + DB filter |
| `src/app/panel/talepler/[id]/page.tsx` | Detay kilidi | UI gate (eksik) |
| `src/components/panel/OfferForm.tsx` | Kotası UI disable | UI gate |
| `src/components/panel/PlanManager.tsx` | Plan seçimi UI | Client → API |
| `prisma/schema.prisma` | `User.planTier`, `Company.planTier`, `planExpiresAt`, `bonusOfferCredits` | **Persisted state** |

### 2.2 Veri akışı (bugün)

```
plans.ts (statik tanım)
       ↓
getMembershipContext(userId)
  ├── User.planTier + bonusOfferCredits
  ├── Company.planTier (aktif üyelik varsa override)
  ├── usedOffersThisMonth (Offer count)
  └── remainingOffers hesabı
       ↓
MembershipContext { planTier, remainingOffers, instantRequestAccess, ... }
       ↓
┌──────────────────────────────────────────────────────┐
│ offer-service.ts    → quota + visibility check         │
│ talepler/page.tsx   → buildSupplierVisibilityFilter    │
│ talepler/[id].tsx   → isLockedForStandard (UI only)    │
│ OfferForm.tsx       → remainingOffers <= 0 disable     │
└──────────────────────────────────────────────────────┘
```

**Eksik:** Merkezi `Entitlements` objesi yok. Feature flag'ler context'e taşınmıyor.

---

## 3. Plan Tanımları vs Gerçek Enforcement

| Özellik | plans.ts | get-membership | offer-service | UI | Durum |
|---------|----------|----------------|---------------|-----|-------|
| Aylık teklif kotası | ✅ | ✅ remainingOffers | ✅ | ✅ | **Çalışıyor** |
| 24s talep gecikmesi | ✅ | ✅ instantRequestAccess | ✅ | ✅ | **Çalışıyor** |
| Bonus teklif kredisi | ✅ schema | ✅ toplam | ⚠️ kısmi decrement | ❌ | **Kısmi / hatalı** |
| planExpiresAt | ✅ schema | ❌ okunmuyor | ❌ | ❌ | **Ölü alan** |
| aiOfferAssistant | ✅ flag | ❌ | ❌ | ❌ (pazarlama metni) | **Tanımlı, yok** |
| advancedAiPricing | ✅ flag | ❌ | ❌ | ❌ | **Tanımlı, yok** |
| alertRules | ✅ flag | ❌ | ❌ | ❌ | **Tanımlı, yok** |
| hiddenInventory | ✅ flag | ❌ | ❌ | ❌ | **Tanımlı, yok** |
| Acil talep önceliği (Pro) | ❌ tanım yok | ❌ | ❌ | ❌ sıralama yok | **Eksik** |
| Öne çıkarma (buyer) | ✅ FEATURE_BOOST | ❌ ödeme yok | ✅ DB yazıyor | ✅ seçim var | **Ödeme gate yok** |
| İletişim filtresi | — | — | ✅ | — | **Herkese uygulanıyor** |

---

## 4. Tespit Edilen Sorunlar (Öncelik Sırasıyla)

### 🔴 Kritik

#### 4.1 `planExpiresAt` hiç kontrol edilmiyor
- **Nerede yazılıyor:** `src/app/api/membership/route.ts` (upgrade sırasında +1 ay)
- **Nerede okunmalı:** `getMembershipContext` — süresi dolmuş plan → STANDARD'a düşür veya erişimi kes
- **Risk:** Süresi dolan Premium kullanıcı sonsuza kadar Premium kalır

#### 4.2 Upgrade API güvenlik açığı
- **Dosya:** `src/app/api/membership/route.ts`
- **Sorun:** Herhangi bir authenticated user `POST { action: "upgrade", planTier: "PREMIUM" }` ile ücretsiz yükselir
- **Risk:** Gelir modeli bypass; production'da kabul edilemez

#### 4.3 Talep detayında visibility bypass
- **Dosya:** `src/app/panel/talepler/[id]/page.tsx`
- **Sorun:** Liste sayfası `buildSupplierVisibilityFilter` kullanır; detay sayfası **filtresiz** `findFirst` yapar
- **Risk:** Standart kullanıcı URL ile kilitli talebin tam içeriğini okuyabilir (sadece teklif formu kilitli)

#### 4.4 Kota race condition
- **Dosya:** `src/server/offer/offer-service.ts`
- **Sorun:** `remainingOffers` kontrolü transaction dışında; iki eşzamanlı istek ikisi de geçebilir
- **Risk:** Kotası dolmuş kullanıcı fazladan teklif verebilir

---

### 🟠 Yüksek

#### 4.5 Bonus kredi decrement mantığı tutarsız
- **Dosya:** `offer-service.ts` satır 132–146
- **Sorun:**
  - `remainingOffers` = user + company bonus **toplamı**
  - Decrement: sadece company **veya** user'dan 1 düşülüyor
  - Hangi havuzdan düşüleceği net değil (company öncelikli ama user bonus'u company varken sayılıyor)
- **Risk:** Yanlış kredi tüketimi, accounting tutarsızlığı

#### 4.6 User vs Company plan çözümleme belirsiz
- **Dosya:** `get-membership.ts`
- **Mevcut kural:** `company.planTier ?? user.planTier`
- **Belirsizlikler:**
  - Kullanıcı birden fazla firmada aktif olabilir mi? (`findFirst` — hangisi seçilir?)
  - User Premium + Company Standard → Company plan geçerli (downgrade)
  - User Standard + Company Premium → Company plan geçerli (upgrade)
  - Kota user bazında sayılıyor, plan company bazında — ekip modeli tutarsız

#### 4.7 `9999` = sınırsız hack
- **Dosya:** `plans.ts`
- **Sorun:** Magic number; UI'da "sınırsız" gösterilir ama teknik olarak 9999 limit
- **Öneri:** `monthlyOfferQuota: null` veya `isUnlimited: true` flag

---

### 🟡 Orta

#### 4.8 Feature flag'ler enforce edilmiyor
- `aiOfferAssistant`, `advancedAiPricing`, `alertRules`, `hiddenInventory` sadece `plans.ts` ve pazarlama UI'ında
- Premium satın alan kullanıcı bu özellikleri kullanamaz (henüz kod yok) — bu beklenen; ama mimari hazır değil

#### 4.9 PROFESSIONAL vs PREMIUM farkı yok
- İki planın entitlement seti neredeyse identik (`hiddenInventory` hariç, o da sadece CORPORATE'te true)
- "Acil taleplere öncelik" tanımlı pazarlama metninde var, kodda yok

#### 4.10 Buyer-side monetization gate yok
- `featureBoost` seçildiğinde ödeme kontrolü yok (`create-request.ts`)
- `isUrgent` herkese ücretsiz — bilinçli karar mı?

#### 4.11 Subscription / audit trail yok
- Plan değişikliği, kredi satın alma için ayrı tablo yok
- Destek, fatura, iade senaryoları izlenemez

---

### 🟢 Düşük

#### 4.12 `isPaidPlan`, `hasInstantAccess` helper'ları kullanılmıyor
- **Dosya:** `plans.ts` — export edilmiş ama grep'te başka kullanım yok

#### 4.13 Contact filter plan-bağımsız
- Bilinçli tercih olabilir; tüm planlarda platform içi kalma kuralı

---

## 5. Hedef Mimari (Önerilen)

### 5.1 Katman modeli

```
┌─────────────────────────────────────────────────────────┐
│  plans.ts — Statik plan catalog (değişmez config)        │
└──────────────────────────┬──────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│  resolve-entitlements.ts — TEK RESOLVER (yeni dosya)     │
│  Input: userId                                           │
│  Output: EntitlementContext                              │
│    • effectivePlanTier (expiry + company override)       │
│    • entitlements: Record<FeatureKey, boolean | number>  │
│    • quota: { limit, used, remaining, source }           │
│    • subject: { type: 'user' | 'company', id }           │
│    • expiresAt, isExpired                                │
└──────────────────────────┬───────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│  assert-entitlement.ts — TEK GUARD (yeni dosya)          │
│  assertEntitlement(ctx, 'submit_offer') → throws 402/403 │
│  assertEntitlement(ctx, 'instant_request_access')        │
│  assertEntitlement(ctx, 'ai_offer_assistant')            │
└──────────────────────────┬───────────────────────────────┘
                           ↓
         Server services · API routes · (opsiyonel) UI hints
```

### 5.2 Feature key registry (önerilen enum)

```typescript
type FeatureKey =
  | 'submit_offer'              // kotası var mı
  | 'instant_request_access'    // 24s gecikme yok
  | 'ai_offer_assistant'        // Premium+
  | 'advanced_ai_pricing'       // Premium+
  | 'alert_rules'               // Premium+
  | 'hidden_inventory'          // Corporate
  | 'urgent_request_priority'   // Professional+
  | 'feature_request_boost'     // buyer paid (gelecek)
```

Her key → `plans.ts`'deki flag'lere map edilir. Yeni özellik eklerken sadece catalog + registry güncellenir.

### 5.3 Subject modeli (User vs Company kararı)

**Önerilen kural (onay bekliyor):**

| Konu | Subject | Gerekçe |
|------|---------|---------|
| Plan tier | Company varsa Company, yoksa User | B2B satış firmaya |
| Teklif kotası | Company varsa Company havuzu, yoksa User | Ekip paylaşımı |
| Bonus krediler | Company havuzu (user bonus migrate edilir) | Accounting basitliği |
| Feature flags | Effective plan tier'dan türetilir | Tek kaynak |

**Alternatif:** Her şey user bazında — daha basit ama B2B ekip modeli zayıf.

---

## 6. Değiştirilecek Dosyalar (Implementasyon Haritası)

> Aşağıdaki liste **plan onayı sonrası** uygulanacak. Şimdilik kod yok.

### 6.1 Yeni dosyalar

| Dosya | Amaç |
|-------|------|
| `src/lib/membership/entitlements.ts` | `FeatureKey` enum, plan → feature map |
| `src/lib/membership/resolve-entitlements.ts` | `resolveEntitlements(userId)` — tek resolver |
| `src/lib/membership/assert-entitlement.ts` | `assertEntitlement(ctx, key)` + error sınıfları |
| `src/lib/membership/types.ts` | `EntitlementContext`, `QuotaInfo`, `EntitlementSubject` |

### 6.2 Güncellenecek dosyalar

| Dosya | Ne değişecek |
|-------|--------------|
| `src/lib/membership/plans.ts` | `9999` → `null`/unlimited flag; PROFESSIONAL'a `urgentRequestPriority: true`; helper'lar consolidate |
| `src/lib/membership/get-membership.ts` | **Deprecated wrapper** → `resolveEntitlements` çağırır (geriye uyumluluk) veya silinir |
| `src/server/offer/offer-service.ts` | `getMembershipContext` → `resolveEntitlements`; `assertEntitlement('submit_offer')`; visibility check → `assertEntitlement('instant_request_access')`; kota decrement transaction içinde |
| `src/app/api/membership/route.ts` | Upgrade → `PENDING_PAYMENT` state veya dev-only flag; production'da payment webhook zorunlu |
| `src/app/panel/talepler/page.tsx` | `buildSupplierVisibilityFilter` → entitlement helper'dan |
| `src/app/panel/talepler/[id]/page.tsx` | Detay fetch'e visibility guard; kilitli talepte içerik maskeleme veya 403 |
| `src/components/panel/OfferForm.tsx` | `EntitlementContext` tipi; feature-aware UI mesajları |
| `src/app/panel/plan/page.tsx` | Expiry tarihi gösterimi |
| `src/app/panel/profil/page.tsx` | Effective plan + expiry + kalan kota detayı |
| `src/server/request/create-request.ts` | (FAZ 2) featureBoost için payment entitlement check |

### 6.3 Şema değişiklikleri (opsiyonel — FAZ 2)

| Model | Alan | Amaç |
|-------|------|------|
| `Subscription` | userId/companyId, planTier, status, expiresAt, provider | Ödeme entegrasyonu |
| `CreditLedger` | subject, delta, reason, offerId | Kredi audit trail |
| `PlanTier` enum | değişiklik yok | — |

**Not:** FAZ 1 şema değişikliği olmadan yapılabilir (`planExpiresAt` zaten var).

### 6.4 Dokunulmayacak dosyalar (bu fazda)

- `contact-filter.ts` — plan-bağımsız kalır
- `plan-visuals.ts` — sadece UI
- `PricingPlans.tsx` — pazarlama; entitlement'tan beslenmesi FAZ 2

---

## 7. Uygulama Fazları

### FAZ 1 — Sağlamlaştırma (şema değişikliği yok)

**Hedef:** Mevcut çalışan kuralları kırma; kritik bug'ları kapat.

| # | İş | Dosyalar | Kabul kriteri |
|---|-----|----------|---------------|
| 1.1 | `resolveEntitlements` + `assertEntitlement` oluştur | yeni 3–4 dosya | Tek import noktası |
| 1.2 | `planExpiresAt` kontrolü | resolve-entitlements | Süresi dolan → STANDARD |
| 1.3 | Detay sayfası visibility guard | talepler/[id]/page.tsx | URL ile bypass yok |
| 1.4 | Kota transaction-safe | offer-service.ts | Concurrent test geçer |
| 1.5 | Bonus kredi decrement düzelt | offer-service.ts | Doğru havuzdan düşer |
| 1.6 | Upgrade API dev/prod ayrımı | membership/route.ts | Prod'da mock upgrade kapalı |
| 1.7 | `getMembershipContext` → wrapper | get-membership.ts | Mevcut tüketiciler kırılmaz |

**Tahmini kapsam:** ~8 dosya, ~400–600 satır

---

### FAZ 2 — Feature registry + UI entegrasyonu

| # | İş | Kabul kriteri |
|---|-----|---------------|
| 2.1 | Tüm feature flag'leri `EntitlementContext`'e taşı | UI'da `ctx.entitlements.aiOfferAssistant` |
| 2.2 | PROFESSIONAL `urgentRequestPriority` | Acil talepler liste sıralamasında öncelik |
| 2.3 | Plan sayfasında expiry + feature listesi | Kullanıcı ne satın aldığını görür |
| 2.4 | `9999` unlimited refactor | Magic number yok |

---

### FAZ 3 — Ödeme + audit (ayrı prompt)

| # | İş |
|---|-----|
| 3.1 | Subscription tablosu + iyzico webhook |
| 3.2 | CreditLedger audit trail |
| 3.3 | featureBoost payment gate |
| 3.4 | Admin plan override |

---

## 8. Karar Noktaları (Birlikte Onaylanacak)

Implementasyon prompt'u vermeden önce şu sorular netleşmeli:

### 8.1 Subject modeli
- [ ] **A)** Plan ve kota **company bazlı** (önerilen B2B model)
- [ ] **B)** Plan ve kota **user bazlı** (daha basit MVP)
- [ ] **C)** Plan company, kota user (mevcut hibrit — önerilmez)

### 8.2 Süresi dolan plan davranışı
- [ ] **A)** Otomatik STANDARD'a düşür (grace period yok)
- [ ] **B)** 7 gün grace period, sonra STANDARD
- [ ] **C)** READ-ONLY mod (teklif veremez ama mevcut konuşmalar açık)

### 8.3 Mock upgrade (dev ortamı)
- [ ] **A)** `NODE_ENV !== 'production'` ise serbest
- [ ] **B)** `.env ALLOW_MOCK_UPGRADE=true` flag
- [ ] **C)** Tamamen kaldır, sadece seed/script ile plan ata

### 8.4 Kilitli talep detayı
- [ ] **A)** 404 / redirect (içerik hiç görünmez)
- [ ] **B)** Başlık + "Premium ile eriş" CTA, açıklama maskelenir
- [ ] **C)** Liste dışı deep link'e izin ver ama teklif engelle (mevcut — zayıf)

### 8.5 PROFESSIONAL diferansiyasyonu
- [ ] **A)** Sadece acil talep önceliği ekle (minimal fark)
- [ ] **B)** Premium + acil öncelik + gelişmiş filtreler (ayrı feature key'ler)
- [ ] **C)** Premium ile birleştir, iki plan yerine tek "Paid" plan

### 8.6 Buyer featureBoost
- [ ] **A)** FAZ 1'de dokunma (ödeme gelene kadar ücretsiz dev)
- [ ] **B)** FAZ 1'de entitlement key ekle ama gate kapalı
- [ ] **C)** FAZ 1'de tamamen gizle (UI'dan kaldır)

---

## 9. Mevcut → Hedef API Yüzeyi

### Bugün
```typescript
getMembershipContext(userId): MembershipContext
buildSupplierVisibilityFilter(membership): PrismaWhere
```

### Hedef (FAZ 1 sonrası)
```typescript
resolveEntitlements(userId): EntitlementContext

assertEntitlement(ctx, 'submit_offer'): void  // throws EntitlementError
assertEntitlement(ctx, 'instant_request_access'): void

canAccessRequest(ctx, request): boolean
buildSupplierVisibilityFilter(ctx): PrismaWhere  // ctx'ten türetilir

// Geriye uyumluluk (deprecated)
getMembershipContext(userId): MembershipContext  // → resolveEntitlements wrapper
```

---

## 10. Test Senaryoları (Implementasyon Sonrası)

| # | Senaryo | Beklenen |
|---|---------|----------|
| T1 | STANDARD user, kotası 5/5 dolu | 402 OFFER_QUOTA_EXCEEDED |
| T2 | STANDARD user, talep 1 saat önce yayınlandı | Liste yok, detay 404/maskeli |
| T3 | PREMIUM user, aynı talep | Liste + detay + teklif OK |
| T4 | PREMIUM, planExpiresAt geçmiş | STANDARD davranışı |
| T5 | 2 eşzamanlı teklif, kota 1 kaldı | Sadece 1 başarılı |
| T6 | Company Premium, User Standard | Company plan geçerli |
| T7 | POST upgrade (production) | 403 veya payment required |
| T8 | Bonus kredi 3, aylık kota dolu | 4. teklif bonus'tan düşer |
| T9 | aiOfferAssistant feature check | STANDARD → false, PREMIUM → true |
| T10 | Deep link /panel/talepler/[id] standart kilitli | İçerik görünmez |

---

## 11. Implementasyon Prompt Taslağı (Onay Sonrası)

Aşağıdaki prompt, bu plan onaylandıktan sonra Cursor'a verilebilir:

```
FAZ 1 entitlement sağlamlaştırmasını uygula:

1. src/lib/membership/ altında resolve-entitlements.ts, assert-entitlement.ts,
   entitlements.ts, types.ts oluştur (Bölüm 5–6'daki hedef mimariye göre).

2. planExpiresAt kontrolünü ekle — süresi dolmuş plan STANDARD'a düşsün.

3. offer-service.ts: resolveEntitlements kullan; submit_offer ve
   instant_request_access assert'leri ekle; kota decrement'i transaction içine al.

4. talepler/[id]/page.tsx: visibility bypass'ı kapat ([Karar 8.4]'e göre).

5. membership/route.ts: production'da mock upgrade'i kapat ([Karar 8.3]'e göre).

6. get-membership.ts'i wrapper olarak bırak — mevcut tüketiciler kırılmasın.

7. Bonus kredi decrement mantığını düzelt ([Karar 8.1]'e göre).

Kararlar:
- Subject modeli: [A/B/C]
- Expiry davranışı: [A/B/C]
- Mock upgrade: [A/B/C]
- Kilitli talep: [A/B/C]

Test: Bölüm 10 senaryolarını manuel doğrula.
Build geçmeli. Yeni test dosyası ekleme (istenmedi).
```

---

## 12. Sonuç

Mevcut sistem **MVP için yeterli** ama production'a çıkmadan önce FAZ 1 şart. En kritik üç fix:

1. **`planExpiresAt` enforcement** — sonsuz Premium sorunu
2. **Detay sayfası visibility bypass** — paywall delik
3. **Merkezi entitlement katmanı** — dağınık mantık ve gelecek feature'lar için zemin

Feature flag'lerin (`aiOfferAssistant` vb.) enforce edilmemesi şu an **beklenen** (kod yok); ama mimari hazır olmazsa her yeni özellikte aynı dağınıklık tekrarlanır.

---

**Sonraki adım:** Bölüm 8'deki karar noktalarını birlikte seçin → implementasyon prompt'unu netleştirin → FAZ 1 kodlanır.
