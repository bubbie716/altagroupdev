import { Card } from "@/components/page-shell";
import type { EntityStatus as PlatformStatus, PlatformStatusItem } from "@/lib/governance/content";
import { cn } from "@/lib/utils";

function statusLabel(status: PlatformStatus): string {
  switch (status) {
    case "Exchange Product":
      return "Exchange Product";
    case "In Development":
      return "In Development";
    case "Planned":
      return "Planned";
    default:
      return "Operational";
  }
}

function statusTone(status: PlatformStatus): string {
  switch (status) {
    case "Operational":
      return "text-[var(--success)]";
    case "Exchange Product":
      return "text-gold";
    case "In Development":
      return "text-muted-foreground";
    case "Planned":
      return "text-muted-foreground";
    default:
      return "text-foreground";
  }
}

export function PlatformStatusGrid({ items }: { items: PlatformStatusItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Card key={item.name} className="flex flex-col justify-between">
          <div className="type-meta">
            Platform
          </div>
          <div className="mt-3 text-lg font-semibold tracking-tight">{item.name}</div>
          <div
            className={cn(
              "mt-4 font-mono text-[10px] uppercase tracking-[0.2em]",
              statusTone(item.status),
            )}
          >
            {statusLabel(item.status)}
          </div>
        </Card>
      ))}
    </div>
  );
}
