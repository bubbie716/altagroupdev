
# Lending Editorial Pass — Apply, Applications, Loans

Bring the three weaker lending routes up to the bar set by `/bank/lending` and `/bank/lending/deal-rooms`. Frontend/presentation only — no changes to server functions, loan service, mock data, schema, routing, or auth.

## 1. `/bank/lending/apply` — Editorial application flow

Goal: feel like sitting across from a credit officer, not filling a generic form.

- Restructure the route body into a two-column layout (`lg:grid-cols-[minmax(0,1fr)_360px]`). Single column on mobile.
- **Left column** — split the existing `LendingApplyForm` into 4 visual fieldsets separated by hairline dividers and mono section eyebrows:
  1. `01 · Product` — product selector + (when business) company picker.
  2. `02 · Amount & term` — requested amount, term months, linked account.
  3. `03 · Purpose` — purpose, repayment plan, collateral.
  4. `04 · Notes for the officer` — notes textarea.
  No fields added or removed. State, validation, and `submitLoanApplication` call stay identical.
- Add a slim progress rail above the form: 4 hairline pills, current step highlighted in gold, driven by scroll position (IntersectionObserver on the fieldsets). Pure UI affordance.
- **Right column (sticky `top-24`)** — new `ApplicationSummaryCard` component that mirrors current form state live:
  - Eyebrow: `Application summary`.
  - Product label, requested amount (Florin), term, repayment cadence (from `LOAN_PRODUCT_REPAYMENT_TERMS`), estimated total outstanding (already computed via `computeLoanTermEstimate`).
  - Mono rate line ("Indicative · subject to officer review").
  - "What happens next" 3-step list (Submit → Officer assigned → Deal room opens). Static copy.
- **Mobile**: summary becomes a collapsible bottom sheet (`<details>` with sticky bottom bar) showing the same fields.
- Submit button row gets a hairline top divider and a mono caption ("Reviewed manually by Alta Bank credit operations · typical response < 4h").

## 2. `/bank/lending/applications` — Editorial list

Goal: stop looking like an internal admin table.

- Add a stat strip above the table (4 cells, hairline divided, mono labels): Total submitted · Under review · Approved · Declined. Computed from `applications` array.
- Replace the raw `AdminDataTable` with a hairline-bordered row list (same row pattern as deal rooms): each row shows
  - mono ID + submitted timestamp eyebrow,
  - serif product name, company subline,
  - right-aligned Florin amount, term (mono),
  - status badge,
  - review note (line-clamped, muted) beneath.
- Filter chip row above the list: All / Pending / Under review / Approved / Declined. Local `useState`, filters the same array.
- Improved empty state using the project's `EmptyState` with eyebrow, title, and a CTA to `/bank/lending/apply`.
- All data still comes from `fetchUserLoanApplications`; no fields added.

## 3. `/bank/lending/loans` — Facility summary + table

Goal: institutional credit portfolio, not a stack of expanding cards.

- Add a top **Portfolio summary strip** (4 hairline cells): Total exposure, Total repaid, Next payment due (date + amount from soonest pending installment across loans), Auto-pay coverage (X of Y facilities). Derived from existing `loans` array — no new server calls.
- Replace the vertical card stack with an institutional **facility table**:
  - Columns: Facility ID (mono), Product, Principal, Outstanding, Rate, Next due, Status, Auto-pay.
  - Row click expands an inline detail panel beneath the row (single-row expanded at a time) containing the existing `LoanRepaymentProgressBar`, metric grid, `LoanPaymentScheduleTable`, `LoanAutoPayForm`, payment history, and Make payment button.
  - Reuses every existing component and the existing `useServerFn(fetchLoanPaymentContext)` lazy load — only the outer container changes.
- First facility expanded by default when count > 0; matches current behavior.
- Empty state unchanged (already polished).
- Keep `AltaCreditProfilePlaceholder` at the bottom.

## Technical notes

- New components, all under `src/components/bank/`:
  - `lending-apply-shell.tsx` (two-column layout + progress rail + sticky summary).
  - `application-summary-card.tsx`.
  - `lending-applications-list.tsx` (row list + filter chips + stat strip).
  - `lending-loans-table.tsx` (facility table + expanded detail row).
- `LendingApplyForm` refactored internally to expose its state via a render-prop or to accept an optional `onStateChange` callback so the sticky summary stays in sync. No public API breakage for any other caller — only `/bank/lending/apply` imports it.
- All styling via existing tokens (`bg-surface-1`, `border-border`, `text-gold`, `font-mono`, `font-serif`). No new CSS variables, no hardcoded colors.
- Mobile: single column for Apply, scrollable filter chip row for Applications, table degrades to a stacked row list on `<sm` for Loans.
- No changes to `routeTree.gen.ts`, route files' loaders/`beforeLoad`, or any `*.functions.ts`.

## Out of scope

- Backend, server functions, Prisma, loan service, auth, routing.
- Deal room chat (already done).
- Editorial pass on Exchange / Terminal / Governance / Profile / etc.
- Adding new loan fields, new statuses, or new product types.

## Order of work

1. `application-summary-card.tsx` + refactor `LendingApplyForm` state hook → 2. `lending-apply-shell.tsx` and rewire `apply.tsx` → 3. `lending-applications-list.tsx` and rewire `applications.tsx` → 4. `lending-loans-table.tsx` and rewire `loans/index.tsx` → 5. Mobile QA across all three.
