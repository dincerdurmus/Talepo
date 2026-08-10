# TALEPO — Global Product Identity & Matching Engine V1.1 Report

Date: 2026-08-10  
Phase: V1.1 (post live stress test fixes)  
Decision: **PRODUCTION_CANDIDATE**

---

## BEFORE (V1 live stress test)

| Metric | Value |
|--------|-------|
| Precision | 0.955 |
| Recall | 0.538 |
| TP | 21 |
| FP | **1** |
| Audited FN | 18 |

Critical failures: Dyson V12→V15 leak, Samsung brand over-extraction, DeWalt brand null, Chicco model lost to productType, accessory FP on “şarjlı süpürge”, RAW=0 conflated with match failure.

---

## AFTER (V1.1 live re-stress test)

| Metric | Value |
|--------|-------|
| Precision | **1.000** |
| Recall | **0.726** |
| TP | 61 |
| FP | **0** |
| Audited FN | 23 |

Build: **PASS**  
`verify-global-product-identity.ts`: **PASS (V1.1)**  
`verify-external-price-intelligence.ts`: **PASS**

---

## MODEL IDENTITY

**Added:** `extractModelIdentityTokens()` + `modelIdentityTokenConflict()` in `model-identity-tokens.ts`

- Token classes: `ALPHA_NUMERIC_MODEL`, `NUMERIC_SERIES`, `SKU_LIKE`, `QUALIFIER`
- Strips storage (256 GB), weight (9 kg), years from identity extraction
- **Conflict > score:** confident family mismatch → hard reject regardless of aggregate score
- Generic Example-brand fixtures: V15≠V12, S24≠S23, DHP486≠DHP484, XR-900≠XR-800 — all HARD REJECT

**DYSON V12→V15:** `TRUE_NEGATIVE` — `model identity mismatch (v: 15 vs 12)` (not brand-specific)

**Additional V1.1 precision guards:**
- Washer-only vs washer-dryer combo → hard reject (`washer-dryer combo mismatch`)
- Multi-unit listings (`2 adet`, bundle sets) → hard reject (`multi-unit listing`)

---

## BRAND EXTRACTION

**Rewritten generic heuristics** in `brand-extraction.ts`:

- Mixed-case brands: DeWalt, LaCie
- Lowercase brands: eufy
- Leading-lowercase: iRobot (`iPhone`-style product lines stop before model)
- Product-family stop: Galaxy before S24 (Samsung fix without Samsung regex)
- Qualifier boundary: LaCie / Rugged Mini (not LaCie Rugged)

| Input | Brand | Model |
|-------|-------|-------|
| Samsung Galaxy S24 Ultra | Samsung | Galaxy S24 Ultra |
| DeWalt DCD996 | DeWalt | DCD996 |
| iRobot Roomba j7+ | iRobot | Roomba j7+ |
| Novexa XR-900 Pro | Novexa | XR-900 Pro |

**SAMSUNG:** brand=`Samsung`, model=`Galaxy S24 Ultra` ✓  
**DEWALT:** brand=`DeWalt`, model=`DCD996` ✓

Structured `brandPreference` / `brand` fields always take priority over title inference.

---

## FEATURE PROMOTION

**Added:** `identity-candidates.ts`

- Promotes model-like phrases from `features`, `specs`, `productName`, `modelDetails`, `variantDetails`
- Scoring excludes product-type vocabulary; boosts when only `productType` is structured
- Skips series-like specs (`Series 6`) from erroneous model promotion
- Strips trailing product-type tokens from model (`akülü matkap` → model core)

**CHICCO:** brand=`Chicco`, model=`Urban Plus`, productType=`Bebek arabası / puset` ✓

---

## ACCESSORY DETECTION

**Context-aware V1.1** in `accessory-detection.ts`:

- Core product phrases: şarjlı/kablosuz süpürge, şarjlı matkap, çamaşır makinesi → **not accessory**
- Part phrases: filtresi, şarj cihazı, kılıfı, hortumu → accessory
- Core product + trailing part noun (e.g. “… makinesi kapağı”) → accessory
- Removed standalone `sarj`/`charger` stem false positives

| Phrase | Accessory |
|--------|-----------|
| Şarjlı süpürge | false |
| Süpürge filtresi | true |
| Matkap şarj cihazı | true |

---

## PROVIDER STATUS

**Added** `ProviderOutcomeStatus` in `fetch-external-listings.ts`:

- `PROVIDER_NO_RESULTS` — API success, RAW=0 (coverage variance)
- `PROVIDER_SUCCESS_WITH_RESULTS`
- `PROVIDER_ERROR`
- `MATCH_NO_VALID_PRODUCTS` — RAW>0 but matcher rejected all
- `SKIPPED`

Exposed via `rawCount`, `matchedCount`, `providerOutcome` on fetch result.  
Samsung RAW=30 vs Chicco RAW=0 now distinguishable from engine failure.

---

## FALLBACK QUERY

- Max **1** fallback when primary query returns RAW=0
- Fallback: `brand + model` via `buildFallbackProviderQuery()`
- Matcher threshold unchanged at **0.4** — query widening does not loosen matching

---

## CACHE

- In-memory provider cache: MISS→HIT verified (Bosch)
- Samsung cache check intermittent (API variance on re-query) — documented as CHECK

---

## UNKNOWN BRAND

- Novexa XR-900 Pro: identity PASS, no provider call (by design) ✓

---

## AUTOMOTIVE ROUTING

- Toyota Corolla 2024 Hybrid Dream: external call **NO** ✓

---

## MACHINERY ROUTING

- Heidelberg SM 74: external call **NO** ✓

---

## ACCEPTANCE CRITERIA CHECKLIST

| Criterion | Status |
|-----------|--------|
| Audited FP = 0 | ✓ |
| Dyson V12 leak fixed (generic token conflict) | ✓ |
| Samsung extraction fixed | ✓ |
| DeWalt extraction fixed | ✓ |
| Chicco Urban Plus in identity | ✓ |
| Accessory FP fixed | ✓ |
| Build/tests PASS | ✓ |
| Brand-specific production code NONE | ✓ |
| Threshold 0.4 unchanged | ✓ |

---

## BRAND-SPECIFIC PRODUCTION CODE

**NONE / FOUND:** **NONE**

Repository scan: no `if brand === "Dyson"|"Samsung"|"DeWalt"|"Chicco"` or equivalent in engine paths.

---

## REMAINING LIMITATIONS

1. **Recall vs precision trade-off:** FN=23 on small audited sample — conservative matching by design (precision > recall).
2. **Provider RAW=0 variance:** iPhone, Makita, Chicco, Sony intermittently return RAW=0 despite CONFIGURED credentials — classified as `PROVIDER_NO_RESULTS`, not engine failure.
3. **Series-only appliance requests:** Bosch `Series 6` without SKU — some valid SKU listings score below threshold when series token conflict triggers on model codes (acceptable precision trade-off).
4. **Title-only brand noise:** Service/print categories may infer weak brands from titles when no structured brand field (external call still skipped).
5. **Dyson stand/variant listings:** “V15 Ayaklı Ünite” may pass audit heuristics — accessory stand detection deferred to V1.2 if needed.
6. **Philips LatteGo live fields:** When only `features` (not `productName`) is populated, model extraction from features string can still degrade — recommend structured `productName` in forms.

---

## FINAL DECISION

### **PRODUCTION_CANDIDATE**

Generic product identity engine V1.1 meets precision-first acceptance criteria with zero audited false positives across the live re-stress set, all targeted identity fixes verified, and no brand-specific production code.

---

## Files changed (V1.1)

| Area | Files |
|------|-------|
| Model identity tokens | `src/lib/product-identity/model-identity-tokens.ts` (new) |
| Feature promotion | `src/lib/product-identity/identity-candidates.ts` (new) |
| Brand extraction | `src/lib/product-identity/brand-extraction.ts` |
| Accessory detection | `src/lib/product-identity/accessory-detection.ts` |
| Identity builder | `src/lib/product-identity/identity-builder.ts` |
| Matching engine | `src/lib/product-identity/matching-engine.ts` |
| Provider fetch | `src/server/price-intelligence/fetch-external-listings.ts` |
| Query fallback | `src/server/price-intelligence/provider-query-builder.ts` |
| Suitability | `src/lib/price-intelligence/product-suitability.ts` |
| Exports | `src/lib/product-identity/index.ts` |
| Tests | `scripts/verify-global-product-identity.ts` |

---

*Phase complete. No new providers, payment, LLM, brand catalog seed, knowledge engine, or ERP in this phase.*
