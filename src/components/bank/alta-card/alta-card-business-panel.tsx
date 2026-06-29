import { Link } from "@tanstack/react-router";
import type {
  AltaCardApplicationRow,
  AltaCardBillingSummary,
  AltaCardRow,
  AltaCardTransactionRow,
  AltaEmployeeCardRow,
  CompanyEmployeeCardMemberOption,
} from "@/lib/bank/alta-card-types";
import { ALTA_CARD_BILLING_HELPER_TEXT, formatAltaCardBillingDate } from "@/lib/bank/alta-card-billing-cycle";
import {
  altaCardStatusLabel,
  formatAltaCardCurrency,
  formatAltaCardRate,
  ALTA_CARD_TIER_LABELS,
} from "@/lib/bank/alta-card-types";
import { ALTA_CARD_APPLICATION_STATUS_LABELS } from "@/lib/bank/alta-card-application-thread-types";
import { AltaCardPendingApplicationBanner } from "@/components/bank/alta-card/alta-card-landing-hero";
import { AltaCardVisual, AltaCardMiniChip } from "@/components/bank/alta-card/alta-card-visual";
import {
  AltaCardMetric,
  AltaCardSection,
  AltaCardUtilizationBar,
} from "@/components/bank/alta-card/alta-card-ui-primitives";
import { AltaCardQuickActions } from "@/components/bank/alta-card/alta-card-quick-actions";
import { AdminDataTable, type AdminTableColumn } from "@/components/internal/admin-data-table";
import { AltaCardTransactionHistory } from "@/components/bank/alta-card/alta-card-transaction-history";
import { AltaCardEmployeeCardManageButton } from "@/components/bank/alta-card/alta-card-employee-limit-editor";
import { AltaCardEmployeeCardCreateForm } from "@/components/bank/alta-card/alta-card-employee-card-create-form";
import { AltaCardAutopayPanel } from "@/components/bank/alta-card/alta-card-autopay-panel";
import type { AltaCardAutopayContext } from "@/lib/bank/alta-card-autopay-types";
import type { AltaCardReviewEligibility } from "@/lib/bank/alta-card-review-types";
import { useCreditDeskCustomerNav } from "@/hooks/use-credit-desk-nav";

type BusinessViewProps = {
  companyId: string;
  companyName: string;
  businessCard: AltaCardRow | null;
  pendingApplication?: AltaCardApplicationRow | null;
  billingSummary?: AltaCardBillingSummary | null;
  autopayContext?: AltaCardAutopayContext | null;
  reviewEligibility?: AltaCardReviewEligibility | null;
  employeeMemberOptions?: CompanyEmployeeCardMemberOption[];
  employeeCards: AltaEmployeeCardRow[];
  companyTransactions: AltaCardTransactionRow[];
  canManageTreasury?: boolean;
  hasMultipleBusinessCards?: boolean;
};

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

function employeeColumns(
  companyId: string,
  onRefresh: () => Promise<void>,
  canManageTreasury: boolean,
): AdminTableColumn<AltaEmployeeCardRow>[] {
  const columns: AdminTableColumn<AltaEmployeeCardRow>[] = [
    { key: "user", header: "Authorized user", cell: (row) => row.authorizedUsername },
    { key: "last4", header: "Card", cell: (row) => `•••• ${row.cardLastFour}` },
    {
      key: "limit",
      header: "Spend limit",
      cell: (row) => formatAltaCardCurrency(row.employeeSpendLimit),
    },
    {
      key: "available",
      header: "Available",
      cell: (row) => formatAltaCardCurrency(row.employeeAvailableLimit),
    },
    {
      key: "spent",
      header: "Spent",
      cell: (row) => formatAltaCardCurrency(row.employeeCurrentBalance),
    },
    { key: "status", header: "Status", cell: (row) => altaCardStatusLabel(row.status) },
  ];

  if (canManageTreasury) {
    columns.push({
      key: "actions",
      header: "",
      cell: (row) => (
        <AltaCardEmployeeCardManageButton employeeCard={row} onUpdated={onRefresh} />
      ),
    });
  }

  return columns;
}

export function AltaCardBusinessPanel({
  companyId,
  companyName,
  businessCard,
  pendingApplication = null,
  billingSummary = null,
  autopayContext = null,
  reviewEligibility = null,
  employeeMemberOptions = [],
  employeeCards,
  companyTransactions,
  canManageTreasury = true,
  hasMultipleBusinessCards = false,
  onRefresh,
}: BusinessViewProps & { onRefresh: () => Promise<void> }) {
  const creditDeskNav = useCreditDeskCustomerNav();

  if (!businessCard && pendingApplication) {
    return (
      <AltaCardPendingApplicationBanner
        statusLabel={ALTA_CARD_APPLICATION_STATUS_LABELS[pendingApplication.status]}
        applicationId={pendingApplication.id}
        cardType="business"
        status={pendingApplication.status}
        companyName={companyName}
      />
    );
  }

  if (!businessCard) {
    return (
      <div className="rounded-xl border border-border bg-surface-1/80 p-8">
        <p className="font-serif text-[20px]">{companyName}</p>
        <p className="mt-2 text-[14px] text-muted-foreground">
          No business Alta Card on file.
          {creditDeskNav.showApplyEntryPoints
            ? " Apply from the Alta Card application flow."
            : " The Credit Desk is not accepting new applications at this time."}
        </p>
        {creditDeskNav.showApplyEntryPoints ? (
        <Link
          to="/bank/alta-card/business/apply"
          search={{ companyId }}
          className="mt-4 inline-flex rounded-md border border-border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em]"
        >
          Apply for business card
        </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-8">
      {hasMultipleBusinessCards ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-[13px] text-muted-foreground">
          This company has more than one business Alta Card on file. Balances below combine all
          active cards so they match the transaction history.
        </div>
      ) : null}
      <div className="flex min-w-0 flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start">
        <div className="mx-auto w-full min-w-0 max-w-[360px] lg:mx-0">
          <AltaCardVisual
            tier={businessCard.tier}
            cardLastFour={businessCard.cardLastFour}
            cardHolder={companyName}
            responsive
          />
        </div>
        <div className="min-w-0 space-y-5">
          <div className="min-w-0">
            <p className="break-words font-serif text-[24px] tracking-tight">{companyName}</p>
            <p className="mt-1 break-words text-[13px] text-muted-foreground">
              {ALTA_CARD_TIER_LABELS[businessCard.tier]} ·{" "}
              {altaCardStatusLabel(businessCard.status)} · Business credit line
            </p>
          </div>
          <AltaCardUtilizationBar
            utilization={
              businessCard.creditLimit > 0
                ? (businessCard.currentBalance / businessCard.creditLimit) * 100
                : 0
            }
          />
          <dl className="grid min-w-0 gap-3 sm:grid-cols-3">
            <AltaCardMetric label="Credit limit" value={formatAltaCardCurrency(businessCard.creditLimit)} />
            <AltaCardMetric label="Current balance" value={formatAltaCardCurrency(businessCard.currentBalance)} emphasis />
            <AltaCardMetric label="Available credit" value={formatAltaCardCurrency(businessCard.availableCredit)} emphasis />
          </dl>
        </div>
      </div>

      {billingSummary?.hasOverdueStatement ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-[13px] text-amber-800 dark:text-amber-300">
          Your company statement is overdue. Interest and fees may apply to the remaining balance.
        </div>
      ) : null}

      <dl className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AltaCardMetric label="Statement balance" value={formatAltaCardCurrency(businessCard.statementBalance)} />
        <AltaCardMetric label="Minimum payment" value={formatAltaCardCurrency(businessCard.minimumPaymentDue)} />
        <AltaCardMetric label="Payment due" value={paymentDueLabel(businessCard, billingSummary)} />
        <AltaCardMetric
          label="Next statement date"
          value={nextStatementLabel(businessCard, billingSummary)}
        />
        <AltaCardMetric label="Interest rate" value={formatAltaCardRate(businessCard.interestRate)} />
      </dl>
      <p className="text-[13px] text-muted-foreground">{ALTA_CARD_BILLING_HELPER_TEXT}</p>

      <AltaCardSection title="Quick actions" description="Manage the company credit line.">
        {canManageTreasury ? (
          <AltaCardQuickActions card={businessCard} reviewEligibility={reviewEligibility} />
        ) : (
          <p className="text-[13px] text-muted-foreground">
            You have view-only access to this company Alta Card.
          </p>
        )}
      </AltaCardSection>

      {businessCard ? (
        <AltaCardSection
          title="Autopay"
          description="Automatically pay the company statement from a business operating account on the payment due date."
        >
          <AltaCardAutopayPanel card={businessCard} initialContext={autopayContext ?? undefined} />
        </AltaCardSection>
      ) : null}

      <section className="min-w-0 space-y-4">
        <h3 className="font-serif text-[18px]">Employee cards</h3>
        <div className="space-y-3 md:hidden">
          {employeeCards.map((row) => (
            <div key={row.id} className="rounded-xl border border-border bg-surface-1/80 p-4">
              <AltaCardMiniChip
                tier={businessCard.tier}
                label={row.authorizedUsername}
                lastFour={row.cardLastFour}
              />
              <dl className="mt-3 grid grid-cols-1 gap-2 text-[12px] min-[400px]:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Limit</dt>
                  <dd className="font-mono tabular-nums">{formatAltaCardCurrency(row.employeeSpendLimit)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Spent</dt>
                  <dd className="font-mono tabular-nums">{formatAltaCardCurrency(row.employeeCurrentBalance)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>{altaCardStatusLabel(row.status)}</dd>
                </div>
              </dl>
              {canManageTreasury ? (
                <div className="mt-3">
                  <AltaCardEmployeeCardManageButton employeeCard={row} onUpdated={onRefresh} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <div className="hidden md:block">
          <AdminDataTable
            columns={employeeColumns(companyId, onRefresh, canManageTreasury)}
            rows={employeeCards}
            rowKey={(row) => row.id}
          />
        </div>
      </section>

      <AltaCardTransactionHistory
        transactions={companyTransactions}
        title="Company card transactions"
        description="Includes company-line activity and spends from employee cards issued on this credit line."
      />

      {canManageTreasury && businessCard.status === "active" ? (
        <section className="rounded-xl border border-border bg-surface-1/80 p-6">
          <h3 className="font-serif text-[18px]">Create employee card</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Issue an authorized card against the company line. The spend limit is reserved from company
            available credit immediately. Spend is capped by the employee limit and company available credit.
          </p>
          <AltaCardEmployeeCardCreateForm
            companyId={companyId}
            members={employeeMemberOptions}
            onCreated={onRefresh}
          />
        </section>
      ) : null}
    </div>
  );
}

export function AltaCardBusinessCompanyList({
  companies,
}: {
  companies: {
    companyId: string;
    companyName: string;
    businessCard: AltaCardRow | null;
    pendingApplication: AltaCardApplicationRow | null;
  }[];
}) {
  if (companies.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {companies.map((c) => {
        const pending = c.pendingApplication;
        const isApprovedPendingAccept = pending?.status === "approved";

        if (pending && !c.businessCard) {
          return (
            <Link
              key={c.companyId}
              to="/bank/alta-card/business/applications/$applicationId"
              params={{ applicationId: pending.id }}
              className="rounded-xl border border-gold/30 bg-gold/5 p-5 transition-colors hover:bg-gold/10"
            >
              <p className="font-serif text-[18px]">{c.companyName}</p>
              <p className="mt-2 text-[13px] text-muted-foreground">
                {isApprovedPendingAccept
                  ? `Approved — review and accept your ${ALTA_CARD_TIER_LABELS[pending.approvedTier ?? pending.requestedTier]} card terms`
                  : `${ALTA_CARD_APPLICATION_STATUS_LABELS[pending.status]} — view application`}
              </p>
            </Link>
          );
        }

        return (
          <Link
            key={c.companyId}
            to="/bank/alta-card/business/$companyId"
            params={{ companyId: c.companyId }}
            className="rounded-xl border border-border bg-surface-1/80 p-5 transition-colors hover:bg-surface-1"
          >
            <p className="font-serif text-[18px]">{c.companyName}</p>
            <p className="mt-2 text-[13px] text-muted-foreground">
              {c.businessCard
                ? `${ALTA_CARD_TIER_LABELS[c.businessCard.tier]} · ${formatAltaCardCurrency(c.businessCard.availableCredit)} available`
                : "No business card — apply to open a line"}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
