# 01 — Product Vision and Trust Contracts

> Etiketler: `PRODUCT-INTENT` (birincil) · ilgili kod uygulamaları `CODE-VERIFIED` ile `11-DECISION-LOG.md` içinde

## Ürün vizyonu

Talepo klasik ilan sitesi değildir. **Talep odaklı bir pazar yeridir.**

Kullanıcı ihtiyacını doğal dilde yazar. Sistem:

1. Metni anlamlandırır,
2. Gerekli birkaç bilgiyi (seçenek öncelikli) sorar,
3. Doğru tedarikçilere yönlendirir.

Talep akışı uzun form değildir. Hedef: mümkün olduğunca **15–30 saniyede** tamamlanan, seçenek öncelikli ve kategoriye özgü yönlendirme. [`PRODUCT-INTENT`]

## İki değişmez güven sözleşmesi

### 1) Alıcı engellenemez; orijinal metin kaybolamaz

Kullanıcı, katalog veya kategori eksikliği nedeniyle talep oluşturmaktan engellenemez. Orijinal talep metni (`rawInput`) kaybolamaz; **AI / `professionalDescription` onu otomatik ezemez**. [`PRODUCT-INTENT`]

Kodda kısmen uygulanmış: `rawInput` Prisma alanı, `sanitizeRawInput`, create’te professionalDescription’ın rawInput olarak kullanılmaması, unresolved soft category, authority verifier’lar. [`CODE-VERIFIED` — Phase 1]

**Dikkat (kod gerçeği):** Açık bir `rawInput` update payload’ı mevcut `update-request` yolunda alanı **geri dönüşsüz** değiştirir; versiyon/history/aktör kaydı yoktur. [`CODE-VERIFIED` — `apps/web/src/server/request/update-request.ts:155-156`]

**Politika kararı verildi (2026-08-22) — fakat henüz uygulanmadı:** İlk kullanıcı metni değiştirilemez orijinal kayıt olmalı; düzenleme üzerine yazmak yerine **yeni bir kullanıcı revizyonu** açmalı (aktör + zaman + kaynak ile); canonical understanding son revizyondan yeniden kurulmalı; anlamlı düzenlemede yeniden eşleştirme çalışmalı; bildirimler revizyon × firma bazında idempotent olmalı. Durum: **`DECIDED-NOT-IMPLEMENTED`** — ayrı şema ve davranış tasarım dilimi gerektirir. Tam metin: `11-DECISION-LOG.md` → Karar B.

**Ayrıca (kod gerçeği):** Düzenleme yolunda understanding snapshot **yeniden kurulmaz** ve re-fanout **tetiklenmez**. Yani bugün düzenlenen bir talep hem eski anlama kaydında hem eski eşleşme kümesinde kalır. [`CODE-VERIFIED` — bkz. `02` / `08` #2b]

### 2) Pro tedarikçi sessizce kaçırılmamalı

Ücretli Pro tedarikçi, uygun bir talebi sistemin kategori/marka/model hatası nedeniyle **sessizce** kaçırmamalıdır. [`PRODUCT-INTENT`]

Kodda: branch fanout hâlâ kaba kategori+şehir (`apps/web/src/server/request/distribute-request.ts`); Matching V3 shadow bu riski azaltmayı hedefler ama **fanout’a bağlı değil** (`SHADOW`). Production deploy: `PRODUCTION-STATUS-NOT-VERIFIED`. [`CODE-VERIFIED`]

## Öncelikli beş kategori

1. Emlak (`real-estate`)
2. Otomotiv (`automotive`)
3. Teknoloji (`technology`)
4. Matbaa ve Ambalaj (`printing`)
5. Beyaz Eşya (`appliances`)

[`PRODUCT-INTENT`] — engine id’leri `REQUEST_CATEGORIES` ile uyumlu. [`CODE-VERIFIED`]

## Diğer kategoriler (minimum Talepo kalite standardı)

- Mobilya ve Ofis (`furniture`)
- Makine (`machinery`)
- Sağlık (`health`)
- Bebek ve Çocuk (`baby`)
- Ev ve Mutfak (`home-kitchen`)
- Hizmetler (`services`)

Bunlar da: serbest metin kabulü, soft kategori, bütçe/konum publish kapıları, sessiz zero-match yasağı gibi minimum standardı paylaşmalıdır. [`PRODUCT-INTENT`]

## Relevance ≠ ücretli plan

Uygunluk skoru (relevance) ile Pro/Standard bildirim politikası **ayrı katmanlardır**. Ücretli plan relevance skorunu şişirmemelidir. Matching V3 delivery policy dosyası contract-only’dir. [`PRODUCT-INTENT` + `CODE-VERIFIED`]

---

**Bunu ne için yapıyoruz?**  
Teknik kararlar “ne güzel görünür” diye değil; alıcının talebinin kaybolmaması ve dürüst Pro tedarikçinin iş kaçırmaması için alınır. Bu belge o pusulayı sabitler.
