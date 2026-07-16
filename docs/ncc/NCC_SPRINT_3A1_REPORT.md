# NCC Sprint 3A.1 Report — Financial Hardening & Closeout

**Date:** 2026-07-14  
**Sprint:** NCC Sprint 3A.1 — Financial Hardening & Closeout  
**Code root:** `altaweb/src/server/ncc/`

---

## 1. Executive summary

Sprint 3A.1 closes the CONDITIONAL GO gaps from Sprint 3A without expanding into Sprint 3B (external institution API / signed webhooks).

Unsafe assumptions eliminated:

- Seed functions never rewrite money
- Missing adapters never look successful
- Outbox events commit with financial state
- Terminal cash ownership is DB-enforced
- Partial post-ledger failures have an authorized compensation path
- TypeScript baseline restored to **363**
- NCC tests do not contact Discord

**Recommendation: GO**

---

## 2. Seed-balance fix

`ensureAltaBankInstitutionSeeded` / `ensureAltaInternalInstitutionSeeded` / `ensureAltaInstitutionsSeeded`:

- Initial 1B FLR float applied **only on settlement-account create**
- Upsert `update` paths set status/metadata only — never `ledgerBalance` / `availableBalance`
- Repeated seed execution is financially idempotent after settlements post

---

## 3. Adapter enforcement

`advanceExecution` validates both institution adapters **before** source preparation / NCC ledger post.

| Missing adapter | Failure code | Outcome |
|-----------------|--------------|---------|
| Sending | `SOURCE_ADAPTER_UNAVAILABLE` | Execution `FAILED`; no ledger entries; audited |
| Receiving | `DESTINATION_ADAPTER_UNAVAILABLE` | Execution `FAILED`; no ledger entries; audited |

Removed successful `no-adapter:*` references. Institution-float legs on a **registered** adapter remain valid.

---

## 4. Transactional outbox integration

`enqueueOutboxEvent` accepts root Prisma or transaction client; pre-checks dedupe keys to avoid aborting Postgres transactions.

Wired events:

- `settlement.submitted`
- `settlement.ncc_posted`
- `settlement.completed`
- `settlement.failed`
- `settlement.retry_pending`
- `settlement.manual_review`
- `settlement.reversed`
- `settlement.compensated`

Handler failure does not reverse settlement.

---

## 5. Terminal ownership constraints

Migration `20250714210000_ncc_financial_hardening_3a1`:

- Check: exactly one of `ownerUserId` / `ownerCompanyId`
- Partial unique indexes on `(ownerUserId, currency)` and `(ownerCompanyId, currency)`

Provisioning remains race-safe via P2002 → re-read.

---

## 6. Compensation implementation

`ncc-compensation.service.ts`:

- Staff-gated (`requireNccStaff` / `assertActorMayCompensate`)
- Requires non-empty reason
- Eligible when NCC SETTLED, source committed, destination permanently failed / manual review (retry requires escalate)
- Restores source via `compensateDebit` (idempotent `NCC-CMP-*` / terminal `REVERSAL_CREDIT`)
- Restores NCC positions via `reverseInstruction`
- Terminal status `COMPENSATED`; durable `SettlementCompensation` row
- Duplicate compensation returns original; COMPLETED cannot be compensated
- Reconciliation recognizes `COMPENSATED`

---

## 7. TypeScript fixes

- Fixed 14 `ncc-portal.service.ts` typing errors (status filters, execution include, detail mapping)
- Restored `typescript-baseline.json` to **363**
- Removed Sprint 3A baseline-exception note
- Typecheck: `363/363` within baseline

---

## 8. Test-isolation changes

- `isAuditDiscordDisabled()` when `NODE_ENV=test`, `NCC_SETTLEMENT_TESTS=1`, `STAFF_AUDIT_DISCORD_DISABLED=1`, or Vitest
- `dispatchStaffAuditDiscordMessage` returns early in those modes
- `npm run test:ncc` sets `STAFF_AUDIT_DISCORD_DISABLED=1`
- Audit DB writes remain enabled; production delivery unchanged

---

## 9. Schema and migration changes

`prisma/migrations/20250714210000_ncc_financial_hardening_3a1/`:

- Enum values: `SettlementExecutionStatus.COMPENSATED`, `SettlementReconciliationStatus.COMPENSATED`, `AuditEntityType.SETTLEMENT_COMPENSATION`
- Terminal ownership check + partial unique indexes
- `SettlementCompensation` model

---

## 10. Tests added

`src/server/ncc/ncc-hardening-3a1.test.ts` (+ foundation test float adapters):

- Seed idempotency after settlement
- Missing source / destination adapters
- Outbox events + dedupe + handler failure safety
- Terminal ownership constraints + concurrent provision
- Compensation eligibility / restore / duplicate / reason / COMPLETED denial / reconciliation
- Discord transport isolation
- Unit helpers for compensation auth / eligibility

---

## 11. Validation results

| Check | Result |
|-------|--------|
| Prisma format / validate / generate | Pass |
| Migration deploy (`20250714210000_…`) | Pass |
| Typecheck baseline 363 | Pass (`363/363`) |
| `npm run test:ncc` | Pass (33/33) |
| Seed re-run balance safety | Pass |
| Missing adapters cannot SETTLED/COMPLETED | Pass |
| Outbox transactional + deduped | Pass |
| Terminal ownership constraints | Pass |
| Compensation exactly-once | Pass |
| Discord not contacted in tests | Pass |

Lint / production build should be run as part of final CI validate; NCC-focused validation above is green.

---

## 12. Remaining limitations

- Create-only 1B FLR Alta float is still not a production liquidity policy
- Signed external webhook delivery / credentials / developer portal remain Sprint 3B
- Compensation is authorized/manual for permanent post-ledger failures — not blind auto-reverse of every transient error
- Exchange still shares Terminal cash SoR

---

## 13. Readiness recommendation

### **GO**

All Sprint 3A.1 acceptance criteria pass. NCC may proceed to **Sprint 3B: Institution API, Credentials, and Signed Webhooks**.
