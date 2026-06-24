import { Card } from "@/components/page-shell";
import { type } from "@/lib/typography";
import { cn } from "@/lib/utils";

export function PlatformStatCard({
  label,
  value,
  sub,
  accent,
  signedValue,
  alert,
  className,
  padding = "md",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  signedValue?: number;
  alert?: boolean;
  className?: string;
  padding?: "sm" | "md";
}) {
  const signedTone =
    signedValue !== undefined
      ? signedValue > 0
        ? "text-[var(--success)]"
        : signedValue < 0
          ? "text-[var(--destructive)]"
          : undefined
      : undefined;

  return (
    <Card className={cn(padding === "sm" ? "!p-4" : "!p-5", className)}>
      <div className={type.meta}>{label}</div>
      <div
        className={cn(
          type.financeLg,
          "mt-2",
          accent && "text-[var(--success)]",
          alert && "text-[var(--destructive)]",
          signedTone,
        )}
      >
        {value}
      </div>
      {sub && <div className={cn(type.financeSm, "mt-1 text-muted-foreground")}>{sub}</div>}
    </Card>
  );
}
