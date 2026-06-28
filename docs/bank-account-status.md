# Customer account status

Customer-facing account status, holds, restrictions, and available balance — what customers see in Alta Bank and why actions may be unavailable.

## Account statuses

| Status | Customer meaning |
|--------|------------------|
| **Active / In Good Standing** | Account is open with no restrictions or holds affecting activity. |
| **Under Review** | Account opening or activity may require review by Alta before certain actions are available. |
| **Restricted** | Temporary limits on deposits, withdrawals, and/or transfers. |
| **Frozen** | Account is temporarily frozen; some activity may be unavailable. |
| **Closed** | Account is closed; money movement is not available. |

Customers see plain-English copy only. Internal operator notes, audit metadata, fraud flags, and compliance labels are never shown.

## Restrictions

Operators may apply per-account flags:

- **Deposit restriction** — Deposits are currently unavailable for this account.
- **Withdrawal restriction** — Withdrawals are currently unavailable for this account.
- **Transfer restriction** — Transfers are currently unavailable for this account.

Restrictions are shown on the account overview **Account Status** panel and summarized in deposit, withdrawal, transfer, and Alta Pay flows before submission.

## Holds and available balance

**Current Balance** is the ledger balance on the account.

**Available Balance** is what the customer can spend, withdraw, or transfer now:

```
Available Balance = Current Balance − Pending Withdrawals − Held Funds
```

**Held Funds** are amounts placed on hold by Alta. They reduce available balance until released. Customers see a short explanation when holds exist; hold reasons and operator identity are not exposed.

## Where status appears

- Account detail overview (`/bank/account/$accountId`)
- Bank dashboard account cards (summary when issues exist)
- Deposit, withdrawal, and intrabank transfer forms
- Alta Pay funding source selection (bank accounts)

## Blocked actions

When an action fails because of status or restrictions, the customer sees a specific message (for example, “This transfer couldn't be completed because transfers are currently restricted on this account”) and a **View Account Status** link when a bank account is involved.

## Business accounts

Company members with view or treasury access see the same customer-safe status for business operating accounts. Access follows existing company role permissions; internal notes remain operator-only.

## Implementation

| File | Purpose |
|------|---------|
| `src/lib/bank/account-status-copy.ts` | Customer-safe copy and blocked-action message mapping |
| `src/lib/bank/backend-types.ts` | `CustomerAccountStatus` type on `UserBankAccount` |
| `src/server/bank.service.ts` | Status snapshot on list/detail; customer-safe API errors |
| `src/components/bank/account-status-panel.tsx` | Full status panel on account overview |
| `src/components/bank/account-status-summary.tsx` | Compact summary in money-movement flows |
| `src/components/bank/account-balance-breakdown.tsx` | Current / available / held funds |
| `src/components/bank/blocked-action-alert.tsx` | Error alert with status link |
