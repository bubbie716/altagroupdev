import { createFileRoute, Link } from "@tanstack/react-router";
import { Section, Card } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import { CompanyVerificationActions } from "@/components/internal/company-verification-actions";
import { formatCompanyRole } from "@/lib/internal/format";
import { fetchInternalCompanyFromDb } from "@/lib/company/company.functions";
import { getCompanyById } from "@/lib/internal/api";

export const Route = createFileRoute("/internal/companies/$companyId")({
  loader: async ({ params }) => {
    try {
      const dbCompany = await fetchInternalCompanyFromDb({ data: params.companyId });
      if (dbCompany) return { source: "db" as const, company: dbCompany };
    } catch {
      // fall through to mock
    }
    // TODO: remove mock fallback when internal detail view is fully DB-backed.
    const mock = getCompanyById(params.companyId);
    return mock ? { source: "mock" as const, company: mock } : null;
  },
  head: ({ params }) => ({
    meta: [{ title: `${params.companyId} — Company — Alta Internal` }],
  }),
  component: InternalCompanyDetail,
});

function InternalCompanyDetail() {
  const data = Route.useLoaderData();

  if (!data) {
    return (
      <InternalPageShell title="Company Not Found" description="No registered entity matches this ID.">
        <Link to="/internal/companies" className="font-mono text-[12px] text-gold hover:underline">
          ← Back to companies
        </Link>
      </InternalPageShell>
    );
  }

  if (data.source === "db") {
    const company = data.company;
    return (
      <InternalPageShell
        title={company.name}
        description={`${company.type} · ${company.sector ?? "—"} · ${company.id}`}
      >
        <Link to="/internal/companies" className="mb-6 inline-block font-mono text-[12px] text-gold hover:underline">
          ← Back to companies
        </Link>

        <div className="mb-8 flex flex-wrap gap-2">
          <StatusBadge status={company.status} />
          <StatusBadge status={company.verificationStatus} />
          {company.ticker && <span className="rounded bg-surface-2 px-2 py-0.5 font-mono text-[11px]">{company.ticker}</span>}
        </div>

        <Section title="Authorized Representatives">
          <Card className="!p-0">
            <div className="-mx-4 overflow-x-auto sm:mx-0"><table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left type-meta">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Since</th>
                </tr>
              </thead>
              <tbody>
                {company.members.map((m: any) => (
                  <tr key={m.membershipId} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 font-mono text-[12px]">{m.discordUsername}</td>
                    <td className="px-4 py-3">{formatCompanyRole(m.role)}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{m.joinedAt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </Card>
        </Section>

        <div className="mt-8">
          <CompanyVerificationActions
            companyId={company.id}
            verificationStatus={company.verificationStatus}
          />
        </div>
      </InternalPageShell>
    );
  }

  const company = data.company;

  return (
    <InternalPageShell
      title={company.name}
      description={`${company.type} · ${company.sector} · ${company.id}`}
    >
      <Link to="/internal/companies" className="mb-6 inline-block font-mono text-[12px] text-gold hover:underline">
        ← Back to companies
      </Link>

      <div className="mb-8 flex flex-wrap gap-2">
        <StatusBadge status={company.status} />
        <StatusBadge status={company.verificationStatus} />
        {company.ticker && <span className="rounded bg-surface-2 px-2 py-0.5 font-mono text-[11px]">{company.ticker}</span>}
      </div>

      <Section title="Authorized Representatives (mock data)">
        <Card className="!p-0">
          <div className="-mx-4 overflow-x-auto sm:mx-0"><table className="w-full text-sm">
            <tbody>
              {company.representatives.map((r: any) => (
                <tr key={r.userId} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-3 font-mono">{r.username}</td>
                  <td className="px-4 py-3">{formatCompanyRole(r.role)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Card>
      </Section>
    </InternalPageShell>
  );
}
