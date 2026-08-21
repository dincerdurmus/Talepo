# 07 — Tests and Evidence

> Handoff hazırlık anında güvenli verifier’lar koşuldu (`npx tsx`, `npm install` yok). Sonuçlar `TEST-VERIFIED`.  
> Test sayısı ≠ production precision/recall.

## Çalıştırılan (2026-08-22 handoff)

| Dosya | Komut | Sonuç | Fixture? | DB? | Browser? | Prod metriği? |
|-------|--------|--------|----------|-----|----------|---------------|
| `scripts/verify-matching-v3-shadow.ts` | `npx tsx scripts/verify-matching-v3-shadow.ts` | **117 passed, 0 failed**; corpus **89** | Synthetic golden | Hayır | Hayır | **Hayır** |
| `scripts/verify-request-authority-v1.ts` | `npx tsx …` | **14 PASS, 0 FAIL** | Unit/synthetic | Hayır | Hayır | Hayır |
| `scripts/verify-taxonomy-drift-v1.ts` | `npx tsx …` | **20/20 PASS** | Taxonomy files | Hayır | Hayır | Hayır |
| `verify-request-composer-v2-slice1.ts` | `npx tsx …` | **13 PASS** | Synthetic | Hayır | Hayır | Hayır |
| `verify-request-composer-v2-controls.ts` | | **128 passed** | Synthetic | Hayır | Hayır | Hayır |
| `verify-request-composer-v2-entity-global-core.ts` | | **28 passed** | Synthetic | Hayır | Hayır | Hayır |
| `verify-request-composer-v2-re-semantics.ts` | | **6 passed** | Synthetic | Hayır | Hayır | Hayır |
| `verify-request-composer-v2-review-display.ts` | | **3 passed** | Synthetic | Hayır | Hayır | Hayır |
| `verify-request-composer-v2-phase2.ts` | | **9 passed** | Synthetic | Hayır | Hayır | Hayır |
| `verify-request-composer-v2-phase2-scheduler.ts` | | **16 passed** | Synthetic | Hayır | Hayır | Hayır |

cwd: `apps/web` (worktree matching-v3).

**Yeniden koşum (2026-08-22 devralma denetimi):** Yukarıdaki **10 verifier’ın tamamı** bağımsız olarak yeniden çalıştırıldı; sayılar **birebir** tuttu (117/89 · 14 · 20/20 · 13 · 128 · 28 · 6 · 3 · 9 · 16), 0 FAIL. [`TEST-VERIFIED`]

## ⚠️ Verifier’lar npm script değil / CI’a bağlı değil

**Düzeltme (2026-08-22 denetimi):** Bu belgenin önceki sürümü yalnız `verify-matching-v3-shadow.ts`’in kayıtlı olmadığını söylüyordu. Gerçek daha geniştir:

`apps/web/package.json` scripts bölümünde **yalnız iki** verify girdisi vardır:

```
"verify:core":     "npx --yes tsx scripts/verify-core.ts"
"verify:phase4b":  "npx --yes tsx scripts/verify-phase4b-soft-launch-v1.ts"
```

Yani bu handoff’un dayandığı **10 verifier’ın hiçbiri** npm script değildir; hepsi elle `npx tsx scripts/<dosya>.ts` ile çalıştırılır. [`CODE-VERIFIED`]

Sonuç:

- Bu testlerin bir CI hattında koşup koşmadığı bu handoff’ta **doğrulanmadı** → `NOT-VERIFIED`.
- Pratik risk: Phase 1/2/3 güvencelerinin hiçbiri **otomatik regresyon koruması altında değil** varsayılmalıdır. Bir sonraki ajan koddaki bir sözleşmeyi bozarsa (ör. `rawInput` yolunu) bunu **kimse otomatik yakalamaz**; yalnız elle koşan biri yakalar.
- Bu yüzden her dilim sonunda ilgili verifier’ları **elle** koşmak zorunludur.

## Ne kanıtlar?

- Phase 1: rawInput’un AI tarafından otomatik ezilmemesi; unresolved soft category; snapshot şekli; getCategoryById güvenliği (açık update ayrı konu)
- Taxonomy: manifest ↔ REQUEST_CATEGORIES; orphan yok; `diger` collision belgelenir
- Phase 2: scheduler ≤3 visible; controls critical text_fallback; entity roles; RE semantics; review display; publish readiness gates (unit düzey)
- Matching V3: structured golden; missing≠exclude; brandModelPairs; tier gates; plan boundary static; notificationsEmitted false

## Ne kanıtlamaz?

- Canlı Pro kaçırma oranı
- Gerçek precision/recall
- Browser/responsive QA
- DB migration production uygulanmışlığı
- Alert/hunter production güvenilirliği
- Eşik kalibrasyonu

## İlgili ama bu turda koşulmayan (varlık `CODE-VERIFIED`, sonuç `NOT-VERIFIED`)

Örnekler: `verify-request-publish-v1.ts`, `verify-request-understanding-brain.ts`, `verify-master-taxonomy*` (isimler scripts altında), E2E publish, browser QA. Koşmadan PASS iddia etme.

## Master taxonomy / request authority

- Authority + taxonomy-drift: yukarıda yeşil
- Ayrı “master taxonomy” generator output’ları repo’da başka scriptlerle gelebilir; bu turda koşulmadı → `NOT-VERIFIED` sonuç

---

**Bunu ne için yapıyoruz?**  
“Test geçti” cümlesinin alıcı/tedarikçi güvenini abartmasını engelliyoruz; hangi güvenin laboratuvar kanıtı, hangisinin henüz ölçülmediğini ayırıyoruz.
