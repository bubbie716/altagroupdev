"use client";

import { useRouter } from "@tanstack/react-router";
import { OpsAction } from "@/components/internal/ops-action";
import { florin } from "@/lib/bank/api";
import {
  approveBankDeposit,
  approveBankWithdrawal,
  denyBankDeposit,
  denyBankWithdrawal,
} from "@/lib/bank/bank.functions";

type TxLike = {
  id: string;
  type: string;
  status: string;
  referenceCode: string;
  amount: number;
  accountNumber: string;
  holder: string;
  description: string;
};

export function TransactionWorkspaceActions({ tx }: { tx: TxLike }) {
  const router = useRouter();
  const isPending = tx.status.toUpperCase() === "PENDING";
  const type = tx.type.toUpperCase();

  if (!isPending) return null;

  if (type === "DEPOSIT") {
    return (
      <div className="flex flex-wrap gap-2">
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
            void router.invalidate();
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
            void router.invalidate();
          }}
        />
      </div>
    );
  }

  if (type === "WITHDRAWAL") {
    const isAltaPay = tx.description.toLowerCase().includes("alta pay");
    return (
      <div className="flex flex-wrap gap-2">
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
            void router.invalidate();
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
            void router.invalidate();
          }}
        />
      </div>
    );
  }

  return null;
}
