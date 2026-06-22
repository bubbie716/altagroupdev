import { Card } from "@/components/page-shell";
import { florin, getTradeDefaults } from "@/lib/terminal/api";

export function TradeTicket() {
  const t = getTradeDefaults();
  const cost = t.quantity * t.estimatedPrice;

  return (
    <Card>
      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        Order Ticket
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {[
          { label: "Ticker", value: t.ticker, placeholder: "Enter symbol" },
          { label: "Side", value: t.side },
          { label: "Order type", value: t.orderType },
          { label: "Quantity", value: String(t.quantity) },
          { label: "Estimated price", value: florin(t.estimatedPrice) },
          { label: "Estimated cost", value: florin(cost) },
          { label: "Available cash", value: florin(t.availableCash) },
        ].map((f) => (
          <label key={f.label} className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {f.label}
            </span>
            <input
              type="text"
              readOnly
              defaultValue={f.value}
              placeholder={"placeholder" in f ? f.placeholder : undefined}
              className="mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground shadow-none"
            />
          </label>
        ))}
      </div>
      <div className="mt-6 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
        Order entry is simulated in this preview. No trades are executed.
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-md border border-border bg-surface-2 px-5 py-2.5 text-[13px] font-medium text-muted-foreground"
        >
          Review Order (preview only)
        </button>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-md bg-foreground/40 px-5 py-2.5 text-[13px] font-medium text-background/70"
        >
          Submit Order (preview only)
        </button>
      </div>
    </Card>
  );
}
