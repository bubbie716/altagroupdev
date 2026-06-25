# Alta Bank Account Numbering

Alta Bank uses a standardized internal account number format for all customer accounts. Account numbers are assigned at account opening and stored in the `BankAccount.accountNumber` field.

## Account number format

```
AB-[PRODUCT CODE]-[UNIQUE NUMBER]
```

| Segment | Description |
|---------|-------------|
| `AB` | Alta Bank institution prefix |
| `PRODUCT CODE` | Four-digit product identifier (see below) |
| `UNIQUE NUMBER` | Six-digit random identifier (100000–999999) |

**Examples**

- `AB-1000-482913` — Alta Access
- `AB-2000-938144` — Checking
- `AB-3000-938144` — Savings
- `AB-3500-552811` — Alta Money Market
- `AB-5000-774120` — Business Operating
- `AB-9000-118742` — Alta Private

### Design principles

- **Human readable** — Easy to read aloud and transcribe
- **Stable** — Assigned once at opening; never changes for the life of the account
- **Not sequential** — Random six-digit suffix does not expose total account count
- **Not derived from Discord IDs** — No user or platform identifiers in the number

### Implementation

| File | Purpose |
|------|---------|
| `src/lib/bank/account-number.ts` | `generateAccountNumber(accountType)`, product code map, validation |
| `src/server/bank.service.ts` | `generateUniqueAccountNumber()` with collision retry on create |

Validation pattern: `/^AB-\d{4}-\d{6}$/`

## Product codes

| Code | Account type | Prisma enum |
|------|--------------|-------------|
| `1000` | Alta Access | `ALTA_ACCESS` |
| `2000` | Checking | `CHECKING` |
| `3000` | Savings | `SAVINGS` |
| `3500` | Alta Money Market | `MONEY_MARKET` |
| `4000` | Reserve | `RESERVE` |
| `5000` | Business Operating | `BUSINESS_OPERATING` |
| `9000` | Alta Private | `PRIVATE` |

Product codes are embedded in the account number so account type can be inferred from the number without a database lookup (useful for support, statements, and future rails).

## Routing number

All Alta Bank accounts currently share a single routing number:

```
011000001
```

| File | Purpose |
|------|---------|
| `src/lib/bank/routing.ts` | `getRoutingNumber()` — centralized routing config |

The routing number is **not** stored per account in the database. It is resolved at display time via `getRoutingNumber()` and included in API responses (`routingNumber` on `UserBankAccount`).

**Displayed on**

- Account list cards on `/bank` (dashboard)
- Account detail page (`/bank/account/[accountId]`)
- Account opening confirmation
- Future transfer and wire pages

All accounts use the `AB-[CODE]-[UNIQUE]` format assigned at opening. To renumber any non-standard values in the database, run:

```bash
npm run db:migrate-account-numbers
```

## Future: NCC routing integration

The Newport Clearing Corporation (NCC) may eventually assign institution-specific routing numbers and manage settlement rails between Alta Bank and other Newport financial institutions.

**Planned approach**

1. NCC assigns routing numbers per institution (or per Alta Bank charter)
2. `getRoutingNumber()` reads from NCC registry or institution config instead of a hardcoded constant
3. Cross-institution transfers validate routing + account number against NCC directory
4. Wire and ACH-style flows use NCC settlement rather than manual review

Until NCC is live, all Alta accounts use routing number `011000001`.

## Future: Institution account numbering

When Alta Bank connects to external institutions or subsidiary charters:

- Product codes may expand (e.g. `6000` for treasury, `7000` for escrow)
- NCC may require institution-specific prefixes beyond `AB`
- Account numbers may need check-digit validation for automated rails
- Institution routing tables would map `(routing, accountNumber)` → settlement endpoint

The current `AB-[CODE]-[UNIQUE]` format is designed to extend without breaking existing accounts.

d