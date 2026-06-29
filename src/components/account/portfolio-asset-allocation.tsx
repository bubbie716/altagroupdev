import { motion } from "framer-motion";
import type { AssetAllocationItem } from "@/lib/account/asset-allocation";
import { cn } from "@/lib/utils";

export function PortfolioAssetAllocation({
  items,
  locked = false,
}: {
  items: AssetAllocationItem[];
  locked?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface-1 p-3 sm:col-span-2">
      <div className="type-meta-sm">Asset Allocation</div>
      <div className="mt-2 space-y-2.5">
        {items.map((item) => (
          <div key={item.id}>
            <div className="flex items-baseline justify-between gap-3">
              <span className={cn("text-[12px] text-foreground/85", locked && "blur-[6px]")}>
                {item.label}
              </span>
              <span
                className={cn(
                  "shrink-0 tabular text-[12px] font-medium text-foreground",
                  locked && "blur-[6px]",
                )}
              >
                {item.percent}%
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <motion.div
                className="h-full rounded-full bg-gold/80"
                initial={false}
                animate={{ width: `${item.percent}%` }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
