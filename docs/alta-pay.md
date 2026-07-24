# Alta Pay

PayPal-style business payments within Alta Bank. Users pay **verified companies** by name — no account number required.

## How it works

1. Payer selects an Alta Bank source account — personal or Business Operating Account (treasury manage role required).
2. Payer searches for a **verified** company with an **active Business Operating Account**.
3. Payer enters amount (Florins) and optional memo.
4. Payer reviews and confirms.
5. Alta Bank debits the source account and credits the company operating account **instantly** via paired intrabank transactions.

Route: `/bank/pay`

## Requirements

| Requirement | Enforcement |
|-------------|-------------|
| Verified company | `Company.verificationStatus === VERIFIED` |
| Business Operating Account | `BankAccount` type `BUSINESS_OPERATING`, status `ACTIVE` |
| Payer account | Personal (`companyId` null) or `BUSINESS_OPERATING` with treasury manage role, status `ACTIVE` |
| Sufficient funds | Available balance check (excludes pending withdrawals) |

Companies without verification or an operating account do not appear in search results.

## Transaction flow

Uses existing `BankAccount` and `BankTransaction` models — no new enum.

Reference format:

```
PAY-YYYYMMDD-{HEX}-OUT   (payer withdrawal)
PAY-YYYYMMDD-{HEX}-IN    (merchant deposit)
```

Descriptions:

- Out: `Alta Pay business payment to {Company Name}`
- In: `Alta Pay business payment from {Discord Username}`

Settlement runs in a single Prisma `$transaction`: balance updates + both records, status `APPROVED`.

Implementation: `src/server/alta-pay.service.ts` → `submitAltaPayPayment()`

## Permissions

### Payers

Any authenticated user with at least one **eligible source account**:

- Active **personal** Alta Bank account, or
- Active **Business Operating Account** for a verified company where the user holds Owner, Executive, or Finance Manager role (same as Business Banking treasury manage).

Paying your own company from its operating account is blocked.

### Business — incoming payments

| Role | Access |
|------|--------|
| Owner | View received payments + MTD total |
| Executive | View received payments + MTD total |
| Finance Manager | View received payments + MTD total |
| Compliance Contact | No Alta Pay treasury view |
| Viewer | No access |

Shown on `/bank/business/payments` → **Alta Pay received**.

## Business integration

`/bank/business/payments` includes:

- **Alta Pay received** — MTD total, recent customer payments, reference codes
- **Treasury outbound payments** — existing scheduled/recurring payment center (manual review)

## Internal operations

`/internal/bank` summary cards include **Alta Pay (MTD)** — count and Florin volume from `PAY-*-IN` deposits.

## Future plans (not built)

Documented as TODOs in `alta-pay.service.ts`:

- **Business payment links** — shareable URLs with prefilled payee/amount
- **QR codes** — scan-to-pay
- **Invoices** — structured payment requests
- **Refunds** — merchant or operator reversal
- **Customer receipts** — post-payment receipt delivery
- **Discord payment notifications** — webhook on settlement

Also planned separately:

- Payment disputes / chargebacks

## API surface

Server functions (`src/lib/bank/alta-pay.functions.ts`):

- `fetchPaySourceAccounts` (alias: `fetchPersonalPaySourceAccounts`)
- `searchPayableCompaniesForPay`
- `submitAltaPay`
- `fetchUserAltaPayHistory`
- `fetchCompanyAltaPayReceived`
- `fetchAltaPayVolume` (internal)
