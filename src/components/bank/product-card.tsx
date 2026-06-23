import { Card } from "@/components/page-shell";
import type { BankProduct } from "@/lib/bank/api";
import { cn } from "@/lib/utils";

export function ProductCard({ product }: { product: BankProduct }) {
  const isPrivate = product.isPrivate ?? product.category === "Alta Private";

  return (
    <Card className={cn(isPrivate && "border-gold/25 bg-surface-1")}>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">{product.name}</div>
      {isPrivate && (
        <span className="mt-2 inline-flex rounded-full border border-gold/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-gold">
          Invitation only
        </span>
      )}
      <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
        {product.category}
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{product.positioning}</p>
      <div className="mt-4 grid gap-3 text-sm">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            Minimum balance
          </div>
          <div className="tabular mt-1 font-medium">{product.minimumBalance}</div>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Best for</div>
          <p className="mt-1 leading-relaxed text-muted-foreground">{product.bestFor}</p>
        </div>
        <ul className="space-y-1.5 border-t border-border/60 pt-3">
          {product.benefits.map((b) => (
            <li key={b} className="flex items-center gap-2 text-[13px] text-foreground/90">
              <span className="h-px w-3 bg-gold/70" />
              {b}
            </li>
          ))}
        </ul>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Availability · {product.availability}
        </div>
      </div>
    </Card>
  );
}
