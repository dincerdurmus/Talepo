# Talepo migration deployment policy

Do not apply migrations to production from this document alone. This is the process contract.

## Principles

1. **Backup/restore readiness** — confirm external DB backup (e.g. Supabase PITR/backup) before migrate. Repo cannot prove backup exists.
2. **Migration review** — every SQL reviewed for locks, rewrites, and data loss.
3. **Additive-first** — prefer nullable columns / new tables; avoid destructive drops in the same release as app deploy.
4. **Deploy-compatible schema** — old app code must tolerate new columns (expand); new app may require new columns (contract).
5. **Migration apply** — `npx prisma migrate deploy` using `DIRECT_URL` (session mode), not the transaction pooler.
6. **App deploy** — deploy after migrate succeeds (or expand-then-migrate-then-contract for risky changes).
7. **Smoke tests** — run production smoke suite (health, ready, auth gate, publish path).
8. **Rollback decision** — app rollback ≠ DB rollback (see rollback-readiness.md).

## Commands (ops)

```bash
cd apps/web
npx prisma migrate status
npx prisma migrate deploy
npm run build
npm run start
```

## Forbidden without explicit approval

- `prisma migrate reset` on shared/prod
- Force drop of columns with live readers
- Running migrate through pooler port `6543`
