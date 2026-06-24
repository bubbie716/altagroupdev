# Alta Permission System

Authorization for Alta Bank, Alta Exchange, Alta Terminal, and Internal uses **existing Prisma models only** — no separate permission tables.

## Data model

### Global tags (`UserTagAssignment`)

Tags are granted through the internal portal at **`/internal/users`** (admin and operator access required). The CLI remains available for bootstrap and automation:

```bash
npm run db:grant-tag -- DISCORD_ID admin private_client
npm run db:grant-tag -- DISCORD_ID operator
npm run db:grant-tag -- DISCORD_ID admin --remove
```

| Tag (app) | DB enum | Purpose |
|-----------|---------|---------|
| `admin` | `ADMIN` | Full internal access; admin-only staff tag management |
| `operator` | `OPERATOR` | Internal console access; cannot manage staff tags |
| `private_client` | `PRIVATE_CLIENT` | Alta Private banking surfaces |
| `developer` | `DEVELOPER` | Exchange API documentation and keys |
| `issuer` | `ISSUER` | May submit new listing applications |

### Internal tag management (`/internal/users`)

| Actor | View users | Grant/revoke tags |
|-------|------------|-------------------|
| **Admin** | Yes | All tags (`admin`, `operator`, `private_client`, `developer`, `issuer`) |
| **Operator** | Yes | `private_client`, `developer`, `issuer` only — **not** `admin` or `operator` |
| **Everyone else** | No | No access to `/internal/users` |

**Safety rules (enforced server-side):**

- Cannot revoke the **last admin** on the platform.
- Operators cannot grant or revoke **admin** or **operator** tags.
- Users cannot modify their own **admin** tag (prevents accidental lockout).
- Grant/revoke **admin**, revoke **operator**, and set **restricted** / **frozen** account status require confirmation in the UI.

**Account status** (`User.accountStatus`):

| Actor | Allowed status changes |
|-------|------------------------|
| **Admin** | `active`, `restricted`, `frozen`, `pending_review` |
| **Operator** | `pending_review`, `restricted` only |

Restricted and frozen accounts are already blocked by existing auth helpers (`auth.service.ts`, embed routes). No auth refactor required.

**Audit:** Tag and status changes are not yet written to an append-only log. TODO: add `AuditLog` model and record `TAG_GRANTED`, `TAG_REVOKED`, `ACCOUNT_STATUS_CHANGED`.

**Future:** Discord role sync — mirror `UserTagAssignment` to Discord guild roles when staff tags change (not implemented).

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
| Internal user & tag management (`/internal/users`) | Admin **or** operator (tag writes limited by role) | Yes |
| Admin-only tag actions (admin/operator tags) | Admin only | Server-enforced in `internal-user-management.service.ts` |
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
5. **Audit logging** — Record tag grants/revokes and account status changes in an append-only `AuditLog` table (TODO in internal user management service).
6. **Discord role sync** — Propagate staff tags to Discord guild roles on grant/revoke.
7. **Resource-level ACLs** — Fine-grained permissions per filing, API key, or account when backends go live.
8. **Remove legacy developer field** — Migrate fully to `developer` tag once approval workflow is unified.

## Related docs

- [auth.md](./auth.md) — Discord OAuth and sessions
- [database.md](./database.md) — Schema overview and seeding
