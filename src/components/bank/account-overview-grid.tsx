import { AccountCard, OpenAccountCard } from "@/components/bank/account-card";
import type { BankAccountStatusCode } from "@/lib/bank/backend-types";
import { useHiddenClosedAccounts } from "@/hooks/use-hidden-closed-accounts";

type DashboardAccount = {
  id: string;
  name: string;
  product: string;
  accountNumber: string;
  balance: number;
  status: BankAccountStatusCode;
  statusLabel: string;
  interestAccrualEnabled?: boolean;
};

export function AccountOverviewGrid({ accounts }: { accounts: DashboardAccount[] }) {
  const { hiddenIds, hideAccount } = useHiddenClosedAccounts();

  const visibleAccounts = accounts.filter(
    (account) => account.status !== "closed" || !hiddenIds.has(account.id),
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <OpenAccountCard />
      {visibleAccounts.map((account) => (
        <AccountCard
          key={account.id}
          footer="view"
          account={{
            id: account.id,
            name: account.name,
            product: account.product,
            accountNumber: account.accountNumber,
            balance: account.balance,
            status: account.statusLabel,
            statusCode: account.status,
            interestAccrualEnabled: account.interestAccrualEnabled,
          }}
          onHideClosed={
            account.status === "closed" ? () => hideAccount(account.id) : undefined
          }
        />
      ))}
    </div>
  );
}
