# NCC Sprint 4E — Liquidity and Operational Hardening

## Liquidity changes

- New settlement accounts (including Alta seed creates) start at `0.00` / `0.00`. Create-time 1B FLR float removed.
- Dual-control `NccLiquidityOperation` workflow: funding, withdrawal, authorized correction, opening-balance authorization.
- Lifecycle: `PENDING_APPROVAL` → `APPROVED`/`APPLIED` / `REJECTED` / `CANCELLED` / `FAILED`.
- Requester cannot approve own operation; application is atomic with `FOR UPDATE` on the settlement account; withdrawals cannot overdraw; direct `adjustSettlementAccount` disabled.
- Per-account low-liquidity threshold, freeze/unfreeze, portal liquidity view, insufficient/low-liquidity alerts via audit + outbox.

## Treatment of legacy float

- Exact `1,000,000,000.00` create-time balances are marked `REQUIRES_REVIEW` without altering balances.
- Clear via opening-balance authorization or authorized correction (dual control).
- Unexplained legacy float count is surfaced in NCC health; production signoff should remain blocked while any remain.

## Regulatory document controls

- Private `NccParticipantDocument` upload with magic-byte sniffing, size/type limits, safe storage keys, `PENDING_SCAN` (no fake malware scan).
- Staff safe-review → accept/reject; replacement versioning; expiration checks.
- LIVE promotion requires all mandatory documents accepted and unexpired.

## Cancellation and compensation behavior

- Cancel allowed only before irrevocable NCC ledger posting; releases prepared source holds idempotently; portal/API share `isInstructionCancelable`.
- Post-ledger / source-commit / destination-credit stages reject cancel (not labeled as reversal/compensation).
- Automatic compensation only for confirmed destination failures on an allowlist; ambiguous/timeout statuses escalate to manual review; connector outage never returns fake success.

## Reconciliation and operational controls

- Reconciliation distinguishes missing, duplicate, mismatched, stale, and compensated outcomes; never moves money; resolution preserves original findings; re-run is idempotent.
- Health metrics extended with settlement latency, retry/manual/compensation backlogs, recon mismatches, outbox/webhook backlog, connector health, liquidity threshold status, expired docs, unexplained legacy floats.

## Test / typecheck / build results

| Check | Result |
|-------|--------|
| Focused 4E (`ncc-liquidity-ops-4e.test.ts`) | **19/19 pass** |
| `npm run test:ncc` | **144/144 pass** |
| `npm run typecheck` | **Within baseline (363/363)** |
| `npm run build` | **Pass** |

## Remaining release-candidate blockers

- Clear remaining `REQUIRES_REVIEW` legacy 1B floats in shared environments via dual-control liquidity ops.
- Staff ops UI for liquidity request/approve and document review is service-ready but still thin in the NCC admin surface.
- Production malware scanning not available — `PENDING_SCAN` + manual safe-review required until infrastructure exists.
- External participant certification evidence and LIVE connector production readiness remain outside this sprint.

## GO / NO-GO

**Conditional GO for v1 RC engineering freeze** on NCC liquidity/ops controls: core dual-control liquidity, cancel boundaries, auto-compensation rules, document LIVE gates, reconciliation/health hardening, and Bank↔Terminal instant settlement are verified.

**NO-GO for production signoff** until unexplained legacy floats are authorized/corrected and remaining operational UI/runbook items above are accepted by ops.
