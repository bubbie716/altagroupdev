# NCC Sprint 4D Report — Production Truth and Runtime Mock Removal

**Date:** 2026-07-17  
**Code root:** `altaweb/`

## 4C corrections

- External connector responses are strict: prepare/commit/credit/compensate require real references and explicit success; malformed 2xx fails closed.
- Missing connector compensation never returns a fake success.
- Ambiguous commit/credit/compensation recover via status query on the original idempotency key only.
- Certification PASS only when the participant connector demonstrated the check; unprovable checks stay FAIL for staff evidence.
- Owners configure TEST source/destination account identifiers for certification (resolved through the connector).
- LIVE promotion is idempotent; audit write failure cannot invert a completed activation; settlement create remains `0.00` and never overwrites liquidity.

## Runtime mock paths removed

- Deleted `SHOW_PUBLIC_SIMULATED_MARKET_DATA` / `SHOW_USER_FINANCIAL_MOCK_DATA` and all production branches.
- Formatters moved to `src/lib/format/money-display.ts`.
- Terminal/Exchange APIs return empty or unavailable datasets (no generated markets/portfolios).
- Removed `DEMO_API_KEY`, browser credential issuance, and simulated issuer sessions.
- Corporate homepage no longer shows fake indices, movers, or market metrics.
- Bank UI mock branches removed; live DB paths retained.
- `prisma/seed.ts` refuses production (`NODE_ENV` / `VERCEL_ENV`).

## Real data retained

- Terminal cash account number and available/ledger/reserved balances
- Bank ↔ Terminal funding and withdrawal history (NCC-backed)
- NCC settlements, institutions, credentials, connectors, directories, certification (persisted only)

## Features now empty / unavailable

- Terminal holdings, trading, watchlists, IPOs, research, news, rankings
- Exchange listings, indices, IPOs, filings, announcements, rankings, API credentials, issuer portal
- Corporate homepage market snapshot / demo portfolio chart

## Test / typecheck / build results

- Focused 4C + 4D: **20/20 pass**
- Full `npm run test:ncc`: **125/125 pass**
- Typecheck: within baseline (**348/363**)
- Production build: **pass**

## Remaining NCC v1 freeze blockers

- Real participant certification evidence against a non-stub TEST connector (staff evidence for webhook/timeout/negative cases)
- Authorized liquidity funding after LIVE activation at zero
- Secure regulatory document upload UI
- Real Terminal trading / Exchange market infrastructure (explicitly out of scope)

## GO/NO-GO

**GO** for production truth: no fabricated runtime financial/market data; NCC connector honesty + empty Terminal/Exchange surfaces.  
**NO-GO** for production external-bank money movement until a real connector completes honest certification and liquidity is funded.
