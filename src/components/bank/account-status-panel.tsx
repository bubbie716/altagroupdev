import { Card } from "@/components/page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import type { CustomerAccountStatus } from "@/lib/bank/backend-types";
import { accountStatusBadgeLabel } from "@/lib/bank/account-status-copy";

export function AccountStatusPanel({
  status,
  className,
}: {
  status: CustomerAccountStatus;
  className?: string;
}) {
  const badgeLabel = accountStatusBadgeLabel(status);

  return (
    <Card id="account-status" className={className ?? "!p-6"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-medium tracking-wide text-foreground">Account Status</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{status.headline}</p>
        </div>
        <StatusBadge status={badgeLabel} className="shrink-0" />
      </div>

      <ul className="mt-4 space-y-2 border-t border-border/60 pt-4">
        {status.notices.map((notice) => (
          <li key={notice} className="text-[13px] leading-relaxed text-muted-foreground">
            {notice}
          </li>
        ))}
      </ul>
    </Card>
  );
}
