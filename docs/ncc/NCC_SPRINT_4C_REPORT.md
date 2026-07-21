# NCC Sprint 4C Report — External Connectivity, Directory, Certification

**Date:** 2026-07-17  
**Code root:** `altaweb/`

## What landed

- **4B correction:** TEST approval provisions institution/membership/routing only. Staff never receive API secrets. Institution owners create/rotate TEST credentials in Developers → API Credentials (secret once; hash stored).
- Participant connector config (API / DIRECTORY), encrypted auth secret, timeouts, certification status
- Versioned account-directory CSV import: upload → validate → review diff → activate / rollback
- External participant adapter (`resolve` + money ops) wired for non-Alta institutions
- Staff certification checklist/run + LIVE promotion gates and atomic activation
- Portal: `/portal/developers/connector`, `/portal/developers/directory`, `/portal/certification/$institutionId`

## Connector and directory behavior

- **API mode:** real-time resolve + signed debit/credit ops via pinned HTTPS transport (no redirects, DNS pin, SSRF blocks, size/timeouts).
- **DIRECTORY mode:** resolves `accountIdentifier` → opaque `participantAccountReference` from the active version only. Spreadsheet alone cannot move money or pass money-movement certification.
- Directory scoped per institution + currency; identifiers preserved exactly; activation atomic; one active version; audit on upload/activate/rollback; public views mask identifiers and never return participant references.

## Certification gates

Checklist covers auth, resolve, unavailable/currency cases, prepare/commit/release/credit/compensate (+ duplicates), status recovery, timeout, signature, webhooks, reconciliation, and **money_movement_requires_api**. Directory-only runs fail that gate.

## LIVE activation behavior

Requires `APPROVED_FOR_LIVE`, institution `CERTIFICATION`, certified connector, contacts, reserved routing, no open `INFORMATION_REQUIRED`. Atomically: `ACTIVE` + `isNCCParticipant=true`, activate routing, create FLR settlement account at **0.00** if missing (never 1B float). Owner creates LIVE credential afterward — never auto-issued.

## Security boundaries

- Secrets encrypted at rest; never in metadata/logs/browser storage/public responses
- Staff cannot retrieve owner secrets after issuance
- Settlement operators cannot alter connector secrets without credential-manage permission
- Cross-institution directory/connector/certification isolation
- Ambiguous connector timeout → status query by same idempotency key; no replacement settlement

## Test / typecheck results

- Focused 4C: **9/9 pass**
- Full `npm run test:ncc`: **114/114 pass**
- Typecheck: within baseline (**339/363**)

## Remaining NCC v1 freeze blockers

- Secure regulatory document upload UI (deferred from 4B)
- Production connector soak / real participant certification evidence
- Authorized liquidity funding workflow (separate from promotion zero balance)
- Runtime mock-data removal (explicitly out of scope for 4C)

## GO/NO-GO

**GO** for external TEST connectivity, directory import, certification, and gated LIVE activation (zero settlement account).  
**NO-GO** for production money movement until a real participant completes certification against a non-stub connector and authorized liquidity is funded.
