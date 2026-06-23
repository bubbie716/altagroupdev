# Alta Companies & Memberships

Companies and institutions are **registered entities** on Alta. They do not authenticate directly. Individual users log in with Discord and act on behalf of companies through **authorized representative memberships**.

## Concept

```
Discord User
  └── CompanyMembership (role)
        └── Company (entity)
```

A user may belong to **multiple companies** with different roles on each.

## Routes

| Route | Access | Purpose |
|-------|--------|---------|
| `/companies` | Authenticated | Dashboard of user's companies |
| `/companies/create` | Authenticated | Register a new company |
| `/companies/$companyId` | Company member | Workspace overview |
| `/companies/$companyId/members` | Company member | View/manage representatives |
| `/companies/$companyId/settings` | Owner only | Edit company profile |

Navigation: **Account → Companies** (logged-in users only).

## Company lifecycle

1. User submits **Create Company** form.
2. `Company` row created with `status: PENDING`, `verificationStatus: UNVERIFIED`.
3. Creator receives `CompanyMembership` with role `OWNER`.
4. Alta operations may later verify the entity and assign an official `ticker`.
5. Future modules (banking, IPO, issuer portal, API) unlock after verification and product-specific approval.

### Profile fields (`Company`)

| Field | Editable by owner | Notes |
|-------|-------------------|-------|
| `name`, `sector`, `description`, `headquarters` | Yes | Settings page |
| `desiredTicker` | Yes, until official `ticker` assigned | Request only |
| `ticker` | No (operations) | Official listing symbol |
| `status`, `verificationStatus` | No (operations) | Internal admin |

## Role matrix

| Role | View company | Manage members | Edit settings | Future modules |
|------|--------------|----------------|---------------|----------------|
| **Owner** | Yes | Yes (full) | Yes | All (when live) |
| **Executive** | Yes | Yes (not owner role/transfer) | No | Operational |
| **Finance Manager** | Yes | No | No | Business banking / finance |
| **Compliance Contact** | Yes | No | No | Filings / compliance |
| **Viewer** | Yes | No | No | Read-only |

Permission helpers: `canManageCompany`, `canAccessIssuerPortal`, `isCompanyOwner`, etc. in `src/lib/auth/permissions.ts`.

### Member management rules (implemented)

- **Owner** may change roles and remove members, except cannot remove the sole owner.
- **Executive** may manage members only below executive rank (not owners or other executives).
- New members are added only via **Send invitation** — no direct add flow.
- At least one **Owner** must remain on every company.

## Invitation system

Company invitations are stored in `CompanyInvitation` and appear on the invitee's **`/companies`** dashboard.

### Sending invitations

From **Members → Invite authorized representative**, **Send invitation** creates a pending `CompanyInvitation` (30-day expiry). The invitee must accept on their Companies page — there is no direct add flow.

### Accepting invitations

Pending invitations appear at the top of `/companies` with **Accept** and **Decline** actions. Accepting creates a `CompanyMembership` with the invited role.

Invitations match the logged-in user by:

- `invitedUserId`
- `invitedDiscordId`
- `invitedDiscordUsername` (case-insensitive)

### Future Discord bot integration

When the Alta Discord bot ships, invitations should also trigger:

1. **Discord DM** to the invitee with company name, role, and link to `/companies`.
2. **Admin channel log** in the Alta operations Discord server.
3. **Acceptance confirmation** — notify the inviting owner after membership is created.

```typescript
// TODO(bot): dispatch invitation after CompanyInvitation insert
// await discordBot.sendCompanyInvite({ ... })
```

## IPO / listing dependency

IPO applications and issuer portal access depend on:

1. Verified `Company` record.
2. Appropriate **company role** (issuer portal: owner, executive, finance manager, or compliance contact).
3. Global **`issuer` tag** for new listing applications (future route guard on `/exchange/apply`).
4. Alta Exchange operations approval (not built in this pass).

## Internal admin

`/internal/companies` loads **real Prisma `Company` records** when the database is available. Detail pages use DB data with mock fallback for legacy seed IDs.

Operators can **Verify** or **Reject verification** from the companies list or company detail page. Verification sets `verificationStatus: VERIFIED` and promotes `status` from `PENDING` to `ACTIVE` when applicable.

Verified companies can open **Business Operating Accounts** immediately — no manual bank review queue.

## Code map

| Path | Purpose |
|------|---------|
| `src/lib/company/types.ts` | Shared types and form options |
| `src/lib/company/company.functions.ts` | Server functions (RPC) |
| `src/lib/companies/api.ts` | Server-side API + permission helpers |
| `src/server/company.service.ts` | Business logic |
| `src/server/company-mapper.ts` | Prisma → app types |
| `src/routes/companies/**` | User-facing company UI |
| `src/components/companies/**` | Forms, tables, modules |

## Related docs

- [permissions.md](./permissions.md) — global tags and company-scoped checks
- [auth.md](./auth.md) — Discord login and sessions
- [database.md](./database.md) — Prisma schema
