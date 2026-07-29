import { OpsAction } from "@/components/internal/ops-action";
import {
  rejectCompanyVerificationRecord,
  revokeCompanyVerificationRecord,
  verifyCompanyRecord,
} from "@/lib/company/company.functions";
import { normalizeCompanyVerificationStatus } from "@/lib/company/verification-status";
import { useUiLabMutationGate } from "@/lib/internal/ui-lab-mutation-gate";

export function CompanyVerificationActions({
  companyId,
  verificationStatus,
  companyName,
}: {
  companyId: string;
  verificationStatus: string;
  companyName?: string;
}) {
  const { uiLab, unavailableLabel } = useUiLabMutationGate();
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
            label={uiLab ? unavailableLabel("Verify") : "Verify"}
            variant="primary"
            title="Verify company"
            description="This will mark the company as verified and enable full institutional operations."
            impact={label}
            confirmLabel="Confirm verification"
            disabled={uiLab}
            onConfirm={async (reason) => {
              await verifyCompanyRecord({ data: { companyId, reviewNote: reason } });
            }}
          />
          <OpsAction
            label={uiLab ? unavailableLabel("Reject") : "Reject"}
            variant="danger"
            title="Reject company verification"
            description="This will reject the verification request."
            impact={label}
            confirmLabel="Confirm rejection"
            disabled={uiLab}
            onConfirm={async (reason) => {
              await rejectCompanyVerificationRecord({ data: { companyId, reviewNote: reason } });
            }}
          />
        </>
      )}
      {isVerified && (
        <OpsAction
          label={uiLab ? unavailableLabel("Revoke") : "Revoke"}
          variant="danger"
          title="Revoke company verification"
          description="This will revoke verified status."
          impact={label}
          confirmLabel="Confirm revocation"
          disabled={uiLab}
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
