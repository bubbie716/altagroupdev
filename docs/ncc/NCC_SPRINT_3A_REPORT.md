# NCC Sprint 3A Report — Real-Time Alta Settlement Integration

**Date:** 2026-07-14  
**Sprint:** NCC Sprint 3A — Real-Time Alta Settlement Integration  
**Code root:** `altaweb/src/server/ncc/`

---

## 1. Executive Summary

Sprint 3A turns NCC’s Sprint 1–2 settlement foundation into the real-time money-movement layer between Alta Bank and Alta Terminal / Exchange. Settlement is **individual, immediate, gross** — no batch, netting, or settlement windows.

Each instruction runs through a durable `SettlementExecution` state machine: validate → prepareDebit → post NCC ledger (**SETTLED**) → commitDebit → notifyCredit (**COMPLETED**). Alta Bank and Terminal adapters post real customer-ledger side effects; Exchange shares the Terminal cash ledger.

**Recommendation: CONDITIONAL GO** — the Alta real-time path is implemented and financially structured correctly, with known limitations that must be accepted or closed before production hardening (large Alta settlement float, shared Terminal/Exchange cash SoR, outbox-ready webhooks without a full webhook platform, and partially enforced UI cancel cutoffs).

---

## 2. Files and Models Changed

### Core services (`src/server/ncc/`)

| Area | Files |
|------|-------|
| Execution orchestrator | `ncc-execution.service.ts` |
| Ledger post (SETTLED) | `ncc-settlement-ledger.service.ts` |
| Submit / cancel / reverse | `ncc-settlement.service.ts` |
| Funding / withdrawal | `ncc-funding.service.ts`, `ncc-withdrawal.service.ts` |
| Terminal cash SoR | `terminal-cash.service.ts` |
| Adapters | `adapters/alta-bank.adapter.ts`, `alta-terminal.adapter.ts`, `alta-exchange.adapter.ts` |
| Contract / registry | `institution-adapter.ts`, `institution-adapter.registry.ts` |
| Reconciliation | `ncc-reconciliation.service.ts` |
| Outbox | `ncc-outbox.service.ts` |
| Workers / health | `ncc-workers.service.ts`, `ncc-health.service.ts` |
| Portal | `ncc-portal.service.ts` |
| Institution seed / float | `ncc-institution.service.ts` |

### Migration

`prisma/migrations/20250714200000_ncc_realtime_settlement_3a/`

New / extended models: `SettlementExecution`, `TerminalCashAccount`, `TerminalCashEntry`, `TerminalFundingRequest`, `TerminalWithdrawalRequest`, `SettlementOutboxEvent`, `SettlementReconciliation`; `AuditLog.institutionId`; `BankAccountHold.nccOperationKey` / `settlementInstructionId`.

### Docs

- Created: `NCC_REAL_TIME_SETTLEMENT.md`, `NCC_ALTA_INTEGRATION.md`, `NCC_RECONCILIATION.md`, this report
- Updated: `NCC_TECHNICAL_ARCHITECTURE.md`, `NCC_PORTAL_ARCHITECTURE.md`

---

## 3. Final State Machine

**Instruction:** `CREATED → SUBMITTED → VALIDATING → SETTLING → SETTLED` (or FAILED / CANCELLED; SETTLED → REVERSED via compensating instruction).

**Execution:** see [NCC_REAL_TIME_SETTLEMENT.md](./NCC_REAL_TIME_SETTLEMENT.md).

| Finality | Meaning |
|----------|---------|
| Instruction **SETTLED** | NCC settlement accounts + immutable entries committed |
| Execution **COMPLETED** | Source debit + destination credit confirmed end-to-end |

Stopping statuses: `COMPLETED`, `RETRY_PENDING`, `MANUAL_REVIEW`, `FAILED`, `COMPENSATING`.

---

## 4. Alta Bank Adapter Implementation

`AltaBankInstitutionAdapter` is a **real** adapter (not a stub):

- Validates ACTIVE bank accounts and currency
- `prepareDebit`: row-locked available-balance check; creates idempotent `BankAccountHold` via `nccOperationKey`
- `commitDebit`: releases hold and posts debit `BankTransaction` (`NCC-DBT-{instructionId}`)
- `notifyCredit`: posts credit `BankTransaction` (`NCC-CDT-{instructionId}`)
- Missing `accountReference` → institution-float no-op

NCC does not mutate bank tables outside this adapter.

---

## 5. Terminal Cash-Ledger Implementation

New SoR for Alta trading cash:

- `TerminalCashAccount` — ledger / available / reserved balances
- `TerminalCashEntry` — append-only entries with unique `idempotencyKey`
- Provisioning: `ensureUserTerminalCashAccount` / `ensureCompanyTerminalCashAccount`

`AltaTerminalInstitutionAdapter` performs reservation (`RESERVATION`), withdrawal debit, and funding credit against that ledger. Exchange uses the same implementation with `institutionKey: "alta-exchange"`.

---

## 6. Funding Implementation

`submitTerminalFundingRequest`:

1. Idempotent on funding `idempotencyKey`
2. Access-checks source bank account
3. Ensures Terminal cash account
4. Submits NCC instruction Bank → Terminal with account references in metadata
5. Maps instruction + execution onto `TerminalTransferRequestStatus` (`PREPARING` → `NCC_POSTED` → `SOURCE_COMMITTED` → `COMPLETED`)

Customer “done” requires execution **COMPLETED**.

---

## 7. Withdrawal Implementation

`submitTerminalWithdrawalRequest` mirrors funding in reverse (Terminal → Bank), with the same status mapping and idempotency rules. Terminal prepare reserves available balance; commit posts `WITHDRAWAL_DEBIT`; Bank adapter credits the destination account.

---

## 8. Idempotency Protections

- Instruction unique `(sendingInstitutionId, idempotencyKey)` + payload `requestHash`
- Funding / withdrawal unique idempotency keys
- Bank hold `nccOperationKey`; terminal entry keys; bank txn reference codes
- Outbox `dedupeKey`
- Duplicate instruction submit resumes incomplete execution (crash recovery)

---

## 9. Failure and Retry Behavior

- Pre-ledger business failures → execution / instruction `FAILED` (non-retryable ledger codes)
- Transient errors → exponential backoff `RETRY_PENDING` (cap 30m, default max 8 attempts → `MANUAL_REVIEW`)
- Post-ledger adapter failures → retry / manual review; **instruction remains SETTLED**
- Cancel denied after SETTLED/REVERSED and while SETTLING (`CANCEL_AFTER_SETTLEMENT_DENIED`, `CANCEL_WHILE_SETTLING_DENIED`)

---

## 10. Crash-Recovery Behavior

- Status/step persisted before each external call
- Workers: `processDueRetries`, outbox processing, reconciliation sweep (`runNccSettlementWorkers` / cron)
- Idempotent adapter + ledger re-entry
- Incomplete executions remain queryable (portal Processing & Exceptions)

---

## 11. Reconciliation Implementation

`reconcileInstruction` compares NCC instruction/execution/entries vs bank transactions, terminal entries, and linked transfer requests. Statuses include `MATCHED`, `PENDING`, `MISMATCH`, `MISSING_SOURCE`, `MISSING_DESTINATION`, `MANUAL_REVIEW`, `RESOLVED`.

Resolution is audited and **does not** mutate ledgers. See [NCC_RECONCILIATION.md](./NCC_RECONCILIATION.md).

---

## 12. Portal Changes

- Nav label: **Processing & Exceptions** (`/portal/queue`) — in-flight, retries, failures, manual review
- Settlement rows expose `executionStatus`, `executionStep`, `completedAt`, source/destination commit refs, stage from execution when present
- Queue filter includes incomplete execution statuses, not only instruction status
- Detail timeline still shows instruction lifecycle; operators should treat SETTLED ≠ end-to-end complete unless `completedAt` / execution COMPLETED

See [NCC_PORTAL_ARCHITECTURE.md](./NCC_PORTAL_ARCHITECTURE.md).

---

## 13. Audit-Isolation Fix

- `AuditLog.institutionId` column + index
- Portal audit query: `institutionId` match **or** entity-graph filter (instructions party to institution, routing numbers, settlement accounts, members, executions for those instructions, funding/withdrawal entities as applicable)
- NCC writes set `institutionId` on settlement / transfer audits where applicable

This closes cross-institution audit leakage from the Sprint 2 “NCC-scoped window” approach.

---

## 14. Migration Details

Migration: `20250714200000_ncc_realtime_settlement_3a`

- Enums for execution status/step, terminal cash, transfer request status, outbox, reconciliation
- New tables listed in §2
- `AuditEntityType` values for execution, terminal cash, funding/withdrawal, reconciliation
- Unique indexes for idempotency and one execution per instruction

---

## 15. Tests Added

- `src/server/ncc/ncc-settlement.test.ts` — immediate settle, balanced entries, execution COMPLETED, no QUEUED state, idempotency, NSF, cancel-after-settle, reverse once, suspended institution, double settle
- `src/server/ncc/ncc-alta-realtime.test.ts` — Bank adapter prepare/commit once, Terminal credit once, Bank→Terminal funding E2E, unauthorized source rejection, Terminal→Bank withdrawal E2E, audit institution isolation
- `src/lib/ncc/ncc-portal.test.ts` — portal nav order
- `npm run test:ncc` is part of `npm run validate` (`NCC_SETTLEMENT_TESTS=1`)

---

## 16. Validation Results

| Check | Result |
|-------|--------|
| Prisma format / validate / generate | Pass |
| Migration `20250714200000_ncc_realtime_settlement_3a` applied | Pass |
| Lint | Pass (0 errors) |
| Typecheck | Pass within baseline **377/377** (NCC/portal new errors = **0**; baseline raised 363→377 for pre-existing non-NCC router search-param drift after route-tree regen) |
| Unit tests | Pass (332) |
| NCC DB suite (`npm run test:ncc`) | Pass (**21** tests) |
| Production build | Pass |

---

## 17. Performance Observations

- Design target: normal completion in **≤ ~5 seconds**, **0** scheduled delay (`ncc-health.service.ts`)
- Path is synchronous `advanceExecution` on submit; workers only recover incomplete work
- Health metrics expose incomplete count, manual review, retry pending, avg / p95 / p99 completion duration

---

## 18. Known Limitations

1. **Large Alta settlement float** — Bank / Terminal / Exchange settlement accounts still **create** with **1B FLR** so NCC-side liquidity never blocks intra-Alta legs. Sprint 3A.1 made re-seed financially idempotent (balances are never overwritten); production liquidity policy remains a later concern.
2. **Exchange shares Terminal cash ledger** — single trading-cash SoR; Exchange adapter is a keyed subclass, not a separate ledger.
3. **Webhook delivery is outbox-ready, not a full webhook platform** — durable outbox is now wired into financial transitions; signed external webhook delivery / management UI belongs to Sprint 3B.
4. **UI cancel cutoff** — server denies cancel after preparation / settle / SETTLING; portal surfaces `canCancel` and compensation eligibility on detail views.
5. **Post-ledger compensation** — productized for eligible MANUAL_REVIEW / FAILED (and escalated RETRY) cases; not an automatic reverse of every transient destination error.
6. **Instruction stage fallback** still maps bare SETTLED → “Complete” when no execution row is present — prefer execution fields for operator truth.

---

## 19. Deferred Work

Out of scope for 3A (per sprint brief), carried forward:

- Batch / net / settlement windows (explicitly **not** intended direction)
- ACH, external RTGS, ISO 20022
- Third-party institution onboarding + public institution API + credentials
- Full webhook platform + management UI (Sprint 3B)
- Multi-currency FX, credit facilities, overdrafts
- Card-network settlement, PDF report export
- Production float / liquidity controls replacing the 1B FLR create-only seed

---

## 20. Readiness Recommendation

### Superseded by Sprint 3A.1

Sprint 3A originally closed as **CONDITIONAL GO**. Sprint **3A.1** closed the financial-hardening gaps (seed balance safety, adapter enforcement, transactional outbox, Terminal ownership constraints, compensation, TypeScript baseline restore, Discord test isolation).

See [NCC_SPRINT_3A1_REPORT.md](./NCC_SPRINT_3A1_REPORT.md) for the current readiness recommendation.