# Scheduled transfer automatic execution

Alta Capital Suite runs **approved intrabank (Alta-to-Alta) scheduled transfers** automatically via a cron job. The executor reuses the existing internal transfer service (`submitInternalTransfer`) — it does not rebuild the transfer system.

## Supported transfer types

- Personal scheduled transfers (`transferScope: INTRABANK`, status `APPROVED`)
- Business scheduled transfers (company operating account → Alta recipient)
- Recurring intrabank transfers (weekly, biweekly, monthly, quarterly)

Intrabank transfers are **auto-approved on creation**. Interbank scheduled transfers remain `PENDING_REVIEW` and are never executed by the cron job.

## Unsupported (never auto-executed)

- Withdrawals
- External wires / interbank scheduled transfers
- NCC transfers
- Deposit requests
- Payroll runs (separate review queue)
- Any transfer requiring manual review

## How execution works

1. Cron (or internal operator) calls `GET /api/cron/scheduled-transfers`.
2. `executeDueScheduledTransfers()` finds `ScheduledPayment` rows where:
   - `transferScope = INTRABANK`
   - `status = APPROVED`
   - `nextRunDate` or `scheduledDate` is due (≤ now)
3. For each due transfer:
   - Creates a `ScheduledTransferExecution` row (`PENDING`) keyed by `(scheduledPaymentId, scheduledRunAt)`.
   - Validates source/destination accounts are `ACTIVE` and source has sufficient balance.
   - Executes via `submitInternalTransfer` using the original creator’s permissions.
   - Updates `lastRunAt`, `nextRunDate` (recurring), or marks one-time transfers `EXECUTED`.

## Idempotency

Each run is keyed by **`scheduledPaymentId + scheduledRunAt`** with a unique database constraint. If the cron endpoint runs twice for the same due window, the second run **skips** transfers that already have an execution record.

## Failure handling

| Condition | Behavior |
|-----------|----------|
| Insufficient funds | Execution `FAILED`; transfer stays `APPROVED` (recurring) or `FAILED` (one-time); friendly message stored |
| Frozen/closed source | Execution `FAILED`; no money moved |
| Missing/inactive destination | Execution `FAILED`; no money moved |
| 3 consecutive failures | Scheduled transfer status → `PAUSED` with message “Paused after repeated failures.” |

Recurring transfers advance `nextRunDate` even after a failure so the next cycle can retry.

## Environment

Add to your server environment (never expose to the frontend):

```env
CRON_SECRET=your-long-random-secret
```

Generate with:

```bash
openssl rand -base64 32
```

## Cron endpoint

**URL:** `/api/cron/scheduled-transfers`  
**Methods:** `GET`, `POST`  
**Auth:** `Authorization: Bearer <CRON_SECRET>` or `?secret=<CRON_SECRET>`

**Response:**

```json
{
  "ok": true,
  "dueCount": 2,
  "executedCount": 1,
  "failedCount": 1,
  "skippedCount": 0
}
```

## Vercel Cron setup

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/scheduled-transfers",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

Set `CRON_SECRET` in the Vercel project environment. Vercel Cron sends requests without a custom header by default — use the query parameter in the cron path if needed:

```json
{
  "path": "/api/cron/scheduled-transfers?secret=YOUR_CRON_SECRET",
  "schedule": "*/15 * * * *"
}
```

Prefer configuring Vercel to send `Authorization: Bearer …` when available.

## Manual testing (before enabling Vercel Cron)

1. Internal → **Bank Operations** → **Run Due Scheduled Transfers**, or open **/internal/bank/scheduled**.
2. Create an intrabank scheduled transfer due now (personal or business).
3. Run the manual executor; verify balances change once.
4. Run again; verify **no duplicate** transfer (skipped via idempotency).
5. Test insufficient funds → friendly failure message, no balance change.
6. Test frozen source account → failed execution, no balance change.
7. Trigger 3 consecutive failures → transfer status `PAUSED`.

## Key files

| File | Purpose |
|------|---------|
| `src/server/scheduled-transfer-executor.service.ts` | Core executor |
| `src/lib/bank/scheduled-transfer-executor.ts` | Public export |
| `src/routes/api/cron/scheduled-transfers.ts` | Cron HTTP endpoint |
| `src/server/scheduled-transfer-admin.service.ts` | Internal admin actions |
| `prisma/schema.prisma` | `ScheduledTransferExecution` model |
