import { Florin } from "@/components/ui/florin";
import { formatInterestRateLabel } from "@/lib/bank/loan-interest";
import type { DealRoomOfferRow } from "@/lib/bank/deal-room-types";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<DealRoomOfferRow["status"], string> = {
  draft: "border-border bg-surface-2 text-muted-foreground",
  sent: "border-gold/30 bg-gold/10 text-gold",
  accepted: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  withdrawn: "border-border bg-surface-1 text-muted-foreground",
  expired: "border-border bg-surface-1 text-muted-foreground",
};

export function DealOfferTimeline({ offers }: { offers: DealRoomOfferRow[] }) {
  if (offers.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        No formal offers or counter-offers have been submitted yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {offers.map((offer) => (
        <OfferCard key={offer.id} offer={offer} />
      ))}
    </div>
  );
}

function OfferCard({ offer }: { offer: DealRoomOfferRow }) {
  return (
    <article
      className={cn(
        "rounded-lg border border-border/70 bg-surface-2/20 p-4",
        offer.isActive && "ring-1 ring-gold/20",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {offer.offerTypeLabel}
          </div>
          <div className="mt-0.5 text-[13px]">
            {offer.createdByName}
            <span className="mx-1.5 text-muted-foreground">·</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {formatActivityDateTime(offer.createdAt)}
            </span>
          </div>
        </div>
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]",
            STATUS_TONE[offer.status],
          )}
        >
          {offer.statusLabel}
        </span>
      </header>

      <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-[13px]">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Principal
          </dt>
          <dd className="mt-0.5 tabular font-medium">
            <Florin value={offer.proposedPrincipal} fractionDigits={0} />
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Rate
          </dt>
          <dd className="mt-0.5 tabular font-mono font-medium">
            {formatInterestRateLabel(offer.proposedInterestRate)}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Term
          </dt>
          <dd className="mt-0.5 tabular font-mono font-medium">{offer.proposedTermMonths} mo</dd>
        </div>
        {offer.proposedMinimumPayment != null && (
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Min payment
            </dt>
            <dd className="mt-0.5 tabular font-medium">
              <Florin value={offer.proposedMinimumPayment} fractionDigits={0} />
            </dd>
          </div>
        )}
      </dl>

      {(offer.collateralDescription || offer.specialConditions) && (
        <div className="mt-3 space-y-2 border-t border-border/50 pt-3 text-[12px] leading-relaxed text-muted-foreground">
          {offer.collateralDescription && (
            <p>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/70">
                Collateral
              </span>
              <br />
              {offer.collateralDescription}
            </p>
          )}
          {offer.specialConditions && (
            <p>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/70">
                Special conditions
              </span>
              <br />
              {offer.specialConditions}
            </p>
          )}
        </div>
      )}

      {offer.rejectionNote && (
        <p className="mt-2 text-[12px] text-destructive/90">Rejection note: {offer.rejectionNote}</p>
      )}
    </article>
  );
}
