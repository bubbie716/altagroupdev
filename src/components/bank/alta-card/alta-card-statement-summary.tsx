import type { AltaCardBillingSummary, AltaCardRow } from "@/lib/bank/alta-card-types";
import { ALTA_CARD_BILLING_HELPER_TEXT, formatAltaCardBillingDate } from "@/lib/bank/alta-card-billing-cycle";
import {
  formatAltaCardCurrency,
  formatAltaCardRate,
} from "@/lib/bank/alta-card-types";

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

export function hasUsefulNextStatementDate(
  card: AltaCardRow,
  billingSummary?: AltaCardBillingSummary | null,
): boolean {
  return !!(billingSummary?.nextStatementDate ?? card.nextStatementDate);
}

export function AltaCardStatementSummary({
  card,
  billingSummary = null,
}: {
  card: AltaCardRow;
  billingSummary?: AltaCardBillingSummary | null;
}) {
  const nextStatement = nextStatementLabel(card, billingSummary);
  const showNextStatement = hasUsefulNextStatementDate(card, billingSummary);

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border bg-surface-1/80 px-4 py-3">
        <dl className="grid min-w-0 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              Statement balance
            </dt>
            <dd className="mt-1 font-mono tabular-nums">{formatAltaCardCurrency(card.statementBalance)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              Minimum payment
            </dt>
            <dd className="mt-1 font-mono tabular-nums">
              {formatAltaCardCurrency(card.minimumPaymentDue)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              Payment due
            </dt>
            <dd className="mt-1">{paymentDueLabel(card, billingSummary)}</dd>
          </div>
        </dl>
        <p className="mt-2.5 text-[12px] text-muted-foreground">
          {formatAltaCardRate(card.interestRate)}
          {showNextStatement ? ` · Next statement ${nextStatement}` : null}
        </p>
      </div>
      {showNextStatement ? (
        <p className="text-[13px] text-muted-foreground">{ALTA_CARD_BILLING_HELPER_TEXT}</p>
      ) : null}
    </div>
  );
}
