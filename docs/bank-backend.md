# Alta Bank Backend (V1)

Manual-review banking for Alta Group: account opening, deposit requests, and withdrawal requests backed by Postgres/Prisma.

## Scope (V1)

**Included**

- `BankAccount` and `BankTransaction` models
- User account opening (`/bank/accounts/open`)
- Deposit requests with screenshot proof upload (`/bank/deposit`)
- Withdrawal requests (`/bank/withdraw`)
- Admin review in `/internal/bank` (approve/deny deposits & withdrawals, approve/freeze/unfreeze accounts)
- Real balances on `/bank`, and `/profile`
- Business Operating Accounts with treasury features on `/bank/account/[accountId]` (see [business-banking.md](./business-banking.md))
- Customer account status, holds, and restrictions (see [bank-account-status.md](./bank-account-status.md))

**Not included (future)**

- Automatic deposits
- Minecraft economy API integration

## Data models

### `BankAccount`

| Field | Description |
|-------|-------------|
| `id` | CUID primary key |
| `userId` | Owning Alta user |
| `companyId` | Optional linked company |
| `accountType` | `ALTA_ACCESS`, `CHECKING`, `SAVINGS`, `MONEY_MARKET`, `RESERVE`, `BUSINESS_OPERATING`, `PRIVATE` |
| `accountName` | Display name |
| `accountNumber` | Unique Alta Bank number (`AB-[PRODUCT]-[UNIQUE]`, see `docs/account-numbering.md`) |
| `status` | `PENDING`, `ACTIVE`, `FROZEN`, `CLOSED` |
| `balance` | Florin balance (`Decimal`, default 0) |
| `currency` | Default `FLR` |
| `openingNotes` | User reason/notes from opening form |

**Opening rules**

- `ALTA_ACCESS`, `CHECKING`, `SAVINGS`, `MONEY_MARKET` → `ACTIVE` immediately
- `BUSINESS_OPERATING` → `ACTIVE` immediately when linked company is `VERIFIED`
- `RESERVE`, `PRIVATE` → require `private_client` tag; **ACTIVE** immediately when enrolled (no manual review). Revoking `private_client` transfers remaining private balances to the user's oldest active personal account and closes reserve/private accounts.

### `BankTransaction`

| Field | Description |
|-------|-------------|
| `id` | CUID |
| `bankAccountId` | Target account |
| `type` | `DEPOSIT`, `WITHDRAWAL`, `ADJUSTMENT` |
| `amount` | Florin amount (positive) |
| `status` | `PENDING`, `APPROVED`, `DENIED`, `CANCELLED` |
| `description` | Source note (deposit) or destination instructions (withdrawal) |
| `memo` | Optional user memo |
| `referenceCode` | Unique ref (`DEP-YYYYMMDD-…` / `WDR-…`) |
| `proofImageUrl` | Stored proof image URL (uploaded via deposit form) |
| `reviewedById` / `reviewedAt` / `reviewNote` | Admin review audit |

## Approval flows

### Intrabank transfer

1. User selects a source account they can access
2. Destination is either another own account (dropdown) or another player's Alta account number (`AB-####-######`)
3. Instant `$transaction`: debit source, credit destination
4. Creates paired `WITHDRAWAL` + `DEPOSIT` records (reference `TRF-YYYYMMDD-…-OUT` / `-IN`)
5. No admin review — balances update immediately

### Deposit

1. User submits form → `BankTransaction` `DEPOSIT` / `PENDING`
2. Balance **unchanged**
3. Admin approves → Prisma `$transaction`: status `APPROVED`, balance `increment`
4. Admin denies → status `DENIED`, balance unchanged

### Withdrawal

1. User submits form → `BankTransaction` `WITHDRAWAL` / `PENDING`
2. Balance **unchanged**
3. Admin approves → verify sufficient balance → status `APPROVED`, balance `decrement`
4. Admin denies → status `DENIED`

### Account opening

1. User submits → `BankAccount` created
2. Instant types → `ACTIVE`
3. Review types → `PENDING` until admin approves → `ACTIVE`
4. Admin can freeze active accounts or unfreeze frozen accounts

**Rule:** Balances only change when a `BankTransaction` is approved. Account status changes do not move money.

## Screenshot proof flow

- UI accepts image file selection on `/bank/deposit`
- Server uploads proof to configured blob storage and stores the URL in `proofImageUrl`
- Alta reviews the deposit in `/internal/bank`; proof is visible to the customer in Requests in Progress

## Permissions

| Actor | Access |
|-------|--------|
| User | Own personal accounts (`companyId` null) |
| Company member | Company accounts for memberships |
| Admin / operator | All accounts and review actions via `/internal/bank` |

## Key files

| Area | Path |
|------|------|
| Schema | `prisma/schema.prisma` |
| Service | `src/server/bank.service.ts` |
| Server fns | `src/lib/bank/bank.functions.ts` |
| Types | `src/lib/bank/backend-types.ts` |
| Account numbers | `src/lib/bank/account-number.ts`, `docs/account-numbering.md` |
| Routing | `src/lib/bank/routing.ts` |
| User routes | `src/routes/bank/accounts/`, `deposit.tsx`, `withdraw.tsx` |
| Admin | `src/routes/internal/bank.tsx` |

## Migrations

```bash
npx prisma migrate deploy
# or locally:
npx prisma migrate dev
npx prisma generate
```

Migration: `20250625000000_bank_accounts`

## Re-enable mock financial UI

Set `SHOW_USER_FINANCIAL_MOCK_DATA = true` in `src/lib/config/data-mode.ts` for demo dashboards with fake numbers.

## Future: Minecraft economy API

Planned integration:

1. Verified in-game payment webhook creates `DEPOSIT` transaction pre-filled with proof metadata
2. Auto-approve path for trusted rails (after manual V1 validation period)
3. Withdrawal fulfillment posts back to Minecraft economy on approval

## Future: Automatic deposits

1. Replace manual screenshot flow with payment rail callbacks
2. Idempotent `referenceCode` from external system
3. Optional auto-approve under policy limits
