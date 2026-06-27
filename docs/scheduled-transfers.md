# Scheduled transfer automatic execution

Alta Capital Suite runs **approved intrabank (Alta-to-Alta) scheduled transfers** automatically when something calls the executor HTTP endpoint. The executor reuses the existing internal transfer service (`submitInternalTransfer`) — it does not rebuild the transfer system.

**Recommended scheduler:** [cron-job.org](https://cron-job.org) (free, supports intervals down to **once per minute**). Vercel native cron is optional and requires Pro for sub-daily schedules on most setups.

## Supported transfer types

- Personal scheduled transfers (`transferScope: INTRABANK`, status `APPROVED`)
- Business scheduled transfers (company operating account → Alta recipient)
- Recurring intrabank transfers (weekly, biweekly, monthly, quarterly)
- **Business payroll batches** (`PayrollRun` status `APPROVED`, pay date due)

Intrabank transfers and payroll batches are **auto-approved on creation**. Interbank scheduled transfers remain `PENDING_REVIEW` and are never executed automatically.

## Unsupported (never auto-executed)

- Withdrawals
- External wires / interbank scheduled transfers
- NCC transfers
- Deposit requests
- Any transfer requiring manual review

## How execution works

1. A scheduler (cron-job.org, manual operator, etc.) calls `GET /api/cron/scheduled-transfers`.
2. `executeDueScheduledTransfers()` finds due `ScheduledPayment` rows (intrabank, approved).
3. `executeDuePayrollRuns()` finds due `PayrollRun` rows (`status = APPROVED`, `payDate` due).
4. `accrueInterestForDueLoans()` then `executeDueLoanAutoPayments()` run loan interest accrual and auto-pay (in that order).
5. **Alta Card servicing** runs in parallel with the above:
   - `runAltaCardStatementSchedulerJob()` — no-ops except on the last calendar day of the month (UTC), then closes eligible statements.
   - `runAltaCardBillingSchedulerJob()` — marks overdue statements, applies late fees and interest.
6. **Bank account statements** — `runBankAccountStatementSchedulerJob()` no-ops except on the 1st of the month (UTC), then generates prior-month statements for eligible accounts.
7. **Deposit interest** — `runDepositInterestSchedulerJob()` accrues due monthly deposit account interest and applies any scheduled manual interest batches whose run time has passed.
8. For each due transfer or payroll line:
   - Creates a `ScheduledTransferExecution` row (`PENDING`) keyed by `(scheduledPaymentId, scheduledRunAt)`.
   - Validates source/destination accounts are `ACTIVE` and source has sufficient balance.
   - Executes via `submitInternalTransfer` using the original creator’s permissions.
   - Updates `lastRunAt`, `nextRunDate` (recurring), or marks one-time transfers `EXECUTED`.

## Idempotency

Each run is keyed by **`scheduledPaymentId + scheduledRunAt`** with a unique database constraint. If the endpoint runs twice for the same due window, the second run **skips** transfers that already have an execution record.

## Failure handling

| Condition | Behavior |
|-----------|----------|
| Insufficient funds | Execution `FAILED`; transfer stays `APPROVED` (recurring) or `FAILED` (one-time); friendly message stored |
| Frozen/closed source | Execution `FAILED`; no money moved |
| Missing/inactive destination | Execution `FAILED`; no money moved |
| 3 consecutive failures | Scheduled transfer status → `PAUSED` with message “Paused after repeated failures.” |

Recurring transfers advance `nextRunDate` even after a failure so the next cycle can retry.

## Scheduled date & time (Eastern)

Users pick a **date** and **time (Eastern)** when scheduling. The server stores the exact instant in UTC via `src/lib/scheduled-datetime.ts` (`America/New_York`).

- **One-time / scheduled:** runs at the chosen Eastern date and time.
- **Recurring:** first run at that date/time; later runs keep the same clock time (e.g. every month at 9:00 AM ET).
- **Default time** if omitted on API: 9:00 AM Eastern.
- **Actual execution** still depends on cron-job.org polling (within ~1–15 minutes after the due instant).

## Environment

Add to your server environment (never expose to the frontend):

```env
CRON_SECRET=your-long-random-secret
```

Generate with:

```bash
openssl rand -base64 32
```

Set the same value in **Vercel → Project → Environment Variables**.

## Cron endpoint

**URL:** `/api/cron/scheduled-transfers`  
**Methods:** `GET`, `POST`  
**Auth:** `Authorization: Bearer <CRON_SECRET>` or `?secret=<CRON_SECRET>`

**Response:**

```json
{
  "ok": true,
  "scheduledTransfers": {
    "dueCount": 2,
    "executedCount": 1,
    "failedCount": 1,
    "skippedCount": 0
  },
  "payroll": {
    "dueCount": 1,
    "executedCount": 1,
    "failedCount": 0,
    "skippedCount": 0
  },
  "loanServicing": { "...": "..." },
  "altaCard": {
    "statements": { "skipped": true, "skipReason": "Not the last calendar day of the month" },
    "billing": { "overdueStatementsMarked": 0, "interestApplied": 0, "lateFeesApplied": 0 }
  },
  "bankStatements": {
    "skipped": true,
    "skipReason": "Not statement day (first day of month)"
  }
}
```

**One cron for bank automation:** You do not need separate cron jobs for loans, Alta Card, or bank account statements in production. Point a single daily (or more frequent) scheduler at `/api/cron/scheduled-transfers` only.

Standalone endpoints (`/api/cron/loan-interest`, `/api/cron/alta-card-*`, `/api/cron/bank-statements`) remain available for isolated testing or split schedules, but are optional.

## cron-job.org setup (recommended)

[cron-job.org](https://cron-job.org) is **free** and allows each job to run **up to once per minute** (60 times per hour). That is more than enough for scheduled transfers.

### 1. Create an account

Sign up at [console.cron-job.org](https://console.cron-job.org).

### 2. Create a cron job

| Field | Value |
|-------|--------|
| **Title** | Alta scheduled transfers |
| **URL** | `https://YOUR_DOMAIN.vercel.app/api/cron/scheduled-transfers` |
| **Schedule** | Every **15 minutes** (or every minute if you want faster pickup) |
| **Request method** | `GET` or `POST` |
| **Enabled** | Yes |

### 3. Add authentication (required)

Under **Advanced** → **Request headers**, add:

| Header | Value |
|--------|--------|
| `Authorization` | `Bearer YOUR_CRON_SECRET` |

Use the same `CRON_SECRET` as in Vercel env vars. **Do not** put the secret only in the URL if you can use a header — headers are less likely to appear in access logs.

If your plan/UI cannot set headers, use:

```
https://YOUR_DOMAIN.vercel.app/api/cron/scheduled-transfers?secret=YOUR_CRON_SECRET
```

### 4. Test the job

Use **Run now** in the cron-job.org console. Expect HTTP **200** and JSON with `ok: true`.

Check **Execution history** — failed runs show status codes and response bodies.

### 5. Limits (free tier)

- **Minimum interval:** once per minute per job
- **Request timeout:** 30 seconds (plenty for typical transfer batches)
- **Fair use:** unlimited jobs per account under normal use

### Example schedule choices

| Goal | cron-job.org setting |
|------|----------------------|
| Check every 15 minutes | Every 15 minutes |
| Check every 5 minutes | Custom / every 5 minutes (if UI allows; still under 60/hour) |
| Maximum responsiveness | Every 1 minute |

## Vercel Cron (optional alternative)

`vercel.json` in this repo **does not** include Vercel Cron — it blocked Hobby-plan deploys when using sub-daily schedules.

If you upgrade to **Vercel Pro**, you can add native cron instead of cron-job.org:

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

Vercel sends `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set in project env.

## Manual testing (before enabling cron-job.org)

1. Internal → **Bank Operations** → **Run Due Scheduled Transfers**, or open **/internal/bank/scheduled**.
2. Create an intrabank scheduled transfer due now (personal or business).
3. Run the manual executor; verify balances change once.
4. Run again; verify **no duplicate** transfer (skipped via idempotency).
5. Test insufficient funds → friendly failure message, no balance change.
6. Test frozen source account → failed execution, no balance change.
7. Trigger 3 consecutive failures → transfer status `PAUSED`.
8. Configure cron-job.org and use **Run now**; confirm the same behavior.

## Key files

| File | Purpose |
|------|---------|
| `src/server/scheduled-transfer-executor.service.ts` | Scheduled transfer executor |
| `src/server/payroll-executor.service.ts` | Payroll batch executor |
| `src/lib/bank/scheduled-transfer-executor.ts` | Public export |
| `src/lib/bank/payroll-executor.ts` | Public export |
| `src/routes/api/cron/scheduled-transfers.ts` | HTTP endpoint (cron-job.org hits this) |
| `src/server/scheduled-transfer-admin.service.ts` | Internal admin actions |
| `prisma/schema.prisma` | `ScheduledTransferExecution` model |
