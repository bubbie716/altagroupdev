import { Link } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";
import { formatActivityDateTime } from "@/lib/format-datetime";
import type { AuditLogRow } from "@/lib/internal/audit.types";

export function AccountActivityLink({
  accountId,
  accountName,
  accountNumber,
  label,
}: {
  accountId: string | null | undefined;
  accountName?: string | null;
  accountNumber?: string | null;
  label?: string | null;
}) {
  if (!accountId) {
    return <span className="text-muted-foreground">—</span>;
  }

  const name = accountName ?? (label?.includes(" · ") ? label.split(" · ")[0] : null);
  const number = accountNumber ?? (label?.includes(" · ") ? label.split(" · ").slice(1).join(" · ") : label);

  if (!name && !number) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <Link to="/internal/bank/accounts/$accountId" params={{ accountId }} className="hover:text-gold">
      {name ? <div className="text-[12px]">{name}</div> : null}
      {number ? <div className="font-mono text-[11px] text-muted-foreground">{number}</div> : null}
    </Link>
  );
}

export function InternalAuditTable({
  rows,
  showAccount = true,
}: {
  rows: AuditLogRow[];
  showAccount?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <Card className="!p-8 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          No audit entries yet
        </p>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Operator actions will appear here as they are performed.
        </p>
      </Card>
    );
  }

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="w-full overflow-x-auto">
        <table className="alta-table w-full min-w-[900px] text-sm">
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              {showAccount ? <th>Account</th> : null}
              <th>Target</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="font-mono text-[11px] text-muted-foreground">
                  {formatActivityDateTime(row.createdAt)}
                </td>
                <td className="font-mono text-[12px]">{row.actorUsername}</td>
                <td className="font-mono text-[11px]">{row.action}</td>
                {showAccount ? (
                  <td className="text-[13px]">
                    <AccountActivityLink
                      accountId={row.targetAccountId}
                      accountName={row.targetAccountName}
                      accountNumber={row.targetAccountNumber}
                    />
                  </td>
                ) : null}
                <td className="font-mono text-[11px] text-muted-foreground">
                  {row.targetUsername ??
                    row.targetCompanyId?.slice(0, 10) ??
                    row.targetLoanId?.slice(0, 10) ??
                    row.entityId?.slice(0, 10) ??
                    "—"}
                </td>
                <td className="text-[13px]">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
