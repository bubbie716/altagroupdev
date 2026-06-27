# Alta Private

Alta Private is Alta Bank's invitation-only private banking relationship — distinct from public Alta Card tiers and standard retail products.

## Core relationship

Alta Private clients receive access to relationship-managed financial services, including:

- Negotiated credit and custom lending facilities
- Preferred pricing across banking and card products
- Priority review for applications and account requests
- Dedicated banker support
- Invitation-only products such as the **Alta Gold Card**

Membership is extended by referral. Benefits are subject to relationship review — Alta Private does not guarantee approval of any requested terms.

## Alta Gold Card

**Alta Gold is Alta Private-only.** It is not a public Alta Card tier and cannot be selected through the standard application flow.

| Attribute | Detail |
|-----------|--------|
| Availability | Invitation-only · Alta Private clients |
| Limits & rates | Negotiated · relationship pricing |
| How to request | **Request Account Review** on an existing Alta Card (`/bank/alta-card/$cardId/review`) |
| Approval | Manual · reviewed by Alta Private · never auto-approved |

Gold tier upgrades (Black → Gold) are available only to `private_client` tag holders. Non–private clients see an Alta Private upsell on the review form and on `/bank/private`.

See also: [Alta Card — Request Account Review](./alta-card.md#request-account-review)

## Relationship pricing

Preferred pricing may reflect the client's total Alta relationship:

- Bank balances and deposit activity
- Loan history
- Alta Pay activity (when available in scoring)
- Business accounts
- Future investment holdings

Illustrative benefits (not guaranteed):

- Lower card rates
- Higher credit limits
- Preferred lending rates
- Custom repayment terms
- Priority underwriting

Pricing is reviewed with the dedicated banker. Published tier defaults do not apply to Alta Gold.

## Negotiated lending

Private clients may receive custom lending terms, larger credit facilities, flexible collateral review, and banker-assisted structuring across:

- Personal lending
- Business lending
- Alta Card credit limits
- Future secured / portfolio-backed credit

## Dedicated banker

Relationship-managed support covers banking, lending, payments, Alta Card account reviews, and future capital markets services.

Banker assignment follows Alta Private onboarding. Contact details appear on `/bank/private` when relationship data is available.

## Higher transfer limits

Expanded transfer, payment, and Alta Pay limits may be granted based on account history and relationship review. Limits are relationship-based — not published as standard tiers.

## Priority application review

Private clients receive priority routing for:

- Alta Card requests and account reviews
- Loan applications
- Business banking requests
- Future exchange and capital markets services

Priority review does not guarantee approval.

## Bespoke financial services (future)

Relationship-based capabilities under development include portfolio-backed credit, private placements, custom credit facilities, business treasury support, merchant/payment advisory, and capital markets introductions.

## UI

- Private banking page: `/bank/private`
- Section components: `src/components/bank/alta-private/alta-private-benefits.tsx`
- Page route: `src/routes/bank/private.tsx`

Authenticated users may view `/bank/private` to explore benefits; personal relationship data and banker contact require `private_client` status.
