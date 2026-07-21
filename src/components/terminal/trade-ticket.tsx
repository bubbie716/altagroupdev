import { Card } from "@/components/page-shell";

const unavailableFields = [
  { label: "Ticker", placeholder: "Enter symbol" },
  { label: "Side", placeholder: "—" },
  { label: "Order type", placeholder: "—" },
  { label: "Quantity", placeholder: "—" },
  { label: "Estimated price", placeholder: "—" },
  { label: "Estimated cost", placeholder: "—" },
  { label: "Available cash", placeholder: "—" },
];

export function TradeTicket({ disabled = true }: { disabled?: boolean }) {
  void disabled;

  return (
    <Card>
      <div className="type-section-title">
        Order Ticket
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {unavailableFields.map((f) => (
          <label key={f.label} className="block">
            <span className="type-meta">
              {f.label}
            </span>
            <input
              type="text"
              readOnly
              disabled
              placeholder={f.placeholder}
              className="mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground shadow-none"
            />
          </label>
        ))}
      </div>
      <div className="mt-6 rounded-lg border border-border bg-surface-2/50 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
        Order entry is not available yet. Trading will open after account and exchange access are
        enabled.
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-md border border-border bg-surface-2 px-5 py-2.5 text-[13px] font-medium text-muted-foreground"
        >
          Review Order (unavailable)
        </button>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-md bg-foreground/40 px-5 py-2.5 text-[13px] font-medium text-background/70"
        >
          Submit Order (unavailable)
        </button>
      </div>
    </Card>
  );
}
