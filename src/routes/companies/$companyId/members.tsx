import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { CompanySubNav } from "@/components/companies/company-sub-nav";
import { CompanyMembersPanel } from "@/components/companies/company-members-panel";
import { Route as CompanyRoute } from "@/routes/companies/$companyId/route";

export const Route = createFileRoute("/companies/$companyId/members")({
  head: () => ({ meta: [{ title: "Company Members — Alta Group" }] }),
  component: CompanyMembersPage,
});

function CompanyMembersPage() {
  const company = CompanyRoute.useLoaderData();

  return (
    <PageShell
      eyebrow="Alta Account · Company Workspace"
      title={`${company.name} — Members`}
      description="Authorized representatives and membership roles for this registered entity."
    >
      <Link
        to="/companies/$companyId"
        params={{ companyId: company.id }}
        className="mb-6 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-gold hover:underline"
      >
        ← Company overview
      </Link>

      <CompanySubNav companyId={company.id} />
      <CompanyMembersPanel company={company} />
    </PageShell>
  );
}
