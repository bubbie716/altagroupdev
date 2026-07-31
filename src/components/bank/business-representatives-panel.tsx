import { Link } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";
import type { BusinessRepresentativeRow } from "@/lib/bank/business-banking-types";
import { COMPANY_ROLE_LABELS } from "@/lib/bank/business-banking-types";
import { formatDueDate } from "@/lib/format-datetime";
import {
  BankMobileStack,
  BankMobileStackField,
  BankMobileStackRow,
  BankTableScroll,
} from "@/components/bank/bank-scroll-contain";
import type { CompanyRole } from "@/lib/auth/types";

const BANKING_ACCESS: Record<CompanyRole, string> = {
  owner: "Full banking access",
  executive: "Full banking access",
  finance_manager: "Payments & payroll",
  compliance_contact: "View only",
  viewer: "No banking access",
};

const CAPABILITIES: Record<CompanyRole, string> = {
  owner:
    "Manage treasury, commercial settings, payroll, invoices, payment links, and company members.",
  executive:
    "Manage treasury, payroll, invoices, and payment links. Plan billing is view-only.",
  finance_manager:
    "Create and manage payments, payroll, invoices, and payment links for day-to-day operations.",
  compliance_contact: "Review activity, statements, and this roster. Cannot move money.",
  viewer: "Can see company context only — no treasury or commercial banking tools.",
};

const ROLE_ORDER: CompanyRole[] = [
  "owner",
  "executive",
  "finance_manager",
  "compliance_contact",
];

export function BusinessRepresentativesPanel({
  representatives,
  companyId,
  companyName,
}: {
  representatives: BusinessRepresentativeRow[];
  companyId: string;
  companyName: string;
}) {
  const bankingTeam = representatives.filter((r) => r.role !== "viewer");

  return (
    <div className="min-w-0 space-y-8 pb-[calc(var(--bank-mobile-nav-offset)+0.5rem)] md:pb-0">
      <Card className="min-w-0 !p-0">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            Banking access for <span className="text-foreground">{companyName}</span> comes from
            Alta company membership — the same roles you manage on the company members page. There
            is no separate banking permission system.
          </p>
          <Link
            to="/companies/$companyId/members"
            params={{ companyId }}
            className="mt-4 inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-surface-2/60"
          >
            Manage company members
          </Link>
        </div>

        <div className="min-w-0 overflow-hidden">
          {bankingTeam.length === 0 ? (
            <p className="px-5 py-8 text-[13px] text-muted-foreground sm:px-6">
              No team members with banking access yet.
            </p>
          ) : (
            <>
              <BankMobileStack>
                {bankingTeam.map((r) => (
                  <BankMobileStackRow key={r.membershipId}>
                    <p className="font-medium break-words">{r.displayName}</p>
                    <BankMobileStackField label="Company role">
                      {COMPANY_ROLE_LABELS[r.role]}
                    </BankMobileStackField>
                    <BankMobileStackField label="Banking access">
                      {BANKING_ACCESS[r.role]}
                    </BankMobileStackField>
                    <BankMobileStackField label="Can">
                      <span className="text-[13px] leading-relaxed text-muted-foreground">
                        {CAPABILITIES[r.role]}
                      </span>
                    </BankMobileStackField>
                    <BankMobileStackField label="Joined">
                      {formatDueDate(r.joinedAt)}
                    </BankMobileStackField>
                  </BankMobileStackRow>
                ))}
              </BankMobileStack>

              <BankTableScroll>
                <table className="alta-table w-full min-w-[640px] text-sm">
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Company role</th>
                      <th>Banking access</th>
                      <th>Capabilities</th>
                      <th>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankingTeam.map((r) => (
                      <tr key={r.membershipId}>
                        <td className="font-medium">{r.displayName}</td>
                        <td>{COMPANY_ROLE_LABELS[r.role]}</td>
                        <td>{BANKING_ACCESS[r.role]}</td>
                        <td className="max-w-xs text-muted-foreground">{CAPABILITIES[r.role]}</td>
                        <td className="text-muted-foreground">{formatDueDate(r.joinedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </BankTableScroll>
            </>
          )}
        </div>
      </Card>

      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        {ROLE_ORDER.map((role) => (
          <Card key={role} className="min-w-0 !p-5">
            <div className="type-meta-accent">{COMPANY_ROLE_LABELS[role]}</div>
            <p className="mt-2 text-[12px] font-medium text-foreground">{BANKING_ACCESS[role]}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              {CAPABILITIES[role]}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
