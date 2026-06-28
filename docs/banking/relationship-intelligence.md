# Relationship Intelligence

Relationship Intelligence is Alta’s read-only customer relationship profile system. It aggregates real platform data into a single score, tier, and factor breakdown for staff review and a limited customer-facing summary.

**V1 is intelligence only.** It does not auto-approve products, change Alta Card limits, modify loan decisions, or enroll customers in Alta Private.

---

## Purpose

Every Alta user can have a **Relationship Profile** that consolidates:

- Bank account balances and activity
- Alta Card exposure and payment history
- Loan balances and repayment behavior
- Alta Pay volume (bank transaction descriptions)
- Business banking and company verification
- Alta Private client status (tag-based)

This profile supports:

- Relationship score (0–1000, not a credit score)
- Relationship tier
- Private banking eligibility signal
- Admin/customer relationship overview
- Future pre-approval and recommendation surfaces
+ V2 read-only product recommendations (see below)

---

## V2 — Recommendations & pre-approvals

Relationship Intelligence V2 generates **read-only** `RelationshipRecommendation` rows from persisted profiles. Admins review, dismiss, or accept — **nothing auto-applies** to products, limits, rates, loans, or private enrollment.

### `RelationshipRecommendation`

| Field | Purpose |
|-------|---------|
| `recommendationType` | Alta Card tier/limit/rate, loan pre-approval, private invite, product opportunity |
| `status` | `ACTIVE`, `REVIEWED`, `DISMISSED`, `ACCEPTED`, `EXPIRED` |
| `confidenceScore` | 0–100 internal signal (admin-only) |
| `recommendedTier` / `recommendedLimit` / `recommendedRate` | Suggested values |
| `reasons` | JSON bullets + optional `actionPath` deep link |

Rules live in `src/lib/bank/relationship-recommendation-config.ts`.

### Recommendation engine

`src/server/relationship-intelligence-recommendation.service.ts`

| Function | Description |
|----------|-------------|
| `generateRelationshipRecommendations(userId)` | Expire prior `ACTIVE`, create new rows, audit |
| `getRelationshipRecommendations(userId)` | Admin list |
| `getCustomerRelationshipOpportunities(userId)` | Sanitized customer copy |
| `dismissRelationshipRecommendation` | Mark dismissed |
| `markRecommendationReviewed` | Mark reviewed |
| `acceptRelationshipRecommendation` | Mark accepted — **does not mutate products** |
| `refreshRecommendationsForAllProfiles()` | Batch regenerate |

Regeneration runs automatically after `refreshRelationshipProfile` (best-effort).

Scheduler: `refreshRelationshipRecommendationsScheduled()` in `relationship-intelligence-recommendation-scheduler.service.ts` (**not wired to production cron**).

### Pre-approval logic (read-only)

- **Alta Card tier:** Preferred → Navy, Premier → Black, Private → Gold
- **Limit:** Assets, score, exposure, payment history
- **Rate:** Score discount; Gold/private = negotiable floor
- **Loan pre-approval:** Score ≥ 500, no delinquency/default, assets or deposit activity
- **Private invite:** Eligibility flag, score + assets, or business + Alta Pay volume
- **Product opportunities:** Missing Alta Card, business lending when volume high

### Admin review workflow

- Full panel: `/internal/relationships/$userId` → **Recommendations**
- Actions: **Review**, **Dismiss**, **Accept / Apply**
- **Accept** records audit + deep links only:
  - Alta Card → `/internal/alta-card/$cardId?suggestedTier=&suggestedLimit=&suggestedRate=` (prefill ops panel)
  - Loans → `/internal/lending?preApprovalUserId=`
  - Private → `/internal/users/$userId?privateReview=true` (tag panel placeholder)

Widgets on internal Alta Card detail, card application/review, lending application thread, loan detail, user detail.

### Customer-facing opportunities

`/bank/relationship` shows limited messages (e.g. eligible for Alta Private review). **Never** shows confidence, negative factors, or formulas.

### V2 audit events

| Action | When |
|--------|------|
| `RELATIONSHIP_RECOMMENDATIONS_GENERATED` | Batch/single generation |
| `RELATIONSHIP_RECOMMENDATION_REVIEWED` | Admin marked reviewed |
| `RELATIONSHIP_RECOMMENDATION_DISMISSED` | Admin dismissed |
| `RELATIONSHIP_RECOMMENDATION_ACCEPTED` | Admin accepted (follow-up manual) |

---

## Data model (V1)

### `RelationshipProfile`

One row per user (`userId` unique). Stores latest aggregated metrics and score/tier.

Key fields: `relationshipSince`, `relationshipScore`, `relationshipTier`, `privateBankingEligible`, `privateBankingClient`, asset/lifetime totals, active balances, `currentCreditExposure`, `lastCalculatedAt`.

### `RelationshipProfileSnapshot`

Historical snapshot written on each refresh for trend/changelog analysis. Optional `metadata` JSON includes factor count, products held, and prior score/tier.

### `RelationshipTier`

| Tier | Rule (V1) |
|------|-----------|
| `NEW` | Score &lt; 250 |
| `STANDARD` | 250–499 |
| `PREFERRED` | 500–699 |
| `PREMIER` | 700–849 |
| `PRIVATE_ELIGIBLE` | Score ≥ 850 and assets threshold met |
| `PRIVATE_CLIENT` | User has `private_client` tag (overrides display tier) |

---

## Data sources

All calculations use **existing Prisma data only**:

| Metric | Source |
|--------|--------|
| Bank assets | Sum of active `BankAccount.balance` (personal + company accounts via membership) |
| Investments | `0` placeholder until Exchange/Terminal balances exist |
| Lifetime deposits / withdrawals | Approved `BankTransaction` DEPOSIT / WITHDRAWAL |
| Interest earned | Approved `INTEREST_CREDIT` bank transactions |
| Interest paid | Loan payment interest applied + Alta Card statement interest charged |
| Alta Pay volume | Approved bank transactions with “Alta Pay” in description (sent + business received) |
| Loan / card payments | `LoanPayment` totals, Alta Card `PAYMENT` transactions |
| Active balances | Active/frozen/delinquent loans and Alta Cards |
| Relationship since | Earliest of user signup, first account, loan, card, or application |
| Private client | `UserTag.PRIVATE_CLIENT` via `isPrivateClient()` |
| Private eligible | Score ≥ 850 **and** total Alta assets ≥ $250,000 (configurable) |

Negative factors: delinquent cards, defaulted loans, overdue installments, failed autopay, restricted/frozen personal accounts, non-active user status.

Weights live in `src/lib/bank/relationship-intelligence-config.ts`.

---

## Service API

`src/server/relationship-intelligence.service.ts`

| Function | Description |
|----------|-------------|
| `getRelationshipProfile(userId)` | Persisted profile (if exists) |
| `calculateRelationshipProfile(userId)` | Live calculation + factor breakdown |
| `refreshRelationshipProfile(userId, actorUserId?)` | Persist profile, write snapshot, audit |
| `refreshAllRelationshipProfiles()` | Batch refresh (scheduler) |
| `refreshAllRelationshipProfilesAdmin(actorUserId)` | Operator-gated batch |
| `getRelationshipSnapshot(userId)` | Latest snapshot |
| `getRelationshipFactors(userId)` | Factor list from calculation |
| `getCustomerRelationshipView(userId)` | Sanitized customer view |
| `getRelationshipProfileSummary(userId)` | Admin summary card |
| `getRelationshipIntelligenceDashboard()` | Internal dashboard metrics |
| `getAdminRelationshipDetail(userId)` | Full admin detail page |

Scheduler hook: `refreshRelationshipProfilesScheduled()` in `src/server/relationship-intelligence-scheduler.service.ts` (uses `OpsJobRun`, **not wired to production cron yet**).

---

## Admin usage

- Dashboard: `/internal/relationships`
- Customer profile: `/internal/relationships/$userId`
- **Refresh Relationship Profile** button persists latest calculation
- Summary cards embedded on:
  - Internal user detail
  - Internal Alta Card detail
  - Internal Alta Card application / review
  - Internal loan detail

---

## Customer usage

- `/bank/relationship` — tier, relationship since, total Alta assets, products held
- Private eligibility message when applicable
- **Does not** expose negative factors, weights, or internal risk detail

---

## Audit events

| Action | When |
|--------|------|
| `RELATIONSHIP_PROFILE_CREATED` | First refresh |
| `RELATIONSHIP_PROFILE_REFRESHED` | Every refresh |
| `RELATIONSHIP_SCORE_CHANGED` | Score delta |
| `RELATIONSHIP_TIER_CHANGED` | Tier delta |
| `PRIVATE_BANKING_ELIGIBILITY_CHANGED` | Eligibility delta |

Metadata includes `userId`, `oldScore`, `newScore`, `oldTier`, `newTier`, `actorUserId` or `SYSTEM`.

---

## Safety

- Read-only intelligence — no automatic product changes
- Private client status read from tag; never auto-granted
- Idempotent refresh (upsert by `userId`)
- Graceful handling for users with no banking/card/loan data

---

## V3 — Relationship timeline & product history

Relationship Intelligence V3 adds a **Relationship Timeline** — a chronological history of how a customer's Alta relationship developed. History only; no product mutations.

### `RelationshipTimelineEvent`

| Field | Purpose |
|-------|---------|
| `eventType` | See enum below |
| `title` / `description` | Human-readable event |
| `occurredAt` | When the event happened (from source record when backfilling) |
| `relatedEntityType` / `relatedEntityId` | Optional link to account, card, loan, application |
| `metadata` | Dedupe keys, milestone category, manual note actor |

### Event types

`RELATIONSHIP_STARTED`, `BANK_ACCOUNT_OPENED`, `BUSINESS_ACCOUNT_OPENED`, deposit/withdrawal/Alta Pay milestones, Alta Card events, lending lifecycle events, private banking events, relationship score/tier changes, `MANUAL_NOTE`.

### Service API

`src/server/relationship-timeline.service.ts`

| Function | Description |
|----------|-------------|
| `getRelationshipTimeline(userId)` | Full admin timeline |
| `getCustomerRelationshipTimeline(userId)` | Sanitized customer view |
| `getRelationshipTimelineSummary(userId)` | Summary stats for admin profile |
| `createRelationshipTimelineEvent(input)` | Idempotent create with dedupe |
| `recordRelationshipTimelineEvent(input)` | Safe integration wrapper |
| `backfillRelationshipTimeline(userId)` | Rebuild from platform records |
| `backfillAllRelationshipTimelines()` | Batch backfill |
| `createMilestoneEvents(userId)` | Volume/asset milestone detection |
| `createManualRelationshipNote(userId, input, actorUserId)` | Internal admin note |
| `syncRelationshipProfileTimelineEvents(...)` | Live sync on profile refresh |

### Backfill behavior

Backfill uses **real records only** — user signup, bank accounts, Alta Cards, audit tier changes, loan applications/loans, private client tags, profile snapshots. Skips events when source data is unavailable. Idempotent via `dedupeKey` metadata.

### Milestone rules

Thresholds in `src/lib/bank/relationship-timeline-config.ts`:

- Total Alta assets: ƒ10k – ƒ1M (from profile snapshots when available)
- Lifetime deposits / withdrawals / Alta Pay: cumulative transaction history

Milestones are not duplicated (`dedupeKey: milestone:{category}:{threshold}`).

### Customer vs internal visibility

**Customers** (`/bank/relationship`): positive/neutral events only — no manual notes, delinquency, denials, or internal score commentary.

**Admins** (`/internal/relationships/$userId`): full timeline + manual notes + entity deep links.

### V3 audit events

| Action | When |
|--------|------|
| `RELATIONSHIP_TIMELINE_EVENT_CREATED` | Any timeline event |
| `RELATIONSHIP_TIMELINE_BACKFILLED` | Backfill completed |
| `RELATIONSHIP_MANUAL_NOTE_CREATED` | Admin manual note |

Live integrations (best-effort): bank account opened, Alta Card opened/tier/limit changed, loan application submitted, loan accepted/denied/funded/paid off, profile score/tier/eligibility changes.

---

## V4 — Product integration

Relationship Intelligence V4 surfaces the profile, recommendations, and product holdings across Alta Bank admin flows. **Nothing auto-applies** — operators review context and confirm every decision manually.

### Integration contexts

| Context | Routes | Purpose |
|---------|--------|---------|
| `ALTA_CARD` | Card detail, applications, reviews | Tier/limit/rate review, Gold eligibility |
| `LENDING` | Lending queue, application thread, loan detail | Manual underwriting, pricing, exposure |
| `PRIVATE_BANKING` | `/bank/private`, internal relationship profile | Eligibility + private client review |
| `CUSTOMER_PROFILE` | `/internal/users/$userId` | Central operator view |

Context filters live in `src/lib/bank/relationship-integration-config.ts`.

### Reusable components

| Component | Location |
|-----------|----------|
| `RelationshipIntelligencePanel` | Summary metrics (score, tier, assets, exposure) |
| `RelationshipRecommendationPanel` | Context-filtered recommendations + **Use Recommendation** |
| `RelationshipProductHoldingsPanel` | Unified product holdings |
| `PreApprovalReadinessPanel` | Future pre-approval readiness (internal only) |
| `RelationshipIntelligenceOperatorPanel` | Full operator hub on user detail |
| `RelationshipQueueCell` | Queue list score/tier + profile link |

**Use Recommendation** calls `useRelationshipRecommendationRecord` → audits `RELATIONSHIP_RECOMMENDATION_USED`, marks recommendation reviewed, returns prefill values only. Admin must still submit approval with reason (existing audit on card/loan actions).

### Alta Card integration

- `/internal/alta-card/$cardId` — full panel + recommendation prefill into ops controls
- `/internal/alta-card/applications`, `/applications/$applicationId`, `/reviews`, `/reviews/$reviewId` — intelligence summary + recommendations
- Queue lists show score/tier column with link to full relationship profile

Suggested tier, limit, rate, reasons, and confidence shown when recommendations exist. **Not applied automatically.**

### Lending integration

- `/internal/lending` — queue column + callout
- `/internal/lending/applications/$applicationId/thread` — lending signals + pre-approval readiness placeholder
- `/internal/lending/loans/$loanId` — borrower relationship block

**Future Pre-Approval Readiness** section shows eligible / not eligible / needs review via `getPreApprovalReadiness(userId)`. No loan offers generated.

### Alta Private integration

**Customer** (`/bank/private`):

- Private client → “Alta Private Client”
- Eligible → “You may be eligible for Alta Private review.”
- Not eligible → aspirational copy only (no rejection/risk factors)

**Internal** — eligibility factors, assets, score, tier, product mix, recommended action on relationship profile and user detail. Private client tag changes audit `PRIVATE_BANKING_CLIENT_MARKED` / `PRIVATE_BANKING_CLIENT_REMOVED` (requires confirmation + reason).

### Internal customer profile

`/internal/users/$userId` — `RelationshipIntelligenceOperatorPanel` with:

- Relationship summary, assets, lifetime activity, credit exposure
- Product holdings, context recommendations, timeline preview
- Quick links: full profile, Alta Card, lending, bank accounts, Alta Pay, companies

### Product holdings

`getProductHoldingsSummary(userId)` — real data: bank accounts, Alta Card status/tier, business cards, active/paid-off loans, company memberships, private client status. Exchange/Terminal placeholders only.

### Service API (V4)

`src/server/relationship-intelligence-integration.service.ts`

| Function | Description |
|----------|-------------|
| `getRelationshipIntelligencePanel(userId)` | Full panel data for admin surfaces |
| `getProductHoldingsSummary(userId)` | Unified holdings |
| `getRecommendationsForContext(userId, context)` | Filtered active recommendations |
| `getPreApprovalReadiness(userId)` | **Stub** — eligible, readinessStatus, reasons, blockers, suggestedProducts placeholder |
| `getRelationshipIntegrationBundle(userId, context)` | Panel + recommendations + optional lending signals |
| `useRelationshipRecommendation(...)` | Audit + prefill (no product mutation) |
| `recordPreApprovalReadinessViewed(...)` | Audits explicit readiness view |

### V4 audit events

| Action | When |
|--------|------|
| `RELATIONSHIP_RECOMMENDATION_USED` | Admin clicked Use Recommendation |
| `RELATIONSHIP_PREAPPROVAL_READINESS_VIEWED` | Explicit readiness panel action |
| `PRIVATE_BANKING_CLIENT_MARKED` | Private client tag granted |
| `PRIVATE_BANKING_CLIENT_REMOVED` | Private client tag revoked |

`RELATIONSHIP_INTELLIGENCE_VIEWED` is **not** logged on every page load (too noisy).

### V4 safety rules

- No auto-approve loans, card limits, tiers, rates, or private enrollment
- No customer-facing pre-approved loan offers
- No Discord bot integration
- Customer copy: positive, opportunity-oriented — no “credit score”, “rejected”, or risk grades
- Internal copy may be direct; full scores and factors operator-only

---

## Company Relationship Intelligence

Companies have **independent** Relationship Profiles, separate from owner personal profiles.

### Owner-only company inclusion (personal profiles)

Personal Relationship Profiles include company activity **only when the user is an OWNER** of that company (`CompanyRole.OWNER`).

| Included in personal profile | Excluded from personal profile |
|------------------------------|--------------------------------|
| Personal bank accounts, loans, Alta Cards, Alta Pay | Non-owner company memberships (executive, finance manager, employee) |
| **Owned** company business accounts, loans, cards, Alta Pay | Employee-only or finance-manager business activity |
| Verified owned companies count toward products held | Company balances for companies the user does not own |

Company Relationship Profiles remain **company-scoped only** — they never mix owner personal activity.

Internal admin views may still show associated companies as context; personal scoring does not blend non-owner company balances.

### Data isolation (company profile)

| Included (company) | Excluded (personal) |
|--------------------|---------------------|
| Business bank accounts | Owner personal accounts |
| Business loans & Alta Cards | Personal loans & cards |
| Company Alta Pay on business accounts | Personal Alta Pay |
| Company deposits/withdrawals/interest | Owner personal activity |

### Models & services

- `CompanyRelationshipProfile`, snapshots, recommendations, timeline events
- `company-relationship-intelligence.service.ts` — score, refresh, customer/admin views
- `company-relationship-recommendation.service.ts` — business-only recommendations
- `company-relationship-timeline.service.ts` — business timeline + backfill

### Routes

- Customer: `/companies/$companyId/relationship`
- Internal: `/internal/companies/$companyId/relationship`
- Summary on `/internal/companies/$companyId`

### Company recommendation types

`BUSINESS_ALTA_CARD_LIMIT`, `BUSINESS_ALTA_CARD_RATE`, `BUSINESS_LOAN_OPPORTUNITY`, `TREASURY_PRODUCT_OPPORTUNITY` (placeholder), `COMMERCIAL_BANKING_ELIGIBILITY`

---

## Production readiness (V5)

### Authoritative scoring

- **V2 Relationship Intelligence (0–1000)** is the authoritative score everywhere operator-facing.
- Legacy Alta Card 0–100 relationship pricing remains internal/deprecated in `alta-card-relationship-pricing.service.ts` only — operator Alta Card pages use RI V2 integration blocks.

### Scheduled refresh (cron)

Relationship Intelligence refresh runs inside the existing **`/api/cron/scheduled-transfers`** job (same cron as scheduled transfers, payroll, loan servicing, Alta Card billing, etc.):

| Job | Service |
|-----|---------|
| Personal profile refresh | `refreshRelationshipProfilesScheduled()` |
| Personal recommendations | `refreshRelationshipRecommendationsScheduled()` |
| Company profile refresh | `refreshCompanyRelationshipProfilesScheduled()` |
| Company recommendations | `refreshCompanyRelationshipRecommendationsScheduled()` |

- Uses **SYSTEM/CRON** actor via `resolveAuditActorId()` — never impersonates a human admin.
- Each RI sub-job is wrapped in try/catch so failures do not block other cron work.
- `OpsJobRun` entries recorded per job key when available.

### Event-driven refresh (best-effort)

`relationship-refresh-hooks.service.ts` triggers non-blocking profile refresh after high-signal events:

- Bank account opened, deposit approved, withdrawal approved
- Loan application accepted/denied, loan funded, loan payment, loan paid off
- Alta Card opened, payment made, delinquency changed
- Alta Pay completed
- Business account/card/loan events (company stack + owner personal sync)

Failures are logged; primary user actions are never blocked.

### Recommendation lifecycle

- On regeneration, only **ACTIVE** recommendations of **superseded types** are expired.
- **REVIEWED**, **ACCEPTED**, and **DISMISSED** recommendations are preserved.
- Prefill / “Open workflow” records `RELATIONSHIP_RECOMMENDATION_USED` with recommendationId, context, and actor.

### Snapshot retention

- Snapshots written only on **material** score/tier/asset/exposure/eligibility changes.
- At most **52 snapshots** retained per profile (personal or company); older snapshots pruned after each write.
- Policy: `src/lib/bank/relationship-snapshot-policy.ts`

### Customer vs internal visibility

- **Personal customer timeline**: positive/neutral allowlist (`relationship-timeline-config.ts`).
- **Company customer timeline**: positive/neutral allowlist (`company-relationship-timeline-config.ts`) — hides score penalties, denials, internal notes, negative risk events.
- Full factors, negative events, and manual notes: operator/admin only.

### Service-layer auth

- Customers: own personal profile only; company members: authorized company profiles only.
- Refresh/generate/backfill: operator/admin or SYSTEM/cron paths.
- `getRelationshipFactors` enforces self-or-operator at service layer.

### Manual test checklist

1. **Overdue penalty**: Create overdue loan installment → refresh personal profile → score decreases (not floored to zero).
2. **Multiple overdue installments**: Penalty scales up to cap.
3. **Delinquent Alta Card / failed autopay**: Negative factors apply; score decreases.
4. **Alta Pay single count**: Personal `lifetimeAltaPayVolume` matches one scoped aggregation (no double-count on owned-company deposits).
5. **Owner inclusion**: User who **owns** a company sees that company’s deposits/loans/cards in personal profile.
6. **Non-owner exclusion**: Finance manager / employee without OWNER role does **not** see employer company activity in personal profile.
7. **Company loan exposure**: `activeLoanBalance` uses payoff once (`outstandingBalance + accruedInterest`), not triple-counted.
8. **Company timeline customer view**: Only allowlisted positive/neutral events visible.
9. **Recommendation lifecycle**: Regenerating does not expire in-review recommendations; supersedes same-type ACTIVE only.
10. **Timeline dedupe**: Repeated tier/limit changes on same card allowed when dedupeKey differs.
11. **Cron**: Hit `/api/cron/scheduled-transfers` → `relationshipIntelligence` summary in response.
12. **Nav**: `/bank/relationship` discoverable in Bank sub-nav.

---

## Future integrations (TODO)

- Exchange / Terminal investment balances in `totalInvestments`
- Dedicated Alta Pay per-user analytics (reduce description-string matching)
- Dedicated loan pre-approval workflow page (currently lending queue placeholder)
- **Pre-Approved Loans** product workflow
- **Discord bot** payment/notification integration
- Promotions engine
- Relationship manager assignment on company 360
- Advanced performance optimization (incremental refresh, caching)

---

## Related code

- Config: `src/lib/bank/relationship-intelligence-config.ts`
- Integration config: `src/lib/bank/relationship-integration-config.ts`
- Recommendation config: `src/lib/bank/relationship-recommendation-config.ts`
- Types: `src/lib/bank/relationship-intelligence-types.ts`
- Integration service: `src/server/relationship-intelligence-integration.service.ts`
- Timeline: `src/server/relationship-timeline.service.ts`
- Timeline config: `src/lib/bank/relationship-timeline-config.ts`
- Alta Card relationship pricing (legacy 0–100 score): `src/server/alta-card-relationship-pricing.service.ts` — separate from V1/V2 profile; may converge later
