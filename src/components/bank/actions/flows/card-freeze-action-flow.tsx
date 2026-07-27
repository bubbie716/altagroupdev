"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BankActionFooter,
  BankActionPrimaryButton,
  BankActionProcessing,
  BankActionSecondaryButton,
  BankActionSuccess,
} from "@/components/bank/actions/bank-action-chrome";
import { BankProcessError } from "@/components/bank/actions/bank-process-ui";
import type { BankActionFlowController } from "@/components/bank/actions/bank-action-flow-types";
import {
  freezeAltaCardRecord,
  unfreezeAltaCardRecord,
} from "@/lib/bank/alta-card.functions";
import { BANK_PROCESS_MOTION, waitBankProcessMin } from "@/lib/bank/bank-process";
import {
  mockBankActionSubmission,
  shouldUseBankActionUiLabMock,
} from "@/lib/bank/bank-action-ui-lab";
import { applyUiLabAltaCardFreeze } from "@/lib/bank/ui-lab-alta-card-state";

export function CardFreezeActionFlow({
  mode,
  cardId,
  phase,
  setPhase,
  setTitle,
  setDescription,
  setDirty,
  setShowBack,
  setFooter,
  registerBack,
  onDone,
}: BankActionFlowController & {
  mode: "freeze" | "unfreeze";
  cardId?: string;
}) {
  const router = useRouter();
  const freeze = useServerFn(freezeAltaCardRecord);
  const unfreeze = useServerFn(unfreezeAltaCardRecord);
  const [error, setError] = useState<string | null>(null);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const submittingLockRef = useRef(false);

  useEffect(() => {
    setDirty(false);
    setShowBack(false);
    registerBack(null);
    if (phase === "success") {
      setTitle(mode === "freeze" ? "Card frozen" : "Card unfrozen");
      setDescription(undefined);
      setFooter(null);
      return;
    }
    if (phase === "submitting") {
      setTitle(mode === "freeze" ? "Freeze card" : "Unfreeze card");
      setDescription(undefined);
      setFooter(null);
      return;
    }
    if (phase === "error") {
      setTitle("Action failed");
      setDescription(undefined);
      setFooter(null);
      return;
    }
    setTitle(mode === "freeze" ? "Freeze card" : "Unfreeze card");
    setDescription(
      mode === "freeze"
        ? "Freezing blocks new purchases and cash advances until you unfreeze."
        : "Unfreezing restores normal card spending, subject to available credit.",
    );
    setFooter(
      <BankActionFooter>
        <BankActionSecondaryButton onClick={onDone}>Cancel</BankActionSecondaryButton>
        <BankActionPrimaryButton onClick={() => void confirm()}>
          {mode === "freeze" ? "Freeze card" : "Unfreeze card"}
        </BankActionPrimaryButton>
      </BankActionFooter>,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode]);

  async function confirm() {
    if (!cardId || submittingLockRef.current || phase === "submitting") return;
    submittingLockRef.current = true;
    setPhase("submitting");
    setError(null);
    const startedAt = Date.now();

    try {
      if (shouldUseBankActionUiLabMock()) {
        mockBankActionSubmission({ kind: mode, amount: 0 });
        applyUiLabAltaCardFreeze(cardId, mode === "freeze");
        await waitBankProcessMin(startedAt, BANK_PROCESS_MOTION.minProcessingMs);
        setStatusLabel(mode === "freeze" ? "Frozen" : "Active");
        setPhase("success");
        return;
      }
      if (mode === "freeze") {
        await freeze({ data: cardId });
        setStatusLabel("Frozen");
      } else {
        await unfreeze({ data: cardId });
        setStatusLabel("Active");
      }
      await router.invalidate();
      await waitBankProcessMin(startedAt, BANK_PROCESS_MOTION.minProcessingMs);
      setPhase("success");
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Unable to update card.");
      setPhase("error");
    } finally {
      submittingLockRef.current = false;
    }
  }

  if (!cardId) {
    return (
      <p className="text-[14px] text-muted-foreground">
        Open this confirmation from your Alta Card page so the correct card is selected.
      </p>
    );
  }

  if (phase === "submitting") {
    return (
      <BankActionProcessing
        label={mode === "freeze" ? "Freezing card…" : "Unfreezing card…"}
        variant="progress"
      />
    );
  }

  if (phase === "success") {
    return (
      <BankActionSuccess
        title={mode === "freeze" ? "Card frozen" : "Card unfrozen"}
        liveMessage={`Your Alta Card status is now ${statusLabel ?? "updated"}.`}
        onDone={onDone}
        summary={statusLabel ? [{ label: "Card status", value: statusLabel }] : undefined}
      >
        <p>
          {mode === "freeze"
            ? "New purchases and cash advances are declined until you unfreeze."
            : "You can spend again up to your available credit."}
        </p>
      </BankActionSuccess>
    );
  }

  if (phase === "error") {
    return (
      <BankProcessError
        message={error ?? "Unable to update card."}
        onRetry={() => setPhase("details")}
        retryLabel="Try again"
      />
    );
  }

  return (
    <p className="text-[14px] leading-relaxed text-muted-foreground">
      {mode === "freeze"
        ? "New purchases and cash advances will be declined while the card is frozen. Existing pending transactions may still settle."
        : "After unfreezing, you can spend again up to your available credit."}
    </p>
  );
}
