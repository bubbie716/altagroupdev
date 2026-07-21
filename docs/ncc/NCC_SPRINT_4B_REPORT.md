# NCC Sprint 4B Report — Participant Application and TEST Access

**Date:** 2026-07-17  
**Code root:** `altaweb/`

## What landed

- Dedicated `NccParticipantApplication` model (+ transitions, staff-only internal notes)
- Applicant routes: `/participation/apply`, `/participation/applications`, `/participation/applications/$id`
- Staff queue: `/portal/applications` (NCC staff only)
- Participation page CTA wires to the real application flow
- TEST provisioning on `APPROVED_FOR_TEST`: institution (`CERTIFICATION`), owner membership, reserved routing number, one TEST credential (secret once)
- Account-identifier format stored as opaque participant-owned JSON (no NCC universal regex)
- API auth allows TEST credentials for `CERTIFICATION`; LIVE still requires `ACTIVE` + `isNCCParticipant`

## Application lifecycle

`DRAFT → SUBMITTED → UNDER_REVIEW → INFORMATION_REQUIRED | TECHNICAL_REVIEW → APPROVED_FOR_TEST → CERTIFICATION → APPROVED_FOR_LIVE`  
Terminal: `REJECTED`, `WITHDRAWN`  

Invalid transitions rejected server-side; each transition records actor, timestamps, and reason.

`APPROVED_FOR_LIVE` is administrative only — LIVE activation remains a 4C concern.

## TEST provisioning behavior

On first `APPROVED_FOR_TEST`:

- Create/link `FinancialInstitution` with status `CERTIFICATION`, `isNCCParticipant=false`
- Exactly one `INSTITUTION_OWNER` for the applicant
- Reserve primary routing number (`RESERVED`, not activated)
- Issue one TEST API credential via existing credential service (hash stored; secret returned once)
- No LIVE credential, no settlement account / float seed, no live settlement routes

Repeated provisioning is idempotent.

## Security boundaries

- Auth required for applicant private data
- Applicants see only their applications; never internal notes
- Staff-only review mutations
- Fields locked after submit unless `INFORMATION_REQUIRED`
- TEST credentials cannot create live settlements; LIVE credentials denied for CERTIFICATION institutions
- Document checklist recorded; secure private upload UI deferred (existing Blob/document-storage exists)

## Test results

- Focused 4B: **3/3 pass**
- Full `npm run test:ncc`: **105/105 pass**
- Typecheck: within baseline (**336/363**; improved vs prior 363/363 ceiling)

## Remaining blockers for 4C

- Secure document upload UI for regulatory packets
- Technical certification checklist / LIVE promotion workflow
- LIVE credential issuance + settlement-account funding
- Activate reserved routing numbers
- External adapter / account-directory onboarding
- Spreadsheet account-directory upload

## GO/NO-GO

**GO** for TEST-path participant onboarding and staff review.  
**NO-GO** for LIVE settlement or production money movement.
