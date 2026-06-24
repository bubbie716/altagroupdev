import { cn } from "@/lib/utils";

export function EmbedCharCounter({
  current,
  max,
  className,
}: {
  current: number;
  max: number;
  className?: string;
}) {
  const over = current > max;
  return (
    <span
      className={cn(
        "font-mono text-[10px] tabular-nums",
        over ? "text-[var(--destructive)]" : "text-muted-foreground",
        className,
      )}
    >
      {current}/{max}
    </span>
  );
}

export function EmbedFieldLabel({
  label,
  counter,
}: {
  label: string;
  counter?: { current: number; max: number };
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="type-meta">
        {label}
      </span>
      {counter && <EmbedCharCounter current={counter.current} max={counter.max} />}
    </div>
  );
}
