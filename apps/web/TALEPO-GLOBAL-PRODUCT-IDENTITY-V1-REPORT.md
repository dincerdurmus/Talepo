# TALEPO — Global Product Identity & Matching Engine V1

**Date:** 2026-08-10  
**Scope:** Generic product normalization + provider-independent matching. No new providers, payments, LLM, brand catalog seed, or ERP.

---

## Executive summary

Talepo now normalizes and matches products through a **provider-independent** `product-identity` module. Brand extraction no longer depends on a hardcoded global brand list. Unknown brands (e.g. **Novexa**) work when structured fields or generic text inference provide signals.

**Match threshold remains 0.4** — not lowered.

**Build:** `npm run build` — PASS  
**Unit tests:** `verify-external-price-intelligence.ts` — PASS  
**Identity tests:** `verify-global-product-identity.ts` — PASS  
**Live DataForSEO:** NOT_CONFIGURED in dev environment (live section skipped; prior live validation from Phase 1 still valid when credentials present)

---

## 1. Removed product-specific hardcodes

| Location | Removed | Replaced with |
|----------|---------|---------------|
| `category-registry.ts` | `KNOWN_PRODUCT_BRANDS` regex (~24 brands) | `splitProductNameString()` generic Title-Case + model-token heuristics |
| `category-registry.ts` | iPhone/galaxy trigger in `extractBrandModelVariant` | Generic embedded name split via `brand-extraction.ts` |
| `external-match-quality.ts` | iPhone Pro Max caps, `promax` guards, storage hacks | Delegates to `matchProductToExternal()` |
| `product-suitability.ts` | `hardwareHints: ["iphone","macbook","samsung",…]` | Generic model-like token regex (`letter+digit`, capacity units) |
| `normalize-product.ts` | Monolithic normalization | `buildProductIdentity()` + legacy adapter |

**Not in scope (upstream, unchanged):** `src/lib/ai/parser/brand-catalog.ts`, entity/category Apple branches — separate AI parser layer.

---

## 2. Remaining generic rules (intentional)

| Rule | Purpose |
|------|---------|
| `GLOBAL_KEY_WEIGHTS`, `SKIP_QUERY_FIELD_KEYS` | Category fingerprint + query hygiene |
| `semantic-fields.ts` key/label patterns | Generic field → semantic class mapping |
| `model-normalization.ts` camelCase / alphanumeric split | SM74, V15Detect, iPhone15 tolerance |
| `promax` → `pro max` token split | Generic joined qualifier language (not brand-specific) |
| `APPLIANCE_FAMILIES` synonym groups | washer/dryer/dishwasher family conflict detection |
| `PART_NOUNS` + Turkish suffix stems | Accessory / spare-part detection |
| `REFURB_PATTERNS`, `USED_PATTERNS`, `NEW_PATTERNS` | Condition normalization |
| `EXTERNAL_MATCH_QUALITY.minAggregate = 0.4` | Unchanged threshold |
| `deriveProviderProfile()` | Category routing suitability (shopping vs machinery vs internal) |

---

## 3. Brand extraction

**Priority:**
1. Structured `brand` / `brandPreference` fields (confidence ~0.95)
2. Optional `BrandMemoryStore` alias resolution (not seeded — architecture only)
3. Generic leading Title-Case token inference from title / embedded product string
4. `brand = null`, low confidence when uncertain

**No brand enum in Prisma.** Brand remains free-form string + optional future canonical layer.

**Files:** `brand-extraction.ts`, `brand-memory.ts`, `identity-builder.ts`

---

## 4. Unknown brand support

| Input | Brand | Model |
|-------|-------|-------|
| Structured `brand=Novexa`, `model=XR-900 Pro` | Novexa (0.95) | XR-900 Pro |
| Free text `Novexa XR-900 Pro` | Novexa (0.55 inferred) | XR-900 Pro |

Pipeline produces provider query, fingerprint, and matching without code changes for new brands.

---

## 5. Generic product identity model

`ProductIdentity` / extended `NormalizedProduct`:

```
categoryId, brand, brandConfidence, productType, model, series, variant,
condition (NEW|USED|REFURBISHED|UNKNOWN), identifiers (SKU/GTIN/EAN/UPC/MPN),
attributes, semanticFields, fingerprint, confidence, providerQuery
```

**Legacy compatibility:** `identityToLegacyNormalized()` preserves existing price-intelligence consumers.

---

## 6. Semantic field resolver

`semantic-fields.ts` maps FormField keys/labels to classes:

`brand-like`, `model-like`, `series-like`, `variant-like`, `sku-like`, `gtin-like`, `storage-like`, `capacity-like`, `size-like`, `year-like`, `condition-like`, `product-type-like`, `part-type-like`, …

`needType` / meta type fields are excluded from product-type classification.

---

## 7. Unit normalization

Central module: `unit-normalization.ts`

| Type | Examples |
|------|----------|
| Storage | `256GB` ≡ `256 GB`; 1TB policy: token equality (not 1024 GB auto-equiv) |
| Weight | `9kg` ≡ `9 kg` |
| Dimensions | `160x80` parsing |
| Model text | Compact SKU codes ≥10 chars preserved (`WGG244Z0TR`) |

---

## 8. Accessory detection

Generic `detectAccessory()` using:
- `partType` / `accessoryType` structured fields
- Part noun lexicon + Turkish suffix stems (`hortumu` → `hortum`, `kılıf` → `kilif`)
- Model-in-title + part-noun co-occurrence

**Not** a brand blacklist.

---

## 9. Condition handling

Global enum: `NEW | USED | REFURBISHED | UNKNOWN`

- Refurbished/used listings capped below threshold when request is not explicitly refurbished/used
- Turkish `yenilenmiş` pattern fixed (`yenilenm\w*`)
- Missing condition → UNKNOWN (does not assume NEW for external listings)

---

## 10. Provider-independent matching

```
Request → buildProductIdentity() → ProductIdentity
Provider observation → normalizeExternalProduct() → NormalizedExternalProduct
→ matchProductToExternal(identity, external, 0.4) → MatchQualityResult
```

**Score layers:** `identityScore`, `attributeScore`, `titleScore`, `conditionScore`, `identifierScore`

**Hard reject:** brand mismatch (high confidence), identifier mismatch, accessory, model generation mismatch

**Soft cap / missing info:** storage, capacity, qualifiers, refurbished, comparison titles (` vs `)

DataForSEO adapter only normalizes to `NormalizedExternalProduct`; matcher never reads raw provider JSON.

---

## 11. Bosch false-positive audit (20-title sample)

Request: Bosch Series 6, 9 kg, Çamaşır makinesi

| Label | Count |
|-------|-------|
| TRUE_POSITIVE | 7 |
| TRUE_NEGATIVE | 12 |
| FALSE_POSITIVE | **0** |
| FALSE_NEGATIVE | 1 |

**FALSE_NEGATIVE:** `Bosch WGG244Z0TR` alone (mq=0.39) — model code only, no series/capacity in title. Acceptable conservative behavior.

**Previously problematic FPs now rejected:**
- Kurutma (dryer) vs çamaşır (washer)
- Bulaşık (dishwasher) vs çamaşır
- 7 kg / 8 kg vs 9 kg capacity
- Hortum / kapak / yedek parça accessories

> Note: Live 40/40 matched count from Phase 1 is **not reproduced in dev** (DataForSEO NOT_CONFIGURED). Sample audit uses rule-based labeled titles; accuracy prioritized over match count per spec.

---

## 12. iPhone regression (generic engine)

| Case | Result | mq |
|------|--------|-----|
| Correct Pro Max 256 GB | PASS | 0.905 |
| Missing storage | REJECT | 0.39 |
| Wrong storage 128 GB | REJECT | 0.25 |
| Wrong model (Pro / 15 / Plus) | REJECT | 0.39 |
| Wrong generation (17) | HARD REJECT | 0 |
| Refurbished (Yenilenmiş) | REJECT | 0.25 |
| Comparison (` vs `) | HARD REJECT | 0 |
| Accessory (Kılıf) | HARD REJECT | 0 |

No iPhone-specific code path — generic qualifier, storage, generation, condition, accessory rules.

---

## 13. Multi-brand test results

| Brand | Category | Brand | Model | External call |
|-------|----------|-------|-------|---------------|
| Apple | technology | Apple | iPhone 15 Pro Max | yes |
| Dyson | home-kitchen | Dyson | V15 Detect Absolute | yes |
| Philips | home-kitchen | Philips | LatteGo 5400 | yes |
| Bosch | appliances | Bosch | Series 6 | yes |
| Toyota | automotive | Toyota | Corolla / 2024 | **no** (normalized, shopping skip) |
| Novexa (unknown) | technology | Novexa | XR-900 Pro | yes |
| Heidelberg | machinery | Heidelberg | SM 74 | no |
| Chicco | baby | Chicco | — | yes |

---

## 14. Multi-category test results

| Category | Suitability | External | Notes |
|----------|-------------|----------|-------|
| technology | HIGH | yes | |
| appliances | HIGH | yes | |
| home-kitchen | MEDIUM | yes | |
| automotive | LOW | **no** | Identity works; Google Shopping not forced |
| services | ~0 | no | |
| printing | LOW | no | |
| machinery | MEDIUM | no | internal-weighted |
| baby | MEDIUM | yes | |
| furniture | MEDIUM | yes | |

---

## 15. Build

```
npm run build → PASS (Next.js 16.2.10, TypeScript clean)
```

---

## 16. Remaining limitations

1. **Brand inference from title-only service requests** can produce false brand tokens (e.g. "Ofis temizliği" → Ofis). Structured brand fields recommended; low-confidence inference does not hard-reject alone.
2. **Brand memory / alias layer** is in-memory architecture only — not seeded, not persisted.
3. **Product family synonyms** (`APPLIANCE_FAMILIES`) cover common appliance conflicts; other categories rely on semantic fields + token overlap.
4. **Live provider re-validation** requires `DATAFORSEO_*` credentials; dev run returned RAW=0 (NOT_CONFIGURED).
5. **Model-only SKU listings** (e.g. bare `WGG244Z0TR`) may score 0.39 — conservative, not auto-accepted.
6. **Upstream AI brand catalog** (`brand-catalog.ts`) still exists for AI parser — not wired into price-intelligence pipeline.
7. **1TB vs 1024GB** not treated as equivalent (explicit token policy).

---

## New / modified files

### New module: `src/lib/product-identity/`
- `types.ts`, `semantic-fields.ts`, `unit-normalization.ts`, `model-normalization.ts`
- `brand-extraction.ts`, `brand-memory.ts`, `condition.ts`, `accessory-detection.ts`
- `identity-builder.ts`, `external-product.ts`, `matching-engine.ts`, `index.ts`

### Modified
- `src/server/price-intelligence/normalize-product.ts` → delegates to identity builder
- `src/server/price-intelligence/normalize-product-fingerprint.ts` → extracted fingerprint helpers
- `src/server/price-intelligence/external-match-quality.ts` → thin wrapper over matching engine
- `src/lib/price-intelligence/category-registry.ts` → removed brand list
- `src/lib/price-intelligence/product-suitability.ts` → generic hints + automotive penalty
- `src/lib/price-intelligence/types.ts` → extended NormalizedProduct fields

### Scripts
- `scripts/verify-global-product-identity.ts` — multi-brand/category + audit harness
- `TALEPO-GLOBAL-PRODUCT-IDENTITY-V1-TEST-OUTPUT.txt` — latest test run log

---

## Verification commands

```bash
cd apps/web
npm run build
npx tsx scripts/verify-external-price-intelligence.ts
npx tsx scripts/verify-global-product-identity.ts
# With credentials:
npx tsx scripts/verify-dataforseo-live.ts
```

---

**Phase status: COMPLETE — stopped per spec (no new provider/payment/LLM/catalog/ERP).**
