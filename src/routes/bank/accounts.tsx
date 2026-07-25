import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { EmptyBankState } from "@/components/data/empty-bank-state";
import { BankActionLauncher } from "@/components/bank/actions/bank-action-launcher";
import { StatusBadge } from "@/components/internal/status-badge";
import { florin } from "@/lib/bank/api";
import { fetchUserBankAccounts } from "@/lib/bank/bank.functions";
import { maskAccountNumber } from "@/lib/bank/bank-home-context";
import { accountStatusBadgeLabel } from "@/lib/bank/account-status-copy";
import { authBeforeLoad } from "@/lib/auth/guards";
import type { UserBankAccount } from "@/lib/bank/backend-types";

export const Route = createFileRoute("/bank/accounts")({
  beforeLoad: authBeforeLoad,
  loader: async () => fetchUserBankAccounts(),
  head: () => ({
    meta: [{ title: "Accounts — Alta Bank" }],
  }),
  component: BankAccountsPage,
});

function BankAccountsPage() {
  const accounts = Route.useLoaderData();
  const personal = accounts.filter((a) => !a.companyId);
  const business = accounts.filter((a) => Boolean(a.companyId));

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank"
        title="Accounts"
        description="Personal and business accounts you can access."
        action={
          <BankActionLauncher action="open-account">Open an account</BankActionLauncher>
        }
      />

      {accounts.length === 0 ? (
        <EmptyBankState />
      ) : (
        <div className="space-y-8">
          {personal.length > 0 ? (
            <AccountGroup title="Personal" accounts={personal} />
          ) : null}
          {business.length > 0 ? (
            <AccountGroup title="Business" accounts={business} />
          ) : null}
        </div>
      )}
    </>
  );
}

/** Frozen / pending / restricted accounts get an explicit badge, not a buried suffix. */
function accountStatusTreatment(account: UserBankAccount): string | null {
  if (account.status === "active" && account.accountStatusInfo.inGoodStanding) return null;
  return accountStatusBadgeLabel(account.accountStatusInfo);
}

function AccountGroup({
  title,
  accounts,
}: {
  title: string;
  accounts: UserBankAccount[];
}) {
  return (
    <section>
      <h2 className="mb-3 text-[15px] font-semibold tracking-tight">{title}</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-1">
        {accounts.map((account) => {
          const status = accountStatusTreatment(account);
          return (
            <li key={account.id}>
              <Link
                to="/bank/account/$accountId"
                params={{ accountId: account.id }}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--menu-item-hover)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="min-w-0 max-w-full truncate text-[14px] font-medium">
                      {account.accountName}
                    </p>
                    {status ? <StatusBadge status={status} /> : null}
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                    {account.companyName ? `${account.companyName} · ` : null}
                    {account.accountTypeLabel} · {maskAccountNumber(account.accountNumber)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[14px] font-medium tabular-nums">
                    {florin(account.availableBalance)}
                  </p>
                  {account.availableBalance !== account.balance ? (
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {florin(account.balance)} total
                    </p>
                  ) : null}
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
