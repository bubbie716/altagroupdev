import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalManualInterestOps } from "@/components/bank/internal-manual-interest-ops";
import { InternalScheduledManualInterestPanel } from "@/components/bank/internal-scheduled-manual-interest-panel";
import { InternalAccountInterestOps } from "@/components/bank/internal-account-interest-ops";
import { fetchAccountInterestOps } from "@/lib/bank/account-interest.functions";
import { fetchScheduledManualInterestApplications } from "@/lib/bank/manual-interest.functions";
import type { AccountInterestOpsSummary } from "@/lib/bank/account-interest.functions";
import type { ScheduledManualInterestRow } from "@/lib/bank/manual-interest.functions";

export const Route = createFileRoute("/internal/bank/interest")({
  loader: async () => {
    const [interestOpsResult, scheduledManualInterest] = await Promise.all([
      fetchAccountInterestOps().catch(
        (): AccountInterestOpsSummary => ({
          dueAccountCount: 0,
          interestBearingActiveCount: 0,
          estimatedTotalInterestDue: 0,
          lastInterestRunAt: null,
          totalInterestCreditedThisMonth: 0,
          dueAccounts: [],
        }),
      ),
      fetchScheduledManualInterestApplications().catch((): ScheduledManualInterestRow[] => []),
    ]);
    return { interestOps: interestOpsResult, scheduledManualInterest };
  },
  head: () => ({ meta: [{ title: "Interest — Alta Internal" }] }),
  component: InternalInterestPage,
});

function InternalInterestPage() {
  const { interestOps, scheduledManualInterest } = Route.useLoaderData();

  return (
    <InternalPageShell
      title="Interest"
      description="Manual category credits, scheduled interest applications, and monthly deposit account accrual."
    >
      <Link
        to="/internal/bank"
        className="mb-6 inline-block font-mono text-[12px] text-gold hover:underline"
      >
        ← Bank ops
      </Link>

      <Section title="Manual interest application">
        <p className="mb-6 text-[13px] leading-relaxed text-muted-foreground">
          Credit interest manually by percentage or fixed amount across one or more account
          categories. Preview affected accounts before applying, or set an optional schedule date to
          run via the shared platform cron (same endpoint as scheduled transfers).
        </p>
        <InternalManualInterestOps />
      </Section>

      <Section title="Scheduled manual interest" className="mt-10">
        <p className="mb-4 text-[13px] text-muted-foreground">
          Pending category-based interest batches waiting for their scheduled run time.
        </p>
        <InternalScheduledManualInterestPanel initialRows={scheduledManualInterest} />
      </Section>

      <Section title="Deposit account accrual" className="mt-10">
        <p className="mb-4 text-[13px] text-muted-foreground">
          Monthly interest accrual for eligible Alta Bank deposit accounts. Due accounts are also
          processed automatically by the platform cron job.
        </p>
        <InternalAccountInterestOps summary={interestOps} />
      </Section>
    </InternalPageShell>
  );
}
