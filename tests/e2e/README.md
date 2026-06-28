# Alta Bank Playwright E2E QA

Automated browser tests for customer (`/bank`) and internal (`/internal`) workflows.

## Quick start

### 1. Prerequisites

```bash
npx prisma migrate deploy
npm run db:seed
cp .env.example .env   # set DATABASE_URL, SESSION_SECRET, E2E_TEST_MODE=true
npm install              # requires @playwright/test 1.61+ (Node 25 compatible)
npx playwright install chromium
```

**Note:** Playwright 1.52 hangs on Node 25. Use `@playwright/test` **1.61+** (included after `npm install`).

### 2. Seed auth (first run or after DB reset)

```bash
E2E_TEST_MODE=true npm run test:e2e:auth
```

This seeds E2E users and writes Playwright storage states to `tests/e2e/.auth/`.

### 3. Start the dev server (separate terminal)

```bash
npm run dev
```

App runs at **http://localhost:3000**.

### 4. Run tests

```bash
# Headless (CI-style)
E2E_TEST_MODE=true npm run test:e2e

# Watch in a real browser
E2E_TEST_MODE=true npm run test:e2e:headed

# Interactive UI — pause, replay, inspect (opens in your browser at http://127.0.0.1:9323)
E2E_TEST_MODE=true npm run test:e2e:ui

# Skip re-seeding auth if you already ran test:e2e:auth
E2E_TEST_MODE=true npm run test:e2e:ui:only

# Open HTML report after a run
npm run test:e2e:report
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `E2E_BASE_URL` | `http://localhost:3000` | Target app URL |
| `E2E_TEST_MODE` | unset | Set `true` to enable deposit/withdraw/submission tests |
| `DATABASE_URL` | required | Local/test database |
| `BLOB_READ_WRITE_TOKEN` | optional | Required for deposit proof upload |

## Safety

- Tests **refuse to run** when `NODE_ENV=production`
- Mutation tests **skip** unless `E2E_TEST_MODE=true`
- Maintenance mode / Credit Desk close buttons are not clicked in read-only settings tests
- Uses synthetic E2E users only — see [SEED_DATA.md](./SEED_DATA.md)

## Reports

| Output | Location |
|--------|----------|
| HTML report | `playwright-report/` → `npm run test:e2e:report` |
| Markdown summary | `tests/e2e/reports/qa-summary.md` |
| Failure screenshots | `test-results/` |
| Visual screenshots | `tests/e2e/reports/screenshots/` |

## Project structure

```
tests/e2e/
  auth.setup.ts          # Setup project placeholder
  global-setup.ts        # Seed DB + generate auth states
  customer/              # /bank customer flows
  internal/              # /internal operator/admin flows
  utils/                 # Helpers (env, routes, page health)
  scripts/seed-e2e-data.ts
  reporters/qa-summary-reporter.ts
  fixtures/proof.png     # Safe deposit proof upload
```

## Auth

See [AUTH.md](./AUTH.md).

## Coverage overview

### Customer

- Route smoke: all major `/bank` pages
- Deposit / withdrawal / transfers / Alta Pay / Alta Card / lending / relationship / business
- Responsive smoke (desktop, tablet, mobile)
- Visual screenshots for key pages

### Internal

- Route smoke: dashboards, queues, workspaces, lending, Alta Card, jobs, audit, reports, settings
- Operator vs admin settings visibility
- Deposit/withdrawal review workflows (with `E2E_TEST_MODE`)

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `DATABASE_URL` error | Set `.env` and run migrations |
| All tests redirect to `/login` | Re-run tests (global setup regenerates auth) |
| Deposit test skipped | Set `BLOB_READ_WRITE_TOKEN` |
| Mutation tests skipped | Set `E2E_TEST_MODE=true` |
| Connection refused | Start `npm run dev` first |
| Playwright UI is a blank white window | Our scripts use `--ui-host=127.0.0.1 --ui-port=9323` so the UI opens in **Chrome/Safari** at http://127.0.0.1:9323 instead of the Electron shell (which often renders blank on macOS). If it still looks empty, open that URL manually. |
| `playwright test --ui` hangs (Node 25) | Run `npm install` to get `@playwright/test` 1.61+ |
