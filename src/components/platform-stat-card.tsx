import { type } from "@/lib/typography";
import { cn } from "@/lib/utils";

/**
 * Institutional stat card. Static surface (no hover lift — these aren't
 * clickable), subtle gold rail when `accent`, and a numeric body that
 * lines up across rows because we lock the value line-height.
 */
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
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-surface-1/80 shadow-card",
        "transition-colors duration-200 hover:border-border-strong",
        padding === "sm" ? "p-4" : "p-5",
        className,
      )}
    >
      {accent ? (
        <span
          aria-hidden
          className="absolute inset-y-3 left-0 w-[2px] rounded-full bg-gradient-to-b from-gold/80 via-gold to-gold/40"
        />
      ) : null}
      <div className={cn(type.meta, "truncate")}>{label}</div>
      <div
        className={cn(
          type.financeLg,
          "mt-2 leading-none",
          accent && "text-[var(--success)]",
          alert && "text-[var(--destructive)]",
          signedTone,
        )}
      >
        {value}
      </div>
      {sub && (
        <div className={cn(type.financeSm, "mt-2 text-muted-foreground")}>
          {sub}
        </div>
      )}
    </div>
  );
}
