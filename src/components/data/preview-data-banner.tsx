import { cn } from "@/lib/utils";

type PreviewDataBannerProps = {
  message?: string;
  className?: string;
};

export function PreviewDataBanner({
  message = "Internal preview data — not connected to live operations.",
  className,
}: PreviewDataBannerProps) {
  return (
    <div
      role="status"
      className={cn(
        "mb-8 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground",
        className,
      )}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">Preview mode</span>
      <p className="mt-1">{message}</p>
    </div>
  );
}
