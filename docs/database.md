# Alta Database & Auth Persistence

PostgreSQL-backed users, sessions, and company memberships via Prisma. Discord OAuth creates or loads a persistent Alta user and stores a database session referenced by an HttpOnly cookie.

## Prerequisites

- PostgreSQL 14+ (local Docker, Neon, Supabase, or similar)
- Node.js and npm
- Discord OAuth app (see [auth.md](./auth.md))

## Environment Variables

Copy `.env.example` to `.env`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `DISCORD_CLIENT_ID` | OAuth2 client ID |
| `DISCORD_CLIENT_SECRET` | Server-only OAuth secret |
| `DISCORD_REDIRECT_URI` | Must match Discord portal (e.g. `http://localhost:3000/api/auth/discord/callback`) |
| `SESSION_SECRET` | Min 32 chars; signs OAuth state cookie |

Example `DATABASE_URL`:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/alta_dev?schema=public
```

## Prisma Setup

Install dependencies (includes Prisma client generation via `postinstall`):

```bash
npm install
```

Generate the Prisma client:

```bash
npm run db:generate
```

Create the database schema:

```bash
npm run db:migrate
```

When prompted for a migration name, use something like `init`.

Seed demo companies (and sync dev memberships for users that already exist):

```bash
npm run db:seed
```

For quick prototyping without migrations:

```bash
npm run db:push
```

## Data Model

### User

Persisted Alta identity from Discord login:

- `discordId` (unique)
- `discordUsername`, `discordAvatar`
- `email` (optional — not collected with current `identify` scope)
- `minecraftUsername` (optional)
- `accountStatus`, `developerAccessStatus`
- Tags via `UserTagAssignment` (`admin`, `private_client`, …)
- `createdAt`, `updatedAt`, `lastLoginAt`

### Company

Registered entities (not login principals). Seeded from demo registry.

### CompanyMembership

Links users to companies with a scoped role (`OWNER`, `EXECUTIVE`, etc.).

### Session

Server-side session store:

- `sessionToken` (unique, stored in HttpOnly cookie)
- `userId`, `expiresAt`, `createdAt`

## Discord Login → User Table

1. User completes Discord OAuth.
2. Server fetches Discord profile (`identify` scope).
3. Server looks up `User` by `discordId`.
4. If missing, creates a new user with defaults (`USER`, `ACTIVE`, etc.).
5. Updates profile fields and `lastLoginAt` (does not change tags on existing users).
6. Creates a `Session` row and sets the session cookie.
7. Redirects to `/profile` (or the original `?redirect=` path).

## Session Storage

- Cookie name: `alta_session`
- Cookie value: opaque `sessionToken` (not a signed user payload)
- Session row in Postgres with 7-day expiry
- `fetchCurrentUser` / route guards load the user by joining `Session → User → CompanyMemberships`
- Logout deletes the session row and clears the cookie

## Tags & Admin Access

Backend tags (`ADMIN`, `PRIVATE_CLIENT`, …) are stored in `UserTagAssignment`. A user may have multiple tags. Login does not change tags — grant or revoke them directly in the database.

After a user signs in for the first time:

```bash
npm run db:grant-tag -- DISCORD_ID admin
npm run db:grant-tag -- DISCORD_ID private_client
npm run db:grant-tag -- DISCORD_ID admin --remove
```

`src/config/mock-users.ts` applies optional tags for local fake Discord IDs on first create only.

## Local Testing

1. Start Postgres and set `DATABASE_URL` in `.env`.
2. Run migrations and seed:

```bash
npm run db:migrate
npm run db:seed
```

3. Configure Discord OAuth + `SESSION_SECRET`.
4. Start the app:

```bash
npm run dev
```

5. **Real Discord:** visit `/login` → Sign in with Discord → you should land on `/profile` with persisted identity.

6. **Assign yourself admin:** sign in once, then run `npm run db:grant-tag -- YOUR_DISCORD_ID admin`.

## Code Map

| Path | Purpose |
|------|---------|
| `prisma/schema.prisma` | Models and enums |
| `docs/architecture/core-financial-abstractions.md` | Payment, TransferGroup, institution, and assignment foundations |
| `prisma/seed.ts` | Demo companies |
| `src/server/db.ts` | Prisma client singleton |
| `src/server/user.service.ts` | Upsert user from Discord |
| `src/server/session.service.ts` | Create/load/delete sessions |
| `src/server/user-mapper.ts` | Prisma → `AltaUser` mapping |
| `src/server/enum-map.ts` | Enum conversions |
| `prisma/grant-tag.ts` | CLI to grant/revoke user tags by Discord ID |
| `src/server/auth.service.ts` | Current user, login, logout guards |

## Future TODOs

- [ ] Real banking account balances and ledger tables
- [ ] Real trading positions and order history
- [ ] Transfer and wire persistence
- [ ] Admin UI for tag and membership management (replace grant-tag CLI + mock config)
- [ ] Permission enforcement beyond route guards
- [ ] Minecraft username linking workflow
- [ ] Auth audit log (login, logout, role changes)
- [ ] Session revocation UI and device management
- [ ] Optional `email` scope for Discord if contact email is needed
