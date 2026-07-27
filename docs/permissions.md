# Alta Permission System

Authorization for Alta Bank, Alta Terminal, and Internal uses **existing Prisma models only** — no separate permission tables.

## Data model

### Global tags (`UserTagAssignment`)

Tags are granted through the internal portal at **`/internal/users`**. The CLI remains available for bootstrap and automation:

```bash
npm run db:grant-tag -- DISCORD_ID corporate_admin
npm run db:grant-tag -- DISCORD_ID bank_admin
npm run db:grant-tag -- DISCORD_ID terminal_admin --remove
```

| Tag (app) | DB enum | Purpose |
|-----------|---------|---------|
| `corporate_admin` | `CORPORATE_ADMIN` | Full group / corporate internal access |
| `bank_admin` | `BANK_ADMIN` | Bank ops console |
| `terminal_admin` | `TERMINAL_ADMIN` | Terminal settings (with corporate admin) |

### Company roles (`CompanyMembership`)

Companies do not log in. Representatives act on behalf of a company through membership rows linking `User` → `Company` with a `CompanyRole`.

| Role (app) | DB enum | Typical use |
|------------|---------|-------------|
| `owner` | `OWNER` | Primary company representative |
| `executive` | `EXECUTIVE` | Senior management |
| `finance_manager` | `FINANCE_MANAGER` | Financial reporting / treasury |
| `compliance_contact` | `COMPLIANCE_CONTACT` | Compliance / view-only treasury |
| `viewer` | `VIEWER` | Read-only company profile |

## Helpers

### Client-safe checks (`src/lib/auth/permissions.ts`)

**Global**

- `isCorporateAdmin` / `isAdmin` — corporate admin tag
- `isBankAdmin` / `canAccessBankInternal` — bank ops
- `isTerminalAdmin` — terminal staff
- `canAccessInternalForSite(user, siteKey)` — site-scoped internal access

**Company-scoped** (pass `{ companyId }` or `{ ticker }`)

- `isCompanyOwner`, `isCompanyExecutive`, `isCompanyFinanceManager`, `isCompanyComplianceContact`
- `canManageCompany` — owner or executive
- `canViewBusinessTreasury` / `canManageBusinessTreasury` — business banking

### Server guards (`src/server/permissions.service.ts`)

- `requireAdmin()` — corporate admin
- `requireOperator()` — bank ops (corporate or bank admin)
- `requireTerminalAdmin()` — corporate or terminal admin

### Route guards (`src/lib/auth/guards.ts`)

| Guard | Routes |
|-------|--------|
| `authBeforeLoad` | Authenticated pages |
| `internalBeforeLoad` | `/internal/*` |

Unauthenticated users redirect to sign-in. Authenticated but unauthorized users redirect to `/access-restricted`.

## Permission matrix

| Surface | Required permission | Enforced |
|---------|---------------------|----------|
| Internal console (`/internal`) | Site-appropriate staff tag | Yes |
| Internal user & tag management (`/internal/users`) | Corporate / bank staff (writes limited by role) | Yes |
| Business banking | Company membership + treasury roles | Yes |
| Terminal | Account session | Existing auth guards |

## Architecture

```
User
 ├── UserTagAssignment[]     → global staff tags
 └── CompanyMembership[]     → companyId + CompanyRole
         └── Company         → ticker, name, status, …
```

Permission checks are pure functions on `AltaUser` (loaded with tags and enriched memberships). Route guards call server verification functions that re-read the session from the database.

## Related docs

- [auth.md](./auth.md) — Discord OAuth and sessions
- [database.md](./database.md) — Schema overview and seeding
