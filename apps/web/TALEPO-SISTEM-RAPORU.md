# Talepo — Sistem Çalışma Prensibi ve Özellik Raporu

**Hazırlayan:** Talepo AI analiz raporu  
**Tarih:** 9 Ağustos 2026  
**Kapsam:** `apps/web` — Next.js tabanlı B2B tedarik ve talep platformu  
**Hedef kitle:** Ürün yönetimi, yatırımcı brifingi, teknik roadmap planlama

---

## 1. Executive Summary

Talepo, **alıcıların doğal dilde talep oluşturduğu**, **firmaların bu taleplere teklif verdiği** ve **teklif kabulünden sonra mesajlaşmanın açıldığı** bir B2B pazar yeri platformudur.

Platformun temel değer önerisi üç eksende toplanır:

1. **Alıcı tarafı:** Talep oluşturmak ücretsiz; AI destekli form yapılandırma ile hızlı ve düzenli talep yayını.
2. **Firma tarafı:** Gerçek alıcılara erken ulaşma, sınırlı/ sınırsız teklif hakkı, plan bazlı erişim hızı.
3. **Platform tarafı:** Abonelik, teklif kredisi ve talep öne çıkarma gelir modeli.

**Mevcut durum:** Fonksiyonel bir MVP. Talep → teklif → kabul → mesajlaşma akışı veritabanı destekli ve çalışır durumda. Ödeme entegrasyonu, gerçek firma eşleştirmesi, LLM tabanlı AI ve kurumsal özellikler henüz tamamlanmamış veya mock seviyesindedir.

---

## 2. Teknoloji Altyapısı

| Katman | Teknoloji | Not |
|--------|-----------|-----|
| Framework | Next.js 16.2 (App Router) | React Server Components + API Routes |
| UI | React 19, Tailwind CSS 4 | Lucide ikon seti |
| Dil | TypeScript 5 | Strict tip güvenliği |
| Veritabanı | PostgreSQL (Supabase) | Prisma 7.8 ORM |
| Kimlik doğrulama | NextAuth v4 | Google OAuth, JWT session |
| AI | Kural tabanlı motor | Harici LLM API yok |
| Dağıtım | Node.js | `npm run build` / `npm run start` |

### Mimari katmanlar

```
┌─────────────────────────────────────────────────────────┐
│  İstemci (React)                                        │
│  /talep · /panel/* · Ana sayfa · Giriş/Kayıt           │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  AI Core (client-side, kural tabanlı)                   │
│  Parser → Knowledge → Pricing → Matching → Composer     │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  API Routes (Next.js)                                   │
│  /api/requests · /api/offers · /api/membership · ...    │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Server Services                                        │
│  create-request · offer-service · send-message · ...    │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  PostgreSQL (Prisma)                                    │
│  User · Company · Request · Offer · Conversation · ...  │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Kullanıcı Rolleri ve İş Modeli

### 3.1 Alıcı (Talep oluşturan)

- Google ile giriş yapar.
- `/talep` sayfasında ihtiyacını serbest metin olarak yazar.
- AI Core kategoriyi, teknik alanları ve profesyonel metni otomatik üretir.
- Talebi yayınlar; firmalardan teklif alır.
- Teklif kabul eder; mesajlaşma açılır.
- **Ödeme yapmaz** (talep oluşturma ücretsiz).
- İsteğe bağlı: "Acil alıcıyım" (ücretsiz) veya talep öne çıkarma (₺99–₺349, ödeme henüz bağlı değil).

### 3.2 Firma (Teklif veren)

- Google ile giriş yapar.
- `/panel/talepler` üzerinden açık talepleri keşfeder.
- Uygun taleplere teklif verir.
- Planına göre:
  - **Standart:** Ayda 5 teklif, yeni taleplere 24 saat gecikmeli erişim.
  - **Premium+:** Anında erişim, sınırsız teklif, AI araçları (planlanmış).
- Teklif kabul edilirse alıcıyla mesajlaşır.

### 3.3 Platform gelir kaynakları

| Gelir kalemi | Fiyat | Durum |
|--------------|-------|-------|
| Premium plan | ₺990/ay | Tanımlı, ödeme mock |
| Profesyonel plan | ₺2.490/ay | Tanımlı, ödeme mock |
| Kurumsal plan | Özel fiyat | Tanımlı, satış kanalı yok |
| Ek teklif paketi (5/10/25) | ₺149 / ₺249 / ₺499 | Tanımlı, ödeme mock |
| Talep öne çıkarma (24s/3g/7g) | ₺99 / ₺199 / ₺349 | DB'ye yazılıyor, ödeme mock |

**Temel prensip:** Alıcı tarafı ücretsiz büyür; firma tarafı hız, erişim ve AI ile monetize edilir.

---

## 4. Veritabanı Modeli

### 4.1 Ana varlıklar

| Model | Açıklama |
|-------|----------|
| **User** | Kullanıcı profili, plan tier, bonus teklif kredileri |
| **Company** | Firma profili, doğrulama, kendi plan tier'ı |
| **CompanyMember** | Ekip üyeliği (OWNER → VIEWER), davet akışı |
| **Category** | Pazar yeri kategorileri |
| **RequestForm / FormField** | Kategori bazlı dinamik formlar |
| **Request** | Alıcı talepleri (AI skoru, öne çıkarma, görünürlük gecikmesi) |
| **RequestFieldValue** | Talebe özel dinamik alan değerleri |
| **Offer** | Firma teklifleri |
| **Conversation / Message** | Teklif kabulü sonrası mesajlaşma |
| **Notification** | Olay bazlı bildirimler |

### 4.2 Kritik iş kuralları (şema seviyesinde)

- `Request.visibleToSuppliersAt` — Standart firmalar bu tarihten sonra talebi görür.
- `Request.isFeatured / featuredUntil` — Öne çıkan talep bayrakları.
- `Request.isUrgent` — Acil alıcı işareti.
- `User.planTier / Company.planTier` — Üyelik seviyesi.
- `Offer.status` — SUBMITTED → ACCEPTED / REJECTED yaşam döngüsü.

### 4.3 Henüz UI/API'si olmayan şema özellikleri

- Firma oluşturma ve doğrulama akışı
- Ekip daveti ve rol yönetimi
- Kategori önerisi onay süreci (`CategorySuggestion`)
- Dosya tipi mesajlar (şema var, UI yok)

---

## 5. Sayfa ve Rota Haritası

### 5.1 Herkese açık sayfalar

| Rota | Amaç | Durum |
|------|------|-------|
| `/` | Landing: hero, kategoriler, planlar, istatistikler | UI tam, veri mock |
| `/giris` | Google OAuth giriş | ✅ Çalışır |
| `/kayit` | Kayıt ekranı (alıcı/firma/ikisi) | ⚠️ Sadece Google çalışır |
| `/talep` | AI destekli talep oluşturma | ✅ Çalışır |

### 5.2 Panel (giriş zorunlu)

| Rota | Amaç | Durum |
|------|------|-------|
| `/panel` | Dashboard: özet istatistikler, son bildirimler | ✅ |
| `/panel/taleplerim` | Kullanıcının talepleri | ✅ |
| `/panel/taleplerim/[id]` | Talep detayı, gelen teklifler, kabul/red | ✅ |
| `/panel/talepler` | Açık talepleri keşfet (plan filtresi) | ✅ |
| `/panel/talepler/[id]` | Talep detayı + teklif formu | ✅ |
| `/panel/mesajlar` | Konuşma listesi | ✅ |
| `/panel/mesajlar/[id]` | Mesaj thread'i | ✅ |
| `/panel/plan` | Plan yönetimi, kredi paketleri | ⚠️ Ödeme mock |
| `/panel/profil` | Profil görüntüleme | ⚠️ Salt okunur |
| `/panel/bildirimler` | Bildirim listesi | ⚠️ Okundu işaretleme yok |

### 5.3 Eksik rotalar (UI'da link var, sayfa yok)

- `/kategoriler`
- `/kullanim-kosullari`
- `/gizlilik-politikasi`

---

## 6. API Uç Noktaları

| Method | Endpoint | İşlev | Durum |
|--------|----------|-------|-------|
| `*` | `/api/auth/[...nextauth]` | OAuth oturum yönetimi | ✅ |
| `POST` | `/api/requests` | Talep oluştur ve yayınla | ✅ |
| `POST` | `/api/offers` | Teklif gönder | ✅ |
| `POST` | `/api/offers/[id]` | Teklif kabul / red | ✅ |
| `POST` | `/api/conversations/[id]/messages` | Mesaj gönder | ✅ |
| `GET` | `/api/membership` | Üyelik bağlamı | ✅ |
| `POST` | `/api/membership` | Plan yükselt / kredi satın al | ⚠️ Ödeme yok |

**Henüz olmayan API'ler:** profil güncelleme, firma CRUD, bildirim okundu, dosya yükleme, teklif geri çekme, talep iptali.

---

## 7. Talep Oluşturma Akışı (Detaylı)

```
1. Kullanıcı /talep sayfasına gelir
2. Serbest metin yazar: "bağcılarda kiralık ev arıyorum"
3. Client-side AI Core çalışır (runTalepoAiCore)
   ├── Kategori tespiti → Emlak
   ├── Entity extraction → ilan türü, konut türü, konum
   ├── Eksik alan önerileri
   ├── Fiyat aralığı tahmini (mock katsayılar)
   ├── Firma sayısı tahmini (mock)
   └── Profesyonel başlık + açıklama metni
4. Kullanıcı kategori/alanları düzenler
5. "Talebimi yayınla" veya "AI sürümünü yayınla" tıklar
6. POST /api/requests
   ├── requireUser() — oturum kontrolü
   ├── parseCreateRequestInput() — validasyon
   └── createRequest()
       ├── Category + RequestForm + FormField upsert
       ├── Request kaydı (status: PUBLISHED)
       ├── visibleToSuppliersAt = now + 24h (standart erişim)
       ├── isFeatured / featuredUntil (boost seçildiyse)
       ├── RequestFieldValue kayıtları
       └── REQUEST_PUBLISHED bildirimi
7. Yönlendirme → /panel/taleplerim/[id]
```

### 7.1 Desteklenen kategoriler (7 adet)

| ID | Kategori | Örnek alanlar |
|----|----------|---------------|
| `printing` | Matbaa ve Ambalaj | Ölçü, kağıt gramajı, selefon |
| `automotive` | Otomotiv Yedek Parça | Marka, model, parça |
| `machinery` | Makine ve Ekipman | Makine tipi, kapasite |
| `furniture` | Mobilya ve Ofis | Mobilya tipi, adet |
| `technology` | Teknoloji ve Yazılım | Çözüm tipi, destek |
| `real-estate` | Emlak | İlan türü, konut türü, oda, m² |
| `services` | Hizmetler | Hizmet tipi, kapsam |

Her kategorinin kendi `commonFields` (başlık, şehir, bütçe vb.) ve `fields` (dinamik teknik alanlar) seti vardır.

---

## 8. AI Core — Çalışma Prensibi

> **Önemli:** Talepo AI Core harici bir LLM kullanmaz. Tamamen kural tabanlı (heuristic) bir motordur. Client-side çalışır; sunucuya AI API çağrısı gitmez.

### 8.1 Pipeline

```
Kullanıcı metni
    ↓
parser/parser.ts          → Kategori + entity çıkarımı
    ↓
knowledge/index.ts        → Tamlık skoru + eksik bilgi notları
    ↓
pricing/estimate.ts       → Kategori bazlı fiyat aralığı (mock tablolar)
    ↓
matching/companyMatcher.ts → Tahmini firma sayısı (sabit katsayılar)
    ↓
recommendations/recommendationEngine.ts → Eksik alan önerileri
    ↓
request-text-composer.ts  → Profesyonel başlık + açıklama metni
    ↓
orchestrator.ts           → Skor (0–100) + birleşik sonuç
```

### 8.2 Parser yetenekleri

- **Kategori tespiti:** Anahtar kelime eşleştirme (`category.ts`)
- **Şehir/ilçe:** İstanbul ilçeleri dahil lokasyon sözlüğü (`entity.ts`)
- **Miktar, bütçe, teslim süresi:** Regex tabanlı çıkarım
- **Kategori özel attribute'lar:**
  - Otomotiv: marka, model, yıl, parça
  - Emlak: kiralık/satılık, daire/villa, oda, m²
  - Matbaa: ölçü, kağıt, selefon

### 8.3 Metin oluşturucu (request-text-composer)

Kullanıcı metninden tekrarsız, okunabilir talep metni üretir:

- Emlak: *"Bağcılar'da kiralık daire arıyorum."*
- Teknik detaylar madde işaretli listelenir
- Teklif talimatı kategoriye göre eklenir

### 8.4 AI özellik durumu

| Özellik | Durum | Not |
|---------|-------|-----|
| Kategori tespiti | ✅ Çalışır | Keyword tabanlı |
| Entity extraction | ✅ Çalışır | Regex + sözlük |
| Eksik alan önerileri | ✅ Çalışır | Kural tabanlı |
| Profesyonel metin | ✅ Çalışır | Şablon + composer |
| Talep kalite skoru | ✅ Çalışır | Heuristic |
| Fiyat tahmini | ⚠️ Mock | Sabit kategori tabloları |
| Firma eşleştirme | ⚠️ Mock | Sabit sayılar |
| AI teklif asistanı | ❌ Planlanmış | Premium feature flag var, kod yok |
| Gelişmiş fiyat analizi | ❌ Planlanmış | Premium feature flag var, kod yok |

---

## 9. Üyelik ve Erişim Kontrolü

### 9.1 Plan karşılaştırması

| Özellik | Standart | Premium | Profesyonel | Kurumsal |
|---------|----------|---------|-------------|----------|
| Aylık teklif | 5 | Sınırsız | Sınırsız | Sınırsız |
| Talep erişim gecikmesi | 24 saat | Anında | Anında | Anında |
| AI teklif asistanı | ❌ | ✅* | ✅* | ✅* |
| Talep bildirim kuralları | ❌ | ✅* | ✅* | ✅* |
| Acil talep önceliği | ❌ | ❌ | ✅* | ✅* |
| Gizli envanter | ❌ | ❌ | ❌ | ✅* |
| Fiyat | Ücretsiz | ₺990/ay | ₺2.490/ay | Özel |

*\* Feature flag tanımlı; uygulama kodu henüz yazılmadı.*

### 9.2 Uygulanan kontroller

1. **Teklif kotası** — `offer-service.ts` aylık kullanımı sayar, limit aşımında 402 döner.
2. **Görünürlük gecikmesi** — Standart firmalar `visibleToSuppliersAt` öncesinde talebi göremez.
3. **İletişim filtresi** — Teklif ve mesajlarda telefon, IBAN, harici link engellenir (`contact-filter.ts`).
4. **Mesajlaşma kapısı** — Sadece ACCEPTED tekliflerde mesaj gönderilebilir.
5. **Plan çözümleme** — Aktif firma üyeliği varsa firma planı, yoksa kullanıcı planı geçerli.

---

## 10. Teklif ve Mesajlaşma Yaşam Döngüsü

### 10.1 Teklif akışı

```
Firma talep görür (/panel/talepler/[id])
    ↓
Teklif formu doldurur (tutar, açıklama, teslim süresi)
    ↓
POST /api/offers
    ├── Kotası kontrol edilir
    ├── Görünürlük gecikmesi kontrol edilir
    ├── İletişim bilgisi filtrelenir
    └── Offer status: SUBMITTED
    ↓
Alıcı bildirim alır (NEW_OFFER)
    ↓
Alıcı kabul veya red eder
    ├── Kabul → Offer: ACCEPTED, diğerleri REJECTED
    │          Request: OFFER_SELECTED
    │          Conversation otomatik oluşturulur
    └── Red → Offer: REJECTED
```

### 10.2 Mesajlaşma akışı

```
Teklif kabul edildi
    ↓
Conversation + Participants oluşturulur
    ↓
/panel/mesajlar/[id] — thread görüntülenir
    ↓
POST /api/conversations/[id]/messages
    ├── Offer ACCEPTED mi? (gate)
    ├── İletişim bilgisi filtrelenir
    └── NEW_MESSAGE bildirimi
```

**Eksikler:** Gerçek zamanlı güncelleme (WebSocket/polling), dosya/görsel mesaj UI'ı, okundu bilgisi (kısmen var).

---

## 11. Bildirim Sistemi

Otomatik oluşturulan bildirim türleri:

| Tür | Tetikleyici |
|-----|-------------|
| `REQUEST_PUBLISHED` | Talep yayınlandı |
| `NEW_OFFER` | Yeni teklif geldi |
| `OFFER_ACCEPTED` | Teklif kabul edildi |
| `OFFER_REJECTED` | Teklif reddedildi |
| `NEW_MESSAGE` | Yeni mesaj |

**Eksik:** Okundu/arsivleme API'si, e-posta/push entegrasyonu, bildirim tercihleri.

---

## 12. Tamamlanan vs Eksik Özellikler

### ✅ Production-ready (çalışır)

- Google OAuth + Prisma kullanıcı senkronizasyonu
- AI destekli talep oluşturma (client-side)
- Dinamik kategori/form persistansı
- Talep listeleme ve detay (alıcı + firma tarafı)
- Plan bazlı talep görünürlük filtresi
- Teklif gönderme, kabul, red
- Teklif sonrası mesajlaşma
- Üyelik kotası ve erişim gecikmesi enforcement
- İletişim bilgisi filtreleme
- Panel dashboard ve navigasyon
- Plan sayfası UI (renkli kartlar)

### ⚠️ Kısmen tamamlanmış

- AI fiyat tahmini ve firma eşleştirmesi (mock veri)
- Üyelik yükseltme (DB güncellenir, ödeme yok)
- Talep öne çıkarma / acil alıcı (DB'ye yazılır, ödeme yok)
- Profil sayfası (salt okunur)
- Bildirimler (listeleme var, okundu yok)
- Kayıt sayfası (UI var, email formu çalışmıyor)
- Ana sayfa istatistikleri ve öne çıkan talepler (mock)

### ❌ Henüz yapılmamış

- Ödeme entegrasyonu (Stripe / iyzico)
- Firma kayıt ve doğrulama UI
- Ekip yönetimi ve davet sistemi
- AI teklif asistanı (Premium)
- Talep bildirim kuralları / alert engine
- Gizli envanter eşleştirme (Kurumsal)
- Gerçek zamanlı mesajlaşma
- Dosya ekleme (talep + mesaj)
- LLM entegrasyonu
- Mobil uygulama
- Admin paneli
- RLS / güvenlik politikaları (Supabase tablolarında RLS kapalı)

---

## 13. Güvenlik ve Risk Notları

| Konu | Durum | Öneri |
|------|-------|-------|
| Kimlik doğrulama | Google OAuth + JWT | Email/şifre eklenirse bcrypt + rate limit |
| API yetkilendirme | `requireUser()` middleware | Rol bazlı erişim (RBAC) genişletilmeli |
| İletişim sızıntısı | Regex filtre var | ML tabanlı gelişmiş filtre düşünülebilir |
| Supabase RLS | Kapalı (19 tablo) | Production öncesi mutlaka açılmalı |
| Ödeme | Yok | PCI uyumlu gateway (iyzico önerilir) |
| Dosya yükleme | Yok | Signed URL + virüs taraması gerekli |

---

## 14. Yenilik ve Geliştirme Önerileri

Aşağıdaki öneriler mevcut altyapı, pazar konumlandırması ve gelir modeli dikkate alınarak hazırlanmıştır. Öncelik sırası: **yüksek iş etkisi + mevcut altyapıya uyum**.

---

### 14.1 Kısa vade (0–3 ay) — MVP'yi gelire hazır hale getir

#### 1. Ödeme entegrasyonu (iyzico / Stripe)
**Neden:** Gelir modeli tanımlı ama para akışı yok.  
**Ne yapılır:** `/api/membership` POST'a gerçek ödeme webhook'u; plan yükseltme ve kredi paketi satın alma.  
**Etki:** İlk gelir kapısı açılır.

#### 2. Firma onboarding akışı
**Neden:** Şema hazır, UI yok; teklif veren taraf büyüyemez.  
**Ne yapılır:** Firma profili oluşturma, kategori seçimi, vergi no, logo; `CompanyStatus` doğrulama pipeline'ı.  
**Etki:** Gerçek B2B tedarikçi havuzu oluşur.

#### 3. Gerçek firma eşleştirmesi
**Neden:** AI matching mock; platform değeri düşük algılanır.  
**Ne yapılır:** `CompanyCategory` + şehir + plan tier üzerinden DB sorgusu; `/talep` ekranında gerçek firma sayısı.  
**Etki:** "Kaç firma görecek?" sorusuna gerçek cevap.

#### 4. Profil düzenleme + bildirim okundu
**Neden:** Temel kullanıcı beklentisi.  
**Etki:** Retention artar, destek yükü azalır.

#### 5. Supabase RLS politikaları
**Neden:** Güvenlik açığı; production riski.  
**Etki:** Veri izolasyonu, güven.

---

### 14.2 Orta vade (3–6 ay) — Farklılaştırıcı AI ve operasyon

#### 6. LLM destekli talep anlama (GPT / Claude API)
**Neden:** Kural tabanlı parser sınırlı; karmaşık taleplerde hata yapar.  
**Ne yapılır:** Serbest metin → structured JSON; mevcut `request-category-engine` ile birleştir.  
**Etki:** Kategori doğruluğu ve metin kalitesi sıçrar.

#### 7. AI Teklif Asistanı (Premium özellik)
**Neden:** Premium planın ana satış argümanı; kod yok.  
**Ne yapılır:** Talep + firma profiline göre teklif taslağı, fiyat önerisi, rekabet analizi.  
**Etki:** Premium dönüşüm oranı artar.

#### 8. Talep bildirim kuralları (Alert Engine)
**Neden:** Profesyonel/Kurumsal plan özelliği; firmaların pasif beklemesini bitirir.  
**Ne yapılır:** "Bağcılar + kiralık daire + max ₺30.000" gibi kurallar; e-posta/push ile anında bildirim.  
**Etki:** Premium plan stickiness.

#### 9. Teklif karşılaştırma paneli (alıcı tarafı)
**Neden:** Alıcı birden fazla teklif aldığında karar vermek zor.  
**Ne yapılır:** Yan yana fiyat, teslim süresi, firma puanı karşılaştırması.  
**Etki:** Platform içinde kalma süresi artar.

#### 10. Firma performans skoru ve rozet sistemi
**Neden:** Güven oluşturur; alıcı kararını kolaylaştırır.  
**Ne yapılır:** Yanıt süresi, kabul oranı, tamamlanan iş sayısı → rozet.  
**Etki:** Kaliteli firmalar öne çıkar, kötü davranış cezalandırılır.

---

### 14.3 Uzun vade (6–12 ay) — Platform genişlemesi

#### 11. Gizli envanter eşleştirme (Kurumsal)
**Neden:** Kurumsal planın killer feature'ı.  
**Ne yapılır:** Firmalar stok/ürün listesi yükler; yeni talep geldiğinde otomatik eşleşme önerisi (ve firma onayı).  
**Etki:** Kurumsal satış kapısı; yüksek ARPU.

#### 12. Bütçe değişim bildirimi
**Neden:** Alıcı bütçe revize ettiğinde firmalar haberdar olmalı.  
**Etki:** Teklif yenileme oranı artar.

#### 13. Sözleşme ve sipariş yönetimi
**Neden:** Teklif kabul sonrası platform dışına kaçışı önler.  
**Ne yapılır:** Dijital sözleşme, milestone takibi, teslim onayı.  
**Etki:** Transaction fee modeli mümkün hale gelir.

#### 14. Piyasa fiyat endeksi
**Neden:** Talepo verisi biriktikçe unique asset oluşur.  
**Ne yapılır:** Kategori + bölge bazlı ortalama teklif fiyatları; firmalara benchmark raporu (Profesyonel plan).  
**Etki:** Data moat; rakiplerin kopyalayamayacağı değer.

#### 15. WhatsApp / SMS bildirim entegrasyonu
**Neden:** B2B kullanıcılar e-postayı geç kontrol eder.  
**Etki:** Yanıt süresi düşer, platform aktivitesi artar.

#### 16. Çoklu dil desteği
**Neden:** İhracat/tedarik talepleri için genişleme.  
**Etki:** Yeni pazar segmentleri.

#### 17. Mobil uygulama (React Native / PWA)
**Neden:** Saha satış ekipleri ve küçük firmalar mobil-first.  
**Etki:** Teklif verme frekansı artar.

#### 18. Admin ve moderasyon paneli
**Neden:** Kategori onayı, firma doğrulama, uyuşmazlık yönetimi.  
**Etki:** Operasyonel ölçeklenebilirlik.

---

### 14.4 Stratejik / diferansiyasyon fikirleri

| Fikir | Açıklama | Potansiyel etki |
|-------|----------|-----------------|
| **Talep kalitesi garantisi** | AI skoru düşük talepler yayınlanmadan uyarı | Platform kalitesi |
| **Reverse auction** | Alıcı açık artırma modunda en düşük teklifi seçer | Fiyat şeffaflığı |
| **Referans programı** | Firma davet eden firmaya kredi | Viral büyüme |
| **Sektör bazlı landing page'ler** | `/emlak`, `/matbaa` SEO odaklı sayfalar | Organik trafik |
| **API / webhook marketplace** | ERP entegrasyonu (Logo, Mikro, SAP) | Kurumsal satış |
| **Escrow ödeme** | Platform üzerinden güvenli ödeme tutma | Transaction fee |
| **AI dolandırıcılık tespiti** | Sahte talep / spam firma filtreleme | Güven |
| **Video teklif sunumu** | Firma 2 dk video ile teklif açıklar | Diferansiyasyon |

---

## 15. Önerilen Roadmap Özeti

```
FAZ 1 (Şimdi)          FAZ 2 (3 ay)           FAZ 3 (6 ay)           FAZ 4 (12 ay)
─────────────────────────────────────────────────────────────────────────────────────
✅ Talep oluşturma      Ödeme (iyzico)         LLM entegrasyonu       Gizli envanter
✅ Teklif sistemi       Firma onboarding       AI teklif asistanı     Sözleşme yönetimi
✅ Mesajlaşma           Gerçek matching        Alert engine           Piyasa endeksi
✅ Plan mantığı         Profil düzenleme       Teklif karşılaştırma   Mobil app
⚠️ Mock AI/pricing     RLS güvenlik           Firma skoru/rozet      Admin panel
                       Bildirim okundu        WhatsApp entegrasyon   API marketplace
```

---

## 16. Sonuç

Talepo, **B2B tedarik pazar yerlerinin temel döngüsünü** (talep → teklif → anlaşma → iletişim) başarıyla kurmuş bir MVP'dir. Ürün vizyonu net: alıcı ücretsiz, firma hız ve erişim için öder.

**En kritik üç eksik:**
1. Para akışı (ödeme)
2. Gerçek firma havuzu (onboarding)
3. Gerçek AI değeri (LLM + DB-backed matching)

Bu üçü tamamlandığında platform, tanımlanan gelir modelini test etmeye ve ilk paying customer'a ulaşmaya hazır hale gelir.

---

*Bu rapor `apps/web` kod tabanının 9 Ağustos 2026 tarihli analizine dayanmaktadır.*
