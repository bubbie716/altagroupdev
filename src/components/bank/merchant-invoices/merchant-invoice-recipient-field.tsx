"use client";

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, ShieldCheck, UserRound } from "lucide-react";
import { searchInvoiceRecipientsForMerchant } from "@/lib/bank/merchant-invoice.functions";
import type { MerchantInvoiceRecipientOption } from "@/lib/bank/merchant-invoice-types";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60";

function recipientIcon(recipient: MerchantInvoiceRecipientOption) {
  return recipient.kind === "company" ? ShieldCheck : UserRound;
}

function recipientSubtitle(recipient: MerchantInvoiceRecipientOption): string {
  if (recipient.kind === "company") {
    return recipient.subtitle || "Verified company";
  }
  return recipient.subtitle ? `@${recipient.subtitle}` : "";
}

function RecipientRowContent({ recipient }: { recipient: MerchantInvoiceRecipientOption }) {
  const Icon = recipientIcon(recipient);
  return (
    <>
      <Icon className="mt-0.5 size-4 shrink-0 text-gold" />
      <span className="min-w-0 flex-1">
        <span className="font-medium">{recipient.displayName}</span>
        {recipientSubtitle(recipient) ? (
          <span className="mt-0.5 block text-[12px] text-muted-foreground">
            {recipientSubtitle(recipient)}
          </span>
        ) : null}
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {recipient.destinationLabel}
        </span>
      </span>
    </>
  );
}

export function MerchantInvoiceRecipientField({
  companyId,
  selectedRecipient,
  onSelectedRecipientChange,
  disabled = false,
  initialQuery = "",
}: {
  companyId: string;
  selectedRecipient: MerchantInvoiceRecipientOption | null;
  onSelectedRecipientChange: (recipient: MerchantInvoiceRecipientOption | null) => void;
  disabled?: boolean;
  initialQuery?: string;
}) {
  const searchRecipients = useServerFn(searchInvoiceRecipientsForMerchant);
  const [query, setQuery] = useState(initialQuery);
  const [recipients, setRecipients] = useState<MerchantInvoiceRecipientOption[]>([]);

  useEffect(() => {
    if (query.trim().length < 1) {
      setRecipients([]);
      return;
    }
    if (selectedRecipient && query.trim() === selectedRecipient.displayName) {
      return;
    }
    const timer = setTimeout(() => {
      void searchRecipients({ data: { query: query.trim(), companyId } })
        .then(setRecipients)
        .catch(() => setRecipients([]));
    }, 280);
    return () => clearTimeout(timer);
  }, [query, searchRecipients, companyId, selectedRecipient]);

  return (
    <div>
      <span className={fieldLabel}>Recipient</span>
      <div className="relative mt-2">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          className={`${inputClass} pl-9`}
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            onSelectedRecipientChange(null);
          }}
          placeholder="Customer or company name"
        />
      </div>
      {recipients.length > 0 && !selectedRecipient ? (
        <ul className="mt-2 overflow-hidden rounded-md border border-border">
          {recipients.map((recipient) => (
            <li key={`${recipient.kind}:${recipient.id}`}>
              <button
                type="button"
                disabled={disabled || !recipient.canReceive}
                onClick={() => {
                  if (!recipient.canReceive) return;
                  onSelectedRecipientChange(recipient);
                  setQuery(recipient.displayName);
                }}
                className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-surface-2/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RecipientRowContent recipient={recipient} />
              </button>
            </li>
          ))}
        </ul>
      ) : selectedRecipient ? (
        <ul className="mt-2 overflow-hidden rounded-md border border-border">
          <li className="flex w-full items-start gap-3 border-l-2 border-gold bg-gold/5 px-4 py-3 text-left text-sm">
            <RecipientRowContent recipient={selectedRecipient} />
          </li>
        </ul>
      ) : null}
    </div>
  );
}
