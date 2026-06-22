import { Card } from "@/components/page-shell";
import type { BankProduct } from "@/lib/bank/api";

export function ProductCard({ product }: { product: BankProduct }) {
  return (
    <Card>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">{product.name}</div>
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
          {product.availability}
        </div>
      </div>
    </Card>
  );
}
