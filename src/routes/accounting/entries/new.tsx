"use client";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useTransition } from "react";
import {
  createAccountingEntryFn,
  listAccountingCategoriesFn,
  listAccountingCounterpartiesFn,
} from "@/lib/accounting/accounting.functions";
import { ACCOUNTING_ENTRY_TYPES, ACCOUNTING_PAYMENT_METHODS } from "@/lib/accounting/defaults";
import { florinsToCents } from "@/lib/accounting/format";
import type { AccountingCategoryDto, AccountingCounterpartyDto } from "@/lib/accounting/types";

export const Route = createFileRoute("/accounting/entries/new")({
  component: NewAccountingEntryPage,
});

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function NewAccountingEntryPage() {
  const navigate = useNavigate();
  const listCategories = useServerFn(listAccountingCategoriesFn);
  const listCounterparties = useServerFn(listAccountingCounterpartiesFn);
  const createEntry = useServerFn(createAccountingEntryFn);

  const [categories, setCategories] = useState<AccountingCategoryDto[]>([]);
  const [counterparties, setCounterparties] = useState<AccountingCounterpartyDto[]>([]);
  const [date, setDate] = useState(todayIso());
  const [type, setType] = useState<(typeof ACCOUNTING_ENTRY_TYPES)[number]>("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<(typeof ACCOUNTING_PAYMENT_METHODS)[number]>("bank");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const [cats, cps] = await Promise.all([listCategories(), listCounterparties()]);
        setCategories(cats);
        setCounterparties(cps);
        const matching = cats.filter(
          (c) => c.kind === type || c.kind === "both",
        );
        if (matching[0]) setCategoryId(matching[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load form data");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const matching = categories.filter((c) => c.kind === type || c.kind === "both");
    if (!matching.some((c) => c.id === categoryId)) {
      setCategoryId(matching[0]?.id ?? "");
    }
  }, [type, categories, categoryId]);

  const filteredCategories = categories.filter(
    (c) => c.kind === type || c.kind === "both",
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amountCents = florinsToCents(amount);
    if (amountCents <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    if (!categoryId) {
      setError("Select a category.");
      return;
    }
    startTransition(async () => {
      try {
        await createEntry({
          data: {
            date,
            type,
            amountCents,
            categoryId,
            counterpartyId: counterpartyId || null,
            paymentMethod,
            note: note.trim() || null,
          },
        });
        await navigate({ to: "/accounting" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create entry");
      }
    });
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="font-serif text-2xl tracking-tight">New ledger entry</h2>
        <p className="text-[13px] text-muted-foreground">
          Record income or expense in florins for the selected company.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
          {error}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-border/70 bg-surface-1 p-4">
        <Field label="Date">
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-10 w-full rounded-md border border-border bg-background px-3 text-[13px]"
          />
        </Field>
        <Field label="Type">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="min-h-10 w-full rounded-md border border-border bg-background px-3 text-[13px]"
          >
            {ACCOUNTING_ENTRY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Amount (ƒ)">
          <input
            type="text"
            inputMode="decimal"
            required
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="min-h-10 w-full rounded-md border border-border bg-background px-3 text-[13px]"
          />
        </Field>
        <Field label="Category">
          <select
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="min-h-10 w-full rounded-md border border-border bg-background px-3 text-[13px]"
          >
            <option value="">Select…</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Counterparty (optional)">
          <select
            value={counterpartyId}
            onChange={(e) => setCounterpartyId(e.target.value)}
            className="min-h-10 w-full rounded-md border border-border bg-background px-3 text-[13px]"
          >
            <option value="">None</option>
            {counterparties.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Payment method">
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
            className="min-h-10 w-full rounded-md border border-border bg-background px-3 text-[13px]"
          >
            {ACCOUNTING_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Note">
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px]"
          />
        </Field>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-foreground text-[13px] font-medium text-background disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save entry"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
