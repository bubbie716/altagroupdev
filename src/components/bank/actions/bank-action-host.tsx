"use client";

import { useRef, useState, type ReactNode } from "react";
import { ResponsiveBankAction } from "@/components/bank/actions/responsive-bank-action";
import { useBankActionLauncher } from "@/components/bank/actions/use-bank-action-launcher";
import { BANK_ACTION_LABELS, type BankActionId } from "@/lib/bank/bank-action-ids";
import type { BankActionPhase } from "@/lib/bank/bank-action-flow";
import { fetchActiveBankAccounts } from "@/lib/bank/bank.functions";
import type { UserBankAccount } from "@/lib/bank/backend-types";
import { MoveMoneyActionFlow } from "@/components/bank/actions/flows/move-money-action-flow";
import { DepositActionFlow } from "@/components/bank/actions/flows/deposit-action-flow";
import { WithdrawActionFlow } from "@/components/bank/actions/flows/withdraw-action-flow";
import { PayActionFlow } from "@/components/bank/actions/flows/pay-action-flow";
import { OpenAccountActionFlow } from "@/components/bank/actions/flows/open-account-action-flow";
import { TransferActionFlow } from "@/components/bank/actions/flows/transfer-action-flow";
import { CardFreezeActionFlow } from "@/components/bank/actions/flows/card-freeze-action-flow";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";

/**
 * Mounts at most one active Bank action overlay driven by `?action=`.
 * Form state remounts via `key` when action identity changes.
 */
export function BankActionHost() {
  const { action, accountId, cardId, companyId, scope, closeAction, restoreLaunchFocus } =
    useBankActionLauncher();
  const loadAccounts = useServerFn(fetchActiveBankAccounts);
  const [accounts, setAccounts] = useState<UserBankAccount[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const needsAccounts =
    action === "move-money" ||
    action === "transfer" ||
    action === "deposit" ||
    action === "withdraw" ||
    action === "pay";

  useEffect(() => {
    if (!action || !needsAccounts) {
      setAccounts(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setAccounts(null);
    setLoadError(null);
    void loadAccounts()
      .then((rows) => {
        if (!cancelled) setAccounts(rows);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load accounts.");
      });
    return () => {
      cancelled = true;
    };
  }, [action, needsAccounts, loadAccounts]);

  if (!action) return null;

  const accountContext = {
    accountId,
    companyId,
    workspace: companyId
      ? (`company:${companyId}` as const)
      : scope === "all"
        ? ("all" as const)
        : ("personal" as const),
  };

  return (
    <BankActionFlowShell
      key={`${action}:${accountId ?? ""}:${cardId ?? ""}:${companyId ?? ""}:${scope ?? ""}`}
      action={action}
      accountId={accountId}
      cardId={cardId}
      accountContext={accountContext}
      accounts={accounts}
      loadError={loadError}
      onClose={() => {
        closeAction({ replace: true });
        restoreLaunchFocus();
      }}
    />
  );
}

function BankActionFlowShell({
  action,
  accountId,
  cardId,
  accountContext,
  accounts,
  loadError,
  onClose,
}: {
  action: BankActionId;
  accountId?: string;
  cardId?: string;
  accountContext: {
    accountId?: string;
    companyId?: string;
    workspace: "personal" | "all" | `company:${string}`;
  };
  accounts: UserBankAccount[] | null;
  loadError: string | null;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<BankActionPhase>(
    action === "move-money" ? "selection" : "details",
  );
  const [title, setTitle] = useState(BANK_ACTION_LABELS[action]);
  const [description, setDescription] = useState<string | undefined>(undefined);
  const [dirty, setDirty] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const [footer, setFooter] = useState<ReactNode>(null);
  const backHandlerRef = useRef<(() => void) | null>(null);

  let body: ReactNode = null;

  if (loadError) {
    body = <p className="text-[14px] text-muted-foreground">{loadError}</p>;
  } else if (needsAccountsFor(action) && accounts == null) {
    body = (
      <div className="animate-pulse space-y-3" aria-busy="true" aria-label="Loading">
        <div className="h-10 rounded-md bg-surface-2" />
        <div className="h-10 rounded-md bg-surface-2" />
        <div className="h-24 rounded-md bg-surface-2" />
      </div>
    );
  } else if (action === "move-money" && accounts) {
    body = (
      <MoveMoneyActionFlow
        accounts={accounts}
        defaultAccountId={accountId}
        accountContext={accountContext}
        phase={phase}
        setPhase={setPhase}
        setTitle={setTitle}
        setDescription={setDescription}
        setDirty={setDirty}
        setShowBack={setShowBack}
        setFooter={setFooter}
        registerBack={(fn) => {
          backHandlerRef.current = fn;
        }}
        onDone={onClose}
      />
    );
  } else if (action === "transfer" && accounts) {
    body = (
      <TransferActionFlow
        accounts={accounts}
        defaultAccountId={accountId}
        accountContext={accountContext}
        phase={phase}
        setPhase={setPhase}
        setTitle={setTitle}
        setDescription={setDescription}
        setDirty={setDirty}
        setShowBack={setShowBack}
        setFooter={setFooter}
        registerBack={(fn) => {
          backHandlerRef.current = fn;
        }}
        onDone={onClose}
        initialTiming="now"
      />
    );
  } else if (action === "deposit" && accounts) {
    body = (
      <DepositActionFlow
        accounts={accounts}
        defaultAccountId={accountId}
        accountContext={accountContext}
        phase={phase}
        setPhase={setPhase}
        setTitle={setTitle}
        setDescription={setDescription}
        setDirty={setDirty}
        setShowBack={setShowBack}
        setFooter={setFooter}
        registerBack={(fn) => {
          backHandlerRef.current = fn;
        }}
        onDone={onClose}
      />
    );
  } else if (action === "withdraw" && accounts) {
    body = (
      <WithdrawActionFlow
        accounts={accounts}
        defaultAccountId={accountId}
        accountContext={accountContext}
        phase={phase}
        setPhase={setPhase}
        setTitle={setTitle}
        setDescription={setDescription}
        setDirty={setDirty}
        setShowBack={setShowBack}
        setFooter={setFooter}
        registerBack={(fn) => {
          backHandlerRef.current = fn;
        }}
        onDone={onClose}
      />
    );
  } else if (action === "pay" && accounts) {
    body = (
      <PayActionFlow
        accounts={accounts}
        defaultAccountId={accountId}
        accountContext={accountContext}
        phase={phase}
        setPhase={setPhase}
        setTitle={setTitle}
        setDescription={setDescription}
        setDirty={setDirty}
        setShowBack={setShowBack}
        setFooter={setFooter}
        registerBack={(fn) => {
          backHandlerRef.current = fn;
        }}
        onDone={onClose}
      />
    );
  } else if (action === "open-account") {
    body = (
      <OpenAccountActionFlow
        phase={phase}
        setPhase={setPhase}
        setTitle={setTitle}
        setDescription={setDescription}
        setDirty={setDirty}
        setShowBack={setShowBack}
        setFooter={setFooter}
        registerBack={(fn) => {
          backHandlerRef.current = fn;
        }}
        onDone={onClose}
      />
    );
  } else if (action === "card-freeze" || action === "card-unfreeze") {
    body = (
      <CardFreezeActionFlow
        mode={action === "card-freeze" ? "freeze" : "unfreeze"}
        cardId={cardId}
        phase={phase}
        setPhase={setPhase}
        setTitle={setTitle}
        setDescription={setDescription}
        setDirty={setDirty}
        setShowBack={setShowBack}
        setFooter={setFooter}
        registerBack={(fn) => {
          backHandlerRef.current = fn;
        }}
        onDone={onClose}
      />
    );
  } else if (
    action === "card-payment" ||
    action === "card-cash-advance" ||
    action === "card-autopay"
  ) {
    body = (
      <p className="text-[14px] text-muted-foreground">
        Open this action from your Alta Card page. Card-specific context is required.
      </p>
    );
  }

  return (
    <ResponsiveBankAction
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={title}
      description={description}
      phase={phase}
      dirty={dirty}
      showBack={showBack}
      onBack={() => backHandlerRef.current?.()}
      footer={footer}
    >
      {body}
    </ResponsiveBankAction>
  );
}

function needsAccountsFor(action: BankActionId): boolean {
  return (
    action === "move-money" ||
    action === "transfer" ||
    action === "deposit" ||
    action === "withdraw" ||
    action === "pay"
  );
}
