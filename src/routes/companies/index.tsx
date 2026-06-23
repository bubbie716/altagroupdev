import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, Section, Card } from "@/components/page-shell";
import { CompanyDashboardCard } from "@/components/companies/company-dashboard-card";
import { fetchUserCompanies } from "@/lib/company/company.functions";

export const Route = createFileRoute("/companies/")({
  loader: () => fetchUserCompanies(),
  head: () => ({ meta: [{ title: "Companies — Alta Group" }] }),
  component: CompaniesDashboard,
});

function CompaniesDashboard() {
  const companies = Route.useLoaderData();

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

      {companies.length === 0 ? (
        <Card className="mx-auto max-w-lg !p-10 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">No memberships</p>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">
            You are not connected to any companies yet.
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
            Register a company or institution to begin business banking, listing, issuer portal, and
            API workflows. You may belong to multiple companies with distinct roles.
          </p>
          <Link
            to="/companies/create"
            className="mt-8 inline-block rounded-md border border-border px-5 py-2.5 text-[13px] font-medium tracking-wide"
          >
            Create company
          </Link>
        </Card>
      ) : (
        <Section title="Your companies">
          <div className="grid gap-4 md:grid-cols-2">
            {companies.map((company) => (
              <CompanyDashboardCard key={company.id} company={company} />
            ))}
          </div>
        </Section>
      )}
    </PageShell>
  );
}
