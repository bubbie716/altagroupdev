import { cn } from "@/lib/utils";

export function HideClosedAccountButton({
  onHide,
  className,
  label = "Don't show anymore",
}: {
  onHide: () => void;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onHide();
      }}
      className={cn(
        "font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      {label}
    </button>
  );
}
