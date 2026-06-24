# UI Lab Mode

> **UI LAB ONLY — DO NOT ENABLE IN PRODUCTION.**
> This mode disables authentication so design previews can render
> protected pages without Discord OAuth, a database, or real sessions.
> Never set this flag on a production deployment.

## How to enable

Set the following in `.env` (or the preview environment):

```
VITE_UI_LAB_MODE=true
```

Restart the dev server so Vite picks up the new env var. When the flag
is unset or `false`, the app behaves exactly as before — real Discord
auth, real route guards, real internal-role checks.

## What it bypasses

When `VITE_UI_LAB_MODE=true`:

- The root `beforeLoad` skips `fetchCurrentUser()` and injects a mock
  user into router context.
- `authBeforeLoad`, `privateClientBeforeLoad`, `developerBeforeLoad`,
  `issuerPortalBeforeLoad`, and `internalBeforeLoad` short-circuit and
  allow the route to render.
- DATABASE_URL and Discord OAuth env vars are not required for
  navigating the preview (server functions are not called by guards).
- A fixed banner — `UI Lab Mode — authentication bypass enabled` — is
  shown on every page as a visible warning.

## Pages that can now be previewed

- `/profile`
- `/companies` (and children)
- `/bank/dashboard`, `/bank/accounts`, `/bank/accounts/[accountId]`
- `/bank/transfers`, `/bank/deposit`, `/bank/withdraw`
- `/bank/lending/loans`, `/bank/statements`
- `/exchange/terminal`
- `/internal` (admin/operator bypass)

## Mock user

Defined in `src/lib/auth/ui-lab.ts` as `UI_LAB_MOCK_USER`:

| Field           | Value                                                     |
| --------------- | --------------------------------------------------------- |
| Discord username| `Carter`                                                  |
| Tags            | `admin`, `operator`, `private_client`, `developer`, `issuer` |
| Account status  | `active`                                                  |
| Companies       | Alta Group N.V. (owner), Newport Petroleum Corp. (executive) |

The mock user only exists when the flag is on. With the flag off the
constant is never read by any guard or route.

## Why this exists

Lovable's UI Lab renders the app without provisioning Discord, Postgres,
or session cookies. Without a bypass, every protected route would
redirect to `/login` and the design surfaces could not be reviewed.

## Production safety

- When `VITE_UI_LAB_MODE` is unset or `false`:
  - Discord OAuth and session cookies are the only path to a user.
  - All guards enforce real tags and memberships.
  - `/internal` requires `admin` or `operator`.
  - The mock user is never injected and no banner renders.
- All bypass code paths are annotated with
  `UI LAB ONLY — DO NOT ENABLE IN PRODUCTION` for easy auditing.
- Prisma schema, banking, transfer, loan, company, and permission
  logic are unchanged.