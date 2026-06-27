import { BankReviewButton } from "@/components/bank/bank-review-button";
import {
  rejectCompanyVerificationRecord,
  revokeCompanyVerificationRecord,
  verifyCompanyRecord,
} from "@/lib/company/company.functions";
import { normalizeCompanyVerificationStatus } from "@/lib/company/verification-status";

export function CompanyVerificationActions({
  companyId,
  verificationStatus,
}: {
  companyId: string;
  verificationStatus: string;
}) {
  const state = normalizeCompanyVerificationStatus(verificationStatus);
  const isVerified = state === "verified";
  const isRejected = state === "rejected";
  const canReview = state === "unverified" || state === "pending";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canReview && (
        <>
          <BankReviewButton
            label="Verify"
            variant="primary"
            onAction={async () => {
              await verifyCompanyRecord({ data: { companyId } });
            }}
          />
          <BankReviewButton
            label="Reject verification"
            variant="danger"
            onAction={async () => {
              await rejectCompanyVerificationRecord({ data: { companyId } });
            }}
          />
        </>
      )}
      {isVerified && (
        <BankReviewButton
          label="Revoke verification"
          variant="danger"
          onAction={async () => {
            await revokeCompanyVerificationRecord({ data: { companyId } });
          }}
        />
      )}
      {isVerified && (
        <span className="self-center font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--success)]">
          Verified
        </span>
      )}
      {isRejected && (
        <span className="self-center font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Rejected
        </span>
      )}
    </div>
  );
}
