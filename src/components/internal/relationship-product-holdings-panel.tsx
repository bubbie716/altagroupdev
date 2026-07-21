import type { ProductHoldingsDetail } from "@/lib/bank/relationship-intelligence-types";
import { ALTA_CARD_TIER_LABELS } from "@/lib/bank/alta-card-types";
import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";

export function RelationshipProductHoldingsPanel({
  holdings,
}: {
  holdings: ProductHoldingsDetail;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface-1/80 p-5">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Product holdings
      </h3>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-[14px]">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Bank accounts</dt>
          <dd className="mt-1">
            {holdings.bankAccountsActive} active · {holdings.bankAccountsTotal} total
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Alta Card</dt>
          <dd className="mt-1">
            {holdings.altaCardTier
              ? `${ALTA_CARD_TIER_LABELS[holdings.altaCardTier as AltaCardTierCode]} · ${holdings.altaCardStatus ?? "—"}`
              : "None"}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Business cards</dt>
          <dd className="mt-1">{holdings.businessCardCount}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Active loans</dt>
          <dd className="mt-1">{holdings.activeLoans}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Paid-off loans</dt>
          <dd className="mt-1">{holdings.paidOffLoans}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Companies</dt>
          <dd className="mt-1">
            {holdings.companyMemberships} · {holdings.verifiedCompanies} verified
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Alta Private</dt>
          <dd className="mt-1">{holdings.isPrivateClient ? "Client" : "Not enrolled"}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Alta Terminal</dt>
          <dd className="mt-1 text-muted-foreground">Brokerage · holdings unavailable</dd>
        </div>
      </dl>
    </section>
  );
}
