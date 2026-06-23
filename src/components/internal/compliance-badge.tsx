import { cn } from "@/lib/utils";
import type { ComplianceSeverity } from "@/lib/internal/types";

const severityStyles: Record<ComplianceSeverity, string> = {
  Low: "bg-muted text-muted-foreground border-border",
  Medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  High: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30",
  Critical: "bg-[var(--destructive)]/10 text-[var(--destructive)] border-[var(--destructive)]/30",
};

export function ComplianceBadge({ severity }: { severity: ComplianceSeverity }) {
  return (
    <span
      className={cn(
        "inline-flex rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
        severityStyles[severity],
      )}
    >
      {severity}
    </span>
  );
}
