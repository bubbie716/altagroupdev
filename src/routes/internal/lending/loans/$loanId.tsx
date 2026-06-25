import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalActiveLoanCard } from "@/components/bank/internal-loan-ops";
import { InternalNotePanel } from "@/components/internal/internal-note-panel";
import { InternalActivityTimeline } from "@/components/internal/internal-activity-timeline";
import { fetchInternalLoanDetailOps, fetchActivityTimeline } from "@/lib/internal/ops-platform.functions";
import { fetchInternalNotes } from "@/lib/internal/internal-note.functions";
import { LoanPaymentScheduleTable } from "@/components/bank/loan-payment-schedule-table";
import { InternalLoanPaymentForm } from "@/components/internal/internal-loan-payment-form";

export const Route = createFileRoute("/internal/lending/loans/$loanId")({
  loader: async ({ params }) => {
    const [loan, notes, timeline] = await Promise.all([
      fetchInternalLoanDetailOps({ data: params.loanId }),
      fetchInternalNotes({ data: { targetType: "LOAN", targetId: params.loanId } }),
      fetchActivityTimeline({ data: { entityType: "LOAN", entityId: params.loanId } }),
    ]);
    return { loan, notes, timeline };
  },
  component: InternalLoanDetailPage,
});

function InternalLoanDetailPage() {
  const { loan, notes, timeline } = Route.useLoaderData();

  return (
    <InternalPageShell title="Loan servicing" description={loan.borrowerLabel}>
      <Link to="/internal/lending" className="mb-6 inline-block font-mono text-[12px] text-gold hover:underline">
        ← Lending queue
      </Link>

      <InternalActiveLoanCard loan={loan} />

      <Section title="Repayment schedule" className="mt-10">
        <LoanPaymentScheduleTable
          schedule={loan.paymentSchedule}
          termMonths={loan.termMonths}
          monthlyPrincipalPercent={loan.monthlyPrincipalPercent}
        />
      </Section>

      <Section title="Record manual payment" className="mt-10">
        <InternalLoanPaymentForm
          loanId={loan.id}
          linkedBankAccountId={loan.linkedBankAccountId}
          linkedAccountNumber={loan.linkedAccountNumber}
          currentPayoffAmount={loan.currentPayoffAmount}
        />
      </Section>

      <Section title="Activity timeline" className="mt-10">
        <InternalActivityTimeline events={timeline} />
      </Section>

      <Section title="Internal notes" className="mt-10">
        <InternalNotePanel targetType="LOAN" targetId={loan.id} initialNotes={notes} />
      </Section>

      <Section title="Deal room" className="mt-10">
        <p className="text-[13px] text-muted-foreground">
          Deal room integration is planned.{" "}
          <Link to="/internal/lending/deal-rooms" className="text-gold hover:underline">
            View deal rooms (preview)
          </Link>
        </p>
      </Section>
    </InternalPageShell>
  );
}
