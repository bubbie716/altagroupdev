# NCC Sprint 3B.1 Report — Institution API and Webhook Release Hardening

**Date:** 2026-07-16  
**Sprint:** NCC Sprint 3B.1 — Institution API and Webhook Release Hardening  
**Code root:** `altaweb/`

---

## 1. Executive summary

Sprint 3B.1 remediates release-blocking gaps in the Institution API and webhook platform without redesigning real-time gross settlement.

**Recommendation: GO**

---

## 2. Root causes fixed

| Issue | Root cause | Fix |
|-------|------------|-----|
| Flaky credential auth | Base64URL `keyPrefix` could contain `_`, colliding with bearer delimiters | Hex-only prefixes (`randomHexToken`); exact grammar `ncc_(live\|test)_<hex12>_<secret>` |
| DNS rebinding SSRF | DNS validated then `fetch(hostname)` resolved again | Pin TCP to validated public IP; preserve SNI/`Host` |
| Stranded deliveries/outbox | `DELIVERING` / `PROCESSING` claims never recovered | `claimedAt` + `claimToken` leases with CAS finalize |
| List 500s | Unvalidated enums/cursors/`NaN` limits hit Prisma | Strict 4xx validation + compound `createdAt\|id` cursor |
| Missing audits | Constants existed; writes absent | Expiry / terminal delivery success & failure audits |
| Production pepper | `hashApiSecret` / encryption fell back unsafely | Require `NCC_SECRETS_KEY` in production |

---

## 3. Token-format compatibility

- **New credentials:** lowercase hex prefix (12 chars / 6 bytes). Secrets remain Base64URL (may contain `_`/`-`) as the unambiguous remainder.
- **Legacy:** prefixes containing `_` resolved by longest `keyPrefix` match on the token remainder; ambiguous matches fail closed.
- Prefix uniqueness collisions retry up to 8 times.

---

## 4. SSRF connection-pinning design

1. Validate URL shape  
2. Resolve DNS once (injectable in tests)  
3. Reject if **any** answer is prohibited  
4. Connect via Node `http`/`https` to the pinned IP with custom `lookup`, `servername` (SNI), and `Host`  
5. Redirects rejected  

No validate-then-unpinned-`fetch` sequence remains.

---

## 5. Worker lease/recovery design

| Field | Purpose |
|-------|---------|
| `claimedAt` | Lease start |
| `claimToken` | CAS token for finalize |

Lease: **90s**. Stale `DELIVERING` / `PROCESSING` rows are reclaimable. Finalize updates require matching `claimToken`. Worker health reports `reclaimedStaleWebhookDeliveries` and `reclaimedStaleOutboxEvents`.

---

## 6. API validation changes

- `status` / `executionStatus` allow-lists  
- Invalid `direction` → 400  
- `limit` integer 1–100  
- Cursor: base64url(`createdAt|id`) with existence check  
- Max lengths for idempotency key, purpose, references, reasons  
- Wrong optional JSON types rejected  

---

## 7. Audit changes

Writes added for:

- `NCC_API_CREDENTIAL_EXPIRED`
- `NCC_WEBHOOK_DELIVERY_SUCCEEDED` (once on success)
- `NCC_WEBHOOK_DELIVERY_FAILED` (once on terminal failure)

No raw secrets, Authorization headers, or full bodies.

---

## 8. Secret-key deployment requirements

| Env | Rule |
|-----|------|
| Production (`NODE_ENV` or `VERCEL_ENV` = production) | `NCC_SECRETS_KEY` required, min 32 chars |
| Non-production | `NCC_SECRETS_KEY` → else `SESSION_SECRET` → else explicit dev pepper |

- Documented in `.env.example`  
- Ciphertext version prefix `v1.` for future key rotation  
- Changing the key without re-encryption renders webhook secrets undecryptable  

---

## 9. Files changed (primary)

- `src/server/crypto.ts`
- `src/server/ncc/ncc-api-credential.service.ts`
- `src/server/ncc/ncc-api-auth.service.ts`
- `src/server/ncc/ncc-webhook-ssrf.ts`
- `src/server/ncc/ncc-webhook-pinned-http.ts` (new)
- `src/server/ncc/ncc-webhook-delivery.service.ts`
- `src/server/ncc/ncc-outbox.service.ts`
- `src/server/ncc/ncc-api-settlement.service.ts`
- `src/server/ncc/ncc-api-http.ts` / `ncc-api-rate-limit.service.ts` / `ncc-workers.service.ts`
- `src/lib/ncc/ncc-api-errors.ts`
- `src/routes/api/ncc/v1/settlements/index.ts`
- `prisma/schema.prisma` + `prisma/migrations/20260716180000_ncc_sprint_3b1_leases/`
- `src/server/ncc/ncc-api-3b.test.ts` / `ncc-api-3b1.test.ts` (new)
- Docs under `docs/ncc/` + `.env.example`

---

## 10. Migration status

`20260716180000_ncc_sprint_3b1_leases` — **applied** (`claimedAt`, `claimToken` on outbox + webhook delivery).

---

## 11. Exact test counts

| Suite | Count |
|-------|-------|
| Full `npm run test:ncc` | **64** tests |
| Sprint 3B.1 focused file | **20** tests |
| Prior Sprint 3B file | included in 64 |

---

## 12. Five consecutive NCC runs

Recorded in closeout validation:

| Run | Result |
|-----|--------|
| 1 | Pass (64/64) |
| 2 | Pass (64/64) |
| 3 | Pass (64/64) |
| 4 | Pass (64/64) |
| 5 | Pass (64/64) |

---

## 13. Corrected Sprint 3B claims

The original Sprint 3B report overstated readiness:

- Typecheck observed at **363/363**, not 331/363  
- Worker claims were **not** fully crash-safe before 3B.1  
- Delivery success/failure and credential-expiry audit writes were **missing**  
- SSRF had a DNS validation/connection TOCTOU gap  
- Credential prefix/`_` delimiter collision made auth probabilistically flaky  

Those are corrected in this remediation and reflected in updated 3B report artifacts.

---

## 14. Remaining limitations

- Legacy underscore prefixes rely on bounded scan (≤200) per environment  
- DB-backed rate limits (not Redis)  
- TEST credentials still cannot mutate live money (no fake test ledger)  
- API reversals remain ops-review (`PENDING_REVIEW`)  
- Key rotation of `NCC_SECRETS_KEY` still requires an explicit re-encryption migration job (v1 metadata only)

---

## 15. Readiness recommendation

**GO** — credential tokens are delimiter-safe, SSRF connections are pinned, stale claims recover, public list validation returns 4xx, required audits write, production requires `NCC_SECRETS_KEY`, five consecutive NCC suites pass, typecheck within baseline, migration applied, production build passes.
