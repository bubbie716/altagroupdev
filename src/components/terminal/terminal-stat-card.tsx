import { PlatformStatCard } from "@/components/platform-stat-card";

export function TerminalStatCard(
  props: Parameters<typeof PlatformStatCard>[0],
) {
  return <PlatformStatCard {...props} />;
}
