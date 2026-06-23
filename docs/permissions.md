# Alta Permission System

Authorization for Alta Bank, Alta Exchange, Alta Terminal, and Internal uses **existing Prisma models only** — no separate permission tables.

## Data model

### Global tags (`UserTagAssignment`)

Tags are granted by Alta operations via the database (see `npm run db:grant-tag`). A user may hold multiple tags.

| Tag (app) | DB enum | Purpose |
|-----------|---------|---------|
| `admin` | `ADMIN` | Full internal access; admin-only actions |
| `operator` | `OPERATOR` | Internal console access; no admin-only actions |
| `private_client` | `PRIVATE_CLIENT` | Alta Private banking surfaces |
| `developer` | `DEVELOPER` | Exchange API documentation and keys |
| `issuer` | `ISSUER` | May submit new listing applications |

Grant or revoke tags (one or more per command):

```bash
npm run db:grant-tag -- DISCORD_ID admin private_client
npm run db:grant-tag -- DISCORD_ID operator
npm run db:grant-tag -- DISCORD_ID admin --remove
```

**Developer access (legacy):** `User.developerAccessStatus === APPROVED` also grants developer permission via `isDeveloper()`, even without the `developer` tag. Prefer the tag for new grants.

### Company roles (`CompanyMembership`)

Companies do not log in. Representatives act on behalf of a company through membership rows linking `User` → `Company` with a `CompanyRole`.

| Role (app) | DB enum | Typical use |
|------------|---------|-------------|
| `owner` | `OWNER` | Primary company representative |
| `executive` | `EXECUTIVE` | Senior management |
| `finance_manager` | `FINANCE_MANAGER` | Financial reporting |
| `compliance_contact` | `COMPLIANCE_CONTACT` | Regulatory filings |
| `viewer` | `VIEWER` | Read-only; **no issuer portal access** |

## Helpers

### Client-safe checks (`src/lib/auth/permissions.ts`)

**Global**

- `isAdmin(user)` — `admin` tag
- `isOperator(user)` — `operator` tag
- `isPrivateClient(user)` — `private_client` tag
- `isDeveloper(user)` — `developer` tag or approved `developerAccessStatus`
- `isIssuer(user)` — `issuer` tag
- `canAccessInternal(user)` — admin **or** operator

**Company-scoped** (pass `{ companyId }` or `{ ticker }`)

- `isCompanyOwner`, `isCompanyExecutive`, `isCompanyFinanceManager`, `isCompanyComplianceContact`
- `canManageCompany` — owner or executive
- `canSubmitFilings` — owner, executive, finance_manager, or compliance_contact
- `canAccessIssuerPortal` — same as filing roles; **excludes viewer**

### Server guards (`src/server/permissions.service.ts`)

Throw `FORBIDDEN` when the session user lacks permission:

- `requireAdmin()`
- `requireOperator()` — internal access (admin or operator)
- `requirePrivateClient()`
- `requireDeveloper()`
- `requireIssuerPortalAccess(ticker)`

Use these in server functions, loaders, and future API routes.

### Route guards (`src/lib/auth/guards.ts`)

| Guard | Routes |
|-------|--------|
| `internalBeforeLoad` | `/internal/*` |
| `privateClientBeforeLoad` | `/bank/private` |
| `developerBeforeLoad` | `/exchange/api` |
| `issuerPortalBeforeLoad` | `/exchange/company/$ticker/owner` |

Unauthenticated users redirect to `/login`. Authenticated but unauthorized users redirect to `/access-restricted`.

## Permission matrix

| Surface | Required permission | Enforced |
|---------|---------------------|----------|
| Internal console (`/internal`) | Admin **or** operator | Yes |
| Admin-only internal actions | Admin only | Use `requireAdmin()` per action (future) |
| Alta Private (`/bank/private`) | `private_client` tag | Yes |
| Exchange API (`/exchange/api`) | Developer tag or approved developer status | Yes |
| Issuer portal (`/exchange/company/[ticker]/owner`) | Company membership + issuer portal role | Yes |
| Listing applications (`/exchange/apply`) | `issuer` tag | Not yet route-guarded |
| Terminal trading | Account session | Existing auth guards |

### Issuer portal roles

User must **belong to the company** (matching ticker) **and** hold one of:

- Owner
- Executive
- Finance manager
- Compliance contact

`VIEWER` is explicitly denied issuer portal permissions.

## Architecture

```
User
 ├── UserTagAssignment[]     → global tags (admin, operator, …)
 └── CompanyMembership[]     → companyId + CompanyRole
         └── Company         → ticker, name, status, …
```

Permission checks are pure functions on `AltaUser` (loaded with tags and enriched memberships). Route guards call server verification functions that re-read the session from the database.

## Future expansion

1. **Per-route admin enforcement** — Split internal pages so sensitive actions call `requireAdmin()` while operators use read-only or operational views.
2. **Listing application guard** — Add `issuerBeforeLoad` on `/exchange/apply` using `requireIssuer()` / `isIssuer()`.
3. **Terminal entitlements** — Map account tiers and market data licenses without new auth models.
4. **Bank product scopes** — Layer product flags on top of `private_client` when real banking ships.
5. **Audit logging** — Record permission denials and privileged actions in an append-only log table.
6. **Tag management UI** — Internal tool to grant/revoke tags and assign company roles (today: CLI + direct DB).
7. **Resource-level ACLs** — Fine-grained permissions per filing, API key, or account when backends go live.
8. **Remove legacy developer field** — Migrate fully to `developer` tag once approval workflow is unified.

## Related docs

- [auth.md](./auth.md) — Discord OAuth and sessions
- [database.md](./database.md) — Schema overview and seeding
