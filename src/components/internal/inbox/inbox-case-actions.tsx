"use client";

import { OpsAction } from "@/components/internal/ops-action";
import type { InboxItem, InboxSearch } from "@/lib/internal/inbox-types";
import { buildInboxRecordHref } from "@/lib/internal/inbox-navigation";
import {
  approveBankDeposit,
  denyBankDeposit,
  approveBankWithdrawal,
  denyBankWithdrawal,
  approveBankAccountOpening,
} from "@/lib/bank/bank.functions";
import { setExceptionDispositionOps } from "@/lib/internal/ops-v1.functions";
import {
  verifyCompanyRecord,
  rejectCompanyVerificationRecord,
} from "@/lib/company/company.functions";
import { useUiLabMutationGate } from "@/lib/internal/ui-lab-mutation-gate";
import { inboxPrimaryActionLabel } from "@/lib/internal/inbox-normalize";

export function InboxCaseActions({
  item,
  onDone,
  onBeginNavigate,
  className,
  inboxSearch,
}: {
  item: InboxItem;
  onDone?: () => void;
  /** Call before leaving Inbox so sheet close does not race clearCase. */
  onBeginNavigate?: () => void;
  className?: string;
  /** Current Inbox filters — preserved when opening a record. */
  inboxSearch?: InboxSearch;
}) {
  const { uiLab } = useUiLabMutationGate();
  const recordHref = buildInboxRecordHref(item, inboxSearch);

  async function after() {
    // OpsAction already runs soft post-mutation refresh after confirm.
    onDone?.();
  }

  const buttons: React.ReactNode[] = [];

  if (!uiLab && item.caseType === "deposit" && item.actions.includes("approve")) {
    buttons.push(
      <OpsAction
        key="approve"
        label="Approve"
        variant="primary"
        title="Approve deposit"
        description="Credit the account and mark this deposit approved."
        impact={item.amountLabel ? `${item.amountLabel} · ${item.partyLabel}` : item.partyLabel}
        confirmLabel="Confirm approval"
        customerNotifies
        onConfirm={async (reason, options) => {
          await approveBankDeposit({
            data: {
              transactionId: item.actionTargetId,
              reviewNote: reason,
              silentNotification: options?.silentNotification,
            },
          });
          await after();
        }}
      />,
    );
    buttons.push(
      <OpsAction
        key="deny"
        label="Deny"
        variant="danger"
        title="Deny deposit"
        description="Reject this deposit. Funds will not be credited."
        impact={item.title}
        confirmLabel="Confirm denial"
        customerNotifies
        onConfirm={async (reason, options) => {
          await denyBankDeposit({
            data: {
              transactionId: item.actionTargetId,
              reviewNote: reason,
              silentNotification: options?.silentNotification,
            },
          });
          await after();
        }}
      />,
    );
  }

  if (!uiLab && item.caseType === "withdrawal" && item.actions.includes("approve")) {
    buttons.push(
      <OpsAction
        key="approve"
        label="Approve"
        variant="primary"
        title="Approve withdrawal"
        description="Post this withdrawal to the ledger."
        impact={item.amountLabel ? `${item.amountLabel} from ${item.referenceLabel}` : item.partyLabel}
        confirmLabel="Confirm approval"
        customerNotifies
        onConfirm={async (reason, options) => {
          await approveBankWithdrawal({
            data: {
              transactionId: item.actionTargetId,
              reviewNote: reason,
              silentNotification: options?.silentNotification,
            },
          });
          await after();
        }}
      />,
    );
    buttons.push(
      <OpsAction
        key="deny"
        label="Deny"
        variant="danger"
        title="Deny withdrawal"
        description="Reject this withdrawal request."
        impact={item.title}
        confirmLabel="Confirm denial"
        customerNotifies
        onConfirm={async (reason, options) => {
          await denyBankWithdrawal({
            data: {
              transactionId: item.actionTargetId,
              reviewNote: reason,
              silentNotification: options?.silentNotification,
            },
          });
          await after();
        }}
      />,
    );
  }

  if (!uiLab && item.caseType === "account_opening" && item.actions.includes("approve")) {
    buttons.push(
      <OpsAction
        key="approve"
        label="Approve opening"
        variant="primary"
        title="Approve account opening"
        description="Activate this pending account."
        impact={`${item.title} · ${item.partyLabel}`}
        confirmLabel="Confirm approval"
        onConfirm={async (reason) => {
          await approveBankAccountOpening({
            data: { accountId: item.actionTargetId, reviewNote: reason },
          });
          await after();
        }}
      />,
    );
  }

  if (!uiLab && item.caseType === "company_verification") {
    if (item.actions.includes("approve")) {
      buttons.push(
        <OpsAction
          key="approve"
          label="Verify"
          variant="primary"
          title="Verify company"
          description="Mark this company as verified."
          impact={item.title}
          confirmLabel="Confirm verification"
          onConfirm={async (reason) => {
            await verifyCompanyRecord({ data: { companyId: item.actionTargetId, reviewNote: reason } });
            await after();
          }}
        />,
      );
    }
    if (item.actions.includes("deny")) {
      buttons.push(
        <OpsAction
          key="deny"
          label="Reject"
          variant="danger"
          title="Reject verification"
          description="Reject this company verification request."
          impact={item.title}
          confirmLabel="Confirm rejection"
          onConfirm={async (reason) => {
            await rejectCompanyVerificationRecord({
              data: { companyId: item.actionTargetId, reviewNote: reason },
            });
            await after();
          }}
        />,
      );
    }
  }

  if (!uiLab && item.caseType === "exception") {
    if (item.actions.includes("resolve")) {
      buttons.push(
        <OpsAction
          key="resolve"
          label="Resolve"
          variant="primary"
          title="Resolve exception"
          description="Mark this exception as resolved."
          confirmLabel="Resolve"
          onConfirm={async (reason) => {
            await setExceptionDispositionOps({
              data: { exceptionKey: item.actionTargetId, status: "RESOLVED", reason },
            });
            await after();
          }}
        />,
      );
    }
    if (item.actions.includes("escalate")) {
      buttons.push(
        <OpsAction
          key="escalate"
          label="Escalate"
          title="Escalate exception"
          description="Escalated exceptions remain visible for senior review."
          confirmLabel="Escalate"
          onConfirm={async (reason) => {
            await setExceptionDispositionOps({
              data: { exceptionKey: item.actionTargetId, status: "ESCALATED", reason },
            });
            await after();
          }}
        />,
      );
    }
    if (item.actions.includes("dismiss")) {
      buttons.push(
        <OpsAction
          key="dismiss"
          label="Dismiss"
          variant="danger"
          title="Dismiss exception"
          description="Dismiss when this item is not actionable."
          confirmLabel="Dismiss"
          onConfirm={async (reason) => {
            await setExceptionDispositionOps({
              data: { exceptionKey: item.actionTargetId, status: "DISMISSED", reason },
            });
            await after();
          }}
        />,
      );
    }
  }

  if (item.actions.includes("open") || item.actions.includes("review")) {
    const openLabel = inboxPrimaryActionLabel(item);
    buttons.push(
      <a
        key="open"
        href={recordHref}
        onClick={() => onBeginNavigate?.()}
        className="inline-flex h-7 items-center rounded border border-border px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:border-border-strong hover:text-foreground"
      >
        {openLabel}
      </a>,
    );
  }

  if (buttons.length === 0) return null;
  return <div className={className ?? "flex flex-wrap gap-1.5"}>{buttons}</div>;
}
