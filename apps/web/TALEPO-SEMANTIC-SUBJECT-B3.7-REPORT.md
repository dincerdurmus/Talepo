# TALEPO — SEMANTIC SUBJECT & RELATIONSHIP UNDERSTANDING
# B3.7 REPORT

**Date:** 2026-08-11  
**Verdict:** **PASS_SEMANTIC_SUBJECT**

---

## 1. PROBLEM

Browser’da `"Toyota Corolla arka tampon"` girildiğinde UI:

`Toyota Corolla Corolla`

gösteriyordu. Bu yalnızca string tekrarı değildi: sistem entity token’larını çıkarıyor ama **entity’ler arası semantik ilişkiyi** modellemiyordu. Kullanıcının asıl aradığı şey (arka tampon) ile parent (Toyota Corolla) ayrışmıyordu; identity `brand=Toyota Corolla` + `model=Corolla` birleşince headline bozuluyordu.

---

## 2. ROOT CAUSE

1. PART lexicon’ta `tampon` yoktu → intent UNKNOWN → subject VEHICLE  
2. Product Identity V1.1 brand string’e model gömüyordu → `Toyota Corolla` + `Corolla`  
3. Summary `brand + model` mekanik concat yapıyordu  
4. JS `\b` ASCII-only → Türkçe ekli lemma’lar (`pompası`, `kapağı`, `çanta`) kaçıyordu  

---

## 3. SEMANTIC SUBJECT MODEL

First-class `requestSubject: SemanticRequestSubject` on `RequestUnderstandingResult`:

- `kind`: PRODUCT | PART | ACCESSORY | VEHICLE | REAL_ESTATE | SERVICE | MANUFACTURED_ITEM | INDUSTRIAL_EQUIPMENT | SOFTWARE | MEDICAL_DEVICE | UNKNOWN  
- `name` / `displayPhrase` / `position`  
- `parentEntity` { kind, brand, model, series, variant }  
- `relation` / `relationship`  
- `serviceType` / `target`  
- `alternatives[]` (B4 hazırlığı)

Module: `src/lib/request-understanding/semantic-subject.ts`  
Wired in `understandRequest()` after identity, before strategy.

---

## 4. RELATIONSHIP MODEL

| Relationship | Example |
|--------------|---------|
| PART_FOR_PRODUCT | Toyota Corolla → arka tampon |
| ACCESSORY_FOR_PRODUCT | iPhone → kılıf |
| SERVICE_FOR_OBJECT | Corolla → bakım / ofis → boyama |
| VEHICLE_REQUEST | Toyota Corolla arıyorum |
| PRODUCT_REQUEST | Dyson V15 arıyorum |
| PROPERTY_REQUEST | Başakşehir 2+1 kiralık |
| MANUFACTURE_REQUEST | logolu kutu bastır |

---

## 5. WHOLE PRODUCT VS PART

Strong part evidence overrides whole-product purchase:

- `"Toyota Corolla arka tampon"` → PART + AUTO_PART  
- `"Toyota Corolla arıyorum"` → VEHICLE  
- Negation: `"tampon istemiyorum araç arıyorum"` → VEHICLE (PART kaybetmez)

Retail spare (`Dyson V15 filtresi`): subject PART korunur; dedicated retail-spare strategy yok → güvenli supported strategy (genelde RETAIL_PRODUCT path / category appliances). Vehicle parent → AUTO_PART.

---

## 6. PART / ACCESSORY

Generic lemma registries (marka/model branch yok):

- PART: tampon, far, ayna, filtre, kapak, pompa, merdane, balata, batarya, mandren, …  
- ACCESSORY: kılıf, başlık, stand, çanta, aparat, …  
- Position: ön, arka, sağ, sol, üst, alt, iç, dış  
- Turkish mutation: kapak → kapağı  

Unicode word boundaries (`\p{L}`) — ASCII `\b` kaldırıldı.

---

## 7. SERVICE TARGET

`"200m2 ofis boyatacam"` → SERVICE, serviceType=boyama, target=ofis, area=200m²  
Summary: `200 m2 ofis için boyama`

Negation: `"servis istemiyorum cihazın kendisini arıyorum"` → SERVICE zorlanmaz.

---

## 8. MANUFACTURING SUBJECT

`"5000 tane logolu kutu bastırcam"` / `"1000 bez çanta bastıracağım"` / `"350gr kuşe 5bin kutu"`  
→ MANUFACTURED_ITEM (çanta accessory lexicon’tan önce manufacture verb önceliği)

---

## 9. REAL ESTATE SUBJECT

`"Başakşehir 2+1 kiralık ev"` → REAL_ESTATE  
Summary duplication guard: `Başakşehir Başakşehir` yok.

---

## 10. SUMMARY COMPOSITION

`buildUnderstandingSummary()` artık `requestSubject` üzerinden:

- PART: `{parent} için {displayPhrase}`  
- SERVICE: `{area?} {target?} için {service}`  
- MANUFACTURE / REAL_ESTATE / VEHICLE / PRODUCT: semantic templates  
- Generic adjacent-token dedupe safety (hack değil, guard)

`/talep` “Sizi şöyle anladım” semantic headline’ı tercih eder.  
Category label: `Otomotiv · Yedek parça` (subtype mevcutsa).

---

## 11. HUMAN QUESTION IMPACT

- `solutionType` / `productName` / `specs` / `technicalSpecs` primary’den elenir  
- AUTO_PART boost: modelYear, condition, partPreference, city, budget  
- Part zaten biliniyorsa `part` sorusu tekrarlanmaz  
- Metric: GENERIC_BACKEND_QUESTION_LEAK = 0  

Mevcut schema’da `partQuality` / `originalEquivalent` ayrı field yok → `partPreference` reuse; raporlandı.

---

## 12. TEST CORPUS

`scripts/verify-semantic-request-subject.ts` — 27 fixtures (automotive parts, retail part/accessory, machinery, service, manufacturing, real estate, negation).

---

## 13. SEMANTIC METRICS

| Metric | Value |
|--------|-------|
| TOTAL FIXTURES | 27 |
| PASS | 27 |
| FAIL | 0 |
| SUBJECT ACCURACY | 100% |
| RELATIONSHIP ACCURACY | 100% |
| WHOLE-VS-PART ACCURACY | 100% |
| SEMANTIC ENTITY DUPLICATION COUNT | **0** |
| GENERIC BACKEND QUESTION LEAK COUNT | **0** |
| FABRICATED RELATIONSHIP COUNT | **0** |
| EXPLICIT SUBJECT LOSS COUNT | **0** |
| CONFIDENT WRONG SUBJECT COUNT | **0** |

---

## 14. BROWSER QA

**LIVE_BROWSER_QA = RUN**

| Input | Headline |
|-------|----------|
| Toyota Corolla arka tampon | **Toyota Corolla için arka tampon** (no Corolla Corolla) |
| C180 ön far | **C180 için ön far** (no fabricated Mercedes) |
| Dyson V15 filtresi | **Dyson v15 için filtre** |
| 200m2 ofis boyatacam | **200 m2 ofis için boyama** |
| Başakşehir 2+1 kiralık ev | (script + prior) semantic real-estate |

---

## 15. REGRESSIONS

| Suite | Result |
|-------|--------|
| npm run build | **PASS** |
| verify-semantic-request-subject | **PASS** |
| verify-single-brain-closure | **PASS** |
| verify-request-understanding-brain | **PASS** |
| verify-canonical-request-flow | **PASS** |
| verify-global-product-identity | **PASS** |
| verify-external-price-intelligence | **PASS** |
| verify-price-strategy | **PASS** |
| verify-provider-routing | **PASS** |
| verify-confidence-v2 | **PASS** |
| verify-request-preview | **PASS** |
| verify-request-ux-state | **PASS** |
| verify-human-request-understanding | **PASS** |

---

## 16. FILES CREATED

- `apps/web/src/lib/request-understanding/semantic-subject.ts`
- `apps/web/scripts/verify-semantic-request-subject.ts`
- `apps/web/TALEPO-SEMANTIC-SUBJECT-B3.7-REPORT.md`

---

## 17. FILES MODIFIED

- `src/lib/request-understanding/types.ts` — SemanticRequestSubject types  
- `src/lib/request-understanding/understand-request.ts` — wire + strategy overrides  
- `src/lib/request-understanding/activation-bridge.ts` — semantic summary + seeds  
- `src/lib/request-understanding/index.ts` — exports  
- `src/app/talep/page.tsx` — semantic headline + subtype label  
- `src/lib/ai/request-text-composer.ts` — part title `için`  
- `src/lib/request-brain/question-priority.ts` — AUTO_PART boost + leak block  
- `src/lib/request-brain/human-question-layer.ts` — generic question filter  

---

## 18. REMAINING RISKS

1. Retail spare-part için ayrı PriceStrategy yok — subject PART doğru; strategy taxonomy sınırlı  
2. Conversational start strip vs full AI panel subtype label tutarlılığı (HMR/path) iyileştirilebilir  
3. Lemma registry genişledikçe false positive riski (motor yalnız, çanta accessory vs manufacture) — manufacture verb priority ile azaltıldı  
4. Product Identity hâlâ year/brand edge case üretebilir — semantic reconciliation + display guard ile sınırlandı; V1.1 rewrite yok  
5. B4 ambiguity engine henüz yok — `alternatives[]` contract hazır  

---

## 19. NEXT STEP

**STOP — await review.**

Aday (sonra): B4 ambiguity clarification; retail PART strategy taxonomy; conversational subtype label parity.

---

## DECLARATIONS

| Declaration | Value |
|-------------|-------|
| SEMANTIC SUBJECT FIRST-CLASS | **YES** |
| RELATIONSHIP FIRST-CLASS | **YES** |
| WHOLE PRODUCT / PART DISTINCTION | **YES** |
| SEMANTIC ENTITY DUPLICATION COUNT | **0** |
| GENERIC BACKEND QUESTION LEAK COUNT | **0** |
| CONFIDENT WRONG SUBJECT COUNT | **0** |
| BRAND-SPECIFIC PRODUCTION CODE | **NO** |
| MODEL-SPECIFIC PRODUCTION CODE | **NO** |
| LLM ADDED | **NO** |
| DATABASE CHANGED | **NO** |
| UI REDESIGNED | **NO** (minimum semantic summary fix only) |
| COMMIT/PUSH | **NO** |

---

## FINAL VERDICT

**PASS_SEMANTIC_SUBJECT**
