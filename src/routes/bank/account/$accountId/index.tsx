import { createFileRoute } from "@tanstack/react-router";
import { Section, Card } from "@/components/page-shell";
import { BankStatCard } from "@/components/bank/bank-stat-card";
import { BankAccountTransactions } from "@/components/bank/bank-account-transactions";
import { AccountQuickActions } from "@/components/bank/account-quick-actions";
import { ClosedAccountBanner } from "@/components/bank/closed-account-banner";
import { AccountStatusPanel } from "@/components/bank/account-status-panel";
import { AccountBalanceBreakdown } from "@/components/bank/account-balance-breakdown";
import { RouteButton } from "@/components/bank/route-button";
import { florin } from "@/lib/bank/api";
import { formatDueDate } from "@/lib/format-datetime";
import type { BankAccountStatusCode } from "@/lib/bank/backend-types";
import { cn } from "@/lib/utils";
import { Route as AccountRoute } from "./route";

export const Route = createFileRoute("/bank/account/$accountId/")({
  component: AccountOverviewPage,
});

function accountStatusTone(status: BankAccountStatusCode): string {
  if (status === "active") return "text-[var(--success)]";
  if (status === "frozen") return "text-[var(--destructive)]";
  return "";
}

function ProfileRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-1 px-5 sm:flex-row sm:items-center sm:justify-between">
      <span className="type-meta">
        {label}
      </span>
      <span className={cn("font-mono text-[12px] sm:max-w-md sm:text-right", valueClassName)}>
        {value}
      </span>
    </div>
  );
}

/**
 * Compact month-to-date metric cell. The label wraps onto a second line
 * instead of truncating, which is what clipped "Withdrawals this month"
 * in the previous five-across desktop grid.
 */
function MonthMetric({
  label,
  period,
  value,
  signedValue,
  className,
}: {
  label: string;
  period: string;
  value: string;
  signedValue?: number;
  className?: string;
}) {
  const signedTone =
    signedValue === undefined || signedValue === 0
      ? undefined
      : signedValue > 0
        ? "text-[var(--success)]"
        : "text-[var(--destructive)]";

  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border border-border bg-surface-1/80 p-3.5 shadow-card transition-colors duration-200 hover:border-border-strong sm:p-4",
        className,
      )}
    >
      <div className="type-meta leading-relaxed">
        <span className="block">{label}</span>
        <span className="block text-muted-foreground/70">{period}</span>
      </div>
      <div
        className={cn(
          "mt-2 break-words font-mono text-[15px] font-semibold leading-none tabular-nums sm:text-[17px]",
          signedTone,
        )}
      >
        {value}
      </div>
    </div>
  );
}

function AccountOverviewPage() {
  const { account, businessContext, isBusinessOperating } = AccountRoute.useLoaderData();
  const isClosed = account.status === "closed";
  const showBalanceBreakdown =
    account.accountStatusInfo.heldFunds > 0 ||
    account.accountStatusInfo.pendingWithdrawals > 0 ||
    account.availableBalance < account.balance;

  return (
    <>
      {isClosed ? <ClosedAccountBanner accountId={account.id} /> : null}

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        <div className="rounded-xl border border-border bg-surface-1/80 p-5 shadow-card transition-colors duration-200 hover:border-border-strong">
          <div className="type-meta">Current balance</div>
          <div className="type-finance-hero mt-2 break-words leading-none">
            {florin(account.balance)}
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-border/60 pt-3">
            <span className="type-meta">Available</span>
            <span className="font-mono text-[14px] tabular-nums">
              {florin(account.availableBalance)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <MonthMetric
            label="Deposits"
            period="This month"
            value={florin(account.depositsThisMonth)}
          />
          <MonthMetric
            label="Withdrawals"
            period="This month"
            value={florin(account.withdrawalsThisMonth)}
          />
          <MonthMetric
            label="Net change"
            period="This month"
            value={`${account.netChangeThisMonth >= 0 ? "+" : ""}${florin(account.netChangeThisMonth)}`}
            signedValue={account.netChangeThisMonth}
            className="col-span-2 sm:col-span-1"
          />
        </div>
      </div>

      {isBusinessOperating && businessContext && (
        <Section title="Business overview" className="mt-10">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <BankStatCard label="Company" value={businessContext.companyName} />
            <BankStatCard
              label="Your role"
              value={businessContext.treasury.permissions.roleLabel}
              sub={
                businessContext.treasury.permissions.viewOnly ? "View only" : "Treasury access"
              }
            />
            <BankStatCard
              label="Operating account"
              value={account.accountNumber}
              sub="Business Operating"
            />
          </div>
        </Section>
      )}

      <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <Section title="Account information" className="flex h-full min-h-0 flex-col">
          <Card className="flex min-h-0 flex-1 flex-col divide-y divide-border/50 !p-0">
            <ProfileRow label="Account number" value={account.accountNumber} />
            <ProfileRow label="Routing number" value={account.routingNumber} />
            <ProfileRow
              label="Status"
              value={account.statusLabel}
              valueClassName={accountStatusTone(account.status)}
            />
            {account.interestInfo.applicable ? (
              <>
                <ProfileRow
                  label="Last interest date"
                  value={
                    account.interestInfo.lastInterestDate
                      ? formatDueDate(account.interestInfo.lastInterestDate)
                      : "—"
                  }
                />
                <ProfileRow
                  label="Last interest amount"
                  value={
                    account.interestInfo.lastInterestAmount != null
                      ? florin(account.interestInfo.lastInterestAmount)
                      : "—"
                  }
                />
              </>
            ) : (
              <ProfileRow label="Interest" value="Not applicable" />
            )}
          </Card>
        </Section>

        <Section title="Quick actions" className="flex h-full min-h-0 flex-col">
          {isClosed ? (
            <Card className="flex min-h-0 flex-1 flex-col !p-6">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Transfers, deposits, and withdrawals are not available on closed accounts.
              </p>
            </Card>
          ) : (
            <AccountQuickActions accountId={account.id} className="min-h-0 flex-1" />
          )}
        </Section>
      </div>

      <div
        className={
          showBalanceBreakdown
            ? "mt-10 grid gap-6 lg:grid-cols-2"
            : "mt-10"
        }
      >
        <AccountStatusPanel status={account.accountStatusInfo} />
        {showBalanceBreakdown ? (
          <AccountBalanceBreakdown
            currentBalance={account.balance}
            availableBalance={account.availableBalance}
            heldFunds={account.accountStatusInfo.heldFunds}
            pendingWithdrawals={account.accountStatusInfo.pendingWithdrawals}
          />
        ) : null}
      </div>

      <Section title="Recent activity" className="mt-10">
        <BankAccountTransactions transactions={account.recentTransactions} scrollable="compact" />
        <RouteButton
          to="/bank/account/$accountId/activity"
          params={{ accountId: account.id }}
          className="mt-4 inline-flex rounded-md border border-border bg-surface-2/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground"
        >
          View all activity
        </RouteButton>
      </Section>
    </>
  );
}
