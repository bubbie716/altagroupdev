import { cn } from "@/lib/utils";

type MockDataNoticeProps = {
  message?: string;
  className?: string;
};

export function MockDataNotice({
  message = "Simulated market data for preview.",
  className,
}: MockDataNoticeProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/80 bg-surface-2/60 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground",
        className,
      )}
    >
      {message}
    </div>
  );
}
