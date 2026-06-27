# Legacy Deal Room Infrastructure

Alta Bank Lending V1 uses **Secure Deal Rooms** implemented as `LoanApplicationThread` records. See [deal-rooms.md](./deal-rooms.md).

The codebase still contains an earlier, full-feature **legacy deal room** stack tied to the Prisma `DealRoom` model. It is **not** used by the current application submission flow (`createLoanApplication` → `createThreadForLoanApplication` only).

## What remains and why

| Area | Purpose |
|------|---------|
| `src/server/deal-room*.service.ts` | Historical records, agreement execution, document storage |
| `src/lib/bank/deal-room*.ts` | Types, workflow enums, RPC wrappers |
| `prisma` `DealRoom*` models | Existing production/historical data |
| `/api/deal-rooms/*` | Agreement preview, document upload for legacy rooms |
| `/bank/lending/deal-rooms/*` | **Redirect only** → `/bank/lending/applications` |
| `/internal/lending/deal-rooms/*` | **Redirect only** → `/internal/lending` |
| `internal-dashboard` `openDealRooms` metric | Ops visibility into legacy pipeline |

## Removed (V1 cleanup)

- `src/components/bank/deal-room/*` — UI was orphaned after routes redirected to application threads (no mounted pages).

## User-facing terminology

All new lending copy uses **Secure Deal Room** and **Alta Credit Desk**. Legacy notification and audit strings in deal-room services were updated to match where they may still surface.

## Do not use for new features

Relationship Intelligence and future lending work should extend **application threads** (`loan-application-thread.service.ts`), not legacy `DealRoom` tables.
