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

## Removed products

The following legacy catalog items are no longer shown:

- Alta Certificates of Deposit
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

The `reserve` and `private` account types remain in the Prisma enum for existing accounts but are
not offered for new account opening.

## Routes

- `/bank/products` — canonical product page
- `/bank/deposits` — redirects to `/bank/products`
