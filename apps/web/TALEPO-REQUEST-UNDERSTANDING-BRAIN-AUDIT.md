# TALEPO — REQUEST UNDERSTANDING ENGINE
# PHASE A — EXISTING BRAIN AUDIT
# READ-ONLY ARCHITECTURE ANALYSIS

**Date:** 2026-08-11  
**Scope:** `apps/web` — no production code/UI/DB/provider changes in this phase.  
**Method:** Static code mapping + live probe of existing engines on short/messy corpus.

---

## A. CURRENT RAW INPUT FLOW

### Call chain (`/talep`)

```
USER requestText
  ↓  useMemo
runTalepoAiCore(text)                          lib/ai/orchestrator.ts
  ↓
parseRequest(text)                             lib/ai/parser/parser.ts
  ├─ normalizeCasualTurkish                    lib/ai/parser/normalize-casual-tr.ts
  ├─ detectCategoryResult                      lib/ai/parser/category.ts
  ├─ detectQuantity                            lib/ai/parser/entity.ts
  ├─ detectAttributes(text, categoryId)        lib/ai/parser/entity.ts
  ├─ extractBudgetFromText                     lib/ai/parser/budget.ts
  ├─ detectCity / detectDeliveryDays           lib/ai/parser/entity.ts
  └─ needType defaults + resolveSubcategory    parser.ts
  ↓
getCategoryById(parsed.categoryId)             lib/request-category-engine.ts
  ↓
runKnowledgeEngine(parsed)                     lib/ai/knowledge/index.ts
estimatePrice(parsed)                          lib/ai/pricing/estimate.ts   (heuristic, not PI)
estimateCompanyMatches(parsed)                 lib/ai/matching/companyMatcher.ts
createRecommendations(parsed)                  lib/ai/recommendations/…
composeProfessionalDescription(parsed…)        lib/ai/request-text-composer.ts
  ↓
page.tsx merges → activeCategoryId, form drafts, dynamicValues
  ├─ soft override: unconfident services + purchase verb → appliances
  ├─ composeRequestTitle / composeProfessionalDescription (2nd pass)
  └─ useRequestBrain(draft)                    hooks/useRequestBrain.ts
        ├─ buildLocalRequestIntelligence       request-brain/local-intelligence.ts
        │     → buildPriceStrategyContext
        │     → resolvePriceStrategy
        │     → computeStrategyCompleteness
        │     → rankNextBestQuestions → toHumanQuestions
        └─ POST /api/price-intelligence/preview
              → resolvePreviewCategorySync     (NO re-parse)
              → normalizeProductFromRequest
              → buildProductIdentity
              → resolvePriceStrategy (again, may have identity)
              → getPriceIntelligence / Confidence V2
```

**Critical property:** Category is decided **early** in the client parser, then reused. Preview/server does **not** re-run category detection; it trusts the draft’s `categorySlug`.

---

## B. CATEGORY DETECTION

| Item | Current state |
|------|----------------|
| **Primary files** | `lib/ai/parser/category.ts` (`detectCategoryResult`, `detectCategoryId`) |
| **Legacy twin** | `lib/request-category-engine.ts` → `detectCategory()` (HomeComposer; last category = services when score 0) |
| **Scoring** | Keyword substring scores `ceil(len/5)` + category boosts (brands, models, paint, household vs machinery…) |
| **Default / fallback** | Loop init `winner = "services"`. If `winnerScore <= 0` → still return `categoryId: "services"` but `confident: false` |
| **Confidence** | `confident` boolean + numeric `score`; `CATEGORY_CONFIDENT_MIN_SCORE = 2`; services need score ≥ 3; retail tie soft-rule |
| **Alternatives** | `runnerUpId` / `runnerUpScore` computed — **not wired to UI** |
| **UI reads** | `aiResult.parsed.categoryId` + `categoryConfident`; override via `categoryOverride` / clarification |
| **Server re-detect?** | **No.** Preview uses client-sent slug only |

### Historical `"dyson arıyorum" → services` (and post-fix)

**Architectural cause (pre-5.4):**
1. Winner defaulted to `services` at score 0.
2. UI treated that id as certain (“Hizmet”).
3. “Dyson” was absent from appliance keyword/brand catalogs → no score → silent services default.

**Post-5.4:**
1. Dyson (and other retail brands) live in **catalog lists** used by keyword scoring — not `if (dyson)`.
2. Score 0 never sets `confident: true`; knowledge confidence capped.
3. Soft UI override for unconfident services + purchase intent → provisional `appliances` field schema.
4. Probe today: `"dyson lazım"` → `appliances`, `confident=true`, strategy `RETAIL_PRODUCT`.

**Remaining architectural smell:** Fallback id is still literally `"services"` when nothing matches. Downstream strategy/completeness can still attach `SERVICE_SCOPE` if a consumer ignores `confident` (see `"v15 bakıyom"`).

---

## C. INTENT DETECTION

There is **no** unified intent enum (`BUY | RENT | SERVICE | …`).

| Desired intent | Current representation | Source |
|----------------|------------------------|--------|
| BUY (product) | Category + purchase verbs; strategy `RETAIL_*` / `VEHICLE` | category + strategy |
| RENT / SALE | `attributes.listingType` = Kiralık / Satılık | `detectAttributes` (real-estate) |
| SERVICE | `needType=service` **or** category `services` | entity / category |
| MANUFACTURE | strategy `CUSTOM_MANUFACTURING` (no needType) | strategy-resolver |
| PART | `needType=part\|tire` | automotive/machinery entity |
| VEHICLE | `needType=vehicle` | automotive (+ parser default) |
| SOFTWARE / HARDWARE | `needType=software\|hardware` | technology entity / defaults |
| MACHINE | `needType=machine` | machinery |

**Fragmentation:** Same user goal can be expressed as category slug XOR needType XOR listingType XOR strategy key. Strategy resolver ranks candidates (`resolveFromNeedType` → RE → manufacturing → … → category hint) but **does not** produce a single canonical intent object.

**Documented conflict example:** `"c180 parçası lazım"` stays `needType=vehicle` because part morphology (`parçası`) misses explicit part phrases, and `wantsVehicle` is true whenever a model is present.

---

## D. ATTRIBUTE EXTRACTION

**Entry:** `detectAttributes(text, categoryId)` in `lib/ai/parser/entity.ts` (+ quantity/city/budget/delivery detectors).

| Field | Source | Confidence | Explicit/inferred | Normalization |
|-------|--------|------------|-------------------|---------------|
| brand / brandPreference | catalog `findBrand` | none on attr | implicit catalog | raw canonical |
| model | catalog / regex | none | implicit | raw |
| modelYear | year regex | none | text match | number |
| condition | keywords (sıfır, 2.el…) | none | keyword | Turkish labels |
| needType | category rules + defaults | none | often **inferred default** | enum-like strings |
| listingType | kiralık/satılık | none | keyword | label |
| roomCount / area / location | RE regex | none | text | partial |
| quantity / unit | `detectQuantity` | none | text | **error-prone** (V15→15, Heidelberg 74→74) |
| budget | `extractBudgetFromText` | none | text | TRY display |
| city | `detectCity` | none | text | known cities |
| dimensions / paperWeight | regex | none | text | number |
| mileage | **not extracted** | — | — | “düşük km / 50 bin km” stays in raw |
| specs | tech dumps “temiz” etc. | none | fuzzy → specs string | weak |

**Provenance:** Attribute map is flat `Record<string, …>` — no `explicit | inferred | unknown` tags.

---

## E. PRODUCT IDENTITY

| Piece | Location |
|-------|----------|
| `buildProductIdentity` | `lib/product-identity/identity-builder.ts` |
| Brand extraction | `brand-extraction.ts` (`source: structured\|memory\|inferred\|none`) |
| Semantic fields | `semantic-fields.ts` |
| Fingerprint | hash in identity-builder |
| Condition | `condition.ts` |
| Server bridge | `normalizeProductFromRequest` → identity → legacy `NormalizedProduct` |

**Relationship to parser:** Identity runs **later** (preview/PI), not inside `parseRequest`. It re-reads title + fieldValues and may invent/split brand/model differently.

**Conflict examples from probe:**
- `"2013 c180 düşük km"` → identity brand **`2013`** (year as brand)
- `"merso c180"` → brand **`merso`** (not Mercedes knowledge)
- `"heidelberg 74…"` → brand `heidelberg 74`, model `ikinci el lazım`
- `"lattego lazım"` → model **`lazım`**
- `"urban plus bebek arabası"` → brand `urban plus`, model `bebek`

Parser and Identity are **duplicate brand/model brains** with different failure modes.

---

## F. STRATEGY RESOLUTION

**Function:** `resolvePriceStrategy(ctx)` — `lib/price-intelligence/strategy-resolver.ts`

**Inputs (`PriceStrategyContext`):**
`categorySlug`, `title`, `needType`, `condition`, `attributes`, `semanticFields`, `brand`, `model`, `productType`, `identityConfidence`

**Local brain path** (`buildLocalRequestIntelligence`): builds context from draft **without** full Product Identity enrichment → weaker retail/identity strategies for short titles.

**Upstream damage examples:**
| Bad upstream | Downstream |
|--------------|------------|
| category=services @ score 0 (if treated as certain) | `SERVICE_SCOPE`, service questions, wrong PI routing |
| needType stuck at vehicle | `VEHICLE` instead of `AUTO_PART` / `SERVICE_SCOPE` |
| listingType missing on “ev lazım” | `REAL_ESTATE_SALE` hint (0.45) instead of rent |
| home-kitchen without retail identity signals | `UNKNOWN` (lattego) |

---

## G. HUMAN QUESTION LAYER

**File:** `lib/request-brain/human-question-layer.ts`

| Class | Exists? | Behavior |
|-------|---------|----------|
| REQUIRED_TO_PUBLISH | YES | budget/city/required dynamics |
| HIGH_VALUE | YES | brand/model/condition/year… |
| OPTIONAL | YES | delivery, frequency… |
| INFERABLE | YES | only if already filled (classify path) |
| EXPERT_ONLY | YES | specs/technicalSpecs/vin… dropped from primary |
| IRRELEVANT | YES | reserved |

**Pipeline:** `computeStrategyCompleteness.nextBestFields` → `rankNextBestQuestions` → page filter (drops specs) → `toHumanQuestions`.

**Leakage residual:**
- Strategy profiles still list `specs` as important; ranking can propose it before filter.
- Category form “Teknik özellikler” still exists under “Tüm detayları düzenle”.
- `smart-nudge.ts` / composer may still echo specs language.

---

## H. DUPLICATE BRAINS

| Brain | WHAT IT UNDERSTANDS | INPUT | OUTPUT | CONFIDENCE | OVERLAP | CONFLICT RISK |
|-------|---------------------|-------|--------|------------|---------|---------------|
| AI Parser | category + attrs | raw text | `ParsedRequest` | cat score/confident; knowledge 0–100 | Identity brands | High |
| Legacy `detectCategory` | keywords | text | RequestCategory | none | AI category | Home path diverge |
| Knowledge engine | fill ratio notes | ParsedRequest | notes + score | fill % | form liveScore | Medium |
| Heuristic `estimatePrice` | fake band | ParsedRequest | min/max | fixed 45 | Real PI | High if shown |
| Request Brain local | strategy + questions | RequestDraft | strategy, completeness, Qs | strategyConfidence | Server strategy | Medium (no identity) |
| Product Identity | brand/model/fp | title + fields | ProductIdentity | identity/brand conf | Parser brands | High |
| Price Intelligence | market | draft + identity | range + Conf V2 | overall/int/ext | — | Downstream only |
| Match engine | listing similarity | identity vs listing | score ≥ 0.4 | match quality | — | Downstream |
| Company matcher / recommendations | UX tips | ParsedRequest | counts | weak | — | Parallel |
| Form `liveScore` / missingFields | publish fill | form | % / blockers | none | strategy completeness | High drift |
| Human Question Layer | UX ranking | nextBestFields | human prompts | n/a | smart-nudge | Low |
| Clarification builder | category uncertainty | raw + confident | option chips | n/a | runnerUp unused | Low |

---

## I. EXPLICIT / INFERRED / UNKNOWN GAP

**Conceptual split for** `"2013 model c180 düşük km araç arıyorum"` **is not implemented.**

| Expected | Current |
|----------|---------|
| EXPLICIT: 2013, C180, düşük km, araç, arıyorum | Partially: modelYear, model, needType=vehicle; **düşük km lost** |
| INFERRED: Mercedes-Benz, VEHICLE, automotive | Category/strategy yes; **Mercedes not inferred** (knowledge boundary missing); identity may hallucinate brand=`2013` |
| UNKNOWN: budget, maxMileage, trim… | Completeness lists missing fields, but **not** as typed unknownFacts[] |

Only partial provenance: brand-extraction `source`, category `confident`.  
**Gap: system-wide provenance is missing.**

---

## J. AMBIGUITY / CONTRADICTION GAP

| Capability | Status |
|------------|--------|
| Category confidence + runnerUp | Exists; runnerUp unused in UI |
| Clarification chips (`buildCategoryClarification`) | Exists for weak category |
| Contradiction detector (2013 vs 2020+) | **Missing** |
| Structured `ambiguities[]` / alternatives | **Missing** |
| Intent alternatives (part vs vehicle vs service) | **Missing** (defaults to vehicle when model present) |
| Condition ambiguity signal | Only inside Confidence V2 market path |

---

## K. SHORT / MESSY INPUT TEST

Live probe of existing engines (2026-08-11).  
`WRONG CONFIDENT?` = category or needType/strategy asserted confidently while clearly wrong for user intent.

| RAW INPUT | CATEGORY | CAT CONF | STRATEGY | STRAT CONF | IDENTITY | EXTRACTED | AMBIGUITIES | WRONG CONFIDENT? | RESULT |
|-----------|----------|----------|----------|------------|----------|-----------|-------------|------------------|--------|
| c180 lazım | automotive | true | VEHICLE | 0.92 | model C180 | model, needType=vehicle | brand unknown | no (OK default) | PASS-ish |
| 2013 c180 düşük km | automotive | true | VEHICLE | 0.92 | brand=**2013**, model C180 | year, model, vehicle | düşük km unused; brand halluc. | **YES** (identity brand) | FAIL identity |
| merso c180 bakıyorum | automotive | true | VEHICLE | 0.92 | brand=merso | model C180 | slang brand | partial | PASS-ish |
| c180 parçası lazım | automotive | true | **VEHICLE** | 0.92 | model C180 | needType=**vehicle** | part morphology miss | **YES** | FAIL intent |
| c180 bakım yaptıracam | automotive | true | **VEHICLE** | 0.92 | model C180 | needType=**vehicle** | service slang miss; model⇒vehicle | **YES** | FAIL intent |
| dyson lazım | appliances | true | RETAIL_PRODUCT | 0.72 | Dyson | brand | product family unknown | no | PASS |
| v15 bakıyom | services | **false** | SERVICE_SCOPE* | 0.45 | empty | none | model-only token | strategy ignores cat conf | PARTIAL |
| dyson v15 sıfır | appliances | true | RETAIL_PRODUCT | 0.72 | Dyson | condition Sıfır; **qty=15** | V15→quantity | **YES** qty hallucination | FAIL qty |
| başakşehir 2+1 ev lazım | real-estate | true | REAL_ESTATE_**SALE** | 0.45 | — | 2+1, location | rent vs sale | weak sale default | PARTIAL |
| kiracılı satılık dükkan… | real-estate | true | REAL_ESTATE_SALE | 0.93 | — | Satılık, iş yeri | kiracılı nuance lost | no | PASS-ish |
| 5000 kutu bastırcam | printing | true | CUSTOM_MANUFACTURING | 0.9 | — | qty 5000 | runnerUp appliances | no | PASS |
| 350gr kuşe 5bin kutu | printing | true | CUSTOM_MANUFACTURING | 0.9 | — | paperWeight 350; **qty=350** | 5bin misread | **YES** qty | FAIL qty |
| 200m2 ofis boyatacam | services | true | SERVICE_SCOPE | 0.75 | — | (area not in attrs) | m2 not structured | no | PASS |
| heidelberg 74 ikinci el | machinery | true | INDUSTRIAL_EQUIPMENT | 0.9 | brand/model garbage | needType machine; **qty=74** | model number vs qty | **YES** qty/identity | FAIL extract |
| lattego lazım | home-kitchen | true | **UNKNOWN** | 0.2 | brand lattego, model lazım | usageArea Ev? | retail strategy miss | identity noise | PARTIAL |
| urban plus bebek arabası | baby | true | **UNKNOWN** | 0.2 | brand urban plus, model bebek | babyProductType | Chicco not linked | identity weak | PARTIAL |

\*Local strategy uses categorySlug even when `categoryConfident=false`.

---

## L. CONFIDENCE MAP

| System | Scale | Independent? | Affects UX? |
|--------|-------|--------------|-------------|
| Category score + `confident` | score + bool | Yes | Yes (label / clarification) |
| Knowledge / AiCore score | 0–100 | Mostly fill-ratio | Weak |
| Heuristic price estimate | fixed 45 | Yes | Should not drive PI |
| Strategy confidence | 0–1 | Upstream-dependent | Questions / PI |
| Strategy completeness | 0–1 | Profile-based | Brain readiness |
| Form liveScore | 0–100 | Form fields | Publish UX |
| Product identity confidence | 0–1 | Separate | Matching / strategy (server) |
| Brand extraction confidence | 0–1 | Identity only | Indirect |
| Match quality | ≥0.4 threshold | External | Listings |
| Confidence V2 (int/ext/overall) | levels | Market path | Market card |
| Question `confidenceImpact` | weight | Ranking only | Question order |

**Recommendation:** One canonical envelope on `RequestUnderstandingResult` with **slots** (category, intent, identity, attributes, market) — consumers must not invent a parallel score.

---

## M. CANONICAL CONTRACT GAP

Target: `RequestUnderstandingResult`

| FIELD | EXISTS? | CURRENT SOURCE | QUALITY | CAN REUSE? | NEEDS NEW WORK? |
|-------|---------|----------------|---------|------------|-----------------|
| rawInput | partial | `ParsedRequest.rawText` / draft.rawText | OK | YES | wrap |
| normalizedInput | partial | normalizeCasualTurkish (ephemeral) | OK | YES | persist on result |
| intent | NO unified | needType/listingType/strategy | fragmented | reuse pieces | **NEW** |
| category | YES | detectCategoryResult | improved | YES | expose alternatives |
| strategy | YES | resolvePriceStrategy | good if upstream good | YES | consume canonical only |
| subject | partial | title / summary headline | medium | YES | define |
| identity | YES | buildProductIdentity | uneven | YES | merge w/ parser |
| attributes | YES | detectAttributes | uneven | YES | provenance |
| location | partial | city + RE fields | medium | YES | |
| budget | partial | budget parser + form | medium | YES | |
| condition | partial | keywords | medium | YES | |
| quantity | YES | detectQuantity | **noisy** | YES | harden |
| explicitFacts[] | NO | — | — | — | **NEW** |
| inferredFacts[] | NO | — | — | partial brand source | **NEW** |
| unknownFields[] | partial | completeness missing* | medium | YES | typed unknowns |
| ambiguities[] | NO | runnerUp unused | — | seed from runnerUp | **NEW** |
| contradictions[] | NO | — | — | — | **NEW** |
| understandingConfidence | NO unified | many scores | — | compose | **NEW** |
| publishReadiness | partial | form + readiness | medium | YES | reconcile w/ strategy |
| priceAnalysisReadiness | partial | preview gate | medium | YES | |
| recommendedQuestions[] | YES | human question layer | good direction | YES | feed from canonical |
| professionalDraftContext | partial | composer inputs | invent risk | YES | facts-only context |

---

## N. REUSABLE COMPONENTS

Keep and wrap (do not rewrite):

- `detectCategoryResult` (+ catalogs / boosts)
- `detectAttributes` / entity / budget / normalizeCasualTurkish
- `buildProductIdentity` + semantic fields + match threshold 0.4
- `resolvePriceStrategy` + strategy profiles + completeness
- Confidence V2 + provider routing + preview sanitize
- `toHumanQuestions` / field classification
- `composeProfessionalDescription` (after facts-only context)
- Clarification chip builder

---

## O. COMPONENTS TO CONSOLIDATE

| Action | What |
|--------|------|
| **Orchestrate** | New `buildRequestUnderstanding(raw)` adapter producing canonical result |
| **Deprecate dual use** | Stop treating category id as certain when `confident=false` in strategy/brain |
| **Merge brand/model** | Parser catalog hits + Identity extraction with conflict rules (prefer explicit catalog; never year-as-brand) |
| **Unify completeness** | Map strategy missing ↔ form required; expose “meaning gap” vs “form gap” |
| **Wire alternatives** | category runnerUp + intent alternatives → ambiguities[] |
| **Retire / quarantine** | Heuristic `estimatePrice` from “understanding”; legacy home `detectCategory` align or delete |
| **Quantity hygiene** | Don’t treat model tokens (V15, SM74) as quantity |

---

## P. TARGET ARCHITECTURE

```
USER INPUT
  ↓
normalizeCasualTurkish
  ↓
deterministic extractors (category result, entities, budget, location, qty)
  ↓
product identity candidate (non-authoritative alone)
  ↓
[optional future] semantic interpreter candidate (LLM) — proposals only
  ↓
reconcile / validate / provenance tagging
  ↓
CANONICAL RequestUnderstandingResult
  ├── UI (understood / clarify / questions)
  ├── Price Intelligence preview (strategy + identity from canonical)
  ├── Provider Routing
  ├── Professional Draft (explicitFacts only + safe templates)
  └── Supplier Matching
```

**Suggested service boundary (extension, not rewrite):**

| Module | Role |
|--------|------|
| `lib/request-understanding/types.ts` | Canonical contract |
| `lib/request-understanding/build.ts` | Orchestrator adapter over existing parsers |
| `lib/request-understanding/provenance.ts` | explicit/inferred/unknown |
| `lib/request-understanding/ambiguity.ts` | alternatives + contradictions |
| Existing `lib/ai/parser/*`, `product-identity/*`, `price-intelligence/*` | Engines behind adapter |

---

## Q. FUTURE LLM BOUNDARY

```
deterministic extraction
  → semantic interpreter candidate (proposals + confidences)
  → reconcile/validate against deterministic facts
  → canonical result
```

**Hard rule:** LLM must not be source-of-truth for category, attributes, or market numbers. It may propose ambiguities, soft preferences (“düşük km” → preference), and clarification copy.

---

## R. KNOWLEDGE LAYER BOUNDARY

| Today | Future |
|-------|--------|
| Brand catalogs in `brand-catalog.ts` / automotive models | External knowledge resolver: C180→Mercedes, LatteGo→Philips, Urban Plus→Chicco |
| Product Identity generic brand guess | Knowledge hit as `inferred` with provenance `knowledge` |
| No world-brand hardcoding growth in production ifs | Catalog/knowledge data packs versioned separately |

Parser may keep **lightweight** catalogs for scoring; **relationship knowledge** (model→brand) should not sprawl as `if` trees.

---

## S. METRICS (future)

| Metric | Why |
|--------|-----|
| intent accuracy | part/service/vehicle splits |
| category accuracy | top-1 + top-3 |
| strategy accuracy | downstream PI/routing |
| entity precision / recall | brand/model/year/qty |
| **confident wrong classification rate** | Phase 5.4 killer metric |
| **hallucinated attribute rate** | year-as-brand, V15-as-qty |
| clarification rate | healthy uncertainty |
| repeated question rate | already-answered fields |
| user correction rate | category/field overrides |

---

## T. IMPLEMENTATION PHASES (repo-adjusted)

| Phase | Scope |
|-------|-------|
| **B1** | Canonical types + `buildRequestUnderstanding` adapter (wrap existing; no behavior change required initially) |
| **B2** | Provenance: explicit/inferred/unknown on facts; stop leaking inferred into draft as “said by user” |
| **B3** | Unified category/intent/strategy orchestration; strategy must respect `categoryConfident`; intent alternatives for auto part/service |
| **B4** | Ambiguity/contradiction + wire runnerUp; quantity/model collision guards |
| **B5** | Human questions consume canonical unknowns only; kill residual specs primary leakage |
| **B6** | Stress corpus (this matrix + expand) + metrics harness |
| **B7** | Optional LLM semantic interpreter behind reconcile boundary |

---

## U. RISKS

1. **Treating category id as truth while `confident=false`** still poisons strategy (`v15` → SERVICE_SCOPE).
2. **Quantity false positives** (model numbers) poison manufacturing/PI fingerprints.
3. **Identity hallucinations** (year/slang as brand) poison matching.
4. **Automotive default-to-vehicle** when model present blocks part/service intents.
5. **Dual completeness** (form vs strategy) confuses publish vs enrichment.
6. **Professional draft** can narrate category templates beyond explicit facts.
7. **Home legacy detector** can diverge from AI detector.
8. Expanding brand catalogs without knowledge boundary recreates hardcode debt.

---

## FINAL VERDICT

**READY_TO_BUILD_UNIFIED_BRAIN**

Rationale: Engines already exist and are reusable; the gap is **orchestration + provenance + intent + ambiguity**, not a greenfield rewrite. Phase 5.4 fixed the worst category default UX, but probe matrix still shows **confident wrong intents**, **quantity/identity hallucinations**, and **no explicit/inferred contract** — exactly what a thin unified adapter should address first.

---

*Phase A complete. No production code/UI/DB changes. Temporary probe script removed after capturing matrix. Commit/push not performed.*
