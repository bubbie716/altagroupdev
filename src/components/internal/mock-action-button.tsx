import { cn } from "@/lib/utils";

export function MockActionButton({
  label,
  variant = "default",
}: {
  label: string;
  variant?: "default" | "danger" | "primary";
}) {
  return (
    <button
      type="button"
      disabled
      className={cn(
        "cursor-not-allowed rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] opacity-60",
        variant === "danger" && "border-[var(--destructive)]/40 text-[var(--destructive)]",
        variant === "primary" && "border-gold/40 text-gold",
        variant === "default" && "border-border text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}
