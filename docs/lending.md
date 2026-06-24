# Alta Bank Lending & Loan Service V1

Alta Bank lending is a **manual-review** credit system. There is no automatic credit scoring, bureau integration, collateral enforcement, or collections automation.

All amounts are in **Florins (ƒ)**. All advertised rates are **monthly interest** unless marked negotiated.

## Products

| Product | Limit | Monthly rate | Repayment |
|---------|-------|--------------|-----------|
| Personal Credit Line | Up to ƒ1.5M | 7.5% monthly | Minimum 10% monthly |
| Business Credit Line | Up to ƒ10M | 6% monthly | Minimum 8% monthly |
| Private Liquidity Line | Up to ƒ25M | Negotiated monthly | Custom terms |

### Eligibility

| Product | Requirements |
|---------|----------------|
| Personal Credit Line | Signed-in Alta user |
| Business Credit Line | Verified company + Owner / Executive / Finance Manager |
| Private Liquidity Line | `PRIVATE_CLIENT` tag |

## Lifecycle

```
Application (PENDING) → Under Review → Approved → Disbursement → Active loan
                                                              ↓
                                    Payments ← Monthly interest accrual
                                                              ↓
                                                         PAID_OFF
```

## Interest accrual (monthly)

V1 uses **monthly interest rates** stored on each loan (`MONTHLY_PERCENT`):

- Personal default at approval: **7.5% monthly**
- Business default at approval: **6% monthly**
- Private: operator-entered negotiated monthly rate

Monthly charge:

```
interestCharge = outstandingBalance × (monthlyRate / 100)
```

Interest **increases `outstandingBalance`**. Each accrual creates a `LoanLedgerEntry` of type `INTEREST_CHARGE`.

`nextInterestAccrualAt` is set on approval (+1 month) and advanced after each accrual.

### Execution

- **Manual:** `/internal/lending` → “Accrue due interest” or per-loan “Accrue interest”
- **Cron:** `/api/cron/scheduled-transfers` with `CRON_SECRET` — accrues due interest, then runs due loan auto-pay (same job as scheduled transfers and payroll)

Automatic monthly accrual via cron may be enabled in production; operators may also accrue manually. Interest does not accrue on `PAID_OFF`, `CANCELLED`, or `FROZEN` loans.

Legacy loans with `ANNUAL_PERCENT` still accrue using annual ÷ 12.

## Payment schedule

When a loan is approved, a schedule is generated from `termMonths` (from the application):

- **Equal principal per month** plus **projected monthly interest** on the remaining balance (e.g. 4 months on ƒ100,000 at 5.25% monthly → ƒ25,000 principal + ƒ5,250 interest in month 1)
- First installment due **one month after approval** (aligned with first interest accrual)
- Last installment absorbs any cent rounding remainder

Each row is a `LoanPaymentScheduleItem` with due date, scheduled amount, and status (`PENDING`, `PAID`, `OVERDUE`, `FAILED`).

Existing active loans without a schedule get one backfilled on next load when `termMonths` is set.

## Automatic payments (auto-pay)

Borrowers may enable auto-pay on `/bank/lending/loans`:

- Debits the selected Alta Bank account on each **due installment date**
- Pays the scheduled installment total (principal + projected interest), capped at outstanding balance
- Failed attempts (e.g. insufficient funds) are recorded on the installment; cron retries on subsequent runs

The shared cron endpoint and `/internal/lending` → **Run due auto-pay** call `executeDueLoanAutoPayments()`.

## Loan payments

Payments are made from each loan card on `/bank/lending/loans` via **Make payment** (opens a repayment dialog).

Rules:

- Pay permission required (business: Owner / Executive / Finance Manager; compliance is view-only)
- Source account `ACTIVE` with sufficient balance
- Amount > 0 and ≤ outstanding balance
- Only `ACTIVE` loans

Atomic: debit account → `LOAN_PAYMENT` bank txn → `LoanPayment` → ledger → reduce balance → `PAID_OFF` at zero. Manual payments apply to the oldest open schedule installment when present.

Interest accrues on the remaining outstanding balance; scheduled installments include both principal and projected interest for each period.

## Approval & disbursement

Operator sets **monthly rate %** at approval (defaults pre-filled from product). Creates `Loan`, optional disbursement to linked account, `DISBURSEMENT` ledger entry.

## Repayment progress

Progress uses total obligation (outstanding + payments made), including accrued interest when applicable. Next payment due is shown from the payment schedule.

## Alta Credit Profile (placeholder)

Coming Soon / Requires Terminal integration — no real values.

## Future pre-approved credit (not implemented)

May consider bank cash, deposits, portfolio, repayment history, verification status. Manual review remains required.

## Safety

- Ledger + bank txn on every balance change
- DB transactions for approval, payment, interest, adjustments
- No double-approval; server-side validation

## Data model

`LoanApplication`, `Loan`, `LoanPayment`, `LoanPaymentScheduleItem`, `LoanLedgerEntry` — see `prisma/schema.prisma`.

Service: `src/server/loan.service.ts`
