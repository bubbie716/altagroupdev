
# Bank Editorial Polish — Every Page

Visual polish pass across every page under `src/routes/bank/`. Same vocabulary as the Lending overview and Deal Rooms (hairline rails, mono micro-caps, serif headers, gold accents, Florin tabular). Frontend only — no loaders, server functions, schema, routes, or business logic change.

## Shared idioms to standardize

- **Hairline stat strip**: `dl` with hairline dividers (`divide-x divide-y divide-border`), mono uppercase labels, serif tabular values. Replaces ad-hoc `BankStatCard` grids on overview pages.
- **Mono section eyebrow + serif header**: every `Section` already has it via `PageShell`, but in-page subsections (Account Overview, Recent Activity, etc.) get a consistent eyebrow + right-aligned mono action chip.
- **Hairline row list** (`ul.divide-y.border` in `bg-surface-1`) for directory-style content (statements, contacts, transfers hub). Replaces card grids where the content reads as a list.
- **Hairline product/feature tiles** (`grid gap-px bg-border`) for product-style content (Products, Business "what's included"). Replaces drop-shadow card grids.
- **Editorial CTA strip** (the one used on `/bank/lending`) for marketing surfaces: hero copy + buttons left, mono stat dl below the gold hairline. Used on Bank index empty state, Business index, Products header, Private hero.
- **Empty states**: consolidate to the shared `EmptyState` with eyebrow, single CTA, dashed hairline border.
- **Page chrome consistency**: every `PageShell` keeps the existing `eyebrow="Alta Bank · …"` pattern; trim any rogue inline informational banners into a single hairline strip (`border border-border bg-surface-1/60 px-4 py-3 text-[12px] text-muted-foreground`).

## Page-by-page

### Overview / dashboards
- **`/bank` (`index.tsx`)** — Replace the 7-cell `BankStatCard` grid with a 4-cell hairline stat strip (Total Relationship · Private Status · Pending reviews · Net change). Move the secondary balances (Checking · Savings · Reserve · Business) into a second compact mono-labeled row. Account Overview keeps cards but gets a mono right-aligned `View all →` chip. Recent Activity gets a hairline-bordered table wrapper.
- **`-dashboard-mock.tsx`** — mirror the live dashboard changes so preview matches.

### Products & marketing
- **`/bank/products`** — Editorial section headers (mono eyebrow + serif title + count chip). Each product category renders as a hairline product grid (`grid gap-px bg-border`) instead of shadowed cards. Add a one-line section description below each header.
- **`/bank/business/index.tsx`** — Replace the 2-up card hero with an editorial CTA strip (matches `/bank/lending`). "What's included" becomes a hairline 3-column grid with mono "01–06" indices.
- **`/bank/open.tsx`** — Add a hairline summary rail showing the 3 products being opened.
- **`/bank/private.tsx`** — Already large (826 lines). Scope here: just normalize section headers, swap shadowed cards for hairline cards, and apply the editorial CTA strip at the top. No structural rebuild.

### Money movement
- **`/bank/transfers`** — Hub tiles get hairline borders, mono micro-caps, gold corner accent, hover tint matching lending overview.
- **`/bank/transfers/intrabank` & `/interbank`** — Wrap the form in a two-column layout (form + sticky summary card showing source/destination/amount/schedule). Same Application-Summary pattern from Lending Apply.
- **`/bank/transfers/contacts`** — Convert grid to a hairline row list (name, type, account, last used).
- **`/bank/pay`** — Wrap form in a two-column shell (form + sticky "What you're sending" summary). Payment history becomes a hairline row list.
- **`/bank/deposit`, `/bank/deposits`, `/bank/withdraw`** — Normalize: editorial header, hairline form card, mono note strip in place of long muted paragraphs.

### Accounts & statements
- **`/bank/accounts.tsx`**, **`/bank/account/$accountId`**, **`/bank/accounts/$accountId`**, **`/bank/accounts/open.tsx`** — Hairline account row list on the index, sticky right rail on detail (balance, status, account number, linked products), tabbed hairline underline for activity / statements / scheduled.
- **`/bank/statements/index.tsx`** — Already a list; replace the muted info banner with a mono hairline note, switch the Card wrapper to a hairline row list, add a 2-cell stat strip (Personal months · Business months).
- **`/bank/statements/$statementId.tsx`** — Receipt-style hairline panel with mono metadata header, tabular line items, gold hairline footer.

### Business
- **`/bank/business/payments`, `payroll`, `representatives`, `statements`** — These are 18-line route stubs that just compose existing components. Add editorial `PageShell` headers with descriptions and a consistent in-page mono stat strip drawn from the loader data (e.g. employees count, batches this period).
- **`/bank/business/route.tsx`** — keep as-is; just confirm `<Outlet />`.

### Admin
- **`/bank/admin/clients`, `loans`, `private`** — 7-line stubs. Add editorial `PageShell` framing, hairline stat strip, hairline row list, mono action menu (same pattern as `/internal/lending/deal-rooms`). Keep all server data identical.

## Technical notes

- New shared components under `src/components/bank/`:
  - `bank-stat-strip.tsx` (the hairline `dl` strip).
  - `hairline-row-list.tsx` (typed list wrapper).
  - `editorial-cta-strip.tsx` (the marketing hero strip).
  - `summary-rail.tsx` (sticky right-column summary card).
- Existing components touched only where the visual layer is internal (e.g. `BankStatCard` keeps existing API but gets a `variant="strip"` for the new layout — or callers switch to `bank-stat-strip`). No external API breakage.
- All styling via existing tokens. No new CSS variables, no hardcoded colors. No font changes.
- Mobile: every two-column shell collapses to single column; row lists already stack via existing patterns.
- All loaders, `beforeLoad`, server functions, `routeTree.gen.ts`, business logic, validation, and mocks are untouched.

## Out of scope

- Backend, server functions, Prisma, validation, auth, routing IA.
- Adding new fields, statuses, or data sources.
- Rewriting `/bank/private.tsx` (only header + cards normalized; no structural rebuild).
- Non-bank routes (Exchange / Terminal / Governance / Profile / Companies / Home).
- New components outside the four shared primitives above.

## Order of work

1. Build the four shared primitives.
2. Apply across overview + marketing pages (`/bank`, `/bank/products`, `/bank/business/index`, `/bank/private` header, `/bank/-dashboard-mock`).
3. Money movement (`/bank/transfers/*`, `/bank/pay`, `/bank/deposit*`, `/bank/withdraw`).
4. Accounts & statements (`/bank/accounts*`, `/bank/account/$accountId`, `/bank/statements/*`).
5. Business sub-routes and admin stubs.
6. Mobile QA across all touched pages.
