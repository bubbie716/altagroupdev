import { Link } from "@tanstack/react-router";
import type { UserEmployeeAltaCardDetail, UserEmployeeAltaCardSummary } from "@/lib/bank/alta-card-types";
import {
  ALTA_CARD_TIER_LABELS,
  altaCardStatusLabel,
  formatAltaCardCurrency,
} from "@/lib/bank/alta-card-types";
import { AltaCardVisual } from "@/components/bank/alta-card/alta-card-visual";
import {
  AltaCardMetric,
  AltaCardSection,
  AltaCardUtilizationBar,
} from "@/components/bank/alta-card/alta-card-ui-primitives";
import { AltaCardTransactionHistory } from "@/components/bank/alta-card/alta-card-transaction-history";
import { AltaCardCashAdvancePanel } from "@/components/bank/alta-card/alta-card-cash-advance-panel";

export function AltaCardEmployeeCardList({ cards }: { cards: UserEmployeeAltaCardSummary[] }) {
  if (cards.length === 0) return null;

  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-serif text-[20px]">Your employee cards</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Cards issued to you by a company owner or finance manager against their business credit line.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.id}
            to="/bank/alta-card/business/employee/$employeeCardId"
            params={{ employeeCardId: card.id }}
            className="rounded-xl border border-border bg-surface-1/80 p-5 transition-colors hover:bg-surface-1"
          >
            <p className="font-serif text-[18px]">{card.companyName}</p>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Employee card · {ALTA_CARD_TIER_LABELS[card.parentTier]} · •••• {card.cardLastFour}
            </p>
            <p className="mt-2 font-mono text-[12px] tabular-nums text-muted-foreground">
              {formatAltaCardCurrency(card.employeeAvailableLimit)} available ·{" "}
              {altaCardStatusLabel(card.status)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function AltaCardEmployeeCardPanel({ card }: { card: UserEmployeeAltaCardDetail }) {
  const utilization =
    card.employeeSpendLimit > 0
      ? (card.employeeCurrentBalance / card.employeeSpendLimit) * 100
      : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,360px)_1fr] lg:items-start">
        <div className="mx-auto w-full max-w-[360px] lg:mx-0">
          <AltaCardVisual
            tier={card.parentTier}
            cardLastFour={card.cardLastFour}
            cardHolder={card.authorizedUsername}
            responsive
          />
        </div>
        <div className="space-y-5">
          <div>
            <p className="font-serif text-[24px] tracking-tight">{card.companyName}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {ALTA_CARD_TIER_LABELS[card.parentTier]} employee card ·{" "}
              {altaCardStatusLabel(card.status)}
            </p>
          </div>
          <AltaCardUtilizationBar utilization={utilization} />
          <dl className="grid gap-3 sm:grid-cols-3">
            <AltaCardMetric label="Spend limit" value={formatAltaCardCurrency(card.employeeSpendLimit)} />
            <AltaCardMetric
              label="Available"
              value={formatAltaCardCurrency(card.employeeAvailableLimit)}
              emphasis
            />
            <AltaCardMetric
              label="Spent this cycle"
              value={formatAltaCardCurrency(card.employeeCurrentBalance)}
              emphasis
            />
          </dl>
        </div>
      </div>

      {card.status === "frozen" ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-[13px] text-amber-800 dark:text-amber-300">
          This employee card is frozen. Contact your company&apos;s finance manager to restore access.
        </div>
      ) : null}

      <AltaCardSection
        title="Using your card"
        description="Purchases draw against your employee spend limit and the company's Alta Card line."
      >
        <div className="flex flex-wrap gap-2">
          <Link
            to="/bank/pay"
            search={{ employeeCardId: card.id }}
            className="inline-flex rounded-md border border-border bg-surface-2 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:bg-surface-1"
          >
            Pay with Alta Card
          </Link>
          <AltaCardCashAdvancePanel employeeCard={card} variant="button" />
        </div>
      </AltaCardSection>

      <AltaCardTransactionHistory transactions={card.recentTransactions} title="Recent activity" />
    </div>
  );
}
