# TALEPO — UNIFIED REQUEST UNDERSTANDING BRAIN
# B3.5 — CANONICAL BRAIN ACTIVATION REPORT

**Date:** 2026-08-11  
**Verdict:** **PASS_CANONICAL_ACTIVATION**

---

## 1. BEFORE ARCHITECTURE

```
USER TEXT
  → runTalepoAiCore / parseRequest          (category + attrs SoT)
  → page form state + services→appliances hack
  → useRequestBrain → resolvePriceStrategy  (2nd strategy)
  → POST preview(categorySlug from client)  (3rd strategy path)
  → buildRequestSummary(fieldValues)
  → composeProfessionalDescription(parsed attrs)
```

Dual authority: category, strategy, identity decided independently on client parse, local brain, and server preview.

---

## 2. AFTER ARCHITECTURE

```
USER RAW INPUT + structured overrides
  → understandRequest()                     ★ CANONICAL SoT
  → RequestUnderstandingResult
       ├─ /talep UI (schema, chips, confidence)
       ├─ Human questions (unknowns − known facts)
       ├─ useRequestBrain strategy/completeness from understanding
       ├─ POST preview(rawInput + overrides) → server understandRequest
       └─ Professional draft (explicit/structured facts only)
```

---

## 3. CANONICAL SOURCE OF TRUTH

`understandRequest({ rawInput, structured })` is authoritative for:

- intent / subject / category (gated) / strategy
- identity (with provenance)
- attributes / preferences / unknownFields
- priceAnalysisReadiness / understandingConfidence

Priority:

1. USER STRUCTURED OVERRIDE (`STRUCTURED_FIELD`)
2. USER RAW EXPLICIT
3. HIGH-CONFIDENCE INFERENCE
4. TENTATIVE
5. UNKNOWN

---

## 4. /TALEP MIGRATION

**File:** `src/app/talep/page.tsx`

- Removed `runTalepoAiCore` as understanding source
- `understanding = understandRequest(...)` with manual/city/budget/locked-category overrides
- `resolveSchemaCategory` → form schema; tentative/unknown never labeled as certain “Hizmet”
- Summary chips from `buildUnderstandingSummary`
- Soft services→appliances page hack removed (brain gating covers it)

---

## 5. STRUCTURED OVERRIDE PRIORITY

Implemented in `understand-request.ts`:

- Locked `categoryId` → CONFIDENT `STRUCTURED_FIELD`
- Manual `fieldValues` overlay after inference
- Structured condition/city/district honored

UI corrections are not wiped by re-parse.

---

## 6. HUMAN QUESTION MIGRATION

`useRequestBrain`:

- Strategy/completeness from canonical understanding
- Filters out fields already known (modelYear, model, mileage preference, needType, condition, qty, roomCount, area, part, serviceType, listingType)
- Still uses `rankNextBestQuestions` + `toHumanQuestions` presentation layer

---

## 7. PRICE PREVIEW MIGRATION

**Files:**

- `api/price-intelligence/preview/route.ts` — `categorySlug` no longer required; accepts `rawInput` + `structuredOverrides`
- `run-price-intelligence-preview.ts` — server-side `understandRequest`; merges canonical fields; `priceAnalysisReadiness` gates external calls (`NOT_READY` → no external)

Client slug is **hint only** unless user locked category.

---

## 8. PROFESSIONAL DRAFT MIGRATION

`safeDraftAttributes()` — only EXPLICIT / STRUCTURED facts.

Inferred brand/model (e.g. Mercedes from C180) does **not** enter draft as certain.

---

## 9. REQUEST SUMMARY MIGRATION

`buildUnderstandingSummary` replaces legacy `buildRequestSummary` as SoT for chips on `/talep`.

Shows explicit + high-confidence safe facts; preferences like “düşük km” as preference chips (not fabricated maxMileage).

---

## 10. LEGACY BRAIN STATUS

| System | Status |
|---|---|
| `understandRequest` | **Authoritative** on `/talep` + preview |
| `runTalepoAiCore` / `parseRequest` | **Deprecated for /talep understanding** — still exists for EditRequestForm / other callers |
| `detectCategoryResult` | **Wrapped** inside brain (not UI SoT) |
| `detectCategory` (request-category-engine) | **Legacy** (HomeComposer) — not /talep SoT |
| `useRequestBrain` local `resolvePriceStrategy` | **Fallback only** when understanding absent |
| Product Identity / Strategy Registry / Confidence V2 | **Reused** unchanged |
| Matching estimate API | Still category-id based (not full brain) — residual |

---

## 11. BROWSER ACCEPTANCE

Deterministic flow simulation covers the 8 browser corpus cases via `verify-canonical-request-flow.ts` (UI state + strategy + questions + draft safety).

Live browser click-through not automated in this pass; scripted acceptance is the gate.

Expected behaviors covered:

| Input | Result |
|---|---|
| 2013 c180 düşük km… | VEHICLE, year, model, preference; no qty hallucination |
| c180 parçası | AUTO_PART; no vehicle mileage questions |
| c180 bakım | SERVICE |
| dyson v15 sıfır | retail + NEW + V15 |
| v15 bakıyom | not confident Hizmet |
| 350gr / 5bin kutu | manufacturing qty/weight |
| 200m2 boyatacam | SERVICE + area |
| başakşehir 2+1 kiralık | RENT / REAL_ESTATE_RENT |

---

## 12. CANONICAL CONSISTENCY METRICS

```
CANONICAL/UI MISMATCH COUNT: 0
CANONICAL/PREVIEW STRATEGY MISMATCH: 0
REPEATED QUESTION COUNT: 0
LOW-CONFIDENCE FACT SHOWN AS CERTAIN COUNT: 0
DRAFT HALLUCINATION COUNT: 0
```

---

## 13. REGRESSION

| Check | Result |
|---|---|
| `npm run build` | PASS |
| `verify-request-understanding-brain` | PASS |
| `verify-canonical-request-flow` | PASS |
| `verify-global-product-identity` | PASS |
| `verify-external-price-intelligence` | PASS |
| `verify-price-strategy` | PASS |
| `verify-provider-routing` | PASS |
| `verify-confidence-v2` | PASS |
| `verify-request-preview` | PASS |
| `verify-request-ux-state` | PASS |
| `verify-human-request-understanding` | PASS |

---

## 14. REMAINING DUAL-BRAIN RISKS

1. **EditRequestForm / panel edit** may still use `runTalepoAiCore`
2. **Matching estimate** uses category id, not full understanding
3. **Price engine** still runs internal `resolvePriceStrategy`; preview response strategy overwritten with canonical — engine path may diverge briefly for routing internals
4. Home `detectCategory` legacy twin unchanged
5. Soft URL `?category=` still seeds override (unlocked) — intentional UX

---

## 15. NEXT STEP

- Migrate EditRequestForm + matching estimate to canonical brain
- Optional B4 ambiguity engine
- Optional live browser QA pass on `/talep`

Do **not** add LLM yet.

---

## DECLARATIONS

| Item | Value |
|---|---|
| **/TALEP USES CANONICAL BRAIN** | **YES** |
| **PRICE PREVIEW USES CANONICAL BRAIN** | **YES** |
| **HUMAN QUESTIONS USE CANONICAL BRAIN** | **YES** |
| **PROFESSIONAL DRAFT USES CANONICAL FACTS** | **YES** |
| **LEGACY CATEGORY AUTHORITATIVE** | **NO** |
| **DATABASE CHANGED** | **NO** |
| **UI REDESIGNED** | **NO** |
| **COMMIT/PUSH** | **NO** |

---

## FILES TOUCHED (activation)

**Created**

- `src/lib/request-understanding/activation-bridge.ts`
- `scripts/verify-canonical-request-flow.ts`
- `TALEPO-UNIFIED-BRAIN-ACTIVATION-REPORT.md`

**Modified**

- `src/app/talep/page.tsx`
- `src/hooks/useRequestBrain.ts`
- `src/app/api/price-intelligence/preview/route.ts`
- `src/server/price-intelligence/run-price-intelligence-preview.ts`
- `src/lib/request-understanding/understand-request.ts` (structured overrides)
- `src/lib/request-understanding/index.ts`

---

## FINAL VERDICT

# PASS_CANONICAL_ACTIVATION
