import { createFileRoute, Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsSection } from "@/components/internal/console";
import { buildBreadcrumbs } from "@/components/internal/console/internal-breadcrumbs";
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
      breadcrumbs={buildBreadcrumbs([
        { label: "Dashboard", to: "/internal" },
        { label: "Bank", to: "/internal/bank" },
        { label: "Interest" },
      ])}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <NavPill to="/internal/bank">Bank ops</NavPill>
        <NavPill to="/internal/bank/accounts">Accounts</NavPill>
        <NavPill to="/internal/jobs">System jobs</NavPill>
      </div>

      <OpsSection title="Manual interest application">
        <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
          Credit interest manually by percentage or fixed amount across one or more account categories.
          Preview affected accounts before applying, or schedule a future run via platform cron.
        </p>
        <InternalManualInterestOps />
      </OpsSection>

      <OpsSection title="Scheduled manual interest" className="mt-8">
        <p className="mb-4 text-[13px] text-muted-foreground">
          Pending category-based interest batches waiting for their scheduled run time.
        </p>
        <InternalScheduledManualInterestPanel initialRows={scheduledManualInterest} />
      </OpsSection>

      <OpsSection title="Deposit account accrual" className="mt-8">
        <p className="mb-4 text-[13px] text-muted-foreground">
          Monthly interest accrual for eligible Alta Bank deposit accounts. Due accounts are also
          processed automatically by the platform cron job.
        </p>
        <InternalAccountInterestOps summary={interestOps} />
      </OpsSection>
    </InternalPageShell>
  );
}

function NavPill({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded border border-border bg-surface-1 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:border-gold/40 hover:text-gold"
    >
      {children}
    </Link>
  );
}
