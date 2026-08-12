# Rollback readiness

## Separate concerns

| Layer | Rollback | Notes |
|-------|----------|--------|
| App (Next.js) | Redeploy previous release | Safe if schema is backward compatible |
| Database | Restore from backup / forward-fix | Destructive migrations make this hard |

## Why destructive migrations are risky

- Dropped columns/tables cannot be recovered by redeploying old app code.
- Expanding unique constraints can fail mid-deploy with partial data.
- Prefer: add column → dual-write/read → backfill → switch → drop later.

## Decision tree

1. Symptom is code-only → rollback app.
2. Symptom is bad migration already applied → stop deploys; restore backup or write forward fix migration.
3. Never “fix” by resetting production.

## Evidence gap

Backup/restore is an **external infrastructure dependency**. If not documented in ops runbooks outside this repo, treat as **UNKNOWN**.
