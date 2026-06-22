import { Card } from "@/components/page-shell";

const fields = [
  { label: "From account", placeholder: "Alta Checking ••1187" },
  { label: "Recipient institution", placeholder: "Meridian Holdings LLP" },
  { label: "Recipient name", placeholder: "Treasury Operations" },
  { label: "Routing number", placeholder: "021000021" },
  { label: "Account number", placeholder: "•••• •••• 4821" },
  { label: "Settlement network", placeholder: "NCC-Net", value: "NCC-Net" },
  { label: "Amount", placeholder: "ƒ0.00" },
  { label: "Memo", placeholder: "Operating disbursement" },
];

export function TransferFormPreview() {
  return (
    <Card>
      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        Wire Transfer · NCC-Net
      </div>
      <p className="mt-2 text-[13px] text-muted-foreground">
        Outbound wires route through NCC-Net settlement infrastructure — planned clearing network for
        Newport interbank transfers.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {fields.map((f) => (
          <label key={f.label} className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {f.label}
            </span>
            <input
              type="text"
              readOnly
              value={f.value}
              placeholder={f.placeholder}
              className="mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground"
            />
          </label>
        ))}
      </div>
      <div className="mt-6 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
        Wire execution is simulated in this preview. NCC-Net settlement is planned infrastructure.
      </div>
      <button
        type="button"
        disabled
        className="mt-4 cursor-not-allowed rounded-md border border-border bg-surface-2 px-5 py-2.5 text-[13px] font-medium text-muted-foreground"
      >
        Submit wire (preview only)
      </button>
    </Card>
  );
}
