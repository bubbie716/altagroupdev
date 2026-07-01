import { Outlet } from "@tanstack/react-router";
import {
  BankPageMeta,
} from "@/components/bank/bank-page-layout";
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
    <>
      <BankPageMeta
        eyebrow={`Alta Bank · ${businessContext.companyName}`}
        title={account.accountName}
        description={`Business Operating Account · ${account.accountNumber}`}
      />
      <AccountPageToolbar accounts={accounts} currentAccountId={account.id} />
      <BusinessAccountSubNav accountId={account.id} role={businessContext.role} />
      <Outlet />
    </>
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
    <>
      <BankPageMeta
        eyebrow="Alta Bank · Account"
        title={account.accountName}
        description={`${account.accountTypeLabel} · ${account.accountNumber}`}
      />
      <AccountPageToolbar accounts={accounts} currentAccountId={account.id} />
      <PersonalAccountSubNav accountId={account.id} />
      <Outlet />
    </>
  );
}
