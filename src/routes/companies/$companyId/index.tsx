import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  RelationshipIdentityCard,
  RelationshipInformationPanel,
  RelationshipProfileSection,
  RelationshipSnapshotAside,
} from "@/components/account/relationship-profile-ui";
import { PageShell, Section, Card } from "@/components/page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import { Florin } from "@/components/ui/florin";
import { CompanySubNav } from "@/components/companies/company-sub-nav";
import { CompanyFutureModules } from "@/components/companies/company-future-modules";
import { formatCompanyRole } from "@/lib/auth/tags";
import { formatIntendedUse } from "@/lib/company/types";
import { fetchCompanyBankSummary } from "@/lib/company/company.functions";
import type { CompanyDetail } from "@/lib/company/types";
import { Route as CompanyRoute } from "@/routes/companies/$companyId/route";

export const Route = createFileRoute("/companies/$companyId/")({
  loader: async ({ params }) => fetchCompanyBankSummary({ data: params.companyId }),
  head: ({ matches }) => {
    const companyMatch = matches.find((m) => (m.routeId as string) === "/companies/$companyId");
    const company = companyMatch?.loaderData as CompanyDetail | undefined;
    return {
      meta: [{ title: `${company?.name ?? "Company"} — Alta Group` }],
    };
  },
  component: CompanyDetailPage,
});

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/50 py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between">
      <span className="type-meta">{label}</span>
      <span className="text-sm sm:max-w-md sm:text-right">{value}</span>
    </div>
  );
}

function CompanyDetailPage() {
  const company = CompanyRoute.useLoaderData();
  const bankSummary = Route.useLoaderData();

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

      <CompanySubNav companyId={company.id} />

      <RelationshipIdentityCard
        className="mb-16 sm:mb-20"
        primary={
          <div className="bg-surface-1 px-6 py-8 sm:px-10 sm:py-10">
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
                Company identity
              </div>
              <h2 className="mt-1 font-serif text-2xl leading-tight tracking-tight sm:text-3xl">
                {company.name}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={company.status} />
                <StatusBadge status={company.verificationStatus} />
                {company.ticker ? (
                  <span className="rounded bg-surface-2 px-2 py-0.5 font-mono text-[11px]">
                    {company.ticker}
                  </span>
                ) : null}
              </div>
            </div>

            <dl className="mt-8 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              <DetailRow label="Entity type" value={company.type} />
              <DetailRow label="Sector" value={company.sector ?? "—"} />
              <DetailRow
                label="Ticker"
                value={
                  company.ticker ?? (
                    <span className="text-muted-foreground">
                      {company.desiredTicker ? `Requested: ${company.desiredTicker}` : "—"}
                    </span>
                  )
                }
              />
              <DetailRow label="Headquarters" value={company.headquarters ?? "—"} />
              <DetailRow
                label="Registered"
                value={<span className="font-mono text-[11px]">{company.createdAt.slice(0, 10)}</span>}
              />
              <DetailRow label="Your role" value={formatCompanyRole(company.currentUserRole)} />
            </dl>
          </div>
        }
        snapshot={
          <RelationshipSnapshotAside
            rows={[
              { label: "Standing", value: company.verificationStatus },
              { label: "Total balance", value: <Florin value={bankSummary.totalBalance} /> },
              { label: "Active accounts", value: String(bankSummary.activeAccountCount) },
              { label: "Representatives", value: String(company.memberCount) },
            ]}
            footer={
              <>
                Business banking · {bankSummary.activeAccountCount} active operating{" "}
                {bankSummary.activeAccountCount === 1 ? "account" : "accounts"}
              </>
            }
          />
        }
      />

      <RelationshipProfileSection
        index="01"
        title="Relationship information"
        kicker="Business banking"
        className="mt-16 sm:mt-20"
      >
        <RelationshipInformationPanel
          summary={bankSummary}
          linkTo="/bank/business"
          linkLabel="Open business banking →"
        />
      </RelationshipProfileSection>

      <RelationshipProfileSection
        index="02"
        title="Company profile"
        kicker="Registration details"
        className="mt-16 sm:mt-20"
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="!p-5">
            <DetailRow
              label="Primary contact"
              value={
                <span className="font-mono text-[12px]">
                  {company.primaryContactDiscordUsername ?? "—"}
                </span>
              }
            />
            <DetailRow
              label="Intended use"
              value={
                company.intendedUses.length === 0
                  ? "—"
                  : company.intendedUses.map(formatIntendedUse).join(", ")
              }
            />
            <DetailRow label="Last updated" value={company.updatedAt.slice(0, 10)} />
          </Card>

          <Card className="!p-5">
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              {company.description ?? "No description provided."}
            </p>
          </Card>
        </div>
      </RelationshipProfileSection>

      <RelationshipProfileSection
        index="03"
        title="Authorized representatives"
        kicker="Entity membership"
        className="mt-16 sm:mt-20"
      >
        <Card className="!p-0">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left type-meta">
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
          </div>
        </Card>
        {company.canManageMembers ? (
          <Link
            to="/companies/$companyId/members"
            params={{ companyId: company.id }}
            className="mt-4 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-gold hover:underline"
          >
            Manage members →
          </Link>
        ) : null}
      </RelationshipProfileSection>

      <Section title="Modules" className="mt-12">
        <CompanyFutureModules />
      </Section>
    </PageShell>
  );
}
