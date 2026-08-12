# iyzico Production Adapter (Phase 4D)

## Status

Adapter implemented on Phase 4C Billing Core. Live money requires merchant portal setup + credentials + Phase 4C migration applied.

## Official docs (source of truth)

- Auth (IYZWSv2): https://docs.iyzico.com/en/getting-started/preliminaries/authentication/hmacsha256-auth.md
- Subscription CF: https://docs.iyzico.com/en/products/subscription/subscription-implementation/subscription-transactions.md
- Checkout Form: https://docs.iyzico.com/en/payment-methods/checkoutform/cf-implementation/cf-initialize.md
- Webhook + X-IYZ-SIGNATURE-V3: https://docs.iyzico.com/en/advanced/webhook.md

## SDK decision

| Package | Notes |
| --- | --- |
| `iyzipay` (official) | Maintained, callback-based CJS — awkward for Next.js async |
| `iyzico-js` | Unofficial community client — not used |
| **Decision** | Minimal direct HTTP adapter + official IYZWSv2 + V3 webhook verify |

## Env

```
TALEPO_PAYMENT_PROVIDER=iyzico
TALEPO_IYZICO_API_KEY=
TALEPO_IYZICO_SECRET_KEY=
TALEPO_IYZICO_MERCHANT_ID=
TALEPO_IYZICO_ENVIRONMENT=sandbox|production
TALEPO_IYZICO_BASE_URL=   # optional override
TALEPO_IYZICO_PLAN_PREMIUM_MONTHLY=
TALEPO_IYZICO_PLAN_PROFESSIONAL_MONTHLY=
TALEPO_IYZICO_PLAN_CORPORATE_MONTHLY=
TALEPO_BILLING_CALLBACK_BASE_URL=https://your.domain
```

Aliases accepted: `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_MERCHANT_ID`.

Production + sandbox credentials ⇒ billing **not READY**.

## Webhook URL (merchant portal)

```
POST https://<TALEPO_BILLING_CALLBACK_BASE_URL>/api/billing/webhook
```

Also configure **Merchant Subscription Notifications** to the same URL (or dedicated HTTPS URL).

**Required:** enable `X-IYZ-SIGNATURE-V3` via entegrasyon@iyzico.com — unsigned webhooks are rejected.

## Merchant portal checklist

1. Merchant account + production activation
2. API key / secret
3. Subscription product feature enabled
4. Create products + monthly pricing plans → copy reference codes into env
5. Webhook URL (Merchant Notifications)
6. Subscription notification URL
7. Signature V3 enablement
8. HTTPS callback base URL

## Cancel semantics

Official cancel endpoint cancels immediately. Talepo maps post-cancel entitlement to period-end grace via `CANCEL_AT_PERIOD_END` + `currentPeriodEnd` when available.

## Profile requirements

iyzico requires name, surname, email, gsmNumber, identityNumber, billingAddress.  
COMPANY: `taxNumber` + company address.  
USER without national ID field ⇒ `CHECKOUT_PROFILE_INCOMPLETE` (do not invent TCKN).

## Authority

Browser callback `/api/billing/callback` → link subscription id / pending UX only.  
Plan/credit activation → verified webhook only.
