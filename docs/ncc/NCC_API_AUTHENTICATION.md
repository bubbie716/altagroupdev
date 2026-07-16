# NCC API Authentication

**Newport Clearing Corporation — Sprint 3B**

Related: [Institution API](./NCC_INSTITUTION_API.md) · [Webhooks](./NCC_WEBHOOKS.md)

---

## 1. Credential format

```
Authorization: Bearer ncc_<env>_<prefix>_<secret>
```

Exact grammar (Sprint 3B.1):

`ncc_(live|test)_([a-f0-9]{12})_([A-Za-z0-9_-]{16,})`

| Part | Example | Notes |
|------|---------|-------|
| Scheme | `Bearer` | Required |
| Product | `ncc` | Fixed |
| Environment | `live` or `test` | Maps to `LIVE` / `TEST` |
| Prefix | 12-char lowercase hex | Never contains `_` (delimiter-safe) |
| Secret | Base64URL (may contain `_`/`-`) | Parsed as complete remainder; shown **once** |

Legacy prefixes that contain `_` are resolved via longest-prefix DB match; new credentials never create them.

Never put credentials in query strings. Never log the `Authorization` header.

---

## 2. Secret storage

| Material | Storage |
|----------|---------|
| API secret | One-way hash only (`secretHash`) |
| Raw secret | Never stored; returned once at creation/rotation |
| Webhook signing secret | Authenticated encryption (AES-GCM) — see [Webhook Security](./NCC_WEBHOOK_SECURITY.md) |

Comparison uses constant-time equality after hashing.

---

## 3. Lifecycle

| Status | Meaning |
|--------|---------|
| `ACTIVE` | Usable |
| `REVOKED` | Immediately unusable |
| `EXPIRED` | Past `expiresAt` |
| `ROTATED` | Replaced; immediately revoked (no overlap by default) |

Rotation policy: **immediate revocation** of the previous credential. The old row is renamed to free the institution-scoped unique name, marked `ROTATED`, and the new credential takes the original name.

`lastUsedAt` updates are throttled (~60s) to limit write pressure.

---

## 4. Scopes

Server-enforced only:

| Scope | Purpose |
|-------|---------|
| `institution:read` | Institution profile |
| `routing:read` | Routing numbers |
| `accounts:read` | Settlement accounts |
| `settlements:read` | List/detail |
| `settlements:create` | Submit settlement |
| `settlements:cancel` | Cancel |
| `settlements:reverse` | Request reversal |
| `webhooks:read` | List endpoints/deliveries |
| `webhooks:write` | Manage endpoints / test / redeliver |
| `api_logs:read` | Institution API logs |

Unsupported scopes are rejected at credential creation. Missing scopes return `403 INSUFFICIENT_SCOPE`.

---

## 5. Authentication flow

```mermaid
sequenceDiagram
  participant Client
  participant API as /api/ncc/v1
  participant Auth as Auth service
  participant DB as Credentials

  Client->>API: Authorization Bearer ncc_live_prefix_secret
  API->>Auth: authenticateNccApiRequest
  Auth->>Auth: Parse token (no oracle)
  Auth->>DB: Lookup by keyPrefix + environment
  Auth->>Auth: Hash secret + timing-safe compare
  Auth->>Auth: Check status, expiry, institution state
  alt Invalid
    Auth-->>API: 401 UNAUTHORIZED (sanitized)
  else Valid
    Auth-->>API: credentialId, institutionId, scopes, environment
    API->>API: require scope + rate limit
    API->>API: handler
  end
```

Rejection reasons (all return the same sanitized `UNAUTHORIZED` to clients):

- Missing / malformed token
- Unknown prefix
- Incorrect secret
- Revoked / expired / rotated
- Inactive, suspended, terminated, or non-participant institution
- Wrong environment for the operation

---

## 6. Credential rotation diagram

```mermaid
flowchart TD
  A[ACTIVE credential A] --> B[Create new secret]
  B --> C[New ACTIVE credential B]
  C --> D[Rename A + mark ROTATED/revoked]
  D --> E[B takes original name]
  E --> F[A immediately unusable]
```

---

## 7. Portal permissions

| Permission | Typical roles |
|------------|---------------|
| `manage_api_credentials` | Owner, Admin |
| `view_api_credentials` | Owner, Admin, Settlement Manager, Auditor |
| `manage_webhooks` | Owner, Admin |
| `view_webhooks` | Owner, Admin, Settlement Manager, Auditor |
| `view_api_logs` | Owner, Admin, Settlement Manager, Auditor |

UI visibility never grants capability; server functions enforce permissions.

---

## 8. Security recommendations

1. Store secrets in a vault / HSM-backed secret manager
2. Prefer short-lived credentials with explicit `expiresAt`
3. Rotate on staffing changes and suspected exposure
4. Grant least-privilege scopes
5. Monitor `401` spikes via ops health / API logs
6. Never commit tokens to source control

---

## 9. Examples

### cURL

```bash
curl -sS https://example.ncc/api/ncc/v1/institution \
  -H "Authorization: Bearer ncc_live_abcdefgh_REPLACE_WITH_SECRET"
```

### TypeScript

```ts
const headers = { Authorization: `Bearer ${token}` };
```

### Python

```python
headers = {"Authorization": f"Bearer {token}"}
```
