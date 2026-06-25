import { Card } from "@/components/page-shell";
import { formatActivityDateTime } from "@/lib/format-datetime";
import type { AuditLogRow } from "@/lib/internal/audit.types";

export function InternalAuditTable({ rows }: { rows: AuditLogRow[] }) {
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
                <td className="font-mono text-[11px] text-muted-foreground">
                  {row.targetUsername ??
                    row.targetAccountId?.slice(0, 10) ??
                    row.targetCompanyId?.slice(0, 10) ??
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
