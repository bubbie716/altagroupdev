import { cn } from "@/lib/utils";
import { formatQueueAgeDisplay, queueAgeSeverity } from "./queue-utils";

export function QueueAgeCell({ isoOrDate }: { isoOrDate: string }) {
  const severity = queueAgeSeverity(isoOrDate);
  return (
    <span
      className={cn(
        "font-mono text-[11px] tabular-nums",
        severity === "normal" && "text-muted-foreground",
        severity === "warning" && "text-amber-400",
        severity === "critical" && "font-medium text-red-400",
      )}
    >
      {formatQueueAgeDisplay(isoOrDate)}
    </span>
  );
}
