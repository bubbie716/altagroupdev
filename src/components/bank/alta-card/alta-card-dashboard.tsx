import { Link } from "@tanstack/react-router";
import type { AltaCardBillingSummary, AltaCardDetail, AltaCardRow } from "@/lib/bank/alta-card-types";
import {
  altaCardStatusLabel,
  formatAltaCardCurrency,
  formatAltaCardRate,
  ALTA_CARD_TIER_LABELS,
} from "@/lib/bank/alta-card-types";
import { getTierBenefitsSummary } from "@/lib/bank/alta-card-tier-config";
import { AltaCardVisual } from "@/components/bank/alta-card/alta-card-visual";
import { BankReviewButton } from "@/components/bank/bank-review-button";
import { AltaCardTransactionHistory } from "@/components/bank/alta-card/alta-card-transaction-history";
import { AltaCardCashAdvancePanel } from "@/components/bank/alta-card/alta-card-cash-advance-panel";
import { AltaCardPaymentPanel } from "@/components/bank/alta-card/alta-card-payment-panel";
import {
  activateAltaCardRecord,
  freezeAltaCardRecord,
  unfreezeAltaCardRecord,
} from "@/lib/bank/alta-card.functions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ALTA_CARD_BILLING_HELPER_TEXT } from "@/lib/bank/alta-card-billing-cycle";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-1/80 p-4">
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-2 font-mono text-[15px] tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

export function AltaCardDashboard({
  card,
  billingSummary,
  showActions = true,
}: {
  card: AltaCardRow | AltaCardDetail;
  billingSummary?: AltaCardBillingSummary | null;
  showActions?: boolean;
}) {
  const user = useCurrentUser();
  const holder = user?.discordUsername ?? card.ownerUsername ?? "Cardholder";
  const transactions = "recentTransactions" in card ? card.recentTransactions : [];
  const hasOverdue = billingSummary?.hasOverdueStatement ?? false;
  const activeFees = billingSummary?.activeFeesTotal ?? 0;
  const utilization =
    card.creditLimit > 0
      ? Math.round((card.currentBalance / card.creditLimit) * 1000) / 10
      : 0;
  const tierBenefits = getTierBenefitsSummary(card.tier);

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-[auto_1fr] lg:items-start">
        <AltaCardVisual tier={card.tier} cardLastFour={card.cardLastFour} cardHolder={holder} />

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-border bg-surface-2 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]">
              {ALTA_CARD_TIER_LABELS[card.tier]}
            </span>
            <span className="rounded-full border border-border bg-surface-2 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]">
              {altaCardStatusLabel(card.status)}
            </span>
            <span className="rounded-full border border-border bg-surface-2 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Funding source ready
            </span>
          </div>

          <p className="text-[13px] text-muted-foreground">{tierBenefits}</p>
          {card.tier === "gold" ? (
            <p className="text-[12px] text-gold">
              Relationship pricing managed through Alta Private.
            </p>
          ) : card.tier !== "white" ? (
            <p className="text-[12px] text-muted-foreground">
              Your rate and limit reflect your Alta relationship. Contact support for changes.
            </p>
          ) : null}

          {showActions ? (
            <div className="flex flex-wrap gap-2">
              {card.status === "pending" ? (
                <BankReviewButton
                  label="Activate card"
                  variant="primary"
                  onAction={async () => {
                    await activateAltaCardRecord({ data: card.id });
                  }}
                />
              ) : null}
              {card.status === "active" ? (
                <BankReviewButton
                  label="Freeze card"
                  onAction={async () => {
                    await freezeAltaCardRecord({ data: card.id });
                  }}
                />
              ) : null}
              {card.status === "frozen" ? (
                <BankReviewButton
                  label="Unfreeze card"
                  variant="primary"
                  onAction={async () => {
                    await unfreezeAltaCardRecord({ data: card.id });
                  }}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {hasOverdue ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
            Your statement is overdue. Interest and fees may apply.
          </p>
        </div>
      ) : null}

      <p className="text-[13px] text-muted-foreground">{ALTA_CARD_BILLING_HELPER_TEXT}</p>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Current balance" value={formatAltaCardCurrency(card.currentBalance)} />
        <Metric label="Statement balance" value={formatAltaCardCurrency(card.statementBalance)} />
        <Metric label="Minimum payment" value={formatAltaCardCurrency(card.minimumPaymentDue)} />
        <Metric
          label="Payment due"
          value={
            card.paymentDueDate
              ? new Date(card.paymentDueDate).toLocaleDateString()
              : card.dueDate
                ? new Date(card.dueDate).toLocaleDateString()
                : "—"
          }
        />
        <Metric
          label="Billing period"
          value={
            card.currentBillingCycleStart && card.currentBillingCycleEnd
              ? `${new Date(card.currentBillingCycleStart).toLocaleDateString()} – ${new Date(card.currentBillingCycleEnd).toLocaleDateString()}`
              : "—"
          }
        />
        <Metric
          label="Next statement date"
          value={
            card.nextStatementDate
              ? new Date(card.nextStatementDate).toLocaleDateString()
              : "—"
          }
        />
        <Metric label="Credit limit" value={formatAltaCardCurrency(card.creditLimit)} />
        <Metric label="Utilization" value={`${utilization}%`} />
        <Metric label="Available credit" value={formatAltaCardCurrency(card.availableCredit)} />
        <Metric label="Interest rate" value={formatAltaCardRate(card.interestRate)} />
        <Metric label="Fees" value={formatAltaCardCurrency(activeFees)} />
        <Metric label="Card status" value={altaCardStatusLabel(card.status)} />
      </dl>

      {showActions && card.cardType === "personal" ? (
        <div className="flex flex-wrap gap-2">
          <Link
            to="/bank/alta-card/$cardId/statements"
            params={{ cardId: card.id }}
            className="rounded-md border border-border bg-surface-2 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em]"
          >
            View statements
          </Link>
          <AltaCardCashAdvancePanel card={card} />
          <AltaCardPaymentPanel card={card} />
        </div>
      ) : null}

      <AltaCardTransactionHistory transactions={transactions} title="Recent activity" />
    </div>
  );
}

export function AltaCardEmptyState() {
  return (
    <div className="rounded-xl border border-border bg-surface-1/80 p-8 text-center">
      <p className="font-serif text-[22px] tracking-tight">No Alta Card yet</p>
      <p className="mx-auto mt-3 max-w-md text-[14px] text-muted-foreground">
        Apply for a revolving Alta Card — separate from term lending — with tiered limits and
        manual underwriting.
      </p>
      <Link
        to="/bank/alta-card/apply"
        className="mt-6 inline-flex rounded-md bg-foreground px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-background"
      >
        Apply for Alta Card
      </Link>
    </div>
  );
}
