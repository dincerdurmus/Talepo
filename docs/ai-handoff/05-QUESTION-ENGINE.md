# 05 — Question Engine

> `CODE-VERIFIED` — `question-scheduler.ts`, `publish-readiness.ts`, `question-control-registry.ts`, `question-profiles.ts`, Phase 2 verifier’lar.

## Metinden çıkan vs sorulan

**Genelde metinden / identity’den:** product, brand, model/family adayları, kategori candidates, bazı attributes (lexicon/hints).

**Tekrar sorulmayan:** `isFieldSatisfied` true olan alanlar (değer, soft status, budget/location kuralları).

## Önem seviyeleri

Profile importance (ör. `routing_critical`, `quote_critical`, ve daha düşükler) — `question-profile-types` + `importanceRank`. Critical alanlarda text_fallback yasak (`question-control-registry`).

## Ekran başına / toplam

- **Bir ekranda:** en fazla **3** soru (`MAX_VISIBLE = 3`). [`CODE-VERIFIED`]
- **Toplam akış 3 ile sınırlı değil** — dosya yorumu: groups answers geldikçe ilerler. [`CODE-VERIFIED`]
- Scheduler verifier: focused selectVisible ≤ 3. [`TEST-VERIFIED`]

## Budget / location garantisi

`global-core-profile` + `publish-readiness`:

- Budget publish için `isBudgetSatisfiedForPublish`
- Location: nationwide / remote / no_preference veya `il/ilçe` çifti
- Hazır değilse primary CTA `review`/`publish` açılmaz (blocking labels)

[`CODE-VERIFIED`]

## Soft cevaplar

`softStatus`: `open_to_offers`, `unknown`, `no_preference`, `flexible` (TR eş anlamlı parse). Optional skip publish_required’ı karşılamaz.

**Saklama:** Ayrı softAnswers tablosu yok. UI soft seçince `/talep` kanonik **Türkçe VALUE etiketleri** yazar (ör. `"Teklifleri görmek istiyorum"`, `"Henüz bilmiyorum"`, `"Türkiye geneli"`); scheduler `parseSoftStatus` ile yeniden okur. [`CODE-VERIFIED` — `apps/web/src/app/talep/page.tsx`, `apps/web/src/lib/request-composer/v2/question-scheduler.ts`]

## Location — emlak özel kuralı

Non-RE: nationwide / remote / no_preference veya `il/ilçe`.  
**Real-estate:** `realEstateComplete === true` (il+ilçe); soft nationwide/remote ile publish bypass **yok**. [`CODE-VERIFIED`]

## Review ne zaman

Budget+location (+ diğer blocking yok) → review/publish CTA yolu. Review display ayrı formatlanır (`review-display.ts`).

## Text fallback

- Critical (`routing_critical` / `quote_critical`): `text_fallback` **yasak** (registry assert).
- Descriptive non-critical: fallback olabilir.

## Seçenekli alanlar

`option-providers.ts` + control types (select, chips, vb.). Controls verifier geniş fixture seti. [`TEST-VERIFIED` 128]

## Kategori profilleri

`question-profiles.ts` satırları kategori listeleriyle: real-estate, automotive, printing, technology, appliances, services, health, furniture, machinery, baby, home-kitchen — **derinlik eşit değil**. Öncelikli 5’te daha fazla alana özel satır var; diğerleri global core + daha az spesifik profile ile minimum standarda yaklaşır. [`CODE-VERIFIED` / kısmi derinlik `NOT-VERIFIED` ürün ölçümü]

## Örnek ifadeler (kod/test yüzeyi)

| Örnek | Kod/test yüzeyi | Not |
|-------|-----------------|-----|
| Arçelik 55 inç televizyon | product-identity + appliances/tech profiles; Matching V3 golden TV | Brand+product; inç attribute hints |
| Arçelik A55 D 55 inç televizyon | brand/model ayrımı + A55 cross-brand tests (V3) | Model vs screen size karışma riski |
| 5000 adet broşür | printing quantity profiles; golden brochure | Quantity kritik |
| Heidelberg SM 74 nemlendirme pompası | printing brand/model; V3 parts vs water-pump | Part vs machine |
| 2+1 satılık daire | re-semantics verifier; RE profiles | Listing intent |
| 2019 Renault Clio | automotive year/brand/model | Year attribute |
| Bosch Serie 6 çamaşır | family + appliances; domain split vs auto | Family ≠ model |
| Bebek arabası | baby product; free-text OK | Catalog miss engel değil |
| 12.000 BTU klima | klima/appliance yönü var; `capacityBtu` schema alias’ı var | **Gap:** `number-role` / understand pipeline’da özel BTU extractor **bulunamadı** [`CODE-VERIFIED`] |
| Uzaktan logo tasarım | services remote + logo product | Remote location soft |

Tam E2E browser kanıtı bu handoff’ta koşulmadı (`NOT-VERIFIED` runtime UX).

## Yanlış bilgi üretim riskleri

1. Product span’ın brand/model sayılması
2. A55 gibi model ile inç/ekran karışması (TV gate Galaxy A55’i engeller; `A55 D` korunur — phase2 fixture)
3. Bosch appliance vs automotive brand çarpışması
4. Heidelberg “pompa” → genel su pompası alias
5. `detectCategory` deprecated heuristiğin yanlış UX hint’i
6. Kullanıcı yanlış primary seçince entity rescue’ye bağımlılık
7. Soft “bilmiyorum”un publish_required’ı yanlış karşılaması (kod engeller; UX kopyası riski)
8. BTU kapasitesinin schema’da olup understanding’de çıkarılmaması → eksik attribute / yanlış soru

---

**Bunu ne için yapıyoruz?**  
Alıcıya gereksiz form doldurtmadan, teklif için şart olan bütçe/konum ve kategoriye özgü birkaç seçimi hızlıca netleştirmek; yanlış “serbest metin kutusu” ile kritik alanı sulandırmamak.
