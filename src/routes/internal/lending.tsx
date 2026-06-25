import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalStatCard } from "@/components/internal/internal-stat-card";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { internalLendingColumns } from "@/components/bank/internal-lending-panel";
import { InternalActiveLoanCard } from "@/components/bank/internal-loan-ops";
import { BankReviewButton } from "@/components/bank/bank-review-button";
import {
  accrueDueLoanInterestRecord,
  backfillLegacyLoanInterestRecord,
  executeDueLoanAutoPaymentsRecord,
  fetchInternalLendingOps,
} from "@/lib/bank/lending.functions";
import { useRouter } from "@tanstack/react-router";

export const Route = createFileRoute("/internal/lending")({
  loader: async () => fetchInternalLendingOps(),
  head: () => ({ meta: [{ title: "Lending Review — Alta Internal" }] }),
  component: InternalLending,
});

function InternalLending() {
  const { applications, activeLoans, paidOffLoans, frozenLoans } = Route.useLoaderData();
  const router = useRouter();
  const pending = applications.filter(
    (a: any) => a.status === "pending" || a.status === "under_review",
  ).length;

  return (
    <InternalPageShell
      title="Lending Review"
      description="Manual credit facilities — applications, servicing, and monthly interest guarantees."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InternalStatCard label="Open applications" value={String(pending)} alert={pending > 0} />
        <InternalStatCard label="Active loans" value={String(activeLoans.length)} />
        <InternalStatCard label="Frozen loans" value={String(frozenLoans.length)} />
        <InternalStatCard label="Paid off" value={String(paidOffLoans.length)} />
      </div>

      <Section title="Loan servicing" className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-[13px] text-muted-foreground">
            Monthly interest guarantees vest on disbursement anniversaries. Automatic loan payments run on principal installment due dates.
          </p>
          <div className="flex flex-wrap gap-2">
            <AccrueDueInterestButton
              onDone={async () => {
                await router.invalidate();
              }}
            />
            <RunLoanAutoPayButton
              onDone={async () => {
                await router.invalidate();
              }}
            />
            <BackfillLegacyLoansButton
              onDone={async () => {
                await router.invalidate();
              }}
            />
          </div>
        </div>
      </Section>

      <Section title="Loan application queue" className="mt-10">
        <AdminDataTable
          columns={internalLendingColumns()}
          rows={applications}
          rowKey={(row) => row.id}
        />
      </Section>

      <Section title="Active loans" className="mt-10">
        {activeLoans.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No active loans.</p>
        ) : (
          <div className="space-y-6">
            {activeLoans.map((loan: any) => (
              <InternalActiveLoanCard key={loan.id} loan={loan} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Past due" className="mt-10">
        <p className="text-[13px] text-muted-foreground">
          Delinquency tracking — <span className="font-mono text-[11px] uppercase text-gold/80">Coming Soon</span>
        </p>
      </Section>

      <Section title="Frozen loans" className="mt-10">
        {frozenLoans.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No frozen loans.</p>
        ) : (
          <div className="space-y-6">
            {frozenLoans.map((loan: any) => (
              <InternalActiveLoanCard key={loan.id} loan={loan} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Paid off loans" className="mt-10">
        {paidOffLoans.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No paid-off loans on file.</p>
        ) : (
          <div className="space-y-6">
            {paidOffLoans.map((loan: any) => (
              <InternalActiveLoanCard key={loan.id} loan={loan} />
            ))}
          </div>
        )}
      </Section>
    </InternalPageShell>
  );
}

function AccrueDueInterestButton({ onDone }: { onDone: () => Promise<void> }) {
  return (
    <BankReviewButton
      label="Guarantee due interest"
      variant="primary"
      onAction={async () => {
        await accrueDueLoanInterestRecord();
        await onDone();
      }}
    />
  );
}

function RunLoanAutoPayButton({ onDone }: { onDone: () => Promise<void> }) {
  return (
    <BankReviewButton
      label="Run due auto-pay"
      variant="default"
      onAction={async () => {
        await executeDueLoanAutoPaymentsRecord();
        await onDone();
      }}
    />
  );
}

function BackfillLegacyLoansButton({ onDone }: { onDone: () => Promise<void> }) {
  return (
    <BankReviewButton
      label="Fix legacy loans"
      variant="default"
      onAction={async () => {
        await backfillLegacyLoanInterestRecord();
        await onDone();
      }}
    />
  );
}
