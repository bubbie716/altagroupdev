# Alta Internal Operations Platform V2 — Deliverable Summary

Date: June 22, 2026  
Scope: Extend `/internal` into enterprise-grade banking operations software without redesigning UI or breaking existing routes.

---

## 1. Features Added

### Operations infrastructure
- **Global search** (`InternalGlobalSearch`) — users, companies, accounts, transactions, loans, Alta Pay refs, Discord ID, Minecraft username, ticker, account numbers
- **Operations Center dashboard** (`/internal`) — operational queues, platform health, activity feed
- **Exception Center** (`/internal/exceptions`) — negative balances, failed jobs, large adjustments, pending reviews
- **Operational reports** (`/internal/reports`) — today's deposits, withdrawals, loans, Alta Pay, adjustments, interest, largest transactions, operator activity
- **Activity timelines** (`InternalActivityTimeline`) — unified event stream per user, company, account, loan
- **Confirmation + reason dialogs** (`OpsConfirmDialog`) — used for bulk approvals, holds, transfers, restrictions, loan payments
- **Ops job health tracking** (`OpsJobRun` model + `ops-job-run.service.ts`) — schema for cron/batch last-run status

### Transaction & Alta Pay operations
- **Transaction explorer** (`/internal/bank/transactions`, `/internal/bank/transactions/$transactionId`) — search + detail with audit, linked entities
- **Alta Pay operations console** (`/internal/bank/alta-pay`) — search, filter, reverse with reason + audit

### Account operations
- **Account holds** (`BankAccountHold` model) — apply/release with audit
- **Account restrictions** — `restrictDeposits`, `restrictWithdrawals`, `restrictTransfers` on `BankAccount` (enforced in client submit paths)
- **Reopen closed account** — operator action with reason
- **Admin manual transfer** — between Alta accounts with audit
- **Reverse adjustment** — offsetting ledger entry + audit
- **Account ops panel** — holds, restrictions, manual transfer, reopen, links to manual interest

### Customer & company 360
- **Customer 360** (`fetchCustomer360`) — identity, roles, accounts, loans, Alta Pay, timeline, notes, audit on user page
- **Company 360** (`fetchCompany360`) — members, bank accounts, loans, Alta Pay, statements, verification timeline, notes, audit

### Lending expansion
- **Loan servicing workspace** (`/internal/lending/loans/$loanId`) — schedule, timeline, notes, deal room placeholder
- **Admin manual loan payment** — operator payment with reason + audit (`adminRecordLoanPayment`)
- **Term months on approve** — lending review panel can override term at approval
- **Open workspace** link from active loan cards

### Queue & bulk operations
- **Deposit queue** — search, multi-select, bulk approve with confirmation + reason
- **Bulk approve deposits/withdrawals** APIs (`ops-bulk.service.ts`)
- **Audit log CSV export** API (`exportAuditLogsOps`)

### Notes expansion
- Internal notes support **BANK_TRANSACTION** and **ALTA_PAY_PAYMENT** target types (schema)

### Navigation
- Sub-nav links: Exceptions, Reports, Transactions, Alta Pay
- Global search in page shell (dashboard uses inline search)
- Deep links between users ↔ accounts ↔ transactions ↔ loans ↔ companies

---

## 2. Pages Expanded

| Route | Changes |
|-------|---------|
| `/internal` | Operations Center: queues, health, activity feed |
| `/internal/exceptions` | **New** — daily exception workspace |
| `/internal/reports` | **New** — operational daily reports |
| `/internal/users/$userId` | Customer 360: Alta Pay, timeline, deep links, private banking badge |
| `/internal/companies/$companyId` | Company 360: full DB-backed dashboard (mock fallback removed) |
| `/internal/bank/accounts/$accountId` | Ops workspace: holds, restrictions, transfers, scheduled transfers, statements, timeline |
| `/internal/bank/deposits` | Search + bulk approve |
| `/internal/bank/transactions` | **New** — transaction explorer |
| `/internal/bank/transactions/$transactionId` | **New** — transaction detail |
| `/internal/bank/alta-pay` | **New** — Alta Pay ops console |
| `/internal/lending/loans/$loanId` | **New** — loan servicing workspace |

---

## 3. New Admin Workflows

1. **Morning ops check** — Dashboard queues → Exception Center → drill into entity
2. **Customer investigation** — Global search → User 360 → account → transaction explorer
3. **Company onboarding** — Company 360 → verification actions → linked accounts/loans
4. **Account exception handling** — Apply hold → restrict flows → manual transfer → reverse adjustment
5. **Deposit throughput** — Filter deposit queue → bulk approve with documented reason
6. **Alta Pay dispute** — Search payment → view related transactions → reverse with reason
7. **Loan servicing** — Open loan workspace → guarantee interest / freeze / manual payment / notes
8. **End-of-day reporting** — Reports page for today's volumes and operator activity

---

## 4. Remaining Limitations

### Not yet fully wired
- **Withdrawal bulk approve UI** — API exists; withdrawals page still single-action only
- **OpsConfirmDialog on all lifecycle actions** — freeze/close/deny still use `BankReviewButton` in places
- **Balance before/after on transaction detail** — stub logic; needs ledger snapshot integration
- **Failed Alta Pay queue** on dashboard — metric not split from general exceptions
- **OpsJobRun recording** — schema exists; cron routes not yet calling `recordOpsJobSuccess`
- **Audit export button** — API exists; audit UI page not wired
- **Statement void / per-account generate** — no admin UI
- **Bulk**: approve companies, freeze accounts, manual interest, generate statements — not implemented
- **Compliance cases** — still placeholder
- **Deal room** — backend still mock
- **Company suspend/reactivate, admin ticker assignment** — not implemented
- **Pagination** — users (200), accounts (500), audit (200), transaction search still capped
- **Relationship manager** — placeholder on company 360

### Migration required
Run before production:
```bash
npx prisma migrate deploy
npx prisma generate
```

Migration: `prisma/migrations/20250701130000_internal_ops_platform_v2/migration.sql`

### Known architectural gaps (from prior audit)
- Some audit writes still outside DB transactions
- Alta Pay full ledger reversal depends on existing payment matching logic
- Risk/compliance scoring not implemented

---

## 5. Future Recommendations

1. **Wire OpsJobRun** into scheduled transfer, loan interest, statement, and Alta Pay cron handlers; surface failures on dashboard health cards
2. **Replace remaining BankReviewButton** financial actions with `OpsConfirmDialog` + mandatory reason
3. **Pagination + server-side filtering** on all queues (users, accounts, transactions, audit)
4. **Withdrawal bulk UI** mirroring deposits queue
5. **Statement admin** — per-account generate, void, reissue from account workspace
6. **Compliance module** — cases linked to users/accounts with assignment workflow
7. **Deal room backend** — replace mock with real negotiation threads tied to loan applications
8. **Impersonation / read-only client view** for operators debugging user issues
9. **Real-time queue counts** via websocket or polling for Operations Center
10. **Enforce incoming transfer restrictions** when `restrictDeposits` is set on destination account

---

## Files Added (core)

### Services
- `src/server/ops-global-search.service.ts`
- `src/server/ops-transaction-explorer.service.ts`
- `src/server/ops-alta-pay-admin.service.ts`
- `src/server/ops-platform.service.ts`
- `src/server/ops-account-ops.service.ts`
- `src/server/ops-bulk.service.ts`
- `src/server/ops-customer-360.service.ts`
- `src/server/ops-company-360.service.ts`
- `src/server/ops-job-run.service.ts`

### API
- `src/lib/internal/ops-platform.functions.ts`
- `src/lib/internal/ops-types.ts`

### UI
- `src/components/internal/ops-confirm-dialog.tsx`
- `src/components/internal/internal-global-search.tsx`
- `src/components/internal/internal-activity-timeline.tsx`
- `src/components/internal/internal-account-ops-panel.tsx`
- `src/components/internal/internal-loan-payment-form.tsx`
- `src/components/internal/internal-deposits-queue.tsx`

### Routes
- `src/routes/internal/exceptions.tsx`
- `src/routes/internal/reports.tsx`
- `src/routes/internal/bank/transactions/index.tsx`
- `src/routes/internal/bank/transactions/$transactionId.tsx`
- `src/routes/internal/bank/alta-pay/index.tsx`
- `src/routes/internal/lending/loans/$loanId.tsx`

---

*Preserves existing routes, styling, and design system. Extends rather than replaces working implementations.*
