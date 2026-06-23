import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { CompanyCreateForm } from "@/components/companies/company-create-form";

export const Route = createFileRoute("/companies/create")({
  head: () => ({ meta: [{ title: "Create Company — Alta Group" }] }),
  component: CreateCompanyPage,
});

function CreateCompanyPage() {
  return (
    <PageShell
      eyebrow="Alta Account · Companies"
      title="Register a Company"
      description="Establish a registered entity on Alta and become its primary authorized owner."
    >
      <Link
        to="/companies"
        className="mb-8 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-gold hover:underline"
      >
        ← Back to companies
      </Link>
      <CompanyCreateForm />
    </PageShell>
  );
}
