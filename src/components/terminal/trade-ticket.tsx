import { Card } from "@/components/page-shell";
import { florin, getTradeDefaults } from "@/lib/terminal/api";

export function TradeTicket({ disabled = false }: { disabled?: boolean }) {
  const t = disabled ? null : getTradeDefaults();
  const cost = t ? t.quantity * t.estimatedPrice : 0;

  const fields = disabled
    ? [
        { label: "Ticker", placeholder: "Enter symbol" },
        { label: "Side", placeholder: "—" },
        { label: "Order type", placeholder: "—" },
        { label: "Quantity", placeholder: "—" },
        { label: "Estimated price", placeholder: "—" },
        { label: "Estimated cost", placeholder: "—" },
        { label: "Available cash", placeholder: "—" },
      ]
    : [
        { label: "Ticker", value: t!.ticker, placeholder: "Enter symbol" },
        { label: "Side", value: t!.side },
        { label: "Order type", value: t!.orderType },
        { label: "Quantity", value: String(t!.quantity) },
        { label: "Estimated price", value: florin(t!.estimatedPrice) },
        { label: "Estimated cost", value: florin(cost) },
        { label: "Available cash", value: florin(t!.availableCash) },
      ];

  return (
    <Card>
      <div className="type-section-title">
        Order Ticket
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {fields.map((f) => (
          <label key={f.label} className="block">
            <span className="type-meta">
              {f.label}
            </span>
            <input
              type="text"
              readOnly
              disabled={disabled}
              defaultValue={"value" in f ? f.value : undefined}
              placeholder={"placeholder" in f ? f.placeholder : undefined}
              className="mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground shadow-none"
            />
          </label>
        ))}
      </div>
      <div className="mt-6 rounded-lg border border-border bg-surface-2/50 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
        {disabled
          ? "Trading will become available after account and exchange access are enabled."
          : "Order entry is simulated in this preview. No trades are executed."}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-md border border-border bg-surface-2 px-5 py-2.5 text-[13px] font-medium text-muted-foreground"
        >
          {disabled ? "Review Order (unavailable)" : "Review Order (preview only)"}
        </button>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-md bg-foreground/40 px-5 py-2.5 text-[13px] font-medium text-background/70"
        >
          {disabled ? "Submit Order (unavailable)" : "Submit Order (preview only)"}
        </button>
      </div>
    </Card>
  );
}
