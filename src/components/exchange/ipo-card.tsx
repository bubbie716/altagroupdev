import { Card } from "@/components/page-shell";
import type { IPOListing } from "@/lib/exchange/types";

export function IPOCard({ ipo }: { ipo: IPOListing }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">{ipo.ticker}</div>
          <h3 className="mt-2 text-lg font-semibold tracking-tight">{ipo.company}</h3>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {ipo.status}
        </span>
      </div>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        {ipo.offeringPrice && (
          <div>
            <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              Offering Price
            </dt>
            <dd className="tabular mt-1 font-medium">{ipo.offeringPrice}</dd>
          </div>
        )}
        {ipo.expectedPrice && (
          <div>
            <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              Expected Price
            </dt>
            <dd className="tabular mt-1 font-medium">{ipo.expectedPrice}</dd>
          </div>
        )}
        {ipo.sharesOffered && (
          <div>
            <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              Shares Offered
            </dt>
            <dd className="tabular mt-1 font-medium">{ipo.sharesOffered}</dd>
          </div>
        )}
        {ipo.raiseSize && (
          <div>
            <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              Raise Size
            </dt>
            <dd className="tabular mt-1 font-medium">{ipo.raiseSize}</dd>
          </div>
        )}
        {ipo.listingPrice && (
          <div>
            <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              Listing Price
            </dt>
            <dd className="tabular mt-1 font-medium">{ipo.listingPrice}</dd>
          </div>
        )}
        {ipo.currentPrice && (
          <div>
            <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              Current Price
            </dt>
            <dd className="tabular mt-1 font-medium">{ipo.currentPrice}</dd>
          </div>
        )}
        {ipo.returnSinceListing && (
          <div>
            <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              Return Since Listing
            </dt>
            <dd className="tabular mt-1 font-medium ticker-up">{ipo.returnSinceListing}</dd>
          </div>
        )}
      </dl>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
        >
          View Prospectus
        </button>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
        >
          Indicate Interest
        </button>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
        >
          View Listing
        </button>
      </div>
    </Card>
  );
}
