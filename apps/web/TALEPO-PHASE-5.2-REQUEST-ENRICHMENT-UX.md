# TALEPO — Phase 5.2 Request Enrichment UX

## BEFORE UX

Step 2 felt like a form:
- Input grid (title, city, category, budget, required fields)
- "Hızlı filtreler" / missing-field language
- Completeness score ring (% /100)
- "Eksik alan" / validation-heavy tone
- Advanced details competing with primary flow

## AFTER UX

Prepared-request flow:
1. **Talebinizi böyle anladım** + positive copy
2. **Request summary** (headline + editable chips)
3. **Bütçeniz nedir?** (required, natural — not a red validation wall)
4. **Location** only when missing / relevant
5. **Enrichment chips** (optional, strategy-driven)
6. **Tüm detayları düzenle** (collapsed advanced form)
7. **Talebimi Yayınla**
8. Right panel: market → smart nudge → professional draft

## FORM FEEL REDUCED

**YES**

## UNDERSTOOD REQUEST SUMMARY

`RequestSummaryCard` + `buildRequestSummary()`:
- Headline from composed title
- Chips from strategy profile priority + filled field values
- Editable / removable chips
- Single “Talepo verdiğiniz bilgileri talebe dönüştürdü” affirmation (no badge spam)

## BUDGET FLOW

- Budget **required before publish** when category has budget common field
- Soft block: “Bütçeniz nedir?” + friendly publish error if empty
- Market reference hint when reliable range exists
- Optional “Piyasa medyanını kullan” — **no auto-write**

## LOCATION FLOW

- Real estate: structured il/ilçe prompt
- Other: city chips only if city missing
- Do not re-ask if already understood

## ENRICHMENT SYSTEM

`EnrichmentChips` — max candidates from `brain.nextQuestions` (budget/city excluded)

## ENRICHMENT SOURCE

- `StrategyAttributeProfile` / completeness `nextBestFields`
- `rankNextBestQuestions` + FormField metadata
- Quick choices from field options / year ranges

## HARDCODED CATEGORY LOGIC

**NO** — generic strategy/metadata driven

## INLINE EDITING

Chip select → single-field inline editor (chips / select / text) — does not open full advanced form

## COMPLETENESS PRESENTATION

Hidden % score. Mapped to:
- **READY** — Talebiniz yayına hazır.
- **ENRICHABLE** — Talebiniz hazır. Birkaç detay daha…
- **BLOCKED** — Bir bilgiye daha ihtiyacımız var.

Backend completeness still computed.

## ADVANCED DETAILS

Collapsed: **Tüm detayları düzenle** — all existing fields preserved

## TALEPO AI PANEL

Simplified: market → smart nudge → professional draft

## MARKET

Piyasa görünümü + expandable “Bu fiyat nasıl hesaplandı?” (aggregates only)

## SMART NUDGE

One top `nextBestFields` recommendation via `buildSmartNudge()` — no product hardcodes

## PROFESSIONAL DRAFT

Önizle / Bu metni kullan — existing `composeProfessionalDescription()`; apply still opt-in

## DESKTOP

Two-column: summary flow left, sticky AI right

## MOBILE

Collapsible AI panel; publish CTA in main column after readiness

## ALL CATEGORY COMPATIBILITY

Same framework for all 11 categories (strategy + FormField metadata)

## LIVE PREVIEW REGRESSION

Unchanged preview API / fingerprint / category first-call / error fallback

## PUBLISH REGRESSION

Same `POST /api/requests` path; budget gate added client-side before urgency modal

## BUILD

**PASS**

## VERIFY

| Script | Result |
|--------|--------|
| verify-request-preview | PASS |
| verify-request-ux-state | PASS |
| verify-confidence-v2 | PASS |
| verify-provider-routing | PASS |
| verify-price-strategy | PASS |
| verify-external-price-intelligence | PASS |
| verify-global-product-identity | PASS |

## KNOWN ISSUES

1. Some required category fields (e.g. technology needType) still appear as soft “yayın için bir bilgi daha” — necessary for publish, not enrichment.
2. Chip edit of a filled field may open advanced if not in enrichment candidate list (intentional power-user path).
3. Full browser visual QA recommended after hot reload.

## FIRST RELEASE UX

**READY**

## FINAL VERDICT

**PASS**

*Commit/push: not performed (per instructions)*
