import { Link } from "@tanstack/react-router";
import type { AltaCardBillingSummary, AltaCardDetail, AltaCardRow } from "@/lib/bank/alta-card-types";
import {
  ALTA_CARD_TIER_LABELS,
  altaCardStatusLabel,
  formatAltaCardCurrency,
  formatAltaCardRate,
} from "@/lib/bank/alta-card-types";
import { getTierBenefitsSummary } from "@/lib/bank/alta-card-tier-config";
import { AltaCardVisual } from "@/components/bank/alta-card/alta-card-visual";
import {
  AltaCardMetric,
  AltaCardProductEyebrow,
  AltaCardSection,
  AltaCardUtilizationBar,
} from "@/components/bank/alta-card/alta-card-ui-primitives";
import { AltaCardQuickActions } from "@/components/bank/alta-card/alta-card-quick-actions";
import { AltaCardTransactionHistory } from "@/components/bank/alta-card/alta-card-transaction-history";
import { AltaCardCashAdvancePanel } from "@/components/bank/alta-card/alta-card-cash-advance-panel";
import { AltaCardPaymentPanel } from "@/components/bank/alta-card/alta-card-payment-panel";
import { BankReviewButton } from "@/components/bank/bank-review-button";
import {
  activateAltaCardRecord,
  freezeAltaCardRecord,
  unfreezeAltaCardRecord,
} from "@/lib/bank/alta-card.functions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ALTA_CARD_BILLING_HELPER_TEXT } from "@/lib/bank/alta-card-billing-cycle";

function cardUtilization(card: AltaCardRow): number {
  return card.creditLimit > 0
    ? Math.round((card.currentBalance / card.creditLimit) * 1000) / 10
    : 0;
}

function paymentDueLabel(card: AltaCardRow): string {
  const date = card.paymentDueDate ?? card.dueDate;
  return date ? new Date(date).toLocaleDateString() : "—";
}

/** Mobile-first landing dashboard when user has an active card. */
export function AltaCardLandingDashboard({
  card,
  billingSummary,
}: {
  card: AltaCardRow | AltaCardDetail;
  billingSummary?: AltaCardBillingSummary | null;
}) {
  const user = useCurrentUser();
  const holder = user?.discordUsername ?? card.ownerUsername ?? "Cardholder";
  const transactions = "recentTransactions" in card ? card.recentTransactions.slice(0, 8) : [];
  const utilization = cardUtilization(card);
  const hasOverdue = billingSummary?.hasOverdueStatement ?? false;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,360px)_1fr] lg:items-start lg:gap-8">
        <div className="mx-auto w-full max-w-[360px] lg:mx-0">
          <AltaCardVisual
            tier={card.tier}
            cardLastFour={card.cardLastFour}
            cardHolder={holder}
            responsive
          />
        </div>

        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-surface-2 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]">
              {ALTA_CARD_TIER_LABELS[card.tier]}
            </span>
            <span className="rounded-full border border-border bg-surface-2 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]">
              {altaCardStatusLabel(card.status)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <AltaCardMetric label="Available credit" value={formatAltaCardCurrency(card.availableCredit)} emphasis />
            <AltaCardMetric label="Current balance" value={formatAltaCardCurrency(card.currentBalance)} emphasis />
            <AltaCardMetric
              label="Payment due"
              value={paymentDueLabel(card)}
              emphasis
            />
          </div>

          <AltaCardUtilizationBar utilization={utilization} />

          {hasOverdue ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-[13px] text-amber-800 dark:text-amber-300">
              Your statement is overdue. Interest and fees may apply to the remaining balance.
            </div>
          ) : null}

          <AltaCardSection title="Quick actions" description="Manage your revolving credit line.">
            <AltaCardQuickActions card={card} />
          </AltaCardSection>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AltaCardMetric label="Credit limit" value={formatAltaCardCurrency(card.creditLimit)} />
        <AltaCardMetric label="Statement balance" value={formatAltaCardCurrency(card.statementBalance)} />
        <AltaCardMetric label="Minimum payment" value={formatAltaCardCurrency(card.minimumPaymentDue)} />
        <AltaCardMetric label="Interest rate" value={formatAltaCardRate(card.interestRate)} />
      </dl>
      <p className="text-[13px] text-muted-foreground">{ALTA_CARD_BILLING_HELPER_TEXT}</p>

      <AltaCardTransactionHistory transactions={transactions} title="Recent activity" limit={8} />
    </div>
  );
}

/** Full card detail page layout. */
export function AltaCardDetailView({
  card,
  billingSummary,
}: {
  card: AltaCardDetail;
  billingSummary?: AltaCardBillingSummary | null;
}) {
  const user = useCurrentUser();
  const holder = user?.discordUsername ?? card.ownerUsername ?? "Cardholder";
  const utilization = cardUtilization(card);
  const tierBenefits = getTierBenefitsSummary(card.tier);
  const hasOverdue = billingSummary?.hasOverdueStatement ?? false;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,360px)_1fr] lg:gap-10">
        <div className="mx-auto w-full max-w-[360px] lg:mx-0">
          <AltaCardVisual tier={card.tier} cardLastFour={card.cardLastFour} cardHolder={holder} responsive />
        </div>
        <div className="space-y-4">
          <AltaCardProductEyebrow>Cardholder · {altaCardStatusLabel(card.status)}</AltaCardProductEyebrow>
          <h2 className="font-serif text-[clamp(1.5rem,3vw,2rem)] tracking-tight">
            {ALTA_CARD_TIER_LABELS[card.tier]} credit line
          </h2>
          <p className="text-[14px] text-muted-foreground">{tierBenefits}</p>
          {card.tier === "gold" ? (
            <p className="text-[13px] text-gold">Relationship pricing managed through Alta Private.</p>
          ) : null}
          <AltaCardUtilizationBar utilization={utilization} />
        </div>
      </div>

      {hasOverdue ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-[13px]">
          Your statement is overdue. Please submit at least your minimum payment to avoid additional
          interest and fees.
        </div>
      ) : null}

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AltaCardMetric label="Current balance" value={formatAltaCardCurrency(card.currentBalance)} emphasis />
        <AltaCardMetric label="Available credit" value={formatAltaCardCurrency(card.availableCredit)} emphasis />
        <AltaCardMetric label="Credit limit" value={formatAltaCardCurrency(card.creditLimit)} />
        <AltaCardMetric label="Statement balance" value={formatAltaCardCurrency(card.statementBalance)} />
        <AltaCardMetric label="Minimum payment" value={formatAltaCardCurrency(card.minimumPaymentDue)} />
        <AltaCardMetric label="Payment due" value={paymentDueLabel(card)} />
        <AltaCardMetric
          label="Next statement date"
          value={
            card.nextStatementDate
              ? new Date(card.nextStatementDate).toLocaleDateString()
              : "—"
          }
        />
        <AltaCardMetric label="Interest rate" value={formatAltaCardRate(card.interestRate)} />
        <AltaCardMetric label="Utilization" value={`${utilization}%`} />
      </dl>
      <p className="text-[13px] text-muted-foreground">{ALTA_CARD_BILLING_HELPER_TEXT}</p>

      <AltaCardSection title="Card controls">
        <div className="flex flex-wrap gap-2">
          {card.status === "pending" ? (
            <BankReviewButton label="Activate card" variant="primary" onAction={async () => activateAltaCardRecord({ data: card.id })} />
          ) : null}
          {card.status === "active" ? (
            <BankReviewButton label="Freeze card" onAction={async () => freezeAltaCardRecord({ data: card.id })} />
          ) : null}
          {card.status === "frozen" ? (
            <BankReviewButton label="Unfreeze card" variant="primary" onAction={async () => unfreezeAltaCardRecord({ data: card.id })} />
          ) : null}
          <Link
            to="/bank/alta-card/$cardId/statements"
            params={{ cardId: card.id }}
            className="rounded-md border border-border bg-surface-2 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em]"
          >
            View statements
          </Link>
        </div>
      </AltaCardSection>

      {card.cardType === "personal" || card.cardType === "business" ? (
        <>
          <AltaCardSection
            title="Payments"
            description={
              card.cardType === "business"
                ? "Pay toward the company balance from a business operating account."
                : "Pay toward your balance from an Alta Bank account."
            }
          >
            <AltaCardPaymentPanel card={card} variant="panel" />
          </AltaCardSection>
          <AltaCardSection
            title="Cash advances"
            description={
              card.cardType === "business"
                ? "Transfer available credit to a personal or business operating account. Cash advances increase the company card balance."
                : "Transfer available credit to your checking account. Cash advances increase your Alta Card balance."
            }
          >
            <AltaCardCashAdvancePanel card={card} variant="panel" />
          </AltaCardSection>
        </>
      ) : null}

      <AltaCardTransactionHistory transactions={card.recentTransactions} title="Recent transactions" />
    </div>
  );
}
