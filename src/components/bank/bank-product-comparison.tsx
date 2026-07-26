"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BankActionLauncher } from "@/components/bank/actions/bank-action-launcher";
import { useBankActionLauncher } from "@/components/bank/actions/use-bank-action-launcher";
import { RouteButton } from "@/components/bank/route-button";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSiteContext } from "@/hooks/use-site-context";
import { buildSignInSearch, resolveSiteSignInPath } from "@/lib/site/site-sign-in-path";
import type { BankProduct } from "@/lib/bank/api";
import { resolveBankAccountTypeFromProductName } from "@/lib/bank/bank-product-account-type";
import { closeThenRun } from "@/lib/ui/close-then-run";
import { cn } from "@/lib/utils";

function OpenAccountAction({
  className,
  accountType,
}: {
  className?: string;
  accountType?: ReturnType<typeof resolveBankAccountTypeFromProductName>;
}) {
  const user = useCurrentUser();
  const site = useSiteContext();

  if (!user) {
    return (
      <RouteButton
        to={resolveSiteSignInPath(site.key)}
        search={buildSignInSearch(site.key, "/bank/open")}
        className={cn(
          "inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background hover:opacity-90",
          className,
        )}
      >
        Sign in to open
      </RouteButton>
    );
  }

  return (
    <BankActionLauncher
      action="open-account"
      accountType={accountType}
      variant="default"
      className={className}
    >
      Open an account
    </BankActionLauncher>
  );
}

/**
 * Product-details CTA that closes the details dialog (full unmount) before
 * launching open-account — never stacks two Bank dialogs/backdrops.
 */
function OpenAccountFromProductDetails({
  product,
  onRequestCloseDetails,
  className,
}: {
  product: BankProduct;
  onRequestCloseDetails: () => void;
  className?: string;
}) {
  const user = useCurrentUser();
  const site = useSiteContext();
  const { openAction } = useBankActionLauncher();
  const accountType = resolveBankAccountTypeFromProductName(product.name);

  if (!user) {
    return (
      <RouteButton
        to={resolveSiteSignInPath(site.key)}
        search={buildSignInSearch(site.key, "/bank/open")}
        className={cn(
          "inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background hover:opacity-90",
          className,
        )}
      >
        Sign in to open
      </RouteButton>
    );
  }

  return (
    <Button
      type="button"
      variant="default"
      size="sm"
      className={cn("h-10 min-w-11 gap-1.5 px-3 text-[13px] font-medium", className)}
      onClick={(event) => {
        const fromElement = event.currentTarget;
        // Conditional Dialog unmount (activeProduct → null) removes the portal
        // immediately — no exit-animation double-scrim with the Bank action.
        closeThenRun(onRequestCloseDetails, () => {
          openAction("open-account", { accountType }, { fromElement });
        });
      }}
    >
      Open an account
    </Button>
  );
}

/** Compact comparison list — one row per product, full detail in a dialog. */
export function BankProductComparisonList({ products }: { products: BankProduct[] }) {
  const [activeProduct, setActiveProduct] = useState<BankProduct | null>(null);

  return (
    <>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-1">
        {products.map((product) => (
          <li
            key={product.name}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:flex-nowrap"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium">{product.name}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                {product.positioning}
              </p>
            </div>
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {product.availability}
            </span>
            <button
              type="button"
              onClick={() => setActiveProduct(product)}
              className="min-h-11 shrink-0 rounded-md border border-border bg-surface-2/50 px-3 py-1.5 text-[12px] font-medium transition-colors hover:border-border-strong"
            >
              Details
            </button>
          </li>
        ))}
      </ul>

      {/*
        Mount Dialog only while a product is selected so closing fully unmounts
        the portal (no stacked exit animation under the Bank action sheet).
      */}
      {activeProduct ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setActiveProduct(null);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{activeProduct.name}</DialogTitle>
              <DialogDescription>{activeProduct.positioning}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              <div>
                <div className="type-meta">Best for</div>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  {activeProduct.bestFor}
                </p>
              </div>
              <ul className="space-y-1.5 border-t border-border/60 pt-3">
                {activeProduct.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-2 text-[13px] text-foreground/90">
                    <span className="h-px w-3 shrink-0 bg-gold/70" aria-hidden />
                    {benefit}
                  </li>
                ))}
              </ul>
              <div className="type-meta">Availability · {activeProduct.availability}</div>
            </div>

            <OpenAccountFromProductDetails
              product={activeProduct}
              onRequestCloseDetails={() => setActiveProduct(null)}
              className="w-full"
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

export { OpenAccountAction as BankOpenAccountAction };
