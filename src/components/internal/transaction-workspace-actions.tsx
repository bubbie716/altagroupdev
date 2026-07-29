"use client";

import { OpsAction } from "@/components/internal/ops-action";
import { florin } from "@/lib/bank/api";
import {
  approveBankDeposit,
  approveBankWithdrawal,
  denyBankDeposit,
  denyBankWithdrawal,
} from "@/lib/bank/bank.functions";
import { reverseAdjustmentOps } from "@/lib/internal/ops-platform.functions";

type TxLike = {
  id: string;
  type: string;
  status: string;
  referenceCode: string;
  amount: number;
  accountNumber: string;
  holder: string;
  description: string;
  canReverseAdjustment?: boolean;
};

export function TransactionWorkspaceActions({
  tx,
  layout = "inline",
}: {
  tx: TxLike;
  /** panel = bordered resolve block on the detail overview (mobile-friendly). */
  layout?: "inline" | "panel";
}) {
  const isPending = tx.status.toUpperCase() === "PENDING";
  const type = tx.type.toUpperCase();
  const actions = resolveActions(tx, isPending, type);

  if (!actions) return null;

  if (layout === "panel") {
    return (
      <section className="rounded border border-border/80 bg-surface-1/40 px-3 py-3">
        <div>
          <h3 className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            Resolve transaction
          </h3>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Approve or deny from this page. A reason is required; nothing submits until you confirm.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
      </section>
    );
  }

  return <div className="flex flex-wrap gap-2">{actions}</div>;
}

function resolveActions(tx: TxLike, isPending: boolean, type: string) {
  if (type === "ADJUSTMENT" && tx.status.toUpperCase() === "APPROVED" && tx.canReverseAdjustment) {
    return (
      <OpsAction
        label="Reverse adjustment"
        variant="danger"
        title="Reverse adjustment"
        description="Post an offsetting adjustment. The original ledger entry is preserved."
        impact={`${florin(tx.amount)} · ${tx.referenceCode}`}
        confirmLabel="Post reversal"
        customerNotifies
        onConfirm={async (reason, options) => {
          await reverseAdjustmentOps({
            data: {
              transactionId: tx.id,
              reason,
              silentNotification: options?.silentNotification,
            },
          });
        }}
      />
    );
  }

  if (!isPending) return null;

  if (type === "DEPOSIT") {
    return (
      <>
        <OpsAction
          label="Approve deposit"
          variant="primary"
          title="Approve deposit"
          description="Credit the account and mark this deposit approved."
          impact={`${florin(tx.amount)} → ${tx.accountNumber} (${tx.holder})`}
          confirmLabel="Confirm approval"
          customerNotifies
          onConfirm={async (reason, options) => {
            await approveBankDeposit({
              data: { transactionId: tx.id, reviewNote: reason, silentNotification: options?.silentNotification },
            });
          }}
        />
        <OpsAction
          label="Deny deposit"
          variant="danger"
          title="Deny deposit"
          description="Reject this deposit. Funds will not be credited."
          impact={`Reference ${tx.referenceCode}`}
          confirmLabel="Confirm denial"
          customerNotifies
          onConfirm={async (reason, options) => {
            await denyBankDeposit({
              data: { transactionId: tx.id, reviewNote: reason, silentNotification: options?.silentNotification },
            });
          }}
        />
      </>
    );
  }

  if (type === "WITHDRAWAL") {
    const isAltaPay = tx.description.toLowerCase().includes("alta pay");
    return (
      <>
        <OpsAction
          label={isAltaPay ? "Approve Alta Pay" : "Approve withdrawal"}
          variant="primary"
          title={isAltaPay ? "Approve Alta Pay payment" : "Approve withdrawal"}
          description="Post this withdrawal to the ledger."
          impact={`${florin(tx.amount)} from ${tx.accountNumber}`}
          confirmLabel="Confirm approval"
          customerNotifies
          onConfirm={async (reason, options) => {
            await approveBankWithdrawal({
              data: { transactionId: tx.id, reviewNote: reason, silentNotification: options?.silentNotification },
            });
          }}
        />
        <OpsAction
          label="Deny withdrawal"
          variant="danger"
          title="Deny withdrawal"
          description="Reject this withdrawal request."
          impact={`Reference ${tx.referenceCode}`}
          confirmLabel="Confirm denial"
          customerNotifies
          onConfirm={async (reason, options) => {
            await denyBankWithdrawal({
              data: { transactionId: tx.id, reviewNote: reason, silentNotification: options?.silentNotification },
            });
          }}
        />
      </>
    );
  }

  return null;
}
