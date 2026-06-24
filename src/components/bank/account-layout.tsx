import { Outlet } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import {
  BusinessAccountSubNav,
  PersonalAccountSubNav,
} from "@/components/bank/account-sub-nav";
import { AccountPageToolbar } from "@/components/bank/account-page-toolbar";
import type { BusinessAccountContext } from "@/server/business-account-context.service";
import type { UserBankAccount, UserBankAccountDetail } from "@/lib/bank/backend-types";

export function BusinessAccountLayout({
  account,
  accounts,
  businessContext,
}: {
  account: UserBankAccountDetail;
  accounts: UserBankAccount[];
  businessContext: BusinessAccountContext;
}) {
  return (
    <PageShell
      eyebrow={`Alta Bank · ${businessContext.companyName}`}
      title={account.accountName}
      description={`Business Operating Account · ${account.accountNumber}`}
    >
      <AccountPageToolbar accounts={accounts} currentAccountId={account.id} />
      <BusinessAccountSubNav accountId={account.id} role={businessContext.role} />
      <Outlet />
    </PageShell>
  );
}

export function PersonalAccountLayout({
  account,
  accounts,
}: {
  account: UserBankAccountDetail;
  accounts: UserBankAccount[];
}) {
  return (
    <PageShell
      eyebrow="Alta Bank · Account"
      title={account.accountName}
      description={`${account.accountTypeLabel} · ${account.accountNumber}`}
    >
      <AccountPageToolbar accounts={accounts} currentAccountId={account.id} />
      <PersonalAccountSubNav accountId={account.id} />
      <Outlet />
    </PageShell>
  );
}
