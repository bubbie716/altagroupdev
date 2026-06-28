import { Link } from "@tanstack/react-router";
import type { AuditEntityType } from "@prisma/client";
import { entityAuditHref } from "@/lib/internal/audit-links";

export function WorkspaceAuditLink({
  entityType,
  entityId,
}: {
  entityType: AuditEntityType;
  entityId: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <p className="text-[12px] text-muted-foreground">
        Official compliance trail for this record. For recent operational events, use the Activity tab.
      </p>
      <Link
        to={entityAuditHref(entityType, entityId)}
        className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
      >
        Full audit log →
      </Link>
    </div>
  );
}
