import { cn } from "@/lib/utils";
import { formatOpsStatusLabel } from "@/lib/internal/console/ops-copy";
import { resolveOpsStatusTone, type OpsStatusTone, OPS_STATUS_TONE_STYLES } from "@/lib/internal/console/ops-status";

/** Canonical internal-console status badge. */
export function OpsStatusBadge({
  status,
  tone,
  dot = true,
  normalize = true,
  className,
}: {
  status: string;
  tone?: OpsStatusTone;
  dot?: boolean;
  normalize?: boolean;
  className?: string;
}) {
  const label = normalize ? formatOpsStatusLabel(status) : status;
  const resolved = resolveOpsStatusTone(status, tone);
  const styles = OPS_STATUS_TONE_STYLES[resolved];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase leading-none tracking-[0.14em] whitespace-nowrap",
        styles.wrap,
        className,
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", styles.dot)} aria-hidden /> : null}
      {label}
    </span>
  );
}
