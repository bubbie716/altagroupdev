"use client";

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, ShieldCheck, UserRound } from "lucide-react";
import { searchInvoiceRecipientsForMerchant } from "@/lib/bank/merchant-invoice.functions";
import type { MerchantInvoiceRecipientOption } from "@/lib/bank/merchant-invoice-types";
import { resolveRecipientSearchStatus } from "@/lib/bank/merchant-invoice-validation";
import { getUiLabInvoiceRecipients } from "@/lib/bank/bank-action-ui-lab";
import { isUiLabMode } from "@/lib/auth/ui-lab";
import { SEARCH_DEBOUNCE_MS } from "@/lib/ui/route-loading";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:border-gold/60 focus-visible:ring-0 focus-visible:shadow-none disabled:cursor-not-allowed disabled:opacity-60 min-h-11";

function recipientIcon(recipient: MerchantInvoiceRecipientOption) {
  return recipient.kind === "company" ? ShieldCheck : UserRound;
}

function recipientSubtitle(recipient: MerchantInvoiceRecipientOption): string {
  if (recipient.kind === "company") {
    return recipient.subtitle || "Verified company";
  }
  return recipient.subtitle ? `@${recipient.subtitle.replace(/^@/, "")}` : "";
}

function RecipientRowContent({ recipient }: { recipient: MerchantInvoiceRecipientOption }) {
  const Icon = recipientIcon(recipient);
  return (
    <>
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="font-medium">{recipient.displayName}</span>
        {recipientSubtitle(recipient) ? (
          <span className="mt-0.5 block text-[12px] text-muted-foreground">
            {recipientSubtitle(recipient)}
          </span>
        ) : null}
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {recipient.canReceive
            ? recipient.destinationLabel
            : "Unavailable — no active Alta Bank account"}
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
  onUnavailableSelect,
}: {
  companyId: string;
  selectedRecipient: MerchantInvoiceRecipientOption | null;
  onSelectedRecipientChange: (recipient: MerchantInvoiceRecipientOption | null) => void;
  disabled?: boolean;
  initialQuery?: string;
  /** Called when the user tries to select a recipient that cannot receive invoices. */
  onUnavailableSelect?: (recipient: MerchantInvoiceRecipientOption) => void;
}) {
  const searchRecipients = useServerFn(searchInvoiceRecipientsForMerchant);
  const [query, setQuery] = useState(initialQuery);
  const [recipients, setRecipients] = useState<MerchantInvoiceRecipientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setRecipients([]);
      setLoading(false);
      setSearchError(false);
      return;
    }
    if (selectedRecipient && trimmed === selectedRecipient.displayName) {
      setRecipients([]);
      setLoading(false);
      setSearchError(false);
      return;
    }

    setLoading(true);
    setSearchError(false);
    const timer = setTimeout(() => {
      if (isUiLabMode()) {
        setRecipients(getUiLabInvoiceRecipients(trimmed));
        setLoading(false);
        setSearchError(false);
        return;
      }
      void searchRecipients({ data: { query: trimmed, companyId } })
        .then((rows) => {
          setRecipients(rows);
          setSearchError(false);
        })
        .catch(() => {
          setRecipients([]);
          setSearchError(true);
        })
        .finally(() => setLoading(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, searchRecipients, companyId, selectedRecipient]);

  const status = resolveRecipientSearchStatus({
    query,
    loading,
    searchError,
    results: recipients,
    selected: selectedRecipient,
  });

  function clearSelection() {
    onSelectedRecipientChange(null);
    setQuery("");
    setRecipients([]);
    setSearchError(false);
  }

  return (
    <div>
      <span className={fieldLabel}>Recipient</span>
      {selectedRecipient ? (
        <div className="mt-2 rounded-lg border border-border bg-surface-2/40 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3 text-sm">
              <RecipientRowContent recipient={selectedRecipient} />
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={clearSelection}
              className="shrink-0 rounded-md px-2 py-1 text-[12px] font-medium text-muted-foreground hover:bg-[var(--menu-item-hover)] hover:text-foreground disabled:opacity-50"
            >
              Change
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={`${inputClass} pl-9`}
              value={query}
              disabled={disabled}
              onChange={(e) => {
                setQuery(e.target.value);
                onSelectedRecipientChange(null);
              }}
              placeholder="Search people or verified companies"
              aria-label="Search invoice recipients"
              autoComplete="off"
            />
          </div>
          {status === "loading" ? (
            <p className="mt-2 text-[12px] text-muted-foreground" aria-live="polite">
              Searching…
            </p>
          ) : null}
          {status === "no-results" ? (
            <p className="mt-2 text-[13px] text-muted-foreground" role="status">
              No matching people or verified companies.
            </p>
          ) : null}
          {status === "search-error" ? (
            <p className="mt-2 text-[13px] text-destructive" role="alert">
              Could not search recipients. Check your connection and try again.
            </p>
          ) : null}
          {status === "results" ? (
            <ul
              className="mt-2 overflow-hidden rounded-md border border-border bg-[var(--menu-surface)] shadow-md"
              role="listbox"
              aria-label="Recipient results"
            >
              {recipients.map((recipient) => (
                <li key={`${recipient.kind}:${recipient.id}`}>
                  <button
                    type="button"
                    role="option"
                    aria-disabled={!recipient.canReceive}
                    disabled={disabled}
                    onClick={() => {
                      if (!recipient.canReceive) {
                        onUnavailableSelect?.(recipient);
                        return;
                      }
                      onSelectedRecipientChange(recipient);
                      setQuery(recipient.displayName);
                      setRecipients([]);
                    }}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-[var(--menu-item-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RecipientRowContent recipient={recipient} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}
