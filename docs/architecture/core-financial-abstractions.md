# Core Financial Abstractions


## Design principles

1. **Additive only** — Existing `BankTransaction` rows, APIs, and reference codes continue to work.
2. **Ledger stays canonical** — `BankAccount.balance` and `BankTransaction` remain the source of posted movements.
3. **Abstractions link forward** — New entities provide FK-backed grouping and metadata for future products.
4. **No product migration yet** — Deal room files, proof uploads, and thread assignments are not migrated in this sprint.

---

## Payment

**Table:** `Payment`

A first-class customer payment — the business operation — rather than individual debit/credit ledger legs.

| Field | Purpose |
|-------|---------|
| `paymentType` | `ALTA_PAY`, `INTRABANK_TRANSFER`, `INTERBANK_TRANSFER` (future) |
| `payerUserId` / `recipientUserId` | Customer parties when known |
| `sourceBankAccountId` / `destinationBankAccountId` | Funding and destination accounts |
| `amount`, `currency`, `memo`, `referenceCode` | Payment details |
| `status` | `PENDING` → `COMPLETED` / `FAILED` / `REVERSED` |
| `initiatedByUserId` | Actor who submitted the payment |
| `transferGroupId` | Link to grouped ledger entries |

**Created today for:** Alta Pay (bank-funded), intrabank transfers.


**Service:** `src/server/payment-entity.service.ts` — `recordPairedPaymentInTx()`

---

## TransferGroup

**Table:** `TransferGroup`

Groups all ledger movements belonging to one financial operation.

```
Alta Pay (PAY-xxx)
TransferGroup
├── BankTransaction (DEBIT,  -OUT)
└── BankTransaction (CREDIT, -IN)

Adjustment reversal
TransferGroup
├── BankTransaction (SINGLE, original)
└── BankTransaction (REVERSAL_CREDIT, offset)
```

| Field | Purpose |
|-------|---------|
| `groupType` | `ALTA_PAY`, `INTRABANK_TRANSFER`, `ADJUSTMENT_REVERSAL`, … |
| `referenceCode` | Shared reference (e.g. `PAY-…`, `TRF-…`) |
| `status` | Operation lifecycle |

**BankTransaction additions:** `transferGroupId`, `ledgerRole` (`DEBIT`, `CREDIT`, `SINGLE`, `REVERSAL_*`).

**Future use:** Reconciliation, ops explorer, settlement matching, reversal queries without reference parsing.

---

## FinancialInstitution

**Table:** `FinancialInstitution`

Canonical registry of banks and market infrastructure participants.

| Field | Purpose |
|-------|---------|
| `name`, `shortName` | Display |
| `routingPrefix` | Institution prefix (Alta: `AB`) |
| `institutionType` | `BANK`, `CLEARING_HOUSE`, `BROKER_DEALER`, … |
| `isAlta` | Alta Bank flag |

**Seeded:** Alta Bank (`inst-alta-bank`).


---

## RoutingNumber

**Table:** `RoutingNumber`

Routing numbers linked to `FinancialInstitution`.

**Seeded:** `011000001` (Alta Bank primary — matches `docs/account-numbering.md`).



---

## Bank account ownership

**Field:** `BankAccount.ownershipType` — `PERSONAL` | `COMPANY`

- Personal accounts: `userId` is the owner; `companyId` is null.
- Company accounts: `companyId` is the primary owner; `userId` is the authorized representative at creation time.
- Access control uses `CompanyMembership` roles via `bank-account-access.service.ts` — not solely `userId`.

Existing company accounts are backfilled to `ownershipType = COMPANY` in migration.

---

## PrivateBankingRelationship

**Table:** `PrivateBankingRelationship`

Replaces hardcoded Alta Private banker config with a durable assignment record.

| Field | Purpose |
|-------|---------|
| `customerUserId`, `bankerUserId` | Relationship parties |
| `status` | `ACTIVE`, `INACTIVE`, `PENDING` |
| `assignedAt`, `assignedByUserId`, `notes` | Assignment audit |

**Service:** `src/server/relationship-assignment.service.ts` — `assignPrivateBanker()`, `getActivePrivateBankingRelationship()`

**Future use:** Alta Private UI, relationship timeline, staff workload, Commercial RM parity.

**Not migrated:** Existing `private_client` tag and static banker copy remain authoritative until a later sprint.

---

## Document

**Table:** `Document`

Generic document abstraction for unified file metadata.

| Field | Purpose |
|-------|---------|
| `subjectType`, `subjectId` | Polymorphic subject (transaction, loan, deal room, …) |
| `documentKind` | `proof`, `filing`, `agreement`, … |
| `storageKey`, `fileName`, `mimeType`, `sizeBytes` | Storage reference |
| `uploadedByUserId`, `status` | Provenance and lifecycle |

**Not migrated:** Transaction `proofImageUrl`, `DealRoomDocument`, thread attachments remain in place.

**Future use:** Exchange filings, issuer documents, unified ops document search, compliance retention.

---

## StaffAssignment

**Table:** `StaffAssignment`

One assignment model for staff ↔ subject relationships.

| Field | Purpose |
|-------|---------|
| `staffUserId` | Assigned operator |
| `subjectType`, `subjectId` | `USER`, `COMPANY`, `LOAN_APPLICATION`, `DEAL_ROOM`, … |
| `assignmentType` | `ALTA_PRIVATE_BANKER`, `CREDIT_DESK`, `DEAL_ROOM_OFFICER`, … |
| `status`, `assignedAt`, `assignedByUserId` | Lifecycle |

**Not migrated:** Thread `assignedStaffId`, Deal Room officer FKs remain.

**Future use:** Credit desk queues, commercial banking RM, Exchange listing review, company verification ownership.

---

## Backwards compatibility

| Area | Strategy |
|------|----------|
| APIs | No breaking changes; existing endpoints unchanged |
| Reference codes | `PAY-*`, `TRF-*-OUT/IN` unchanged |
| Alta Pay admin | Still searches by transaction reference prefix |
| Routing display | `getRoutingNumber()` unchanged |
| Proofs / deal docs | Legacy columns and tables untouched |
| Access control | Same membership rules; `ownershipType` is additive |

New Payment/TransferGroup rows are created **in the same DB transaction** as ledger posts for Alta Pay and intrabank transfers. If foundation writes fail, the whole transaction rolls back.

---

## Migration

```bash
npm run db:migrate
# Applies: 20250703250000_core_financial_abstractions
```

Seeds Alta Bank institution and routing number. Backfills `ownershipType` for existing business accounts.

---

## Code map

| Path | Purpose |
|------|---------|
| `prisma/schema.prisma` | Entity definitions |
| `src/server/payment-entity.service.ts` | Payment + TransferGroup writers |
| `src/server/financial-institution.service.ts` | Institution seed + lookup |
| `src/server/relationship-assignment.service.ts` | Private banking + staff assignment + Document |
| `src/lib/bank/account-ownership.ts` | Ownership helpers |
| `src/lib/bank/schema-foundation.test.ts` | Unit tests |
