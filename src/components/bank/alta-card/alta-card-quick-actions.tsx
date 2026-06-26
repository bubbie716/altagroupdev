import { Link } from "@tanstack/react-router";
import type { AltaCardRow } from "@/lib/bank/alta-card-types";
import { AltaCardActionButton } from "@/components/bank/alta-card/alta-card-ui-primitives";
import { AltaCardCashAdvancePanel } from "@/components/bank/alta-card/alta-card-cash-advance-panel";
import { AltaCardPaymentPanel } from "@/components/bank/alta-card/alta-card-payment-panel";
import { activateAltaCardRecord, freezeAltaCardRecord, unfreezeAltaCardRecord } from "@/lib/bank/alta-card.functions";
import { altaCardStatementsLink } from "@/lib/bank/alta-card-navigation";
import { useRouter } from "@tanstack/react-router";

export function AltaCardQuickActions({
  card,
  layout = "grid",
}: {
  card: AltaCardRow;
  layout?: "grid" | "row";
}) {
  const router = useRouter();
  const canPay = card.currentBalance > 0 && card.status !== "closed";
  const canAdvance = card.status === "active" && card.availableCredit > 0;
  const canAltaPay = card.status === "active";

  return (
    <div
      className={
        layout === "grid"
          ? "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
          : "flex flex-wrap gap-2"
      }
    >
      {canPay ? (
        <div className="col-span-2 sm:col-span-1">
          <AltaCardPaymentPanel card={card} variant="quick" />
        </div>
      ) : (
        <AltaCardActionButton label="Make payment" disabled />
      )}
      {canAdvance ? (
        <div className="col-span-2 sm:col-span-1">
          <AltaCardCashAdvancePanel card={card} variant="quick" />
        </div>
      ) : (
        <AltaCardActionButton label="Cash advance" disabled />
      )}
      {canAltaPay ? (
        <Link
          to="/bank/pay"
          search={{ cardId: card.id }}
          className="rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-center font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:bg-surface-1"
        >
          Pay with Alta Card
        </Link>
      ) : (
        <AltaCardActionButton label="Pay with Alta Card" disabled />
      )}
      <Link
        {...altaCardStatementsLink(card)}
        className="rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-center font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:bg-surface-1"
      >
        Statements
      </Link>
      {card.status === "pending" ? (
        <AltaCardActionButton
          label="Activate card"
          variant="primary"
          onClick={() => void activateAltaCardRecord({ data: card.id }).then(() => router.invalidate())}
        />
      ) : null}
      {card.status === "active" ? (
        <AltaCardActionButton
          label="Freeze card"
          variant="ghost"
          onClick={() => void freezeAltaCardRecord({ data: card.id }).then(() => router.invalidate())}
        />
      ) : null}
      {card.status === "frozen" ? (
        <AltaCardActionButton
          label="Unfreeze"
          variant="primary"
          onClick={() => void unfreezeAltaCardRecord({ data: card.id }).then(() => router.invalidate())}
        />
      ) : null}
      <AltaCardActionButton
        label="Limit increase"
        variant="ghost"
        disabled
        onClick={() => undefined}
      />
    </div>
  );
}
