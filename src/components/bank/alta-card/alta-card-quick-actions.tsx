import { Link, useRouter } from "@tanstack/react-router";
import type { AltaCardRow } from "@/lib/bank/alta-card-types";
import type { AltaCardReviewEligibility } from "@/lib/bank/alta-card-review-types";
import {
  AltaCardActionButton,
  AltaCardQuickActionCell,
  AltaCardQuickActionLink,
} from "@/components/bank/alta-card/alta-card-ui-primitives";
import { AltaCardCashAdvancePanel } from "@/components/bank/alta-card/alta-card-cash-advance-panel";
import { AltaCardPaymentPanel } from "@/components/bank/alta-card/alta-card-payment-panel";
import { activateAltaCardRecord, freezeAltaCardRecord, unfreezeAltaCardRecord } from "@/lib/bank/alta-card.functions";
import { altaCardStatementsLink, altaCardReviewLink, altaCardReviewDetailLink } from "@/lib/bank/alta-card-navigation";

export function AltaCardQuickActions({
  card,
  reviewEligibility,
}: {
  card: AltaCardRow;
  reviewEligibility?: AltaCardReviewEligibility | null;
}) {
  const router = useRouter();
  const canPay = card.currentBalance > 0 && card.status !== "closed";
  const canAdvance = card.status === "active" && card.availableCredit > 0;
  const canAltaPay = card.status === "active";
  const reviewBlockMessage = reviewEligibility?.blockMessage ?? null;
  const activeReviewId = reviewEligibility?.activeReviewId ?? null;
  const inCooldown = reviewEligibility?.inCooldown ?? false;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
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

        <AltaCardQuickActionCell>
          <AltaCardQuickActionLink label="Statements" {...altaCardStatementsLink(card)} />
        </AltaCardQuickActionCell>

        {card.status === "pending" ? (
          <AltaCardQuickActionCell>
            <AltaCardActionButton
              label="Activate card"
              variant="primary"
              tile
              onClick={() => void activateAltaCardRecord({ data: card.id }).then(() => router.invalidate())}
            />
          </AltaCardQuickActionCell>
        ) : null}

        {card.status === "active" ? (
          <AltaCardQuickActionCell>
            <AltaCardActionButton
              label="Freeze card"
              variant="ghost"
              tile
              onClick={() => void freezeAltaCardRecord({ data: card.id }).then(() => router.invalidate())}
            />
          </AltaCardQuickActionCell>
        ) : null}

        {card.status === "frozen" ? (
          <AltaCardQuickActionCell>
            <AltaCardActionButton
              label="Unfreeze"
              variant="primary"
              tile
              onClick={() => void unfreezeAltaCardRecord({ data: card.id }).then(() => router.invalidate())}
            />
          </AltaCardQuickActionCell>
        ) : null}

        <AltaCardQuickActionCell>
          {card.status !== "closed" ? (
            <AltaCardQuickActionLink label="Account review" {...altaCardReviewLink(card)} />
          ) : (
            <AltaCardActionButton label="Account review" variant="ghost" tile disabled />
          )}
        </AltaCardQuickActionCell>
      </div>

      {reviewBlockMessage ? (
        <p className="text-[12px] text-muted-foreground">
          {reviewBlockMessage}
          {activeReviewId ? (
            <>
              {" "}
              <Link
                {...altaCardReviewDetailLink(card, activeReviewId)}
                className="text-gold hover:underline"
              >
                View active review
              </Link>
            </>
          ) : inCooldown ? (
            <>
              {" "}
              <Link {...altaCardReviewLink(card)} className="text-gold hover:underline">
                View past reviews
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
