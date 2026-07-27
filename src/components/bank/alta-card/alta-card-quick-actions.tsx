"use client";

import type { AltaCardRow } from "@/lib/bank/alta-card-types";
import {
  AltaCardActionButton,
  AltaCardQuickActionCell,
  AltaCardQuickActionLink,
} from "@/components/bank/alta-card/alta-card-ui-primitives";
import { AltaCardCashAdvancePanel } from "@/components/bank/alta-card/alta-card-cash-advance-panel";
import { AltaCardPaymentPanel } from "@/components/bank/alta-card/alta-card-payment-panel";

export function AltaCardQuickActions({
  card,
  onManage,
}: {
  card: AltaCardRow;
  onManage?: () => void;
}) {
  const canPay = card.currentBalance > 0 && card.status !== "closed";
  const canAdvance = card.status === "active" && card.availableCredit > 0;
  const canAltaPay = card.status === "active";

  return (
    <div className="space-y-3">
      <div className="grid min-w-0 grid-cols-1 gap-2.5 min-[420px]:grid-cols-3">
        <AltaCardQuickActionCell>
          {canPay ? (
            <AltaCardPaymentPanel card={card} variant="quick" />
          ) : (
            <AltaCardActionButton label="Make payment" tile disabled />
          )}
        </AltaCardQuickActionCell>

        <AltaCardQuickActionCell>
          {canAdvance ? (
            <AltaCardCashAdvancePanel card={card} variant="quick" />
          ) : (
            <AltaCardActionButton label="Cash advance" tile disabled />
          )}
        </AltaCardQuickActionCell>

        <AltaCardQuickActionCell>
          <AltaCardQuickActionLink
            label="Pay with Alta Card"
            to="/bank/pay"
            search={{ cardId: card.id }}
            disabled={!canAltaPay}
          />
        </AltaCardQuickActionCell>
      </div>

      {onManage ? (
        <button
          type="button"
          onClick={onManage}
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Manage card
        </button>
      ) : null}
    </div>
  );
}
