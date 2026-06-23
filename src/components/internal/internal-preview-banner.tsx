import { internalPreviewNotice } from "@/lib/internal/api";

export function InternalPreviewBanner() {
  return (
    <div className="mb-6 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">
        {internalPreviewNotice}
      </p>
    </div>
  );
}
