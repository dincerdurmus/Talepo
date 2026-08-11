# Talepo — Collaboration Handoff

**Branch:** `cursor/talepo-web-core-platform`  
**Repo:** https://github.com/dincerdurmus/Talepo

## Setup

```bash
git clone https://github.com/dincerdurmus/Talepo.git
cd Talepo
git checkout cursor/talepo-web-core-platform
git pull
cd apps/web
npm install
# Copy .env.local from Dinçer (do not commit secrets)
npm run build
npm run dev
```

Open: http://localhost:3000/talep

## Non-negotiables

- **Single Brain:** `understandRequest()` is the only request-understanding authority. Do not create a second brain.
- Catalog / Knowledge / Taxonomy enrich and browse — they do not own intent/category/strategy.
- No Prisma / DB migration unless Dinçer explicitly asks.
- No production catalog apply unless Dinçer explicitly asks (TX production is still empty).
- No commit/push unless asked (or agreed in the team).

## What landed (checkpoint)

1. **Knowledge Engine** — profiles, browse, request schema, question resolver, dry-run ingestion foundation.
2. **SourceAdapters V1/V2** — LIVE/FIXTURE/CACHE, registry, generic structured, EPA automotive pilots; dry-run only.
3. **Automotive V2C transmission** — schema/loader/index; production transmissions = `[]`; SAFE audit approved only 4 MANUAL rows (not applied).
4. **Master Taxonomy V1** — ~1164 nodes / 927 leaves; all 11×59 categories.
5. **Hybrid Request Composer** — `CanonicalRequestState`, ANY ≠ UNKNOWN, text↔browse sync.
6. **/talep UI wiring** — `useHybridRequestComposer` + panels; client `node:fs` fix (static JSON imports).

## Key paths

| Area | Path |
|------|------|
| Hybrid composer | `apps/web/src/lib/request-composer/` |
| /talep hook | `apps/web/src/hooks/useHybridRequestComposer.ts` |
| /talep page | `apps/web/src/app/talep/page.tsx` |
| Knowledge | `apps/web/src/lib/knowledge/` (ingestion: import from `knowledge/ingestion`, not client barrel) |
| Taxonomy | `apps/web/src/lib/taxonomy/` + `data/taxonomy/` |
| Automotive catalog | `apps/web/src/lib/catalog/automotive/` + `data/catalogs/automotive/` |

## Verify before changing behavior

```bash
cd apps/web
npx tsx scripts/verify-talep-hybrid-ui-v1.ts
npx tsx scripts/verify-hybrid-request-composer-v1.ts
npx tsx scripts/verify-master-taxonomy-v1.ts
npx tsx scripts/verify-single-brain-closure.ts
npx tsx scripts/verify-canonical-request-flow.ts
npx tsx scripts/verify-request-understanding-brain.ts
npx tsx scripts/verify-semantic-request-subject.ts
npm run build
```

## Suggested next work (pick with Dinçer)

1. /talep UX polish (path chip brand popovers) — no redesign.
2. Selective apply of **4 APPROVED MANUAL** transmissions only (after human OK).
3. Fix EPA `powerHp = city08` bug before any engine apply.
4. Do **not** blind-expand OEM / engine codes / transmission codes.

## Codex prompt starter

```text
Continue on branch cursor/talepo-web-core-platform.
Read COLLABORATION-HANDOFF.md first.
Preserve Single Brain (understandRequest). Use existing Hybrid Request Composer.
No DB/migration. No production catalog apply unless explicitly requested.
Run verify scripts above after changes.
```
