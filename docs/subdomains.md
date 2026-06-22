# Subdomain Architecture

Alta Group runs as a **single TanStack Start application** that can eventually serve four product experiences from one deployment and one codebase:

| Experience     | Production hostname           | In-app home (route-based) |
| -------------- | ----------------------------- | ------------------------- |
| Alta Group     | `altagroup.dev`               | `/`                       |
| Alta Bank      | `bank.altagroup.dev`          | `/bank/dashboard`         |
| Alta Terminal  | `terminal.altagroup.dev`      | `/terminal`               |
| Alta Exchange  | `exchange.altagroup.dev`      | `/exchange`               |

Route-based access remains fully supported. Both of these work today and after DNS is configured:

- `bank.altagroup.dev` **and** `altagroup.dev/bank/dashboard`
- `terminal.altagroup.dev` **and** `altagroup.dev/terminal`
- `exchange.altagroup.dev` **and** `altagroup.dev/exchange`

---

## Architecture overview

```
                    ┌─────────────────────────────────────┐
                    │   Single TanStack Start deployment   │
                    │   (one build, one codebase)          │
                    └─────────────────────────────────────┘
                                        │
          ┌─────────────────────────────┼─────────────────────────────┐
          │                             │                             │
   altagroup.dev              bank.altagroup.dev           terminal.altagroup.dev
          │                             │                             │
          ▼                             ▼                             ▼
       path `/`                  path `/` → redirect            path `/` → redirect
                                  to `/bank/dashboard`           to `/terminal`
```

### Code layout

| Module | Purpose |
| ------ | ------- |
| `src/lib/domain/config.ts` | Hostname config from `VITE_*` env vars |
| `src/lib/domain/host.ts` | Hostname detection (`getCurrentSubdomain`, `isBankDomain`, …) |
| `src/lib/domain/urls.ts` | URL builders (`getBankUrl`, `getTerminalUrl`, …) |
| `src/lib/domain/redirect.ts` | Subdomain root redirect logic |
| `src/routes/__root.tsx` | Applies subdomain redirect on `/` only |

No UI components were changed. Subdomain behavior is infrastructure-only.

---

## How subdomain routing works

1. **Hostname detection** — `getHostname()` reads the request `Host` header on the server and `window.location.hostname` in the browser (via TanStack `createIsomorphicFn`).

2. **Root redirect** — When a product subdomain serves exactly `/`, the root route redirects internally:
   - `bank.*` → `/bank/dashboard`
   - `terminal.*` → `/terminal`
   - `exchange.*` → `/exchange`

3. **All other paths are unchanged** — e.g. `bank.altagroup.dev/bank/accounts`, `terminal.altagroup.dev/terminal/trade`, and cross-product paths on any host continue to work.

4. **URL helpers** — Use `@/lib/domain` helpers when building links that may need to cross subdomains in the future:
   - `getMainSiteUrl()`
   - `getBankUrl()`
   - `getTerminalUrl()`
   - `getExchangeUrl()`

   On `localhost` or the main domain, helpers return **relative paths** for SPA navigation. Pass `{ absolute: true }` to force full URLs.

---

## Environment variables

Copy `.env.example` to `.env.local` and adjust as needed:

```env
VITE_MAIN_DOMAIN=altagroup.dev
VITE_BANK_DOMAIN=bank.altagroup.dev
VITE_TERMINAL_DOMAIN=terminal.altagroup.dev
VITE_EXCHANGE_DOMAIN=exchange.altagroup.dev
```

Optional local subdomain overrides:

```env
VITE_DEV_MAIN_HOST=localhost
VITE_DEV_BANK_HOST=bank.localhost
VITE_DEV_TERMINAL_HOST=terminal.localhost
VITE_DEV_EXCHANGE_HOST=exchange.localhost
```

Do not hardcode production domains in application code — import from `@/lib/domain`.

---

## Local development

### Path-based (default)

No DNS setup required:

```bash
npm run dev
```

- `http://localhost:3000/` — Alta Group homepage
- `http://localhost:3000/bank/dashboard` — Alta Bank
- `http://localhost:3000/terminal` — Alta Terminal
- `http://localhost:3000/exchange` — Alta Exchange

### Subdomain testing (optional)

Modern browsers resolve `*.localhost` without `/etc/hosts` entries:

- `http://bank.localhost:3000/` → redirects to `/bank/dashboard`
- `http://terminal.localhost:3000/` → redirects to `/terminal`
- `http://exchange.localhost:3000/` → redirects to `/exchange`

If your environment does not support `*.localhost`, add entries to `/etc/hosts`:

```
127.0.0.1 bank.localhost
127.0.0.1 terminal.localhost
127.0.0.1 exchange.localhost
```

---

## DNS setup (future)

When ready for production subdomains, create **CNAME or A/AAAA records** pointing each hostname to the same deployment target:

| Hostname | Record | Target |
| -------- | ------ | ------ |
| `altagroup.dev` | A/AAAA or CNAME | Your hosting provider |
| `bank.altagroup.dev` | CNAME | Same deployment |
| `terminal.altagroup.dev` | CNAME | Same deployment |
| `exchange.altagroup.dev` | CNAME | Same deployment |

All four hostnames must resolve to the **same application**. No separate deployments are required.

---

## Vercel setup (future)

1. Add the project once in Vercel.
2. Under **Project → Settings → Domains**, add all four hostnames:
   - `altagroup.dev`
   - `bank.altagroup.dev`
   - `terminal.altagroup.dev`
   - `exchange.altagroup.dev`
3. Configure DNS at your registrar per Vercel’s instructions (typically CNAME to `cname.vercel-dns.com` or Vercel nameservers).
4. Set environment variables in Vercel (**Settings → Environment Variables**) matching `.env.example`.
5. Deploy once — all domains serve the same build.

No monorepo, no separate Vercel projects, and no path rewrites are required for the initial subdomain rollout.

---

## Future expansion

### Recommended next steps

1. **Adopt URL helpers in navigation** — When cross-product links should open on product subdomains, replace hardcoded paths with `getBankUrl()`, etc.
2. **Product-aware shell (optional)** — Hide global nav items outside the active product when `isOnProductSubdomain()` is true.
3. **Canonical URLs / SEO** — Set `rel="canonical"` per product subdomain when marketing pages split.
4. **Cookie scope** — If auth is added later, scope session cookies to `.altagroup.dev` for SSO across subdomains.
5. **Edge middleware (optional)** — Vercel/Nitro middleware can perform hostname redirects before SSR for faster first byte.

### Limitations today

- Subdomain root redirect only applies to `/`; URLs still include product path prefixes (e.g. `/bank/dashboard` on `bank.altagroup.dev`).
- No hostname-based route isolation — all routes remain reachable on every host.
- URL helpers are available but **not yet wired into existing UI** (by design — no UI changes in this phase).
- `127.0.0.1` is treated as the main domain; use `localhost` or `*.localhost` for subdomain dev testing.

### What this architecture avoids

- Separate codebases per product
- Separate deployments per subdomain
- Backend/API work
- Breaking existing `/bank`, `/terminal`, or `/exchange` routes

---

## Quick reference

```ts
import {
  getCurrentSubdomain,
  isBankDomain,
  getBankUrl,
  getSubdomainRootRedirect,
} from "@/lib/domain";

getCurrentSubdomain(); // "main" | "bank" | "terminal" | "exchange" | null
isBankDomain();        // true on bank.altagroup.dev or bank.localhost
getBankUrl("/bank/accounts"); // "/bank/accounts" on main host, full URL when needed
```
