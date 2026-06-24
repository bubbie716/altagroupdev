# Alta Platform Authentication

Discord OAuth for individual user accounts, Postgres-backed sessions, and route-level access control. Companies do not authenticate directly — users act as authorized representatives via membership records.

See [database.md](./database.md) for Prisma setup, migrations, and session persistence details.

## Architecture

```
Individual Discord User
  → OAuth (identify)
  → User row in Postgres (upsert by discordId)
  → Session row + HttpOnly cookie (sessionToken)
  → AltaUser profile (with CompanyMembership[])
  → Permissions (not enforced yet)
```

## Discord Developer Portal Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications).
2. **New Application** → name it (e.g. `Alta Group Dev`).
3. Open **OAuth2**:
   - Add redirect URI:
     - Local: `http://localhost:3000/api/auth/discord/callback`
     - Production: `https://your-domain.com/api/auth/discord/callback`
   - Copy **Client ID** and **Client Secret**.
4. Under **OAuth2 → General**, scopes used by Alta:
   - `identify`

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `DISCORD_CLIENT_ID` | OAuth2 client ID (public in authorize URL only) |
| `DISCORD_CLIENT_SECRET` | Server-only — never bundled to the client |
| `DISCORD_REDIRECT_URI` | Must exactly match a URI in Discord portal |
| `SESSION_SECRET` | Min 32 chars; signs OAuth state cookie |

Generate a session secret:

```bash
openssl rand -base64 32
```

**Vercel:** Add the same variables in Project → Settings → Environment Variables.

## Local Development

1. Copy env file and configure Postgres, Discord, and session secret:

```bash
cp .env.example .env
npm run db:migrate
npm run db:seed
```

2. Start the dev server:

```bash
npm run dev
```

3. Visit `/login` or any protected route → **Sign in with Discord**.
   - After login you are redirected to `/profile`.

4. **Assign test roles**

   - Sign in once so your user row exists in Postgres.
   - Promote yourself in the database:

```bash
npm run db:grant-tag -- YOUR_DISCORD_ID admin
```

   - Optional: `src/config/mock-users.ts` for dev-only fake users (memberships, statuses).

## Auth Flow

1. User clicks **Sign in with Discord** → `GET /api/auth/discord?redirect=/target`
2. Server stores signed OAuth `state` in a short-lived cookie, redirects to Discord.
3. Discord redirects to `GET /api/auth/discord/callback?code=…&state=…`
4. Server validates state, exchanges code for token (server-side), fetches `@me`.
5. User upserted in Postgres; session row created; session cookie set.
6. User redirected to `/profile` (or original `redirect` path).

**Logout:** Profile menu → Logout calls `logoutUser` server function, deletes DB session, clears cookie, redirects to `/`.

## Protected Routes

### Requires login (`authBeforeLoad`)

- `/profile`
- `/bank/dashboard`, `/bank/accounts`, `/bank/transfers`
- `/terminal`, `/terminal/portfolio`, `/terminal/trade`, `/terminal/watchlist`

Unauthenticated users redirect to `/login?redirect=…` with the Alta access gate.

### Requires admin (`internalBeforeLoad`)

- `/internal/*`

Access is granted only when the signed-in user has the `admin` tag in Postgres. Users without it redirect to `/access-restricted`.

### Public (no login)

- `/`, `/governance`, `/login`
- `/bank`, `/bank/products`, `/bank/lending`, `/bank/business`, `/bank/private`
- `/exchange`, `/exchange/listings`, `/exchange/company/*`, `/exchange/ipo`, `/exchange/apply`, `/exchange/research`
- `/terminal/news`, `/terminal/research`, `/terminal/ipo`, `/terminal/leaderboard` (marketing/preview pages)

## Tags & Access

### Backend tags (`UserTagAssignment`)

Users can hold **multiple tags at once** (e.g. `admin` and `private_client`). Each tag is a separate row in `UserTagAssignment`. Tags are not shown as “roles” in the public UI — they drive backend access only.

| Tag | Purpose |
|-----|---------|
| `admin` | Full internal ops access |
| `operator` | Internal ops (non-admin actions) |
| `private_client` | Alta Private relationship |
| `developer` | Exchange API access |
| `issuer` | Submit listing applications |

Grant one or more tags after first login:

```bash
npm run db:grant-tag -- DISCORD_ID admin private_client
npm run db:grant-tag -- DISCORD_ID admin
npm run db:grant-tag -- DISCORD_ID private_client
```

Remove specific tags with `--remove` (other tags are kept):

```bash
npm run db:grant-tag -- DISCORD_ID private_client --remove
```

### Account statuses

`active`, `restricted`, `frozen`, `pending_review`

### Company roles (membership, not login)

`owner`, `executive`, `finance_manager`, `compliance_contact`, `viewer`

## Code Map

| Path | Purpose |
|------|---------|
| `src/lib/auth/types.ts` | User, company, membership types |
| `src/lib/auth/tags.ts` | Tag helpers |
| `src/lib/auth/guards.ts` | Route `beforeLoad` guards |
| `src/lib/auth/auth.functions.ts` | `fetchCurrentUser`, `logoutUser` |
| `src/hooks/use-current-user.ts` | `useCurrentUser`, `useIsAuthenticated` |
| `src/server/auth.service.ts` | Session auth, login, guards |
| `src/server/user.service.ts` | Discord → User upsert |
| `src/server/session.service.ts` | DB session CRUD |
| `src/server/discord.ts` | OAuth token exchange |
| `src/server/db.ts` | Prisma client |
| `prisma/schema.prisma` | Database schema |
| `src/config/mock-users.ts` | **Temporary** dev overrides |
| `docs/database.md` | Migrations, seed, session details |

## Production Deployment

1. Provision Postgres and set `DATABASE_URL`.
2. Run `npx prisma migrate deploy` in CI or release step.
3. Set all env vars on Vercel (or host).
4. Update Discord redirect URI to production domain.
5. Use HTTPS (session cookies use `Secure` in production).

## Future Database TODOs

- [ ] Admin UI for tag assignment (replace grant-tag CLI)
- [ ] Company verification workflow
- [ ] Permission enforcement middleware (resource-scoped)
- [ ] Minecraft username linking flow
- [ ] Audit log of auth events
- [ ] Real banking, trading, and transfer data models
