# Alta Card

Alta Card is Alta Bank's **intrabank revolving credit line** — separate from term lending facilities. V1 supports Alta Pay funding, internal cash advances, statement billing, relationship pricing, and secure review threads with Alta Credit Desk. Card artwork is display-only; there is no merchant network, physical card, or POS authorization in V1.

## Products

| Product | Scope | Rules |
|---------|-------|-------|
| **Personal Alta Card** | One card per user | At most one active personal card (`ACTIVE`, `FROZEN`, `LOST`, `DELINQUENT`) |
| **Business Alta Card** | One line per company | Treasury managers apply; company must be verified |
| **Employee cards** | Authorized spend against company line | Individual spend limit; cannot exceed company available credit |

## Tiers

Order: **White** < **Navy** < **Black** < **Gold**

| Tier | Default limit | Default APR | Notes |
|------|---------------|-------------|-------|
| Alta White | ƒ5,000 | 24.99% | Entry tier |
| Alta Navy | ƒ15,000 | 19.99% | |
| Alta Black | ƒ50,000 | 15.99% | |
| Alta Gold | Negotiable | Negotiable | Alta Private only (`private_client` tag) |

Admins may override tier, limit, and rate on approval or after issuance.

### Tier config (`src/lib/bank/alta-card-tier-config.ts`)

Centralized defaults — **recommendation only**. Approved limit and rate are stored on `AltaCard`.

| Tier | Role | Default limit | Default APR |
|------|------|---------------|-------------|
| Alta White | Entry | ƒ5,000 | 24.99% |
| Alta Navy | Standard | ƒ15,000 | 19.99% |
| Alta Black | Premium public | ƒ50,000 | 15.99% |
| Alta Gold | Private banking | Negotiable | Negotiable |

Gold is `private_client` only unless admin override. Changing tier does not change limit/rate unless admin selects **Apply tier defaults**.

## Relationship pricing

`src/server/alta-card-relationship-pricing.service.ts`

`getAltaCardRelationshipRecommendation(userId, companyId?)` returns:

- `recommendedTier`, `recommendedCreditLimit`, `recommendedInterestRate`
- `relationshipScore` (0–100)
- `relationshipFactors` (bank balances, deposit activity, loan history, company verification, private client, account age, etc.)

**Recommendation only** — never auto-approves applications. Shown on internal card detail and application review. Audit: `ALTA_CARD_RELATIONSHIP_RECOMMENDATION_VIEWED`.

TODO: Alta Pay volume when centralized analytics are available.

## Admin controls

`src/server/alta-card-admin.service.ts` · `src/lib/bank/alta-card-admin.functions.ts`

Internal card operations page: `/internal/alta-card/$cardId`

### Status transitions

| From | Allowed to |
|------|------------|
| `PENDING` | `ACTIVE` |
| `ACTIVE` | `FROZEN`, `LOST`, `CLOSED`, `DELINQUENT` |
| `FROZEN` | `ACTIVE` |
| `DELINQUENT` | `ACTIVE` |
| `LOST` | `CLOSED` |
| `CLOSED` | `ACTIVE` (admin override only) |

Spending allowed when `status = ACTIVE`. Payments allowed when `ACTIVE`, `FROZEN`, or `DELINQUENT`.

Every admin action requires **reason** and writes an audit event (`ALTA_CARD_STATUS_CHANGED`, etc.).

### Limit changes

- Increase or decrease credit limit
- New limit must be ≥ `currentBalance` unless admin override + reason
- Updates `availableCredit`; audits `previousLimit` / `newLimit`

### Rate changes

- Rate ≥ 0; Gold may be custom
- UI shows tier default vs current rate
- Audits `previousRate` / `newRate`

### Payments & fees

- **Manual payment** (`ALTA_CARD_MANUAL_PAYMENT`): posts `PAYMENT` transaction without bank withdrawal
- **Apply fee** (`ALTA_CARD_FEE_APPLIED`): manual fee via `AltaCardFee` + `FEE` transaction
- **Admin adjustment** (`ALTA_CARD_ADMIN_ADJUSTMENT`): credit/debit — never updates balance without a transaction

### Employee card admin (business cards)

Admins can create employee cards, update limits, freeze/unfreeze, close, and view employee transactions.

Business owners (`OWNER` / `EXECUTIVE` / `FINANCE_MANAGER`) can create employee cards, set limits, freeze/unfreeze, close, and view transactions — but **cannot** change company limit, rate, tier, waive fees, or admin-adjust balance.

Employee limit cannot exceed company `availableCredit`. Employee spend rolls up to parent business card.

## Data model

### Enums

- `AltaCardType`: `PERSONAL`, `BUSINESS`, `EMPLOYEE` (employee records use `AltaEmployeeCard`)
- `AltaCardTier`: `WHITE`, `NAVY`, `BLACK`, `GOLD`
- `AltaCardStatus`: `PENDING`, `ACTIVE`, `FROZEN`, `LOST`, `EXPIRED`, `CLOSED`, `DELINQUENT`
- `AltaCardApplicationStatus`: `SUBMITTED`, `UNDER_REVIEW`, `NEEDS_INFO`, `APPROVED`, `DENIED`, `CANCELLED`

### `AltaCardApplication`

Application queue before a card is issued. Creates an application thread on submit. Approval stores terms; card is created when the applicant accepts (or immediately if admin chooses **approve and activate**).

Key fields: `requestedTier`, `requestedLimit`, `purpose`, `approvedTier`, `approvedLimit`, `approvedInterestRate`, `billingCycleDay`, `paymentSourceAccountId`, `goldOverride`, `acceptedAt`.

Rules:

- One open personal application per user (`SUBMITTED`, `UNDER_REVIEW`, `NEEDS_INFO`)
- One active personal card per user
- Business applications require treasury role (`OWNER` / `EXECUTIVE` / `FINANCE_MANAGER`)
- One open business application per company
- One active business line per company

### `AltaCardApplicationThread` / `AltaCardApplicationThreadMessage`

Simplified messaging thread (mirrors loan application thread pattern):

- Applicant, Alta staff, and system messages
- Attachments via JSON (`FILE`, `IMAGE`, `LINK`) and file upload API
- Full-screen thread routes matching loan deal room UX
- No offers, contracts, or e-sign

Thread routes:

| Audience | Personal | Business |
|----------|----------|----------|
| Applicant | `/bank/alta-card/applications/$applicationId/thread` | `/bank/alta-card/business/applications/$applicationId/thread` |
| Internal | `/internal/alta-card/applications/$applicationId/thread` | same |

Attachment upload: `POST /api/alta-card-threads/$applicationId/attachments`

### `AltaCard`

Primary revolving credit account for personal and business cards.

Key fields: `ownerUserId`, `companyId`, `tier`, `cardType`, `status`, `creditLimit`, `availableCredit`, `currentBalance`, `statementBalance`, `minimumPaymentDue`, `interestRate`, `billingCycleDay`, `dueDate`, `openedAt`, `closedAt`.

### `AltaEmployeeCard`

Employee authorized cards: `companyId`, `authorizedUserId`, `parentBusinessCardId`, `employeeSpendLimit`, `employeeAvailableLimit`, `employeeCurrentBalance`, `status`.

### `AltaCardTransaction`

Ledger of all balance-changing card activity.

| Field | Purpose |
|-------|---------|
| `altaCardId` | Parent personal or business card |
| `altaEmployeeCardId` | Set when an employee card spends |
| `type` | `PURCHASE`, `ALTA_PAY`, `CASH_ADVANCE`, `PAYMENT`, `INTEREST`, `FEE`, `ADJUSTMENT_CREDIT`, `ADJUSTMENT_DEBIT`, `REVERSAL` |
| `status` | `PENDING`, `COMPLETED`, `FAILED`, `REVERSED` |
| `relatedBankTransactionId` | Linked bank deposit/withdrawal |
| `relatedAltaPayPaymentId` | Alta Pay reference (`PAY-YYYYMMDD-XXX`) |
| `merchantCompanyId` | Payee company for Alta Pay / purchases |

## Application workflow

### Personal (`/bank/alta-card/apply`)

User selects tier, optional limit, intended use, optional payment source, acknowledgement → `SUBMITTED` application + thread.

### Business (`/bank/alta-card/business/apply`)

Treasury managers submit company application with expected spend and employee card needs.

### Approval & activation

- Admin approves tier, limit, rate, billing cycle day
- Applicant **Accept card** creates active card (unless admin used approve-and-activate)
- Gold requires admin; non–private Gold requires override audit

Routes: `/bank/alta-card/applications/$applicationId`, `/bank/alta-card/applications/$applicationId/thread`, `/internal/alta-card/applications/$applicationId`, `/internal/alta-card/applications/$applicationId/thread`

## Transaction service

`src/server/alta-card-transaction.service.ts`

| Function | Purpose |
|----------|---------|
| `chargeAltaCardInTransaction` | Atomic charge + transaction record (internal) |
| `chargeAltaCardForAltaPay` | Alta Pay funding from personal or employee card |
| `submitCashAdvance` | Card → checking deposit |
| `submitCardPayment` | Checking → card balance reduction |
| `createAdminAltaCardAdjustment` | Operator credit/debit adjustment |
| `reverseAltaCardTransaction` | Reverse completed transaction |
| `listAltaCardTransactions` | Card history |
| `listEmployeeCardTransactions` | Employee drill-down history |
| `listAltaCardFundingSources` | Alta Pay funding source list |

### Balance rules

All charges (purchase, Alta Pay, cash advance, admin debit):

- `currentBalance` increases
- `availableCredit` = `creditLimit - currentBalance`

Payments and admin credits reverse the effect. Employee spends also update `employeeCurrentBalance` and `employeeAvailableLimit` on `AltaEmployeeCard`.

Guards:

- `currentBalance` never below 0
- `availableCredit` never above `creditLimit`
- Charges blocked when card is not `ACTIVE` (admin override for adjustments)
- Payments allowed when `ACTIVE`, `FROZEN`, or `DELINQUENT`
- Employee spend cannot exceed employee limit or parent available credit

### Alta Pay funding source

At `/bank/pay`, users select **bank account** or **Alta Card •••• XXXX** (personal or employee card).

**Bank account:** existing paired `PAY-*-OUT` / `PAY-*-IN` bank transactions.

**Alta Card:**

1. Merchant receives `PAY-*-IN` deposit to Business Operating Account
2. Card `currentBalance` increases; `availableCredit` decreases
3. `AltaCardTransaction` type `ALTA_PAY` created with `relatedAltaPayPaymentId`
4. Receipt shows funding source label
5. Audit: `ALTA_CARD_ALTA_PAY_CHARGED`

Employee card Alta Pay charges the parent business line and records the authorized user as spender.

### Cash advance

On `/bank/alta-card/$cardId`:

1. User selects destination personal checking account and amount (confirmation required)
2. Card balance increases; available credit decreases
3. `AltaCardTransaction` type `CASH_ADVANCE`
4. `BankTransaction` deposit on destination account
5. Audit: `ALTA_CARD_CASH_ADVANCE_CREATED`

### Card payment

1. User selects source checking account and amount (minimum / statement / current / custom)
2. Payment capped at `currentBalance`
3. Source account debited via `BankTransaction` withdrawal
4. Card balance decreases; available credit increases
5. `AltaCardTransaction` type `PAYMENT`
6. Payment allocated to oldest unpaid statement first (`ISSUED`, `PARTIALLY_PAID`, `OVERDUE`)
7. Audit: `ALTA_CARD_PAYMENT_MADE`, `ALTA_CARD_STATEMENT_PAID` when a statement is paid in full

## Billing cycle & statements

`src/server/alta-card-statement.service.ts` · `src/lib/bank/alta-card-minimum-payment.ts` · `src/lib/bank/alta-card-billing-cycle.ts`

### Alta Card Billing Policy (V1)

| Rule | Value |
|------|-------|
| Statement close | Last day of every calendar month |
| Statement generation | Immediately when the monthly period closes (cron or admin) |
| Payment due | 15 days after statement close |
| Minimum payment | Greater of 5% of **statement balance** or ƒ100, capped at statement balance |
| Interest | Only if statement balance is not fully paid by the due date |

**Current balance vs statement balance**

- **Current balance** — total card balance including purchases in the open billing cycle.
- **Statement balance** — amount owed from closed statement(s), excluding new-cycle activity.
- **Minimum payment** — calculated from the oldest unpaid statement’s `statementBalance` (not `currentBalance`).

Example: June 30 statement closes at ƒ5,000. User spends ƒ2,000 on July 2.

| Field | Value |
|-------|-------|
| Current balance | ƒ7,000 |
| Statement balance | ƒ5,000 |
| Minimum payment | ƒ250 |
| Payment due | July 15 |

New purchases after the statement date appear on the next statement.

**Minimum payment examples** (from `calculateAltaCardMinimumPayment`):

| Statement balance | Minimum payment |
|-------------------|-----------------|
| ƒ80 | ƒ80 |
| ƒ400 | ƒ100 |
| ƒ5,000 | ƒ250 |
| ƒ20,000 | ƒ1,000 |

### Card billing fields

- `currentBillingCycleStart` / `currentBillingCycleEnd`
- `currentStatementId` (OPEN cycle accumulator)
- `lastStatementDate`, `nextStatementDate`, `paymentDueDate`
- `statementBalance`, `minimumPaymentDue` (synced from unpaid statements)

### `AltaCardStatement`

Monthly statement with period totals, minimum payment, amount paid, and status.

Statuses: `OPEN` → `ISSUED` → `PAID` / `PARTIALLY_PAID` / `OVERDUE` / `VOID`

Transactions are linked to a statement via `altaCardStatementId` when the cycle closes. New spending after close belongs to the next OPEN cycle.

### Statement generation (`generateStatement`)

1. Aggregate `AltaCardTransaction` rows in `[billingPeriodStart, billingPeriodEnd]` (inclusive) with no statement link
2. Compute previous balance from prior unpaid statement remainder
3. Calculate purchases, payments, adjustments, interest, fees
4. `endingBalance` = previous + activity; `statementBalance` = max(0, ending)
5. `minimumPayment` = `calculateAltaCardMinimumPayment(statementBalance)`
6. `statementDate` = `billingPeriodEnd`; `dueDate` = `getAltaCardDueDate(billingPeriodEnd)`
7. Issue statement (`ISSUED`), tag transactions, advance to next OPEN cycle (next month)
8. Audit: `ALTA_CARD_STATEMENT_GENERATED`

Billing cycle helpers (`src/lib/bank/alta-card-billing-cycle.ts`):

- `getStatementCloseDate(date)` — last day of that month
- `getAltaCardDueDate(statementCloseDate)` — close + 15 days
- `getInitialBillingCycle(anchorDate)` — first cycle for a new card
- `getNextBillingCycle(previousCycleEnd)` — day after close through last day of next month

### Minimum payment (V1)

```typescript
// src/lib/bank/alta-card-minimum-payment.ts
calculateAltaCardMinimumPayment(statementBalance)
// max(5% × statementBalance, ƒ100), capped at statementBalance; 0 if balance ≤ 0
```

### Payment allocation

Payments apply to the **oldest unpaid statement first**. Within each statement, payment priority is:

1. Fees
2. Interest
3. Principal / statement balance

Updates `amountPaid`, `feesPaid`, `interestPaid`, `principalPaid`, `remainingBalance`, and status (`PAID` / `PARTIALLY_PAID`). Sets `paidAt` when fully paid. Card `statementBalance` and `minimumPaymentDue` resync from unpaid statements.

## Interest & fees

`src/server/alta-card-interest.service.ts` · `src/server/alta-card-fee.service.ts` · `src/lib/bank/alta-card-fee-config.ts`

### Interest rules (V1)

- Interest applies only when a statement is **not fully paid by the due date**
- Pay the full statement balance by `dueDate` → **no interest**
- After due date with unpaid `remainingBalance` → monthly interest on the unpaid balance
- Formula: `unpaidBalance × (APR / 100) / 12` — `interestRate` on `AltaCard` is stored as APR percent
- One interest charge per statement per billing period (`interestAppliedAt` prevents duplicates)
- Creates `AltaCardTransaction` type `INTEREST`; increases `currentBalance`, decreases `availableCredit`

### Tier default rates (starting values on approval)

| Tier | Default APR |
|------|-------------|
| Alta White | 24.99% (highest) |
| Alta Navy | 19.99% |
| Alta Black | 15.99% |
| Alta Gold | Manual / negotiable (private banking) |

Admins can override via `updateAltaCardRate`. Audit: `ALTA_CARD_RATE_CHANGED`.

### Grace period

15-day payment window from statement close to `dueDate`. Pay the full statement balance by due date to avoid interest. No daily accrual in V1.

### Overdue behavior

When `dueDate` passes with unpaid balance:

1. Status → `OVERDUE` (`overdueAt` set)
2. Late fee charged once per statement (ƒ100 default)
3. Monthly interest applied when billing processor runs

### Late fees

- `AltaCardFee` type `LATE_PAYMENT`, default ƒ100 (`ALTA_CARD_LATE_FEE_AMOUNT`)
- Charged once per overdue statement; creates `FEE` transaction
- Admins can waive → adjustment credit + `ALTA_CARD_FEE_WAIVED`
- Cash advance fee default ƒ0 (`ALTA_CARD_CASH_ADVANCE_FEE_AMOUNT`) — hook for future pricing

### `AltaCardFee` model

Tracks fee lifecycle: `ACTIVE` → `PAID` / `WAIVED`. Linked to statement and transaction.

### Billing processor

`processAltaCardBilling()` in `src/server/alta-card-billing.service.ts`:

1. `runAutopayForDueStatements()` — attempt automatic card payments on due dates
2. `markOverdueStatements()`
3. `applyLateFeesForDueStatements()`
4. `applyInterestForDueStatements()`

Autopay runs **before** overdue marking so a successful payment on the due date prevents late fees and interest on that cycle.

Schedulers invoke this via `runAltaCardBillingSchedulerJob()` — see **Billing Scheduler** below.

## Autopay

Service: `src/server/alta-card-autopay.service.ts`

Cardholders (personal) or company treasury managers (business) can enable automatic statement payments from an Alta Bank account.

### Settings (on `AltaCard`)

| Field | Purpose |
|-------|---------|
| `autopayEnabled` | Master switch |
| `autopaySourceAccountId` | Debit account |
| `autopayType` | `MINIMUM_PAYMENT`, `STATEMENT_BALANCE`, or `FIXED_AMOUNT` |
| `autopayFixedAmount` | Required when type is `FIXED_AMOUNT` |
| `autopayLastRunAt` / `autopayLastStatus` / `autopayFailureReason` | Last run tracking |

Employee cards inherit autopay from the parent business card (read-only in UI).

### Payment types

- **Minimum payment** — remaining minimum due on the oldest unpaid statement (5% or ƒ100 rule, capped at remaining balance). Skips when minimum is already satisfied.
- **Statement balance** — remaining balance on the oldest unpaid statement.
- **Fixed amount** — configured fixed amount, capped at remaining statement balance.

Amount calculation: `calculateAltaCardAutopayAmount(cardId, statementId)`.

Autopay never partially pays when funds are insufficient (V1). The run fails and records a failure reason.

### Source account rules

| Card type | Source account |
|-----------|----------------|
| Personal | Active personal Alta account owned by cardholder |
| Business | Active `BUSINESS_OPERATING` account for the company |

Closed, frozen, or withdrawal-restricted accounts are rejected.

### Scheduler behavior

Daily billing cron calls `runAutopayForDueStatements()` first. For each enabled card with a due unpaid statement:

1. Calculate autopay amount
2. Verify source balance
3. Execute payment via `submitCardAutopayPayment()` (same ledger path as manual payments)
4. Update autopay run status on the card

Idempotency: one autopay attempt per card/statement per UTC day (audit-log keyed).

### Failure handling

Common failure reasons: missing/inactive source account, insufficient funds, invalid settings, card not active, statement already paid, payment service error. Failures are shown in user and internal admin UI via `autopayFailureReason`.

### Admin controls

Route: `/internal/alta-card/$cardId` — view/override settings, manual run with required reason, autopay audit history.

### Autopay audit events

| Action | When |
|--------|------|
| `ALTA_CARD_AUTOPAY_ENABLED` | Autopay turned on |
| `ALTA_CARD_AUTOPAY_DISABLED` | Autopay turned off |
| `ALTA_CARD_AUTOPAY_SETTINGS_UPDATED` | Settings changed |
| `ALTA_CARD_AUTOPAY_RUN` | Run started (cron or manual) |
| `ALTA_CARD_AUTOPAY_SUCCESS` | Payment posted |
| `ALTA_CARD_AUTOPAY_FAILED` | Run failed |
| `ALTA_CARD_AUTOPAY_SKIPPED` | No payment due or not yet due |

### Notifications (TODO)

- Autopay success notification
- Autopay failed notification
- Payment due reminder

Internal admin: preview interest, apply manually per statement, run billing batch, waive fees.

### Interest & fee audit events

| Action | When |
|--------|------|
| `ALTA_CARD_INTEREST_APPLIED` | Interest posted to a statement |
| `ALTA_CARD_INTEREST_BATCH_APPLIED` | Batch interest run |
| `ALTA_CARD_FEE_CHARGED` | Fee posted (e.g. late payment) |
| `ALTA_CARD_FEE_WAIVED` | Admin waived a fee |
| `ALTA_CARD_RATE_CHANGED` | Card APR updated |

## Billing Scheduler

Architecture separates scheduling from business logic:

```
Cron → API route → alta-card-billing-scheduler.service → existing services → database
```

Orchestration: `src/server/alta-card-billing-scheduler.service.ts`  
HTTP helpers: `src/lib/cron/cron-http.ts`  
Admin server functions: `src/lib/bank/alta-card-scheduler.functions.ts`

### Statement Scheduler

**Endpoint:** `GET|POST /api/cron/alta-card-statements` (requires `CRON_SECRET`)

**Schedule:** Daily (intended production: once per day via external cron or Vercel Cron)

**Behavior:**

1. If today is **not** the last calendar day of the month → exit successfully with `skipped: true`
2. If month-end → call `generateStatement()` per eligible card (same logic as `generateStatementsForEligibleCards()`)
3. Per-card failures are collected; other cards continue processing
4. Writes `OpsJobRun` key `ALTA_CARD_STATEMENTS` and structured JSON logs

**Manual execution:** `/internal/alta-card` → **Run statement generation** (admin only, `force: true` skips month-end check)

### Daily Billing Processing

**Endpoint:** `GET|POST /api/cron/alta-card-billing` (requires `CRON_SECRET`)

**Schedule:** Daily

**Behavior:** Calls `processAltaCardBilling()` — overdue detection, late fees, interest — without changing calculation rules.

**Manual execution:** `/internal/alta-card` → **Run billing processing** (admin only)

### Idempotency

Existing service guards make repeat runs safe:

| Action | Protection |
|--------|------------|
| Statement generation | Only closes OPEN cycles; eligible cards use `nextStatementDate ≤ now` |
| Interest | `interestAppliedAt` prevents duplicate interest per statement |
| Late fees | One late fee per overdue statement |
| Paid statements | Payment allocation and status updates do not re-open paid statements |

A second scheduler run on the same day should mostly no-op or skip already-processed work.

### Job history (`OpsJobRun`)

| `jobKey` | Label |
|----------|-------|
| `ALTA_CARD_STATEMENTS` | Alta Card statement generation |
| `ALTA_CARD_BILLING` | Alta Card billing processing |

`lastMessage` stores JSON: `startedAt`, `completedAt`, `durationMs`, `processedCount`, `successCount`, `failureCount`, `errorSummary`.

Operators can view last run on `/internal/alta-card`. Only admins can trigger manual runs.

### Scheduler audit events

| Action | When |
|--------|------|
| `ALTA_CARD_STATEMENT_JOB_STARTED` | Statement batch started |
| `ALTA_CARD_STATEMENT_JOB_COMPLETED` | Statement batch finished or skipped |
| `ALTA_CARD_BILLING_JOB_STARTED` | Billing batch started |
| `ALTA_CARD_BILLING_JOB_COMPLETED` | Billing batch finished |
| `ALTA_CARD_BILLING_JOB_FAILED` | Billing batch catastrophic failure |

### Future Vercel Cron deployment

**TODO — not configured in this repo.** In production, Alta Card jobs run as part of the shared bank cron:

| Path | Schedule | Notes |
|------|----------|-------|
| `/api/cron/scheduled-transfers` | Daily (or more frequent) | Includes transfers, payroll, loan servicing, **and** Alta Card statements + billing |

Authenticate with `Authorization: Bearer $CRON_SECRET` or `?secret=$CRON_SECRET`.

The statement scheduler no-ops on non–month-end days, so a single daily cron is sufficient.

**Optional standalone endpoints** (testing or split schedules only):

| Path | Purpose |
|------|---------|
| `/api/cron/alta-card-statements` | Statement generation only |
| `/api/cron/alta-card-billing` | Billing processing only |

Example `vercel.json` (deployment TODO) — **one job is enough**:

```json
{
  "crons": [
    { "path": "/api/cron/scheduled-transfers", "schedule": "0 6 * * *" }
  ]
}
```

### PDF export

Customer statement detail pages include **Download PDF** via client-side export (`AltaCardStatementDocument` + `downloadElementAsPdf`). The server stub in `alta-card-statement-pdf.ts` is unused — do not wire UI to it.

### Statement lifecycle

| Status | Customer-visible | Billing |
|--------|------------------|---------|
| `OPEN` | No | Current cycle only |
| `GENERATED` | **No** (admin preview only) | Does not trigger interest, due dates, or autopay |
| `ISSUED` | Yes | Production statement |
| `PARTIALLY_PAID` / `PAID` / `OVERDUE` / `VOID` | Yes | Standard rules |

Preview statements: internal ops panel only (`AltaCardStatementGenerateForm`). Customers see issued statements on `/bank/alta-card/$cardId/statements`.

### Statement routes

| Route | Purpose |
|-------|---------|
| `/bank/alta-card/$cardId/statements` | Statement list |
| `/bank/alta-card/$cardId/statements/$statementId` | Statement detail + period transactions |

### Statement audit events

| Action | When |
|--------|------|
| `ALTA_CARD_STATEMENT_GENERATED` | Statement issued |
| `ALTA_CARD_STATEMENT_VOIDED` | Statement voided (no payments applied) |
| `ALTA_CARD_STATEMENT_PAID` | Statement paid in full via card payment |

### Billing test checklist (manual)

No automated test suite in repo — verify manually when changing billing logic:

1. `calculateAltaCardMinimumPayment` returns ƒ80 / ƒ100 / ƒ250 / ƒ1,000 for ƒ80 / ƒ400 / ƒ5,000 / ƒ20,000
2. Statement closes on last calendar day; `dueDate` is 15 days later
3. Post-close purchase increases `currentBalance` but not `statementBalance` until next close
4. Payment applies to oldest unpaid statement first; status → `PARTIALLY_PAID` or `PAID`
5. After `dueDate`, unpaid statements → `OVERDUE`; interest only on unpaid statement `remainingBalance`
6. Full payment by `dueDate` → no interest for that statement
7. When a statement becomes `OVERDUE`, card status → `DELINQUENT` (spending blocked; payments/autopay allowed)
8. When all overdue statements are paid, `DELINQUENT` → `ACTIVE` unless manually frozen/closed/lost
9. `GENERATED` preview statements never appear in customer statement lists
10. Cron/billing jobs attribute audit events to `Alta System (Cron)` (`SYSTEM` tag), not a human admin
11. Payment allocation order: fees → interest → principal (same payment, idempotent re-run)
12. Late fee and interest batch jobs are idempotent on second run same day
13. Autopay cron uses system actor; duplicate run same day should no-op via audit idempotency

## Service

`src/server/alta-card.service.ts`

### Admin mutations

All financial card mutations (limit, rate, tier, status, fees, payments, adjustments, reversals) route through:

- `src/server/alta-card-admin.service.ts`
- `src/lib/bank/alta-card-admin.functions.ts`
- `/internal/alta-card/$cardId` → `InternalAltaCardOpsPanel`

The card list at `/internal/alta-card` is read-only for card terms. Billing batch tools live in `InternalAltaCardDetailPanel` on the same detail page.

Deprecated: `updateAltaCardLimit`, `updateAltaCardRate`, `changeAltaCardTier` in `alta-card.service.ts` (throw if called).

### System actor

Scheduled jobs use `resolveSystemActorUserId()` from `src/server/system-actor.service.ts` — dedicated user `alta-system-cron` with `SYSTEM` tag. Never impersonates a human admin.

### Thread attachments

Application and review thread uploads use **private** blob storage. Download via auth-gated API routes. Audit: `ALTA_CARD_THREAD_ATTACHMENT_UPLOADED`, `ALTA_CARD_THREAD_ATTACHMENT_DOWNLOADED`.

### Admin adjustments

Operators post credit (reduces balance) or debit (increases balance) with required reason and confirmation. Audit: `ALTA_CARD_ADJUSTMENT_CREATED`. Use adjustment credits to waive interest.

| Function | Purpose |
|----------|---------|
| `getUserAltaCard` | Active/pending personal card for user |
| `getCompanyAltaCards` | Business card + employee cards for company |
| `getAltaCardDetail` | Full card detail with employee cards |
| `createPersonalAltaCardApplication` | Submit personal application |
| `createBusinessAltaCardApplication` | Submit business application |
| `approveAltaCardApplication` | Issue card (status `PENDING`) |
| `denyAltaCardApplication` | Deny application |
| `activateAltaCard` | `PENDING` → `ACTIVE` |
| `freezeAltaCard` / `unfreezeAltaCard` | Card freeze controls |
| `closeAltaCard` | Close card |
| `updateAltaCardLimit` / `updateAltaCardRate` / `changeAltaCardTier` | Admin overrides |
| `createEmployeeCard` | Issue employee card |
| `updateEmployeeCardLimit` | Adjust employee spend cap |
| `freezeEmployeeCard` / `closeEmployeeCard` | Employee card controls |
| `listInternalAltaCards` / `listInternalAltaCardApplications` | Internal lists |

Server functions: `src/lib/bank/alta-card.functions.ts`

## Routes

### User-facing (`/bank/alta-card`)

| Route | Purpose |
|-------|---------|
| `/bank/alta-card` | Personal dashboard |
| `/bank/alta-card/apply` | Application form |
| `/bank/alta-card/$cardId` | Card detail |
| `/bank/alta-card/business` | Company list |
| `/bank/alta-card/business/$companyId` | Business line + employee cards |

### Internal (`/internal/alta-card`)

| Route | Purpose |
|-------|---------|
| `/internal/alta-card` | All cards, filters, pending applications |
| `/internal/alta-card/$cardId` | Full card operations (status, terms, payments, relationship pricing) |
| `/internal/alta-card/applications` | Full application queue |
| `/internal/alta-card/applications/$applicationId` | Application review with relationship recommendation |

## UI

- Card visuals: `src/components/bank/alta-card/alta-card-visual.tsx` (Untitled UI `CreditCard` asset)
- Dashboard: tier benefits, utilization, rate, limits, relationship note (Gold → Alta Private)
- Business page: company limit, balance, employee utilization, company transactions
- Internal: all transactions, adjustments, reversals, linked bank/Alta Pay refs

## Audit events

| Action | When |
|--------|------|
| `ALTA_CARD_APPLICATION_CREATED` | Application submitted |
| `ALTA_CARD_APPROVED` | Application approved, card created |
| `ALTA_CARD_DENIED` | Application denied |
| `ALTA_CARD_ACTIVATED` | Card activated |
| `ALTA_CARD_STATUS_CHANGED` | Card status transition |
| `ALTA_CARD_LIMIT_CHANGED` | Credit limit updated |
| `ALTA_CARD_RATE_CHANGED` | Interest rate updated |
| `ALTA_CARD_TIER_CHANGED` | Tier changed |
| `ALTA_CARD_FEE_WAIVED` | Fee waived |
| `ALTA_CARD_FEE_APPLIED` | Manual fee applied |
| `ALTA_CARD_MANUAL_PAYMENT` | Admin manual payment |
| `ALTA_CARD_ADMIN_ADJUSTMENT` | Admin credit/debit adjustment |
| `ALTA_CARD_RELATIONSHIP_RECOMMENDATION_VIEWED` | Relationship pricing viewed |
| `ALTA_CARD_EMPLOYEE_CARD_CREATED` | Employee card issued |
| `ALTA_CARD_EMPLOYEE_CARD_UPDATED` | Employee card updated (e.g. unfreeze) |
| `ALTA_CARD_EMPLOYEE_CARD_CLOSED` | Employee card closed |
| `ALTA_CARD_FROZEN` / `ALTA_CARD_UNFROZEN` / `ALTA_CARD_CLOSED` | Legacy status events (user flows) |
| `ALTA_CARD_PAYMENT_MADE` | Card payment from checking |
| `ALTA_CARD_CASH_ADVANCE_CREATED` | Cash advance to checking |
| `ALTA_CARD_ALTA_PAY_CHARGED` | Alta Pay charged to card |
| `ALTA_CARD_ADJUSTMENT_CREATED` | Admin adjustment |
| `ALTA_CARD_TRANSACTION_REVERSED` | Transaction reversed |

Metadata includes: `cardId`, `userId`, `companyId`, `oldValue`, `newValue`, `reason`, `actorUserId`, plus transaction-specific fields.

Entity type: `ALTA_CARD`

## Request Account Review

Relationship review workflow for **existing** Alta Card holders — separate from the application flow.

### User flow

1. Alta Card dashboard → **Request Account Review**
2. Form at `/bank/alta-card/$cardId/review`
3. Submit → review request created + secure review thread opened
4. Status at `/bank/alta-card/$cardId/review/$reviewId` · thread at `…/thread`

Cardholders may request one or more of:

- Higher credit limit (optional requested limit)
- Lower interest rate (optional requested rate)
- Card tier upgrade (single-step: White→Navy, Navy→Black, Black→Gold)

One open review per card (`SUBMITTED`, `UNDER_REVIEW`, `NEEDS_INFORMATION`).

**Cooldown:** After a completed review (`APPROVED`, `PARTIALLY_APPROVED`, `DENIED`, `CANCELLED`), cardholders must wait **30 days** before submitting another request. Eligibility is computed in `getCardReviewEligibility` (`alta-card-review.service.ts`). Admins bypass the cooldown on submit.

**UI:** Quick actions disable **Request Account Review** and show the block message when ineligible. The review form page shows the same eligibility state plus relationship recommendations.

### Gold eligibility

- Alta Gold is **Alta Private-only** — see [Alta Private banking](./private-banking.md)
- Alta Gold is **not** publicly selectable
- Non–Private clients at Black tier see Alta Private upsell (`/bank/private`)
- Private clients may request Black→Gold via Request Account Review; approvals remain manual
- Negotiated limits and rates are subject to relationship review — not guaranteed

### Review workflow

| Status | Meaning |
|--------|---------|
| `SUBMITTED` | Just submitted |
| `UNDER_REVIEW` | Staff engaged |
| `NEEDS_INFORMATION` | Awaiting cardholder |
| `APPROVED` | All requested items approved |
| `PARTIALLY_APPROVED` | Some items approved |
| `DENIED` | No items approved |
| `CANCELLED` | Closed by staff |

Staff queue: `/internal/alta-card/reviews`

Admin may independently approve/deny limit, rate, and tier. Approved changes apply immediately via `alta-card-admin.service.ts`.

### Partial approvals

When status is `PARTIALLY_APPROVED`, the review detail shows requested vs approved terms side by side (limit, rate, tier).

### Secure review thread

Models: `AltaCardReviewThread`, `AltaCardReviewThreadMessage` — reuses application thread status/sender enums. Not a deal room / application thread.

Upload API: `/api/alta-card-review-threads/$reviewId/attachments`

### Audit events

| Action | When |
|--------|------|
| `ALTA_CARD_REVIEW_REQUEST_CREATED` | Cardholder submits |
| `ALTA_CARD_REVIEW_APPROVED` | Full approval |
| `ALTA_CARD_REVIEW_PARTIALLY_APPROVED` | Partial approval |
| `ALTA_CARD_REVIEW_DENIED` | Denied |
| `ALTA_CARD_LIMIT_UPDATED` | Limit applied on approval |
| `ALTA_CARD_RATE_UPDATED` | Rate applied on approval |
| `ALTA_CARD_TIER_UPDATED` | Tier applied on approval |

Metadata: `reviewId`, `cardId`, requested/approved terms, `actorUserId`, `reason`.

## Migration

```bash
npx prisma migrate dev --name alta_card_application_workflow
npx prisma generate
```

Migrations:

- `prisma/migrations/20250701230000_alta_card_foundation/migration.sql`
- `prisma/migrations/20250702000000_alta_card_transactions/migration.sql`
- `prisma/migrations/20250702010000_alta_card_statements/migration.sql`
- `prisma/migrations/20250702020000_alta_card_interest_fees/migration.sql`
- `prisma/migrations/20250702030000_alta_card_application_workflow/migration.sql`
- `prisma/migrations/20250702170000_alta_card_review_requests/migration.sql`

## V1 limitations

- No rewards program
- No Discord bot notifications (TODO hooks in autopay service only)
- No disputes/chargebacks
- No card-network / POS authorization
- No fraud detection / collections workflows
- Alta Pay volume not yet in relationship score
- Interest waiver / fee waiver as distinct adjustment types use fee waive + credit adjustment paths
- No daily interest accrual — monthly charge only
- No repeated daily late fees
- Server-side PDF generation stub unused (client PDF export works)
- Spending outside Alta Pay/cash advance/adjustments is admin-only in V1
