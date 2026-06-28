import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { BankAccountTransactions } from "@/components/bank/bank-account-transactions";
import { Route as AccountRoute } from "./route";

export const Route = createFileRoute("/bank/account/$accountId/activity")({
  component: AccountActivityPage,
});

function AccountActivityPage() {
  const { account } = AccountRoute.useLoaderData();

  return (
    <Section title="Account activity">
      <BankAccountTransactions transactions={account.recentTransactions} scrollable="full" />
    </Section>
  );
}
