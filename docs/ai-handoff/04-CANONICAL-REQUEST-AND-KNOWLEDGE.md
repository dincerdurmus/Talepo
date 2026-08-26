# 04 — Canonical Request and Knowledge

> `CODE-VERIFIED` aksi belirtilmedikçe.

## Alan sınıfları

### Gerçek DB alanları (`Request` — `apps/web/prisma/schema.prisma`)

| Alan | Not |
|------|-----|
| `id`, `requestNumber` | Kimlik |
| `categoryId` | Prisma Category.id (cuid) — zorunlu FK |
| `title`, `description` | Legacy display/storage; Phase 1 `description` yazımı sürer |
| `rawInput` | Nullable Text; kullanıcı kaynak metni. AI/`professionalDescription` otomatik ezmemeli. Açık update payload ile değişebilir (politika açık değil). |
| `professionalDescription` | AI/Talepo okunabilir metin; rawInput yerine geçmez |
| `discoveryProjection` | Json?; taxonomy + constraints + nested `understanding` |
| `city`, `district`, `budgetMin/Max`, `currency` | Konum/bütçe kolonları |
| `status`, timestamps, moderation flags | Lifecycle |
| `matches` → `RequestMatch` | Legacy fanout kalıcılığı |

### JSON snapshot alanları

`RequestUnderstandingSnapshot` (`understanding-snapshot.ts`):

- `version`, `kind`, `profileVersion`, `builtAt`
- `rawInputRef: "request.rawInput"` (pointer; metin DB’de)
- `categoryResolution`: status, userSelected, userChoice, primary, candidates
- `entities`, `attributes`
- `unresolvedExpressions`, `confirmedFieldKeys`

Nested: `discoveryProjection.understanding` via `withUnderstandingSnapshot`.

**Matching/filter bu bloğu ignore etmeli** (dosya sözleşmesi).

⚠️ **Snapshot yalnız create yolunda kurulur.** `update-request.ts` içinde snapshot rebuild yoktur (`understanding` → 0 hit); yalnız client hazır bir `discoveryProjection` gönderirse yazılır (`:162-163`). Yani düzenlenmiş bir talepte snapshot **eski metnin** anlamını gösterebilir — ve snapshot audit authority olduğu için denetim kaydı da yanlış metni anlatır. [`CODE-VERIFIED` — 2026-08-22 denetim düzeltmesi]

### Türetilmiş alanların provenance’ı (açık boşluk)

`discoveryProjection`, create yolunda client projection göndermezse `resolveDiscoveryProjection` (`create-request.ts:46-50`) ile kurulur ve fallback zinciri şudur:

`rawInput` → `description` → **`professionalDescription` (AI metni)** → `title`

Yani türetilmiş taxonomy/constraint okuması AI metninden doğabilir. rawInput bozulmaz, ama **“bu projection hangi metinden kuruldu?” bilgisi hiçbir yerde saklanmaz**. Provenance alanı yoktur. [`CODE-VERIFIED`]

> **Bu boşluk `ce464eb` sonrasında da AÇIKTIR** (D3c). O commit besteci
> tarafındaki **alan otoritesini** tek kanonik merdivene indirdi
> (`UNKNOWN < INFERRED < VERIFIED < USER_EXPLICIT`,
> `request-understanding/provenance.ts`), ama **yayın tarafı bu bilgiyi hâlâ
> taşımıyor**: `build-projection.ts` içinde `provenance` hiç geçmez ve
> understanding snapshot yalnız `confidence` taşır. Sonuç: bir alanın değerinin
> kullanıcı beyanı mı, katalog doğrulaması mı, yoksa çıkarım mı olduğu yayın
> verisinde okunamaz. Bu yüzden `provenance_mismatch = 69` ölçümünün bugün
> **davranışsal etkisi ölçülmemiştir** — etiket ekseni yayına hiç ulaşmıyor.
> [`CODE-VERIFIED` — 2026-08-26]

### Client / composer state

- `build-state`, field answer `kind` / `value` / `softStatus`
- UI phase, focused questions, locationMode
- Entity role düzeltmeleri (`entity-roles.ts`)

### Hesaplanan / geçici

- Publish readiness blocking labels
- Category guidance display
- AI confidence scores (normalize 0..1 snapshot’ta)

### Vizyon seviyesi (henüz DB’de yok / kısmi)

- Match result persistence for V3 tiers/reasons
- Notification delivery log (V3 contract tipi var, tablo wiring yok — `NOT-VERIFIED` ayrı tablo)
- Human review queue persistence
- Exhaustive supplier expertise as first-class DB model
- **rawInput revizyon zinciri** — append-only kullanıcı revizyonları + aktör/zaman/kaynak alanları; güncel canonical understanding’in son revizyondan yeniden kurulması. Karar verildi, şema yok → `DECIDED-NOT-IMPLEMENTED` (bkz. `11`)
- **Projection/snapshot provenance alanı** — türetilmiş okumanın hangi kaynak metinden kurulduğu (`raw_input` | `description` | `professional_description` | `title` | `client`)
- **Bildirim idempotency anahtarı** — revizyon × firma bazında dedupe (`notification.createMany` bugün dedupe’suz)

## Kavram durumu

| Kavram | Durum |
|--------|--------|
| rawInput | DB + sanitize + authority tests. **Sözleşme:** kullanıcı kalıcı kaynak metin; AI/professionalDescription otomatik ezemez. **Kod gerçeği:** açık `rawInput` update payload mevcut kodda alanı **geri dönüşsüz** değiştirir (`update-request.ts:155-156`); versiyon/history/aktör kaydı yok [`CODE-VERIFIED`]. **Ürün kararı (2026-08-22):** ilk metin değiştirilemez olmalı, düzenleme yeni bir kullanıcı revizyonu açmalı — `DECIDED-NOT-IMPLEMENTED`, bkz. `11-DECISION-LOG.md`. |
| professionalDescription | DB; create yolunda rawInput olarak kullanılmaz (`create-request.ts`) |
| primary category | Snapshot slug + DB `categoryId` (iki dünya) |
| category candidates | Snapshot candidates[] |
| confidence | Snapshot candidate confidence |
| taxonomy leaf/ancestors | discoveryProjection + Matching V3 envelope |
| product/brand/family/model/variant | Entities + product-identity; variant kısmi |
| attributes | Snapshot + field values |
| confirmed fields | `confirmedFieldKeys` |
| soft answers | Scheduler softStatus parse |
| unresolved expressions | Snapshot array |
| userChoice | CategoryUserChoice enum |
| profile/model version | `UNDERSTANDING_PROFILE_VERSION` |
| provenance | source ai/user/system on candidates |

## Knowledge Engine haritası

| Kaynak | Yol | Rol |
|--------|-----|-----|
| REQUEST_CATEGORIES | `lib/request-category-engine.ts` | 11 browse kök + keywords + form hints |
| data/taxonomy | `data/taxonomy/**`, `manifest.json` | Leaf/node graf (~1239 node drift test) |
| Prisma Category | schema + DB | Fanout FK authority |
| Category keywords | engine keywords | Heuristik detect (deprecated detectCategory) |
| CatalogRegistry / automotive / tech brands | knowledge + product-identity | Marka/model adayları |
| Alias/synonym | çeşitli parser + matching-v3 aliases fixtures | Çakışma riski |
| Product phrase lexicon | `request-composer/v2/product-phrase-lexicon.ts` | Ürün span |
| Question profiles | `question-profiles.ts` | Soru beyni |
| Supplier inventory / alerts / saved search | monetization + company relations | Legacy yan yollar |

## Drift riski (açık)

Birden fazla “kategori gerçeği” birlikte yaşar:

1. `REQUEST_CATEGORIES.id` (slug-like engine id)
2. Prisma `Category.id` (cuid) + `Category.slug`
3. Taxonomy `tax:…` node ids
4. Understanding snapshot `primary.slug`
5. Matching V3 envelope: `primaryCategoryDbId` vs `primaryCategorySlug` vs `taxonomyNodeIds`

Yanlış namespace birleştirme → yanlış fanout veya sahte EXACT. Taxonomy drift verifier `diger` çoklu parent çarpışmasını belgeler. [`TEST-VERIFIED`]

---

**Bunu ne için yapıyoruz?**  
“Kategori” kelimesinin üç farklı kimlik sistemine işaret edebileceğini yazıyoruz; böylece bir sonraki ajan yanlışlıkla cuid ile slug’ı eşitleyip Pro’ya yanlış talep göndermez / kaçırmaz.
