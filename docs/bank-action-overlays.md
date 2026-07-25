# Bank action overlays

## Architecture choice: query-driven overlays

Alta Bank transactional actions use **URL search parameters** on the current Bank path, not nested modal routes.

Examples:

- `/bank?action=deposit`
- `/bank?action=withdraw&accountId=…`
- `/bank?action=move-money`
- `/bank?action=pay`
- `/bank?action=transfer`
- `/bank?action=open-account`
- `/bank?action=card-freeze&cardId=…`

### Why query-driven

- Matches existing Bank patterns (`accountId`, Alta Pay `tab`, etc.).
- Browser **Back** dismisses the overlay when open pushed a history entry.
- Refresh restores a valid action’s safe initial state.
- Closing with Done/X uses `replace: true` and strips only action-related keys (`action`, `accountId`, `cardId`, `companyId`) so completed flows do not reopen on Back.
- Invalid `action` values are ignored safely.

### Standalone routes

Bookmarked pages remain available and share the same flow components via `BankActionPageSurface`:

- `/bank/deposit`
- `/bank/withdraw`
- `/bank/transfers/intrabank`
- `/bank/pay`
- `/bank/open`

### Responsive shell

`ResponsiveBankAction` is a **single Dialog tree** with SSR-safe CSS: centered on desktop, bottom sheet on mobile (above the Bank mobile nav + safe area). Forms are not dual-mounted.

### State machine

`selection → details → review → submitting → success` (or `error`). Success stays until **Done**. Form state resets after the close animation.
