# Metrics Policy

Alta Group surfaces two distinct categories of numbers across the public site, bank client areas, and internal tools. This document defines what must be database-backed and what may remain simulated.

## Live platform metrics

**Source:** PostgreSQL via Prisma (`platform-metrics.service.ts`, `bank-metrics.service.ts`).

**Must be DB-backed when displayed as platform usage:**

- Users (total registered)
- Companies (total, verified, pending verification)
- Bank accounts (total, active, pending, frozen, personal vs business)
- Deposits held (sum of active account balances)
- Pending deposit / withdrawal requests
- Pending bank reviews (accounts, transactions, user review status)
- Approved deposit / withdrawal volumes
- Company memberships / authorized representatives

**UI label:** `Live platform data` (via `LiveMetricCard` or equivalent copy).

**Rule:** If a statistic describes real platform usage, customers, accounts, deposits, users, companies, bank volume, or operational activity, it must come from the database or show `0` honestly when empty.

## Simulated market data

**Source:** In-memory mock modules under `src/lib/exchange/`, `src/lib/mock-data.ts`, and Terminal preview data.

**May remain simulated (explicitly labeled):**

- Exchange listed company previews
- Stock / index prices and changes
- Market cap, daily turnover, advancers/decliners on Exchange pages
- IPO preview cards
- Market rankings and leaderboard preview data
- Terminal portfolio / watchlist / order preview when mock data mode is enabled

**UI label:** `Simulated market data` or `MockDataNotice` where shown on Exchange / Terminal surfaces.

## Preview / not yet active

**Source:** Static copy for modules without live backends.

**Examples:**

- NCC settlement network volume
- Internal IPO queue counts (until wired to DB)
- Compliance flag counts
- API application queue (until wired to DB)
- Merchant accounts, business lending marketing claims

**UI label:** `Preview — not connected to live operations`, `Coming Soon`, `Planned`, or `In Development`.

## Where metrics come from

| Surface | Live metrics | Simulated |
|---------|--------------|-----------|
| `/governance` | Company registry, bank accounts, deposits, pending reviews | Exchange market posture label |
| `/` homepage | User, account, company, deposit totals | Hero NSX-100 ticker, marquee prices |
| `/internal` | Users, companies, bank ops counts | IPO, compliance, API preview rows |
| `/bank` (live mode) | User-specific balances and transactions | Mock dashboard when mock mode enabled |
| `/exchange` | — | Listings, indices, market stats |
| `/exchange/terminal` | — | Portfolio / market preview data |

## Server functions

- `fetchPlatformMetrics()` — public aggregate platform metrics
- `fetchBankMetrics()` — bank-specific aggregates (also used inside platform metrics)

Both return zero-filled objects when the database is unavailable (no fabricated fallback counts).

## Development rule

**Never present fake user or platform statistics as real.** When in doubt, use a status label (`Operational`, `Planned`, `Preview`) or query the database.
