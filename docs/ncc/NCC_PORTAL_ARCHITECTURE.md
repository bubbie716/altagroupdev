# NCC Portal Architecture

Institution-facing operational portal for approved financial institutions.

Builds on Sprint 1 settlement foundation and Sprint 2 portal shell. Sprint 3A adds real-time execution visibility, Processing & Exceptions queue semantics, and tighter audit isolation. Sprint 3B adds the **Developers** section for API credentials, webhooks, API logs, and documentation — still not public self-registration.

Related: [Technical Architecture](./NCC_TECHNICAL_ARCHITECTURE.md) · [Real-Time Settlement](./NCC_REAL_TIME_SETTLEMENT.md) · [Institution API](./NCC_INSTITUTION_API.md) · [Sprint 3B Report](./NCC_SPRINT_3B_REPORT.md)

## Design language

- White background, soft gray surfaces, NCC green (`#0c4d32`)
- Dense tables, summary cards, status badges, side navigation
- Institutional typography; minimal motion
- Skeleton loaders instead of centered spinners

## Navigation

### Sidebar (`PORTAL_NAV`)

| Label | Path |
| --- | --- |
| Dashboard | `/portal` |
| Processing & Exceptions | `/portal/queue` |
| Settlement History | `/portal/settlements` |
| Settlement Accounts | `/portal/accounts` |
| Routing Numbers | `/portal/routing` |
| Institution Members | `/portal/members` |
| Reports | `/portal/reports` |
| Audit Log | `/portal/audit` |
| Institution Settings | `/portal/settings` |
| Support | `/portal/support` |
| Developers | `/portal/developers` |

### Developers section (Sprint 3B)

| Path | Purpose |
| --- | --- |
| `/portal/developers` | Overview |
| `/portal/developers/api-credentials` | Create / rotate / revoke machine credentials |
| `/portal/developers/webhooks` | Endpoint management |
| `/portal/developers/webhooks/:id` | Delivery history, test, redeliver |
| `/portal/developers/api-logs` | Sanitized request logs |
| `/portal/developers/documentation` | Links to API docs |

Permissions: `manage_api_credentials`, `view_api_credentials`, `manage_webhooks`, `view_webhooks`, `view_api_logs`.

### Top bar

- Global search (settlements, routing, members, audit)
- Notifications (operational alerts + recent audit)
- Current user menu

Legacy `/dashboard` on the NCC site redirects to `/portal`.

## Page hierarchy

```
/portal                          Layout shell (auth + institution context)
├── /                            Dashboard metrics, alerts, recent activity
├── /queue                       Processing & Exceptions (in-flight + failures)
├── /settlements                 Settlement history
├── /settlements/$id             Settlement detail (timeline, ledger, audit, execution)
├── /accounts                    Settlement account balances + ledger
├── /routing                     Routing numbers (read + future admin actions)
├── /members                     Institution members + roles
├── /reports                     Trailing metrics + lazy chart + CSV export
├── /audit                       Read-only institution-isolated audit log
├── /settings                    Institution profile (read-only)
└── /support                     Support entry points
```

### Processing & Exceptions (`/portal/queue`)

Formerly “Settlement Queue.” Shows instructions that need attention:

- Instruction statuses in intake / validation / settling / failed
- **Or** linked `SettlementExecution` in non-terminal progress / retry / manual review / failed / compensating

Completed end-to-end work belongs in Settlement History. Description copy: in-flight real-time settlements, retries, failures, and manual-review exceptions.

## Component hierarchy

```
PortalShell
├── Sidebar (PORTAL_NAV)
├── Top bar
│   ├── PortalGlobalSearch
│   ├── Notifications dropdown
│   └── NccUserMenu
└── Page views
    ├── PortalDashboardView
    ├── PortalSettlementsView (history + Processing & Exceptions)
    ├── PortalSettlementDetailView
    ├── PortalAccountsView
    ├── PortalRoutingView
    ├── PortalMembersView
    ├── PortalReportsView (+ lazy PortalVolumeChart)
    └── PortalAuditView

Shared:
├── PortalEnterpriseTable
├── PortalStatusBadge
├── PortalMetricCard / PortalPageHeader
└── Portal*Skeleton
```

## Permissions

Server-side only (`requireInstitutionPermission` / `requireAuth`).

Institution members see **only** their institution’s:

- settlement instructions (party to send/receive)
- routing numbers
- settlement accounts
- members
- audit (institution-isolated — see below)
- reports

NCC internal staff (`canAccessInternal`) may operate any institution; preferred `institutionId` is honored for staff. Staff without membership default to Alta Bank (`inst-alta-bank`).

UI may hide controls; **all** mutations and reads must re-check on the server.

## Settlement / execution display

List and detail rows include Sprint 3A execution fields (`PortalSettlementRow`):

| Field | Meaning |
| --- | --- |
| `status` | `SettlementInstruction` status (SETTLED = NCC ledger finality) |
| `stage` | Prefer `execution.status`; fallback maps instruction status |
| `executionStatus` | Raw execution status (e.g. `CREDITING_DESTINATION`, `COMPLETED`) |
| `executionStep` | Current step (`VALIDATE` … `FINALIZE`) |
| `completedAt` | Set only when execution reaches **COMPLETED** |
| `sourceCommitReference` | Source adapter commit ref |
| `destinationCreditReference` | Destination adapter credit ref |
| `failureCode` / `failureReason` | Instruction or execution failure |

### SETTLED vs end-to-end completion

- **SETTLED** on the instruction badge means NCC ledger posted — not necessarily that the customer destination credit finished.
- End-to-end completion is **`executionStatus === COMPLETED`** (and `completedAt` set).
- Operators must not treat SETTLED alone as “fully done” when execution is still retrying or in manual review.

Cancel: server denies cancel after SETTLED/REVERSED and while SETTLING. Portal cancel UX does not yet fully mirror every mid-execution cutoff (known limitation).

## Audit isolation

Sprint 3A fix: portal audit is scoped by:

1. `AuditLog.institutionId = current institution`, **or**
2. Entity-graph membership — entity ids belonging to that institution:
   - settlement instructions (send or receive)
   - settlement executions for those instructions
   - routing numbers, settlement accounts, institution members
   - financial institution entity itself
   - related terminal funding/withdrawal entities as wired in `listPortalAudit`

This replaces the earlier broad “NCC-scoped window” that could leak cross-institution events.

## Table system

`PortalEnterpriseTable` is the reusable enterprise table:

- sticky headers
- loading skeleton rows
- empty states
- optional row click / keyboard activation
- responsive horizontal scroll (`min-w-[720px]`)

Page-level filters (search, status, actor) compose above the table.

## Status system

Consistent badges via `PortalStatusBadge`:

- Institution: Applicant, Active, Restricted, Suspended, Terminated
- Routing: Reserved, Active, Suspended, Retired
- Settlement instruction: Created → … → Settled / Failed / Cancelled / Reversed
- Execution stage shown as text alongside instruction badge (Processing & Exceptions)

## Report system

`getPortalReports` aggregates trailing ~30 days:

- volume, count, failure rate, average processing time
- balances
- top counterparties
- daily volume series

Charts lazy-load (`PortalVolumeChart` via `React.lazy` + `Suspense`).

Exports: CSV now; PDF reserved for a later sprint.

## Data loaders

Server functions in `src/lib/ncc/ncc-portal.functions.ts` call `ncc-portal.service.ts`:

| Function | Purpose |
| --- | --- |
| `fetchPortalShell` | Institution + notifications for chrome |
| `fetchPortalDashboard` | Metrics, alerts, recent activity |
| `fetchPortalSettlements` | Processing & Exceptions / history lists (includes execution fields) |
| `fetchPortalSettlementDetail` | Full instruction detail |
| `fetchPortalAccount` | Settlement account summary |
| `fetchPortalRouting` | Routing numbers |
| `fetchPortalMembers` | Members |
| `fetchPortalReports` | Report metrics |
| `fetchPortalAudit` | Institution-isolated audit rows |
| `fetchPortalSearch` | Global search |
| `portalCancelSettlement` | Cancel when server permits |

## Future API integration

Later sprints may add:

- External institution API (authenticated machine clients)
- Invitation / role-change workflows in the portal
- Routing admin actions (suspend / retire / mark primary) with permission gates
- Persistent notification store + dismiss API
- PDF report export
- Institution selector for multi-institution operators
- Full cancel UX aligned with execution cutoffs
- Explicit dual badges: instruction SETTLED vs execution COMPLETED

Do **not** couple the portal UI to a public HTTP API until that API is intentionally designed. Portal loaders remain the institution UI boundary.
