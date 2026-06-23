import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { CompanySubNav } from "@/components/companies/company-sub-nav";
import { CompanySettingsForm } from "@/components/companies/company-settings-form";
import { Route as CompanyRoute } from "@/routes/companies/$companyId/route";

export const Route = createFileRoute("/companies/$companyId/settings")({
  beforeLoad: ({ context, params }) => {
    const membership = context.user?.companyMemberships.find((m) => m.companyId === params.companyId);
    if (!membership || membership.role !== "owner") {
      throw redirect({
        to: "/companies/$companyId",
        params: { companyId: params.companyId },
      });
    }
  },
  head: () => ({ meta: [{ title: "Company Settings — Alta Group" }] }),
  component: CompanySettingsPage,
});

function CompanySettingsPage() {
  const company = CompanyRoute.useLoaderData();

  return (
    <PageShell
      eyebrow="Alta Account · Company Workspace"
      title={`${company.name} — Settings`}
      description="Company profile settings. Verification status and listing state are managed by Alta operations."
    >
      <Link
        to="/companies/$companyId"
        params={{ companyId: company.id }}
        className="mb-6 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-gold hover:underline"
      >
        ← Company overview
      </Link>

      <CompanySubNav companyId={company.id} />
      <CompanySettingsForm company={company} />
    </PageShell>
  );
}
