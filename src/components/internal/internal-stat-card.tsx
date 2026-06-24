import { PlatformStatCard } from "@/components/platform-stat-card";

export function InternalStatCard(
  props: Parameters<typeof PlatformStatCard>[0],
) {
  return <PlatformStatCard padding="sm" {...props} />;
}
