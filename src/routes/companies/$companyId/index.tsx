import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, Section, Card } from "@/components/page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import { CompanySubNav } from "@/components/companies/company-sub-nav";
import { CompanyFutureModules } from "@/components/companies/company-future-modules";
import { formatCompanyRole } from "@/lib/auth/tags";
import { formatIntendedUse } from "@/lib/company/types";
import type { CompanyDetail } from "@/lib/company/types";
import { Route as CompanyRoute } from "@/routes/companies/$companyId/route";

export const Route = createFileRoute("/companies/$companyId/")({
  head: ({ matches }) => {
    const companyMatch = matches.find((m) => m.routeId === "/companies/$companyId");
    const company = companyMatch?.loaderData as CompanyDetail | undefined;
    return {
      meta: [{ title: `${company?.name ?? "Company"} — Alta Group` }],
    };
  },
  component: CompanyDetailPage,
});

function ProfileRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/50 py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <span className="text-sm sm:max-w-md sm:text-right">{value}</span>
    </div>
  );
}

function CompanyDetailPage() {
  const company = CompanyRoute.useLoaderData();

  return (
    <PageShell
      eyebrow="Alta Account · Company Workspace"
      title={company.name}
      description={`${company.type} · ${company.sector ?? "Sector pending"} · Authorized representative workspace`}
    >
      <Link
        to="/companies"
        className="mb-6 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-gold hover:underline"
      >
        ← All companies
      </Link>

      <div className="mb-6 flex flex-wrap gap-2">
        <StatusBadge status={company.status} />
        <StatusBadge status={company.verificationStatus} />
        {company.ticker && (
          <span className="rounded bg-surface-2 px-2 py-0.5 font-mono text-[11px]">{company.ticker}</span>
        )}
      </div>

      <CompanySubNav companyId={company.id} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Company profile">
          <Card className="!p-5">
            <ProfileRow label="Type" value={company.type} />
            <ProfileRow label="Sector" value={company.sector ?? "—"} />
            <ProfileRow
              label="Ticker"
              value={
                company.ticker ?? (
                  <span className="text-muted-foreground">
                    {company.desiredTicker ? `Requested: ${company.desiredTicker}` : "—"}
                  </span>
                )
              }
            />
            <ProfileRow label="Headquarters" value={company.headquarters ?? "—"} />
            <ProfileRow
              label="Primary contact"
              value={
                <span className="font-mono text-[12px]">
                  {company.primaryContactDiscordUsername ?? "—"}
                </span>
              }
            />
            <ProfileRow
              label="Intended use"
              value={
                company.intendedUses.length === 0
                  ? "—"
                  : company.intendedUses.map(formatIntendedUse).join(", ")
              }
            />
            <ProfileRow label="Registered" value={<span className="font-mono text-[11px]">{company.createdAt.slice(0, 10)}</span>} />
            <ProfileRow label="Your role" value={formatCompanyRole(company.currentUserRole)} />
          </Card>
        </Section>

        <Section title="Description">
          <Card className="!p-5">
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              {company.description ?? "No description provided."}
            </p>
          </Card>
        </Section>
      </div>

      <Section title="Authorized representatives" className="mt-10">
        <Card className="!p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <th className="px-4 py-3">Representative</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Since</th>
              </tr>
            </thead>
            <tbody>
              {company.members.map((m) => (
                <tr key={m.membershipId} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-3 font-mono text-[12px]">{m.discordUsername}</td>
                  <td className="px-4 py-3">{formatCompanyRole(m.role)}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                    {m.joinedAt.slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        {company.canManageMembers && (
          <Link
            to="/companies/$companyId/members"
            params={{ companyId: company.id }}
            className="mt-4 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-gold hover:underline"
          >
            Manage members →
          </Link>
        )}
      </Section>

      <Section title="Modules" className="mt-12">
        <CompanyFutureModules />
      </Section>
    </PageShell>
  );
}
