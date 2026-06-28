import { createFileRoute } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { BankAccountOpenForm } from "@/components/bank/bank-account-open-form";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/open")({
  beforeLoad: authBeforeLoad,
  head: () => ({ meta: [{ title: "Open Account — Alta Bank" }] }),
  component: OpenBankAccountPage,
});

function OpenBankAccountPage() {
  return (
    <>
      <BankPageMeta
      eyebrow="Alta Bank · Accounts"
      title="Open an Account"
      description="Create a personal or company Alta Bank account. Starter accounts activate immediately; premium accounts require review."
     />
<BankAccountOpenForm />
    </>
  );
}
