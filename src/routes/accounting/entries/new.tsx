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
        const matching = cats.filter((c) => c.kind === type || c.kind === "both");
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
        <h1 className="text-2xl font-semibold">Add Transaction</h1>
        <p className="mt-1 text-sm text-gray-600">Amounts are in florins (ƒ).</p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <Field label="Date">
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Type">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
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
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Category">
          <select
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
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
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
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
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
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
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save transaction"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
