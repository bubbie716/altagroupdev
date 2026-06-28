import { createFileRoute, Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsSection } from "@/components/internal/console";
import { OpsQueueCard } from "@/components/internal/ops-queue-card";
import { fetchInternalAltaCardOps } from "@/lib/bank/alta-card.functions";
import { fetchInternalAltaCardReviewQueue } from "@/lib/bank/alta-card-review.functions";

export const Route = createFileRoute("/internal/alta-card/")({
  loader: async () => {
    const [ops, reviews] = await Promise.all([
      fetchInternalAltaCardOps({ data: {} }),
      fetchInternalAltaCardReviewQueue(),
    ]);
    return {
      ...ops,
      openReviews: reviews.filter((r) =>
        ["submitted", "under_review", "needs_information"].includes(r.status),
      ).length,
    };
  },
  head: () => ({ meta: [{ title: "Alta Card Ops — Alta Internal" }] }),
  component: InternalAltaCard,
});

function InternalAltaCard() {
  const { cards, applications, openReviews } = Route.useLoaderData();
  const pendingApps = applications.filter((a) =>
    ["submitted", "under_review", "needs_info"].includes(a.status),
  ).length;
  const active = cards.filter((c) => c.status === "active").length;

  return (
    <InternalPageShell title="Alta Card">
      <div className="mb-4 flex flex-wrap gap-2">
        <NavPill to="/internal/alta-card/cards">All cards</NavPill>
        <NavPill to="/internal/queues/alta-card-applications">Applications</NavPill>
        <NavPill to="/internal/queues/alta-card-reviews">Reviews</NavPill>
        <NavPill to="/internal/queues/deal-rooms">Deal rooms</NavPill>
      </div>

      <OpsSection title="Operational queues">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <OpsQueueCard
            label="Pending applications"
            count={pendingApps}
            to="/internal/queues/alta-card-applications"
            cta="Open queue"
            tone={pendingApps > 0 ? "alert" : "neutral"}
          />
          <OpsQueueCard
            label="Account reviews"
            count={openReviews}
            to="/internal/queues/alta-card-reviews"
            cta="Open queue"
            tone={openReviews > 0 ? "warn" : "neutral"}
          />
          <OpsQueueCard
            label="Deal room threads"
            count={pendingApps}
            to="/internal/queues/deal-rooms"
            cta="Inbox"
          />
        </div>
      </OpsSection>

      <OpsSection title="Product snapshot" className="mt-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Active cards" value={String(active)} />
          <Metric label="Total cards" value={String(cards.length)} />
          <Metric label="Applications (all)" value={String(applications.length)} />
        </div>
        <Link
          to="/internal/alta-card/cards"
          className="mt-3 inline-block font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
        >
          Browse all cards →
        </Link>
      </OpsSection>

      <OpsSection title="Billing & schedulers" className="mt-6">
        <p className="text-[12px] text-muted-foreground">
          Alta Card statement generation, billing, and autopay run via the shared daily servicing cron.
          Monitor status and run manual batches from{" "}
          <Link to="/internal/jobs" className="text-gold hover:underline">
            System Jobs
          </Link>
          .
        </p>
      </OpsSection>
    </InternalPageShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface-1/60 px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold tabular">{value}</div>
    </div>
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
