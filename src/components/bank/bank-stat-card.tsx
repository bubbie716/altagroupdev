import { PlatformStatCard } from "@/components/platform-stat-card";

export function BankStatCard(
  props: Parameters<typeof PlatformStatCard>[0],
) {
  return <PlatformStatCard {...props} />;
}
