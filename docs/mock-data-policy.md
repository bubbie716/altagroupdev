# Mock Data Policy

Alta uses mock data in two distinct categories. This document defines what is allowed, what is disabled in production-facing authenticated areas, and how to toggle behavior for local demos.

## Configuration

Global flags live in `src/lib/config/data-mode.ts`:

| Flag | Default | Purpose |
|------|---------|---------|
| `SHOW_PUBLIC_SIMULATED_MARKET_DATA` | `true` | Exchange listings, indices, rankings, company pages, IPO/research previews |
| `SHOW_USER_FINANCIAL_MOCK_DATA` | `false` | User-specific bank balances, portfolios, transactions, orders, watchlists |

Helper functions:

- `isPublicSimulatedMarketDataEnabled()`
- `isUserFinancialMockDataEnabled()`

## Allowed mock data (public / marketing)

These areas may continue showing simulated content while real backends are built:

- **Homepage** — division metrics, marquee ticker, closing CTA market snapshot (with disclaimer)
- **Exchange** — `/exchange`, listings, indices, rankings, company pages, IPO, research, corporate actions
- **Bank marketing** — `/bank/products`, `/bank/lending`, `/bank/business` (product catalogs and institutional previews)
- **Terminal marketing** — `/terminal/news`, `/terminal/research`, `/terminal/ipo`, `/terminal/leaderboard`
- **Governance** — static institutional content

Public simulated market data must display:

> Simulated market data for preview.

via `MockDataNotice` (Exchange sub-nav, homepage marquee/CTA).

## Disabled mock data (user-specific financial)

When `SHOW_USER_FINANCIAL_MOCK_DATA` is `false`, authenticated pages must **not** present fake balances, holdings, or transactions as real:

| Area | Empty state / behavior |
|------|------------------------|
| `/bank` (dashboard) | “No Alta Bank accounts yet.” → Open an Account |
| `/bank/accounts` | “You do not have any Alta Bank accounts yet.” |
| `/bank/transfers` | Transfer hub — choose Intrabank or Interbank |
| `/bank/transfers/intrabank` | Live intrabank transfers — own accounts or another player |
| `/bank/transfers/interbank` | Wire preview only (NCC-Net) |
| `/bank/private` | No fake private metrics, card, or banker assignment |
| `/terminal` | “No portfolio connected yet.” → Explore Alta Exchange |
| `/terminal/portfolio` | “You do not have any holdings yet.” |
| `/terminal/trade` | Trade ticket disabled; no order history |
| `/terminal/watchlist` | Empty user watchlist; optional **Sample watchlist** section (labeled) |
| `/profile` | Real Prisma/auth identity only (already the case) |
| Homepage hero (signed in) | User identity + empty portfolio state (no fake net worth) |

Mock data files (`lib/bank/data.ts`, `lib/terminal/data.ts`, `lib/mock-data.ts`) are **retained** but gated at the route/component layer.

## Internal admin portal

Internal pages (`/internal/*`) may keep mock operational data for UI development. All internal pages show:

> Internal preview data — not connected to live operations.

via `PreviewDataBanner` in `InternalPageShell`.

Do not treat internal mock metrics as live operational truth.

## Re-enabling mock data for local demos

1. Open `src/lib/config/data-mode.ts`
2. Set `SHOW_USER_FINANCIAL_MOCK_DATA = true`
3. Restart the dev server

This restores simulated bank dashboards, terminal portfolios, and homepage net-worth snapshot for signed-in users.

## Reusable components

| Component | Path | Use |
|-----------|------|-----|
| `EmptyBankState` | `src/components/data/empty-bank-state.tsx` | No bank accounts |
| `EmptyPortfolioState` | `src/components/data/empty-portfolio-state.tsx` | No portfolio / holdings |
| `MockDataNotice` | `src/components/data/mock-data-notice.tsx` | Public simulated market disclaimer |
| `PreviewDataBanner` | `src/components/data/preview-data-banner.tsx` | Internal ops preview banner |

## TODO — replace empty states with real backends

- [ ] Alta Bank accounts, balances, and transactions (Postgres + bank service)
- [ ] Transfers and wire initiation (NCC-Net integration)
- [ ] Alta Private relationship profile (invitation + banker assignment)
- [ ] Terminal portfolio positions synced from exchange/custody
- [ ] Order entry and trade history
- [ ] User watchlists persisted per account
- [ ] Homepage portfolio snapshot from real aggregated positions
- [ ] Internal ops metrics from live admin APIs (replace `lib/internal/data.ts` mocks)

## Import guidance

- **Do not** import `lib/bank/data` or `lib/terminal/data` directly in routes — use `lib/bank/api` and `lib/terminal/api`, gated by `data-mode`.
- **Deprecated shims** (`mock-bank-data.ts`, `mock-terminal-data.ts`, `mock-exchange-data.ts`) have no runtime consumers; prefer API layers.
- Exchange mock data flows through `lib/exchange/api` and remains allowed when `SHOW_PUBLIC_SIMULATED_MARKET_DATA` is true.
