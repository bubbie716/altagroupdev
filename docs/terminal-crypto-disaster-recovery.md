# Alta Terminal crypto — disaster-recovery readiness

**Scope:** Minimum operational foundation for fictional Alta Crypto (NPFC / NVA / VLT). Not a standalone backup product. Do not paste secrets, credentials, or connection strings into tickets or this document.

## What must be backed up

PostgreSQL logical backup (or equivalent snapshot) covering at least:

| Area | Tables / artifacts |
|------|--------------------|
| Assets & market state | `TerminalCryptoAsset`, `TerminalCryptoMarketState` |
| Customer wallets | `TerminalCryptoWallet`, `TerminalCryptoWalletBalance`, `TerminalCryptoWalletLedgerEntry` |
| Settlements & orders | `TerminalOrder` (CRYPTO / ALTA_CRYPTO), `TerminalCryptoOrderSettlement` |
| Market ledger | `TerminalCryptoMarketLedgerEntry` |
| Lifecycle & config versions | `TerminalCryptoAssetStatusChange`, `TerminalCryptoAssetConfigChange` |
| Integrity | `TerminalCryptoReconciliationRun`, `TerminalCryptoReconciliationIssue` |
| Treasury ops | `TerminalCryptoRevenueSweep`, `TerminalCryptoExternalContribution` |
| Candles | `TerminalCryptoPriceCandle` |
| Portfolio cash | `TerminalPortfolio`, `TerminalPortfolioCashAccount`, cash ledger entries tied to sweeps |
| Audit | Platform `AuditLog` rows for `TERMINAL_CRYPTO_*` |

Secrets are **not** in the database backup: `TERMINAL_CRYPTO_QUOTE_SECRET`, `TERMINAL_CRYPTO_REVENUE_PORTFOLIO_ID`, Discord OAuth, session secrets — restore from the secrets manager separately.

## Backup freshness visibility

The Terminal System page reports backup readiness as **not configured** until an automated freshness probe exists. Operators must:

1. Confirm a successful PostgreSQL logical backup (or snapshot) within the last 30 days before migration deploy or activation
2. Record backup id / timestamp in the change ticket (never credentials)
3. Confirm staging restore procedure has been exercised within 30 days

## Safe export / evidence (read-only)

Prefer existing operator surfaces — do not invent balance-edit shortcuts:

- Asset workspace **Activity**, **Fees & curve** versions, **Market ledger**, **Recent settlements**
- Reconciliation issue fingerprints, first/last seen, severity, status
- Append-only audit log entries for lifecycle, fees, sweeps, contributions, issue resolve/reopen
- System page readiness categories (available now / demonstration / not configured / not implemented / blocked by Newport)

Exports should omit secrets and raw customer Discord tokens.

## Recovery dependencies and migration order

Apply forward-only migrations in timestamp order. Crypto-relevant sequence:

1. `20260731140000_terminal_crypto_market_foundation`
2. `20260731160000_terminal_crypto_execution_hardening`
3. `20260731180000_terminal_crypto_customer_phase3`
4. `20260731200000_terminal_crypto_operations_phase4`
5. `20260731210000_terminal_crypto_go_live_activate`
6. `20260731220000_terminal_crypto_curve_recalibration`
7. `20260802200000_terminal_crypto_operations_phase5` (config history + issue review metadata)

After restore:

1. `prisma migrate deploy` only with explicit ops approval (never from UI Lab)
2. `prisma generate`
3. Confirm `TERMINAL_CRYPTO_QUOTE_SECRET` (≥ 32 chars) in the secrets manager
4. Run crypto reconciliation from `/internal/terminal/crypto`
5. Resolve CRITICAL issues before resume/activate
6. Smoke Markets → preview → submit on staging

## Rollback expectations

- **Schema:** forward-only; do not drop crypto tables with live settlements
- **Trading:** halt or redemption-only — operational rollback without deleting history
- **Money:** compensating ledger entries only — never rewrite posted rows
- **CLOSED** assets cannot reopen

## Related

- [terminal-crypto-operations.md](./terminal-crypto-operations.md) — day-to-day ops runbook
