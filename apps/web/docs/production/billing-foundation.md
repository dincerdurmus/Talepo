# Billing foundation (Phase 4C)

## Status

Phase 4C foundation + Phase 4D **iyzico adapter** available.

Set `TALEPO_PAYMENT_PROVIDER=iyzico` with credentials — see `docs/production/iyzico-adapter.md`.

Without credentials: **PAYMENT_PROVIDER_REQUIRED** / foundation still usable with mock in non-prod.

## Authority

| Concern | Authority |
|---------|-----------|
| Features / quotas | `featuresForPlan` / entitlements |
| Paid plan activation | Verified webhook → `applyCanonicalBillingEvent` |
| Browser checkout redirect | Presentation only (`PENDING`) |
| Prices charged | Provider price objects (mapped via env) |
| Display prices | `pricing-config.ts` / `plans.ts` |

## Provider selection

Do **not** invent a vendor. Set:

- `TALEPO_PAYMENT_PROVIDER=stripe|iyzico|paytr|paddle|mock|none`
- Provider secrets only when adapter exists
- Dev: `ALLOW_MOCK_BILLING=true` (never production)

## Canonical flow

1. `POST /api/billing/checkout` (server plan validation + permission)
2. Provider checkout session → UI redirect
3. UI shows “Ödemeniz doğrulanıyor”
4. `POST /api/billing/webhook` signature verify + idempotent apply
5. `BillingSubscription` + membership `planTier` sync

## Credits

`POST /api/billing/credits/checkout` → webhook `CREDIT_PURCHASED` → ledger + bonus increment once per `providerEventId`.
