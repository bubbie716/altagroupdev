"use client";

import { useEffect, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Section } from "@/components/page-shell";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { LendingApplyWorkflow } from "@/components/bank/lending-apply-workflow";
import { RouteButton } from "@/components/bank/route-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getLendingProducts } from "@/lib/bank/api";
import { fetchLendingFormContext } from "@/lib/bank/lending.functions";
import type { LoanProductTypeCode } from "@/lib/bank/lending-types";
import { lendingProductNameToCode } from "@/lib/bank/lending-wizard-validation";
import type { LendingProduct } from "@/lib/bank/types";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSiteContext } from "@/hooks/use-site-context";
import { buildSignInSearch, resolveSiteSignInPath } from "@/lib/site/site-sign-in-path";
import { useCreditDeskCustomerNav } from "@/hooks/use-credit-desk-nav";
import { closeThenRun } from "@/lib/ui/close-then-run";

type LendingOverviewSearch = {
  apply?: "1";
  product?: LoanProductTypeCode;
};

export const Route = createFileRoute("/bank/lending/")({
  validateSearch: (search: Record<string, unknown>): LendingOverviewSearch => {
    const next: LendingOverviewSearch = {};
    if (search.apply === "1" || search.apply === 1) next.apply = "1";
    const product = search.product;
    if (product === "personal_credit_line" || product === "business_credit_line") {
      next.product = product;
    }
    return next;
  },
  component: BankLendingOverview,
  head: () => ({
    meta: [{ title: "Alta Bank Lending — Alta Group" }],
  }),
});

const applyButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background transition-opacity hover:opacity-90";

const navButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface-2/50 px-4 py-2 text-[13px] font-medium transition-colors hover:border-border-strong";

function ApplyFromProductDetails({
  product,
  onRequestCloseDetails,
  className,
}: {
  product: LendingProduct;
  onRequestCloseDetails: () => void;
  className?: string;
}) {
  const user = useCurrentUser();
  const site = useSiteContext();
  const router = useRouter();
  const productCode = lendingProductNameToCode(product.name);

  if (!user) {
    return (
      <RouteButton
        to={resolveSiteSignInPath(site.key)}
        search={buildSignInSearch(
          site.key,
          productCode ? `/bank/lending?apply=1&product=${productCode}` : "/bank/lending?apply=1",
        )}
        className={className ?? applyButtonClass}
      >
        Sign in to apply
      </RouteButton>
    );
  }

  return (
    <Button
      type="button"
      variant="default"
      className={className ?? `${applyButtonClass} w-full`}
      onClick={() => {
        closeThenRun(onRequestCloseDetails, () => {
          void router.navigate({
            to: "/bank/lending",
            search: productCode ? { apply: "1", product: productCode } : { apply: "1" },
          });
        });
      }}
    >
      Apply
    </Button>
  );
}

function ProductApplyLink({
  productCode,
  className,
  ariaLabel,
}: {
  productCode?: LoanProductTypeCode;
  className?: string;
  ariaLabel?: string;
}) {
  const user = useCurrentUser();
  const site = useSiteContext();
  const label = "Apply";
  const accessibleName =
    ariaLabel ??
    (productCode === "business_credit_line"
      ? "Apply for Business Credit Line"
      : productCode === "personal_credit_line"
        ? "Apply for Personal Credit Line"
        : "Apply for credit");

  if (!user) {
    return (
      <RouteButton
        to={resolveSiteSignInPath(site.key)}
        search={buildSignInSearch(
          site.key,
          productCode ? `/bank/lending?apply=1&product=${productCode}` : "/bank/lending?apply=1",
        )}
        className={className}
        aria-label={accessibleName}
      >
        {label}
      </RouteButton>
    );
  }

  return (
    <Link
      to="/bank/lending"
      search={productCode ? { apply: "1", product: productCode } : { apply: "1" }}
      className={className}
      aria-label={accessibleName}
    >
      {label}
    </Link>
  );
}

function BankLendingOverview() {
  const router = useRouter();
  const user = useCurrentUser();
  const lendingProducts = getLendingProducts();
  const creditDeskNav = useCreditDeskCustomerNav();
  const { apply, product } = Route.useSearch();
  const showApply = creditDeskNav.showApplyEntryPoints;
  const showApplyWorkflow = showApply && apply === "1" && Boolean(user);
  const [activeProduct, setActiveProduct] = useState<LendingProduct | null>(null);
  const fetchFormContext = useServerFn(fetchLendingFormContext);
  const [formContext, setFormContext] = useState<Awaited<ReturnType<typeof fetchLendingFormContext>> | null>(
    null,
  );

  useEffect(() => {
    if (!showApplyWorkflow) {
      setFormContext(null);
      return;
    }
    let cancelled = false;
    void fetchFormContext()
      .then((context) => {
        if (!cancelled) setFormContext(context);
      })
      .catch(() => {
        if (!cancelled) setFormContext(null);
      });
    return () => {
      cancelled = true;
    };
  }, [showApplyWorkflow, fetchFormContext]);

  function closeApplyWorkflow() {
    void router.navigate({
      to: "/bank/lending",
      search: (prev) => {
        const { apply: _apply, product: _product, ...rest } = prev;
        return rest;
      },
      replace: true,
    });
  }

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank · Lending"
        title="Lending"
        description="Personal and business credit lines for Alta Bank clients. Apply from a product below."
        action={
          <>
            <Link to="/bank/lending/loans" className={navButtonClass}>
              My Loans
            </Link>
            <Link to="/bank/lending/applications" className={navButtonClass}>
              My Applications
            </Link>
          </>
        }
      />

      <Section
        title="Credit products"
        action={
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {lendingProducts.length} products
          </span>
        }
      >
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-1">
          {lendingProducts.map((productItem) => {
            const productCode = lendingProductNameToCode(productItem.name);
            return (
              <li key={productItem.name} className="px-4 py-3.5">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{productItem.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {productItem.limit} · {productItem.rate}
                    </p>
                  </div>
                  <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setActiveProduct(productItem)}
                      aria-label={`Details for ${productItem.name}`}
                      className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-md border border-border bg-surface-2/50 px-3 py-1.5 text-[12px] font-medium transition-colors hover:border-border-strong sm:flex-none sm:px-3"
                    >
                      Details
                    </button>
                    {showApply ? (
                      <ProductApplyLink
                        productCode={productCode}
                        ariaLabel={`Apply for ${productItem.name}`}
                        className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-md bg-foreground px-3 py-1.5 text-[12px] font-medium text-background transition-opacity hover:opacity-90 sm:flex-none"
                      />
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

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
              <DialogDescription>{activeProduct.summary}</DialogDescription>
            </DialogHeader>

            <dl className="grid gap-3 sm:grid-cols-2">
              <Spec label="Maximum" value={activeProduct.limit} />
              <Spec label="Rate" value={activeProduct.rate} />
              <div className="sm:col-span-2">
                <Spec
                  label="Typical repayment term"
                  value={
                    activeProduct.repayment.replace(/^Typical term:\s*/i, "").replace(/\.$/, "") +
                    ". Final terms are determined during underwriting."
                  }
                />
              </div>
            </dl>

            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Rates and terms are indicative and subject to review. Alta may request additional
              information before making a decision.
            </p>

            {showApply ? (
              <ApplyFromProductDetails
                product={activeProduct}
                onRequestCloseDetails={() => setActiveProduct(null)}
                className={`${applyButtonClass} w-full`}
              />
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}

      {showApplyWorkflow && formContext ? (
        <LendingApplyWorkflow
          open
          accounts={formContext.accounts}
          companies={formContext.companies}
          initialProduct={product}
          onOpenChange={(open) => {
            if (!open) closeApplyWorkflow();
          }}
          onDone={closeApplyWorkflow}
        />
      ) : null}
    </>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="type-meta">{label}</dt>
      <dd className="mt-1 font-mono text-[14px] tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
