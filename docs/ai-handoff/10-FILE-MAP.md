# 10 — File Map

Kısa görev notları. Yollar `apps/web/` göreli (aksi belirtilmedikçe). Worktree: Talepo-matching-v3.

## Request UI

| Dosya | Görev |
|-------|--------|
| `src/app/talep/page.tsx` | Ana talep giriş / composer V2 yüzeyi |
| `src/components/request/v2/UnderstoodFactsBoard.tsx` | Anlaşılanlar sinyali |
| `src/components/request/v2/CategoryGuidanceCard.tsx` | Kategori rehberi |
| `src/components/request/v2/FocusedQuestionsPanel.tsx` | Odak sorular UI |
| `src/components/request/v2/PublishReviewSummary.tsx` | Review özeti |
| `src/hooks/useHybridRequestComposer.ts` | Composer hook |

## Request understanding

| Dosya | Görev |
|-------|--------|
| `src/lib/request-understanding/**` | Understanding sonuç tipleri / köprü |
| `src/lib/ai/orchestrator.ts` | AI orchestration (ilgili) |
| `src/lib/request-category-engine.ts` | REQUEST_CATEGORIES, getCategoryById |

## Product identity

| Dosya | Görev |
|-------|--------|
| `src/lib/product-identity/brand-extraction.ts` | Marka çıkarma |
| `src/lib/product-identity/identity-builder.ts` | Identity birleştirme |
| `src/lib/request-composer/v2/entity-roles.ts` | Rol düzeltmeleri |
| `src/lib/request-composer/v2/product-phrase-lexicon.ts` | Ürün ifadeleri |

## Canonical request

| Dosya | Görev |
|-------|--------|
| `src/lib/request/raw-input.ts` | rawInput sanitize, unresolved slug |
| `src/lib/request/understanding-snapshot.ts` | Snapshot tipleri |
| `src/lib/request/publish-understanding.ts` | Projection’a understanding ekle |
| `src/server/request/request-schema.ts` | Server Zod/schema |
| `src/server/request/create-request.ts` | Create + publish + fanout çağrısı |
| `src/server/request/update-request.ts` | Update |

## Taxonomy / catalogs

| Dosya | Görev |
|-------|--------|
| `data/taxonomy/**` | Taxonomy JSON |
| `data/taxonomy/manifest.json` | Domain manifest |
| `src/lib/knowledge/**` | Browse/knowledge helpers |

## Question engine

| Dosya | Görev |
|-------|--------|
| `src/lib/request-composer/v2/question-profiles.ts` | Profiller |
| `src/lib/request-composer/v2/question-scheduler.ts` | ≤3 visible |
| `src/lib/request-composer/v2/question-control-registry.ts` | Kontroller |
| `src/lib/request-composer/v2/global-core-profile.ts` | Budget/location |
| `src/lib/request-composer/v2/publish-readiness.ts` | CTA kapıları |
| `src/lib/request-composer/v2/option-providers.ts` | Seçenekler |

## Publish / legacy matching

| Dosya | Görev |
|-------|--------|
| `src/server/request/distribute-request.ts` | Legacy fanout (`BRANCH-WIRED`) — **üç yol içerir**, aşağıya bak |
| `src/server/monetization/alert-notifications.ts` | Alert notifs |
| `src/server/monetization/opportunity-hunter.ts` | Hunter |

### `distribute-request.ts` içindeki üç yol (2026-08-22 denetim eklemesi)

| Satır | Fonksiyon | Cap | RequestMatch | Bildirim |
|---|---|---|---|---|
| `:~40+` | `distributeRequestToCompanies` — ana fanout | `200` (`:100`) / `300` (`:123`) / city-only `40` (`:151`) | ✅ `:170` | ✅ `:269` |
| `:289+` | **`backfillMatchesForCompany`** — yorum: *“Silent backfill”* | **`100`** (`:349`) | ✅ `:389` | ❌ |
| `:418+` | Estimator | **`400`** (`:442`) | ❌ | ❌ |

⚠️ Dosyanın tamamında **log çağrısı yoktur**; zero-match `:164-165` logsuz erken dönüştür. Dilim 2a’nın hedefi budur.

## Observability (Dilim 2a için yeniden kullanılacak)

| Dosya | Görev |
|-------|--------|
| `src/lib/observability/logger.ts` | `createSubsystemLogger`, `logOperational`, `addLogSink` / `getRecentLogs` / `clearRecentLogs` (test için sink) |
| `src/lib/observability/redaction.ts` | `sanitizeTelemetryMetadata`, `TELEMETRY_FORBIDDEN_METADATA_KEYS`, `isSensitiveKey`, `redactObject` |
| `src/lib/observability/metrics.ts` | `BUSINESS_METRICS`, `MetricDefinition`, `getMetricDefinition` |
| `src/lib/observability/shadow.ts` | Shadow rollout modu + `emitShadowCandidate` (Dilim **2b** için ilgili) |

## Matching V3

| Dosya | Görev |
|-------|--------|
| `src/lib/matching-v3/types.ts` | Tipler |
| `src/lib/matching-v3/routing-envelope.ts` | Envelope |
| `src/lib/matching-v3/supplier-capability-profile.ts` | Profile builder |
| `src/lib/matching-v3/identity.ts` | ID + brand-model hits |
| `src/lib/matching-v3/generators/candidate-channels.ts` | Kanallar |
| `src/lib/matching-v3/scoring/score-candidate.ts` | Skor |
| `src/lib/matching-v3/scoring/tier-gates.ts` | Effective tier |
| `src/lib/matching-v3/shadow-match.ts` | Orchestrator |
| `src/lib/matching-v3/contracts/delivery-policy.ts` | Contract only |
| `src/lib/matching-v3/golden/*` | Corpus/fixtures |
| `scripts/verify-matching-v3-shadow.ts` | Verifier |

## Alerts / notifications

| Dosya | Görev |
|-------|--------|
| `prisma/schema.prisma` → `Notification`, `RequestMatch` | Persist |
| monetization alert routes | API yüzeyleri |

## Prisma / migrations

| Dosya | Görev |
|-------|--------|
| `apps/web/prisma/schema.prisma` | Schema |
| `apps/web/prisma/migrations/**` | Migrations (Phase 1 rawInput migration lineage’de) |

## Verifiers (seçilmiş)

| Dosya | Görev |
|-------|--------|
| `scripts/verify-request-authority-v1.ts` | Phase 1 |
| `scripts/verify-taxonomy-drift-v1.ts` | Drift |
| `scripts/verify-request-composer-v2-*.ts` | Phase 2 |
| `scripts/verify-matching-v3-shadow.ts` | Phase 3 Dilim 1 |

## Handoff docs

| Dosya | Görev |
|-------|--------|
| `docs/ai-handoff/*.md` | Bu paket |

---

**Bunu ne için yapıyoruz?**  
Doğru dosyayı 10 dakikada bulmak; yanlış worktree’de veya eski fanout’ta “matcher” aramayı bitirmek.
