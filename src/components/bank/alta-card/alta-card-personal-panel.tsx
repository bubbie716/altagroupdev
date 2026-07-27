"use client";

import { useState, useSyncExternalStore } from "react";
import type {
  AltaCardBillingSummary,
  AltaCardDetail,
  AltaCardRow,
  AltaCardTransactionRow,
} from "@/lib/bank/alta-card-types";
import {
  altaCardStatusLabel,
  formatAltaCardCurrency,
} from "@/lib/bank/alta-card-types";
import { AltaCardVisual } from "@/components/bank/alta-card/alta-card-visual";
import {
  AltaCardMetric,
  AltaCardUtilizationBar,
} from "@/components/bank/alta-card/alta-card-ui-primitives";
import { AltaCardQuickActions } from "@/components/bank/alta-card/alta-card-quick-actions";
import { AltaCardTransactionHistory } from "@/components/bank/alta-card/alta-card-transaction-history";
import { AltaCardStatementSummary } from "@/components/bank/alta-card/alta-card-statement-summary";
import { AltaCardAutopayStatusRow } from "@/components/bank/alta-card/alta-card-autopay-status-row";
import { AltaCardManageSheet } from "@/components/bank/alta-card/alta-card-manage-sheet";
import type { AltaCardAutopayContext } from "@/lib/bank/alta-card-autopay-types";
import type { AltaCardReviewEligibility } from "@/lib/bank/alta-card-review-types";
import {
  getUiLabAltaCardOverlay,
  getUiLabAltaCardOverlayRevision,
  mergeUiLabAltaCardRow,
  subscribeUiLabAltaCardOverlays,
} from "@/lib/bank/ui-lab-alta-card-state";

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
  const [manageOpen, setManageOpen] = useState(false);
  const [manageView, setManageView] = useState<"menu" | "autopay">("menu");
  useSyncExternalStore(
    subscribeUiLabAltaCardOverlays,
    getUiLabAltaCardOverlayRevision,
    getUiLabAltaCardOverlayRevision,
  );
  const displayCard = mergeUiLabAltaCardRow(card);
  const overlay = getUiLabAltaCardOverlay(card.id);
  const autopayEnabled =
    overlay?.autopayEnabled ?? autopayContext?.settings.enabled ?? false;

  function openManage(view: "menu" | "autopay" = "menu") {
    setManageView(view);
    setManageOpen(true);
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="mx-auto w-full min-w-0 max-w-[300px] sm:max-w-[340px] lg:mx-0">
          <AltaCardVisual
            tier={displayCard.tier}
            cardLastFour={displayCard.cardLastFour}
            cardHolder={cardholderName}
            responsive
          />
        </div>
        <div className="min-w-0 space-y-4 sm:space-y-5">
          <p className="min-w-0 break-words text-[13px] text-muted-foreground">
            {altaCardStatusLabel(displayCard.status)}
          </p>
          <AltaCardUtilizationBar
            utilization={
              displayCard.creditLimit > 0
                ? (displayCard.currentBalance / displayCard.creditLimit) * 100
                : 0
            }
          />
          <dl className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
            <AltaCardMetric
              label="Credit limit"
              value={formatAltaCardCurrency(displayCard.creditLimit)}
              dense
            />
            <AltaCardMetric
              label="Current balance"
              value={formatAltaCardCurrency(displayCard.currentBalance)}
              emphasis
              dense
            />
            <AltaCardMetric
              label="Available credit"
              value={formatAltaCardCurrency(displayCard.availableCredit)}
              emphasis
              dense
              className="col-span-2 sm:col-span-1"
            />
          </dl>
        </div>
      </div>

      {billingSummary?.hasOverdueStatement ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-[13px] text-amber-800 dark:text-amber-300">
          Your statement is overdue. Interest and fees may apply to the remaining balance.
        </div>
      ) : null}

      <AltaCardStatementSummary card={displayCard} billingSummary={billingSummary} />

      <AltaCardQuickActions card={displayCard} onManage={() => openManage("menu")} />

      {displayCard.status !== "closed" ? (
        <AltaCardAutopayStatusRow
          autopayContext={autopayContext}
          autopayEnabled={autopayEnabled}
          onManage={() => openManage("autopay")}
        />
      ) : null}

      <AltaCardTransactionHistory
        transactions={transactions}
        title="Recent transactions"
        limit={5}
      />

      <AltaCardManageSheet
        card={displayCard}
        reviewEligibility={reviewEligibility}
        autopayContext={autopayContext}
        open={manageOpen}
        onOpenChange={setManageOpen}
        initialView={manageView}
      />
    </div>
  );
}
