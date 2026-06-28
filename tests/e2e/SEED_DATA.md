# Alta Bank E2E Test Data

E2E tests use **dedicated synthetic users** seeded into your **local/test database**. They never touch production data.

## Seed command

```bash
npm run test:e2e:seed
```

This runs automatically before the first Playwright project via `global-setup.ts`.

## Required environment

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Local or test Postgres (same as dev) |
| `SESSION_SECRET` | Session signing (min 32 chars) |
| `E2E_TEST_MODE=true` | Enable mutation/submission tests |
| `E2E_BASE_URL` | App URL (default `http://localhost:3000`) |
| `BLOB_READ_WRITE_TOKEN` | Optional — required for deposit proof upload tests |

Also run `npm run db:seed` once so companies (`CO-HBR`, `CO-NPC`, etc.) exist.

## Seeded users

| Role | Discord ID | Username | Tags |
|------|------------|----------|------|
| Customer | `0000000000000e001` | e2e-customer | — |
| Business owner | `0000000000000e002` | e2e-business-owner | — |
| Finance manager | `0000000000000e003` | e2e-finance-manager | — |
| Operator | `0000000000000e004` | e2e-operator | operator |
| Admin | `0000000000000e005` | e2e-admin | admin, operator |

## Seeded accounts

| Account number | Owner | Type |
|----------------|-------|------|
| `AB-E2E-001-CHKG` | Customer | Checking (ƒ5,000) |
| `AB-E2E-001-SAVG` | Customer | Savings (ƒ1,200) |
| `AB-E2E-HBR-OPER` | Business owner / CO-HBR | Business operating (ƒ25,000) |

## Seeded pending items (for internal queue tests)

- One **pending deposit** on the customer checking account
- One **pending withdrawal** on the customer checking account

IDs are written to `tests/e2e/.auth/manifest.json` after seeding.

## Auth storage states

Generated automatically in `tests/e2e/.auth/`:

- `customer.json`
- `business-owner.json`
- `operator.json`
- `admin.json`

See [AUTH.md](./AUTH.md) for regeneration details.

## Safety

- Seed script throws if `NODE_ENV=production`
- Mutation tests skip unless `E2E_TEST_MODE=true`
- E2E Discord IDs use a dedicated `…e00x` range — do not reuse for real users
