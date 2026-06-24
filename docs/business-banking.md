# Business Banking

Business treasury features are **account-scoped**, not a separate global bank tab. Each verified company operates through its **Business Operating Account** at:

`/bank/account/[accountId]`

## Information architecture

| Surface | Purpose |
|---------|---------|
| `/bank` | Dashboard — account cards link to individual account pages |
| `/bank/account/[accountId]` | Account hub — personal or business modules |
| `/bank/business` | **Marketing only** — product overview and CTAs |
| `/bank/open` | Open accounts (including Business Operating after company verification) |

Legacy routes under `/bank/business/*` and `/bank/accounts/*` redirect to the matching account-scoped path.

## Business Operating Account modules

When `accountType === business_operating`, the account page shows:

| Tab | Feature |
|-----|---------|
| Overview | Balances, company context, recent activity |
| Activity | Transaction history |
| Payments | Alta Pay received |
| Payroll | Employee registry and payroll batches |
| Scheduled | Future-dated and recurring treasury transfers |
| Statements | Monthly statements |
| Representatives | Authorized company representatives (read-only roster) |
| Settings | Account/company settings placeholder |

Personal accounts show Overview, Activity, Deposit/Withdraw links, Statements, and Settings only.

## Permissions (company role)

Module access is derived from `CompanyMembership.role` on the account's company:

| Role | Access |
|------|--------|
| **Owner** | Full access to all business modules including settings |
| **Executive** | Full treasury access; settings view-only |
| **Finance Manager** | Payments, payroll, scheduled, statements (manage); representatives view |
| **Compliance Contact** | View statements, activity, representatives |
| **Viewer** | Overview and activity view only — no treasury tabs |

Enforcement:

- Client: `src/lib/bank/business-account-access.ts` — module visibility in account sub-nav
- Server: `src/server/business-account-context.service.ts` — `assertBusinessAccountAccess` on each module loader

Existing helpers (`canViewBusinessTreasury`, `canManageBusinessTreasury`) remain unchanged for API/services.

## Data model

No schema changes. Business features continue to use:

- `BankAccount` (`BUSINESS_OPERATING`, linked to `companyId`)
- `Company` (must be `VERIFIED`)
- `CompanyMembership` (role-based access)
- `ScheduledPayment`, `PayrollEmployee`, `PayrollRun` (company-scoped)

## Internal ops

Internal bank operations (`/internal/bank`) are unchanged. Business accounts appear in account queues and link to the same `BankAccount` records.

## Related docs

- [bank-backend.md](./bank-backend.md) — account opening and ledger
- [permissions.md](./permissions.md) — global tags vs company roles
- [alta-pay.md](./alta-pay.md) — Alta Pay received on business account Payments tab
