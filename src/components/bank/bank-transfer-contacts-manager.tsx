import { useState } from "react";
import { SUBMITTING_COPY } from "@/lib/ui/route-loading";
import { Card } from "@/components/page-shell";
import {
  createIntrabankContactRecord,
  createInterbankContactRecord,
  deleteTransferContactRecord,
} from "@/lib/bank/bank.functions";
import type {
  CreateInterbankTransferContactInput,
  CreateIntrabankTransferContactInput,
  TransferContact,
  TransferContactScopeCode,
} from "@/lib/bank/backend-types";
import { getRoutingNumber } from "@/lib/bank/routing";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";

const ACCOUNT_NUMBER_PATTERN = /^AB-\d{4}-\d{6}$/;

function contactSummary(contact: TransferContact): string {
  if (contact.scope === "interbank") {
    return `${contact.recipientInstitution ?? "—"} · ${contact.recipientName ?? "—"}`;
  }
  return `${contact.resolvedName ?? "Player"} · ${contact.accountNumber ?? "—"}`;
}

export function BankTransferContactsManager({
  scope,
  contacts,
  onChanged,
  compact = false,
}: {
  scope: TransferContactScopeCode;
  contacts: TransferContact[];
  onChanged?: () => void;
  compact?: boolean;
}) {
  const scopedContacts = contacts.filter((contact) => contact.scope === scope);
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {scopedContacts.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          {scope === "intrabank"
            ? "No saved intrabank contacts yet."
            : "No saved wire recipients yet."}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {scopedContacts.map((contact) => (
            <ContactRow key={contact.id} contact={contact} onChanged={onChanged} />
          ))}
        </ul>
      )}

      {showAddForm ? (
        scope === "intrabank" ? (
          <AddIntrabankContactForm
            onCancel={() => setShowAddForm(false)}
            onSuccess={() => {
              setShowAddForm(false);
              onChanged?.();
            }}
          />
        ) : (
          <AddInterbankContactForm
            onCancel={() => setShowAddForm(false)}
            onSuccess={() => {
              setShowAddForm(false);
              onChanged?.();
            }}
          />
        )
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="rounded-md border border-border px-4 py-2 text-[12px] font-medium hover:border-border-strong"
        >
          Add contact
        </button>
      )}
    </div>
  );
}

function ContactRow({
  contact,
  onChanged,
}: {
  contact: TransferContact;
  onChanged?: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteTransferContactRecord({ data: contact.id });
      onChanged?.();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <li className="flex items-start justify-between gap-4 px-4 py-3">
      <div>
        <p className="text-[14px] font-medium">{contact.label}</p>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{contactSummary(contact)}</p>
      </div>
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={deleting}
        className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-destructive disabled:opacity-50"
      >
        {deleting ? "…" : "Remove"}
      </button>
    </li>
  );
}

export function TransferContactPicker({
  contacts,
  scope = "intrabank",
  onSelect,
}: {
  contacts: TransferContact[];
  scope?: TransferContactScopeCode;
  onSelect: (contact: TransferContact) => void;
}) {
  const matching = contacts.filter((contact) => {
    if (contact.scope !== scope) return false;
    if (scope === "intrabank") return !!contact.accountNumber;
    return true;
  });

  if (matching.length === 0) return null;

  return (
    <div>
      <span className={fieldLabel}>Saved contacts</span>
      <div className="mt-2 flex flex-wrap gap-2">
        {matching.map((contact) => (
          <button
            key={contact.id}
            type="button"
            onClick={() => onSelect(contact)}
            className="rounded-md border border-border bg-surface-2/40 px-3 py-1.5 text-left text-[12px] transition-colors hover:border-border-strong hover:bg-surface-2"
          >
            <span className="font-medium">{contact.label}</span>
            <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
              {scope === "intrabank"
                ? contact.accountNumber
                : `${contact.recipientInstitution ?? "—"} · ${contact.routingNumber ?? "—"}`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AddIntrabankContactForm({
  onCancel,
  onSuccess,
}: {
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [recipientName, setRecipientName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const input: CreateIntrabankTransferContactInput = {
        recipientName,
        accountNumber: accountNumber.trim().toUpperCase(),
      };
      await createIntrabankContactRecord({ data: input });
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Unable to save contact.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const normalizedAccountNumber = accountNumber.trim().toUpperCase();

  return (
    <Card className="!p-5">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className={fieldLabel}>Recipient name</span>
          <input
            required
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="e.g. John Smith"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={fieldLabel}>Account number</span>
          <input
            required
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="AB-2000-482913"
            className={`${inputClass} font-mono uppercase`}
          />
        </label>

        {error && <p className="text-[12px] text-destructive">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={
              submitting || !ACCOUNT_NUMBER_PATTERN.test(normalizedAccountNumber)
            }
            className="rounded-md bg-foreground px-4 py-2 text-[12px] font-medium text-background disabled:opacity-50"
          >
            {submitting ? SUBMITTING_COPY.saving : "Save contact"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-2 text-[12px] font-medium"
          >
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}

function AddInterbankContactForm({
  onCancel,
  onSuccess,
}: {
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [recipientInstitution, setRecipientInstitution] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [wireAccountNumber, setWireAccountNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const input: CreateInterbankTransferContactInput = {
        recipientInstitution,
        recipientName,
        routingNumber,
        wireAccountNumber,
      };
      await createInterbankContactRecord({ data: input });
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Unable to save contact.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="!p-5">
      <p className="mb-4 text-[12px] text-muted-foreground">
        Wire recipients can be saved now and used when external interbank wires launch.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className={fieldLabel}>Recipient institution</span>
          <input
            required
            value={recipientInstitution}
            onChange={(e) => setRecipientInstitution(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>Recipient name</span>
          <input
            required
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            className={inputClass}
          />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className={fieldLabel}>Routing number</span>
            <input
              required
              value={routingNumber}
              onChange={(e) => setRoutingNumber(e.target.value)}
              className={`${inputClass} font-mono`}
            />
          </label>
          <label className="block">
            <span className={fieldLabel}>Account number</span>
            <input
              required
              value={wireAccountNumber}
              onChange={(e) => setWireAccountNumber(e.target.value)}
              className={`${inputClass} font-mono`}
            />
          </label>
        </div>
        <label className="block">
          <span className={fieldLabel}>Settlement network</span>
          <input readOnly value="External wire" className={`${inputClass} bg-surface-2/50 text-muted-foreground`} />
        </label>
        <p className="font-mono text-[10px] text-muted-foreground">
          Alta routing for reference: {getRoutingNumber()}
        </p>
        {error && <p className="text-[12px] text-destructive">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-foreground px-4 py-2 text-[12px] font-medium text-background disabled:opacity-50"
          >
            {submitting ? SUBMITTING_COPY.saving : "Save contact"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-2 text-[12px] font-medium"
          >
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
