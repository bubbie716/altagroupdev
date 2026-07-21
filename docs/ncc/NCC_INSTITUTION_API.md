# NCC Institution API

**Newport Clearing Corporation — Sprint 3B / 4A**  
Base path: `/api/ncc/v1`

Related: [Authentication](./NCC_API_AUTHENTICATION.md) · [Webhooks](./NCC_WEBHOOKS.md) · [Webhook Security](./NCC_WEBHOOK_SECURITY.md) · [Real-Time Settlement](./NCC_REAL_TIME_SETTLEMENT.md) · [Sprint 4A Account Addressing](./NCC_SPRINT_4A_ACCOUNT_ADDRESSING_REPORT.md)

---

## 1. Overview

The Institution API exposes the existing NCC real-time gross settlement engine to approved institutional machine clients.

Every settlement is:

- Submitted individually
- Validated immediately
- Processed immediately
- Protected by idempotency
- Scoped to the authenticated institution
- Recoverable after interruption
- Traceable via request logs, audit events, settlement execution, and webhooks

The API **does not** implement a parallel settlement engine. Routes call the same trusted NCC settlement services used internally.

---

## 2. Versioning

| Item | Value |
|------|-------|
| Current version | `v1` |
| Base URL | `/api/ncc/v1` |
| Breaking changes | New major path (`/api/ncc/v2`) |

---

## 3. Environments

| Credential environment | Financial mutations | Notes |
|------------------------|---------------------|-------|
| `LIVE` | Allowed | Production settlements |
| `TEST` | Blocked for live settlement create/cancel/reverse | No separate test settlement ledger is faked |

---

## 4. Routes

### Institution

| Method | Path | Scope |
|--------|------|-------|
| `GET` | `/api/ncc/v1/institution` | `institution:read` |
| `GET` | `/api/ncc/v1/institution/routing-numbers` | `routing:read` |
| `GET` | `/api/ncc/v1/institution/settlement-accounts` | `accounts:read` |

### Settlements

| Method | Path | Scope |
|--------|------|-------|
| `POST` | `/api/ncc/v1/settlements` | `settlements:create` |
| `GET` | `/api/ncc/v1/settlements` | `settlements:read` |
| `GET` | `/api/ncc/v1/settlements/:reference` | `settlements:read` |
| `POST` | `/api/ncc/v1/settlements/:reference/cancel` | `settlements:cancel` |
| `POST` | `/api/ncc/v1/settlements/:reference/reverse` | `settlements:reverse` |

---

## 5. Response envelope

Success:

```json
{
  "data": {},
  "requestId": "req_...",
  "timestamp": "2026-07-16T12:00:00.000Z"
}
```

Error:

```json
{
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "The sending settlement account has insufficient available funds."
  },
  "requestId": "req_...",
  "timestamp": "2026-07-16T12:00:00.000Z"
}
```

HTTP status mapping:

| Status | Meaning |
|--------|---------|
| `400` | Invalid request |
| `401` | Authentication failed |
| `403` | Insufficient scope / forbidden institution state |
| `404` | Institution-owned resource not found |
| `409` | Idempotency or lifecycle conflict |
| `422` | Valid request that cannot be processed |
| `429` | Rate limited |
| `500` | Sanitized internal failure |
| `503` | Temporary NCC / adapter unavailability |

---

## 6. Settlement submission

`POST /api/ncc/v1/settlements`

**Required header:** `Idempotency-Key: <client-generated-key>`

### Payment addressing (Sprint 4A)

NCC treats an account identifier as an **opaque, institution-specific string**. The routing number selects the institution responsible for validating and resolving it.

```text
Routing number → institution
Account identifier → account at that institution (opaque string)
```

NCC standardizes the request envelope. It does **not** standardize the internal structure of every participant’s account identifiers. Digits-only, alphanumeric, and punctuated identifiers are all valid at the network layer when they pass envelope checks.

Public API fields remain `sourceAccountNumber` / `destinationAccountNumber` for v1 stability; their values are opaque institution-specific account identifiers (not a universal “account number format”).

Customer-facing settlement requests must supply those identifiers, never internal database IDs.

Example body:

```json
{
  "sendingRoutingNumber": "011000002",
  "receivingRoutingNumber": "012000001",
  "sourceAccountNumber": "AB-2000-482913",
  "destinationAccountNumber": "840942513093",
  "amount": "100.00",
  "currency": "FLR",
  "purpose": "Treasury transfer",
  "externalReference": "client-transfer-4821"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `receivingRoutingNumber` | Yes | Resolves the receiving institution |
| `amount` | Yes | Decimal string |
| `currency` | No | Defaults to `FLR` |
| `sourceAccountNumber` | When debiting a customer account | Opaque institution-specific identifier (1–64 chars; format owned by sender) |
| `destinationAccountNumber` | When crediting a customer account | Opaque institution-specific identifier (format owned by receiver) |
| `sendingRoutingNumber` | No | If supplied, must be ACTIVE and belong to the credential’s institution |
| `purpose` / `externalReference` | No | Existing optional fields |

**Rejected (hard):** `sourceAccountReference` / `destinationAccountReference` — these are not accepted on the public API (HTTP 400).

Rules:

- Sending institution is always derived from the credential (cannot impersonate another sender)
- Default sending routing number is the institution’s primary ACTIVE routing number when omitted
- Receiving institution is resolved from the receiving routing number
- NCC envelope-validates identifiers only (string, length, no control chars / null bytes, no leading/trailing whitespace). It does **not** change case, strip punctuation, remove leading zeros, or apply a universal bank regex.
- Identifiers are resolved by the institution adapter selected by the routing number **before** any NCC ledger post
- The same identifier string may exist at two different banks; network identity is `(routing number + identifier)`
- Self-settlement is denied
- Amounts are decimal strings (no floating-point math)
- Idempotency hash includes routing numbers, exact envelope-validated account identifiers, amount, and currency (no global case/punctuation normalization)
- Same key + same canonical payload → original result
- Same key + different address or financial body → `409 IDEMPOTENCY_CONFLICT`

### Addressing errors (sanitized)

| Code | Meaning |
|------|---------|
| `INVALID_PAYMENT_ADDRESS` | Malformed address or internal-ID shape rejected |
| `ACCOUNT_UNAVAILABLE` | Unknown / closed / frozen / unauthorized (non-enumerating) |
| `ACCOUNT_NOT_DEBITABLE` | Source cannot be debited |
| `ACCOUNT_NOT_CREDITABLE` | Destination cannot be credited |
| `UNSUPPORTED_CURRENCY` | Currency not supported for the account |
| `ROUTING_NUMBER_UNAVAILABLE` | Routing unusable or not owned by credential institution |
| `SOURCE_ADAPTER_UNAVAILABLE` | Sending participant has no adapter |
| `DESTINATION_ADAPTER_UNAVAILABLE` | Receiving participant has no adapter |

Public responses and webhooks never include internal adapter account references or full account numbers. Masked numbers may appear on authorized portal history.

Response includes `reference`, instruction `status`, `executionStatus`, `executionStep`, amount, currency, institutions, timestamps, and failure fields when applicable.

---

## 7. Settlement reads

List and detail return instructions where the authenticated institution is sender **or** receiver.

Safe filters: status, execution status, direction, created date, public reference, external reference, cursor pagination (bounded page size).

Invalid `status`, `executionStatus`, `direction`, `limit`, or `cursor` values return **400** with the standard error envelope (never incidental 500s). Cursor is a compound `createdAt|id` token for stable ordering.

Receiving institutions see redacted sender-private fields. Internal adapter account references and full account numbers are never returned.

---

## 8. Cancellation and reversal

**Cancel:** sending institution only; only before preparation/finality cutoff; uses existing cancellation service.

**Reverse:** creates an `NccSettlementReversalRequest` in `PENDING_REVIEW` by default. Institution API reversals do **not** auto-invoke compensation. NCC operations review is required.

---

## 9. Rate limits (per minute, DB-backed)

| Class | Limit |
|-------|-------|
| Read | 120 |
| Settlement submit | 30 |
| Cancel | 20 |
| Reverse | 10 |
| Credential manage | 20 |
| Webhook manage | 20 |
| Webhook test | 10 |

Dimensions: credential, institution, route class, optional IP hash.

---

## 10. What clients cannot do

- Choose the sending institution
- Submit internal database IDs as account addresses
- Set instruction/execution status or ledger balances
- Bypass routing validation or account-resolution adapters
- Invoke compensation directly
- Access another institution’s resources
- Pass credentials in query strings
- Authorize a debit based only on knowing an account number (source ownership / credential institution still required)

---

## 11. Example integrations

### cURL

```bash
curl -sS https://example.ncc/api/ncc/v1/settlements \
  -H "Authorization: Bearer ncc_live_PREFIX_SECRET" \
  -H "Idempotency-Key: transfer-4821" \
  -H "Content-Type: application/json" \
  -d '{
    "receivingRoutingNumber": "012000001",
    "sourceAccountNumber": "AB-2000-482913",
    "destinationAccountNumber": "840942513093",
    "amount": "100.00",
    "currency": "FLR",
    "purpose": "Treasury transfer"
  }'
```

### TypeScript

```ts
const res = await fetch("https://example.ncc/api/ncc/v1/settlements", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.NCC_API_TOKEN}`,
    "Idempotency-Key": crypto.randomUUID(),
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    receivingRoutingNumber: "012000001",
    sourceAccountNumber: "AB-2000-482913",
    destinationAccountNumber: "840942513093",
    amount: "100.00",
    currency: "FLR",
    purpose: "Treasury transfer",
  }),
});
const json = await res.json();
```

### Python

```python
import os, uuid, requests

r = requests.post(
    "https://example.ncc/api/ncc/v1/settlements",
    headers={
        "Authorization": f"Bearer {os.environ['NCC_API_TOKEN']}",
        "Idempotency-Key": str(uuid.uuid4()),
    },
    json={
        "receivingRoutingNumber": "012000001",
        "sourceAccountNumber": "AB-2000-482913",
        "destinationAccountNumber": "840942513093",
        "amount": "100.00",
        "currency": "FLR",
        "purpose": "Treasury transfer",
    },
)
print(r.status_code, r.json())
```

---

## 12. Known limitations

- No distinct TEST settlement ledger; TEST credentials cannot create live settlements
- API reversals require operations review (safer default)
- Rate limiting is database-backed (suitable for multi-instance; document Redis upgrade for very high throughput)
- Public self-registration and open production API access are out of scope
- External banks must implement `resolveAccount` in their own adapter; NCC does not centrally import every external customer account
- Float-only institution legs (no customer account numbers) remain supported for Alta settlement-account float transfers where applicable
