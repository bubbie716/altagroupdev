import { Card } from "@/components/page-shell";
import type { TransferContact } from "@/lib/bank/backend-types";

const fieldLabel = "type-meta";

const fields = [
  { key: "fromAccount", label: "From account", placeholder: "Alta Checking ••1187" },
  { key: "recipientInstitution", label: "Recipient institution", placeholder: "Meridian Holdings LLP" },
  { key: "recipientName", label: "Recipient name", placeholder: "Treasury Operations" },
  { key: "routingNumber", label: "Routing number", placeholder: "021000021" },
  { key: "accountNumber", label: "Account number", placeholder: "•••• •••• 4821" },
  { key: "settlementNetwork", label: "Settlement network", placeholder: "NCC-Net", value: "NCC-Net" },
  { key: "amount", label: "Amount", placeholder: "ƒ0.00" },
  { key: "memo", label: "Memo", placeholder: "Operating disbursement" },
] as const;

export function TransferFormPreview({
  disabled = false,
  contacts = [],
  defaultFromAccount,
}: {
  disabled?: boolean;
  contacts?: TransferContact[];
  defaultFromAccount?: { accountName: string; accountNumber: string };
}) {
  const fromAccountValue = defaultFromAccount
    ? `${defaultFromAccount.accountName} · ${defaultFromAccount.accountNumber}`
    : undefined;

  return (
    <Card className="mx-auto max-w-2xl space-y-6 !p-6">
      <div className="type-section-title">
        External wire · Coming soon
      </div>
      <p className="mt-2 text-[13px] text-muted-foreground">
        Send to another NCC institution or an external beneficiary once public account addressing is
        available. Instant transfers to your own Alta Terminal account are available above.
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
        {fields.map((f) => {
          const value =
            f.key === "fromAccount"
              ? fromAccountValue
              : "value" in f
                ? f.value
                : undefined;

          return (
          <label key={f.key} className="block">
            <span className={fieldLabel}>{f.label}</span>
            <input
              type="text"
              readOnly
              disabled={disabled}
              value={value}
              placeholder={disabled && !value ? "—" : f.placeholder}
              className="mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground"
            />
          </label>
          );
        })}
      </div>
      <div className="mt-6 rounded-lg border border-border bg-surface-2/50 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
        External institution wires are coming soon. You can save beneficiaries on the Contacts page
        meanwhile. Scheduled and recurring NCC wires are not enabled in this release.
      </div>
      <button
        type="button"
        disabled
        className="mt-4 cursor-not-allowed rounded-md border border-border bg-surface-2 px-5 py-2.5 text-[13px] font-medium text-muted-foreground"
      >
        External wire (coming soon)
      </button>
    </Card>
  );
}
