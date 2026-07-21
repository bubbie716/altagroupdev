# NCC Sprint 4A Report — Canonical Account Addressing

**Date:** 2026-07-17  
**Sprint:** NCC v1 Freeze Sprint 4A — Canonical Account Addressing  
**Code root:** `altaweb/`

---

## 1. Executive summary

Sprint 4A replaces public NCC account addressing that used internal Prisma IDs with a routing-number + account-number payment model. Alta Bank and Alta Terminal adapters resolve customer-visible account numbers to opaque internal references before any NCC ledger post. Settlement remains instant individual real-time gross settlement.

**Recommendation: GO** for beginning participant onboarding on the addressing contract.

GO criteria met:

- Public API rejects `sourceAccountReference` / `destinationAccountReference`
- Terminal cash accounts have stable unique account numbers (backfilled)
- Bank website funding submits account numbers through the same settlement path
- Idempotent retries cannot create a second transfer
- Full NCC suite green; typecheck within baseline; production build succeeded
- No mock financial resolution on production paths

---

## 2. What changed

| Area | Change |
|------|--------|
| Schema | `TerminalCashAccount.accountNumber` (unique, required); `SettlementInstruction` addressing snapshot + encrypted full numbers |
| Migration | `20260717120000_ncc_sprint_4a_account_addressing` — backfill then NOT NULL + unique index |
| Adapter contract | Required `resolveAccount({ accountNumber, currency, direction })` |
| Alta Bank | Resolves `AB-####-######`; rejects internal IDs; non-enumerating errors |
| Alta Terminal / Exchange | Resolves 12-digit cash account numbers |
| Settlement submit | Public fields `sourceAccountNumber` / `destinationAccountNumber`; resolve before create; persist masked snapshot |
| Institution API | Clean v1 contract; optional `sendingRoutingNumber` ownership check |
| Webhooks / metadata | Strip internal refs and full account numbers |
| Bank website | Terminal account number masked in selector; idempotency key retained across failed/ambiguous retries |
| Docs | Institution API, Alta integration, RTGS, technical architecture, developer portal |

---

## 3. Schema and migration summary

**TerminalCashAccount**

- `accountNumber TEXT NOT NULL UNIQUE` (indexed)
- Digits-only 12-digit numbers
- Generated with `crypto.randomInt` at create; migration backfill for existing rows
- Not derived from Prisma `id`
- Re-provisioning cannot rewrite numbers or balances

**SettlementInstruction addressing snapshot**

- `sourceAccountNumberMasked` / `destinationAccountNumberMasked`
- `sendingRoutingNumberUsed` / `receivingRoutingNumberUsed`
- `addressResolvedAt`
- `sourceResolverKey` / `destinationResolverKey`
- `sourceAccountNumberEncrypted` / `destinationAccountNumberEncrypted` (ops-scoped; never in webhooks)

**SettlementExecution**

- Continues to store opaque internal `sourceAccountReference` / `destinationAccountReference` for execution resume only (historical + new)

---

## 4. Final public request example

```http
POST /api/ncc/v1/settlements
Authorization: Bearer ncc_live_<prefix>_<secret>
Idempotency-Key: transfer-4821
Content-Type: application/json

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

Sending institution is always the credential’s institution. If `sendingRoutingNumber` is supplied, it must be ACTIVE and owned by that institution.

---

## 5. Adapter contract summary

Successful `resolveAccount` returns (internally only):

- Opaque internal adapter account reference
- Canonical account number
- Masked account number
- Currency, status, debit/credit eligibility
- Optional beneficiary label
- Resolution timestamp + resolver key

External banks later resolve through their own systems; NCC does not import every external customer account. Missing adapters fail with `SOURCE_ADAPTER_UNAVAILABLE` / `DESTINATION_ADAPTER_UNAVAILABLE` before ledger posting.

---

## 6. Security decisions

- Never authorize a debit from account number alone (website ownership checks + credential institution binding remain)
- Unknown / closed / frozen / unauthorized lookups collapse to `ACCOUNT_UNAVAILABLE` externally
- Masked numbers in portal/history; encrypted full numbers only in scoped instruction columns
- Webhook fanout deletes internal refs and full/encrypted account numbers
- API request logging remains sanitized (no raw financial bodies)
- Rate limits on settlement submit unchanged
- No browser-local financial state; no mock account resolution in production paths

---

## 7. Backfill results

Migration applied to the configured development database via `prisma migrate deploy`.

| Check | Result |
|-------|--------|
| `TerminalCashAccount` rows | 80 (all have `accountNumber`) |
| Sample formats | 12-digit digits-only |
| Bank account numbers | Unchanged |
| Balances / ledger entries | Unchanged by migration |
| Unique constraint | Enforced after backfill |

---

## 8. Tests and exact results

Command:

```bash
npm run test:ncc
```

Result:

```text
ℹ tests 91
ℹ suites 16
ℹ pass 91
ℹ fail 0
ℹ duration_ms ~91637
```

Includes new `src/server/ncc/ncc-addressing-4a.test.ts` covering resolve, uniqueness, re-provision, race safety, unknown/frozen/currency/routing, credential isolation, public API rejection of internal IDs, adapter-unavailable, Terminal→Bank addressing, idempotency, and historical readability.

---

## 9. Typecheck result

```bash
npm run typecheck
```

```text
Typecheck within baseline (363/363 errors).
```

No new typecheck debt relative to baseline.

---

## 10. Production build result

```bash
npm run build
```

```text
✓ built in ~925ms
[nitro] ✔ You can preview this build using npx vite preview
```

Build succeeded.

---

## 11. Known limitations

- Float-only legs (no customer account numbers) remain valid for institution settlement-account float transfers
- Historical executions may still contain internal refs as execution data; only new public submissions use the account-number contract
- External-bank connectors and full participant application remain out of scope
- Encrypted full account numbers require configured secrets; if encryption is unavailable, masked snapshot still persists and settlement proceeds

---

## 12. GO / NO-GO

| Gate | Status |
|------|--------|
| Public callers cannot submit internal IDs | Pass |
| Terminal accounts have stable account numbers | Pass |
| Retry cannot move money twice | Pass |
| Account lookup is not an enumeration oracle | Pass |
| Migration does not change balances | Pass |
| NCC financial tests green | Pass (91/91) |
| Production build | Pass |

**GO** — participant onboarding may begin against the Sprint 4A addressing contract. Do not expand into full external connectors, Terminal trading, or Exchange listings in this sprint.

---

## Correction: Institution-Specific Account Identifier Formats

**Date:** 2026-07-17 (corrective pass)

### Principle

> NCC treats an account identifier as an opaque, institution-specific string. The routing number selects the institution responsible for validating and resolving it.

NCC must **not** require every participating bank to use the same account-number format.

### Assumptions found (pre-correction)

| Assumption | Where |
|------------|--------|
| Global AB- uppercase normalization | `normalizePaymentAccountNumber` used by settlement hash + resolution |
| Digits-only / fixed-length framing as network language | Shared helpers + some docs |
| Terminal 12-digit pattern implied as general | Docs / shared module naming |
| Terminal generator never produced leading zeros | `randomInt(100_000_000_000, …)` |

### Code corrected

| Change | Detail |
|--------|--------|
| `validateNccAccountIdentifierEnvelope` | Format-neutral: string, 1–64 chars, no control/null bytes, no leading/trailing whitespace; preserves exact value |
| Removed global AB- uppercase from NCC path | Alta Bank normalization moved to `normalizeAltaBankAccountIdentifier` inside Bank adapter only |
| Settlement idempotency hash | Uses exact envelope-validated identifiers (no case/punctuation mutation) |
| Terminal generator | 12 digit-characters as string; may include leading zeros; never `Number()` |
| Docs / developer portal | State opaque institution-specific identifiers explicitly |
| Tests | `ncc-addressing-4a-formats.test.ts` — alphanumeric, punctuation, leading zeros, dual-routing uniqueness, envelope neutrality |

### Public field names

**Unchanged:** `sourceAccountNumber` / `destinationAccountNumber` retained for pre-freeze v1 stability. Documented as opaque institution-specific account identifiers (not a universal format). No dual-contract support.

### Final NCC validation rules

- Value is a string
- Non-empty, length 1–64
- No control characters / null bytes
- No leading or trailing whitespace
- Reject known internal DB id shapes at the network edge
- **Do not** parse as integer, strip zeros/punctuation/spaces, or change case

### Final uniqueness scope

- Network identity = `(routing number + account identifier)`
- Same identifier string may exist at two banks
- Alta Terminal uniqueness remains institution-scoped (`TerminalCashAccount.accountNumber`)
- Alta Bank uniqueness remains Alta Bank policy — not an NCC participant requirement

### Tests added

`src/server/ncc/ncc-addressing-4a-formats.test.ts` (included in `npm run test:ncc`)

### Migration impact

**None.** No schema change in this corrective pass. Existing Terminal account numbers and balances unchanged.

### Confirmation

- Existing Terminal account identifiers not regenerated
- Balances not rewritten
- Instant individual RTGS path unchanged
- Digits-only remains Alta Terminal policy only

