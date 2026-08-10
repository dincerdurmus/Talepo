# TALEPO — UNIFIED REQUEST UNDERSTANDING BRAIN
# B1 + B2 + B3 — FINAL REPORT

**Date:** 2026-08-11  
**Scope:** Canonical Request Understanding contract + provenance + orchestrator  
**Verdict:** **PASS_B1_B3**

---

## 1. ROOT CAUSES ADDRESSED

| Audit root cause | Fix in B1–B3 |
|---|---|
| Multiple independent “brains” (parser / identity / strategy / form) with no shared contract | Single `RequestUnderstandingResult` + `understandRequest()` entry point |
| No explicit / inferred / unknown provenance | `UnderstandingValue` + `explicitFacts` / `inferredFacts` / `unknownFields` |
| Intent fragmented; category decided first | Intent signals before category; subject derived from intent |
| Quantity hallucinations (V15→15, Heidelberg 74→74) | Generic `classifyNumbers` with unit-backed roles first; bare digits → OTHER/MODEL_IDENTIFIER, never auto QUANTITY |
| Low-confidence `services` treated as real category | Category gating: score 0 / unconfident services → `UNKNOWN`; not passed as dominant strategy signal |
| Automotive model ⇒ always VEHICLE | Strong PART/SERVICE intent overrides vehicle strategy |
| Fuzzy prefs fabricated as numerics (“düşük km” → maxMileage) | Preferences layer (`mileagePreference=LOW`); no invented `maxMileage` |

---

## 2. ARCHITECTURE

```
RAW INPUT
  → normalizeUnderstandingInput (light; preserves model tokens)
  → classifyNumbers (number-role)
  → collectIntentSignals / resolveIntent (intent before category)
  → subjectKindForIntent
  → gateCategory(detectCategoryResult)  // reuse; not SoT alone
  → buildProductIdentity (V1.1 reuse)
  → attributes / preferences / condition / budget / location
  → resolvePriceStrategy (reuse; strong intent prepared in context)
  → reconcileUnderstanding
  → unknownFields from strategy attribute profile
  → publishReadiness + priceAnalysisReadiness (independent)
  → understandingConfidence (weighted, separate from Price Confidence)
  → RequestUnderstandingResult
```

**Principle held:** Category is a consequence of evidence, not the first decision.

---

## 3. FILES CREATED

### `src/lib/request-understanding/`
- `types.ts` — canonical contract
- `confidence-config.ts` — weights / category gates
- `provenance.ts` — `uv`, fact partition, clamp
- `normalize.ts` — light normalization wrapper
- `number-role.ts` — number role classifier
- `intent-signals.ts` — generic TR intent lexicon + negation
- `understand-request.ts` — orchestrator
- `reconcile-understanding.ts` — light conflict reconcile
- `adapters.ts` — shape-only adapters
- `index.ts` — public exports

### `src/server/request-understanding/`
- `understand-request.ts` — server re-export entry

### Scripts / report
- `scripts/verify-request-understanding-brain.ts`
- `TALEPO-UNIFIED-REQUEST-BRAIN-B1-B3-REPORT.md` (this file)

---

## 4. FILES MODIFIED

**None of the protected production engines were rewritten.**

No changes to:
- Product Identity V1.1
- Price Strategy Registry / Resolver
- Provider routing
- Price Intelligence / Confidence V2
- DataForSEO parser
- External match quality threshold
- Human Question Layer
- `/talep` UI

---

## 5. CANONICAL CONTRACT

`RequestUnderstandingResult` (`version: "v1"`) answers:

1. What the user said → `rawInput` / `normalizedInput` / `explicitFacts`
2. What Talepo extracted → attributes, identity, preferences, inferredFacts
3. How sure → `understandingConfidence` + per-decision confidence/status
4. What we don’t know → `unknownFields`
5. What is ambiguous → `ambiguities` / `contradictions` (carrier ready; light use)
6. Intent → `intent`
7. Category → `category` (`CONFIDENT` | `TENTATIVE` | `UNKNOWN`)
8. Strategy → `strategy`
9. Downstream payload → adapters (`toStrategyContext`, `toProductIdentityInput`, `toLegacyFormHints`)

---

## 6. PROVENANCE MODEL

- `UnderstandingValue<T>`: `value`, `confidence` (0..1), `provenance` (`EXPLICIT`|`INFERRED`), `source`, `evidence`
- Sources include `USER_EXPLICIT`, `PRODUCT_IDENTITY`, `DETERMINISTIC_INFERENCE`, `CATEGORY_INFERENCE`, `STRATEGY_INFERENCE`, …
- Identity example: user writes `c180` → model **EXPLICIT**; brand from identity resolver (if any) → **INFERRED**
- Fuzzy language stays in `preferences` (never invented hard numerics)

---

## 7. INTENT RESOLUTION

Generic Turkish lexicon (not category-specific): BUY / RENT / SELL / SERVICE / PART / MANUFACTURE.

Negation guards:
- `servis istemiyorum` → SERVICE suppressed
- `parça değil` / `komple makine` → PART suppressed

**Intent before category** validated on:
- `c180 araç arıyorum` → BUY + VEHICLE
- `c180 parçası lazım` → PART + AUTO_PART
- `c180 bakım yaptıracam` → SERVICE + SERVICE_SCOPE

Note: Turkish `ı` breaks JS `\b` (ASCII `\w` only). PART suffix forms (`parçası`) and `kiracılı` use suffix-aware / includes matching.

---

## 8. CATEGORY RESOLUTION

Reuses `detectCategoryResult`.

Gating (`confidence-config.CATEGORY_DECISION`):
- score ≤ 0 → UNKNOWN (no silent services)
- unconfident `services` → UNKNOWN / suppressed for strategy
- status CONFIDENT / TENTATIVE / UNKNOWN with alternatives (runner-up)

Low-confidence category is **not** passed as dominant `categorySlug` into strategy when strong needType/intent exists.

---

## 9. STRATEGY RESOLUTION

Reuses `resolvePriceStrategy`.

Orchestrator prepares:
- `needType` from intent/subject (part / service / vehicle / machine)
- listingType for RE
- quantity / paperWeight for manufacturing
- condition strings for used/new

Strong intent overrides weak vehicle defaults (PART→AUTO_PART, SERVICE→SERVICE_SCOPE).  
Unconfident services path cannot confidently force `SERVICE_SCOPE` for purchase-like intents.

---

## 10. NUMBER ROLE CLASSIFICATION

Roles: MODEL_IDENTIFIER, MODEL_YEAR, QUANTITY, WEIGHT, DIMENSION, MILEAGE, CAPACITY, AREA, PRICE, STORAGE, OTHER.

Order: unit-backed roles first → alphanumeric/hyphen model tokens → bare-after-alpha model candidates → OTHER.

Corpus proofs: V15≠qty, 74≠qty, 350gr=weight + 5bin=5000 qty, 2013=year, 200m2=area, bir tane=1 + V15 model.

---

## 11. UNKNOWN HANDLING

`unknownFields` generated from `getStrategyAttributeProfile(resolvedStrategy)` minus resolved keys.

UNKNOWN ≠ INVALID ≠ BLOCKED.  
Missing enrichment does not auto-BLOCK publish.

---

## 12. CONFIDENCE MODEL

Separate from Price Confidence V2.

Weighted blend (`confidence-config.ts`):
- intent 0.28, category 0.22, strategy 0.20, identity 0.18, attributes 0.12
- penalties: ambiguity, contradiction, tentative category, unknown intent

---

## 13. ACCEPTANCE CORPUS RESULTS

```
TOTAL FIXTURES: 25
PASS: 25
FAIL: 0
INTENT ACCURACY: 100.0% (9/9)
STRATEGY ACCURACY: 100.0% (6/6)
```

---

## 14. CONFIDENT WRONG CLASSIFICATION COUNT

**0**

---

## 15. HALLUCINATED ATTRIBUTE COUNT

**0**

---

## 16. REGRESSION RESULTS

| Check | Result |
|---|---|
| `npm run build` | PASS |
| `verify-global-product-identity` | PASS |
| `verify-external-price-intelligence` | PASS |
| `verify-price-strategy` | PASS |
| `verify-provider-routing` | PASS |
| `verify-confidence-v2` | PASS |
| `verify-request-preview` | PASS |
| `verify-request-ux-state` | PASS |
| `verify-human-request-understanding` | PASS |
| `verify-request-understanding-brain` | PASS |

No live DataForSEO paid calls required for this phase (deterministic/mocked path).

---

## 17. EXISTING COMPONENTS REUSED

- `detectCategoryResult` (category.ts)
- `buildProductIdentity` + model identity tokens
- `resolvePriceStrategy` + `getStrategyAttributeProfile`
- `extractBudgetFromText`, `detectCity`, geo districts
- `findAutomotiveModel` (catalog-based, not a new brand if-hack)
- `normalizeCasualTurkish` (via light wrapper)

---

## 18. CONSUMERS NOT YET MIGRATED

Canonical entry exists, but these still use legacy paths:

- `/talep` page → `runTalepoAiCore` / parser
- `useRequestBrain` / local intelligence → strategy from form draft
- `/api/price-intelligence/preview` → client-sent category slug
- Professional draft composer
- Human question layer (still strategy-driven from draft, not `understandRequest`)
- Matching estimate APIs

**Adapters are ready;** UI/API migration is a later phase (not B4 ambiguity engine).

---

## 19. REMAINING RISKS

1. Legacy parser still defaults needType=vehicle for automotive independently of the new brain until UI migrates.
2. Brand alias slang (`merso`) is not resolved (by design — no brand hardcode); crash-safe only.
3. Intent lexicon is keyword/negation-level, not full NLP — edge phrasings may need B4+ / future LLM.
4. `extractModelIdentityTokens` can still emit noisy tokens; number-role ordering mitigates quantity harm.
5. Dual category detectors remain (`detectCategory` in request-category-engine vs `detectCategoryResult`).

---

## 20. NEXT RECOMMENDED STEP

**B4 — Ambiguity / contradiction engine** on top of the carrier fields, **or** thin migration of `/talep` + preview to call `understandRequest()` as single source of truth (no UI redesign).

Do **not** add LLM yet.

---

## DECLARATIONS

| Item | Value |
|---|---|
| **BRAND-SPECIFIC PRODUCTION CODE ADDED** | **NO** |
| **LLM ADDED** | **NO** |
| **DATABASE CHANGED** | **NO** |
| **PROVIDER BEHAVIOR CHANGED** | **NO** |
| **UI CHANGED** | **NO** |
| **COMMIT/PUSH** | **NO** |

---

## FINAL VERDICT

# PASS_B1_B3

Criteria met:
- build PASS
- regressions PASS
- new corpus PASS (25/25)
- confident wrong classification = 0
- hallucinated attribute = 0
- brand-specific production hack = 0
