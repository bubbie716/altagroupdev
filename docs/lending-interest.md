# Alta Bank loan interest — monthly guarantee schedule

Commercial loan interest is **guaranteed monthly**. Borrowers owe guaranteed interest only for months that have vested, while month 1 is guaranteed immediately at disbursement.

## Balances

### Outstanding principal

The amount still borrowed. Decreases when payments are applied to principal after guaranteed interest is satisfied.

### Guaranteed interest owed

Interest that has **vested** (status `GUARANTEED` on the schedule) but is not yet paid. Denormalized on `Loan.accruedInterest` for fast payoff queries; the schedule is the source of truth for status.

Month 1 is guaranteed at disbursement. Month *n* guarantees on the disbursement anniversary (*n* − 1 months later) while the loan remains active.

### Remaining potential interest

Sum of `PENDING` schedule items — informational only. Not owed until each guarantee date passes and the loan is still active.

### Current payoff amount

```
currentPayoff = outstandingPrincipal + guaranteedUnpaidInterest
```

Early payoff uses this amount only. Pending future interest is **not** included.

`Loan.outstandingBalance` stays synced as `principalOutstanding + accruedInterest` (guaranteed unpaid interest).

### Projected full-term cost

```
projectedFullTermCost = originalPrincipal + sum(all schedule interest amounts)
```

Informational — what the loan would cost if every scheduled month vests and is paid. Not the amount due today.

## Interest guarantee schedule

Model: `LoanInterestScheduleItem`

| Field | Role |
|-------|------|
| `installmentNumber` | Month (1 … term) |
| `guaranteeDate` | When interest vests |
| `interestAmount` | Guaranteed amount for that month |
| `paidAmount` | Portion paid (supports partial interest payments) |
| `status` | `PENDING`, `GUARANTEED`, `PAID`, `WAIVED` |

Rules:

- Created for each month in the term at disbursement.
- Month 1: `guaranteeDate = disbursementDate`, status `GUARANTEED`.
- Months 2+: `guaranteeDate = disbursement + (n−1) months`, status `PENDING`.
- When `guaranteeDate ≤ now` and loan is `ACTIVE`, item becomes `GUARANTEED` and `accruedInterest` increases.
- If loan is `PAID_OFF` or `CANCELLED`, due pending items become `WAIVED`.
- On early payoff, remaining `PENDING` items are `WAIVED`.

Interest amounts use declining principal projection (same as payment schedule estimates). **Projected interest is not added to principal at disbursement.**

## Payment allocation (waterfall)

When a payment is received (`LoanPayment` + `BankTransaction` LOAN_PAYMENT):

1. Apply to **guaranteed unpaid interest** first.
2. Remainder to **outstanding principal**.

`applyGuaranteedInterestPaymentInTx` marks schedule items `PAID` (or partial `paidAmount`) in installment order.

Payments cannot exceed `calculateCurrentPayoff()`.

## Guarantee processor

`src/lib/bank/loan-interest-service.ts`:

| Function | Purpose |
|----------|---------|
| `buildLoanInterestScheduleDrafts()` | Project monthly interest + guarantee dates |
| `createLoanInterestScheduleInTx()` | Persist schedule at disbursement |
| `guaranteeDueInterestForLoan()` | Vest due `PENDING` items for one loan |
| `guaranteeDueLoanInterest()` | Batch vest for all loans |
| `calculateLoanPayoffBreakdown()` | Full payoff breakdown from schedule |
| `summarizeInterestSchedule()` | Map schedule → UI/admin metrics |
| `allocateLoanPayment()` | Waterfall math |
| `applyGuaranteedInterestPaymentInTx()` | Mark schedule paid on payment |
| `waivePendingInterestScheduleInTx()` | Waive future pending on payoff |
| `backfillLoanInterestGuaranteeSchedules()` | Create schedules for legacy loans |

Cron: `/api/cron/loan-interest` calls `accrueInterestForDueLoans()` → `guaranteeDueLoanInterest()`.

Internal ops: **Guarantee due interest** (batch or per loan). Only items with `guaranteeDate ≤ now` vest — future months cannot be manually guaranteed early.

## UI

Borrower loan detail shows:

- Outstanding principal, guaranteed interest owed, remaining potential interest
- **Current payoff amount** (emphasized) with note: *Includes outstanding principal plus guaranteed unpaid interest.*
- Interest guarantee schedule table (month, guarantee date, amount, status, paid date)
- Progress bar: **principal repaid** only; guaranteed interest shown separately if owed

## Early repayment

Pay `currentPayoffAmount` → loan `PAID_OFF`. Remaining `PENDING` schedule items → `WAIVED`. No future interest is charged. Already-guaranteed interest must still be paid.

## Schema

| Model / field | Role |
|---------------|------|
| `LoanInterestScheduleItem` | Monthly guarantee rows |
| `Loan.principalOutstanding` | Live principal |
| `Loan.accruedInterest` | Guaranteed unpaid interest (denormalized) |
| `LoanPayment.appliedToInterest` / `appliedToPrincipal` | Waterfall split |

## Migration / backfill

```bash
npx prisma migrate deploy
npx prisma generate
npm run db:backfill-loan-interest-guarantee
```

Migration `20250701020000_loan_interest_guarantee_schedule` adds `LoanInterestScheduleItem` and `paidAmount`. Run the guarantee backfill for existing active loans without schedules.

Prior migration `20250701010000_loan_principal_accrued_split` introduced principal/accrued split; use `npm run db:backfill-loan-balance-split` if upgrading from combined-balance loans.

## Test cases

1. **Disbursement** — Month 1 `GUARANTEED` immediately; months 2+ `PENDING`; `accruedInterest` = month 1 amount; principal unchanged.
2. **Anniversary** — On guarantee date, pending month → `GUARANTEED`; `accruedInterest` increases; ledger `INTEREST_CHARGE`.
3. **Payment** — Interest first, then principal; schedule items → `PAID`; payoff decreases.
4. **Early payoff** — Pay principal + guaranteed interest only; pending → `WAIVED`; loan `PAID_OFF`.
5. **Inactive loan** — Due pending items → `WAIVED` on guarantee run, not `GUARANTEED`.
6. **Partial interest payment** — `paidAmount` increments; item stays `GUARANTEED` until fully paid.
