import { useNavigate, useRouterState } from "@tanstack/react-router";
import { RouteButton } from "@/components/bank/route-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/use-current-user";
import { findCompanyMembership } from "@/lib/auth/permissions";
import type { UserBankAccount } from "@/lib/bank/backend-types";
import { resolveAccountSwitchSuffix } from "@/lib/bank/account-switch-path";
import { florin } from "@/lib/bank/api";

function accountOptionLabel(account: UserBankAccount): string {
  return `${account.accountName} · ${account.accountNumber} · ${florin(account.balance)}`;
}

export function AccountPageToolbar({
  accounts,
  currentAccountId,
}: {
  accounts: UserBankAccount[];
  currentAccountId: string;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useCurrentUser();

  function handleAccountChange(nextAccountId: string) {
    if (nextAccountId === currentAccountId) return;

    const nextAccount = accounts.find((account) => account.id === nextAccountId);
    if (!nextAccount) return;

    const companyRole =
      nextAccount.companyId && user
        ? findCompanyMembership(user, { companyId: nextAccount.companyId })?.role
        : undefined;

    const suffix = resolveAccountSwitchSuffix(
      pathname,
      currentAccountId,
      nextAccount,
      companyRole,
    );

    navigate({
      to: `/bank/account/$accountId${suffix}` as "/bank/account/$accountId",
      params: { accountId: nextAccountId },
    });
  }

  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <RouteButton
        to="/bank"
        className="inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-surface-2/40 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground transition-colors hover:bg-surface-2"
      >
        Back to dashboard
      </RouteButton>

      <div className="min-w-0 sm:ml-auto sm:max-w-lg">
        <div className="mb-2 type-meta">
          Account
        </div>
        <Select value={currentAccountId} onValueChange={handleAccountChange}>
          <SelectTrigger className="w-full font-mono text-[12px] shadow-none">
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id} className="font-mono text-[12px]">
                {accountOptionLabel(account)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
