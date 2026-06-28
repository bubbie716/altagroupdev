# Alta Internal Admin Console

Operations platform for Alta staff (operators and admins). Customer-facing routes are separate and must not be linked from internal search or workspaces.

## Navigation

| Area | Route | Purpose |
|------|-------|---------|
| Dashboard | `/internal` | Queues, health, recent operational events |
| Queues | `/internal/queues/*` | Canonical review queues (deposits, withdrawals, applications, etc.) |
| Explore | `/internal/users`, `/internal/companies`, `/internal/bank/*` | Customer, company, account, transaction workspaces |
| Products | `/internal/lending`, `/internal/alta-card` | Product hubs (queue counts only — no embedded job dashboards) |
| System | `/internal/jobs`, `/internal/audit`, `/internal/reports`, `/internal/compliance`, `/internal/settings` | Jobs, audit, reports, compliance signals, maintenance |

## Queue model

Each queue under `/internal/queues/` is the single canonical list for that work type. Product hub pages show count cards linking to queues — they do not duplicate queue tables.

Review actions use `OpsAction` / `OpsConfirmDialog` with a required reason. Server-side APIs enforce permissions independently of UI.

## Workspace model

Detail pages use tabbed workspaces (`?tab=`):

- **Customer** — `/internal/users/$userId`
- **Company** — `/internal/companies/$companyId`
- **Bank account** — `/internal/bank/accounts/$accountId`
- **Transaction** — `/internal/bank/transactions/$transactionId`
- **Loan** — `/internal/lending/loans/$loanId`
- **Alta Card** — `/internal/alta-card/$cardId`

Each workspace includes Overview, product tabs, Activity (operational events), Audit (compliance trail with link to filtered audit log), and Notes where supported.

## Jobs page

**Route:** `/internal/jobs`

Central registry for scheduled jobs, cron runs, and admin manual batch actions.

Tracked jobs include scheduled transfers, payroll, bank statements, deposit interest, loan servicing, Alta Card statements/billing/autopay (via billing job), and Relationship Intelligence batch refreshes.

Manual runs:

- Admin-only (`requireAdmin` server-side)
- Confirmation + required reason via `OpsAction`
- Audit log entry (`OPS_JOB_MANUAL_RUN`)
- Uses existing scheduler services and `OpsJobRun` records where available

Product hubs link to Jobs instead of embedding scheduler panels.

## Permission model

| Role | Capabilities |
|------|----------------|
| **Operator** | View queues, workspaces, transactions; low-risk review actions per policy |
| **Admin** | Manual job runs, maintenance mode, financial adjustments, statement void/regenerate, interest ops, destructive/batch actions |

Operators see **"Admin permission required."** for gated UI — buttons are hidden, not disabled in place.

Server checks (`requireAdmin`, `requireOperator`) always apply regardless of UI.

## Audit model

**Route:** `/internal/audit`

Append-only compliance trail. Filters: actor, entity type/id, action, date range, target IDs.

**Not** the same as the dashboard **Recent operational events** feed, which shows live activity for situational awareness.

Workspaces link to filtered audit views: `/internal/audit?entityType=…&entityId=…`

Export: CSV via the audit page (up to 5000 rows).

## Search model

Header global search queries live database records across customers, companies, accounts, transactions, deposits, withdrawals, statements, loans, lending applications, deal rooms, Alta Card entities, relationship profiles, audit references, and job runs.

All results link to **internal** routes only. Statement results link to account workspace `?tab=statements`, not customer `/bank/statements/[id]`.

## Mock route removal

These routes redirect to `/internal` — no mock data in production internal UI:

- `/internal/exchange`
- `/internal/terminal`
- `/internal/ipos`
- `/internal/listings`
- `/internal/api-applications`

## Safe action rules

1. Never use `window.confirm` for internal mutations — use `OpsAction`.
2. Every manual job run requires admin + reason + audit.
3. Operators must not reach maintenance or batch mutation UI.
4. Do not link internal search or ops views to customer routes.

## Remaining TODOs

- [ ] Wire `scheduled_transfers` / `loan_servicing` OpsJobRun writers in cron handlers
- [ ] Internal Secure Deal Room workspace (currently inbox → application threads)
- [ ] `ALTA_CARD` internal note target in Prisma
- [ ] Replace remaining `BankReviewButton` in loan/card ops panels with `OpsAction`
- [ ] Transaction explorer query params for report drill-down links
- [ ] Audit source/severity filters when metadata schema is standardized
- [ ] Migrate remaining explore pages from `AdminDataTable` to `OpsTable`
- [ ] Migrate bank ops sub-pages (interest, alta-pay, transfers) to console patterns

## UI consistency (polish pass)

Shared primitives live under `src/components/internal/console/`:

| Component | Purpose |
|-----------|---------|
| `OpsStatusBadge` | Canonical status display with normalized labels (`formatOpsStatusLabel`) |
| `OpsTable` | Sort, select, bulk actions, skeleton loading, empty states |
| `OpsEmptyState` | Informative empty states |
| `OpsFilterBar` | Compact filter panels (customers, accounts, audit) |
| `OpsTableSkeleton` | Consistent loading placeholders |
| `OpsAction` + `OpsConfirmDialog` | Safe mutations with reason + a11y |

`StatusBadge` re-exports `OpsStatusBadge` for backward-compatible imports.

Copy vocabulary is centralized in `src/lib/internal/console/ops-copy.ts`.
