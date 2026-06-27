import type { BankStatementSummary } from "@/lib/bank/statement-types";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { StatusBadge } from "@/components/internal/status-badge";
import { RouteButton } from "@/components/bank/route-button";
import {
  BankMobileStack,
  BankMobileStackField,
  BankMobileStackRow,
  BankTableScroll,
  bankTableShellClass,
} from "@/components/bank/bank-scroll-contain";

function formatPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
}

function formatGeneratedAt(generatedAt: string | null, createdAt: string): string {
  return formatActivityDateTime(generatedAt ?? createdAt);
}

export function StatementListTable({
  statements,
  returnFrom = "account",
}: {
  statements: BankStatementSummary[];
  /** Where the user opened statements from — controls back navigation on the detail page. */
  returnFrom?: "account" | "center";
}) {
  if (statements.length === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        No statements have been generated for this view yet.
      </p>
    );
  }

  return (
    <div className={bankTableShellClass}>
      <BankMobileStack>
        {statements.map((s) => (
          <BankMobileStackRow key={s.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium break-words">{s.accountName}</p>
                {s.companyName ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{s.companyName}</p>
                ) : null}
              </div>
              <StatusBadge status={s.statusLabel} />
            </div>
            <BankMobileStackField label="Period">
              {formatPeriod(s.periodStart, s.periodEnd)}
            </BankMobileStackField>
            <BankMobileStackField label="Generated">
              {formatGeneratedAt(s.generatedAt, s.createdAt)}
            </BankMobileStackField>
            <BankMobileStackField label="Closing balance">
              <span className="type-finance-nums">{florin(s.closingBalance)}</span>
            </BankMobileStackField>
            <BankMobileStackField label="Account">{s.accountNumber}</BankMobileStackField>
            <RouteButton
              to="/bank/statements/$statementId"
              params={{ statementId: s.id }}
              search={{ from: returnFrom }}
              className="mt-1 inline-flex rounded border border-gold/30 bg-gold/5 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-gold"
            >
              View statement
            </RouteButton>
          </BankMobileStackRow>
        ))}
      </BankMobileStack>

      <BankTableScroll>
        <table className="alta-table w-full min-w-[760px] text-sm">
          <thead>
            <tr>
              <th>Account</th>
              <th>Number</th>
              <th>Period</th>
              <th>Generated</th>
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
                <td className="text-muted-foreground">{formatGeneratedAt(s.generatedAt, s.createdAt)}</td>
                <td className="type-finance-nums">{florin(s.closingBalance)}</td>
                <td>
                  <StatusBadge status={s.statusLabel} />
                </td>
                <td>
                  <RouteButton
                    to="/bank/statements/$statementId"
                    params={{ statementId: s.id }}
                    search={{ from: returnFrom }}
                    className="rounded border border-gold/30 bg-gold/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold"
                  >
                    View
                  </RouteButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </BankTableScroll>
    </div>
  );
}
