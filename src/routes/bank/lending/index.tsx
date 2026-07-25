"use client";

import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { RouteButton } from "@/components/bank/route-button";
import { BankStatStrip } from "@/components/bank/bank-stat-strip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getLendingProducts } from "@/lib/bank/api";
import { fetchLendingDeskStats } from "@/lib/bank/lending.functions";
import { formatLendingAvgResponse } from "@/lib/bank/lending-types";
import type { LendingProduct } from "@/lib/bank/types";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSiteContext } from "@/hooks/use-site-context";
import { buildSignInSearch, resolveSiteSignInPath } from "@/lib/site/site-sign-in-path";
import { useCreditDeskCustomerNav } from "@/hooks/use-credit-desk-nav";

export const Route = createFileRoute("/bank/lending/")({
  loader: () => fetchLendingDeskStats(),
  head: () => ({
    meta: [{ title: "Alta Bank Lending — Alta Group" }],
  }),
  component: BankLendingOverview,
});

const applyButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background transition-opacity hover:opacity-90";

function ApplyAction({ className }: { className?: string }) {
  const user = useCurrentUser();
  const site = useSiteContext();

  if (!user) {
    return (
      <RouteButton
        to={resolveSiteSignInPath(site.key)}
        search={buildSignInSearch(site.key, "/bank/lending/apply")}
        className={className ?? applyButtonClass}
      >
        Sign in to apply
      </RouteButton>
    );
  }

  return (
    <Link to="/bank/lending/apply" className={className ?? applyButtonClass}>
      Apply for credit
    </Link>
  );
}

function BankLendingOverview() {
  const lendingProducts = getLendingProducts();
  const creditDeskNav = useCreditDeskCustomerNav();
  const deskStats = Route.useLoaderData();
  const showApply = creditDeskNav.showApplyEntryPoints;
  const [activeProduct, setActiveProduct] = useState<LendingProduct | null>(null);

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank · Credit Desk"
        title="Lending"
        description="Manually underwritten credit facilities. Every application is reviewed in your Secure Deal Room."
        action={
          showApply ? (
            <>
              <ApplyAction />
              <Link
                to="/bank/lending/applications"
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface-2/50 px-4 py-2 text-[13px] font-medium transition-colors hover:border-border-strong"
              >
                My applications
              </Link>
            </>
          ) : undefined
        }
      />

      {showApply ? (
        <BankStatStrip
          density="compact"
          items={[
            { label: "Review team", value: String(deskStats.officersOnDesk) },
            { label: "Avg. response", value: formatLendingAvgResponse(deskStats.avgResponseHours) },
            { label: "Active facilities", value: String(deskStats.activeFacilities) },
            { label: "In review", value: String(deskStats.pendingReview) },
          ]}
        />
      ) : null}

      <Section
        title="Credit products"
        className={showApply ? "mt-8" : undefined}
        action={
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {lendingProducts.length} facilities
          </span>
        }
      >
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-1">
          {lendingProducts.map((product) => (
            <li key={product.name} className="px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:flex-nowrap">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{product.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {product.limit} · {product.rate}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveProduct(product)}
                  className="min-h-11 shrink-0 rounded-md border border-border bg-surface-2/50 px-3 py-1.5 text-[12px] font-medium transition-colors hover:border-border-strong"
                >
                  Details
                </button>
                {showApply ? (
                  <Link
                    to="/bank/lending/apply"
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-foreground px-3 py-1.5 text-[12px] font-medium text-background transition-opacity hover:opacity-90"
                  >
                    Apply
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Dialog
        open={activeProduct !== null}
        onOpenChange={(open) => {
          if (!open) setActiveProduct(null);
        }}
      >
        <DialogContent className="max-w-md">
          {activeProduct ? (
            <>
              <DialogHeader>
                <DialogTitle>{activeProduct.name}</DialogTitle>
                <DialogDescription>{activeProduct.summary}</DialogDescription>
              </DialogHeader>

              <dl className="grid gap-3 sm:grid-cols-2">
                <Spec label="Limit" value={activeProduct.limit} />
                <Spec label="Rate" value={activeProduct.rate} />
                <div className="sm:col-span-2">
                  <Spec label="Repayment" value={activeProduct.repayment} />
                </div>
              </dl>

              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Interest accrues monthly on outstanding balances. Applications are reviewed manually
                by Alta Bank credit operations, with updates delivered in your Secure Deal Room.
              </p>

              {showApply ? <ApplyAction className={`${applyButtonClass} w-full`} /> : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
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
