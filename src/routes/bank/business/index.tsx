import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Section } from "@/components/page-shell";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { BankStatStrip } from "@/components/bank/bank-stat-strip";
import { BankActionLauncher } from "@/components/bank/actions/bank-action-launcher";
import {
  BusinessCompanyPicker,
  BusinessPermissionBadge,
} from "@/components/bank/business-company-picker";
import { EmptyState } from "@/components/data/empty-state";
import { florin } from "@/lib/bank/api";
import { fetchBusinessBankingOverview } from "@/lib/bank/business-banking.functions";
import { canAccessBusinessModule } from "@/lib/bank/business-account-access";
import { authBeforeLoad } from "@/lib/auth/guards";
import type { BusinessTreasuryCompany } from "@/lib/bank/business-banking-types";

export const Route = createFileRoute("/bank/business/")({
  beforeLoad: authBeforeLoad,
  loaderDeps: ({ search }) => ({ companyId: search.companyId }),
  loader: async ({ deps }) => fetchBusinessBankingOverview({ data: deps.companyId }),
  head: () => ({ meta: [{ title: "Business Banking — Alta Bank" }] }),
  component: BusinessBankingHubPage,
});

const QUICK_LINKS = [
  {
    module: "payments" as const,
    to: "/bank/account/$accountId/commercial/payments" as const,
    label: "Payments",
    description: "Treasury queue and Alta Pay received",
  },
  {
    module: "payments" as const,
    to: "/bank/account/$accountId/commercial/invoices" as const,
    label: "Invoices",
    description: "Create and track customer invoices",
  },
  {
    module: "payments" as const,
    to: "/bank/account/$accountId/commercial/payment-links" as const,
    label: "Payment links",
    description: "Share checkout links for collections",
  },
  {
    module: "payroll" as const,
    to: "/bank/account/$accountId/commercial/payroll" as const,
    label: "Payroll",
    description: "Employee registry and payroll batches",
  },
  {
    module: "payments" as const,
    to: "/bank/account/$accountId/commercial/analytics" as const,
    label: "Analytics",
    description: "Collections, success rates, and trends",
  },
  {
    module: "activity" as const,
    to: "/bank/account/$accountId/activity" as const,
    label: "Activity",
    description: "Approved transaction history",
  },
  {
    module: "statements" as const,
    to: "/bank/account/$accountId/statements" as const,
    label: "Statements",
    description: "Monthly operating account statements",
  },
  {
    module: "representatives" as const,
    to: "/bank/account/$accountId/representatives" as const,
    label: "Team",
    description: "Role-based treasury permissions",
  },
  {
    module: "settings" as const,
    to: "/bank/account/$accountId/commercial/settings" as const,
    label: "Commercial settings",
    description: "Plan, billing, and subscription history",
  },
];

function BusinessBankingHubPage() {
  const { companies, selectedCompanyId } = Route.useLoaderData();
  const selected =
    companies.find((company) => company.companyId === selectedCompanyId) ?? companies[0] ?? null;

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank · Business"
        title="Business Banking"
        description="Treasury for the verified Newport companies you represent."
        action={
          selected ? (
            <Link
              to="/bank/account/$accountId"
              params={{ accountId: selected.operatingAccount.id }}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
            >
              Open operating account
            </Link>
          ) : (
            <BankActionLauncher action="open-account" variant="default">
              Open Operating Account
            </BankActionLauncher>
          )
        }
      />

      {!selected ? (
        <EmptyState
          eyebrow="Alta Bank"
          title="No business operating account yet."
          description="Payments, payroll, representatives, and statements unlock once a verified company you represent has an active Business Operating Account."
        />
      ) : (
        <>
          <BusinessCompanyPicker companies={companies} selectedCompanyId={selected.companyId} />
          <BusinessPermissionBadge permissions={selected.permissions} />

          <BankStatStrip
            items={[
              { label: "Operating balance", value: florin(selected.operatingAccount.balance) },
              { label: "Account", value: selected.operatingAccount.accountNumber },
              { label: "Company", value: selected.companyName },
            ]}
          />

          <Section title="Quick links" className="mt-8">
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-1">
              {QUICK_LINKS.filter((link) =>
                canAccessBusinessModule(selected.permissions.role, link.module),
              ).map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    params={{ accountId: selected.operatingAccount.id }}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--menu-item-hover)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium">{link.label}</p>
                      <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                        {link.description}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          {companies.length > 1 ? (
            <Section title="Your companies" className="mt-8">
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-1">
                {companies.map((company) => (
                  <CompanyRow
                    key={company.companyId}
                    company={company}
                    selected={company.companyId === selected.companyId}
                  />
                ))}
              </ul>
            </Section>
          ) : null}
        </>
      )}
    </>
  );
}

function CompanyRow({
  company,
  selected,
}: {
  company: BusinessTreasuryCompany;
  selected: boolean;
}) {
  return (
    <li>
      <Link
        to="/bank/account/$accountId"
        params={{ accountId: company.operatingAccount.id }}
        className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--menu-item-hover)]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <p className="min-w-0 max-w-full truncate text-[14px] font-medium">
              {company.companyName}
            </p>
            {selected ? (
              <span className="rounded-full border border-gold/30 bg-gold/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-gold">
                Selected
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
            {company.permissions.roleLabel} · {company.operatingAccount.accountNumber}
          </p>
        </div>
        <p className="shrink-0 text-[14px] font-medium tabular-nums">
          {florin(company.operatingAccount.balance)}
        </p>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
