# Canonical business metrics

Source of truth in code: `src/lib/observability/metrics.ts` (`BUSINESS_METRICS`).

| Metric | Meaning |
|--------|---------|
| Published Request | Request with `publishedAt` and marketplace status |
| Valid Offer | Offer created through `createOffer` (submitted lifecycle) |
| Accepted Offer | `Offer.status = ACCEPTED` |
| Active Conversation | Conversation linked to offer (`offerId` unique) with activity |
| Opportunity | `OpportunityMatch` row |
| Assigned Opportunity | Opportunity with `assignedToMemberId` |
| Offer Conversion | accepted / valid offers |

Do not invent alternate SQL definitions in dashboards without updating the code catalog.
