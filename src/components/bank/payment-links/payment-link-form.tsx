"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import { Textarea } from "@/components/ui/textarea";
import { createPaymentLinkRecord } from "@/lib/bank/payment-link.functions";
import { PAYMENT_LINK_FORM_INTRO } from "@/lib/bank/bank-shared-copy";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import { BankRequestErrorCard, BankRequestSubmitButton } from "@/components/bank/bank-request-submission-ui";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";

export function PaymentLinkForm({ companyId }: { companyId: string }) {
  const router = useRouter();
  const createLink = useServerFn(createPaymentLinkRecord);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [internalMemo, setInternalMemo] = useState("");
  const [amountType, setAmountType] = useState<"FIXED" | "OPEN">("FIXED");
  const [usageType, setUsageType] = useState<"ONE_TIME" | "REUSABLE">("REUSABLE");
  const [amount, setAmount] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const parsedAmount = Number(amount);
  const canSubmit =
    description.trim().length > 0 &&
    (amountType === "OPEN" ||
      (Number.isFinite(parsedAmount) && parsedAmount > 0));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const link = await createLink({
        data: {
          companyId,
          title: title.trim() || undefined,
          description: description.trim(),
          internalMemo: internalMemo.trim() || undefined,
          amountType,
          usageType,
          amount: amountType === "FIXED" ? parsedAmount : undefined,
          minAmount: amountType === "OPEN" && minAmount ? Number(minAmount) : undefined,
          maxAmount: amountType === "OPEN" && maxAmount ? Number(maxAmount) : undefined,
          expiresAt: expiresAt || null,
        },
      });
      await router.navigate({
        to: "/bank/commercial/payment-links/$linkId",
        params: { linkId: link.id },
        search: { companyId },
      });
    } catch (err) {
      setError(formatCustomerActionError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      <Card className="space-y-6 !p-6">
        <p className="text-[13px] leading-relaxed text-muted-foreground">{PAYMENT_LINK_FORM_INTRO}</p>

        <fieldset disabled={submitting} className="space-y-6 border-0 p-0 m-0 min-w-0">
          <label className="block">
            <span className={fieldLabel}>Title (optional)</span>
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <label className="block">
            <span className={fieldLabel}>Description</span>
            <input
              className={inputClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this payment for?"
              required
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={fieldLabel}>Amount type</span>
              <select
                className={inputClass}
                value={amountType}
                onChange={(e) => setAmountType(e.target.value as "FIXED" | "OPEN")}
              >
                <option value="FIXED">Fixed amount</option>
                <option value="OPEN">Open amount</option>
              </select>
            </label>
            <label className="block">
              <span className={fieldLabel}>Link type</span>
              <select
                className={inputClass}
                value={usageType}
                onChange={(e) => setUsageType(e.target.value as "ONE_TIME" | "REUSABLE")}
              >
                <option value="REUSABLE">Reusable</option>
                <option value="ONE_TIME">One-time</option>
              </select>
            </label>
          </div>

          {amountType === "FIXED" ? (
            <label className="block">
              <span className={fieldLabel}>Amount (FLR)</span>
              <input
                className={`${inputClass} tabular`}
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={fieldLabel}>Minimum (optional)</span>
                <input
                  className={`${inputClass} tabular`}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>Maximum (optional)</span>
                <input
                  className={`${inputClass} tabular`}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                />
              </label>
            </div>
          )}

          <label className="block">
            <span className={fieldLabel}>Expires (optional)</span>
            <input
              className={inputClass}
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </label>

          <label className="block">
            <span className={fieldLabel}>Internal memo (optional)</span>
            <Textarea
              autoResize
              className={`${inputClass} min-h-[80px]`}
              value={internalMemo}
              onChange={(e) => setInternalMemo(e.target.value)}
            />
          </label>
        </fieldset>

        {error ? <BankRequestErrorCard message={error} /> : null}

        <BankRequestSubmitButton
          kind="merchant_invoice"
          label="Create payment link"
          submitting={submitting}
          submittingLabel="Creating link…"
          disabled={!canSubmit}
        />
      </Card>
    </form>
  );
}
