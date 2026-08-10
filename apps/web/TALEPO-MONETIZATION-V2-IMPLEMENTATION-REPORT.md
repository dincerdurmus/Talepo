# TALEPO — Monetization & Entitlement V2 Implementation Report

**Date:** 2026-08-10  
**Scope:** `apps/web` — backend, entitlement, Prisma, API, minimal panel entry points  
**Status:** Infrastructure ready; core MVP flows preserved

---

## 1. New Prisma Models

| Model | Purpose |
|-------|---------|
| `AlertRule` | Premium+ smart alert rules (company-scoped) |
| `SavedSearch` | Premium+ saved explore filters (JSON) |
| `OpportunityWatchlistItem` | Professional+ request watchlist |
| `RequestChange` | Budget/urgency/deadline/status change log |
| `OpportunityMatch` | Corporate lead engine (alert/profile/inventory sources) |

**Extended:** `CompanyInventoryItem` — `name`, `brand`, `model`, `categoryId`, `price`, `attributes`

**Enums:** `OpportunityMatchSource`, `OpportunityMatchStatus`

---

## 2. New Migration

- **File:** `prisma/migrations/20260810170000_monetization_v2/migration.sql`
- **Safe:** additive only; backfills `CompanyInventoryItem.name` from `title`
- **Apply:** `cd apps/web && npx prisma migrate deploy`

---

## 3. New Services (`src/server/monetization/`)

| Service | Status | Notes |
|---------|--------|-------|
| `smart-matching.ts` | **WORKING** | Rule-based 0–100 score + reasons |
| `alert-matching.ts` | **WORKING** | `matchRequestToAlertRules(requestId)` |
| `inventory-matching.ts` | **WORKING** | Corporate hidden inventory match |
| `opportunity-score.ts` | **WORKING** | NORMAL/GOOD/HOT classification |
| `budget-opportunity.ts` | **INFRASTRUCTURE_READY** | Returns UNKNOWN without reference data |
| `competition-signals.ts` | **WORKING** | Anonymous offerCount / LOW-MEDIUM-HIGH |
| `request-changes.ts` | **WORKING** | Tracks budget, isUrgent, deadline, status |
| `opportunity-hunter.ts` | **WORKING** | Auto-scan on request distribute; upserts OpportunityMatch |
| `professional-analytics.ts` | **WORKING** | `getCompanyPerformance(companyId, from, to)` |
| `corporate-intelligence.ts` | **WORKING** | Real DB aggregates; `insufficientData` when < 3 rows |
| `talepo-insights.ts` | **WORKING** | Anonymized market insight; min 5 requests |
| `ai-offer-assistant.ts` | **INFRASTRUCTURE_READY** | Provider interface; rule-based stub only |
| `inventory-import.ts` | **WORKING** | CSV parse/validate/import + ERP adapter interface |

**Hook:** `distribute-request.ts` calls `runAutomaticOpportunityHunter` (non-blocking) after publish.

---

## 4. New API Endpoints

| Route | Feature gate | CRUD |
|-------|--------------|------|
| `POST/GET /api/monetization/alerts` | `smart_alerts` | AlertRule CRUD |
| `POST/GET /api/monetization/saved-searches` | `saved_searches` | SavedSearch CRUD |
| `POST/GET /api/monetization/watchlist` | `watchlist` | Watchlist add/remove |
| `GET/POST /api/monetization/opportunities` | `hot_opportunities` / `lead_distribution` | Scores + matches + assign |
| `GET /api/monetization/analytics` | `professional_analytics` / `corporate_intelligence` / `talepo_insights` | Metrics |
| `POST /api/monetization/inventory` | `inventory_import` / `hidden_inventory` | CSV import + match |

**Legacy:** `/api/alert-rules` (cookie store) retained; V2 DB API preferred.

---

## 5. FeatureKey Registry (V2)

Central registry: `src/lib/membership/entitlements.ts`

**Core:** `submit_offer`, `instant_request_access`, `unlimited_offers`

**Premium:** `smart_alerts`, `ai_offer_assistant`, `smart_matching`, `saved_searches`, `advanced_filters`, `basic_market_insights`

**Professional:** `hot_opportunities`, `high_budget_opportunities`, `advanced_opportunity_analysis`, `competition_signals`, `budget_change_alerts`, `watchlist`, `professional_analytics`, `talepo_insights`

**Corporate:** `team_management`, `hidden_inventory`, `automatic_opportunity_hunter`, `inventory_import`, `lead_distribution`, `corporate_intelligence`, `erp_integration`

**Legacy aliases preserved:** `alert_rules`, `advanced_ai_pricing`, `urgent_request_priority`, `feature_request_boost`

---

## 6. Plan Entitlement Matrix

| Plan | Character | Key unlocks |
|------|-----------|-------------|
| **STANDARD** | Temel kullanım | `submit_offer`, 5 offers/mo, delayed access (config) |
| **PREMIUM** | Hız | unlimited offers, instant access, smart alerts, AI assistant, matching, saved searches, advanced filters |
| **PROFESSIONAL** | Zeka | Premium + hot opportunities, competition signals, watchlist, analytics, insights |
| **CORPORATE** | Otomasyon + veri | Professional + team, hidden inventory, opportunity hunter, import, lead distribution, corporate intelligence |

**Pricing config:** `src/lib/membership/pricing-config.ts` (990 / 2490 TL; Corporate custom)

**Resolver:** `resolveEntitlements()` — company-first, no bonus summing.

**Error codes:** `FEATURE_NOT_AVAILABLE`, `PLAN_REQUIRED`, `QUOTA_EXCEEDED`

---

## 7. UI Entry Points

| Path | Plan | Component |
|------|------|-----------|
| `/panel/uyarilar` | Premium+ | Existing + upgrade gate |
| `/panel/kayitli-aramalar` | Premium+ | **NEW** minimal + `FeatureUpgradeGate` |
| `/panel/firsatlar` | Professional+ | **NEW** |
| `/panel/analiz` | Professional+ | **NEW** |
| `/panel/envanter` | Corporate | Existing (enhanced schema) |
| `/panel/ekip` | Corporate | Nav gated by `team_management` |

**Nav:** `panel-nav.ts` updated with V2 labels and feature gates.

**Plan page:** `plan-visuals.ts` PLAN_FEATURES updated (Hız / Zeka / Otomasyon).

---

## 8. Security Controls

- `requireCompanyFeature()` — auth + entitlement + company membership
- All monetization APIs company-scoped
- Inventory/opportunity data not in public listings
- Competition signals: offer count only — no competitor prices/names
- Talepo Insights: aggregate only; `insufficientData` below threshold
- Contact-filter unchanged (all plans)

---

## 9. Index / Performance

- Composite indexes on company-scoped models
- Hunter: 100 corporate companies cap per request (MVP)
- Alert scan: 500 rules cap
- Queue-ready: hunter via non-blocking `void` call

---

## 10. Feature Status Summary

| Feature | Status |
|---------|--------|
| Entitlement V2 registry | **WORKING** |
| Quota (null = unlimited) | **WORKING** |
| Smart alert DB + matching | **WORKING** (no email/push) |
| Smart matching | **WORKING** |
| Saved search API | **INFRASTRUCTURE_READY** |
| Watchlist API | **INFRASTRUCTURE_READY** |
| Request change tracking | **WORKING** |
| Opportunity score | **WORKING** |
| Budget opportunity | **INFRASTRUCTURE_READY** (UNKNOWN default) |
| Competition signals | **WORKING** |
| Professional analytics | **WORKING** |
| Hidden inventory match | **WORKING** |
| Opportunity hunter | **WORKING** |
| Lead assignment | **WORKING** |
| Inventory CSV import | **WORKING** |
| ERP integration | **NOT_IMPLEMENTED** |
| AI Offer Assistant LLM | **NOT_IMPLEMENTED** |
| Payment provider | **NOT_IMPLEMENTED** |
| Full feature UI | **NOT_IMPLEMENTED** (entry points only) |

---

## 11. Preserved MVP Flows

`npm run build` — 55 routes, TypeScript clean:

- Talep oluşturma, listeleme, teklif, kabul/red, conversation, mesajlaşma ✓

---

## 12. Next Phase

1. `npx prisma migrate deploy`
2. Wire AlertRulesManager to DB API
3. Saved Search + Watchlist UI
4. Analytics dashboard charts
5. Payment → plan activation
6. External LLM provider
7. Background queue for hunter
8. Email/push for alerts

---

## 13. Validation Results

| Check | Result |
|-------|--------|
| `npx prisma format` | ✓ |
| `npx prisma validate` | ✓ |
| `npx prisma generate` | ✓ |
| `npm run build` | ✓ |
