import { OpsAction } from "@/components/internal/ops-action";
import {
  rejectCompanyVerificationRecord,
  revokeCompanyVerificationRecord,
  verifyCompanyRecord,
} from "@/lib/company/company.functions";
import { normalizeCompanyVerificationStatus } from "@/lib/company/verification-status";

export function CompanyVerificationActions({
  companyId,
  verificationStatus,
  companyName,
}: {
  companyId: string;
  verificationStatus: string;
  companyName?: string;
}) {
  const state = normalizeCompanyVerificationStatus(verificationStatus);
  const isVerified = state === "verified";
  const isRejected = state === "rejected";
  const canReview = state === "unverified" || state === "pending";
  const label = companyName ?? companyId;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canReview && (
        <>
          <OpsAction
            label="Verify"
            variant="primary"
            title="Verify company"
            description="This will mark the company as verified and enable full institutional operations."
            impact={label}
            confirmLabel="Confirm verification"
            onConfirm={async (reason) => {
              await verifyCompanyRecord({ data: { companyId, reviewNote: reason } });
            }}
          />
          <OpsAction
            label="Reject"
            variant="danger"
            title="Reject company verification"
            description="This will reject the verification request."
            impact={label}
            confirmLabel="Confirm rejection"
            onConfirm={async (reason) => {
              await rejectCompanyVerificationRecord({ data: { companyId, reviewNote: reason } });
            }}
          />
        </>
      )}
      {isVerified && (
        <OpsAction
          label="Revoke"
          variant="danger"
          title="Revoke company verification"
          description="This will revoke verified status."
          impact={label}
          confirmLabel="Confirm revocation"
          onConfirm={async (reason) => {
            await revokeCompanyVerificationRecord({ data: { companyId, reviewNote: reason } });
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
