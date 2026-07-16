# NCC Sprint 3C Report — Customer Bank Website Transfers

**Date:** 2026-07-16  
**Sprint:** NCC Sprint 3C — Customer Bank Website Transfers  
**Code root:** `altaweb/`

---

## 1. Executive summary

Sprint 3C activates `/bank/transfers/interbank` for authenticated customers to fund their own Alta Terminal trading-cash account from a personal Alta Bank account through existing NCC settlement services.

**Recommendation: GO**

GO criteria met:

- Website is no longer a disabled wire preview for the supported path
- Customers do not handle institution API credentials
- Company Bank accounts cannot fund personal Terminal cash (UI filter + server enforcement)
- Idempotent submit with payload conflict detection; double-submit reuses one key
- End-to-end Bank debit and Terminal credit complete immediately and individually

---

## 2. Website route activated

| Item | Detail |
|------|--------|
| Route | `/bank/transfers/interbank` |
| Live component | `BankTerminalFundingForm` |
| History | `TerminalFundingHistory` |
| External wires | Separate “Coming soon” preview (`TransferFormPreview`) |
| Scheduled NCC wires | Still blocked (`canManage={false}` + server reject) |

Page includes: personal source selector, “My Alta Terminal account”, Bank available balance, Terminal cash balance, amount, FLR currency, optional memo, review step, immediate/final disclosure, submit + loading, success/processing/failure states, recent history, link to source account activity.

---

## 3. Service functions added

| Server function | Purpose |
|-----------------|---------|
| `fetchTerminalFundingSources` | Personal eligible Bank accounts + Terminal cash snapshot |
| `fetchTerminalFundingHistory` | Bounded recent funding history for signed-in user |
| `fetchTerminalFundingRequest` | Poll/refresh a single request (ownership-scoped) |
| `submitTerminalFundingTransfer` | Auth + rate limit + `submitCustomerTerminalFunding()` |

Core settlement remains:

`submitTerminalFundingRequest()` / `submitCustomerTerminalFunding()` in `src/server/ncc/ncc-funding.service.ts`

No browser calls to the public institution API. No duplicated settlement logic in React.

---

## 4. Ownership controls

- Source accounts must be personal (`ownershipType` / `companyId` checks)
- Authenticated user must own the Bank account (`userId` match)
- Company-owned accessible accounts rejected with `COMPANY_SOURCE_NOT_SUPPORTED`
- Selector filters company and withdrawal-restricted accounts
- History and get-by-id scoped strictly to `userId`

Business Terminal funding is **not** enabled in this release.

---

## 5. Idempotency behavior

- One UUID per intended transfer (`resolveFundingIdempotencyKey`)
- Retries after timeout reuse the same key
- Submit disabled while in flight
- Same key + same payload → original result
- Same key + different source/amount/currency → `IDEMPOTENCY_CONFLICT`
- Settlement adapter holds/commits remain idempotent under the instruction key

Failed adapter outcomes (e.g. NSF) now throw `NccFundingError` after persisting the failed funding request so the website never treats failure as success.

---

## 6. Exact Bank and Terminal balance verification

Integration test (`ncc-funding-3c.test.ts`):

1. Submit `1.00 FLR` Bank → Terminal  
2. Bank balance decreases by exactly `1.00`  
3. Terminal available cash increases by exactly `1.00`  
4. Instruction status `SETTLED`, execution `COMPLETED` (no batch clearing state)  
5. Bank activity description: `Transfer to Alta Terminal · {publicReference}`  
6. Matching Terminal cash ledger credit present  
7. Duplicate idempotent submit does not move value again  

Manual website check (operator): sign in → Transfers → Interbank → personal account → My Alta Terminal → `1.00 FLR` → review → confirm immediate completion and balances.

---

## 7. Customer-facing statuses

| Internal condition | Label |
|--------------------|-------|
| Preparing / created | Preparing |
| NCC posted / in flight | Sent to NCC |
| Execution completed + Terminal credited | Completed |
| Retry pending / source committed | Delayed—still processing |
| Manual review | Needs review |
| Failed / cancelled | Failed |
| Reversed | Reversed |

“Completed” requires destination credit path completion (`execution.status === COMPLETED`), not NCC ledger post alone.

---

## 8. Copy / honesty updates

Updated:

- Transfers hub Interbank card
- Contacts page interbank copy
- Scheduled interbank notice (`INTERBANK_EXECUTION_NOTICE`)
- `INTERBANK_TRANSFERS_UNAVAILABLE_MESSAGE` (external wires still unavailable)
- Scheduled-transfer service reject message
- External wire preview (“Coming soon”)

**Available now:** Bank → my Alta Terminal (instant NCC)  
**Coming soon:** other NCC institutions / external beneficiaries; scheduled/recurring NCC wires

---

## 9. Test results

| Suite | Result |
|-------|--------|
| `npm run test:ncc` (includes `ncc-funding-3c` + website route tests) | **Pass** (78 tests) |
| Website route activation / idempotency helper / status labels | Pass |
| Company → personal Terminal rejection | Pass |
| History isolation | Pass |
| NSF / restricted / other-user source | Pass |
| Existing NCC API + webhook + 3A.1 + 3B/3B.1 | Pass |

---

## 10. Build / Prisma validation

| Check | Result |
|-------|--------|
| `npx prisma format` | Pass |
| `npx prisma validate` | Pass |
| `npx prisma generate` | Pass |
| `npx prisma migrate status` | Up to date (no new migration required) |
| `npm run typecheck` | Within baseline (363/363) |
| `npm run build` | Pass |

---

## 11. Remaining limitations

1. **External institution wires** — not enabled; contacts can be saved only.  
2. **Business / company Terminal funding** — rejected; no company Terminal cash path in this sprint.  
3. **Scheduled / recurring NCC transfers** — explicitly blocked.  
4. **Arbitrary beneficiaries** — not supported until a secure public account-addressing system exists.  
5. **Adapter copy** — Alta Bank debit/credit descriptions use Terminal-oriented customer language (current Bank↔Terminal product path).  

---

## 12. Key files

- `src/routes/bank/transfers/interbank.tsx`
- `src/components/bank/bank-terminal-funding-form.tsx`
- `src/lib/bank/ncc-terminal-funding.functions.ts`
- `src/lib/bank/ncc-terminal-funding-idempotency.ts`
- `src/server/ncc/ncc-funding.service.ts`
- `src/server/ncc/adapters/alta-bank.adapter.ts`
- `src/server/ncc/ncc-funding-3c.test.ts`
- `src/lib/bank/ncc-terminal-funding-website.test.ts`
