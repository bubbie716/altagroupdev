import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, Section, Card } from "@/components/page-shell";
import { CompanyDashboardCard } from "@/components/companies/company-dashboard-card";
import { CompanyInvitationsPanel } from "@/components/companies/company-invitations-panel";
import { RoutePendingFallback } from "@/components/ui/route-pending-fallback";
import { fetchCompaniesDashboard } from "@/lib/company/company.functions";

export const Route = createFileRoute("/companies/")({
  loader: async () => {
    try {
      return await fetchCompaniesDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[companies.dashboard] loader failed", {
        name: error instanceof Error ? error.name : "Error",
        message: message.slice(0, 500),
        // Helps diagnose schema drift without leaking credentials to the browser.
        prismaCode:
          typeof error === "object" && error && "code" in error
            ? String((error as { code?: unknown }).code ?? "")
            : undefined,
      });
      throw error;
    }
  },
  pendingComponent: () => <RoutePendingFallback label="Loading companies" />,
  errorComponent: CompaniesDashboardError,
  head: () => ({ meta: [{ title: "Companies — Alta Group" }] }),
  component: CompaniesDashboard,
});

function CompaniesDashboardError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <PageShell
      eyebrow="Alta Account"
      title="Companies unavailable"
      description="We couldn’t load your companies right now. This is usually a temporary database or configuration issue — your session is still signed in."
    >
      <Card className="mx-auto max-w-lg !p-8 text-center">
        <p className="text-[13px] text-muted-foreground">
          {/discordNotifiedAt|P2022|column/i.test(error.message)
            ? "Company invitation data needs a database update. An administrator should run pending Prisma migrations."
            : "Please try again in a moment. If this keeps happening, contact Alta support."}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-foreground px-5 py-2.5 text-[13px] font-medium tracking-wide text-background"
          >
            Try again
          </button>
          <Link
            to="/profile"
            className="rounded-md border border-border px-5 py-2.5 text-[13px] font-medium tracking-wide"
          >
            Back to profile
          </Link>
        </div>
      </Card>
    </PageShell>
  );
}

function CompaniesDashboard() {
  const { companies, invitations } = Route.useLoaderData();
  const hasInvitations = invitations.length > 0;
  const hasCompanies = companies.length > 0;

  return (
    <PageShell
      eyebrow="Alta Account"
      title="Companies & Institutions"
      description="Registered entities you are authorized to represent. Companies do not log in directly — individuals act on their behalf through membership roles."
    >
      <div className="mb-8 flex justify-end">
        <Link
          to="/companies/create"
          className="rounded-md bg-foreground px-5 py-2.5 text-[13px] font-medium tracking-wide text-background"
        >
          Create company
        </Link>
      </div>

      {hasInvitations && <CompanyInvitationsPanel invitations={invitations} />}

      {!hasCompanies && !hasInvitations ? (
        <Card className="mx-auto max-w-lg !p-10 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">No memberships</p>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">
            You are not connected to any companies yet.
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
            Register a company or institution to begin business banking and related
            workflows. You may belong to multiple companies with distinct roles.
          </p>
          <Link
            to="/companies/create"
            className="mt-8 inline-block rounded-md border border-border px-5 py-2.5 text-[13px] font-medium tracking-wide"
          >
            Create company
          </Link>
        </Card>
      ) : hasCompanies ? (
        <Section title="Your companies">
          <div className="grid gap-4 md:grid-cols-2">
            {companies.map((company) => (
              <CompanyDashboardCard key={company.id} company={company} />
            ))}
          </div>
        </Section>
      ) : (
        <Card className="mx-auto max-w-lg !p-8 text-center">
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Accept an invitation above to join a company, or register a new entity.
          </p>
        </Card>
      )}
    </PageShell>
  );
}
