import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserBankAccount } from "@/lib/bank/backend-types";
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

  function handleAccountChange(nextAccountId: string) {
    if (nextAccountId === currentAccountId) return;

    const base = `/bank/account/${currentAccountId}`;
    const suffix = pathname.startsWith(base) ? pathname.slice(base.length) : "";

    navigate({
      to: `/bank/account/$accountId${suffix}` as "/bank/account/$accountId",
      params: { accountId: nextAccountId },
    });
  }

  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <Link
        to="/bank"
        className="inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-surface-2/40 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground transition-colors hover:bg-surface-2"
      >
        Back to dashboard
      </Link>

      <div className="min-w-0 sm:ml-auto sm:max-w-lg">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
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
