
# Alta — Premium Editorial Pass

Alta Bank is the institution; **Alta Private** is one division. The polish target is "private-bank caliber across the whole bank," but the *Private* name and voice are reserved for the Private division surfaces. Everywhere else reads as Alta Bank (institutional, modern, confident) — not Alta Private.

The logo is navy ink + a gold arc on ivory, so the visual system stays in that family. No new design system, no rebrand — refine tokens, then deeply rework Lending, then rebuild Deal Rooms as a modern agent chat.

## Brand voice & labeling (clarified)

- Default chrome, headers, and microcopy across the site = **Alta Bank**. Eyebrows like "Alta Bank · Lending", "Alta Bank · Markets", etc.
- **Alta Private** voice (serif-forward, "your relationship manager", concierge tone) is used only on Private-division surfaces — e.g. eligible private-client dashboards, the private client section of Profile, and any product card explicitly tagged as a Private offering.
- The Alta Private split-screen login from the previous priority pass stays for the Private route, but the default login experience belongs to Alta Bank — not Private. (No code change to login is part of this plan unless the user asks; flagging only for naming consistency.)
- Lending is an **Alta Bank** product surface. The Credit Desk wording stays, but no "Private" branding on application, products, loans, or deal rooms unless the underlying product is a Private offering.
- Deal Room officer is an "Alta credit officer" (Alta Bank), not a "private banker."

## 1. Global system refinement

Touch tokens once, every page benefits.

- **Type scale**: serif headers paired with a tighter editorial ramp (h1 56/60, h2 40/44, h3 28/32, eyebrow mono 11/16 +0.18em). Body sans, slightly looser leading.
- **Color / surface**: ivory + navy + gold. Add `--surface-3` (deeper ivory) for sectioning, `--ink-soft` for secondary text, and a true `--hairline` token for 1px dividers. Replace heavier `border` usage on cards with hairlines.
- **Radius**: standardize on 6 / 10 / 14 (controls / cards / modals).
- **Shadows**: `--shadow-hairline` (subtle inset) and `--shadow-elevated` (soft Y-shadow with 6% navy tint).
- **Motion**: `--ease-editorial` cubic-bezier + 180ms standard. Applied to button, link, tabs, sub-nav, dialog. No springy motion.
- **Cards / tables / dialogs**: refactor `Card`, `Table`, `Dialog` to the hairline editorial system; opt-in `variant="elevated"` for shadow.
- **Section spacing**: 96px desktop / 56px mobile rhythm.

Files: `src/styles.css`, `src/components/ui/card.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/table.tsx`, `src/components/page-shell.tsx`, `src/components/typography.tsx`, `src/lib/typography.ts`.

## 2. Section-by-section editorial pass

Same vocabulary applied everywhere. No route or IA changes.

- **Home (`/`)**: editorial Alta Bank hero, serif headline, gold rule, three-up product proof, hairline footer.
- **Bank**: dashboard cards re-skinned to institutional statement look (account numbers in mono, balances via `Florin`).
- **Exchange + Terminal**: stat cards, watchlist, leaderboard, news, research re-skinned to shared table + card system. No layout changes.
- **Governance**: leadership / entity overview re-typeset with editorial serif intros and hairline dividers.
- **Internal**: tables and stat cards inherit shared components; filter bars get new control styles.
- **Profile / Companies / Markets**: typography, hairlines, button styles only. Profile's private-client section keeps Private voice; everything else is Alta Bank.

No business logic, routing, or auth changes.

## 3. Lending — deeper rework (highest priority)

Keep all routes and logic intact. Rework presentation across the five lending surfaces. Branded as **Alta Bank · Credit Desk** (not Private).

### `/bank/lending` (overview)
- Editorial hero: "Alta Bank Credit Desk", short lede, two CTAs (Apply, View facilities).
- Three product summary cards (Personal credit line, Business term, Bridge / structured) in hairline editorial style.
- Below: "Your facilities" — institutional table replacing current card grid.

### `/bank/lending/apply` (most work)
Full rework into a premium multi-step.
- Two-column desktop: left = step content, right = sticky **Application Summary** card (live preview of amount, term, est. rate, monthly est., assigned officer).
- Steps as hairline progress rail (mono labels): `Product → Amount & Term → Purpose → Profile → Review`.
- Inputs use the existing Alta input system; inline helper + validation in mono micro-caps.
- Review step shows a term-sheet–style preview block (`ReceiptBlock` + `Florin`) before submit.
- Mobile: single column, sticky bottom action bar with summary chip that expands to a sheet.

### `/bank/lending/products`
Editorial product detail cards: serif name, eyebrow tag, rate band, term band, eligibility list, "Start application" link. Hairline dividers, no shadow.

### `/bank/lending/loans` (My Loans) + loan detail
- List: institutional table — Facility ID (mono), product, principal (Florin), rate, next payment, status badge.
- Detail: hairline underline tabs — Overview, Schedule, Statements, Autopay. Schedule = dense table with tabular numerics; current row gets a gold left-border.

### `/bank/lending/deal-rooms` (directory)
Editorial list (not card grid): row = counterparty + product + status badge + last-activity timestamp + officer initials, hairline divider, hover tint. Filter chips above.

### Internal `/internal/lending/deal-rooms`
Picks up new table styles; Actions menu re-skinned. No logic change.

## 4. Deal Room → modern agent chat (rebuild)

Single-pane chat with a deal context rail.

### Layout
```text
Desktop (≥lg):
┌──────────────────────────────────────────┬─────────────────────┐
│ Header: counterparty · product · status  │ Deal Context Rail   │
│ ──────────────────────────────────────── │ ───────────────────│
│                                          │ Summary             │
│   Chat transcript (AI Elements)          │ Terms (req vs Alta) │
│   - officer / applicant / system         │ Documents           │
│   - inline cards (term sheet, document,  │ Timeline            │
│     status, signature)                   │ Officer             │
│                                          │                     │
│ ──────────────────────────────────────── │                     │
│ Composer (PromptInput, attach, send)     │                     │
└──────────────────────────────────────────┴─────────────────────┘

Mobile:
- Chat full-screen.
- Sticky top: counterparty + status + "Deal" button.
- "Deal" opens a bottom sheet with the rail (Summary, Terms, Documents, Timeline).
```

### Implementation
- Install AI Elements: `bun x ai-elements@latest add conversation message prompt-input shimmer`.
- Build `DealRoomChat` from `Conversation`, `Message` + `MessageContent` + `MessageResponse`, `PromptInput` + `PromptInputTextarea` + `PromptInputFooter` + `PromptInputSubmit`.
- Roles: `officer` (Alta credit officer), `applicant`, `system`. Officer messages on the left with a small Alta gold mark avatar; applicant on the right as a navy-on-ivory bubble; system as centered hairline meta lines ("Term sheet v2 issued", "Documents requested").
- **Inline cards** as custom `message.parts` types (mocked):
  - `term-sheet-card` — compact terms grid + "View term sheet" link to rail.
  - `document-request-card` — requested docs with "Upload" placeholder buttons.
  - `status-card` — status transitions with gold rule.
  - `signature-card` — ready-for-signature CTA.
- Composer is UI-only. Submitting appends an optimistic applicant message + a `Shimmer` "Officer is reviewing…" then a canned reply from mock data. No websockets, no AI gateway calls.
- Deal Context Rail = condensed `TermsBlock`, `DealTimeline`, documents list, officer card. Collapsible sections with hairline headers.

### Files
- New: `src/components/bank/deal-room/deal-room-chat.tsx`, `deal-context-rail.tsx`, `inline-cards.tsx`, `mobile-deal-sheet.tsx`.
- Update: `src/routes/bank/lending/deal-rooms/$dealRoomId.tsx` to use the new chat layout.
- Update: `src/lib/bank/deal-rooms-mock.ts` to add per-room `messages` with mixed text + inline-card parts and canned officer replies.
- Keep: existing `deal-room-bits.tsx` exports reused inside the rail.

## 5. Non-goals (explicit)

- No backend, websockets, AI calls, e-signature, or contract generation.
- No new design system or rebrand — same Alta tokens, refined.
- No auth, routing, lending business logic, Prisma, or server function changes.
- No relabeling of non-Private surfaces as "Alta Private" — Lending and the rest stay Alta Bank.

## 6. Order of execution

1. Tokens + shared primitives.
2. Lending rework (overview → apply → products → loans → deal-rooms directory).
3. Deal Room chat rebuild.
4. Editorial pass on remaining sections (Home, Bank, Exchange, Terminal, Governance, Internal, Profile, Companies, Markets).
5. Mobile QA pass.

## Final summary

- Site-wide premium editorial polish on Alta Bank, with Private voice scoped to Private division surfaces only.
- Significantly deeper Lending rework, especially Apply.
- Deal Rooms rebuilt as a single-pane AI-Elements agent chat with a deal context rail (mocked, UI-only).
- All routing, auth, and lending logic preserved.
