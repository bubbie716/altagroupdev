# Alta Terminal fictional crypto — operations runbook

**Explicit statement:** Alta Terminal crypto (NPFC, NVA, VLT) is a **fictional Minecraft roleplay economy denominated exclusively in florins (ƒ)**. It is unrelated to real-world cryptocurrency, blockchains, external exchanges, custody wallets, gas fees, or fiat money. Nothing here moves real-world value.

Do not paste secrets into this document, tickets, chat, or screenshots.

---

## Architecture and asset rules

| Symbol | Kind | Peg / start | Notes |
|--------|------|-------------|--------|
| **NPFC** | Stable | ƒ1.00 peg | Conversion fee; protected reserve backs circulating NPFC at ƒ1 |
| **NVA** | Bonding curve | Starts ƒ5 | Linear curve; fees split revenue + stabilization |
| **VLT** | Bonding curve | Starts ƒ0.10 | Same curve model; higher price impact |

**Authoritative stores**

- Customer coin balances: `TerminalCryptoWallet` / `TerminalCryptoWalletBalance` (not `TerminalPosition`)
- Settlement: `TerminalOrder` (`CRYPTO` / `ALTA_CRYPTO`) + `TerminalCryptoOrderSettlement`
- Market state / reserves / accrued revenue: `TerminalCryptoMarketState` + immutable market ledger
- Price history: `TerminalCryptoPriceCandle` (real trades only; empty periods may carry last close — never invent volatility)
- Portfolio charts: cash ledger + crypto fills/candles via `crypto-portfolio-history` merge (no fabricated pre-launch holdings)

**Lifecycle statuses:** `DRAFT` → `ACTIVE` ↔ `HALTED` / `REDEMPTION_ONLY` → `CLOSED` (terminal). Seeded launch assets remain **DRAFT** until a Corporate admin activates them after migration and staging checks.

**Venues:** Stock orders use TSE. Crypto orders use ALTA_CRYPTO only. TSE outage must not be treated as Alta Crypto outage.

---

## Permissions

| Action | Corporate admin (`requireAdmin`) | Terminal admin (`requireTerminalAdmin`) | Bank-only |
|--------|----------------------------------|------------------------------------------|-----------|
| View markets, assets, reconciliation, settlements | Yes | Yes | No |
| Halt / redemption-only | Yes | Yes | No |
| Run read-only reconciliation | Yes | Yes | No |
| DRAFT → ACTIVE (activate) | Yes | **No** | No |
| Resume → ACTIVE | Yes | **No** | No |
| Close asset | Yes | **No** | No |
| Revenue sweep | Yes | **No** | No |
| External reserve / stabilization contribution | Yes | **No** | No |
| Revenue→stabilization reclassification | Yes | **No** | No |

Server-side enforcement is the security boundary. UI visibility is not. Every mutation requires: nonempty operator reason, explicit confirmation, idempotency key, current version/status check, UI Lab mutation gate, audit event, and customer-safe errors (no raw DB leakage).

---

## Activation checklist (DRAFT → ACTIVE)

Corporate admin only. Fail closed unless **all** readiness checks pass (see `evaluateActivationReadiness`):

1. Phase 1–4 crypto migrations present and applied in the target environment
2. Asset configuration validates; market state row exists
3. `TERMINAL_CRYPTO_QUOTE_SECRET` configured strongly in production (min 32 chars)
4. Current price recomputes correctly from curve / peg
5. No unresolved **CRITICAL** reconciliation issues
6. Supply conservation (NVA/VLT: treasury + circulation = max supply)
7. Protected reserve coverage (NPFC ≥ circulation × ƒ1; curves ≥ recomputed liability)
8. Wallet aggregates and market/wallet ledgers reconcile
9. CRYPTO consent bundle + AT-LEGAL-006 registered/current
10. Scheduled crypto execution configured correctly
11. No impossible negative state

**Initial-state expectations**

- NPFC: circulation 0, protected reserve 0, price ƒ1
- NVA/VLT: treasury = max supply, circulation 0, reserves/stabilization 0, price = starting price

**UI:** readiness checklist, type the asset symbol, provide a reason. Do **not** activate in UI Lab (demonstrate with disabled controls). Do **not** activate production assets until staging verification below passes.

---

## Halt procedure

1. Confirm incident / risk (who, what, customer impact)
2. Terminal or Corporate admin: ACTIVE → HALTED with reason + confirmation + idempotency key
3. Verify new previews/submissions and scheduled executions reject immediately
4. Confirm completed fills are untouched; holdings/history preserved
5. Audit / activity visible on the asset workspace
6. Communicate customer-facing status (“Trading halted”)
7. Run reconciliation; do not “fix” balances by hand
8. Resume (→ ACTIVE) is Corporate-only and requires readiness again

---

## Redemption-only procedure

1. Terminal or Corporate admin: ACTIVE or HALTED → REDEMPTION_ONLY
2. Buys blocked; legitimate sells/redemptions allowed
3. Scheduled buys skip safely; scheduled sells may execute if otherwise valid
4. Customer UI must reflect buy disabled / sell enabled from **database status**, not hardcoded copy
5. Return to ACTIVE: Corporate admin + readiness
6. Close from REDEMPTION_ONLY: Corporate admin only, **circulation must be zero**, typed symbol + reason; never delete history

---

## Reconciliation checks

Read-only, idempotent, safe to re-run. No automatic balance repair.

Per asset (and cross-cutting settlement/wallet isolation):

1. Fixed-supply conservation (NVA/VLT)
2. Wallet aggregation vs circulating supply
3. NPFC backing (reserve ≥ circulation × ƒ1)
4. Curve coverage (reserve ≥ recomputed liability)
5. Cached marginal price vs recomputed price
6. Market ledger vs market state
7. Wallet ledger vs wallet balances
8. Settlement completeness (one settlement per fill; expected ledger entries; no duplicates)
9. Cash effects vs settlement values
10. Fee allocation (total = revenue + stabilization; NPFC stabilization 0)
11. Candle integrity (counts/volumes/OHLC from real settlements)
12. Wallet isolation (one wallet per portfolio; no cross-portfolio leak)
13. Order routing (CRYPTO↔ALTA_CRYPTO; STOCK↔TSE; no TSE id on crypto)

**Severities:** INFO / WARNING / CRITICAL. Critical blocks activation/resume, appears in Terminal Inbox/System attention, links to **Review crypto market**. Do not duplicate Inbox cases for the same unresolved issue.

Jobs: existing ops job catalog + cron; UI Lab manual run blocked; humanized results; failure visible in Jobs/System.

---

## Revenue sweep

- Env: `TERMINAL_CRYPTO_REVENUE_PORTFOLIO_ID` (ACTIVE Terminal portfolio suitable for Alta corporate revenue)
- Corporate admin only; amount ≤ accrued Terminal revenue
- Debit accrued revenue; credit destination portfolio cash
- Immutable market ledger + Terminal cash ledger + sweep record
- Idempotent and concurrency-safe; reason + confirmation
- Does **not** touch protected reserve, stabilization fund, customer wallets, or treasury inventory
- Does **not** auto-transfer to Alta Bank (use existing Terminal funding afterward)
- If destination missing/invalid: show accrued revenue, disable Sweep with configuration copy

Stabilization fund has **no** normal withdrawal button.

---

## External reserve / stabilization contributions

Append-only, positive florin amounts only, Corporate admin:

- **External protected-reserve contribution** — increases reserve; does not mint customer coins
- **External stabilization contribution** — increases stabilization only
- **Revenue → stabilization reclassification** — moves accrued revenue; no reserve/customer effect

Reject negative or arbitrary signed deltas. Label contributions transparently. No customer wallet/supply “set balance” controls in general admin UI.

---

## Incident response

1. **Contain:** halt or redemption-only as appropriate
2. **Observe:** reconciliation run + asset Activity timeline
3. **Communicate:** customer-safe status labels; no internal ledger dumps
4. **Do not** edit balances, rewrite ledger rows, or delete settlements
5. **Resolve** via code-reviewed compensating operation or controlled incident migration after review
6. **Prove** resolution with a later clean reconciliation run linked to the issue
7. **Resume** only after Corporate readiness passes

---

## Why arbitrary balance editing is prohibited

Crypto accounting is append-only. Direct “set reserve / set supply / set wallet” bypasses invariants, destroys auditability, and can silently undercollateralize the fictional market. Reconciliation identifies corruption; humans halt and ship a reviewed compensating path. There is no unrestricted signed-delta endpoint.

---

## Required backups

Before migration deploy or activation:

- PostgreSQL logical backup (or snapshot) covering Terminal + crypto tables
- Confirm restore procedure on staging within the last 30 days
- Record backup id / timestamp in the change ticket (no credentials)

After failed deploy: restore from backup only with explicit ops approval; prefer forward-fix migrations when safe.

---

## Migration order

Apply forward-only, in order (do not rewrite completed migrations):

1. `20260731140000_terminal_crypto_market_foundation`
2. `20260731160000_terminal_crypto_execution_hardening`
3. `20260731180000_terminal_crypto_customer_phase3`
4. `20260731200000_terminal_crypto_operations_phase4` (ops / reconciliation / lifecycle records)

Then: `prisma migrate deploy` in the target env (human-operated), generate client, run staging gates. **Do not activate assets in the same change as the first production migrate unless staging already proved activation.**

---

## Staging verification

Mandatory post-migrate gate before production activation:

- [ ] Migrations applied; launch assets still DRAFT
- [ ] Quote secret set; weak/missing secret fails closed
- [ ] Preview/submit reject DRAFT; ACTIVE path works on staging-only fixture if used
- [ ] Halt blocks preview/submit/scheduled immediately
- [ ] Redemption-only: buy blocked, sell allowed
- [ ] Reconciliation healthy on NPFC/NVA/VLT zero-circulation baseline
- [ ] Revenue sweep dry-run / staging sweep to configured portfolio
- [ ] Portfolio chart: no crypto before first fill; sells reduce exposure; NPFC at ƒ1; no double-count vs headline
- [ ] Phase 2 concurrency + Phase 4 ops integration tests (no silent skip in staging)
- [ ] UI Lab mutations still blocked
- [ ] Customer lifecycle labels match DB status
- [ ] TSE unavailable does not mark Alta Crypto unavailable

---

## Quote-secret rotation

1. Generate a new secret (`openssl rand -base64 32` or equivalent) — store only in the secrets manager
2. Deploy config with the new `TERMINAL_CRYPTO_QUOTE_SECRET`
3. In-flight quote fingerprints signed with the old secret will fail verification → customers requote (expected, fail closed)
4. Do not log the secret; do not put it in this runbook or git
5. Confirm preview/submit succeed after rotation; watch REQUOTE_REQUIRED rates briefly

---

## Recovery from a failed deployment

1. Stop further activates/sweeps
2. Halt ACTIVE assets if customer trading could be inconsistent
3. Assess: migrate partially applied vs app-only failure
4. Prefer forward fix; restore from backup only with approval
5. Re-run reconciliation; resolve CRITICAL issues before resume
6. Customer communication: trading paused / limited — fictional florin balances preserved

---

## Rollback expectations

- **Schema:** forward-only; do not “roll back” crypto migrations by dropping tables with live settlements
- **App:** prior app version may be redeployed if it tolerates newer schema (expand/contract)
- **Lifecycle:** CLOSED cannot reopen; halt/redemption-only are the operational rollback for trading
- **Money:** reverse via new ledger entries / reviewed compensations — never rewrite posted rows

---

## Customer communication points

| Event | Customer-facing message themes |
|-------|--------------------------------|
| Activation | Asset appears in Markets when ACTIVE; consent (AT-LEGAL-006) on first use |
| Halt | “Trading halted”; holdings visible; no new buys/sells |
| Redemption-only | Buys unavailable; sells/redemptions available |
| Close | Historical only; no trading |
| Quote secret / config | Generic unavailable / try again — never expose config internals |
| Reconciliation incident | Status-driven UI only; no raw issue codes in customer surfaces |

Always restate that crypto is **fictional and florin-only** in legal disclosures and support macros.

---

## Environment configuration (no secrets)

| Variable | Purpose |
|----------|---------|
| `TERMINAL_CRYPTO_QUOTE_SECRET` | HMAC for quote fingerprints; required in production (min 32 chars) |
| `TERMINAL_CRYPTO_REVENUE_PORTFOLIO_ID` | Destination Terminal portfolio for accrued revenue sweeps |

See `.env.example`. Never commit real values.

---

## Portfolio history (operators)

Charts merge **cash ledger** + **crypto fills** + **persisted candle closes** (NPFC peg ƒ1). Crypto contributes nothing before the portfolio’s first fill. Missing candles use last executed price and carry last known close flat. Headline `totalValue` and series end share one live marked crypto total (no double-count). If stock equity history is unavailable, scope is cash + crypto only — labeled honestly in product copy.

---

## Related code (pointers)

- Lifecycle: `src/lib/terminal/crypto/crypto-lifecycle.service.ts`
- Readiness: `src/lib/terminal/crypto/crypto-activation-readiness.service.ts`
- History merge: `src/lib/terminal/crypto/crypto-portfolio-history.ts`
- History loader: `src/lib/terminal/crypto/crypto-portfolio-history.service.ts`
- Ops errors: `src/lib/terminal/crypto/crypto-ops-errors.ts`
