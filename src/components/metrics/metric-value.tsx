import { cn } from "@/lib/utils";

export function MetricValue({
  children,
  className,
  size = "default",
}: {
  children: React.ReactNode;
  className?: string;
  size?: "default" | "hero";
}) {
  return (
    <div
      className={cn(
        "metric-value-cell",
        size === "hero" && "metric-value-cell--hero",
        className,
      )}
    >
      <div className="metric-value-fit">{children}</div>
    </div>
  );
}
