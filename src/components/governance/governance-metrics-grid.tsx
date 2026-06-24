import { LiveMetricCard } from "@/components/metrics/live-metric-card";
import type { GovernanceMetricItem } from "@/lib/metrics/governance-metrics";

export function GovernanceMetricsGrid({ items }: { items: GovernanceMetricItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <LiveMetricCard
          key={item.label}
          label={item.label}
          value={item.value}
          helper={item.helper}
          sourceLabel={item.sourceLabel}
        />
      ))}
    </div>
  );
}
