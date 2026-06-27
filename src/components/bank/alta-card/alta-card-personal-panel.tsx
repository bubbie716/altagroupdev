import type {
  AltaCardBillingSummary,
  AltaCardDetail,
  AltaCardRow,
  AltaCardTransactionRow,
} from "@/lib/bank/alta-card-types";
import { ALTA_CARD_BILLING_HELPER_TEXT, formatAltaCardBillingDate } from "@/lib/bank/alta-card-billing-cycle";
import {
  altaCardStatusLabel,
  formatAltaCardCurrency,
  formatAltaCardRate,
  ALTA_CARD_TIER_LABELS,
} from "@/lib/bank/alta-card-types";
import { AltaCardVisual } from "@/components/bank/alta-card/alta-card-visual";
import {
  AltaCardMetric,
  AltaCardSection,
  AltaCardUtilizationBar,
} from "@/components/bank/alta-card/alta-card-ui-primitives";
import { AltaCardQuickActions } from "@/components/bank/alta-card/alta-card-quick-actions";
import { AltaCardTransactionHistory } from "@/components/bank/alta-card/alta-card-transaction-history";
import { AltaCardAutopayPanel } from "@/components/bank/alta-card/alta-card-autopay-panel";
import type { AltaCardAutopayContext } from "@/lib/bank/alta-card-autopay-types";
import type { AltaCardReviewEligibility } from "@/lib/bank/alta-card-review-types";

function paymentDueLabel(
  card: AltaCardRow,
  billingSummary?: AltaCardBillingSummary | null,
): string {
  return formatAltaCardBillingDate(
    billingSummary?.paymentDueDate ?? card.paymentDueDate ?? card.dueDate,
  );
}

function nextStatementLabel(
  card: AltaCardRow,
  billingSummary?: AltaCardBillingSummary | null,
): string {
  return formatAltaCardBillingDate(
    billingSummary?.nextStatementDate ?? card.nextStatementDate,
  );
}

export function AltaCardPersonalPanel({
  card,
  cardholderName,
  billingSummary = null,
  autopayContext = null,
  reviewEligibility = null,
  transactions,
}: {
  card: AltaCardRow | AltaCardDetail;
  cardholderName: string;
  billingSummary?: AltaCardBillingSummary | null;
  autopayContext?: AltaCardAutopayContext | null;
  reviewEligibility?: AltaCardReviewEligibility | null;
  transactions: AltaCardTransactionRow[];
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,360px)_1fr] lg:items-start">
        <div className="mx-auto w-full max-w-[360px] lg:mx-0">
          <AltaCardVisual
            tier={card.tier}
            cardLastFour={card.cardLastFour}
            cardHolder={cardholderName}
            responsive
          />
        </div>
        <div className="space-y-5">
          <div>
            <p className="font-serif text-[24px] tracking-tight">{cardholderName}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {ALTA_CARD_TIER_LABELS[card.tier]} · {altaCardStatusLabel(card.status)} · Personal
              credit line
            </p>
          </div>
          <AltaCardUtilizationBar
            utilization={
              card.creditLimit > 0 ? (card.currentBalance / card.creditLimit) * 100 : 0
            }
          />
          <dl className="grid gap-3 sm:grid-cols-3">
            <AltaCardMetric label="Credit limit" value={formatAltaCardCurrency(card.creditLimit)} />
            <AltaCardMetric
              label="Current balance"
              value={formatAltaCardCurrency(card.currentBalance)}
              emphasis
            />
            <AltaCardMetric
              label="Available credit"
              value={formatAltaCardCurrency(card.availableCredit)}
              emphasis
            />
          </dl>
        </div>
      </div>

      {billingSummary?.hasOverdueStatement ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-[13px] text-amber-800 dark:text-amber-300">
          Your statement is overdue. Interest and fees may apply to the remaining balance.
        </div>
      ) : null}

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AltaCardMetric label="Statement balance" value={formatAltaCardCurrency(card.statementBalance)} />
        <AltaCardMetric label="Minimum payment" value={formatAltaCardCurrency(card.minimumPaymentDue)} />
        <AltaCardMetric label="Payment due" value={paymentDueLabel(card, billingSummary)} />
        <AltaCardMetric
          label="Next statement date"
          value={nextStatementLabel(card, billingSummary)}
        />
        <AltaCardMetric label="Interest rate" value={formatAltaCardRate(card.interestRate)} />
      </dl>
      <p className="text-[13px] text-muted-foreground">{ALTA_CARD_BILLING_HELPER_TEXT}</p>

      <AltaCardSection title="Quick actions" description="Manage your revolving credit line.">
        <AltaCardQuickActions card={card} reviewEligibility={reviewEligibility} />
      </AltaCardSection>

      <AltaCardSection
        title="Autopay"
        description="Automatically pay your statement from an Alta Bank account on the payment due date."
      >
        <AltaCardAutopayPanel card={card} initialContext={autopayContext ?? undefined} />
      </AltaCardSection>

      <AltaCardTransactionHistory
        transactions={transactions}
        title="Card transactions"
        description="Purchases, payments, cash advances, and other activity on your personal Alta Card."
      />
    </div>
  );
}
