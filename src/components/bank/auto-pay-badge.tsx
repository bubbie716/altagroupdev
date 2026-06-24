import { StatusBadge } from "@/components/internal/status-badge";

export function AutoPayBadge({ enabled }: { enabled: boolean }) {
  return <StatusBadge status={enabled ? "Auto-pay enabled" : "Auto-pay disabled"} />;
}
