# Talepo deploy / migrate pipeline

Canonical order (do not skip):

1. **Backup readiness** — confirm external DB backup/PITR (repo cannot prove this).
2. **Env hard gate** — `npm run env:check:prod` (no secret values printed).
3. **Prisma generate** — `npm run db:generate`
4. **Migrate deploy** — `npm run db:migrate:deploy` using `DIRECT_URL` (session mode).
5. **Build** — `npm run build` (`prisma generate && next build`)
6. **Start** — `npm run start:prod` (re-checks env) or platform start + instrumentation gate.
7. **Readiness** — `GET /api/ready` must be 200 (DB + env; providers optional).
8. **Smoke** — `npm run verify:phase4b` (+ prior phase verifies as needed).
9. **Rollback decision** — see `rollback-readiness.md` (app ≠ DB).

## Scripts

| Script | Purpose |
|--------|---------|
| `env:check:prod` | Production env hard gate |
| `db:generate` | `prisma generate` |
| `db:migrate:deploy` | `prisma migrate deploy` |
| `db:migrate:status` | Migration status |
| `deploy:check` | env gate + generate + migrate status |
| `start:prod` | env gate then `next start` |
| `verify:phase4b` | Soft-launch gate verify suite |

## Notes

- Instrumentation (`src/instrumentation.ts`) also hard-gates env on Node production boot.
- Never run migrate through pooler port `6543`.
- Do not apply migrations from CI/agent to production without explicit ops approval.
