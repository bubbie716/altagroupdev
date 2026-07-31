import { cn } from "@/lib/utils";
import type { TerminalInstrumentKind } from "@/lib/terminal/types";

/** Compact Stock / Crypto badge for search results and security headers. */
export function InstrumentKindBadge({
  kind,
  className,
}: {
  kind: TerminalInstrumentKind;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md border border-[var(--terminal-border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--terminal-muted)]",
        className,
      )}
    >
      {kind === "CRYPTO" ? "Crypto" : "Stock"}
    </span>
  );
}
