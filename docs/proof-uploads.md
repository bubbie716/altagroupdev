# Bank proof screenshot uploads

Deposit and withdrawal requests can include screenshot proof images. Proofs are stored in **Vercel Blob** and linked on `BankTransaction` for operator review. The manual review workflow is unchanged — operators still approve or deny each request.

## Storage provider

- **Vercel Blob** via `@vercel/blob`
- Server-side uploads only (`BLOB_READ_WRITE_TOKEN` never exposed to the browser)

## Environment variables

```env
BLOB_READ_WRITE_TOKEN=
```

Create a Blob store in the [Vercel dashboard](https://vercel.com/docs/storage/vercel-blob) and copy the read/write token into your server environment.

## Accepted file types

| Type | MIME |
|------|------|
| PNG | `image/png` |
| JPEG | `image/jpeg` |
| WebP | `image/webp` |

**Not accepted:** PDF, GIF, SVG, executables, or unknown types.

**Max size:** 8MB

## Storage path convention

```
bank-proofs/{userId}/{transactionType}/{YYYYMMDD-HHMMSS}-{random}.{ext}
```

Examples:

- `bank-proofs/clxyz123/deposit/20260623-184422-a8f19c.png`
- `bank-proofs/clxyz123/withdrawal/20260623-184500-bc19d2.jpg`

## Deposit proof flow

1. User selects PNG/JPG/WebP on `/bank/deposit`.
2. Browser POSTs `multipart/form-data` to `/api/bank/deposit-request`.
3. Server validates auth, file type, and size.
4. `uploadBankProof()` stores the file in Vercel Blob.
5. On success, `submitDepositRequest()` creates a `PENDING` deposit with `proofImageUrl` and metadata.
6. If upload fails, **no transaction is created** and the user sees: “Proof upload failed. Please try again.”

## Withdrawal proof flow

1. User submits `/bank/withdraw` with optional supporting screenshot.
2. Browser POSTs to `/api/bank/withdrawal-request`.
3. If a file is included, it is validated and uploaded the same way as deposits.
4. Withdrawal request is created with or without proof depending on user input.

## Operator review flow

1. Open **Internal → Bank Operations** (`/internal/bank`).
2. Pending deposits/withdrawals show proof status:
   - **Proof uploaded** — filename, upload time, **View proof** link (opens in new tab)
   - **No proof attached**
3. Review the screenshot before approving or denying.

## Database fields

On `BankTransaction`:

| Field | Purpose |
|-------|---------|
| `proofImageUrl` | Vercel Blob public URL |
| `proofFileName` | Original sanitized filename |
| `proofUploadedAt` | Upload timestamp |
| `proofMimeType` | Stored MIME type |
| `proofSizeBytes` | File size |

## Security

- Only authenticated users can upload proof (session cookie on API routes).
- Users can only submit requests for accounts they can access.
- File validation runs server-side in `validateProofFile()`.
- Blob token stays server-side.
- TODO: virus/malware scanning before production hardening.

## Future migration (S3 / Supabase)

If moving off Vercel Blob:

1. Replace `uploadBankProof()` implementation in `src/lib/storage/proof-upload.ts`.
2. Keep the same path convention and `BankTransaction` fields.
3. Update `getProofFileUrl()` for the new CDN/base URL.
4. No change to review UI if URLs remain HTTPS.

## Testing checklist

- [ ] Submit deposit with PNG — success message, proof stored
- [ ] Submit deposit with JPG — success
- [ ] Reject file over 8MB — error, no transaction
- [ ] Reject invalid file type (e.g. PDF) — error, no transaction
- [ ] Verify `BankTransaction.proofImageUrl` is a real Blob URL
- [ ] Operator can open **View proof** on `/internal/bank`
- [ ] Simulate upload failure (missing token) — no transaction created
- [ ] Optional withdrawal proof uploads and displays correctly

## Key files

| File | Purpose |
|------|---------|
| `src/lib/storage/proof-upload.ts` | Validation + Vercel Blob upload |
| `src/routes/api/bank/deposit-request.ts` | Deposit multipart endpoint |
| `src/routes/api/bank/withdrawal-request.ts` | Withdrawal multipart endpoint |
| `src/server/bank.service.ts` | Creates transactions with proof metadata |
| `src/components/bank/bank-deposit-form.tsx` | User deposit form |
| `src/components/bank/bank-withdraw-form.tsx` | User withdrawal form |
