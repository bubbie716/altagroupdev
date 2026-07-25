import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { BankActionPhase } from "@/lib/bank/bank-action-flow";
import type { BankActionAccountContext } from "@/lib/bank/bank-action-account-context";

export type BankActionFlowController = {
  phase: BankActionPhase;
  setPhase: Dispatch<SetStateAction<BankActionPhase>>;
  setTitle: (title: string) => void;
  setDescription: (description: string | undefined) => void;
  setDirty: (dirty: boolean) => void;
  setShowBack: (show: boolean) => void;
  setFooter: (footer: ReactNode) => void;
  registerBack: (fn: (() => void) | null) => void;
  onDone: () => void;
  accountContext?: BankActionAccountContext;
};
