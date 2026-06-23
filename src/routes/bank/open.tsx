import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { BankAccountOpenForm } from "@/components/bank/bank-account-open-form";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/open")({
  beforeLoad: authBeforeLoad,
  head: () => ({ meta: [{ title: "Open Account — Alta Bank" }] }),
  component: OpenBankAccountPage,
});

function OpenBankAccountPage() {
  return (
    <PageShell
      eyebrow="Alta Bank · Accounts"
      title="Open an Account"
      description="Create a personal or company Alta Bank account. Starter accounts activate immediately; premium accounts require review."
    >
      <BankSubNav />
      <Link
        to="/bank"
        className="mb-8 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-gold hover:underline"
      >
        ← Back to dashboard
      </Link>
      <BankAccountOpenForm />
    </PageShell>
  );
}
