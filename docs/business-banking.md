# Business Banking

Business treasury and Alta Commercial features are **account-scoped**, not a separate global bank tab. Each verified company operates through its **Business Operating Account** at:

`/bank/account/[accountId]`

Commercial surfaces live under:

`/bank/account/[accountId]/commercial/*`

## Information architecture

| Surface | Purpose |
|---------|---------|
| `/bank` | Dashboard — account cards link to individual account pages |
| `/bank/account/[accountId]` | Account hub — personal or business modules |
| `/bank/account/[accountId]/commercial` | Alta Commercial hub (invoices, payment links, analytics, payroll, settings) |
| `/bank/business` | **Marketing only** — product overview and CTAs |
| `/bank/open` | Open accounts (including Business Operating after company verification) |

Legacy routes under `/bank/business/*` and `/bank/accounts/*` redirect to the matching account-scoped path.

## Business Operating Account modules

When `accountType === business_operating`, the account page shows:

| Tab | Feature |
|-----|---------|
| Overview | Balances, company context, recent activity |
| Activity | Transaction history |
| Payments | Treasury scheduled/recurring payments + Alta Pay received |
| Invoices | Merchant invoices (Commercial) |
| Payment Links | Hosted payment links (Commercial) |
| Payroll | Employee registry & payroll batches — **Commercial Pro** (Core sees upgrade preview) |
| Analytics | Core: month summary · Pro: ranges, channels, trends |
| Team & permissions | Company membership → banking access (read-only roster + link to members) |
| Statements | Monthly statements |
| Settings | Commercial plan & billing (or account settings when Commercial is unavailable) |

Personal accounts show Overview, Activity, Deposit/Withdraw links, Statements, and Settings only.

## Commercial plans

| Plan | Collections | Analytics | Payroll | Branding |
|------|-------------|-----------|---------|----------|
| **Core** | Limited invoices & payment links | Basic month summary | Upgrade preview | Preview only — checkout stays Alta-branded |
| **Pro** | Unlimited | Ranges, invoice vs payment-link vs Alta Pay, trends | Full payroll | Publish custom branding |

Default Pro fee: **ƒ10,000 / month** (`DEFAULT_COMMERCIAL_PRO_MONTHLY_FEE`), overridable via platform settings.

Banking access is **not** a second permission system. Roles come from Alta company membership (`CompanyMembership.role`). Manage members at `/companies/[companyId]/members`.

## Permissions (company role)

Module access is derived from `CompanyMembership.role` on the account's company:

| Role | Access |
|------|--------|
| **Owner** | Full access to all business modules including settings / Pro purchase |
| **Executive** | Full treasury access; settings view-only for some billing actions |
| **Finance Manager** | Payments, payroll, invoices, payment links, statements (manage); team view |
| **Compliance Contact** | View statements, activity, team roster |
| **Viewer** | Overview and activity view only — no treasury tabs |

Enforcement:

- Client: `src/lib/bank/business-account-access.ts` — module visibility in account sub-nav
- Server: `src/server/business-account-context.service.ts` — `assertBusinessAccountAccess` on each module loader
- Commercial Pro feature gates: `src/server/commercial-plan.service.ts` / `src/lib/bank/commercial-banking-types.ts`

Existing helpers (`canViewBusinessTreasury`, `canManageBusinessTreasury`) remain unchanged for API/services.

## Data model

No schema changes. Business features continue to use:

- `BankAccount` (`BUSINESS_OPERATING`, linked to `companyId`)
- `Company` (must be `VERIFIED`; commercial plan fields)
- `CompanyMembership` (role-based access)
- `ScheduledPayment`, `PayrollEmployee`, `PayrollRun` (company-scoped)
- Merchant invoices / payment links (Commercial)

## Daily servicing

Commercial Pro renewals, past-due handling, grace downgrade, admin-grant expiration, and scheduled downgrades run inside `/api/cron/daily-servicing`. See [operations/daily-servicing.md](./operations/daily-servicing.md).

## Internal ops

Internal bank operations (`/internal/bank`) are unchanged. Business accounts appear in account queues and link to the same `BankAccount` records.

## Related docs

- [bank-backend.md](./bank-backend.md) — account opening and ledger
- [permissions.md](./permissions.md) — global tags vs company roles
- [alta-pay.md](./alta-pay.md) — Alta Pay received on the Commercial Payments surface
- [scheduled-transfers.md](./scheduled-transfers.md) — transfer + payroll execution
- [operations/daily-servicing.md](./operations/daily-servicing.md) — daily cron + commercial billing
