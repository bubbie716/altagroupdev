"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  applyAccountHoldOps,
  adminManualTransferOps,
  releaseAccountHoldOps,
  reopenBankAccountOps,
  setAccountRestrictionsOps,
} from "@/lib/internal/ops-platform.functions";
import { OpsConfirmDialog } from "@/components/internal/ops-confirm-dialog";
import { florin } from "@/lib/bank/api";

const fieldClass =
  "w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";

type HoldRow = {
  id: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
};

export function InternalAccountOpsPanel({
  accountId,
  accountNumber,
  status,
  restrictions,
  holds,
  activeHoldTotal,
}: {
  accountId: string;
  accountNumber: string;
  status: string;
  restrictions: { restrictDeposits: boolean; restrictWithdrawals: boolean; restrictTransfers: boolean };
  holds: HoldRow[];
  activeHoldTotal: number;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "reopen" | "hold" | "transfer" | "restrict">(null);
  const [holdAmount, setHoldAmount] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferMemo, setTransferMemo] = useState("");
  const [restrictDraft, setRestrictDraft] = useState(restrictions);

  useEffect(() => {
    if (dialog === "restrict") setRestrictDraft(restrictions);
  }, [dialog, restrictions]);

  const reopenFn = useServerFn(reopenBankAccountOps);
  const holdFn = useServerFn(applyAccountHoldOps);
  const releaseFn = useServerFn(releaseAccountHoldOps);
  const restrictFn = useServerFn(setAccountRestrictionsOps);
  const transferFn = useServerFn(adminManualTransferOps);

  function closeDialog() {
    setDialog(null);
    setHoldAmount("");
    setTransferTo("");
    setTransferAmount("");
    setTransferMemo("");
  }

  return (
    <div className="space-y-6 rounded-lg border border-border/60 bg-surface-2/20 p-5">
      <div>
        <h4 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Account operations</h4>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Active holds: {florin(activeHoldTotal)} · Restrictions:{" "}
          {[restrictions.restrictDeposits && "deposits", restrictions.restrictWithdrawals && "withdrawals", restrictions.restrictTransfers && "transfers"]
            .filter(Boolean)
            .join(", ") || "none"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to="/internal/bank/interest" className="rounded border border-border px-2 py-1 font-mono text-[10px] uppercase text-gold">
          Manual interest
        </Link>
        <button type="button" className="rounded border border-border px-2 py-1 font-mono text-[10px] uppercase" onClick={() => setDialog("hold")}>
          Apply hold
        </button>
        <button type="button" className="rounded border border-border px-2 py-1 font-mono text-[10px] uppercase" onClick={() => setDialog("transfer")}>
          Manual transfer
        </button>
        <button type="button" className="rounded border border-border px-2 py-1 font-mono text-[10px] uppercase" onClick={() => setDialog("restrict")}>
          Restrictions
        </button>
        {status === "Closed" ? (
          <button type="button" className="rounded border border-gold/30 px-2 py-1 font-mono text-[10px] uppercase text-gold" onClick={() => setDialog("reopen")}>
            Reopen account
          </button>
        ) : null}
      </div>

      {holds.length > 0 && (
        <div>
          <p className="type-meta-sm mb-2">Holds</p>
          <ul className="space-y-2 text-[13px]">
            {holds.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 rounded border border-border/50 px-3 py-2">
                <span>
                  {florin(h.amount)} · {h.reason}{" "}
                  <span className="font-mono text-[10px] text-muted-foreground">({h.status})</span>
                </span>
                {h.status === "ACTIVE" ? (
                  <button
                    type="button"
                    className="font-mono text-[10px] uppercase text-gold"
                    onClick={() =>
                      void (async () => {
                        const reason = window.prompt("Reason for releasing hold:");
                        if (!reason?.trim()) return;
                        await releaseFn({ data: { holdId: h.id, reason: reason.trim() } });
                        await router.invalidate();
                      })()
                    }
                  >
                    Release
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      <OpsConfirmDialog
        open={dialog === "reopen"}
        title="Reopen account"
        description={`Reopen ${accountNumber} for normal operations.`}
        confirmLabel="Reopen"
        onCancel={closeDialog}
        onConfirm={async (reason) => {
          await reopenFn({ data: { accountId, reason } });
          await router.invalidate();
        }}
      />

      <OpsConfirmDialog
        open={dialog === "hold"}
        title="Apply account hold"
        description="Record a hold against available balance for this account."
        confirmLabel="Apply hold"
        onCancel={closeDialog}
        onConfirm={async (reason) => {
          const amount = Number(holdAmount);
          if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error("BAD_REQUEST:Enter a valid hold amount");
          }
          await holdFn({ data: { accountId, amount, reason } });
          await router.invalidate();
        }}
      >
        <label className="block text-sm">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Hold amount (ƒ)</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            className={`${fieldClass} mt-1`}
            value={holdAmount}
            onChange={(e) => setHoldAmount(e.target.value)}
            required
          />
        </label>
      </OpsConfirmDialog>

      <OpsConfirmDialog
        open={dialog === "transfer"}
        title="Manual transfer"
        description={`Transfer from ${accountNumber} to another Alta account.`}
        confirmLabel="Transfer"
        onCancel={closeDialog}
        onConfirm={async (reason) => {
          const amount = Number(transferAmount);
          if (!transferTo.trim()) throw new Error("BAD_REQUEST:Enter a destination account number");
          if (!Number.isFinite(amount) || amount <= 0) throw new Error("BAD_REQUEST:Enter a valid transfer amount");
          await transferFn({
            data: {
              fromAccountId: accountId,
              toAccountNumber: transferTo.trim(),
              amount,
              memo: transferMemo,
              reason,
            },
          });
          await router.invalidate();
        }}
      >
        <label className="block text-sm">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">To account number</span>
          <input
            placeholder="AB-####-######"
            className={`${fieldClass} mt-1 font-mono`}
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Amount (ƒ)</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            className={`${fieldClass} mt-1`}
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Memo (optional)</span>
          <input
            placeholder="Transfer memo"
            className={`${fieldClass} mt-1`}
            value={transferMemo}
            onChange={(e) => setTransferMemo(e.target.value)}
          />
        </label>
      </OpsConfirmDialog>

      <OpsConfirmDialog
        open={dialog === "restrict"}
        title="Update account restrictions"
        description="Toggle deposit, withdrawal, and transfer restrictions."
        confirmLabel="Save restrictions"
        onCancel={closeDialog}
        onConfirm={async (reason) => {
          await restrictFn({
            data: {
              accountId,
              reason,
              restrictDeposits: restrictDraft.restrictDeposits,
              restrictWithdrawals: restrictDraft.restrictWithdrawals,
              restrictTransfers: restrictDraft.restrictTransfers,
            },
          });
          await router.invalidate();
        }}
      >
        <div className="space-y-2 text-[13px]">
          {(
            [
              ["restrictDeposits", "Restrict deposits"],
              ["restrictWithdrawals", "Restrict withdrawals"],
              ["restrictTransfers", "Restrict transfers"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={restrictDraft[key]}
                onChange={(e) => setRestrictDraft((prev) => ({ ...prev, [key]: e.target.checked }))}
              />
              {label}
            </label>
          ))}
        </div>
      </OpsConfirmDialog>
    </div>
  );
}
