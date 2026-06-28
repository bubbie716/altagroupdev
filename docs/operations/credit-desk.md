# Credit Desk Status

Admins can temporarily **close the Credit Desk** to stop new credit applications while keeping existing credit products fully operational.

## What Credit Desk Closed does

When the Credit Desk is **Closed**:

- New **loan applications** (personal, business, private liquidity) are blocked.
- New **Alta Card applications** (personal and business) are blocked.
- New **Alta Card account review requests** (tier, limit, rate) are blocked.
- **Pending** lending applications, Alta Card applications, and account reviews are **cancelled** automatically.
- Secure Deal Rooms for those cancelled applications are closed with a system message.
- Customer apply entry points are hidden from bank navigation and product pages.
- Direct visits to application routes show the **Credit Desk Closed** page.

When the Credit Desk is **Open**, customers can submit new applications normally.

## What remains available

Closing the Credit Desk does **not** affect:

- Existing active loans and loan payments
- Existing Alta Cards, card payments, statements, and autopay
- Internal lending and Alta Card queues for already-funded products
- Balances, credit limits, rates, or payment logic

This is an operational pause on **new intake**, not product removal.

### Pending applications cancelled on close

When an admin closes the Credit Desk, the platform cancels:

| Type | Pending statuses |
|------|------------------|
| Lending applications | `PENDING`, `UNDER_REVIEW` (no funded loan) |
| Alta Card applications | `SUBMITTED`, `UNDER_REVIEW`, `NEEDS_INFO`, and `APPROVED` not yet accepted |
| Alta Card account reviews | `SUBMITTED`, `UNDER_REVIEW`, `NEEDS_INFORMATION` |

Each cancellation closes the associated Secure Deal Room with an institutional system message citing the admin's close reason.

## Who can change it

| Role | View status | Open / Close Credit Desk |
|------|-------------|--------------------------|
| Admin | Yes | Yes (confirmation + reason required) |
| Operator | Yes | No |
| Customer | Sees closed-state page if applying | No |

Controls live at `/internal/settings` under **Credit Desk**.

## Audit behavior

Status changes write to the append-only audit log:

| Action | When |
|--------|------|
| `CREDIT_DESK_CLOSED` | Credit Desk set to Closed |
| `CREDIT_DESK_OPENED` | Credit Desk set to Open |

Metadata includes:

- `previousStatus` / `newStatus` (`open` | `closed`)
- `actorUserId`
- `reason`
- `timestamp`
- On close: `cancelledLoanApplications`, `cancelledAltaCardApplications`, `cancelledAltaCardReviews` (counts)

Per-entity audit events are also written for each cancelled application or review (`LOAN_APPLICATION_CANCELLED`, `ALTA_CARD_APPLICATION_STATUS_CHANGED`, `ALTA_CARD_REVIEW_CANCELLED`).

Entity type: `PLATFORM` · Entity id: `credit-desk`

## Data model

Settings are stored in `PlatformSetting` (key/value rows):

- `creditDeskStatus` — `"open"` or `"closed"` (defaults to open if unset)
- `creditDeskClosedAt` — ISO timestamp when the current closed window started
- `creditDeskUpdatedById` — last admin who changed settings

## Internal visibility

When the Credit Desk is closed, a banner appears across the internal console:

**Credit Desk Closed** — New credit applications are currently disabled.

Operators retain full access to lending and Alta Card queues.

## Related files

- `src/server/platform-settings.service.ts` — read/write and submission guard
- `src/server/credit-desk-cancel-pending.service.ts` — bulk cancellation on close
- `src/lib/platform/credit-desk-guard.ts` — application route detection
- `src/lib/auth/credit-desk-guards.ts` — customer route redirect
- `src/routes/bank/credit-desk-closed.tsx` — customer closed-state page
- `src/routes/internal/settings.tsx` — admin controls
- `src/components/internal/credit-desk-panel.tsx` — settings UI
