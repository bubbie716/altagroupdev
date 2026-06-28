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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <BankStatCard label="Current Balance" value={florin(account.balance)} accent />
        <BankStatCard label="Available Balance" value={florin(account.availableBalance)} />
        <BankStatCard label="Deposits This Month" value={florin(account.depositsThisMonth)} />
        <BankStatCard label="Withdrawals This Month" value={florin(account.withdrawalsThisMonth)} />
        <BankStatCard
          label="Net Change"
          value={`${account.netChangeThisMonth >= 0 ? "+" : ""}${florin(account.netChangeThisMonth)}`}
          signedValue={account.netChangeThisMonth}
        />
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
            <ProfileRow label="Account name" value={account.accountName} />
            <ProfileRow label="Account number" value={account.accountNumber} />
            <ProfileRow label="Routing number" value={account.routingNumber} />
            <ProfileRow label="Account type" value={account.accountTypeLabel} />
            <ProfileRow label="Owner" value={account.ownerLabel} />
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
                      ? new Date(account.interestInfo.lastInterestDate).toLocaleDateString()
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
