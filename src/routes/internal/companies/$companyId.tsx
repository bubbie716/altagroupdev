import { createFileRoute, Link } from "@tanstack/react-router";
import { Section, Card } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import { CompanyVerificationActions } from "@/components/internal/company-verification-actions";
import { InternalNotePanel } from "@/components/internal/internal-note-panel";
import { InternalAuditTable } from "@/components/internal/internal-audit-table";
import { AccountActivityLink } from "@/components/internal/internal-audit-table";
import { InternalActivityTimeline } from "@/components/internal/internal-activity-timeline";
import { formatCompanyRole } from "@/lib/internal/format";
import { fetchCompany360 } from "@/lib/internal/ops-platform.functions";
import { fetchAuditLogsForEntity } from "@/lib/internal/audit.functions";
import { florin } from "@/lib/bank/api";
import { COMPANY_RELATIONSHIP_TIER_LABELS } from "@/lib/bank/company-relationship-intelligence-config";
import { fetchAdminCompanyRelationshipDetail } from "@/lib/internal/company-relationship-intelligence.functions";
import { CompanyRelationshipSummaryCard } from "@/components/internal/company-relationship-timeline-panel";

export const Route = createFileRoute("/internal/companies/$companyId")({
  loader: async ({ params }) => {
    try {
      const [data, auditLogs, relationship] = await Promise.all([
        fetchCompany360({ data: params.companyId }),
        fetchAuditLogsForEntity({
          data: { entityType: "COMPANY", entityId: params.companyId },
        }),
        fetchAdminCompanyRelationshipDetail({ data: params.companyId }).catch(() => null),
      ]);
      return { data, auditLogs, relationship };
    } catch {
      return null;
    }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.data.company.name ?? "Company"} — Alta Internal` }],
  }),
  component: InternalCompanyDetail,
});

function InternalCompanyDetail() {
  const loaderData = Route.useLoaderData();

  if (!loaderData) {
    return (
      <InternalPageShell title="Company Not Found" description="No registered entity matches this ID.">
        <Link to="/internal/companies" className="font-mono text-[12px] text-gold hover:underline">
          ← Back to companies
        </Link>
      </InternalPageShell>
    );
  }

  const { data, auditLogs, relationship } = loaderData;
  const { company, notes, timeline, bankAccounts, loans, altaPayActivity, statements, verificationTimeline, relationshipManager } = data;
  const display = relationship?.calculated ?? relationship?.profile;

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

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="!p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Relationship manager</div>
          <div className="mt-2 text-[13px]">{relationshipManager ?? "Unassigned (coming soon)"}</div>
        </Card>
        <Card className="!p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Registered</div>
          <div className="mt-2 font-mono text-[12px]">{company.createdAt.slice(0, 10)}</div>
        </Card>
        <Card className="!p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Audit events</div>
          <div className="mt-2 type-finance">{data.auditCount}</div>
        </Card>
      </div>

      {display && relationship ? (
        <div className="mb-8">
          <CompanyRelationshipSummaryCard
            companyId={company.id}
            companyName={company.name}
            score={display.relationshipScore}
            tier={COMPANY_RELATIONSHIP_TIER_LABELS[display.relationshipTier]}
            totalBusinessAssets={display.totalBusinessAssets}
            commercialEligible={display.commercialBankingEligible}
          />
        </div>
      ) : null}

      <Section title="Members">
        <Card className="!p-0">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left type-meta">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Since</th>
                </tr>
              </thead>
              <tbody>
                {company.members.map((m) => (
                  <tr key={m.membershipId} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3">
                      <Link to="/internal/users/$userId" params={{ userId: m.userId }} className="font-mono text-[12px] hover:text-gold">
                        {m.discordUsername}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{formatCompanyRole(m.role)}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{m.joinedAt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>

      <Section title="Bank accounts" className="mt-10">
        {bankAccounts.length === 0 ? (
          <Card className="!p-6 text-[13px] text-muted-foreground">No bank accounts.</Card>
        ) : (
          <Card className="!p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left type-meta">
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {bankAccounts.map((a) => (
                    <tr key={a.id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3">
                        <Link to="/internal/bank/accounts/$accountId" params={{ accountId: a.id }} className="hover:text-gold">
                          <div>{a.accountName}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">{a.accountNumber}</div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">{a.accountTypeLabel}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="tabular px-4 py-3 text-right">{florin(a.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </Section>

      <Section title="Loan portfolio" className="mt-10">
        {loans.length === 0 ? (
          <Card className="!p-6 text-[13px] text-muted-foreground">No loans.</Card>
        ) : (
          <Card className="!p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left type-meta">
                    <th className="px-4 py-3">Loan</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Principal</th>
                    <th className="px-4 py-3 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((l) => (
                    <tr key={l.id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3">
                        <Link to="/internal/lending/loans/$loanId" params={{ loanId: l.id }} className="font-mono text-[11px] text-gold hover:underline">
                          {l.id.slice(0, 10)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={l.status} />
                      </td>
                      <td className="tabular px-4 py-3 text-right">{florin(l.principalAmount)}</td>
                      <td className="tabular px-4 py-3 text-right">{florin(l.outstandingBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </Section>

      {altaPayActivity.length > 0 && (
        <Section title="Alta Pay activity" className="mt-10">
          <Card className="!p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left type-meta">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {altaPayActivity.map((tx) => (
                    <tr key={tx.id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 font-mono text-[11px]">{tx.createdAt.slice(0, 19).replace("T", " ")}</td>
                      <td className="px-4 py-3">
                        <Link to="/internal/bank/transactions/$transactionId" params={{ transactionId: tx.id }} className="font-mono text-[11px] text-gold hover:underline">
                          {tx.referenceCode}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <AccountActivityLink
                          accountId={tx.accountId}
                          accountName={tx.accountName}
                          accountNumber={tx.accountNumber}
                        />
                      </td>
                      <td className="tabular px-4 py-3 text-right">{florin(tx.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Section>
      )}

      {statements.length > 0 && (
        <Section title="Statements" className="mt-10">
          <Card className="!p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left type-meta">
                    <th className="px-4 py-3">Statement</th>
                    <th className="px-4 py-3">Period end</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {statements.map((s) => (
                    <tr key={s.id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 font-mono text-[11px]">{s.statementNumber}</td>
                      <td className="px-4 py-3 font-mono text-[11px]">{s.periodEnd.slice(0, 10)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Section>
      )}

      <Section title="Verification timeline" className="mt-10">
        <ol className="space-y-2 text-[13px]">
          {verificationTimeline.map((step, i) => (
            <li key={i} className="flex justify-between gap-4 border-b border-border/40 pb-2">
              <span>{step.label}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{step.at.slice(0, 19).replace("T", " ")}</span>
            </li>
          ))}
        </ol>
      </Section>

      <div className="mt-8">
        <CompanyVerificationActions companyId={company.id} verificationStatus={company.verificationStatus} />
      </div>

      <Section title="Activity timeline" className="mt-10">
        <InternalActivityTimeline events={timeline} />
      </Section>

      <Section title="Internal notes" className="mt-10">
        <InternalNotePanel targetType="COMPANY" targetId={company.id} initialNotes={notes} />
      </Section>

      <Section title="Audit history" className="mt-10">
        <InternalAuditTable rows={auditLogs} />
      </Section>
    </InternalPageShell>
  );
}
