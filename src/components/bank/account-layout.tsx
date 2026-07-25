import { Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
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

function AccountNavRow({
  accounts,
  currentAccountId,
  children,
}: {
  accounts: UserBankAccount[];
  currentAccountId: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-border/60 pb-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pb-4">
      <div className="min-w-0 flex-1">{children}</div>
      <AccountPageToolbar accounts={accounts} currentAccountId={currentAccountId} />
    </div>
  );
}

export function BusinessAccountLayout({
  account,
  accounts,
  businessContext,
  commercialPayrollEnabled = false,
}: {
  account: UserBankAccountDetail;
  accounts: UserBankAccount[];
  businessContext: BusinessAccountContext;
  commercialPayrollEnabled?: boolean;
}) {
  return (
    <>
      <BankPageMeta
        eyebrow={`Alta Bank · ${businessContext.companyName}`}
        title={account.accountName}
        description={`Business Operating Account · ${account.accountNumber}`}
      />
      <AccountNavRow accounts={accounts} currentAccountId={account.id}>
        <BusinessAccountSubNav
          accountId={account.id}
          companyId={businessContext.companyId}
          role={businessContext.role}
          commercialPayrollEnabled={commercialPayrollEnabled}
        />
      </AccountNavRow>
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
      <AccountNavRow accounts={accounts} currentAccountId={account.id}>
        <PersonalAccountSubNav accountId={account.id} />
      </AccountNavRow>
      <Outlet />
    </>
  );
}
