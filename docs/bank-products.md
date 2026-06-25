# Alta Bank Products

Public product catalog for `/bank/products`. Marketing and copy only — no backend account types are created from this page.

## Product suite

### Retail Banking

| Product | Minimum balance | Availability |
|---------|-----------------|--------------|
| Alta Access | None | Open |
| Alta Checking | ƒ500 | Open |
| Alta Savings | ƒ1,000 | Open |
| Alta Money Market | ƒ7,500 | Open |

### Business Banking

| Product | Minimum balance | Availability |
|---------|-----------------|--------------|
| Business Operating Account | ƒ2,500 | Requires verified company |

### Alta Private

Invitation-only. Requires `private_client` tag for account opening where mapped.

| Product | Minimum balance | Availability |
|---------|-----------------|--------------|
| Reserve Account by Alta Private | ƒ50,000 | Alta Private only |
| Summit Money Market by Alta Private | ƒ100,000 | Alta Private only |

## Removed products

The following legacy catalog items are no longer shown:

- Alta Certificates of Deposit
- Alta Private Deposit Program
- Private Negotiated CDs
- Structured / Citadel-era deposit products

## Data source

| File | Purpose |
|------|---------|
| `src/lib/bank/data.ts` | `bankProducts` array |
| `src/lib/bank/api.ts` | `getBankProducts()` |
| `src/routes/bank/products.tsx` | Product page |
| `src/components/bank/product-card.tsx` | Product card UI |

## Account opening mapping

Account opening (`/bank/accounts/open`) uses backend account types, not every catalog product:

| Catalog product | Account type (if openable today) |
|-----------------|----------------------------------|
| Alta Access | `alta_access` |
| Alta Checking | `checking` |
| Alta Savings | `savings` |
| Alta Money Market | `money_market` |
| Business Operating Account | `business_operating` |
| Reserve Account by Alta Private | `reserve` |
| Summit Money Market by Alta Private | `private` |

## Routes

- `/bank/products` — canonical product page
- `/bank/deposits` — redirects to `/bank/products`
