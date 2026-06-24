import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import type { CompanySummary } from "@/lib/company/types";
import { formatCompanyRole } from "@/lib/auth/tags";

export function CompanyDashboardCard({ company }: { company: CompanySummary }) {
  return (
    <Card className="flex flex-col !p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="type-meta">
            {company.type}
          </div>
          <h3 className="mt-2 text-lg font-semibold tracking-tight">{company.name}</h3>
          {company.sector && (
            <p className="mt-1 text-[13px] text-muted-foreground">{company.sector}</p>
          )}
        </div>
        <StatusBadge status={company.status} />
      </div>

      <div className="mt-6 grid gap-3 text-[13px] sm:grid-cols-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Your role
          </div>
          <div className="mt-1 font-medium">{formatCompanyRole(company.role)}</div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Verification
          </div>
          <div className="mt-1">
            <StatusBadge status={company.verificationStatus} />
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Ticker
          </div>
          <div className="mt-1 font-mono text-[12px]">
            {company.ticker ?? company.desiredTicker ?? "—"}
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Registered
          </div>
          <div className="mt-1 font-mono text-[11px] text-muted-foreground">
            {company.createdAt.slice(0, 10)}
          </div>
        </div>
      </div>

      <Link
        to="/companies/$companyId"
        params={{ companyId: company.id }}
        className="mt-6 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-gold hover:underline"
      >
        View company
        <ArrowUpRight className="size-3.5" />
      </Link>
    </Card>
  );
}
