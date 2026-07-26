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
- `/bank?action=open-account&accountType=alta_access`
- `/bank?action=card-freeze&cardId=…`

### Why query-driven

- Matches existing Bank patterns (`accountId`, Alta Pay `tab`, etc.).
- Browser **Back** dismisses the overlay when open pushed a history entry.
- Refresh restores a valid action’s safe initial state.
- Closing with Done/X uses `replace: true` and strips only action-related keys (`action`, `accountId`, `cardId`, `companyId`, `scope`, `accountType`) so completed flows do not reopen on Back.
- Invalid `action` values are ignored safely.

### Standalone routes

Bookmarked pages remain available and share the same flow components via `BankActionPageSurface`:

- `/bank/deposit`
- `/bank/withdraw`
- `/bank/transfers/intrabank`
- `/bank/pay`
- `/bank/open`

### Responsive shell

`ResponsiveBankAction` is a **single Dialog tree** with SSR-safe CSS: centered on desktop, bottom sheet on mobile (above the Bank mobile nav + safe area via `--bank-mobile-nav-offset` / `--bank-mobile-sheet-max-height`). Forms are not dual-mounted. Backdrop clicks never dismiss financial workflows; X/Close, Cancel, Done, Discard, or Escape (after nested menus) do.

Alta Card payment / cash-advance dialogs and `?action=` sheets share `bank-workflow-registry`: opening Freeze (or any Bank action) force-closes an open card dialog first, and opening a card dialog force-closes any open Bank action sheet. Exactly one Bank workflow may be active.

### Dirty state

Pay / Transfer / Deposit / Withdraw / Open Account derive dirty from form values vs an initial snapshot (`bank-action-dirty.ts`). Pay is dirty when amount, note, selected recipient, or source account changes — amount alone is enough for discard protection.

### Mobile verification notes

Automated Playwright smoke covered:

- Desktop 1280×800 and iPhone-width 390×844 for Products → Open account (single dialog, sheet above nav)
- Short landscape-style 667×375 for Deposit sheet bounds

Native iOS/Android soft-keyboard focus scrolling remains browser-dependent (`interactive-widget=resizes-content` + `100dvh`). Manual keyboard reachability was not re-verified in this pass beyond those viewport sizes.

### State machine

`selection → details → review → submitting → success` (or `error`). Success stays until **Done**. Form state resets after the close animation.
