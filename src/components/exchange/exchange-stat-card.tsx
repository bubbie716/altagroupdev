import { PlatformStatCard } from "@/components/platform-stat-card";

export function ExchangeStatCard(
  props: Parameters<typeof PlatformStatCard>[0],
) {
  return <PlatformStatCard {...props} />;
}
