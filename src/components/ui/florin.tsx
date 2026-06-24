import { cn } from "@/lib/utils";

/**
 * Institutional currency component.
 * Always renders tabular monospace figures with the Florin glyph.
 *
 * Use everywhere a raw `florin(n)` string would otherwise leak default
 * proportional digits into a financial column.
 */
export function Florin({
  value,
  className,
  sign = false,
  tone,
  fractionDigits = 2,
  compact = false,
}: {
  value: number | null | undefined;
  className?: string;
  /** Force a leading `+` on positive values (e.g. P&L columns). */
  sign?: boolean;
  /** Optional tone — colors the figure with the success/danger token. */
  tone?: "positive" | "negative" | "muted" | "auto";
  fractionDigits?: number;
  compact?: boolean;
}) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return (
      <span
        className={cn(
          "tabular font-mono text-muted-foreground/70",
          className,
        )}
      >
        ƒ—
      </span>
    );
  }

  const formatted = compact
    ? Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 2,
      }).format(value)
    : value.toLocaleString("en-US", {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      });

  const prefix = sign && value > 0 ? "+" : "";

  const resolvedTone =
    tone === "auto"
      ? value > 0
        ? "positive"
        : value < 0
        ? "negative"
        : "muted"
      : tone;

  return (
    <span
      className={cn(
        "tabular font-mono",
        resolvedTone === "positive" && "text-[var(--success)]",
        resolvedTone === "negative" && "text-[var(--destructive)]",
        resolvedTone === "muted" && "text-muted-foreground",
        className,
      )}
    >
      {prefix}ƒ{formatted}
    </span>
  );
}