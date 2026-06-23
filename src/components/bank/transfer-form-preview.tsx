import { Card } from "@/components/page-shell";
import type { TransferContact } from "@/lib/bank/backend-types";

const fieldLabel = "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground";

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

export function TransferFormPreview({
  disabled = false,
  contacts = [],
}: {
  disabled?: boolean;
  contacts?: TransferContact[];
}) {
  return (
    <Card>
      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        Wire Transfer · NCC-Net
      </div>
      <p className="mt-2 text-[13px] text-muted-foreground">
        Outbound wires route through NCC-Net settlement infrastructure — planned clearing network for
        Newport interbank transfers.
      </p>

      {contacts.length > 0 && (
        <div className="mt-6">
          <span className={fieldLabel}>Saved contacts</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="rounded-md border border-border bg-surface-2/40 px-3 py-1.5 text-[12px] text-muted-foreground"
              >
                <span className="font-medium text-foreground">{contact.label}</span>
                <span className="mt-0.5 block font-mono text-[10px]">
                  {contact.recipientInstitution} · {contact.routingNumber}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Contacts will prefill this form when wires launch.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {fields.map((f) => (
          <label key={f.label} className="block">
            <span className={fieldLabel}>{f.label}</span>
            <input
              type="text"
              readOnly
              disabled={disabled}
              value={disabled ? undefined : f.value}
              placeholder={disabled ? "—" : f.placeholder}
              className="mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground"
            />
          </label>
        ))}
      </div>
      {disabled ? (
        <div className="mt-6 rounded-lg border border-border bg-surface-2/50 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
          Wire transfers are not available yet. Manage wire recipients on the Contacts page.
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
          Wire execution is simulated in this preview. NCC-Net settlement is planned infrastructure.
        </div>
      )}
      <button
        type="button"
        disabled
        className="mt-4 cursor-not-allowed rounded-md border border-border bg-surface-2 px-5 py-2.5 text-[13px] font-medium text-muted-foreground"
      >
        {disabled ? "Submit wire (unavailable)" : "Submit wire (preview only)"}
      </button>
    </Card>
  );
}
