# Platform Maintenance Mode

Alta Group maintenance mode lets **admins** take the public platform offline while internal operations remain available.

## What it does

When maintenance mode is **enabled**:

- Anonymous visitors see `/maintenance` instead of normal site pages.
- Signed-in users who are **not** admins or operators are also redirected to `/maintenance`.
- Bank, Exchange, profile, companies, and other public platform routes are blocked at the root router guard (server-side).
- The **Discord bot** blocks slash commands, hub buttons/modals, invitation actions, and deal room channel sync for the same users. Outbound bot delivery (DMs, staff audit posts, web-initiated deal room setup) continues.

When maintenance mode is **disabled**, routing behaves normally.

## Who can enable it

| Role | View status | Toggle maintenance | Edit message |
|------|-------------|-------------------|--------------|
| Admin | Yes | Yes | Yes |
| Operator | Yes | No | No |
| Normal user | Sees maintenance page only | No | No |

Only users with the **admin** tag may enable, disable, or save maintenance settings.

## Routes that remain accessible

These paths are **never** redirected to maintenance:

- `/maintenance` — the public maintenance page
- `/login` — Discord sign-in
- `/access-restricted` — permission denial page
- `/api/*` — auth callbacks, logout, cron, and other API handlers

### Internal operations (admins/operators)

Users with **admin** or **operator** tags bypass maintenance entirely. They can use the full public platform and all internal routes without seeing `/maintenance`.

If a bypass user lands on `/maintenance`, they are redirected to `/` automatically.

## Lockout prevention

1. **Bypass users** — Admins and operators are never redirected to `/maintenance`.
2. **Database read failure** — If maintenance settings cannot be read, the platform defaults to **maintenance OFF** so admins are not accidentally locked out.
3. **Auth preserved** — Login and session API routes are exempt; admins can sign in during maintenance.
4. **Internal routes** — Not blocked for bypass users; `/internal/settings` is always reachable for admins/operators.
5. **No client-only enforcement** — The root route `beforeLoad` guard evaluates maintenance server-side on every navigation.

## Audit behavior

Maintenance changes write to the append-only audit log when available:

| Action | When |
|--------|------|
| `MAINTENANCE_MODE_ENABLED` | Maintenance turned on |
| `MAINTENANCE_MODE_DISABLED` | Maintenance turned off |
| `MAINTENANCE_MESSAGE_UPDATED` | Message changed while state unchanged |

Metadata includes previous/new enabled state, previous/new message, reason, and actor.

Entity type: `PLATFORM` · Entity id: `platform-maintenance`

## Data model

Settings are stored in `PlatformSetting` (key/value rows):

- `maintenanceModeEnabled` — boolean
- `maintenanceModeMessage` — string shown on `/maintenance`
- `maintenanceModeStartedAt` — ISO timestamp when current maintenance window started
- `maintenanceModeUpdatedById` — last admin who changed settings

## How to disable if something goes wrong

1. **Preferred:** Sign in as an admin, open `/internal/settings`, and disable maintenance mode.
2. **Direct database:** Set `maintenanceModeEnabled` to `false` in `PlatformSetting`:

```sql
UPDATE "PlatformSetting"
SET "value" = 'false'::jsonb
WHERE "key" = 'maintenanceModeEnabled';
```

3. **Migration rollback:** If the settings table is unavailable, the app defaults to maintenance **off** on read errors.

## Operations Center

`/internal` shows a prominent banner when maintenance is active, plus a **Maintenance mode** health card under Operational health.

## Related files

- `src/server/platform-settings.service.ts` — read/write helpers
- `src/server/bot-maintenance.service.ts` — Discord bot maintenance gate
- `src/lib/platform/maintenance-guard.ts` — exempt paths and bypass logic
- `src/routes/__root.tsx` — root maintenance guard
- `src/routes/maintenance.tsx` — public maintenance page
- `src/routes/internal/settings.tsx` — admin controls
- `src/components/internal/maintenance-mode-panel.tsx` — settings UI

## Migration

Apply the platform settings migration:

```bash
npx prisma migrate deploy
npx prisma generate
```

Migration: `20250701140000_platform_maintenance_mode`
