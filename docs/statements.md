# Alta Bank — Account Statements

Monthly account statements for personal and company-owned Alta Bank accounts.

## Data model

### `BankStatement`

| Field | Description |
|-------|-------------|
| `bankAccountId` | Linked Alta Bank account |
| `statementNumber` | Unique institutional reference |
| `periodStart` / `periodEnd` | Statement window (inclusive) |
| `openingBalance` | Balance at period start |
| `closingBalance` | Balance at period end |
| `totalDeposits` | Sum of approved deposits in period |
| `totalWithdrawals` | Sum of approved withdrawals in period |
| `totalTransfersIn` | Intrabank deposits (`*-IN` references) |
| `totalTransfersOut` | Intrabank withdrawals (`*-OUT` references) |
| `transactionCount` | Approved transactions in period |
| `status` | `DRAFT`, `GENERATED`, or `VOID` |
| `generatedAt` | When the statement record was produced |

Prisma: `prisma/schema.prisma` · Migration: `prisma/migrations/20250628100000_bank_statements/`

## Statement number format

```
STMT-[YEAR][MONTH]-[ACCOUNT_SHORT]-[RANDOM]
```

Example: `STMT-202606-482913-7742`

- **YEAR/MONTH** — from `periodEnd` (UTC)
- **ACCOUNT_SHORT** — last six digits of the account number
- **RANDOM** — four-digit suffix for collision avoidance

Implementation: `src/lib/bank/statement-number.ts`

## Generation logic

Helper: `generateStatementForAccount(accountId, periodStart, periodEnd)` in `src/server/statement.service.ts`

1. Load **approved** `BankTransaction` rows in `[periodStart, periodEnd]`
2. Compute totals (deposits, withdrawals, transfer in/out via reference suffix)
3. **Opening balance** — net sum of approved transactions *before* `periodStart`
4. **Closing balance** — `openingBalance + deposits − withdrawals`
5. Create `BankStatement` with status `GENERATED` and `generatedAt = now`

### Opening balance limitation (TODO)

Opening balances are **estimated from transaction history**, not immutable ledger snapshots. Accounts seeded with non-zero balances or incomplete history may show approximate openings until ledger v2.

## Routes

| Route | Audience |
|-------|----------|
| `/bank/statements` | Personal account statements (non-company accounts) |
| `/bank/account/$accountId/statements` | Per-account history + preview generation |
| `/bank/statements/$statementId` | Formal statement detail (print-enabled) |
| `/bank/business/statements` | Company-owned account statements |

Legacy alias: `/bank/accounts/$accountId/statements` redirects to `/bank/account/$accountId/statements`.

## Business statement access

Uses treasury view roles from Business Banking:

| Role | Access |
|------|--------|
| Owner | View + generate |
| Executive | View + generate |
| Finance Manager | View + generate |
| Compliance Contact | View only |
| Viewer | **No access** |

Enforced in `src/server/statement.service.ts` via `canViewBusinessTreasury` / `canManageBusinessTreasury`.

## Internal operations

`/internal/bank/statements` → **Statement Operations**

- Recent generated statements table
- **Automatic monthly generation** status (`OpsJobRun` key `BANK_ACCOUNT_STATEMENTS`)
- **Generate previous month statements** — admin only, confirmation required; same service as cron (`force: true`)
- Void count

Operators can view cron status; only admins can run batch generation.

## Monthly statement cron

**Endpoint:** `GET|POST /api/cron/bank-statements`  
**Auth:** `Authorization: Bearer $CRON_SECRET` (or `?secret=` for testing)

**Schedule:** Daily via `/api/cron/scheduled-transfers` (recommended) or standalone `/api/cron/bank-statements`. Generation runs **only on the first calendar day of each month** (UTC). Other days return success with `skipped: true`.

**Period policy:** Previous calendar month.

Example: cron runs **July 1** → generates statements for **June 1 – June 30**.

Orchestration: `src/server/bank-statement-scheduler.service.ts`  
Reuses: `generateStatementForAccount()` in `src/server/statement.service.ts`

### Eligible accounts

| Status | Included when |
|--------|----------------|
| `ACTIVE` | Always |
| `FROZEN` | Had approved transactions during the period |
| `CLOSED` | Had approved transactions during the period |
| `PENDING` | Never |

Skipped if a non-`VOID` statement already exists for the same `periodStart` / `periodEnd`.

### Idempotency

- Pre-create lookup in `generateStatementForAccount()` and batch scheduler
- Safe to run cron multiple times on the 1st — existing statements are skipped
- Issued statements are never overwritten

### Audit events

| Action | When |
|--------|------|
| `BANK_STATEMENT_CRON_STARTED` | Batch started |
| `BANK_STATEMENT_CRON_COMPLETED` | Batch finished or skipped (not 1st) |
| `BANK_STATEMENT_CRON_FAILED` | Catastrophic batch failure |
| `BANK_STATEMENTS_BATCH_GENERATED` | One or more statements created |

### Future Vercel Cron (TODO)

One shared job is enough — bank statements are included in `/api/cron/scheduled-transfers`:

```json
{
  "crons": [
    { "path": "/api/cron/scheduled-transfers", "schedule": "10 0 * * *" }
  ]
}
```

Optional standalone endpoint: `/api/cron/bank-statements` (same scheduler; useful for testing only).

## What works now

- Statement database records and history UI
- On-demand preview generation (user or internal batch)
- Formal statement detail layout with transaction table
- Browser **Print** (`window.print()` + print CSS)
- Role-based business access
- **Automated monthly generation** via `/api/cron/bank-statements` (1st of month) or admin manual batch

## Preview-only / not built
- **Void workflow UI** (status exists; admin void TBD)
- **Ledger-accurate opening balances** (future ledger improvements)

## Future plans

1. **PDF export** — server-side render (Playwright or PDFKit) from statement template
2. **Email delivery** — optional monthly statement email to account holders
3. **Ledger snapshots** — daily balance checkpoints for exact opening/closing without reverse calculation
4. **Statement void & reissue** — operator tools with audit trail
