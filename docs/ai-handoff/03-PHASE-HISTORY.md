# 03 — Phase History

> Commit’ler `GIT-VERIFIED`. Davranış özetleri `CODE-VERIFIED` + commit stat.

Lineage (aynı branch üzerinde ardışık):

```
0975ab9  Phase 1 — raw input + resolution snapshot
   ↓
b0e9a22  Phase 2 — guided request composer v2
   ↓
27806c3  Phase 3 Dilim 1 — shadow matching engine
   ↓
466436b  Phase 3 Dilim 2a — legacy fanout observability
```

`git merge-base --is-ancestor` önceki commit’lerin tamamı için doğru. [`GIT-VERIFIED`]

---

## Phase 1 — Request authority

| | |
|--|--|
| **Amaç** | Orijinal metni korumak; unresolved soft category; understanding snapshot; kategori allowlist değil |
| **Commit** | `0975ab9339de539998b6df006ede53a9eca2e936` — `feat(requests): preserve raw input and resolution snapshot` |
| **Migration** | Bu commit’te migration.sql (+17) ve schema `rawInput` vb. eklendi [`GIT-VERIFIED`] |
| **Deploy durumu** | Bu handoff worktree’sinde deploy yapılmadı; production deploy `NOT-VERIFIED` |

### Gerçek değişiklikler (özet)

- `Request.rawInput`, understanding snapshot helpers, publish-understanding
- `UNRESOLVED_CATEGORY_SLUG`, system category picker exclusion
- `getCategoryById`: empty/unresolved → UNKNOWN shell; unknown id → `null` (sessiz son kategoriye düşmez)
- Authority + taxonomy-drift verifier’lar

### Korunan davranışlar

- Legacy `description` yazımı devam (görünüm kırılmasın)
- Fanout hâlâ category+city (Phase 1 matching rewrite değil)

### Testler

- `verify-request-authority-v1.ts` — 14 PASS (handoff koşusu) [`TEST-VERIFIED`]
- `verify-taxonomy-drift-v1.ts` — 20/20 PASS [`TEST-VERIFIED`]

**Kanıtlar / kanıtlamazlar:** Snapshot şekli ve AI’nin rawInput’u otomatik ezmemesi; açık update ile değişebilirlik ayrı konu; production precision/recall veya gerçek publish E2E değil. Deploy: `PRODUCTION-STATUS-NOT-VERIFIED`.

### Branch-wired vs shadow

- rawInput persist: **`BRANCH-WIRED`** (`create-request.ts` **ve** `update-request.ts`)
- Understanding snapshot **kurulumu**: **yalnız create yolunda** `BRANCH-WIRED`.
  **Düzeltme (2026-08-22 denetimi):** Bu belgenin önceki sürümü snapshot persist’i
  “`create-request.ts` / `update-request.ts`” olarak gösteriyordu. Bu **yanlıştı**.
  `update-request.ts` içinde `understanding` / `snapshot` / `withUnderstandingSnapshot`
  araması **0 hit** verir; update yalnız client hazır bir `discoveryProjection`
  gönderirse onu yazar (`update-request.ts:162-163`). Snapshot **yeniden kurulmaz**.
  [`CODE-VERIFIED` · `CONFLICT-WITH-HANDOFF` (düzeltildi)]
- Matching iyileştirmesi: yok (Phase 1 kapsamında)

### Bilinen sınırlamalar

- Legacy satırlarda `rawInput` null olabilir; backfill best-effort
- Understanding match authority değildir
- Açık `rawInput` update payload alanı değiştirebilir (immutability politikası açık değil)

---

## Phase 2 — Guided composer v2

| | |
|--|--|
| **Amaç** | Signal tarzı anlaşılanlar; kategoriye özel soru motoru; seçenek öncelikli kontroller; review/publish readiness |
| **Commit** | `b0e9a22f033d7a9554b9ed8d4c17179813c7df41` — `feat(requests): add guided request composer v2` |
| **Migration** | Bu commit’te yeni migration yok (UI/lib ağırlıklı) [`GIT-VERIFIED` stat] |

### Özellikle

- `UnderstoodFactsBoard`, `CategoryGuidanceCard`, `FocusedQuestionsPanel`, `PublishReviewSummary`
- `entity-roles`, `product-phrase-lexicon`, `question-scheduler` (`MAX_VISIBLE=3`, toplam 3 cap değil)
- `global-core-profile` budget/location publish kapıları
- `question-control-registry`: critical alanlarda `text_fallback` yasak
- Tek primary CTA mantığı `publish-readiness` (`continue` | `review` | `publish`)

### Testler (handoff koşusu)

| Script | Sonuç |
|--------|--------|
| slice1 | 13 PASS |
| controls | 128 passed |
| entity-global-core | 28 passed |
| re-semantics | 6 passed |
| review-display | 3 passed |
| phase2 | 9 passed |
| phase2-scheduler | 16 passed |

Hepsi 0 FAIL. [`TEST-VERIFIED`]

**Kanıtlamaz:** Gerçek kullanıcı 15–30 sn süresi; tüm kategori derinliği eşitliği; browser QA; production deploy.

### Branch-wired

- `/talep` V2 yüzeyleri **`BRANCH-WIRED`** (`apps/web/src/app/talep/page.tsx`)
- Matching hâlâ legacy fanout (`BRANCH-WIRED`); Matching V3 yok
- Production deploy: `PRODUCTION-STATUS-NOT-VERIFIED`

### Bilinen UX/semantic sınırlar

- Kategori profilleri derinliği eşit değil (öncelikli 5 daha zengin profile satırları)
- Alias/role hataları için ayrı risk listesi (08)
- `detectCategory` hâlâ deprecated UX hint olarak duruyor

---

## Phase 3 Dilim 1 — Shadow relevance

| | |
|--|--|
| **Amaç** | Explainable, plan-bağımsız shadow matching; missing≠excluded; verified brand-model; golden corpus |
| **Commit** | `27806c33bf544aa912e6ea2423623e01ffa18310` — `feat(matching): add explainable shadow relevance engine` |
| **Migration / fanout wiring / deploy** | Dilim 1’de migration yok; fanout wiring yok (`SHADOW`). Production deploy: `PRODUCTION-STATUS-NOT-VERIFIED`. [`GIT-VERIFIED` + `CODE-VERIFIED`] |

### Özellikle

- Routing envelope (DB id / slug / taxonomy ayrı)
- Supplier capability profile (+ `brandCoverage` / `productCoverage` / `modelCoverage`, `brandModelPairs`)
- 10 candidate channel
- Score components + `deriveEffectiveTier` (scoreBand ≠ final tier)
- EXACT / STRONG / NEAR / REVIEW / NO_MATCH
- Missing/partial ≠ hard exclude; exhaustive/explicit exclude → NO_MATCH
- Verified pair: inventory row veya `brandModelPairs` (cartesian EXACT değil)
- Delivery policy **contract only**
- `productionShadowComparison: "not_wired"`
- Golden corpus **89** scenarios; verifier **117** checks [`TEST-VERIFIED`]

### Test

- `npx tsx scripts/verify-matching-v3-shadow.ts` → 117 passed, 0 failed; corpus 89 [`TEST-VERIFIED`]

**Kanıtlamaz:** Gerçek precision/recall; production supplier coverage; canlı bildirim doğruluğu.

### Fanout’a bağlı parçalar

- **Hiçbiri.** Matching V3 import yok. Durum: `SHADOW` + `TEST-ONLY`. Dilim 2a bunu **değiştirmedi**.

---

## Phase 3 Dilim 2a — Legacy fanout observability

| | |
|--|--|
| **Amaç** | Legacy fanout’u ölçülebilir kılmak: zero-match, kategori-skip, cap doygunluğu, city-only fallback, sessiz backfill ve estimator. **Sıfır davranış değişikliği.** |
| **Commit** | `466436bb438765cd42fd9031eb6ac35a530bb562` — `feat(observability): instrument legacy request fanout` |
| **Migration / şema / bağımlılık** | **Yok.** Prisma, migration, `package.json`, lockfile stage bile edilmedi. [`GIT-VERIFIED`] |
| **Fanout wiring** | Matching V3 hâlâ bağlı **değil**; yalnız telemetri eklendi |
| **Deploy durumu** | `PRODUCTION-STATUS-NOT-VERIFIED` |
| **Ölçüm durumu** | **`PRODUCTION-SINK-NOT-VERIFIED`** — olaylar üretiliyor, merkezî olarak sorgulanabildiği doğrulanmadı |

### Değişen dosyalar (5)

| Dosya | Rol |
|---|---|
| `src/server/request/fanout-telemetry.ts` | **Yeni.** 14 olaylık canonical sözleşme, fail-open emit sınırı, PII guard, failure stage allowlist’leri |
| `src/lib/observability/province-allowlist.ts` | **Yeni.** İl adları `TURKEY_IL_NAMES`’ten türetilir; yalnız allowlist edilmiş `TR-NN` kodu üretir |
| `src/server/request/distribute-request.ts` | Yalnız telemetri eklendi + üç gövde `try/catch` ile sarıldı |
| `src/lib/observability/logger.ts` | Additive `LogOptions { omitActorCorrelation }`; seçenek verilmezse davranış birebir eskisi |
| `scripts/verify-fanout-telemetry-v1.ts` | **Yeni.** 69 assert |

### Sözleşme

- **14 canonical olay:** `request.fanout.{started, precondition_skipped, category_skipped, category_scan, city_scan, city_only_fallback, zero_match, notifications_written, completed, failed, estimated}` + `request.backfill.{started, completed, failed}`
- **Span denklemleri:** fanout `started = precondition_skipped + zero_match + completed + failed`; backfill `started = completed + failed`
- **Hata yolu:** terminal failure olayı → `reason: "unexpected_error"` + allowlist `failureStage` + `errorName` (yalnız hata sınıfı adı) → **aynı hata yeniden fırlatılır**
- **`outcome`** ortak `OperationalOutcome` sözleşmesine uyar; hata için `"failure"`
- **Tarama modeli:** `scanStatus: "executed"` (cap + found + capSaturated) veya `"not_run"` (yalnız cap). Sahte sıfır, NaN, null yok
- **Konum:** yalnız `locationScope` + allowlist `provinceCode` (`TR-NN`) + `resolutionStatus`. Ham şehir/ilçe/mahalle/adres ve serbest metin **loglanmaz**; güvenilir dönüşüm yoksa kod yazılmaz
- **Aktör kimliği yok:** `userId` / aktör `companyId` / transport `requestId` correlation mirası alınmaz

### Test

- `npx tsx scripts/verify-fanout-telemetry-v1.ts` → **69 passed, 0 failed** [`TEST-VERIFIED`]
  8’i gerçek runtime testi: Prisma stub’lanıp `distributeRequestToCompanies` / `backfillMatchesForCompany` / `countMatchingCompanies` çalıştırılır, failure terminali ve **aynı hata nesnesinin** yeniden fırlatıldığı doğrulanır
- `npx tsx scripts/verify-phase4a-observability-v1.ts` → **23 passed, 0 failed** (logger değiştiği için koşuldu) [`TEST-VERIFIED`]
- Önceki 10 verifier aynı sayılarla yeşil: 117 · 14 · 20 · 13 · 128 · 28 · 6 · 3 · 9 · 16 [`TEST-VERIFIED`]
- `tsc --noEmit` ve scoped `eslint` → temiz

**Kanıtlamaz:** Olayların merkezî log sisteminde sorgulanabildiğini; production deploy’u; gerçek zero-match oranını (henüz canlı veri yok).

---

**Bunu ne için yapıyoruz?**  
Hangi vaadin hangi commit’te kodlandığını ve hangisinin hâlâ laboratuvarda olduğunu ayırıyoruz; böylece “matcher hazır” sanılıp Pro’ya yanlış güven verilmez.
