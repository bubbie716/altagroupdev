# Alta Bank deposit account interest

Monthly interest accrual for eligible **deposit** accounts only. This is separate from loan interest (`INTEREST_CHARGE` on facilities).

## Eligible products (V1 defaults)

| Product | Interest | Default monthly rate |
|---------|----------|----------------------|
| Alta Access | No | 0% |
| Alta Checking | No | 0% |
| Alta Savings | Yes | 0.50% monthly (0.005) |
| Alta Money Market | Yes | 0.85% monthly (0.0085) |
| Business Operating Account | No | 0% |
| Reserve Account by Alta Private | No | 0% |
| Summit Money Market by Alta Private (`PRIVATE`) | Yes | 1.10% monthly (0.011) |

Rates are stored per account (`interestRate`, `interestRatePeriod`) so admins can override later; new accounts receive product defaults on open.

## Accrual method

- **Period:** monthly (`InterestRatePeriod.MONTHLY`)
- **Formula:** `interestAmount = round(balance × monthlyRate, 2)`
- **Example:** ƒ10,000 balance at 0.50% monthly → ƒ50.00 credit
- **Balance used:** current approved balance at accrual time (simple monthly credit)

## Rules

- Only **ACTIVE** accounts accrue.
- `PENDING`, `FROZEN`, and `CLOSED` accounts do not accrue.
- Balance must be **> 0**.
- Interest-bearing flag must be enabled (`interestAccrualEnabled`).
- `nextInterestAccrualAt` must be **≤ now** to be due.
- Every credit creates an approved `BankTransaction` of type **`INTEREST_CREDIT`** — balances are never updated without a transaction.
- Accruals run inside a **database transaction**.

## Duplicate prevention

`BankInterestAccrual` records each period with a unique constraint on `(bankAccountId, periodStart, periodEnd)`. A second accrual for the same period is skipped if status is already `PROCESSED`. Account `lastInterestAccruedAt` and `nextInterestAccrualAt` are advanced after a successful run.

## Internal accrual process (manual only)

**There is no cron or automatic interest for deposit accounts.**

1. Open **Internal → Bank Operations → Interest Operations**.
2. Review due accounts, estimated credits, and month-to-date totals.
3. **Operators** may **Preview interest** for an account.
4. **Admins** run **Accrue** (single account) or **Accrue all due interest** (batch), with confirmation.
5. Audit log actions: `ACCOUNT_INTEREST_ACCRUED`, `ACCOUNT_INTEREST_BATCH_RUN`.

## Client visibility

- Account detail shows rate, status, last credit, next date, and estimated next credit (or “Not applicable”).
- Activity lists `INTEREST_CREDIT` as **Interest Credit**.
- Interest-bearing accounts show a subtle **Interest bearing** badge on the bank dashboard.

## Statements

Statement generation includes approved `INTEREST_CREDIT` transactions in deposit totals and opening/closing balance rollups (same treatment as deposits).

## Future plans

- **Automation:** optional scheduled batch job (explicitly out of scope for V1; accrual remains manual).
- **Admin rate changes:** per-account `interestRate` / `interestAccrualEnabled` editing in internal account admin.
- **Ledger snapshots:** statement opening balances may move to immutable snapshots when ledger v2 ships.

## Testing checklist

- [ ] Create Alta Savings account — verify interest enabled by default
- [ ] Create Alta Checking account — verify interest disabled
- [ ] Seed/update savings balance
- [ ] Preview interest (internal)
- [ ] Accrue interest (admin)
- [ ] Verify `BankTransaction` `INTEREST_CREDIT`
- [ ] Verify balance increased
- [ ] Verify `lastInterestAccruedAt` updated
- [ ] Verify `nextInterestAccrualAt` advanced one month
- [ ] Run accrual again for same period — duplicate blocked
- [ ] Freeze account — verify interest does not accrue

## Migration

```bash
npx prisma migrate deploy
npx prisma generate
```

Migration: `20250701000000_bank_account_interest`
