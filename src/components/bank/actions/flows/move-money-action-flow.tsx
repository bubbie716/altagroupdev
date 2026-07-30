"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, Landmark, Send } from "lucide-react";
import {
  BankActionChoiceCard,
} from "@/components/bank/actions/bank-action-chrome";
import type { BankActionFlowController } from "@/components/bank/actions/bank-action-flow-types";
import { TransferActionFlow } from "@/components/bank/actions/flows/transfer-action-flow";
import { PayActionFlow } from "@/components/bank/actions/flows/pay-action-flow";
import { TerminalFundingActionFlow } from "@/components/bank/actions/flows/terminal-funding-action-flow";
import type { UserBankAccount } from "@/lib/bank/backend-types";

type Branch = "chooser" | "transfer" | "pay" | "terminal-funding";

export function MoveMoneyActionFlow({
  accounts,
  defaultAccountId,
  defaultPortfolioId,
  ...ctrl
}: BankActionFlowController & {
  accounts: UserBankAccount[];
  defaultAccountId?: string;
  defaultPortfolioId?: string;
}) {
  const [branch, setBranch] = useState<Branch>("chooser");

  useEffect(() => {
    if (branch === "chooser") {
      ctrl.setPhase("selection");
      ctrl.setTitle("Move money");
      ctrl.setDescription("Choose how you want to move money.");
      ctrl.setDirty(false);
      ctrl.setShowBack(false);
      ctrl.setFooter(null);
      ctrl.registerBack(null);
      return;
    }
    // Nested Transfer/Pay footers only mount on phase === "details".
    ctrl.setPhase("details");
  }, [branch]); // eslint-disable-line react-hooks/exhaustive-deps

  function openBranch(next: Exclude<Branch, "chooser">) {
    ctrl.setPhase("details");
    setBranch(next);
  }

  if (branch === "transfer") {
    return (
      <TransferActionFlow
        accounts={accounts}
        defaultAccountId={defaultAccountId}
        {...ctrl}
        onExitToChooser={() => setBranch("chooser")}
        initialTiming="now"
      />
    );
  }

  if (branch === "pay") {
    return (
      <PayActionFlow
        accounts={accounts}
        defaultAccountId={defaultAccountId}
        {...ctrl}
        onExitToChooser={() => setBranch("chooser")}
      />
    );
  }

  if (branch === "terminal-funding") {
    return (
      <TerminalFundingActionFlow
        {...ctrl}
        defaultAccountId={defaultAccountId}
        defaultPortfolioId={defaultPortfolioId}
        onExitToChooser={() => setBranch("chooser")}
      />
    );
  }

  return (
    <div className="space-y-3">
      <BankActionChoiceCard
        title="Between my accounts"
        description="Move money now, later, or on a schedule."
        icon={<ArrowLeftRight className="size-4" aria-hidden />}
        onClick={() => openBranch("transfer")}
      />
      <BankActionChoiceCard
        title="Pay someone"
        description="Send Florin to a person or business."
        icon={<Send className="size-4" aria-hidden />}
        onClick={() => openBranch("pay")}
      />
      <BankActionChoiceCard
        title="Transfer to or from Alta Terminal"
        description="Move florins between Bank and a Terminal portfolio."
        icon={<Landmark className="size-4" aria-hidden />}
        onClick={() => openBranch("terminal-funding")}
      />
      <BankActionChoiceCard
        title="External bank transfer"
        description="Send to banks outside Alta."
        badge="Coming later"
        disabled
        onClick={() => undefined}
      />
    </div>
  );
}
