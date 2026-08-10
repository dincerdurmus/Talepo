# TALEPO — UNIFIED REQUEST UNDERSTANDING BRAIN
# B3.6 — SINGLE-BRAIN CLOSURE REPORT

**Date:** 2026-08-11  
**Verdict:** **PASS_SINGLE_BRAIN_CLOSURE**

---

## 1. EXECUTIVE SUMMARY

B3.6 closes the remaining dual-authority paths left after B3.5 canonical activation. Create, edit, price routing, matching estimate, and Home handoff now consume `understandRequest()` → `RequestUnderstandingResult` (or pure adapters from it). Legacy parsers remain contained for non-request surfaces; they are not authoritative in the active request lifecycle.

All single-brain metrics = **0**. Build and regression suite **PASS**. Live browser QA ran on required fixtures.

---

## 2. WHY B3.6 WAS REQUIRED

B3.5 made `/talep`, human questions, preview, and professional draft canonical — but left architectural gaps:

1. **EditRequestForm** could still re-interpret via `runTalepoAiCore`
2. **Matching estimate** was category-id based without canonical understanding
3. **Price engine** re-called `resolvePriceStrategy` after preview already had canonical strategy
4. **Home** used legacy `detectCategory` as a competing signal
5. **URL `?category=`** needed explicit unlock/hint vs user-lock semantics

Without closing these, one request could still acquire multiple meanings across layers.

---

## 3. REPOSITORY AUTHORITY AUDIT

| CALL SITE | PURPOSE | INPUT | OUTPUT | AUTHORITATIVE? | SHOULD REMAIN? | TARGET STATE |
|-----------|---------|-------|--------|----------------|----------------|--------------|
| `understandRequest` (`lib/request-understanding`) | Canonical orchestrator | raw + structured | `RequestUnderstandingResult` | **YES** | YES | Keep as sole SoT |
| `detectCategoryResult` (`ai/parser/category`) | Category primitive | text | detection result | NO (primitive) | YES inside brain | Internal only |
| `resolvePriceStrategy` | Strategy primitive / fallback | attrs/context | strategy resolution | NO when canonical present | YES as fallback | Fallback only |
| `buildProductIdentity` | Identity V1.1 primitive | title/attrs | identity | NO (called by brain) | YES | Brain-owned |
| `runTalepoAiCore` | Legacy AI core | text | AiCoreResult | NO for request flows | Contained | Deprecated for workflows |
| `parseRequest` | Legacy parser | text | ParsedRequest | NO for request flows | Contained | Deprecated; offer-assistant still uses |
| `detectCategory` / `detectCategoryHintLabel` | Home UX hint | text | label | **NO** | Hint only | Non-authoritative |
| `/talep` page | Create UI | raw + overrides | form + questions | Consumer | YES | Via understandRequest |
| `EditRequestForm` | Edit UI | persisted + edits | form | Consumer | YES | Via understandRequest |
| preview route / `run-price-intelligence-preview` | Price preview | raw + overrides | sanitized preview | Consumer | YES | understandRequest → canonicalStrategy |
| `getPriceIntelligence` engine | Price routing | query + optional canonicalStrategy | intelligence | Strategy authoritative if supplied | YES | Prefer canonicalStrategy |
| `/api/matching/estimate` | Matching count | rawInput / legacy category | counts | Category from canonical | YES | `toMatchingEstimateInput` |
| `HomeComposer` | Capture + handoff | raw text | navigate `?query=` | NO | YES | Hint display only |
| offer-assistant `parseRequest` | Offer paste assist | pasted text | parse | Outside request lifecycle | YES for now | Legacy non-request |

---

## 4. BEFORE AUTHORITY MAP

```
CREATE (/talep)     → understandRequest          ✓ (B3.5)
EDIT                → runTalepoAiCore / parse     ✗ dual
PRICE PREVIEW       → understandRequest           ✓ (B3.5)
PRICE ENGINE        → resolvePriceStrategy again  ✗ dual routing
MATCHING ESTIMATE   → category id only            ✗ dual
HOME                → detectCategory authority    ✗ dual risk
URL ?category=      → soft hint (OK) but fragile
DRAFT / QUESTIONS   → canonical                   ✓ (B3.5)
```

---

## 5. AFTER AUTHORITY MAP

```
HOME RAW → ?query= only (hint UI non-authoritative)
     ↓
CREATE / EDIT
     ↓
understandRequest(raw + STRUCTURED_FIELD overrides)
     ↓
RequestUnderstandingResult  ★ CANONICAL
  ├─ UI (schema, summary, questions)
  ├─ toPriceCanonicalHints → price engine (routing uses canonicalStrategy)
  ├─ toMatchingEstimateInput → matching estimate
  ├─ safeDraftAttributes → professional draft
  └─ Edit re-understand with STRUCTURED_FIELD provenance
```

| CONCEPT | AUTHORITATIVE OWNER | ALLOWED PRIMITIVES | CONSUMERS | LEGACY FALLBACK |
|---------|---------------------|--------------------|-----------|-----------------|
| raw request | user input | normalize | brain | — |
| intent | `understandRequest` | intent-signals | UI, matching, draft | — |
| category | `understandRequest` | `detectCategoryResult` | UI, matching adapter | schema provisional only |
| strategy | `understandRequest` | `resolvePriceStrategy` inside brain | price engine, fingerprint | resolver if no canonical |
| identity | `understandRequest` | Product Identity V1.1 | UI, price, draft | — |
| condition / qty / attrs | `understandRequest` + structured | number-role, etc. | all adapters | — |
| questions | brain unknowns − known | human-question-layer | UI | — |
| price context | adapters + canonical strategy | — | preview / engine | resolvePriceStrategy |
| matching context | `toMatchingEstimateInput` | — | estimate API | legacy category param only if no rawInput |
| draft context | `safeDraftAttributes` | — | compose draft | — |

---

## 6. EDIT REQUEST MIGRATION

**File:** `src/components/panel/EditRequestForm.tsx`

- Removed authoritative `runTalepoAiCore` / `parseRequest`
- Feeds persisted category as locked `STRUCTURED_FIELD` into `understandRequest`
- User corrections win on re-understand; unedited facts remain stable

Provenance: persisted form values use **STRUCTURED_FIELD** (not falsely marked as raw-text explicit).

---

## 7. EDIT ROUND-TRIP

Verified in `verify-single-brain-closure.ts`:

`RAW → understand → form seed → edit one field → understand again`

- Manual correction wins  
- Unrelated facts stable  
- **EDIT ROUND-TRIP SEMANTIC DRIFT COUNT = 0**

---

## 8. MATCHING ESTIMATE MIGRATION

**Files:** `consumer-adapters.ts` (`toMatchingEstimateInput`), `api/matching/estimate/route.ts`

- Prefer `rawInput` → `understandRequest` → adapter
- Matching may score/filter; does **not** reinterpret category/intent
- UNKNOWN / weak TENTATIVE → `INSUFFICIENT_UNDERSTANDING` (no silent `services`)
- Legacy `?category=` without rawInput remains opaque filter compatibility only

**CANONICAL/MATCHING CATEGORY MISMATCH COUNT = 0**

---

## 9. PRICE ENGINE STRATEGY MIGRATION

**Files:** `price-intelligence-engine.ts`, `run-price-intelligence-preview.ts`, `preview-fingerprint.ts`

- `canonicalStrategy?` on price query
- When present and valid → **USE IT** for routing (no conflicting re-resolve)
- When absent → existing `resolvePriceStrategy` compatibility fallback
- Preview passes `toPriceCanonicalHints` → engine

Invariant for canonical request flow:

`CANONICAL STRATEGY = PRICE ENGINE STRATEGY = PROVIDER ROUTING STRATEGY`

**CANONICAL/PRICE-INTERNAL STRATEGY MISMATCH COUNT = 0**

---

## 10. HOME HANDOFF

**File:** `HomeComposer.tsx`

- `detectCategoryHintLabel()` — UX only
- Navigate: `/talep?query=...` only (no category lock in URL)
- Semantic equality Home→/talep vs direct /talep verified in script

**HOME HANDOFF SEMANTIC DRIFT COUNT = 0**  
**HOME CATEGORY AUTHORITATIVE: NO**

---

## 11. URL CATEGORY HINT SEMANTICS

Three distinct concepts:

| Concept | Meaning |
|---------|---------|
| `CATEGORY_HINT` | Unlocked URL `?category=` — soft, non-locking |
| `USER_CATEGORY_OVERRIDE` | Explicit user lock / structured override |
| `CANONICAL_CATEGORY` | Brain decision |

Priority: **USER LOCK > canonical CONFIDENT/TENTATIVE > unlocked hint > provisional schema**

Adversarial (live + script):  
`?category=services` + `"dyson v15 sıfır arıyorum"` → product / Beyaz Eşya wins (unlocked hint does not force Services).

---

## 12. LEGACY PARSER CONTAINMENT

| Caller | Classification |
|--------|----------------|
| `/talep`, EditRequestForm, preview, matching (rawInput) | **A. migrated** |
| offer-assistant `parseRequest` | **B. legacy non-critical** (outside request create/edit) |
| verify / diagnostic scripts | **C. diagnostic/test** |
| Active request workflow product risk | **D = 0** |

`runTalepoAiCore` / `parseRequest` / legacy `detectCategory` annotated deprecated for canonical request workflows. Not deleted.

---

## 13. PRODUCT IDENTITY AUTHORITY

- Single Product Identity V1.1 path inside canonical brain
- Consumers use `understanding.identity` / safe adapters
- **DUPLICATE PRODUCT IDENTITY AUTHORITY COUNT = 0**
- No brand/model-specific production hacks added

**UI-visible semantic fix (not Product Identity change):** year-like tokens (e.g. `"2013"`) are not seeded/shown as brand in summary/title/draft adapters — prevents `"2013 2013 C180"` display corruption. Identity object itself unchanged (V1.1 behavior preserved).

---

## 14. UNKNOWN/TENTATIVE PRESERVATION

- UNKNOWN category → matching insufficient; no silent services
- TENTATIVE not upgraded to CONFIDENT across adapters
- Metrics: **UNKNOWN→CONCRETE LEAK = 0**, **TENTATIVE→CONFIDENT LEAK = 0**

---

## 15. ADAPTER BOUNDARIES

Pure adapters in `consumer-adapters.ts` / `activation-bridge.ts`:

- `toMatchingEstimateInput`
- `toPriceCanonicalHints` / `strategyResolutionFromUnderstanding`
- `seedFieldValuesFromUnderstanding`
- `buildUnderstandingSummary`
- `safeDraftAttributes`
- `CanonicalRequestContext` packaging (not a second model)

Adapters map/shape only — no category/brand/strategy guessing.

---

## 16. PERFORMANCE

- `/talep` continues single memoized `understandRequest` per input fingerprint
- Preview debounce / cost controls unchanged
- No intentional understand→state→understand loops introduced

---

## 17. LIVE BROWSER QA

**LIVE_BROWSER_QA = RUN** (real browser tooling, localhost `/talep`)

| Fixture | Observed |
|---------|----------|
| `2013 model c180 düşük km araç arıyorum` | Otomotiv; headline `2013 C180` (year-as-brand fixed) |
| `c180 parçası lazım` | Otomotiv; `C180 parça` |
| `dyson v15 sıfır` | Beyaz Eşya; Dyson understanding |
| `başakşehir 2+1 kiralık ev` | Emlak; kiralık 2+1 |
| `?category=services` + dyson | Unlocked hint ignored → Beyaz Eşya |

Notes: Next.js hydration overlay observed intermittently on `/talep` (pre-existing risk; not introduced as dual-authority). Edit panel not fully exercised in browser (covered by script round-trip).

---

## 18. SINGLE-BRAIN METRICS

| Metric | Value |
|--------|-------|
| ACTIVE DUAL-AUTHORITY PATH COUNT | **0** |
| EDIT ROUND-TRIP SEMANTIC DRIFT COUNT | **0** |
| HOME HANDOFF SEMANTIC DRIFT COUNT | **0** |
| CANONICAL/PRICE-INTERNAL STRATEGY MISMATCH COUNT | **0** |
| CANONICAL/MATCHING CATEGORY MISMATCH COUNT | **0** |
| UNKNOWN→CONCRETE LEAK COUNT | **0** |
| TENTATIVE→CONFIDENT LEAK COUNT | **0** |
| STRUCTURED OVERRIDE LOST COUNT | **0** |
| DUPLICATE PRODUCT IDENTITY AUTHORITY COUNT | **0** |

---

## 19. REGRESSION RESULTS

| Suite | Result |
|-------|--------|
| `npm run build` | **PASS** |
| `verify-single-brain-closure` | **PASS** |
| `verify-request-understanding-brain` | **PASS** |
| `verify-canonical-request-flow` | **PASS** |
| `verify-global-product-identity` | **PASS** |
| `verify-external-price-intelligence` | **PASS** |
| `verify-price-strategy` | **PASS** |
| `verify-provider-routing` | **PASS** |
| `verify-confidence-v2` | **PASS** |
| `verify-request-preview` | **PASS** |
| `verify-request-ux-state` | **PASS** |
| `verify-human-request-understanding` | **PASS** |

---

## 20. FILES CREATED

- `apps/web/scripts/verify-single-brain-closure.ts`
- `apps/web/src/lib/request-understanding/consumer-adapters.ts` (CanonicalRequestContext + matching/price adapters)
- `apps/web/TALEPO-SINGLE-BRAIN-CLOSURE-B3.6-REPORT.md`

---

## 21. FILES MODIFIED

- `src/components/panel/EditRequestForm.tsx`
- `src/app/api/matching/estimate/route.ts`
- `src/server/price-intelligence/price-intelligence-engine.ts`
- `src/server/price-intelligence/run-price-intelligence-preview.ts`
- `src/lib/request-brain/preview-fingerprint.ts`
- `src/components/home/HomeComposer.tsx`
- `src/lib/request-category-engine.ts` (`detectCategoryHintLabel`, deprecation notes)
- `src/lib/ai/orchestrator.ts` / `parser.ts` (deprecated for request workflows)
- `src/app/talep/page.tsx` (URL hint vs lock priority; matching rawInput)
- `src/hooks/useRequestBrain.ts`
- `src/lib/request-understanding/activation-bridge.ts` (year-as-brand display safety)
- `src/lib/request-understanding/index.ts` (exports)

---

## 22. REMAINING LEGACY CODE

- `runTalepoAiCore` / `parseRequest` (offer-assistant and any residual callers)
- Legacy `detectCategory` (compatibility; Home uses hint wrapper)
- Matching estimate legacy `?category=` without `rawInput`
- Price engine `resolvePriceStrategy` when `canonicalStrategy` absent

Safe to keep; not product-level authorities for migrated request flows.

---

## 23. REMAINING ARCHITECTURAL RISKS

1. Offer-assistant still parses independently (outside create/edit lifecycle)
2. Product Identity may still extract year-like brand tokens internally — display adapters filter them; deeper identity fix is out of B3.6 scope (V1.1 freeze)
3. Occasional `/talep` hydration mismatch in Next.js dev
4. Full supplier matching engine still category-centric by contract (adapter bridges meaning; engine redesign deferred)
5. Legacy matching callers without `rawInput` remain non-canonical by design

---

## 24. NEXT RECOMMENDED PHASE

**STOP — await review.** Do not start B4 / ambiguity / LLM / knowledge resolver.

When ready (post-review candidates only):

- Optional: migrate offer-assistant to canonical understanding
- Optional: Product Identity year≠brand hardening (separate from V1.1 freeze policy)
- Optional: delete legacy parsers after zero remaining callers

---

## REQUIRED DECLARATIONS

| Declaration | Value |
|-------------|-------|
| CANONICAL BRAIN AUTHORITATIVE ON CREATE | **YES** |
| CANONICAL BRAIN AUTHORITATIVE ON EDIT | **YES** |
| CANONICAL STRATEGY USED INSIDE PRICE ROUTING | **YES** |
| MATCHING INPUT DERIVED FROM CANONICAL | **YES** |
| HOME CATEGORY AUTHORITATIVE | **NO** |
| LEGACY PARSER AUTHORITATIVE IN ACTIVE REQUEST FLOW | **NO** |
| UNKNOWN CATEGORY DEFAULTS TO SERVICES | **NO** |
| BRAND-SPECIFIC PRODUCTION CODE ADDED | **NO** |
| MODEL-SPECIFIC PRODUCTION CODE ADDED | **NO** |
| LLM ADDED | **NO** |
| DATABASE CHANGED | **NO** |
| PROVIDER ADDED | **NO** |
| MATCH THRESHOLD CHANGED | **NO** |
| UI REDESIGNED | **NO** |
| COMMIT/PUSH | **NO** |

**UI-visible change documented:** year-as-brand filtered from summary headline / seeded brand / draft brand (semantic correctness only).

---

## FINAL VERDICT

**PASS_SINGLE_BRAIN_CLOSURE**
