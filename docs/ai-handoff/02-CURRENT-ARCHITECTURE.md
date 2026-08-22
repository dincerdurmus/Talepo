# 02 — Current Architecture

> Kaynak önceliği: kod. Etiket: aksi belirtilmedikçe `CODE-VERIFIED`.  
> Durum etiketleri: `00-START-HERE.md` sözlüğü (`BRANCH-WIRED` ≠ `PRODUCTION-DEPLOYED`).

## Uçtan uca akış (özet)

```
/talep UI
  → useHybridRequestComposer + understandRequest
  → product-identity / entity roles / category guidance
  → question scheduler + control registry
  → publish readiness → create/update/publish
  → discoveryProjection + understanding snapshot
  → BRANCH-WIRED: distributeRequestToCompanies (+ alerts/hunter fire-and-forget)
  → SHADOW / TEST-ONLY: matching-v3 runShadowMatch (verifier/fixtures)
```

Production deploy durumu: **`PRODUCTION-STATUS-NOT-VERIFIED`**.

## Katman tablosu

| Katman | Rol | Ana yollar | Girdi → Çıktı | Sonraki | Durum |
|--------|-----|------------|---------------|---------|-------|
| `/talep` UI | Serbest metin + browse + V2 paneller | `apps/web/src/app/talep/page.tsx`, `components/request/v2/*` | Kullanıcı metni/seçimler → composer state | Hook + API | `BRANCH-WIRED` |
| Hybrid composer hook | UI state / transition | `hooks/useHybridRequestComposer.ts` | Events → build-state | Understanding + questions | `BRANCH-WIRED` |
| Build / transition | Composer durum makinesi | `lib/request-composer/build-state.ts`, `request-transition.ts` | Partial answers → UI phase | Publish readiness | `BRANCH-WIRED` |
| Understand request | Kategori + entity çıkarımı | `lib/request-understanding/*` (SoT: `understand-request.ts`) | Metin → `RequestUnderstandingResult` | Snapshot / guidance | `BRANCH-WIRED` |
| Product identity | Brand/model/product span disiplini | `lib/product-identity/*`, `request-composer/v2/entity-roles.ts` | Ham entity → roller | Facts board / questions | `BRANCH-WIRED` |
| Category guidance | “Talepo’nun anladıkları” sinyali | `request-composer/v2/category-guidance.ts`, `CategoryGuidanceCard.tsx` | Candidates → UI kartı | Scheduler | `BRANCH-WIRED` |
| Question profiles | Kategoriye göre alan önemleri | `question-profiles.ts`, `global-core-profile.ts` | Category id → profile list | Scheduler | `BRANCH-WIRED` |
| Question scheduler | Ekranda ≤3 soru; toplam 3 ile sınırlı değil | `question-scheduler.ts` (`MAX_VISIBLE = 3`) | Unanswered → visible set | Controls | `BRANCH-WIRED` |
| Control registry | Seçenek öncelikli kontroller; critical’te text_fallback yasak | `question-control-registry.ts` | Field → control def | FocusedQuestionsPanel | `BRANCH-WIRED` |
| Publish readiness | Budget/location olmadan review/publish kapalı | `publish-readiness.ts` | Answers → CTA | Create/publish | `BRANCH-WIRED` |
| rawInput authority | Kullanıcı kaynak metni; AI otomatik ezmez (açık update ile değişebilir — bkz. 04/11) | `lib/request/raw-input.ts`, Prisma `Request.rawInput` | User text → DB | Snapshot ref | `BRANCH-WIRED` |
| Understanding snapshot | Audit/ops JSON (match authority değil) — **yalnız create yolunda kurulur** | `understanding-snapshot.ts`, `publish-understanding.ts` | Understanding → nested JSON | `discoveryProjection.understanding` | `BRANCH-WIRED` (create); **update’te kurulmaz** |
| discoveryProjection | Taxonomy/constraint read model | `lib/discovery/*`, Prisma `Request.discoveryProjection` | Publish-time projection | Discovery surfaces | `BRANCH-WIRED` |
| Create/update/publish | Request CRUD + publish | `server/request/create-request.ts`, `update-request.ts`, `request-schema.ts` | Payload → DB row | Fanout | `BRANCH-WIRED` |
| Legacy fanout | Kategori (+şehir) match + Notification + RequestMatch | `server/request/distribute-request.ts` | Published request → matches/notifs | Alerts/hunter | `BRANCH-WIRED` |
| Alerts / hunter | Ek bildirim yolları | `server/monetization/alert-notifications.ts`, `opportunity-hunter.ts` | requestId → void.catch | — | `BRANCH-WIRED` (fire-and-forget) |
| Matching V3 | Explainable relevance shadow | `lib/matching-v3/**` | Envelope+profiles → ShadowMatchReport | (fanout’a wired değil) | `SHADOW` + `TEST-ONLY` |
| Delivery policy V3 | Pro/Standard urgency contract | `matching-v3/contracts/delivery-policy.ts` | Tier → proposed urgency | (runtime bildirim sürmez) | Contract / `SHADOW` |

## Kritik ayrım: BRANCH-WIRED vs SHADOW

- Publish sonrası `create-request.ts` içinde `distributeRequestToCompanies` **çağrılır**. [`CODE-VERIFIED`]
- `distribute-request.ts` içinde `matching-v3` / `runShadowMatch` **yok**. [`CODE-VERIFIED`]
- Matching V3 yalnız lib + `scripts/verify-matching-v3-shadow.ts` ile kanıtlanır. [`CODE-VERIFIED`]
- Yukarıdakilerin production’a deploy’u: **`PRODUCTION-STATUS-NOT-VERIFIED`**.

## Branch kodundan doğrulanan ek bulgular

Kanıt dosyaları (Cursor iç bağlantı yok):

- Understanding SoT: `apps/web/src/lib/request-understanding/understand-request.ts`
- Legacy parser (request SoT değil): `apps/web/src/lib/ai/parser/parser.ts`
- Create = publish: `apps/web/src/server/request/create-request.ts` (`:22` import, `:318` `await distributeRequestToCompanies`, `:247` `status: "PUBLISHED"`)
- Update (rawInput açık payload ile yazılabilir; distribute çağrısı yok; **snapshot rebuild de yok**): `apps/web/src/server/request/update-request.ts`
- Home kategori non-authoritative: `apps/web/src/components/home/HomeComposer.tsx` → `/talep`
- Alert / inventory / saved-search yan yollar: `apps/web/src/server/monetization/*` — `BRANCH-WIRED`; Matching V3’e bağlı değil

## Understanding snapshot notu

Dosya başlığı: matching/filter kodu bu bloğu **ignore** etmelidir; audit + operations authority. [`CODE-VERIFIED` — `apps/web/src/lib/request/understanding-snapshot.ts`]

## ⚠️ Update (edit) yolu — 2026-08-22 denetim düzeltmesi

`apps/web/src/server/request/update-request.ts` üç şeyi **yapmaz**:

| Yapmadığı | Kanıt | Sonuç |
|---|---|---|
| Understanding snapshot’ı yeniden kurmaz | `understanding` / `snapshot` / `withUnderstandingSnapshot` → **0 hit** | `discoveryProjection.understanding` **eski metnin** anlamını taşımaya devam eder |
| Projection’ı yeniden hesaplamaz | `:162-163` yalnız `input.discoveryProjection` varsa yazar | Client göndermezse taxonomy/constraint okuması bayat kalır |
| Re-fanout tetiklemez | `distribute` → **0 hit** | Talep eski eşleşme kümesinde kalır |

Buna karşılık **yapar**: açık `rawInput` payload’ıyla alanı üzerine yazar (`:155-156`).

```
:155        ...(input.rawInput !== undefined
:156          ? { rawInput: input.rawInput }
```

Yani edit yolunda kullanıcı metni **değişebilir**, ama o metnin anlamı ve dağıtımı **değişmez**. Bu, `01`’deki iki güven sözleşmesinin ikisine birden dokunur. [`CODE-VERIFIED`]

> Ürün kararı verildi (revizyon modeli, üzerine yazma yok) fakat **koda dönüştürülmedi** → `DECIDED-NOT-IMPLEMENTED`. Bkz. `11-DECISION-LOG.md`.

## ⚠️ Projection fallback zinciri AI metnini kullanabilir

`create-request.ts` içindeki `resolveDiscoveryProjection`, client hazır projection göndermediğinde metni şu sırayla seçer:

```
:46  const text =
:47    input.rawInput?.trim() ||
:48    input.description?.trim() ||
:49    input.professionalDescription?.trim() ||   ← AI metni
:50    input.title;
```

Bu **rawInput alanını bozmaz** (rawInput depolama zinciri `:229-232`’dir ve içinde `professionalDescription` **yoktur**). Ama türetilmiş `discoveryProjection` — yani taxonomy + constraints ve gelecekte V3 envelope’unu besleyecek okuma modeli — ilk iki alan boşsa **AI metninden** kurulabilir.

Sözleşme ihlali değildir; fakat “AI türetilmiş gerçeğe sızabilir” yolu olarak bilinmelidir. Provenance (bu projection hangi metinden kuruldu?) şu anda **kaydedilmiyor**. [`CODE-VERIFIED`]

## Legacy fanout özeti (detay: 06)

- Category-linked companies `take: 200` (`:161`)
- City-linked scan `take: 300` (`:193`), city-only ekleme cap `40` (`:230`)
- Skor: 100 cat+city, 80 cat, 50 city
- `unresolved` slug → category fanout skip (`:128`)
- Zero match → `{0,0}` return (`:253`) — **artık `request.fanout.zero_match` olayı üretir** (neden enum’u + il kodu); Dilim 2a `466436b`
- **İkinci RequestMatch yazıcısı:** `backfillMatchesForCompany` (“Silent backfill”, `take: 100` `:522`) — aynı dosya `:431+`; artık `request.backfill.*` span’i üretir, yani adı hâlâ *silent* ama davranışı değil
- **Estimator:** `take: 400` (`:680`) — `request.fanout.estimated` üretir
- Opportunity hunter + alert notifications `void ...catch`
- `requestMatch.createMany` → `skipDuplicates: true`; `notification.createMany` (`:375`) → **dedupe yok**

### Telemetri katmanı (Dilim 2a, `466436b`) — `BRANCH-WIRED`

- Üç fonksiyonun gövdesi `try/catch` ile sarılı; hata **terminal failure olayı** üretir (`request.fanout.failed` / `request.backfill.failed`; estimator’da `request.fanout.estimated` + `outcome: "failure"`) ve **aynı hata nesnesi yeniden fırlatılır** — yutma yok, başarıya çevirme yok
- Canonical sözleşme **14 olay** (`fanout-telemetry.ts` `FANOUT_EVENTS`)
- `outcome` değeri ortak `OperationalOutcome` sözleşmesine uyar → hata için `"failure"` (ikinci bir `"failed"` değeri **eklenmedi**)
- Çalışmayan tarama `scanStatus: "not_run"` (yalnız `cap`), gerçekten 0 bulan tarama `scanStatus: "executed"` + `found: 0` + `capSaturated: false` — ikisi karışmaz
- Fail-open: her emit `try/catch` içinde; konum türetme de `safeResolveLocation` sınırından geçer. Telemetri hiçbir koşulda talep yayınlamayı durduramaz
- Aktör kimliği yok: `logger.ts`’e eklenen additive `omitActorCorrelation` seçeneği sayesinde bu olaylar correlation store’dan `userId` / aktör `companyId` / transport `requestId` **miras almaz**; yalnız açıkça geçilen operasyonel `requestId` / `companyId` ve opak `correlationId` bulunur. Diğer logger tüketicilerinin varsayılan davranışı değişmedi

---

**Bunu ne için yapıyoruz?**  
Alıcının yazdığı metinden tedarikçiye giden yolun hangi parçalarının bu branch’te gerçekten fişe takılı, hangilerinin shadow/test olduğunu netleştiriyoruz; “branch’te var = production’da çalışıyor” yanılgısını engelliyoruz.
