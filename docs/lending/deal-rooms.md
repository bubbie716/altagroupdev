# Secure Deal Rooms (Application Threads)

Secure Deal Rooms are **simple asynchronous message threads** tied to each Alta Bank loan application. Applicants communicate with **Alta Credit Desk** — not a named banker. There is no staff assignment, case ownership, or officer workload in V1.

There is **no** built-in term negotiation, contract generation, e-signatures, or automatic loan execution in V1.

## V1 scope

| Included | Not included |
|----------|----------------|
| One thread per loan application | Offer / counter-offer system |
| Applicant and staff messages | Agreement workspace / PDF generation |
| System welcome message on submit | E-signatures |
| Text, images, files, pasted links | Automatic contract creation |
| Thread status (open / waiting / closed) | Staff assignment or case ownership |
| Audit events | Discord/email notifications (TODO hooks only) |

## Data model

### `LoanApplicationThread`

| Field | Description |
|-------|-------------|
| `loanApplicationId` | Unique link to `LoanApplication` |
| `applicantUserId` | Primary applicant |
| `companyId` | Optional company facility |
| `status` | `OPEN`, `WAITING_ON_APPLICANT`, `WAITING_ON_ALTA`, `CLOSED` |
| `assignedStaffId` | **Deprecated / unused in V1** — column retained for schema compatibility |
| `closedAt` | Set when closed |

### `LoanApplicationThreadMessage`

| Field | Description |
|-------|-------------|
| `threadId` | Parent thread |
| `senderUserId` | Optional (null for system) |
| `senderRole` | `APPLICANT`, `ALTA_STAFF`, `SYSTEM` |
| `body` | Optional text (links auto-linked in UI) |
| `attachments` | JSON array of `{ type, url, fileName?, mimeType?, fileSizeBytes? }` |

Attachment types: `FILE`, `IMAGE`, `LINK`.

## Lifecycle

1. User submits a loan application (`createLoanApplication`).
2. System creates `LoanApplicationThread` (idempotent).
3. System posts the application submitted message (see `LOAN_APPLICATION_SUBMITTED_MESSAGE` in `src/lib/bank/lending-application-status-copy.ts`).
4. Applicant and staff exchange messages asynchronously in the Secure Deal Room.

### Status rules

| Event | New status |
|-------|------------|
| Applicant sends message | `WAITING_ON_ALTA` |
| Staff sends message | `WAITING_ON_APPLICANT` |
| Staff closes thread | `CLOSED` |
| Staff reopens | `OPEN` or waiting state based on last message |

Closed threads: applicants cannot send; staff may reopen.

## Routes

| Route | Audience |
|-------|----------|
| `/bank/lending/applications/$applicationId/thread` | Applicant / company rep |
| `/internal/lending/applications/$applicationId/thread` | Admin / operator |
| `/bank/lending/applications` | Application list with thread links |
| `/internal/lending` | Queue with **Open Secure Deal Room** per row |

### Application display statuses

User-facing labels (see `src/lib/bank/lending-application-status-copy.ts`):

- **Waiting on Alta** — Alta is reviewing or preparing the next step
- **Waiting on You** — Applicant action required (`WAITING_ON_APPLICANT` thread status)
- **Accepted** — `APPROVED`
- **Denied** — `DENIED` or `CANCELLED`

Legacy `/bank/lending/deal-rooms/*` and `/internal/lending/deal-rooms/*` redirect to applications / lending.

## Attachments

- **Links:** Paste URLs in the message body; UI renders clickable links (including Google Docs shared links — no integration).
- **Files / images:** Attach button → `POST /api/loan-threads/$applicationId/attachments` → Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set. If storage is not configured, users see a clear error and can paste links instead.

## Permissions

| Actor | Access |
|-------|--------|
| Applicant | Own application thread |
| Company `OWNER` / `EXECUTIVE` / `FINANCE_MANAGER` | View + send on company applications |
| Company `VIEWER` | No send (view policy unchanged) |
| `ADMIN` / `OPERATOR` | All threads; reply as Alta Credit Desk; status; close/reopen |

## Server API

File: `src/server/loan-application-thread.service.ts`

| Function | Purpose |
|----------|---------|
| `createThreadForLoanApplication` | Open thread on application submit |
| `ensureThreadExists` | Backfill thread for legacy applications |
| `getThreadContext` / `getThreadMessages` | Thread UI data |
| `sendThreadMessage` | Post message + update status |
| `updateThreadStatus` | Staff status controls |
| `closeThread` / `reopenThread` | Thread lifecycle |

`assignThreadStaff` is **deprecated** (no-op). V1 does not assign threads to individual staff.

TanStack wrappers: `src/lib/bank/loan-application-thread.functions.ts`

## Audit events

Entity type: `LOAN_APPLICATION`

- `LOAN_THREAD_CREATED`
- `LOAN_THREAD_MESSAGE_SENT`
- `LOAN_THREAD_STATUS_CHANGED`
- `LOAN_THREAD_CLOSED`
- `LOAN_THREAD_REOPENED`

(`LOAN_THREAD_ASSIGNED` is legacy — no longer written in V1.)

Message bodies are **not** stored in audit metadata.

## Notifications (future)

TODO hooks in `sendThreadMessage` and `createThreadForLoanApplication`:

- **Alta Bot** — DM applicant when Alta Credit Desk replies in the Secure Deal Room
- **Alta Bot / staff Discord bridge** — notify staff when applicant sends a message

## Migration

```bash
npx prisma migrate deploy
```

Migration: `prisma/migrations/20250701220000_loan_application_threads/migration.sql`

## Future enhancements (optional)

- In-app or Discord notifications
- Read receipts
- Rich link previews
- Formal term sheets and agreement workflow (separate from V1 thread)

Legacy deal room tables and services remain in the codebase for historical data but are **not** used by the application submission flow. See [legacy-deal-room-infrastructure.md](./legacy-deal-room-infrastructure.md).
