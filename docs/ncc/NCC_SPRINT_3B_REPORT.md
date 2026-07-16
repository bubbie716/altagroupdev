# NCC Sprint 3B Report — Institution API, Credentials & Signed Webhooks

**Date:** 2026-07-16 (corrected after Sprint 3B.1)  
**Sprint:** NCC Sprint 3B — Institution API, Credentials & Signed Webhooks  
**Code root:** `altaweb/src/server/ncc/`, `altaweb/src/routes/api/ncc/v1/`, `altaweb/src/routes/portal/developers/`

> **Correction:** The original Sprint 3B closeout overstated readiness. See [NCC_SPRINT_3B1_REPORT.md](./NCC_SPRINT_3B1_REPORT.md) for remediation of credential delimiter collisions, SSRF DNS pinning, claim leases, list validation, missing audits, and production `NCC_SECRETS_KEY`.

---

## 1. Executive summary

Sprint 3B exposes the proven Sprint 3A/3A.1 real-time gross settlement engine to approved institutional machine clients under `/api/ncc/v1`, with hashed API credentials, encrypted webhook signing secrets, durable signed delivery, SSRF protection, DB-backed rate limits, sanitized request logs, and an institution-isolated developer portal.

The API does **not** redesign or bypass the financial core. Settlements still flow:

credential → auth/scopes → validation → rate limit → existing NCC settlement services → execution → outbox → signed webhooks.

**Recommendation after 3B.1 remediation: GO** (see Sprint 3B.1 report)

---

## 2. Routes implemented

| Method | Path |
|--------|------|
| GET | `/api/ncc/v1/institution` |
| GET | `/api/ncc/v1/institution/routing-numbers` |
| GET | `/api/ncc/v1/institution/settlement-accounts` |
| POST | `/api/ncc/v1/settlements` |
| GET | `/api/ncc/v1/settlements` |
| GET | `/api/ncc/v1/settlements/:reference` |
| POST | `/api/ncc/v1/settlements/:reference/cancel` |
| POST | `/api/ncc/v1/settlements/:reference/reverse` |

Portal: `/portal/developers` (+ credentials, webhooks, api-logs, documentation).

---

## 3. API versioning

Versioned under `/api/ncc/v1`. Breaking changes require a new major path.

---

## 4. Credential architecture

Model: `NccApiCredential`  
Statuses: `ACTIVE`, `REVOKED`, `EXPIRED`, `ROTATED`  
Environments: `TEST`, `LIVE`  
Bearer format: `ncc_<live|test>_<prefix>_<secret>`

---

## 5. Secret-storage design

| Secret type | Storage |
|-------------|---------|
| API credential | One-way hash only |
| Webhook signing | AES-GCM via `encryptSecret` (`NCC_SECRETS_KEY` / `SESSION_SECRET`) |

Raw secrets shown once at create/rotate. Never logged.

---

## 6. Scope model

Explicit scopes (`institution:read`, `routing:read`, `accounts:read`, `settlements:*`, `webhooks:*`, `api_logs:read`) enforced server-side on every route. Unsupported scopes rejected at credential creation.

---

## 7. Authentication flow

Parse Bearer → lookup by prefix/environment → hash + timing-safe compare → status/expiry/institution gates → return sanitized `UNAUTHORIZED` on any failure (no oracle). LIVE required for financial mutations; TEST credentials cannot create live settlements.

---

## 8. Settlement API behavior

- Sender always from credential
- Immediate processing via existing `submitInstruction` path
- No `settleImmediately` option
- Instruction + execution state returned accurately (including retry / manual review)
- Cancel uses existing cancellation policy
- Reverse creates `NccSettlementReversalRequest` `PENDING_REVIEW` (safer default; no auto-compensation)

---

## 9. Idempotency behavior

`Idempotency-Key` required on submit. Scoped to sending institution. Same key + same payload returns original; same key + different payload → `409 IDEMPOTENCY_CONFLICT`.

---

## 10. Rate limiting

DB-backed buckets (`NccApiRateLimitBucket`) by credential, institution, route class, optional IP hash. Returns `429 RATE_LIMITED` with `Retry-After`. Suitable for multi-instance serverless; Redis upgrade deferred for extreme throughput.

---

## 11. Request logging

`NccApiRequestLog`: requestId, institution, credential, route, status, errorCode, latency, idempotency key **prefix**, hashed IP, user-agent. No Authorization, secrets, or full financial bodies. Retention prune (~90 days) via workers.

---

## 12. Webhook architecture

Outbox fanout → `NccWebhookEvent` (per institution) → `NccWebhookDelivery` (unique per event/endpoint) → signed POST. Workers claim deliveries; failures never mutate settlement finality.

---

## 13. Events supported

`settlement.submitted|ncc_posted|completed|failed|retry_pending|manual_review|reversed|compensated`

---

## 14. Signing implementation

`HMAC-SHA256(secret, timestamp + "." + rawBody)` with headers `NCC-Event-Id`, `NCC-Event-Type`, `NCC-Delivery-Id`, `NCC-Timestamp`, `NCC-Signature`. Constant-time verify helpers + test vector coverage.

---

## 15. SSRF protections

HTTPS required in LIVE; reject embedded credentials, loopback/private/link-local/metadata/IPv6 reserved, DNS to blocked addresses; no redirects; timeouts; response size caps. Fixed unsigned IP mask comparisons so `169.254.169.254` is correctly blocked.

---

## 16. Delivery and retry behavior

Exponential backoff + jitter; bounded attempts; disablement cancels; manual redelivery audited; worker crash-safe via status claim; one logical delivery per event/endpoint.

---

## 17. Portal developer section

Credentials, webhooks, API logs, documentation. Permission-gated server functions. Secrets shown once in UI.

---

## 18. Institution isolation

Credentials, endpoints, events, deliveries, and API logs are institution-scoped. Settlement reads require sender or receiver. Cross-institution detail access returns `404 NOT_FOUND`.

---

## 19. Schema changes

Models: `NccApiCredential`, `NccWebhookEndpoint`, `NccWebhookEvent`, `NccWebhookDelivery`, `NccApiRequestLog`, `NccApiRateLimitBucket`, `NccSettlementReversalRequest`  
Plus related enums, audit entity types, and User/Institution relations.

---

## 20. Migrations

`prisma/migrations/20260716120000_ncc_institution_api_3b` — applied via `prisma migrate deploy`.

---

## 21. Workers

`runNccSettlementWorkers` extended: outbox→webhook fanout handlers, webhook delivery/retry, credential expiry, rate-limit prune, API log prune. Ops health includes API + webhook metrics.

---

## 22. Audit events

Credential create/rotate/revoke/expire; auth/scope reject (sparingly); webhook endpoint lifecycle; secret rotate; test send; delivery success/fail; redelivery requested. No raw secrets in metadata.

---

## 23. Tests added

`src/server/ncc/ncc-api-3b.test.ts` — crypto, SSRF, signing, auth, rotation, settlement API idempotency, isolation, rate-limit path, fanout, SSRF delivery rejection, scope enforcement.

`test:ncc` runs serially (`--test-concurrency=1`) to avoid DB lock contention across settlement suites.

---

## 24. Validation results (corrected)

| Check | Result |
|-------|--------|
| Typecheck vs baseline 363 | Pass (**363**/363 observed; must not rise) |
| `npm run test:ncc` after 3B.1 | Pass (**64**/64), five consecutive runs |
| Sprint 3B.1 lease migration | Applied |
| Production build | Pass |

Corrected prior inaccuracies: typecheck was not 331/363; worker claims were not fully crash-safe; delivery/expiry audits were missing; SSRF had DNS TOCTOU; credential `_` prefixes caused intermittent auth failures.

---

## 25. Known limitations

- No separate TEST settlement ledger; TEST credentials cannot mutate live money
- Institution API reversals require operations review
- DB-backed rate limits (not Redis)
- Optional routing/institution status webhook events not default-subscribed
- No public developer self-registration

---

## 26. Deferred work

- Redis / shared cache rate limiting at very high QPS
- Optional secret-overlap window for webhook rotation
- Certification / billing / open production API access
- ISO 20022 / ACH / external RTGS

---

## 27. Readiness recommendation

Original Sprint 3B closeout claimed **GO** prematurely.

**After Sprint 3B.1 remediation: GO** — see [NCC_SPRINT_3B1_REPORT.md](./NCC_SPRINT_3B1_REPORT.md).
