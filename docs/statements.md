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

`/internal/bank` → **Statement Operations**

- Recent generated statements table
- **Generate monthly statements (preview batch)** — prior calendar month for all active accounts without an existing statement
- Void count / error placeholders

## What works now

- Statement database records and history UI
- On-demand preview generation (user or internal batch)
- Formal statement detail layout with transaction table
- Browser **Print** (`window.print()` + print CSS)
- Role-based business access

## Preview-only / not built

- **PDF download** — button disabled (“coming soon”)
- **Email delivery**
- **Automated scheduled monthly generation** (cron / end-of-month job)
- **Void workflow UI** (status exists; admin void TBD)
- **Ledger-accurate opening balances** (future ledger improvements)

## Future plans

1. **PDF export** — server-side render (Playwright or PDFKit) from statement template
2. **Monthly automation** — scheduled job on last business day; optional email to authorized representatives
3. **Ledger snapshots** — daily balance checkpoints for exact opening/closing without reverse calculation
4. **Statement void & reissue** — operator tools with audit trail
