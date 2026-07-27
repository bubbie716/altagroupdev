import { useMemo } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useHiddenClosedAccounts } from "@/hooks/use-hidden-closed-accounts";
import { useNavigatingSelect } from "@/hooks/use-navigating-select";
import { findCompanyMembership } from "@/lib/auth/permissions";
import type { UserBankAccount } from "@/lib/bank/backend-types";
import { resolveAccountSwitchSuffix } from "@/lib/bank/account-switch-path";
import { cn } from "@/lib/utils";

function accountOptionLabel(account: UserBankAccount): string {
  return `${account.accountName} · ${account.accountNumber}`;
}

function accountTriggerLabel(account: UserBankAccount | undefined): string {
  if (!account) return "Switch account";
  return account.accountNumber;
}

export function AccountPageToolbar({
  accounts,
  currentAccountId,
  className,
}: {
  accounts: UserBankAccount[];
  currentAccountId: string;
  className?: string;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useCurrentUser();
  const { hiddenIds } = useHiddenClosedAccounts();

  const switcherAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          account.id === currentAccountId ||
          account.status !== "closed" ||
          !hiddenIds.has(account.id),
      ),
    [accounts, currentAccountId, hiddenIds],
  );

  const currentAccount = switcherAccounts.find((account) => account.id === currentAccountId);

  const accountSelect = useNavigatingSelect(currentAccountId, (nextAccountId) => {
    const nextAccount = switcherAccounts.find((account) => account.id === nextAccountId);
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

    void navigate({
      to: `/bank/account/$accountId${suffix}` as "/bank/account/$accountId",
      params: { accountId: nextAccountId },
    });
  });

  return (
    <div className={cn("min-w-0 w-full sm:max-w-xs sm:shrink-0", className)}>
      <label className="sr-only" htmlFor="account-page-switcher">
        Switch account
      </label>
      <Select
        value={accountSelect.value}
        open={accountSelect.open}
        onOpenChange={accountSelect.onOpenChange}
        onValueChange={accountSelect.onValueChange}
      >
        <SelectTrigger
          id="account-page-switcher"
          aria-label="Switch account"
          className="h-11 w-full bg-surface-1 font-mono text-[12px] shadow-none"
        >
          <SelectValue placeholder="Switch account">
            {accountTriggerLabel(currentAccount)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-[var(--menu-surface)]">
          {switcherAccounts.map((account) => (
            <SelectItem key={account.id} value={account.id} className="font-mono text-[12px]">
              {accountOptionLabel(account)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
