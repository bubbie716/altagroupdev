# Manual account interest (Alta Bank)

Internal admin tool for **manually** crediting interest to deposit accounts by category. This is separate from per-account scheduled accrual in Interest Operations. Applications can run immediately or be **scheduled** for a future date (9:00 AM Eastern) via the shared platform cron.

## Purpose

Operators and admins sometimes need to:

- Run promotional interest campaigns across a product line
- Credit a fixed total amount split across all accounts in a category
- Apply a one-time private banking adjustment

Manual interest creates permanent `INTEREST_CREDIT` bank transactions. Reversal is only via a separate admin debit/adjustment — records are never deleted.

## Account categories

| Category | Account type |
|----------|----------------|
| Alta Access | `alta_access` |
| Alta Checking | `checking` |
| Alta Savings | `savings` |
| Alta Money Market | `money_market` |
| Business Operating Account | `business_operating` |
| Reserve Account by Alta Private | `reserve` |
| Summit Money Market by Alta Private | `private` |
| All Categories | All of the above |

Admins may select one category, multiple categories, or **All Categories**. When All Categories is selected, individual category checkboxes are disabled.

## Application modes

### Percentage credit

```
interestCredit = round(currentBalance × (percentageRate / 100))
```

Example: 2% on ƒ10,000 → ƒ200.

- Percentage must be &gt; 0
- Skips accounts with balance ≤ 0

### Fixed amount credit

The entered amount is **split equally** across all eligible accounts in the selected categories (not applied in full to each account).

```
perAccountCredit = round(totalFixedAmount / eligibleAccountCount)
```

Remainder cents are distributed one cent at a time so the per-account credits sum exactly to the total.

Example: ƒ500 split across 3 eligible Alta Savings accounts → ƒ166.67, ƒ166.67, ƒ166.66.

- Amount must be &gt; 0
- Skips accounts with balance ≤ 0

## Eligibility rules

Accounts receive credit only when:

- Status is **ACTIVE** (pending, frozen, and closed are always excluded)
- Balance is **greater than zero**
- Account type matches a selected category

Category selection replaces separate personal/business/private filters — choose Alta Checking, Business Operating, Reserve, etc. directly.

## Preview and confirmation flow

Route: **`/internal/bank/interest`**

1. **Form** — mode, rate/amount, categories, filters, reason, internal note, optional schedule date
2. **Preview** — affected/skipped counts, totals, per-account table (server-calculated)
3. **Confirmation** — admin must type `APPLY INTEREST`; displays permanent-record warning (or schedule confirmation when a date is set)
4. **Result** — processed/skipped/failed counts, total credited, batch reference ID — or schedule confirmation with run date

When a **schedule date** is set (YYYY-MM-DD), the application is stored as pending and applied at **9:00 AM Eastern** on that date by `runDepositInterestSchedulerJob()` via `/api/cron/scheduled-transfers`. Balances are evaluated at run time, not at preview time. Leave the date blank to apply immediately.

## Permissions

| Action | Role |
|--------|------|
| Preview | Operator or Admin |
| Apply | **Admin only** |

## Transactions and audit

Each credited account gets:

- `BankTransaction` type **`INTEREST_CREDIT`**
- Balance increment on `BankAccount`
- Unique transaction reference (`INT-YYYYMMDD-…`)
- Shared batch reference in transaction `memo` (`Batch: MI-…`)
- `reviewNote` = public reason; `memo` includes reason + internal note

User-facing history label: **Interest Credit** (via transaction type display).

Audit actions:

- `MANUAL_INTEREST_PREVIEWED` — optional on each preview
- `MANUAL_INTEREST_ACCOUNT_CREDITED` — per account on apply
- `MANUAL_INTEREST_APPLIED` — batch summary with metadata (mode, categories, totals, batch ID)

Apply supports an **idempotency key** to prevent duplicate batch submission on double-click.

## Service layer

`src/lib/bank/manual-interest-service.ts`

| Function | Purpose |
|----------|---------|
| `previewManualInterestApplication()` | Server-side eligibility and totals |
| `applyManualInterestApplication()` | Re-preview, credit accounts, audit batch |
| `logManualInterestPreviewed()` | Audit preview |

Server functions: `src/lib/bank/manual-interest.functions.ts`

## Why manual (not automatic)

Automatic monthly accrual per account (Interest Operations) uses configured account rates and accrual schedules. Manual interest is for **ad hoc, category-wide** campaigns that do not fit that model.

A future automatic interest system could reuse transaction types and audit patterns but is **out of scope** for this tool.

## Migration

No schema migration required — uses existing `INTEREST_CREDIT` transaction type.

## Reversal

To reverse a manual credit, use **Admin adjustment (debit)** on the affected account with a documented reason. Do not delete interest transactions.
