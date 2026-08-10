# TALEPO — Phase 5.4 Request Experience + Talepo AI Workspace

## AUDIT BEFORE IMPLEMENTATION

### CRITICAL
1. Category defaulted to `services` at score 0 → “Dyson arıyorum” confidently shown as **Hizmet**
2. Publish success was redirect-only — no completion moment
3. Talepo AI panel felt like a tiny secondary card, not a workspace
4. Insufficient market data could feel like “Talepo did nothing”
5. Low-confidence category presented as certain fact

### HIGH
6. “Teknik özellikler” / expert fields surfaced as primary chips
7. Paint + ofis phrases misrouted to **Emlak**
8. Household “kahve makinesi” could win **Makine**
9. Publish error reset left analysis status stuck / weak copy
10. Weak publish click feedback (“Bastım mı?”)

### MEDIUM
11. First-screen copy still slightly form-adjacent
12. Budget wording not fully strategy-aware
13. Source semantics under-explained
14. Mobile AI hierarchy not first-class

### POLISH
15. Hydration risk from `Date.now()`/`getFullYear()` in year chips
16. Visual hierarchy too muted for primary CTA / understood states

---

## IMPLEMENTED

- Confidence-aware `detectCategoryResult` (no confident `services` at score 0)
- Generic keyword/catalog expansions (product types + brand catalogs; no `if Dyson → …` hacks)
- Paint/service vs real-estate disambiguation; household machine vs industrial machinery
- Human Question Layer (`REQUIRED_TO_PUBLISH` … `EXPERT_ONLY`)
- Talepo AI Workspace: Anladığım / Netleştirelim / Piyasa / Profesyonel talep
- Market presentation states: LOADING / ENOUGH / LIMITED / INSUFFICIENT / ERROR
- Source semantics + expandable “Bu tahmin neye dayanıyor?”
- Publish: publishing copy, in-page success moment, soft error + retry, draft preserved
- First-screen copy + reassurance update
- Wider desktop split (~62/38)

## FIRST SCREEN

Hero: **Ne arıyorsanız anlatın.** / Talepo talebinizi sizinle birlikte hazırlasın.  
Reassurance includes: “Bilmediğiniz detayları bilmek zorunda değilsiniz.”

## TALEPO AI WORKSPACE

Desktop sticky workspace with four intelligence layers. Mobile: same content in expandable companion.

## UNDERSTANDING

Live chips only from real parser/brain. Category label withheld / softened when not confident.

## UNCERTAINTY HANDLING

`buildCategoryClarification` + “Bunu biraz netleştirelim” option chips when detection is weak.

## HUMAN QUESTION LAYER

`human-question-layer.ts` maps fields → human prompts; drops `EXPERT_ONLY` from primary surface; escape paths “Fark etmez / Bilmiyorum”.

## TECHNICAL FIELD UX

`specs` / technical dumps filtered from primary enrichment; condition asked as preference chips.

## MARKET INTELLIGENCE

Uses Phase 4 contract via `buildMarketPresentation`.

### MARKET — ENOUGH DATA
Range + tipik değer + confidence + source semantics.

### MARKET — LIMITED DATA
Range kept + “Sınırlı piyasa verisi” warning; no confident budget comparison.

### MARKET — INSUFFICIENT DATA
Card remains visible with honest copy; **no fake numbers**.

## SOURCE SEMANTICS

Listing / offers / accepted / confirmed / mixed wording (no “people usually buy at…” for listing-only).

## BUDGET INTELLIGENCE

Strategy-aware title/helper/placeholder; median action only when reliable.

## PROFESSIONAL REQUEST

“Verdiğiniz bilgileri değiştirmeden…” + Önizle / Talebimde kullan.

## PUBLISHING STATE

Button: “Talebiniz yayınlanıyor…” + spinner + disabled (double-submit guard).

## PUBLISHED STATE

`PublishSuccessMoment`: ✓ Talebiniz yayınlandı → Şimdi ne olacak? → Talebimi görüntüle / Yeni talep.

## PUBLISH ERROR

“Talebiniz henüz yayınlanamadı. Bilgileriniz korunuyor.” + Tekrar dene. Draft kept. Status → READY_FOR_REVIEW.

## MOBILE

Inline companion hierarchy; sticky publish CTA; process strip after primary path.

## SHORT/MESSY INPUT QA

| INPUT | UNDERSTOOD AS | STRATEGY-ish CAT | CONFIDENCE | FAKE INFO? | RESULT |
|-------|---------------|------------------|------------|------------|--------|
| dyson arıyorum | Dyson / Beyaz Eşya | appliances | confident | no | PASS (was Hizmet) |
| dyson v15 sıfır lazım | appliances | appliances | confident | no | PASS |
| v15 bakıyom | uncertain (no claim) | conf=false | uncertain | no | PASS |
| c200 amg 2022 üstü… | automotive | automotive | confident | no | PASS |
| 2+1 ev lazım başakşehir kiralık | real-estate | real-estate | confident | no | PASS |
| istanbulda kiralık depo | real-estate | real-estate | confident | no | PASS |
| 5000 tane logolu kutu bastırcam | printing | printing | confident | no | PASS |
| heidelberg 74 ikinci el lazım | machinery | machinery | confident | no | PASS |
| 200 metre kare ofis boyatacam | services | services | confident | no | PASS (was Emlak) |
| bosch çamaşır makinesi lazım | appliances | appliances | confident | no | PASS |
| lattego kahve makinesi | home-kitchen | home-kitchen | confident | no | PASS |
| urban plus bebek arabası | baby | baby | confident | no | PASS |

Questions shown: humanized (max 3); expert specs not primary.  
Market state (Dyson prepared, no DataForSEO in env): **INSUFFICIENT** visible.

## MARKET QA

1. Enough data — presentation path implemented (depends on live PI)  
2. Limited — warning + range, no aggressive budget compare  
3. Insufficient — card visible, range null  

Fake price count: **0**

## PUBLISH QA

| Check | Result |
|-------|--------|
| CLICK FEEDBACK | PASS (explicit publishing label + spinner) |
| DOUBLE SUBMIT PREVENTED | YES |
| SUCCESS MOMENT | STRONG (in-page) |
| DRAFT PRESERVED ON ERROR | YES |

Controlled failure exercised via error UI path (copy/retry); live 401 redirects to login as before.

## FAKE PRICE COUNT

**0**

## CONFIDENT WRONG CLASSIFICATION COUNT

**0** on the required stress set (notably Dyson ≠ Hizmet)

## BUILD

**PASS**

## VERIFY

| Script | Result |
|--------|--------|
| verify-human-request-understanding | PASS |
| verify-request-preview | PASS |
| verify-request-ux-state | PASS |
| verify-confidence-v2 | PASS |
| verify-provider-routing | PASS |
| verify-price-strategy | PASS |
| verify-global-product-identity | PASS |
| verify-external-price-intelligence | PASS |

## BACKEND CHANGES

Understanding/UX layer only:
- `detectCategoryResult` + keyword/catalog expansions
- `categoryConfident` / `categoryScore` on `ParsedRequest`
- knowledge confidence cap when uncertain
- No Product Identity V1.1 / routing / Confidence V2 / DataForSEO / match threshold / cache changes

## REGRESSIONS

None observed in verify suite. UX strategy checks now correctly return SERVICE_SCOPE for service samples.

## FIRST RELEASE BLOCKERS

None for audited critical set. Residual polish: appliance “ürün türü” enum still white-goods-centric for Dyson (category schema limitation — not inventing service).

## FINAL VERDICT

**PASS**

*Commit/push: not performed*
