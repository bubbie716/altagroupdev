import { BankReviewButton } from "@/components/bank/bank-review-button";
import {
  rejectCompanyVerificationRecord,
  verifyCompanyRecord,
} from "@/lib/company/company.functions";

export function CompanyVerificationActions({
  companyId,
  verificationStatus,
}: {
  companyId: string;
  verificationStatus: string;
}) {
  const isVerified = verificationStatus === "Verified";
  const isRejected = verificationStatus === "Rejected";

  return (
    <div className="flex flex-wrap gap-2">
      {!isVerified && (
        <BankReviewButton
          label="Verify"
          variant="primary"
          onAction={async () => {
            await verifyCompanyRecord({ data: { companyId } });
          }}
        />
      )}
      {!isVerified && !isRejected && (
        <BankReviewButton
          label="Reject verification"
          variant="danger"
          onAction={async () => {
            await rejectCompanyVerificationRecord({ data: { companyId } });
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
