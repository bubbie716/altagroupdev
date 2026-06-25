# Alta Internal Admin Panel

Operations console at `/internal` for **ADMIN** and **OPERATOR** staff. Uses live Prisma-backed services — not mock data — for banking, identity, lending, and company operations.

## Access roles

| Role | How granted | Capabilities |
|------|-------------|--------------|
| **Admin** | `admin` tag | All operator tools + grant/revoke any tag including admin/operator |
| **Operator** | `operator` tag | User/company/bank/lending ops; cannot grant/revoke `admin` or `operator` |

Route guard: `internalBeforeLoad` → `canAccessInternal` in `src/lib/auth/guards.ts`.

## Routes (V2)

| Route | Purpose |
|-------|---------|
| `/internal` | Live dashboard — queues, vitals, audit activity |
| `/internal/audit` | Full audit log with filters |
| `/internal/users` | User search & management |
| `/internal/users/$userId` | User detail, tags, status, notes, loans |
| `/internal/companies` | Company registry & verification |
| `/internal/bank` | Bank ops hub |
| `/internal/bank/deposits` | Deposit review queue |
| `/internal/bank/withdrawals` | Withdrawal review queue |
| `/internal/bank/accounts` | Account search |
| `/internal/bank/accounts/$accountId` | Account detail, adjustments, notes |
| `/internal/bank/transfers` | Scheduled transfer operations |
| `/internal/bank/statements` | Statement batch & recent list |
| `/internal/bank/scheduled` | Scheduled transfer admin (existing) |
| `/internal/lending` | Loan applications & servicing |
| `/internal/compliance` | Live risk signals |
| `/internal/settings` | Ops status + feature flag placeholders |

**Still mock-only:** Exchange ops, IPOs, API applications, listings, terminal activity, lending deal rooms, interbank transfer preview on Bank Ops.

## Audit log

Model: `AuditLog` in `prisma/schema.prisma`.

Every critical mutation writes an entry via `writeAuditLog()` in `src/server/audit.service.ts`.

Examples: `USER_TAG_GRANTED`, `DEPOSIT_APPROVED`, `ACCOUNT_ADJUSTMENT_CREATED`, `COMPANY_VERIFIED`, `LOAN_APPROVED`.

## Internal notes

Model: `InternalNote` — staff notes on users, accounts, companies, loans.

UI: `InternalNotePanel` on user and account detail pages.

## Safety rules

1. **No balance changes without `BankTransaction`** — admin credits/debits use `ADJUSTMENT` type in a DB transaction.
2. **Server-side permission checks** on every mutation (`requireOperator`, tag rules, admin-only overdraft).
3. **Cannot remove the last admin** — enforced in `internal-user-management.service.ts`.
4. **Operators cannot modify admin/operator tags.**
5. **Revoking `private_client`** liquidates personal reserve/private balances and closes those accounts.
6. **Account close** requires zero balance.

## User management

- List: Discord identity, email, status, tags, company count, total bank balance.
- Detail: companies, accounts, transactions, loan applications, active loans, internal notes, audit history.
- Actions: grant/revoke tags, change account status (`active`, `restricted`, `frozen`, `pending_review`).

## Account adjustments

On `/internal/bank/accounts/$accountId`:

- **Credit** — increases balance, `ADJUSTMENT` transaction, audit entry.
- **Debit** — decreases balance; optional admin overdraft override.
- Reason is **required**.

## Deposit & withdrawal review

Dedicated queues at `/internal/bank/deposits` and `/internal/bank/withdrawals`.

Approve: updates transaction + balance (withdrawals verify sufficient funds).

Deny: no balance change; review note stored on transaction.

## Company verification

Verify → `verificationStatus: VERIFIED`, may activate pending company.

Reject → `verificationStatus: REJECTED`.

Both write audit entries. Review notes supported via API (UI confirmation on verify actions — extend as needed).

## Lending

Use `/internal/lending` — existing loan application queue, approve/deny, active loan servicing, interest batch.

Loan actions write audit log entries.

## Migration

```bash
npm run db:migrate
# or
npx prisma migrate deploy
```

Migration: `20250630200000_internal_audit_notes`

## Future TODOs

- Compliance case model & workflow
- Remote feature flags & maintenance mode
- Statement void UI
- Per-account statement generation in internal panel
- Company suspend/reactivate & official ticker assignment UI
- Interbank transfer operations (when rails exist)
- Discord role sync on tag changes
