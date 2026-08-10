# TALEPO — Phase 5.3 Conversational Request Start UX

## FIRST SCREEN

- Hero: **İhtiyacınızı anlatın.** / **Talepo gerisini hazırlasın.**
- Short explanation (casual writing OK)
- Compact process strip: Anlatın → Talepo anlasın → Birlikte tamamlayın → Teklifleri alın
- No “Adım 1/2” wizard chrome (badge: Yeni talep / Hazırlanıyor)
- CTA empty → **Yazmaya başlayın**; filled → **Talebimi hazırla**

## EMPTY STATE

- Desktop right panel: “Nasıl çalışıyor?” demo only (not live parse)
- Mobile: process strip after CTA; demo behind **Nasıl çalışıyor?** disclosure
- Multi-category example chips under “Nasıl yazabilirsiniz?”

## TYPING STATE

- Right panel: “Talepo dinliyor” until structured signal exists
- CTA enables when text is ready

## UNDERSTOOD STATE

- Real Request Brain / parser only: “Sizi şöyle anladım” + headline + chips + category
- Enrichment hints from `nextBestFields` labels
- Mobile compact “Anladım ✓” under input
- No invented attributes; demo stays demo

## PREPARED STATE

Phase 5.2 preserved:
- **Talebinizi böyle anladım ✓**
- Summary → budget (required, soft) → location/enrichment → advanced collapsed → publish
- Soft copy; no step badge

## PROCESS COMMUNICATION

Mental model throughout: **ANLATIN → TALEPO ANLASIN → BİRLİKTE TAMAMLAYIN → TEKLİFLERİ ALIN**  
Strip is informational, not a wizard progress bar.

## INPUT GUIDANCE

Label: “Ne arıyorsunuz?”  
Conversational placeholder. Example chips fill textarea only (not hardcoded into parser).

## REASSURANCE

✓ Yazım hatası sorun değil  
✓ Kendi cümlelerinizle yazın  
✓ Eksik detayları birlikte tamamlarız

## LIVE UNDERSTANDING

Uses existing local intelligence + `buildRequestSummary`. Empty if insufficient signal.

## BUDGET

Required for publish. Soft prompt: “Talebinizi yayınlamak için son bir bilgiye ihtiyacımız var…”  
Placeholder via `budgetPlaceholderForStrategy` (e.g. rent → `Örn. 25.000 TL / ay`).

## ENRICHMENT

Unchanged Phase 5.2 chips from strategy / `nextBestFields` (max ~2–3).

## PRICE INTELLIGENCE

Unchanged preview. Soft empty: no fake ranges. Empty-state note: “Uygun veri varsa piyasa aralığını da gösteririz.”

## PROFESSIONAL DRAFT

Copy: “Verdiğiniz bilgileri değiştirmeden daha anlaşılır bir talep metni hazırladık.”

## MOBILE

First path: hero → input → CTA (examples/process after). Demo collapsible. Live “Anladım ✓” under input when understood.

## 5-SECOND CLARITY

**PASS**

## "WHAT DO I DO?" CONFUSION

**LOW**

## FORM FEEL

**LOW**

## TALEPO BRAIN VISIBILITY

**HIGH**

## BROWSER QA

| Scenario | Result |
|----------|--------|
| vehicle — `2022 üstü c200 amg lazım 50 bin km altı` | PASS — Otomotiv, live chips, CTA → prepared |
| real estate — `başakşehirde 2+1 kiralık ev arıyorum` | PASS — Emlak, rent chips, budget placeholder `/ ay` |
| retail — `dyson v15 sıfır arıyorum` | PARTIAL — understands product title; UI category often **Hizmetler** (existing detect, not Phase 5.3) |
| manufacturing — `5000 tane logolu kutu yaptıracam` | PASS — Matbaa ve Ambalaj |
| service — `200 metre kare ofis boya badana lazım` | PARTIAL — CTA/live works; category often **Emlak** (existing detect, not Phase 5.3) |

Checks: input ✓ · CTA ✓ · prepared ✓ · budget soft ✓ · enrichment ✓ · no fake market ✓ · no invented chips ✓

## BACKEND CHANGES

**NONE** for engines listed in brief.  
UI-only helpers:
- `budgetPlaceholderForStrategy` in `budget-actions.ts`
- `needType` display map in `request-summary.ts` (labels only)

## BUILD

**PASS** (`npm run build`)

## VERIFY

| Script | Result |
|--------|--------|
| verify-request-preview | PASS |
| verify-request-ux-state | PASS |
| verify-confidence-v2 | PASS |
| verify-provider-routing | PASS |
| verify-price-strategy | PASS |
| verify-global-product-identity | PASS |
| verify-external-price-intelligence | PASS |

## KNOWN NOTES (out of Phase 5.3 scope)

1. Short retail/service phrases can mis-route category (Dyson → Hizmetler; boya → Emlak) — strategy verify scripts still PASS for canonical inputs; conversational short forms inherit existing detect quirks.
2. Do not invent missing attributes to “look smart.”

## FINAL VERDICT

**PASS**

*Commit/push: not performed*
