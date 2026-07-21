# NCC Sprint 4F — Staff Control Plane and Production Readiness

## Staff controls delivered

- Dedicated `NccStaffMembership` roles (Viewer → Emergency Administrator) with central permission mapping in `ncc-staff-permissions.ts`.
- `requireNccStaff(permission)` no longer treats every internal user as an institution owner; platform access alone does not grant NCC financial authority.
- Staff-management UI/API with self-escalation prevention and final-administrator protection.
- Control-plane sections on `/admin`: institutions, network, exceptions, returns, compensation, liquidity, documents, reconciliation, outbox/webhooks, risk, health/alerts, staff access.
- Institution restrict / suspend / resume / terminate, routing/account/credential/connector/webhook controls, atomic emergency suspension with dual-control resume of only snapshotted resources.
- Sensitive actions require reason + typed confirmation (`CONFIRM NCC ACTION`). Step-up/MFA is explicitly **unavailable** (`NCC_STEP_UP_MFA_AVAILABLE = false`) and reported as a readiness blocker.

## Return workflow

- Full-amount v1 `NccTransferReturn` lifecycle: REQUESTED → … → COMPLETED / FAILED / FUNDS_UNAVAILABLE / MANUAL_REVIEW.
- Institution/API request → staff review → receiving approval where required → second distinct staff execution approval → adapter debit recipient → new immutable NCC ledger instruction → adapter credit sender.
- Public `reverseInstruction` throws `LEDGER_ONLY_REVERSAL_DISABLED`; compensation uses `reverseNccLedgerPositionsForCompensation` only.
- Pending `NccSettlementReversalRequest` rows migrated into transfer returns.

## Worker and compensation wiring

- `vercel.json` schedules `/api/cron/ncc-settlement` every 2 minutes (`CRON_SECRET`).
- Database `NccWorkerLock` overlap protection, overdue detection/alerts, manual staff trigger, ops catalog entry.
- Worker runs retries, outbox, webhooks, reconciliation, credential expiry, pruning, **automatic compensation**, and expired-document compliance alerts — still individual RTGS, no batching/netting.
- Liquidity outbox handlers registered for `liquidity.requested|applied|rejected|low|insufficient`.

## Risk limits

- Per-institution policies: max transfer, daily amount/count, manual-review threshold, probation limits, emergency zero, effective dates, enable/disable.
- Evaluated before prepare/ledger; concurrency-safe daily usage; persisted `NccRiskDecision`; hard rejects; manual-review holds money movement; staff override with authority + reason.

## Regulatory / liquidity UI

- Staff liquidity request/approve/reject/freeze/threshold (requester ≠ approver enforced).
- Document review accept/reject/under-review; production fails closed without persistent blob storage (no in-memory fallback in production).
- Expired docs block LIVE promotion gates and raise CRITICAL compliance alerts.

## Production readiness check

- `getNccProductionReadiness()` reports blockers without secret values: DB, SESSION_SECRET, NCC_SECRETS_KEY, CRON_SECRET, private document storage, worker success, legacy floats, outbox handlers, uncertified connectors, missing docs, critical alerts, unsafe activation path, network mode, production seed, **STEP_UP_MFA_UNAVAILABLE**.
- Direct `approveInstitution` activation bypass removed — only application + documents + certification + LIVE promotion.

## Network settlement switch

- Persisted `NccNetworkControl` modes: `ACTIVE` / `PAUSE_NEW_SETTLEMENTS` / `EMERGENCY_STOP`.
- Enforced in `submitInstruction` (covers institution API, Bank website funding, Terminal withdrawal paths).
- Resume requires dual control; changes audited and alerted. Distinct from site maintenance mode.

## Test / typecheck / build results

| Check | Result |
|-------|--------|
| Focused 4F static (`ncc-staff-control-4f.test.ts`, `NCC_SETTLEMENT_TESTS=0`) | **10/10 pass** |
| `npm run typecheck` | **Within baseline (363/363)** |
| `npm run build` | **Pass** |
| `npm run test:ncc` | **Blocked by Neon compute quota** (`Your account or project has exceeded the compute time quota`). Static/non-DB cases still pass; DB integration suites could not run in this environment. Re-run when quota resets. |

## Remaining external or deployment blockers

1. Neon/DB compute quota must be restored to re-run the full NCC integration suite.
2. Bootstrap at least one `NccStaffMembership` (`ensureBootstrapNccAdministrator` when zero admins) — internal tags alone are insufficient.
3. Configure production secrets: `SESSION_SECRET`, `NCC_SECRETS_KEY`, `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN`.
4. Clear unexplained legacy 1B floats via dual-control liquidity ops.
5. Step-up/MFA not available in current identity system — treat as known RC blocker for high-risk actions.
6. External participant LIVE certification evidence remains outside this sprint.
7. Deploy Vercel cron for `/api/cron/ncc-settlement` and confirm worker last-success.

## GO / NO-GO

**Conditional GO for release-candidate engineering testing** of the staff control plane, network kill switch, return workflow, risk holds, worker scheduling, and readiness reporting — implementation is in place and static/typecheck/build verified.

**NO-GO for production signoff** until: full `test:ncc` passes after DB quota recovery, staff bootstrap + production secrets + private document storage are configured, legacy floats cleared, and MFA/step-up gap is accepted or remediated by ops.
