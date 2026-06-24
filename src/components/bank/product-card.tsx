import { Card } from "@/components/page-shell";
import type { BankProduct } from "@/lib/bank/api";
import { cn } from "@/lib/utils";

export function ProductCard({ product }: { product: BankProduct }) {
  const isPrivate = product.isPrivate ?? product.category === "Alta Private";

  return (
    <Card className={cn(isPrivate && "border-gold/25 bg-surface-1")}>
      <div className="type-meta-accent">{product.name}</div>
      {isPrivate && (
        <span className="mt-2 inline-flex rounded-full border border-gold/30 px-2 py-0.5 type-meta-sm text-gold">
          Invitation only
        </span>
      )}
      <div className="mt-2 type-meta-sm">
        {product.category}
      </div>
      <p className={cn("mt-3 type-body-sm text-muted-foreground")}>{product.positioning}</p>
      <div className="mt-4 grid gap-3 text-sm">
        <div>
          <div className="type-meta-sm">Best for</div>
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
        <div className="type-meta">
          Availability · {product.availability}
        </div>
      </div>
    </Card>
  );
}
