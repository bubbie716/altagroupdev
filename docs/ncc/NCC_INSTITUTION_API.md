# NCC Institution API

**Newport Clearing Corporation — Sprint 3B**  
Base path: `/api/ncc/v1`

Related: [Authentication](./NCC_API_AUTHENTICATION.md) · [Webhooks](./NCC_WEBHOOKS.md) · [Webhook Security](./NCC_WEBHOOK_SECURITY.md) · [Real-Time Settlement](./NCC_REAL_TIME_SETTLEMENT.md)

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

Example body:

```json
{
  "receivingRoutingNumber": "012000001",
  "amount": "100.00",
  "currency": "FLR",
  "purpose": "Treasury transfer",
  "externalReference": "client-transfer-4821"
}
```

Rules:

- Sending institution is always derived from the credential
- Sending routing number is resolved server-side from the institution’s primary active routing number
- Receiving institution is resolved from the receiving routing number
- Self-settlement is denied
- Amounts are decimal strings (no floating-point math)
- Same key + same payload → original result
- Same key + different payload → `409 IDEMPOTENCY_CONFLICT`

Response includes `reference`, instruction `status`, `executionStatus`, `executionStep`, amount, currency, institutions, timestamps, and failure fields when applicable.

---

## 7. Settlement reads

List and detail return instructions where the authenticated institution is sender **or** receiver.

Safe filters: status, execution status, direction, created date, public reference, external reference, cursor pagination (bounded page size).

Invalid `status`, `executionStatus`, `direction`, `limit`, or `cursor` values return **400** with the standard error envelope (never incidental 500s). Cursor is a compound `createdAt|id` token for stable ordering.

Receiving institutions see redacted sender private account references.

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
- Set instruction/execution status or ledger balances
- Bypass routing validation
- Invoke compensation directly
- Access another institution’s resources
- Pass credentials in query strings

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
