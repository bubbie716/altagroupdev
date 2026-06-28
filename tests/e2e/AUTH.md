# E2E Authentication

Playwright tests authenticate via **real session cookies** — not UI Lab mode and not permission bypasses in app code.

## How it works

1. `global-setup.ts` seeds E2E users into Postgres (`tests/e2e/scripts/seed-e2e-data.ts`).
2. For each role, a `Session` row is created and the `alta_session` cookie is written to a Playwright storage state file.
3. Test projects load the appropriate storage state so requests are authenticated like a normal browser session.

## Storage state files

| File | Role |
|------|------|
| `tests/e2e/.auth/customer.json` | Normal customer |
| `tests/e2e/.auth/business-owner.json` | Business owner (Harbor Logistics) |
| `tests/e2e/.auth/operator.json` | Internal operator |
| `tests/e2e/.auth/admin.json` | Internal admin |

These files are gitignored and regenerated on every `npm run test:e2e`.

## Regenerate manually

```bash
# Ensure dev server is NOT required for auth generation
E2E_TEST_MODE=true npm run test:e2e:seed

# Or run full setup (seed + auth states)
E2E_TEST_MODE=true npx playwright test --project=setup
```

## Prerequisites

1. Local Postgres with migrations applied: `npx prisma migrate deploy`
2. Base companies seeded: `npm run db:seed`
3. `SESSION_SECRET` set in `.env`
4. `DATABASE_URL` pointing at your **test/dev** database

## Discord OAuth

E2E tests **do not** use Discord OAuth in the browser. Sessions are created directly in the database for the synthetic E2E users documented in [SEED_DATA.md](./SEED_DATA.md).

If you need to test OAuth manually, sign in once with Discord and use `npm run db:grant-tag` for roles — that path is separate from automated E2E.

## Finance manager role

The finance manager user is seeded (`0000000000000e003`) with NPC finance-manager membership. Add a dedicated storage state file if you add finance-manager-specific specs:

```bash
# Extend global-setup.ts ROLE_FILES to include finance-manager.json
```
