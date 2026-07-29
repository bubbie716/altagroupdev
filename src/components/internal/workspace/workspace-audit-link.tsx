import { Link } from "@tanstack/react-router";
import type { AuditEntityType } from "@prisma/client";
import { entityAuditHref } from "@/lib/internal/audit-links";

function appendSiteToHref(href: string, site?: string | null): string {
  if (!site?.trim()) return href;
  const u = new URL(href, "https://alta.local");
  u.searchParams.set("site", site.trim());
  return u.pathname + u.search;
}

export function WorkspaceAuditLink({
  entityType,
  entityId,
  site,
}: {
  entityType: AuditEntityType;
  entityId: string;
  site?: string | null;
}) {
  const href = appendSiteToHref(entityAuditHref(entityType, entityId), site);

  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <p className="text-[12px] text-muted-foreground">
        Official compliance trail for this record. For recent operational events, use the Activity tab.
      </p>
      <Link
        to={href as "/"}
        className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
      >
        Full audit log →
      </Link>
    </div>
  );
}
