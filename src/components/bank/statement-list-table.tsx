import type { BankStatementSummary } from "@/lib/bank/statement-types";
import { florin } from "@/lib/bank/api";
import { StatusBadge } from "@/components/internal/status-badge";
import { RouteButton } from "@/components/bank/route-button";

function formatPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
}

export function StatementListTable({ statements }: { statements: BankStatementSummary[] }) {
  if (statements.length === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        No statements have been generated for this view yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="-mx-4 overflow-x-auto sm:mx-0"><table className="alta-table w-full min-w-[640px] text-sm">
        <thead>
          <tr>
            <th>Account</th>
            <th>Number</th>
            <th>Period</th>
            <th>Closing balance</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {statements.map((s) => (
            <tr key={s.id}>
              <td>
                <div className="font-medium">{s.accountName}</div>
                {s.companyName && (
                  <div className="text-[11px] text-muted-foreground">{s.companyName}</div>
                )}
              </td>
              <td className="font-mono text-[11px]">{s.accountNumber}</td>
              <td className="text-muted-foreground">{formatPeriod(s.periodStart, s.periodEnd)}</td>
              <td className="type-finance-nums">{florin(s.closingBalance)}</td>
              <td>
                <StatusBadge status={s.statusLabel} />
              </td>
              <td>
                <RouteButton
                  to="/bank/statements/$statementId"
                  params={{ statementId: s.id }}
                  className="rounded border border-gold/30 bg-gold/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold"
                >
                  View
                </RouteButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
